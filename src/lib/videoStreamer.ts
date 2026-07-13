import { supabase } from '@/integrations/supabase/client';

const PREFETCH_COUNT = 8;

export class StreamDecryptorService {
  static isListening = false;
  static seededFiles = new Set<string>();
  static seedingPromises = new Map<string, Promise<void>>();

  static initListener(shareId?: string) {
    if (!('serviceWorker' in navigator) || this.isListening) return;
    this.isListening = true;
  }

  static async seedFileMeta(fileId: string, shareId?: string): Promise<void> {
    if (this.seededFiles.has(fileId)) return;
    if (this.seedingPromises.has(fileId)) return this.seedingPromises.get(fileId)!;
    const p = this._doSeed(fileId, shareId);
    this.seedingPromises.set(fileId, p);
    return p;
  }

  private static async _doSeed(fileId: string, shareId?: string): Promise<void> {
    const sw = await Promise.race([
      navigator.serviceWorker?.ready,
      new Promise<null>((r) => setTimeout(() => r(null), 5000)),
    ]);
    const controller = (sw as ServiceWorkerRegistration)?.active ?? navigator.serviceWorker?.controller;
    if (!controller) {
      console.warn('[Streamer] No SW controller, skipping seed');
      this.seedingPromises.delete(fileId);
      return;
    }

    try {
      const { data: file, error } = await supabase.from('files').select('*').eq('id', fileId).single();
      if (error || !file) throw new Error('File metadata not found');

      const fileMeta = JSON.parse(file.tags[0]);
      const chunks = fileMeta.chunks
        .filter((c: any) => c.repo && c.path)
        .sort((a: any, b: any) => a.index - b.index);

      const STANDARD_CHUNK_SIZE = 8 * 1024 * 1024;

      const meta = {
        fileId,
        fileSize: file.size,
        fileType: file.type,
        encryptionKey: fileMeta.encryptionKey,
        chunks,
        chunkSize: STANDARD_CHUNK_SIZE,
      };

      controller.postMessage({ type: 'SET_META', fileId, meta });

      const { data: { session } } = await supabase.auth.getSession();
      const urls: Record<number, string> = {};

      const BATCH = 10;
      for (let i = 0; i < chunks.length; i += BATCH) {
        const batch = chunks.slice(i, i + BATCH);
        await Promise.allSettled(batch.map(async (chunk: any) => {
          try {
            const body: any = { action: 'download', path: chunk.path, repo: chunk.repo };
            if (shareId) body.shareId = shareId;
            else if (session?.user?.id) body.userId = session.user.id;
            if (chunk.accountId) body.nodeId = chunk.accountId - 1;

            const response = await supabase.functions.invoke('github-storage', { body });
            if (response.error) throw new Error(response.error.message);

            const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
            if (data.downloadUrl) urls[chunk.index] = data.downloadUrl;
          } catch (e) {
            console.warn(`[Streamer] URL failed chunk ${chunk.index}:`, e);
          }
        }));

        controller.postMessage({ type: 'SET_URLS', fileId, urls });
      }

      controller.postMessage({ type: 'SET_URLS', fileId, urls });

      this.seededFiles.add(fileId);
      this.seedingPromises.delete(fileId);

      const prefetchIndices: number[] = [];
      for (let d = 1; d <= PREFETCH_COUNT; d++) {
        if (d < chunks.length) prefetchIndices.push(d);
      }
      if (prefetchIndices.length > 0) {
        controller.postMessage({ type: 'PREFETCH', fileId, indices: prefetchIndices });
      }
    } catch (err) {
      console.error('[Streamer] Seed failed:', err);
      this.seedingPromises.delete(fileId);
      throw err;
    }
  }
}

import { supabase } from '@/integrations/supabase/client';
import { cacheFileMeta, cacheDownloadUrls, type CachedFileMeta } from './videoStreamCache';

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

    const promise = this._doSeed(fileId, shareId);
    this.seedingPromises.set(fileId, promise);
    return promise;
  }

  private static async _doSeed(fileId: string, shareId?: string): Promise<void> {
    if (!navigator.serviceWorker?.controller) {
      await navigator.serviceWorker?.ready;
    }
    const sw = navigator.serviceWorker?.controller;
    if (!sw) return;

    try {
      const { data: file, error } = await supabase.from('files').select('*').eq('id', fileId).single();
      if (error || !file) throw new Error('File metadata not found');

      const meta = JSON.parse(file.tags[0]);
      const chunks = meta.chunks
        .filter((c: any) => c.repo && c.path)
        .sort((a: any, b: any) => a.index - b.index);

      const STANDARD_CHUNK_SIZE = 8 * 1024 * 1024;

      const cachedMeta: CachedFileMeta = {
        fileId,
        fileSize: file.size,
        fileType: file.type,
        encryptionKey: meta.encryptionKey,
        chunks,
        chunkSize: STANDARD_CHUNK_SIZE,
        ts: Date.now(),
      };

      await cacheFileMeta(cachedMeta);
      sw.postMessage({ type: 'CACHE_FILE_META', fileId, meta: cachedMeta });

      const { data: { session } } = await supabase.auth.getSession();
      const urlObj: Record<number, string> = {};

      const BATCH = 10;
      for (let i = 0; i < chunks.length; i += BATCH) {
        const batch = chunks.slice(i, i + BATCH);
        await Promise.allSettled(batch.map(async (chunk) => {
          try {
            const body: any = {
              action: 'download',
              path: chunk.path,
              repo: chunk.repo,
            };
            if (shareId) body.shareId = shareId;
            else if (session?.user?.id) body.userId = session.user.id;
            if (chunk.accountId) body.nodeId = chunk.accountId - 1;

            const response = await supabase.functions.invoke('github-storage', { body });
            if (response.error) throw new Error(response.error.message);

            const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
            if (data.downloadUrl) {
              urlObj[chunk.index] = data.downloadUrl;
            }
          } catch (e) {
            console.warn(`[Streamer] URL fetch failed chunk ${chunk.index}:`, e);
          }
        }));
      }

      const urls = new Map<number, string>();
      Object.entries(urlObj).forEach(([k, v]) => urls.set(Number(k), v));
      await cacheDownloadUrls(fileId, urls);

      sw.postMessage({ type: 'CACHE_DOWNLOAD_URLS', fileId, urls: urlObj });

      this.seededFiles.add(fileId);
      this.seedingPromises.delete(fileId);

      if (sw) {
        const prefetchIndices: number[] = [];
        for (let d = 1; d <= PREFETCH_COUNT; d++) {
          if (d < chunks.length) prefetchIndices.push(d);
        }
        sw.postMessage({ type: 'PREFETCH_CHUNKS', fileId, chunkIndices: prefetchIndices });
      }

    } catch (err) {
      console.error('[Streamer] Seed failed:', err);
      this.seedingPromises.delete(fileId);
      throw err;
    }
  }
}

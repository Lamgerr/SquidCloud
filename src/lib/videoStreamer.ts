import { supabase } from '@/integrations/supabase/client';
import { fetchFileEncryptionKey } from '@/lib/secure-file-metadata';
import { getV4Master } from '@/lib/e2e-v4-session';

const PREFETCH_COUNT = 8;
const BATCH_SIZE = 10;

export class StreamDecryptorService {
  static isListening = false;
  static seededFiles = new Set<string>();
  static seedingPromises = new Map<string, Promise<void>>();

  static initListener(shareId?: string) {
    if (!('serviceWorker' in navigator) || this.isListening) return;
    this.isListening = true;
  }

/** Hand the in-memory v4 master to the service worker for this session so it
 *  can decrypt byte ranges on demand instead of downloading the whole file. */
  static async seedV4Key(fileId: string, meta: {
    fileId: string; saltB64: string; userId?: string; chunkSize?: number; totalChunks?: number;
  }): Promise<boolean> {
    const master = getV4Master();
    if (!master) return false;
    let reg: ServiceWorkerRegistration | null = null;
    try {
      reg = await Promise.race([
        navigator.serviceWorker?.ready,
        new Promise<null>((r) => setTimeout(() => r(null), 5000)),
      ]) ?? null;
    } catch { /* no SW support */ }
    const controller = (reg as ServiceWorkerRegistration | null)?.active ?? navigator.serviceWorker?.controller;
    if (!controller) return false;
    // Transfer a copy so the page's in-memory master stays usable.
    const copy = master.slice();
    controller.postMessage({
      type: 'SET_V4',
      fileId,
      v4: {
        fileId: meta.fileId,
        saltB64: meta.saltB64,
        userId: meta.userId || '',
        chunkSize: meta.chunkSize || 1024 * 1024,
        totalChunks: meta.totalChunks || 1,
        master: copy.buffer,
      },
    }, [copy.buffer]);
    return true;
  }

  static async seedFileMeta(fileId: string, shareId?: string): Promise<void> {
    if (this.seededFiles.has(fileId)) return;
    if (this.seedingPromises.has(fileId)) return this.seedingPromises.get(fileId)!;
    const p = this._doSeed(fileId, shareId);
    this.seedingPromises.set(fileId, p);
    return p;
  }

  private static async _getChunkUrl(
    chunk: any,
    session: any,
    shareId?: string
  ): Promise<string | null> {
    try {
      // Custom S3-compatible provider
      if (chunk.providerId) {
        const { data, error } = await supabase.functions.invoke('s3-storage', {
          body: { action: 'get-download-url', providerId: chunk.providerId, path: chunk.path }
        });
        if (error || !data?.success) throw new Error(error?.message || 'S3 download error');
        return data.downloadUrl;
      }

      const body: any = { action: 'download', path: chunk.path, repo: chunk.repo };
      if (shareId) body.shareId = shareId;
      else if (session?.user?.id) body.userId = session.user.id;

      // Legacy GitHub repo path
      if (chunk.repo && chunk.repo !== 'b2') {
        if (chunk.accountId) body.nodeId = chunk.accountId - 1;
      } else {
        // B2 via squidcloud-cluster universal dispatch
        if (chunk.clusterId) body.clusterId = chunk.clusterId;
        if (chunk.bucket) body.bucket = chunk.bucket;
      }

      const response = await supabase.functions.invoke('squidcloud-cluster', { body });
      if (response.error) throw new Error(response.error.message);

      const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      if (data.downloadUrl) return data.downloadUrl;
      throw new Error('No downloadUrl in response');
    } catch (e) {
      console.warn(`[Streamer] URL failed chunk ${chunk.index}:`, e);
      return null;
    }
  }

  private static async _doSeed(fileId: string, shareId?: string): Promise<void> {
    let sw: ServiceWorkerRegistration | null = null;
    try {
      sw = await Promise.race([
        navigator.serviceWorker?.ready,
        new Promise<null>((r) => setTimeout(() => r(null), 5000)),
      ]);
    } catch {}

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

      if (chunks.length === 0) throw new Error('No downloadable chunks found');

      let encryptionKey = fileMeta.encryptionKey;
      if (encryptionKey === 'managed_key' || !encryptionKey) {
        try {
          const fetched = await fetchFileEncryptionKey(fileId);
          if (fetched) encryptionKey = fetched;
        } catch (keyError) {
          console.warn('[Streamer] Managed key fetch failed, streaming decryption will fail:', keyError);
        }
      }

      // Chunk layout varies by upload pipeline: newer records carry per-chunk
      // offsets, older ones only a top-level chunkSize (or per-chunk size).
      // Never allow NaN/0 through — SW findChunk would 416 every request and
      // the player would fail the file after 8 blind retries.
      const o1 = chunks.length > 1 ? chunks[1]?.offset : undefined;
      const o0 = chunks.length > 0 ? chunks[0]?.offset : undefined;
      let actualChunkSize =
        typeof o1 === 'number' && typeof o0 === 'number' ? o1 - o0 : NaN;
      if (!Number.isFinite(actualChunkSize) || actualChunkSize <= 0) {
        const metaChunkSize = (fileMeta as any)?.chunkSize;
        actualChunkSize =
          typeof metaChunkSize === 'number' && metaChunkSize > 0 ? metaChunkSize : NaN;
      }
      if (!Number.isFinite(actualChunkSize) || actualChunkSize <= 0) {
        const s0 = chunks[0]?.size;
        actualChunkSize =
          typeof s0 === 'number' && s0 > 0
            ? s0
            : Math.max(1, Math.floor(file.size / Math.max(1, chunks.length)));
      }

      const meta = {
        fileId,
        fileSize: file.size,
        fileType: file.type,
        encryptionKey,
        chunks,
        chunkSize: actualChunkSize,
      };

      controller.postMessage({ type: 'SET_META', fileId, meta });

      const { data: { session } } = await supabase.auth.getSession();
      const urls: Record<number, string> = {};

      const firstBatchEnd = Math.min(BATCH_SIZE, chunks.length);
      const firstBatch = chunks.slice(0, firstBatchEnd);

      await Promise.allSettled(firstBatch.map(async (chunk: any) => {
        const url = await this._getChunkUrl(chunk, session, shareId);
        if (url) urls[chunk.index] = url;
      }));

      controller.postMessage({ type: 'SET_URLS', fileId, urls });

      this.seededFiles.add(fileId);
      this.seedingPromises.delete(fileId);

      if (firstBatchEnd < chunks.length) {
        const remainingChunks = chunks.slice(firstBatchEnd);
        this._fetchRemainingUrls(controller, fileId, remainingChunks, session, shareId, urls);
      }

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

  private static async _fetchRemainingUrls(
    controller: ServiceWorker,
    fileId: string,
    chunks: any[],
    session: any,
    shareId?: string,
    existingUrls?: Record<number, string>
  ) {
    const urls = { ...(existingUrls || {}) };

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(batch.map(async (chunk: any) => {
        const url = await this._getChunkUrl(chunk, session, shareId);
        if (url) urls[chunk.index] = url;
      }));

      try {
        controller.postMessage({ type: 'SET_URLS', fileId, urls });
      } catch {}
    }
  }
}

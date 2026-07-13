import { supabase } from '@/integrations/supabase/client';
import { cacheFileMeta, cacheDownloadUrls, type CachedFileMeta } from './videoStreamCache';

const PREFETCH_COUNT = 8;
const URL_REFRESH_THRESHOLD = 60 * 60 * 1000;

function findChunkForByte(chunks: any[], fileSize: number, chunkSize: number, startByte: number) {
  let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    const sz = i === chunks.length - 1 ? (fileSize % chunkSize || chunkSize) : chunkSize;
    if (startByte >= offset && startByte < offset + sz) {
      return { chunkIndex: chunks[i].index, chunkStartOffset: offset };
    }
    offset += sz;
  }
  return null;
}

export class StreamDecryptorService {
  static isListening = false;
  static seededFiles = new Set<string>();

  static initListener(shareId?: string) {
    if (!('serviceWorker' in navigator) || this.isListening) return;
    this.isListening = true;
  }

  static async seedFileMeta(fileId: string, shareId?: string): Promise<void> {
    if (this.seededFiles.has(fileId)) return;
    if (!navigator.serviceWorker?.controller) return;

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

      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_FILE_META',
        fileId,
        meta: cachedMeta,
      });

      const { data: { session } } = await supabase.auth.getSession();
      const urls = new Map<number, string>();

      const downloadPromises = chunks.map(async (chunk) => {
        try {
          const body: any = {
            action: 'download',
            path: chunk.path,
            repo: chunk.repo,
          };
          if (shareId) {
            body.shareId = shareId;
          } else if (session?.user?.id) {
            body.userId = session.user.id;
          }
          if (chunk.accountId) {
            body.nodeId = chunk.accountId - 1;
          }

          const response = await supabase.functions.invoke('github-storage', { body });
          if (response.error) throw new Error(response.error.message);

          const responseData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
          if (responseData.downloadUrl) {
            urls.set(chunk.index, responseData.downloadUrl);
          }
        } catch (e) {
          console.warn(`[Streamer] Failed to get URL for chunk ${chunk.index}:`, e);
        }
      });

      await Promise.all(downloadPromises);

      const urlObj: Record<number, string> = {};
      urls.forEach((v, k) => { urlObj[k] = v; });
      await cacheDownloadUrls(fileId, urls);

      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_DOWNLOAD_URLS',
        fileId,
        urls: urlObj,
      });

      this.seededFiles.add(fileId);

      this.prefetchChunks(fileId, 0, chunks);

    } catch (err) {
      console.error('[Streamer] Seed failed:', err);
    }
  }

  static prefetchChunks(fileId: string, currentIndex: number, chunks: any[]) {
    if (!navigator.serviceWorker?.controller) return;
    const indices: number[] = [];
    for (let d = 1; d <= PREFETCH_COUNT; d++) {
      const idx = currentIndex + d;
      if (idx < chunks.length) indices.push(idx);
    }
    if (indices.length > 0) {
      navigator.serviceWorker.controller.postMessage({
        type: 'PREFETCH_CHUNKS',
        fileId,
        chunkIndices: indices,
      });
    }
  }
}

import { downloadChunk } from './res54';
import { decryptData } from './encryption';
import { supabase } from '@/integrations/supabase/client';

const DECRYPT_CACHE_MAX = 12;
const chunkCache = new Map<string, { data: ArrayBuffer; timestamp: number }>();
const inflightRequests = new Map<string, Promise<ArrayBuffer>>();

function cacheKey(fileId: string, index: number) {
  return `${fileId}:${index}`;
}

function evictOldest() {
  if (chunkCache.size <= DECRYPT_CACHE_MAX) return;
  let oldestKey = '';
  let oldestTs = Infinity;
  for (const [k, v] of chunkCache) {
    if (v.timestamp < oldestTs) {
      oldestTs = v.timestamp;
      oldestKey = k;
    }
  }
  if (oldestKey) chunkCache.delete(oldestKey);
}

async function fetchAndDecryptChunk(
  chunk: any,
  meta: any,
  shareId?: string,
  fileId?: string
): Promise<ArrayBuffer> {
  const key = cacheKey(fileId || '', chunk.index);
  const cached = chunkCache.get(key);
  if (cached) return cached.data;

  const inflight = inflightRequests.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const downloadResult = await downloadChunk(chunk, 0, shareId);
      const decrypted = await decryptData(downloadResult.data, meta.encryptionKey);
      chunkCache.set(key, { data: decrypted, timestamp: Date.now() });
      evictOldest();
      inflightRequests.delete(key);
      return decrypted;
    } catch (err) {
      inflightRequests.delete(key);
      throw err;
    }
  })();

  inflightRequests.set(key, promise);
  return promise;
}

export class StreamDecryptorService {
  static isListening = false;

  static initListener(shareId?: string) {
    if (!('serviceWorker' in navigator) || this.isListening) return;
    
    this.isListening = true;

    navigator.serviceWorker.addEventListener('message', async (event) => {
      if (event.data && event.data.type === 'REQUEST_DECRYPT_STREAM') {
        const { fileId, range, requestId } = event.data;
        
        try {
          const match = range.match(/bytes=(\d+)-(\d*)/);
          const startByte = match ? parseInt(match[1], 10) : 0;
          const requestedEndByte = (match && match[2]) ? parseInt(match[2], 10) : undefined;
          
          const { data: file, error: dbError } = await supabase.from('files').select('*').eq('id', fileId).single();
          if (dbError || !file) throw new Error("File metadata not found");

          const meta = JSON.parse(file.tags[0]);
          const chunks = meta.chunks.filter((c: any) => c.repo && c.path).sort((a: any, b: any) => a.index - b.index);
          const STANDARD_CHUNK_SIZE = 8 * 1024 * 1024;

          let targetChunk = null;
          let chunkStartOffset = 0;
          let currentOffset = 0;

          for (let i = 0; i < chunks.length; i++) {
            const cSize = (i === chunks.length - 1) ? (file.size % STANDARD_CHUNK_SIZE || STANDARD_CHUNK_SIZE) : STANDARD_CHUNK_SIZE;
            if (startByte >= currentOffset && startByte < currentOffset + cSize) {
              targetChunk = chunks[i];
              chunkStartOffset = currentOffset;
              break;
            }
            currentOffset += cSize;
          }

          if (!targetChunk) throw new Error("Requested byte range is out of bounds");

          const decryptedBuffer = await fetchAndDecryptChunk(targetChunk, meta, shareId, fileId);

          const localStart = startByte - chunkStartOffset;
          const maxLocalEnd = decryptedBuffer.byteLength - 1;
          const localEnd = requestedEndByte !== undefined 
            ? Math.min(maxLocalEnd, requestedEndByte - chunkStartOffset) 
            : maxLocalEnd;

          const slicedBuffer = decryptedBuffer.slice(localStart, localEnd + 1);
          const endByte = startByte + slicedBuffer.byteLength - 1;

          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'DECRYPT_STREAM_RESPONSE',
              requestId,
              buffer: slicedBuffer,
              start: startByte,
              end: endByte,
              totalSize: file.size,
              contentType: file.type
            }, [slicedBuffer]);
          }

          StreamDecryptorService.prefetchAdjacent(fileId, targetChunk.index, chunks, meta, shareId, file.size, STANDARD_CHUNK_SIZE);

        } catch (err: any) {
          console.error('[VirtualServer] Decryption failed:', err);
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'DECRYPT_STREAM_RESPONSE',
              requestId,
              error: err?.message || 'Decryption pipeline failure'
            });
          }
        }
      }
    });
  }

  private static prefetchAdjacent(
    fileId: string,
    currentIndex: number,
    chunks: any[],
    meta: any,
    shareId?: string,
    totalSize?: number,
    chunkSize?: number
  ) {
    const prefetchIndices: number[] = [];
    for (let delta = 1; delta <= 3; delta++) {
      const nextIdx = currentIndex + delta;
      if (nextIdx < chunks.length) prefetchIndices.push(nextIdx);
    }
    prefetchIndices.forEach((idx, i) => {
      setTimeout(() => {
        const key = cacheKey(fileId, idx);
        if (!chunkCache.has(key) && !inflightRequests.has(key)) {
          fetchAndDecryptChunk(chunks[idx], meta, shareId, fileId).catch(() => {});
        }
      }, i * 300);
    });
  }
}

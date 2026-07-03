import { downloadChunk } from './res54';
import { decryptData } from './encryption';
import { supabase } from '@/integrations/supabase/client';

const chunkCache = new Map<number, ArrayBuffer>();

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
          const STANDARD_CHUNK_SIZE = 8 * 1024 * 1024; // 8MB Backblaze chunks

          // 1. Locate the exact chunk containing the requested startByte
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

          // 2. Fetch and decrypt the target chunk (or retrieve from RAM cache)
          let decryptedBuffer: ArrayBuffer;
          if (chunkCache.has(targetChunk.index)) {
            decryptedBuffer = chunkCache.get(targetChunk.index)!;
          } else {
            const downloadResult = await downloadChunk(targetChunk, 0, shareId);
            decryptedBuffer = await decryptData(downloadResult.data, meta.encryptionKey);
            
            chunkCache.set(targetChunk.index, decryptedBuffer);
            if (chunkCache.size > 3) {
              const oldestKey = chunkCache.keys().next().value;
              if (oldestKey !== undefined) chunkCache.delete(oldestKey);
            }
          }

          // 3. Slice the exact requested byte window inside this chunk
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
            }, [slicedBuffer]); // Transferable object for zero-copy memory transfer
          }

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
}

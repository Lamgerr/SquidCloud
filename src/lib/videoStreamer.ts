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
          const match = range.match(/bytes=(\d+)-(.*)/);
          const startByte = match ? parseInt(match[1], 10) : 0;
          
          const { data: file } = await supabase.from('files').select('*').eq('id', fileId).single();
          if (!file) throw new Error("File not found");

          const meta = JSON.parse(file.tags[0]);
          const chunks = meta.chunks.filter((c: any) => c.repo && c.path).sort((a: any, b: any) => a.index - b.index);
          const STANDARD_CHUNK_SIZE = 8 * 1024 * 1024; // 8MB Backblaze chunks

          // 1. Calculate exactly which chunk contains the requested startByte
          let targetChunk = null;
          let chunkStartOffset = 0;
          let currentOffset = 0;

          for (let i = 0; i < chunks.length; i++) {
            // Assume 8MB size, except the very last chunk
            const cSize = (i === chunks.length - 1) ? (file.size % STANDARD_CHUNK_SIZE || STANDARD_CHUNK_SIZE) : STANDARD_CHUNK_SIZE;
            
            if (startByte >= currentOffset && startByte < currentOffset + cSize) {
              targetChunk = chunks[i];
              chunkStartOffset = currentOffset;
              break;
            }
            currentOffset += cSize;
          }

          if (!targetChunk) throw new Error("Requested bytes out of bounds");

          // 2. Fetch and decrypt ONLY that specific chunk (or load from LRU cache)
          let decryptedBuffer: ArrayBuffer;
          if (chunkCache.has(targetChunk.index)) {
            decryptedBuffer = chunkCache.get(targetChunk.index)!;
          } else {
            const downloadResult = await downloadChunk(targetChunk, 0, shareId);
            decryptedBuffer = await decryptData(downloadResult.data, meta.encryptionKey);
            
            // Prevent RAM crashes by keeping only the 3 most recent chunks
            chunkCache.set(targetChunk.index, decryptedBuffer);
            if (chunkCache.size > 3) chunkCache.delete(chunkCache.keys().next().value!);
          }

          // 3. Slice the exact bytes requested and return them to the Service Worker
          const localStart = startByte - chunkStartOffset;
          const slicedBuffer = decryptedBuffer.slice(localStart); // Send the rest of this chunk
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
            }, [slicedBuffer]); // Transferable object for zero-copy max performance!
          }

        } catch (err) {
          console.error('[VirtualServer] Decryption failed:', err);
        }
      }
    });
  }
}

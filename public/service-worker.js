const CACHE_NAME = 'squidcloud-v12.0.22-streamer';
const API_CACHE = 'api-cache-v2';
const STATIC_CACHE = 'static-cache-v3';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

const DB_NAME = 'squidcloud-video-stream';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('file-meta')) db.createObjectStore('file-meta');
      if (!db.objectStoreNames.contains('download-urls')) db.createObjectStore('download-urls');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getCachedMeta(fileId) {
  try {
    const db = await openDB();
    const tx = db.transaction('file-meta', 'readonly');
    const req = tx.objectStore('file-meta').get(fileId);
    return new Promise((resolve) => {
      req.onsuccess = () => { db.close(); resolve(req.result || null); };
      req.onerror = () => { db.close(); resolve(null); };
    });
  } catch { return null; }
}

async function getCachedUrls(fileId) {
  try {
    const db = await openDB();
    const tx = db.transaction('download-urls', 'readonly');
    const req = tx.objectStore('download-urls').get(fileId);
    return new Promise((resolve) => {
      req.onsuccess = () => { db.close(); resolve(req.result || null); };
      req.onerror = () => { db.close(); resolve(null); };
    });
  } catch { return null; }
}

const chunkDecryptCache = new Map();
const inflight = new Map();

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 32768;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function aesGcmDecrypt(iv, encrypted, keyStr, additionalData) {
  const keyBytes = new TextEncoder().encode(keyStr.slice(0, 32).padEnd(32, '0'));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const opts = { name: 'AES-GCM', iv };
  if (additionalData) opts.additionalData = additionalData;
  return crypto.subtle.decrypt(opts, key, encrypted);
}

async function decryptChunk(data, encryptionKey) {
  let binary;
  if (typeof data === 'string') {
    binary = base64ToArrayBuffer(data);
  } else {
    binary = new Uint8Array(data);
  }

  const headerLen = new DataView(binary.buffer, 0, 4).getUint32(0, true);
  if (headerLen > 0 && headerLen < 1000) {
    try {
      const header = JSON.parse(new TextDecoder().decode(binary.slice(4, 4 + headerLen)));
      if (header.version >= 2 && header.chunks > 0 && Array.isArray(header.ivs)) {
        let offset = 4 + headerLen;
        const chunkSize = header.chunkSize || Math.ceil((binary.byteLength - offset) / header.chunks);
        const results = [];
        for (let i = 0; i < header.chunks; i++) {
          const iv = typeof header.ivs[i] === 'string' ? base64ToArrayBuffer(header.ivs[i]) : new Uint8Array(header.ivs[i]);
          const end = Math.min(offset + chunkSize, binary.byteLength);
          const encrypted = binary.slice(offset, end);
          const decrypted = await aesGcmDecrypt(iv, encrypted, encryptionKey);
          results.push(new Uint8Array(decrypted));
          offset = end;
        }
        const totalLen = results.reduce((s, b) => s + b.byteLength, 0);
        const merged = new Uint8Array(totalLen);
        let pos = 0;
        for (const r of results) { merged.set(r, pos); pos += r.byteLength; }
        return merged.buffer;
      }
    } catch (e) { /* not multi-chunk */ }
  }

  try {
    const dataLen = new DataView(binary.buffer, 0, 4).getUint32(0, true);
    const additionalData = binary.slice(4, 4 + dataLen);
    const iv = binary.slice(4 + dataLen, 4 + dataLen + 12);
    const encrypted = binary.slice(4 + dataLen + 12);
    return await aesGcmDecrypt(iv, encrypted, encryptionKey, additionalData);
  } catch (e) {
    if (binary.byteLength > 12) {
      const iv = binary.slice(0, 12);
      const encrypted = binary.slice(12);
      return await aesGcmDecrypt(iv, encrypted, encryptionKey);
    }
    throw e;
  }
}

async function fetchDecryptCache(fileId, chunkIndex, encryptionKey, urls) {
  const key = `${fileId}:${chunkIndex}`;
  const cached = chunkDecryptCache.get(key);
  if (cached) return cached;

  if (inflight.has(key)) return inflight.get(key);

  const promise = (async () => {
    try {
      const url = urls[chunkIndex];
      if (!url) throw new Error(`No URL for chunk ${chunkIndex}`);

      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`B2 ${resp.status}`);

      const arrayBuf = await resp.arrayBuffer();
      const decrypted = await decryptChunk(arrayBuf, encryptionKey);

      chunkDecryptCache.set(key, decrypted);
      if (chunkDecryptCache.size > 20) {
        const oldest = chunkDecryptCache.keys().next().value;
        if (oldest !== undefined) chunkDecryptCache.delete(oldest);
      }
      inflight.delete(key);
      return decrypted;
    } catch (err) {
      inflight.delete(key);
      throw err;
    }
  })();

  inflight.set(key, promise);
  return promise;
}

function findChunkForByte(chunks, fileSize, chunkSize, startByte) {
  let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    const sz = i === chunks.length - 1 ? (fileSize % chunkSize || chunkSize) : chunkSize;
    if (startByte >= offset && startByte < offset + sz) {
      return { chunkIndex: chunks[i].index, chunkStartOffset: offset, chunkSize: sz };
    }
    offset += sz;
  }
  return null;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/virtual-stream/')) {
    const fileId = url.pathname.split('/').pop();
    const rangeHeader = event.request.headers.get('range');

    event.respondWith(
      (async () => {
        try {
          const meta = await getCachedMeta(fileId);
          if (!meta) return new Response('Metadata not cached', { status: 503 });

          const urls = await getCachedUrls(fileId);
          if (!urls) return new Response('URLs not cached', { status: 503 });

          let startByte = 0;
          let requestedEndByte = undefined;

          if (rangeHeader) {
            const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
            if (match) {
              startByte = parseInt(match[1], 10);
              if (match[2]) requestedEndByte = parseInt(match[2], 10);
            }
          }

          const target = findChunkForByte(meta.chunks, meta.fileSize, meta.chunkSize, startByte);
          if (!target) return new Response('Range out of bounds', { status: 416 });

          const decryptedBuffer = await fetchDecryptCache(fileId, target.chunkIndex, meta.encryptionKey, urls);

          const localStart = startByte - target.chunkStartOffset;
          const maxEnd = decryptedBuffer.byteLength - 1;
          const localEnd = requestedEndByte !== undefined
            ? Math.min(maxEnd, requestedEndByte - target.chunkStartOffset)
            : maxEnd;

          const sliced = decryptedBuffer.slice(localStart, localEnd + 1);
          const endByte = startByte + sliced.byteLength - 1;

          const headers = new Headers({
            'Content-Type': meta.fileType || 'video/mp4',
            'Accept-Ranges': 'bytes',
            'Content-Range': `bytes ${startByte}-${endByte}/${meta.fileSize}`,
            'Content-Length': sliced.byteLength.toString(),
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          });

          return new Response(sliced, { status: 206, headers });
        } catch (err) {
          console.error('[SW Stream]', err.message);
          return new Response('Stream error: ' + err.message, { status: 500 });
        }
      })()
    );
    return;
  }

  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CACHE_FILE_META') {
    const { fileId, meta } = event.data;
    openDB().then(db => {
      const tx = db.transaction('file-meta', 'readwrite');
      tx.objectStore('file-meta').put(meta, fileId);
      tx.oncomplete = () => db.close();
    });
  }

  if (event.data?.type === 'CACHE_DOWNLOAD_URLS') {
    const { fileId, urls } = event.data;
    openDB().then(db => {
      const tx = db.transaction('download-urls', 'readwrite');
      tx.objectStore('download-urls').put(urls, fileId);
      tx.oncomplete = () => db.close();
    });
  }

  if (event.data?.type === 'PREFETCH_CHUNKS') {
    const { fileId, chunkIndices } = event.data;
    (async () => {
      const meta = await getCachedMeta(fileId);
      const urls = await getCachedUrls(fileId);
      if (!meta || !urls) return;
      for (const idx of chunkIndices) {
        if (urls[idx] && !chunkDecryptCache.has(`${fileId}:${idx}`)) {
          fetchDecryptCache(fileId, idx, meta.encryptionKey, urls).catch(() => {});
          await new Promise(r => setTimeout(r, 100));
        }
      }
    })();
  }
});

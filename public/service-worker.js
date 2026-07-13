const CACHE_NAME = 'squidcloud-v12.0.24-streamer';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

const metaCache = new Map();
const urlCache = new Map();
const decryptCache = new Map();
const inflight = new Map();

async function aesGcmDecrypt(iv, encrypted, keyStr, aad) {
  const keyBytes = new TextEncoder().encode(keyStr.slice(0, 32).padEnd(32, '0'));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const opts = { name: 'AES-GCM', iv };
  if (aad) opts.additionalData = aad;
  return crypto.subtle.decrypt(opts, key, encrypted);
}

async function decryptChunk(rawData, encryptionKey) {
  let bin;
  if (rawData instanceof ArrayBuffer) {
    bin = new Uint8Array(rawData);
  } else {
    bin = new Uint8Array(rawData);
  }
  if (bin.byteLength < 16) throw new Error('Data too small to decrypt');

  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const first4 = dv.getUint32(0, true);

  if (first4 > 0 && first4 < 1000 && first4 < bin.byteLength - 4) {
    try {
      const header = JSON.parse(new TextDecoder().decode(bin.slice(4, 4 + first4)));
      if (header.version >= 2 && header.chunks > 0 && Array.isArray(header.ivs)) {
        let offset = 4 + first4;
        const chunkSz = header.chunkSize || Math.ceil((bin.byteLength - offset) / header.chunks);
        const parts = [];
        for (let i = 0; i < header.chunks; i++) {
          const iv = typeof header.ivs[i] === 'string'
            ? Uint8Array.from(atob(header.ivs[i]), c => c.charCodeAt(0))
            : new Uint8Array(header.ivs[i]);
          const end = Math.min(offset + chunkSz, bin.byteLength);
          parts.push(new Uint8Array(await aesGcmDecrypt(iv, bin.slice(offset, end), encryptionKey)));
          offset = end;
        }
        const total = parts.reduce((s, p) => s + p.byteLength, 0);
        const out = new Uint8Array(total);
        let pos = 0;
        for (const p of parts) { out.set(p, pos); pos += p.byteLength; }
        return out.buffer;
      }
    } catch {}
  }

  try {
    const aadLen = dv.getUint32(0, true);
    const aad = bin.slice(4, 4 + aadLen);
    const iv = bin.slice(4 + aadLen, 4 + aadLen + 12);
    const enc = bin.slice(4 + aadLen + 12);
    return await aesGcmDecrypt(iv, enc, encryptionKey, aad);
  } catch (e1) {
    try {
      return await aesGcmDecrypt(bin.slice(0, 12), bin.slice(12), encryptionKey);
    } catch (e2) {
      throw new Error('Decrypt failed: ' + e1.message);
    }
  }
}

async function fetchDecrypt(fileId, chunkIdx, encryptionKey, urls) {
  const ck = `${fileId}:${chunkIdx}`;
  if (decryptCache.has(ck)) return decryptCache.get(ck);
  if (inflight.has(ck)) return inflight.get(ck);

  const p = (async () => {
    try {
      const url = urls[chunkIdx];
      if (!url) throw new Error('No URL for chunk ' + chunkIdx);
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('B2 ' + r.status);
      const buf = await r.arrayBuffer();
      const plain = await decryptChunk(buf, encryptionKey);
      decryptCache.set(ck, plain);
      if (decryptCache.size > 20) {
        const oldest = decryptCache.keys().next().value;
        if (oldest !== undefined) decryptCache.delete(oldest);
      }
      inflight.delete(ck);
      return plain;
    } catch (err) {
      inflight.delete(ck);
      throw err;
    }
  })();
  inflight.set(ck, p);
  return p;
}

function findChunk(chunks, fileSize, chunkSize, startByte) {
  let off = 0;
  for (let i = 0; i < chunks.length; i++) {
    const sz = i === chunks.length - 1 ? (fileSize % chunkSize || chunkSize) : chunkSize;
    if (startByte >= off && startByte < off + sz) return { idx: chunks[i].index, off };
    off += sz;
  }
  return null;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith('/virtual-stream/')) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  const fileId = url.pathname.split('/').pop();
  const rangeHeader = event.request.headers.get('range');

  event.respondWith((async () => {
    try {
      const meta = metaCache.get(fileId);
      if (!meta) return new Response('No metadata for ' + fileId, { status: 503 });
      const urls = urlCache.get(fileId);
      if (!urls) return new Response('No URLs for ' + fileId, { status: 503 });

      let startByte = 0;
      let endByte;
      if (rangeHeader) {
        const m = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (m) { startByte = parseInt(m[1], 10); if (m[2]) endByte = parseInt(m[2], 10); }
      }

      const t = findChunk(meta.chunks, meta.fileSize, meta.chunkSize, startByte);
      if (!t) return new Response('Range OOB', { status: 416 });

      const plain = await fetchDecrypt(fileId, t.idx, meta.encryptionKey, urls);
      const locStart = startByte - t.off;
      const locEnd = endByte !== undefined ? Math.min(plain.byteLength - 1, endByte - t.off) : plain.byteLength - 1;
      const sliced = plain.slice(locStart, locEnd + 1);
      const respEnd = startByte + sliced.byteLength - 1;

      return new Response(sliced, {
        status: 206,
        headers: {
          'Content-Type': meta.fileType || 'video/mp4',
          'Accept-Ranges': 'bytes',
          'Content-Range': `bytes ${startByte}-${respEnd}/${meta.fileSize}`,
          'Content-Length': String(sliced.byteLength),
          'Cache-Control': 'no-store',
        },
      });
    } catch (err) {
      console.error('[SW]', err.message);
      return new Response('Error: ' + err.message, { status: 500 });
    }
  })());
});

self.addEventListener('message', (event) => {
  const d = event.data;
  if (!d) return;
  if (d.type === 'SET_META') metaCache.set(d.fileId, d.meta);
  if (d.type === 'SET_URLS') urlCache.set(d.fileId, d.urls);
  if (d.type === 'PREFETCH') {
    (async () => {
      const meta = metaCache.get(d.fileId);
      const urls = urlCache.get(d.fileId);
      if (!meta || !urls) return;
      for (const idx of d.indices) {
        if (urls[idx] && !decryptCache.has(`${d.fileId}:${idx}`)) {
          fetchDecrypt(d.fileId, idx, meta.encryptionKey, urls).catch(() => {});
          await new Promise(r => setTimeout(r, 100));
        }
      }
    })();
  }
});

const CACHE_NAME = 'squidcloud-v12.0.21-1788248574688'; // Dynamic cache name

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // Purge caches left behind by previous deployments so a stale shell/bundle
    // can never be served after a redeploy.
    const names = await caches.keys();
    await Promise.all(
      names.map((n) => (n !== CACHE_NAME ? caches.delete(n) : Promise.resolve()))
    );
    await self.clients.claim();
  })());
});

const metaCache = new Map();
const urlCache = new Map();
const decryptCache = new Map();
const inflight = new Map();

const DB_NAME = 'sq-stream-v2';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      if (!db.objectStoreNames.contains('urls')) db.createObjectStore('urls');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { console.error('[SW] IDB open failed', req.error); reject(req.error); };
  });
}

async function idbGet(store, key) {
  try {
    const db = await openDB();
    return new Promise((res) => {
      const tx = db.transaction(store, 'readonly');
      const r = tx.objectStore(store).get(key);
      r.onsuccess = () => { db.close(); res(r.result || null); };
      r.onerror = () => { db.close(); res(null); };
    });
  } catch { return null; }
}

async function idbPut(store, key, val) {
  try {
    const db = await openDB();
    return new Promise((res) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(val, key);
      tx.oncomplete = () => { db.close(); res(); };
      tx.onerror = () => { db.close(); res(); };
    });
  } catch (e) { console.warn('[SW] IDB write failed', e); }
}

async function getMeta(fileId) {
  if (metaCache.has(fileId)) return metaCache.get(fileId);
  const fromIdb = await idbGet('meta', fileId);
  if (fromIdb) { metaCache.set(fileId, fromIdb); return fromIdb; }
  return null;
}

async function getUrls(fileId) {
  if (urlCache.has(fileId)) return urlCache.get(fileId);
  const fromIdb = await idbGet('urls', fileId);
  if (fromIdb) { urlCache.set(fileId, fromIdb); return fromIdb; }
  return null;
}

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
    let header = null;
    try {
      header = JSON.parse(new TextDecoder().decode(bin.slice(4, 4 + first4)));
    } catch {}
    if (header && header.version >= 2 && header.chunks > 0 && Array.isArray(header.ivs) && header.ivs.length >= header.chunks) {
      // (a1) Canonical framed v2 — v4 API / CLI uploads: per part
      // [u32 aadLen][aad][u32 encLen][enc], decrypted WITH aad, ivs are
      // number arrays in the JSON header. Mirrors decryptLargeData.
      try {
        const keyBytes = new TextEncoder().encode(encryptionKey.slice(0, 32).padEnd(32, '0'));
        const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
        let offset = 4 + first4;
        const parts = [];
        for (let i = 0; i < header.chunks; i++) {
          if (offset + 4 > bin.byteLength) throw new Error('bad aad framing');
          const aadLen = dv.getUint32(offset, true); offset += 4;
          if (aadLen > 4096 || offset + aadLen + 4 > bin.byteLength) throw new Error('bad aad framing');
          const aad = bin.slice(offset, offset + aadLen); offset += aadLen;
          const encLen = dv.getUint32(offset, true); offset += 4;
          if (encLen <= 0 || offset + encLen > bin.byteLength) throw new Error('bad enc framing');
          const enc = bin.slice(offset, offset + encLen); offset += encLen;
          const ivRaw = header.ivs[i];
          const iv = typeof ivRaw === 'string'
            ? Uint8Array.from(atob(ivRaw), c => c.charCodeAt(0))
            : new Uint8Array(ivRaw);
          if (iv.byteLength !== 12) throw new Error('bad iv');
          const plain = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 }, key, enc);
          parts.push(new Uint8Array(plain));
        }
        const total = parts.reduce((s, p) => s + p.byteLength, 0);
        if (typeof header.totalSize === 'number' && header.totalSize > 0 && total !== header.totalSize) throw new Error('size mismatch');
        if (total === 0) throw new Error('empty plaintext');
        const out = new Uint8Array(total);
        let pos = 0;
        for (const p of parts) { out.set(p, pos); pos += p.byteLength; }
        return out.buffer;
      } catch {}
      // (a2) Legacy equal-slice v2 fallback (no per-part framing, no AAD).
      try {
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
      } catch {}
    }
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
      if (decryptCache.size > 25) {
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
  if (!Number.isFinite(chunkSize) || chunkSize <= 0 || !Number.isFinite(startByte) || startByte < 0) {
    console.warn('[SW] invalid chunk layout', { chunkSize, startByte, chunks: chunks?.length, fileSize });
    return null;
  }
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
  // Never intercept third-party requests (IPFS gateways, Supabase, etc.) —
  // the SW cache only holds same-origin entries, so a cross-origin fallback
  // would resolve to undefined and crash respondWith.
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith('/virtual-stream/')) {
    // The app shell and hashed assets must always come from the network so a
    // redeploy never serves a stale HTML referencing purged bundle hashes.
    // Assets are hashed and can be served from the network directly (no SW hop needed).
    // The SW must NOT intercept /assets/ because Firefox can fail the SW's fetch for
    // these requests where Chrome handles them gracefully, causing a permanent fatal error.
    if (url.pathname.startsWith('/assets/')) return; // skip SW entirely for assets
    if (event.request.mode === 'navigate') {
      event.respondWith(fetch(event.request, {cache: 'no-store'}));
    } else {
      event.respondWith(fetch(event.request, {cache: 'no-store'}).catch(() => caches.match(event.request).then((r) => r || new Response('offline', { status: 503 }))));
    }
    return;
  }

  const fileId = url.pathname.split('/').pop();
  const rangeHeader = event.request.headers.get('range');

  event.respondWith((async () => {
    try {
      const meta = await getMeta(fileId);
      if (!meta) return new Response('No metadata', { status: 503 });
      const urls = await getUrls(fileId);
      if (!urls) return new Response('No URLs', { status: 503 });

      let startByte = 0;
      let endByte;
      if (rangeHeader) {
        const m = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (m) { startByte = parseInt(m[1], 10); if (m[2]) endByte = parseInt(m[2], 10); }
      }

      const t = findChunk(meta.chunks, meta.fileSize, meta.chunkSize, startByte);
      if (!t) return new Response('Range OOB', { status: 416 });

      if (!urls[t.idx]) {
        return new Response('Chunk not ready', { status: 503, headers: { 'Retry-After': '1' } });
      }

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

  if (d.type === 'SET_META') {
    metaCache.set(d.fileId, d.meta);
    idbPut('meta', d.fileId, d.meta);
  }

  if (d.type === 'SET_URLS') {
    const existing = urlCache.get(d.fileId) || {};
    const merged = { ...existing, ...d.urls };
    urlCache.set(d.fileId, merged);
    idbPut('urls', d.fileId, merged);
  }

  if (d.type === 'PREFETCH') {
    (async () => {
      const meta = await getMeta(d.fileId);
      const urls = await getUrls(d.fileId);
      if (!meta || !urls) return;
      for (const idx of d.indices) {
        if (urls[idx] && !decryptCache.has(`${d.fileId}:${idx}`)) {
          fetchDecrypt(d.fileId, idx, meta.encryptionKey, urls).catch(() => {});
          await new Promise(r => setTimeout(r, 80));
        }
      }
    })();
  }
});

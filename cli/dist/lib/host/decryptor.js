/* SquidCloud local DECRYPTOR — reserved port 6763.
   Zero-crypto Go side: squidfs proxies every content read here and gets
   plaintext back. This service owns the entire res54 chain (v3 / v2 /
   legacy) using the exact same @noble packages as the web frontend, so
   byte-parity is guaranteed. Local-only bind + session token auth. */
export const DECRYPTOR_PORT = 6763;

export const DECRYPTOR_SOURCE = String.raw`
// squidcloud-decryptor — auto-managed by squidcloudctl. Do not edit.
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = Number(process.env.SQUIDCLOUD_DECRYPTOR_PORT || 6763);
const HOME = os.homedir();
const CFG_DIR = path.join(HOME, '.squidcloud');
const CREDS = path.join(CFG_DIR, 'credentials');
const STATE = path.join(CFG_DIR, 'decryptor.json');
const API_BASE = process.env.SQUIDCLOUD_API_BASE || 'https://squidcloud.vercel.app/api/v1';
const VERSION = '1.0.1';

let authToken = '';
let anonKey = '';
function loadCreds() {
  try {
    const c = JSON.parse(fs.readFileSync(CREDS, 'utf-8'));
    authToken = c.token || '';
    anonKey = c.anon_key || '';
  } catch {}
}
loadCreds();
try { fs.watch(CREDS, () => loadCreds()); } catch {}

// ── crypto (identical chain to cli/src/lib/crypto/res54.ts) ──
const { gcm } = await import('@noble/ciphers/aes.js');
const { hkdf } = await import('@noble/hashes/hkdf.js');
const { sha256 } = await import('@noble/hashes/sha2.js');

const KEY_LEN = 32;
const utf8 = (s) => new TextEncoder().encode(s);
const concat = (...ps) => {
  const t = ps.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(t); let o = 0;
  for (const p of ps) { out.set(p, o); o += p.length; }
  return out;
};
const u32le = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; };
const deriveRawKey = (ks) => utf8(ks.slice(0, 32).padEnd(32, '\0'));
const hkdfExpand = (ikm, info) => hkdf(sha256, ikm, new Uint8Array(0), info, KEY_LEN);

const V3_MAGIC = [0x52, 0x45, 0x03];
function detectVersion(b) {
  if (b.length > 3 && b[0] === V3_MAGIC[0] && b[1] === V3_MAGIC[1] && b[2] === V3_MAGIC[2]) return 3;
  if (b.length > 32) {
    const adLen = new DataView(b.buffer, b.byteOffset).getUint32(0, true);
    if (adLen >= 8 && adLen <= 128 && b.length > 4 + adLen + 12) return 2;
  }
  return 1;
}
function decGcm(key, iv, ct, aad) { return gcm(key, iv, aad).decrypt(ct); }
function decryptV3(blob, masterRaw, userId, fileId, idx, total) {
  const fileKeyRaw = hkdfExpand(masterRaw, concat(utf8('v3-file-master'), utf8(fileId)));
  const chunkKey = hkdfExpand(fileKeyRaw, concat(utf8('v3-chunk'), u32le(idx)));
  const iv = blob.slice(7, 19);
  const ct = blob.slice(19);
  const aad = utf8('res54-v3|' + userId + '|' + fileId + '|' + idx + '|' + total);
  return decGcm(chunkKey, iv, ct, aad);
}
// Canonical v2 (web encryptLargeData / server encryptChunkV2):
// [4B headerLen LE][JSON header{version,chunks,totalSize,ivs:number[][]|b64}]
// then per part: [4B aadLen][aad][4B encLen][ct‖tag]
function parseCanonicalHeader(b) {
  if (b.length < 8) return null;
  const headerLen = new DataView(b.buffer, b.byteOffset).getUint32(0, true);
  if (!(headerLen >= 8 && headerLen <= 512 && b.length > 4 + headerLen)) return null;
  try {
    const h = JSON.parse(new TextDecoder().decode(b.subarray(4, 4 + headerLen)));
    if (h && typeof h.version === 'number' && h.version >= 2 && typeof h.chunks === 'number' && h.chunks > 0 && Array.isArray(h.ivs)) {
      return { header: h, headerLen };
    }
  } catch {}
  return null;
}
const ivFromEntry = (entry) => typeof entry === 'string'
  ? Uint8Array.from(atob(entry), (c) => c.charCodeAt(0))
  : new Uint8Array(entry);
function decryptV2Canonical(blob, keyRaw) {
  const parsed = parseCanonicalHeader(blob);
  if (!parsed) throw new Error('not canonical v2');
  const { header, headerLen } = parsed;
  const parts = [];
  let off = 4 + headerLen;
  const dv = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  for (let i = 0; i < header.chunks; i++) {
    if (!header.ivs?.[i]) throw new Error('canonical v2 missing iv ' + i);
    const iv = ivFromEntry(header.ivs[i]);
    const aadLen = dv.getUint32(off, true); off += 4;
    const aad = blob.slice(off, off + aadLen); off += aadLen;
    const encLen = dv.getUint32(off, true); off += 4;
    const enc = blob.slice(off, off + encLen); off += encLen;
    parts.push(decGcm(keyRaw, iv, enc, aad));
  }
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function decryptV2(blob, keyRaw) {
  const adLen = new DataView(blob.buffer, blob.byteOffset).getUint32(0, true);
  const ad = blob.slice(4, 4 + adLen);
  const iv = blob.slice(4 + adLen, 4 + adLen + 12);
  const ct = blob.slice(4 + adLen + 12);
  return decGcm(keyRaw, iv, ct, ad);
}
function decryptLegacy(blob, keyRaw) {
  return decGcm(keyRaw, blob.slice(0, 12), blob.slice(12));
}
function decryptAny(blob, keyString, ctx) {
  const keyRaw = deriveRawKey(keyString);
  const v = detectVersion(blob);
  const canonical = parseCanonicalHeader(blob);
  const attempts = [];
  if (v === 3 && ctx?.userId && ctx?.fileId) {
    attempts.push(() => decryptV3(blob, keyRaw, ctx.userId, ctx.fileId, ctx.chunkIndex ?? 0, ctx.totalChunks ?? 1));
  }
  if (canonical) {
    // Canonical framing first — legacy-AAD misread would guarantee tag failure.
    attempts.push(() => decryptV2Canonical(blob, keyRaw));
  }
  attempts.push(() => decryptV2(blob, keyRaw));
  attempts.push(() => decryptLegacy(blob, keyRaw));
  let lastErr;
  for (const a of attempts) { try { return a(); } catch (e) { lastErr = e; } }
  throw new Error('decryption failed (' + blob.length + 'B v' + v + '): ' + (lastErr?.message || lastErr));
}

// ── platform calls ──
const SUPABASE_URL = process.env.SQUIDCLOUD_SUPABASE_URL || 'https://aouqcwbdoyrccjcrhzzi.supabase.co';
// Keys that are fingerprints/placeholders, never usable AES material.
function isUsableKey(k) {
  return !!k && !/^(managed_key|sha256:.*|byok_encrypted|byok_protected)$/.test(k);
}
async function fetchVaultKey(fileId) {
  const res = await fetch(SUPABASE_URL + '/functions/v1/file-key', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + authToken,
      ...(anonKey ? { apikey: anonKey } : {}),
    },
    body: JSON.stringify({ fileId }),
  });
  if (!res.ok) throw new Error('vault key unavailable (HTTP ' + res.status + ')');
  const body = await res.json().catch(() => ({}));
  return body?.key || null;
}

async function signedDownload(fileId) {
  const res = await fetch(API_BASE + '/download/' + encodeURIComponent(fileId) + '?signed=true', {
    headers: {
      Authorization: 'Bearer ' + authToken,
      'X-SquidCloud-Key': authToken,
      ...(anonKey ? { apikey: anonKey } : {}),
    },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { throw new Error('signed download HTTP ' + res.status + ': ' + text.slice(0, 160)); }
  if (!res.ok || body.success === false) {
    throw new Error(body.error || ('HTTP ' + res.status));
  }
  return body;
}

async function fetchChunk(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('chunk HTTP ' + res.status);
      return new Uint8Array(await res.arrayBuffer());
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise(r => setTimeout(r, 400 * attempt));
    }
  }
}

function assemble(parts) {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

const inflight = new Map();
async function decryptFile(fileId) {
  if (inflight.has(fileId)) return inflight.get(fileId);
  const job = (async () => {
    const meta = await signedDownload(fileId);
    const urls = meta.signed_urls || [];
    let key = meta.encryption_key || '';
    if (!isUsableKey(key)) key = (await fetchVaultKey(fileId)) || '';
    if (!urls.length) throw new Error('no chunks');
    if (!key) throw new Error('no usable decryption key for this file');
    const total = urls.length;
    const CONC = 8;
    const parts = new Array(total);
    let next = 0;
    async function worker() {
      while (true) {
        const i = next++;
        if (i >= total) return;
        const blob = await fetchChunk(urls[i]);
        parts[i] = decryptAny(blob, key, {
          userId: meta.user_id, fileId,
          chunkIndex: i, totalChunks: total,
        });
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONC, total) }, worker));
    return { plain: assemble(parts), meta };
  })().finally(() => inflight.delete(fileId));
  inflight.set(fileId, job);
  return job;
}

// ── dashboard presence: HOST|<hostId>|<hostname>|6763|decryptor|DECRYPTOR ──
const hostId = createHash('sha256').update(os.hostname() + ':6763').digest('hex').slice(0, 16);
let dashKey = null;
let beatTimer = null;
async function registerDashboard() {
  if (!authToken) return;
  try {
    const res = await fetch(API_BASE + '/keys', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + authToken, 'Content-Type': 'application/json', ...(anonKey ? { apikey: anonKey } : {}) },
      body: JSON.stringify({ name: 'HOST|' + hostId + '|' + os.hostname() + '|6763|decryptor|DECRYPTOR', scopes: ['*'] }),
    });
    const body = await res.json().catch(() => ({}));
    if (body?.key?.id && body?.raw_key) {
      dashKey = { id: body.key.id, raw: body.raw_key };
      beat(); beatTimer = setInterval(beat, 60_000);
    }
  } catch {}
}
async function beat() {
  if (!dashKey) return;
  try {
    await fetch(API_BASE + '/user/whoami', { headers: { 'X-SquidCloud-Key': dashKey.raw, ...(anonKey ? { apikey: anonKey } : {}) } });
  } catch {}
}
async function markOffline() {
  if (!dashKey) return;
  clearInterval(beatTimer);
  try {
    const cur = await fetch(API_BASE + '/keys/' + dashKey.id, { headers: { Authorization: 'Bearer ' + authToken, ...(anonKey ? { apikey: anonKey } : {}) } });
    const body = await cur.json().catch(() => ({}));
    const name = body?.name || body?.key?.name || '';
    if (name && !name.endsWith(':OFFLINE')) {
      await fetch(API_BASE + '/keys/' + dashKey.id, {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + authToken, 'Content-Type': 'application/json', ...(anonKey ? { apikey: anonKey } : {}) },
        body: JSON.stringify({ name: name + ':OFFLINE' }),
      });
    }
  } catch {}
}

// ── session secret ──
let secret = '';
try { secret = JSON.parse(fs.readFileSync(STATE, 'utf-8')).secret || ''; } catch {}
if (!secret) {
  secret = randomBytes(24).toString('hex');
  fs.mkdirSync(CFG_DIR, { recursive: true });
}

// ── server ──
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'squidcloud-decryptor', version: VERSION, port: PORT }));
    return;
  }
  // everything else requires the session token
  if ((req.headers['x-squidfs-auth'] || '') !== secret) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'forbidden' }));
    return;
  }
  // Cloudbliss file IDs are path-style (e.g. "gkd/fengate.pdf"); accept slashes.
  const m = url.pathname.match(/^\/file\/(.+)$/);
  if (req.method === 'GET' && m) {
    loadCreds(); // re-read credentials live so a re-login takes effect without a restart
    try {
      const { plain, meta } = await decryptFile(decodeURIComponent(m[1]));
      res.writeHead(200, {
        'Content-Type': meta.file_type || 'application/octet-stream',
        'Content-Length': String(plain.length),
        'X-SquidCloud-File-Name': encodeURIComponent(meta.file_name || ''),
      });
      res.end(Buffer.from(plain));
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      // A missing file must surface as 404 (not 502) so the WebDAV layer can
      // return a clean 404 instead of proxying ciphertext to the platform API.
      const status = /404|not found/i.test(msg) ? 404 : 502;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: msg }));
    }
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.on('error', (e) => {
  // Never touch the state file here: if another instance owns 6763 its
  // secret stays valid and the supervisor reuses it via /health.
  process.exit(e.code === 'EADDRINUSE' ? 0 : 1);
});

server.listen(PORT, '127.0.0.1', () => {
  fs.writeFileSync(STATE, JSON.stringify({
    pid: process.pid, port: PORT, secret, version: VERSION, started_at: Date.now(),
  }));
  console.log('[decryptor] listening on 127.0.0.1:' + PORT);
  registerDashboard();
});

const shutdown = async () => { await markOffline(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
`;

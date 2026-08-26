// Node.js decryption microservice — uses the same @noble packages as the
// web frontend and the CLI, guaranteeing byte-perfect cross-language compat.
// SquidFS's Go binary POSTs {fileId} here and gets plaintext back.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const CREDS_PATH = path.join(os.homedir(), '.squidcloud', 'credentials');
const API_BASE = process.env.SQUIDCLOUD_API_BASE || 'https://squidcloud.vercel.app/api/v1';
const PORT = parseInt(process.env.SQUIDFS_DECRYPT_PORT || '8066', 10);

function readCreds() {
  try {
    return JSON.parse(fs.readFileSync(CREDS_PATH, 'utf-8'));
  } catch { return {}; }
}

async function getAuthHeaders() {
  const creds = readCreds();
  if (!creds.token) throw new Error('Not authenticated');
  return {
    Authorization: `Bearer ${creds.token}`,
    ...(creds.anon_key ? { apikey: creds.anon_key } : {}),
  };
}

async function fetchJSON(url, opts = {}) {
  const headers = await getAuthHeaders();
  const res = await fetch(url, {
    ...opts,
    headers: { ...headers, 'Content-Type': 'application/json', ...opts.headers },
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  return data;
}

// Get file metadata (tags with chunk info)
async function getFileMeta(fileId) {
  return fetchJSON(`${API_BASE}/files/${fileId}/metadata`);
}

// Get vault key via bridge (same as store-file-key/file-key functions use)
async function getVaultKey(fileId, apiKey) {
  const bridgeURL = process.env.SQUIDFS_BRIDGE_URL || 'https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/squidfs-bridge';
  const creds = readCreds();

  // Try OAuth token auth first (bridge accepts Bearer for cli_devices)
  let res = await fetch(bridgeURL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.token}` },
    body: JSON.stringify({ api_key: '', action: 'resolve_download', file_id: fileId }),
  });
  // If that fails, try with cb_ key from env
  const envKey = process.env.SQUIDCLOUD_API_KEY || (apiKey.startsWith('cb_') ? apiKey : null);
  if (!res.ok && envKey) {
    res = await fetch(bridgeURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: envKey, action: 'resolve_download', file_id: fileId }),
    });
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`bridge: ${text.slice(0, 120)}`);
  return JSON.parse(text);
}

// ── res54 decryption — exact match with encryption.ts + encryption-v3.ts ──
const { gcm: gcmFactory } = require('@noble/ciphers/aes.js');
const { sha256 } = require('@noble/hashes/sha2.js');
const { hkdf } = require('@noble/hashes/hkdf.js');

function gcmDecrypt(keyBytes, iv, ct, aad) {
  const aes = gcmFactory(keyBytes, iv, aad);
  return aes.decrypt(ct);
}

function deriveKeyUTF8(keyStr) {
  let k = keyStr.slice(0, 32).padEnd(32, '\0');
  return Buffer.from(k, 'utf-8');
}

function hkdfExpand(ikm, info, length) {
  return Buffer.from(nobleHkdf.hkdf('sha256', ikm, Buffer.alloc(0), info, length));
}

function decryptV3(blob, masterRaw, userId, fileId, chunkIdx, totalChunks) {
  const enc = Buffer.from('v3-file-master' + fileId, 'utf-8');
  const fileKeyRaw = nobleHkdf.hkdf('sha256', masterRaw, Buffer.alloc(0), enc, 32);

  const idxLE = Buffer.alloc(4);
  idxLE.writeUInt32LE(chunkIdx);
  const chunkInfo = Buffer.concat([Buffer.from('v3-chunk'), idxLE]);
  const chunkKey = nobleHkdf.hkdf('sha256', fileKeyRaw, Buffer.alloc(0), chunkInfo, 32);

  const ivInfo = Buffer.concat([Buffer.from('v3-iv'), idxLE]);
  const iv = nobleHkdf.hkdf('sha256', fileKeyRaw, Buffer.alloc(0), ivInfo, 12);

  const aad = Buffer.from(`res54-v3|${userId}|${fileId}|${chunkIdx}|${totalChunks}`);
  const ivBytes = blob.slice(7, 19); // V3_HEADER_SIZE=19, IV at [7..19)
  const ct = blob.slice(19);
  const g = gcmFactory(chunkKey, ivBytes, aad);
  return g.decrypt(ct);
}

function decryptV2(blob, keyRaw) {
  const adLen = blob.readUInt32LE(0);
  const ad = blob.slice(4, 4 + adLen);
  const iv = blob.slice(4 + adLen, 4 + adLen + 12);
  const ct = blob.slice(4 + adLen + 12);
  const g = gcmFactory(keyRaw, iv, ad);
  return g.decrypt(ct);
}

function decryptLegacy(blob, keyRaw) {
  const iv = blob.slice(0, 12);
  const ct = blob.slice(12);
  const g = gcmFactory(keyRaw, iv);
  return g.decrypt(ct);
}

function detectAndDecrypt(blob, keyHex, ctx) {
  const keyRaw = deriveKeyUTF8(keyHex);
  // v3 magic: 52 45 03
  if (blob.length > 3 && blob[0] === 0x52 && blob[1] === 0x45 && blob[2] === 0x03 && ctx.userId && ctx.fileId) {
    try { return decryptV3(blob, keyRaw, ctx.userId, ctx.fileId, ctx.chunkIdx, ctx.totalChunks); } catch {}
  }
  // v2 AEAD: [4B LE ADLen][AD][IV 12][ct]
  if (blob.length > 20) {
    try { return decryptV2(blob, keyRaw); } catch {}
  }
  // Legacy: [12B IV][ct]
  if (blob.length > 28) {
    try { return decryptLegacy(blob, keyRaw); } catch {}
  }
  // Raw passthrough
  return blob;
}

// Parse double-encoded tags
function parseTags(rawTags) {
  let cur = rawTags;
  for (let i = 0; i < 3; i++) {
    try {
      if (typeof cur === 'string') cur = JSON.parse(cur);
      else if (Array.isArray(cur)) cur = JSON.parse(cur[0]);
      else break;
    } catch { break; }
  }
  return cur;
}

// ── HTTP server ──

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const sendJSON = (code, data) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  try {
    if (req.method !== 'POST') { sendJSON(405, { error: 'POST only' }); return; }

    const body = await new Promise((resolve) => {
      let d = '';
      req.on('data', c => d += c);
      req.on('end', () => resolve(JSON.parse(d || '{}')));
    });

    if (url.pathname === '/decrypt') {
      // body: { fileId, userId, chunkUrls[], keyHex, totalChunks }
      const { fileId, userId, chunkUrls, keyHex, totalChunks } = body;
      const meta = await getFileMeta(fileId);
      const tags = parseTags(meta.file?.tags || meta.tags);
      const chunks = tags.chunks || [];

      let keyStr = keyHex || tags.encryptionKey || '';
      if (!keyStr || keyStr === 'managed_key') {
        const vk = await getVaultKey(fileId);
        keyStr = vk.key || '';
      }

      const results = new Array(chunks.length);
      await Promise.all(chunks.map((chunk, i) => (async () => {
        const resp = await fetch(chunk.downloadUrl);
        const blob = Buffer.from(await resp.arrayBuffer());
        const plain = detectAndDecrypt(blob, keyStr, {
          userId: userId || meta.user_id,
          fileId,
          chunkIdx: i,
          totalChunks: chunks.length,
        });
        results[i] = plain;
      })()));

      const assembled = Buffer.concat(results.filter(Boolean));
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      res.end(assembled);
      return;
    }

    sendJSON(404, { error: 'Unknown path' });
  } catch (err) {
    sendJSON(500, { error: err.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`decrypt service on :${PORT}`);
});

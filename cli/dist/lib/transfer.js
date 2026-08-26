 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } async function _asyncNullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return await rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { apiRaw, apiGet, apiPost } from './api/client.js'

/* Upload/download engine — mirrors the platform's own transfer path:
   POST /upload → parallel chunk PUTs → POST /complete
   GET  /download/:id?signed=true → parallel chunk GETs → local res54 decrypt */









const CONCURRENCY = 4
const CHUNK_RETRIES = 3











/* ── res54 canonical v2 chunk envelope (byte-compatible with the platform's
   encryptChunkV2 / web encryptLargeData / decryptor daemon):
   [u32le headerLen][JSON {version:2,chunks,totalSize,ivs:number[][]}]
   then per 64KB part: [u32le aadLen][aad][u32le encLen][GCM ct‖tag]     ── */

const V2_SUB_CHUNK = 64 * 1024

async function encryptChunkCanonical(
  plaintext,
  keyStr,
) {
  const keyBytes = new TextEncoder().encode(keyStr.slice(0, 32).padEnd(32, '0'))
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM', length: 256 }, false, ['encrypt'])

  const numParts = Math.max(1, Math.ceil(plaintext.length / V2_SUB_CHUNK))
  const ivs = []
  const parts = []
  const timestamp = Date.now()

  for (let i = 0; i < numParts; i++) {
    const sub = plaintext.subarray(i * V2_SUB_CHUNK, Math.min((i + 1) * V2_SUB_CHUNK, plaintext.length))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const aad = new TextEncoder().encode(`chunk-${i}-${numParts}-${timestamp}`)
    const encrypted = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, sub),
    )
    ivs.push(iv)
    parts.push({ aad, encrypted })
  }

  const headerBytes = new TextEncoder().encode(JSON.stringify({
    version: 2,
    chunks: numParts,
    totalSize: plaintext.length,
    ivs: ivs.map((iv) => Array.from(iv)),
  }))

  let total = 4 + headerBytes.length
  for (const p of parts) total += 4 + p.aad.length + 4 + p.encrypted.length
  const out = new Uint8Array(total)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, headerBytes.length, true)
  out.set(headerBytes, 4)
  let off = 4 + headerBytes.length
  for (const p of parts) {
    dv.setUint32(off, p.aad.length, true); off += 4
    out.set(p.aad, off); off += p.aad.length
    dv.setUint32(off, p.encrypted.length, true); off += 4
    out.set(p.encrypted, off); off += p.encrypted.length
  }
  return out
}

function humanBytes(n) {
  if (!Number.isFinite(n)) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = n
  let u = 0
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024
    u++
  }
  return `${v.toFixed(v >= 100 || u === 0 ? 0 : 1)}${units[u]}`
}

export function renderProgressBar(current, total, width = 26) {
  if (total <= 0) return '░'.repeat(width)
  const filled = Math.round((current / total) * width)
  return '█'.repeat(Math.max(0, Math.min(width, filled))) + '░'.repeat(Math.max(0, width - filled))
}

export class TransferProgress {
   __init() {this.startedAt = Date.now()}
   __init2() {this.lastLine = ''}

  constructor( label,  totalBytes,  enabled) {;this.label = label;this.totalBytes = totalBytes;this.enabled = enabled;TransferProgress.prototype.__init.call(this);TransferProgress.prototype.__init2.call(this);}

  update(currentBytes, extra = '') {
    if (!this.enabled) return
    const pct = this.totalBytes > 0 ? Math.min(100, (currentBytes / this.totalBytes) * 100) : 0
    const elapsed = (Date.now() - this.startedAt) / 1000
    const bps = elapsed > 0 ? currentBytes / elapsed : 0
    const eta = bps > 0 && currentBytes > 0 && currentBytes < this.totalBytes
      ? (this.totalBytes - currentBytes) / bps : Infinity
    const etaText = Number.isFinite(eta) ? (eta > 90 ? `${Math.round(eta / 60)}m` : `${Math.round(eta)}s`) : '—'
    const line = `${this.label} ${renderProgressBar(currentBytes, this.totalBytes)} ${pct.toFixed(0)}%  ${humanBytes(currentBytes)}/${humanBytes(this.totalBytes)}  ${humanBytes(bps)}/s  eta ${etaText}${extra ? `  ${extra}` : ''}`
    if (line !== this.lastLine) {
      process.stdout.write(`\r\x1b[2K${line}`)
      this.lastLine = line
    }
  }

  finish() {
    if (this.enabled) process.stdout.write('\r\x1b[2K')
  }
}

export async function uploadFile(
  filePath,
  opts = {},
) {
  const stat = fs.statSync(filePath)
  if (!stat.isFile()) throw new Error(`Not a file: ${filePath}`)
  if (stat.size === 0) throw new Error(`File is empty: ${filePath}`)

  const name = path.basename(filePath)
  const type = guessMime(name)
  const progress = new TransferProgress('upload', stat.size, process.stdout.isTTY && !opts.quiet)

  const init = await apiPost('/upload', {
    name,
    type,
    size: stat.size,
    ...(opts.folderId ? { folder_id: opts.folderId } : {}),
  })
  if (!_optionalChain([init, 'optionalAccess', _2 => _2.success]) || !Array.isArray(init.urls)) throw new Error('Server refused the upload session')
  const encKey = init.encryption_key
  if (!encKey) throw new Error('Upload session missing encryption_key — upgrade the platform deploy')

  const data = await fs.promises.readFile(filePath)
  const chunkSize = init.chunk_size || 512 * 1024
  const totalChunks = Math.max(1, Math.ceil(data.length / chunkSize))

  const urlByIndex = new Map(init.urls.map((u) => [u.index, u]))
  const queue = Array.from({ length: totalChunks }, (_, i) => i)
  let completedBytes = 0
  let done = 0

  const worker = async () => {
    for (;;) {
      const idx = queue.shift()
      if (idx === undefined) return
      const target = urlByIndex.get(idx)
      if (!_optionalChain([target, 'optionalAccess', _3 => _3.upload_url])) throw new Error(`Missing upload URL for chunk ${idx}`)
      const start = idx * chunkSize
      const end = Math.min(start + chunkSize, data.length)
      const slice = data.subarray(start, end)

      let attempt = 0
      for (;;) {
        try {
          // res54 canonical v2 — never store plaintext
          const blob = await encryptChunkCanonical(slice, encKey)
          const r = await fetch(target.upload_url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: blob,
          })
          if (!r.ok) throw new Error(`chunk ${idx} HTTP ${r.status}`)
          break
        } catch (err) {
          attempt++
          if (attempt >= CHUNK_RETRIES) throw err
          await new Promise((r2) => setTimeout(r2, 500 * 2 ** attempt))
        }
      }

      done++
      completedBytes += slice.length
      _optionalChain([opts, 'access', _4 => _4.onProgress, 'optionalCall', _5 => _5({ current: completedBytes, total: stat.size, stage: 'uploading' })])
      progress.update(completedBytes, `chunk ${done}/${totalChunks}`)
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, totalChunks) }, worker))
  progress.finish()

  // /upload/complete mints its OWN file uuid — returned nested as
  // {file:{id}}. Never fall back to init.file_id: that pre-minted id is not
  // the stored record's id.
  const complete = await apiPost(
    '/upload/complete',
    { upload_id: init.upload_id, chunk_size: chunkSize },
  )
  const realId = _optionalChain([complete, 'optionalAccess', _6 => _6.file, 'optionalAccess', _7 => _7.id]) || _optionalChain([complete, 'optionalAccess', _8 => _8.id]) || _optionalChain([complete, 'optionalAccess', _9 => _9.file_id])
  if (!realId) throw new Error('Upload complete did not return a file id')
  return { id: realId, name, size: stat.size }
}

/* ──────────────────────────  DOWNLOAD  ────────────────────────── */
















const isUsableKey = (k) =>
  !!k && !/^(managed_key|sha256:.*|byok_encrypted|byok_protected)$/.test(k)

async function fetchVaultKey(fileId) {
  const { SUPABASE_URL } = await import('./auth/constants.js')
  const { authToken, anonKey } = await import('./auth/oauth-session.js')
  if (!authToken) return null
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/file-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        ...(anonKey ? { apikey: anonKey } : {}),
      },
      body: JSON.stringify({ fileId }),
    })
    if (r.status === 500) {
      const t = await r.text().catch(() => '')
      if (/decrypt file key/i.test(t)) {
        throw new Error(
          'VAULT_KEY_DRIFT: the SQUIDVEIL_MASTER_KEY secret has drifted since this file was uploaded - restore it in Supabase > Edge Functions > Secrets to decrypt managed files.',
        )
      }
    }
    const d = (await r.json()) 
    return _optionalChain([d, 'optionalAccess', _10 => _10.success]) && d.key ? d.key : null
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('VAULT_KEY_DRIFT')) throw err
    return null
  }
}

/* ── SquidFS bridge ──────────────────────────────────────────────
   Files written through SquidFS live under the bridge's own storage
   layout; the standard API resolver cannot see them. We speak the
   same protocol the mount uses. */




async function getBridgeKey() {
  if (process.env.SQUIDCLOUD_API_KEY) {
    const k = process.env.SQUIDCLOUD_API_KEY
    return k.startsWith('cb_') ? k : `cb_${k}`
  }
  const fs2 = await import('node:fs')
  const os2 = await import('node:os')
  const path2 = await import('node:path')
  const keyFile = path2.join(os2.homedir(), '.squidcloud', 'bridge-key.json')
  try {
    const cached = JSON.parse(fs2.readFileSync(keyFile, 'utf8'))
    const k = _nullishCoalesce(_optionalChain([cached, 'optionalAccess', _11 => _11.key]), () => ( ''))
    if (k.startsWith('cb_')) return k
    if (k.length >= 32) return `cb_${k}`
  } catch (e3) {}
  const created = await apiPost('/keys', {
    name: 'cli-bridge-' + new Date().toISOString().slice(0, 10),
  })
  const raw = _optionalChain([created, 'optionalAccess', _12 => _12.raw_key])
  if (!raw) throw new Error('Could not provision a bridge API key')
  try {
    fs2.mkdirSync(path2.dirname(keyFile), { recursive: true })
    fs2.writeFileSync(keyFile, JSON.stringify({ key: `cb_${raw}`, minted_at: Date.now() }), { mode: 0o600 })
  } catch (e4) {}
  return `cb_${raw}`
}




function parseTags(rawTags) {
  let cur = rawTags
  for (let i = 0; i < 3; i++) {
    if (typeof cur === 'string') { try { cur = JSON.parse(cur) } catch (e5) { break } }
    else if (Array.isArray(cur)) { cur = cur[0] }
    else break
  }
  if (cur && typeof cur === 'object' && Array.isArray((cur ).chunks)) {
    const t = cur 
    return { chunks: t.chunks, encryptionKey: t.encryptionKey }
  }
  return { chunks: [] }
}

async function bridgeResolve(apiKey, chunks) {
  const { SUPABASE_URL } = await import('./auth/constants.js')
  const { authToken, anonKey } = await import('./auth/oauth-session.js')
  if (!apiKey && !authToken) throw new Error('Not authenticated')
  const r = await fetch(`${SUPABASE_URL}/functions/v1/squidfs-bridge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(anonKey ? { apikey: anonKey } : {}),
    },
    body: JSON.stringify({ api_key: _nullishCoalesce(apiKey, () => ( '')), action: 'resolve_download', chunks }),
  })
  const d = (await r.json()) 
  if (!r.ok || !d.success || !Array.isArray(d.urls)) throw new Error(d.error || `bridge HTTP ${r.status}`)
  const map = new Map()
  for (const u of d.urls) if (u.downloadUrl) map.set(_nullishCoalesce(u.index, () => ( 0)), u.downloadUrl)
  return chunks.map((c) => {
    const u = map.get(c.index)
    if (!u) throw new Error(`bridge missing URL for chunk ${c.index}`)
    return u
  })
}

/** Frontend-parity chunk transport: squidcloud-cluster issues the signed
    object URL for each chunk. Requires a real Supabase JWT (sb_token from
    browser login). */
async function getSupabaseJwt() {
  const { sbToken, sbTokenExpiresAt } = await import('./auth/oauth-session.js')
  if (sbToken && (!sbTokenExpiresAt || Date.now() < sbTokenExpiresAt)) return sbToken
  throw new Error(
    'WEB_SESSION_REQUIRED: this download needs a short-lived web session token. Run `squidcloudctl login` again, then retry.',
  )
}

async function clusterDownloadChunk(
  chunk,
  userId,
) {
  const { SUPABASE_URL } = await import('./auth/constants.js')
  const jwt = await getSupabaseJwt()
  const r = await fetch(`${SUPABASE_URL}/functions/v1/squidcloud-cluster`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({
      action: 'download',
      path: chunk.path,
      repo: chunk.repo,
      clusterId: chunk.clusterId,
      bucket: chunk.bucket,
      userId,
    }),
  })
  const text = await r.text()
  let data
  try { data = JSON.parse(text) } catch (e6) { throw new Error(`cluster HTTP ${r.status}: ${text.slice(0, 120)}`) }
  if (!r.ok) throw new Error(_optionalChain([data, 'optionalAccess', _13 => _13.error]) || `cluster HTTP ${r.status}`)
  if (data.legacy) {
    const decoded = Buffer.from(String(data.content).replace(/\s/g, ''), 'base64').toString('utf8')
    const parsed = JSON.parse(decoded)
    const b64 = parsed.v === '2.3' ? parsed.d : parsed.chunkData
    return new Uint8Array(Buffer.from(String(b64), 'base64'))
  }
  if (!data.downloadUrl) throw new Error('No download URL received')
  const obj = await fetch(data.downloadUrl)
  if (!obj.ok) throw new Error(`CDN HTTP ${obj.status}`)
  return new Uint8Array(await obj.arrayBuffer())
}

export async function downloadFile(
  target,
  destPath,
  onProgress,
) {
  const errors = []

  // Parse metadata exactly like the web app.
  let chunks = []
  let tagsKey
  let encrypted = false
  try {
    const metaRow = await apiGet(`/files/${target.id}/metadata`)
    const row = _nullishCoalesce(metaRow.file, () => ( {}))
    encrypted = row.encrypted === true
    const parsed = parseTags(row.tags)
    chunks = parsed.chunks
    tagsKey = parsed.encryptionKey
    if (!target.userId && typeof row.user_id === 'string') target.userId = row.user_id 
  } catch (e7) { /* optional */ }

  // Frontend key-resolution order.
  let defaultKey = tagsKey
  if (defaultKey === 'managed_key') defaultKey = await _asyncNullishCoalesce((await fetchVaultKey(target.id)), async () => ( undefined))

  // ── Strategy A: exact frontend transport (squidcloud-cluster) ──
  if (chunks.length > 0) {
    try {
      const finalPath2 = destPath || target.name
      const out = fs.createWriteStream(finalPath2)
      const progress = new TransferProgress('download', _nullishCoalesce(target.size, () => ( 0)), process.stdout.isTTY)
      const noble = await import('@noble/hashes/hkdf.js')
      const sha2 = await import('@noble/hashes/sha2.js')
      const enc = new TextEncoder()
      const { detectChunkVersion, decryptAny, decryptV3, deriveRawKey } = await import('./crypto/res54.js')

      const master = deriveRawKey(defaultKey || '')
      const fileKeyRaw = noble.hkdf(sha2.sha256, master, new Uint8Array(0),
        enc.encode('v3-file-master' + target.id), 32)

      let activeMaster = master
      for (let i = 0; i < chunks.length; i++) {
        const blob = await clusterDownloadChunk(chunks[i], target.userId || '')
        const version = detectChunkVersion(blob)
        let plain
        if (version === 1 && !encrypted && !defaultKey) {
          plain = blob
        } else {
          if (!defaultKey && byokCache === undefined) {
            byokCache = await _asyncNullishCoalesce((await askByokKey(target.name)), async () => ( ''))
          }
          const attemptKey = defaultKey || byokCache || ''
          try {
            if (version === 3) {
              const m2 = attemptKey ? deriveRawKey(attemptKey) : master
              plain = decryptV3(blob, m2, target.userId || '', target.id, i, chunks.length)
              activeMaster = m2
            } else {
              plain = decryptAny(blob, attemptKey, {
                userId: target.userId, fileId: target.id, chunkIndex: i, totalChunks: chunks.length,
              }).plain
            }
          } catch (err) {
            if (!attemptKey) throw new Error('BYOK_KEY_REQUIRED: pass --key or run interactively')
            throw err
          }
          void activeMaster
        }
        void fileKeyRaw
        progress.update(i + 1, `chunk ${i + 1}/${chunks.length}`)
        void onProgress
        const buf = Buffer.from(plain)
        if (!out.write(buf)) await new Promise((r2) => out.once('drain', () => r2()))
      }
      out.end()
      await new Promise((resolve, reject) => { out.on('finish', () => resolve()); out.on('error', reject) })
      progress.finish()
      return finalPath2
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.startsWith('VAULT_KEY_DRIFT')) throw e
      if (msg.startsWith('WEB_SESSION_REQUIRED')) {
        // No fresh web JWT — fall back to signed-mode + vault key (no JWT needed).
        try {
          const key0 = defaultKey || tagsKey || ''
          const usable = key0 && !/^(managed_key|sha256:.*|byok_encrypted|byok_protected)$/.test(key0)
          const vaultKey = usable ? key0 : await fetchVaultKey(target.id)
          if (!vaultKey && !usable && encrypted) throw new Error(msg)
          const sres = await apiRaw(`/download/${target.id}?signed=true`)
          if (!sres.ok) throw new Error(`signed HTTP ${sres.status}`)
          const smeta = (await sres.json()) 
          if (!_optionalChain([smeta, 'optionalAccess', _14 => _14.success]) || !_optionalChain([smeta, 'access', _15 => _15.signed_urls, 'optionalAccess', _16 => _16.length])) throw new Error('signed: empty')
          return await fetchDecryptWrite(smeta.signed_urls, target, destPath, onProgress, _nullishCoalesce(vaultKey, () => ( undefined)), chunks.length)
        } catch (e2) {
          errors.push(`signed: ${e2 instanceof Error ? e2.message : String(e2)}`)
        }
      }
      errors.push(`cluster: ${msg}`)
    }
  }

  // ── Strategy C: SquidFS bridge (files written through the mount) ──
  if (chunks.length > 0 && chunks.some((c) => c.repo !== 'b2')) {
    try {
      const apiKey = await getBridgeKey()
      const urls = await bridgeResolve(
        apiKey,
        chunks.map((c) => ({ path: c.path, index: c.index, bucket: c.bucket })),
      )
      return await fetchDecryptWrite(urls, target, destPath, onProgress)
    } catch (e) {
      errors.push(`squidfs-bridge: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  throw new Error(errors.join(' · ') || 'No downloadable strategy succeeded')
}

let byokCache

async function askByokKey(fileName) {
  if (byokCache !== undefined) return byokCache
  if (!process.stdin.isTTY || process.env.SQUIDCLOUD_NONINTERACTIVE === '1') return null
  const readline = await import('node:readline')
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const answer = await new Promise((res) =>
    rl.question(`\u25cf decryption key for ${fileName}: `, (v) => { rl.close(); res(v) }),
  )
  byokCache = answer.trim() || null
  return byokCache
}

async function resolveKey(fileId, tagsKey) {
  if (tagsKey && !/^(managed_key|sha256:\S+|byok_encrypted|byok_protected)$/.test(tagsKey)) return tagsKey
  return fetchVaultKey(fileId)
}

async function fetchDecryptWrite(
  urls,
  target,
  destPath,
  onProgress,
  preKey,
  declaredChunks,
) {
  const totalChunks = urls.length
  const finalPath = destPath || target.name
  const out = fs.createWriteStream(finalPath)
  const progress = new TransferProgress('download', _nullishCoalesce(target.size, () => ( 0)), process.stdout.isTTY)

  // Caller-resolved key wins (signed-fallback path already checked tags +
  // vault); only re-resolve when the caller had nothing.
  let keyString = _nullishCoalesce(preKey, () => ( undefined))

  for (let i = 0; i < totalChunks; i++) {
    const r = await fetch(urls[i % urls.length])
    if (!r.ok) throw new Error(`chunk ${i} HTTP ${r.status}`)
    const blob = new Uint8Array(await r.arrayBuffer())
    const { detectChunkVersion, decryptAny } = await import('./crypto/res54.js')
    const version = detectChunkVersion(blob)

    if (version === 1 && blob.length <= 28) {
      out.write(Buffer.from(blob))
      continue
    }

    if (!keyString) {
      keyString = await _asyncNullishCoalesce((await resolveKey(target.id)), async () => ( ''))
      if (!keyString) {
        out.end()
        throw new Error('Encrypted file but its key is unavailable (BYOK without key?)')
      }
    }

    let plain
    try {
      plain = decryptAny(blob, keyString, {
        userId: target.userId,
        fileId: target.id,
        chunkIndex: i,
        totalChunks,
      }).plain
    } catch (err) {
      if (version === 1) {
        plain = blob
      } else {
        out.end()
        throw err
      }
    }

    progress.update(i + 1, `chunk ${i + 1}/${totalChunks}`)
    void onProgress
    const buf = Buffer.from(plain)
    if (!out.write(buf)) await new Promise((r2) => out.once('drain', () => r2()))
  }

  out.end()
  await new Promise((resolve, reject) => {
    out.on('finish', () => resolve())
    out.on('error', reject)
  })
  progress.finish()
  return finalPath
}

async function streamPlain(
  reqPath,
  fallbackName,
  destPath,
  onProgress,
) {
  const res = await apiRaw(reqPath)
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(t.slice(0, 300) || `Download failed (HTTP ${res.status})`)
  }
  const total = Number(res.headers.get('content-length')) || 0
  const progress = new TransferProgress('download', total, process.stdout.isTTY)
  const nodeStream = Readable.fromWeb(res.body )
  const header = res.headers.get('content-disposition') || ''
  const m = header.match(/filename="?([^";]+)"?/i)
  const finalPath = destPath || _optionalChain([m, 'optionalAccess', _17 => _17[1]]) || fallbackName
  let received = 0
  nodeStream.on('data', (c) => {
    received += c.length
    _optionalChain([onProgress, 'optionalCall', _18 => _18({ current: received, total: total || received, stage: 'downloading' })])
    progress.update(received)
  })
  await pipeline(nodeStream, fs.createWriteStream(finalPath))
  progress.finish()
  return finalPath
}

function guessMime(name) {
  const ext = path.extname(name).toLowerCase()
  const table = {
    '.txt': 'text/plain', '.md': 'text/markdown', '.html': 'text/html', '.css': 'text/css',
    '.js': 'text/javascript', '.ts': 'text/typescript', '.json': 'application/json',
    '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm', '.zip': 'application/zip',
    '.gz': 'application/gzip', '.tar': 'application/x-tar', '.csv': 'text/csv',
  }
  return table[ext] || 'application/octet-stream'
}

export { apiPost }

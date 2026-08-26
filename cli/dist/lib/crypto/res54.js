 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import { gcm } from '@noble/ciphers/aes.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { randomBytes } from '@noble/hashes/utils.js'

/* res54 chunk-format support for the CLI — mirrors the platform's
   encryption-v3 / v2 / legacy layouts exactly so every stored file
   decrypts locally without server-side help. */

export const V3_MAGIC = new Uint8Array([0x52, 0x45, 0x03])
const KEY_LEN = 32
const IV_LEN = 12

export function utf8(n) {
  return typeof n === 'string' ? new TextEncoder().encode(n) : n
}

function concat(...parts) {
  const total = parts.reduce((s, p) => s + p.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}

function u32le(n) {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, n, true)
  return b
}

/** Platform key normalisation: key.slice(0,32).padEnd(32,'0') as UTF-8 bytes. */
export function deriveRawKey(keyString) {
  return utf8(keyString.slice(0, 32).padEnd(32, '0'))
}

function hkdfExpand(ikm, info, len) {
  return hkdf(sha256, ikm, new Uint8Array(0), info, len)
}

 









function parseCanonicalHeader(blob) {
  if (blob.length < 8) return null
  const headerLen = new DataView(blob.buffer, blob.byteOffset).getUint32(0, true)
  if (!(headerLen >= 8 && headerLen <= 512 && blob.length > 4 + headerLen)) return null
  try {
    const h = JSON.parse(new TextDecoder().decode(blob.subarray(4, 4 + headerLen))) 
    if (h && typeof h.version === 'number' && h.version >= 2 && typeof h.chunks === 'number' && h.chunks > 0 && Array.isArray(h.ivs)) {
      return { header: h, headerLen }
    }
  } catch (e2) { /* not canonical */ }
  return null
}

export function detectChunkVersion(blob) {
  if (blob.length > 3 && blob[0] === V3_MAGIC[0] && blob[1] === V3_MAGIC[1] && blob[2] === V3_MAGIC[2]) return 3
  if (blob.length > 4 + 12 + 16) {
    const adLen = new DataView(blob.buffer, blob.byteOffset).getUint32(0, true)
    if (adLen >= 8 && adLen <= 128 && blob.length > 4 + adLen + 12) {
      // Distinguish canonical-v2 (JSON header with ivs[]) from legacy-AAD.
      if (parseCanonicalHeader(blob)) return 2
      return 2 // both flavours report v2; decryptAny branches internally
    }
  }
  return 1
}

function ivFromEntry(entry) {
  return typeof entry === 'string'
    ? Uint8Array.from(atob(entry), (c) => c.charCodeAt(0))
    : new Uint8Array(entry)
}

/** Canonical v2: [4B headerLen][JSON header][per part: 4B aadLen][aad][4B encLen][ct‖tag] */
export function decryptV2Canonical(blob, keyRaw) {
  const parsed = parseCanonicalHeader(blob)
  if (!parsed) throw new Error('not a canonical v2 chunk')
  const { header, headerLen } = parsed
  const parts = []
  let off = 4 + headerLen
  const dv = new DataView(blob.buffer, blob.byteOffset, blob.byteLength)
  for (let i = 0; i < header.chunks; i++) {
    if (!_optionalChain([header, 'access', _ => _.ivs, 'optionalAccess', _2 => _2[i]])) throw new Error(`canonical v2 missing iv ${i}`)
    const iv = ivFromEntry(header.ivs[i])
    const aadLen = dv.getUint32(off, true); off += 4
    const aad = blob.slice(off, off + aadLen); off += aadLen
    const encLen = dv.getUint32(off, true); off += 4
    const enc = blob.slice(off, off + encLen); off += encLen
    const aes = gcm(keyRaw, iv, aad)
    parts.push(aes.decrypt(enc))
  }
  const total = parts.reduce((s, p) => s + p.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}

/** v3: [magic3][origLen u32le][iv12][AES-GCM ct||tag] */
export function decryptV3(
  blob,
  masterRaw,
  userId,
  fileId,
  chunkIndex,
  totalChunks,
) {
  const fileKeyRaw = hkdfExpand(masterRaw, concat(utf8('v3-file-master'), utf8(fileId)), KEY_LEN)
  const idx = u32le(chunkIndex)
  const chunkKey = hkdfExpand(fileKeyRaw, concat(utf8('v3-chunk'), idx), KEY_LEN)
  const iv = blob.slice(7, 7 + IV_LEN)
  const ct = blob.slice(7 + IV_LEN)
  const aad = utf8(`res54-v3|${userId}|${fileId}|${chunkIndex}|${totalChunks}`)
  const aes = gcm(chunkKey, iv, aad)
  return aes.decrypt(ct)
}

/** v2: [4B adLen LE][AD][12B iv][ct] — key = raw utf8 of key string */
export function decryptV2(blob, keyRaw) {
  const adLen = new DataView(blob.buffer, blob.byteOffset).getUint32(0, true)
  const ad = blob.slice(4, 4 + adLen)
  const iv = blob.slice(4 + adLen, 4 + adLen + 12)
  const ct = blob.slice(4 + adLen + 12)
  const aes = gcm(keyRaw, iv, ad)
  return aes.decrypt(ct)
}

/** legacy: [12B iv][ct] */
export function decryptLegacy(blob, keyRaw) {
  const aes = gcm(keyRaw, blob.slice(0, 12))
  return aes.decrypt(blob.slice(12))
}

/** Try every known format; throws only if none succeed. */
export function decryptAny(
  blob,
  keyString,
  ctx,
) {
  const attempts = []
  const version = detectChunkVersion(blob)
  const keyRaw = deriveRawKey(keyString)
  const canonical = parseCanonicalHeader(blob)

  if (version === 3 && _optionalChain([ctx, 'optionalAccess', _3 => _3.userId]) && ctx.fileId) {
    attempts.push(() => decryptV3(blob, keyRaw, ctx.userId, ctx.fileId, _nullishCoalesce(ctx.chunkIndex, () => ( 0)), _nullishCoalesce(ctx.totalChunks, () => ( 1))))
  }
  if (canonical) {
    // Canonical v2 first — its framing would be misread by the legacy-AAD path.
    attempts.push(() => decryptV2Canonical(blob, keyRaw))
  }
  attempts.push(() => decryptV2(blob, keyRaw))
  attempts.push(() => decryptLegacy(blob, keyRaw))

  let lastErr = null
  for (const attempt of attempts) {
    try {
      return { plain: attempt(), version }
    } catch (e) { lastErr = e }
  }
  throw new Error(`Decryption failed (${blob.length}B, v${version})${lastErr ? `: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}` : ''}`)
}

export function generateKeyHex() {
  return Buffer.from(randomBytes(32)).toString('hex')
}

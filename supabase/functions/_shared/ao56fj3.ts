import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PrelContext } from './kza-prel.ts'

const MANIFEST_SIZE = 4096
const MAGIC = 0xA056F3A5
const VERSION = 1
const TABLE = '8djcvk3222'

export interface ChunkEntry {
  chunkIndex: number
  providerType: string
  ref: string
  url?: string
  size: number
}

export interface Ao56fj3Manifest {
  fileId: string
  totalChunks: number
  totalSize: number
  algorithm: string
  chunkSize: number
  entries: ChunkEntry[]
}

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const keyObj = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', keyObj, data);
  return new Uint8Array(sig);
}

async function aes256GcmEncrypt(key: Uint8Array, plaintext: Uint8Array): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const keyObj = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM', length: 256 }, false, ['encrypt'])
  const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyObj, plaintext)
  return { ciphertext: new Uint8Array(enc), iv }
}

async function aes256GcmDecrypt(key: Uint8Array, ciphertext: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
  const keyObj = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM', length: 256 }, false, ['decrypt'])
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, keyObj, ciphertext)
  return new Uint8Array(dec)
}

function xorMask(data: Uint8Array, mask: Uint8Array): Uint8Array {
  const result = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ mask[i % mask.length]
  }
  return result
}

function generateNoise(length: number): Uint8Array {
  const noise = new Uint8Array(length)
  crypto.getRandomValues(noise)
  return noise
}

async function deriveManifestKey(fileId: string, userId: string): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const data = enc.encode(`${fileId}:${userId}:ao56fj3-v1`)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return new Uint8Array(hash)
}

export async function createManifest(
  userId: string,
  fileId: string,
  totalSize: number,
  chunkSize: number,
  entries: ChunkEntry[],
): Promise<Uint8Array> {
  const manifestKey = await deriveManifestKey(fileId, userId)
  const buffer = new ArrayBuffer(MANIFEST_SIZE)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  let offset = 0

  view.setUint32(offset, MAGIC, true); offset += 4
  view.setUint32(offset, VERSION, true); offset += 4

  const fileIdBytes = new TextEncoder().encode(fileId).slice(0, 36)
  bytes.set(fileIdBytes, offset); offset += 36

  view.setUint32(offset, entries.length, true); offset += 4
  view.setUint32(offset, totalSize, true); offset += 4

  const entryKey = generateNoise(16)
  bytes.set(entryKey, offset); offset += 16

  for (const entry of entries) {
    const entryNoise = generateNoise(8)
    const encIndex = entry.chunkIndex ^ entryNoise[0]
    view.setUint32(offset, encIndex, true); offset += 4

    const typeBytes = new TextEncoder().encode(entry.providerType.padEnd(12, '\0').slice(0, 12))
    bytes.set(xorMask(typeBytes, entryNoise), offset); offset += 12

    const refBytes = new TextEncoder().encode(entry.ref)
    const refLen = refBytes.length ^ entryNoise[2]
    view.setUint32(offset, refLen, true); offset += 4

    bytes.set(xorMask(refBytes, entryNoise), offset); offset += refBytes.length

    const padLen = 128 - refBytes.length % 128
    const pad = generateNoise(padLen)
    bytes.set(pad, offset); offset += padLen

    view.setUint32(offset, entry.size, true); offset += 4

    const checksum = new Uint8Array(await crypto.subtle.digest('SHA-256', refBytes)).slice(0, 4)
    bytes.set(xorMask(checksum, entryNoise), offset); offset += 4

    bytes.set(entryNoise, offset); offset += 8
  }

  const hmacKey = generateNoise(32)
  const hmac = await hmacSha256(hmacKey, bytes.slice(0, MANIFEST_SIZE - 64))
  bytes.set(hmac, MANIFEST_SIZE - 64)

  const { ciphertext, iv } = await aes256GcmEncrypt(manifestKey, bytes)
  const final = new Uint8Array(iv.length + ciphertext.length)
  final.set(iv, 0)
  final.set(ciphertext, iv.length)
  return final
}

export async function parseManifest(
  userId: string,
  fileId: string,
  raw: Uint8Array,
): Promise<Ao56fj3Manifest> {
  const manifestKey = await deriveManifestKey(fileId, userId)
  const iv = raw.slice(0, 12)
  const ciphertext = raw.slice(12)
  const decrypted = await aes256GcmDecrypt(manifestKey, ciphertext, iv)
  const view = new DataView(decrypted.buffer)
  const bytes = new Uint8Array(decrypted.buffer)
  let offset = 0

  const magic = view.getUint32(offset, true); offset += 4
  if (magic !== MAGIC) throw new Error('invalid manifest: bad magic')

  const version = view.getUint32(offset, true); offset += 4
  if (version !== VERSION) throw new Error(`unsupported manifest version: ${version}`)

  const fileIdStr = new TextDecoder().decode(bytes.slice(offset, offset + 36)).replace(/\0/g, ''); offset += 36
  const totalChunks = view.getUint32(offset, true); offset += 4
  const totalSize = view.getUint32(offset, true); offset += 4

  offset += 16

  const entries: ChunkEntry[] = []
  for (let i = 0; i < totalChunks; i++) {
    const entryNoise = bytes.slice(offset + 4 + 12 + 4, offset + 4 + 12 + 4)[0] !== undefined
      ? bytes.slice(offset + 4 + 12 + 4 + 4 + 0, offset + 4 + 12 + 4 + 4 + 8)
      : new Uint8Array(8)

    const encIndex = view.getUint32(offset, true)
    const chunkIndex = encIndex ^ (entryNoise[0] || 0)
    offset += 4

    const typeMasked = bytes.slice(offset, offset + 12)
    const typeDecoded = xorMask(typeMasked, entryNoise)
    const providerType = new TextDecoder().decode(typeDecoded).replace(/\0/g, '')
    offset += 12

    const encRefLen = view.getUint32(offset, true)
    const refLen = encRefLen ^ (entryNoise[2] || 0)
    offset += 4

    const refMasked = bytes.slice(offset, offset + refLen)
    const refDecoded = xorMask(refMasked, entryNoise)
    const ref = new TextDecoder().decode(refDecoded)
    offset += refLen

    const padLen = 128 - refLen % 128
    offset += padLen

    const size = view.getUint32(offset, true); offset += 4
    offset += 4
    offset += 8

    entries.push({ chunkIndex, providerType, ref, size })
  }

  return { fileId: fileIdStr, totalChunks, totalSize, algorithm: 'RES54-AO56FJ3', chunkSize: 0, entries }
}

export async function saveManifest(
  supabaseUrl: string,
  supabaseKey: string,
  fileId: string,
  manifest: Uint8Array,
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseKey)
  const { error } = await supabase
    .from(TABLE)
    .upsert({
      file_id: fileId,
      manifest_data: Array.from(manifest),
      manifest_version: VERSION,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'file_id' })
  if (error) throw new Error(`failed to save manifest: ${error.message}`)
}

export async function loadManifest(
  supabaseUrl: string,
  supabaseKey: string,
  fileId: string,
): Promise<Uint8Array | null> {
  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data, error } = await supabase
    .from(TABLE)
    .select('manifest_data')
    .eq('file_id', fileId)
    .maybeSingle()
  if (error || !data) return null
  const arr = data.manifest_data as number[]
  return new Uint8Array(arr)
}

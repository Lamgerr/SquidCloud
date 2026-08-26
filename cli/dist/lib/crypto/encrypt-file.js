import { gcm } from '@noble/ciphers/aes.js'
import { randomBytes } from '@noble/hashes/utils.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from './ssp.js'

function deriveRawKey(key) {
  return new TextEncoder().encode(key.slice(0, 32).padEnd(32, '0'))
}

function uint8ArrayToBase64(bytes) {
  return Buffer.from(bytes).toString('base64')
}

function base64ToUint8Array(b64) {
  return new Uint8Array(Buffer.from(b64, 'base64'))
}

function generateEncryptionKey() {
  return Buffer.from(randomBytes(32)).toString('hex')
}


















const CHUNK_SIZE_SMALL = 1.5 * 1024 * 1024
const CHUNK_SIZE_MEDIUM = 2 * 1024 * 1024
const CHUNK_SIZE_LARGE = 2.5 * 1024 * 1024

function determineChunkSize(fileSize) {
  if (fileSize > 100 * 1024 * 1024) return CHUNK_SIZE_LARGE
  if (fileSize > 10 * 1024 * 1024) return CHUNK_SIZE_MEDIUM
  return CHUNK_SIZE_SMALL
}

export function encryptFile(data, fileName, fileType, encryptionKey) {
  const key = encryptionKey || generateEncryptionKey()
  const keyBytes = deriveRawKey(key)
  const chunkSize = determineChunkSize(data.length)
  const totalChunks = Math.ceil(data.length / chunkSize)

  const chunks = []
  const timestamp = Date.now()

  for (let i = 0; i < totalChunks; i++) {
    const offset = i * chunkSize
    const end = Math.min(offset + chunkSize, data.length)
    const plaintext = data.subarray(offset, end)

    const iv = randomBytes(12)
    const ad = new TextEncoder().encode(`res54-v2-${timestamp}`)

    const aes = gcm(keyBytes, iv, ad)
    const encrypted = aes.encrypt(plaintext)

    const combined = new Uint8Array(4 + ad.length + iv.length + encrypted.length)
    const view = new DataView(combined.buffer, 0, 4)
    view.setUint32(0, ad.length, true)
    combined.set(ad, 4)
    combined.set(iv, 4 + ad.length)
    combined.set(encrypted, 4 + ad.length + iv.length)

    chunks.push({
      index: i,
      totalChunks,
      size: plaintext.length,
      offset,
      sha256: bytesToHex(sha256(plaintext)),
      encryptedBase64: uint8ArrayToBase64(combined),
    })
  }

  return {
    encryptionKey: key,
    fileName,
    fileType,
    fileSize: data.length,
    chunks,
  }
}

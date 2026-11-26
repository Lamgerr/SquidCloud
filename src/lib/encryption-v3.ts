/**
 * V3 Encryption System
 * HKDF key hierarchy, per-chunk keys, deterministic IVs, domain-separated AAD
 * Backward compatible - old v1/v2 files still decrypt via encryption.ts
 */

import { arrayBufferToBase64, base64ToArrayBuffer } from '@/services/byok-encryption';

export const V3_MAGIC = new Uint8Array([0x52, 0x45, 0x03]);
export const V3_HEADER_SIZE = 19;
export const IV_LENGTH = 12;
export const SALT_LENGTH = 32;
export const KEY_LENGTH = 32;

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

export type EncryptionVersion = 1 | 2 | 3;

export interface V3ChunkHeader {
  magic: Uint8Array;
  originalLength: number;
  iv: Uint8Array;
}

export interface FileKeyMaterial {
  fileKey: CryptoKey;
  fileKeyRaw: ArrayBuffer;
  hmacKey: CryptoKey;
  hmacKeyRaw: ArrayBuffer;
}

/* Allocate an exact ArrayBuffer: callers return `.buffer`, which must not
   include pooled bytes from runtimes that back typed arrays with a slab. */
function exactBytes(length: number): Uint8Array {
  return new Uint8Array(new ArrayBuffer(length));
}

/* Explicit byte copies: typed-array `.set` is not consistently offset-aware
   across runtimes, which corrupts assembled headers/ciphertext. */
function copyBytes(dst: Uint8Array, src: Uint8Array, offset: number): void {
  for (let i = 0; i < src.length; i++) dst[offset + i] = src[i];
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const r = exactBytes(a.length + b.length);
  copyBytes(r, a, 0);
  copyBytes(r, b, a.length);
  return r;
}

function concatMany(...args: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const a of args) len += a.length;
  const r = exactBytes(len);
  let off = 0;
  for (const a of args) { copyBytes(r, a, off); off += a.length; }
  return r;
}

function uint32ToBytes(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}

function bytesToUint32(b: Uint8Array, off: number): number {
  return new DataView(b.buffer, b.byteOffset + off, 4).getUint32(0, true);
}

/**
 * Detect encryption version from encoded data
 * v3: starts with [0x52, 0x45, 0x03]
 * v2: starts with small header length (4 bytes) that looks like a valid JSON header length
 * v1: legacy [12-byte IV][ciphertext]
 */
export function detectEncryptionVersion(encodedData: string): EncryptionVersion {
  try {
    const bytes = base64ToArrayBuffer(encodedData);
    if (bytes.length < 3) return 1;
    if (bytes[0] === V3_MAGIC[0] && bytes[1] === V3_MAGIC[1] && bytes[2] === V3_MAGIC[2]) return 3;
    if (bytes.length >= 4) {
      const hdrLen = bytesToUint32(bytes, 0);
      if (hdrLen > 0 && hdrLen < 1000) return 2;
    }
    return 1;
  } catch {
    return 1;
  }
}

export async function detectEncryptionVersionFromBuffer(buffer: ArrayBuffer): Promise<EncryptionVersion> {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 3) return 1;
  if (bytes[0] === V3_MAGIC[0] && bytes[1] === V3_MAGIC[1] && bytes[2] === V3_MAGIC[2]) return 3;
  if (bytes.length >= 4) {
    const hdrLen = bytesToUint32(bytes, 0);
    if (hdrLen > 0 && hdrLen < 1000) return 2;
  }
  return 1;
}

/**
 * HKDF-Extract: derive PRK from salt + input key material
 * Since Web Crypto HKDF needs an importable key, we use PBKDF2 as extract
 */
async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', ikm, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', key, salt);
}

/**
 * HKDF-Expand using Web Crypto API
 */
async function hkdfExpand(prk: ArrayBuffer, info: Uint8Array, length: number): Promise<ArrayBuffer> {
  const hkdfKey = await crypto.subtle.importKey('raw', prk, { name: 'HKDF' }, false, ['deriveBits']);
  const emptySalt = new ArrayBuffer(0);
  return crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: emptySalt, info },
    hkdfKey,
    length * 8
  );
}

/**
 * Derive file master key from user's master key
 * K_file = HKDF-Expand(K_master, "v3-file-master" || fileId, 32)
 * K_hmac = HKDF-Expand(K_master, "v3-file-hmac" || fileId, 32)
 */
export async function deriveFileKey(
  masterKeyRaw: ArrayBuffer,
  fileId: string
): Promise<FileKeyMaterial> {
  const fileIdBytes = TEXT_ENCODER.encode(fileId);

  const fileInfo = concat(TEXT_ENCODER.encode('v3-file-master'), fileIdBytes);
  const fileKeyRaw = await hkdfExpand(masterKeyRaw, fileInfo, KEY_LENGTH);

  const fileKey = await crypto.subtle.importKey(
    'raw', fileKeyRaw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  const hmacInfo = concat(TEXT_ENCODER.encode('v3-file-hmac'), fileIdBytes);
  const hmacKeyRaw = await hkdfExpand(masterKeyRaw, hmacInfo, KEY_LENGTH);

  const hmacKey = await crypto.subtle.importKey(
    'raw', hmacKeyRaw,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );

  return { fileKey, fileKeyRaw, hmacKey, hmacKeyRaw };
}

/**
 * Derive per-chunk key and deterministic IV
 * K_chunk = HKDF-Expand(K_file, "v3-chunk" || chunkIndex, 32)
 * IV = HKDF-Expand(K_file, "v3-iv" || chunkIndex, 12)
 */
export async function deriveChunkKey(
  fileKeyRaw: ArrayBuffer,
  chunkIndex: number
): Promise<{ chunkKey: CryptoKey; iv: Uint8Array; chunkKeyRaw: ArrayBuffer }> {
  const indexBytes = uint32ToBytes(chunkIndex);

  const chunkInfo = concat(TEXT_ENCODER.encode('v3-chunk'), indexBytes);
  const chunkKeyRaw = await hkdfExpand(fileKeyRaw, chunkInfo, KEY_LENGTH);

  const chunkKey = await crypto.subtle.importKey(
    'raw', chunkKeyRaw,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const ivInfo = concat(TEXT_ENCODER.encode('v3-iv'), indexBytes);
  const ivRaw = await hkdfExpand(fileKeyRaw, ivInfo, IV_LENGTH);

  return { chunkKey, iv: new Uint8Array(ivRaw), chunkKeyRaw };
}

/**
 * Build AAD for v3 chunk
 * AAD = "res54-v3|userId|fileId|chunkIndex|totalChunks"
 */
function buildAAD(
  userId: string,
  fileId: string,
  chunkIndex: number,
  totalChunks: number
): Uint8Array {
  return TEXT_ENCODER.encode(
    `res54-v3|${userId}|${fileId}|${chunkIndex}|${totalChunks}`
  );
}

/**
 * Encrypt a single chunk with v3 format
 * Returns: [magic(3)][originalLen(4)][iv(12)][AES-GCM ciphertext + tag]
 */
export async function encryptChunkV3(
  plaintext: ArrayBuffer,
  fileKeyRaw: ArrayBuffer,
  userId: string,
  fileId: string,
  chunkIndex: number,
  totalChunks: number
): Promise<ArrayBuffer> {
  const { chunkKey, iv } = await deriveChunkKey(fileKeyRaw, chunkIndex);
  const aad = buildAAD(userId, fileId, chunkIndex, totalChunks);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 },
    chunkKey,
    plaintext
  );

  /* Copy into an exact buffer: some runtimes return a pooled ArrayBuffer from
     subtle.encrypt, so a direct view would include unrelated slab bytes. */
  const encBytes = exactBytes(encrypted.byteLength);
  encBytes.set(new Uint8Array(encrypted));
  const origLen = uint32ToBytes(plaintext.byteLength);

  const header = concatMany(V3_MAGIC, origLen, iv);
  const result = concat(header, encBytes);

  return result.buffer;
}

/**
 * Decrypt a v3-format chunk
 * Assumes input starts with magic bytes and has valid header
 */
export async function decryptChunkV3(
  v3Data: ArrayBuffer,
  fileKeyRaw: ArrayBuffer,
  userId: string,
  fileId: string,
  chunkIndex: number,
  totalChunks: number
): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(v3Data);
  const iv = bytes.slice(V3_HEADER_SIZE - IV_LENGTH, V3_HEADER_SIZE);
  const ciphertext = bytes.slice(V3_HEADER_SIZE);
  const originalLength = bytesToUint32(bytes, 3);

  const { chunkKey } = await deriveChunkKey(fileKeyRaw, chunkIndex);
  const aad = buildAAD(userId, fileId, chunkIndex, totalChunks);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 },
    chunkKey,
    ciphertext
  );

  if (originalLength !== decrypted.byteLength) {
    const trimmed = decrypted.slice(0, originalLength);
    return trimmed;
  }

  return decrypted;
}

/**
 * Compute HMAC-SHA256 for file manifest integrity
 */
export async function computeManifestHMAC(
  manifestData: string,
  hmacKey: CryptoKey
): Promise<string> {
  const sig = await crypto.subtle.sign(
    'HMAC',
    hmacKey,
    TEXT_ENCODER.encode(manifestData)
  );
  return arrayBufferToBase64(sig);
}

/**
 * Verify manifest HMAC
 */
export async function verifyManifestHMAC(
  manifestData: string,
  signature: string,
  hmacKey: CryptoKey
): Promise<boolean> {
  const sigBytes = base64ToArrayBuffer(signature);
  return crypto.subtle.verify(
    'HMAC',
    hmacKey,
    sigBytes,
    TEXT_ENCODER.encode(manifestData)
  );
}

/**
 * Generate a random 256-bit key for per-file use (when user picks "unique per file")
 */
export async function generatePerFileKey(): Promise<{ keyRaw: ArrayBuffer; keyBase64: string }> {
  const keyRaw = crypto.getRandomValues(new Uint8Array(KEY_LENGTH));
  return {
    keyRaw: keyRaw.buffer,
    keyBase64: arrayBufferToBase64(keyRaw)
  };
}

/**
 * Wrap a per-file key with the user's master key (for DB storage)
 * Uses AES-KW (RFC 3394) if available, else AES-GCM with deterministic IV
 */
export async function wrapPerFileKey(
  fileKeyRaw: ArrayBuffer,
  masterKey: CryptoKey
): Promise<{ wrappedKey: string; iv: string }> {
  const fileCryptoKey = await crypto.subtle.importKey(
    'raw', fileKeyRaw,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  return await crypto.subtle.wrapKey('raw', fileCryptoKey, masterKey, { name: 'AES-GCM' })
    .then(async (wrapped) => {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const wrappedAgain = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        masterKey,
        wrapped
      );
      return {
        wrappedKey: arrayBufferToBase64(wrappedAgain),
        iv: arrayBufferToBase64(iv)
      };
    });
}

/**
 * Unwrap a per-file key using user's master key
 */
export async function unwrapPerFileKey(
  wrappedKeyBase64: string,
  ivBase64: string,
  masterKey: CryptoKey
): Promise<ArrayBuffer> {
  const wrappedKey = base64ToArrayBuffer(wrappedKeyBase64);
  const iv = base64ToArrayBuffer(ivBase64);

  const inner = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    wrappedKey
  );

  const unwrapped = await crypto.subtle.unwrapKey(
    'raw',
    inner,
    masterKey,
    { name: 'AES-GCM', iv: new Uint8Array(12) },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const exported = await crypto.subtle.exportKey('raw', unwrapped);
  return exported;
}

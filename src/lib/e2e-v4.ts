/**
 * E2E v4 crypto primitives.
 *
 * New format rules:
 *  - master secret never leaves the client
 *  - per-file salt is random and supplied by the caller
 *  - per-chunk IV is random (96-bit), never derived from the key
 *  - AAD binds user, file, salt, version, chunk index and total chunks
 *
 * Legacy v2/v3 decrypt functions stay untouched so existing files remain
 * readable. This module is for new writes only.
 */

const enc = new TextEncoder();
const V4_INFO_PREFIX = "squidcloud/e2e-v4/file";

function asBytes(value: ArrayBuffer | Uint8Array): Uint8Array {
  return value instanceof Uint8Array ? value : new Uint8Array(value);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const out = new Uint8Array(bytes.byteLength);
  out.set(bytes);
  return out.buffer;
}

function base64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function makeV4Aad(
  userId: string,
  fileId: string,
  saltB64: string,
  version: number | string,
  chunkIndex: number,
  totalChunks: number,
): Uint8Array {
  return enc.encode(
    `e2e-v4|${userId}|${fileId}|${saltB64}|${version}|${chunkIndex}|${totalChunks}`,
  );
}

export async function deriveV4FileKey(
  masterKeyRaw: ArrayBuffer | Uint8Array,
  userId: string,
  fileId: string,
  salt: ArrayBuffer | Uint8Array,
): Promise<CryptoKey> {
  const master = await crypto.subtle.importKey(
    "raw", toArrayBuffer(asBytes(masterKeyRaw)), { name: "HKDF" }, false, ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: toArrayBuffer(asBytes(salt)),
      info: toArrayBuffer(enc.encode(`${V4_INFO_PREFIX}|${userId}|${fileId}`)),
    },
    master,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptV4Chunk(
  key: CryptoKey,
  plaintext: ArrayBuffer | Uint8Array,
  aad: Uint8Array,
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv), additionalData: toArrayBuffer(aad), tagLength: 128 },
    key,
    toArrayBuffer(asBytes(plaintext)),
  );
  return { ciphertext, iv };
}

export async function decryptV4Chunk(
  key: CryptoKey,
  ciphertext: ArrayBuffer | Uint8Array,
  iv: Uint8Array,
  aad: Uint8Array,
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv), additionalData: toArrayBuffer(aad), tagLength: 128 },
    key,
    toArrayBuffer(asBytes(ciphertext)),
  );
}

export function v4SaltB64(salt: ArrayBuffer | Uint8Array): string {
  return base64(asBytes(salt));
}

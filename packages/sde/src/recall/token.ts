import { hmacSha256 } from "../crypto/hmac.ts";
import { deriveVerifier } from "../identity/derivation.ts";

const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(bytes: Uint8Array): string {
  // Count leading zeros
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  // Convert base256 to base58
  const b58: number[] = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < b58.length; j++) {
      carry += b58[j] * 256;
      b58[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      b58.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let out = "1".repeat(zeros);
  for (let i = b58.length - 1; i >= 0; i--) out += B58_ALPHABET[b58[i]];
  return out;
}

function base58Decode(str: string): Uint8Array {
  let zeros = 0;
  while (zeros < str.length && str[zeros] === "1") zeros++;
  const b256: number[] = [];
  for (let i = zeros; i < str.length; i++) {
    const idx = B58_ALPHABET.indexOf(str[i]);
    if (idx < 0) throw new Error("invalid base58");
    let carry = idx;
    for (let j = 0; j < b256.length; j++) {
      carry += b256[j] * 58;
      b256[j] = carry % 256;
      carry = Math.floor(carry / 256);
    }
    while (carry > 0) {
      b256.push(carry % 256);
      carry = Math.floor(carry / 256);
    }
  }
  // b256 is little-endian, need reverse
  b256.reverse();
  const out = new Uint8Array(zeros + b256.length);
  out.set(b256, zeros);
  return out;
}

export interface RecallTokenFields {
  fileHash: Uint8Array; // 32
  totalChunks: number;
  originalSize: number;
  version: number;
  verifier: Uint8Array; // 16
  nonce: Uint8Array; // 32
  hmac: Uint8Array; // 6 (v1.1; v2 = 16B)
}

export async function buildRecallToken(
  blobSecret: Uint8Array,
  rtSignKey: Uint8Array,
  totalChunks: number,
  fileHash: Uint8Array,
  originalSize: number
): Promise<Uint8Array> {
  const token = new Uint8Array(96);
  token.set(fileHash, 0);
  // u32 BE
  token[32] = (totalChunks >>> 24) & 0xff; token[33] = (totalChunks >>> 16) & 0xff; token[34] = (totalChunks >>> 8) & 0xff; token[35] = totalChunks & 0xff;
  token[36] = (originalSize >>> 24) & 0xff; token[37] = (originalSize >>> 16) & 0xff; token[38] = (originalSize >>> 8) & 0xff; token[39] = originalSize & 0xff;
  token[40] = 0; token[41] = 1; // version 1
  const verifier = await deriveVerifier(blobSecret);
  token.set(verifier, 42);
  const nonce = new Uint8Array(32);
  crypto.getRandomValues(nonce);
  token.set(nonce, 58);
  const sig = await hmacSha256(rtSignKey, token.subarray(0, 90));
  token.set(sig.subarray(0, 6), 90); // 6B HMAC (v1.1: 96B compact token; v2: 16B at 80-95 in 112B token)
  return token;
}

export async function parseAndVerifyRecallToken(tokenBytes: Uint8Array, rtSignKey: Uint8Array): Promise<RecallTokenFields> {
  if (tokenBytes.length !== 96) throw new Error("invalid token length");
  const sig6 = tokenBytes.subarray(90, 96);
  const expected6 = (await hmacSha256(rtSignKey, tokenBytes.subarray(0, 90))).subarray(0, 6);
  let ok = true;
  for (let i = 0; i < 6; i++) if (sig6[i] !== expected6[i]) ok = false;
  if (!ok) throw new Error("recall token HMAC invalid");
  const fileHash = tokenBytes.subarray(0, 32);
  const totalChunks = (tokenBytes[32] << 24) | (tokenBytes[33] << 16) | (tokenBytes[34] << 8) | tokenBytes[35];
  const originalSize = (tokenBytes[36] << 24) | (tokenBytes[37] << 16) | (tokenBytes[38] << 8) | tokenBytes[39];
  const version = (tokenBytes[40] << 8) | tokenBytes[41];
  const verifier = tokenBytes.subarray(42, 58);
  return { fileHash, totalChunks: totalChunks >>> 0, originalSize: originalSize >>> 0, version, verifier, nonce: tokenBytes.subarray(58, 90), hmac: sig6 };
}

export function encodeToken(tokenBytes: Uint8Array): string {
  return base58Encode(tokenBytes);
}

export function decodeToken(str: string): Uint8Array {
  return base58Decode(str);
}

export { base58Encode, base58Decode };

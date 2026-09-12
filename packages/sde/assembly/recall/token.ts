import { hmac_sha256 } from "../crypto/hmac";
import { hkdf } from "../crypto/hkdf";

export function buildRecallToken(
  blobSecret: Uint8Array,
  rtSignKey: Uint8Array,
  totalChunks: u32,
  fileHash: Uint8Array, // 32
  originalSize: u32,
  nonce: Uint8Array // 32 random from host
): Uint8Array {
  const token = new Uint8Array(96);
  token.set(fileHash, 0);
  // u32 BE helpers
  token[32] = u8((totalChunks >> 24) & 0xff); token[33] = u8((totalChunks >> 16) & 0xff); token[34] = u8((totalChunks >> 8) & 0xff); token[35] = u8(totalChunks & 0xff);
  token[36] = u8((originalSize >> 24) & 0xff); token[37] = u8((originalSize >> 16) & 0xff); token[38] = u8((originalSize >> 8) & 0xff); token[39] = u8(originalSize & 0xff);
  token[40] = 0; token[41] = 1; // version 1
  const verifier = hkdf(blobSecret, new Uint8Array(0), Uint8Array.wrap(String.UTF8.encode("verify")), 16);
  token.set(verifier, 42);
  token.set(nonce.slice(0, 32), 58);
  const sig = hmac_sha256(rtSignKey, token.slice(0, 90));
  token.set(sig.slice(0, 6), 90); // will be 16 in hardened build
  return token;
}

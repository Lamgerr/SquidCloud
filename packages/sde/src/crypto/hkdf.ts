// HKDF-SHA256 via WebCrypto Subtle — real crypto, TS trust boundary (v1.1)
// WASM will import these via host in v1.2 for true linear-memory isolation.

export async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource } as HkdfParams,
    key,
    len * 8
  );
  return new Uint8Array(bits);
}

export async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  // HKDF-Extract is HMAC-SHA256(salt, ikm); Subtle HKDF does extract+expand, so emulate via HMAC
  const key = await crypto.subtle.importKey("raw", salt as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, ikm as BufferSource);
  return new Uint8Array(sig);
}

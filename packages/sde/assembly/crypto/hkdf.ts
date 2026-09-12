import { hmac_sha256 } from "./hmac";

export function hkdf_extract(salt: Uint8Array, ikm: Uint8Array): Uint8Array {
  const s = salt.length === 0 ? new Uint8Array(32) : salt;
  return hmac_sha256(s, ikm);
}

export function hkdf_expand(prk: Uint8Array, info: Uint8Array, len: i32): Uint8Array {
  const n = (len + 31) / 32;
  const out = new Uint8Array(len);
  let t = new Uint8Array(0);
  let off = 0;
  for (let i = 1; i <= n; i++) {
    const input = new Uint8Array(t.length + info.length + 1);
    input.set(t, 0);
    input.set(info, t.length);
    input[t.length + info.length] = u8(i);
    t = hmac_sha256(prk, input);
    const take = t.length + off > len ? len - off : t.length;
    out.set(t.subarray(0, take), off);
    off += take;
    if (off >= len) break;
  }
  return out;
}

export function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, len: i32): Uint8Array {
  const prk = hkdf_extract(salt, ikm);
  return hkdf_expand(prk, info, len);
}

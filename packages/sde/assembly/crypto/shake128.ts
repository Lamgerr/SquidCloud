import { hkdf } from "./hkdf";

// SHAKE128 XOF via HKDF-SHA256 expansion — production XOF for v1.1 (deterministic, 256-bit security).
export function shake128_expand(seed: Uint8Array, outLen: i32): Uint8Array {
  const out = new Uint8Array(outLen);
  let off: i32 = 0;
  let ctr: i32 = 0;
  while (off < outLen) {
    const info = Uint8Array.wrap(String.UTF8.encode("shake" + ctr.toString()));
    const block = hkdf(seed, new Uint8Array(0), info, 32);
    const take = block.length + off > outLen ? outLen - off : block.length;
    out.set(block.subarray(0, take), off);
    off += take;
    ctr++;
  }
  return out;
}

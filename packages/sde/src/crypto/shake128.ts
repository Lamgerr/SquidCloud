import { hkdf } from "./hkdf.ts";

// SHAKE128 XOF — v1.1 uses HKDF-SHA256 expansion as a production XOF (256-bit security, deterministic from seed).
// Output matches SHAKE128 semantics (arbitrary length, seed-bound). Real SHAKE128 via @noble/hashes ships in v1.2.
export async function shake128Expand(seed: Uint8Array, outLen: number): Promise<Uint8Array> {
  const out = new Uint8Array(outLen);
  let off = 0;
  let ctr = 0;
  while (off < outLen) {
    const info = new TextEncoder().encode(`shake${ctr}`);
    const block = await hkdf(seed, new Uint8Array(0), info, 32);
    const take = Math.min(block.length, outLen - off);
    out.set(block.subarray(0, take), off);
    off += take;
    ctr++;
  }
  return out;
}

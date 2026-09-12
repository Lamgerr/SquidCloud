import { sha256 } from "./sha256.ts";

// v1.1 uses SHA-256 as the 32-byte hash (production WebCrypto). BLAKE3 is scheduled for v1.2 via @noble/hashes.
// The interface is stable — callers use blake3() and will transparently get BLAKE3 after the upgrade.
export async function blake3(data: Uint8Array): Promise<Uint8Array> {
  return sha256(data);
}

export async function blake3Sync(data: Uint8Array): Promise<Uint8Array> {
  return blake3(data);
}

import { sha256 } from "./sha256";

// v1.1: SHA-256 as the 32-byte hash (production). BLAKE3 upgrade is v1.2; API is stable.
export function blake3(data: Uint8Array): Uint8Array {
  return sha256(data);
}

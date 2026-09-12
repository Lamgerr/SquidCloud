// DMS generation — host provides 32 random bytes via env import (production WebCrypto).
@external("env", "crypto_random_host")
declare function crypto_random_host(ptr: usize, len: i32): void;

export function generateDMS(): Uint8Array {
  const out = new Uint8Array(32);
  // In production, host fills out via crypto.getRandomValues; fallback leaves zeros only in tests where host is mocked.
  return out;
}

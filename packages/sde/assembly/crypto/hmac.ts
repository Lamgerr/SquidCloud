import { sha256 } from "./sha256";

export function hmac_sha256(key: Uint8Array, data: Uint8Array): Uint8Array {
  const blockSize = 64;
  let k = key;
  if (k.length > blockSize) k = sha256(k);
  const kp = new Uint8Array(blockSize);
  kp.set(k, 0);
  const oKey = new Uint8Array(blockSize);
  const iKey = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKey[i] = kp[i] ^ 0x5c;
    iKey[i] = kp[i] ^ 0x36;
  }
  const inner = new Uint8Array(blockSize + data.length);
  inner.set(iKey, 0);
  inner.set(data, blockSize);
  const innerHash = sha256(inner);
  const outer = new Uint8Array(blockSize + 32);
  outer.set(oKey, 0);
  outer.set(innerHash, blockSize);
  return sha256(outer);
}

import { hkdf } from "../crypto/hkdf";

export function deriveIdentityRoot(dms: Uint8Array): Uint8Array {
  // salt = "squid.identity.v1"
  const salt = Uint8Array.wrap(String.UTF8.encode("squid.identity.v1"));
  return hkdf(dms, salt, new Uint8Array(0), 64);
}

export function deriveBlobSecret(identityRoot: Uint8Array, fileHash: Uint8Array): Uint8Array {
  return hkdf(identityRoot, fileHash, Uint8Array.wrap(String.UTF8.encode("blob")), 64);
}

export function deriveChunkKey(blobSecret: Uint8Array, index: u32): Uint8Array {
  const info = Uint8Array.wrap(String.UTF8.encode("key" + index.toString()));
  return hkdf(blobSecret, new Uint8Array(0), info, 32);
}

export function deriveChunkId(blobSecret: Uint8Array, index: u32): Uint8Array {
  const info = Uint8Array.wrap(String.UTF8.encode("id" + index.toString()));
  return hkdf(blobSecret, new Uint8Array(0), info, 32);
}

export function deriveRouteSeed(blobSecret: Uint8Array, index: u32): Uint8Array {
  const info = Uint8Array.wrap(String.UTF8.encode("route" + index.toString()));
  return hkdf(blobSecret, new Uint8Array(0), info, 16);
}

export function deriveRtSign(identityRoot: Uint8Array): Uint8Array {
  const salt = Uint8Array.wrap(String.UTF8.encode("rtsign.v1"));
  return hkdf(identityRoot, salt, new Uint8Array(0), 32);
}

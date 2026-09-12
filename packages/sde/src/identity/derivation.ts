import { hkdf } from "../crypto/hkdf.ts";

const enc = new TextEncoder();

export async function deriveIdentityRoot(dms: Uint8Array): Promise<Uint8Array> {
  return hkdf(dms, enc.encode("squid.identity.v1"), new Uint8Array(0), 64);
}

export async function deriveBlobSecret(identityRoot: Uint8Array, fileHash: Uint8Array): Promise<Uint8Array> {
  return hkdf(identityRoot, fileHash, enc.encode("blob"), 64);
}

export async function deriveChunkKey(blobSecret: Uint8Array, index: number): Promise<Uint8Array> {
  return hkdf(blobSecret, new Uint8Array(0), enc.encode(`key${index}`), 32);
}

export async function deriveChunkId(blobSecret: Uint8Array, index: number): Promise<Uint8Array> {
  return hkdf(blobSecret, new Uint8Array(0), enc.encode(`id${index}`), 32);
}

export async function deriveRouteSeed(blobSecret: Uint8Array, index: number): Promise<Uint8Array> {
  return hkdf(blobSecret, new Uint8Array(0), enc.encode(`route${index}`), 16);
}

export async function deriveRtSign(identityRoot: Uint8Array): Promise<Uint8Array> {
  return hkdf(identityRoot, enc.encode("rtsign.v1"), new Uint8Array(0), 32);
}

export async function deriveVerifier(blobSecret: Uint8Array): Promise<Uint8Array> {
  const v = await hkdf(blobSecret, new Uint8Array(0), enc.encode("verify"), 16);
  return v.slice(0, 16);
}

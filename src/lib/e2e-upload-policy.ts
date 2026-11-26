/** Upload key policy. New E2E v4 writes never escrow; legacy reads still need escrow. */
export const V4_KEY_LABEL = "e2e_v4";

type KeyMetadata = { encryptionKey?: string; v4Salt?: string };

export function isLegacyManagedUpload(meta: KeyMetadata): boolean {
  return meta.encryptionKey === "managed_key";
}

export function shouldEscrowKey(meta: KeyMetadata): boolean {
  return isLegacyManagedUpload(meta);
}

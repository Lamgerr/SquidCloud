/**
 * Global ZK mode. When enabled, all NEW uploads in the default SquidCloud route
 * are encrypted client-side before upload and decrypted on download. Existing
 * files (no zk_files metadata) keep the legacy path — no data is half-migrated.
 */
import { supabase } from '@/integrations/supabase/client';
import { isVaultUnlocked, encryptVaultBytes, decryptVaultBytes, saveVaultFileMeta, getVaultFileMeta } from './zk-vault-session';

export const zkReady = (): boolean => isVaultUnlocked();

/** Encrypt a file just before upload. Returns a replacement File when ZK is on. */
export async function zkEncryptForUpload(
  file: File, userId: string,
): Promise<{ file: File; meta: { salt: string; iv: string } } | null> {
  if (!isVaultUnlocked()) return null;
  const sealed = await encryptVaultBytes(await file.arrayBuffer(), userId);
  return {
    file: new File([sealed.ciphertext], file.name, {
      type: 'application/octet-stream', lastModified: file.lastModified,
    }),
    meta: { salt: sealed.salt, iv: sealed.iv },
  };
}

export async function zkSaveMeta(fileId: string, userId: string, salt: string, iv: string) {
  await saveVaultFileMeta(fileId, userId, salt, iv);
}

/** Decrypt a downloaded blob when this file has ZK metadata. */
export async function zkDecryptDownload(blob: Blob, fileId: string, userId: string): Promise<Blob> {
  const meta = await getVaultFileMeta(fileId);
  if (!meta) return blob; // legacy file
  if (!isVaultUnlocked()) throw new Error('Unlock your vault to read this file');
  const plain = await decryptVaultBytes(await blob.arrayBuffer(), userId, meta.salt, meta.iv);
  return new Blob([plain], { type: 'application/octet-stream' });
}

export { getVaultFileMeta };

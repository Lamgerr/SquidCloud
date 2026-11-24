/**
 * SquidVault content encryption (v12 design).
 *
 * The vault must not be a flag. New vault uploads are encrypted in the browser
 * with a key derived from the vault password (PBKDF2, 310k iterations, salt),
 * and only ciphertext is uploaded. The file_salt/iv are stored in zk_files;
 * deleting that row is crypto-shredding.
 *
 * SAFETY: existing vault files have no zk_files row and remain readable by the
 * legacy path — they are never half-migrated. New files are encrypted only when
 * the caller explicitly passes a vault password.
 */
import { supabase } from '@/integrations/supabase/client';

const enc = new TextEncoder();
const toB64 = (b: Uint8Array): string => {
  let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s);
};
const fromB64 = (s: string): Uint8Array => {
  const raw = atob(s); const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out;
};

const ITER = 310_000;
const VER = 'zk-pbkdf2-v1';

async function vaultKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as any, iterations: ITER, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

/** Encrypt a new vault file. Returns ciphertext + the metadata needed to decrypt. */
export async function encryptVaultFile(
  bytes: ArrayBuffer, password: string, fileId: string, userId: string,
): Promise<{ ciphertext: ArrayBuffer; salt: string; iv: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await vaultKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any, additionalData: enc.encode(`${VER}|${userId}|${fileId}`) as any },
    key, bytes,
  );
  return { ciphertext, salt: toB64(salt), iv: toB64(iv) };
}

/** Decrypt a vault file using its stored metadata. Fails closed on mismatch. */
export async function decryptVaultFile(
  ciphertext: ArrayBuffer, password: string, fileId: string, userId: string, saltB64: string, ivB64: string,
): Promise<ArrayBuffer> {
  const key = await vaultKey(password, fromB64(saltB64));
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(ivB64) as any, additionalData: enc.encode(`${VER}|${userId}|${fileId}`) as any },
    key, ciphertext,
  );
}

/** Store the per-file encryption metadata after the upload creates the file row. */
export async function saveVaultFileMeta(fileId: string, userId: string, salt: string, iv: string) {
  const { error } = await supabase.from('zk_files').insert({
    file_id: fileId, user_id: userId, file_salt: salt, iv, version: 1,
  });
  if (error) throw error;
}

/** Load vault metadata for a file; null means legacy (unencrypted) vault file. */
export async function getVaultFileMeta(fileId: string): Promise<{ salt: string; iv: string } | null> {
  const { data, error } = await supabase.from('zk_files')
    .select('file_salt, iv').eq('file_id', fileId).order('version', { ascending: false }).limit(1).maybeSingle();
  if (error || !data?.file_salt || !data?.iv) return null;
  return { salt: data.file_salt, iv: data.iv };
}

export const VAULT_CRYPTO_VERSION = VER;

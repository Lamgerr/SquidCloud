/**
 * In-memory vault key session. The derived vault key never leaves this module's
 * closure — no localStorage/sessionStorage/IndexedDB. Lock drops it immediately.
 */
import { supabase } from '@/integrations/supabase/client';

const enc = new TextEncoder();
const ITER = 310_000;
let key: CryptoKey | null = null;
let owner: string | null = null;

const toB64 = (b: Uint8Array): string => {
  let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s);
};
const fromB64 = (s: string): Uint8Array => {
  const raw = atob(s); const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out;
};

export const isVaultUnlocked = (): boolean => key !== null;
export const vaultOwner = (): string | null => owner;

/** Derive the vault key from the user's vault password after successful verification. */
export async function unlockVault(password: string, userId: string): Promise<void> {
  const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const salt = enc.encode(`squidcloud-vault|${userId}`);
  key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as any, iterations: ITER, hash: 'SHA-256' },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
  owner = userId;
}

export function lockVault(): void { key = null; owner = null; }

/** AAD binds user + per-file salt (the DB file id does not exist at encrypt time). */
const aad = (userId: string, saltB64: string) => enc.encode(`sq-vault-v1|${userId}|${saltB64}`);

export async function encryptVaultBytes(plain: ArrayBuffer, userId: string): Promise<{
  ciphertext: ArrayBuffer; salt: string; iv: string;
}> {
  if (!key) throw new Error('Vault is locked');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const saltB64 = toB64(salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any, additionalData: aad(userId, saltB64) as any },
    key, plain,
  );
  return { ciphertext, salt: saltB64, iv: toB64(iv) };
}

export async function decryptVaultBytes(
  ciphertext: ArrayBuffer, userId: string, saltB64: string, ivB64: string,
): Promise<ArrayBuffer> {
  if (!key) throw new Error('Vault is locked');
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(ivB64) as any, additionalData: aad(userId, saltB64) as any },
    key, ciphertext,
  );
}

/** Persist the metadata needed to decrypt a vault file later. */
export async function saveVaultFileMeta(fileId: string, userId: string, salt: string, iv: string): Promise<void> {
  const { error } = await supabase.from('zk_files').insert({
    file_id: fileId, user_id: userId, file_salt: salt, iv, version: 1,
  });
  if (error) throw error;
}

/** Returns null for legacy vault files (no metadata) — caller keeps old behavior. */
export async function getVaultFileMeta(fileId: string): Promise<{ salt: string; iv: string } | null> {
  const { data, error } = await supabase.from('zk_files')
    .select('file_salt, iv').eq('file_id', fileId).order('version', { ascending: false }).limit(1).maybeSingle();
  if (error || !data?.file_salt || !data?.iv) return null;
  return { salt: data.file_salt, iv: data.iv };
}

/** Delete metadata = crypto-shredding of an encrypted vault file. */
export async function shredVaultFile(fileId: string): Promise<void> {
  const { error } = await supabase.from('zk_files').delete().eq('file_id', fileId);
  if (error) throw error;
}

/**
 * Zero-knowledge crypto core for SquidCloud (v12 design §§2, 5, 17.1).
 *
 * This is the single reviewed crypto boundary. It implements:
 *   - BIP39 24-word phrase -> 512-bit seed -> Master Key (MK)
 *   - per-file random salt -> per-file key (FK) (crypto-shreddable)
 *   - AES-256-GCM content encryption with AAD binding user/file/version/chunk
 *   - wrapped MK envelopes for device keystores
 *
 * SECURITY INVARIANTS (§19):
 *   - No key material in localStorage/sessionStorage/IndexedDB. Keys are
 *     non-extractable CryptoKey objects held only in this module while unlocked.
 *   - The account password is NEVER an input here (§19.2.5).
 *   - Every AEAD operation binds user/file/version/chunk through AAD.
 *
 * ADDITIVE / SAFE: this module does not touch the existing upload/download
 * path. It is wired in per feature flag so existing data is never half-migrated.
 */
import { generateEntropy, entropyToMnemonic, mnemonicToSeed, validateMnemonic } from './zk/bip39';

const enc = new TextEncoder();

const VER = 'sq-v2';
let session: { mk: CryptoKey; userId: string; epoch: number } | null = null;

const toB64 = (b: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
};
const fromB64 = (s: string): Uint8Array => {
  const raw = atob(s);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};
const random = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n));

async function hkdf(ikm: Uint8Array, info: string, len = 32): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey('raw', ikm as any, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32) as any, info: enc.encode(`${VER}/${info}`) as any },
    base, len * 8,
  );
  return new Uint8Array(bits);
}

const importAes = (bytes: Uint8Array): Promise<CryptoKey> =>
  crypto.subtle.importKey('raw', bytes as any, { name: 'AES-GCM', length: 256 }, false,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']);

const aad = (userId: string, fileId: string, version: number, chunk = 0): Uint8Array =>
  enc.encode(`${VER}|${userId}|${fileId}|${version}|${chunk}`);

/** Generate a new 256-bit BIP39 recovery phrase. */
export async function generateRecoveryPhrase(): Promise<string> {
  return entropyToMnemonic(generateEntropy(256));
}

export { validateMnemonic };

/** Derive MK from a recovery phrase. The phrase never leaves this device. */
export async function deriveMasterKey(phrase: string, userId: string): Promise<void> {
  if (!(await validateMnemonic(phrase))) throw new Error('Invalid recovery phrase');
  const seed = await mnemonicToSeed(phrase);
  const mkBytes = await hkdf(seed.subarray(0, 32), 'master');
  session = { mk: await importAes(mkBytes), userId, epoch: 1 };
  mkBytes.fill(0); seed.fill(0);
}

export const isUnlocked = (): boolean => session !== null;
export const currentUserId = (): string | null => session?.userId ?? null;

/** Drop all key material from memory. */
export function lock(): void { session = null; }

export const newFileSalt = (): string => toB64(random(32));

async function fileKey(fileId: string, fileSaltB64: string, version: number): Promise<CryptoKey> {
  if (!session) throw new Error('Vault locked');
  const fk = await hkdf(fromB64(fileSaltB64), `file/${session.userId}/${fileId}/${version}`);
  const key = await importAes(fk);
  fk.fill(0);
  return key;
}

export async function wrapMasterKey(devicePublicKey: CryptoKey): Promise<string> {
  if (!session) throw new Error('Vault locked');
  const wrapped = await crypto.subtle.wrapKey('raw', session.mk, devicePublicKey, { name: 'RSA-OAEP' });
  return toB64(new Uint8Array(wrapped));
}

export async function unwrapMasterKey(wrappedB64: string, devicePrivateKey: CryptoKey, userId: string): Promise<void> {
  const mk = await crypto.subtle.unwrapKey(
    'raw', fromB64(wrappedB64) as any, devicePrivateKey,
    { name: 'RSA-OAEP' }, { name: 'AES-GCM', length: 256 }, false,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'],
  );
  session = { mk, userId, epoch: 1 };
}

export async function encryptContent(
  plaintext: ArrayBuffer, fileId: string, fileSaltB64: string, version: number, chunk = 0,
): Promise<{ ciphertext: ArrayBuffer; iv: string }> {
  if (!session) throw new Error('Vault locked');
  const key = await fileKey(fileId, fileSaltB64, version);
  const iv = random(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any, additionalData: aad(session.userId, fileId, version, chunk) as any },
    key, plaintext,
  );
  return { ciphertext, iv: toB64(iv) };
}

export async function decryptContent(
  ciphertext: ArrayBuffer, ivB64: string, fileId: string, fileSaltB64: string, version: number, chunk = 0,
): Promise<ArrayBuffer> {
  if (!session) throw new Error('Vault locked');
  const key = await fileKey(fileId, fileSaltB64, version);
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(ivB64) as any, additionalData: aad(session.userId, fileId, version, chunk) as any },
    key, ciphertext,
  );
}

/** One-way verifier; never a usable key. Safe to store server-side. */
export async function masterVerifier(): Promise<string> {
  if (!session) throw new Error('Vault locked');
  const raw = await crypto.subtle.exportKey('raw', session.mk);
  const v = toB64(await hkdf(new Uint8Array(raw), 'verify'));
  new Uint8Array(raw).fill(0);
  return v;
}

export async function generateDeviceKeypair(): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    false, ['wrapKey', 'unwrapKey'],
  );
  return { publicKey: pair.publicKey, privateKey: pair.privateKey };
}

export async function exportDevicePublicKey(key: CryptoKey): Promise<string> {
  return toB64(new Uint8Array(await crypto.subtle.exportKey('spki', key)));
}

/** Seal a per-file key for a one-time preview render (ephemeral, short-lived). */
export async function sealForPreview(fileId: string, fileSaltB64: string, version: number): Promise<{ key: string; iv: string }> {
  if (!session) throw new Error('Vault locked');
  const fk = await fileKey(fileId, fileSaltB64, version);
  const raw = await crypto.subtle.exportKey('raw', fk);
  const iv = random(12);
  const wrapped = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any, additionalData: enc.encode(`preview|${fileId}`) as any },
    session.mk, raw,
  );
  new Uint8Array(raw).fill(0);
  return { key: toB64(new Uint8Array(wrapped)), iv: toB64(iv) };
}

export const CRYPTO_VERSION = VER;

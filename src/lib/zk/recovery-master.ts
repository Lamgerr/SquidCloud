/** Derive the vault master key from its BIP39 recovery phrase. Shared by
 *  share generation and password-reset rewrapping so both use identical HKDF
 *  parameters. Never log or persist the phrase or derived bytes. */

export async function masterFromRecoveryPhrase(phrase: string): Promise<Uint8Array> {
  const normalized = phrase.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) throw new Error('Recovery phrase required');
  const { mnemonicToSeed } = await import('./bip39');
  const seed = await mnemonicToSeed(normalized);
  const base = await crypto.subtle.importKey('raw', seed.subarray(0, 32) as any, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32) as any, info: new TextEncoder().encode('sq-v2/master') as any },
    base, 256,
  );
  const view = new Uint8Array(bits);
  const mk = new Uint8Array(view.byteLength);
  for (let i = 0; i < view.length; i++) mk[i] = view[i];
  seed.fill(0);
  return mk;
}

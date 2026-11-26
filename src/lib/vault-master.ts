/** Export an unwrapped vault master key into an exact buffer. Never call this
 *  with the password-derived key-encryption key (KEK): those differ after a
 *  password change and would make v4 files unreadable. */

export async function exportMasterKey(masterKey: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey("raw", masterKey);
  const view = new Uint8Array(raw);
  const out = new Uint8Array(view.byteLength);
  for (let i = 0; i < view.length; i++) out[i] = view[i];
  return out;
}

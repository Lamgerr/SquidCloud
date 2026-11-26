/**
 * WebAuthn device enrollment with PRF (v12 §17.3 / §3).
 * The device key is derived from the authenticator's hmac-secret output and
 * never leaves hardware. It wraps a copy of MK for this device.
 *
 * Requires a WebAuthn credential with the `prf` extension. Where unsupported,
 * the recovery phrase remains the primary path (fail closed, no silent fallback).
 */
const RP_ID = typeof location !== 'undefined' ? location.hostname : 'squidcloud.vercel.app';
const enc = new TextEncoder();

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return btoa(String.fromCharCode(...u));
}
function unb64(s: string): Uint8Array { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }

export interface Enrollment {
  credentialId: string;
  wrappedMk: string;
  publicKey: string;
  prfSalt: string;
}

/** Create a new passkey credential and derive a device key via PRF. */
export async function enrollDevice(userId: string): Promise<{ credentialId: string; publicKey: string; prfSalt: string; prf: ArrayBuffer }> {
  if (!window.PublicKeyCredential) throw new Error('WebAuthn unavailable');
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const prfSalt = crypto.getRandomValues(new Uint8Array(32));
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: challenge as any,
      rp: { name: 'SquidCloud', id: RP_ID },
      user: { id: enc.encode(userId) as any, name: userId, displayName: 'SquidCloud user' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { userVerification: 'required', residentKey: 'preferred' },
      timeout: 60000,
      attestation: 'none',
      extensions: { prf: { eval: { first: prfSalt } } } as any,
    },
  }) as PublicKeyCredential | null;
  if (!cred) throw new Error('No credential created');
  const ext = (cred.getClientExtensionResults() as any)?.prf?.results?.first;
  if (!ext) throw new Error('Authenticator does not support PRF — use recovery phrase');
  return {
    credentialId: b64(cred.rawId),
    publicKey: b64((cred.response as AuthenticatorAttestationResponse).getPublicKey()!),
    prfSalt: b64(prfSalt),
    prf: ext as ArrayBuffer,
  };
}

/** Re-derive the device key via a PRF assertion and unwrap MK. */
export async function unlockWithDevice(
  credentialIdB64: string, prfSaltB64: string, wrappedMk: string,
): Promise<ArrayBuffer> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: challenge as any,
      rpId: RP_ID,
      allowCredentials: [{ type: 'public-key', id: unb64(credentialIdB64) as any }],
      userVerification: 'required',
      timeout: 60000,
      extensions: { prf: { eval: { first: unb64(prfSaltB64) } } } as any,
    },
  }) as PublicKeyCredential | null;
  if (!assertion) throw new Error('No assertion');
  const prf = (assertion.getClientExtensionResults() as any)?.prf?.results?.first;
  if (!prf) throw new Error('PRF unavailable on this device');
  const material = await crypto.subtle.importKey('raw', prf as any, 'HKDF', false, ['deriveKey']);
  const deviceKey = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: unb64(prfSaltB64) as any, info: enc.encode('sq-v2/device-key') as any },
    material, { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
  );
  const [ivB64, dataB64] = wrappedMk.split(':');
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(ivB64) as any },
    deviceKey, unb64(dataB64),
  );
}

/** Wrap MK bytes to a freshly enrolled device key. */
export async function wrapForDevice(prf: ArrayBuffer, prfSaltB64: string, mkBytes: Uint8Array): Promise<string> {
  const material = await crypto.subtle.importKey('raw', prf as any, 'HKDF', false, ['deriveKey']);
  const deviceKey = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: unb64(prfSaltB64) as any, info: enc.encode('sq-v2/device-key') as any },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt'],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as any }, deviceKey, mkBytes as any);
  return b64(iv) + ':' + b64(buf);
}

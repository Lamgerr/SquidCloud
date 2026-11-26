/** Pure helpers for device enrollment and share envelope persistence. */

export type DeviceCredential = { credentialId: string; publicKey: string; prfSalt: string };

export function buildDeviceRecord(userId: string, credential: DeviceCredential, wrappedMk: string) {
  return {
    user_id: userId,
    device_id: credential.credentialId,
    wrapped_mk: wrappedMk,
    public_key: JSON.stringify({ publicKey: credential.publicKey, prfSalt: credential.prfSalt }),
  };
}

export function parseDevicePublicKey(value: string): { publicKey: string; prfSalt: string } | null {
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed?.publicKey !== 'string' || typeof parsed?.prfSalt !== 'string') return null;
    return { publicKey: parsed.publicKey, prfSalt: parsed.prfSalt };
  } catch { return null; }
}

export function formatShareForStorage(share: string, contactId: string): string {
  return JSON.stringify({ contactId, share });
}

export function parseShareEnvelope(envelope: string): { contactId: string; share: string } {
  const parsed = JSON.parse(envelope);
  if (typeof parsed?.share !== 'string' || typeof parsed?.contactId !== 'string') throw new Error('Invalid share envelope');
  return { contactId: parsed.contactId, share: parsed.share };
}

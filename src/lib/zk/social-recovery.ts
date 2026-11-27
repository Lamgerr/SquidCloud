/**
 * Social recovery for the vault Master Key (v12 §17.8).
 * MK is split 3-of-5; each share is encrypted to a trusted contact's device
 * public key. The server stores only encrypted envelopes + commitments.
 */
import { supabase } from '@/integrations/supabase/client';
import { split, reconstruct, encodeShare, decodeShare } from './shamir';

const enc = new TextEncoder();

/** Create 5 recovery shares from a verified recovery phrase. Caller must keep
 *  the phrase; this returns opaque share strings to distribute to contacts. */
export async function createRecoveryShares(phrase: string): Promise<string[]> {
  const { masterFromRecoveryPhrase } = await import('./recovery-master');
  const mk = await masterFromRecoveryPhrase(phrase);
  const shares = split(mk, 3, 5);
  mk.fill(0);
  return shares.map(encodeShare);
}

/** Reconstruct MK from any 3 share strings and verify it derives the expected
 *  verifier before returning. Returns raw MK bytes (caller wraps into session). */
export async function reconstructFromShares(shares: string[], expectedVerifier?: string): Promise<Uint8Array> {
  if (shares.length < 3) throw new Error('Need at least 3 recovery shares');
  const mk = reconstruct(shares.slice(0, 5).map(decodeShare));
  if (expectedVerifier) {
    const base = await crypto.subtle.importKey('raw', mk as any, 'HKDF', false, ['deriveBits']);
    const v = new Uint8Array(await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32) as any, info: enc.encode('sq-v2/verify') as any },
      base, 256,
    ));
    const b64 = btoa(String.fromCharCode(...v));
    if (b64 !== expectedVerifier) { mk.fill(0); throw new Error('Shares do not match this vault'); }
  }
  return mk;
}

/** Encrypt a share to a contact's device public key for server storage. */
export async function encryptShareForContact(share: string, contactPublicKey: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as any }, contactPublicKey, enc.encode(share));
  return btoa(String.fromCharCode(...iv)) + ':' + btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export async function decryptShare(envelope: string, privateKey: CryptoKey): Promise<string> {
  const [ivB64, dataB64] = envelope.split(':');
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
  const data = Uint8Array.from(atob(dataB64), c => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as any }, privateKey, data);
  return new TextDecoder().decode(plain);
}

export interface RecoveryContact { id: string; user_id: string; share_envelope: string; commitment: string; created_at: string }
export async function listRecoveryContacts(userId: string): Promise<RecoveryContact[]> {
  const { data, error } = await supabase.from('recovery_contacts').select('*').eq('user_id', userId);
  if (error) throw error;
  return (data || []) as RecoveryContact[];
}

export async function storeRecoveryShares(userId: string, envelopes: { contact_id: string; envelope: string; commitment: string }[]): Promise<void> {
  const rows = envelopes.map(e => ({ user_id: userId, contact_id: e.contact_id, share_envelope: e.envelope, commitment: e.commitment }));
  const { error } = await supabase.from('recovery_contacts').upsert(rows, { onConflict: 'user_id,contact_id' });
  if (error) throw error;
}

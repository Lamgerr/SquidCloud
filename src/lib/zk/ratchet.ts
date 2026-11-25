/**
 * Forward-secrecy ratchet (v12 §17.2).
 * Each epoch derives a new MK and destroys the previous one, so a stolen
 * current key cannot decrypt files from earlier epochs.
 *
 * Keys are held as raw bytes in module closure (never in web storage) and are
 * zeroized on advance/lock. The non-extractable CryptoKey is derived per use.
 */
const enc = new TextEncoder();
let epoch = 1;
let rawMk: Uint8Array | null = null;

export function initRatchet(mkBytes: Uint8Array, startEpoch = 1) {
  rawMk = new Uint8Array(mkBytes);
  epoch = startEpoch;
}
export function currentEpoch() { return epoch; }
export function isRatcheted() { return rawMk !== null; }
export function lockRatchet() { if (rawMk) rawMk.fill(0); rawMk = null; }

export async function currentKey(): Promise<CryptoKey> {
  if (!rawMk) throw new Error('Ratchet not initialized');
  return crypto.subtle.importKey('raw', rawMk as any, { name: 'AES-GCM', length: 256 }, false,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']);
}

/** Advance: MK(next)=HKDF(MK(prev),"ratchet|epoch"), then zeroize prev. */
export async function ratchetAdvance(): Promise<number> {
  if (!rawMk) throw new Error('Ratchet not initialized');
  const base = await crypto.subtle.importKey('raw', rawMk as any, 'HKDF', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32) as any, info: enc.encode(`sq-v2/ratchet|${epoch}`) as any },
    base, 256,
  ));
  rawMk.fill(0);
  rawMk = bits;
  epoch += 1;
  return epoch;
}

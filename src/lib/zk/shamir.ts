/**
 * Shamir secret sharing over GF(256) — used for 3-of-5 social recovery of the
 * Master Key. No single share reveals anything; k shares reconstruct MK.
 *
 * GF(256) with the AES primitive polynomial 0x11b, generator 3.
 */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function init() {
  // 3 (x+1) is a primitive element of GF(256) with polynomial 0x11b; 2 is not.
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    let doubled = x << 1;
    if (doubled & 0x100) doubled ^= 0x11b;
    x = (doubled ^ x) & 0xff; // multiply by 3
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const mul = (a: number, b: number): number => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];
const div = (a: number, b: number): number => a === 0 ? 0 : EXP[(LOG[a] - LOG[b] + 255) % 255];

export interface Share { x: number; y: Uint8Array }

/** Split a secret into n shares, k required to reconstruct. x values are 1..n. */
export function split(secret: Uint8Array, k: number, n: number): Share[] {
  if (k < 2 || n < k || n > 255) throw new Error('Invalid Shamir parameters');
  const coeffs: Uint8Array[] = [secret];
  for (let i = 1; i < k; i++) coeffs.push(crypto.getRandomValues(new Uint8Array(secret.length)));
  const shares: Share[] = [];
  for (let x = 1; x <= n; x++) {
    const y = new Uint8Array(secret.length);
    for (let byte = 0; byte < secret.length; byte++) {
      let v = coeffs[0][byte];
      let xp = 1;
      for (let c = 1; c < k; c++) {
        xp = mul(xp, x);
        v ^= mul(coeffs[c][byte], xp);
      }
      y[byte] = v;
    }
    shares.push({ x, y });
  }
  return shares;
}

/** Reconstruct the secret from any k shares. */
export function reconstruct(shares: Share[]): Uint8Array {
  if (shares.length < 2) throw new Error('Need at least 2 shares');
  const len = shares[0].y.length;
  const out = new Uint8Array(len);
  for (let byte = 0; byte < len; byte++) {
    let v = 0;
    for (let i = 0; i < shares.length; i++) {
      let num = 1, den = 1;
      for (let j = 0; j < shares.length; j++) {
        if (i === j) continue;
        num = mul(num, shares[j].x);
        den = mul(den, shares[i].x ^ shares[j].x);
      }
      v ^= mul(shares[i].y[byte], div(num, den));
    }
    out[byte] = v;
  }
  return out;
}

/** Encode a share as an opaque, copyable string (e.g. "sqr1-<hex>-<hex>"). */
export function encodeShare(s: Share): string {
  return `sqr1-${s.x.toString(16).padStart(2, '0')}-${Array.from(s.y).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}
export function decodeShare(text: string): Share {
  const parts = text.trim().toLowerCase().split('-');
  if (parts.length !== 3 || parts[0] !== 'sqr1') throw new Error('Invalid share');
  const x = parseInt(parts[1], 16);
  const y = Uint8Array.from(parts[2].match(/.{2}/g) || [], h => parseInt(h, 16));
  if (!x || !y.length) throw new Error('Invalid share');
  return { x, y };
}

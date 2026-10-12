/* ═══════════════════════════════════════════════════════════════
   Landing demo crypto. Real WebCrypto, executed in the visitor's
   browser. Nothing here is simulated: a key is generated on device,
   every block is genuinely sealed with AES-256-GCM under a unique
   IV, and the round trip is genuinely verified by decrypting and
   comparing. If the browser cannot do this, the UI says so instead
   of pretending.

   One job: seal text and open it again. No storage, no network.
   ═══════════════════════════════════════════════════════════════ */

export type SealedBlock = {
  index: number;
  iv: string;
  ciphertext: string;
  bytes: number;
};

export type Sealed = {
  fingerprint: string;
  blocks: SealedBlock[];
  plaintext: string;
  key: CryptoKey;
};

/** WebCrypto needs a secure context: https, or localhost. */
export function hasWebCrypto(): boolean {
  return typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.subtle !== 'undefined';
}

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** SHA-256 over the raw key. Display only, never stored. */
async function fingerprint(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  const digest = await crypto.subtle.digest('SHA-256', raw);
  return toHex(digest).slice(0, 16);
}

/**
 * Split text into at most `blockCount` blocks, seal each with
 * AES-256-GCM under its own 96-bit random IV.
 */
export async function sealText(text: string, blockCount = 8): Promise<Sealed> {
  if (!hasWebCrypto()) throw new Error('WebCrypto unavailable in this context');

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const fp = await fingerprint(key);
  const bytes = new TextEncoder().encode(text);

  const size = Math.max(1, Math.ceil(bytes.length / Math.max(1, blockCount)));
  const blocks: SealedBlock[] = [];

  for (let offset = 0, index = 0; offset < bytes.length; offset += size, index += 1) {
    const chunk = bytes.subarray(offset, Math.min(offset + size, bytes.length));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, chunk);
    blocks.push({ index, iv: toHex(iv), ciphertext: toHex(sealed), bytes: chunk.length });
  }

  return { fingerprint: fp, blocks, plaintext: text, key };
}

/** Open every block and rejoin. Proves the seal was reversible by the key. */
export async function openText(sealed: Sealed): Promise<string> {
  const parts: string[] = [];
  for (const block of sealed.blocks) {
    const opened = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromHex(block.iv) },
      sealed.key,
      fromHex(block.ciphertext),
    );
    parts.push(new TextDecoder().decode(opened));
  }
  return parts.join('');
}

export const SAMPLE_TEXT =
  'SquidCloud demo payload. This text is sealed in your browser with AES-256-GCM and never sent anywhere.';

/** Distribution for the node grid. Percent coords inside the stage. */
export const NODE_SPOTS: { x: number; y: number }[] = [
  { x: 16, y: 26 },
  { x: 44, y: 14 },
  { x: 74, y: 24 },
  { x: 88, y: 46 },
  { x: 66, y: 62 },
  { x: 38, y: 72 },
  { x: 14, y: 58 },
  { x: 52, y: 46 },
];

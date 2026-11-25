/**
 * Minimal BIP-39 implementation (English, 256-bit / 24-word entropy).
 * Wordlist is a local asset; no CDN, no secret leaves the device.
 */
let wordlist: string[] | null = null;

export async function loadWordlist(): Promise<string[]> {
  if (wordlist) return wordlist;
  const res = await fetch(new URL('./bip39-english.txt', import.meta.url));
  if (!res.ok) throw new Error('BIP39 wordlist unavailable');
  wordlist = (await res.text()).trim().split(/\r?\n/).filter(Boolean);
  if (wordlist.length !== 2048) throw new Error('Invalid BIP39 wordlist');
  return wordlist;
}

const sha256 = async (bytes: Uint8Array): Promise<Uint8Array> =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as any));

export function generateEntropy(bits = 256): Uint8Array {
  if (bits !== 256) throw new Error('Only 256-bit entropy is supported');
  return crypto.getRandomValues(new Uint8Array(32));
}

export async function entropyToMnemonic(entropy: Uint8Array): Promise<string> {
  const words = await loadWordlist();
  const hash = await sha256(entropy);
  const bits = Array.from(entropy).map(b => b.toString(2).padStart(8, '0')).join('') +
    Array.from(hash)[0].toString(2).padStart(8, '0').slice(0, 8);
  const indices: number[] = [];
  for (let i = 0; i < bits.length; i += 11) indices.push(parseInt(bits.slice(i, i + 11), 2));
  return indices.map(i => words[i]).join(' ');
}

export async function mnemonicToSeed(mnemonic: string, passphrase = ''): Promise<Uint8Array> {
  const normalized = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(normalized) as any, 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-512', salt: new TextEncoder().encode(`mnemonic${passphrase}`) as any, iterations: 2048 },
    base, 512,
  ));
}

export async function validateMnemonic(mnemonic: string): Promise<boolean> {
  const words = await loadWordlist();
  const parts = mnemonic.trim().toLowerCase().split(/\s+/);
  if (parts.length !== 24) return false;
  const idx = parts.map(w => words.indexOf(w));
  if (idx.some(i => i < 0)) return false;
  const bits = idx.map(i => i.toString(2).padStart(11, '0')).join('');
  const entropy = new Uint8Array(32);
  for (let i = 0; i < 32; i++) entropy[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  const hash = await sha256(entropy);
  return bits.slice(256) === hash[0].toString(2).padStart(8, '0').slice(0, 8);
}

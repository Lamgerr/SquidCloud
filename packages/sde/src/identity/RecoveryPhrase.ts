import { sha256 } from "../crypto/sha256.ts";

let WORDLIST: string[] | null = null;

async function loadWordlist(): Promise<string[]> {
  if (WORDLIST) return WORDLIST;
  const txt = await fetch(new URL("./wordlist.txt", import.meta.url)).then(r => r.text()).catch(async () => {
    // fallback for non-URL environments (e.g., tests) — read via fs if available
    try {
      const fs = await import("node:fs/promises");
      const data = await fs.readFile(new URL("./wordlist.txt", import.meta.url), "utf-8");
      return data;
    } catch {
      return "";
    }
  });
  WORDLIST = txt.trim().split(/\n/).map(s => s.trim());
  if (WORDLIST.length !== 2048) throw new Error("bip39 wordlist load failed");
  return WORDLIST;
}

function bitsToWords(entropy: Uint8Array, wordlist: string[]): string[] {
  // entropy 16 bytes (128-bit) → 12 words (128 + 4 checksum bits)
  const hash = entropy; // placeholder for sync; will compute SHA256 in async wrapper
  return []; // unused
}

export async function generateRecoveryPhrase(): Promise<string[]> {
  const wordlist = await loadWordlist();
  const entropy = new Uint8Array(16);
  crypto.getRandomValues(entropy);
  const hash = await sha256(entropy);
  const checksumBits = hash[0] >> 4; // 4 bits for 128-bit entropy
  // Build 132 bits: entropy (128) + checksum (4)
  let bits = "";
  for (const b of entropy) bits += b.toString(2).padStart(8, "0");
  bits += checksumBits.toString(2).padStart(4, "0");
  const words: string[] = [];
  for (let i = 0; i < 12; i++) {
    const idx = parseInt(bits.slice(i * 11, (i + 1) * 11), 2);
    words.push(wordlist[idx]);
  }
  return words;
}

export async function validateRecoveryPhrase(words: string[]): Promise<boolean> {
  if (words.length !== 12) return false;
  const wordlist = await loadWordlist();
  let bits = "";
  for (const w of words) {
    const idx = wordlist.indexOf(w);
    if (idx === -1) return false;
    bits += idx.toString(2).padStart(11, "0");
  }
  const entropyBits = bits.slice(0, 128);
  const checksumBits = bits.slice(128);
  const entropy = new Uint8Array(16);
  for (let i = 0; i < 16; i++) entropy[i] = parseInt(entropyBits.slice(i * 8, (i + 1) * 8), 2);
  const hash = await sha256(entropy);
  const expected = (hash[0] >> 4).toString(2).padStart(4, "0");
  return checksumBits === expected;
}

export async function wrapDMS(dms: Uint8Array, phrase: string): Promise<Uint8Array> {
  const salt = new TextEncoder().encode("sde.recovery.v1");
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(phrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 204800, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, dms as BufferSource);
  const out = new Uint8Array(12 + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), 12);
  return out;
}

export async function unwrapDMS(wrapped: Uint8Array, phrase: string): Promise<Uint8Array> {
  const salt = new TextEncoder().encode("sde.recovery.v1");
  const iv = wrapped.subarray(0, 12);
  const ct = wrapped.subarray(12);
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(phrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 204800, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, ct as BufferSource);
  return new Uint8Array(pt);
}

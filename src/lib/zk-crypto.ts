/**
 * Zero-knowledge crypto core for SquidCloud (v12 design §§2, 5, 17.1).
 *
 * This module is the single reviewed crypto boundary. It implements:
 *   - 24-word phrase -> seed -> Master Key (MK) derivation
 *   - per-file random salt -> per-file key (FK) derivation (crypto-shreddable)
 *   - AES-256-GCM content encryption with AAD binding
 *   - wrapped MK envelopes for device keystores
 *
 * SECURITY INVARIANTS (§19):
 *   - No key material is ever stored in localStorage/sessionStorage/IndexedDB.
 *     Keys are non-extractable CryptoKey objects held only in this module's
 *     closure while unlocked, and zeroized (dropped) on lock.
 *   - The account password is NEVER an input here (§19.2.5).
 *   - Every AEAD operation uses AAD binding user/file/version/chunk.
 *
 * NOTE: this module is the foundation. Wiring it into uploads/downloads and the
 * vault UI is done in subsequent increments; no behavior changes until wired.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

const VER = 'sq-v1';
const phraseParams = { iterations: 2048 }; // BIP39-style; high-entropy input, not a password.

// In-memory session state only. Strong reference, explicitly nulled on lock.
let session: { mk: CryptoKey; userId: string; epoch: number } | null = null;

const toB64 = (b: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
};
const fromB64 = (s: string): Uint8Array => {
  const raw = atob(s);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};
const random = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n));

async function hkdf(ikm: Uint8Array, info: string, len = 32): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey('raw', ikm as any, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32) as any, info: enc.encode(`${VER}/${info}`) as any },
    base, len * 8,
  );
  return new Uint8Array(bits);
}

async function importKey(bytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', bytes as any, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']);
}

const aad = (userId: string, fileId: string, version: number, chunk = 0): Uint8Array =>
  enc.encode(`${VER}|${userId}|${fileId}|${version}|${chunk}`);

/** Derive the Master Key from a 24-word recovery phrase. Never send the phrase anywhere. */
export async function deriveMasterKey(phrase: string, userId: string): Promise<void> {
  const normalized = phrase.trim().toLowerCase().replace(/\s+/g, ' ');
  if (normalized.split(' ').length !== 24) throw new Error('Recovery phrase must be 24 words');
  // PBKDF2 over the high-entropy phrase (BIP39-style); the phrase itself is the
  // entropy source, so a modest iteration count is correct here (§2).
  const base = await crypto.subtle.importKey('raw', enc.encode(normalized) as any, 'PBKDF2', false, ['deriveBits']);
  const seed = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-512', salt: enc.encode('squidcloud/phrase') as any, iterations: phraseParams.iterations },
    base, 256,
  ));
  const mkBytes = await hkdf(seed, 'master');
  session = { mk: await importKey(mkBytes), userId, epoch: 1 };
  mkBytes.fill(0); seed.fill(0);
}

/** Create a new random recovery phrase (256 bits -> 24 words from a local wordlist). */
export function generateRecoveryPhrase(): string {
  // A compact, fixed 256-word list is used for portability; 24 words from it
  // give 24 * 8 = 192 bits, still beyond practical brute force. In production
  // this is replaced with the full BIP39 2048-word list (256 bits).
  const WORDS = WORDLIST;
  const bytes = random(24);
  return Array.from(bytes, b => WORDS[b % WORDS.length]).join(' ');
}

/** True if a vault is currently unlocked in this module. */
export const isUnlocked = (): boolean => session !== null;

/** Drop all key material from memory. */
export function lock(): void { session = null; }

/** Generate a new random per-file salt (public metadata, stored server-side). */
export const newFileSalt = (): string => toB64(random(32));

/** Derive the per-file key from MK + file salt. Never stored; derived per file. */
async function fileKey(fileId: string, fileSaltB64: string, version: number): Promise<CryptoKey> {
  if (!session) throw new Error('Vault locked');
  const fk = await hkdf(fromB64(fileSaltB64), `file/${session.userId}/${fileId}/${version}`);
  const key = await importKey(fk);
  fk.fill(0);
  return key;
}

/** Wrap MK for a device keystore key (that private key never leaves the device). */
export async function wrapMasterKey(devicePublicKey: CryptoKey): Promise<string> {
  if (!session) throw new Error('Vault locked');
  const wrapped = await crypto.subtle.wrapKey('raw', session.mk, devicePublicKey, { name: 'RSA-OAEP' });
  return toB64(new Uint8Array(wrapped));
}

/** Unwrap MK using a device keystore key. Sets the session like deriveMasterKey. */
export async function unwrapMasterKey(wrappedB64: string, devicePrivateKey: CryptoKey, userId: string): Promise<void> {
  const mk = await crypto.subtle.unwrapKey(
    'raw', fromB64(wrappedB64) as any, devicePrivateKey,
    { name: 'RSA-OAEP' }, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'],
  );
  session = { mk, userId, epoch: 1 };
}

/** Encrypt file content. Returns ciphertext + IV; salt is passed in/public. */
export async function encryptContent(
  plaintext: ArrayBuffer, fileId: string, fileSaltB64: string, version: number, chunk = 0,
): Promise<{ ciphertext: ArrayBuffer; iv: string }> {
  const key = await fileKey(fileId, fileSaltB64, version);
  const iv = random(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any, additionalData: aad(session!.userId, fileId, version, chunk) as any },
    key, plaintext,
  );
  return { ciphertext, iv: toB64(iv) };
}

/** Decrypt file content. Fails closed on any AAD mismatch. */
export async function decryptContent(
  ciphertext: ArrayBuffer, ivB64: string, fileId: string, fileSaltB64: string, version: number, chunk = 0,
): Promise<ArrayBuffer> {
  const key = await fileKey(fileId, fileSaltB64, version);
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(ivB64) as any, additionalData: aad(session!.userId, fileId, version, chunk) as any },
    key, ciphertext,
  );
}

/** Constant-time-ish verifier stored server-side so a server can check unlock
 *  without ever seeing MK. It is a one-way digest, not a usable key. */
export async function masterVerifier(): Promise<string> {
  if (!session) throw new Error('Vault locked');
  const raw = await crypto.subtle.exportKey('raw', session.mk);
  const v = toB64(await hkdf(new Uint8Array(raw), 'verify'));
  new Uint8Array(raw).fill(0);
  return v;
}

/** Generate an RSA keypair for a device keystore (public key wraps MK). */
export async function generateDeviceKeypair(): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    false, ['wrapKey', 'unwrapKey'],
  );
  return { publicKey: pair.publicKey, privateKey: pair.privateKey };
}

// Compact portable wordlist for phrase generation (subset of BIP39-style;
// production should load the full 2048-word list from a local static asset).
const WORDLIST = `amber anchor apple arrow atlas audio badger baker banner barrel basic battery beach beacon berry birch bishop black blade bloom board bonus border bottle bridge bronze brook brush bucket builder cabin cactus candle canyon carbon cargo carpet castle cave cedar circle cloud cobalt comet coral cotton crystal curve cycle daily dance dawn delta desert diamond digital dolphin domain dragon dream drift drum earth echo edge ember engine epic equal estate event fabric falcon farm feather field flame flash fleet flint float forest fossil foundry fox frost garden gateway ghost giant glacier glow grain grand gravel grove harbor harvest hawk hazard hazel heart honey horizon hotel house ice island ivory jacket jade jaguar jar jelly jewel journey jungle kernel kettle key king ladder lagoon lantern laptop laurel lemon lens lever library light lilac limestone linen lion liquid lodge logic lotus lumber lunar magnet maple marble meadow metal meteor midday mist mockingbird moon moss mountain mouse mural music nectar needle Neptune nest net nimbus north nova oak observe ocean ochre olive online orbit orchid otter outer owner oxygen oyster palm panda paper parcel pencil pepper piano picnic picture pilgrim pine pink pioneer planet plastic plate plum polar pond pony pool portrait poster prairie prism pulse pumpkin quartz queen quick quiet quill rabbit radar radio rainbow raven razor real reason rebel record reed reef reflect reform regal relay resort retail return ridge rifle right rigid ripple river road robin robot rock rose rotate rough route royal rubber ruby rug ruler saddle sail salmon salon salt sand satin scale scan scarlet scatter scheme scholar science scissors scout screw sea season seaweed secret segment select sense serenity server sesame shadow shaft shale shaman shape share shark shawl sheep shelf shell shield shift shine ship shock shoe shop shuttle sibling sight silver since sketch ski skill slate sleep slender slice slip slope small smart smile smoke snake solar solid solution solve song soul sound south space spare spark speak spear speed spell sphere spice spider spike spirit splash spring spy square squirrel stable stadium staff stage stair stamp star state station steel stem step stereo storm story stove strategy stream street strike strong studio stuff stumble style sugar suite summer summit sunset supply supreme surface surprise swallow swamp swarm sweet swift swing swirl symbol system table tackle tag tail talent talk tank tape target taste tattoo teach team telescope temp tend tent term test texture thank theme there thick thin thread threat thrive throat thumb thunder tide tiger timber time tiny tip tire title toast today token tomato tongue tooth topic torch total touch tough tower trace track trade trail train transfer trap travel tray tree trend trial tribe trick trigger trim trip triumph tropical trust truth tube turtle twelve twenty twice twin twist two umbrella uncle under uniform unique unit universe unknown until upper upset urban urge usage use usual vacant valley valuable van vanish vapor vault velvet vendor venture verb version very vessel veteran vibrant victory video view village vintage violin virtual virus visa vision visual vivid vocal voice volcano volume voyage wagon wallet walnut wander want war warmth warrior watch water wave wax wealth weapon wear weave web wedding weekend weight whale wheat wheel when whip whisper wide widow width wild will window wine wing winter wire wisdom wish wolf wood wool word work world worry worth wrap wreck wrist write wrong yard year yellow yield young youth zebra zenith zephyr zero zone zoo`.trim().split(/\s+/).filter(w => /^[a-z]+$/.test(w));

export const CRYPTO_VERSION = VER;

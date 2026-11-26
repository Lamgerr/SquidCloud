/** Prepare a new upload as E2E v4 ciphertext. Legacy files keep their paths.
 *
 * New writes use independently encrypted 1 MiB frames so a preview only needs
 * the first chunk(s) instead of the whole file. Old single-frame v4 files
 * remain readable through the original magic/format. */
import { deriveV4FileKey, decryptV4Chunk, encryptV4Chunk, makeV4Aad, randomBytes, v4SaltB64 } from './e2e-v4';
import { getV4Master } from './e2e-v4-session';
import { V4_KEY_LABEL } from './e2e-upload-policy';

/* KTL is an external boundary. Inject it so offline tests can verify the
   crypto without a Supabase session; production always uses the real guard. */
type KtlCheck = (userId: string) => Promise<unknown>;
const realKtlCheck: KtlCheck = async (userId) => {
  const { assertKtl } = await import('./zk/ktl-guard');
  return assertKtl(userId);
};

export type V4UploadMeta = {
  fileId: string;
  saltB64: string;
  originalSize: number;
  originalName: string;
  originalType: string;
  version: 4;
  chunkSize?: number;
  totalChunks?: number;
};

export const LEGACY_V4_MAGIC = new Uint8Array([0x52, 0x45, 0x04]);
export const CHUNKED_V4_MAGIC = new Uint8Array([0x52, 0x45, 0x05]);
export const V4_PLAINTEXT_CHUNK_SIZE = 1024 * 1024;
const LEGACY_HEADER_SIZE = LEGACY_V4_MAGIC.length + 32 + 12;
const CHUNKED_HEADER_SIZE = CHUNKED_V4_MAGIC.length + 32 + 4 + 4;
const IV_BYTES = 12;
const TAG_BYTES = 16;

function uint32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true);
}

function putUint32(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer, bytes.byteOffset + offset, 4).setUint32(0, value, true);
}

export async function prepareV4Upload(
  file: File,
  userId: string,
): Promise<{ file: File; meta: V4UploadMeta } | null> {
  const master = getV4Master();
  if (!master) return null;

  const fileId = crypto.randomUUID();
  const salt = randomBytes(32);
  const saltB64 = v4SaltB64(salt);
  const key = await deriveV4FileKey(master.buffer as ArrayBuffer, userId, fileId, salt);
  const plaintext = new Uint8Array(await file.arrayBuffer());
  const totalChunks = Math.max(1, Math.ceil(plaintext.length / V4_PLAINTEXT_CHUNK_SIZE));
  const aadFor = (index: number) =>
    makeV4Aad(userId, fileId, saltB64, 1, index, totalChunks);

  const frames: Uint8Array[] = [];
  for (let index = 0; index < totalChunks; index++) {
    const start = index * V4_PLAINTEXT_CHUNK_SIZE;
    const end = Math.min(start + V4_PLAINTEXT_CHUNK_SIZE, plaintext.length);
    const { ciphertext, iv } = await encryptV4Chunk(key, plaintext.slice(start, end), aadFor(index));
    const frame = new Uint8Array(IV_BYTES + ciphertext.byteLength);
    frame.set(iv, 0);
    frame.set(new Uint8Array(ciphertext), IV_BYTES);
    frames.push(frame);
  }

  const sealed = new Uint8Array(CHUNKED_HEADER_SIZE + frames.reduce((n, f) => n + f.length, 0));
  sealed.set(CHUNKED_V4_MAGIC, 0);
  sealed.set(salt, CHUNKED_V4_MAGIC.length);
  putUint32(sealed, CHUNKED_V4_MAGIC.length + 32, V4_PLAINTEXT_CHUNK_SIZE);
  putUint32(sealed, CHUNKED_V4_MAGIC.length + 36, totalChunks);
  let offset = CHUNKED_HEADER_SIZE;
  for (const frame of frames) { sealed.set(frame, offset); offset += frame.length; }

  return {
    file: new File([sealed], file.name, {
      type: 'application/octet-stream', lastModified: file.lastModified,
    }),
    meta: {
      fileId, saltB64,
      originalSize: file.size,
      originalName: file.name,
      originalType: file.type,
      version: 4,
      chunkSize: V4_PLAINTEXT_CHUNK_SIZE,
      totalChunks,
    },
  };
}

function hasMagic(bytes: Uint8Array, magic: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === magic[0] && bytes[1] === magic[1] && bytes[2] === magic[2];
}

export function isChunkedV4Sealed(bytes: Uint8Array): boolean {
  return hasMagic(bytes, CHUNKED_V4_MAGIC);
}

export function isV4Sealed(bytes: Uint8Array): boolean {
  return hasMagic(bytes, CHUNKED_V4_MAGIC) || hasMagic(bytes, LEGACY_V4_MAGIC);
}

async function fileKey(userId: string, meta: V4UploadMeta, salt: Uint8Array) {
  const master = getV4Master();
  if (!master) throw new Error('Vault locked');
  return deriveV4FileKey(master.buffer as ArrayBuffer, userId, meta.fileId, salt);
}

/** Decrypt every complete frame available in the supplied prefix. Used for
 *  instant preview: callers fetch only the first RES54 chunks. */
export async function decryptV4Prefix(
  sealedPrefix: ArrayBuffer,
  userId: string,
  meta: V4UploadMeta,
  ktlCheck: KtlCheck = realKtlCheck,
): Promise<ArrayBuffer> {
  await ktlCheck(userId);
  const bytes = new Uint8Array(sealedPrefix);
  if (bytes.length < CHUNKED_HEADER_SIZE) throw new Error('Incomplete v4 header');
  for (let i = 0; i < 3; i++) if (bytes[i] !== CHUNKED_V4_MAGIC[i]) throw new Error('Not a chunked v4 file');

  const salt = bytes.slice(CHUNKED_V4_MAGIC.length, CHUNKED_V4_MAGIC.length + 32);
  const chunkSize = uint32(bytes, CHUNKED_V4_MAGIC.length + 32);
  const totalChunks = uint32(bytes, CHUNKED_V4_MAGIC.length + 36);
  if (!chunkSize || !totalChunks) throw new Error('Invalid v4 header');

  const key = await fileKey(userId, meta, salt);
  const pieces: Uint8Array[] = [];
  let offset = CHUNKED_HEADER_SIZE;
  for (let index = 0; index < totalChunks; index++) {
    const expectedPlain = Math.min(chunkSize, meta.originalSize - index * chunkSize);
    if (expectedPlain <= 0) break;
    const frameLength = IV_BYTES + expectedPlain + TAG_BYTES;
    if (offset + frameLength > bytes.length) break;
    const iv = bytes.slice(offset, offset + IV_BYTES);
    const ciphertext = bytes.slice(offset + IV_BYTES, offset + frameLength);
    pieces.push(new Uint8Array(await decryptV4Chunk(
      key, ciphertext, iv, makeV4Aad(userId, meta.fileId, v4SaltB64(salt), 1, index, totalChunks),
    )));
    offset += frameLength;
  }
  if (!pieces.length) throw new Error('No complete v4 chunk in the fetched prefix');
  const out = new Uint8Array(pieces.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  for (const piece of pieces) { out.set(piece, pos); pos += piece.length; }
  return out.buffer;
}

export async function decryptV4File(
  sealed: ArrayBuffer,
  userId: string,
  meta: V4UploadMeta,
  ktlCheck: KtlCheck = realKtlCheck,
): Promise<ArrayBuffer> {
  await ktlCheck(userId);
  const bytes = new Uint8Array(sealed);
  if (!isV4Sealed(bytes)) throw new Error('Invalid v4 ciphertext');

  if (bytes[2] === CHUNKED_V4_MAGIC[2]) {
    const plain = new Uint8Array(await decryptV4Prefix(sealed, userId, meta, async () => undefined));
    if (plain.byteLength !== meta.originalSize) throw new Error('Incomplete v4 ciphertext');
    return plain.buffer;
  }

  // Legacy single-frame v4 files stay readable forever.
  const salt = bytes.slice(LEGACY_V4_MAGIC.length, LEGACY_V4_MAGIC.length + 32);
  const iv = bytes.slice(LEGACY_V4_MAGIC.length + 32, LEGACY_HEADER_SIZE);
  const ciphertext = bytes.slice(LEGACY_HEADER_SIZE);
  const key = await fileKey(userId, meta, salt);
  return decryptV4Chunk(key, ciphertext, iv, makeV4Aad(userId, meta.fileId, v4SaltB64(salt), 1, 0, 1));
}

export const V4_LABEL = V4_KEY_LABEL;

let pendingV4Meta: V4UploadMeta | null = null;
export function setPendingV4Meta(meta: V4UploadMeta | null): void { pendingV4Meta = meta; }
export function takePendingV4Meta(): V4UploadMeta | null {
  const meta = pendingV4Meta;
  pendingV4Meta = null;
  return meta;
}

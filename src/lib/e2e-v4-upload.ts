/** Prepare a new upload as E2E v4 ciphertext. Legacy files keep their paths. */
import { deriveV4FileKey, encryptV4Chunk, makeV4Aad, randomBytes, v4SaltB64 } from './e2e-v4';
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
};

const V4_MAGIC = new Uint8Array([0x52, 0x45, 0x04]);
const HEADER_SIZE = V4_MAGIC.length + 32 + 12;

export async function prepareV4Upload(
  file: File,
  userId: string,
): Promise<{ file: File; meta: V4UploadMeta } | null> {
  const master = getV4Master();
  if (!master) return null;

  const fileId = crypto.randomUUID();
  const salt = randomBytes(32);
  const key = await deriveV4FileKey(master.buffer as ArrayBuffer, userId, fileId, salt);
  const plaintext = await file.arrayBuffer();
  const aad = makeV4Aad(userId, fileId, v4SaltB64(salt), 1, 0, 1);
  const { ciphertext, iv } = await encryptV4Chunk(key, plaintext, aad);

  const sealed = new Uint8Array(HEADER_SIZE + ciphertext.byteLength);
  sealed.set(V4_MAGIC, 0);
  sealed.set(salt, V4_MAGIC.length);
  sealed.set(iv, V4_MAGIC.length + 32);
  sealed.set(new Uint8Array(ciphertext), HEADER_SIZE);

  return {
    file: new File([sealed], file.name, {
      type: 'application/octet-stream', lastModified: file.lastModified,
    }),
    meta: {
      fileId,
      saltB64: v4SaltB64(salt),
      originalSize: file.size,
      originalName: file.name,
      originalType: file.type,
      version: 4,
    },
  };
}

export function isV4Sealed(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === V4_MAGIC[0] && bytes[1] === V4_MAGIC[1] && bytes[2] === V4_MAGIC[2];
}

export async function decryptV4File(
  sealed: ArrayBuffer,
  userId: string,
  meta: V4UploadMeta,
  ktlCheck: KtlCheck = realKtlCheck,
): Promise<ArrayBuffer> {
  await ktlCheck(userId);
  const master = getV4Master();
  if (!master) throw new Error('Vault locked');
  const bytes = new Uint8Array(sealed);
  if (!isV4Sealed(bytes)) throw new Error('Invalid v4 ciphertext');
  const salt = bytes.slice(V4_MAGIC.length, V4_MAGIC.length + 32);
  const iv = bytes.slice(V4_MAGIC.length + 32, HEADER_SIZE);
  const ciphertext = bytes.slice(HEADER_SIZE);
  const key = await deriveV4FileKey(master.buffer as ArrayBuffer, userId, meta.fileId, salt);
  const aad = makeV4Aad(userId, meta.fileId, v4SaltB64(salt), 1, 0, 1);
  const { decryptV4Chunk } = await import('./e2e-v4');
  return decryptV4Chunk(key, ciphertext, iv, aad);
}

export const V4_LABEL = V4_KEY_LABEL;

let pendingV4Meta: V4UploadMeta | null = null;
export function setPendingV4Meta(meta: V4UploadMeta | null): void { pendingV4Meta = meta; }
export function takePendingV4Meta(): V4UploadMeta | null {
  const meta = pendingV4Meta;
  pendingV4Meta = null;
  return meta;
}

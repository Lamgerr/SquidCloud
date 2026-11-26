import { isLegacyManagedUpload, V4_KEY_LABEL, canStartUpload } from './e2e-upload-policy';
import { setPendingV4Meta, takePendingV4Meta, decryptV4File, decryptV4Prefix, isV4Sealed, type V4UploadMeta } from './e2e-v4-upload';
import { supabase } from "@/integrations/supabase/client";
import { decryptData, generateEncryptionKey, detectEncryptionVersion } from "./encryption";
import { getLoadBalancer } from "@/services/load-balancer";
import { generateSalt, arrayBufferToBase64 as arrayToBase64 } from "@/lib/key-derivation";
import { base64ToArrayBuffer } from '@/services/byok-encryption';
import { requestEphemeralBYOKKey, requestKeySelection, requestMandatoryBYOKSetup, type BYOKPromptReason } from '@/services/ephemeral-byok-prompt';
import { deriveFileKey, deriveChunkKey, generatePerFileKey, encryptChunkV3, decryptChunkV3 } from '@/lib/encryption-v3';
import type { FileKeyMaterial } from '@/lib/encryption-v3';
import { fetchFileEncryptionKey } from '@/lib/secure-file-metadata';
import { SUPABASE_URL } from '@/lib/supabaseEnv';

const isProductionBuild = import.meta.env.PROD;
const ACTIVE_WORKSPACE_STORAGE_KEY = 'squid_active_workspace_id';

const devLog = (...args: unknown[]) => {
  if (!isProductionBuild) console.log(...args);
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function assertFileId(fileId: string): void {
  if (!UUID_RE.test(fileId)) throw new Error(`Invalid file id: ${fileId}`);
}

const devWarn = (...args: unknown[]) => {
  if (!isProductionBuild) console.warn(...args);
};

const getActiveWorkspaceId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);
};

const getChunkStoragePath = (userId: string, chunkId: string): string => {
  const workspaceId = getActiveWorkspaceId();
  if (!workspaceId) {
    return `${userId}/${chunkId}.bin`;
  }
  return `${userId}/${workspaceId}/${chunkId}.bin`;
};

type Res54ProgressCallback = (progress: number, stage: string, details?: any) => void;

export interface Res54DownloadOptions {
  reason?: BYOKPromptReason;
  fileName?: string;
  decryptionKey?: string;
  fileRecord?: Record<string, any>;
  shareId?: string;
}

interface BYOKRuntimePolicy {
  enabled: boolean;
  strictMode: boolean;
  allowDefaultFallback: boolean;
  promptEveryDecrypt: boolean;
  hasAccountKey: boolean;
}

export const getBYOKRuntimePolicy = async (userId: string): Promise<BYOKRuntimePolicy> => {
  try {
    const { data, error } = await supabase
      .from('user_encryption_settings')
      .select('settings')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      return { enabled: false, strictMode: true, allowDefaultFallback: true, promptEveryDecrypt: true, hasAccountKey: false };
    }

    const settings = (data.settings || {}) as Record<string, any>;

    return {
      enabled: Boolean(settings.byok_enabled),
      strictMode: settings.strict_mode ?? true,
      allowDefaultFallback: settings.allow_default_fallback ?? true,
      promptEveryDecrypt: settings.prompt_every_decrypt ?? true,
      hasAccountKey: Boolean(settings.account_key_hash),
    };
  } catch (error) {
    devWarn('Failed to load BYOK runtime policy');
    return { enabled: false, strictMode: true, allowDefaultFallback: true, promptEveryDecrypt: true, hasAccountKey: false };
  }
};

// Web Worker pool for non-blocking encryption
const WORKER_POOL_SIZE = 4;
let encryptionWorkers: Worker[] | null = null;

const getEncryptionWorker = (chunkIndex: number): Worker | null => {
  if (!encryptionWorkers || encryptionWorkers.length === 0) {
    encryptionWorkers = [];
    for (let i = 0; i < WORKER_POOL_SIZE; i++) {
      try {
        const worker = new Worker(new URL('../workers/upload-worker.ts', import.meta.url), { type: 'module' });
        encryptionWorkers.push(worker);
      } catch (error) {
        devWarn('Web Worker not available:', error);
      }
    }
    if (encryptionWorkers.length === 0) {
      // Leave the pool as null (not an empty array) so the next call re-attempts
      // creation instead of returning `undefined` for every future chunk.
      encryptionWorkers = null;
      return null;
    }
  }
  return encryptionWorkers[chunkIndex % encryptionWorkers.length];
};

// Main-thread fallbacks used when Web Workers are unavailable. Mirrors the
// encryption performed inside workers/upload-worker.ts so uploads still succeed.
async function encryptDataMainThread(data: ArrayBuffer, keyString: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyString.slice(0, 32).padEnd(32, '0'));
  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = encoder.encode(`res54-v2-${Date.now()}`);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData }, key, data
  );
  const encryptedBytes = new Uint8Array(encrypted);
  const combined = new Uint8Array(4 + additionalData.byteLength + iv.byteLength + encryptedBytes.byteLength);
  const view = new DataView(combined.buffer, 0, 4);
  view.setUint32(0, additionalData.byteLength, true);
  combined.set(additionalData, 4);
  combined.set(iv, 4 + additionalData.byteLength);
  combined.set(encryptedBytes, 4 + additionalData.byteLength + iv.byteLength);
  return combined.buffer;
}

const V3_MAGIC = new Uint8Array([0x52, 0x45, 0x03]);

async function encryptChunkV3MainThread(
  data: ArrayBuffer,
  chunkKeyRaw: ArrayBuffer,
  iv: Uint8Array,
  aad: Uint8Array
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw', chunkKeyRaw, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 }, key, data
  );
  const encBytes = new Uint8Array(encrypted);
  const origLen = new Uint8Array(4);
  new DataView(origLen.buffer).setUint32(0, data.byteLength, true);
  const header = new Uint8Array(V3_MAGIC.length + origLen.length + iv.length);
  header.set(V3_MAGIC, 0);
  header.set(origLen, V3_MAGIC.length);
  header.set(iv, V3_MAGIC.length + origLen.length);
  const result = new Uint8Array(header.length + encBytes.length);
  result.set(header);
  result.set(encBytes, header.length);
  return result.buffer;
}

const terminateAllWorkers = () => {
  if (encryptionWorkers) {
    encryptionWorkers.forEach(w => w.terminate());
    encryptionWorkers = null;
  }
};

let v3FileKeyState: { userId: string; fileId: string; fileKeyRaw: ArrayBuffer; totalChunks: number } | null = null;

export function clearV3KeyState() {
  v3FileKeyState = null;
}

async function resolveUploadEncryptionKey(file: File, userId: string, isBYOKActive: boolean, totalChunks: number): Promise<{ encryptionKey: string }> {
  if (!isBYOKActive) return { encryptionKey: generateEncryptionKey() };

  const selection = await requestKeySelection({ fileName: file.name, fileSize: file.size });
  if (!selection) throw new Error("Encryption key selection was cancelled.");

  if (selection.mode === 'saved') {
    const sessionKey = await getV3SessionKey();
    if (!sessionKey) throw new Error("Please unlock your encryption key first.");
    const fileId = crypto.randomUUID();
    const fm = await deriveFileKey(sessionKey, fileId);
    v3FileKeyState = { userId, fileId, fileKeyRaw: fm.fileKeyRaw, totalChunks };
    return { encryptionKey: `v3_byok_${fileId}` };
  }

  if (selection.mode === 'custom' && selection.customKey) return { encryptionKey: selection.customKey };

  if (selection.mode === 'unique') {
    const { keyRaw } = await generatePerFileKey();
    const fileId = `unique_${crypto.randomUUID()}`;
    const fm = await deriveFileKey(keyRaw, fileId);
    v3FileKeyState = { userId, fileId, fileKeyRaw: fm.fileKeyRaw, totalChunks };
    return { encryptionKey: `v3_unique_${fileId}` };
  }

  return { encryptionKey: generateEncryptionKey() };
}

async function getV3SessionKey(): Promise<ArrayBuffer | null> {
  try {
    const { sessionKeyManager } = await import('@/services/session-key-manager');
    const sessionKey = sessionKeyManager.getAccountKey();
    if (!sessionKey?.key) return null;
    return await crypto.subtle.exportKey('raw', sessionKey.key);
  } catch {
    return null;
  }
}

async function encryptChunkWithWorkerV3(chunkData: ArrayBuffer, index: number): Promise<ArrayBuffer> {
  if (!v3FileKeyState) throw new Error("V3 key state not initialized");
  const { fileKeyRaw, userId, fileId, totalChunks } = v3FileKeyState;
  const { chunkKeyRaw, iv } = await deriveChunkKey(fileKeyRaw, index);
  const encoder = new TextEncoder();
  const aad = encoder.encode(`res54-v3|${userId}|${fileId}|${index}|${totalChunks}`);
  const loadBalancer = getLoadBalancer();

  const worker = getEncryptionWorker(index);
  if (!worker) return encryptChunkV3MainThread(chunkData, chunkKeyRaw, iv, aad);

  return loadBalancer.execute(
    () => new Promise<ArrayBuffer>((resolve, reject) => {
      const timeout = setTimeout(() => {
        worker.removeEventListener('message', handler);
        reject(new Error(`V3 encryption timeout for chunk ${index}`));
      }, 60000);

      const handler = (event: MessageEvent) => {
        if (event.data.index === index) {
          clearTimeout(timeout);
          worker.removeEventListener('message', handler);
          if (event.data.type === 'chunk-encrypted') resolve(event.data.data);
          else if (event.data.type === 'error') reject(new Error(event.data.error));
        }
      };

      worker.addEventListener('message', handler);
      worker.postMessage({ type: 'encrypt-chunk-v3', chunkData, chunkKey: chunkKeyRaw, iv, aad, index }, [chunkData]);
    }),
    { priority: 3, poolType: 'encryption', tags: ['encryption', 'v3'], timeout: 120000, maxRetries: 3 }
  );
}

async function resolveV3DecryptKey(encKey: string, userId: string, fileId: string): Promise<ArrayBuffer | null> {
  try {
    if (encKey.startsWith('v3_byok_')) {
      const fileKeyId = encKey.replace('v3_byok_', '');
      const sessionKey = await getV3SessionKey();
      if (!sessionKey) {
        const { requestEphemeralBYOKKey: promptKey } = await import('@/services/ephemeral-byok-prompt');
        const keyStr = await promptKey({ title: 'Unlock encryption key', description: 'Enter your BYOK key to decrypt this file' });
        if (!keyStr) return null;
        const encoder = new TextEncoder();
        const raw = encoder.encode(keyStr).buffer;
        const fm = await deriveFileKey(raw, fileKeyId);
        return fm.fileKeyRaw;
      }
      const fm = await deriveFileKey(sessionKey, fileKeyId);
      return fm.fileKeyRaw;
    }
    if (encKey.startsWith('v3_custom_')) {
      const fileKeyId = encKey.replace('v3_custom_', '');
      const { requestEphemeralBYOKKey: promptKey } = await import('@/services/ephemeral-byok-prompt');
      const keyStr = await promptKey({ title: 'Enter custom key', description: 'Enter the custom key used to encrypt this file' });
      if (!keyStr) return null;
      const encoder = new TextEncoder();
      const raw = encoder.encode(keyStr.padEnd(32)).buffer;
      const fm = await deriveFileKey(raw, fileKeyId);
      return fm.fileKeyRaw;
    }
    if (encKey.startsWith('v3_unique_')) {
      const fileKeyId = encKey.replace('v3_unique_', '');
      const { sessionKeyManager } = await import('@/services/session-key-manager');
      const sessionCryptoKey = sessionKeyManager.getAccountKey()?.key;
      if (!sessionCryptoKey) return null;
      const { unwrapPerFileKey } = await import('@/lib/encryption-v3');
      const { data } = await supabase.from('encrypted_keys').select('wrapped_key, key_iv').eq('file_id', fileKeyId).maybeSingle();
      if (!data) return null;
      const raw = await unwrapPerFileKey(data.wrapped_key, data.key_iv, sessionCryptoKey);
      const fm = await deriveFileKey(raw, fileKeyId);
      return fm.fileKeyRaw;
    }
    return null;
  } catch {
    return null;
  }
}

async function decryptAllV3Chunks(sortedChunks: string[], fileKeyRaw: ArrayBuffer | null, userId: string, fileId: string, progressCallback?: Res54ProgressCallback): Promise<ArrayBuffer[]> {
  if (!fileKeyRaw) throw new Error('V3 key material not available');
  const decrypted: ArrayBuffer[] = [];
  const totalChunks = sortedChunks.length;

  for (let i = 0; i < totalChunks; i++) {
    progressCallback?.(60 + ((i + 1) / totalChunks * 30), 'decrypting', { current: i + 1, total: totalChunks });
    const chunkBuffer = base64ToArrayBuffer(sortedChunks[i]);
    const decryptedChunk = await decryptChunkV3(chunkBuffer.buffer, fileKeyRaw, userId, fileId, i, totalChunks);
    decrypted.push(decryptedChunk);
  }
  return decrypted;
}

async function encryptChunkDispatch(chunkData: ArrayBuffer, encryptionKey: string, index: number): Promise<ArrayBuffer> {
  if (v3FileKeyState && (encryptionKey.startsWith('v3_byok_') || encryptionKey.startsWith('v3_unique_') || encryptionKey.startsWith('v3_custom_'))) {
    return encryptChunkWithWorkerV3(chunkData, index);
  }
  return encryptChunkWithWorker(chunkData, encryptionKey, index);
}

const encryptChunkWithWorker = async (chunkData: ArrayBuffer, encryptionKey: string, index: number): Promise<ArrayBuffer> => {
  const loadBalancer = getLoadBalancer();
  const worker = getEncryptionWorker(index);
  if (!worker) return encryptDataMainThread(chunkData, encryptionKey);
  return loadBalancer.execute(
    () => new Promise<ArrayBuffer>((resolve, reject) => {
      const timeout = setTimeout(() => {
        worker.removeEventListener('message', handler);
        reject(new Error(`Encryption timeout for chunk ${index}`));
      }, 60000);

      const handler = (event: MessageEvent) => {
        if (event.data.index === index) {
          clearTimeout(timeout);
          worker.removeEventListener('message', handler);
          if (event.data.type === 'chunk-encrypted') resolve(event.data.data);
          else if (event.data.type === 'error') reject(new Error(event.data.error));
        }
      };

      worker.addEventListener('message', handler);
      worker.postMessage({ type: 'encrypt-chunk', chunkData, encryptionKey, index }, [chunkData]);
    }),
    { priority: 3, poolType: 'encryption', tags: ['encryption', 'chunk', `chunk-${index}`], timeout: 65000 }
  );
};

export interface ChunkMetadata {
  index: number;
  totalChunks: number;
  size: number;
  offset: number;
  sha256: string;
  repo?: string;
  path?: string;
  accountId?: number;
  clusterId?: string;
  providerId?: string;
  bucket?: string;
}

interface Res54FileMetadata {
  fileName: string;
  fileType: string;
  fileSize: number;
  chunks: ChunkMetadata[];
  encryptionKey: string;
  created: string;
  previewAvailable: boolean;
  previewType?: string;
  previewPath?: string;
}

const MAX_PARALLEL_OPERATIONS = 16;
const MAX_RETRIES = 5;
const RETRY_DELAY_BASE = 500;
const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024;
const VERY_LARGE_FILE_THRESHOLD = 500 * 1024 * 1024;

const CHUNK_SIZE_SMALL = 2 * 1024 * 1024;
const CHUNK_SIZE_MEDIUM = 8 * 1024 * 1024;
const CHUNK_SIZE_LARGE = 8 * 1024 * 1024;
const CHUNK_SIZE_XLARGE = 4 * 1024 * 1024;

const BATCH_SIZE = 12;
const BATCH_SIZE_LARGE_FILE = 8;
const STREAMING_BATCH_SIZE = 6;

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    for (let j = 0; j < chunk.length; j++) binary += String.fromCharCode(chunk[j]);
  }
  return btoa(binary);
};

export const determineChunkingStrategy = (fileSize: number): number => {
  if (fileSize > VERY_LARGE_FILE_THRESHOLD) return CHUNK_SIZE_XLARGE;
  if (fileSize > LARGE_FILE_THRESHOLD) return CHUNK_SIZE_LARGE;
  if (fileSize > 10 * 1024 * 1024) return CHUNK_SIZE_MEDIUM;
  return CHUNK_SIZE_SMALL;
};

const getBatchSize = (fileSize: number): number => {
  if (fileSize > VERY_LARGE_FILE_THRESHOLD) return BATCH_SIZE_LARGE_FILE;
  return BATCH_SIZE;
};

const readFileChunk = async (file: File, start: number, end: number): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const chunk = file.slice(start, end);
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (buffer instanceof ArrayBuffer && buffer.byteLength > 0) resolve(buffer);
      else reject(new Error('Invalid chunk data'));
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(chunk);
  });
};

export const createFileChunks = async (file: File, progressCallback?: (progress: number) => void, encryptionKey?: string): Promise<{ chunks: ArrayBuffer[], metadata: Res54FileMetadata }> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");

  if (!encryptionKey) encryptionKey = generateEncryptionKey();

  const chunkSize = determineChunkingStrategy(file.size);
  const totalChunks = Math.ceil(file.size / chunkSize);
  const chunks: ArrayBuffer[] = [];
  const chunkMetadata: ChunkMetadata[] = [];
  let offset = 0;
  
  while (offset < file.size) {
    const end = Math.min(offset + chunkSize, file.size);
    const chunkBuffer = await readFileChunk(file, offset, end);
    chunks.push(chunkBuffer);
    chunkMetadata.push({
      index: chunks.length - 1,
      totalChunks,
      size: chunkBuffer.byteLength,
      offset: offset,
      sha256: '' // Integrity hash skipped to save UI freezing
    });
    if (progressCallback) progressCallback((offset / file.size) * 50);
    offset += chunkSize;
  }
  
  const metadata: Res54FileMetadata = {
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    chunks: chunkMetadata,
    encryptionKey,
    created: new Date().toISOString(),
    previewAvailable: false
  };
  
  return { chunks, metadata };
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const backoffDelay = (attempt: number) => Math.min(RETRY_DELAY_BASE * Math.pow(2, attempt), 30000);

async function processChunksInParallel<T>(
  chunks: any[], 
  processor: (chunk: any, index: number, attempt: number) => Promise<T>,
  concurrency: number = MAX_PARALLEL_OPERATIONS,
  progressCallback?: (progress: number, stage: string, details?: any) => void
): Promise<T[]> {
  const results: T[] = new Array(chunks.length);
  let completed = 0;
  let nextIndex = 0;
  const retryQueue: {index: number, attempt: number}[] = [];
  const failed: {index: number, error: any}[] = [];
  const failLog = new Map<number, number>();
  
  const total = chunks.length;
  let done = false;
  let resolvePromise: (val: T[]) => void;
  let rejectPromise: (err: Error) => void;
  
  const tryComplete = () => {
    if (done) return;
    if (completed + failed.length < total) return;
    done = true;
    if (failed.length === 0) resolvePromise(results);
    else rejectPromise(new Error(`Failed to process ${failed.length} chunks. Last error: ${failed[0].error?.message || 'Unknown error'}`));
  };
  
  const workerLoop = async () => {
    while (!done) {
      let index: number | null = null;
      let attempt = 0;
      
      if (retryQueue.length > 0) {
        const item = retryQueue.shift()!;
        index = item.index;
        attempt = item.attempt;
        await delay(backoffDelay(attempt - 1));
      } else if (nextIndex < total) {
        index = nextIndex++;
        attempt = 0;
      } else {
        return;
      }
      
      try {
        results[index] = await processor(chunks[index], index, attempt);
        completed++;
        progressCallback?.((completed / total) * 100, 'processing', { current: completed, total, retry: attempt > 0 });
      } catch (error: any) {
        const prevFails = failLog.get(index) || 0;
        if (prevFails < MAX_RETRIES) {
          failLog.set(index, prevFails + 1);
          retryQueue.push({index, attempt: prevFails + 1});
        } else {
          failed.push({index, error});
        }
      }
      tryComplete();
    }
  };
  
  const workers: Promise<void>[] = [];
  const workerCount = Math.min(concurrency, total);
  for (let i = 0; i < workerCount; i++) workers.push(workerLoop());
  
  return new Promise<T[]>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  }).finally(() => { done = true; });
}

export const uploadFileWithRes54 = async (
  file: File,
  progressCallback?: (progress: number, stage: string, details?: any) => void,
  providerId?: string,
  sealedV4 = false,
  v4MetaOverride?: V4UploadMeta
): Promise<{ id: string, metadata: Res54FileMetadata, encryptionKey: string }> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) throw new Error('Authentication required');
  const supabaseUrl = SUPABASE_URL;

  // S-Hawk metadata screening (plaintext-side, before encryption).
  // Rejections throw SwkRejection carrying the exact reasons for the UI.
  const { buildSwkManifest, swkScanManifest } = await import('./swk-manifest');
  progressCallback?.(0, 'screening', { message: 'S-Hawk safety screening' });
  const swkManifest = await buildSwkManifest(file);
  const swkVerdict = await swkScanManifest(swkManifest);
  progressCallback?.(0, 'screening-done');

  // Central no-escrow gate: every caller of this pipeline gets client-only
  // encryption when the vault is unlocked, even if it did not prepare v4
  // itself. Without a client-held key the upload is refused.
  let sealed = sealedV4;
  let sealedMeta = v4MetaOverride;
  if (!sealed) {
    const { hasV4Master } = await import('./e2e-v4-session');
    const { prepareV4Upload } = await import('./e2e-v4-upload');
    if (hasV4Master()) {
      const prepared = await prepareV4Upload(file, user.id);
      if (prepared) {
        file = prepared.file;
        sealedMeta = prepared.meta;
        sealed = true;
      }
    }
    if (!sealed) {
      const policy = await getBYOKRuntimePolicy(user.id);
      if (!canStartUpload({ v4Prepared: false, byokActive: policy.enabled })) {
        throw new Error('Unlock your vault (or enable BYOK) before uploading');
      }
    }
  }

  // Effective provider: the server may transparently fail over to a
  // sibling bucket with free space (BUCKET_FULL gate). Metadata must point
  // at the bucket that actually holds the chunks.
  let effectiveProviderId = providerId;

  const getUploadUrls = async (chunks: { path: string; index: number }[], totalSize?: number) => {
    if (providerId) {
      const { data, error } = await supabase.functions.invoke('s3-storage', {
        body: { action: 'get-upload-urls', providerId, chunks, totalSize, swkToken: swkVerdict.token, swkManifestHash: swkVerdict.manifestHash }
      });
      if (error || !data?.success) throw new Error(`Storage Error: ${error?.message || data?.error || 'Failed to get upload URLs'}`);
      if (data.providerId && data.providerId !== providerId) {
        effectiveProviderId = data.providerId;
        progressCallback?.(0, 'failover', { message: 'Primary bucket full — using a bucket with free space', providerId: data.providerId });
      }
      const urls = data.urls.map((u: any) => ({ ...u, providerId: u.providerId || effectiveProviderId }));
      return { urls, clusterCount: 1 };
    }
    const urlResponse = await fetch(`${supabaseUrl}/functions/v1/squidcloud-cluster`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get-upload-urls', userId: user.id, totalSize, chunks, swkToken: swkVerdict.token, swkManifestHash: swkVerdict.manifestHash })
    });
    const responseData = await urlResponse.json();
    if (!urlResponse.ok || responseData.error) {
      throw new Error(`Storage Error: ${responseData.error || 'Failed to get upload URLs'}`);
    }
    if (!responseData.urls || !Array.isArray(responseData.urls)) {
      throw new Error('Storage Error: Server did not return valid upload URLs.');
    }
    return { urls: responseData.urls, clusterCount: responseData.clusterCount || 1 };
  };

  const assignChunkMeta = (u: any) => {
    if (u.providerId) {
      metadata.chunks[u.index] = { ...metadata.chunks[u.index], repo: 'b2', path: u.path, accountId: 0, providerId: u.providerId };
    } else {
      metadata.chunks[u.index] = { ...metadata.chunks[u.index], repo: 'b2', path: u.path, accountId: 0, clusterId: u.clusterId, bucket: u.bucket };
    }
  };

  if (file.size === 0) throw new Error('File is empty');
  if (file.size > LARGE_FILE_THRESHOLD) progressCallback?.(0, 'preparing', { message: 'Preparing large file upload strategy' });

  progressCallback?.(0, 'preparing');

  const useStreamingUpload = file.size > LARGE_FILE_THRESHOLD;
  const chunkSize = determineChunkingStrategy(file.size);
  const totalChunks = Math.ceil(file.size / chunkSize);

  let chunks: ArrayBuffer[] = [];
  let metadata: Res54FileMetadata;

  const byokPolicy = await getBYOKRuntimePolicy(user.id);
  const pendingV4 = sealed ? (sealedMeta || takePendingV4Meta()) : null;
  const { encryptionKey } = pendingV4
    ? { encryptionKey: V4_KEY_LABEL }
    : await resolveUploadEncryptionKey(file, user.id, byokPolicy.enabled, totalChunks);

  if (useStreamingUpload) {
    const chunkMetadata: ChunkMetadata[] = [];
    for (let index = 0; index < totalChunks; index++) {
      const offset = index * chunkSize;
      chunkMetadata.push({ index, totalChunks, size: Math.min(offset + chunkSize, file.size) - offset, offset, sha256: '' });
      if (progressCallback && index % 10 === 0) progressCallback((index / Math.max(totalChunks, 1)) * 40, 'chunking');
    }
    metadata = { fileName: file.name, fileType: file.type, fileSize: file.size, chunks: chunkMetadata, encryptionKey, created: new Date().toISOString(), previewAvailable: false };
  } else {
    const preloaded = await createFileChunks(file, (progress) => progressCallback && progressCallback(progress, 'chunking'), encryptionKey);
    chunks = preloaded.chunks;
    metadata = preloaded.metadata;
  }
  
  if (useStreamingUpload) {
    progressCallback?.(50, 'uploading', { message: 'Using memory-optimized streaming upload' });
    let uploadedCount = 0;
    
    for (let i = 0; i < totalChunks; i += STREAMING_BATCH_SIZE) {
      const batchEnd = Math.min(i + STREAMING_BATCH_SIZE, totalChunks);
      const batchIndexes = Array.from({ length: batchEnd - i }, (_, idx) => i + idx);
      
      const encryptedBatch = await Promise.all(
        batchIndexes.map(async (chunkIndex) => {
          const start = chunkIndex * chunkSize;
          const end = Math.min(start + chunkSize, file.size);
          const chunk = await readFileChunk(file, start, end);
          const encrypted = pendingV4 ? chunk : await encryptChunkDispatch(chunk, metadata.encryptionKey, chunkIndex);
          return { encrypted, index: chunkIndex };
        })
      );
      
      const urlPaths = encryptedBatch.map((chunk) => {
        const chunkId = `res54_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}_${chunk.index}`; // e2e-invariant-allow: storage identifier, not key material
        return { path: getChunkStoragePath(user.id, chunkId), index: chunk.index };
      });

      const { urls } = await getUploadUrls(urlPaths, file.size);
      urls.forEach(assignChunkMeta);

      await Promise.all(encryptedBatch.map(async (chunk) => {
        const targetUrl = urls.find((u: any) => u.index === chunk.index).uploadUrl;
        let attempts = 0;
        while (attempts < MAX_RETRIES) {
          try {
            const response = await fetch(targetUrl, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/octet-stream' },
              body: chunk.encrypted
            });
            if (!response.ok) throw new Error(`B2 Upload failed`);
            return;
          } catch (error: any) {
            attempts++;
            if (attempts >= MAX_RETRIES) throw error;
            await delay(backoffDelay(attempts));
          }
        }
      }));
      
      uploadedCount += encryptedBatch.length;
      encryptedBatch.length = 0;
    }
    
    if (encryptionWorkers) terminateAllWorkers();
    progressCallback?.(95, 'finalizing');
    
  } else {
    progressCallback?.(50, 'encrypting');
    
    const encryptChunk = async (chunk: ArrayBuffer, index: number): Promise<ArrayBuffer> => {
      const encryptedChunk = pendingV4 ? chunk : await encryptChunkDispatch(chunk, metadata.encryptionKey, index);
      progressCallback?.(50 + ((index + 1) / chunks.length * 10), 'encrypting', { current: index + 1, total: chunks.length });
      return encryptedChunk;
    };
    
    let encryptedChunks = await processChunksInParallel(chunks, encryptChunk, Math.min(chunks.length, MAX_PARALLEL_OPERATIONS));
    progressCallback?.(60, 'preparing upload');

    const urlPaths = encryptedChunks.map((_, index) => {
      const chunkId = `res54_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}_${index}`; // e2e-invariant-allow: storage identifier, not key material
      return { path: getChunkStoragePath(user.id, chunkId), index };
    });

    const { urls } = await getUploadUrls(urlPaths, file.size);
    urls.forEach(assignChunkMeta);

    const uploadChunkBinary = async (chunkWrap: any): Promise<any> => {
      const targetUrl = urls.find((u: any) => u.index === chunkWrap.index).uploadUrl;
      let attempt = 0;
      while (attempt < MAX_RETRIES) {
        try {
          const response = await fetch(targetUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: chunkWrap.data
          });
          if (!response.ok) throw new Error(`B2 Upload failed: ${response.statusText}`);
          return { index: chunkWrap.index, path: chunkWrap.path, repo: 'b2', verified: true };
        } catch (error: any) {
          attempt++;
          if (attempt >= MAX_RETRIES) throw error;
          await delay(backoffDelay(attempt));
        }
      }
    };

    const preparedChunks = encryptedChunks.map((data, index) => ({ data, index, path: urls.find((u: any) => u.index === index)?.path }));
    
    await processChunksInParallel(
      preparedChunks,
      uploadChunkBinary,
      getBatchSize(file.size),
      (progress) => progressCallback?.(60 + (progress * 0.3), 'uploading')
    );
      
    (encryptedChunks as any) = null;
    terminateAllWorkers();
  }
  
  progressCallback?.(90, 'finalizing');
  
  const isVaultManagedUpload = isLegacyManagedUpload(metadata);
  const isV4Upload = metadata.encryptionKey === V4_KEY_LABEL;
  const rawUploadKey = isVaultManagedUpload ? metadata.encryptionKey : null;
  const dbEncryptionKey = isV4Upload ? V4_KEY_LABEL : byokPolicy.enabled ? 'sha256:byok_encrypted' : 'managed_key';
  if (pendingV4) {
    (metadata as any).v4 = pendingV4;
    (metadata as any).fileSize = pendingV4.originalSize;
  }
  const metadataString = JSON.stringify({
    ...metadata,
    encryptionKey: dbEncryptionKey,
    chunks: metadata.chunks.map(chunk => ({ ...chunk, repo: chunk.repo, path: chunk.path }))
  });

  const activeWorkspaceId = getActiveWorkspaceId();
  const fileRecord: Record<string, any> = {
    name: file.name,
    type: file.type,
    size: file.size,
    storage_path: "res54_distributed",
    user_id: user.id,
    encrypted: true,
    shared: false,
    encryption_key: dbEncryptionKey,
    tags: [metadataString] as string[],
    processor: "res54",
    swk_manifest_hash: swkVerdict.manifestHash,
    swk_manifest: swkManifest,
    swk_decision: swkVerdict.decision,
    swk_scanned_at: new Date().toISOString(),
    ...(activeWorkspaceId ? { workspace_id: activeWorkspaceId } : {}),
    ...(effectiveProviderId ? { storage_provider_id: effectiveProviderId } : {})
  };

  const { data: dbFile, error: dbError } = await supabase.from('files').insert(fileRecord).select().single();
  let createdFile: any = dbFile;

  if (dbError) {
    const rpcArgs: Record<string, unknown> = {
      p_name: file.name,
      p_type: file.type || 'application/octet-stream',
      p_size: file.size,
      p_storage_path: 'res54_distributed',
      p_user_id: user.id,
      p_encrypted: true,
      p_encryption_key: dbEncryptionKey,
      p_metadata: metadataString,
      ...(activeWorkspaceId ? { p_workspace_id: activeWorkspaceId } : {})
    };

    let { data: rpcData, error: rpcError } = await supabase.rpc('create_file_record', rpcArgs as any);
    if (rpcError || !rpcData) throw new Error("Failed to create file record");
    createdFile = rpcData as any;
  }

  if (rawUploadKey && createdFile?.id) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error: storeError } = await supabase.functions.invoke('store-file-key', { // e2e-invariant-allow: legacy managed path only; new uploads are gated by canStartUpload
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: { fileId: createdFile.id, key: rawUploadKey },
      });
      if (storeError) throw storeError;
    } catch (storeFail) {
      console.warn('[res54] store-file-key failed; falling back to legacy tags key', createdFile.id, storeFail);
      const legacyMetadata = JSON.stringify({
        ...metadata,
        encryptionKey: rawUploadKey,
        chunks: metadata.chunks.map(chunk => ({ ...chunk, repo: chunk.repo, path: chunk.path }))
      });
      await supabase.from('files')
        .update({ tags: [legacyMetadata], encryption_key: rawUploadKey })
        .eq('id', createdFile.id);
    }
  }
  
  progressCallback?.(100, 'complete');
  clearV3KeyState();
  return { id: createdFile.id, metadata, encryptionKey: dbEncryptionKey };
};

/* ── Non-canonical row support (uniform read path) ──────────────
   Writers that predate (or bypass) the res54 uploader leave rows that
   the canonical parser rejects:
   • migration / cloud-import / direct-upload rows: NO tags at all, the
     object at storage_path in the `files` bucket IS the file (plaintext).
   • legacy SquidFS-bridge rows: chunk locations but NO key material
     (repo "" / missing encryptionKey). No-BYOK bridge uploads are
     plaintext; anything framed without a key is unrecoverable.
   These helpers let every reader (download, preview, dispatcher) route
   such rows instead of surfacing "Failed to parse chunk …". */

export const MANAGED_STORAGE_PATHS = new Set([
  'res54_distributed',
  'distributed_storage',
  'tebi_external',
  'tebi_external_encrypted',
  'sde',
]);

/** True when a files row carries no chunk metadata and its storage_path
    is a raw object key (not one of the managed pipeline markers). */
export function isRawStorageRow(file: any): boolean {
  const tags = (file as any)?.tags;
  const hasTags = Array.isArray(tags) && tags.some(t => typeof t === 'string' && t.trim().length > 0);
  const sp = (file as any)?.storage_path;
  return !hasTags && typeof sp === 'string' && sp.length > 0 && !MANAGED_STORAGE_PATHS.has(sp);
}

/** Download a raw object straight from the `files` bucket (no decrypt). */
export async function downloadRawStorageObject(file: any): Promise<Blob> {
  const sp = file?.storage_path;
  if (!sp) throw new Error('Download failed: file has no storage location');
  const { data, error } = await supabase.storage.from('files').download(sp);
  if (error || !data) throw new Error(`Download failed: ${error?.message || 'file object not found'}`);
  return data;
}

function u32le(b: Uint8Array, off: number): number {
  return new DataView(b.buffer, b.byteOffset + off, 4).getUint32(0, true);
}

/** True when bytes carry any res54 framing (v3 magic, canonical v2
    header, or standard single-part v2 framing). */
export function looksEncryptedChunk(bytes: Uint8Array): boolean {
  if (bytes.length < 20) return false;
  if (bytes[0] === 0x52 && bytes[1] === 0x45 && bytes[2] === 0x03) return true; // v3 magic RE\x03
  const hlen = u32le(bytes, 0);
  if (hlen >= 8 && hlen <= 512 && bytes.length > 4 + hlen) {
    try {
      const h = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + hlen)));
      if (h && typeof h.version === 'number' && h.version >= 2 && typeof h.chunks === 'number' && h.chunks > 0 && Array.isArray(h.ivs)) {
        return true; // canonical v2 (web large / CLI / server / decryptor)
      }
    } catch { /* not a JSON header */ }
  }
  if (hlen >= 8 && hlen <= 128 && bytes.length > 4 + hlen + 12) return true; // standard v2 framing
  return false;
}

// One-time per session: ask the storage cluster to (re)apply bucket CORS
// rules, then retry. B2 only serves cross-origin reads when the bucket has
// a matching CORS rule; without it the browser blocks even valid links and
// reports a plain TypeError with no status.
let corsFixPromise: Promise<void> | null = null;
function ensureBucketCorsOnce(): Promise<void> {
  if (!corsFixPromise) {
    corsFixPromise = (async () => {
      try {
        await supabase.functions.invoke('squidcloud-cluster?action=fix-cors', { method: 'GET' } as any);
      } catch { /* best-effort: a failed CORS heal must never break downloads */ }
    })();
  }
  return corsFixPromise;
}

export const downloadChunk = async (chunk: ChunkMetadata, _attempt = 0, shareId?: string): Promise<any> => {
  if (!chunk.repo || !chunk.path) throw new Error(`Invalid chunk metadata for chunk ${chunk.index}`);

  let lastError: Error | null = null;
  for (let attempt = _attempt; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let downloadUrl: string;

      // Custom provider (S3-compatible via s3-storage)
      if (chunk.providerId) {
        const { data, error } = await supabase.functions.invoke('s3-storage', {
          body: { action: 'get-download-url', providerId: chunk.providerId, path: chunk.path }
        });
        if (error || !data?.success) throw new Error(`S3 download error: ${error?.message || data?.error}`);
        downloadUrl = data.downloadUrl;
      }
      // Legacy GitHub repo path
      else if (chunk.repo && chunk.repo !== 'b2' && chunk.repo !== 'supabase') {
        const { data, error } = await supabase.functions.invoke('squidcloud-cluster', {
          body: {
            action: 'download', path: chunk.path, repo: chunk.repo,
            ...(shareId ? { shareId } : { userId: session?.user?.id }),
            nodeId: chunk.accountId ? (chunk.accountId - 1) : undefined
          }
        });
        if (error) throw new Error(`Download error: ${error.message}`);
        const responseData = typeof data === 'string' ? JSON.parse(data) : data;
        if (responseData.legacy) {
          const decodedContent = atob(responseData.content.replace(/\s/g, ''));
          const parsedChunk = JSON.parse(decodedContent);
          if (parsedChunk.v === '2.3') return { index: parsedChunk.i, data: parsedChunk.d };
          return { index: parsedChunk.chunkIndex, data: parsedChunk.chunkData };
        }
        downloadUrl = responseData.downloadUrl;
      }
      // Supabase storage bucket chunks (migration / cloud-import res54 rows)
      else if (chunk.repo === 'supabase') {
        const { data, error } = await supabase.storage.from('files').download(chunk.path);
        if (error || !data) throw new Error(`Supabase storage download error: ${error?.message || 'empty object'}`);
        const arrayBuffer = await data.arrayBuffer();
        return { index: chunk.index, data: arrayBufferToBase64(arrayBuffer) };
      }
      // B2 via squidcloud-cluster
      else {
        const { data, error } = await supabase.functions.invoke('squidcloud-cluster', {
          body: {
            action: 'download', path: chunk.path, repo: chunk.repo,
            clusterId: chunk.clusterId,
            bucket: chunk.bucket,
            ...(shareId ? { shareId } : { userId: session?.user?.id }),
          }
        });
        if (error) throw new Error(`Download error: ${error.message}`);
        const responseData = typeof data === 'string' ? JSON.parse(data) : data;
        downloadUrl = responseData.downloadUrl;
      }

      if (!downloadUrl) throw new Error('No download URL received');

      let b2Response: Response;
      try {
        b2Response = await fetch(downloadUrl);
      } catch (fetchErr: any) {
        // Network-level failure: DNS/TLS/CORS block. The browser hides the
        // real status, so heal bucket CORS once per session, then retry once.
        await ensureBucketCorsOnce();
        b2Response = await fetch(downloadUrl);
      }
      if (b2Response.status === 401 || b2Response.status === 403) {
        // Auth failures never self-heal — fail immediately instead of
        // burning 5 retries (~15s stall) per chunk.
        const authErr: any = new Error(`Storage refused access (HTTP ${b2Response.status}) — the download link is invalid or expired. Please retry; if it persists, re-upload the file.`);
        authErr.nonRetriable = true;
        throw authErr;
      }
      if (!b2Response.ok) throw new Error('Failed to fetch from CDN');
      
      const arrayBuffer = await b2Response.arrayBuffer();
      return { index: chunk.index, data: arrayBufferToBase64(arrayBuffer) };
      
    } catch (error: any) {
      lastError = error;
      if (error?.nonRetriable || attempt >= MAX_RETRIES) break;
      await delay(backoffDelay(attempt));
    }
  }
  
  throw new Error(`Failed to download chunk ${chunk.index}: ${lastError?.message}`);
};

export const downloadFileWithRes54 = async (
  fileId: string,
  progressOrOptions?: Res54ProgressCallback | Res54DownloadOptions | string,
  maybeOptions?: Res54DownloadOptions
): Promise<Blob> => {
  assertFileId(fileId);
  const progressCallback: Res54ProgressCallback | undefined = typeof progressOrOptions === 'function' ? progressOrOptions : undefined;
  const options: Res54DownloadOptions = typeof progressOrOptions === 'function' ? (maybeOptions || {}) : typeof progressOrOptions === 'string' ? { fileName: progressOrOptions } : (progressOrOptions || {});

  progressCallback?.(0, 'initializing');
  const { data: { session } } = await supabase.auth.getSession();
  
  const file = options.fileRecord || await (async () => {
    const { data, error } = await supabase.from('files').select('*').eq('id', fileId).single();
    if (error) {
      if (options.shareId) {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_file_for_share', { share_id_param: options.shareId });
        if (!rpcError && rpcData) return rpcData;
      }
      throw new Error("Failed to fetch file metadata");
    }
    return data;
  })();

  if ((file as any)?.storage_path?.startsWith('tebi_external')) {
    const { downloadFile } = await import('./api');
    return await downloadFile(fileId, progressCallback);
  }

  // Raw object rows (migration / cloud-import / direct storage uploads):
  // no chunk metadata — the object at storage_path IS the file.
  if (isRawStorageRow(file)) {
    progressCallback?.(30, 'downloading');
    const blob = await downloadRawStorageObject(file);
    progressCallback?.(100, 'complete');
    return blob;
  }
  
  progressCallback?.(10, 'preparing');
  let metadata: Res54FileMetadata;
  
  try {
    const parsedMetadata = Array.isArray(file.tags) && file.tags.length > 0 ? JSON.parse(file.tags[0]) : null;
    if (parsedMetadata && parsedMetadata.chunks && Array.isArray(parsedMetadata.chunks)) {
      metadata = parsedMetadata;
    } else if (parsedMetadata && Array.isArray(parsedMetadata)) {
      const chunkLocations = parsedMetadata;
      metadata = {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        chunks: chunkLocations.map((loc: any, index: number) => ({
          index: typeof loc.index === 'number' ? loc.index : index,
          totalChunks: chunkLocations.length,
          size: Math.ceil(file.size / chunkLocations.length),
          offset: index * Math.ceil(file.size / chunkLocations.length),
          sha256: loc.sha || "",
          repo: loc.repo || "",
          path: loc.path || ""
        })),
        encryptionKey: file.encryption_key,
        created: file.created_at,
        previewAvailable: false
      };
    } else {
      throw new Error("Invalid metadata structure");
    }
  } catch (e) {
    throw new Error("Failed to parse chunk locations");
  }
  
  progressCallback?.(20, 'downloading');
  const downloadConcurrency = metadata.fileSize > 500 * 1024 * 1024 ? 6 : metadata.fileSize > 50 * 1024 * 1024 ? 12 : 16;
  
  try {
    const downloadedChunks = await processChunksInParallel(
      metadata.chunks,
      async (chunk, index, attempt) => {
        const result = await downloadChunk(chunk, attempt, options.shareId);
        progressCallback?.(20 + (index / metadata.chunks.length) * 40, 'downloading', { current: index + 1, total: metadata.chunks.length });
        return result;
      },
      downloadConcurrency
    );

    const sortedChunks = downloadedChunks.sort((a, b) => a.index - b.index).map(chunk => chunk.data);
    if (sortedChunks.length !== metadata.chunks.length) throw new Error(`Download incomplete`);

    // E2E v4: chunks are opaque slices of one whole-file ciphertext.
    const v4Meta = (metadata as any).v4 as V4UploadMeta | undefined;
    if (metadata.encryptionKey === V4_KEY_LABEL && v4Meta) {
      const sealedBytes = sortedChunks.map(c => base64ToArrayBuffer(c));
      const total = sealedBytes.reduce((n, b) => n + b.byteLength, 0);
      const joined = new Uint8Array(total);
      let off = 0;
      for (const b of sealedBytes) { const u = new Uint8Array(b); for (let i = 0; i < u.length; i++) joined[off++] = u[i]; }
      const plain = await decryptV4File(joined.buffer, session?.user?.id || '', v4Meta);
      progressCallback?.(100, 'complete');
      return new Blob([plain], { type: v4Meta.originalType || metadata.fileType });
    }

    // Zero-chunk records: a 0-byte file legitimately has no chunks;
    // anything else with an empty chunk list is a broken upload record.
    if (sortedChunks.length === 0) {
      if ((metadata.fileSize || file.size || 0) === 0) {
        progressCallback?.(100, 'complete');
        return new Blob([], { type: metadata.fileType });
      }
      throw new Error('No downloadable chunks found for this file.');
    }

    // Legacy keyless rows (old SquidFS-bridge uploads): chunk locations but
    // no key material. No-BYOK bridge uploads are plaintext — sniff the
    // first chunk and return bytes as-is when no res54 framing is present.
    if (!metadata.encryptionKey) {
      const firstBytes = new Uint8Array(base64ToArrayBuffer(sortedChunks[0]));
      if (!looksEncryptedChunk(firstBytes)) {
        progressCallback?.(90, 'assembling');
        const raw = sortedChunks.map(s => base64ToArrayBuffer(s));
        progressCallback?.(100, 'complete');
        return new Blob(raw, { type: metadata.fileType });
      }
      throw new Error('This file was uploaded by an older client without key material and cannot be decrypted.');
    }

    const byokPolicy = session?.user ? await getBYOKRuntimePolicy(session.user.id) : { enabled: false, strictMode: false, allowDefaultFallback: true, promptEveryDecrypt: false, hasAccountKey: false };
    const downloadReason = options.reason || 'decrypt';
    const promptFileName = options.fileName || metadata.fileName || file.name;
    const attemptedKeys = new Set<string>();

    const isV3 = sortedChunks.length > 0 && detectEncryptionVersion(sortedChunks[0]!) === 3;
    let v3FileKeyForDecrypt: ArrayBuffer | null = null;

    const encKey = metadata.encryptionKey || '';
    let v3FileId = fileId;
    if (encKey.startsWith('v3_byok_')) v3FileId = encKey.replace('v3_byok_', '');
    else if (encKey.startsWith('v3_custom_')) v3FileId = encKey.replace('v3_custom_', '');
    else if (encKey.startsWith('v3_unique_')) v3FileId = encKey.replace('v3_unique_', '');

    if (isV3 && (encKey.startsWith('v3_byok_') || encKey.startsWith('v3_unique_') || encKey.startsWith('v3_custom_'))) {
      v3FileKeyForDecrypt = await resolveV3DecryptKey(encKey, session?.user?.id || '', v3FileId);
    }

    const decryptChunksWithKey = async (decryptionKey: string, strategy: 'byok' | 'default'): Promise<ArrayBuffer[]> => {
      progressCallback?.(60, 'decrypting', { strategy, mode: strategy === 'byok' ? 'BYOK' : 'SquidCloud default' });

      if (isV3) {
        let fileKeyRaw = v3FileKeyForDecrypt;
        if (!fileKeyRaw && strategy === 'byok' && decryptionKey && encKey.startsWith('v3_custom_')) {
          const fileKeyId = encKey.replace('v3_custom_', '');
          const encoder = new TextEncoder();
          const raw = encoder.encode(decryptionKey.padEnd(32)).buffer;
          const fm = await deriveFileKey(raw, fileKeyId);
          fileKeyRaw = fm.fileKeyRaw;
        }
        if (!fileKeyRaw) throw new Error('V3 key not resolved');
        return await decryptAllV3Chunks(sortedChunks, fileKeyRaw, session?.user?.id || '', v3FileId, progressCallback);
      }

      if (metadata.fileSize > LARGE_FILE_THRESHOLD) {
        const decryptedSequentialChunks: ArrayBuffer[] = [];
        for (let i = 0; i < sortedChunks.length; i++) {
          progressCallback?.(60 + ((i + 1) / sortedChunks.length * 30), 'decrypting', { current: i + 1, total: sortedChunks.length });
          decryptedSequentialChunks.push(await decryptData(sortedChunks[i], decryptionKey));
        }
        return decryptedSequentialChunks;
      }

      return processChunksInParallel(
        sortedChunks,
        async (chunkData, index) => {
          const decryptedData = await decryptData(chunkData, decryptionKey);
          progressCallback?.(60 + ((index + 1) / sortedChunks.length * 30), 'decrypting', { current: index + 1, total: sortedChunks.length });
          return decryptedData;
        },
        Math.min(sortedChunks.length, MAX_PARALLEL_OPERATIONS)
      );
    };

    const tryCandidateKey = async (candidateKey: string | null | undefined, strategy: 'byok' | 'default'): Promise<ArrayBuffer[] | null> => {
      if (!candidateKey) return null;
      const normalizedKey = candidateKey.trim();
      if (!normalizedKey || attemptedKeys.has(normalizedKey)) return null;
      attemptedKeys.add(normalizedKey);
      try {
        return await decryptChunksWithKey(normalizedKey, strategy);
      } catch {
        return null;
      }
    };

    const promptBYOKKey = async (retry = false): Promise<string | null> => {
      try {
        const key = await requestEphemeralBYOKKey({
          reason: downloadReason,
          fileName: promptFileName,
          title: retry ? 'Key mismatch, try again' : 'BYOK key required',
          description: retry ? 'The previous key could not decrypt this file. Re-enter your BYOK key.' : 'This file is protected with Bring Your Own Key. Enter the decryption key to unlock it.',
        });
        return key?.trim() || null;
      } catch {
        return null;
      }
    };

    let defaultKey = options.decryptionKey || metadata.encryptionKey;
    // Vault-backed rows resolve here. If the vault has no key for this file
    // (legacy BYOK rows whose tags still claim managed_key, deleted vault
    // entries), fall through to the BYOK prompt instead of failing silently
    // against the literal 'managed_key' string.
    let managedKeyResolved = false;
    if (defaultKey === 'managed_key' && !options.decryptionKey) {
      try {
        const vaultKey = await fetchFileEncryptionKey(fileId);
        if (vaultKey) { defaultKey = vaultKey; managedKeyResolved = true; }
        else console.warn('[res54] managed key vault returned empty for', fileId);
      } catch (keyError) {
        console.warn('[res54] managed key fetch failed', keyError);
      }
    }
    const isExplicitBYOK = defaultKey === 'sha256:byok_encrypted' || defaultKey === 'byok_encrypted' || defaultKey === 'byok_protected'
      || (typeof defaultKey === 'string' && defaultKey.startsWith('sha256:'))
      || !defaultKey
      || (defaultKey === 'managed_key' && !managedKeyResolved);
    let decryptedChunks: ArrayBuffer[] | null = null;

    if (isExplicitBYOK) {
      let byok = await promptBYOKKey(false);
      decryptedChunks = await tryCandidateKey(byok, 'byok');
      if (!decryptedChunks) {
        byok = await promptBYOKKey(true);
        decryptedChunks = await tryCandidateKey(byok, 'byok');
      }
    } else if (byokPolicy.enabled) {
      decryptedChunks = await tryCandidateKey(defaultKey, 'default');
      if (!decryptedChunks) {
        const byok = await promptBYOKKey(false);
        decryptedChunks = await tryCandidateKey(byok, 'byok');
      }
      if (!decryptedChunks) {
        const retryByok = await promptBYOKKey(true);
        decryptedChunks = await tryCandidateKey(retryByok, 'byok');
      }
      if (!decryptedChunks && byokPolicy.strictMode && !byokPolicy.allowDefaultFallback) throw new Error('BYOK strict mode is enabled and no valid BYOK key was provided.');
    } else {
      decryptedChunks = await tryCandidateKey(defaultKey, 'default');
    }

    if (!decryptedChunks) throw new Error('Decryption failed due to key mismatch.');

    progressCallback?.(90, 'assembling');
    const blob = new Blob(decryptedChunks, { type: metadata.fileType });
    progressCallback?.(100, 'complete');
    return blob;
  } catch (error: any) {
    throw new Error(`Download failed: ${error.message}`);
  }
};

export const checkFilePreview = async (fileId: string): Promise<{ hasPreview: boolean, previewType?: string, previewUrl?: string }> => {
  try {
    const { data, error } = await supabase.from('files').select('id, preview_available, preview_type').eq('id', fileId).single();
    if (error || !data) return { hasPreview: false };
    const fileData = data as any;
    const hasPreviewField = 'preview_available' in fileData;
    return {
      hasPreview: hasPreviewField ? !!fileData.preview_available : false,
      previewType: hasPreviewField ? (fileData.preview_type || undefined) : undefined,
      previewUrl: hasPreviewField && fileData.preview_available ? `/api/preview/${fileId}` : undefined
    };
  } catch {
    return { hasPreview: false };
  }
};

export interface FilePreviewResult {
  blob: Blob;
  totalChunks: number;
  downloadedChunks: number;
  isPartial: boolean;
}

export const downloadFilePreview = async (fileId: string, maxChunks: number = 3, options?: { fileRecord?: Record<string, any>; shareId?: string }): Promise<FilePreviewResult> => {
  assertFileId(fileId);
  // ZK files are decrypted at the caller (preview modal / api.smartDownload)
  // through zk-mode; this function returns the stored bytes as-is.

  const file = options?.fileRecord || await (async () => {
    const { data: d, error } = await supabase.from('files').select('*').eq('id', fileId).single();
    if (error) {
      if (options?.shareId) {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_file_for_share', { share_id_param: options.shareId });
        if (!rpcError && rpcData) return rpcData;
      }
      throw new Error('Failed to fetch file metadata');
    }
    return d;
  })();

  if ((file as any)?.storage_path?.startsWith('tebi_external')) {
    const { downloadFile } = await import('./api');
    const blob = await downloadFile(fileId);
    return { blob, totalChunks: 1, downloadedChunks: 1, isPartial: false };
  }

  // Raw object rows (migration / cloud-import / direct storage uploads):
  // no chunk metadata — the object at storage_path IS the file.
  if (isRawStorageRow(file)) {
    const blob = await downloadRawStorageObject(file);
    return { blob, totalChunks: 1, downloadedChunks: 1, isPartial: false };
  }

  let metadata: Res54FileMetadata;
  try {
    const parsedMetadata = Array.isArray(file.tags) && file.tags.length > 0 ? JSON.parse(file.tags[0]) : null;
    if (parsedMetadata && parsedMetadata.chunks) {
      metadata = parsedMetadata;
    } else if (parsedMetadata && Array.isArray(parsedMetadata)) {
      metadata = {
        fileName: file.name, fileType: file.type, fileSize: file.size,
        chunks: parsedMetadata.map((loc: any, index: number) => ({
          index: typeof loc.index === 'number' ? loc.index : index,
          totalChunks: parsedMetadata.length,
          size: Math.ceil(file.size / parsedMetadata.length),
          offset: index * Math.ceil(file.size / parsedMetadata.length),
          sha256: loc.sha || '', repo: loc.repo || '', path: loc.path || '',
        })),
        encryptionKey: file.encryption_key, created: file.created_at, previewAvailable: false,
      };
    } else {
      throw new Error('Invalid metadata structure');
    }
  } catch {
    throw new Error('Failed to parse chunk metadata');
  }

  const isPartial = metadata.chunks.length > maxChunks;
  const targetChunks = isPartial ? metadata.chunks.slice(0, maxChunks) : metadata.chunks;

  const downloaded = await processChunksInParallel(targetChunks, async (chunk, index, attempt) => await downloadChunk(chunk, attempt, options?.shareId), 6);
  const sortedChunks = downloaded.sort((a: any, b: any) => a.index - b.index).map((c: any) => c.data);

  if (!metadata.encryptionKey) throw new Error('No encryption key available for preview');

  let previewKey = metadata.encryptionKey;
  if (previewKey === 'managed_key') {
    try {
      previewKey = await fetchFileEncryptionKey(fileId);
    } catch (keyError) {
      console.warn('[res54] preview managed key fetch failed', keyError);
    }
  }

  const decrypted: ArrayBuffer[] = [];
  for (const chunkData of sortedChunks) decrypted.push(await decryptData(chunkData, previewKey));

  return { blob: new Blob(decrypted, { type: metadata.fileType }), totalChunks: metadata.chunks.length, downloadedChunks: targetChunks.length, isPartial };
};

/** Fetch only the first RES54 chunks needed for a preview and decrypt the
 *  complete v4 frames they contain. No whole-file download or reconstruction. */
export const downloadV4Preview = async (
  fileId: string,
  userId: string,
  maxChunks = 3,
  options?: { fileRecord?: Record<string, any>; shareId?: string },
): Promise<{ blob: Blob; totalChunks: number; downloadedChunks: number; isPartial: boolean }> => {
  assertFileId(fileId);
  const file = options?.fileRecord || (() => supabase.from('files').select('*').eq('id', fileId).single()
    .then(({ data, error }) => {
      if (error) throw error;
      return data as Record<string, any>;
    }))();
  const record = await file;
  let metadata: Res54FileMetadata;
  let v4: V4UploadMeta | undefined;
  try {
    const parsed = Array.isArray(record?.tags) && record.tags.length > 0
      ? JSON.parse(record.tags[0]) : null;
    metadata = parsed as Res54FileMetadata;
    v4 = parsed?.v4 as V4UploadMeta | undefined;
  } catch { throw new Error('Failed to parse chunk metadata'); }
  if (!metadata?.chunks?.length || !v4?.fileId) throw new Error('File has no v4 preview metadata');

  const isPartial = metadata.chunks.length > maxChunks;
  const targets = isPartial ? metadata.chunks.slice(0, maxChunks) : metadata.chunks;
  const downloaded = await processChunksInParallel(
    targets.map((c, index) => ({ ...c, index })),
    async (chunk, index, attempt) => downloadChunk(chunk, attempt, options?.shareId),
    6,
  );
  const sorted = downloaded.sort((a, b) => a.index - b.index);
  const bytes = sorted.map(c => base64ToArrayBuffer(c.data));
  const total = bytes.reduce((n, b) => n + b.byteLength, 0);
  const joined = new Uint8Array(total);
  let off = 0;
  for (const b of bytes) { const u = new Uint8Array(b); for (let i = 0; i < u.length; i++) joined[off++] = u[i]; }

  const plain = await decryptV4Prefix(joined.buffer, userId, v4);
  return {
    blob: new Blob([plain], { type: v4.originalType || metadata.fileType || 'application/octet-stream' }),
    totalChunks: metadata.chunks.length,
    downloadedChunks: targets.length,
    isPartial,
  };
};

export async function resolveFileKeyForShare(fileId: string, encryptionKey: string | null): Promise<string | null> {
  if (!encryptionKey) return null;
  if (encryptionKey === 'managed_key') {
    try {
      return await fetchFileEncryptionKey(fileId);
    } catch (err) {
      console.warn('Could not resolve managed key for share:', err);
      return null;
    }
  }
  if (encryptionKey.startsWith('v3_')) {
    const session = await supabase.auth.getSession();
    const userId = session?.data?.session?.user?.id || '';
    const fileKeyId = encryptionKey.replace(/^v3_(byok|custom|unique)_/, '');
    const keyRaw = await resolveV3DecryptKey(encryptionKey, userId, fileKeyId);
    if (!keyRaw) return null;
    const hash = await crypto.subtle.digest('SHA-256', keyRaw);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  if (encryptionKey === 'sha256:byok_encrypted' || encryptionKey === 'byok_encrypted') return null;
  return encryptionKey;
}



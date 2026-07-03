// Upload Worker - Handles file encryption in background thread
// Supports v2 (AES-GCM with random IV) and v3 (HKDF hierarchy with deterministic IVs)

interface EncryptChunkMessage {
  type: 'encrypt-chunk';
  chunkData: ArrayBuffer;
  encryptionKey: string;
  index: number;
}

interface EncryptChunkV3Message {
  type: 'encrypt-chunk-v3';
  chunkData: ArrayBuffer;
  chunkKey: ArrayBuffer;
  iv: Uint8Array;
  aad: Uint8Array;
  index: number;
}

interface WorkerMessage {
  type: 'encrypt-chunk' | 'encrypt-chunk-v3' | 'init';
  payload?: any;
  chunkData?: ArrayBuffer;
  encryptionKey?: string;
  index?: number;
  chunkKey?: ArrayBuffer;
  iv?: Uint8Array;
  aad?: Uint8Array;
}

interface WorkerResponse {
  type: 'chunk-encrypted' | 'error' | 'ready';
  index?: number;
  data?: ArrayBuffer;
  error?: string;
}

async function encryptData(data: ArrayBuffer, keyString: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyString.slice(0, 32).padEnd(32, '0'));
  const key = await crypto.subtle.importKey(
    'raw', keyData,
    { name: 'AES-GCM', length: 256 },
    false, ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = encoder.encode(`res54-v2-${Date.now()}`);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData },
    key, data
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
const TEXT_ENCODER = new TextEncoder();

async function encryptChunkV3(
  data: ArrayBuffer,
  chunkKeyRaw: ArrayBuffer,
  iv: Uint8Array,
  aad: Uint8Array
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw', chunkKeyRaw,
    { name: 'AES-GCM', length: 256 },
    false, ['encrypt']
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 },
    key, data
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

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type } = event.data;

  try {
    if (type === 'init') {
      const response: WorkerResponse = { type: 'ready' };
      self.postMessage(response);
      return;
    }

    if (type === 'encrypt-chunk') {
      const { chunkData, encryptionKey, index } = event.data;
      if (!chunkData || !encryptionKey || index === undefined) {
        throw new Error('Missing required parameters');
      }
      const encryptedBuffer = await encryptData(chunkData, encryptionKey);
      self.postMessage(
        { type: 'chunk-encrypted', index, data: encryptedBuffer },
        [encryptedBuffer]
      );
      return;
    }

    if (type === 'encrypt-chunk-v3') {
      const { chunkData, chunkKey, iv, aad, index } = event.data as EncryptChunkV3Message;
      if (!chunkData || !chunkKey || !iv || !aad || index === undefined) {
        throw new Error('Missing v3 encryption parameters');
      }
      const encryptedBuffer = await encryptChunkV3(chunkData, chunkKey, iv, aad);
      self.postMessage(
        { type: 'chunk-encrypted', index, data: encryptedBuffer },
        [encryptedBuffer]
      );
      return;
    }
  } catch (error) {
    const errorResponse: WorkerResponse = {
      type: 'error',
      index: event.data.index,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    self.postMessage(errorResponse);
  }
};

export {};

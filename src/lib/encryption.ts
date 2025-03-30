/**
 * File encryption/decryption utilities using AES-256-GCM encryption
 */
import CryptoJS from 'crypto-js';

// Generate a random encryption key
export const generateEncryptionKey = (): string => {
  return CryptoJS.lib.WordArray.random(32).toString();
};

// Encrypt file data with AES-256-GCM and return as ArrayBuffer
export const encryptData = async (data: ArrayBuffer, key: string): Promise<ArrayBuffer> => {
  // Convert key to proper format
  const keyBuffer = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // Generate IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const encryptedContent = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    keyBuffer,
    data
  );

  // Combine IV and encrypted content
  const result = new Uint8Array(iv.length + encryptedContent.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encryptedContent), iv.length);

  return result.buffer;
};

// Decrypt file data from ArrayBuffer
export const decryptData = async (data: ArrayBuffer, key: string): Promise<ArrayBuffer> => {
  // Extract IV
  const iv = data.slice(0, 12);
  const encryptedContent = data.slice(12);

  // Import key
  const keyBuffer = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // Decrypt
  return await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(iv)
    },
    keyBuffer,
    encryptedContent
  );
};

// Convert CryptoJS WordArray to Uint8Array
export const convertWordArrayToUint8Array = (wordArray: CryptoJS.lib.WordArray): Uint8Array => {
  const words = wordArray.words;
  const sigBytes = wordArray.sigBytes;
  const result = new Uint8Array(sigBytes);
  
  let i = 0;
  for (let j = 0; j < sigBytes; j += 4) {
    const byte1 = (words[i] >> 24) & 0xff;
    const byte2 = (words[i] >> 16) & 0xff;
    const byte3 = (words[i] >> 8) & 0xff;
    const byte4 = words[i] & 0xff;
    
    if (j < sigBytes) result[j] = byte1;
    if (j + 1 < sigBytes) result[j + 1] = byte2;
    if (j + 2 < sigBytes) result[j + 2] = byte3;
    if (j + 3 < sigBytes) result[j + 3] = byte4;
    
    i++;
  }
  
  return result;
};

// Split file into chunks and convert to JSON
export const splitFileIntoJsonChunks = async (file: File, chunkSize: number = 500 * 1024): Promise<{
  chunks: string[];
  encryptionKey: string;
  totalChunks: number;
}> => {
  // Read the file
  const fileBuffer = await file.arrayBuffer();
  // Encrypt the file data
  const encryptionKey = generateEncryptionKey();
  const encryptedData = await encryptData(fileBuffer, encryptionKey);
  
  // Calculate the number of chunks
  const totalChunks = Math.ceil(encryptedData.byteLength / chunkSize);
  const chunks: string[] = [];
  
  // Split the encrypted data into chunks
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, encryptedData.byteLength);
    const chunkData = new Uint8Array(encryptedData.slice(start, end));
    
    // Create JSON chunk with metadata
    const jsonChunk = JSON.stringify({
      chunkIndex: i,
      totalChunks: totalChunks,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      chunkData: Array.from(chunkData),
      timestamp: new Date().toISOString(),
    });
    
    chunks.push(jsonChunk);
  }
  
  return {
    chunks,
    encryptionKey,
    totalChunks
  };
};

// Reassemble JSON chunks into original file
export const reassembleJsonChunks = async (chunks: string[], encryptionKey: string): Promise<ArrayBuffer> => {
  if (!chunks.length) {
    throw new Error('No chunks provided for reassembly');
  }
  
  // Parse the chunks and sort by index
  const parsedChunks = chunks.map(chunk => JSON.parse(chunk))
    .sort((a, b) => a.chunkIndex - b.chunkIndex);
  
  // Verify all chunks are present
  const totalChunks = parsedChunks[0].totalChunks;
  if (parsedChunks.length !== totalChunks) {
    throw new Error(`Missing chunks: got ${parsedChunks.length}, expected ${totalChunks}`);
  }
  
  // Concatenate chunk data
  const encryptedData = new Uint8Array(parsedChunks.reduce((acc, chunk) => {
    return acc.concat(chunk.chunkData);
  }, []));
  
  // Decrypt the data
  return await decryptData(encryptedData.buffer, encryptionKey);
};

// Check if file needs chunking based on size
export const needsChunking = (fileSize: number): boolean => {
  return fileSize > 500 * 1024; // 500KB
};

// Generate a random string to serve as a chunk identifier
export const generateChunkId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

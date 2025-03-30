/**
 * File encryption/decryption utilities using AES-256-GCM encryption
 */
import CryptoJS from 'crypto-js';

// Generate a random encryption key
export const generateEncryptionKey = (): string => {
  return CryptoJS.lib.WordArray.random(32).toString();
};

// Encrypt file data with AES-256-GCM and return as base64 string
export const encryptData = async (data: ArrayBuffer, key: string): Promise<string> => {
  try {
    const keyBytes = new TextEncoder().encode(key.slice(0, 32)); // Ensure 32-byte key
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const keyBuffer = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const encryptedContent = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      keyBuffer,
      data
    );

    // Combine IV and encrypted content
    const combined = new Uint8Array(iv.length + encryptedContent.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedContent), iv.length);
    
    return btoa(String.fromCharCode(...new Uint8Array(combined)));
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error(`Encryption failed: ${error.message}`);
  }
};

// Decrypt file data from base64 string
export const decryptData = async (data: string, key: string): Promise<ArrayBuffer> => {
  try {
    const binaryStr = atob(data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const iv = bytes.slice(0, 12);
    const encryptedContent = bytes.slice(12);

    const keyBytes = new TextEncoder().encode(key.slice(0, 32));
    const keyBuffer = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    return await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      keyBuffer,
      encryptedContent
    );
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error(`Decryption failed: ${error.message}`);
  }
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
  const totalChunks = Math.ceil(encryptedData.length / chunkSize);
  const chunks: string[] = [];
  
  // Split the encrypted data into chunks
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, encryptedData.length);
    const chunkData = encryptedData.slice(start, end);
    
    // Create JSON chunk with metadata
    const jsonChunk = JSON.stringify({
      chunkIndex: i,
      totalChunks: totalChunks,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      chunkData: chunkData,
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
  const encryptedData = parsedChunks.reduce((acc, chunk) => {
    return acc + chunk.chunkData;
  }, '');
  
  // Decrypt the data
  return await decryptData(encryptedData, encryptionKey);
};

// Check if file needs chunking based on size
export const needsChunking = (fileSize: number): boolean => {
  return fileSize > 500 * 1024; // 500KB
};

// Generate a random string to serve as a chunk identifier
export const generateChunkId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

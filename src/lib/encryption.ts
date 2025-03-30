/**
 * File encryption/decryption utilities using AES-256-GCM encryption
 */
import CryptoJS from 'crypto-js';

// Generate a random encryption key
export const generateEncryptionKey = (): string => {
  return CryptoJS.lib.WordArray.random(32).toString();
};

// More robust base64 utilities
const base64Utils = {
  encode: (buffer: ArrayBuffer): string => {
    try {
      const uint8Array = new Uint8Array(buffer);
      const bytes = Array.from(uint8Array);
      // Use small chunks to prevent call stack issues
      const binary = bytes.map(byte => String.fromCharCode(byte)).join('');
      return btoa(binary);
    } catch (error) {
      console.error('Base64 encode error:', error);
      throw new Error('Failed to encode data to base64');
    }
  },
  
  decode: (input: string): Uint8Array => {
    try {
      if (!input || typeof input !== 'string') {
        throw new Error('Invalid input: expected base64 string');
      }

      // Clean the input string
      const base64 = input.trim().replace(/[^A-Za-z0-9+/=]/g, '');
      
      try {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
      } catch (e) {
        throw new Error('Failed to decode base64 data: Invalid format');
      }
    } catch (error) {
      console.error('Base64 decode error:', error);
      throw new Error(`Failed to decode base64 data: ${error.message}`);
    }
  }
};

// Add binary utilities
const binaryUtils = {
  arrayBufferToBase64: (buffer: ArrayBuffer): string => {
    return btoa(
      Array.from(new Uint8Array(buffer))
        .map(byte => String.fromCharCode(byte))
        .join('')
    );
  },
  
  base64ToArrayBuffer: (base64: string): ArrayBuffer => {
    const binaryString = atob(base64.trim());
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
};

// Add chunk format validation
const validateChunkFormat = (chunk: any): boolean => {
  return (
    chunk &&
    typeof chunk.chunkData === 'string' &&
    typeof chunk.chunkIndex === 'number' &&
    typeof chunk.totalChunks === 'number'
  );
};

// Encrypt file data with AES-256-GCM and return as base64 string
export const encryptData = async (data: ArrayBuffer, key: string): Promise<string> => {
  try {
    const keyBytes = new TextEncoder().encode(key.slice(0, 32).padEnd(32, '0'));
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
    
    // Use standard base64 encoding
    return btoa(String.fromCharCode.apply(null, Array.from(combined)));
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error(`Encryption failed: ${error.message}`);
  }
};

// Decrypt file data from base64 string
export const decryptData = async (encodedData: string, key: string): Promise<ArrayBuffer> => {
  try {
    // Input validation
    if (!encodedData || typeof encodedData !== 'string') {
      throw new Error('Invalid input: expected base64 string');
    }

    // Clean the base64 string
    const cleanedData = encodedData.trim().replace(/\s/g, '');
    
    // Decode base64
    let binary: string;
    try {
      binary = atob(cleanedData);
    } catch (error) {
      console.error('Base64 decode error:', error);
      throw new Error('Invalid base64 format');
    }

    // Convert to Uint8Array
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Validate length
    if (bytes.length < 12) {
      throw new Error('Invalid data: too short');
    }

    // Extract IV and encrypted content
    const iv = bytes.slice(0, 12);
    const encryptedContent = bytes.slice(12);

    // Import key
    const keyBytes = new TextEncoder().encode(key.slice(0, 32).padEnd(32, '0'));
    const keyBuffer = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    // Decrypt
    try {
      return await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        keyBuffer,
        encryptedContent
      );
    } catch (error) {
      console.error('Decryption operation failed:', error);
      throw new Error('Failed to decrypt: invalid key or corrupted data');
    }
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
    if (!validateChunkFormat(chunk)) {
      throw new Error('Invalid chunk format');
    }
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

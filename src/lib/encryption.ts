
/**
 * File encryption/decryption utilities using AES-256 encryption
 */
import CryptoJS from 'crypto-js';

// Generate a random encryption key
export const generateEncryptionKey = (): string => {
  return CryptoJS.lib.WordArray.random(32).toString();
};

// Encrypt file data with AES-256
export const encryptData = (data: ArrayBuffer, encryptionKey: string): string => {
  const wordArray = CryptoJS.lib.WordArray.create(data);
  return CryptoJS.AES.encrypt(wordArray, encryptionKey).toString();
};

// Decrypt file data
export const decryptData = (encryptedData: string, encryptionKey: string): ArrayBuffer => {
  const decrypted = CryptoJS.AES.decrypt(encryptedData, encryptionKey);
  const typedArray = convertWordArrayToUint8Array(decrypted);
  return typedArray.buffer;
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
    if (j + 2 < sigBytes) result[j + 3] = byte3;
    if (j + 3 < sigBytes) result[j + 3] = byte4;
    
    i++;
  }
  
  return result;
};

// Split file into chunks (for files > 10MB)
export const splitFileIntoChunks = (file: File, chunkSize: number = 10 * 1024 * 1024): Blob[] => {
  const chunks: Blob[] = [];
  let start = 0;
  
  while (start < file.size) {
    const end = Math.min(start + chunkSize, file.size);
    chunks.push(file.slice(start, end));
    start = end;
  }
  
  return chunks;
};

// Check if file needs chunking (> 10MB)
export const needsChunking = (fileSize: number): boolean => {
  return fileSize > 10 * 1024 * 1024; // 10MB
};

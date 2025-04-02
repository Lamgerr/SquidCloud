import { supabase } from "@/integrations/supabase/client";
import { encryptData, decryptData, generateEncryptionKey } from "./encryption";

// Res54 - Advanced file processing system
// Implements parallel uploads/downloads, intelligent chunking, and more

interface ChunkMetadata {
  index: number;
  totalChunks: number;
  size: number;
  offset: number;
  sha256: string;
  repo?: string;
  path?: string;
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

interface FileMetadata {
  name: string;
  type: string;
  size: number;
  storage_path: string;
  user_id: string;
  encrypted: boolean;
  shared: boolean;
  encryption_key: string;
  tags: string[];
  processor?: string; // Adding optional processor property
}

// Add these utility functions at the top
const compressData = (data: string): string => {
  try {
    return btoa(unescape(encodeURIComponent(data)));
  } catch (error) {
    console.error('Compression error:', error);
    throw new Error('Failed to compress data');
  }
};

const decompressData = (data: string): string => {
  try {
    return decodeURIComponent(escape(atob(data)));
  } catch (error) {
    console.error('Decompression error:', error);
    throw new Error('Failed to decompress data');
  }
};

const validateRepoResponse = (response: any): boolean => {
  return response && 
         typeof response === 'object' && 
         !Array.isArray(response) &&
         'repo_name' in response;
};

// Add buffer conversion utilities
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

// Add new utility functions at the top
const processChunkData = {
  encode: (chunk: ArrayBuffer): string => {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(chunk)));
  },
  
  decode: (data: string): ArrayBuffer => {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
};

// Update determineChunkingStrategy for consistent chunk sizes
export const determineChunkingStrategy = (fileSize: number): number => {
  const maxChunkSize = 1 * 1024 * 1024; // 1MB max chunk size for better reliability
  
  if (fileSize < 5 * 1024 * 1024) { // Less than 5MB 
    return Math.min(Math.ceil(fileSize / 3), maxChunkSize);
  } else if (fileSize < 20 * 1024 * 1024) { // Less than 20MB
    return Math.min(Math.ceil(fileSize / 5), maxChunkSize);
  } else {
    return maxChunkSize; // Use 1MB chunks for larger files
  }
};

// Add data validation helper
const validateChunkData = (chunk: ArrayBuffer): boolean => {
  return chunk instanceof ArrayBuffer && chunk.byteLength > 0;
};

// Create file chunks with Res54 system
export const createFileChunks = async (
  file: File, 
  progressCallback?: (progress: number) => void
): Promise<{
  chunks: ArrayBuffer[],
  metadata: Res54FileMetadata
}> => {
  const chunkSize = determineChunkingStrategy(file.size);
  const totalChunks = Math.ceil(file.size / chunkSize);
  const chunks: ArrayBuffer[] = [];
  const chunkMetadata: ChunkMetadata[] = [];
  let offset = 0;
  
  // Generate encryption key once for the entire file
  const encryptionKey = generateEncryptionKey();
  
  while (offset < file.size) {
    const end = Math.min(offset + chunkSize, file.size);
    const chunk = file.slice(offset, end);
    
    // Read chunk as ArrayBuffer with verification
    const chunkBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        if (validateChunkData(buffer)) {
          resolve(buffer);
        } else {
          reject(new Error('Invalid chunk data'));
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(chunk);
    });
    
    chunks.push(chunkBuffer);
    chunkMetadata.push({
      index: chunks.length - 1,
      totalChunks: Math.ceil(file.size / chunkSize),
      size: chunkBuffer.byteLength,
      offset: offset,
      sha256: await calculateSHA256(new Uint8Array(chunkBuffer))
    });
    
    offset += chunkSize;
    
    if (progressCallback) {
      progressCallback((offset / file.size) * 50);
    }
  }
  
  // Create file metadata
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

// Calculate SHA256 hash for chunk integrity verification
async function calculateSHA256(data: Uint8Array): Promise<string> {
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Hash calculation error:', error);
    throw new Error('Failed to calculate hash');
  }
}

// Utility function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Add new helper function for sequential upload
const uploadChunksSequentially = async (
  chunks: { chunk: string; index: number }[],
  uploadChunk: (chunk: string, index: number, attempt: number) => Promise<any>,
  progressCallback?: (progress: number, stage: string, details?: any) => void
): Promise<any[]> => {
  const results = [];
  let failedChunks = [];

  // First attempt - try uploading all chunks
  for (const { chunk, index } of chunks) {
    try {
      await delay(1000); // 1 second delay between chunks
      const result = await uploadChunk(chunk, index, 0);
      results[index] = result;
      
      if (progressCallback) {
        const progress = (results.filter(Boolean).length / chunks.length) * 100;
        progressCallback(progress, 'uploading', { 
          current: results.filter(Boolean).length, 
          total: chunks.length 
        });
      }
    } catch (error) {
      console.warn(`Initial upload failed for chunk ${index}:`, error);
      failedChunks.push({ chunk, index });
    }
  }

  // Retry failed chunks with increasing delays
  let retryAttempt = 1;
  while (failedChunks.length > 0 && retryAttempt <= 3) {
    const retryDelay = Math.min(2000 * Math.pow(2, retryAttempt), 10000);
    console.log(`Retry attempt ${retryAttempt} for ${failedChunks.length} chunks after ${retryDelay}ms`);
    await delay(retryDelay);

    const chunksToRetry = [...failedChunks];
    failedChunks = [];

    for (const { chunk, index } of chunksToRetry) {
      try {
        const result = await uploadChunk(chunk, index, retryAttempt);
        results[index] = result;
        
        if (progressCallback) {
          const progress = (results.filter(Boolean).length / chunks.length) * 100;
          progressCallback(progress, 'uploading', {
            current: results.filter(Boolean).length,
            total: chunks.length,
            retry: retryAttempt
          });
        }
      } catch (error) {
        console.error(`Retry ${retryAttempt} failed for chunk ${index}:`, error);
        failedChunks.push({ chunk, index });
      }
    }
    retryAttempt++;
  }

  if (failedChunks.length > 0) {
    throw new Error(`Failed to upload ${failedChunks.length} chunks after all retry attempts`);
  }

  return results;
};

// Encrypt and upload chunks in parallel using GitHub repos
export const uploadFileWithRes54 = async (
  file: File,
  progressCallback?: (progress: number, stage: string, details?: any) => void
): Promise<{
  id: string,
  metadata: Res54FileMetadata,
  encryptionKey: string
}> => {
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");

  // Check for repos
  const { data: repos } = await supabase
    .from('repositories')
    .select('repo_name')
    .eq('user_id', user.id);

  if (!repos?.length) {
    throw new Error("Please create a Storage Vault before uploading files");
  }

  // Add file size validation
  if (file.size === 0) {
    throw new Error('File is empty');
  }

  // Start upload process
  if (progressCallback) progressCallback(0, 'preparing');

  const { chunks, metadata } = await createFileChunks(file, 
    (progress) => progressCallback && progressCallback(progress, 'chunking'));
  
  // Step 2: Encrypt chunks
  if (progressCallback) progressCallback(50, 'encrypting');
  
  const encryptedChunks: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const encryptedChunk = await encryptData(chunks[i], metadata.encryptionKey);
    encryptedChunks.push(encryptedChunk);
    
    if (progressCallback) {
      progressCallback(50 + (i + 1) / chunks.length * 10, 'encrypting');
    }
  }
  
  // Update uploadChunk function
  const uploadChunk = async (chunk: string, index: number, attempt = 0): Promise<any> => {
    try {
      const repoIndex = index % repos.length;
      const repo = repos[repoIndex].repo_name;
      const chunkId = `res54_${Date.now()}_${index}`;
      const path = `${user.id}/${chunkId}.json`;

      // Store raw chunk data without additional encoding
      const chunkMetadata = {
        version: '2.1', // Add version for backward compatibility
        chunkIndex: index,
        totalChunks: chunks.length,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        chunkData: chunk, // Raw encrypted chunk data
        chunkSize: chunk.length,
        checksum: await calculateSHA256(new TextEncoder().encode(chunk)),
        repo,
        path
      };

      // Upload chunk
      const { data: uploadData, error: uploadError } = await supabase.functions.invoke('github-storage', {
        body: { action: 'upload', fileName: `${chunkId}.json`, fileType: 'application/json',
          data: JSON.stringify(chunkMetadata), userId: user.id, path, repo }
      });

      if (uploadError) throw uploadError;
      if (!uploadData) throw new Error('No upload data received');

      // Update metadata to include storage location
      metadata.chunks[index] = {
        ...metadata.chunks[index],
        repo,
        path
      };

      return { index, repo, path, sha: uploadData?.sha };
    } catch (error) {
      console.error(`Upload error for chunk ${index}:`, error);
      throw error;
    }
  };

  try {
    if (progressCallback) progressCallback(60, 'uploading');
    
    const chunksToUpload = encryptedChunks.map((chunk, index) => ({ chunk, index }));
    const results = await uploadChunksSequentially(
      chunksToUpload,
      uploadChunk,
      (progress, stage, details) => {
        if (progressCallback) {
          progressCallback(60 + (progress * 0.3), stage, details);
        }
      }
    );

    if (!results.every(Boolean)) {
      throw new Error('Some chunks failed to upload');
    }
  } catch (error) {
    console.error("Failed to upload all chunks:", error);
    throw new Error("File upload failed. Please try again later.");
  }
  
  // Step 5: Create file record in database
  if (progressCallback) progressCallback(90, 'finalizing');
  
  // Convert metadata to JSON string for storage
  const metadataString = JSON.stringify({
    ...metadata,
    chunks: metadata.chunks.map(chunk => ({
      ...chunk,
      repo: chunk.repo,
      path: chunk.path
    }))
  });
  
  // Create a record in the files table
  const fileRecord = {
    name: file.name,
    type: file.type,
    size: file.size,
    storage_path: "res54_distributed",
    user_id: user.id,
    encrypted: true,
    shared: false,
    encryption_key: metadata.encryptionKey,
    tags: [metadataString] as string[]
  };

  // Check if the columns in the files table include processor
  const { data: columns, error: columnsError } = await supabase
    .from('files')
    .select('*')
    .limit(1);

  if (columnsError) {
    console.error("Error checking files table:", columnsError);
    throw new Error("Failed to create file record");
  }

  // Conditionally add processor field if it exists in the table schema
  let insertData: any = fileRecord;
  
  if (columns && columns.length > 0) {
    const fileColumns = Object.keys(columns[0]);
    if (fileColumns.includes('processor')) {
      insertData = { ...fileRecord, processor: "res54" };
    }
  }

  const { data: dbFile, error: dbError } = await supabase
    .from('files')
    .insert(insertData)
    .select()
    .single();

  if (dbError) {
    console.error("Error creating file record:", dbError);
    throw new Error("Failed to create file record");
  }
  
  if (progressCallback) progressCallback(100, 'complete');
  
  // Step 6: Generate preview if applicable
  const canPreview = ['image/', 'video/', 'text/', 'application/pdf'].some(type => file.type.startsWith(type));
  if (canPreview) {
    // In a real implementation, this would generate appropriate previews
    // This is simplified for now
    setTimeout(() => generatePreview(dbFile.id, file.type), 100);
  }
  
  // Return file information
  return {
    id: dbFile.id,
    metadata,
    encryptionKey: metadata.encryptionKey
  };
};

// Add this helper function to validate metadata structure
const validateMetadata = (data: any): boolean => {
  return (
    data &&
    Array.isArray(data.chunks) &&
    data.fileName &&
    data.fileType &&
    data.fileSize
  );
};

// Add constants
const MAX_RETRIES = 5;
const CHUNK_VERSION = '2.0';

// Add ChunkFormat interface and validation function
export interface ChunkFormat {
  chunkIndex: number;
  totalChunks: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  chunkData: string;
  checksum?: string;
  version?: string;
  repo?: string;
  path?: string;
}

export const validateChunkFormat = (chunk: any): chunk is ChunkFormat => {
  return (
    chunk &&
    typeof chunk.chunkIndex === 'number' &&
    typeof chunk.totalChunks === 'number' &&
    typeof chunk.fileName === 'string' &&
    typeof chunk.fileType === 'string' &&
    typeof chunk.fileSize === 'number' &&
    typeof chunk.chunkData === 'string'
  );
};

// Update downloadChunk function
const downloadChunk = async (chunk: ChunkMetadata, attempt = 0): Promise<any> => {
  if (!chunk.repo || !chunk.path) {
    throw new Error(`Invalid chunk metadata for chunk ${chunk.index}`);
  }

  try {
    const { data, error } = await supabase.functions.invoke('github-storage', {
      body: { action: 'download', path: chunk.path, repo: chunk.repo }
    });

    if (error) throw error;
    if (!data?.content) throw new Error('No content in response');

    try {
      // Clean and decode GitHub base64 content
      const cleanContent = data.content.replace(/\s/g, '');
      const decodedContent = atob(cleanContent);
      const parsedChunk = JSON.parse(decodedContent);

      if (!validateChunkFormat(parsedChunk)) {
        console.error('Invalid chunk format:', parsedChunk);
        throw new Error('Invalid chunk format - missing required fields');
      }

      return {
        index: parsedChunk.chunkIndex,
        data: parsedChunk.chunkData,
        size: parsedChunk.fileSize,
        version: parsedChunk.version || '1.0'
      };
    } catch (parseError) {
      console.error('Chunk parsing error:', parseError);
      throw new Error(`Failed to parse chunk data: ${parseError.message}`);
    }
  } catch (error: any) {
    if (attempt < MAX_RETRIES) {
      await delay(Math.pow(2, attempt) * 1000);
      return downloadChunk(chunk, attempt + 1);
    }
    throw error;
  }
};

// Update downloadFileWithRes54 function to handle binary data properly
export const downloadFileWithRes54 = async (
  fileId: string,
  progressCallback?: (progress: number, stage: string, details?: any) => void
): Promise<Blob> => {
  if (progressCallback) progressCallback(0, 'initializing');
  
  // Step 1: Get file metadata
  const { data: file, error: fileError } = await supabase
    .from('files')
    .select('*')
    .eq('id', fileId)
    .single();
    
  if (fileError) {
    console.error("Error fetching file metadata:", fileError);
    throw new Error("Failed to fetch file metadata");
  }
  
  // Step 2: Parse metadata
  if (progressCallback) progressCallback(10, 'preparing');
  
  let metadata: Res54FileMetadata;
  try {
    // Parse metadata from tags
    const processorValue = (file as any).processor || "unknown";
    let parsedMetadata;
    
    try {
      // First try to parse the first tag
      parsedMetadata = Array.isArray(file.tags) && file.tags.length > 0 
        ? JSON.parse(file.tags[0])
        : null;
    } catch (e) {
      console.warn("Failed to parse first tag:", e);
      parsedMetadata = null;
    }

    // Validate parsed metadata
    if (parsedMetadata && validateMetadata(parsedMetadata)) {
      metadata = parsedMetadata;
    } else {
      // Legacy format or invalid metadata
      const chunkLocations = Array.isArray(file.tags) && file.tags.length > 0 
        ? (typeof file.tags[0] === 'string' ? JSON.parse(file.tags[0]) : file.tags[0])
        : [];

      if (!Array.isArray(chunkLocations)) {
        console.error("Invalid chunk locations format:", chunkLocations);
        throw new Error("Invalid chunk locations format");
      }
        
      // Convert legacy format to Res54 format
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
    }

    // Final validation of metadata structure
    if (!metadata.chunks || !Array.isArray(metadata.chunks)) {
      throw new Error("Invalid metadata structure");
    }

    // Verify all chunks have required metadata
    for (const chunk of metadata.chunks) {
      if (!chunk.repo || !chunk.path) {
        console.error('Invalid chunk metadata:', chunk);
        throw new Error(`Missing storage location for chunk ${chunk.index}`);
      }
    }

  } catch (e) {
    console.error("Error parsing chunk locations:", e);
    console.debug("File data:", file);
    throw new Error("Failed to parse chunk locations");
  }
  
  // Step 3: Download chunks in parallel
  if (progressCallback) progressCallback(20, 'downloading');
  
  try {
    const downloadedChunks = await Promise.all(
      metadata.chunks.map(async (chunk, index) => {
        const result = await downloadChunk(chunk);
        progressCallback?.(20 + (index / metadata.chunks.length) * 40, 'downloading');
        return result;
      })
    );

    progressCallback?.(60, 'decrypting');
    
    // Sort chunks and validate
    const sortedChunks = downloadedChunks
      .sort((a, b) => a.index - b.index)
      .map(chunk => chunk.data);

    if (sortedChunks.length !== metadata.chunks.length) {
      throw new Error('Chunks missing after download');
    }

    // Decrypt chunks sequentially
    const decryptedChunks = [];
    for (const chunkData of sortedChunks) {
      try {
        const decryptedData = await decryptData(chunkData, metadata.encryptionKey);
        decryptedChunks.push(decryptedData);
      } catch (error) {
        console.error('Chunk decryption failed:', error);
        throw new Error('Failed to decrypt chunk');
      }
    }

    progressCallback?.(90, 'assembling');

    // Create final blob
    const blob = new Blob(decryptedChunks, { type: metadata.fileType });
    
    // Verify size
    if (blob.size !== metadata.fileSize) {
      throw new Error(`Size mismatch: expected ${metadata.fileSize}, got ${blob.size}`);
    }

    progressCallback?.(100, 'complete');
    return blob;
  } catch (error) {
    console.error("Download failed:", error);
    throw new Error(`Download failed: ${error.message}`);
  }
};

// Mock preview generation function - would be more complex in a real implementation
async function generatePreview(fileId: string, fileType: string): Promise<void> {
  // This would generate thumbnails, video transcoding, etc.
  console.log(`Preview generation for ${fileId} of type ${fileType} would happen here`);
  
  // Check if preview_available field exists before updating
  const { data: columns, error: columnsError } = await supabase
    .from('files')
    .select('*')
    .limit(1);

  if (columnsError || columns.length === 0) {
    console.error("Error checking files table columns:", columnsError);
    return;
  }

  // Only update fields that exist in the table
  const updateData: Record<string, any> = {};
  
  if ('preview_available' in columns[0]) {
    updateData.preview_available = true;
  }
  
  if ('preview_type' in columns[0]) {
    updateData.preview_type = fileType.split('/')[0];
  }
  
  if (Object.keys(updateData).length === 0) {
    console.log("No preview fields to update");
    return;
  }

  // Update the file record to indicate preview is available
  try {
    await supabase
      .from('files')
      .update(updateData)
      .eq('id', fileId);
  } catch (error) {
    console.error("Error updating preview info:", error);
    // We'll silently fail here as preview generation is optional
  }
}

// Helper to check if a file has an available preview
export const checkFilePreview = async (fileId: string): Promise<{
  hasPreview: boolean,
  previewType?: string,
  previewUrl?: string
}> => {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('id, preview_available, preview_type')
      .eq('id', fileId)
      .single();
      
    if (error || !data) {
      return { hasPreview: false };
    }
    
    const fileData = data as any;
    const hasPreviewField = 'preview_available' in fileData;
    
    return {
      hasPreview: hasPreviewField ? !!fileData.preview_available : false,
      previewType: hasPreviewField ? (fileData.preview_type || undefined) : undefined,
      previewUrl: hasPreviewField && fileData.preview_available ? `/api/preview/${fileId}` : undefined
    };
  } catch (error) {
    console.error("Error checking file preview:", error);
    return { hasPreview: false };
  }
};

// Update blob creation
const createBlobFromChunks = (chunks: ArrayBuffer[], type: string): Blob => {
  return new Blob(chunks, { type });
};

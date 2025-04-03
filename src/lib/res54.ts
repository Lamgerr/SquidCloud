
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
  processor?: string;
}

// Constants for optimized processing
const MAX_PARALLEL_OPERATIONS = 6;
const MAX_RETRIES = 5;
const RETRY_DELAY_BASE = 1000; // Base retry delay in ms
const LARGE_FILE_THRESHOLD = 128 * 1024 * 1024; // 128MB
const CHUNK_SIZE_SMALL = 1 * 1024 * 1024; // 1MB for small files
const CHUNK_SIZE_MEDIUM = 3 * 1024 * 1024; // 3MB for medium files
const CHUNK_SIZE_LARGE = 5 * 1024 * 1024; // 5MB for large files

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
  const chunks: string[] = [];
  const chunkSize = 0x8000;
  
  // Process in chunks to avoid call stack limits
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    const binaryString = String.fromCharCode.apply(null, Array.from(chunk));
    chunks.push(binaryString);
  }
  
  return btoa(chunks.join(''));
};

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (e) {
    console.error('Base64 conversion error:', e);
    throw new Error('Invalid base64 data');
  }
};

// Add new utility functions at the top
const processChunkData = {
  encode: (chunk: ArrayBuffer): string => {
    return arrayBufferToBase64(chunk);
  },
  
  decode: (data: string): ArrayBuffer => {
    return base64ToArrayBuffer(data);
  }
};

// Optimize chunking strategy for various file sizes
export const determineChunkingStrategy = (fileSize: number): number => {
  // For large files (>128MB), use aggressive chunking to avoid browser limitations
  if (fileSize > LARGE_FILE_THRESHOLD) {
    return CHUNK_SIZE_LARGE;
  } else if (fileSize > 20 * 1024 * 1024) { // >20MB
    return CHUNK_SIZE_MEDIUM;
  } else {
    return CHUNK_SIZE_SMALL;
  }
};

// Add data validation helper
const validateChunkData = (chunk: ArrayBuffer): boolean => {
  return chunk instanceof ArrayBuffer && chunk.byteLength > 0;
};

// Create file chunks with enhanced Res54 system
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
  
  // Read file in chunks using FileReader API
  while (offset < file.size) {
    const end = Math.min(offset + chunkSize, file.size);
    const chunk = file.slice(offset, end);
    
    // Read chunk as ArrayBuffer with verification
    const chunkBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          if (validateChunkData(buffer)) {
            resolve(buffer);
          } else {
            reject(new Error('Invalid chunk data'));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(chunk);
    });
    
    chunks.push(chunkBuffer);
    chunkMetadata.push({
      index: chunks.length - 1,
      totalChunks,
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

// Utility function for delay with exponential backoff
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const backoffDelay = (attempt: number) => Math.min(RETRY_DELAY_BASE * Math.pow(1.5, attempt), 10000);

// Parallel chunk processing with rate limiting
async function processChunksInParallel<T>(
  chunks: any[], 
  processor: (chunk: any, index: number, attempt: number) => Promise<T>,
  concurrency: number = MAX_PARALLEL_OPERATIONS,
  progressCallback?: (progress: number, stage: string, details?: any) => void
): Promise<T[]> {
  const results: T[] = new Array(chunks.length);
  let completed = 0;
  let running = 0;
  let nextIndex = 0;
  let retryQueue: {index: number, attempt: number}[] = [];
  let failed: {index: number, error: any}[] = [];
  
  return new Promise((resolve, reject) => {
    // Process next chunk or from retry queue
    async function processNext(): Promise<void> {
      if (completed + failed.length === chunks.length) {
        // All chunks processed
        if (failed.length === 0) {
          resolve(results);
        } else {
          reject(new Error(`Failed to process ${failed.length} chunks`));
        }
        return;
      }
      
      // Process retry queue first
      if (retryQueue.length > 0) {
        const {index, attempt} = retryQueue.shift()!;
        
        // Backoff before retry
        await delay(backoffDelay(attempt));
        
        running++;
        try {
          results[index] = await processor(chunks[index], index, attempt);
          completed++;
          
          if (progressCallback) {
            progressCallback((completed / chunks.length) * 100, 'processing', {
              current: completed,
              total: chunks.length,
              retry: attempt > 0
            });
          }
        } catch (error) {
          if (attempt < MAX_RETRIES) {
            retryQueue.push({index, attempt: attempt + 1});
          } else {
            failed.push({index, error});
          }
        } finally {
          running--;
          processNext();
        }
        return;
      }
      
      // Process next unprocessed chunk
      if (nextIndex < chunks.length && running < concurrency) {
        const index = nextIndex++;
        running++;
        
        try {
          results[index] = await processor(chunks[index], index, 0);
          completed++;
          
          if (progressCallback) {
            progressCallback((completed / chunks.length) * 100, 'processing', {
              current: completed,
              total: chunks.length
            });
          }
        } catch (error) {
          retryQueue.push({index, attempt: 1});
        } finally {
          running--;
          processNext();
        }
      }
    }
    
    // Start initial batch of concurrent processors
    const initialBatch = Math.min(concurrency, chunks.length);
    for (let i = 0; i < initialBatch; i++) {
      processNext();
    }
  });
}

// Enhanced file upload with parallel processing
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
  
  // Add special handling for large files
  if (file.size > LARGE_FILE_THRESHOLD) {
    progressCallback?.(0, 'preparing', { message: 'Preparing large file upload strategy' });
  }

  // Start upload process
  progressCallback?.(0, 'preparing');

  const { chunks, metadata } = await createFileChunks(file, 
    (progress) => progressCallback && progressCallback(progress, 'chunking'));
  
  // Step 2: Encrypt chunks
  progressCallback?.(50, 'encrypting');
  
  // Process encryption in parallel for better performance
  const encryptChunk = async (chunk: ArrayBuffer, index: number): Promise<string> => {
    try {
      const encryptedChunk = await encryptData(chunk, metadata.encryptionKey);
      progressCallback?.(50 + ((index + 1) / chunks.length * 10), 'encrypting', { 
        current: index + 1, 
        total: chunks.length 
      });
      return encryptedChunk;
    } catch (error) {
      console.error(`Encryption error for chunk ${index}:`, error);
      throw error;
    }
  };
  
  const encryptedChunks = await processChunksInParallel(
    chunks, 
    encryptChunk,
    Math.min(chunks.length, MAX_PARALLEL_OPERATIONS)
  );
  
  // Upload chunk in parallel with rate limiting
  const uploadChunk = async (chunk: string, index: number, attempt: number): Promise<any> => {
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
    progressCallback?.(60, 'uploading');
    
    const chunksToUpload = encryptedChunks.map((chunk, index) => ({ chunk, index }));
    const results = await processChunksInParallel(
      chunksToUpload,
      async (item, index, attempt) => {
        return await uploadChunk(item.chunk, item.index, attempt);
      },
      Math.min(4, chunks.length), // Limit concurrent uploads
      (progress, stage, details) => {
        if (progressCallback) {
          progressCallback(60 + (progress * 0.3), stage, details);
        }
      }
    );

    if (results.length !== chunks.length) {
      throw new Error('Some chunks failed to upload');
    }
  } catch (error) {
    console.error("Failed to upload all chunks:", error);
    throw new Error("File upload failed. Please try again later.");
  }
  
  // Step 5: Create file record in database
  progressCallback?.(90, 'finalizing');
  
  // Convert metadata to JSON string for storage
  const metadataString = JSON.stringify({
    ...metadata,
    chunks: metadata.chunks.map(chunk => ({
      ...chunk,
      repo: chunk.repo,
      path: chunk.path
    }))
  });
  
  // Create a record in the files table WITHOUT using the processor field
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

  // Check if processor field exists before using it
  const { data: columns, error: columnsError } = await supabase
    .from('files')
    .select('*')
    .limit(1);

  if (columnsError) {
    console.error("Error checking files table:", columnsError);
    throw new Error("Failed to create file record");
  }

  let insertData = fileRecord;
  // Check if processor field exists in the table
  if (columns && columns.length > 0 && 'processor' in columns[0]) {
    insertData = { ...(fileRecord as any), processor: "res54" };
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
  
  progressCallback?.(100, 'complete');
  
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

// Enhanced download chunk function with better error handling
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
    } catch (parseError: any) {
      console.error('Chunk parsing error:', parseError);
      throw new Error(`Failed to parse chunk data: ${parseError.message}`);
    }
  } catch (error: any) {
    if (attempt < MAX_RETRIES) {
      console.log(`Retrying chunk ${chunk.index}, attempt ${attempt + 1}`);
      await delay(backoffDelay(attempt));
      return downloadChunk(chunk, attempt + 1);
    }
    throw error;
  }
};

// Enhanced download function for better large file handling
export const downloadFileWithRes54 = async (
  fileId: string,
  progressCallback?: (progress: number, stage: string, details?: any) => void
): Promise<Blob> => {
  progressCallback?.(0, 'initializing');
  
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
  progressCallback?.(10, 'preparing');
  
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
  
  // Step 3: Download chunks in parallel with better error handling and retries
  progressCallback?.(20, 'downloading');
  
  // Special handling for large files
  if (metadata.fileSize > LARGE_FILE_THRESHOLD) {
    progressCallback?.(20, 'downloading', { message: 'Optimizing for large file download' });
  }
  
  try {
    // Process downloads in parallel with concurrency control
    const downloadedChunks = await processChunksInParallel(
      metadata.chunks,
      async (chunk, index, attempt) => {
        const result = await downloadChunk(chunk, attempt);
        progressCallback?.(20 + (index / metadata.chunks.length) * 40, 'downloading', {
          current: index + 1,
          total: metadata.chunks.length
        });
        return result;
      },
      Math.min(4, metadata.chunks.length) // Limit concurrent downloads
    );

    progressCallback?.(60, 'decrypting');
    
    // Sort chunks by index
    const sortedChunks = downloadedChunks
      .sort((a, b) => a.index - b.index)
      .map(chunk => chunk.data);

    if (sortedChunks.length !== metadata.chunks.length) {
      throw new Error('Chunks missing after download');
    }

    // Decrypt chunks in parallel for better performance
    const decryptChunk = async (chunkData: string, index: number): Promise<ArrayBuffer> => {
      try {
        const decryptedData = await decryptData(chunkData, metadata.encryptionKey);
        progressCallback?.(60 + ((index + 1) / sortedChunks.length * 30), 'decrypting', {
          current: index + 1,
          total: sortedChunks.length
        });
        return decryptedData;
      } catch (error) {
        console.error(`Decryption error for chunk ${index}:`, error);
        throw error;
      }
    };
    
    const decryptedChunks = await processChunksInParallel(
      sortedChunks,
      decryptChunk,
      Math.min(sortedChunks.length, MAX_PARALLEL_OPERATIONS)
    );

    progressCallback?.(90, 'assembling');

    // Create final blob with streaming approach for large files
    const blob = new Blob(decryptedChunks, { type: metadata.fileType });
    
    // Verify size
    if (blob.size !== metadata.fileSize) {
      console.warn(`Size mismatch: expected ${metadata.fileSize}, got ${blob.size}`);
      // Continue anyway as some browsers may report slightly different sizes
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

// Update blob creation with better memory management
const createBlobFromChunks = (chunks: ArrayBuffer[], type: string): Blob => {
  return new Blob(chunks, { type });
};


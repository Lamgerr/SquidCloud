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

// Modify the determineChunkingStrategy function to create smaller chunks
export const determineChunkingStrategy = (fileSize: number): number => {
  // Limit maximum chunk size to 2MB to prevent timeouts
  const maxChunkSize = 2 * 1024 * 1024; // 2MB
  
  if (fileSize < 10 * 1024 * 1024) { // Less than 10MB
    return Math.min(Math.ceil(fileSize / 5), maxChunkSize);
  } else if (fileSize < 50 * 1024 * 1024) { // Less than 50MB
    return Math.min(Math.ceil(fileSize / 10), maxChunkSize);
  } else {
    return maxChunkSize; // Use 2MB chunks for larger files
  }
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
  
  // Generate encryption key once for the entire file
  const encryptionKey = generateEncryptionKey();
  
  // Create a FileReader for chunk reading
  const reader = new FileReader();
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(file.size, start + chunkSize);
    const chunk = file.slice(start, end);
    
    // Read chunk as ArrayBuffer
    const chunkBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(chunk);
    });
    
    // Store chunk
    chunks.push(chunkBuffer);
    
    // Create metadata
    chunkMetadata.push({
      index: i,
      totalChunks,
      size: end - start,
      offset: start,
      sha256: await calculateSHA256(chunkBuffer)
    });
    
    // Report progress
    if (progressCallback) {
      progressCallback((i + 1) / totalChunks * 50); // First 50% - chunking
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
async function calculateSHA256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
  // Step 1: Create chunks
  if (progressCallback) progressCallback(0, 'preparing');
  
  const { chunks, metadata } = await createFileChunks(file, 
    (progress) => progressCallback && progressCallback(progress, 'chunking'));
  
  // Step 2: Encrypt chunks
  if (progressCallback) progressCallback(50, 'encrypting');
  
  const encryptedChunks: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const encryptedChunk = encryptData(chunks[i], metadata.encryptionKey);
    encryptedChunks.push(encryptedChunk);
    
    if (progressCallback) {
      progressCallback(50 + (i + 1) / chunks.length * 10, 'encrypting');
    }
  }
  
  // Step 3: Get available repositories
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) throw new Error("User not authenticated");
  
  const { data: reposData, error: reposError } = await supabase
    .from("repositories")
    .select("repo_name")
    .eq("user_id", userData.user.id);
    
  if (reposError || !reposData || reposData.length === 0) {
    throw new Error("No secure vaults available for storage. Please create vaults first.");
  }
  
  // Modify the uploadChunk function inside uploadFileWithRes54
  const uploadChunk = async (chunk: string, index: number, attempt = 0): Promise<any> => {
    try {
      // Validate chunk size
      if (chunk.length > 2 * 1024 * 1024) { // 2MB limit
        throw new Error('Chunk size too large');
      }

      // Select repository with round-robin approach instead of random
      const repoIndex = index % reposData.length;
      const repo = reposData[repoIndex].repo_name;
      
      const chunkId = `res54_${Date.now()}_${index}`;
      const path = `${userData.user.id}/${chunkId}.json`;
      
      // Compress chunk data before sending
      const compressedChunk = btoa(encodeURIComponent(chunk));
      
      const chunkData = JSON.stringify({
        chunkIndex: index,
        totalChunks: chunks.length,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        chunkData: compressedChunk,
        timestamp: new Date().toISOString(),
        checksum: await calculateSHA256(new TextEncoder().encode(chunk))
      });

      // Upload with timeout
      const uploadPromise = supabase.functions.invoke('github-storage', {
        body: {
          action: 'upload',
          fileName: `${chunkId}.json`,
          fileType: 'application/json',
          data: chunkData,
          userId: userData.user.id,
          path: null,
          createRepo: false,
          repo: repo,
          retryCount: attempt
        }
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Upload timeout')), 30000);
      });

      const { data: uploadData, error: uploadError } = await Promise.race([
        uploadPromise,
        timeoutPromise
      ]) as any;

      if (uploadError) throw uploadError;
      if (!uploadData) throw new Error('No upload data received');

      metadata.chunks[index].repo = repo;
      metadata.chunks[index].path = path;
      
      return { index, repo, path, sha: uploadData.sha };
    } catch (error: any) {
      throw new Error(`Failed to upload chunk ${index}: ${error.message}`);
    }
  };

  // Replace the chunk upload section in uploadFileWithRes54
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
  const metadataString = JSON.stringify(metadata);
  
  // Create a record in the files table WITHOUT using the processor field
  const fileRecord = {
    name: file.name,
    type: file.type,
    size: file.size,
    storage_path: "res54_distributed",
    user_id: userData.user.id,
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

// Download file using Res54 system
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
    
    if (processorValue === "res54" && Array.isArray(file.tags) && file.tags.length > 0) {
      metadata = JSON.parse(file.tags[0]);
    } else {
      // Legacy format
      const chunkLocations = Array.isArray(file.tags) && file.tags.length > 0 
        ? JSON.parse(file.tags[0]) 
        : [];
        
      // Convert legacy format to Res54 format
      metadata = {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        chunks: chunkLocations.map((loc: any, index: number) => ({
          index: loc.index || index,
          totalChunks: chunkLocations.length,
          size: Math.ceil(file.size / chunkLocations.length),
          offset: index * Math.ceil(file.size / chunkLocations.length),
          sha256: loc.sha || "",
          repo: loc.repo,
          path: loc.path
        })),
        encryptionKey: file.encryption_key,
        created: file.created_at,
        previewAvailable: false
      };
    }
  } catch (e) {
    console.error("Error parsing chunk locations:", e);
    throw new Error("Failed to parse chunk locations");
  }
  
  // Step 3: Download chunks in parallel
  if (progressCallback) progressCallback(20, 'downloading');
  
  let completedDownloads = 0;
  const maxRetries = 5; // Increased from 3 to 5 for more resilience
  
  const downloadChunk = async (chunk: ChunkMetadata, attempt = 0): Promise<any> => {
    try {
      const { data: chunkData, error: chunkError } = await supabase.functions.invoke('github-storage', {
        body: {
          action: 'download',
          path: chunk.path,
          repo: chunk.repo
        }
      });

      if (chunkError) {
        throw new Error(`Failed to download chunk: ${chunkError.message}`);
      }

      // Update progress
      completedDownloads++;
      if (progressCallback) {
        progressCallback(
          20 + (completedDownloads / metadata.chunks.length * 50), 
          'downloading',
          { current: completedDownloads, total: metadata.chunks.length }
        );
      }
      
      const content = atob(chunkData.content);
      // Parse the JSON to get the encrypted chunk data
      const parsedChunk = JSON.parse(content);
      return { index: chunk.index, data: parsedChunk.chunkData };
    } catch (error: any) {
      console.error(`Error downloading chunk at ${chunk.path} (attempt ${attempt + 1}):`, error);
      
      // Retry logic
      if (attempt < maxRetries) {
        console.log(`Retrying download for chunk ${chunk.index}, attempt ${attempt + 2}...`);
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return downloadChunk(chunk, attempt + 1);
      }
      
      throw error;
    }
  };
  
  try {
    // Download chunks with retry logic
    const downloadPromises = metadata.chunks.map(chunk => downloadChunk(chunk));
    const downloadedChunks = await Promise.all(downloadPromises);
    
    // Step 4: Sort chunks by index and decrypt
    if (progressCallback) progressCallback(70, 'decrypting');
    
    // Sort chunks by index
    const sortedChunks = downloadedChunks.sort((a, b) => a.index - b.index);
    
    // Concatenate encrypted chunks
    let encryptedData = '';
    for (const chunk of sortedChunks) {
      encryptedData += chunk.data;
    }
    
    // Decrypt data
    const decryptedBuffer = decryptData(encryptedData, metadata.encryptionKey);
    
    if (progressCallback) progressCallback(95, 'assembling');
    
    // Create blob from decrypted data
    const blob = new Blob([decryptedBuffer], { type: metadata.fileType });
    
    if (progressCallback) progressCallback(100, 'complete');
    
    return blob;
  } catch (error) {
    console.error("Failed to download file:", error);
    throw new Error("File download failed. Please try again later.");
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

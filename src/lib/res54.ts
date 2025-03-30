
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

// Analyzes file size to determine optimal chunking strategy
export const determineChunkingStrategy = (fileSize: number): number => {
  if (fileSize < 512 * 1024 * 1024) {
    // Less than 512MB - split into 10 parts
    return Math.ceil(fileSize / 10);
  } else if (fileSize < 1024 * 1024 * 1024) {
    // Between 512MB and 1GB - progressive splitting
    const base = 1024 * 1024; // 1MB base size
    const exponent = Math.log2(fileSize / base);
    return Math.ceil(fileSize / (2 ** Math.min(exponent, 8)));
  } else {
    // More than 1GB - adaptive chunking (simplified version)
    const optimalChunkCount = Math.min(100, Math.ceil(fileSize / (10 * 1024 * 1024)));
    return Math.ceil(fileSize / optimalChunkCount);
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
  
  // Step 4: Upload chunks in parallel
  if (progressCallback) progressCallback(60, 'uploading');
  
  let completedUploads = 0;
  const uploadPromises = encryptedChunks.map(async (chunk, index) => {
    // For each chunk, select a random repository
    const randomRepoIndex = Math.floor(Math.random() * reposData.length);
    const repo = reposData[randomRepoIndex].repo_name;
    
    const chunkId = `res54_${Date.now()}_${index}`;
    const path = `${userData.user.id}/${chunkId}.json`;
    
    // Prepare chunk data with metadata for storage
    const chunkData = JSON.stringify({
      chunkIndex: index,
      totalChunks: chunks.length,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      chunkData: chunk,
      timestamp: new Date().toISOString(),
    });
    
    try {
      const { data: uploadData, error: uploadError } = await supabase.functions.invoke('github-storage', {
        body: {
          action: 'upload',
          fileName: `${chunkId}.json`,
          fileType: 'application/json',
          data: chunkData,
          userId: userData.user.id,
          path: null,
          createRepo: false,
          repo: repo
        }
      });

      if (uploadError) throw new Error(`Failed to upload chunk ${index}: ${uploadError.message}`);
      if (!uploadData) throw new Error(`Failed to upload chunk ${index}: No data returned`);
      
      // Update chunk metadata with storage location
      metadata.chunks[index].repo = repo;
      metadata.chunks[index].path = path;
      
      // Update progress
      completedUploads++;
      if (progressCallback) {
        progressCallback(
          60 + (completedUploads / chunks.length * 30), 
          'uploading',
          { current: completedUploads, total: chunks.length }
        );
      }
      
      return { index, repo, path, sha: uploadData.sha };
    } catch (error: any) {
      console.error(`Error uploading chunk ${index}:`, error);
      throw error;
    }
  });
  
  // Wait for all uploads to complete
  await Promise.all(uploadPromises);
  
  // Step 5: Create file record in database
  if (progressCallback) progressCallback(90, 'finalizing');
  
  // Convert metadata to JSON string for storage
  const metadataString = JSON.stringify(metadata);
  
  // Create a record in the files table
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

  // Add processor as a separate field after creating the base record
  const { data: dbFile, error: dbError } = await supabase
    .from('files')
    .insert({
      ...fileRecord,
      processor: "res54" // Add processor field
    } as any)
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
    if ((file as any).processor === "res54" && Array.isArray(file.tags) && file.tags.length > 0) {
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
  const downloadPromises = metadata.chunks.map(async (chunk) => {
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
    } catch (error) {
      console.error(`Error downloading chunk at ${chunk.path}:`, error);
      throw error;
    }
  });
  
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
};

// Mock preview generation function - would be more complex in a real implementation
async function generatePreview(fileId: string, fileType: string): Promise<void> {
  // This would generate thumbnails, video transcoding, etc.
  console.log(`Preview generation for ${fileId} of type ${fileType} would happen here`);
  
  // Instead of updating the database directly, let's use a try-catch block to handle potential errors
  try {
    // Update the file record to indicate preview is available
    await supabase
      .from('files')
      .update({
        preview_available: true,
        preview_type: fileType.split('/')[0]
      } as any)
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
    
    return {
      hasPreview: !!fileData.preview_available,
      previewType: fileData.preview_type || undefined,
      previewUrl: fileData.preview_available ? `/api/preview/${fileId}` : undefined
    };
  } catch (error) {
    console.error("Error checking file preview:", error);
    return { hasPreview: false };
  }
};

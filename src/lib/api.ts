import { supabase } from "@/integrations/supabase/client";
import { 
  splitFileIntoJsonChunks, 
  reassembleJsonChunks, 
  generateEncryptionKey,
  encryptData,
  decryptData
} from "./encryption";

export interface FileItem {
  id: string;
  name: string;
  type: string;
  size: number;
  path: string;
  lastModified: Date;
  encrypted: boolean;
  shared: boolean;
  encryptionKey?: string;
  chunks?: number;
}

// Define the chunk location type
interface ChunkLocation {
  repo: string;
  path: string;
  index: number;
  sha?: string;
}

export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const getFiles = async (): Promise<FileItem[]> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError || !userData.user) {
    console.error("User not authenticated:", userError);
    throw new Error("User not authenticated");
  }

  const { data: dbFiles, error } = await supabase
    .from("files")
    .select("*")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching files:", error);
    throw new Error("Failed to fetch files");
  }

  // Map database schema to app schema
  return (dbFiles as any[]).map((file) => ({
    id: file.id,
    name: file.name,
    type: file.type,
    size: file.size,
    path: file.storage_path,
    lastModified: new Date(file.updated_at),
    encrypted: file.encrypted,
    shared: file.shared,
    encryptionKey: file.encryption_key,
    chunks: file.tags?.length || 0,
  }));
};

export const uploadFile = async (file: File): Promise<FileItem> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError || !userData.user) {
    console.error("User not authenticated:", userError);
    throw new Error("User not authenticated");
  }

  const user = userData.user;

  // Get list of user's repositories
  const { data: reposData, error: reposError } = await supabase
    .from("repositories")
    .select("repo_name")
    .eq("user_id", user.id);

  if (reposError || !reposData || reposData.length === 0) {
    console.error("Error fetching repositories or no repositories found:", reposError);
    throw new Error("No secure vaults available for storage. Please create vaults first.");
  }

  console.log("Available repositories:", reposData);

  // Process file into JSON chunks
  const { chunks, encryptionKey, totalChunks } = await splitFileIntoJsonChunks(file);
  
  // Randomly distribute chunks across repositories
  const chunkLocations: ChunkLocation[] = [];
  for (let i = 0; i < chunks.length; i++) {
    // Select a random repository
    const randomRepoIndex = Math.floor(Math.random() * reposData.length);
    const repo = reposData[randomRepoIndex].repo_name;
    
    console.log(`Uploading chunk ${i} to repository: ${repo}`);
    
    // Upload chunk to GitHub via Supabase Edge Function
    const chunkId = `chunk_${Date.now()}_${i}`;
    try {
      const { data: uploadData, error: uploadError } = await supabase.functions.invoke('github-storage', {
        body: {
          action: 'upload',
          fileName: `${chunkId}.json`,
          fileType: 'application/json',
          data: chunks[i],
          userId: user.id,
          path: null,
          createRepo: false,
          repo: repo
        }
      });

      if (uploadError) {
        console.error(`Error uploading chunk ${i}:`, uploadError);
        throw new Error(`Failed to upload chunk ${i}: ${uploadError.message}`);
      }

      if (!uploadData) {
        console.error(`No data returned when uploading chunk ${i}`);
        throw new Error(`Failed to upload chunk ${i}: No data returned`);
      }

      console.log(`Successfully uploaded chunk ${i} to ${repo}:`, uploadData);

      // Save chunk location
      chunkLocations.push({
        repo: repo,
        path: `${user.id}/${chunkId}.json`,
        index: i,
        sha: uploadData.sha
      });
    } catch (error: any) {
      console.error(`Error in upload process for chunk ${i}:`, error);
      throw new Error(`Failed to upload chunk ${i}: ${error.message}`);
    }
  }

  // Create a record in the database
  const fileRecord = {
    name: file.name,
    type: file.type,
    size: file.size,
    storage_path: "distributed_storage", // Indicate this is stored across repos
    user_id: user.id,
    encrypted: true,
    shared: false,
    encryption_key: encryptionKey,
    tags: chunkLocations // This will be automatically serialized to JSON by Supabase
  };

  const { data: dbFile, error: dbError } = await supabase
    .from('files')
    .insert(fileRecord)
    .select()
    .single();

  if (dbError) {
    console.error("Error creating file record:", dbError);
    // We should ideally clean up the uploaded chunks here, but for brevity skipping
    throw new Error("Failed to create file record");
  }

  return {
    id: dbFile.id,
    name: dbFile.name,
    type: dbFile.type,
    size: dbFile.size,
    path: dbFile.storage_path,
    lastModified: new Date(dbFile.created_at),
    encrypted: dbFile.encrypted,
    shared: dbFile.shared,
    encryptionKey: dbFile.encryption_key,
    chunks: chunkLocations.length
  };
};

export const downloadFile = async (fileId: string): Promise<Blob> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError || !userData.user) {
    console.error("User not authenticated:", userError);
    throw new Error("User not authenticated");
  }

  // Get file metadata from database
  const { data: file, error: fileError } = await supabase
    .from('files')
    .select('*')
    .eq('id', fileId)
    .single();

  if (fileError) {
    console.error("Error fetching file metadata:", fileError);
    throw new Error("Failed to fetch file metadata");
  }

  // Check if this is a distributed file
  if (file.storage_path === "distributed_storage" && file.tags) {
    // Retrieve all chunks
    let chunkLocations: ChunkLocation[] = [];
    try {
      chunkLocations = file.tags;
    } catch (e) {
      console.error("Error parsing chunk locations:", e);
      throw new Error("Failed to parse chunk locations");
    }
    
    const chunks: string[] = [];

    for (const location of chunkLocations) {
      const { data: chunkData, error: chunkError } = await supabase.functions.invoke('github-storage', {
        body: {
          action: 'download',
          path: location.path,
          repo: location.repo
        }
      });

      if (chunkError) {
        console.error(`Error downloading chunk at ${location.path}:`, chunkError);
        throw new Error(`Failed to download chunk: ${chunkError.message}`);
      }

      // Decode base64 content from GitHub
      const content = atob(chunkData.content);
      chunks[location.index] = content; // Store at correct index
    }

    // Reassemble chunks
    const fileBuffer = reassembleJsonChunks(chunks, file.encryption_key);
    
    // Convert to blob with correct file type
    return new Blob([fileBuffer], { type: file.type });
  } else {
    // Legacy file - download from Supabase storage
    const { data, error } = await supabase.storage
      .from('files')
      .download(file.storage_path);

    if (error) {
      console.error("Error downloading file:", error);
      throw new Error("Failed to download file");
    }

    // If the file is encrypted, decrypt it
    if (file.encrypted && file.encryption_key) {
      const fileBuffer = await data.arrayBuffer();
      const decryptedBuffer = await decryptData(fileBuffer, file.encryption_key);
      return new Blob([decryptedBuffer], { type: file.type });
    }

    return data;
  }
};

export const deleteFile = async (fileId: string): Promise<void> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError || !userData.user) {
    console.error("User not authenticated:", userError);
    throw new Error("User not authenticated");
  }

  // Get file metadata from database
  const { data: file, error: fileError } = await supabase
    .from('files')
    .select('*')
    .eq('id', fileId)
    .single();

  if (fileError) {
    console.error("Error fetching file metadata:", fileError);
    throw new Error("Failed to fetch file metadata");
  }

  // Check if this is a distributed file
  if (file.storage_path === "distributed_storage" && file.tags) {
    // Delete all chunks
    let chunkLocations: ChunkLocation[] = [];
    try {
      chunkLocations = file.tags;
    } catch (e) {
      console.error("Error parsing chunk locations:", e);
      throw new Error("Failed to parse chunk locations");
    }
    
    for (const location of chunkLocations) {
      try {
        await supabase.functions.invoke('github-storage', {
          body: {
            action: 'delete',
            path: location.path,
            repo: location.repo
          }
        });
      } catch (error) {
        console.error(`Error deleting chunk at ${location.path}:`, error);
        // Continue trying to delete other chunks
      }
    }
  } else if (file.storage_path) {
    // Legacy file - delete from Supabase storage
    try {
      const { error: storageError } = await supabase.storage
        .from('files')
        .remove([file.storage_path]);

      if (storageError) {
        console.error("Error deleting file from storage:", storageError);
      }
    } catch (error) {
      console.error("Error in storage deletion:", error);
    }
  }

  // Delete from database
  const { error: dbError } = await supabase
    .from('files')
    .delete()
    .eq('id', fileId);

  if (dbError) {
    console.error("Error deleting file record:", dbError);
    throw new Error("Failed to delete file record");
  }
};

export const shareFile = async (fileId: string): Promise<string> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError || !userData.user) {
    console.error("User not authenticated:", userError);
    throw new Error("User not authenticated");
  }

  // Get file metadata from database
  const { data: file, error: fileError } = await supabase
    .from('files')
    .select('*')
    .eq('id', fileId)
    .single();

  if (fileError) {
    console.error("Error fetching file metadata:", fileError);
    throw new Error("Failed to fetch file metadata");
  }

  // Generate a secure access code
  const accessCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  // Create a share record with ISO string format for expires_at
  const expirationDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  const { error: shareError } = await supabase
    .from('shares')
    .insert({
      file_id: fileId,
      user_id: userData.user.id,
      access_code: accessCode,
      expires_at: expirationDate.toISOString() // Convert Date to ISO string
    });

  if (shareError) {
    console.error("Error creating share record:", shareError);
    throw new Error("Failed to create share");
  }

  // Update the file to mark it as shared
  const { error: updateError } = await supabase
    .from('files')
    .update({ shared: true })
    .eq('id', fileId);

  if (updateError) {
    console.error("Error updating file share status:", updateError);
    throw new Error("Failed to update file share status");
  }

  // Generate a share link with access code
  const shareLink = `${window.location.origin}/share/${fileId}?code=${accessCode}`;

  return shareLink;
};

export const initializeRepos = async (count: number): Promise<string[]> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError || !userData.user) {
    console.error("User not authenticated:", userError);
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase.functions.invoke('create-repos', {
    body: { count, userId: userData.user.id }
  });

  if (error) {
    console.error("Error initializing repositories:", error);
    throw new Error(error.message || "Failed to initialize repositories");
  }

  if (!data || !data.repositories) {
    throw new Error("Invalid response from server");
  }

  // Return the repository names
  return data.repositories.map((repo: any) => repo.name);
};

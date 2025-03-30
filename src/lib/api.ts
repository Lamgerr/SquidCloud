import { supabase } from "@/integrations/supabase/client";
import { 
  splitFileIntoJsonChunks, 
  reassembleJsonChunks, 
  generateEncryptionKey,
  encryptData,
  decryptData
} from "./encryption";
import {
  uploadFileWithRes54,
  downloadFileWithRes54
} from "./res54";

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
  processor?: string;
  preview_available?: boolean;
  preview_type?: string;
}

export interface ChunkLocation {
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
    processor: file.processor || "legacy",
    preview_available: file.preview_available,
    preview_type: file.preview_type
  }));
};

export const uploadFile = async (file: File): Promise<FileItem> => {
  // Always use Res54 for uploads
  const result = await uploadFileWithRes54(file, (progress, stage, details) => {
    console.log(`Upload progress: ${progress}% - Stage: ${stage}`, details);
  });
  
  return {
    id: result.id,
    name: file.name,
    type: file.type,
    size: file.size,
    path: "res54_distributed",
    lastModified: new Date(),
    encrypted: true,
    shared: false,
    encryptionKey: result.encryptionKey,
    chunks: result.metadata.chunks.length,
    processor: "res54"
  };
};

export const downloadFile = async (fileId: string): Promise<Blob> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError || !userData.user) {
    console.error("User not authenticated:", userError);
    throw new Error("User not authenticated");
  }

  const { data: file, error: fileError } = await supabase
    .from('files')
    .select('*')
    .eq('id', fileId)
    .single();

  if (fileError) {
    console.error("Error fetching file metadata:", fileError);
    throw new Error("Failed to fetch file metadata");
  }

  // If the file was processed with Res54, use Res54 download
  if (file.processor === "res54" || file.storage_path === "res54_distributed") {
    return downloadFileWithRes54(fileId, (progress, stage, details) => {
      console.log(`Download progress: ${progress}% - Stage: ${stage}`, details);
    });
  }
  
  // Legacy download logic for backward compatibility
  if (file.storage_path === "distributed_storage" && file.tags) {
    let chunkLocations: ChunkLocation[] = [];
    try {
      const tagsJson = Array.isArray(file.tags) && file.tags.length > 0 ? file.tags[0] : '[]';
      chunkLocations = JSON.parse(tagsJson);
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

      const content = atob(chunkData.content);
      chunks[location.index] = content;
    }

    const fileBuffer = reassembleJsonChunks(chunks, file.encryption_key);
    
    return new Blob([fileBuffer], { type: file.type });
  } else {
    const { data, error } = await supabase.storage
      .from('files')
      .download(file.storage_path);

    if (error) {
      console.error("Error downloading file:", error);
      throw new Error("Failed to download file");
    }

    if (file.encrypted && file.encryption_key) {
      const fileBuffer = await data.arrayBuffer();
      const encryptedString = new TextDecoder().decode(new Uint8Array(fileBuffer));
      const decryptedBuffer = decryptData(encryptedString, file.encryption_key);
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

  const { data: file, error: fileError } = await supabase
    .from('files')
    .select('*')
    .eq('id', fileId)
    .single();

  if (fileError) {
    console.error("Error fetching file metadata:", fileError);
    throw new Error("Failed to fetch file metadata");
  }

  if (file.storage_path === "distributed_storage" && file.tags) {
    let chunkLocations: ChunkLocation[] = [];
    try {
      const tagsJson = Array.isArray(file.tags) && file.tags.length > 0 ? file.tags[0] : '[]';
      chunkLocations = JSON.parse(tagsJson);
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
        continue;
      }
    }
  } else if (file.storage_path) {
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

  const { data: file, error: fileError } = await supabase
    .from('files')
    .select('*')
    .eq('id', fileId)
    .single();

  if (fileError) {
    console.error("Error fetching file metadata:", fileError);
    throw new Error("Failed to fetch file metadata");
  }

  const accessCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  const expirationDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const { error: shareError } = await supabase
    .from('shares')
    .insert({
      file_id: fileId,
      user_id: userData.user.id,
      access_code: accessCode,
      expires_at: expirationDate.toISOString()
    });

  if (shareError) {
    console.error("Error creating share record:", shareError);
    throw new Error("Failed to create share");
  }

  const { error: updateError } = await supabase
    .from('files')
    .update({ shared: true })
    .eq('id', fileId);

  if (updateError) {
    console.error("Error updating file share status:", updateError);
    throw new Error("Failed to update file share status");
  }

  const shareLink = `${window.location.origin}/share/${fileId}?code=${accessCode}`;

  return shareLink;
};

export const initializeRepos = async (count: number, password?: string): Promise<string[]> => {
  if (password && password !== '9016') {
    throw new Error("Invalid access password");
  }

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

  const repositories = data.repositories.map((repo: any) => ({
    repo_name: repo.name,
    user_id: userData.user.id
  }));

  const { error: insertError } = await supabase
    .from('repositories')
    .insert(repositories);

  if (insertError) {
    console.error("Error storing repository information:", insertError);
  }

  return data.repositories.map((repo: any) => repo.name);
};

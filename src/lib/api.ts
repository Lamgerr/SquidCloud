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
  }));
};

export const uploadFile = async (file: File): Promise<FileItem> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError || !userData.user) {
    console.error("User not authenticated:", userError);
    throw new Error("User not authenticated");
  }

  const user = userData.user;

  const { data: reposData, error: reposError } = await supabase
    .from("repositories")
    .select("repo_name")
    .eq("user_id", user.id);

  if (reposError || !reposData || reposData.length === 0) {
    console.error("Error fetching repositories or no repositories found:", reposError);
    throw new Error("No secure vaults available for storage. Please create vaults first.");
  }

  console.log("Available repositories:", reposData);

  const { chunks, encryptionKey, totalChunks } = await splitFileIntoJsonChunks(file);
  
  const chunkLocations: ChunkLocation[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const randomRepoIndex = Math.floor(Math.random() * reposData.length);
    const repo = reposData[randomRepoIndex].repo_name;
    
    console.log(`Uploading chunk ${i} to repository: ${repo}`);
    
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

  const fileRecord = {
    name: file.name,
    type: file.type,
    size: file.size,
    storage_path: "distributed_storage",
    user_id: user.id,
    encrypted: true,
    shared: false,
    encryption_key: encryptionKey,
    tags: JSON.stringify(chunkLocations)
  };

  const tagsArray = [JSON.stringify(chunkLocations)];

  const fileRecordWithCorrectTags = {
    ...fileRecord,
    tags: tagsArray
  };

  const { data: dbFile, error: dbError } = await supabase
    .from('files')
    .insert(fileRecordWithCorrectTags)
    .select()
    .single();

  if (dbError) {
    console.error("Error creating file record:", dbError);
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

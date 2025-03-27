
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Update the DbFileItem type to include github_repo
interface DbFileItem {
  id: string;
  name: string;
  type: string;
  size: number;
  storage_path: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  shared: boolean;
  encrypted: boolean;
  encryption_key: string;
  tags: string[];
  github_repo?: string; // Add this field as optional
}

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
  githubRepo?: string | null;
  githubPath?: string | null;
  htmlUrl?: string | null;
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
  const { user } = useAuth();

  if (!user) {
    throw new Error("User not authenticated");
  }

  const { data: dbFiles, error } = await supabase
    .from("files")
    .select("*")
    .eq("user_id", user?.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching files:", error);
    throw new Error("Failed to fetch files");
  }

  // Map database schema to app schema
  return (dbFiles as DbFileItem[]).map((file) => ({
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
    githubRepo: file.github_repo || null,
    githubPath: file.github_repo ? `https://github.com/${file.github_repo}/blob/main/${file.name}` : null,
    htmlUrl: file.github_repo ? `https://github.com/${file.github_repo}/blob/main/${file.name}` : null,
  }));
};

export const uploadFile = async (file: File, createRepo: boolean = false): Promise<FileItem> => {
  const { user } = useAuth();

  if (!user) {
    throw new Error("User not authenticated");
  }

  // Generate a unique file path
  const filePath = `${user.id}/${Date.now()}_${file.name}`;

  // Upload to storage
  const { data, error } = await supabase.storage
    .from('files')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error("Error uploading file:", error);
    throw new Error("Failed to upload file");
  }

  // Create a record in the database
  const fileRecord = {
    name: file.name,
    type: file.type,
    size: file.size,
    storage_path: filePath,
    user_id: user.id,
    encrypted: false, // Set to true if you implement encryption
    shared: false,
    github_repo: createRepo ? `${user.id}/file-${Date.now()}` : null // Add github repo if createRepo is true
  };

  const { data: dbFile, error: dbError } = await supabase
    .from('files')
    .insert(fileRecord)
    .select()
    .single();

  if (dbError) {
    console.error("Error creating file record:", dbError);
    // Clean up the uploaded file
    await supabase.storage.from('files').remove([filePath]);
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
    chunks: 0,
    githubRepo: dbFile.github_repo,
    githubPath: dbFile.github_repo ? `https://github.com/${dbFile.github_repo}/blob/main/${dbFile.name}` : null,
    htmlUrl: dbFile.github_repo ? `https://github.com/${dbFile.github_repo}/blob/main/${dbFile.name}` : null,
  };
};

export const downloadFile = async (fileId: string): Promise<Blob> => {
  const { user } = useAuth();

  if (!user) {
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

  // Adjust the code to handle the github_repo property
  if (file.github_repo) {
    // Handle GitHub download
    const repoPath = file.github_repo;
    const fileName = file.name;
    
    // Fetch from GitHub raw content URL
    const response = await fetch(`https://raw.githubusercontent.com/${repoPath}/main/${fileName}`);
    
    if (!response.ok) {
      throw new Error(`Failed to download from GitHub: ${response.statusText}`);
    }
    
    return await response.blob();
  } else {
    // Download from Supabase storage
    const { data, error } = await supabase.storage
      .from('files')
      .download(file.storage_path);

    if (error) {
      console.error("Error downloading file:", error);
      throw new Error("Failed to download file");
    }

    // If the file is encrypted, decrypt it
    if (file.encrypted && file.encryption_key) {
      // Implement decryption logic here
      // For now, just return the file as is
      return data;
    }

    return data;
  }
};

export const deleteFile = async (fileId: string): Promise<void> => {
  const { user } = useAuth();

  if (!user) {
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

  // Adjust the code to handle the github_repo property
  if (file.github_repo) {
    // For GitHub files, we might just remove the reference in our database
    // since we might not have permission to delete from the actual GitHub repo
    console.log(`Note: File is stored in GitHub repo ${file.github_repo}. Only removing reference.`);
  }

  // Delete from storage if it's not a GitHub file
  if (!file.github_repo) {
    const { error: storageError } = await supabase.storage
      .from('files')
      .remove([file.storage_path]);

    if (storageError) {
      console.error("Error deleting file from storage:", storageError);
      throw new Error("Failed to delete file from storage");
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
  const { user } = useAuth();

  if (!user) {
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

  // Update the file to mark it as shared
  const { error: updateError } = await supabase
    .from('files')
    .update({ shared: true })
    .eq('id', fileId);

  if (updateError) {
    console.error("Error updating file share status:", updateError);
    throw new Error("Failed to update file share status");
  }

  // Generate a share link
  // In a real app, you might want to create a separate table for share links
  // with expiration dates, access controls, etc.
  const shareLink = `${window.location.origin}/share/${fileId}`;

  return shareLink;
};

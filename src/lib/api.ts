import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
    shared: false
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
    chunks: 0
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

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('files')
    .remove([file.storage_path]);

  if (storageError) {
    console.error("Error deleting file from storage:", storageError);
    throw new Error("Failed to delete file from storage");
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

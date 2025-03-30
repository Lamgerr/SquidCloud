import { supabase } from "@/integrations/supabase/client";
import { uploadFileWithRes54, downloadFileWithRes54 } from "./res54";

export interface FileItem {
  id: string;
  name: string;
  type: string;
  size: number;
  created_at: string;
  updated_at: string;
  encrypted: boolean;
  shared: boolean;
  user_id: string;
  storage_path: string;
  tags: string[];
  encryption_key?: string;
  github_repo?: string;
  preview_available?: boolean;
  preview_type?: string;
  processor?: string;
}

export async function getFiles(): Promise<FileItem[]> {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching files:", error);
      throw error;
    }

    return data as FileItem[];
  } catch (error) {
    console.error("Error getting files:", error);
    throw error;
  }
}

export async function getFileById(id: string): Promise<FileItem | null> {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error("Error fetching file by ID:", error);
      return null;
    }

    return data as FileItem;
  } catch (error) {
    console.error("Error getting file by ID:", error);
    return null;
  }
}

export async function uploadFile(file: File, onProgress?: (progress: number, stage: string, details?: any) => void): Promise<FileItem> {
  if (!file) {
    throw new Error("No file provided");
  }
  
  try {
    // Use Res54 technology for optimized chunking, encryption, and uploading
    const { id } = await uploadFileWithRes54(file, onProgress);
    
    // Fetch the created file record with complete details
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error) throw error;
    
    // Add processor info if not present in database response
    const fileItem = data as FileItem;
    if (!fileItem.processor && fileItem.storage_path === "res54_distributed") {
      (fileItem as any).processor = "res54";
    }
    
    return fileItem;
  } catch (error: any) {
    console.error("Error uploading file:", error);
    throw new Error(error.message || "Failed to upload file");
  }
}

export async function downloadFile(fileId: string, onProgress?: (progress: number, stage: string, details?: any) => void): Promise<Blob> {
  try {
    // Use Res54 technology for optimized chunking, encryption, and downloading
    const blob = await downloadFileWithRes54(fileId, onProgress);
    return blob;
  } catch (error: any) {
    console.error("Error downloading file:", error);
    throw new Error(error.message || "Failed to download file");
  }
}

export async function deleteFile(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('files')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Error deleting file:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error deleting file:", error);
    throw error;
  }
}

export async function updateFile(id: string, updates: Partial<FileItem>): Promise<FileItem | null> {
  try {
    const { data, error } = await supabase
      .from('files')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error("Error updating file:", error);
      return null;
    }

    return data as FileItem;
  } catch (error) {
    console.error("Error updating file:", error);
    return null;
  }
}

export async function shareFile(id: string, shared: boolean): Promise<FileItem | null> {
  try {
    const { data, error } = await supabase
      .from('files')
      .update({ shared })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error("Error sharing file:", error);
      return null;
    }

    return data as FileItem;
  } catch (error) {
    console.error("Error sharing file:", error);
    return null;
  }
}

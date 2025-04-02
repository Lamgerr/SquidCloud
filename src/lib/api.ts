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

// Utility function to format bytes to human-readable format
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
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
    if (!fileItem.processor && fileItem.storage_path === "github_distributed") {
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

export async function shareFile(id: string, shared: boolean = true): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('files')
      .update({ shared })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error("Error sharing file:", error);
      throw error;
    }

    // Generate a shareable link
    const shareLink = `${window.location.origin}/share/${id}`;
    return shareLink;
  } catch (error) {
    console.error("Error sharing file:", error);
    throw new Error("Failed to generate share link");
  }
}

// Updated the initializeRepos function to initializeStorageNodes
export async function initializeStorageNodes(count: number, password?: string): Promise<string[]> {
  try {
    const response = await fetch('/api/create-storage-nodes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ count, password }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to create storage nodes';
      
      try {
        // Try to parse as JSON first
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // If not JSON, use the text directly
        errorMessage = errorText || errorMessage;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.nodes || [];
  } catch (error: any) {
    console.error('Error initializing storage nodes:', error);
    throw new Error(error.message || 'Failed to initialize secure storage nodes');
  }
}

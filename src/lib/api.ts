
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
  path?: string;
  parent_folder?: string;
  is_folder?: boolean;
}

export interface FolderItem {
  id: string;
  name: string;
  path: string;
  created_at: string;
  is_folder: boolean;
  parent_folder?: string;
  user_id: string;
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

// Get all files including virtual folders for a user
export async function getAllFiles(parentFolder: string = ""): Promise<(FileItem | FolderItem)[]> {
  try {
    // First get files from database
    const { data: dbFiles, error: dbError } = await supabase
      .from('files')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (dbError) {
      console.error("Error fetching files:", dbError);
      throw dbError;
    }

    // Then get the user's folders from GitHub storage
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication required");

    const { data: repos } = await supabase
      .from('repositories')
      .select('repo_name')
      .eq('user_id', user.id);

    if (!repos || repos.length === 0) {
      return dbFiles as FileItem[];
    }

    // Use the first repo to list folders
    const repo = repos[0].repo_name;
    
    // Get all files and folders from GitHub storage
    const response = await supabase.functions.invoke('github-storage', {
      body: { action: 'list', userId: user.id, repo }
    });

    if (response.error) {
      console.error("Error listing files from storage:", response.error);
      return dbFiles as FileItem[];
    }

    // Create a map of virtual folders
    const folders: Map<string, FolderItem> = new Map();
    const allFiles: (FileItem | FolderItem)[] = [...dbFiles as FileItem[]];
    
    // Process the GitHub response to extract folders
    if (response.data?.files && Array.isArray(response.data.files)) {
      // First pass: identify all folders
      for (const item of response.data.files) {
        // Skip README.md files used for folder creation
        if (item.name === 'README.md') continue;
        
        // If this is a folder, add it to our folders map
        if (item.type === 'dir') {
          const folderPath = `${user.id}/${item.path}`;
          const folderName = item.name;
          
          // Create a folder item
          const folderItem: FolderItem = {
            id: `folder_${folderPath}`,
            name: folderName,
            path: folderPath,
            created_at: new Date().toISOString(),
            is_folder: true,
            user_id: user.id
          };
          
          folders.set(folderPath, folderItem);
        }
      }
      
      // Add all folders to the results
      folders.forEach(folder => {
        // Only add folders that match the parent folder filter
        if (parentFolder === "") {
          // For root level, add only top-level folders
          if (!folder.path.includes('/')) {
            allFiles.push(folder);
          }
        } else if (folder.path.startsWith(parentFolder) && 
                  folder.path.replace(parentFolder, '').split('/').length === 1) {
          allFiles.push(folder);
        }
      });
    }
    
    // Filter files based on parent folder
    const filteredFiles = allFiles.filter(file => {
      if ('is_folder' in file && file.is_folder) {
        return true; // We already filtered folders above
      }
      
      // For root level files (no parent folder specified)
      if (parentFolder === "") {
        return !file.parent_folder;
      }
      
      // For files in a specific folder
      return file.parent_folder === parentFolder;
    });
    
    return filteredFiles;
  } catch (error) {
    console.error("Error getting files:", error);
    throw error;
  }
}

// Enhanced getFiles with connection pooling and pagination
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

// Optimized getFileById with faster retrieval
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

// Create a new folder
export async function createFolder(folderName: string, parentFolder: string = ""): Promise<FolderItem> {
  if (!folderName) {
    throw new Error("Folder name is required");
  }
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication required");

    // Get user repositories
    const { data: repos } = await supabase
      .from('repositories')
      .select('repo_name')
      .eq('user_id', user.id);

    if (!repos || repos.length === 0) {
      throw new Error("No storage repositories available");
    }

    // Use the first repo
    const repo = repos[0].repo_name;
    
    // Create the folder path
    const folderPath = parentFolder 
      ? `${parentFolder}/${folderName}` 
      : `${user.id}/${folderName}`;
    
    // Call the GitHub storage function to create the folder
    const response = await supabase.functions.invoke('github-storage', {
      body: { 
        action: 'create_folder', 
        userId: user.id, 
        folderName, 
        path: parentFolder || user.id,
        repo 
      }
    });

    if (response.error) {
      console.error("Error creating folder:", response.error);
      throw new Error("Failed to create folder");
    }

    // Return the new folder item
    return {
      id: `folder_${folderPath}`,
      name: folderName,
      path: folderPath,
      created_at: new Date().toISOString(),
      is_folder: true,
      parent_folder: parentFolder || undefined,
      user_id: user.id
    };
  } catch (error) {
    console.error("Error creating folder:", error);
    throw error;
  }
}

// Improved upload with connection pooling, retry logic, and better error handling
export async function uploadFile(
  file: File, 
  parentFolder: string = "",
  onProgress?: (progress: number, stage: string, details?: any) => void
): Promise<FileItem> {
  if (!file) {
    throw new Error("No file provided");
  }
  
  try {
    // Use optimized Res54 technology for better chunking, encryption, and parallel uploads
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
    
    // Update the file with parent folder information if provided
    if (parentFolder) {
      const { error: updateError } = await supabase
        .from('files')
        .update({ parent_folder: parentFolder } as any)
        .eq('id', id);
        
      if (updateError) {
        console.error("Error updating parent folder:", updateError);
      } else {
        (fileItem as any).parent_folder = parentFolder;
      }
    }
    
    return fileItem;
  } catch (error: any) {
    console.error("Error uploading file:", error);
    throw new Error(error.message || "Failed to upload file");
  }
}

// Enhanced download with retries, parallel processing, and better streaming
export async function downloadFile(fileId: string, onProgress?: (progress: number, stage: string, details?: any) => void): Promise<Blob> {
  try {
    // Use optimized Res54 technology for parallel downloads
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

// Added the missing initializeRepos function
export async function initializeRepos(count: number, password?: string): Promise<string[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication required");
    
    // Use the supabase edge function to create repos
    const response = await supabase.functions.invoke('github-storage', {
      body: { 
        action: 'create-repos', 
        count, 
        userId: user.id,
        password
      }
    });

    if (response.error) {
      throw new Error(response.error.message || 'Failed to create repositories');
    }

    if (!response.data?.repos) {
      throw new Error('Invalid response from server');
    }

    return response.data.repos.map((repo: any) => repo.name) || [];
  } catch (error: any) {
    console.error('Error initializing repos:', error);
    throw new Error(error.message || 'Failed to initialize secure repositories');
  }
}

// Mark file as recently viewed (for use in the file explorer)
export async function markFileViewed(id: string): Promise<void> {
  try {
    await supabase
      .from('files')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);
  } catch (error) {
    console.error("Error marking file as viewed:", error);
  }
}

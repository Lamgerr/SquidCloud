
import { supabase } from "@/integrations/supabase/client";
import { FileSystemItem, FolderData, FileData, FilesystemItem } from "@/types/file-manager";
import { uploadFile, downloadFile } from "./api";

export async function getFolderContents(folderId: string | null): Promise<FileSystemItem[]> {
  try {
    // Use raw SQL query to access the filesystem table
    const { data: folderItems, error: folderError } = await supabase
      .rpc('get_folder_contents', { parent_id: folderId });

    if (folderError) {
      console.error("Error fetching folder contents:", folderError);
      throw folderError;
    }

    if (!folderItems || folderItems.length === 0) {
      return [];
    }

    // Get file details for items that are files
    const fileIds = folderItems
      .filter(item => item.type === 'file' && item.file_id)
      .map(item => item.file_id)
      .filter(Boolean);

    if (fileIds.length) {
      const { data: fileDetails, error: filesError } = await supabase
        .from('files')
        .select('*')
        .in('id', fileIds);

      if (filesError) throw filesError;

      // Transform data to match our interface
      return folderItems.map(item => {
        const result: FileSystemItem = {
          id: item.id,
          name: item.name,
          type: item.type as 'file' | 'folder',
          parentId: item.parent_id,
          userId: item.user_id,
          created_at: item.created_at,
          updated_at: item.updated_at,
          fileId: item.file_id
        };

        if (item.type === 'file' && item.file_id) {
          const fileDetail = fileDetails?.find(f => f.id === item.file_id);
          if (fileDetail) {
            result.size = fileDetail.size;
            result.fileType = fileDetail.type;
            result.storage_path = fileDetail.storage_path;
            result.encrypted = fileDetail.encrypted;
            result.shared = fileDetail.shared;
            result.preview_available = fileDetail.preview_available;
            result.preview_type = fileDetail.preview_type;
          }
        }
        
        return result;
      });
    }

    // Transform data to match our interface
    return folderItems.map(item => ({
      id: item.id,
      name: item.name,
      type: item.type as 'file' | 'folder',
      parentId: item.parent_id,
      userId: item.user_id,
      created_at: item.created_at,
      updated_at: item.updated_at,
      fileId: item.file_id
    }));
  } catch (error) {
    console.error("Error getting folder contents:", error);
    throw error;
  }
}

export async function getPathToFolder(folderId: string | null): Promise<{id: string, name: string}[]> {
  if (!folderId) return [{ id: 'root', name: 'My Drive' }];

  try {
    const path = [{ id: 'root', name: 'My Drive' }];
    let currentId = folderId;

    while (currentId && currentId !== 'root') {
      // Use a function to get folder details safely
      const { data: folder, error } = await supabase
        .rpc('get_folder_by_id', { folder_id: currentId });

      if (error || !folder || folder.length === 0) break;
      
      path.unshift({ id: folder[0].id, name: folder[0].name });
      currentId = folder[0].parent_id;
    }

    return path;
  } catch (error) {
    console.error("Error getting path to folder:", error);
    return [{ id: 'root', name: 'My Drive' }];
  }
}

export async function createFolder(name: string, parentId: string | null): Promise<FolderData> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const newFolder = {
      name,
      type: 'folder',
      parent_id: parentId,
      user_id: user.id
    };

    const { data, error } = await supabase
      .rpc('create_folder', newFolder);

    if (error) throw error;
    
    if (!data || data.length === 0) {
      throw new Error("Failed to create folder");
    }
    
    // Transform to match our interface
    return {
      id: data[0].id,
      name: data[0].name,
      type: 'folder',
      parentId: data[0].parent_id,
      userId: data[0].user_id,
      created_at: data[0].created_at,
      updated_at: data[0].updated_at
    };
  } catch (error) {
    console.error("Error creating folder:", error);
    throw error;
  }
}

export async function uploadFileToFolder(
  file: File, 
  parentId: string | null,
  onProgress?: (progress: number, stage: string, details?: any) => void
): Promise<FileSystemItem> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // First upload the file using the existing API
    const uploadedFile = await uploadFile(file, onProgress);

    // Then create a filesystem entry pointing to this file
    const fileSystemEntry = {
      name: file.name,
      type: 'file',
      parent_id: parentId,
      user_id: user.id,
      file_id: uploadedFile.id
    };

    const { data, error } = await supabase
      .rpc('create_file_entry', fileSystemEntry);

    if (error) throw error;
    
    if (!data || data.length === 0) {
      throw new Error("Failed to create file entry");
    }

    // Return combined data
    return {
      id: data[0].id,
      name: data[0].name,
      type: 'file',
      parentId: data[0].parent_id,
      userId: data[0].user_id,
      fileId: data[0].file_id,
      created_at: data[0].created_at,
      updated_at: data[0].updated_at,
      size: uploadedFile.size,
      fileType: uploadedFile.type,
      storage_path: uploadedFile.storage_path,
      encrypted: uploadedFile.encrypted,
      shared: uploadedFile.shared,
      preview_available: uploadedFile.preview_available,
      preview_type: uploadedFile.preview_type
    };
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
}

export async function downloadFileById(fileId: string): Promise<Blob> {
  try {
    // First get the file details from the files table
    const { data: file, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (error) throw error;

    // Then download using the existing API
    return await downloadFile(file.id);
  } catch (error) {
    console.error("Error downloading file:", error);
    throw error;
  }
}

export async function deleteItem(itemId: string): Promise<void> {
  try {
    // Use a stored procedure to delete the item safely
    const { data, error } = await supabase
      .rpc('delete_filesystem_item', { item_id: itemId });

    if (error) throw error;
  } catch (error) {
    console.error("Error deleting item:", error);
    throw error;
  }
}

export async function renameItem(itemId: string, newName: string): Promise<FileSystemItem> {
  try {
    const { data, error } = await supabase
      .rpc('rename_filesystem_item', { 
        item_id: itemId, 
        new_name: newName 
      });

    if (error) throw error;
    
    if (!data || data.length === 0) {
      throw new Error("Failed to rename item");
    }

    // Transform to match our interface
    return {
      id: data[0].id,
      name: data[0].name,
      type: data[0].type,
      parentId: data[0].parent_id,
      userId: data[0].user_id,
      fileId: data[0].file_id,
      created_at: data[0].created_at,
      updated_at: data[0].updated_at
    };
  } catch (error) {
    console.error("Error renaming item:", error);
    throw error;
  }
}

export async function moveItem(itemId: string, newParentId: string | null): Promise<FileSystemItem> {
  try {
    const { data, error } = await supabase
      .rpc('move_filesystem_item', { 
        item_id: itemId, 
        new_parent_id: newParentId 
      });

    if (error) throw error;
    
    if (!data || data.length === 0) {
      throw new Error("Failed to move item");
    }

    // Transform to match our interface
    return {
      id: data[0].id,
      name: data[0].name,
      type: data[0].type,
      parentId: data[0].parent_id,
      userId: data[0].user_id,
      fileId: data[0].file_id,
      created_at: data[0].created_at,
      updated_at: data[0].updated_at
    };
  } catch (error) {
    console.error("Error moving item:", error);
    throw error;
  }
}

export async function getStorageStats(): Promise<{ totalSize: number, fileCount: number, folderCount: number }> {
  try {
    // Get user data
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Use a stored procedure to get storage stats
    const { data, error } = await supabase
      .rpc('get_user_storage_stats', { user_id: user.id });

    if (error) throw error;
    
    if (!data) {
      return { totalSize: 0, fileCount: 0, folderCount: 0 };
    }
    
    return {
      totalSize: data.total_size || 0,
      fileCount: data.file_count || 0,
      folderCount: data.folder_count || 0
    };
  } catch (error) {
    console.error("Error getting storage stats:", error);
    return { totalSize: 0, fileCount: 0, folderCount: 0 };
  }
}

// Initialize file system for a new user
export async function initializeFileSystem(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Call RPC function to init the filesystem
    const { error } = await supabase
      .rpc('initialize_file_system', { user_id: user.id });

    if (error) throw error;
  } catch (error) {
    console.error("Error initializing file system:", error);
    throw error;
  }
}

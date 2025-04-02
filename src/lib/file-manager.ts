
import { supabase } from "@/integrations/supabase/client";
import { 
  FileSystemItem, 
  FolderData, 
  FileData, 
  FilesystemItem, 
  convertFilesystemItemToFileSystemItem, 
  convertToFilesystemItem,
  GetFolderContentsResult,
  GetFolderByIdResult,
  CreateFolderResult,
  CreateFileEntryResult,
  GetFilesystemItemResult,
  UserStorageStatsResult,
  RpcResponse,
  // Import the specific RPC function argument types
  GetFolderContentsFunctionArgs,
  GetFolderByIdFunctionArgs,
  CreateFolderFunctionArgs,
  CreateFileEntryFunctionArgs,
  DeleteFilesystemItemFunctionArgs,
  RenameFilesystemItemFunctionArgs,
  MoveFilesystemItemFunctionArgs,
  GetFilesystemItemFunctionArgs,
  GetUserStorageStatsFunctionArgs,
  InitializeFileSystemFunctionArgs
} from "@/types/file-manager";
import { uploadFile, downloadFile } from "./api";

export async function getFolderContents(folderId: string | null): Promise<FileSystemItem[]> {
  try {
    // Use RPC function to get folder contents with correct typing
    const args: GetFolderContentsFunctionArgs = { parent_id: folderId };
    const { data, error } = await supabase
      .rpc('get_folder_contents', args) as RpcResponse<GetFolderContentsResult[]>;

    if (error) {
      console.error("Error fetching folder contents:", error);
      throw error;
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return [];
    }

    // Get file details for items that are files
    const fileIds = data
      .filter(item => item.type === 'file' && item.file_id)
      .map(item => item.file_id)
      .filter(Boolean);

    let fileDetails = [];
    if (fileIds.length) {
      const { data: filesData, error: filesError } = await supabase
        .from('files')
        .select('*')
        .in('id', fileIds);

      if (filesError) throw filesError;
      fileDetails = filesData || [];
    }

    // Transform data to match our interface
    return data.map(item => {
      if (item.type === 'file' && item.file_id) {
        const fileDetail = fileDetails.find((f: any) => f.id === item.file_id);
        return convertFilesystemItemToFileSystemItem(item, fileDetail);
      }
      
      return convertFilesystemItemToFileSystemItem(item);
    });
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
      // Use RPC function to get folder details with correct typing
      const args: GetFolderByIdFunctionArgs = { folder_id: currentId };
      const { data, error } = await supabase
        .rpc('get_folder_by_id', args) as RpcResponse<GetFolderByIdResult[]>;

      if (error || !data || !Array.isArray(data) || data.length === 0) break;
      
      path.unshift({ id: data[0].id, name: data[0].name });
      currentId = data[0].parent_id;
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

    // Use RPC function to create folder with correct typing
    const args: CreateFolderFunctionArgs = {
      name: name,
      parent_id: parentId,
      user_id: user.id
    };
    
    const { data, error } = await supabase
      .rpc('create_folder', args) as RpcResponse<CreateFolderResult[]>;

    if (error) throw error;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error("Failed to create folder");
    }
    
    // Transform response to match our interface
    return {
      id: data[0].id,
      name: data[0].name,
      type: 'folder',
      parentId: data[0].parent_id,
      userId: data[0].user_id,
      created_at: data[0].created_at,
      updated_at: data[0].updated_at
    } as FolderData;
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

    // Use RPC function to create file entry with correct typing
    const args: CreateFileEntryFunctionArgs = {
      name: file.name,
      parent_id: parentId,
      user_id: user.id,
      file_id: uploadedFile.id
    };
    
    const { data, error } = await supabase
      .rpc('create_file_entry', args) as RpcResponse<CreateFileEntryResult[]>;

    if (error) throw error;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
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
      preview_available: uploadedFile.preview_available || false,
      preview_type: uploadedFile.preview_type || null
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
    // Use RPC function to safely delete an item with correct typing
    const args: DeleteFilesystemItemFunctionArgs = { item_id: itemId };
    const { error } = await supabase
      .rpc('delete_filesystem_item', args) as RpcResponse<any>;

    if (error) throw error;
  } catch (error) {
    console.error("Error deleting item:", error);
    throw error;
  }
}

export async function renameItem(itemId: string, newName: string): Promise<FileSystemItem> {
  try {
    // Use RPC function to rename an item with correct typing
    const args: RenameFilesystemItemFunctionArgs = { 
      item_id: itemId, 
      new_name: newName 
    };
    
    const { data, error } = await supabase
      .rpc('rename_filesystem_item', args) as RpcResponse<GetFilesystemItemResult[]>;

    if (error) throw error;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error("Failed to rename item");
    }

    // Transform to match our interface
    return convertFilesystemItemToFileSystemItem(data[0]);
  } catch (error) {
    console.error("Error renaming item:", error);
    throw error;
  }
}

export async function moveItem(itemId: string, newParentId: string | null): Promise<FileSystemItem> {
  try {
    // Use RPC function to move an item with correct typing
    const args: MoveFilesystemItemFunctionArgs = { 
      item_id: itemId, 
      new_parent_id: newParentId 
    };
    
    const { data, error } = await supabase
      .rpc('move_filesystem_item', args) as RpcResponse<GetFilesystemItemResult[]>;

    if (error) throw error;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error("Failed to move item");
    }

    // Transform to match our interface
    return convertFilesystemItemToFileSystemItem(data[0]);
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

    // Use RPC function to get storage stats with correct typing
    const args: GetUserStorageStatsFunctionArgs = { user_id: user.id };
    const { data, error } = await supabase
      .rpc('get_user_storage_stats', args) as RpcResponse<UserStorageStatsResult>;

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

export async function initializeFileSystem(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Call RPC function to initialize the filesystem with correct typing
    const args: InitializeFileSystemFunctionArgs = { user_id: user.id };
    const { error } = await supabase
      .rpc('initialize_file_system', args) as RpcResponse<any>;

    if (error) throw error;
  } catch (error) {
    console.error("Error initializing file system:", error);
    throw error;
  }
}

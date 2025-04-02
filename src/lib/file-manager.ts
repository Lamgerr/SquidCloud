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
    const { data, error } = await supabase
      .rpc('get_folder_contents', { parent_id: folderId } as any) as unknown as RpcResponse<GetFolderContentsResult[]>;

    if (error) {
      console.error("Error fetching folder contents:", error);
      throw error;
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return [];
    }

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
      const { data, error } = await supabase
        .rpc('get_folder_by_id', { folder_id: currentId } as any) as unknown as RpcResponse<GetFolderByIdResult[]>;

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

    const { data, error } = await supabase
      .rpc('create_folder', {
        name: name,
        parent_id: parentId,
        user_id: user.id
      } as any) as unknown as RpcResponse<CreateFolderResult[]>;
    
    if (error) throw error;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error("Failed to create folder");
    }
    
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

    const uploadedFile = await uploadFile(file, onProgress);

    const { data, error } = await supabase
      .rpc('create_file_entry', {
        name: file.name,
        parent_id: parentId,
        user_id: user.id,
        file_id: uploadedFile.id
      } as any) as unknown as RpcResponse<CreateFileEntryResult[]>;
    
    if (error) throw error;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error("Failed to create file entry");
    }

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
    const { data: file, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (error) throw error;

    return await downloadFile(file.id);
  } catch (error) {
    console.error("Error downloading file:", error);
    throw error;
  }
}

export async function deleteItem(itemId: string): Promise<void> {
  try {
    const { error } = await supabase
      .rpc('delete_filesystem_item', { item_id: itemId } as any) as unknown as RpcResponse<any>;

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
      } as any) as unknown as RpcResponse<GetFilesystemItemResult[]>;
    
    if (error) throw error;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error("Failed to rename item");
    }

    return convertFilesystemItemToFileSystemItem(data[0]);
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
      } as any) as unknown as RpcResponse<GetFilesystemItemResult[]>;
    
    if (error) throw error;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error("Failed to move item");
    }

    return convertFilesystemItemToFileSystemItem(data[0]);
  } catch (error) {
    console.error("Error moving item:", error);
    throw error;
  }
}

export async function getStorageStats(): Promise<{ totalSize: number, fileCount: number, folderCount: number }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .rpc('get_user_storage_stats', { user_id: user.id } as any) as unknown as RpcResponse<UserStorageStatsResult>;
    
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

    const { error } = await supabase
      .rpc('initialize_file_system', { user_id: user.id } as any) as unknown as RpcResponse<any>;

    if (error) throw error;
  } catch (error) {
    console.error("Error initializing file system:", error);
    throw error;
  }
}

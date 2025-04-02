
import { supabase } from "@/integrations/supabase/client";
import { FileSystemItem, FileData, FolderData } from "@/types/file-manager";
import { uploadFile, downloadFile } from "./api";

export async function getFolderContents(folderId: string | null): Promise<FileSystemItem[]> {
  try {
    const { data: folderItems, error: folderError } = await supabase
      .from('filesystem')
      .select('*')
      .eq('parentId', folderId || null);

    if (folderError) throw folderError;

    // Get file details for items that are files
    const fileIds = folderItems
      .filter(item => item.type === 'file')
      .map(item => item.fileId)
      .filter(Boolean);

    if (fileIds.length) {
      const { data: fileDetails, error: filesError } = await supabase
        .from('files')
        .select('*')
        .in('id', fileIds);

      if (filesError) throw filesError;

      // Merge file details with filesystem items
      return folderItems.map(item => {
        if (item.type === 'file' && item.fileId) {
          const fileDetail = fileDetails.find(f => f.id === item.fileId);
          if (fileDetail) {
            return {
              ...item,
              size: fileDetail.size,
              fileType: fileDetail.type,
              storage_path: fileDetail.storage_path,
              encrypted: fileDetail.encrypted,
              shared: fileDetail.shared,
              preview_available: fileDetail.preview_available,
              preview_type: fileDetail.preview_type
            };
          }
        }
        return item;
      });
    }

    return folderItems;
  } catch (error) {
    console.error("Error getting folder contents:", error);
    throw error;
  }
}

export async function getPathToFolder(folderId: string | null): Promise<{id: string, name: string}[]> {
  if (!folderId) return [{ id: 'root', name: 'My Drive' }];

  const path = [{ id: 'root', name: 'My Drive' }];
  let currentId = folderId;

  while (currentId && currentId !== 'root') {
    const { data: folder, error } = await supabase
      .from('filesystem')
      .select('id, name, parentId')
      .eq('id', currentId)
      .single();

    if (error || !folder) break;
    path.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parentId;
  }

  return path;
}

export async function createFolder(name: string, parentId: string | null): Promise<FolderData> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const newFolder = {
    name,
    type: 'folder' as const,
    parentId,
    userId: user.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('filesystem')
    .insert(newFolder)
    .select()
    .single();

  if (error) throw error;
  return data;
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
      type: 'file' as const,
      parentId,
      userId: user.id,
      fileId: uploadedFile.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: fsItem, error } = await supabase
      .from('filesystem')
      .insert(fileSystemEntry)
      .select()
      .single();

    if (error) throw error;

    // Return combined data
    return {
      ...fsItem,
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
    // First check if it's a folder
    const { data: item, error: fetchError } = await supabase
      .from('filesystem')
      .select('*')
      .eq('id', itemId)
      .single();

    if (fetchError) throw fetchError;

    if (item.type === 'folder') {
      // Recursively delete all contents
      const { data: children, error: childrenError } = await supabase
        .from('filesystem')
        .select('*')
        .eq('parentId', itemId);

      if (childrenError) throw childrenError;

      // Delete all children recursively
      for (const child of children) {
        await deleteItem(child.id);
      }
    } else if (item.type === 'file' && item.fileId) {
      // Delete the actual file
      const { error: deleteFileError } = await supabase
        .from('files')
        .delete()
        .eq('id', item.fileId);

      if (deleteFileError) throw deleteFileError;
    }

    // Delete the filesystem entry
    const { error: deleteError } = await supabase
      .from('filesystem')
      .delete()
      .eq('id', itemId);

    if (deleteError) throw deleteError;
  } catch (error) {
    console.error("Error deleting item:", error);
    throw error;
  }
}

export async function renameItem(itemId: string, newName: string): Promise<FileSystemItem> {
  try {
    const { data, error } = await supabase
      .from('filesystem')
      .update({ name: newName, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error renaming item:", error);
    throw error;
  }
}

export async function moveItem(itemId: string, newParentId: string | null): Promise<FileSystemItem> {
  try {
    const { data, error } = await supabase
      .from('filesystem')
      .update({ parentId: newParentId, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;
    return data;
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

    // Get file stats
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('size')
      .eq('user_id', user.id);

    if (filesError) throw filesError;

    // Get folder stats
    const { data: folders, error: foldersError } = await supabase
      .from('filesystem')
      .select('id')
      .eq('userId', user.id)
      .eq('type', 'folder');

    if (foldersError) throw foldersError;

    // Calculate total size
    const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);

    return {
      totalSize,
      fileCount: files.length,
      folderCount: folders.length
    };
  } catch (error) {
    console.error("Error getting storage stats:", error);
    throw error;
  }
}

// Initialize file system for a new user
export async function initializeFileSystem(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Check if root exists
    const { data: existing, error: checkError } = await supabase
      .from('filesystem')
      .select('id')
      .eq('userId', user.id)
      .eq('parentId', null)
      .eq('type', 'folder');

    if (checkError) throw checkError;

    // If no root folder exists, create default folders
    if (!existing || existing.length === 0) {
      // Create default folders
      const folders = [
        { name: 'My Files', type: 'folder', parentId: null },
        { name: 'Shared with me', type: 'folder', parentId: null },
        { name: 'Documents', type: 'folder', parentId: null },
        { name: 'Media', type: 'folder', parentId: null }
      ];

      for (const folder of folders) {
        await createFolder(folder.name, folder.parentId);
      }
    }
  } catch (error) {
    console.error("Error initializing file system:", error);
    throw error;
  }
}

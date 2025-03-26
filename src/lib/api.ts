
// InflateStorage API with GitHub storage backend integration

import { supabase } from '@/integrations/supabase/client';
import { encryptData, decryptData, generateEncryptionKey, needsChunking, splitFileIntoChunks } from '@/lib/encryption';

const STORAGE_KEY = 'inflate_storage_auth';

// User types
export interface User {
  id: string;
  email: string;
  name: string;
  storage: {
    used: number;
    total: number; // In bytes, but will show as unlimited
  };
}

// File types
export interface FileItem {
  id: string;
  name: string;
  type: string;
  size: number;
  lastModified: Date;
  path: string;
  encrypted: boolean;
  shared: boolean;
  thumbnail?: string;
  chunks?: number;
  encryptionKey?: string;
  githubRepo?: string;
  githubPath?: string;
}

// Folder types
export interface Folder {
  id: string;
  name: string;
  path: string;
  files: FileItem[];
  folders: Folder[];
}

// Mock user data
const mockUser: User = {
  id: '1',
  email: 'user@example.com',
  name: 'User',
  storage: {
    used: 2.5 * 1024 * 1024 * 1024, // 2.5 GB
    total: Number.MAX_SAFE_INTEGER, // Display as unlimited
  },
};

// Authentication functions
export const login = async (email: string, password: string): Promise<User> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  if (email && password) {
    // In a real app, we would validate credentials with a server
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockUser));
    return mockUser;
  }
  
  throw new Error('Invalid credentials');
};

export const register = async (email: string, password: string, name: string): Promise<User> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (email && password && name) {
    const newUser = { ...mockUser, email, name };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    return newUser;
  }
  
  throw new Error('Invalid registration data');
};

export const logout = async (): Promise<void> => {
  localStorage.removeItem(STORAGE_KEY);
};

export const getCurrentUser = (): User | null => {
  const userData = localStorage.getItem(STORAGE_KEY);
  return userData ? JSON.parse(userData) : null;
};

// File operations with GitHub backend
export const getFiles = async (): Promise<FileItem[]> => {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching files:', error);
    return [];
  }
};

// Upload file to GitHub-backed storage
export const uploadFile = async (file: File): Promise<FileItem> => {
  try {
    // Generate a unique encryption key for this file
    const encryptionKey = generateEncryptionKey();
    
    // Check if file needs chunking (> 10MB)
    const isLargeFile = needsChunking(file.size);
    let chunks = 1;
    let uploadedPaths: string[] = [];
    
    // Create a unique file ID
    const fileId = crypto.randomUUID();
    const userId = getCurrentUser()?.id || 'anonymous';
    
    // For large files, we split and upload chunks in parallel
    if (isLargeFile) {
      const fileChunks = splitFileIntoChunks(file);
      chunks = fileChunks.length;
      
      // Process all chunks in parallel
      const chunkPromises = fileChunks.map(async (chunk, index) => {
        const chunkData = await chunk.arrayBuffer();
        const encryptedData = encryptData(chunkData, encryptionKey);
        
        // Upload to GitHub via Supabase Edge Function
        const { data, error } = await supabase.functions.invoke('github-storage', {
          body: {
            action: 'upload',
            fileName: `${fileId}_chunk_${index}`,
            fileType: file.type,
            data: encryptedData,
            userId: userId
          }
        });
        
        if (error) throw error;
        return data.path;
      });
      
      uploadedPaths = await Promise.all(chunkPromises);
    } else {
      // For small files, we encrypt and upload in one go
      const fileData = await file.arrayBuffer();
      const encryptedData = encryptData(fileData, encryptionKey);
      
      // Upload to GitHub via Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('github-storage', {
        body: {
          action: 'upload',
          fileName: fileId,
          fileType: file.type,
          data: encryptedData,
          userId: userId
        }
      });
      
      if (error) throw error;
      uploadedPaths = [data.path];
    }
    
    // Create the file record in our database
    const newFile = {
      id: fileId,
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: new Date(),
      path: `/${userId}/`,
      encrypted: true,
      shared: false,
      chunks: isLargeFile ? chunks : undefined,
      encryptionKey: encryptionKey,
      githubPath: uploadedPaths.join(',')
    };
    
    // Save file metadata to Supabase
    const { error } = await supabase
      .from('files')
      .insert([newFile]);
    
    if (error) throw error;
    
    return newFile;
  } catch (error) {
    console.error('Upload error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

// Download file from GitHub-backed storage
export const downloadFile = async (fileId: string): Promise<Blob> => {
  try {
    // Get file metadata from database
    const { data: fileData, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();
    
    if (fileError) throw fileError;
    if (!fileData) throw new Error('File not found');
    
    const { githubPath, encryptionKey, chunks, type } = fileData;
    
    if (!githubPath || !encryptionKey) {
      throw new Error('Missing file storage information');
    }
    
    // For multi-chunk files
    if (chunks && chunks > 1) {
      const paths = githubPath.split(',');
      if (paths.length !== chunks) {
        throw new Error('Chunk count mismatch');
      }
      
      // Download all chunks in parallel
      const chunkPromises = paths.map(async (path) => {
        // Download from GitHub via Supabase Edge Function
        const { data, error } = await supabase.functions.invoke('github-storage', {
          body: {
            action: 'download',
            path: path
          }
        });
        
        if (error) throw error;
        
        // Decrypt the chunk
        const decryptedData = decryptData(data.content, encryptionKey);
        return decryptedData;
      });
      
      // Combine all chunks into one array buffer
      const chunkBuffers = await Promise.all(chunkPromises);
      const totalLength = chunkBuffers.reduce((acc, curr) => acc + curr.byteLength, 0);
      const combinedBuffer = new Uint8Array(totalLength);
      
      let offset = 0;
      for (const buffer of chunkBuffers) {
        combinedBuffer.set(new Uint8Array(buffer), offset);
        offset += buffer.byteLength;
      }
      
      return new Blob([combinedBuffer], { type });
    } else {
      // For single-file downloads
      // Download from GitHub via Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('github-storage', {
        body: {
          action: 'download',
          path: githubPath
        }
      });
      
      if (error) throw error;
      
      // Decrypt the file
      const decryptedData = decryptData(data.content, encryptionKey);
      return new Blob([decryptedData], { type });
    }
  } catch (error) {
    console.error('Download error:', error);
    throw new Error(`Failed to download file: ${error.message}`);
  }
};

export const deleteFile = async (fileId: string): Promise<boolean> => {
  try {
    // Get file metadata from database
    const { data: fileData, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();
    
    if (fileError) throw fileError;
    if (!fileData) throw new Error('File not found');
    
    const { githubPath } = fileData;
    
    if (githubPath) {
      // Delete all chunks/paths
      const paths = githubPath.split(',');
      
      // Delete from GitHub via Supabase Edge Function
      await Promise.all(paths.map(path => 
        supabase.functions.invoke('github-storage', {
          body: {
            action: 'delete',
            path: path
          }
        })
      ));
    }
    
    // Delete file metadata from database
    const { error } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId);
    
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error('Delete error:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

export const shareFile = async (fileId: string): Promise<string> => {
  try {
    // Update file to mark as shared
    const { error } = await supabase
      .from('files')
      .update({ shared: true })
      .eq('id', fileId);
    
    if (error) throw error;
    
    // Generate a share link
    return `${window.location.origin}/share/${fileId}`;
  } catch (error) {
    console.error('Share error:', error);
    throw new Error(`Failed to share file: ${error.message}`);
  }
};

export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

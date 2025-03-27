
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

// File types for the frontend
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
  githubPath?: string;
  githubRepo?: string;
  previewUrl?: string;
  htmlUrl?: string;
}

// Database file type (matches Supabase schema)
export interface DbFileItem {
  id: string;
  name: string;
  type: string;
  size: number;
  created_at: string;
  updated_at: string;
  user_id: string;
  storage_path: string;
  encrypted: boolean;
  encryption_key: string | null;
  shared: boolean;
  tags: string[] | null;
  github_repo?: string;
  preview_url?: string;
  html_url?: string;
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
    
    // Map database schema to our frontend FileItem interface
    return (data || []).map((dbFile: DbFileItem) => ({
      id: dbFile.id,
      name: dbFile.name,
      type: dbFile.type,
      size: dbFile.size,
      lastModified: new Date(dbFile.updated_at || dbFile.created_at),
      path: dbFile.storage_path,
      encrypted: dbFile.encrypted,
      shared: dbFile.shared,
      encryptionKey: dbFile.encryption_key || undefined,
      chunks: dbFile.tags?.includes('chunked') ? parseInt(dbFile.tags.find(tag => tag.startsWith('chunks:'))?.split(':')[1] || '1') : undefined,
      githubPath: dbFile.storage_path,
      githubRepo: dbFile.github_repo,
      previewUrl: dbFile.preview_url,
      htmlUrl: dbFile.html_url
    }));
  } catch (error) {
    console.error('Error fetching files:', error);
    return [];
  }
};

// Upload file to GitHub-backed storage
export const uploadFile = async (file: File, createRepo: boolean = true): Promise<FileItem> => {
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
            userId: userId,
            createRepo: createRepo
          }
        });
        
        if (error) throw error;
        return data;
      });
      
      const responses = await Promise.all(chunkPromises);
      uploadedPaths = responses.map(res => res.path);
      // Store the GitHub repo from the first response
      const githubRepo = responses[0]?.repo;
      const htmlUrl = responses[0]?.html_url;
      
      // Prepare tags array
      const tags: string[] = [];
      tags.push('chunked');
      tags.push(`chunks:${chunks}`);
      
      // Database file record
      const dbFileData = {
        id: fileId,
        name: file.name,
        type: file.type,
        size: file.size,
        user_id: userId,
        storage_path: uploadedPaths.join(','), // Store all paths
        encrypted: true,
        encryption_key: encryptionKey,
        shared: false,
        tags: tags,
        github_repo: githubRepo,
        html_url: htmlUrl
      };
      
      // Save file metadata to Supabase
      const { error } = await supabase
        .from('files')
        .insert([dbFileData]);
      
      if (error) throw error;
      
      // Return frontend file format
      return {
        id: fileId,
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: new Date(),
        path: uploadedPaths.join(','),
        encrypted: true,
        shared: false,
        chunks: chunks,
        encryptionKey: encryptionKey,
        githubPath: uploadedPaths.join(','),
        githubRepo: githubRepo,
        htmlUrl: htmlUrl
      };
      
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
          userId: userId,
          createRepo: createRepo
        }
      });
      
      if (error) throw error;
      
      const githubRepo = data.repo;
      const htmlUrl = data.html_url;
      let previewUrl = undefined;
      
      // For images and PDFs, we can potentially create a preview URL
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        previewUrl = data.url;
      }
      
      // Database file record
      const dbFileData = {
        id: fileId,
        name: file.name,
        type: file.type,
        size: file.size,
        user_id: userId,
        storage_path: data.path,
        encrypted: true,
        encryption_key: encryptionKey,
        shared: false,
        tags: isLargeFile ? ['chunked', `chunks:${chunks}`] : null,
        github_repo: githubRepo,
        preview_url: previewUrl,
        html_url: htmlUrl
      };
      
      // Save file metadata to Supabase
      const { error: insertError } = await supabase
        .from('files')
        .insert([dbFileData]);
      
      if (insertError) throw insertError;
      
      // Return frontend file format
      return {
        id: fileId,
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: new Date(),
        path: data.path,
        encrypted: true,
        shared: false,
        encryptionKey: encryptionKey,
        githubPath: data.path,
        githubRepo: githubRepo,
        previewUrl: previewUrl,
        htmlUrl: htmlUrl
      };
    }
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
    
    const storagePath = fileData.storage_path;
    const encryptionKey = fileData.encryption_key;
    const fileType = fileData.type;
    const githubRepo = fileData.github_repo;
    const chunks = fileData.tags?.find(tag => tag.startsWith('chunks:'))?.split(':')[1];
    const isChunked = fileData.tags?.includes('chunked');
    
    if (!storagePath || !encryptionKey) {
      throw new Error('Missing file storage information');
    }
    
    // For multi-chunk files
    if (isChunked && chunks) {
      const paths = storagePath.split(',');
      const chunksCount = parseInt(chunks);
      
      if (paths.length !== chunksCount) {
        throw new Error('Chunk count mismatch');
      }
      
      // Download all chunks in parallel
      const chunkPromises = paths.map(async (path) => {
        // Download from GitHub via Supabase Edge Function
        const { data, error } = await supabase.functions.invoke('github-storage', {
          body: {
            action: 'download',
            path: path,
            repo: githubRepo
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
      
      return new Blob([combinedBuffer], { type: fileType });
    } else {
      // For single-file downloads
      // Download from GitHub via Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('github-storage', {
        body: {
          action: 'download',
          path: storagePath,
          repo: githubRepo
        }
      });
      
      if (error) throw error;
      
      // Decrypt the file
      const decryptedData = decryptData(data.content, encryptionKey);
      return new Blob([decryptedData], { type: fileType });
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
    
    const storagePath = fileData.storage_path;
    const githubRepo = fileData.github_repo;
    
    if (storagePath) {
      // Delete all chunks/paths
      const paths = storagePath.split(',');
      
      // Delete from GitHub via Supabase Edge Function
      await Promise.all(paths.map(path => 
        supabase.functions.invoke('github-storage', {
          body: {
            action: 'delete',
            path: path,
            repo: githubRepo
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


// Mock API functions for InflateStorage

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

// Mock files
const mockFiles: FileItem[] = [
  {
    id: '1',
    name: 'Project Presentation.pdf',
    type: 'application/pdf',
    size: 4.7 * 1024 * 1024, // 4.7 MB
    lastModified: new Date('2023-09-15'),
    path: '/Documents/',
    encrypted: true,
    shared: false,
  },
  {
    id: '2',
    name: 'Vacation Photos.zip',
    type: 'application/zip',
    size: 1.2 * 1024 * 1024 * 1024, // 1.2 GB
    lastModified: new Date('2023-07-22'),
    path: '/Photos/',
    encrypted: true,
    shared: true,
  },
  {
    id: '3',
    name: 'Financial Report 2023.xlsx',
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: 2.8 * 1024 * 1024, // 2.8 MB
    lastModified: new Date('2023-10-05'),
    path: '/Documents/Work/',
    encrypted: true,
    shared: false,
  },
  {
    id: '4',
    name: 'Marketing Strategy.docx',
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: 1.5 * 1024 * 1024, // 1.5 MB
    lastModified: new Date('2023-11-01'),
    path: '/Documents/Work/',
    encrypted: true,
    shared: false,
  },
  {
    id: '5',
    name: 'Family Reunion.mp4',
    type: 'video/mp4',
    size: 755 * 1024 * 1024, // 755 MB
    lastModified: new Date('2023-08-17'),
    path: '/Videos/',
    encrypted: true,
    shared: true,
  },
];

// Mock authentication
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

// File operations
export const getFiles = async (): Promise<FileItem[]> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 600));
  
  return mockFiles;
};

// Enhanced upload file function with encryption and chunking support
export const uploadFile = async (file: File): Promise<FileItem> => {
  // Simulate network delay and encryption
  await new Promise(resolve => setTimeout(resolve, file.size / 200000)); // Larger files take longer
  
  // For demo purposes, we're simulating the encryption/chunking process
  // In a real app, you would use the encryption.ts utility functions
  const isLargeFile = file.size > 10 * 1024 * 1024; // 10MB
  const numberOfChunks = isLargeFile ? Math.ceil(file.size / (10 * 1024 * 1024)) : 1;
  
  const newFile: FileItem = {
    id: Math.random().toString(36).substring(2, 15),
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: new Date(),
    path: '/',
    encrypted: true,
    shared: false,
    chunks: isLargeFile ? numberOfChunks : undefined,
    encryptionKey: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
  };
  
  return newFile;
};

// Download file with decryption support
export const downloadFile = async (fileId: string): Promise<Blob> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Simulate fetching and decrypting the file
  // In a real app, you would fetch the encrypted data and use the decryption utility
  const file = mockFiles.find(f => f.id === fileId);
  if (!file) {
    throw new Error('File not found');
  }
  
  // Simulate creating a file blob of the proper type
  return new Blob(['Simulated file content'], { type: file.type });
};

export const deleteFile = async (fileId: string): Promise<boolean> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return true;
};

export const shareFile = async (fileId: string): Promise<string> => {
  // Simulate creating a share link
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return `https://inflate-storage.app/share/${fileId}`;
};

export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};


export interface FileSystemItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  parentId: string | null;
  created_at: string;
  updated_at: string;
  userId: string;
  size?: number;
  fileType?: string;
  path?: string;
  storage_path?: string;
  encrypted?: boolean;
  shared?: boolean;
  encryption_key?: string;
  preview_available?: boolean;
  preview_type?: string;
  fileId?: string; // Added this property to handle files in filesystem
}

export interface FolderData extends FileSystemItem {
  type: 'folder';
  children?: FileSystemItem[];
}

export interface FileData extends FileSystemItem {
  type: 'file';
  fileType: string;
  size: number;
}

export interface BreadcrumbItem {
  id: string;
  name: string;
}

export interface FileManagerState {
  items: FileSystemItem[];
  currentFolder: string | null;
  path: BreadcrumbItem[];
  loading: boolean;
  error: string | null;
  selectedItems: string[];
  viewMode: 'grid' | 'list';
  sorting: {
    field: 'name' | 'created_at' | 'updated_at' | 'size';
    direction: 'asc' | 'desc';
  };
}

// Define Supabase table types for filesystem table
export interface FilesystemItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  parentId: string | null;
  userId: string;
  fileId?: string;
  created_at: string;
  updated_at: string;
}

// Add this to the Supabase types
// This is a placeholder method to make TypeScript aware of the filesystem table
export function extendSupabaseTypes() {
  // This function is just a type helper - doesn't actually do anything at runtime
  console.log("Types extended");
}

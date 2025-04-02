
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

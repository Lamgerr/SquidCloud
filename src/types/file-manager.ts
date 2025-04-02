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
  fileId?: string;
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

export interface FilesystemItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  parent_id: string | null;
  user_id: string;
  file_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GetFolderContentsResult {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
  user_id: string;
  file_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GetFolderByIdResult {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateFolderResult {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateFileEntryResult {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
  user_id: string;
  file_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GetFilesystemItemResult {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
  user_id: string;
  file_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserStorageStatsResult {
  total_size: number;
  file_count: number;
  folder_count: number;
}

export interface FilePreviewData {
  id: string;
  name: string;
  type: string;
  parent_id?: string | null;
  user_id: string;
  size?: number;
  storage_path?: string;
  encrypted?: boolean;
  shared?: boolean;
  created_at?: string;
  updated_at?: string;
  file_id?: string;
  preview_available?: boolean;
  preview_type?: string;
  tags?: string[];
  encryption_key?: string;
  storage_node?: string;
}

export function convertFilesystemItemToFileSystemItem(item: FilesystemItem | GetFilesystemItemResult | GetFolderContentsResult, fileDetails?: any): FileSystemItem {
  return {
    id: item.id,
    name: item.name,
    type: item.type as 'file' | 'folder',
    parentId: item.parent_id,
    userId: item.user_id,
    created_at: item.created_at,
    updated_at: item.updated_at,
    fileId: item.file_id,
    ...(fileDetails && {
      size: fileDetails.size,
      fileType: fileDetails.type,
      storage_path: fileDetails.storage_path,
      encrypted: fileDetails.encrypted,
      shared: fileDetails.shared,
      preview_available: fileDetails.preview_available || false,
      preview_type: fileDetails.preview_type || null,
    })
  };
}

export function convertToFilesystemItem(item: Partial<FileSystemItem>): Partial<FilesystemItem> {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    parent_id: item.parentId,
    user_id: item.userId,
    file_id: item.fileId,
    created_at: item.created_at,
    updated_at: item.updated_at
  };
}

export interface SupabaseProfileType {
  avatar_url: string | null;
  created_at: string | null;
  full_name: string | null;
  id: string;
  storage_used: number | null;
  updated_at: string | null;
  storage_quota_gb: number | null;
  onboarding_complete: boolean | null;
  storage_node_count: number | null;
  preview_available: boolean | null;
  preview_type: string | null;
  repo_count?: number;
  is_premium?: boolean;
}

export interface RpcResponse<T> {
  data: T;
  error: any;
}

export interface RpcFunctionArgs {
  [key: string]: any;
}

export interface GetFolderContentsFunctionArgs extends RpcFunctionArgs {
  parent_id: string | null;
}

export interface GetFolderByIdFunctionArgs extends RpcFunctionArgs {
  folder_id: string;
}

export interface CreateFolderFunctionArgs extends RpcFunctionArgs {
  name: string;
  parent_id: string | null;
  user_id: string;
}

export interface CreateFileEntryFunctionArgs extends RpcFunctionArgs {
  name: string;
  parent_id: string | null;
  user_id: string;
  file_id: string;
}

export interface DeleteFilesystemItemFunctionArgs extends RpcFunctionArgs {
  item_id: string;
}

export interface RenameFilesystemItemFunctionArgs extends RpcFunctionArgs {
  item_id: string;
  new_name: string;
}

export interface MoveFilesystemItemFunctionArgs extends RpcFunctionArgs {
  item_id: string;
  new_parent_id: string | null;
}

export interface GetFilesystemItemFunctionArgs extends RpcFunctionArgs {
  item_id: string;
}

export interface GetUserStorageStatsFunctionArgs extends RpcFunctionArgs {
  user_id: string;
}

export interface InitializeFileSystemFunctionArgs extends RpcFunctionArgs {
  user_id: string;
}

export function createRpcParams<T extends RpcFunctionArgs>(params: T): Record<string, any> {
  return params as Record<string, any>;
}

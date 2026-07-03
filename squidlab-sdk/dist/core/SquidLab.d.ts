/**
 * SquidLab - Core SDK class for SquidCloud extensions
 */
import { ExtensionConfig, Permission, FileMetadata, UserProfile, StorageQuota, APIResponse, FolderMetadata, FilePreviewData, EncryptionResult } from '../types';
export declare class SquidLab {
    private config;
    private permissionManager;
    private apiBaseUrl;
    private inAppMode;
    constructor(config: ExtensionConfig);
    /**
     * SquidFetch - In-app secure file fetching system
     * Access user's files directly without API keys (requires in-app mode)
     */
    get file(): {
        /**
         * Fetch file by ID using sqfetch (in-app only)
         */
        sqfetch: (fileId: string) => Promise<APIResponse<Blob>>;
        /**
         * Get file metadata using sqfetch
         */
        sqfetchMetadata: (fileId: string) => Promise<APIResponse<FileMetadata>>;
        /**
         * List files with sqfetch
         */
        sqfetchList: (folderId?: string) => Promise<APIResponse<FileMetadata[]>>;
        /**
         * Upload file using sqfetch
         */
        sqfetchUpload: (file: File, folderId?: string) => Promise<APIResponse<{
            fileId: string;
        }>>;
        /**
         * Delete file using sqfetch
         */
        sqfetchDelete: (fileId: string) => Promise<APIResponse<void>>;
        /**
         * Get file preview (in-app only)
         */
        sqfetchPreview: (fileId: string) => Promise<APIResponse<FilePreviewData>>;
    };
    /**
     * Folder operations
     */
    get folder(): {
        /**
         * List folders
         */
        sqfetchList: (parentId?: string) => Promise<APIResponse<FolderMetadata[]>>;
        /**
         * Create folder
         */
        sqfetchCreate: (name: string, parentId?: string) => Promise<APIResponse<FolderMetadata>>;
        /**
         * Delete folder
         */
        sqfetchDelete: (folderId: string) => Promise<APIResponse<void>>;
    };
    /**
     * RES54 Encryption/Decryption operations (in-app only, secure environment)
     */
    get res54(): {
        /**
         * Encrypt data using RES54
         */
        encrypt: (data: Blob | File, key: string) => Promise<APIResponse<EncryptionResult>>;
        /**
         * Decrypt data using RES54
         */
        decrypt: (encryptedData: Blob, key: string) => Promise<APIResponse<Blob>>;
        /**
         * Generate RES54 encryption key
         */
        generateKey: () => Promise<APIResponse<string>>;
    };
    /**
     * Send message to parent window and wait for response
     */
    private sendMessageAsync;
    /**
     * Get current user profile
     * Requires: user.profile permission
     */
    getUserProfile(): Promise<APIResponse<UserProfile>>;
    /**
     * List user's files
     * Requires: files.read permission
     */
    listFiles(): Promise<APIResponse<FileMetadata[]>>;
    /**
     * Get file metadata by ID
     * Requires: files.read permission
     */
    getFileMetadata(fileId: string): Promise<APIResponse<FileMetadata>>;
    /**
     * Download file by ID
     * Requires: files.read permission
     */
    downloadFile(fileId: string): Promise<APIResponse<Blob>>;
    /**
     * Upload a file
     * Requires: files.write permission
     */
    uploadFile(file: File): Promise<APIResponse<{
        fileId: string;
    }>>;
    /**
     * Delete a file
     * Requires: files.delete permission
     */
    deleteFile(fileId: string): Promise<APIResponse<void>>;
    /**
     * Get storage quota information
     * Requires: storage.quota permission
     */
    getStorageQuota(): Promise<APIResponse<StorageQuota>>;
    /**
     * Show notification
     * Requires: notifications permission
     */
    showNotification(title: string, message: string, type?: 'success' | 'error' | 'warning' | 'info'): void;
    /**
     * Check if extension has a specific permission
     */
    hasPermission(permission: Permission): boolean;
    /**
     * Get all granted permissions
     */
    getPermissions(): Permission[];
    /**
     * Get current theme
     */
    getTheme(): 'light' | 'dark';
    /**
     * Send message to parent window
     */
    private sendMessage;
    /**
     * Make authenticated API request
     */
    private apiRequest;
    /**
     * Listen for messages from parent window
     */
    onMessage(callback: (event: string, data: any) => void): void;
}
//# sourceMappingURL=SquidLab.d.ts.map
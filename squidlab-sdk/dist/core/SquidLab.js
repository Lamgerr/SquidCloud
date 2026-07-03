/**
 * SquidLab - Core SDK class for SquidCloud extensions
 */
import { PermissionManager } from './PermissionManager';
export class SquidLab {
    constructor(config) {
        this.apiBaseUrl = 'https://ovmkvmzlgwshwdaexjow.supabase.co/functions/v1/cloudbliss-api';
        this.inAppMode = false;
        this.config = config;
        this.permissionManager = new PermissionManager(config.manifest.permissions);
        this.inAppMode = config.inAppMode || false;
        // Notify parent window that extension is ready
        this.sendMessage('extension:ready', {
            name: config.manifest.name,
            version: config.manifest.version
        });
    }
    /**
     * SquidFetch - In-app secure file fetching system
     * Access user's files directly without API keys (requires in-app mode)
     */
    get file() {
        return {
            /**
             * Fetch file by ID using sqfetch (in-app only)
             */
            sqfetch: async (fileId) => {
                if (!this.inAppMode) {
                    return { success: false, error: 'sqfetch is only available in in-app mode' };
                }
                if (!this.permissionManager.hasPermission('files.read')) {
                    return { success: false, error: 'Missing permission: files.read' };
                }
                return this.sendMessageAsync('sqfetch:file', { fileId });
            },
            /**
             * Get file metadata using sqfetch
             */
            sqfetchMetadata: async (fileId) => {
                if (!this.inAppMode) {
                    return { success: false, error: 'sqfetchMetadata is only available in in-app mode' };
                }
                if (!this.permissionManager.hasPermission('files.read')) {
                    return { success: false, error: 'Missing permission: files.read' };
                }
                return this.sendMessageAsync('sqfetch:metadata', { fileId });
            },
            /**
             * List files with sqfetch
             */
            sqfetchList: async (folderId) => {
                if (!this.inAppMode) {
                    return { success: false, error: 'sqfetchList is only available in in-app mode' };
                }
                if (!this.permissionManager.hasPermission('files.read')) {
                    return { success: false, error: 'Missing permission: files.read' };
                }
                return this.sendMessageAsync('sqfetch:list', { folderId });
            },
            /**
             * Upload file using sqfetch
             */
            sqfetchUpload: async (file, folderId) => {
                if (!this.inAppMode) {
                    return { success: false, error: 'sqfetchUpload is only available in in-app mode' };
                }
                if (!this.permissionManager.hasPermission('files.write')) {
                    return { success: false, error: 'Missing permission: files.write' };
                }
                return this.sendMessageAsync('sqfetch:upload', { file, folderId });
            },
            /**
             * Delete file using sqfetch
             */
            sqfetchDelete: async (fileId) => {
                if (!this.inAppMode) {
                    return { success: false, error: 'sqfetchDelete is only available in in-app mode' };
                }
                if (!this.permissionManager.hasPermission('files.delete')) {
                    return { success: false, error: 'Missing permission: files.delete' };
                }
                return this.sendMessageAsync('sqfetch:delete', { fileId });
            },
            /**
             * Get file preview (in-app only)
             */
            sqfetchPreview: async (fileId) => {
                if (!this.inAppMode) {
                    return { success: false, error: 'sqfetchPreview is only available in in-app mode' };
                }
                if (!this.permissionManager.hasPermission('files.read')) {
                    return { success: false, error: 'Missing permission: files.read' };
                }
                return this.sendMessageAsync('sqfetch:preview', { fileId });
            }
        };
    }
    /**
     * Folder operations
     */
    get folder() {
        return {
            /**
             * List folders
             */
            sqfetchList: async (parentId) => {
                if (!this.inAppMode) {
                    return { success: false, error: 'Folder operations only available in in-app mode' };
                }
                if (!this.permissionManager.hasPermission('files.read')) {
                    return { success: false, error: 'Missing permission: files.read' };
                }
                return this.sendMessageAsync('sqfetch:folders:list', { parentId });
            },
            /**
             * Create folder
             */
            sqfetchCreate: async (name, parentId) => {
                if (!this.inAppMode) {
                    return { success: false, error: 'Folder operations only available in in-app mode' };
                }
                if (!this.permissionManager.hasPermission('files.write')) {
                    return { success: false, error: 'Missing permission: files.write' };
                }
                return this.sendMessageAsync('sqfetch:folders:create', { name, parentId });
            },
            /**
             * Delete folder
             */
            sqfetchDelete: async (folderId) => {
                if (!this.inAppMode) {
                    return { success: false, error: 'Folder operations only available in in-app mode' };
                }
                if (!this.permissionManager.hasPermission('files.delete')) {
                    return { success: false, error: 'Missing permission: files.delete' };
                }
                return this.sendMessageAsync('sqfetch:folders:delete', { folderId });
            }
        };
    }
    /**
     * RES54 Encryption/Decryption operations (in-app only, secure environment)
     */
    get res54() {
        return {
            /**
             * Encrypt data using RES54
             */
            encrypt: async (data, key) => {
                if (!this.inAppMode) {
                    return { success: false, error: 'RES54 operations only available in in-app mode' };
                }
                if (!this.permissionManager.hasPermission('api.access')) {
                    return { success: false, error: 'Missing permission: api.access' };
                }
                return this.sendMessageAsync('res54:encrypt', { data, key });
            },
            /**
             * Decrypt data using RES54
             */
            decrypt: async (encryptedData, key) => {
                if (!this.inAppMode) {
                    return { success: false, error: 'RES54 operations only available in in-app mode' };
                }
                if (!this.permissionManager.hasPermission('api.access')) {
                    return { success: false, error: 'Missing permission: api.access' };
                }
                return this.sendMessageAsync('res54:decrypt', { encryptedData, key });
            },
            /**
             * Generate RES54 encryption key
             */
            generateKey: async () => {
                if (!this.inAppMode) {
                    return { success: false, error: 'RES54 operations only available in in-app mode' };
                }
                if (!this.permissionManager.hasPermission('api.access')) {
                    return { success: false, error: 'Missing permission: api.access' };
                }
                return this.sendMessageAsync('res54:generateKey', {});
            }
        };
    }
    /**
     * Send message to parent window and wait for response
     */
    async sendMessageAsync(event, data) {
        return new Promise((resolve) => {
            const messageId = `msg_${Date.now()}_${Math.random()}`;
            const handleResponse = (e) => {
                if (e.data?.type === 'squidlab:response' && e.data?.messageId === messageId) {
                    window.removeEventListener('message', handleResponse);
                    resolve(e.data.response);
                }
            };
            window.addEventListener('message', handleResponse);
            this.sendMessage(event, { ...data, messageId });
            // Timeout after 30 seconds
            setTimeout(() => {
                window.removeEventListener('message', handleResponse);
                resolve({ success: false, error: 'Request timeout' });
            }, 30000);
        });
    }
    /**
     * Get current user profile
     * Requires: user.profile permission
     */
    async getUserProfile() {
        if (!this.permissionManager.hasPermission('user.profile')) {
            return { success: false, error: 'Missing permission: user.profile' };
        }
        // Use in-app mode if available
        if (this.inAppMode) {
            return this.sendMessageAsync('sqfetch:user:profile', {});
        }
        try {
            const response = await this.apiRequest('/user/profile', {
                method: 'GET'
            });
            return { success: true, data: await response.json() };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    /**
     * List user's files
     * Requires: files.read permission
     */
    async listFiles() {
        if (!this.permissionManager.hasPermission('files.read')) {
            return { success: false, error: 'Missing permission: files.read' };
        }
        try {
            const response = await this.apiRequest('/files', {
                method: 'GET'
            });
            return { success: true, data: await response.json() };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    /**
     * Get file metadata by ID
     * Requires: files.read permission
     */
    async getFileMetadata(fileId) {
        if (!this.permissionManager.hasPermission('files.read')) {
            return { success: false, error: 'Missing permission: files.read' };
        }
        try {
            const response = await this.apiRequest(`/files/${fileId}/metadata`, {
                method: 'GET'
            });
            return { success: true, data: await response.json() };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    /**
     * Download file by ID
     * Requires: files.read permission
     */
    async downloadFile(fileId) {
        if (!this.permissionManager.hasPermission('files.read')) {
            return { success: false, error: 'Missing permission: files.read' };
        }
        try {
            const response = await this.apiRequest(`/files/${fileId}/download`, {
                method: 'GET'
            });
            return { success: true, data: await response.blob() };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    /**
     * Upload a file
     * Requires: files.write permission
     */
    async uploadFile(file) {
        if (!this.permissionManager.hasPermission('files.write')) {
            return { success: false, error: 'Missing permission: files.write' };
        }
        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await this.apiRequest('/files/upload', {
                method: 'POST',
                body: formData
            });
            return { success: true, data: await response.json() };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    /**
     * Delete a file
     * Requires: files.delete permission
     */
    async deleteFile(fileId) {
        if (!this.permissionManager.hasPermission('files.delete')) {
            return { success: false, error: 'Missing permission: files.delete' };
        }
        try {
            await this.apiRequest(`/files/${fileId}`, {
                method: 'DELETE'
            });
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    /**
     * Get storage quota information
     * Requires: storage.quota permission
     */
    async getStorageQuota() {
        if (!this.permissionManager.hasPermission('storage.quota')) {
            return { success: false, error: 'Missing permission: storage.quota' };
        }
        try {
            const response = await this.apiRequest('/storage/quota', {
                method: 'GET'
            });
            return { success: true, data: await response.json() };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    /**
     * Show notification
     * Requires: notifications permission
     */
    showNotification(title, message, type = 'info') {
        if (!this.permissionManager.hasPermission('notifications')) {
            console.warn('Missing permission: notifications');
            return;
        }
        this.sendMessage('notification:show', { title, message, type });
    }
    /**
     * Check if extension has a specific permission
     */
    hasPermission(permission) {
        return this.permissionManager.hasPermission(permission);
    }
    /**
     * Get all granted permissions
     */
    getPermissions() {
        return this.permissionManager.getPermissions();
    }
    /**
     * Get current theme
     */
    getTheme() {
        return this.config.theme || 'light';
    }
    /**
     * Send message to parent window
     */
    sendMessage(event, data) {
        if (window.parent) {
            window.parent.postMessage({
                type: 'squidlab:message',
                event,
                data,
                extensionId: this.config.manifest.name
            }, '*');
        }
    }
    /**
     * Make authenticated API request
     */
    async apiRequest(endpoint, options = {}) {
        const headers = new Headers(options.headers || {});
        headers.set('X-SquidCloud-Key', this.config.apiKey);
        headers.set('X-User-Id', this.config.userId);
        // Don't set Content-Type for FormData (browser will set it with boundary)
        if (!(options.body instanceof FormData)) {
            headers.set('Content-Type', 'application/json');
        }
        const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
            ...options,
            headers
        });
        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }
        return response;
    }
    /**
     * Listen for messages from parent window
     */
    onMessage(callback) {
        window.addEventListener('message', (event) => {
            if (event.data?.type === 'squidlab:message') {
                callback(event.data.event, event.data.data);
            }
        });
    }
}

'use strict';

var React = require('react');

/**
 * PermissionManager - Manages extension permissions
 */
class PermissionManager {
    constructor(permissions) {
        this.permissions = new Set(permissions);
    }
    /**
     * Check if a specific permission is granted
     */
    hasPermission(permission) {
        return this.permissions.has(permission);
    }
    /**
     * Get all granted permissions
     */
    getPermissions() {
        return Array.from(this.permissions);
    }
    /**
     * Request a new permission (runtime)
     */
    async requestPermission(permission) {
        if (this.permissions.has(permission)) {
            return true;
        }
        // Send request to parent window
        return new Promise((resolve) => {
            const handleMessage = (event) => {
                if (event.data?.type === 'squidlab:permission-response' &&
                    event.data?.permission === permission) {
                    window.removeEventListener('message', handleMessage);
                    if (event.data.granted) {
                        this.permissions.add(permission);
                    }
                    resolve(event.data.granted);
                }
            };
            window.addEventListener('message', handleMessage);
            if (window.parent) {
                window.parent.postMessage({
                    type: 'squidlab:permission-request',
                    permission
                }, '*');
            }
            // Timeout after 30 seconds
            setTimeout(() => {
                window.removeEventListener('message', handleMessage);
                resolve(false);
            }, 30000);
        });
    }
    /**
     * Check multiple permissions at once
     */
    hasPermissions(permissions) {
        return permissions.every(p => this.permissions.has(p));
    }
}

/**
 * SquidLab - Core SDK class for SquidCloud extensions
 */
class SquidLab {
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

/**
 * ExtensionContext - Provides context information to extensions
 */
class ExtensionContext {
    constructor(manifest, userId, extensionId) {
        this.manifest = manifest;
        this.userId = userId;
        this.extensionId = extensionId;
    }
    /**
     * Get extension manifest
     */
    getManifest() {
        return { ...this.manifest };
    }
    /**
     * Get extension name
     */
    getName() {
        return this.manifest.name;
    }
    /**
     * Get extension version
     */
    getVersion() {
        return this.manifest.version;
    }
    /**
     * Get current user ID
     */
    getUserId() {
        return this.userId;
    }
    /**
     * Get extension ID
     */
    getExtensionId() {
        return this.extensionId;
    }
    /**
     * Get extension author
     */
    getAuthor() {
        return { ...this.manifest.author };
    }
    /**
     * Save extension settings (persisted in database)
     */
    async saveSettings(settings) {
        if (window.parent) {
            window.parent.postMessage({
                type: 'squidlab:save-settings',
                extensionId: this.extensionId,
                settings
            }, '*');
        }
    }
    /**
     * Load extension settings
     */
    async loadSettings() {
        return new Promise((resolve) => {
            const handleMessage = (event) => {
                if (event.data?.type === 'squidlab:settings-response' &&
                    event.data?.extensionId === this.extensionId) {
                    window.removeEventListener('message', handleMessage);
                    resolve(event.data.settings || {});
                }
            };
            window.addEventListener('message', handleMessage);
            if (window.parent) {
                window.parent.postMessage({
                    type: 'squidlab:load-settings',
                    extensionId: this.extensionId
                }, '*');
            }
            // Timeout after 10 seconds
            setTimeout(() => {
                window.removeEventListener('message', handleMessage);
                resolve({});
            }, 10000);
        });
    }
}

/**
 * SquidCloud UI Components - Matching exact SquidCloud design system
 * Colors, spacing, typography, and interactions identical to main app
 */
// SquidCloud Color Palette
const SquidCloudColors = {
    primary: {
        50: '#eff6ff',
        100: '#dbeafe',
        200: '#bfdbfe',
        300: '#93c5fd',
        400: '#60a5fa',
        500: '#3b82f6', // Primary Blue
        600: '#2563eb',
        700: '#1d4ed8',
        800: '#1e40af',
        900: '#1e3a8a',
    },
    gray: {
        50: '#f9fafb',
        100: '#f3f4f6',
        200: '#e5e7eb',
        300: '#d1d5db',
        400: '#9ca3af',
        500: '#6b7280',
        600: '#4b5563',
        700: '#374151',
        800: '#1f2937',
        900: '#111827',
    },
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
};
// SquidCloud Typography
const SquidCloudTypography = {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: {
        xs: '0.75rem', // 12px
        sm: '0.875rem', // 14px
        base: '1rem', // 16px
        lg: '1.125rem', // 18px
        xl: '1.25rem', // 20px
        '2xl': '1.5rem', // 24px
        '3xl': '1.875rem', // 30px
    },
    fontWeight: {
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
    },
};
// SquidCloud Spacing (matches Tailwind scale)
const SquidCloudSpacing = {
    0: '0',
    1: '0.25rem', // 4px
    2: '0.5rem', // 8px
    3: '0.75rem', // 12px
    4: '1rem', // 16px
    5: '1.25rem', // 20px
    6: '1.5rem', // 24px
    8: '2rem', // 32px
    10: '2.5rem', // 40px
    12: '3rem', // 48px
    16: '4rem', // 64px
};
// SquidCloud Border Radius
const SquidCloudRadius = {
    sm: '0.375rem', // 6px
    md: '0.5rem', // 8px
    lg: '0.75rem', // 12px
    xl: '1rem', // 16px
    full: '9999px',
};
// SquidCloud Shadows
const SquidCloudShadows = {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
};
const SQButton = ({ children, onClick, variant = 'primary', size = 'md', disabled = false, loading = false, className = '', type = 'button', icon, fullWidth = false }) => {
    const baseStyles = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: SquidCloudTypography.fontFamily,
        fontWeight: SquidCloudTypography.fontWeight.medium,
        borderRadius: SquidCloudRadius.md,
        transition: 'all 0.2s ease',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.5 : 1,
        border: 'none',
        outline: 'none',
        width: fullWidth ? '100%' : 'auto',
    };
    const variantStyles = {
        primary: {
            backgroundColor: SquidCloudColors.primary[600],
            color: '#ffffff',
            boxShadow: SquidCloudShadows.sm,
        },
        secondary: {
            backgroundColor: SquidCloudColors.gray[200],
            color: SquidCloudColors.gray[800],
        },
        danger: {
            backgroundColor: SquidCloudColors.error,
            color: '#ffffff',
        },
        success: {
            backgroundColor: SquidCloudColors.success,
            color: '#ffffff',
        },
        ghost: {
            backgroundColor: 'transparent',
            color: SquidCloudColors.gray[700],
        },
        outline: {
            backgroundColor: 'transparent',
            color: SquidCloudColors.primary[600],
            border: `2px solid ${SquidCloudColors.primary[600]}`,
        },
    };
    const sizeStyles = {
        sm: {
            padding: `${SquidCloudSpacing[2]} ${SquidCloudSpacing[3]}`,
            fontSize: SquidCloudTypography.fontSize.sm,
        },
        md: {
            padding: `${SquidCloudSpacing[3]} ${SquidCloudSpacing[4]}`,
            fontSize: SquidCloudTypography.fontSize.base,
        },
        lg: {
            padding: `${SquidCloudSpacing[4]} ${SquidCloudSpacing[6]}`,
            fontSize: SquidCloudTypography.fontSize.lg,
        },
    };
    return (React.createElement("button", { type: type, onClick: onClick, disabled: disabled || loading, className: className, style: { ...baseStyles, ...variantStyles[variant], ...sizeStyles[size] } },
        loading && (React.createElement("svg", { style: { marginRight: SquidCloudSpacing[2], animation: 'spin 1s linear infinite' }, width: "16", height: "16", viewBox: "0 0 24 24", fill: "none" },
            React.createElement("circle", { cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4", opacity: "0.25" }),
            React.createElement("path", { fill: "currentColor", opacity: "0.75", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" }))),
        icon && React.createElement("span", { style: { marginRight: SquidCloudSpacing[2] } }, icon),
        children));
};
const SQInput = ({ value, onChange, placeholder, type = 'text', disabled = false, error, label, required = false, className = '', icon, maxLength, fullWidth = true }) => {
    return (React.createElement("div", { style: { width: fullWidth ? '100%' : 'auto' }, className: className },
        label && (React.createElement("label", { style: {
                display: 'block',
                fontSize: SquidCloudTypography.fontSize.sm,
                fontWeight: SquidCloudTypography.fontWeight.medium,
                color: SquidCloudColors.gray[700],
                marginBottom: SquidCloudSpacing[1],
                fontFamily: SquidCloudTypography.fontFamily,
            } },
            label,
            required && React.createElement("span", { style: { color: SquidCloudColors.error, marginLeft: '4px' } }, "*"))),
        React.createElement("div", { style: { position: 'relative' } },
            icon && (React.createElement("div", { style: {
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    paddingLeft: SquidCloudSpacing[3],
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none',
                    color: SquidCloudColors.gray[400],
                } }, icon)),
            React.createElement("input", { type: type, value: value, onChange: (e) => onChange(e.target.value), placeholder: placeholder, disabled: disabled, required: required, maxLength: maxLength, style: {
                    display: 'block',
                    width: '100%',
                    borderRadius: SquidCloudRadius.md,
                    border: `1px solid ${error ? SquidCloudColors.error : SquidCloudColors.gray[300]}`,
                    paddingLeft: icon ? '2.5rem' : SquidCloudSpacing[4],
                    paddingRight: SquidCloudSpacing[4],
                    paddingTop: SquidCloudSpacing[2],
                    paddingBottom: SquidCloudSpacing[2],
                    fontSize: SquidCloudTypography.fontSize.base,
                    fontFamily: SquidCloudTypography.fontFamily,
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    backgroundColor: disabled ? SquidCloudColors.gray[100] : '#ffffff',
                    cursor: disabled ? 'not-allowed' : 'text',
                } })),
        error && (React.createElement("p", { style: {
                marginTop: SquidCloudSpacing[1],
                fontSize: SquidCloudTypography.fontSize.sm,
                color: SquidCloudColors.error,
                fontFamily: SquidCloudTypography.fontFamily,
            } }, error))));
};
const SQCard = ({ children, title, subtitle, footer, className = '', hoverable = false, onClick }) => {
    return (React.createElement("div", { onClick: onClick, className: className, style: {
            backgroundColor: '#ffffff',
            borderRadius: SquidCloudRadius.lg,
            border: `1px solid ${SquidCloudColors.gray[200]}`,
            boxShadow: SquidCloudShadows.sm,
            overflow: 'hidden',
            transition: hoverable ? 'box-shadow 0.2s ease' : 'none',
            cursor: hoverable ? 'pointer' : 'default',
        } },
        (title || subtitle) && (React.createElement("div", { style: {
                padding: `${SquidCloudSpacing[4]} ${SquidCloudSpacing[6]}`,
                borderBottom: `1px solid ${SquidCloudColors.gray[200]}`,
            } },
            title && (React.createElement("h3", { style: {
                    fontSize: SquidCloudTypography.fontSize.lg,
                    fontWeight: SquidCloudTypography.fontWeight.semibold,
                    color: SquidCloudColors.gray[900],
                    fontFamily: SquidCloudTypography.fontFamily,
                    margin: 0,
                } }, title)),
            subtitle && (React.createElement("p", { style: {
                    fontSize: SquidCloudTypography.fontSize.sm,
                    color: SquidCloudColors.gray[600],
                    fontFamily: SquidCloudTypography.fontFamily,
                    marginTop: SquidCloudSpacing[1],
                    margin: 0,
                } }, subtitle)))),
        React.createElement("div", { style: { padding: `${SquidCloudSpacing[4]} ${SquidCloudSpacing[6]}` } }, children),
        footer && (React.createElement("div", { style: {
                padding: `${SquidCloudSpacing[3]} ${SquidCloudSpacing[6]}`,
                backgroundColor: SquidCloudColors.gray[50],
                borderTop: `1px solid ${SquidCloudColors.gray[200]}`,
            } }, footer))));
};
const SQBadge = ({ children, variant = 'default', size = 'md', className = '' }) => {
    const variantStyles = {
        default: { backgroundColor: SquidCloudColors.gray[200], color: SquidCloudColors.gray[800] },
        success: { backgroundColor: '#d1fae5', color: '#065f46' },
        error: { backgroundColor: '#fee2e2', color: '#991b1b' },
        warning: { backgroundColor: '#fef3c7', color: '#92400e' },
        info: { backgroundColor: '#dbeafe', color: '#1e40af' },
        primary: { backgroundColor: SquidCloudColors.primary[100], color: SquidCloudColors.primary[800] },
    };
    const sizeStyles = {
        sm: {
            padding: `${SquidCloudSpacing[1]} ${SquidCloudSpacing[2]}`,
            fontSize: SquidCloudTypography.fontSize.xs,
        },
        md: {
            padding: `${SquidCloudSpacing[1]} ${SquidCloudSpacing[3]}`,
            fontSize: SquidCloudTypography.fontSize.sm,
        },
    };
    return (React.createElement("span", { className: className, style: {
            display: 'inline-flex',
            alignItems: 'center',
            borderRadius: SquidCloudRadius.full,
            fontWeight: SquidCloudTypography.fontWeight.medium,
            fontFamily: SquidCloudTypography.fontFamily,
            ...variantStyles[variant],
            ...sizeStyles[size],
        } }, children));
};
// Add spin animation keyframes
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
    document.head.appendChild(style);
}

/**
 * Button Component - SquidCloud styled button
 */
const Button = ({ children, onClick, variant = 'primary', size = 'md', disabled = false, loading = false, className = '', type = 'button', icon }) => {
    const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
    const variantClasses = {
        primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-300',
        secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-500 disabled:bg-gray-100',
        danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300',
        success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 disabled:bg-green-300',
        ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500'
    };
    const sizeClasses = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg'
    };
    return (React.createElement("button", { type: type, onClick: onClick, disabled: disabled || loading, className: `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className} ${disabled || loading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}` },
        loading && (React.createElement("svg", { className: "animate-spin -ml-1 mr-2 h-4 w-4", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24" },
            React.createElement("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }),
            React.createElement("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" }))),
        icon && React.createElement("span", { className: "mr-2" }, icon),
        children));
};

/**
 * Input Component - SquidCloud styled input field
 */
const Input = ({ value, onChange, placeholder, type = 'text', disabled = false, error, label, required = false, className = '', icon, maxLength }) => {
    return (React.createElement("div", { className: `w-full ${className}` },
        label && (React.createElement("label", { className: "block text-sm font-medium text-gray-700 mb-1" },
            label,
            required && React.createElement("span", { className: "text-red-500 ml-1" }, "*"))),
        React.createElement("div", { className: "relative" },
            icon && (React.createElement("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" }, icon)),
            React.createElement("input", { type: type, value: value, onChange: (e) => onChange(e.target.value), placeholder: placeholder, disabled: disabled, required: required, maxLength: maxLength, className: `
            block w-full rounded-lg border 
            ${icon ? 'pl-10' : 'pl-4'} pr-4 py-2
            ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}
            focus:outline-none focus:ring-2 focus:border-transparent
            disabled:bg-gray-100 disabled:cursor-not-allowed
            transition-colors duration-200
          ` })),
        error && (React.createElement("p", { className: "mt-1 text-sm text-red-500" }, error))));
};

/**
 * Card Component - SquidCloud styled card container
 */
const Card = ({ children, title, subtitle, footer, className = '', hoverable = false, onClick }) => {
    return (React.createElement("div", { onClick: onClick, className: `
        bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden
        ${hoverable ? 'hover:shadow-md transition-shadow duration-200 cursor-pointer' : ''}
        ${className}
      ` },
        (title || subtitle) && (React.createElement("div", { className: "px-6 py-4 border-b border-gray-200" },
            title && React.createElement("h3", { className: "text-lg font-semibold text-gray-900" }, title),
            subtitle && React.createElement("p", { className: "text-sm text-gray-600 mt-1" }, subtitle))),
        React.createElement("div", { className: "px-6 py-4" }, children),
        footer && (React.createElement("div", { className: "px-6 py-3 bg-gray-50 border-t border-gray-200" }, footer))));
};

/**
 * Modal Component - SquidCloud styled modal dialog
 */
const Modal = ({ isOpen, onClose, title, children, footer, size = 'md', closeOnOverlayClick = true }) => {
    React.useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);
    if (!isOpen)
        return null;
    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl'
    };
    return (React.createElement("div", { className: "fixed inset-0 z-50 overflow-y-auto" },
        React.createElement("div", { className: "flex min-h-screen items-center justify-center p-4" },
            React.createElement("div", { className: "fixed inset-0 bg-black bg-opacity-50 transition-opacity", onClick: closeOnOverlayClick ? onClose : undefined }),
            React.createElement("div", { className: `relative bg-white rounded-lg shadow-xl w-full ${sizeClasses[size]} z-50` },
                title && (React.createElement("div", { className: "flex items-center justify-between px-6 py-4 border-b border-gray-200" },
                    React.createElement("h2", { className: "text-xl font-semibold text-gray-900" }, title),
                    React.createElement("button", { onClick: onClose, className: "text-gray-400 hover:text-gray-600 transition-colors" },
                        React.createElement("svg", { className: "w-6 h-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" },
                            React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }))))),
                React.createElement("div", { className: "px-6 py-4 max-h-[70vh] overflow-y-auto" }, children),
                footer && (React.createElement("div", { className: "px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg" }, footer))))));
};

/**
 * Toast Component - SquidCloud styled toast notifications
 */
const Toast = ({ message, type = 'info', duration = 3000, position = 'top-right', id, onClose }) => {
    const [isVisible, setIsVisible] = React.useState(true);
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(() => onClose(id), 300);
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, id, onClose]);
    const typeStyles = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
    };
    const typeIcons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    const positionClasses = {
        'top-right': 'top-4 right-4',
        'top-left': 'top-4 left-4',
        'bottom-right': 'bottom-4 right-4',
        'bottom-left': 'bottom-4 left-4'
    };
    return (React.createElement("div", { className: `
        fixed ${positionClasses[position]} z-50
        transform transition-all duration-300 ease-in-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      ` },
        React.createElement("div", { className: `${typeStyles[type]} text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px]` },
            React.createElement("span", { className: "text-xl font-bold" }, typeIcons[type]),
            React.createElement("p", { className: "flex-1" }, message),
            React.createElement("button", { onClick: () => {
                    setIsVisible(false);
                    setTimeout(() => onClose(id), 300);
                }, className: "text-white hover:text-gray-200 transition-colors" }, "\u2715"))));
};
// Toast manager
let toastId = 0;
const toastCallbacks = [];
const showToast = (message, options = {}) => {
    const id = `toast-${toastId++}`;
    const toast = {
        message,
        id,
        onClose: () => { },
        ...options
    };
    toastCallbacks.forEach(callback => callback(toast));
};
const ToastContainer = () => {
    const [toasts, setToasts] = React.useState([]);
    React.useEffect(() => {
        const callback = (toast) => {
            setToasts(prev => [...prev, toast]);
        };
        toastCallbacks.push(callback);
        return () => {
            const index = toastCallbacks.indexOf(callback);
            if (index > -1)
                toastCallbacks.splice(index, 1);
        };
    }, []);
    const handleClose = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };
    return (React.createElement(React.Fragment, null, toasts.map(toast => (React.createElement(Toast, { key: toast.id, ...toast, onClose: handleClose })))));
};

/**
 * Remaining UI Components - Badge, Select, Checkbox, Switch, Table, Form, Tabs, FileUploader, DataTable, Chart
 */
const Badge = ({ children, variant = 'default', size = 'md', className = '' }) => {
    const variants = {
        default: 'bg-gray-200 text-gray-800',
        success: 'bg-green-100 text-green-800',
        error: 'bg-red-100 text-red-800',
        warning: 'bg-yellow-100 text-yellow-800',
        info: 'bg-blue-100 text-blue-800'
    };
    const sizes = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-3 py-1 text-sm'
    };
    return React.createElement("span", { className: `inline-flex items-center rounded-full font-medium ${variants[variant]} ${sizes[size]} ${className}` }, children);
};
const Select = ({ value, onChange, options, placeholder, label, disabled, className = '' }) => {
    return (React.createElement("div", { className: `w-full ${className}` },
        label && React.createElement("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, label),
        React.createElement("select", { value: value, onChange: (e) => onChange(e.target.value), disabled: disabled, className: "block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100" },
            placeholder && React.createElement("option", { value: "" }, placeholder),
            options.map(opt => React.createElement("option", { key: opt.value, value: opt.value }, opt.label)))));
};
const Checkbox = ({ checked, onChange, label, disabled, className = '' }) => {
    return (React.createElement("label", { className: `flex items-center gap-2 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}` },
        React.createElement("input", { type: "checkbox", checked: checked, onChange: (e) => onChange(e.target.checked), disabled: disabled, className: "w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" }),
        label && React.createElement("span", { className: "text-sm text-gray-700" }, label)));
};
const Switch = ({ checked, onChange, label, disabled, className = '' }) => {
    return (React.createElement("label", { className: `flex items-center gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}` },
        React.createElement("div", { className: "relative" },
            React.createElement("input", { type: "checkbox", checked: checked, onChange: (e) => onChange(e.target.checked), disabled: disabled, className: "sr-only" }),
            React.createElement("div", { className: `w-11 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'}` }),
            React.createElement("div", { className: `absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'transform translate-x-5' : ''}` })),
        label && React.createElement("span", { className: "text-sm text-gray-700" }, label)));
};
function Table({ columns, data, className = '' }) {
    return (React.createElement("div", { className: `overflow-x-auto ${className}` },
        React.createElement("table", { className: "min-w-full divide-y divide-gray-200" },
            React.createElement("thead", { className: "bg-gray-50" },
                React.createElement("tr", null, columns.map(col => (React.createElement("th", { key: col.key, className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" }, col.header))))),
            React.createElement("tbody", { className: "bg-white divide-y divide-gray-200" }, data.map((item, idx) => (React.createElement("tr", { key: idx, className: "hover:bg-gray-50" }, columns.map(col => (React.createElement("td", { key: col.key, className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900" }, col.render ? col.render(item) : item[col.key]))))))))));
}
const Form = ({ children, onSubmit, className = '' }) => {
    return (React.createElement("form", { onSubmit: onSubmit, className: `space-y-4 ${className}` }, children));
};
const Tabs = ({ tabs, defaultTab, className = '' }) => {
    const [activeTab, setActiveTab] = React.useState(defaultTab || tabs[0]?.id);
    return (React.createElement("div", { className: className },
        React.createElement("div", { className: "border-b border-gray-200" },
            React.createElement("nav", { className: "flex space-x-8" }, tabs.map(tab => (React.createElement("button", { key: tab.id, onClick: () => setActiveTab(tab.id), className: `py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}` }, tab.label))))),
        React.createElement("div", { className: "mt-4" }, tabs.find(t => t.id === activeTab)?.content)));
};
const FileUploader = ({ onFileSelect, accept, maxSize, label, className = '' }) => {
    const handleChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (maxSize && file.size > maxSize) {
                alert(`File size exceeds ${(maxSize / 1024 / 1024).toFixed(2)}MB limit`);
                return;
            }
            onFileSelect(file);
        }
    };
    return (React.createElement("div", { className: className },
        label && React.createElement("label", { className: "block text-sm font-medium text-gray-700 mb-2" }, label),
        React.createElement("label", { className: "flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-gray-50" },
            React.createElement("div", { className: "flex flex-col items-center justify-center pt-5 pb-6" },
                React.createElement("svg", { className: "w-10 h-10 mb-3 text-gray-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" },
                    React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" })),
                React.createElement("p", { className: "mb-2 text-sm text-gray-500" },
                    React.createElement("span", { className: "font-semibold" }, "Click to upload"),
                    " or drag and drop"),
                accept && React.createElement("p", { className: "text-xs text-gray-500" }, accept)),
            React.createElement("input", { type: "file", className: "hidden", accept: accept, onChange: handleChange }))));
};
function DataTable({ columns, data, searchable, className = '' }) {
    const [search, setSearch] = React.useState('');
    const [sortKey, setSortKey] = React.useState(null);
    const [sortDir, setSortDir] = React.useState('asc');
    const filtered = React.useMemo(() => {
        let result = [...data];
        if (search) {
            result = result.filter(item => Object.values(item).some(val => String(val).toLowerCase().includes(search.toLowerCase())));
        }
        if (sortKey) {
            result.sort((a, b) => {
                const aVal = a[sortKey];
                const bVal = b[sortKey];
                if (aVal < bVal)
                    return sortDir === 'asc' ? -1 : 1;
                if (aVal > bVal)
                    return sortDir === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [data, search, sortKey, sortDir]);
    return (React.createElement("div", { className: className },
        searchable && (React.createElement("div", { className: "mb-4" },
            React.createElement("input", { type: "search", value: search, onChange: e => setSearch(e.target.value), placeholder: "Search...", className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" }))),
        React.createElement(Table, { columns: columns, data: filtered })));
}
const Chart = ({ type, data, options, className = '' }) => {
    return (React.createElement("div", { className: `p-4 ${className}` },
        React.createElement("div", { className: "text-center text-gray-500" },
            "Chart component (integrate with chart.js or recharts)",
            React.createElement("br", null),
            "Type: ",
            type)));
};

/**
 * Utility functions for extension development
 */
/**
 * Validate extension manifest
 */
function validateManifest(manifest) {
    const errors = [];
    // Required fields
    if (!manifest.name || typeof manifest.name !== 'string') {
        errors.push('Manifest must have a valid "name" field');
    }
    if (!manifest.version || typeof manifest.version !== 'string') {
        errors.push('Manifest must have a valid "version" field');
    }
    if (!manifest.description || typeof manifest.description !== 'string') {
        errors.push('Manifest must have a valid "description" field');
    }
    if (!manifest.entry || typeof manifest.entry !== 'string') {
        errors.push('Manifest must have a valid "entry" field (URL to extension code)');
    }
    // Author validation
    if (!manifest.author || typeof manifest.author !== 'object') {
        errors.push('Manifest must have a valid "author" object');
    }
    else {
        if (!manifest.author.name || typeof manifest.author.name !== 'string') {
            errors.push('Author must have a valid "name" field');
        }
    }
    // Permissions validation
    if (!Array.isArray(manifest.permissions)) {
        errors.push('Manifest must have a "permissions" array');
    }
    else {
        const validPermissions = [
            'files.read',
            'files.write',
            'files.delete',
            'user.profile',
            'storage.quota',
            'api.access',
            'notifications'
        ];
        const invalidPerms = manifest.permissions.filter((p) => !validPermissions.includes(p));
        if (invalidPerms.length > 0) {
            errors.push(`Invalid permissions: ${invalidPerms.join(', ')}`);
        }
    }
    // Icons validation
    if (!manifest.icons || typeof manifest.icons !== 'object') {
        errors.push('Manifest must have an "icons" object with sizes 16, 48, and 128');
    }
    else {
        if (!manifest.icons['16'] || !manifest.icons['48'] || !manifest.icons['128']) {
            errors.push('Icons must include sizes: 16, 48, and 128');
        }
    }
    // Category validation
    const validCategories = ['productivity', 'utility', 'analytics', 'storage', 'security', 'entertainment', 'developer'];
    if (!manifest.category || !validCategories.includes(manifest.category)) {
        errors.push(`Category must be one of: ${validCategories.join(', ')}`);
    }
    // Version format validation (semver)
    if (manifest.version && !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
        errors.push('Version must follow semver format (e.g., 1.0.0)');
    }
    return {
        valid: errors.length === 0,
        errors
    };
}
/**
 * Create extension helper
 */
function createExtension(config) {
    return {
        name: config.name,
        version: config.version,
        description: config.description,
        author: config.author,
        entry: config.entry,
        permissions: config.permissions,
        icons: config.icons,
        category: config.category,
        repository: config.repository,
        screenshots: config.screenshots,
    };
}
/**
 * Format file size
 */
function formatFileSize(bytes) {
    if (bytes === 0)
        return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
/**
 * Format date
 */
function formatDate(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
/**
 * Debounce function
 */
function debounce(func, wait) {
    let timeout = null;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            func(...args);
        };
        if (timeout)
            clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
/**
 * Throttle function
 */
function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

exports.Badge = Badge;
exports.Button = Button;
exports.Card = Card;
exports.Chart = Chart;
exports.Checkbox = Checkbox;
exports.DataTable = DataTable;
exports.ExtensionContext = ExtensionContext;
exports.FileUploader = FileUploader;
exports.Form = Form;
exports.Input = Input;
exports.Modal = Modal;
exports.PermissionManager = PermissionManager;
exports.SQBadge = SQBadge;
exports.SQButton = SQButton;
exports.SQCard = SQCard;
exports.SQInput = SQInput;
exports.Select = Select;
exports.SquidCloudColors = SquidCloudColors;
exports.SquidCloudRadius = SquidCloudRadius;
exports.SquidCloudShadows = SquidCloudShadows;
exports.SquidCloudSpacing = SquidCloudSpacing;
exports.SquidCloudTypography = SquidCloudTypography;
exports.SquidLab = SquidLab;
exports.Switch = Switch;
exports.Table = Table;
exports.Tabs = Tabs;
exports.Toast = Toast;
exports.ToastContainer = ToastContainer;
exports.createExtension = createExtension;
exports.debounce = debounce;
exports.formatDate = formatDate;
exports.formatFileSize = formatFileSize;
exports.showToast = showToast;
exports.throttle = throttle;
exports.validateManifest = validateManifest;
//# sourceMappingURL=index.js.map

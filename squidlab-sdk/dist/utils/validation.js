/**
 * Utility functions for extension development
 */
/**
 * Validate extension manifest
 */
export function validateManifest(manifest) {
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
export function createExtension(config) {
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
export function formatFileSize(bytes) {
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
export function formatDate(date) {
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
export function debounce(func, wait) {
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
export function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

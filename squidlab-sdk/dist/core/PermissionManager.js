/**
 * PermissionManager - Manages extension permissions
 */
export class PermissionManager {
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

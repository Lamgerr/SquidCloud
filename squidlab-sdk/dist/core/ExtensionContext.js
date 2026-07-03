/**
 * ExtensionContext - Provides context information to extensions
 */
export class ExtensionContext {
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

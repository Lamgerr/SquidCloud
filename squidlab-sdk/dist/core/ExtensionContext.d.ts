/**
 * ExtensionContext - Provides context information to extensions
 */
import { ExtensionManifest } from '../types';
export declare class ExtensionContext {
    private manifest;
    private userId;
    private extensionId;
    constructor(manifest: ExtensionManifest, userId: string, extensionId: string);
    /**
     * Get extension manifest
     */
    getManifest(): ExtensionManifest;
    /**
     * Get extension name
     */
    getName(): string;
    /**
     * Get extension version
     */
    getVersion(): string;
    /**
     * Get current user ID
     */
    getUserId(): string;
    /**
     * Get extension ID
     */
    getExtensionId(): string;
    /**
     * Get extension author
     */
    getAuthor(): ExtensionManifest['author'];
    /**
     * Save extension settings (persisted in database)
     */
    saveSettings(settings: Record<string, any>): Promise<void>;
    /**
     * Load extension settings
     */
    loadSettings(): Promise<Record<string, any>>;
}
//# sourceMappingURL=ExtensionContext.d.ts.map
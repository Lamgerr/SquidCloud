/**
 * Utility functions for extension development
 */
import { ExtensionManifest, Permission } from '../types';
/**
 * Validate extension manifest
 */
export declare function validateManifest(manifest: any): {
    valid: boolean;
    errors: string[];
};
/**
 * Create extension helper
 */
export declare function createExtension(config: {
    name: string;
    version: string;
    description: string;
    author: {
        name: string;
        email?: string;
        url?: string;
    };
    permissions: Permission[];
    category: ExtensionManifest['category'];
    icons: {
        '16': string;
        '48': string;
        '128': string;
    };
    entry: string;
    repository?: string;
    screenshots?: string[];
}): ExtensionManifest;
/**
 * Format file size
 */
export declare function formatFileSize(bytes: number): string;
/**
 * Format date
 */
export declare function formatDate(date: string | Date): string;
/**
 * Debounce function
 */
export declare function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void;
/**
 * Throttle function
 */
export declare function throttle<T extends (...args: any[]) => any>(func: T, limit: number): (...args: Parameters<T>) => void;
//# sourceMappingURL=validation.d.ts.map
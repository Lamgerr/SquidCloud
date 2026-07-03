/**
 * PermissionManager - Manages extension permissions
 */
import { Permission } from '../types';
export declare class PermissionManager {
    private permissions;
    constructor(permissions: Permission[]);
    /**
     * Check if a specific permission is granted
     */
    hasPermission(permission: Permission): boolean;
    /**
     * Get all granted permissions
     */
    getPermissions(): Permission[];
    /**
     * Request a new permission (runtime)
     */
    requestPermission(permission: Permission): Promise<boolean>;
    /**
     * Check multiple permissions at once
     */
    hasPermissions(permissions: Permission[]): boolean;
}
//# sourceMappingURL=PermissionManager.d.ts.map
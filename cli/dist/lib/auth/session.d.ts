import { SquidSession } from '../crypto/ssp.js';
export declare function loadSession(): Promise<SquidSession | null>;
export declare function saveSession(session: SquidSession): Promise<void>;
export declare function clearSession(): Promise<void>;
export declare function isSessionExpired(session: SquidSession): boolean;
export declare function shouldRefreshToken(session: SquidSession): boolean;
export declare function getTimeUntilExpiry(session: SquidSession): number;

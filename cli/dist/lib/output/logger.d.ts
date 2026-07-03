export declare function setJsonMode(mode: boolean): void;
export declare function isJsonMode(): boolean;
interface LogOptions {
    prefix?: string;
}
export declare function log(message: string, options?: LogOptions): void;
export declare function logSuccess(message: string): void;
export declare function logError(message: string): void;
export declare function logWarn(message: string): void;
export declare function logInfo(message: string): void;
export declare function logBrand(message: string): void;
export declare function logRaw(message: string): void;
export declare function logJSON(data: unknown): void;
export declare function logErrorJSON(data: {
    message: string;
    code?: string;
}): void;
export declare function writeAudit(command: string, args: string, exitCode: number): void;
export {};

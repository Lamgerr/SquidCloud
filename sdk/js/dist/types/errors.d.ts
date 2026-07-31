export declare class SquidVeilError extends Error {
    readonly code: string;
    readonly status: number | null;
    constructor(message: string, code?: string, status?: number | null);
}
export declare class ConfigurationError extends SquidVeilError {
    constructor(message: string);
}
export declare class AuthenticationError extends SquidVeilError {
    constructor(message: string, code?: string, status?: number | null);
}
export declare class PermissionError extends SquidVeilError {
    constructor(message: string, code?: string);
}
export declare class NotFoundError extends SquidVeilError {
    constructor(message: string, code?: string, status?: number | null);
}
export declare class VeilRefError extends SquidVeilError {
    constructor(message: string, code: string, status?: number | null);
}
export declare class RateLimitedError extends SquidVeilError {
    readonly retryAfterMs: number | null;
    constructor(message: string, retryAfterMs?: number | null);
}
export declare class ServerError extends SquidVeilError {
    constructor(message: string, code?: string, status?: number | null);
}
export declare class NetworkError extends SquidVeilError {
    constructor(message: string);
}
export declare function errorFromResponse(status: number, json: unknown, headers: Headers): SquidVeilError;

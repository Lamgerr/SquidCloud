interface RequestOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    authenticated?: boolean;
    retries?: number;
}
export declare function apiRequest<T>(path: string, options?: RequestOptions): Promise<T>;
export declare class ApiError extends Error {
    status: number;
    details?: unknown | undefined;
    constructor(message: string, status: number, details?: unknown | undefined);
}
export declare function apiGet<T>(path: string, options?: RequestOptions): Promise<T>;
export declare function apiPost<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
export declare function apiPut<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
export declare function apiDelete<T>(path: string, options?: RequestOptions): Promise<T>;
export declare function apiUpload<T>(path: string, formData: FormData, options?: RequestOptions): Promise<T>;
export {};

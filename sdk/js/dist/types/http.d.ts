export interface HttpRequestOptions {
    url: string;
    method: "GET" | "POST" | "PUT" | "DELETE";
    token?: string;
    deviceFingerprint?: string;
    body?: Record<string, unknown>;
    timeoutMs: number;
    maxRetries: number;
}
export interface HttpResponse {
    status: number;
    json: unknown;
    headers: Headers;
}
export declare function httpRequest(opts: HttpRequestOptions): Promise<HttpResponse>;

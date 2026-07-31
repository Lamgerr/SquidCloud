import { NetworkError, errorFromResponse } from "./errors.js";
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
export async function httpRequest(opts) {
    const headers = new Headers({ Accept: "application/json" });
    headers.set("User-Agent", "@squidcloud-kodai/squidveil-js/0.1.0");
    if (opts.token)
        headers.set("Authorization", `Bearer ${opts.token}`);
    if (opts.deviceFingerprint)
        headers.set("x-squidveil-device", opts.deviceFingerprint);
    let body;
    if (opts.body !== undefined) {
        body = JSON.stringify(opts.body);
        headers.set("Content-Type", "application/json");
    }
    let lastError = null;
    let lastStatus = 0;
    let lastHeaders = new Headers();
    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        const started = Date.now();
        try {
            const res = await fetch(opts.url, {
                method: opts.method,
                headers,
                body,
                signal: AbortSignal.timeout(opts.timeoutMs),
            });
            lastStatus = res.status;
            lastHeaders = res.headers;
            const json = await res.json().catch(() => null);
            if (!RETRYABLE_STATUSES.has(res.status) || attempt >= opts.maxRetries) {
                return { status: res.status, json, headers: res.headers };
            }
            await sleepForBackoff(attempt, res.headers);
        }
        catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            const aborted = lastError instanceof DOMException && lastError.name === "TimeoutError";
            if (aborted || attempt >= opts.maxRetries) {
                if (aborted) {
                    throw new NetworkError(`Request timed out after ${opts.timeoutMs}ms: ${opts.url}`);
                }
                throw new NetworkError(`Request to ${opts.url} failed: ${lastError.message}`);
            }
            await sleepForBackoff(attempt, null);
        }
    }
    throw errorFromResponse(lastStatus, null, lastHeaders);
}
function sleepForBackoff(attempt, headers) {
    const retryAfter = headers?.get("retry-after");
    let delayMs;
    if (retryAfter !== null && retryAfter !== undefined && Number.isFinite(Number(retryAfter))) {
        delayMs = Number(retryAfter) * 1000;
    }
    else {
        const base = 250 * 2 ** attempt;
        delayMs = Math.random() * base;
    }
    return new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 10_000)));
}

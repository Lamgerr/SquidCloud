"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkError = exports.ServerError = exports.RateLimitedError = exports.VeilRefError = exports.NotFoundError = exports.PermissionError = exports.AuthenticationError = exports.ConfigurationError = exports.SquidVeilError = void 0;
exports.errorFromResponse = errorFromResponse;
class SquidVeilError extends Error {
    code;
    status;
    constructor(message, code = "ERROR", status = null) {
        super(message);
        this.name = "SquidVeilError";
        this.code = code;
        this.status = status;
    }
}
exports.SquidVeilError = SquidVeilError;
class ConfigurationError extends SquidVeilError {
    constructor(message) {
        super(message, "CONFIGURATION");
        this.name = "ConfigurationError";
    }
}
exports.ConfigurationError = ConfigurationError;
class AuthenticationError extends SquidVeilError {
    constructor(message, code = "INVALID_TOKEN", status = null) {
        super(message, code, status);
        this.name = "AuthenticationError";
    }
}
exports.AuthenticationError = AuthenticationError;
class PermissionError extends SquidVeilError {
    constructor(message, code = "FORBIDDEN") {
        super(message, code, 403);
        this.name = "PermissionError";
    }
}
exports.PermissionError = PermissionError;
class NotFoundError extends SquidVeilError {
    constructor(message, code = "NOT_FOUND", status = null) {
        super(message, code, status);
        this.name = "NotFoundError";
    }
}
exports.NotFoundError = NotFoundError;
class VeilRefError extends SquidVeilError {
    constructor(message, code, status = null) {
        super(message, code, status);
        this.name = "VeilRefError";
    }
}
exports.VeilRefError = VeilRefError;
class RateLimitedError extends SquidVeilError {
    retryAfterMs;
    constructor(message, retryAfterMs = null) {
        super(message, "RATE_LIMITED", 429);
        this.name = "RateLimitedError";
        this.retryAfterMs = retryAfterMs;
    }
}
exports.RateLimitedError = RateLimitedError;
class ServerError extends SquidVeilError {
    constructor(message, code = "SERVER_ERROR", status = null) {
        super(message, code, status);
        this.name = "ServerError";
    }
}
exports.ServerError = ServerError;
class NetworkError extends SquidVeilError {
    constructor(message) {
        super(message, "NETWORK");
        this.name = "NetworkError";
    }
}
exports.NetworkError = NetworkError;
const VEILREF_CODES = new Set([
    "CONSUMED",
    "EXPIRED",
    "BAD_SIGNATURE",
    "DEVICE_MISMATCH",
    "CONCURRENT_CONSUME",
    "OP_NOT_ALLOWED",
]);
function errorFromResponse(status, json, headers) {
    const data = (typeof json === "object" && json !== null ? json : {});
    const message = String(data.error ?? data.message ?? `HTTP ${status}`);
    const code = String(data.code ?? "ERROR");
    if (VEILREF_CODES.has(code))
        return new VeilRefError(message, code, status);
    if (status === 401)
        return new AuthenticationError(message, code, status);
    if (status === 403)
        return new PermissionError(message, code);
    if (status === 404)
        return new NotFoundError(message, code, status);
    if (status === 429) {
        const retryAfter = headers.get("retry-after");
        const retryAfterMs = retryAfter !== null && Number.isFinite(Number(retryAfter)) ? Number(retryAfter) * 1000 : null;
        return new RateLimitedError(message, retryAfterMs);
    }
    if (status >= 500)
        return new ServerError(message, code, status);
    return new SquidVeilError(message, code, status);
}

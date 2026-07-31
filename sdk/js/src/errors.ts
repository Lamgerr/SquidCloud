export class SquidVeilError extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(message: string, code = "ERROR", status: number | null = null) {
    super(message);
    this.name = "SquidVeilError";
    this.code = code;
    this.status = status;
  }
}

export class ConfigurationError extends SquidVeilError {
  constructor(message: string) {
    super(message, "CONFIGURATION");
    this.name = "ConfigurationError";
  }
}

export class AuthenticationError extends SquidVeilError {
  constructor(message: string, code = "INVALID_TOKEN", status: number | null = null) {
    super(message, code, status);
    this.name = "AuthenticationError";
  }
}

export class PermissionError extends SquidVeilError {
  constructor(message: string, code = "FORBIDDEN") {
    super(message, code, 403);
    this.name = "PermissionError";
  }
}

export class NotFoundError extends SquidVeilError {
  constructor(message: string, code = "NOT_FOUND", status: number | null = null) {
    super(message, code, status);
    this.name = "NotFoundError";
  }
}

export class VeilRefError extends SquidVeilError {
  constructor(message: string, code: string, status: number | null = null) {
    super(message, code, status);
    this.name = "VeilRefError";
  }
}

export class RateLimitedError extends SquidVeilError {
  readonly retryAfterMs: number | null;

  constructor(message: string, retryAfterMs: number | null = null) {
    super(message, "RATE_LIMITED", 429);
    this.name = "RateLimitedError";
    this.retryAfterMs = retryAfterMs;
  }
}

export class ServerError extends SquidVeilError {
  constructor(message: string, code = "SERVER_ERROR", status: number | null = null) {
    super(message, code, status);
    this.name = "ServerError";
  }
}

export class NetworkError extends SquidVeilError {
  constructor(message: string) {
    super(message, "NETWORK");
    this.name = "NetworkError";
  }
}

const VEILREF_CODES = new Set([
  "CONSUMED",
  "EXPIRED",
  "BAD_SIGNATURE",
  "DEVICE_MISMATCH",
  "CONCURRENT_CONSUME",
  "OP_NOT_ALLOWED",
]);

export function errorFromResponse(status: number, json: unknown, headers: Headers): SquidVeilError {
  const data = (typeof json === "object" && json !== null ? json : {}) as Record<string, unknown>;
  const message = String(data.error ?? data.message ?? `HTTP ${status}`);
  const code = String(data.code ?? "ERROR");

  if (VEILREF_CODES.has(code)) return new VeilRefError(message, code, status);
  if (status === 401) return new AuthenticationError(message, code, status);
  if (status === 403) return new PermissionError(message, code);
  if (status === 404) return new NotFoundError(message, code, status);
  if (status === 429) {
    const retryAfter = headers.get("retry-after");
    const retryAfterMs = retryAfter !== null && Number.isFinite(Number(retryAfter)) ? Number(retryAfter) * 1000 : null;
    return new RateLimitedError(message, retryAfterMs);
  }
  if (status >= 500) return new ServerError(message, code, status);
  return new SquidVeilError(message, code, status);
}

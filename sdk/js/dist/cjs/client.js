"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SquidVeilClient = void 0;
const errors_js_1 = require("./errors.js");
const http_js_1 = require("./http.js");
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
class TtlCache {
    ttlMs;
    items = new Map();
    constructor(ttlMs) {
        this.ttlMs = ttlMs;
    }
    get(key) {
        if (this.ttlMs <= 0)
            return null;
        const item = this.items.get(key);
        if (!item)
            return null;
        if (Date.now() - item.at > this.ttlMs) {
            this.items.delete(key);
            return null;
        }
        return item.value;
    }
    set(key, value) {
        if (this.ttlMs <= 0)
            return;
        this.items.set(key, { at: Date.now(), value });
    }
    clear() {
        this.items.clear();
    }
}
function env(key) {
    if (typeof process !== "undefined" && process.env) {
        return process.env[key];
    }
    return undefined;
}
function requireString(value, name, envName) {
    if (value && value.trim().length > 0)
        return value.trim();
    const fromEnv = env(envName);
    if (fromEnv && fromEnv.trim().length > 0)
        return fromEnv.trim();
    throw new errors_js_1.ConfigurationError(`${name} is required (or set ${envName})`);
}
class SquidVeilClient {
    url;
    token;
    timeoutMs;
    maxRetries;
    deviceFingerprint;
    cache;
    constructor(options = {}) {
        this.url = (options.url || env("SQUIDVEIL_URL") || "").replace(/\/+$/, "");
        if (!this.url)
            throw new errors_js_1.ConfigurationError("url is required (or set SQUIDVEIL_URL)");
        this.token = requireString(options.token, "token", "SQUIDVEIL_TOKEN");
        this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
        this.deviceFingerprint = options.deviceFingerprint;
        this.cache = new TtlCache(options.cacheTtlMs ?? 0);
    }
    static fromEnv(options = {}) {
        return new SquidVeilClient(options);
    }
    toString() {
        return `<SquidVeilClient url=${this.url} token=***>`;
    }
    clearCache() {
        this.cache.clear();
    }
    async request(method, path, body) {
        const res = await (0, http_js_1.httpRequest)({
            url: this.url + path,
            method,
            token: this.token,
            deviceFingerprint: this.deviceFingerprint,
            body,
            timeoutMs: this.timeoutMs,
            maxRetries: this.maxRetries,
        });
        if (res.status >= 400)
            throw (0, errors_js_1.errorFromResponse)(res.status, res.json, res.headers);
        return res.json;
    }
    async health() {
        return this.request("GET", "/health");
    }
    async getSecret(name, version) {
        const cacheKey = `${name}:${version ?? "latest"}`;
        const cached = this.cache.get(cacheKey);
        if (cached)
            return cached;
        const query = version !== undefined ? `?version=${version}` : "";
        const data = await this.request("GET", `/v1/secrets/${quote(name)}${query}`);
        const result = {
            name: String(data.name ?? name),
            value: String(data.value ?? ""),
            version: Number(data.version ?? 0),
            secretType: String(data.secret_type ?? "opaque"),
        };
        this.cache.set(cacheKey, result);
        return result;
    }
    async listSecrets() {
        const data = await this.request("GET", "/v1/secrets");
        return (data.secrets ?? []).map(secretMetaFromJson);
    }
    async listVersions(name) {
        const data = await this.request("GET", `/v1/secrets/${quote(name)}/versions`);
        return (data.versions ?? []).map((v) => ({
            versionNumber: Number(v.version_number),
            state: String(v.state),
            createdBy: String(v.created_by),
            createdAt: String(v.created_at),
            destroyedAt: v.destroyed_at,
            keyId: String(v.key_id),
        }));
    }
    async rotationStatus(name) {
        const data = await this.request("GET", `/v1/secrets/${quote(name)}/rotation`);
        const r = data.rotation ?? {};
        return {
            enabled: Boolean(r.enabled),
            intervalDays: Number(r.interval_days ?? 30),
            lastRotatedAt: r.last_rotated_at,
            nextRotatedAt: r.next_rotation_at,
            source: String(r.source ?? "auto_generated"),
        };
    }
    async issueVeilRef(secretName, options = {}) {
        const body = {
            secret_name: secretName,
            max_uses: options.maxUses ?? 1,
            ref_ttl: options.refTtl ?? 60,
        };
        if (options.opsAllowed)
            body.ops_allowed = options.opsAllowed;
        if (options.version !== undefined)
            body.version = options.version;
        const data = await this.request("POST", "/v1/veilref", body);
        const ref = JSON.parse(data.veil_ref_json);
        return {
            refId: String(ref.ref_id),
            secretName: String(ref.secret_name),
            versionNumber: Number(ref.version_number),
            issuedAt: String(ref.issued_at),
            expiresAt: String(ref.expires_at),
            useCountMax: Number(ref.use_count_max),
            useCountUsed: Number(ref.use_count_used),
            opsAllowed: Array.isArray(ref.ops_allowed) ? ref.ops_allowed : [],
            deviceBound: Boolean(ref.device_bound),
            json: data.veil_ref_json,
        };
    }
    async verifyVeilRef(veilRefJson) {
        const data = await this.request("POST", "/v1/veilref/verify", { veil_ref_json: veilRefJson });
        return {
            verified: Boolean(data.verified),
            secretName: String(data.secret_name ?? ""),
            versionNumber: Number(data.version_number ?? 0),
        };
    }
    async resolveVeilRef(veilRefJson) {
        const data = await this.request("POST", "/v1/veilref/resolve", { veil_ref_json: veilRefJson });
        return {
            value: String(data.value ?? ""),
            secretName: String(data.secret_name ?? ""),
            versionNumber: Number(data.version_number ?? 0),
        };
    }
    async createSecret(name, value, options = {}) {
        const data = await this.request("POST", "/v1/secrets", {
            name,
            value,
            secret_type: options.secretType ?? "opaque",
            description: options.description ?? "",
        });
        return secretMetaFromJson(data.secret);
    }
    async rotateSecret(name, value) {
        const body = value !== undefined ? { value } : {};
        const data = await this.request("POST", `/v1/secrets/${quote(name)}/rotate`, body);
        return Boolean(data.rotated);
    }
    async configureRotation(name, enabled, intervalDays = 30) {
        await this.request("POST", `/v1/secrets/${quote(name)}/rotation`, { enabled, interval_days: intervalDays });
    }
    async softDelete(name) {
        await this.request("DELETE", `/v1/secrets/${quote(name)}`);
    }
    async undelete(name) {
        await this.request("POST", `/v1/secrets/${quote(name)}/undelete`, {});
    }
    async destroy(name) {
        await this.request("POST", `/v1/secrets/${quote(name)}/destroy`, {});
    }
    async auditVerify() {
        const data = await this.request("GET", "/v1/audit/verify");
        return {
            valid: Boolean(data.valid),
            checked: Number(data.checked ?? 0),
            lastSeq: Number(data.last_seq ?? 0),
        };
    }
}
exports.SquidVeilClient = SquidVeilClient;
function quote(name) {
    return encodeURIComponent(name);
}
function secretMetaFromJson(s) {
    return {
        id: String(s.id ?? ""),
        name: String(s.name ?? ""),
        description: String(s.description ?? ""),
        labels: s.labels ?? {},
        secretType: String(s.secret_type ?? ""),
        recoveryWindowDays: Number(s.recovery_window_days ?? 0),
        createdAt: String(s.created_at ?? ""),
        updatedAt: String(s.updated_at ?? ""),
        deletedAt: s.deleted_at,
    };
}

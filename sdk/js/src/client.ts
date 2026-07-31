import {
  AuditStatus,
  ClientOptions,
  Resolution,
  RotationStatus,
  SecretMeta,
  SecretValue,
  VeilRef,
  VeilRefIssueOptions,
  VerificationResult,
  VersionInfo,
} from "./types.js";
import { ConfigurationError, errorFromResponse } from "./errors.js";
import { httpRequest } from "./http.js";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;

class TtlCache {
  private readonly ttlMs: number;
  private readonly items = new Map<string, { at: number; value: unknown }>();

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  get<T>(key: string): T | null {
    if (this.ttlMs <= 0) return null;
    const item = this.items.get(key);
    if (!item) return null;
    if (Date.now() - item.at > this.ttlMs) {
      this.items.delete(key);
      return null;
    }
    return item.value as T;
  }

  set(key: string, value: unknown): void {
    if (this.ttlMs <= 0) return;
    this.items.set(key, { at: Date.now(), value });
  }

  clear(): void {
    this.items.clear();
  }
}

function env(key: string): string | undefined {
  if (typeof process !== "undefined" && process.env) {
    return process.env[key];
  }
  return undefined;
}

function requireString(value: string | undefined, name: string, envName: string): string {
  if (value && value.trim().length > 0) return value.trim();
  const fromEnv = env(envName);
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();
  throw new ConfigurationError(`${name} is required (or set ${envName})`);
}

export class SquidVeilClient {
  readonly url: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly deviceFingerprint?: string;
  private readonly cache: TtlCache;

  constructor(options: ClientOptions = {}) {
    this.url = (options.url || env("SQUIDVEIL_URL") || "").replace(/\/+$/, "");
    if (!this.url) throw new ConfigurationError("url is required (or set SQUIDVEIL_URL)");
    this.token = requireString(options.token, "token", "SQUIDVEIL_TOKEN");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.deviceFingerprint = options.deviceFingerprint;
    this.cache = new TtlCache(options.cacheTtlMs ?? 0);
  }

  static fromEnv(options: Omit<ClientOptions, "url" | "token"> = {}): SquidVeilClient {
    return new SquidVeilClient(options);
  }

  toString(): string {
    return `<SquidVeilClient url=${this.url} token=***>`;
  }

  clearCache(): void {
    this.cache.clear();
  }

  private async request<T>(method: "GET" | "POST" | "PUT" | "DELETE", path: string, body?: Record<string, unknown>): Promise<T> {
    const res = await httpRequest({
      url: this.url + path,
      method,
      token: this.token,
      deviceFingerprint: this.deviceFingerprint,
      body,
      timeoutMs: this.timeoutMs,
      maxRetries: this.maxRetries,
    });
    if (res.status >= 400) throw errorFromResponse(res.status, res.json, res.headers);
    return res.json as T;
  }

  async health(): Promise<{ ok: boolean; service: string; version: number }> {
    return this.request("GET", "/health");
  }

  async getSecret(name: string, version?: number): Promise<SecretValue> {
    const cacheKey = `${name}:${version ?? "latest"}`;
    const cached = this.cache.get<SecretValue>(cacheKey);
    if (cached) return cached;
    const query = version !== undefined ? `?version=${version}` : "";
    const data = await this.request<Record<string, unknown>>("GET", `/v1/secrets/${quote(name)}${query}`);
    const result: SecretValue = {
      name: String(data.name ?? name),
      value: String(data.value ?? ""),
      version: Number(data.version ?? 0),
      secretType: String(data.secret_type ?? "opaque"),
    };
    this.cache.set(cacheKey, result);
    return result;
  }

  async listSecrets(): Promise<SecretMeta[]> {
    const data = await this.request<{ secrets: Array<Record<string, unknown>> }>("GET", "/v1/secrets");
    return (data.secrets ?? []).map(secretMetaFromJson);
  }

  async listVersions(name: string): Promise<VersionInfo[]> {
    const data = await this.request<{ versions: Array<Record<string, unknown>> }>("GET", `/v1/secrets/${quote(name)}/versions`);
    return (data.versions ?? []).map((v) => ({
      versionNumber: Number(v.version_number),
      state: String(v.state),
      createdBy: String(v.created_by),
      createdAt: String(v.created_at),
      destroyedAt: v.destroyed_at as string | null,
      keyId: String(v.key_id),
    }));
  }

  async rotationStatus(name: string): Promise<RotationStatus> {
    const data = await this.request<{ rotation: Record<string, unknown> }>("GET", `/v1/secrets/${quote(name)}/rotation`);
    const r = data.rotation ?? {};
    return {
      enabled: Boolean(r.enabled),
      intervalDays: Number(r.interval_days ?? 30),
      lastRotatedAt: r.last_rotated_at as string | null,
      nextRotatedAt: r.next_rotation_at as string | null,
      source: String(r.source ?? "auto_generated"),
    };
  }

  async issueVeilRef(secretName: string, options: VeilRefIssueOptions = {}): Promise<VeilRef> {
    const body: Record<string, unknown> = {
      secret_name: secretName,
      max_uses: options.maxUses ?? 1,
      ref_ttl: options.refTtl ?? 60,
    };
    if (options.opsAllowed) body.ops_allowed = options.opsAllowed;
    if (options.version !== undefined) body.version = options.version;

    const data = await this.request<{ veil_ref_json: string }>("POST", "/v1/veilref", body);
    const ref = JSON.parse(data.veil_ref_json) as Record<string, unknown>;
    return {
      refId: String(ref.ref_id),
      secretName: String(ref.secret_name),
      versionNumber: Number(ref.version_number),
      issuedAt: String(ref.issued_at),
      expiresAt: String(ref.expires_at),
      useCountMax: Number(ref.use_count_max),
      useCountUsed: Number(ref.use_count_used),
      opsAllowed: Array.isArray(ref.ops_allowed) ? (ref.ops_allowed as string[]) : [],
      deviceBound: Boolean(ref.device_bound),
      json: data.veil_ref_json,
    };
  }

  async verifyVeilRef(veilRefJson: string): Promise<VerificationResult> {
    const data = await this.request<Record<string, unknown>>("POST", "/v1/veilref/verify", { veil_ref_json: veilRefJson });
    return {
      verified: Boolean(data.verified),
      secretName: String(data.secret_name ?? ""),
      versionNumber: Number(data.version_number ?? 0),
    };
  }

  async resolveVeilRef(veilRefJson: string): Promise<Resolution> {
    const data = await this.request<Record<string, unknown>>("POST", "/v1/veilref/resolve", { veil_ref_json: veilRefJson });
    return {
      value: String(data.value ?? ""),
      secretName: String(data.secret_name ?? ""),
      versionNumber: Number(data.version_number ?? 0),
    };
  }

  async createSecret(name: string, value: string, options: { secretType?: string; description?: string } = {}): Promise<SecretMeta> {
    const data = await this.request<{ secret: Record<string, unknown> }>("POST", "/v1/secrets", {
      name,
      value,
      secret_type: options.secretType ?? "opaque",
      description: options.description ?? "",
    });
    return secretMetaFromJson(data.secret);
  }

  async rotateSecret(name: string, value?: string): Promise<boolean> {
    const body = value !== undefined ? { value } : {};
    const data = await this.request<{ rotated: boolean }>("POST", `/v1/secrets/${quote(name)}/rotate`, body);
    return Boolean(data.rotated);
  }

  async configureRotation(name: string, enabled: boolean, intervalDays = 30): Promise<void> {
    await this.request("POST", `/v1/secrets/${quote(name)}/rotation`, { enabled, interval_days: intervalDays });
  }

  async softDelete(name: string): Promise<void> {
    await this.request("DELETE", `/v1/secrets/${quote(name)}`);
  }

  async undelete(name: string): Promise<void> {
    await this.request("POST", `/v1/secrets/${quote(name)}/undelete`, {});
  }

  async destroy(name: string): Promise<void> {
    await this.request("POST", `/v1/secrets/${quote(name)}/destroy`, {});
  }

  async auditVerify(): Promise<AuditStatus> {
    const data = await this.request<Record<string, unknown>>("GET", "/v1/audit/verify");
    return {
      valid: Boolean(data.valid),
      checked: Number(data.checked ?? 0),
      lastSeq: Number(data.last_seq ?? 0),
    };
  }
}

function quote(name: string): string {
  return encodeURIComponent(name);
}

function secretMetaFromJson(s: Record<string, unknown>): SecretMeta {
  return {
    id: String(s.id ?? ""),
    name: String(s.name ?? ""),
    description: String(s.description ?? ""),
    labels: (s.labels as Record<string, string> | undefined) ?? {},
    secretType: String(s.secret_type ?? ""),
    recoveryWindowDays: Number(s.recovery_window_days ?? 0),
    createdAt: String(s.created_at ?? ""),
    updatedAt: String(s.updated_at ?? ""),
    deletedAt: s.deleted_at as string | null,
  };
}

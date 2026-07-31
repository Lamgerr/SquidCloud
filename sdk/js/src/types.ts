export interface SecretValue {
  name: string;
  value: string;
  version: number;
  secretType: string;
}

export interface SecretMeta {
  id: string;
  name: string;
  description: string;
  labels: Record<string, string>;
  secretType: string;
  recoveryWindowDays: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface VeilRef {
  refId: string;
  secretName: string;
  versionNumber: number;
  issuedAt: string;
  expiresAt: string;
  useCountMax: number;
  useCountUsed: number;
  opsAllowed: string[];
  deviceBound: boolean;
  json: string;
}

export interface VerificationResult {
  verified: boolean;
  secretName: string;
  versionNumber: number;
}

export interface Resolution {
  value: string;
  secretName: string;
  versionNumber: number;
}

export interface AuditStatus {
  valid: boolean;
  checked: number;
  lastSeq: number;
}

export interface RotationStatus {
  enabled: boolean;
  intervalDays: number;
  lastRotatedAt: string | null;
  nextRotatedAt: string | null;
  source: string;
}

export interface VersionInfo {
  versionNumber: number;
  state: string;
  createdBy: string;
  createdAt: string;
  destroyedAt: string | null;
  keyId: string;
}

export interface VeilRefIssueOptions {
  maxUses?: number;
  refTtl?: number;
  opsAllowed?: Array<"resolve" | "verify">;
  version?: number;
}

export interface ClientOptions {
  url?: string;
  token?: string;
  timeoutMs?: number;
  maxRetries?: number;
  cacheTtlMs?: number;
  deviceFingerprint?: string;
}

export interface BrowserVerifyOptions {
  url: string;
  timeoutMs?: number;
  maxRetries?: number;
  deviceFingerprint?: string;
}

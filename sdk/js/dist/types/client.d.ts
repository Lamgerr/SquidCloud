import { AuditStatus, ClientOptions, Resolution, RotationStatus, SecretMeta, SecretValue, VeilRef, VeilRefIssueOptions, VerificationResult, VersionInfo } from "./types.js";
export declare class SquidVeilClient {
    readonly url: string;
    private readonly token;
    private readonly timeoutMs;
    private readonly maxRetries;
    private readonly deviceFingerprint?;
    private readonly cache;
    constructor(options?: ClientOptions);
    static fromEnv(options?: Omit<ClientOptions, "url" | "token">): SquidVeilClient;
    toString(): string;
    clearCache(): void;
    private request;
    health(): Promise<{
        ok: boolean;
        service: string;
        version: number;
    }>;
    getSecret(name: string, version?: number): Promise<SecretValue>;
    listSecrets(): Promise<SecretMeta[]>;
    listVersions(name: string): Promise<VersionInfo[]>;
    rotationStatus(name: string): Promise<RotationStatus>;
    issueVeilRef(secretName: string, options?: VeilRefIssueOptions): Promise<VeilRef>;
    verifyVeilRef(veilRefJson: string): Promise<VerificationResult>;
    resolveVeilRef(veilRefJson: string): Promise<Resolution>;
    createSecret(name: string, value: string, options?: {
        secretType?: string;
        description?: string;
    }): Promise<SecretMeta>;
    rotateSecret(name: string, value?: string): Promise<boolean>;
    configureRotation(name: string, enabled: boolean, intervalDays?: number): Promise<void>;
    softDelete(name: string): Promise<void>;
    undelete(name: string): Promise<void>;
    destroy(name: string): Promise<void>;
    auditVerify(): Promise<AuditStatus>;
}

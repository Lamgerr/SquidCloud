export declare class SquidVeilWasm {
    private sessionId;
    connect(deviceFingerprint?: string): Promise<string>;
    get connected(): boolean;
    createVeilRef(secretName: string, ops_allowed?: string[], ref_ttl?: number, max_uses?: number): Promise<string>;
    verifyVeilRef(refJson: string): Promise<boolean>;
    resolveVeilRef(refJson: string): Promise<string>;
    encrypt(plaintext: string): Promise<{
        ciphertext: string;
        iv: string;
    }>;
    decrypt(ciphertextB64: string, ivB64: string): Promise<string>;
    sha256Hex(data: string): string;
}
export default SquidVeilWasm;
//# sourceMappingURL=index.d.ts.map
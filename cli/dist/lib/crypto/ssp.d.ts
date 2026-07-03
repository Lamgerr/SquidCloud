export interface SSPHello {
    email: string;
    password_proof: string;
    client_ephemeral_pub: string;
    client_nonce: string;
    device_fingerprint: string;
    timestamp: number;
}
export interface SSPResponse {
    server_nonce: string;
    server_ephemeral_pub: string;
    server_signature: string;
    encrypted_session: string;
    session_iv: string;
    session_tag: string;
}
export interface SquidSession {
    session_id: string;
    access_token: string;
    refresh_token: string;
    refresh_token_id: string;
    device_fingerprint: string;
    issued_at: number;
    expires_at: number;
    user: {
        id: string;
        email: string;
        username: string;
        plan: 'free' | 'pro' | 'team';
    };
    api_key?: string;
}
export declare function generateKeypair(): {
    pub: Uint8Array;
    priv: Uint8Array;
};
export declare function generateNonce(): Uint8Array;
export declare function hashPassword(password: string, email: string): Buffer;
export declare function computeDeviceFingerprint(machineId: string): string;
export declare function computeSignPayload(clientNonce: Uint8Array, serverNonce: Uint8Array, clientPub: Uint8Array, timestamp: number): Uint8Array;
export declare function deriveSharedSecret(pub: Uint8Array, priv: Uint8Array): Uint8Array;
export declare function deriveEncryptionKey(ecdhSecret: Uint8Array, clientNonce: Uint8Array, serverNonce: Uint8Array): Uint8Array;
export declare function encryptSession(session: SquidSession, key: Uint8Array): {
    ciphertext: Uint8Array;
    iv: Uint8Array;
    tag: Uint8Array;
};
export declare function decryptSession(encrypted: Uint8Array, iv: Uint8Array, tag: Uint8Array, key: Uint8Array): SquidSession;
export declare function verifyServerSignature(signature: Uint8Array, payload: Uint8Array, serverPub: Uint8Array): Promise<boolean>;
export declare function signPayload(priv: Uint8Array, payload: Uint8Array): Promise<Uint8Array>;
export declare function computeHMAC(key: Uint8Array, data: string): string;
export declare function bytesToHex(buf: Uint8Array): string;
export declare function hexToBytes(hex: string): Uint8Array;

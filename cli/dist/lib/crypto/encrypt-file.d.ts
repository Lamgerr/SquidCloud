export interface EncryptedChunkResult {
    index: number;
    totalChunks: number;
    size: number;
    offset: number;
    sha256: string;
    encryptedBase64: string;
}
export interface FileEncryptionResult {
    encryptionKey: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    chunks: EncryptedChunkResult[];
}
export declare function encryptFile(data: Uint8Array, fileName: string, fileType: string, encryptionKey?: string): FileEncryptionResult;

export declare function uploadFileWithProgress(url: string, fileContent: Buffer, filename: string, headers: Record<string, string>, onProgress: (bytes: number) => void): Promise<Response>;

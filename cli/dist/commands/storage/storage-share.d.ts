export default function storageShare(path: string, options?: {
    expires?: string;
    password?: string;
    views?: number;
    burn?: boolean;
}): Promise<void>;

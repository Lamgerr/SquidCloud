export default function storageUpload(local: string, remote?: string, options?: {
    ignore?: string;
    dryRun?: boolean;
}): Promise<void>;

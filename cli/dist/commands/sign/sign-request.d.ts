export default function signRequest(file: string, options: {
    to?: string | string[];
    order?: boolean;
}): Promise<void>;

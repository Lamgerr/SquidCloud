export default function authRevoke(options: {
    session?: string;
    all?: boolean;
}): Promise<void>;

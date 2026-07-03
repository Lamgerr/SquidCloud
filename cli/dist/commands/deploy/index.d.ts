export default function deploy(target?: string, options?: {
    name?: string;
    env?: string;
    preview?: boolean;
    noWait?: boolean;
    force?: boolean;
    output?: string;
}): Promise<void>;

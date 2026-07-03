interface RunOptions {
    env?: string[];
    dryRun?: boolean;
}
export default function scriptsRun(name: string, options?: RunOptions): Promise<void>;
export {};

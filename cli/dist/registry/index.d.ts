export type CommandCategory = 'auth' | 'storage' | 'deploy' | 'sites' | 'scripts' | 'automations' | 'forms' | 'sign' | 'time' | 'monitor' | 'logs' | 'collab' | 'tunnel' | 'id' | 'project' | 'utility';
export interface CommandDescriptor {
    name: string;
    aliases: string[];
    description: string;
    requiresAuth: boolean;
    requiresProject: boolean;
    ciSafe: boolean;
    jsonSupport: boolean;
    dangerLevel: 'safe' | 'caution' | 'destructive';
    category: CommandCategory;
    handler: () => Promise<{
        default: (...args: unknown[]) => void | Promise<void>;
    }>;
}
export declare function getCommand(name: string): CommandDescriptor | undefined;
export declare function getCategory(cat: CommandCategory): CommandDescriptor[];
export declare function getAllCommands(): CommandDescriptor[];
export declare function getCISafeCommands(): CommandDescriptor[];

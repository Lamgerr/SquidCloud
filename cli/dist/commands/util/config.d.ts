import Conf from 'conf';
declare const config: Conf<{
    defaultEnvironment: string;
    autoCopyUrl: boolean;
    outputFormat: string;
    checkUpdates: boolean;
}>;
export declare function getConfig(): Conf;
export default function configList(): Promise<void>;
export { config };

import Conf from 'conf';
export interface Config {
    apiKey?: string;
    apiUrl?: string;
    projectId?: string;
}
declare const store: Conf<Config>;
export declare function getApiKey(): string;
export declare function getApiUrl(): string;
export default store;

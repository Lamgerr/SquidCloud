import { Ora } from 'ora';
declare const SPINNER_FRAMES: Record<string, ora.Options>;
export declare function createSpinner(text: string, style?: keyof typeof SPINNER_FRAMES): Ora;
export {};

export type DeployType = 'single-file' | 'codebase' | 'invalid';
export interface DetectedProject {
    type: DeployType;
    rootPath: string;
    hasIndexHtml: boolean;
    htmlFiles: string[];
    totalFiles: number;
}
export declare function detectProject(targetPath: string): Promise<DetectedProject>;

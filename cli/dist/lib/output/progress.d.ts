import cliProgress from 'cli-progress';
interface SpeedTracker {
    startTime: number;
    lastBytes: number;
    lastTime: number;
    speed: number;
}
export declare function createSpeedTracker(): SpeedTracker;
export declare function updateSpeed(t: SpeedTracker, bytes: number): void;
export declare function speedInfo(t: SpeedTracker, total: number): string;
export declare function createProgressBar(filename: string, total: number): {
    bar: cliProgress.SingleBar;
    tracker: SpeedTracker;
};
export declare function updateProgress(bar: cliProgress.SingleBar, tracker: SpeedTracker, bytes: number): void;
export {};

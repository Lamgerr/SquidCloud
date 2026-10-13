import { SDEBrain } from "../brain/SDEBrain.ts";
import type { UploadOpts, DownloadOpts } from "../brain/SDEBrain.ts";

export class SDE {
  private brain: SDEBrain;
  constructor(brain?: SDEBrain) {
    this.brain = brain ?? new SDEBrain();
  }

  async upload(file: File, onChunk?: (idx: number, total: number) => void, opts?: UploadOpts): Promise<{ recallToken: string; fileHash: string }> {
    return this.brain.upload(file, onChunk, opts);
  }

  async download(recallToken: string, onStream: (chunk: Uint8Array) => void, opts?: DownloadOpts): Promise<File> {
    return this.brain.download(recallToken, onStream, opts);
  }
}

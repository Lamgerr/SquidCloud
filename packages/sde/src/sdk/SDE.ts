import { SDEBrain } from "../brain/SDEBrain.ts";

export class SDE {
  private brain: SDEBrain;
  constructor(brain?: SDEBrain) {
    this.brain = brain ?? new SDEBrain();
  }

  async upload(file: File, onChunk?: (idx: number, total: number) => void): Promise<{ recallToken: string; fileHash: string }> {
    return this.brain.upload(file, onChunk);
  }

  async download(recallToken: string, onStream: (chunk: Uint8Array) => void, opts?: { fileName?: string; mimeType?: string }): Promise<File> {
    return this.brain.download(recallToken, onStream, opts);
  }
}

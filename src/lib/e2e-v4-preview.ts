/** Read E2E v4 metadata from a stored file record's tags. Pure so it can be
 *  tested without a DOM; the preview modal uses it to pick the v4 path. */

export type V4FileMeta = {
  fileId: string;
  saltB64: string;
  originalSize: number;
  originalName?: string;
  originalType?: string;
  version: 4;
  chunkSize?: number;
  totalChunks?: number;
};

export function readV4Meta(file: any): V4FileMeta | null {
  try {
    const tags = Array.isArray(file?.tags) ? file.tags : [];
    for (const tag of tags) {
      const parsed = JSON.parse(tag);
      if (parsed?.v4?.fileId && parsed?.v4?.saltB64) return parsed.v4 as V4FileMeta;
    }
  } catch { /* not a v4 file */ }
  return null;
}

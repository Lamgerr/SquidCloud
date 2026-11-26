import { describe, expect, test } from "bun:test";
import { setV4Master, clearV4Master } from "../src/lib/e2e-v4-session";
import {
  CHUNKED_V4_MAGIC,
  V4_PLAINTEXT_CHUNK_SIZE,
  decryptV4File,
  decryptV4Prefix,
  prepareV4Upload,
} from "../src/lib/e2e-v4-upload";

const ktl = async () => "GENESIS";

function toBytes(buf: ArrayBuffer): Uint8Array { return new Uint8Array(buf); }
function decode(buf: ArrayBuffer): string { return new TextDecoder().decode(buf); }

describe("chunked v4 with instant prefix preview", () => {
  test("round-trips a multi-chunk file", async () => {
    setV4Master(crypto.getRandomValues(new Uint8Array(32)));
    const payload = "A".repeat(V4_PLAINTEXT_CHUNK_SIZE * 2 + 123);
    const file = new File([payload], "big.txt", { type: "text/plain" });
    const prepared = await prepareV4Upload(file, "user-1");
    expect(prepared).not.toBeNull();
    expect(prepared!.meta.totalChunks).toBe(3);
    expect(toBytes(await prepared!.file.arrayBuffer()).slice(0, 3)).toEqual(new Uint8Array(CHUNKED_V4_MAGIC));

    const plain = await decryptV4File(await prepared!.file.arrayBuffer(), "user-1", prepared!.meta, ktl);
    expect(decode(plain)).toBe(payload);
    clearV4Master();
  });

  test("decrypts only the first complete chunk from a truncated prefix", async () => {
    setV4Master(crypto.getRandomValues(new Uint8Array(32)));
    const payload = "B".repeat(V4_PLAINTEXT_CHUNK_SIZE + 50);
    const prepared = await prepareV4Upload(new File([payload], "prefix.txt"), "user-1");
    const sealed = toBytes(await prepared!.file.arrayBuffer());
    // Header + first frame only (header is 39 bytes; frame is chunk + 12 IV + 16 tag).
    const headerBytes = 3 + 32 + 4 + 4;
    const firstFrameBytes = V4_PLAINTEXT_CHUNK_SIZE + 12 + 16;
    const prefix = sealed.slice(0, headerBytes + firstFrameBytes).buffer;

    const plain = await decryptV4Prefix(prefix, "user-1", prepared!.meta, ktl);
    expect(decode(plain)).toBe("B".repeat(V4_PLAINTEXT_CHUNK_SIZE));
    clearV4Master();
  });

  test("rejects a truncated or tampered prefix", async () => {
    setV4Master(crypto.getRandomValues(new Uint8Array(32)));
    const prepared = await prepareV4Upload(new File(["C".repeat(100)], "small.txt"), "user-1");
    const sealed = toBytes(await prepared!.file.arrayBuffer());
    let rejected = false;
    try { await decryptV4Prefix(sealed.slice(0, 20).buffer, "user-1", prepared!.meta, ktl); }
    catch { rejected = true; }
    expect(rejected).toBe(true);
    clearV4Master();
  });
});

import { readV4Meta } from "../src/lib/e2e-v4-preview";

test("preview modal detects v4 metadata in file tags", () => {
  const meta = { fileId: "f1", saltB64: "c2FsdA", totalChunks: 2, chunkSize: 1024, originalSize: 2048, version: 4 };
  expect(readV4Meta({ tags: [JSON.stringify({ chunks: [], v4: meta })] })).toEqual(meta);
  expect(readV4Meta({ tags: [JSON.stringify({ encryptionKey: "managed_key" })] })).toBeNull();
});

import { describe, expect, test } from "bun:test";
import {
  decryptV4Chunk,
  deriveV4FileKey,
  encryptV4Chunk,
  makeV4Aad,
  randomBytes,
} from "../src/lib/e2e-v4";
import {
  decryptChunkV3,
  encryptChunkV3,
  deriveFileKey,
} from "../src/lib/encryption-v3";

const encoder = new TextEncoder();

function toBytes(buffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(buffer);
}

describe("e2e v4 crypto", () => {
  test("encrypts two identical chunks with different IVs", async () => {
    const master = crypto.getRandomValues(new Uint8Array(32)).buffer;
    const salt = crypto.getRandomValues(new Uint8Array(32)).buffer;
    const key = await deriveV4FileKey(master, "user-1", "file-1", salt);
    const aad = makeV4Aad("user-1", "file-1", "c2FsdA", 1, 0, 2);
    const first = await encryptV4Chunk(key, encoder.encode("same bytes").buffer, aad);
    const second = await encryptV4Chunk(key, encoder.encode("same bytes").buffer, aad);

    expect(first.iv.byteLength).toBe(12);
    expect(toBytes(first.iv)).not.toEqual(toBytes(second.iv));
    expect(toBytes(first.ciphertext)).not.toEqual(toBytes(second.ciphertext));
  });

  test("decrypts only with the exact AAD", async () => {
    const master = crypto.getRandomValues(new Uint8Array(32)).buffer;
    const salt = crypto.getRandomValues(new Uint8Array(32)).buffer;
    const key = await deriveV4FileKey(master, "user-1", "file-1", salt);
    const goodAad = makeV4Aad("user-1", "file-1", "c2FsdA", 1, 0, 1);
    const badAad = makeV4Aad("user-1", "file-1", "c2FsdA", 1, 1, 1);
    const sealed = await encryptV4Chunk(key, encoder.encode("secret").buffer, goodAad);

    const plain = await decryptV4Chunk(key, sealed.ciphertext, sealed.iv, goodAad);
    expect(new TextDecoder().decode(plain)).toBe("secret");

    let rejected = false;
    try {
      await decryptV4Chunk(key, sealed.ciphertext, sealed.iv, badAad);
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
  });

  test("randomBytes returns the requested cryptographically random length", () => {
    expect(randomBytes(12).byteLength).toBe(12);
    expect(toBytes(randomBytes(32))).not.toEqual(toBytes(randomBytes(32)));
  });

  test("legacy v3 ciphertext remains readable", async () => {
    const master = crypto.getRandomValues(new Uint8Array(32)).buffer;
    const { fileKeyRaw } = await deriveFileKey(master, "legacy-file");
    const sealed = await encryptChunkV3(
      encoder.encode("legacy plaintext").buffer,
      fileKeyRaw,
      "user-1",
      "legacy-file",
      0,
      1,
    );
    const plain = await decryptChunkV3(sealed, fileKeyRaw, "user-1", "legacy-file", 0, 1);
    expect(new TextDecoder().decode(plain)).toBe("legacy plaintext");
  });
});

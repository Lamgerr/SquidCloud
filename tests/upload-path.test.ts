import { describe, expect, test } from "bun:test";
import {
  isLegacyManagedUpload,
  shouldEscrowKey,
  V4_KEY_LABEL,
} from "../src/lib/e2e-upload-policy";

describe("upload key escrow policy", () => {
  test("new v4 uploads never escrow a key", () => {
    expect(shouldEscrowKey({ encryptionKey: V4_KEY_LABEL })).toBe(false);
  });

  test("legacy managed uploads still escrow for backward-compatible reads", () => {
    expect(shouldEscrowKey({ encryptionKey: "managed_key" })).toBe(true);
    expect(isLegacyManagedUpload({ encryptionKey: "managed_key" })).toBe(true);
  });

  test("BYOK and v3 labels never escrow", () => {
    expect(shouldEscrowKey({ encryptionKey: "sha256:byok_encrypted" })).toBe(false);
    expect(shouldEscrowKey({ encryptionKey: "v3_byok_file-1" })).toBe(false);
    expect(isLegacyManagedUpload({ encryptionKey: "v3_byok_file-1" })).toBe(false);
  });

  test("v4 metadata carries salt but no raw key", () => {
    const meta = { encryptionKey: V4_KEY_LABEL, v4Salt: "c2FsdA" };
    expect(shouldEscrowKey(meta)).toBe(false);
    expect(JSON.stringify(meta)).not.toContain("rawKey");
  });
});

import { setV4Master, clearV4Master } from "../src/lib/e2e-v4-session";
import { prepareV4Upload, decryptV4File } from "../src/lib/e2e-v4-upload";

describe("v4 upload roundtrip", () => {
  test("prepared file decrypts to original bytes", async () => {
    setV4Master(crypto.getRandomValues(new Uint8Array(32)));
    const file = new File([new TextEncoder().encode("v4 payload")], "v4.txt", { type: "text/plain" });
    const prepared = await prepareV4Upload(file, "user-1");
    expect(prepared).not.toBeNull();
    const sealed = await prepared!.file.arrayBuffer();
    const plain = await decryptV4File(sealed, "user-1", prepared!.meta, async () => "GENESIS");
    expect(new TextDecoder().decode(plain)).toBe("v4 payload");
    clearV4Master();
  });
});

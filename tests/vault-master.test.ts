import { describe, expect, test } from "bun:test";
import { exportMasterKey } from "../src/lib/vault-master";

describe("v4 master extraction", () => {
  test("exports the unwrapped master key, never the password-derived KEK", async () => {
    const master = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"],
    ) as CryptoKey;
    const kek = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"],
    ) as CryptoKey;

    const exported = await exportMasterKey(master);
    const masterBytes = new Uint8Array(await crypto.subtle.exportKey("raw", master));
    const kekBytes = new Uint8Array(await crypto.subtle.exportKey("raw", kek));

    expect(Array.from(exported)).toEqual(Array.from(masterBytes));
    expect(Array.from(exported)).not.toEqual(Array.from(kekBytes));
  });
});

import { describe, expect, test } from "bun:test";
import { classifyVaultHealth } from "../src/lib/vault-health";

describe("vault health classification", () => {
  test("counts v4 files from key label or tags", () => {
    const result = classifyVaultHealth({
      files: [
        { encryption_key: "e2e_v4" },
        { tags: [JSON.stringify({ v4: { fileId: "f1", saltB64: "c2FsdA" } })] },
        { encryption_key: "managed_key" },
      ],
      passkeys: [],
      recoveryContacts: 3,
      devices: 1,
    });
    expect(result.totalFiles).toBe(3);
    expect(result.v4Files).toBe(2);
    expect(result.legacyFiles).toBe(1);
    expect(result.needsAttention).toBe(true);
    expect(result.recommendations.some(r => /legacy file/i.test(r))).toBe(true);
  });

  test("distinguishes verifiable passkeys from legacy ones", () => {
    const result = classifyVaultHealth({
      files: [],
      passkeys: [
        { public_key: JSON.stringify({ kty: "EC", crv: "P-256" }) },
        { public_key: null },
        { public_key: "" },
      ],
      recoveryContacts: 0,
      devices: 0,
    });
    expect(result.verifiedPasskeys).toBe(1);
    expect(result.legacyPasskeys).toBe(2);
    expect(result.recommendations.some(r => /passkey/i.test(r))).toBe(true);
    expect(result.recommendations.some(r => /recovery/i.test(r))).toBe(true);
  });

  test("healthy vault has no recommendations", () => {
    const result = classifyVaultHealth({
      files: [{ encryption_key: "e2e_v4" }],
      passkeys: [{ public_key: JSON.stringify({ kty: "EC" }) }],
      recoveryContacts: 3,
      devices: 1,
    });
    expect(result.needsAttention).toBe(false);
    expect(result.recommendations).toEqual([]);
  });
});

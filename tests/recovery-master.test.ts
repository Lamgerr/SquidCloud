import { describe, expect, test } from "bun:test";
import { masterFromRecoveryPhrase } from "../src/lib/zk/recovery-master";

const PHRASE = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

describe("recovery phrase master derivation", () => {
  test("is deterministic and 32 bytes", async () => {
    const a = await masterFromRecoveryPhrase(PHRASE);
    const b = await masterFromRecoveryPhrase(PHRASE);
    expect(a.byteLength).toBe(32);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  test("different phrases derive different masters", async () => {
    const a = await masterFromRecoveryPhrase(PHRASE);
    const b = await masterFromRecoveryPhrase("zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong");
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  test("rejects an empty phrase", async () => {
    let rejected = false;
    try { await masterFromRecoveryPhrase("  "); } catch { rejected = true; }
    expect(rejected).toBe(true);
  });
});

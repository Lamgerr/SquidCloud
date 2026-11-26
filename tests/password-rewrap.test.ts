import { describe, expect, test } from "bun:test";
import {
  rewrapMasterKey,
  type WrappedMaster,
} from "../src/lib/master-key-rewrap";

const encoder = new TextEncoder();

async function makeWrapped(password: string): Promise<WrappedMaster> {
  const mk = crypto.getRandomValues(new Uint8Array(32));
  const r = await rewrapMasterKey(null, password, password, mk);
  return r.next!;
}

describe("master key rewrap", () => {
  test("rewraps with a new password while preserving the master key", async () => {
    const original = crypto.getRandomValues(new Uint8Array(32));
    const wrapped = await rewrapMasterKey(null, "old-pass", "old-pass", original);
    const { ok, next, masterRaw } = await rewrapMasterKey(wrapped.next!, "old-pass", "new-pass");
    expect(ok).toBe(true);
    expect(Array.from(masterRaw!)).toEqual(Array.from(original));
    const retry = await rewrapMasterKey(next!, "new-pass", "newer-pass");
    expect(retry.ok).toBe(true);
  });

  test("wrong current password does not produce a new wrapper", async () => {
    const wrapped = await makeWrapped("right-pass");
    const result = await rewrapMasterKey(wrapped, "wrong-pass", "new-pass");
    expect(result.ok).toBe(false);
    expect(result.next).toBeNull();
  });
});

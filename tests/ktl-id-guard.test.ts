import { describe, expect, test } from "bun:test";
import { isValidKtlUserId } from "../src/lib/zk/ktl-id";

describe("KTL user id guard", () => {
  test("accepts a real UUID", () => {
    expect(isValidKtlUserId("57a062e4-ae90-457b-9753-2436ed385b31")).toBe(true);
  });

  test("rejects the malformed id that produced the Postgres 400", () => {
    expect(isValidKtlUserId("3")).toBe(false);
    expect(isValidKtlUserId("")).toBe(false);
    expect(isValidKtlUserId("user-1")).toBe(false);
  });
});

import { describe, expect, test } from "bun:test";
import { isBoundAuthenticationChallenge } from "../supabase/functions/passkey-auth/challenge-binding";

const now = Date.now();

describe("passkey authentication challenge binding", () => {
  test("accepts an unexpired challenge bound to the passkey email", () => {
    expect(isBoundAuthenticationChallenge({
      expires_at: new Date(now + 60_000).toISOString(),
      email: "user@example.com",
    }, "user@example.com", now)).toBe(true);
  });

  test("rejects expired challenges", () => {
    expect(isBoundAuthenticationChallenge({
      expires_at: new Date(now - 1).toISOString(),
      email: "user@example.com",
    }, "user@example.com", now)).toBe(false);
  });

  test("rejects challenges bound to a different or missing email", () => {
    expect(isBoundAuthenticationChallenge({
      expires_at: new Date(now + 60_000).toISOString(),
    }, "user@example.com", now)).toBe(false);
    expect(isBoundAuthenticationChallenge({
      expires_at: new Date(now + 60_000).toISOString(),
      email: "victim@example.com",
    }, "user@example.com", now)).toBe(false);
    expect(isBoundAuthenticationChallenge(null, "user@example.com", now)).toBe(false);
  });
});

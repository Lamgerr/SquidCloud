import { describe, expect, test } from "bun:test";
import { isBoundAuthenticationChallenge } from "../supabase/functions/passkey-auth/challenge-binding";

const now = Date.now();

describe("passkey authentication challenge binding", () => {
  test("accepts an unexpired challenge bound to this credential and email", () => {
    expect(isBoundAuthenticationChallenge({
      expires_at: new Date(now + 60_000).toISOString(),
      credential_ids: ["cred-1", "cred-2"],
      email: "user@example.com",
    }, "cred-1", "user@example.com", now)).toBe(true);
  });

  test("rejects expired challenges", () => {
    expect(isBoundAuthenticationChallenge({
      expires_at: new Date(now - 1).toISOString(),
      credential_ids: ["cred-1"],
      email: "user@example.com",
    }, "cred-1", "user@example.com", now)).toBe(false);
  });

  test("rejects challenges that are not bound to a credential or email", () => {
    expect(isBoundAuthenticationChallenge({
      expires_at: new Date(now + 60_000).toISOString(),
    }, "cred-1", "user@example.com", now)).toBe(false);
    expect(isBoundAuthenticationChallenge({
      expires_at: new Date(now + 60_000).toISOString(),
      credential_ids: ["other"],
      email: "user@example.com",
    }, "cred-1", "user@example.com", now)).toBe(false);
    expect(isBoundAuthenticationChallenge({
      expires_at: new Date(now + 60_000).toISOString(),
      credential_ids: ["cred-1"],
      email: "victim@example.com",
    }, "cred-1", "user@example.com", now)).toBe(false);
  });
});

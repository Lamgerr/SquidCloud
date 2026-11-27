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


test("accepts an email resolved from the WebAuthn userHandle when none was typed", () => {
  expect(isBoundAuthenticationChallenge({
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  }, "user@example.com", "user@example.com", Date.now())).toBe(true);
  expect(isBoundAuthenticationChallenge({
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  }, "user@example.com", "attacker@example.com", Date.now())).toBe(false);
});


test("allows an unbound legacy challenge when explicitly permitted", () => {
  const ch = { expires_at: new Date(Date.now() + 60_000).toISOString() };
  expect(isBoundAuthenticationChallenge(ch, "user@example.com", "", Date.now(), true)).toBe(true);
  expect(isBoundAuthenticationChallenge(ch, "user@example.com", "", Date.now(), false)).toBe(false);
});

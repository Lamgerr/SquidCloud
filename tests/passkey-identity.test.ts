import { describe, expect, test } from "bun:test";
import { resolveRegistrationEmail } from "../supabase/functions/passkey-auth/identity";

describe("passkey registration identity", () => {
  test("uses the JWT-verified email and never a body-supplied email", () => {
    expect(resolveRegistrationEmail("victim@example.com", "attacker@example.com")).toBe("victim@example.com");
    expect(resolveRegistrationEmail("victim@example.com", undefined)).toBe("victim@example.com");
  });

  test("fails closed when the verified user has no email", () => {
    expect(resolveRegistrationEmail(undefined, "attacker@example.com")).toBeNull();
    expect(resolveRegistrationEmail("", "attacker@example.com")).toBeNull();
  });
});

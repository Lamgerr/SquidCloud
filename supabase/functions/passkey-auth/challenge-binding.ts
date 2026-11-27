/** A legacy passkey (no stored public key) cannot be cryptographically
 *  verified. Its challenge must be issued for the verified email of the
 *  credential being used, must not be expired, and the resulting sign-in must
 *  be completed by the emailed magic link — never by returning an OTP to the
 *  caller. */
export function isBoundAuthenticationChallenge(
  challenge: { expires_at?: string | null; email?: string | null } | null | undefined,
  passkeyEmail: string,
  boundEmailOverride?: string,
  now = Date.now(),
  allowUnbound = false,
): boolean {
  if (!challenge?.expires_at) return false;
  const expiry = Date.parse(challenge.expires_at);
  if (!Number.isFinite(expiry) || expiry <= now) return false;
  const boundEmail = (typeof boundEmailOverride === "string" && boundEmailOverride
    ? boundEmailOverride
    : typeof challenge.email === "string" ? challenge.email : "").trim().toLowerCase();
  const ownerEmail = passkeyEmail.trim().toLowerCase();
  if (!boundEmail) return allowUnbound;
  return boundEmail === ownerEmail;
}

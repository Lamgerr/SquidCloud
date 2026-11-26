/** A legacy passkey (no stored public key) cannot be cryptographically
 *  verified. We only permit it when the challenge was issued for that exact
 *  credential and verified email, and has not expired. */
export function isBoundAuthenticationChallenge(
  challenge: { expires_at?: string | null; credential_ids?: unknown; email?: string | null } | null | undefined,
  credentialId: string,
  passkeyEmail: string,
  now = Date.now(),
): boolean {
  if (!challenge) return false;
  if (!challenge.expires_at) return false;
  const expiry = Date.parse(challenge.expires_at);
  if (!Number.isFinite(expiry) || expiry <= now) return false;

  const ids = Array.isArray(challenge.credential_ids)
    ? challenge.credential_ids.filter((id): id is string => typeof id === "string")
    : [];
  if (!ids.includes(credentialId)) return false;

  const boundEmail = typeof challenge.email === "string" ? challenge.email.trim().toLowerCase() : "";
  const ownerEmail = passkeyEmail.trim().toLowerCase();
  return !!boundEmail && boundEmail === ownerEmail;
}

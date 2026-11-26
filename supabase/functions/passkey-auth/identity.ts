/** Email for a passkey always comes from the JWT-verified user. A client-
 *  supplied email is ignored so a passkey cannot be bound to a victim's
 *  account and used to request their login OTP. */
export function resolveRegistrationEmail(
  verifiedEmail: string | null | undefined,
  _bodyEmail?: unknown,
): string | null {
  const email = typeof verifiedEmail === "string" ? verifiedEmail.trim().toLowerCase() : "";
  return email || null;
}

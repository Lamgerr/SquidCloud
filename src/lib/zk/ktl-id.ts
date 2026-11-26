/** Pure validation for KTL user ids. Kept free of Supabase imports so it is
 *  unit-testable without a client runtime. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidKtlUserId(userId: string): boolean {
  return UUID_RE.test(userId);
}

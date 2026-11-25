# SUMMARY — SquidCloud

## Done
- **Vault unlock root cause fixed with live evidence**: the affected user has no BYOK hash and no `vaults` row, but has a `master_keys` row created from the **account sign-in password**. The dialog now fetches master-key metadata through the BFF and verifies by unwrapping the master key with a PBKDF2-derived key from the entered password. BYOK and legacy verifiers remain as fallbacks. Local WebCrypto roundtrip verified.
- **AccountSettings layout rebuilt from the root**: removed conflicting inline styles and the mobile rail box; one authoritative high-specificity rule keeps the rail transparent/borderless; `.tv-root` is transparent so the full-document `.sa` ambient wash shows.
- BFF routing, reset reauth, security-event and maintenance fixes from prior passes remain. Vercel READY.

## Important usage note
- The vault passphrase is the **account sign-in password** used at master-key setup, not a separately chosen BYOK passphrase unless one was explicitly created in Encryption.

## Blocked / known
- Supabase service-role key from old history still live (user deprioritized rotation).
- Realtime websocket errors from other Supabase channels remain unchanged.
- No local browser rendering; user verifies visually.

## Queued next
1. User retest: unlock with account sign-in password; inspect layout.
2. If unlock still fails, add BFF-side diagnostics to report which verifier branch fired.

Live: https://squidcloud.vercel.app · Repo: https://github.com/Lamgerr/SquidCloud

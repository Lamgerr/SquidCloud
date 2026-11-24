# What happened while you were away

## Done
- **Security review completed (read-only, no changes made).** Two audits: client-side key handling and Supabase-side DB/functions, plus independent CLI SQL checks.
- **Critical live issues found on Supabase:** any authenticated user can enumerate all public share rows including `shared_encryption_key` and `access_code`; `get_shared_file_info` / `get_file_for_share` are anon-callable SECURITY DEFINER functions that return keys and storage paths with no password check (edge-function password checks are dead code because `access_code` isn't even returned); `update_share_options` lets anon overwrite any share; `get_secret` is an anon-callable vault-secret reader; the `files` bucket is public; `anon` has EXECUTE on token-signing primitives; several key functions have `verify_jwt=false` and one has a hardcoded maintenance token.
- **Client side:** default managed uploads escrow the raw AES key to the server, so "zero-knowledge" claims are false; a fallback writes the raw key into `files.tags`; the key RPC bypasses step-up for JWT holders; the markdown preview sanitizer is a weak blocklist.
- **Verified OK:** profile admin/tier fields are not user-writable, GitHub tokens are RLS owner-only, `file_key_vault` is scoped, and `file-key`'s JWT path does validate ownership. No plaintext key values are logged.
- Proposed a three-phase fix: (0) SQL containment, (1) BFF with HttpOnly cookies, (2) user-held keys for true E2E.

## In progress
- Nothing being edited. Awaiting direction.

## Blocked / needs a decision
- Review only per your request; the brainstorming gate means no implementation until a design is agreed.
- Open decision: must existing managed files be re-encrypted client-side to user-held keys on next open, or should only new files be true E2E?

## Queued next
- Phase 0 containment if you approve; then the BFF design doc and plan.

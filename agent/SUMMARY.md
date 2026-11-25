# SUMMARY — SquidCloud

## Done
- **Vault unlock fixed**: verifies the real passphrase against the BYOK account-key hash in `user_encryption_settings` (with legacy fallback), then derives the in-memory vault key.
- **All browser console errors routed through BFF**: `security_events` writes and `system_settings.maintenance_mode` reads now use a service-role BFF client, eliminating 42501 anon/RLS errors. Live checks: maintenance read 200, unauth security event 401.
- **Vault reset forces re-login** via `supabase.auth.signOut()` and redirect to `/auth?reason=vault-reset`.
- **Layout seam + rail box**: viewport-fixed wash replaced with document-level background; settings roots have uniform background and rail is forced transparent with inline overrides.
- BFF response hang and edge 403 were fixed in the prior pass. Vercel READY.

## Blocked — needs a decision
- Supabase service-role key from old history still live; user deprioritized rotation.
- No local browser rendering; cannot self-verify visual quality.

## Queued next
1. User to retest vault unlock with the real account-key passphrase and check the settings layout.
2. If unlock still fails, inspect logs for which verification path fired.

Live: https://squidcloud.vercel.app · Repo: https://github.com/Lamgerr/SquidCloud

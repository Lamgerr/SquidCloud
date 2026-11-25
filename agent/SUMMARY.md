# SUMMARY — SquidCloud

## Done
- Vault unlock now routes passphrase verification through the BFF (`vault-pass-meta`), eliminating the Firefox CORS block. Client receives only the Argon2 hash+salt and verifies locally.
- Vault unlock verifies the real BYOK account-key passphrase (legacy fallback retained).
- Security events and maintenance status route through the BFF service-role client; no anon 42501 errors.
- Vault reset forces sign-out/re-login.
- Layout seam eliminated: ambient wash moved from a viewport-fixed body pseudo-element to the full-document `.sa` shell; settings roots use document-sized wash; rail forced transparent.
- BFF actual responses fixed (no more 300s timeout); edge 403 gate removed.
- Vercel READY.

## Blocked / known
- Supabase service-role key from old history still live (user deprioritized rotation).
- Realtime websocket errors come from other Supabase channels (signals/support/share surveillance), not the routes changed here; left untouched.
- No local browser rendering; user verifies visually.

## Queued next
1. User retest: vault unlock, layout seam, reset flow.
2. If realtime websocket errors remain disruptive, migrate those channels to BFF polling or disable them.

Live: https://squidcloud.vercel.app · Repo: https://github.com/Lamgerr/SquidCloud

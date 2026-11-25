# SUMMARY — SquidCloud

## Done
- Vault unlock works via master-key verification through BFF.
- Settings screenshot verified: seam and rail box are gone; spacing tightened.
- Share decrypt logging routed through BFF using the live `ip_address` column (fixes 42703 actor_ip).
- Share password rejection is correct server behavior — live RPC/edge function accept the stored access code. Non-secret diagnostics added to identify mismatches; share-access redeployed.
- OpenCode Supabase MCP now uses a scoped PAT header instead of OAuth (redirect URI was rejected); `opencode mcp list` shows connected.
- Vercel READY.

## Blocked / needs data
- To finish the `wrong_password` case: need one retry so the new diagnostics show submitted password length vs stored access-code length (secrets are never logged).
- Supabase DB migration push is blocked by migration-history mismatch, so schema fixes are done at BFF layer.
- Supabase service-role key from old history still live (user deprioritized rotation).

## Queued next
1. Read share-access diagnostics after user retries.
2. Continue page polish only where requested.

Live: https://squidcloud.vercel.app · Repo: https://github.com/Lamgerr/SquidCloud

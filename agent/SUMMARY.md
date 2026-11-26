# SUMMARY — SquidCloud

## Done
- E2E hardening shipped and pushed: client-only v4 new writes, legacy reads preserved, passkey login fixed, BFF share gate, sealed previews, CI invariant gate.
- Supabase cleanup executed and verified via MCP after the owner delegated the decision: **380 MB → 67 MB**, 151 → 139 public tables, anon access to all four share RPCs revoked, cron polling and log retention fixed, hardcoded anon JWT removed.
- 42 tests pass, invariant gate passes, Vercel READY, `fresh-main` clean and pushed.

## In progress
- Nothing mid-edit.

## Blocked — needs a decision
- Service-role key from old history remains live (previously deprioritized).
- Four empty/unreferenced storage buckets remain; removing them yields no Postgres storage saving, so they were left alone.

## Queued next
1. Confirm after 24h that the hourly `log-bloat-control` job keeps `net._http_response` near 1 MB.
2. Rotate the leaked service-role key.
3. Remove empty buckets if no external consumers exist.

Live: https://squidcloud.vercel.app · Repo: https://github.com/Lamgerr/SquidCloud

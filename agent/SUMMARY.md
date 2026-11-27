# SUMMARY — SquidCloud

## Done
- All verified E2E, preview, streaming, passkey and Supabase cleanup work remains shipped.
- Vault health panel and glass context menus are shipped.
- Owner-provided Auth.tsx redesign was reverted on request; the previous auth page is restored.

## In progress
- Nothing mid-edit. Working tree clean, `fresh-main` pushed.

## Blocked — needs a decision
- Service-role key rotation: human dashboard action (`docs/SECURITY-KEY-ROTATION-RUNBOOK.md`).
- Empty bucket deletion: Supabase Storage API credentials required.

## Queued next
1. Make preview chunk budget and KTL cache TTL configurable.
2. Admin viewer for `client_error_events`.

Live: https://squidcloud.vercel.app · Repo: https://github.com/Lamgerr/SquidCloud

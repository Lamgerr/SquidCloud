# SUMMARY — SquidCloud

## Done
- All E2E hardening, preview/streaming, geo, passkey and Supabase cleanup work is shipped and pushed to `fresh-main`.
- Owner verified all flows: passkey login, previews, video streaming, downloads, shares and vault unlock.
- 55 tests pass, invariant gate passes, Vercel READY, production smoke checks pass.

## In progress
- Nothing mid-edit. Working tree clean.

## Blocked — needs a decision
- Service-role key rotation: human dashboard action (`docs/SECURITY-KEY-ROTATION-RUNBOOK.md`).
- Empty bucket deletion: Storage API credentials required.

## Queued next
1. Make preview chunk budget and KTL cache TTL configurable.
2. Optional vault health screen for legacy-vs-v4 status, passkey verifier status, and one-click upgrade/re-enroll.

Live: https://squidcloud.vercel.app · Repo: https://github.com/Lamgerr/SquidCloud

# SUMMARY — SquidCloud

## Done
- E2E file-pipeline hardening implemented, reviewed three times and pushed (14+ commits on `fresh-main`): client-only v4 new writes, legacy reads preserved, passkey login fixed, BFF share gate, sealed previews, CI invariant gate.
- Full Supabase review completed via MCP. Wrote `docs/audits/supabase-review-2026-11-26.md` and four owner-run SQL scripts in `supabase/maintenance/`.
- Key finding: 84% of the 380 MB database is `net._http_response` (290 MB) and `cron.job_run_details` (24 MB) — log retention, not application data. 27 empty unreferenced tables and 7 unused secondary indexes identified.

## In progress
- Nothing mid-edit. Working tree clean; `fresh-main` pushed.

## Blocked — needs a decision
- SKIPPED by standing rule: all destructive DB operations (DROP TABLE, DELETE, DROP INDEX, bucket/cron/policy/key changes). Scripts are ready for the owner.
- Branch `main` in Supabase is `MIGRATIONS_FAILED`; repair history before applying DDL.
- Live anon grant on `get_shared_file_info` and hardcoded anon JWT in cron job 9 remain; time-boxed in `scripts/e2e-invariant-allowlist.json`.
- Service-role key from old history remains live (previously deprioritized).

## Queued next
1. Owner runs `supabase/maintenance/01_log_retention.sql` first (~314 MB expected recovery).
2. Repair migration history, then run 02-04 after reviewing the candidate list.
3. Re-run Supabase advisors and `ANALYZE public` to refresh stale stats.

Live: https://squidcloud.vercel.app · Repo: https://github.com/Lamgerr/SquidCloud

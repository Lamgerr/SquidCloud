# Supabase review — 2026-11-26

Project `aouqcwbdoyrccjcrhzzi` (production). Read-only review via the Supabase
MCP. No table, row, policy, cron job or bucket was changed during the audit.

## Headline

The database is **380 MB**, and 320 MB (84%) is two Supabase-managed log
tables, not application data:

| Schema / object | Size | Notes |
|---|---:|---|
| `net._http_response` | 290 MB | 733 responses, all from today; bodies retained by pg_net |
| `cron.job_run_details` | 24 MB | 35,525 runs since 2026-11-15 |
| `public` (151 tables) | 48 MB | only ~25 MB is real application data |
| `auth` | 6.5 MB | normal |
| `storage` | 5.9 MB | normal |
| `squidveil` | 1.1 MB | normal |

Two per-minute `net.http_post` cron jobs (migration processing and webhook
retry) generate the pg_net response bodies. There is no retention policy on
`net._http_response`. Adding one is the single biggest storage win.

## Application data

| Table | Est. rows | Size |
|---|---:|---:|
| `files` | 2,850 | 17.1 MB |
| `security_events` | 9,774 | 3.8 MB |
| `kza_threat_events` | 5 (stats stale) | 1.9 MB |
| `repositories` | 0 (stats stale) | 1.8 MB |
| `video_stream_sessions` | 0 | 1.1 MB |
| `folders` | 826 | 0.9 MB |
| `file_key_vault` | 2,428 | 0.8 MB |

All 151 public tables have RLS enabled (good). Statistics are stale on most
tables — `ANALYZE` would make size/row decisions much more reliable.

## Cleanup candidates

### 1. Dead tables — empty, no application code, no function-body reference

These 27 tables have zero live rows, are not referenced by `src/`, `api/`,
`supabase/functions/` or `scripts/`, and are not referenced in any stored
function body:

```
8djcvk3222                 user_terms_acceptance      video_quality_metrics
partner_codes              storage_settings           pin_operation_authorizations
kza_ip_reputation          kza_prel_hmac_keys         pdf_sessions
account_changes            account_health_logs        maintenance_schedules
extension_ratings          kza_cip_versions           pin_attempt_logs
kza_rate_buckets           media_playback_logs        upload_stats
user_preferences           video_processing_queue     kza_ip_rate_buckets
playback_resume            user_redeem_codes          extension_approval_history
video_stream_sessions      user_subscriptions         pdf_annotations
```

`8djcvk3222` is a randomly named `bytea` manifest table — almost certainly
accidental migration residue. Verify the `kza_*` entries against the live
security functions before dropping them; they are empty today but belong to
the hardening subsystem.

**Not candidates** even though they are empty: `zk_devices`, `zk_ktl`,
`recovery_contacts`, `master_keys` and `zk_vaults` are used by the current
E2E/recovery code; `webhooks`, `system_settings` and `api_admin_config` are
referenced by application code.

See `supabase/maintenance/02_drop_dead_tables.sql` (guarded, not executed).

### 2. Log retention

- `net._http_response`: delete responses older than 1 day on an hourly cron.
  Expected recovery: ~290 MB.
- `cron.job_run_details`: the existing job 11 only runs weekly with 7-day
  retention; change to daily with 1-day retention. Expected recovery: ~24 MB.
- Reduce cron jobs 3 and 6 from every minute to every 5 minutes if the workers
  can tolerate it; that cuts request volume by 80%.

See `supabase/maintenance/01_log_retention.sql` and `04_cron_hardening.sql`.

### 3. Unused / duplicate indexes

The performance advisor reports 130 unused indexes and 2 duplicate indexes;
`public` alone has 13 unused indexes over 64 KB. Primary keys must not be
dropped. `supabase/maintenance/03_unused_indexes.sql` lists the safe
secondary-index candidates only. Expected recovery: a few MB, but it also
reduces write amplification.

### 4. Empty storage buckets

| Bucket | Objects | Verdict |
|---|---:|---|
| `files` | 333 | keep |
| `squid-sites` | 15 | keep |
| `apidoc` | 3 | keep |
| `avatars` | 2 | keep |
| `migration-zips` | 2 | keep |
| `extensions` | 1 | keep |
| `go-mod` | 1 | no code reference — candidate |
| `premium` | 0 | no objects — candidate |
| `book-covers` | 0 | no objects — candidate |
| `extension-manifests` | 0 | no code reference — candidate |

Buckets do not store bytes in Postgres, so this is clutter reduction, not
a Postgres-storage saving.

## Security / hygiene findings

- **Anon-callable SECURITY DEFINER functions (4):** `get_folder_share_contents`,
  `get_shared_file_info`, `increment_share_download`, `increment_share_view`.
  `get_shared_file_info` is gated through the BFF on the client, but the DB
  grant is still live. This is the known migration-blocked item tracked in
  `scripts/e2e-invariant-allowlist.json`.
- **Hardcoded anon JWT in cron job 9** (`backfill-file-keys`) inside
  `cron.job.command`. It is an anon key rather than a service key, but it
  should be replaced with a secret stored from the vault. The literal token is
  deliberately not reproduced in this document.
- **38 functions with mutable `search_path`** and **`pg_net` installed in
  `public`** — Supabase advisor WARNs. Set `search_path = ''` on SECURITY
  DEFINER functions and move `pg_net` to the `extensions` schema.
- **18 tables with RLS enabled and no policy** — fail-closed by design (service
  role only), so these are notes, not exposure findings.
- **59 unindexed foreign keys**, **228 `auth_rls_initplan` warnings**, **193
  multiple permissive policies** — performance/policy complexity, not an
  immediate exposure.
- **Branch `main` has `MIGRATIONS_FAILED`** — the known migration-history
  mismatch that blocks schema changes through `supabase db push`. Repair the
  history before applying any of the scripts below.

## What was NOT done

Per the standing operating rule, destructive operations on production were
not executed: no `DROP TABLE`, no `DELETE`, no `DROP INDEX`, no bucket
deletion, no policy/grant change, no cron edit, no key rotation. Each is
written as a guarded, reviewable script under `supabase/maintenance/` for the
owner to run after the migration history is repaired.

## Recommended order

1. Repair migration history / `MIGRATIONS_FAILED`.
2. Run log retention (290 MB + 24 MB) and verify with `pg_database_size`.
3. `ANALYZE` public tables, then re-check the dead-table list.
4. Drop the confirmed dead tables; keep the E2E tables.
5. Drop duplicate/unused secondary indexes.
6. Remove hardcoded token from cron job 9; reduce cron frequency.
7. Remove empty buckets only if the owner confirms no external consumers.

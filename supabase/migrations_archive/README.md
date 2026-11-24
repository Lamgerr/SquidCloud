# Archived migrations (pre-open-source baseline)

- **Archived:** 2026-11-10
- **Reason:** repository cleanup for open-source readiness; replaced incremental migration history with a single production-derived schema baseline.
- **Contents:** `pre-2026-11-10/*.sql` — 101 historical migration files as they existed on `fresh-main` at archive time.
- **Active baseline:** `../migrations/20261110000000_prod_baseline.sql` (generated from live production schema via Supabase Management API; covers public/squidveil objects: extensions, enums, tables/constraints/indexes, views, functions, triggers, RLS, policies).

Notes:
- The baseline is a **schema snapshot**, not a data dump. Managed Supabase schemas (`auth`, `storage`, `realtime`, `vault`, etc.) are platform-managed and not fully reproduced here.
- Validate the baseline against a fresh local Supabase stack (`supabase start` + apply) before relying on it for onboarding; adjust ordering/extension ownership if your local stack differs.
- Historical migrations are preserved for forensics/audit only. Do not replay them on top of the baseline.

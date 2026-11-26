-- MANUAL / OWNER-RUN ONLY. Not a migration.
-- Candidates: empty tables with no reference in src/, api/, supabase/functions/,
-- scripts/, or any stored function body. Verified 2026-11-26.
--
-- DO NOT run before:
--   1. repairing the failed migration history (branch main = MIGRATIONS_FAILED);
--   2. taking a backup;
--   3. re-checking the kza_* rows against your hardening functions.
--
-- Drop without CASCADE on purpose: a dependency will abort that statement
-- rather than silently removing a view or function.

BEGIN;

DROP TABLE IF EXISTS public."8djcvk3222";
DROP TABLE IF EXISTS public.user_terms_acceptance;
DROP TABLE IF EXISTS public.video_quality_metrics;
DROP TABLE IF EXISTS public.partner_codes;
DROP TABLE IF EXISTS public.storage_settings;
DROP TABLE IF EXISTS public.pin_operation_authorizations;
DROP TABLE IF EXISTS public.kza_ip_reputation;
DROP TABLE IF EXISTS public.kza_prel_hmac_keys;
DROP TABLE IF EXISTS public.pdf_sessions;
DROP TABLE IF EXISTS public.account_changes;
DROP TABLE IF EXISTS public.account_health_logs;
DROP TABLE IF EXISTS public.maintenance_schedules;
DROP TABLE IF EXISTS public.extension_ratings;
DROP TABLE IF EXISTS public.kza_cip_versions;
DROP TABLE IF EXISTS public.pin_attempt_logs;
DROP TABLE IF EXISTS public.kza_rate_buckets;
DROP TABLE IF EXISTS public.media_playback_logs;
DROP TABLE IF EXISTS public.upload_stats;
DROP TABLE IF EXISTS public.user_preferences;
DROP TABLE IF EXISTS public.video_processing_queue;
DROP TABLE IF EXISTS public.kza_ip_rate_buckets;
DROP TABLE IF EXISTS public.playback_resume;
DROP TABLE IF EXISTS public.user_redeem_codes;
DROP TABLE IF EXISTS public.extension_approval_history;
DROP TABLE IF EXISTS public.video_stream_sessions;
DROP TABLE IF EXISTS public.user_subscriptions;
DROP TABLE IF EXISTS public.pdf_annotations;

-- Verify before COMMIT; ROLLBACK if anything unexpected is missing.
SELECT count(*) AS remaining_public_tables
FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r';

-- COMMIT;  -- uncomment only after reviewing the count above
ROLLBACK;  -- safe default: this script is inert until the owner edits it

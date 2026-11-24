-- ============================================================
-- SPIKE FALLBACK: pg_cron for daily credit/upload reset + PREL for kza-enforce
-- reset_all_api_credits() is idempotent (only touches rows where
-- last_reset_date < CURRENT_DATE OR uploads_reset_date < CURRENT_DATE),
-- so running after Vercel cron (00:05 UTC) at 00:10 UTC is safe.
-- Also registers kza-enforce in PREL (public geo check, needs rate limit).
-- ============================================================

-- 1. pg_cron fallback for daily reset (Vercel cron remains primary)
DO $$
BEGIN
  PERFORM cron.unschedule('reset-api-credits-daily-fallback');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'reset-api-credits-daily-fallback',
  '10 0 * * *',
  'SELECT public.reset_all_api_credits()'
);

-- 2. PREL registry row for kza-enforce (unauthenticated geo check)
INSERT INTO public.kza_prel_registry (function_id, function_name, description, required_auth_level, cip_required, f2fa_required, chain_depth_limit, allowed_callers, ttl_seconds, long_op_ttl_seconds, is_active, required_min_role, rate_limit_rps, rate_limit_burst, geo_velocity_check, geo_max_speed_kmh)
VALUES ('kza-enforce', 'KZA Geo-Fence Enforcement', 'Public country block check for uploads/access; fail-open edge check, rate-limited', 'none', false, false, 3, '{}'::text[], 60, 600, true, null, 30, 90, false, 900)
ON CONFLICT (function_id) DO UPDATE SET required_auth_level = 'none', is_active = true, rate_limit_rps = 30, rate_limit_burst = 90;

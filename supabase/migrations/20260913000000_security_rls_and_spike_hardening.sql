-- ============================================================
-- SECURITY FIX: RLS hardening for discount_codes, partner_codes
-- passkey_challenges already secure (RLS on, no policies = deny-all)
-- ============================================================

-- 1. discount_codes: drop the dangerous public ALL policy, add service-role-only
DROP POLICY IF EXISTS "service_role_all_discount_codes" ON public.discount_codes;

-- Revoke direct access from anon, authenticated, and public roles
REVOKE ALL ON public.discount_codes FROM public, anon, authenticated;

-- Service role bypasses RLS, so no policy needed — the REVOKE above blocks
-- all client-side access. Edge functions using SERVICE_ROLE_KEY still work.

-- 2. partner_codes: drop public read policy, add service-role-only
DROP POLICY IF EXISTS "Anyone can read partner codes" ON public.partner_codes;
DROP POLICY IF EXISTS "Authenticated users can create partner codes" ON public.partner_codes;

REVOKE ALL ON public.partner_codes FROM public, anon, authenticated;

-- 3. passkey_challenges: already secure (RLS on, zero policies = deny-all)
-- Belt-and-suspenders: revoke grants from public/anon/authenticated too
REVOKE ALL ON public.passkey_challenges FROM public, anon, authenticated;

-- ============================================================
-- SPIKE HARDENING: Cleanup cron jobs for unbounded tables
-- ============================================================

-- Helper function: cleanup old rows from multiple tables in one call
CREATE OR REPLACE FUNCTION spike_cleanup_old_rows()
RETURNS void AS $$
BEGIN
  -- pg_net responses: keep 24 hours
  DELETE FROM net._http_response WHERE created < now() - interval '24 hours';

  -- API request logs: keep 30 days
  DELETE FROM public.api_request_logs WHERE created_at < now() - interval '30 days';

  -- API credit log: keep 90 days
  DELETE FROM public.api_credit_log WHERE created_at < now() - interval '90 days';

  -- KZA health checks: keep 7 days
  DELETE FROM public.kza_health_checks WHERE checked_at < now() - interval '7 days';

  -- pg_cron job run details: keep 14 days
  DELETE FROM cron.job_run_details WHERE start_time < now() - interval '14 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup every 6 hours
SELECT cron.schedule(
  'spike-cleanup',
  '0 */6 * * *',
  'SELECT spike_cleanup_old_rows()'
);

-- Re-enable pdf_secure_urls cleanup (was commented out in original migration)
SELECT cron.schedule(
  'cleanup-expired-pdf-urls',
  '0 * * * *',
  $$DELETE FROM pdf_secure_urls WHERE expires_at < now()$$
);

-- 2026-08-04: Penetration test fix — close anonymous RPC exposure
-- get_subscriptions_needing_notifications returned 11 rows of subscriber PII
-- (emails, names, plans, billing dates) to anonymous callers via PostgREST.

REVOKE ALL ON FUNCTION public.get_subscriptions_needing_notifications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscriptions_needing_notifications() TO service_role;

-- is_admin is used by RLS policies evaluated as authenticated; anon must not execute it.
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;

-- Defense in depth: ensure internal KZA tables have RLS enabled
-- (policies restrict to service_role; anon has no table grants).
ALTER TABLE public.kza_ip_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kza_prel_registry ENABLE ROW LEVEL SECURITY;

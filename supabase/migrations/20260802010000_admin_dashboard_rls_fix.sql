-- Fix AdminDashboard / admin tabs returning no data due to RLS.
-- Admin tabs query tables through the anon-JWT client; RLS scoped reads to
-- auth.uid() and left admins unable to see anything (even admin_access_logs,
-- which AdminDashboard reads to validate its own session).
--
-- Adds a recursion-safe public.is_admin() helper (SECURITY DEFINER so it
-- bypasses RLS) and admin grants across every table the admin UI touches.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false)
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

-- admin_access_logs (AdminDashboard session check + UsersTab) ---------------
DROP POLICY IF EXISTS "Admins can manage admin access logs" ON public.admin_access_logs;
CREATE POLICY "Admins can manage admin access logs"
  ON public.admin_access_logs FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- profiles (SupportTab, SystemToolsTab, UsersTab, KZA: restrict) -------------
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- files (SystemToolsTab, UsersTab)
DROP POLICY IF EXISTS "Admins can read all files" ON public.files;
CREATE POLICY "Admins can read all files"
  ON public.files FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all files" ON public.files;
CREATE POLICY "Admins can update all files"
  ON public.files FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete all files" ON public.files;
CREATE POLICY "Admins can delete all files"
  ON public.files FOR DELETE TO authenticated
  USING (public.is_admin());

-- upload_sessions (currently RLS with zero policies -> fully locked out)
DROP POLICY IF EXISTS "Admins can manage upload sessions" ON public.upload_sessions;
CREATE POLICY "Admins can manage upload sessions"
  ON public.upload_sessions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- repositories (RepoManagerTab, SystemToolsTab)
DROP POLICY IF EXISTS "Admins can read all repositories" ON public.repositories;
CREATE POLICY "Admins can read all repositories"
  ON public.repositories FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all repositories" ON public.repositories;
CREATE POLICY "Admins can update all repositories"
  ON public.repositories FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete all repositories" ON public.repositories;
CREATE POLICY "Admins can delete all repositories"
  ON public.repositories FOR DELETE TO authenticated
  USING (public.is_admin());

-- kza_ip_reputation (KZADashboardTab reads + clears)
DROP POLICY IF EXISTS "Admins can manage ip reputation" ON public.kza_ip_reputation;
CREATE POLICY "Admins can manage ip reputation"
  ON public.kza_ip_reputation FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- support_tickets + support_messages (SupportTab)
DROP POLICY IF EXISTS "Admins can manage all support tickets" ON public.support_tickets;
CREATE POLICY "Admins can manage all support tickets"
  ON public.support_tickets FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage all support messages" ON public.support_messages;
CREATE POLICY "Admins can manage all support messages"
  ON public.support_messages FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- api_keys (UsersTab)
DROP POLICY IF EXISTS "Admins can manage all API keys" ON public.api_keys;
CREATE POLICY "Admins can manage all API keys"
  ON public.api_keys FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- api_request_logs (UsersTab)
DROP POLICY IF EXISTS "Admins can read all API request logs" ON public.api_request_logs;
CREATE POLICY "Admins can read all API request logs"
  ON public.api_request_logs FOR SELECT TO authenticated
  USING (public.is_admin());

-- api_admin_config (APIControlTab writes)
DROP POLICY IF EXISTS "Admins can manage admin config" ON public.api_admin_config;
CREATE POLICY "Admins can manage admin config"
  ON public.api_admin_config FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- api_credits (APIControlTab)
DROP POLICY IF EXISTS "Admins can manage all API credits" ON public.api_credits;
CREATE POLICY "Admins can manage all API credits"
  ON public.api_credits FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- api_operation_costs (APIControlTab edits cost table)
DROP POLICY IF EXISTS "Admins can update operation costs" ON public.api_operation_costs;
CREATE POLICY "Admins can update operation costs"
  ON public.api_operation_costs FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- subscription_events (SubscriptionsTab)
DROP POLICY IF EXISTS "Admins can read all subscription events" ON public.subscription_events;
CREATE POLICY "Admins can read all subscription events"
  ON public.subscription_events FOR SELECT TO authenticated
  USING (public.is_admin());

-- squidcloud_b2_buckets (B2ClusterManager writes; SELECT already public)
DROP POLICY IF EXISTS "Admins can update squidcloud buckets" ON public.squidcloud_b2_buckets;
CREATE POLICY "Admins can update squidcloud buckets"
  ON public.squidcloud_b2_buckets FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete squidcloud buckets" ON public.squidcloud_b2_buckets;
CREATE POLICY "Admins can delete squidcloud buckets"
  ON public.squidcloud_b2_buckets FOR DELETE TO authenticated
  USING (public.is_admin());
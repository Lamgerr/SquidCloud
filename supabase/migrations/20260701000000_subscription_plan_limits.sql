-- Subscription Plan Limits and Enforcement
-- Migration: 20260701000000

-- ============================================================
-- 1. PLAN LIMITS TABLE
-- Defines the hard limits for each subscription tier.
-- These are consumed by RPC functions and edge functions.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.plan_limits (
  tier text PRIMARY KEY,
  concurrent_uploads integer NOT NULL,
  concurrent_downloads integer NOT NULL,
  max_file_size_bytes bigint NOT NULL,
  api_tokens_per_day integer NOT NULL,
  queue_priority text NOT NULL DEFAULT 'standard',
  early_feature_access boolean NOT NULL DEFAULT false,
  sites_always_active boolean NOT NULL DEFAULT false,
  custom_domains boolean NOT NULL DEFAULT false,
  auto_archive_days integer
);

COMMENT ON TABLE public.plan_limits IS 'Defines feature limits per subscription tier. -1 means unlimited.';

-- Seed the plan limits
INSERT INTO public.plan_limits (tier, concurrent_uploads, concurrent_downloads, max_file_size_bytes, api_tokens_per_day, queue_priority, early_feature_access, sites_always_active, custom_domains, auto_archive_days)
VALUES
  ('free',            2,   2,   1073741824, 1000,   'standard',  false, false, false, 50),
  ('supporter',       10,  10,  26843545600, 10000, 'priority',  true,  true,  true,  NULL),
  ('supporter-plus', -1,  -1,  -1,         -1,     'priority',  true,  true,  true,  NULL)
ON CONFLICT (tier) DO NOTHING;

-- ============================================================
-- 2. ADD SUBSCRIPTION TRACKING COLUMNS TO PROFILES
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;

-- ============================================================
-- 3. SUBSCRIPTION EVENTS TABLE
-- Tracks all subscription lifecycle events for audit & email triggers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('purchased', 'redeemed', 'expired', 'cancelled', 'payment_failed', 'payment_expired', 'renewed', 'downgraded', 'email_sent')),
  plan_type text NOT NULL,
  billing_period text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_user_id ON public.subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created_at ON public.subscription_events(created_at);

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription events
CREATE POLICY "Users can view their own subscription events"
  ON public.subscription_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only service role (edge functions) can insert
CREATE POLICY "Service role can insert subscription events"
  ON public.subscription_events FOR INSERT
  TO authenticated
  WITH CHECK (false); -- only service role via edge functions

-- ============================================================
-- 4. RPC: GET USER PLAN LIMITS
-- Returns the plan limits for a user based on their tier.
-- Used by edge functions and frontend for enforcement.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_plan_limits(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tier text;
  limits record;
  result jsonb;
BEGIN
  SELECT tier INTO user_tier FROM profiles WHERE id = user_id;
  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;

  SELECT * INTO limits FROM plan_limits WHERE tier = user_tier;

  IF limits IS NULL THEN
    SELECT * INTO limits FROM plan_limits WHERE tier = 'free';
  END IF;

  result := jsonb_build_object(
    'tier', user_tier,
    'concurrent_uploads', limits.concurrent_uploads,
    'concurrent_downloads', limits.concurrent_downloads,
    'max_file_size_bytes', limits.max_file_size_bytes,
    'api_tokens_per_day', limits.api_tokens_per_day,
    'queue_priority', limits.queue_priority,
    'early_feature_access', limits.early_feature_access,
    'sites_always_active', limits.sites_always_active,
    'custom_domains', limits.custom_domains,
    'auto_archive_days', limits.auto_archive_days
  );

  RETURN result;
END;
$$;

-- ============================================================
-- 5. RPC: CHECK IF USER CAN UPLOAD (concurrent + file size)
-- Called before starting an upload.
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_upload_allowed(
  user_id uuid,
  file_size_bytes bigint DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tier text;
  limits record;
  active_uploads integer;
  result jsonb;
BEGIN
  SELECT tier INTO user_tier FROM profiles WHERE id = user_id;
  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;

  SELECT * INTO limits FROM plan_limits WHERE tier = user_tier;
  IF limits IS NULL THEN
    SELECT * INTO limits FROM plan_limits WHERE tier = 'free';
  END IF;

  -- Count currently active uploads (files created in last 5 minutes that are still being processed)
  -- This is a best-effort count since we don't have real-time tracking in DB
  SELECT COUNT(*) INTO active_uploads
  FROM files
  WHERE user_id = check_upload_allowed.user_id
    AND created_at > now() - interval '5 minutes';

  -- Check file size limit
  IF limits.max_file_size_bytes > 0 AND file_size_bytes > limits.max_file_size_bytes THEN
    result := jsonb_build_object(
      'allowed', false,
      'reason', format('File size exceeds your %s plan limit of %s. Upgrade to upload larger files.',
        user_tier,
        pg_size_pretty(limits.max_file_size_bytes::bigint)
      ),
      'limit', limits.max_file_size_bytes,
      'tier', user_tier
    );
    RETURN result;
  END IF;

  -- Check concurrent upload limit
  IF limits.concurrent_uploads > 0 AND active_uploads >= limits.concurrent_uploads THEN
    result := jsonb_build_object(
      'allowed', false,
      'reason', format('You have reached the concurrent upload limit of %s for your %s plan. Wait for current uploads to finish.',
        limits.concurrent_uploads,
        user_tier
      ),
      'limit', limits.concurrent_uploads,
      'tier', user_tier
    );
    RETURN result;
  END IF;

  result := jsonb_build_object(
    'allowed', true,
    'tier', user_tier,
    'limit', limits.concurrent_uploads
  );

  RETURN result;
END;
$$;

-- ============================================================
-- 6. RPC: CHECK IF USER CAN DOWNLOAD (concurrent)
-- Called before starting a download.
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_download_allowed(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tier text;
  limits record;
  active_downloads integer;
  result jsonb;
BEGIN
  SELECT tier INTO user_tier FROM profiles WHERE id = user_id;
  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;

  SELECT * INTO limits FROM plan_limits WHERE tier = user_tier;
  IF limits IS NULL THEN
    SELECT * INTO limits FROM plan_limits WHERE tier = 'free';
  END IF;

  -- For download concurrency, we use the SmartTransferQueue on frontend.
  -- Server-side, we check recent share access as a proxy.
  SELECT COUNT(*) INTO active_downloads
  FROM shares
  WHERE user_id = check_download_allowed.user_id
    AND created_at > now() - interval '5 minutes';

  IF limits.concurrent_downloads > 0 AND active_downloads >= limits.concurrent_downloads THEN
    result := jsonb_build_object(
      'allowed', false,
      'reason', format('You have reached the concurrent download limit of %s for your %s plan.',
        limits.concurrent_downloads,
        user_tier
      ),
      'limit', limits.concurrent_downloads,
      'tier', user_tier
    );
    RETURN result;
  END IF;

  result := jsonb_build_object(
    'allowed', true,
    'tier', user_tier,
    'limit', limits.concurrent_downloads
  );
  RETURN result;
END;
$$;

-- ============================================================
-- 7. RPC: CHECK SUBSCRIPTION VALIDITY
-- Returns current subscription status including expiration info.
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_subscription_validity(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_record record;
  days_remaining integer;
  result jsonb;
BEGIN
  SELECT * INTO profile_record FROM profiles WHERE id = user_id;

  IF profile_record IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  -- Check if subscription has expired
  IF profile_record.subscription_expires_at IS NOT NULL
     AND profile_record.subscription_expires_at < now()
     AND profile_record.tier != 'free' THEN
    -- Auto-downgrade to free
    UPDATE profiles
    SET is_premium = false,
        tier = 'free',
        updated_at = now()
    WHERE id = user_id
      AND tier != 'free';
    RETURN jsonb_build_object(
      'valid', false,
      'tier', 'free',
      'is_premium', false,
      'reason', 'subscription_expired'
    );
  END IF;

  IF profile_record.subscription_expires_at IS NOT NULL THEN
    days_remaining := GREATEST(0, EXTRACT(DAY FROM profile_record.subscription_expires_at - now())::integer);
  ELSE
    days_remaining := NULL;
  END IF;

  result := jsonb_build_object(
    'valid', profile_record.is_premium,
    'tier', COALESCE(profile_record.tier, 'free'),
    'is_premium', COALESCE(profile_record.is_premium, false),
    'subscription_starts_at', profile_record.subscription_starts_at,
    'subscription_expires_at', profile_record.subscription_expires_at,
    'days_remaining', days_remaining
  );

  RETURN result;
END;
$$;

-- ============================================================
-- 8. RPC: GET USERS WITH EXPIRING SUBSCRIPTIONS
-- Returns users whose subscriptions expire within a given number of days.
-- Used by subscription-manager edge function for email notifications.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_users_with_expiring_subscriptions(
  within_days integer DEFAULT 7
)
RETURNS TABLE (
  user_id uuid,
  email text,
  tier text,
  subscription_expires_at timestamptz,
  days_remaining integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    u.email::text,
    p.tier,
    p.subscription_expires_at,
    GREATEST(0, EXTRACT(DAY FROM p.subscription_expires_at - now())::integer)::integer
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.subscription_expires_at IS NOT NULL
    AND p.subscription_expires_at > now()
    AND p.subscription_expires_at <= now() + (within_days || ' days')::interval
    AND p.is_premium = true
  ORDER BY p.subscription_expires_at ASC;
END;
$$;

-- ============================================================
-- 9. RPC: GET USERS WHOSE SUBSCRIPTIONS JUST EXPIRED
-- Returns users whose subscriptions expired in the last 24 hours.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_users_with_recently_expired_subscriptions()
RETURNS TABLE (
  user_id uuid,
  email text,
  tier text,
  subscription_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    u.email::text,
    p.tier,
    p.subscription_expires_at
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.subscription_expires_at IS NOT NULL
    AND p.subscription_expires_at BETWEEN now() - interval '24 hours' AND now()
    AND p.is_premium = true
  ORDER BY p.subscription_expires_at ASC;
END;
$$;

-- ============================================================
-- 10. RPC: GET USER API TOKEN USAGE FOR TODAY
-- Used to enforce API token/day limits.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_api_token_usage_today(user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  usage_count integer;
BEGIN
  SELECT COUNT(*) INTO usage_count
  FROM api_request_logs
  WHERE user_id = get_user_api_token_usage_today.user_id
    AND created_at >= CURRENT_DATE
    AND created_at < CURRENT_DATE + interval '1 day';

  RETURN COALESCE(usage_count, 0);
END;
$$;

-- ============================================================
-- 11. RPC: CHECK API TOKEN USAGE
-- Returns whether the user has remaining API tokens for today.
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_api_token_available(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tier text;
  limits record;
  tokens_used integer;
  result jsonb;
BEGIN
  SELECT tier INTO user_tier FROM profiles WHERE id = user_id;
  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;

  SELECT * INTO limits FROM plan_limits WHERE tier = user_tier;
  IF limits IS NULL THEN
    SELECT * INTO limits FROM plan_limits WHERE tier = 'free';
  END IF;

  tokens_used := get_user_api_token_usage_today(user_id);

  IF limits.api_tokens_per_day > 0 AND tokens_used >= limits.api_tokens_per_day THEN
    result := jsonb_build_object(
      'available', false,
      'used', tokens_used,
      'limit', limits.api_tokens_per_day,
      'tier', user_tier,
      'reason', format('You have used all %s API tokens for today. Upgrade your plan for more.', limits.api_tokens_per_day)
    );
    RETURN result;
  END IF;

  result := jsonb_build_object(
    'available', true,
    'used', tokens_used,
    'limit', CASE WHEN limits.api_tokens_per_day > 0 THEN limits.api_tokens_per_day ELSE -1 END,
    'tier', user_tier,
    'remaining', CASE WHEN limits.api_tokens_per_day > 0 THEN limits.api_tokens_per_day - tokens_used ELSE -1 END
  );

  RETURN result;
END;
$$;

-- ============================================================
-- 12. RLS POLICIES FOR PLAN_LIMITS
-- Anyone can read plan limits (it's public data)
-- ============================================================
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view plan limits"
  ON public.plan_limits FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can modify plan limits via anonymous
CREATE POLICY "Only service role can insert plan limits"
  ON public.plan_limits FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "Only service role can update plan limits"
  ON public.plan_limits FOR UPDATE
  TO authenticated
  USING (false);

-- ============================================================
-- 13. GRANT EXECUTE PERMISSIONS ON RPCs
-- ============================================================
GRANT EXECUTE ON FUNCTION public.get_user_plan_limits TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_upload_allowed TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_download_allowed TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_subscription_validity TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_users_with_expiring_subscriptions TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_users_with_recently_expired_subscriptions TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_api_token_usage_today TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_api_token_available TO authenticated, anon;

-- ============================================================
-- 14. UPDATE PROFILES RLS TO ALLOW SERVICE ROLE TO SET SUBSCRIPTION FIELDS
-- The existing policy prevents users from changing is_premium/tier.
-- We need to ensure the service role (via edge functions) can still update.
-- Since edge functions use the service_role key which bypasses RLS,
-- the existing RLS should work fine - it blocks authenticated users.
-- ============================================================

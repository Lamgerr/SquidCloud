-- CloudBliss API v4.0 — Credit System & Admin Controls
-- Migration: 20260722000000

-- ============================================================
-- 1. API CREDITS TABLE
-- One row per user, tracks daily credit balance with lazy reset
-- ============================================================
CREATE TABLE IF NOT EXISTS public.api_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_remaining INTEGER NOT NULL DEFAULT 1000,
  credits_used_today INTEGER NOT NULL DEFAULT 0,
  daily_limit INTEGER NOT NULL DEFAULT 1000,
  last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
  custom_daily_limit INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.api_credits IS 'Daily API credit balance per user. Credits reset at UTC midnight via lazy reset.';

ALTER TABLE public.api_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credits"
  ON public.api_credits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages credits"
  ON public.api_credits FOR ALL
  TO authenticated
  USING (false);

-- ============================================================
-- 2. API CREDIT LOG TABLE (append-only audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.api_credit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  operation TEXT NOT NULL,
  credits_deducted INTEGER NOT NULL,
  file_size BIGINT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_credit_log_user_created
  ON public.api_credit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_credit_log_created
  ON public.api_credit_log(created_at);

ALTER TABLE public.api_credit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit logs"
  ON public.api_credit_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert credit logs"
  ON public.api_credit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================
-- 3. API OPERATION COSTS TABLE
-- Configurable credit costs per operation. Admins can adjust.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.api_operation_costs (
  operation TEXT PRIMARY KEY,
  base_cost INTEGER NOT NULL DEFAULT 1,
  per_byte_cost NUMERIC(12,8) DEFAULT 0,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.api_operation_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read operation costs"
  ON public.api_operation_costs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only service role modifies costs"
  ON public.api_operation_costs FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- ============================================================
-- 4. API ADMIN CONFIG TABLE
-- Global API settings controllable from admin dashboard
-- ============================================================
CREATE TABLE IF NOT EXISTS public.api_admin_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.api_admin_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages admin config"
  ON public.api_admin_config FOR ALL
  TO authenticated
  USING (false);

CREATE POLICY "Anyone can read admin config"
  ON public.api_admin_config FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 5. API KEY LIMITS TABLE
-- Per-key custom limits for supporter+ users
-- ============================================================
CREATE TABLE IF NOT EXISTS public.api_key_limits (
  api_key_id UUID PRIMARY KEY REFERENCES public.api_keys(id) ON DELETE CASCADE,
  custom_daily_limit INTEGER,
  custom_rate_limit_rps INTEGER,
  is_disabled BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.api_key_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own key limits"
  ON public.api_key_limits FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.api_keys WHERE id = api_key_id AND user_id = auth.uid())
  );

-- ============================================================
-- 6. SQUIDCDN FILES TABLE
-- Files published to SquidCDN for media streaming
-- ============================================================
CREATE TABLE IF NOT EXISTS public.squidcdn_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  workspace_id UUID REFERENCES public.workspaces(id),
  cdn_path TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  file_size BIGINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  views_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_squidcdn_user ON public.squidcdn_files(user_id);
CREATE INDEX IF NOT EXISTS idx_squidcdn_file ON public.squidcdn_files(file_id);
CREATE INDEX IF NOT EXISTS idx_squidcdn_cdn_path ON public.squidcdn_files(cdn_path);

ALTER TABLE public.squidcdn_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own CDN files"
  ON public.squidcdn_files FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Public can read active CDN files"
  ON public.squidcdn_files FOR SELECT
  TO anon
  USING (is_active = true);

-- ============================================================
-- 7. MODIFY EXISTING TABLES
-- ============================================================
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS request_timestamp_max_age INTEGER DEFAULT 300,
  ADD COLUMN IF NOT EXISTS allow_hmac BOOLEAN DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS api_disabled BOOLEAN DEFAULT false;

-- ============================================================
-- 8. SEED OPERATION COSTS
-- ============================================================
INSERT INTO public.api_operation_costs (operation, base_cost, per_byte_cost, description) VALUES
  ('whoami',             2,    0,              'Get current user info'),
  ('files.list',         1,    0,              'List files and folders'),
  ('files.metadata',     1,    0,              'Get file metadata'),
  ('files.upload.init',  5,    0,              'Initialize file upload (returns signed URLs)'),
  ('files.upload.chunk', 0,    0.0000005,      'Upload chunk (per byte cost)'),
  ('files.upload.complete', 3, 0,              'Complete upload and register file'),
  ('files.download',     3,    0.0000001,      'Download file (base + per byte)'),
  ('files.delete',       2,    0,              'Soft delete a file'),
  ('keys.list',          1,    0,              'List API keys'),
  ('keys.create',        2,    0,              'Create API key'),
  ('keys.update',        2,    0,              'Update API key'),
  ('keys.delete',        2,    0,              'Delete API key'),
  ('storage.usage',      1,    0,              'Get storage usage'),
  ('secrets.list',       2,    0,              'List secrets'),
  ('secrets.get',        3,    0,              'Get secret value'),
  ('secrets.create',     5,    0,              'Create secret'),
  ('secrets.update',     5,    0,              'Update/rename secret'),
  ('secrets.delete',     5,    0,              'Delete secret'),
  ('secrets.verify',     3,    0,              'Verify secret value'),
  ('squidshake.handshake', 3,  0,              'Initiate SquidShake handshake'),
  ('squidshake.ref',     5,    0,              'Issue VeilRef'),
  ('squidshake.audit',   1,    0,              'Log audit entry'),
  ('veilref.verify',     3,    0,              'Verify VeilRef'),
  ('veilref.resolve',    3,    0,              'Resolve VeilRef secret'),
  ('cdn.publish',        5,    0.0000001,      'Publish file to SquidCDN'),
  ('cdn.unpublish',      2,    0,              'Remove from SquidCDN'),
  ('cdn.play',           1,    0.00000002,     'Stream media from SquidCDN'),
  ('cdn.info',           1,    0,              'Get CDN file info'),
  ('search',             3,    0,              'Search files across workspace'),
  ('batch.delete',       1,    0,              'Batch delete (per file)'),
  ('batch.move',         1,    0,              'Batch move (per file)'),
  ('stats.usage',        2,    0,              'Usage statistics'),
  ('export.csv',         5,    0,              'Export file listing as CSV'),
  ('health',             1,    0,              'Health check endpoint')
ON CONFLICT (operation) DO NOTHING;

-- ============================================================
-- 9. SEED ADMIN CONFIG
-- ============================================================
INSERT INTO public.api_admin_config (key, value) VALUES
  ('api_globally_enabled', '"true"'),
  ('global_rate_limit_rps', '100'),
  ('global_daily_credit_multiplier', '1.0'),
  ('maintenance_message', '""')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 10. RPC: DEDUCT_API_CREDITS
-- Atomic credit deduction with lazy UTC midnight reset
-- ============================================================
CREATE OR REPLACE FUNCTION public.deduct_api_credits(
  p_user_id UUID,
  p_api_key_id UUID DEFAULT NULL,
  p_operation TEXT DEFAULT 'whoami',
  p_file_size BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits RECORD;
  v_cost RECORD;
  v_plan_limit INTEGER;
  v_credits_to_deduct INTEGER;
  v_multiplier NUMERIC;
  v_result JSONB;
  v_is_unlimited BOOLEAN;
BEGIN
  -- Get or create credit row (select for update = row lock)
  INSERT INTO api_credits (user_id, credits_remaining, daily_limit, last_reset_date)
  VALUES (p_user_id, 1000, 1000, CURRENT_DATE)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_credits FROM api_credits WHERE user_id = p_user_id FOR UPDATE;

  -- Check custom per-key limit override
  IF p_api_key_id IS NOT NULL THEN
    SELECT custom_daily_limit INTO v_plan_limit
    FROM api_key_limits WHERE api_key_id = p_api_key_id;
    IF v_plan_limit IS NOT NULL AND v_plan_limit > 0 THEN
      v_credits.daily_limit := v_plan_limit;
      v_credits.custom_daily_limit := v_plan_limit;
    END IF;
  END IF;

  -- Lazy UTC midnight reset
  IF v_credits.last_reset_date < CURRENT_DATE THEN
    v_plan_limit := COALESCE(v_credits.custom_daily_limit, v_credits.daily_limit);
    UPDATE api_credits SET
      credits_remaining = CASE WHEN v_plan_limit = -1 THEN -1 ELSE v_plan_limit END,
      credits_used_today = 0,
      last_reset_date = CURRENT_DATE,
      updated_at = now()
    WHERE user_id = p_user_id;
    v_credits.credits_remaining := CASE WHEN v_plan_limit = -1 THEN -1 ELSE v_plan_limit END;
    v_credits.credits_used_today := 0;
  END IF;

  -- Check if unlimited
  IF v_credits.credits_remaining = -1 THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'credits_deducted', 0,
      'credits_remaining', -1,
      'credits_used_today', v_credits.credits_used_today,
      'daily_limit', -1
    );
  END IF;

  -- Get operation cost
  SELECT * INTO v_cost FROM api_operation_costs WHERE operation = p_operation AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Unknown operation: ' || COALESCE(p_operation, 'null'),
      'code', 'UNKNOWN_OPERATION'
    );
  END IF;

  -- Check if operation is free
  IF v_cost.base_cost = 0 AND (v_cost.per_byte_cost = 0 OR p_file_size = 0) THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'credits_deducted', 0,
      'credits_remaining', v_credits.credits_remaining,
      'credits_used_today', v_credits.credits_used_today,
      'daily_limit', v_credits.daily_limit
    );
  END IF;

  -- Get global credit multiplier
  SELECT COALESCE((value::text)::numeric, 1.0) INTO v_multiplier
  FROM api_admin_config WHERE key = 'global_daily_credit_multiplier';

  -- Calculate total cost: base_cost + ceil(per_byte_cost * file_size) * multiplier
  v_credits_to_deduct := GREATEST(1, CEIL((v_cost.base_cost + CEIL(v_cost.per_byte_cost * p_file_size)) * v_multiplier)::INTEGER);

  -- Check balance
  IF v_credits.credits_remaining < v_credits_to_deduct THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Insufficient credits. Required: ' || v_credits_to_deduct || ', Remaining: ' || v_credits.credits_remaining,
      'code', 'INSUFFICIENT_CREDITS',
      'required', v_credits_to_deduct,
      'remaining', v_credits.credits_remaining,
      'operation', p_operation
    );
  END IF;

  -- Deduct
  UPDATE api_credits SET
    credits_remaining = credits_remaining - v_credits_to_deduct,
    credits_used_today = credits_used_today + v_credits_to_deduct,
    updated_at = now()
  WHERE user_id = p_user_id;

  -- Log the deduction
  INSERT INTO api_credit_log (user_id, api_key_id, operation, credits_deducted, file_size)
  VALUES (p_user_id, p_api_key_id, p_operation, v_credits_to_deduct, CASE WHEN p_file_size > 0 THEN p_file_size ELSE NULL END);

  RETURN jsonb_build_object(
    'allowed', true,
    'credits_deducted', v_credits_to_deduct,
    'credits_remaining', v_credits.credits_remaining - v_credits_to_deduct,
    'credits_used_today', v_credits.credits_used_today + v_credits_to_deduct,
    'daily_limit', v_credits.daily_limit
  );
END;
$$;

-- ============================================================
-- 11. RPC: CHECK_API_CREDITS
-- Non-destructive balance check
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_api_credits(
  p_user_id UUID,
  p_operation TEXT DEFAULT 'whoami',
  p_file_size BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits RECORD;
  v_cost RECORD;
  v_credits_to_deduct INTEGER;
  v_multiplier NUMERIC;
BEGIN
  SELECT * INTO v_credits FROM api_credits WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'available', true,
      'credits_remaining', 1000,
      'daily_limit', 1000
    );
  END IF;

  IF v_credits.credits_remaining = -1 THEN
    RETURN jsonb_build_object(
      'available', true,
      'credits_remaining', -1,
      'daily_limit', -1
    );
  END IF;

  SELECT * INTO v_cost FROM api_operation_costs WHERE operation = p_operation AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('available', false, 'reason', 'Unknown operation');
  END IF;

  SELECT COALESCE((value::text)::numeric, 1.0) INTO v_multiplier
  FROM api_admin_config WHERE key = 'global_daily_credit_multiplier';

  v_credits_to_deduct := GREATEST(1, CEIL((v_cost.base_cost + CEIL(v_cost.per_byte_cost * p_file_size)) * v_multiplier)::INTEGER);

  RETURN jsonb_build_object(
    'available', v_credits.credits_remaining >= v_credits_to_deduct,
    'credits_remaining', v_credits.credits_remaining,
    'required', v_credits_to_deduct,
    'daily_limit', v_credits.daily_limit
  );
END;
$$;

-- ============================================================
-- 12. RPC: RESET_ALL_API_CREDITS
-- Called by Vercel cron daily at 00:05 UTC
-- ============================================================
CREATE OR REPLACE FUNCTION public.reset_all_api_credits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE api_credits SET
    credits_remaining = daily_limit,
    credits_used_today = 0,
    last_reset_date = CURRENT_DATE,
    updated_at = now()
  WHERE last_reset_date < CURRENT_DATE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================
-- 13. RPC: GET_CREDIT_USAGE_STATS
-- Usage analytics for admin dashboard
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_credit_usage_stats(
  p_days INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_requests', (SELECT COUNT(*) FROM api_credit_log WHERE created_at >= now() - (p_days || ' days')::interval),
    'total_credits_deducted', (SELECT COALESCE(SUM(credits_deducted), 0) FROM api_credit_log WHERE created_at >= now() - (p_days || ' days')::interval),
    'top_operations', (SELECT jsonb_agg(t) FROM (
      SELECT operation, COUNT(*) as count, SUM(credits_deducted) as total_credits
      FROM api_credit_log
      WHERE created_at >= now() - (p_days || ' days')::interval
      GROUP BY operation ORDER BY COUNT(*) DESC LIMIT 10
    ) t),
    'daily_usage', (SELECT jsonb_agg(t) FROM (
      SELECT DATE(created_at) as date, COUNT(*) as count, SUM(credits_deducted) as credits
      FROM api_credit_log
      WHERE created_at >= now() - (p_days || ' days')::interval
      GROUP BY DATE(created_at) ORDER BY date DESC
    ) t),
    'users_with_credits', (SELECT COUNT(*) FROM api_credits)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

-- ============================================================
-- 14. GRANT EXECUTE PERMISSIONS
-- ============================================================
GRANT EXECUTE ON FUNCTION public.deduct_api_credits TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_api_credits TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.reset_all_api_credits TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_credit_usage_stats TO authenticated, anon;

-- ============================================================
-- 15. CREATE UPDATED_AT TRIGGER FOR API CREDITS
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_api_credits_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_api_credits_updated_at
  BEFORE UPDATE ON public.api_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_api_credits_updated_at();

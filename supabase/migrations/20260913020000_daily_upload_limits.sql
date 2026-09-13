-- ============================================================
-- DAILY FILE UPLOAD LIMITS (files per 24h, UTC midnight reset)
-- free = 20, supporter = 50, supporter-plus = 100
-- Counter lives on api_credits so the SAME daily cron
-- (reset_all_api_credits, Vercel 00:05 UTC) resets both.
-- ============================================================

-- 1. Per-tier daily upload limits
ALTER TABLE public.plan_limits
  ADD COLUMN IF NOT EXISTS daily_upload_limit integer NOT NULL DEFAULT 20;

UPDATE public.plan_limits SET daily_upload_limit = 20  WHERE tier = 'free';
UPDATE public.plan_limits SET daily_upload_limit = 50  WHERE tier = 'supporter';
UPDATE public.plan_limits SET daily_upload_limit = 100 WHERE tier = 'supporter-plus';

-- 2. Per-user daily upload counter (own reset date: no cross-talk with credits)
ALTER TABLE public.api_credits
  ADD COLUMN IF NOT EXISTS uploads_used_today integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS uploads_reset_date date NOT NULL DEFAULT CURRENT_DATE;

-- 3. Same cron RPC now resets upload counters too
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
    credits_remaining = CASE WHEN last_reset_date < CURRENT_DATE THEN daily_limit ELSE credits_remaining END,
    credits_used_today = CASE WHEN last_reset_date < CURRENT_DATE THEN 0 ELSE credits_used_today END,
    last_reset_date = CASE WHEN last_reset_date < CURRENT_DATE THEN CURRENT_DATE ELSE last_reset_date END,
    uploads_used_today = CASE WHEN uploads_reset_date < CURRENT_DATE THEN 0 ELSE uploads_used_today END,
    uploads_reset_date = CASE WHEN uploads_reset_date < CURRENT_DATE THEN CURRENT_DATE ELSE uploads_reset_date END,
    updated_at = now()
  WHERE last_reset_date < CURRENT_DATE OR uploads_reset_date < CURRENT_DATE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 4. Count every completed upload via trigger (covers web, CLI, API, automations)
CREATE OR REPLACE FUNCTION public.count_file_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO api_credits (user_id, credits_remaining, daily_limit, last_reset_date, uploads_used_today, uploads_reset_date)
  VALUES (NEW.user_id, 1000, 1000, CURRENT_DATE, 1, CURRENT_DATE)
  ON CONFLICT ON CONSTRAINT api_credits_pkey DO UPDATE SET
    uploads_used_today = CASE
      WHEN api_credits.uploads_reset_date < CURRENT_DATE THEN 1
      ELSE api_credits.uploads_used_today + 1
    END,
    uploads_reset_date = CURRENT_DATE,
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_count_file_upload ON public.files;
CREATE TRIGGER trg_count_file_upload
AFTER INSERT ON public.files
FOR EACH ROW EXECUTE FUNCTION public.count_file_upload();

-- 5. Upload gate: file size AND daily count (with lazy UTC-midnight reset)
CREATE OR REPLACE FUNCTION public.check_upload_file_size(
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
  size_limit bigint;
  upload_limit integer;
  uploads_used integer;
BEGIN
  SELECT tier INTO user_tier FROM profiles WHERE id = user_id;
  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;

  SELECT max_file_size_bytes, daily_upload_limit INTO size_limit, upload_limit
  FROM plan_limits WHERE tier = user_tier;
  IF size_limit IS NULL THEN
    SELECT max_file_size_bytes, daily_upload_limit INTO size_limit, upload_limit
    FROM plan_limits WHERE tier = 'free';
  END IF;

  -- Lazy UTC-midnight reset of the daily upload counter (same pattern as credits)
  INSERT INTO api_credits (user_id, credits_remaining, daily_limit, last_reset_date, uploads_used_today, uploads_reset_date)
  VALUES (check_upload_file_size.user_id, 1000, 1000, CURRENT_DATE, 0, CURRENT_DATE)
  ON CONFLICT ON CONSTRAINT api_credits_pkey DO NOTHING;

  UPDATE api_credits SET
    uploads_used_today = 0,
    uploads_reset_date = CURRENT_DATE,
    updated_at = now()
  WHERE api_credits.user_id = check_upload_file_size.user_id
    AND api_credits.uploads_reset_date < CURRENT_DATE;

  SELECT uploads_used_today INTO uploads_used
  FROM api_credits WHERE api_credits.user_id = check_upload_file_size.user_id;

  IF size_limit > 0 AND file_size_bytes > size_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('File size exceeds your %s plan limit of %s. Upgrade to upload larger files.',
        user_tier,
        pg_size_pretty(size_limit)
      ),
      'limit', size_limit,
      'tier', user_tier,
      'daily_upload_limit', upload_limit,
      'uploads_used_today', uploads_used
    );
  END IF;

  IF upload_limit > 0 AND uploads_used >= upload_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('You have reached your daily upload limit of %s files on the %s plan. Resets at midnight UTC.',
        upload_limit,
        user_tier
      ),
      'limit', size_limit,
      'tier', user_tier,
      'daily_upload_limit', upload_limit,
      'uploads_used_today', uploads_used
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'limit', size_limit,
    'tier', user_tier,
    'daily_upload_limit', upload_limit,
    'uploads_used_today', uploads_used
  );
END;
$$;

-- 6. Expose daily quota to the client via the limits RPC (with lazy reset)
CREATE OR REPLACE FUNCTION public.get_user_plan_limits(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tier text;
  limits record;
  uploads_used integer;
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

  -- Lazy UTC-midnight reset so the client always sees today's count
  INSERT INTO api_credits (user_id, credits_remaining, daily_limit, last_reset_date, uploads_used_today, uploads_reset_date)
  VALUES (get_user_plan_limits.user_id, 1000, 1000, CURRENT_DATE, 0, CURRENT_DATE)
  ON CONFLICT ON CONSTRAINT api_credits_pkey DO NOTHING;

  UPDATE api_credits SET
    uploads_used_today = 0,
    uploads_reset_date = CURRENT_DATE,
    updated_at = now()
  WHERE api_credits.user_id = get_user_plan_limits.user_id
    AND api_credits.uploads_reset_date < CURRENT_DATE;

  SELECT uploads_used_today INTO uploads_used
  FROM api_credits WHERE api_credits.user_id = get_user_plan_limits.user_id;

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
    'auto_archive_days', limits.auto_archive_days,
    'daily_upload_limit', limits.daily_upload_limit,
    'uploads_used_today', COALESCE(uploads_used, 0)
  );

  RETURN result;
END;
$$;

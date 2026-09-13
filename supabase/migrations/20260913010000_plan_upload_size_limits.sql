-- ============================================================
-- PLAN UPLOAD SIZE LIMITS (matches advertised pricing)
-- free = 1 GB, supporter = 25 GB, supporter-plus = unlimited (-1)
-- ============================================================

UPDATE public.plan_limits
SET max_file_size_bytes = 1073741824    -- 1 GB
WHERE tier = 'free';

UPDATE public.plan_limits
SET max_file_size_bytes = 26843545600   -- 25 GB
WHERE tier = 'supporter';

UPDATE public.plan_limits
SET max_file_size_bytes = -1            -- unlimited
WHERE tier = 'supporter-plus';

-- ============================================================
-- RPC: CHECK UPLOAD FILE SIZE ONLY (no concurrent-upload proxy)
-- Called server-side by squidcloud-cluster before minting signed
-- upload URLs, so the client-side check can't be bypassed.
-- A limit <= 0 means unlimited.
-- ============================================================
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
BEGIN
  SELECT tier INTO user_tier FROM profiles WHERE id = user_id;
  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;

  SELECT max_file_size_bytes INTO size_limit FROM plan_limits WHERE tier = user_tier;
  IF size_limit IS NULL THEN
    SELECT max_file_size_bytes INTO size_limit FROM plan_limits WHERE tier = 'free';
  END IF;

  IF size_limit > 0 AND file_size_bytes > size_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('File size exceeds your %s plan limit of %s. Upgrade to upload larger files.',
        user_tier,
        pg_size_pretty(size_limit)
      ),
      'limit', size_limit,
      'tier', user_tier
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'limit', size_limit,
    'tier', user_tier
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_upload_file_size TO authenticated, anon;

-- KZA-PREL Phase 4: Hardening
-- Rate limiting, geo-velocity scoring, CIP rotation, enhanced threat detection

-- ========================================
-- 1. RATE LIMITING PER FUNCTION PER USER
-- ========================================

CREATE TABLE IF NOT EXISTS kza_rate_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  function_id TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INTEGER NOT NULL DEFAULT 0,
  tokens_remaining INTEGER NOT NULL DEFAULT 60,
  tokens_refilled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_buckets_lookup
  ON kza_rate_buckets(user_id, function_id, window_start);

-- ========================================
-- 2. GEO-VELOCITY TRACKING
-- ========================================

CREATE TABLE IF NOT EXISTS kza_geo_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  ip_address TEXT NOT NULL,
  country_code TEXT,
  city TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geo_events_user_time
  ON kza_geo_events(user_id, occurred_at DESC);

-- ========================================
-- 3. CIP VERSION REGISTRY
-- ========================================

CREATE TABLE IF NOT EXISTS kza_cip_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  is_current BOOLEAN NOT NULL DEFAULT false,
  released_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deprecated_at TIMESTAMPTZ,
  min_score INTEGER NOT NULL DEFAULT 40,
  entropy_required INTEGER NOT NULL DEFAULT 64,
  timing_min_ms INTEGER NOT NULL DEFAULT 80,
  timing_max_ms INTEGER NOT NULL DEFAULT 500
);

CREATE INDEX IF NOT EXISTS idx_cip_versions_current
  ON kza_cip_versions(is_current) WHERE is_current = true;

-- Seed initial CIP version
INSERT INTO kza_cip_versions (version, is_current, min_score, entropy_required, timing_min_ms, timing_max_ms)
VALUES ('1.0.0', true, 40, 64, 80, 500)
ON CONFLICT (version) DO NOTHING;

-- ========================================
-- 4. ENHANCED RATE LIMITING FUNCTION
-- ========================================

CREATE OR REPLACE FUNCTION kza_check_rate_limit(
  p_user_id UUID,
  p_function_id TEXT,
  p_max_rps INTEGER DEFAULT 10,
  p_burst_size INTEGER DEFAULT 30
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window TIMESTAMPTZ;
  v_bucket kza_rate_buckets;
  v_tokens_available INTEGER;
  v_now TIMESTAMPTZ := now();
  v_elapsed_seconds DOUBLE PRECISION;
  v_tokens_to_add INTEGER;
BEGIN
  v_window := date_trunc('second', v_now);

  -- Get or create bucket for this second
  INSERT INTO kza_rate_buckets (user_id, function_id, window_start, tokens_remaining)
  VALUES (p_user_id, p_function_id, v_window, p_burst_size)
  ON CONFLICT (user_id, function_id, window_start)
  DO UPDATE SET request_count = kza_rate_buckets.request_count + 1
  RETURNING * INTO v_bucket;

  IF NOT FOUND THEN
    SELECT * INTO v_bucket
    FROM kza_rate_buckets
    WHERE user_id = p_user_id
      AND function_id = p_function_id
      AND window_start = v_window;
  END IF;

  -- Increment request count
  UPDATE kza_rate_buckets
  SET request_count = request_count + 1
  WHERE id = v_bucket.id;

  -- Token bucket refill
  v_elapsed_seconds := EXTRACT(EPOCH FROM v_now - v_bucket.tokens_refilled_at);
  v_tokens_to_add := GREATEST(0, floor(v_elapsed_seconds * p_max_rps)::INTEGER);
  v_tokens_available := LEAST(p_burst_size, v_bucket.tokens_remaining + v_tokens_to_add);

  IF v_tokens_available <= 0 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'retry_after', ceil(1.0 / p_max_rps * 1000)::INTEGER,
      'tokens_remaining', 0
    );
  END IF;

  UPDATE kza_rate_buckets
  SET
    tokens_remaining = v_tokens_available - 1,
    tokens_refilled_at = v_now
  WHERE id = v_bucket.id;

  RETURN jsonb_build_object(
    'allowed', true,
    'tokens_remaining', v_tokens_available - 1,
    'request_count', v_bucket.request_count + 1
  );
END;
$$;

-- ========================================
-- 5. GEO-VELOCITY CHECK FUNCTION
-- ========================================

CREATE OR REPLACE FUNCTION kza_check_geo_velocity(
  p_user_id UUID,
  p_ip_address TEXT,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_max_speed_kmh DOUBLE PRECISION DEFAULT 900
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_event kza_geo_events;
  v_distance_km DOUBLE PRECISION;
  v_time_diff_hours DOUBLE PRECISION;
  v_speed_kmh DOUBLE PRECISION;
  v_score INTEGER;
BEGIN
  -- Get last geo event for this user within last 24h
  SELECT * INTO v_last_event
  FROM kza_geo_events
  WHERE user_id = p_user_id
    AND latitude IS NOT NULL
    AND longitude IS NOT NULL
    AND occurred_at > now() - interval '24 hours'
  ORDER BY occurred_at DESC
  LIMIT 1;

  IF v_last_event.id IS NULL OR p_latitude IS NULL OR p_longitude IS NULL THEN
    -- Insert event and return clean
    INSERT INTO kza_geo_events (user_id, ip_address, latitude, longitude)
    VALUES (p_user_id, p_ip_address, p_latitude, p_longitude);
    RETURN jsonb_build_object('score', 100, 'alert', false);
  END IF;

  -- Haversine distance
  v_distance_km := 6371 * 2 * asin(
    sqrt(
      power(sin(radians(p_latitude - v_last_event.latitude) / 2), 2)
      + cos(radians(v_last_event.latitude))
      * cos(radians(p_latitude))
      * power(sin(radians(p_longitude - v_last_event.longitude) / 2), 2)
    )
  );

  v_time_diff_hours := EXTRACT(EPOCH FROM now() - v_last_event.occurred_at) / 3600;

  IF v_time_diff_hours < 0.01 THEN
    v_speed_kmh := 0;
  ELSE
    v_speed_kmh := v_distance_km / v_time_diff_hours;
  END IF;

  -- Score: 100 = safe, 0 = impossible travel
  IF v_speed_kmh > p_max_speed_kmh THEN
    v_score := GREATEST(0, 100 - ((v_speed_kmh - p_max_speed_kmh) / 100)::INTEGER * 10);
  ELSE
    v_score := 100;
  END IF;

  -- Insert current event
  INSERT INTO kza_geo_events (user_id, ip_address, latitude, longitude)
  VALUES (p_user_id, p_ip_address, p_latitude, p_longitude);

  RETURN jsonb_build_object(
    'score', v_score,
    'speed_kmh', round(v_speed_kmh::numeric, 1),
    'distance_km', round(v_distance_km::numeric, 1),
    'time_hours', round(v_time_diff_hours::numeric, 2),
    'alert', v_score < 30,
    'previous_location', jsonb_build_object(
      'lat', v_last_event.latitude,
      'lng', v_last_event.longitude,
      'time', v_last_event.occurred_at
    )
  );
END;
$$;

-- ========================================
-- 6. CIP VERSION VALIDATION FUNCTION
-- ========================================

CREATE OR REPLACE FUNCTION kza_validate_cip_version(
  p_version TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cip kza_cip_versions;
BEGIN
  SELECT * INTO v_cip
  FROM kza_cip_versions
  WHERE version = p_version
    AND (deprecated_at IS NULL OR deprecated_at > now());

  IF v_cip.id IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'CIP version unknown or deprecated'
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'is_current', v_cip.is_current,
    'min_score', v_cip.min_score,
    'entropy_required', v_cip.entropy_required,
    'timing_min_ms', v_cip.timing_min_ms,
    'timing_max_ms', v_cip.timing_max_ms
  );
END;
$$;

-- ========================================
-- 7. UPDATE KZA_PREL_REGISTRY WITH RATE LIMITS
-- ========================================

ALTER TABLE kza_prel_registry
  ADD COLUMN IF NOT EXISTS rate_limit_rps INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS rate_limit_burst INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS geo_velocity_check BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS geo_max_speed_kmh DOUBLE PRECISION NOT NULL DEFAULT 900;

-- Update rate limits for sensitive functions
UPDATE kza_prel_registry SET
  rate_limit_rps = 3,
  rate_limit_burst = 10,
  geo_velocity_check = true
WHERE function_id IN (
  'admin-auth', 'admin-data-access', 'verify-admin',
  'api-key-management', 'file-key', 'secure-file-metadata'
);

UPDATE kza_prel_registry SET
  rate_limit_rps = 5,
  rate_limit_burst = 20,
  geo_velocity_check = true
WHERE function_id IN (
  'file-operations', 'trash-operations', 'cloud-file-browser',
  'github-storage', 'github-cluster', 'store-provider'
);

UPDATE kza_prel_registry SET
  rate_limit_rps = 20,
  rate_limit_burst = 100
WHERE function_id IN (
  'media-segment', 'media-playlist', 'media-master-manifest',
  'video-stream-proxy', 'video-stream-url'
);

UPDATE kza_prel_registry SET
  rate_limit_rps = 100,
  rate_limit_burst = 500
WHERE function_id = 'get-app-updates';

-- ========================================
-- 8. ENHANCED THREAT DETECTION
-- ========================================

-- Add geo velocity columns to threat events
ALTER TABLE kza_threat_events
  ADD COLUMN IF NOT EXISTS geo_score INTEGER,
  ADD COLUMN IF NOT EXISTS rate_limit_exceeded BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cip_version TEXT;

-- ========================================
-- 9a. ADD GEO SCORE TO SESSIONS
-- ========================================

ALTER TABLE kza_prel_sessions
  ADD COLUMN IF NOT EXISTS geo_score INTEGER;

-- ========================================
-- 10. CLEANUP: RLS FOR NEW TABLES
-- ========================================

ALTER TABLE kza_rate_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE kza_geo_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE kza_cip_versions ENABLE ROW LEVEL SECURITY;

-- Service role only access
CREATE POLICY kza_rate_buckets_service_role
  ON kza_rate_buckets FOR ALL TO service_role USING (true);

CREATE POLICY kza_geo_events_service_role
  ON kza_geo_events FOR ALL TO service_role USING (true);

CREATE POLICY kza_cip_versions_service_role
  ON kza_cip_versions FOR ALL TO service_role USING (true);

-- ========================================
-- 10. SCHEDULED CLEANUP FUNCTION
-- ========================================

CREATE OR REPLACE FUNCTION kza_cleanup_hardening_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Remove rate buckets older than 1 hour
  DELETE FROM kza_rate_buckets
  WHERE window_start < now() - interval '1 hour';

  -- Remove geo events older than 7 days
  DELETE FROM kza_geo_events
  WHERE occurred_at < now() - interval '7 days';

  -- Clean expired CIP versions (deprecated > 30 days)
  UPDATE kza_cip_versions
  SET deprecated_at = now()
  WHERE is_current = false
    AND deprecated_at IS NULL
    AND released_at < now() - interval '90 days';
END;
$$;

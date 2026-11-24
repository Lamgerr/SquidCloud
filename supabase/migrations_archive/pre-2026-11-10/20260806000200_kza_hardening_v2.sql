-- KZA-PREL v2 Hardwaretning
-- IP-based rate limiting, CIP proof-of-work, shadow bans, threat score decay,
-- geo coordinates, SQL heartbeat monitor.

-- ========================================
-- 1. IP-BASED RATE LIMITING (covers anon + api_key callers)
-- ========================================

CREATE TABLE IF NOT EXISTS kza_ip_rate_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash TEXT NOT NULL,
  function_id TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INTEGER NOT NULL DEFAULT 0,
  tokens_remaining INTEGER NOT NULL DEFAULT 60,
  tokens_refilled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ip_rate_buckets_lookup
  ON kza_ip_rate_buckets(ip_hash, function_id, window_start);

CREATE OR REPLACE FUNCTION kza_check_ip_rate_limit(
  p_ip_hash TEXT,
  p_function_id TEXT,
  p_max_rps INTEGER DEFAULT 10,
  p_burst_size INTEGER DEFAULT 30
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window TIMESTAMPTZ;
  v_bucket kza_ip_rate_buckets;
  v_tokens_available INTEGER;
  v_now TIMESTAMPTZ := now();
  v_elapsed_seconds DOUBLE PRECISION;
  v_tokens_to_add INTEGER;
BEGIN
  IF p_ip_hash IS NULL THEN
    RETURN jsonb_build_object('allowed', true);
  END IF;

  v_window := date_trunc('second', v_now);

  INSERT INTO kza_ip_rate_buckets (ip_hash, function_id, window_start, tokens_remaining)
  VALUES (p_ip_hash, p_function_id, v_window, p_burst_size)
  ON CONFLICT (ip_hash, function_id, window_start)
  DO NOTHING
  RETURNING * INTO v_bucket;

  IF NOT FOUND THEN
    SELECT * INTO v_bucket
    FROM kza_ip_rate_buckets
    WHERE ip_hash = p_ip_hash
      AND function_id = p_function_id
      AND window_start = v_window;
  END IF;

  UPDATE kza_ip_rate_buckets
  SET request_count = request_count + 1
  WHERE id = v_bucket.id;

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

  UPDATE kza_ip_rate_buckets
  SET tokens_remaining = v_tokens_available - 1, tokens_refilled_at = v_now
  WHERE id = v_bucket.id;

  RETURN jsonb_build_object(
    'allowed', true,
    'tokens_remaining', v_tokens_available - 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION kza_check_ip_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;

-- ========================================
-- 2. CIP PROOF-OF-WORK (client must burn compute; throttles bots)
-- ========================================

ALTER TABLE kza_cip_versions
  ADD COLUMN IF NOT EXISTS pow_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pow_bits INTEGER NOT NULL DEFAULT 0;

UPDATE kza_cip_versions SET pow_required = true, pow_bits = 12 WHERE version = '1.0.0';

-- ========================================
-- 3. SHADOW BANS (RED tier -> serve 404 canaries instead of blocking)
-- ========================================

ALTER TABLE kza_banned_entities
  ADD COLUMN IF NOT EXISTS shadow BOOLEAN NOT NULL DEFAULT false;

-- ========================================
-- 4. THREAT SCORE DECAY support
-- ========================================

ALTER TABLE kza_user_profiles
  ADD COLUMN IF NOT EXISTS threat_score_decayed_at TIMESTAMPTZ;

-- ========================================
-- 5. HEALTH CHECKS + SCHEDULED HEARTBEAT
-- ========================================

CREATE TABLE IF NOT EXISTS kza_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PASS', 'WARN', 'FAIL')),
  details JSONB,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kza_health_checks_time ON kza_health_checks(checked_at DESC);

CREATE OR REPLACE FUNCTION kza_heartbeat_check()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_functions INT;
  v_expired_sessions INT;
  v_keyring_ok BOOLEAN;
  v_result JSONB;
BEGIN
  SELECT count(*) INTO v_active_functions FROM kza_prel_registry WHERE is_active = true;
  SELECT count(*) INTO v_expired_sessions FROM kza_prel_sessions
    WHERE consumed_at IS NULL AND expires_at < now();

  SELECT EXISTS (
    SELECT 1 FROM security_keyring WHERE name IN ('kza_prel_hmac_v2', 'kza_veil_master', 'kza_prel_f2fa_master')
    HAVING count(*) = 3
  ) INTO v_keyring_ok;

  DELETE FROM kza_prel_sessions
    WHERE expires_at < now() AND consumed_at IS NOT NULL;
  DELETE FROM kza_rate_buckets WHERE window_start < now() - interval '1 hour';
  DELETE FROM kza_ip_rate_buckets WHERE window_start < now() - interval '1 hour';
  DELETE FROM kza_geo_events WHERE occurred_at < now() - interval '7 days';

  INSERT INTO kza_health_checks (check_name, status, details) VALUES
    ('registry', CASE WHEN v_active_functions > 0 THEN 'PASS' ELSE 'FAIL' END,
       jsonb_build_object('active_functions', v_active_functions)),
    ('session_pressure', CASE WHEN v_expired_sessions > 1000 THEN 'WARN' ELSE 'PASS' END,
       jsonb_build_object('expired_unconsumed', v_expired_sessions)),
    ('keyring', CASE WHEN v_keyring_ok THEN 'PASS' ELSE 'FAIL' END, jsonb_build_object('keys', 'kza_prel_hmac_v2,kza_veil_master,kza_prel_f2fa_master'));

  v_result := jsonb_build_object(
    'ok', v_active_functions > 0 AND v_keyring_ok,
    'active_functions', v_active_functions,
    'expired_unconsumed_sessions', v_expired_sessions,
    'keyring_ok', v_keyring_ok
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION kza_heartbeat_check() TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'kza-heartbeat') THEN
    PERFORM cron.schedule('kza-heartbeat', '0 * * * *', 'select public.kza_heartbeat_check();');
  END IF;
END $$;

-- ========================================
-- 6. GEO-FENCE + IP REPUTATION in gateway flow
-- ========================================

ALTER TABLE kza_prel_registry
  ADD COLUMN IF NOT EXISTS geo_fence_check BOOLEAN NOT NULL DEFAULT false;

-- Geo-fence rules: country-level allow/block
ALTER TABLE kza_geo_fence
  ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'block' CHECK (severity IN ('block', 'shadow'));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM kza_geo_fence WHERE country_code = 'KP') THEN
    INSERT INTO kza_geo_fence (country_code, action, reason) VALUES ('KP', 'block', 'Sanctions / high-fraud origin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM kza_geo_fence WHERE country_code = 'IR') THEN
    INSERT INTO kza_geo_fence (country_code, action, reason) VALUES ('IR', 'block', 'Sanctions / high-fraud origin');
  END IF;
END $$;

-- ========================================
-- 7. IP REPUTATION helper (callable from gateway when coordinates absent)
-- ========================================

CREATE OR REPLACE FUNCTION kza_check_geo_fence(p_country TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rule record;
BEGIN
  SELECT * INTO v_rule FROM kza_geo_fence
    WHERE country_code = upper(p_country) ORDER BY updated_at DESC LIMIT 1;

  IF v_rule IS NULL THEN
    RETURN jsonb_build_object('allowed', true);
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_rule.action = 'allow',
    'shadow', v_rule.severity = 'shadow',
    'reason', v_rule.reason
  );
END;
$$;

GRANT EXECUTE ON FUNCTION kza_check_geo_fence(TEXT) TO service_role;
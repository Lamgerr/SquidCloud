-- KZA Veil — zero-knowledge behavioral privacy
-- Encrypt behavioral snapshots at rest, hash IPs, no-log mode for sensitive
-- streaming/share functions, user-ownable export + delete.

-- ========================================
-- 1. VEIL MASTER KEY
-- ========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.security_keyring WHERE name = 'kza_veil_master'
  ) THEN
    INSERT INTO public.security_keyring (name, key_id)
    VALUES ('kza_veil_master', (SELECT (pgsodium.create_key()).id));
  END IF;
END $$;

-- ========================================
-- 2. THREAT EVENTS — encrypted snapshot + hashed IP + plaintext country
-- ========================================

ALTER TABLE public.kza_threat_events
  ADD COLUMN IF NOT EXISTS payload_snapshot_enc TEXT,
  ADD COLUMN IF NOT EXISTS payload_snapshot_nonce TEXT,
  ADD COLUMN IF NOT EXISTS ip_hash TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT;

CREATE INDEX IF NOT EXISTS idx_kza_threat_events_ip_hash
  ON public.kza_threat_events(ip_hash);

-- ========================================
-- 3. USER PROFILES — encrypt typical_devices
-- ========================================

ALTER TABLE public.kza_user_profiles
  ADD COLUMN IF NOT EXISTS typical_devices_enc TEXT,
  ADD COLUMN IF NOT EXISTS typical_devices_nonce TEXT;

-- ========================================
-- 4. NO-LOG MODE for privacy-sensitive functions
-- ========================================

ALTER TABLE public.kza_prel_registry
  ADD COLUMN IF NOT EXISTS veil_no_log BOOLEAN NOT NULL DEFAULT false;

UPDATE public.kza_prel_registry SET veil_no_log = true
WHERE function_id IN (
  'media-segment', 'media-playlist', 'media-master-manifest', 'media-manifest',
  'video-stream-proxy', 'video-stream-url', 'download-shared-file',
  'validate-share', 'serve-pdf', 'serve-pdf-secure', 'download-manager'
);

-- ========================================
-- 5. IP REPUTATION — hashed IP column
-- ========================================

ALTER TABLE public.kza_ip_reputation
  ADD COLUMN IF NOT EXISTS ip_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_kza_ip_reputation_ip_hash
  ON public.kza_ip_reputation(ip_hash) WHERE ip_hash IS NOT NULL;

-- ========================================
-- 6. VEIL HELPERS (service_role)
-- ========================================

CREATE OR REPLACE FUNCTION public.kza_veil_encrypt_snapshot(p_payload JSONB)
RETURNS TABLE(ciphertext TEXT, nonce TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key_id UUID;
  v_nonce BYTEA := gen_random_bytes(24);
BEGIN
  SELECT key_id INTO v_key_id FROM public.security_keyring WHERE name = 'kza_veil_master';
  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'Veil key not found';
  END IF;

  RETURN QUERY SELECT
    encode(pgsodium.crypto_secretbox(convert_to(p_payload::text, 'utf8'), v_nonce, v_key_id), 'hex'),
    encode(v_nonce, 'hex');
END;
$$;

CREATE OR REPLACE FUNCTION public.kza_veil_decrypt_snapshot(p_ciphertext TEXT, p_nonce TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key_id UUID;
  v_plain BYTEA;
BEGIN
  SELECT key_id INTO v_key_id FROM public.security_keyring WHERE name = 'kza_veil_master';
  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'Veil key not found';
  END IF;

  v_plain := pgsodium.crypto_secretbox_open(decode(p_ciphertext, 'hex'), decode(p_nonce, 'hex'), v_key_id);
  RETURN v_plain::text::jsonb;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.kza_veil_ip_hash(p_ip TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key_id UUID;
  v_key BYTEA;
BEGIN
  IF p_ip IS NULL OR p_ip = '' OR p_ip = 'unknown' THEN
    RETURN NULL;
  END IF;

  SELECT key_id INTO v_key_id FROM public.security_keyring WHERE name = 'kza_veil_master';
  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'Veil key not found';
  END IF;

  SELECT key INTO v_key FROM pgsodium.get_key(v_key_id);
  RETURN encode(pgsodium.crypto_auth(convert_to(p_ip, 'utf8'), v_key), 'hex');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.kza_veil_encrypt_snapshot(JSONB) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kza_veil_decrypt_snapshot(TEXT, TEXT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kza_veil_ip_hash(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kza_veil_encrypt_snapshot(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.kza_veil_decrypt_snapshot(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.kza_veil_ip_hash(TEXT) TO service_role;

-- ========================================
-- 7. USER SELF-SERVICE: view + delete own behavioral data
-- ========================================

CREATE OR REPLACE FUNCTION public.kza_veil_export_profile(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_result JSONB;
BEGIN
  v_role := current_setting('request.jwt.claims', true)::jsonb->>'role';
  IF v_role <> 'service_role' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'KZA_VEIL_NOT_OWNER';
  END IF;

  SELECT jsonb_build_object(
    'profile', CASE WHEN p.user_id IS NOT NULL THEN jsonb_build_object(
      'total_requests', p.total_requests,
      'typical_countries', p.typical_countries,
      'typical_endpoints_count', coalesce(array_length(p.typical_endpoints, 1), 0),
      'typical_active_hours', p.typical_active_hours,
      'device_fingerprint_count', coalesce(jsonb_array_length(
        CASE WHEN p.typical_devices_enc IS NOT NULL THEN
          (kza_veil_decrypt_snapshot(p.typical_devices_enc, p.typical_devices_nonce) #> '{fingerprints}')
        ELSE p.typical_devices END
      ), 0),
      'threat_score', p.threat_score,
      'watchlisted', p.is_watchlisted,
      'first_seen', p.created_at,
      'last_seen', p.last_seen_at
    ) ELSE NULL END,
    'country_activity', (
      SELECT jsonb_agg(jsonb_build_object('country', c.country_code, 'last_activity', max(c.checked_at)))
      FROM kza_ip_reputation c WHERE c.ip_hash IN (
        SELECT e.ip_hash FROM kza_threat_events e WHERE e.user_id = p_user_id AND e.ip_hash IS NOT NULL
      )
    ),
    'threat_events', (
      SELECT jsonb_agg(jsonb_build_object(
        'tier', t.threat_tier, 'type', t.threat_type, 'occurred_at', t.created_at,
        'country', t.country, 'action', t.automated_action_taken
      ))
      FROM (
        SELECT threat_tier, threat_type, created_at, country, automated_action_taken
        FROM kza_threat_events t
        WHERE t.user_id = p_user_id
        ORDER BY t.created_at DESC
        LIMIT 200
      ) t
    ),
    'geo_history', (
      SELECT jsonb_agg(jsonb_build_object('country', g.country_code, 'occurred_at', g.occurred_at))
      FROM (
        SELECT country_code, occurred_at
        FROM kza_geo_events g
        WHERE g.user_id = p_user_id
        ORDER BY g.occurred_at DESC
        LIMIT 100
      ) g
    ),
    'active_sessions', (
      SELECT count(*) FROM kza_prel_sessions s
      WHERE s.user_id = p_user_id AND s.consumed_at IS NULL AND s.expires_at > now()
    )
  ) INTO v_result
  FROM kza_user_profiles p WHERE p.user_id = p_user_id;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('profile', NULL);
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.kza_veil_delete_profile(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := current_setting('request.jwt.claims', true)::jsonb->>'role';
  IF v_role <> 'service_role' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'KZA_VEIL_NOT_OWNER';
  END IF;

  DELETE FROM public.kza_threat_events      WHERE user_id = p_user_id;
  DELETE FROM public.kza_user_profiles      WHERE user_id = p_user_id;
  DELETE FROM public.kza_prel_sessions      WHERE user_id = p_user_id;
  DELETE FROM public.kza_prel_f2fa_seeds    WHERE user_id = p_user_id;
  DELETE FROM public.kza_geo_events         WHERE user_id = p_user_id;
  DELETE FROM public.kza_rate_buckets       WHERE user_id = p_user_id;
  DELETE FROM public.kza_honeypot_hits      WHERE user_id = p_user_id;
  DELETE FROM public.kza_linked_accounts    WHERE primary_user_id = p_user_id OR linked_user_id = p_user_id;

  -- Anonymize any admin incident references to this user (keep the record)
  UPDATE public.kza_admin_incidents
  SET attacker_profile =
      CASE WHEN attacker_profile ? 'user_id' THEN
        jsonb_set(attacker_profile, '{user_id}', to_jsonb('<' || p_user_id::text || '>'))
      ELSE attacker_profile END,
      linked_accounts = '[]'::jsonb
  WHERE attacker_profile ? 'user_id'
     OR (linked_accounts IS NOT NULL AND linked_accounts @> jsonb_build_array(p_user_id::text));

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.kza_veil_export_profile(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kza_veil_delete_profile(UUID) TO authenticated, service_role;
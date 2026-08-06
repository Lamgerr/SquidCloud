-- KZA-PREL v2 Gateway
-- Token versioning + key id (kid), per-function HMAC signing keys with real
-- verification, session binding, F2FA server-side seeds, operation scoping.

-- ========================================
-- 1. V2 TOKEN SIGNING KEY (keyring)
-- ========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.security_keyring WHERE name = 'kza_prel_hmac_v2'
  ) THEN
    INSERT INTO public.security_keyring (name, key_id)
    VALUES ('kza_prel_hmac_v2', (SELECT (pgsodium.create_key()).id));
  END IF;
END $$;

-- ========================================
-- 2. PER-FUNCTION HMAC SIGNING KEYS (real HMAC auth level)
-- ========================================

CREATE TABLE IF NOT EXISTS public.kza_prel_hmac_keys (
  function_id TEXT PRIMARY KEY REFERENCES public.kza_prel_registry(function_id) ON DELETE CASCADE,
  key_name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rotated_at TIMESTAMPTZ
);

-- Seed a dedicated keyring key for every hmac / hmac_gateway function
DO $$
DECLARE
  v_fn TEXT;
  v_key_name TEXT;
BEGIN
  FOR v_fn IN
    SELECT function_id FROM public.kza_prel_registry
    WHERE required_auth_level IN ('hmac', 'hmac_gateway', 'hmac_jwt')
  LOOP
    v_key_name := 'kza_hmac_' || v_fn;
    IF NOT EXISTS (SELECT 1 FROM public.security_keyring WHERE name = v_key_name) THEN
      INSERT INTO public.security_keyring (name, key_id)
      VALUES (v_key_name, (SELECT (pgsodium.create_key()).id));
    END IF;
    INSERT INTO public.kza_prel_hmac_keys (function_id, key_name)
    VALUES (v_fn, v_key_name)
    ON CONFLICT (function_id) DO NOTHING;
  END LOOP;
END $$;

-- Rotate a function's signing key (issues new keyring key, deactivates old)
CREATE OR REPLACE FUNCTION public.kza_prel_rotate_hmac_key(p_function_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_name TEXT;
BEGIN
  v_new_name := 'kza_hmac_' || p_function_id || '_' || to_char(now(), 'YYYYMMDDHH24MISS');
  INSERT INTO public.security_keyring (name, key_id)
  VALUES (v_new_name, (SELECT (pgsodium.create_key()).id));

  UPDATE public.kza_prel_hmac_keys
  SET is_active = false, rotated_at = now()
  WHERE function_id = p_function_id;

  INSERT INTO public.kza_prel_hmac_keys (function_id, key_name)
  VALUES (p_function_id, v_new_name)
  ON CONFLICT (function_id) DO UPDATE SET key_name = v_new_name, is_active = true, rotated_at = now();

  RETURN v_new_name;
END;
$$;

-- Constant-time HMAC verification of a per-function signed request.
-- Message format: `${ts}:${method}:${path}:${userId}`
CREATE OR REPLACE FUNCTION public.kza_prel_hmac_verify(
  p_function_id TEXT,
  p_ts TEXT,
  p_method TEXT,
  p_path TEXT,
  p_user_id TEXT,
  p_signature TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key_name TEXT;
  v_key BYTEA;
  v_message TEXT;
BEGIN
  SELECT key_name INTO v_key_name
  FROM public.kza_prel_hmac_keys
  WHERE function_id = p_function_id AND is_active = true
  LIMIT 1;

  IF v_key_name IS NULL THEN
    RETURN false;
  END IF;

  SELECT k.key INTO v_key
  FROM pgsodium.get_key((SELECT key_id FROM public.security_keyring WHERE name = v_key_name)) k;

  IF v_key IS NULL THEN
    RETURN false;
  END IF;

  v_message := p_ts || ':' || p_method || ':' || p_path || ':' || p_user_id;

  BEGIN
    PERFORM pgsodium.crypto_auth_verify(
      convert_to(v_message, 'utf8'),
      decode(p_signature, 'hex'),
      v_key
    );
    RETURN true;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN false;
  END;
END;
$$;

-- ========================================
-- 3. TOKEN V2 SIGN / VERIFY (format: v2.<key_name>.<nonce_hex>.<ct_hex>)
-- ========================================

CREATE OR REPLACE FUNCTION public.kza_prel_sign_token(
  p_function_id TEXT,
  p_payload TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key_id UUID;
  v_nonce BYTEA := extensions.gen_random_bytes(24);
  v_ciphertext BYTEA;
BEGIN
  SELECT key_id INTO v_key_id FROM public.security_keyring WHERE name = 'kza_prel_hmac_v2';
  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'PREL v2 HMAC key not found';
  END IF;

  v_ciphertext := pgsodium.crypto_secretbox(
    convert_to(p_payload, 'utf8'),
    v_nonce,
    v_key_id
  );

  RETURN 'v2.' || 'kza_prel_hmac_v2' || '.' || encode(v_nonce, 'hex') || '.' || encode(v_ciphertext, 'hex');
END;
$$;

CREATE OR REPLACE FUNCTION public.kza_prel_verify_token(
  p_token TEXT,
  p_function_id TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key_id UUID;
  v_nonce BYTEA;
  v_ciphertext BYTEA;
  v_parts TEXT[];
  v_plain BYTEA;
BEGIN
  v_parts := string_to_array(p_token, '.');
  IF array_length(v_parts, 1) != 4 THEN
    RETURN NULL;
  END IF;

  IF v_parts[1] != 'v2' THEN
    RETURN NULL;
  END IF;

  SELECT key_id INTO v_key_id FROM public.security_keyring WHERE name = v_parts[2];
  IF v_key_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_nonce := decode(v_parts[3], 'hex');
  v_ciphertext := decode(v_parts[4], 'hex');

  v_plain := pgsodium.crypto_secretbox_open(v_ciphertext, v_nonce, v_key_id);
  RETURN convert_from(v_plain, 'utf8');
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.kza_prel_sign_token(TEXT, TEXT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kza_prel_verify_token(TEXT, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kza_prel_sign_token(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.kza_prel_verify_token(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.kza_prel_hmac_verify(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- ========================================
-- 4. SESSION BINDING (network fingerprint hash on the token)
-- ========================================

ALTER TABLE public.kza_prel_sessions
  ADD COLUMN IF NOT EXISTS binding_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_kza_prel_sessions_binding
  ON public.kza_prel_sessions(binding_hash) WHERE consumed_at IS NULL;

-- ========================================
-- 5. F2FA SEEDS — server-issued, user-scoped
-- ========================================

CREATE OR REPLACE FUNCTION public.kza_prel_generate_f2fa_seed(
  p_user_id UUID,
  p_function_id TEXT,
  p_session_nonce TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key_id UUID;
  v_day_seed TEXT;
  v_seed_derived TEXT;
  v_role TEXT;
BEGIN
  v_role := current_setting('request.jwt.claims', true)::jsonb->>'role';
  IF v_role <> 'service_role' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'KZA_VEIL_F2FA_NOT_OWNER';
  END IF;

  SELECT key_id INTO v_key_id FROM public.security_keyring WHERE name = 'kza_prel_f2fa_master';
  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'F2FA master key not found';
  END IF;

  v_day_seed := to_char(now(), 'YYYY-MM-DD');
  v_seed_derived := encode(
    pgsodium.crypto_auth(
      convert_to(p_user_id || p_function_id || v_day_seed, 'utf8'),
      (SELECT key FROM pgsodium.get_key(v_key_id))
    ),
    'hex'
  );

  INSERT INTO public.kza_prel_f2fa_seeds
    (user_id, function_id, day_seed, session_nonce, seed_derived)
  VALUES
    (p_user_id, p_function_id, v_day_seed, p_session_nonce, v_seed_derived)
  ON CONFLICT DO NOTHING;

  RETURN v_seed_derived;
END;
$$;

GRANT EXECUTE ON FUNCTION public.kza_prel_generate_f2fa_seed(UUID, TEXT, TEXT) TO service_role, authenticated;

-- ========================================
-- 6. REGISTRY — new auth level, new functions, sentinel to jwt
-- ========================================

ALTER TABLE public.kza_prel_registry
  DROP CONSTRAINT IF EXISTS kza_prel_registry_auth_check;

ALTER TABLE public.kza_prel_registry
  DROP CONSTRAINT IF EXISTS kza_prel_registry_required_auth_level_check;

ALTER TABLE public.kza_prel_registry
  ADD CONSTRAINT kza_prel_registry_auth_check
  CHECK (required_auth_level IN ('jwt', 'api_key', 'hmac', 'hmac_gateway', 'hmac_jwt', 'prel_only', 'none', 'any'));

-- Sentinel is called directly from browsers with a JWT; prel_only blocked that.
UPDATE public.kza_prel_registry
SET required_auth_level = 'jwt', chain_depth_limit = 0, f2fa_required = false, cip_required = false
WHERE function_id = 'kza-sentinel';

-- hmac-level functions self-verify their own signatures (STREAM_SIGNING_SECRET
-- scheme, media-segment et al): the gateway issues a bound placeholder identity
-- so userId can never be spoofed. hmac_gateway = strict gateway-verified
-- signature via kza_prel_hmac_verify (opt-in for new integrations).
UPDATE public.kza_prel_registry
SET required_auth_level = 'hmac'
WHERE function_id IN ('media-segment', 'media-playlist', 'media-master-manifest', 'media-manifest', 'video-stream-proxy', 'download-shared-file');

INSERT INTO public.kza_prel_registry
  (function_id, function_name, description, required_auth_level, required_min_role, f2fa_required, cip_required, chain_depth_limit, allowed_callers, ttl_seconds, long_op_ttl_seconds)
VALUES
  ('kza-heartbeat', 'KZA Heartbeat', 'Infrastructure health monitor; smoke checks for gateway, sentinel, keyring, sessions.', 'prel_only', NULL, false, false, 0, '{}', 60, 120),
  ('kza-admin', 'KZA Admin', 'Admin console gateway for ban/shadow/export/revoke operations.', 'jwt', 'admin', true, true, 1, '{}', 60, 120)
ON CONFLICT (function_id) DO UPDATE SET
  required_auth_level = EXCLUDED.required_auth_level,
  required_min_role = EXCLUDED.required_min_role,
  f2fa_required = EXCLUDED.f2fa_required,
  cip_required = EXCLUDED.cip_required,
  chain_depth_limit = EXCLUDED.chain_depth_limit,
  ttl_seconds = EXCLUDED.ttl_seconds,
  updated_at = now();

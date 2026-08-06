-- KZA pgsodium compat: this project's pgsodium build has no pgsodium.get_key()
-- and id(uuid)-based crypto variants only resolve keys that are decryptable.
-- Sequence-backed keys (created via pgsodium.create_key()) are usable through
-- the (message, nonce|mac, key_id bigint, key_context bytea) overloads, so all
-- crypto helpers now resolve (key_id, key_context) from pgsodium.key directly.
-- Also re-seeds the missing per-function HMAC keys + F2FA master.

-- ========================================
-- 1. ENSURE KEYRING ENTRIES EXIST
-- ========================================

-- F2FA master (was missing: June-era key absent from keyring)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.security_keyring WHERE name = 'kza_prel_f2fa_master') THEN
    INSERT INTO public.security_keyring (name, key_id)
    VALUES ('kza_prel_f2fa_master', (SELECT (pgsodium.create_key()).id));
  END IF;
END $$;

-- Per-function HMAC keys for every hmac / hmac_gateway / hmac_jwt function
-- (the original v2 migration seeded these before registry auth levels changed,
--  so it missed every function)
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
    ON CONFLICT (function_id) DO UPDATE SET key_name = EXCLUDED.key_name, is_active = true;
  END LOOP;
END $$;

-- ========================================
-- 2. CRYPTO HELPERS (bigint key_id + key_context path)
-- ========================================

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
SET search_path = public, pgsodium
AS $$
DECLARE
  v_key_name TEXT;
  v_key_id BIGINT;
  v_key_ctx BYTEA;
  v_message TEXT;
BEGIN
  SELECT key_name INTO v_key_name
  FROM public.kza_prel_hmac_keys
  WHERE function_id = p_function_id AND is_active = true
  LIMIT 1;

  IF v_key_name IS NULL THEN
    RETURN false;
  END IF;

  SELECT k.key_id, k.key_context INTO v_key_id, v_key_ctx
  FROM pgsodium.key k
  JOIN public.security_keyring r ON r.key_id = k.id
  WHERE r.name = v_key_name;

  IF v_key_id IS NULL THEN
    RETURN false;
  END IF;

  v_message := p_ts || ':' || p_method || ':' || p_path || ':' || p_user_id;

  BEGIN
    PERFORM pgsodium.crypto_auth_verify(
      decode(p_signature, 'hex'),
      convert_to(v_message, 'utf8'),
      v_key_id,
      v_key_ctx
    );
    RETURN true;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN false;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.kza_prel_sign_token(
  p_function_id TEXT,
  p_payload TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pgsodium
AS $$
DECLARE
  v_key_id BIGINT;
  v_key_ctx BYTEA;
  v_nonce BYTEA := gen_random_bytes(24);
  v_ciphertext BYTEA;
BEGIN
  SELECT k.key_id, k.key_context INTO v_key_id, v_key_ctx
  FROM pgsodium.key k
  JOIN public.security_keyring r ON r.key_id = k.id
  WHERE r.name = 'kza_prel_hmac_v2';

  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'PREL v2 key not found';
  END IF;

  v_ciphertext := pgsodium.crypto_secretbox(
    convert_to(p_payload, 'utf8'),
    v_nonce,
    v_key_id,
    v_key_ctx
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
SET search_path = public, pgsodium
AS $$
DECLARE
  v_key_id BIGINT;
  v_key_ctx BYTEA;
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

  SELECT k.key_id, k.key_context INTO v_key_id, v_key_ctx
  FROM pgsodium.key k
  JOIN public.security_keyring r ON r.key_id = k.id
  WHERE r.name = v_parts[2];

  IF v_key_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_nonce := decode(v_parts[3], 'hex');
  v_ciphertext := decode(v_parts[4], 'hex');

  v_plain := pgsodium.crypto_secretbox_open(v_ciphertext, v_nonce, v_key_id, v_key_ctx);
  RETURN convert_from(v_plain, 'utf8');
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.kza_prel_generate_f2fa_seed(
  p_user_id UUID,
  p_function_id TEXT,
  p_session_nonce TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pgsodium
AS $$
DECLARE
  v_key_id BIGINT;
  v_key_ctx BYTEA;
  v_day_seed TEXT;
  v_seed_derived TEXT;
  v_role TEXT;
BEGIN
  v_role := current_setting('request.jwt.claims', true)::jsonb->>'role';
  IF v_role <> 'service_role' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'KZA_VEIL_F2FA_NOT_OWNER';
  END IF;

  SELECT k.key_id, k.key_context INTO v_key_id, v_key_ctx
  FROM pgsodium.key k
  JOIN public.security_keyring r ON r.key_id = k.id
  WHERE r.name = 'kza_prel_f2fa_master';

  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'F2FA master key not found';
  END IF;

  v_day_seed := to_char(now(), 'YYYY-MM-DD');
  v_seed_derived := encode(
    pgsodium.crypto_auth(
      convert_to(p_user_id || p_function_id || v_day_seed, 'utf8'),
      v_key_id,
      v_key_ctx
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

CREATE OR REPLACE FUNCTION public.kza_veil_encrypt_snapshot(p_payload JSONB)
RETURNS TABLE(ciphertext TEXT, nonce TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pgsodium
AS $$
DECLARE
  v_key_id BIGINT;
  v_key_ctx BYTEA;
  v_nonce BYTEA := gen_random_bytes(24);
BEGIN
  SELECT k.key_id, k.key_context INTO v_key_id, v_key_ctx
  FROM pgsodium.key k
  JOIN public.security_keyring r ON r.key_id = k.id
  WHERE r.name = 'kza_veil_master';

  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'Veil key not found';
  END IF;

  RETURN QUERY SELECT
    encode(pgsodium.crypto_secretbox(convert_to(p_payload::text, 'utf8'), v_nonce, v_key_id, v_key_ctx), 'hex'),
    encode(v_nonce, 'hex');
END;
$$;

CREATE OR REPLACE FUNCTION public.kza_veil_decrypt_snapshot(p_ciphertext TEXT, p_nonce TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium
AS $$
DECLARE
  v_key_id BIGINT;
  v_key_ctx BYTEA;
  v_plain BYTEA;
BEGIN
  SELECT k.key_id, k.key_context INTO v_key_id, v_key_ctx
  FROM pgsodium.key k
  JOIN public.security_keyring r ON r.key_id = k.id
  WHERE r.name = 'kza_veil_master';

  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'Veil key not found';
  END IF;

  v_plain := pgsodium.crypto_secretbox_open(
    decode(p_ciphertext, 'hex'),
    decode(p_nonce, 'hex'),
    v_key_id,
    v_key_ctx
  );
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
SET search_path = public, pgsodium
AS $$
DECLARE
  v_key_id BIGINT;
  v_key_ctx BYTEA;
BEGIN
  IF p_ip IS NULL OR p_ip = '' OR p_ip = 'unknown' THEN
    RETURN NULL;
  END IF;

  SELECT k.key_id, k.key_context INTO v_key_id, v_key_ctx
  FROM pgsodium.key k
  JOIN public.security_keyring r ON r.key_id = k.id
  WHERE r.name = 'kza_veil_master';

  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'Veil key not found';
  END IF;

  RETURN encode(
    pgsodium.crypto_auth(convert_to(p_ip, 'utf8'), v_key_id, v_key_ctx),
    'hex'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.kza_prel_sign_token(TEXT, TEXT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kza_prel_verify_token(TEXT, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kza_prel_sign_token(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.kza_prel_verify_token(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.kza_prel_hmac_verify(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.kza_prel_generate_f2fa_seed(UUID, TEXT, TEXT) TO service_role, authenticated;
REVOKE EXECUTE ON FUNCTION public.kza_veil_encrypt_snapshot(JSONB) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kza_veil_decrypt_snapshot(TEXT, TEXT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kza_veil_ip_hash(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kza_veil_encrypt_snapshot(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.kza_veil_decrypt_snapshot(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.kza_veil_ip_hash(TEXT) TO service_role;

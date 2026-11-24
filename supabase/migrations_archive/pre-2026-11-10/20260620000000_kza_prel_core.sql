-- KZA-PREL Core: Proactive Request Entropy Layer
-- Authentication gateway infrastructure for all 48 edge functions

-- Enable pgsodium for key management
CREATE EXTENSION IF NOT EXISTS pgsodium WITH SCHEMA extensions;

-- 1. PREL Function Registry
CREATE TABLE IF NOT EXISTS public.kza_prel_registry (
  function_id TEXT PRIMARY KEY,
  required_auth_level TEXT NOT NULL DEFAULT 'jwt',
  required_min_role TEXT,
  allowed_operations TEXT[] DEFAULT '{}',
  f2fa_required BOOLEAN DEFAULT true,
  cip_required BOOLEAN DEFAULT true,
  chain_depth_limit INT DEFAULT 5,
  rate_limit_rps INT DEFAULT 10,
  allowed_callers TEXT[] DEFAULT '{}',
  ttl_seconds INT DEFAULT 45,
  long_op_ttl_seconds INT DEFAULT 600,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT kza_prel_registry_auth_check
    CHECK (required_auth_level IN ('jwt', 'api_key', 'hmac', 'hmac_jwt', 'prel_only', 'none', 'any')),
  CONSTRAINT kza_prel_registry_role_check
    CHECK (required_min_role IS NULL OR required_min_role IN ('viewer', 'editor', 'admin', 'owner'))
);

-- 2. PREL Active Sessions / Token Chain State
CREATE TABLE IF NOT EXISTS public.kza_prel_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  parent_token_hash TEXT REFERENCES public.kza_prel_sessions(token_hash) ON DELETE SET NULL,
  function_id TEXT NOT NULL REFERENCES public.kza_prel_registry(function_id),
  operation_scope TEXT[] DEFAULT '{}',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  chain_depth INT DEFAULT 0,
  cip_score INT,
  f2fa_window INT,
  is_long_op BOOLEAN DEFAULT false,
  long_op_expires_at TIMESTAMPTZ,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_kza_prel_sessions_user_id ON public.kza_prel_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_kza_prel_sessions_session_id ON public.kza_prel_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_kza_prel_sessions_expires ON public.kza_prel_sessions(expires_at)
  WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_kza_prel_sessions_parent ON public.kza_prel_sessions(parent_token_hash)
  WHERE consumed_at IS NULL;

-- 3. F2FA Seed Store
CREATE TABLE IF NOT EXISTS public.kza_prel_f2fa_seeds (
  seed_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  function_id TEXT NOT NULL REFERENCES public.kza_prel_registry(function_id),
  day_seed TEXT NOT NULL,
  session_nonce TEXT NOT NULL,
  seed_derived TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  rotated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kza_prel_f2fa_seeds_user_fn
  ON public.kza_prel_f2fa_seeds(user_id, function_id);

-- 4. PREL Keyring for HMAC signing keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.security_keyring WHERE name = 'kza_prel_hmac'
  ) THEN
    INSERT INTO public.security_keyring (name, key_id)
    VALUES ('kza_prel_hmac', (SELECT (pgsodium.create_key()).key_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.security_keyring WHERE name = 'kza_prel_f2fa_master'
  ) THEN
    INSERT INTO public.security_keyring (name, key_id)
    VALUES ('kza_prel_f2fa_master', (SELECT (pgsodium.create_key()).key_id));
  END IF;
END $$;

-- 5. RLS: service_role only
ALTER TABLE public.kza_prel_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kza_prel_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kza_prel_f2fa_seeds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only access to kza_prel_registry" ON public.kza_prel_registry;
CREATE POLICY "Service role only access to kza_prel_registry"
  ON public.kza_prel_registry FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role only access to kza_prel_sessions" ON public.kza_prel_sessions;
CREATE POLICY "Service role only access to kza_prel_sessions"
  ON public.kza_prel_sessions FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Service role only access to kza_prel_f2fa_seeds" ON public.kza_prel_f2fa_seeds;
CREATE POLICY "Service role only access to kza_prel_f2fa_seeds"
  ON public.kza_prel_f2fa_seeds FOR ALL USING (false) WITH CHECK (false);

-- 6. Helper: Clean expired sessions (run via pg_cron or edge function)
CREATE OR REPLACE FUNCTION public.kza_prel_clean_expired_sessions()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM public.kza_prel_sessions
  WHERE expires_at < now()
    AND consumed_at IS NOT NULL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- 7. Helper: Encrypt/decrypt PREL keys via pgsodium
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
  SELECT key_id INTO v_key_id FROM public.security_keyring WHERE name = 'kza_prel_hmac';
  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'PREL HMAC key not found';
  END IF;

  v_ciphertext := pgsodium.crypto_secretbox(
    convert_to(p_payload, 'utf8'),
    v_nonce,
    v_key_id
  );

  RETURN encode(v_nonce, 'hex') || '.' || encode(v_ciphertext, 'hex');
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
  SELECT key_id INTO v_key_id FROM public.security_keyring WHERE name = 'kza_prel_hmac';
  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'PREL HMAC key not found';
  END IF;

  v_parts := string_to_array(p_token, '.');
  IF array_length(v_parts, 1) != 2 THEN
    RAISE EXCEPTION 'Invalid token format';
  END IF;

  v_nonce := decode(v_parts[1], 'hex');
  v_ciphertext := decode(v_parts[2], 'hex');

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

-- 8. Helper: Generate F2FA seed
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
BEGIN
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

GRANT EXECUTE ON FUNCTION public.kza_prel_generate_f2fa_seed(UUID, TEXT, TEXT) TO service_role;

-- 9. Seed initial registry with critical functions
INSERT INTO public.kza_prel_registry (function_id, required_auth_level, required_min_role, f2fa_required, cip_required, chain_depth_limit, allowed_callers, ttl_seconds, long_op_ttl_seconds)
VALUES
  ('kza-prel', 'prel_only', NULL, false, false, 0, '{}', 300, 600),
  ('kza-sentinel', 'prel_only', NULL, false, false, 0, '{}', 60, 120),
  ('kza-verdict', 'prel_only', NULL, false, false, 1, '{kza-sentinel}', 60, 120),
  ('kza-oracle', 'prel_only', NULL, false, false, 1, '{kza-sentinel}', 60, 120),
  ('kza-phantom', 'prel_only', NULL, false, false, 1, '{kza-prel}', 60, 120),
  ('github-storage', 'jwt', 'editor', true, true, 3, '{cloudbliss-api,file-key,media-segment,serve-pdf,download-shared-file}', 120, 600),
  ('cloudbliss-api', 'api_key', 'viewer', true, true, 2, '{}', 60, 600),
  ('file-key', 'jwt', NULL, true, true, 2, '{cloudbliss-api,serve-pdf}', 60, 300),
  ('file-operations', 'jwt', 'editor', true, true, 2, '{cloudbliss-api}', 120, 600),
  ('admin-auth', 'jwt', NULL, true, true, 1, '{}', 60, 120),
  ('admin-data-access', 'jwt', NULL, true, true, 1, '{admin-auth}', 60, 300),
  ('check-admin-status', 'jwt', NULL, true, true, 1, '{}', 60, 120),
  ('verify-admin', 'jwt', NULL, false, true, 1, '{cloudbliss-api,admin-auth}', 60, 120),
  ('media-segment', 'hmac', NULL, false, false, 2, '{}', 120, 600),
  ('media-playlist', 'hmac', NULL, false, false, 1, '{}', 60, 120),
  ('media-manifest', 'hmac_jwt', NULL, true, false, 1, '{}', 60, 120),
  ('media-master-manifest', 'hmac', NULL, false, false, 1, '{}', 60, 120),
  ('hls-generation', 'jwt', 'editor', false, false, 2, '{}', 300, 1800),
  ('video-stream-proxy', 'hmac', NULL, false, false, 1, '{}', 120, 600),
  ('video-stream-url', 'jwt', NULL, true, true, 1, '{}', 60, 120),
  ('api-file-upload', 'api_key', NULL, true, false, 1, '{}', 120, 600),
  ('api-file-delete', 'api_key', NULL, true, false, 1, '{}', 60, 120),
  ('api-file-metadata', 'api_key', NULL, true, false, 1, '{}', 60, 120),
  ('api-file-upload-tebi', 'jwt', 'editor', true, false, 1, '{}', 120, 600),
  ('api-key-management', 'jwt', NULL, true, true, 1, '{}', 60, 120),
  ('serve-pdf', 'jwt', NULL, true, true, 2, '{generate-pdf-url}', 120, 300),
  ('serve-pdf-secure', 'jwt', NULL, true, true, 1, '{generate-pdf-url}', 120, 300),
  ('generate-pdf-url', 'jwt', NULL, true, true, 2, '{}', 60, 120),
  ('download-shared-file', 'hmac', NULL, false, false, 2, '{}', 120, 600),
  ('download-manager', 'jwt', 'editor', true, true, 1, '{}', 60, 600),
  ('trash-operations', 'jwt', 'editor', true, true, 1, '{}', 60, 120),
  ('secure-file-metadata', 'jwt', 'editor', true, true, 1, '{}', 60, 120),
  ('validate-share', 'jwt', NULL, false, false, 1, '{cloudbliss-api,generate-pdf-url}', 60, 120),
  ('github-api', 'jwt', NULL, true, true, 1, '{github-cluster,cloudbliss-api}', 60, 120),
  ('github-cluster', 'jwt', NULL, true, true, 1, '{cloudbliss-api}', 60, 120),
  ('create-repos', 'jwt', 'editor', true, true, 1, '{cloudbliss-api,github-storage}', 120, 300),
  ('gemini-api', 'jwt', NULL, true, true, 1, '{cloudbliss-api}', 60, 120),
  ('ink-ai', 'jwt', NULL, true, false, 1, '{}', 120, 300),
  ('squid-ai-chat', 'jwt', NULL, true, false, 1, '{}', 120, 300),
  ('migration-oauth', 'jwt', NULL, false, false, 1, '{}', 120, 300),
  ('migration-oauth-callback', 'jwt', NULL, false, false, 1, '{}', 60, 120),
  ('start-migration', 'jwt', NULL, false, false, 1, '{}', 300, 3600),
  ('start-cloud-import', 'jwt', NULL, false, false, 1, '{}', 300, 3600),
  ('store-provider', 'jwt', NULL, true, true, 1, '{}', 60, 120),
  ('verify-provider', 'jwt', NULL, true, true, 1, '{}', 60, 120),
  ('get-app-updates', 'none', NULL, false, false, 0, '{}', 0, 0),
  ('add-app-update', 'jwt', NULL, true, true, 1, '{}', 60, 120),
  ('send-workspace-invite', 'jwt', 'admin', true, true, 1, '{}', 60, 120),
  ('cli-operations', 'jwt', NULL, true, true, 2, '{}', 120, 600),
  ('cloud-file-browser', 'jwt', NULL, true, true, 2, '{}', 120, 600)
ON CONFLICT (function_id) DO UPDATE SET
  required_auth_level = EXCLUDED.required_auth_level,
  f2fa_required = EXCLUDED.f2fa_required,
  cip_required = EXCLUDED.cip_required,
  chain_depth_limit = EXCLUDED.chain_depth_limit,
  allowed_callers = EXCLUDED.allowed_callers,
  ttl_seconds = EXCLUDED.ttl_seconds,
  long_op_ttl_seconds = EXCLUDED.long_op_ttl_seconds,
  updated_at = now();

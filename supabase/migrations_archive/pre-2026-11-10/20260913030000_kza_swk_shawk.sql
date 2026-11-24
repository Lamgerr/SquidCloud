-- ============================================================
-- KZA-SWK "S-HAWK" — post-investigation unit for upload/material
-- rule violations. Metadata-only screening (never file content):
-- investigates, files cases, forwards to kza-verdict, recommends
-- bans. S-Hawk never bans on heuristic scores alone — critical
-- hash/forgery hits and repeat offenders trigger suspensions
-- that kza-verdict/admin review.
-- ============================================================

-- 1. Tunable policy (single row, id = 1)
CREATE TABLE IF NOT EXISTS public.kza_swk_policy (
  id integer PRIMARY KEY DEFAULT 1,
  reject_at integer NOT NULL DEFAULT 70,
  review_at integer NOT NULL DEFAULT 40,
  warn_repeat_within_days integer NOT NULL DEFAULT 30,
  escalate_repeat_count integer NOT NULL DEFAULT 3,
  susp_70_89_days integer NOT NULL DEFAULT 7,
  susp_90_plus_days integer NOT NULL DEFAULT 30,
  token_ttl_seconds integer NOT NULL DEFAULT 900,
  token_max_uses integer NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kza_swk_policy_single_row CHECK (id = 1)
);

INSERT INTO public.kza_swk_policy (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- 2. Investigation cases
CREATE TABLE IF NOT EXISTS public.kza_swk_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  manifest_hash text NOT NULL,
  filename text NOT NULL DEFAULT '',
  size_bytes bigint NOT NULL DEFAULT 0,
  decision text NOT NULL CHECK (decision IN ('allow', 'review', 'reject')),
  risk_score integer NOT NULL DEFAULT 0,
  repeat_count integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'forwarded', 'adjudicated', 'closed', 'appealed')),
  threat_event_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_swk_cases_user ON public.kza_swk_cases (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_swk_cases_status ON public.kza_swk_cases (status);
CREATE INDEX IF NOT EXISTS idx_swk_cases_manifest ON public.kza_swk_cases (manifest_hash);

-- 3. Per-signal audit trail (why a decision was made)
CREATE TABLE IF NOT EXISTS public.kza_swk_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.kza_swk_cases (id) ON DELETE CASCADE,
  scanner text NOT NULL,
  scanner_version text NOT NULL DEFAULT 'v1',
  signal text NOT NULL,
  weight integer NOT NULL DEFAULT 0,
  critical boolean NOT NULL DEFAULT false,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_swk_findings_case ON public.kza_swk_findings (case_id);
CREATE INDEX IF NOT EXISTS idx_swk_findings_signal ON public.kza_swk_findings (signal);

-- 4. Learned denylist (manual entries + auto-fed by verdicts)
CREATE TABLE IF NOT EXISTS public.kza_swk_denylist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL
    CHECK (kind IN ('sha256', 'phash', 'filename_pattern', 'keyword', 'mime_tool')),
  value text NOT NULL,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'verdict', 'shawk')),
  note text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, value)
);

CREATE INDEX IF NOT EXISTS idx_swk_denylist_active ON public.kza_swk_denylist (kind) WHERE is_active;

-- Seed: near-zero false-positive executable-masquerade patterns
INSERT INTO public.kza_swk_denylist (kind, value, source, note) VALUES
  ('filename_pattern', '\.pdf\.exe$', 'manual', 'Executable disguised as PDF'),
  ('filename_pattern', '\.docx?\.scr$', 'manual', 'Screensaver binary disguised as document'),
  ('filename_pattern', '\.xlsx?\.exe$', 'manual', 'Executable disguised as spreadsheet'),
  ('filename_pattern', '\.jpe?g\.exe$', 'manual', 'Executable disguised as image'),
  ('filename_pattern', '\.png\.scr$', 'manual', 'Screensaver binary disguised as image'),
  ('filename_pattern', '\.mp4\.exe$', 'manual', 'Executable disguised as video')
ON CONFLICT (kind, value) DO NOTHING;

-- 5. User-facing notices (why a file was rejected + appeal path)
CREATE TABLE IF NOT EXISTS public.kza_swk_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  case_id uuid REFERENCES public.kza_swk_cases (id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  reason_codes text[] NOT NULL DEFAULT '{}',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_swk_notices_user ON public.kza_swk_notices (user_id, created_at DESC);

-- 6. Verdict tokens (bound to user + manifest + size, short TTL, capped uses)
CREATE TABLE IF NOT EXISTS public.kza_swk_verdict_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL,
  manifest_hash text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  decision text NOT NULL CHECK (decision IN ('allow', 'review')),
  expires_at timestamptz NOT NULL,
  max_uses integer NOT NULL DEFAULT 5,
  used_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_swk_tokens_user ON public.kza_swk_verdict_tokens (user_id);

-- 7b. Carry the manifest through upload sessions (simple/API upload flow)
ALTER TABLE public.upload_sessions
  ADD COLUMN IF NOT EXISTS swk_manifest_hash text,
  ADD COLUMN IF NOT EXISTS swk_manifest jsonb;

-- 7. Manifest provenance on files (metadata only — never content)
ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS swk_manifest_hash text,
  ADD COLUMN IF NOT EXISTS swk_manifest jsonb,
  ADD COLUMN IF NOT EXISTS swk_decision text,
  ADD COLUMN IF NOT EXISTS swk_scanned_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_files_swk_hash ON public.files (swk_manifest_hash)
  WHERE swk_manifest_hash IS NOT NULL;

-- 8. New ban source for S-Hawk suspensions
ALTER TABLE public.kza_banned_entities
  DROP CONSTRAINT IF EXISTS kza_banned_entities_ban_source_check;

ALTER TABLE public.kza_banned_entities
  ADD CONSTRAINT kza_banned_entities_ban_source_check
  CHECK (ban_source = ANY (ARRAY['MANUAL'::text, 'GEO_FENCE'::text, 'IP_REPUTATION'::text, 'KZA_SENTINEL'::text, 'S_HAWK'::text]));

-- 9. Service-role-only access (clients go through the kza-swk edge function)
ALTER TABLE public.kza_swk_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kza_swk_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kza_swk_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kza_swk_denylist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kza_swk_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kza_swk_verdict_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.kza_swk_policy FROM public, anon, authenticated;
REVOKE ALL ON public.kza_swk_cases FROM public, anon, authenticated;
REVOKE ALL ON public.kza_swk_findings FROM public, anon, authenticated;
REVOKE ALL ON public.kza_swk_denylist FROM public, anon, authenticated;
REVOKE ALL ON public.kza_swk_notices FROM public, anon, authenticated;
REVOKE ALL ON public.kza_swk_verdict_tokens FROM public, anon, authenticated;

GRANT ALL ON public.kza_swk_policy TO service_role;
GRANT ALL ON public.kza_swk_cases TO service_role;
GRANT ALL ON public.kza_swk_findings TO service_role;
GRANT ALL ON public.kza_swk_denylist TO service_role;
GRANT ALL ON public.kza_swk_notices TO service_role;
GRANT ALL ON public.kza_swk_verdict_tokens TO service_role;

-- 10. PREL registry row (plain user-JWT callers, like store-file-key)
INSERT INTO public.kza_prel_registry (function_id, function_name, description, required_auth_level, cip_required, f2fa_required, chain_depth_limit, allowed_callers, ttl_seconds, long_op_ttl_seconds, is_active, required_min_role, rate_limit_rps, rate_limit_burst, geo_velocity_check, geo_max_speed_kmh)
VALUES ('kza-swk', 'S-Hawk Content Investigation', 'KZA post-investigation unit: metadata screening of upload manifests, case filing, verdict forwarding', 'jwt', false, false, 3, '{}'::text[], 300, 3600, true, null, 20, 60, false, 900)
ON CONFLICT (function_id) DO UPDATE SET required_auth_level = 'jwt', is_active = true;

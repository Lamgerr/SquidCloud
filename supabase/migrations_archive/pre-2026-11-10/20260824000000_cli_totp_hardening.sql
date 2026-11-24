-- CLI TOTP hardening: AAL2 attestation on devices, cli-guard PREL registry,
-- device-scoped banning (never ban the whole account for device failures).

ALTER TABLE public.cli_devices
  ADD COLUMN IF NOT EXISTS aal2_verified_at TIMESTAMPTZ;

ALTER TABLE public.kza_banned_entities
  ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE public.kza_banned_entities
  ADD COLUMN IF NOT EXISTS entity_value TEXT;

DO $$ BEGIN
  ALTER TABLE public.kza_banned_entities
    ADD CONSTRAINT kza_banned_entities_entity_type_check
    CHECK (entity_type IS NULL OR entity_type IN ('USER','IP','DEVICE','MACHINE'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_kza_banned_entities_entity
  ON public.kza_banned_entities (entity_type, entity_value)
  WHERE is_active = true;

ALTER TABLE public.kza_prel_registry
  ADD COLUMN IF NOT EXISTS allowed_operations TEXT[] DEFAULT '{}'::text[];

INSERT INTO public.kza_prel_registry (
  function_id, required_auth_level, required_min_role,
  f2fa_required, cip_required, ttl_seconds, long_op_ttl_seconds,
  allowed_operations, allowed_callers, chain_depth_limit, is_active
) VALUES (
  'cli-guard', 'jwt', null,
  true, false, 900, 900,
  ARRAY['host api','fs mount','fs webdav','keys add','keys rm','storage rm'],
  ARRAY[]::text[], 0, true
)
ON CONFLICT (function_id) DO UPDATE SET
  required_auth_level = EXCLUDED.required_auth_level,
  f2fa_required = EXCLUDED.f2fa_required,
  cip_required = EXCLUDED.cip_required,
  allowed_operations = EXCLUDED.allowed_operations,
  is_active = EXCLUDED.is_active;

ALTER TABLE public.kza_prel_f2fa_seeds
  ADD COLUMN IF NOT EXISTS issued_by TEXT DEFAULT 'kza-prel';

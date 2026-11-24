-- ADDITIVE ZK vault schema (v12 §§2, 17.1).
-- This migration does NOT modify any existing table or row. Existing users keep
-- their current escrow-based flow untouched. The ZK path is opt-in per user via
-- zk_vaults.status, so no data can be half-migrated by schema deployment alone.

CREATE TABLE IF NOT EXISTS public.zk_vaults (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'disabled' CHECK (status IN ('disabled','setup','active','migrating')),
  crypto_version text NOT NULL DEFAULT 'sq-v2',
  epoch integer NOT NULL DEFAULT 1,
  verifier text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Per-file ZK metadata. file_salt is PUBLIC (not a secret); deleting the row
-- is crypto-shredding because FK = HKDF(MK, file_salt).
CREATE TABLE IF NOT EXISTS public.zk_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  file_salt text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  iv text,
  ciphertext_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (file_id, version)
);
CREATE INDEX IF NOT EXISTS zk_files_user_idx ON public.zk_files(user_id);

-- Wrapped MK envelopes, one per enrolled device. Server never holds a key that
-- can open these (device private keys stay in hardware keystores).
CREATE TABLE IF NOT EXISTS public.zk_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  wrapped_mk text NOT NULL,
  public_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

-- Append-only key transparency log (hash chain). Clients verify the chain.
CREATE TABLE IF NOT EXISTS public.zk_ktl (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seq bigint NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  prev_hash text NOT NULL,
  hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, seq)
);

-- RLS: owner-only on every new table.
ALTER TABLE public.zk_vaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zk_vaults FORCE ROW LEVEL SECURITY;
ALTER TABLE public.zk_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zk_files FORCE ROW LEVEL SECURITY;
ALTER TABLE public.zk_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zk_devices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.zk_ktl ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zk_ktl FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS zk_vaults_owner ON public.zk_vaults;
CREATE POLICY zk_vaults_owner ON public.zk_vaults FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zk_files_owner ON public.zk_files;
CREATE POLICY zk_files_owner ON public.zk_files FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zk_devices_owner ON public.zk_devices;
CREATE POLICY zk_devices_owner ON public.zk_devices FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS zk_ktl_owner ON public.zk_ktl;
CREATE POLICY zk_ktl_owner ON public.zk_ktl FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.zk_vaults, public.zk_files, public.zk_devices, public.zk_ktl FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zk_vaults, public.zk_files, public.zk_devices TO authenticated;
GRANT SELECT ON public.zk_ktl TO authenticated;

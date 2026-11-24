-- Storage Provider Expansion: Multi-bucket, public buckets, health tracking, admin cluster

-- DROP OLD UNIQUE INDEX — allows multiple buckets per provider type per user
DROP INDEX IF EXISTS storage_providers_user_provider_type_idx;

-- Expand storage_providers with new columns
ALTER TABLE public.storage_providers
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS bucket_name TEXT,
  ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bucket_region TEXT,
  ADD COLUMN IF NOT EXISTS bucket_endpoint TEXT,
  ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_limit_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS last_health_check TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Update the constraint to allow more providers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'storage_providers_provider_type_check'
  ) THEN
    ALTER TABLE public.storage_providers DROP CONSTRAINT storage_providers_provider_type_check;
  END IF;
END $$;

ALTER TABLE public.storage_providers
  ADD CONSTRAINT storage_providers_provider_type_check
  CHECK (provider_type IN ('squidcloud', 'r2', 'tebi', 's3', 'gcp', 'b2', 'azure', 'wasabi', 'backblaze', 'custom'));

CREATE INDEX IF NOT EXISTS storage_providers_user_id_type_idx
  ON public.storage_providers (user_id, provider_type);

CREATE INDEX IF NOT EXISTS storage_providers_enabled_idx
  ON public.storage_providers (user_id, is_enabled);

-- Admin-managed SquidCloud B2 cluster buckets
CREATE TABLE IF NOT EXISTS public.squidcloud_b2_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_name TEXT NOT NULL,
  bucket_region TEXT NOT NULL,
  bucket_endpoint TEXT NOT NULL,
  access_key_id TEXT NOT NULL,
  secret_access_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  storage_used_bytes BIGINT DEFAULT 0,
  storage_limit_bytes BIGINT DEFAULT 10737418240,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.squidcloud_b2_buckets ENABLE ROW LEVEL SECURITY;

-- Global storage settings
CREATE TABLE IF NOT EXISTS public.storage_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.storage_settings ENABLE ROW LEVEL SECURITY;

-- Insert defaults
INSERT INTO public.storage_settings (setting_key, setting_value) VALUES
  ('max_buckets_per_user', '"20"'),
  ('allow_public_buckets', 'true'),
  ('squidcloud_fallback_enabled', 'true'),
  ('provider_whitelist', '["squidcloud","tebi","r2","s3","gcp","b2","azure","wasabi","backblaze"]')
ON CONFLICT (setting_key) DO NOTHING;

-- User storage preferences table
CREATE TABLE IF NOT EXISTS public.user_storage_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fallback_mode TEXT NOT NULL DEFAULT 'squidcloud_then_mine'
    CHECK (fallback_mode IN ('squidcloud_only', 'mine_only', 'squidcloud_then_mine', 'mine_then_squidcloud')),
  upload_distribution TEXT NOT NULL DEFAULT 'round_robin'
    CHECK (upload_distribution IN ('round_robin', 'least_used_first', 'primary_only')),
  allow_public_sharing BOOLEAN NOT NULL DEFAULT false,
  max_buckets INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_storage_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_storage_preferences
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_storage_preferences' AND policyname = 'Users can view own preferences'
  ) THEN
    CREATE POLICY "Users can view own preferences"
      ON public.user_storage_preferences FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_storage_preferences' AND policyname = 'Users can upsert own preferences'
  ) THEN
    CREATE POLICY "Users can upsert own preferences"
      ON public.user_storage_preferences FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_storage_preferences' AND policyname = 'Users can update own preferences'
  ) THEN
    CREATE POLICY "Users can update own preferences"
      ON public.user_storage_preferences FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- RLS policies for squidcloud_b2_buckets (admin-only via service role)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'squidcloud_b2_buckets' AND policyname = 'Admin select squidcloud_b2_buckets'
  ) THEN
    CREATE POLICY "Admin select squidcloud_b2_buckets"
      ON public.squidcloud_b2_buckets FOR SELECT USING (true);
  END IF;
END $$;

-- RPC: Get user's storage provider count
CREATE OR REPLACE FUNCTION public.get_user_storage_provider_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM public.storage_providers WHERE user_id = p_user_id AND is_enabled = true);
END;
$$;

-- RPC: Increment storage used bytes for a provider
CREATE OR REPLACE FUNCTION public.increment_provider_storage_used(
  p_provider_id UUID,
  p_bytes BIGINT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.storage_providers
  SET storage_used_bytes = GREATEST(0, storage_used_bytes + p_bytes),
      updated_at = now()
  WHERE id = p_provider_id;
END;
$$;

-- RPC: Update provider health status
CREATE OR REPLACE FUNCTION public.update_provider_health(
  p_provider_id UUID,
  p_health_status TEXT,
  p_last_error TEXT DEFAULT NULL,
  p_storage_used_bytes BIGINT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.storage_providers
  SET health_status = p_health_status,
      last_health_check = now(),
      last_error = p_last_error,
      storage_used_bytes = COALESCE(p_storage_used_bytes, storage_used_bytes),
      updated_at = now()
  WHERE id = p_provider_id;
END;
$$;

-- RPC: Get user storage preferences with defaults
CREATE OR REPLACE FUNCTION public.get_user_storage_preferences(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  prefs JSONB;
BEGIN
  SELECT jsonb_build_object(
    'fallback_mode', COALESCE(usp.fallback_mode, 'squidcloud_then_mine'),
    'upload_distribution', COALESCE(usp.upload_distribution, 'round_robin'),
    'allow_public_sharing', COALESCE(usp.allow_public_sharing, false),
    'max_buckets', COALESCE(usp.max_buckets, 20),
    'active_bucket_count', (SELECT COUNT(*) FROM public.storage_providers WHERE user_id = p_user_id AND is_enabled = true)
  ) INTO prefs
  FROM public.user_storage_preferences usp
  WHERE usp.user_id = p_user_id;

  IF prefs IS NULL THEN
    prefs := jsonb_build_object(
      'fallback_mode', 'squidcloud_then_mine',
      'upload_distribution', 'round_robin',
      'allow_public_sharing', false,
      'max_buckets', 20,
      'active_bucket_count', (SELECT COUNT(*) FROM public.storage_providers WHERE user_id = p_user_id AND is_enabled = true)
    );
  END IF;

  RETURN prefs;
END;
$$;

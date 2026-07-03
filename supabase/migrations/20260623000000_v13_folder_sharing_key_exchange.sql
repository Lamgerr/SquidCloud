-- v13 Octolus Continuum: Folder Sharing, Key Exchange, Realtime Surveillance
-- Part 1: Schema extensions for shares table

ALTER TABLE shares ADD COLUMN IF NOT EXISTS shared_encryption_key TEXT;
ALTER TABLE shares ADD COLUMN IF NOT EXISTS share_secret_hash TEXT;
ALTER TABLE shares ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE CASCADE;
ALTER TABLE shares ADD COLUMN IF NOT EXISTS decrypt_attempts INTEGER DEFAULT 0;
ALTER TABLE shares ADD COLUMN IF NOT EXISTS last_decrypt_attempt_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS shares_folder_id_idx ON shares(folder_id);
CREATE INDEX IF NOT EXISTS shares_decrypt_attempts_idx ON shares(decrypt_attempts) WHERE decrypt_attempts > 0;

-- Part 2: Share decryption surveillance table
CREATE TABLE IF NOT EXISTS share_decrypt_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id TEXT NOT NULL REFERENCES shares(share_id) ON DELETE CASCADE,
  actor_ip INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  failure_reason TEXT,
  geo_city TEXT,
  geo_country TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decrypt_logs_share_id ON share_decrypt_logs(share_id);
CREATE INDEX IF NOT EXISTS idx_decrypt_logs_created_at ON share_decrypt_logs(created_at DESC);

ALTER TABLE share_decrypt_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Share owners can view decrypt logs"
  ON share_decrypt_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shares
      WHERE shares.share_id = share_decrypt_logs.share_id
      AND shares.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can insert decrypt logs"
  ON share_decrypt_logs FOR INSERT
  WITH CHECK (true);

-- Part 3: Add shares to realtime publication (for surveillance broadcasting)
ALTER PUBLICATION supabase_realtime ADD TABLE shares;

-- Part 4: Update create_file_share to accept shared_encryption_key
DROP FUNCTION IF EXISTS public.create_file_share(uuid);
DROP FUNCTION IF EXISTS public.create_file_share(uuid, text);

CREATE OR REPLACE FUNCTION public.create_file_share(
  file_id_param uuid,
  shared_encryption_key_param TEXT DEFAULT NULL,
  share_secret_hash_param TEXT DEFAULT NULL
)
RETURNS TABLE(share_id text)
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_share_id text;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM files WHERE id = file_id_param AND user_id = current_user_id) THEN
    RAISE EXCEPTION 'File not found or access denied';
  END IF;

  IF EXISTS (SELECT 1 FROM shares WHERE file_id = file_id_param AND user_id = current_user_id) THEN
    SELECT s.share_id INTO new_share_id
    FROM shares s
    WHERE s.file_id = file_id_param AND s.user_id = current_user_id;

    -- Update encryption key material if provided
    IF shared_encryption_key_param IS NOT NULL THEN
      UPDATE shares
      SET shared_encryption_key = shared_encryption_key_param,
          share_secret_hash = COALESCE(share_secret_hash_param, shares.share_secret_hash)
      WHERE shares.share_id = new_share_id;
    END IF;

    RETURN QUERY SELECT new_share_id;
    RETURN;
  END IF;

  LOOP
    new_share_id := encode(gen_random_bytes(9), 'base64');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM shares WHERE shares.share_id = new_share_id);
  END LOOP;

  INSERT INTO shares (user_id, file_id, share_id, access_code, created_at, shared_encryption_key, share_secret_hash)
  VALUES (current_user_id, file_id_param, new_share_id, new_share_id, NOW(), shared_encryption_key_param, share_secret_hash_param);

  RETURN QUERY SELECT new_share_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.create_file_share(uuid, text, text) TO authenticated;

-- Part 5: Folder share creation
CREATE OR REPLACE FUNCTION public.create_folder_share(
  folder_id_param uuid,
  shared_encryption_key_param TEXT DEFAULT NULL,
  share_secret_hash_param TEXT DEFAULT NULL
)
RETURNS TABLE(share_id text, file_count bigint)
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_share_id text;
  current_user_id uuid;
  total_files bigint;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM folders WHERE id = folder_id_param AND user_id = current_user_id) THEN
    RAISE EXCEPTION 'Folder not found or access denied';
  END IF;

  SELECT COUNT(*) INTO total_files
  FROM files
  WHERE parent_folder = (SELECT path FROM folders WHERE id = folder_id_param)
    AND user_id = current_user_id
    AND is_deleted = false;

  LOOP
    new_share_id := encode(gen_random_bytes(9), 'base64');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM shares WHERE shares.share_id = new_share_id);
  END LOOP;

  INSERT INTO shares (user_id, folder_id, share_id, access_code, created_at, shared_encryption_key, share_secret_hash)
  VALUES (current_user_id, folder_id_param, new_share_id, new_share_id, NOW(), shared_encryption_key_param, share_secret_hash_param);

  RETURN QUERY SELECT new_share_id, total_files;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.create_folder_share(uuid, text, text) TO authenticated;

-- Part 6: Update get_shared_file_info to include shared_encryption_key (NOT the original encryption_key)
DROP FUNCTION IF EXISTS public.get_shared_file_info(text);

CREATE OR REPLACE FUNCTION public.get_shared_file_info(share_id_param text)
RETURNS TABLE(
  file_id uuid,
  file_name text,
  file_type text,
  file_size bigint,
  file_created_at timestamptz,
  file_updated_at timestamptz,
  is_encrypted boolean,
  storage_path text,
  owner_id uuid,
  share_created_at timestamptz,
  share_expires_at timestamptz,
  share_download_limit integer,
  share_download_count integer,
  share_view_only boolean,
  share_require_email boolean,
  shared_encryption_key text,
  is_folder_share boolean,
  folder_id uuid,
  folder_name text,
  is_byok boolean,
  file_tags text[],
  file_encryption_key text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_folder_id uuid;
  v_is_folder boolean;
BEGIN
  SELECT s.folder_id INTO v_folder_id
  FROM public.shares s
  WHERE s.share_id = share_id_param;

  v_is_folder := v_folder_id IS NOT NULL;

  IF v_is_folder THEN
    RETURN QUERY
    SELECT
      NULL::uuid,
      f.name,
      'inode/directory',
      0::bigint,
      f.created_at,
      f.updated_at,
      false,
      f.path,
      f.user_id::uuid,
      s.created_at,
      s.expires_at,
      NULL::integer,
      NULL::integer,
      NULL::boolean,
      NULL::boolean,
      s.shared_encryption_key,
      true,
      s.folder_id,
      f.name,
      false,
      NULL::text[],
      NULL::text
    FROM public.shares s
    JOIN public.folders f ON s.folder_id = f.id
    WHERE s.share_id = share_id_param
      AND (s.expires_at IS NULL OR s.expires_at > NOW())
      AND s.is_active IS NOT FALSE;
  ELSE
    RETURN QUERY
    SELECT
      f.id::uuid,
      f.name,
      f.type,
      f.size,
      f.created_at,
      f.updated_at,
      f.encrypted,
      f.storage_path,
      f.user_id::uuid,
      s.created_at,
      s.expires_at,
      s.download_limit,
      s.download_count,
      s.view_only,
      s.require_email,
      s.shared_encryption_key,
      false,
      NULL::uuid,
      NULL::text,
      f.encryption_key IN ('sha256:byok_encrypted', 'byok_encrypted'),
      f.tags,
      f.encryption_key
    FROM public.shares s
    JOIN public.files f ON s.file_id = f.id
    WHERE s.share_id = share_id_param
      AND (s.expires_at IS NULL OR s.expires_at > NOW())
      AND s.is_active IS NOT FALSE;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_file_info(text) TO authenticated, anon;

-- Part 7: Get folder share contents listing
CREATE OR REPLACE FUNCTION public.get_folder_share_contents(share_id_param text)
RETURNS TABLE(
  file_id uuid,
  file_name text,
  file_type text,
  file_size bigint,
  file_created_at timestamptz,
  file_updated_at timestamptz,
  is_encrypted boolean,
  shared_encryption_key text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_folder_id uuid;
  v_folder_path text;
  v_user_id uuid;
BEGIN
  SELECT s.folder_id, f.path, f.user_id INTO v_folder_id, v_folder_path, v_user_id
  FROM public.shares s
  JOIN public.folders f ON s.folder_id = f.id
  WHERE s.share_id = share_id_param
    AND (s.expires_at IS NULL OR s.expires_at > NOW())
    AND s.is_active IS NOT FALSE;

  IF v_folder_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    fl.id::uuid,
    fl.name,
    fl.type,
    fl.size,
    fl.created_at,
    fl.updated_at,
    fl.encrypted,
    s.shared_encryption_key
  FROM public.files fl
  CROSS JOIN LATERAL (
    SELECT shared_encryption_key FROM public.shares WHERE share_id = share_id_param
  ) s
  WHERE fl.parent_folder = v_folder_path
    AND fl.user_id = v_user_id
    AND fl.is_deleted = false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_folder_share_contents(text) TO authenticated, anon;

-- Part 8: Log decrypt attempt surveillance function
CREATE OR REPLACE FUNCTION public.log_share_decrypt_attempt(
  p_share_id TEXT,
  p_success BOOLEAN,
  p_failure_reason TEXT DEFAULT NULL,
  p_ip INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO share_decrypt_logs (share_id, success, failure_reason, actor_ip, user_agent)
  VALUES (p_share_id, p_success, p_failure_reason, p_ip, p_user_agent);

  UPDATE shares
  SET decrypt_attempts = COALESCE(decrypt_attempts, 0) + 1,
      last_decrypt_attempt_at = NOW()
  WHERE share_id = p_share_id;

  -- Auto-revoke share after 10 failed attempts (brute force protection)
  IF NOT p_success THEN
    UPDATE shares
    SET is_active = false
    WHERE share_id = p_share_id
      AND COALESCE(decrypt_attempts, 0) >= 10;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_share_decrypt_attempt(text, boolean, text, inet, text) TO authenticated, anon;

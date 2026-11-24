-- Update get_folder_share_contents to return storage_path for file downloads
DROP FUNCTION IF EXISTS public.get_folder_share_contents(text);

CREATE OR REPLACE FUNCTION public.get_folder_share_contents(share_id_param text)
RETURNS TABLE(
  file_id uuid,
  file_name text,
  file_type text,
  file_size bigint,
  file_created_at timestamptz,
  file_updated_at timestamptz,
  is_encrypted boolean,
  shared_encryption_key text,
  storage_path text
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
    s.shared_encryption_key,
    fl.storage_path
  FROM public.files fl
  CROSS JOIN LATERAL (
    SELECT shared_encryption_key FROM public.shares WHERE share_id = share_id_param
  ) s
  WHERE fl.parent_folder = v_folder_path
    AND fl.user_id = v_user_id
    AND fl.is_deleted = false;
END;
$$;

-- Add idempotency to create_folder_share: prevent duplicate folder shares
DROP FUNCTION IF EXISTS public.create_folder_share(uuid, text, text);

CREATE OR REPLACE FUNCTION public.create_folder_share(
  folder_id_param uuid,
  shared_encryption_key_param text DEFAULT NULL::text,
  share_secret_hash_param text DEFAULT NULL::text
)
RETURNS TABLE(share_id text, total_files bigint)
LANGUAGE plpgsql
SECURITY DEFINER
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

  -- Idempotent: if share already exists for this folder+user, return existing
  IF EXISTS (SELECT 1 FROM shares WHERE folder_id = folder_id_param AND user_id = current_user_id AND is_active IS NOT FALSE) THEN
    SELECT s.share_id INTO new_share_id
    FROM shares s
    WHERE s.folder_id = folder_id_param AND s.user_id = current_user_id AND s.is_active IS NOT FALSE;

    -- Update encryption key material if provided
    IF shared_encryption_key_param IS NOT NULL THEN
      UPDATE shares
      SET shared_encryption_key = shared_encryption_key_param,
          share_secret_hash = COALESCE(share_secret_hash_param, shares.share_secret_hash)
      WHERE shares.share_id = new_share_id;
    END IF;

    SELECT COUNT(*) INTO total_files
    FROM files
    WHERE parent_folder = (SELECT path FROM folders WHERE id = folder_id_param)
      AND user_id = current_user_id AND is_deleted = false;

    RETURN QUERY SELECT new_share_id, total_files;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO total_files
  FROM files
  WHERE parent_folder = (SELECT path FROM folders WHERE id = folder_id_param)
    AND user_id = current_user_id AND is_deleted = false;

  LOOP
    new_share_id := encode(gen_random_bytes(9), 'base64');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM shares WHERE shares.share_id = new_share_id);
  END LOOP;

  INSERT INTO shares (user_id, folder_id, share_id, access_code, created_at, shared_encryption_key, share_secret_hash)
  VALUES (current_user_id, folder_id_param, new_share_id, NULL, NOW(), shared_encryption_key_param, share_secret_hash_param);

  RETURN QUERY SELECT new_share_id, total_files;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_folder_share_contents(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_folder_share(uuid, text, text) TO authenticated;

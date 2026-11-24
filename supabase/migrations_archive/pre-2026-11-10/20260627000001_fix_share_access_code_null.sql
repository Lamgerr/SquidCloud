-- Fix create_file_share and create_folder_share to set access_code = NULL on INSERT
-- Previously set access_code = new_share_id (the share URL identifier), making every share
-- appear password-protected even when no password was set.
-- The password (access_code) is set later via a direct UPDATE in createFileShare/createFolderShare
-- when the user provides an accessCode option.

-- Allow NULL in access_code column (no password)
ALTER TABLE shares ALTER COLUMN access_code DROP NOT NULL;

-- Clean up existing shares where access_code was incorrectly set to share_id
UPDATE shares SET access_code = NULL WHERE access_code = share_id;

DROP FUNCTION IF EXISTS public.create_file_share(uuid, text, text);
DROP FUNCTION IF EXISTS public.create_folder_share(uuid, text, text);

CREATE OR REPLACE FUNCTION public.create_file_share(
  file_id_param uuid,
  shared_encryption_key_param text DEFAULT NULL::text,
  share_secret_hash_param text DEFAULT NULL::text
)
RETURNS TABLE(share_id text)
LANGUAGE plpgsql
SECURITY DEFINER
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
  VALUES (current_user_id, file_id_param, new_share_id, NULL, NOW(), shared_encryption_key_param, share_secret_hash_param);

  RETURN QUERY SELECT new_share_id;
END;
$$;

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
  VALUES (current_user_id, folder_id_param, new_share_id, NULL, NOW(), shared_encryption_key_param, share_secret_hash_param);

  RETURN QUERY SELECT new_share_id, total_files;
END;
$$;

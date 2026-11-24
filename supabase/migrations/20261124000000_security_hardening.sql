-- Phase 0 / v12 backend hardening.
-- Closes the live critical exposure from the 2026-11-24 audit without breaking
-- the share-link flow: the wrapped share key stays available through the
-- audited RPC, but it is useless without the URL-fragment secret.

-- 1. Revoke dangerous primitives from PUBLIC/anon/authenticated.
REVOKE ALL ON FUNCTION public.get_secret(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kza_prel_sign_token(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kza_prel_verify_token(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kza_prel_rotate_hmac_key(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_file_record(text, text, bigint, text, uuid, boolean, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_file_for_share(text) FROM PUBLIC, anon, authenticated;

-- 2. update_share_options had NO ownership check: an anon caller could rewrite
--    any share. Preserve every parameter but enforce owner + invoker rights.
CREATE OR REPLACE FUNCTION public.update_share_options(
  p_share_id text,
  p_expires_at timestamp with time zone DEFAULT NULL,
  p_access_code text DEFAULT NULL,
  p_download_limit integer DEFAULT NULL,
  p_view_only boolean DEFAULT NULL,
  p_require_email boolean DEFAULT NULL,
  p_max_views integer DEFAULT NULL,
  p_max_downloads integer DEFAULT NULL,
  p_burn_after_reading boolean DEFAULT NULL,
  p_allowed_countries text[] DEFAULT NULL,
  p_blocked_countries text[] DEFAULT NULL,
  p_device_fingerprint text DEFAULT NULL,
  p_watermark_email boolean DEFAULT NULL,
  p_is_active boolean DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.shares s
                 WHERE s.share_id = p_share_id AND s.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'not authorized for this share';
  END IF;
  UPDATE shares SET
    expires_at = COALESCE(p_expires_at, expires_at),
    access_code = COALESCE(p_access_code, access_code),
    download_limit = COALESCE(p_download_limit, download_limit),
    view_only = COALESCE(p_view_only, view_only),
    require_email = COALESCE(p_require_email, require_email),
    max_views = COALESCE(p_max_views, max_views),
    max_downloads = COALESCE(p_max_downloads, max_downloads),
    burn_after_reading = COALESCE(p_burn_after_reading, burn_after_reading),
    allowed_countries = COALESCE(p_allowed_countries, allowed_countries),
    blocked_countries = COALESCE(p_blocked_countries, blocked_countries),
    device_fingerprint = COALESCE(p_device_fingerprint, device_fingerprint),
    watermark_email = COALESCE(p_watermark_email, watermark_email),
    is_active = COALESCE(p_is_active, is_active)
  WHERE share_id = p_share_id AND user_id = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.update_share_options(text, timestamp with time zone, text, integer,
  boolean, boolean, integer, integer, boolean, text[], text[], text, boolean, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_share_options(text, timestamp with time zone, text, integer,
  boolean, boolean, integer, integer, boolean, text[], text[], text, boolean, boolean)
  TO authenticated;

-- 3. Direct table access is owner-only; share metadata remains available via
--    get_shared_file_info (SECURITY DEFINER, audited, wrapped key only).
DROP POLICY IF EXISTS "Allow public access to shares by share_id" ON public.shares;
DROP POLICY IF EXISTS "shares_select_user_specific" ON public.shares;
DROP POLICY IF EXISTS "Users can create shares for their files" ON public.shares;
DROP POLICY IF EXISTS "Users can create their own shares" ON public.shares;
DROP POLICY IF EXISTS "Users can delete their own shares" ON public.shares;
DROP POLICY IF EXISTS "Users can read their own shares" ON public.shares;
DROP POLICY IF EXISTS "Users can update their own shares" ON public.shares;
DROP POLICY IF EXISTS "Users can view their own shares" ON public.shares;
CREATE POLICY "shares_owner_select" ON public.shares
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "shares_owner_write" ON public.shares
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Strict zero-knowledge file privacy" ON public.files;
DROP POLICY IF EXISTS "Allow public access to shared files" ON public.files;
DROP POLICY IF EXISTS "Allow public access to public files" ON public.files;
-- Legacy policies that granted full file rows to any authenticated user,
-- including `shared = true` and EXISTS(shares...) variants.
DROP POLICY IF EXISTS "files_select_shared" ON public.files;
DROP POLICY IF EXISTS "Admins can read all files" ON public.files;
DROP POLICY IF EXISTS "Admins can update all files" ON public.files;
DROP POLICY IF EXISTS "Admins can delete all files" ON public.files;
DROP POLICY IF EXISTS "Allow authenticated selects from files" ON public.files;
DROP POLICY IF EXISTS "Allow users to delete their own files" ON public.files;
DROP POLICY IF EXISTS "Allow users to update their own files" ON public.files;
DROP POLICY IF EXISTS "Owners can delete their files" ON public.files;
DROP POLICY IF EXISTS "Owners can insert their files" ON public.files;
DROP POLICY IF EXISTS "Owners can update their files" ON public.files;
DROP POLICY IF EXISTS "Users can create their own files" ON public.files;
DROP POLICY IF EXISTS "Users can delete own files" ON public.files;
DROP POLICY IF EXISTS "Users can insert own files" ON public.files;
DROP POLICY IF EXISTS "Users can read own files" ON public.files;
DROP POLICY IF EXISTS "Users can update own files" ON public.files;
CREATE POLICY "files_owner_select" ON public.files
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "files_owner_insert" ON public.files
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "files_owner_update" ON public.files
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "files_owner_delete" ON public.files
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 4. Private storage bucket; downloads go through short-lived signed URLs.
UPDATE storage.buckets SET public = false WHERE id = 'files';

-- 5. No plaintext key column through direct table access (legacy rows kept).
REVOKE SELECT (encryption_key) ON public.files FROM authenticated, anon;
REVOKE SELECT (encrypted_key, encrypted_key_nonce, encryption_key_salt) ON public.files FROM authenticated, anon;

-- 6. Force RLS on all user-data tables.
ALTER TABLE public.files FORCE ROW LEVEL SECURITY;
ALTER TABLE public.shares FORCE ROW LEVEL SECURITY;
ALTER TABLE public.file_key_vault FORCE ROW LEVEL SECURITY;
ALTER TABLE public.github_connections FORCE ROW LEVEL SECURITY;

-- 7. Default privileges: new objects are denied by default.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;

-- 8. get_shared_file_info must not disclose storage paths, file tags or the
-- original encryption key to anonymous share-link holders. Keep the wrapped
-- share key (useless without the URL fragment secret) and metadata only.
CREATE OR REPLACE FUNCTION public.get_shared_file_info(share_id_param text)
 RETURNS TABLE(file_id uuid, file_name text, file_type text, file_size bigint,
   file_created_at timestamp with time zone, file_updated_at timestamp with time zone,
   is_encrypted boolean, owner_id uuid, share_created_at timestamp with time zone,
   share_expires_at timestamp with time zone, share_download_limit integer,
   share_download_count integer, share_view_only boolean, share_require_email boolean,
   shared_encryption_key text, is_folder_share boolean, folder_id uuid,
   folder_name text, is_byok boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_folder_id uuid;
  v_is_folder boolean;
BEGIN
  SELECT s.folder_id INTO v_folder_id FROM public.shares s WHERE s.share_id = share_id_param;
  v_is_folder := v_folder_id IS NOT NULL;

  IF v_is_folder THEN
    RETURN QUERY
    SELECT NULL::uuid, f.name, 'inode/directory'::text, 0::bigint, f.created_at, f.updated_at,
           false, f.user_id, s.created_at, s.expires_at, NULL::integer, NULL::integer,
           NULL::boolean, NULL::boolean, s.shared_encryption_key, true, s.folder_id, f.name, false
    FROM public.shares s JOIN public.folders f ON s.folder_id = f.id
    WHERE s.share_id = share_id_param AND (s.expires_at IS NULL OR s.expires_at > NOW())
      AND s.is_active IS NOT FALSE;
  ELSE
    RETURN QUERY
    SELECT f.id, f.name, f.type, f.size, f.created_at, f.updated_at, f.encrypted,
           f.user_id, s.created_at, s.expires_at, s.download_limit, s.download_count,
           s.view_only, s.require_email, s.shared_encryption_key, false,
           NULL::uuid, NULL::text,
           (f.encryption_key IN ('sha256:byok_encrypted','byok_encrypted'))
    FROM public.shares s JOIN public.files f ON s.file_id = f.id
    WHERE s.share_id = share_id_param AND (s.expires_at IS NULL OR s.expires_at > NOW())
      AND s.is_active IS NOT FALSE;
  END IF;
END;
$function$;

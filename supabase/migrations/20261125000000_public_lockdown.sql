-- Public-lockdown migration (backend open-source readiness).
-- Least-privilege for functions, buckets, and default privileges.
-- Applied live 2026-11-24 via `supabase db query --linked`.

-- 1. Revoke PUBLIC/anon EXECUTE on ALL public functions by default.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
           FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public'
  LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon', r.proname, r.args);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- 2. Explicitly revoke the high-risk primitives from authenticated too.
REVOKE ALL ON FUNCTION public.exec_sql(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_api_key() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_secret(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kza_prel_sign_token(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kza_prel_verify_token(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kza_prel_rotate_hmac_key(text) FROM PUBLIC, anon, authenticated;

-- 3. Grant back only functions that genuinely need anonymous/authenticated access.
--    Share-link metadata (wrapped key blob only; useless without the URL fragment).
GRANT EXECUTE ON FUNCTION public.get_shared_file_info(text) TO anon, authenticated; -- e2e-invariant-allow: superseded by 20261126020300_revoke_anon_share_rpcs
GRANT EXECUTE ON FUNCTION public.get_folder_share_contents(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_share_access(text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_share_view(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_share_download(text) TO anon, authenticated;
-- Owner-scoped key operations (function body checks auth.uid()).
GRANT EXECUTE ON FUNCTION public.rotate_master_key(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_key_selection_preference(uuid) TO authenticated;

-- 4. Make non-public buckets private. (squid-sites / apidoc / avatars / book-covers stay public.)
UPDATE storage.buckets SET public = false
WHERE id IN ('extension-manifests', 'go-mod', 'extensions');

-- 5. Default privileges: new functions/tables are denied by default.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;

-- 6. Force RLS on all user-data tables.
DO $$
DECLARE t RECORD;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public'
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t.tablename);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

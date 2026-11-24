-- Read-only security invariant audit (v12 §19 / §21.12).
-- Run with: supabase db query --linked --file scripts/security-audit.sql
-- Every query below should return zero rows.

-- 1. Sensitive functions must not be executable by anon/authenticated.
SELECT p.proname, 'anon' AS role
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('get_secret','kza_prel_sign_token','kza_prel_verify_token',
                   'kza_prel_rotate_hmac_key','create_file_record','get_file_for_share')
  AND has_function_privilege('anon', p.oid, 'EXECUTE')
UNION ALL
SELECT p.proname, 'authenticated'
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('get_secret','kza_prel_sign_token','kza_prel_verify_token',
                   'kza_prel_rotate_hmac_key','create_file_record','get_file_for_share')
  AND has_function_privilege('authenticated', p.oid, 'EXECUTE');

-- 2. No broad data table policy for anon/public.
SELECT tablename, policyname, roles::text
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('files','shares','zk_vaults','zk_files','zk_devices','zk_ktl')
  AND (roles::text LIKE '%anon%' OR roles::text LIKE '%public%');

-- 3. No permissive USING(true) on user tables.
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('files','shares','zk_vaults','zk_files','zk_devices')
  AND qual IN ('true', '(true)');

-- 4. Every user table must have RLS enabled and forced.
SELECT c.relname
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('files','shares','zk_vaults','zk_files','zk_devices','zk_ktl')
  AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity);

-- 5. Private storage bucket.
SELECT id FROM storage.buckets WHERE id = 'files' AND public = true;

-- 6. get_shared_file_info must not return key/path/tag columns.
SELECT p.proname
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'get_shared_file_info'
  AND pg_get_function_result(p.oid) ~* 'storage_path|file_tags|file_encryption_key|(^|[^_])(encryption_key)([^_]|$)';

-- 7. ZK vaults default to disabled (no silent migration of existing users).
SELECT 'zk_vaults default' AS issue
FROM pg_attrdef d JOIN pg_class c ON c.oid = d.adrelid
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.adnum
WHERE c.relname = 'zk_vaults' AND a.attname = 'status'
  AND pg_get_expr(d.adbin, d.adrelid) NOT LIKE '%disabled%';

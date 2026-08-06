-- 20260804030000_file_key_sweep.sql
-- Automatic safety net: every 6h, POST to the idempotent `backfill-file-keys`
-- edge function. It vault-wraps and strips to managed_key ANY file that still
-- carries a raw encryption key in tags (old clients, upload fallbacks, API
-- inserts), so no raw key survives long anywhere in the REST-visible schema.
select cron.schedule('sweep_file_keys', '0 */6 * * *', $cron$
  select net.http_post(
    url := 'https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/backfill-file-keys',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<ANON_KEY_PLACEHOLDER>',
      'Authorization', 'Bearer <ANON_KEY_PLACEHOLDER>'
    ),
    body := jsonb_build_object('token', 'backfill-2026-08-04-kza-v1')
  );
$cron$;
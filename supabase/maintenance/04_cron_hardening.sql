-- MANUAL / OWNER-RUN ONLY. Not a migration.
-- Two per-minute http_post jobs generate most of the pg_net response bodies.

-- 1. Reduce polling frequency (verify the workers tolerate 5-minute ticks).
SELECT cron.alter_job(3, schedule => '*/5 * * * *');  -- process-migration
SELECT cron.alter_job(6, schedule => '*/5 * * * *');  -- webhook-dispatch retry_due

-- 2. cron.job 9 (backfill-file-keys) embeds a hard-coded anon JWT in its
--    command. DO NOT paste that token anywhere. Replace the command entirely
--    with one that reads the secret from vault / an env-backed function:
--
--    SELECT cron.alter_job(
--      9,
--      command => $$
--        SELECT net.http_post(
--          url := 'https://<project>.supabase.co/functions/v1/backfill-file-keys',
--          headers := jsonb_build_object(
--            'Content-Type', 'application/json',
--            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_webhook_key')
--          ),
--          body := jsonb_build_object('token', 'backfill-2026-08-04-kza-v1')
--        )
--      $$
--    );
--
--    The exact secret name and endpoint contract must be confirmed by the owner.

-- 3. Inventory after changes.
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobid;

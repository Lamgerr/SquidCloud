-- MANUAL / OWNER-RUN ONLY. Not a migration; nothing here runs automatically.
-- Biggest storage win: net._http_response was 290 MB with 733 responses in one day.

-- 1. Inspect before.
SELECT pg_size_pretty(pg_total_relation_size('net._http_response')) AS net_before,
       count(*) AS responses
FROM net._http_response;

-- 2. Prune retained bodies. Start conservatively (24h) and inspect the result;
--    if the table is still large, tighten to 1 hour.
DELETE FROM net._http_response
WHERE created < now() - interval '24 hours';

-- 3. Inspect after.
SELECT pg_size_pretty(pg_total_relation_size('net._http_response')) AS net_after
FROM net._http_response;

-- 4. Make it recurring. Unschedule first so this is idempotent.
SELECT cron.unschedule('net-http-response-retention')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'net-http-response-retention');

SELECT cron.schedule(
  'net-http-response-retention',
  '0 * * * *',
  $$DELETE FROM net._http_response WHERE created < now() - interval '24 hours'$$
);

-- 5. cron.job_run_details was 24 MB / 35,525 rows in 11 days. Existing job 11
--    cleans weekly with 7-day retention; make it daily with 1-day retention.
SELECT cron.alter_job(
  11,
  schedule => '0 * * * *',
  command => $$DELETE FROM cron.job_run_details WHERE start_time < now() - interval '1 day'$$
);

-- 6. Verify total database size after the run.
SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size;

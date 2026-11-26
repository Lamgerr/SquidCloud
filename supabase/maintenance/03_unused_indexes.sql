-- MANUAL / OWNER-RUN ONLY. Not a migration.
-- Secondary indexes with idx_scan = 0 and size > 64 KB in pg_stat_user_indexes.
-- Primary keys and UNIQUE constraint indexes are deliberately excluded.
-- idx_scan resets on stats reset, so confirm with the live advisor before dropping.

-- Inspect first.
SELECT s.relname AS table_name,
       s.indexrelname AS index_name,
       pg_size_pretty(pg_relation_size(s.indexrelid)) AS size,
       s.idx_scan
FROM pg_stat_user_indexes s
WHERE s.schemaname = 'public'
  AND s.idx_scan = 0
  AND pg_relation_size(s.indexrelid) > 65536
ORDER BY pg_relation_size(s.indexrelid) DESC;

-- Safe secondary-index candidates (not PKs, not UNIQUE constraints):
DROP INDEX IF EXISTS public.idx_video_quality_metrics_timestamp;
DROP INDEX IF EXISTS public.idx_video_stream_sessions_last_activity;
DROP INDEX IF EXISTS public.idx_video_stream_sessions_created_at;
DROP INDEX IF EXISTS public.idx_repositories_usage;
DROP INDEX IF EXISTS public.idx_repositories_account_id;
DROP INDEX IF EXISTS public.folders_path_idx;
DROP INDEX IF EXISTS public.files_parent_folder_idx;

-- The advisor also reports 2 duplicate indexes and 130 unused indexes across
-- all schemas. Run the advisor again after these drops and only remove
-- confirmed duplicates from non-PK indexes.

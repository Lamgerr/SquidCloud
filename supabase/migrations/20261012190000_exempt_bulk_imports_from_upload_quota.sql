-- Exempt bulk imports (repo clone, ZIP/cloud migration) from the daily
-- file-upload quota. These flows insert one files row per extracted file
-- (a single repo clone burned 563 credits in seconds), which locked users
-- out of normal uploads. Bulk rows share the '/migration/' storage_path
-- marker on every path (client clone, process-migration, start-migration).
-- Applied directly 2026-10-12 alongside a one-time counter reset.

CREATE OR REPLACE FUNCTION public.count_file_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.storage_path IS NOT NULL AND NEW.storage_path LIKE '%/migration/%' THEN
    RETURN NEW;
  END IF;
  INSERT INTO api_credits (user_id, credits_remaining, daily_limit, last_reset_date, uploads_used_today, uploads_reset_date)
  VALUES (NEW.user_id, 1000, 1000, CURRENT_DATE, 1, CURRENT_DATE)
  ON CONFLICT ON CONSTRAINT api_credits_pkey DO UPDATE SET
    uploads_used_today = CASE
      WHEN api_credits.uploads_reset_date < CURRENT_DATE THEN 1
      ELSE api_credits.uploads_used_today + 1
    END,
    uploads_reset_date = CURRENT_DATE,
    updated_at = now();
  RETURN NEW;
END;
$func$;

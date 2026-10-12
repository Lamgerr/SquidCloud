-- Automatic provider storage accounting.
-- Keeps storage_providers.storage_used_bytes exact on every file write,
-- so the upload capacity gate + sibling failover always decides on fresh
-- numbers with zero manual refreshes and zero cron jobs.
-- Trash (is_deleted) does NOT free bucket space, so only hard DELETEs
-- decrement. Works uniformly for app, API, CLI and edge-function writes.

CREATE OR REPLACE FUNCTION public.sync_provider_storage_used()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.storage_provider_id IS NOT NULL THEN
      UPDATE public.storage_providers
      SET storage_used_bytes = COALESCE(storage_used_bytes, 0) + COALESCE(NEW.size, 0),
          updated_at = now()
      WHERE id = NEW.storage_provider_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.storage_provider_id IS NOT NULL THEN
      UPDATE public.storage_providers
      SET storage_used_bytes = GREATEST(0, COALESCE(storage_used_bytes, 0) - COALESCE(OLD.size, 0)),
          updated_at = now()
      WHERE id = OLD.storage_provider_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.storage_provider_id IS DISTINCT FROM NEW.storage_provider_id THEN
      IF OLD.storage_provider_id IS NOT NULL THEN
        UPDATE public.storage_providers
        SET storage_used_bytes = GREATEST(0, COALESCE(storage_used_bytes, 0) - COALESCE(OLD.size, 0)),
            updated_at = now()
        WHERE id = OLD.storage_provider_id;
      END IF;
      IF NEW.storage_provider_id IS NOT NULL THEN
        UPDATE public.storage_providers
        SET storage_used_bytes = COALESCE(storage_used_bytes, 0) + COALESCE(NEW.size, 0),
            updated_at = now()
        WHERE id = NEW.storage_provider_id;
      END IF;
    ELSIF COALESCE(OLD.size, 0) <> COALESCE(NEW.size, 0) THEN
      IF NEW.storage_provider_id IS NOT NULL THEN
        UPDATE public.storage_providers
        SET storage_used_bytes = GREATEST(0, COALESCE(storage_used_bytes, 0) + COALESCE(NEW.size, 0) - COALESCE(OLD.size, 0)),
            updated_at = now()
        WHERE id = NEW.storage_provider_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_provider_storage_used ON public.files;

CREATE TRIGGER trg_sync_provider_storage_used
AFTER INSERT OR DELETE OR UPDATE OF size, storage_provider_id ON public.files
FOR EACH ROW
EXECUTE FUNCTION public.sync_provider_storage_used();

-- One-time backfill: recompute from all existing file rows (trashed rows
-- still occupy bucket space until hard-deleted, so they count).
UPDATE public.storage_providers p
SET storage_used_bytes = COALESCE(sub.total, 0),
    updated_at = now()
FROM (
  SELECT storage_provider_id AS pid, SUM(COALESCE(size, 0)) AS total
  FROM public.files
  WHERE storage_provider_id IS NOT NULL
  GROUP BY storage_provider_id
) sub
WHERE p.id = sub.pid;

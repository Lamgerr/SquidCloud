-- Per-bucket usage accounting driven straight from the files table,
-- so upload rotation's capacity filter (usedBytes + fileSize <= limitBytes)
-- actually enforces the configured caps.
--
-- Rules: INSERT of a live row adds its chunk bytes; soft-delete subtracts;
-- restore adds back; hard-delete of an already-trashed row changes nothing.
-- Only chunks with an explicitBucket attributions count (repo 'supabase'
-- chunks live in Supabase storage, not B2; legacy array-shape tags carry
-- no bucket). Malformed tags are skipped, never fatal.
CREATE OR REPLACE FUNCTION public.add_file_bytes(p_tags text[], p_size bigint, p_sign int DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw text;
  j jsonb;
  c jsonb;
  b text;
  sz bigint;
  n int;
BEGIN
  IF p_tags IS NULL OR array_length(p_tags, 1) IS NULL THEN RETURN; END IF;
  raw := p_tags[1];
  BEGIN
    j := raw::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;
  IF jsonb_typeof(j) <> 'object' THEN RETURN; END IF;
  IF NOT (j ? 'chunks') THEN RETURN; END IF;
  n := jsonb_array_length(j->'chunks');
  IF n IS NULL OR n = 0 THEN RETURN; END IF;
  FOR c IN SELECT * FROM jsonb_array_elements(j->'chunks') LOOP
    b := c->>'bucket';
    IF b IS NULL OR b = '' THEN CONTINUE; END IF;
    IF (c->>'repo') = 'supabase' THEN CONTINUE; END IF;
    IF (c->>'size') ~ '^[0-9]+$' THEN
      sz := (c->>'size')::bigint;
    ELSE
      sz := COALESCE(p_size, 0) / n;
    END IF;
    UPDATE public.squidcloud_b2_buckets
      SET storage_used_bytes = GREATEST(0, COALESCE(storage_used_bytes, 0) + p_sign * sz)
      WHERE bucket_name = b;
    UPDATE public.storage_providers
      SET storage_used_bytes = GREATEST(0, COALESCE(storage_used_bytes, 0) + p_sign * sz)
      WHERE bucket_name = b;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_bucket_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.is_deleted, false) = false THEN
      PERFORM public.add_file_bytes(NEW.tags, NEW.size, 1);
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF COALESCE(OLD.is_deleted, false) = false THEN
      PERFORM public.add_file_bytes(OLD.tags, OLD.size, -1);
    END IF;
    RETURN OLD;
  END IF;
  IF COALESCE(OLD.is_deleted, false) <> COALESCE(NEW.is_deleted, false) THEN
    IF COALESCE(NEW.is_deleted, false) = true THEN
      PERFORM public.add_file_bytes(OLD.tags, OLD.size, -1);
    ELSE
      PERFORM public.add_file_bytes(NEW.tags, NEW.size, 1);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bucket_usage ON public.files;
CREATE TRIGGER trg_bucket_usage
AFTER INSERT OR UPDATE OF is_deleted OR DELETE ON public.files
FOR EACH ROW EXECUTE FUNCTION public.adjust_bucket_usage();

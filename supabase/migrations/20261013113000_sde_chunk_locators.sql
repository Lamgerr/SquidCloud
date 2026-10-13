-- SDE dispersal locator store. Chunk payloads live on external substrates
-- (Nostr relays, paste-hosts, caches); this table records WHERE each chunk
-- landed so reads don't depend on deterministic routing alone and the fleet
-- can grow without orphaning old files. Locators are opaque (URLs, key
-- refs) — no plaintext, no keys, zero-knowledge preserved.
CREATE TABLE IF NOT EXISTS public.sde_chunk_locators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  chunk_index int NOT NULL,
  substrate text NOT NULL,
  locator text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sde_locators_file ON public.sde_chunk_locators (file_id);
ALTER TABLE public.sde_chunk_locators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own SDE locators" ON public.sde_chunk_locators;
CREATE POLICY "Users manage own SDE locators" ON public.sde_chunk_locators
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Locator rows die with their file (covers hard deletes and the TrashTab
-- direct-delete fallback; soft-deleted files keep locators for restore).
CREATE OR REPLACE FUNCTION public.delete_sde_locators()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.sde_chunk_locators WHERE file_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_sde_locators_cleanup ON public.files;
CREATE TRIGGER trg_sde_locators_cleanup
AFTER DELETE ON public.files
FOR EACH ROW EXECUTE FUNCTION public.delete_sde_locators();

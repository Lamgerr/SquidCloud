CREATE TABLE IF NOT EXISTS public."8djcvk3222" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL UNIQUE REFERENCES public.files(id) ON DELETE CASCADE,
  manifest_data BYTEA NOT NULL,
  manifest_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_8djcvk3222_file_id"
  ON public."8djcvk3222" (file_id);

ALTER TABLE public."8djcvk3222" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access to 8djcvk3222"
  ON public."8djcvk3222"
  FOR ALL
  USING (false)
  WITH CHECK (false);

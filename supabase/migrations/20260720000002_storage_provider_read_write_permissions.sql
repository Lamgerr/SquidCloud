ALTER TABLE public.storage_providers
  ADD COLUMN IF NOT EXISTS read_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS write_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS storage_providers_read_enabled_idx
  ON public.storage_providers (user_id, read_enabled);

CREATE INDEX IF NOT EXISTS storage_providers_write_enabled_idx
  ON public.storage_providers (user_id, write_enabled);

CREATE OR REPLACE FUNCTION public.toggle_storage_provider_permission(
  p_provider_id UUID,
  p_permission TEXT,
  p_enabled BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.storage_providers
  WHERE id = p_provider_id;

  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Provider not found or access denied';
  END IF;

  IF p_permission = 'read' THEN
    UPDATE public.storage_providers
    SET read_enabled = p_enabled, updated_at = now()
    WHERE id = p_provider_id;
  ELSIF p_permission = 'write' THEN
    UPDATE public.storage_providers
    SET write_enabled = p_enabled, updated_at = now()
    WHERE id = p_provider_id;
  ELSE
    RAISE EXCEPTION 'Invalid permission type. Use ''read'' or ''write''.';
  END IF;

  RETURN true;
END;
$$;

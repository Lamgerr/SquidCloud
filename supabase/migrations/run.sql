-- ============================================================
-- SquidCloud v12.5 Migration — run.sql
-- Release Date: August 1, 2026
-- ============================================================

-- 1. UPDATE PLAN LIMITS for v12.5 Supporter changes
-- ============================================================
UPDATE public.plan_limits
SET
  max_file_size_bytes = 12884901888,  -- 12 GB
  sites_always_active = true
WHERE tier = 'supporter';

-- Supporter+ keeps unlimited (-1)
UPDATE public.plan_limits
SET
  max_file_size_bytes = -1,  -- unlimited
  sites_always_active = true
WHERE tier = 'supporter-plus';

-- Free stays at 1 GB
UPDATE public.plan_limits
SET
  max_file_size_bytes = 1073741824   -- 1 GB
WHERE tier = 'free';

-- ============================================================
-- 2. FILE & FOLDER NOTES
-- Private notes per file/folder, never shared
-- ============================================================
CREATE TABLE IF NOT EXISTS public.entity_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('file', 'folder')),
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_entity_notes_user ON public.entity_notes(user_id);
CREATE INDEX idx_entity_notes_entity ON public.entity_notes(entity_id, entity_type);
CREATE INDEX idx_entity_notes_user_entity ON public.entity_notes(user_id, entity_id, entity_type);

ALTER TABLE public.entity_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own notes"
  ON public.entity_notes FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RPC: Get notes for an entity
CREATE OR REPLACE FUNCTION public.get_entity_notes(
  p_entity_id UUID,
  p_entity_type TEXT
)
RETURNS SETOF public.entity_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.entity_notes
  WHERE entity_id = p_entity_id
    AND entity_type = p_entity_type
    AND user_id = auth.uid()
  ORDER BY created_at DESC;
END;
$$;

-- RPC: Create a note
CREATE OR REPLACE FUNCTION public.create_entity_note(
  p_entity_id UUID,
  p_entity_type TEXT,
  p_content TEXT
)
RETURNS public.entity_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_note public.entity_notes;
  note_count BIGINT;
  user_tier TEXT;
  max_notes INT;
BEGIN
  SELECT COALESCE(tier, 'free') INTO user_tier FROM profiles WHERE id = auth.uid();
  IF user_tier IS NULL THEN user_tier := 'free'; END IF;

  max_notes := CASE user_tier
    WHEN 'free' THEN 5
    WHEN 'supporter' THEN 20
    WHEN 'supporter-plus' THEN 30
    ELSE 5
  END;

  SELECT COUNT(*) INTO note_count
  FROM public.entity_notes
  WHERE entity_id = p_entity_id
    AND entity_type = p_entity_type
    AND user_id = auth.uid();

  IF note_count >= max_notes THEN
    RAISE EXCEPTION 'Note limit reached for % plan. Max % notes per file/folder.', user_tier, max_notes;
  END IF;

  INSERT INTO public.entity_notes (user_id, entity_id, entity_type, content)
  VALUES (auth.uid(), p_entity_id, p_entity_type, p_content)
  RETURNING * INTO new_note;

  RETURN new_note;
END;
$$;

-- RPC: Update a note
CREATE OR REPLACE FUNCTION public.update_entity_note(
  p_note_id UUID,
  p_content TEXT
)
RETURNS public.entity_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_note public.entity_notes;
BEGIN
  UPDATE public.entity_notes
  SET content = p_content, updated_at = now()
  WHERE id = p_note_id AND user_id = auth.uid()
  RETURNING * INTO updated_note;

  IF updated_note IS NULL THEN
    RAISE EXCEPTION 'Note not found or access denied';
  END IF;

  RETURN updated_note;
END;
$$;

-- RPC: Delete a note
CREATE OR REPLACE FUNCTION public.delete_entity_note(
  p_note_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted BIGINT;
BEGIN
  DELETE FROM public.entity_notes
  WHERE id = p_note_id AND user_id = auth.uid();

  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted > 0;
END;
$$;

-- RPC: Count notes for an entity
CREATE OR REPLACE FUNCTION public.count_entity_notes(
  p_entity_id UUID,
  p_entity_type TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM public.entity_notes
    WHERE entity_id = p_entity_id
      AND entity_type = p_entity_type
      AND user_id = auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_entity_notes TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_entity_note TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_entity_note TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_entity_note TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_entity_notes TO authenticated;

-- ============================================================
-- 3. WEBHOOK EVENTS (Premium Only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret_key TEXT NOT NULL DEFAULT '',
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhooks_user ON public.webhooks(user_id);

ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own webhooks"
  ON public.webhooks FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.webhook_events_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  response_status INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_events_log_webhook ON public.webhook_events_log(webhook_id);
CREATE INDEX idx_webhook_events_log_created ON public.webhook_events_log(created_at);

ALTER TABLE public.webhook_events_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own webhook event logs"
  ON public.webhook_events_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_user_webhooks()
RETURNS SETOF public.webhooks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.webhooks WHERE user_id = auth.uid() ORDER BY created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_webhook(p_url TEXT, p_events TEXT[])
RETURNS public.webhooks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tier TEXT;
  webhook_count BIGINT;
  max_webhooks INT;
  new_webhook public.webhooks;
  secret TEXT;
BEGIN
  SELECT COALESCE(tier, 'free') INTO user_tier FROM profiles WHERE id = auth.uid();
  IF user_tier IS NULL THEN user_tier := 'free'; END IF;

  IF user_tier = 'free' THEN
    RAISE EXCEPTION 'Webhooks are a premium feature. Upgrade to Supporter or Supporter+.';
  END IF;

  max_webhooks := CASE user_tier WHEN 'supporter' THEN 5 WHEN 'supporter-plus' THEN 10 ELSE 0 END;

  SELECT COUNT(*) INTO webhook_count FROM public.webhooks WHERE user_id = auth.uid();
  IF webhook_count >= max_webhooks THEN
    RAISE EXCEPTION 'Webhook limit reached for % plan. Max % webhooks.', user_tier, max_webhooks;
  END IF;

  secret := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.webhooks (user_id, url, secret_key, events)
  VALUES (auth.uid(), p_url, secret, p_events)
  RETURNING * INTO new_webhook;

  RETURN new_webhook;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_webhook(
  p_webhook_id UUID, p_url TEXT DEFAULT NULL, p_events TEXT[] DEFAULT NULL, p_is_active BOOLEAN DEFAULT NULL
)
RETURNS public.webhooks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE updated_webhook public.webhooks;
BEGIN
  UPDATE public.webhooks
  SET url = COALESCE(p_url, url), events = COALESCE(p_events, events),
      is_active = COALESCE(p_is_active, is_active), updated_at = now()
  WHERE id = p_webhook_id AND user_id = auth.uid()
  RETURNING * INTO updated_webhook;
  IF updated_webhook IS NULL THEN RAISE EXCEPTION 'Webhook not found or access denied'; END IF;
  RETURN updated_webhook;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_webhook(p_webhook_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted BIGINT;
BEGIN
  DELETE FROM public.webhooks WHERE id = p_webhook_id AND user_id = auth.uid();
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.rotate_webhook_secret(p_webhook_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_secret TEXT;
BEGIN
  new_secret := encode(gen_random_bytes(32), 'hex');
  UPDATE public.webhooks SET secret_key = new_secret, updated_at = now()
  WHERE id = p_webhook_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Webhook not found or access denied'; END IF;
  RETURN new_secret;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_webhooks TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_webhook TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_webhook TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_webhook TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_webhook_secret TO authenticated;

-- Webhook Pipeline v2 — industry-standard delivery tracking
ALTER TABLE public.webhook_events_log
  ADD COLUMN IF NOT EXISTS delivery_id UUID,
  ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration_ms INT,
  ADD COLUMN IF NOT EXISTS response_body TEXT,
  ADD COLUMN IF NOT EXISTS event_payload JSONB;

CREATE INDEX IF NOT EXISTS idx_webhook_events_log_pending
  ON public.webhook_events_log(status, next_attempt_at)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_log_delivery
  ON public.webhook_events_log(delivery_id)
  WHERE delivery_id IS NOT NULL;

ALTER TABLE public.webhooks
  ADD COLUMN IF NOT EXISTS total_deliveries INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_deliveries INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_status TEXT,
  ADD COLUMN IF NOT EXISTS last_duration_ms INT;

CREATE OR REPLACE FUNCTION public.ping_webhook(p_webhook_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_webhook public.webhooks;
  v_url TEXT;
BEGIN
  SELECT * INTO v_webhook FROM public.webhooks WHERE id = p_webhook_id AND user_id = auth.uid();
  IF v_webhook.id IS NULL THEN
    RAISE EXCEPTION 'Webhook not found or access denied';
  END IF;

  UPDATE public.webhooks
  SET last_triggered_at = now(), last_status = 'ping',
      updated_at = now()
  WHERE id = v_webhook.id;

  RETURN jsonb_build_object(
    'ok', true,
    'webhook_id', v_webhook.id,
    'url', v_webhook.url,
    'events', v_webhook.events
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ping_webhook(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_webhook_deliveries(
  p_limit INT DEFAULT 50,
  p_status TEXT DEFAULT NULL
)
RETURNS SETOF public.webhook_events_log
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.webhook_events_log
  WHERE user_id = auth.uid()
    AND (p_status IS NULL OR status = p_status)
  ORDER BY created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 200);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_webhook_deliveries(INT, TEXT) TO authenticated;

-- ============================================================
-- 4. SQUIDEMBED — Embed tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS public.embed_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('file', 'folder')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  view_count BIGINT NOT NULL DEFAULT 0,
  embed_config JSONB NOT NULL DEFAULT '{"theme":"dark","width":"100%","height":"400","layout":"grid","showBranding":true}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_embed_tokens_entity ON public.embed_tokens(entity_id, entity_type);
CREATE INDEX idx_embed_tokens_user ON public.embed_tokens(user_id);

ALTER TABLE public.embed_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own embed tokens"
  ON public.embed_tokens FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_or_create_embed_token(p_entity_id UUID, p_entity_type TEXT)
RETURNS public.embed_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE existing_token public.embed_tokens; new_token public.embed_tokens;
BEGIN
  SELECT * INTO existing_token FROM public.embed_tokens
  WHERE entity_id = p_entity_id AND entity_type = p_entity_type AND user_id = auth.uid();
  IF existing_token IS NOT NULL THEN RETURN existing_token; END IF;
  INSERT INTO public.embed_tokens (user_id, entity_id, entity_type)
  VALUES (auth.uid(), p_entity_id, p_entity_type) RETURNING * INTO new_token;
  RETURN new_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_embed_config(p_token_id UUID, p_config JSONB)
RETURNS public.embed_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE updated_token public.embed_tokens;
BEGIN
  UPDATE public.embed_tokens SET embed_config = p_config, updated_at = now()
  WHERE id = p_token_id AND user_id = auth.uid() RETURNING * INTO updated_token;
  IF updated_token IS NULL THEN RAISE EXCEPTION 'Embed token not found or access denied'; END IF;
  RETURN updated_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_embed_token(p_token_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE updated BIGINT;
BEGIN
  UPDATE public.embed_tokens SET is_active = false, updated_at = now()
  WHERE id = p_token_id AND user_id = auth.uid();
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_embed_view(p_token_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_count BIGINT;
BEGIN
  UPDATE public.embed_tokens SET view_count = view_count + 1, updated_at = now()
  WHERE id = p_token_id AND is_active = true RETURNING view_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_embed_token TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_embed_config TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_embed_token TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_embed_view TO anon, authenticated;

-- ============================================================
-- 5. NOTES SEARCH INDEX for Spotlight Search
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_entities_with_notes(
  p_query TEXT, p_limit INT DEFAULT 20
)
RETURNS TABLE (entity_id UUID, entity_type TEXT, entity_name TEXT, match_source TEXT, snippet TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT f.id, 'file'::TEXT, f.name, 'file_name'::TEXT, ''::TEXT
  FROM files f
  WHERE f.user_id = auth.uid() AND f.name ILIKE '%' || p_query || '%'
  LIMIT p_limit;

  RETURN QUERY
  SELECT fo.id, 'folder'::TEXT, fo.name, 'folder_name'::TEXT, ''::TEXT
  FROM folders fo
  WHERE fo.user_id = auth.uid() AND fo.name ILIKE '%' || p_query || '%'
  LIMIT p_limit;

  RETURN QUERY
  SELECT en.entity_id, en.entity_type,
    COALESCE(
      (SELECT f.name FROM files f WHERE f.id = en.entity_id AND f.user_id = auth.uid()),
      (SELECT fo.name FROM folders fo WHERE fo.id = en.entity_id AND fo.user_id = auth.uid()),
      'Unknown'
    ), 'note_content'::TEXT, LEFT(en.content, 100)
  FROM entity_notes en
  WHERE en.user_id = auth.uid() AND en.content ILIKE '%' || p_query || '%'
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_entities_with_notes TO authenticated;

-- ============================================================
-- Done — All v12.5 features migrated
-- ============================================================

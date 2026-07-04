-- PDF Viewer Backend: Annotations, Bookmarks, Reading Progress, Sessions
CREATE TABLE IF NOT EXISTS public.pdf_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id text NOT NULL,
  page_number integer NOT NULL,
  annotation_type text NOT NULL CHECK (annotation_type IN ('highlight','underline','strikethrough','freehand','sticky_note','text_box','signature','drawing')),
  color text DEFAULT '#FFEB3B',
  opacity real DEFAULT 0.4,
  content jsonb DEFAULT '{}'::jsonb,
  position_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pdf_annotations_doc_page ON public.pdf_annotations(document_id, page_number);
CREATE INDEX IF NOT EXISTS idx_pdf_annotations_user ON public.pdf_annotations(user_id);
ALTER TABLE public.pdf_annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own annotations"
  ON public.pdf_annotations FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.pdf_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id text NOT NULL,
  page_number integer NOT NULL,
  label text DEFAULT '',
  color text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pdf_bookmarks_user_doc ON public.pdf_bookmarks(user_id, document_id);
ALTER TABLE public.pdf_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own bookmarks"
  ON public.pdf_bookmarks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.pdf_reading_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id text NOT NULL,
  document_name text DEFAULT '',
  last_page integer DEFAULT 1,
  total_pages integer DEFAULT 0,
  scroll_position real DEFAULT 0,
  zoom real DEFAULT 1.35,
  theme text DEFAULT 'normal',
  layout text DEFAULT 'single',
  reading_time_seconds integer DEFAULT 0,
  last_read_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, document_id)
);
ALTER TABLE public.pdf_reading_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own reading progress"
  ON public.pdf_reading_progress FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.pdf_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_ids text[] DEFAULT '{}',
  active_document text DEFAULT '',
  state_data jsonb DEFAULT '{}'::jsonb,
  last_active timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pdf_sessions_user ON public.pdf_sessions(user_id);
ALTER TABLE public.pdf_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own sessions"
  ON public.pdf_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_pdf_statistics(p_document_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user_id uuid; v_annotation_count integer; v_bookmark_count integer; v_reading_time integer; v_last_page integer;
BEGIN
  v_user_id := auth.uid(); IF v_user_id IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  SELECT COUNT(*) INTO v_annotation_count FROM public.pdf_annotations WHERE document_id = p_document_id AND user_id = v_user_id;
  SELECT COUNT(*) INTO v_bookmark_count FROM public.pdf_bookmarks WHERE document_id = p_document_id AND user_id = v_user_id;
  SELECT reading_time_seconds, last_page INTO v_reading_time, v_last_page FROM public.pdf_reading_progress WHERE document_id = p_document_id AND user_id = v_user_id;
  RETURN jsonb_build_object('annotations', COALESCE(v_annotation_count, 0), 'bookmarks', COALESCE(v_bookmark_count, 0), 'reading_time_seconds', COALESCE(v_reading_time, 0), 'last_page', COALESCE(v_last_page, 1));
END; $$;
GRANT EXECUTE ON FUNCTION public.get_pdf_statistics TO authenticated;

CREATE OR REPLACE FUNCTION public.bulk_save_pdf_annotations(p_annotations jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user_id uuid; v_annotation jsonb;
BEGIN
  v_user_id := auth.uid(); IF v_user_id IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  FOR v_annotation IN SELECT * FROM jsonb_array_elements(p_annotations) LOOP
    INSERT INTO public.pdf_annotations (user_id, document_id, page_number, annotation_type, color, opacity, content, position_data)
    VALUES (v_user_id, v_annotation->>'document_id', (v_annotation->>'page_number')::integer, v_annotation->>'annotation_type',
      COALESCE(v_annotation->>'color', '#FFEB3B'), COALESCE((v_annotation->>'opacity')::real, 0.4), COALESCE(v_annotation->'content', '{}'::jsonb), COALESCE(v_annotation->'position_data', '{}'::jsonb));
  END LOOP;
  RETURN jsonb_build_object('success', true, 'count', jsonb_array_length(p_annotations));
END; $$;
GRANT EXECUTE ON FUNCTION public.bulk_save_pdf_annotations TO authenticated;

CREATE OR REPLACE FUNCTION public.export_pdf_annotations(p_document_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user_id uuid;
BEGIN
  v_user_id := auth.uid(); IF v_user_id IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  RETURN (SELECT jsonb_agg(jsonb_build_object('page', page_number, 'type', annotation_type, 'color', color, 'content', content, 'position', position_data, 'created', created_at) ORDER BY page_number, created_at)
    FROM public.pdf_annotations WHERE document_id = p_document_id AND user_id = v_user_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.export_pdf_annotations TO authenticated;
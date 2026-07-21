-- DeepRead: Book metadata & reading progress tables

-- Book metadata (covers, extracted title/author)
CREATE TABLE IF NOT EXISTS public.book_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cover_storage_path text DEFAULT NULL,
  extracted_title text DEFAULT NULL,
  extracted_author text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, file_id)
);

ALTER TABLE public.book_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own book metadata"
  ON public.book_metadata FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Unified reading progress for books (EPUB/PDF/etc)
CREATE TABLE IF NOT EXISTS public.reading_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_page integer DEFAULT 0,
  total_pages integer DEFAULT 0,
  last_read_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, file_id)
);

ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own reading progress"
  ON public.reading_progress FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Storage bucket for book covers
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('book-covers', 'book-covers', true, 2097152, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload covers
CREATE POLICY "Users can upload own covers"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'book-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own covers"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'book-covers');

CREATE POLICY "Users can delete own covers"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'book-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read for covers (so they can be displayed in the UI)
CREATE POLICY "Public read book covers"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'book-covers');

-- RPC: Save reading progress
CREATE OR REPLACE FUNCTION public.save_reading_progress(
  p_file_id uuid,
  p_progress integer DEFAULT 0,
  p_current_page integer DEFAULT 0,
  p_total_pages integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.reading_progress (file_id, user_id, progress, current_page, total_pages, last_read_at, updated_at)
  VALUES (p_file_id, auth.uid(), p_progress, p_current_page, p_total_pages, now(), now())
  ON CONFLICT (user_id, file_id)
  DO UPDATE SET
    progress = EXCLUDED.progress,
    current_page = EXCLUDED.current_page,
    total_pages = EXCLUDED.total_pages,
    last_read_at = now(),
    updated_at = now();
END;
$$;

-- RPC: Get reading progress
CREATE OR REPLACE FUNCTION public.get_reading_progress(p_file_id uuid)
RETURNS TABLE (
  progress integer,
  current_page integer,
  total_pages integer,
  last_read_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT rp.progress, rp.current_page, rp.total_pages, rp.last_read_at
  FROM public.reading_progress rp
  WHERE rp.file_id = p_file_id AND rp.user_id = auth.uid()
  LIMIT 1;
END;
$$;

-- RPC: Save book metadata
CREATE OR REPLACE FUNCTION public.save_book_metadata(
  p_file_id uuid,
  p_cover_storage_path text DEFAULT NULL,
  p_extracted_title text DEFAULT NULL,
  p_extracted_author text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.book_metadata (file_id, user_id, cover_storage_path, extracted_title, extracted_author, updated_at)
  VALUES (p_file_id, auth.uid(), p_cover_storage_path, p_extracted_title, p_extracted_author, now())
  ON CONFLICT (user_id, file_id)
  DO UPDATE SET
    cover_storage_path = COALESCE(EXCLUDED.cover_storage_path, book_metadata.cover_storage_path),
    extracted_title = COALESCE(EXCLUDED.extracted_title, book_metadata.extracted_title),
    extracted_author = COALESCE(EXCLUDED.extracted_author, book_metadata.extracted_author),
    updated_at = now();
END;
$$;

-- RPC: Get book metadata
CREATE OR REPLACE FUNCTION public.get_book_metadata(p_file_id uuid)
RETURNS TABLE (
  id uuid,
  file_id uuid,
  cover_storage_path text,
  extracted_title text,
  extracted_author text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT bm.id, bm.file_id, bm.cover_storage_path, bm.extracted_title, bm.extracted_author, bm.created_at, bm.updated_at
  FROM public.book_metadata bm
  WHERE bm.file_id = p_file_id AND bm.user_id = auth.uid()
  LIMIT 1;
END;
$$;

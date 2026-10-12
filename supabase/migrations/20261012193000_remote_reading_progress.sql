-- Remote (non-library) reading progress: Gutendex / Open Library /
-- Internet Archive books have no files row, so they get their own table
-- keyed by a stable provider key (e.g. 'gutendex:123', 'ol:/works/OL..W',
-- 'ia:someidentifier').

CREATE TABLE IF NOT EXISTS public.remote_reading_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_key text NOT NULL,
  title text DEFAULT NULL,
  author text DEFAULT NULL,
  cover_url text DEFAULT NULL,
  subjects jsonb DEFAULT '[]'::jsonb,
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_page integer DEFAULT 0,
  total_pages integer DEFAULT 0,
  last_read_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, book_key)
);

ALTER TABLE public.remote_reading_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own remote progress" ON public.remote_reading_progress;
CREATE POLICY "Users manage own remote progress"
  ON public.remote_reading_progress FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.save_remote_progress(
  p_book_key text,
  p_progress integer DEFAULT 0,
  p_current_page integer DEFAULT 0,
  p_total_pages integer DEFAULT 0,
  p_title text DEFAULT NULL,
  p_author text DEFAULT NULL,
  p_cover_url text DEFAULT NULL,
  p_subjects jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.remote_reading_progress
    (book_key, user_id, progress, current_page, total_pages, title, author, cover_url, subjects, last_read_at, updated_at)
  VALUES
    (p_book_key, auth.uid(), p_progress, p_current_page, p_total_pages, p_title, p_author, p_cover_url, COALESCE(p_subjects, '[]'::jsonb), now(), now())
  ON CONFLICT (user_id, book_key)
  DO UPDATE SET
    progress = EXCLUDED.progress,
    current_page = EXCLUDED.current_page,
    total_pages = EXCLUDED.total_pages,
    title = COALESCE(EXCLUDED.title, public.remote_reading_progress.title),
    author = COALESCE(EXCLUDED.author, public.remote_reading_progress.author),
    cover_url = COALESCE(EXCLUDED.cover_url, public.remote_reading_progress.cover_url),
    subjects = CASE WHEN EXCLUDED.subjects = '[]'::jsonb THEN public.remote_reading_progress.subjects ELSE EXCLUDED.subjects END,
    last_read_at = now(),
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_remote_progress(p_book_key text)
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
  FROM public.remote_reading_progress rp
  WHERE rp.book_key = p_book_key AND rp.user_id = auth.uid()
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_remote_progress(p_limit integer DEFAULT 12)
RETURNS TABLE (
  book_key text,
  title text,
  author text,
  cover_url text,
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
  SELECT rp.book_key, rp.title, rp.author, rp.cover_url, rp.progress, rp.current_page, rp.total_pages, rp.last_read_at
  FROM public.remote_reading_progress rp
  WHERE rp.user_id = auth.uid()
  ORDER BY rp.last_read_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 12), 50));
END;
$$;

CREATE TABLE IF NOT EXISTS public.github_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    github_user_id TEXT NOT NULL,
    github_username TEXT NOT NULL,
    access_token TEXT NOT NULL,
    token_type TEXT DEFAULT 'bearer',
    scope TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_github_connections_user_id ON public.github_connections(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_github_connections_user_gh_id ON public.github_connections(user_id, github_user_id);

ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own GitHub connections"
    ON public.github_connections FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own GitHub connections"
    ON public.github_connections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own GitHub connections"
    ON public.github_connections FOR DELETE
    USING (auth.uid() = user_id);

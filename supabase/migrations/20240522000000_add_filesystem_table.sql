
-- Create a filesystem table to manage files and folders
CREATE TABLE IF NOT EXISTS public.filesystem (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('file', 'folder')),
    parentId UUID REFERENCES public.filesystem(id),
    userId UUID REFERENCES auth.users(id) NOT NULL,
    fileId UUID REFERENCES public.files(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_filesystem_parent ON public.filesystem (parentId);
CREATE INDEX IF NOT EXISTS idx_filesystem_user ON public.filesystem (userId);

-- Add RLS policies for filesystem table
ALTER TABLE public.filesystem ENABLE ROW LEVEL SECURITY;

-- Policy for select (read)
CREATE POLICY select_filesystem ON public.filesystem
    FOR SELECT TO authenticated
    USING (userId = auth.uid());

-- Policy for insert
CREATE POLICY insert_filesystem ON public.filesystem
    FOR INSERT TO authenticated
    WITH CHECK (userId = auth.uid());

-- Policy for update
CREATE POLICY update_filesystem ON public.filesystem
    FOR UPDATE TO authenticated
    USING (userId = auth.uid())
    WITH CHECK (userId = auth.uid());

-- Policy for delete
CREATE POLICY delete_filesystem ON public.filesystem
    FOR DELETE TO authenticated
    USING (userId = auth.uid());

-- Add storage_quota_gb column to profiles if it doesn't exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS storage_quota_gb NUMERIC DEFAULT 5;

-- Add onboarding_complete flag to profiles if it doesn't exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;

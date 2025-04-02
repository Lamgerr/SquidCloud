
-- Add needed columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS storage_quota_gb NUMERIC DEFAULT 5,
ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS repo_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS preview_available BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS preview_type TEXT;

-- Update existing profiles
UPDATE public.profiles 
SET storage_quota_gb = 5, 
    onboarding_complete = false,
    repo_count = 0
WHERE storage_quota_gb IS NULL 
   OR onboarding_complete IS NULL
   OR repo_count IS NULL;

-- Add RLS policy for these columns
CREATE POLICY "Users can read own storage_quota_gb" ON profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can read own onboarding_complete" ON profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can read own repo_count" ON profiles
FOR SELECT
USING (auth.uid() = id);

-- Add types to database for filesystem operations
CREATE TYPE file_system_item_type AS ENUM ('file', 'folder');

-- Create table for filesystem if it doesn't exist
CREATE TABLE IF NOT EXISTS public.filesystem (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type file_system_item_type NOT NULL,
    parent_id UUID REFERENCES public.filesystem(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    file_id UUID REFERENCES public.files(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Add RLS policies for filesystem
ALTER TABLE public.filesystem ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own filesystem items" ON public.filesystem
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own filesystem items" ON public.filesystem
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own filesystem items" ON public.filesystem
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own filesystem items" ON public.filesystem
FOR DELETE
USING (auth.uid() = user_id);

-- Add preview columns to files table if they don't exist
ALTER TABLE public.files
ADD COLUMN IF NOT EXISTS preview_available BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS preview_type TEXT;

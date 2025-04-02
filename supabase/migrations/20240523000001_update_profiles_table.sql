
-- Add needed columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS storage_quota_gb NUMERIC DEFAULT 5,
ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS repo_count INT DEFAULT 0;

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

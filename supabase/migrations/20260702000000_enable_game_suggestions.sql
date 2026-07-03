-- Game Suggestions Preference for profiles
-- Migration: 20260702000000

-- Add game suggestions toggle column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS enable_game_suggestions boolean NOT NULL DEFAULT true;

-- RPC for fast client-side toggling
CREATE OR REPLACE FUNCTION public.update_game_preference(p_enable boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET enable_game_suggestions = p_enable,
      updated_at = now()
  WHERE id = auth.uid();
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.update_game_preference TO authenticated;


-- Update the get_filesystem_item function to properly join with files table
CREATE OR REPLACE FUNCTION public.get_filesystem_item(item_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  type TEXT,
  parent_id UUID,
  user_id UUID,
  file_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fs.id,
    fs.name,
    fs.type::TEXT,
    fs.parent_id,
    fs.user_id,
    fs.file_id,
    fs.created_at,
    fs.updated_at
  FROM public.filesystem fs
  WHERE fs.id = item_id
  AND fs.user_id = auth.uid();
END;
$$;

-- Make sure the RPC function can be called
GRANT EXECUTE ON FUNCTION public.get_filesystem_item(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_folder_contents(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_folder_by_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_folder(TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_file_entry(TEXT, UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rename_filesystem_item(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_filesystem_item(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_filesystem_item(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_storage_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_file_system(UUID) TO authenticated;

-- Add preview_available and preview_type to files table if they don't exist
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS preview_available BOOLEAN DEFAULT FALSE;
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS preview_type TEXT DEFAULT NULL;

-- Update policies to ensure users can access their files and filesystem items
CREATE POLICY IF NOT EXISTS "Users can view their filesystem items" ON public.filesystem
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can view their files" ON public.files
FOR SELECT
USING (auth.uid() = user_id);

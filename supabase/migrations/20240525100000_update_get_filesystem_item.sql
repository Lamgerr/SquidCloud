
-- Update the get_filesystem_item function to return all fields
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

-- Add RLS policy for the function
CREATE POLICY IF NOT EXISTS "Users can execute get_filesystem_item" ON public.filesystem
FOR SELECT
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.delete_folder_secure(folder_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  is_authorized BOOLEAN := FALSE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT public.assert_pin_authorized_operation('delete_files') INTO is_authorized;
  IF COALESCE(is_authorized, FALSE) = FALSE THEN
    RAISE EXCEPTION 'PIN authentication required';
  END IF;

  -- Delete files from all descendant folders (recursive traversal)
  WITH RECURSIVE subfolders AS (
    SELECT id FROM public.folders
    WHERE id = folder_uuid AND user_id = current_user_id
    
    UNION ALL
    
    SELECT f.id FROM public.folders f
    INNER JOIN subfolders sf ON f.parent_folder = sf.id::text
    WHERE f.user_id = current_user_id
  )
  DELETE FROM public.files
  WHERE parent_folder IN (SELECT id::text FROM subfolders)
    AND user_id = current_user_id;

  -- Delete all descendant folders (including target)
  WITH RECURSIVE subfolders AS (
    SELECT id FROM public.folders
    WHERE id = folder_uuid AND user_id = current_user_id
    
    UNION ALL
    
    SELECT f.id FROM public.folders f
    INNER JOIN subfolders sf ON f.parent_folder = sf.id::text
    WHERE f.user_id = current_user_id
  )
  DELETE FROM public.folders
  WHERE id IN (SELECT id FROM subfolders)
    AND user_id = current_user_id;

  RETURN FOUND;
END;
$$;

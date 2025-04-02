
-- Create filesystem RPC functions

-- Get folder contents
CREATE OR REPLACE FUNCTION public.get_folder_contents(parent_id UUID)
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
  FROM 
    filesystem fs
  WHERE 
    (parent_id IS NULL AND fs.parent_id IS NULL) OR
    fs.parent_id = parent_id
  AND
    fs.user_id = auth.uid();
END;
$$;

-- Get folder by ID
CREATE OR REPLACE FUNCTION public.get_folder_by_id(folder_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  type TEXT,
  parent_id UUID,
  user_id UUID,
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
    fs.created_at,
    fs.updated_at
  FROM 
    filesystem fs
  WHERE 
    fs.id = folder_id
  AND
    fs.user_id = auth.uid()
  AND
    fs.type = 'folder';
END;
$$;

-- Create a folder
CREATE OR REPLACE FUNCTION public.create_folder(
  name TEXT,
  parent_id UUID,
  user_id UUID
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  type TEXT,
  parent_id UUID,
  user_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_folder_id UUID;
BEGIN
  -- Verify user is creating for themselves
  IF user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Insert folder
  INSERT INTO filesystem (name, type, parent_id, user_id)
  VALUES (name, 'folder', parent_id, user_id)
  RETURNING id INTO new_folder_id;

  -- Return the created folder
  RETURN QUERY
  SELECT 
    fs.id,
    fs.name,
    fs.type::TEXT,
    fs.parent_id,
    fs.user_id,
    fs.created_at,
    fs.updated_at
  FROM 
    filesystem fs
  WHERE 
    fs.id = new_folder_id;
END;
$$;

-- Create a file entry
CREATE OR REPLACE FUNCTION public.create_file_entry(
  name TEXT,
  parent_id UUID,
  user_id UUID,
  file_id UUID
)
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
DECLARE
  new_file_entry_id UUID;
BEGIN
  -- Verify user is creating for themselves
  IF user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Insert file entry
  INSERT INTO filesystem (name, type, parent_id, user_id, file_id)
  VALUES (name, 'file', parent_id, user_id, file_id)
  RETURNING id INTO new_file_entry_id;

  -- Return the created file entry
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
  FROM 
    filesystem fs
  WHERE 
    fs.id = new_file_entry_id;
END;
$$;

-- Delete filesystem item
CREATE OR REPLACE FUNCTION public.delete_filesystem_item(item_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_type TEXT;
  file_id_to_delete UUID;
BEGIN
  -- Get item's file_id and type if it exists
  SELECT fs.type::TEXT, fs.file_id INTO item_type, file_id_to_delete
  FROM filesystem fs
  WHERE fs.id = item_id AND fs.user_id = auth.uid();
  
  -- Delete the filesystem entry
  DELETE FROM filesystem WHERE id = item_id AND user_id = auth.uid();
  
  -- If item was a file, also delete the file record
  IF item_type = 'file' AND file_id_to_delete IS NOT NULL THEN
    DELETE FROM files WHERE id = file_id_to_delete AND user_id = auth.uid();
  END IF;
END;
$$;

-- Rename filesystem item
CREATE OR REPLACE FUNCTION public.rename_filesystem_item(
  item_id UUID,
  new_name TEXT
)
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
  -- Update the item name
  UPDATE filesystem 
  SET 
    name = new_name,
    updated_at = now()
  WHERE 
    id = item_id AND user_id = auth.uid();

  -- Return the updated item
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
  FROM 
    filesystem fs
  WHERE 
    fs.id = item_id;
END;
$$;

-- Move filesystem item
CREATE OR REPLACE FUNCTION public.move_filesystem_item(
  item_id UUID,
  new_parent_id UUID
)
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
  -- Update the item parent_id
  UPDATE filesystem 
  SET 
    parent_id = new_parent_id,
    updated_at = now()
  WHERE 
    id = item_id AND user_id = auth.uid();

  -- Return the updated item
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
  FROM 
    filesystem fs
  WHERE 
    fs.id = item_id;
END;
$$;

-- Get user storage stats
CREATE OR REPLACE FUNCTION public.get_user_storage_stats(user_id UUID)
RETURNS TABLE (
  total_size BIGINT,
  file_count BIGINT,
  folder_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user is querying for themselves
  IF user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT 
    COALESCE(SUM(f.size), 0)::BIGINT as total_size,
    COUNT(DISTINCT fs.id) FILTER (WHERE fs.type = 'file')::BIGINT as file_count,
    COUNT(DISTINCT fs.id) FILTER (WHERE fs.type = 'folder')::BIGINT as folder_count
  FROM 
    filesystem fs
  LEFT JOIN
    files f ON fs.file_id = f.id
  WHERE 
    fs.user_id = user_id;
END;
$$;

-- Initialize file system
CREATE OR REPLACE FUNCTION public.initialize_file_system(user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user is initializing for themselves
  IF user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Create default folders if they don't exist
  INSERT INTO filesystem (name, type, parent_id, user_id)
  VALUES 
    ('Documents', 'folder', NULL, user_id),
    ('Images', 'folder', NULL, user_id),
    ('Videos', 'folder', NULL, user_id)
  ON CONFLICT DO NOTHING;
  
  -- Update user profile to mark onboarding as complete
  UPDATE profiles
  SET onboarding_complete = true
  WHERE id = user_id;
END;
$$;

-- Get filesystem entry by file_id
CREATE OR REPLACE FUNCTION public.get_filesystem_entry_by_file_id(file_id UUID)
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
  FROM 
    filesystem fs
  JOIN
    files f ON fs.file_id = f.id
  WHERE 
    fs.file_id = file_id
  AND
    fs.user_id = auth.uid();
END;
$$;

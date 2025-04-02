
-- Create functions to work with the filesystem table

-- Function to get folder contents
CREATE OR REPLACE FUNCTION get_folder_contents(parent_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  type TEXT,
  parent_id UUID,
  user_id UUID,
  file_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.name,
    f.type,
    f."parentId" as parent_id,
    f."userId" as user_id,
    f."fileId" as file_id,
    f.created_at,
    f.updated_at
  FROM
    public.filesystem f
  WHERE
    f."parentId" IS NOT DISTINCT FROM parent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get a specific folder by ID
CREATE OR REPLACE FUNCTION get_folder_by_id(folder_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  type TEXT,
  parent_id UUID,
  user_id UUID,
  file_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.name,
    f.type,
    f."parentId" as parent_id,
    f."userId" as user_id,
    f."fileId" as file_id,
    f.created_at,
    f.updated_at
  FROM
    public.filesystem f
  WHERE
    f.id = folder_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a folder
CREATE OR REPLACE FUNCTION create_folder(
  name TEXT,
  type TEXT,
  parent_id UUID,
  user_id UUID
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
) AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO public.filesystem (name, type, "parentId", "userId", created_at, updated_at)
  VALUES (name, type, parent_id, user_id, now(), now())
  RETURNING id INTO new_id;
  
  RETURN QUERY
  SELECT
    f.id,
    f.name,
    f.type,
    f."parentId" as parent_id,
    f."userId" as user_id,
    f."fileId" as file_id,
    f.created_at,
    f.updated_at
  FROM
    public.filesystem f
  WHERE
    f.id = new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a file entry
CREATE OR REPLACE FUNCTION create_file_entry(
  name TEXT,
  type TEXT,
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
) AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO public.filesystem (name, type, "parentId", "userId", "fileId", created_at, updated_at)
  VALUES (name, type, parent_id, user_id, file_id, now(), now())
  RETURNING id INTO new_id;
  
  RETURN QUERY
  SELECT
    f.id,
    f.name,
    f.type,
    f."parentId" as parent_id,
    f."userId" as user_id,
    f."fileId" as file_id,
    f.created_at,
    f.updated_at
  FROM
    public.filesystem f
  WHERE
    f.id = new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete a filesystem item (recursive for folders)
CREATE OR REPLACE FUNCTION delete_filesystem_item(item_id UUID)
RETURNS VOID AS $$
DECLARE
  item_record RECORD;
  child_record RECORD;
BEGIN
  -- Get the item
  SELECT * INTO item_record FROM public.filesystem WHERE id = item_id;
  
  -- If not found, do nothing
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- If it's a folder, recursively delete all children
  IF item_record.type = 'folder' THEN
    FOR child_record IN SELECT id FROM public.filesystem WHERE "parentId" = item_id
    LOOP
      PERFORM delete_filesystem_item(child_record.id);
    END LOOP;
  -- If it's a file, delete the associated file if needed
  ELSIF item_record.type = 'file' AND item_record."fileId" IS NOT NULL THEN
    DELETE FROM public.files WHERE id = item_record."fileId";
  END IF;
  
  -- Finally, delete the item itself
  DELETE FROM public.filesystem WHERE id = item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to rename a filesystem item
CREATE OR REPLACE FUNCTION rename_filesystem_item(
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
) AS $$
BEGIN
  UPDATE public.filesystem
  SET name = new_name, updated_at = now()
  WHERE id = item_id;
  
  RETURN QUERY
  SELECT
    f.id,
    f.name,
    f.type,
    f."parentId" as parent_id,
    f."userId" as user_id,
    f."fileId" as file_id,
    f.created_at,
    f.updated_at
  FROM
    public.filesystem f
  WHERE
    f.id = item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to move a filesystem item
CREATE OR REPLACE FUNCTION move_filesystem_item(
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
) AS $$
BEGIN
  UPDATE public.filesystem
  SET "parentId" = new_parent_id, updated_at = now()
  WHERE id = item_id;
  
  RETURN QUERY
  SELECT
    f.id,
    f.name,
    f.type,
    f."parentId" as parent_id,
    f."userId" as user_id,
    f."fileId" as file_id,
    f.created_at,
    f.updated_at
  FROM
    public.filesystem f
  WHERE
    f.id = item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get filesystem entry by file ID
CREATE OR REPLACE FUNCTION get_filesystem_entry_by_file_id(file_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  type TEXT,
  parent_id UUID,
  user_id UUID,
  file_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.name,
    f.type,
    f."parentId" as parent_id,
    f."userId" as user_id,
    f."fileId" as file_id,
    f.created_at,
    f.updated_at
  FROM
    public.filesystem f
  WHERE
    f."fileId" = file_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get storage stats for a user
CREATE OR REPLACE FUNCTION get_user_storage_stats(user_id UUID)
RETURNS TABLE (
  total_size BIGINT,
  file_count INT,
  folder_count INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(f.size), 0) as total_size,
    COUNT(CASE WHEN fs.type = 'file' THEN 1 END) as file_count,
    COUNT(CASE WHEN fs.type = 'folder' THEN 1 END) as folder_count
  FROM
    public.filesystem fs
  LEFT JOIN
    public.files f ON fs."fileId" = f.id
  WHERE
    fs."userId" = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to initialize a filesystem for a user
CREATE OR REPLACE FUNCTION initialize_file_system(user_id UUID)
RETURNS VOID AS $$
DECLARE
  count_folders INT;
BEGIN
  -- Check if user already has folders
  SELECT COUNT(*) INTO count_folders FROM public.filesystem 
  WHERE "userId" = user_id AND "parentId" IS NULL;
  
  -- If no root folders exist, create default folders
  IF count_folders = 0 THEN
    -- Create My Files folder
    INSERT INTO public.filesystem (name, type, "parentId", "userId", created_at, updated_at)
    VALUES ('My Files', 'folder', NULL, user_id, now(), now());
    
    -- Create Shared with me folder
    INSERT INTO public.filesystem (name, type, "parentId", "userId", created_at, updated_at)
    VALUES ('Shared with me', 'folder', NULL, user_id, now(), now());
    
    -- Create Documents folder
    INSERT INTO public.filesystem (name, type, "parentId", "userId", created_at, updated_at)
    VALUES ('Documents', 'folder', NULL, user_id, now(), now());
    
    -- Create Media folder
    INSERT INTO public.filesystem (name, type, "parentId", "userId", created_at, updated_at)
    VALUES ('Media', 'folder', NULL, user_id, now(), now());
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

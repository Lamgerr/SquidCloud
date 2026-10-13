-- Allows owners to read objects in the `files` bucket that back
-- migration / cloud-import / direct-upload rows (no chunk metadata —
-- the object at storage_path IS the file), plus res54 chunk objects
-- written by server-side importers under <uid>/.../res54/.
DROP POLICY IF EXISTS "Users can read own file objects" ON storage.objects;
CREATE POLICY "Users can read own file objects"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'files' AND (
    auth.uid() = owner
    OR EXISTS (
      SELECT 1 FROM public.files f
      WHERE f.storage_path = storage.objects.name
        AND f.user_id = auth.uid()
        AND COALESCE(f.is_deleted, false) = false
    )
    OR (
      (storage.foldername(storage.objects.name))[1] = auth.uid()::text
      AND storage.objects.name LIKE '%/res54/%'
    )
  )
);

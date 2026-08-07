-- cloudbliss-api upload flow inserts folder_id/file_type into upload_sessions,
-- but the table never had those columns -> insert silently failed -> /upload/complete 404.
-- Align schema with the API contract.

ALTER TABLE public.upload_sessions
  ADD COLUMN IF NOT EXISTS folder_id UUID,
  ADD COLUMN IF NOT EXISTS file_type TEXT;
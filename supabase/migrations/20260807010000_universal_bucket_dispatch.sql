-- Universal bucket dispatch: /upload assigns each chunk to a bucket
-- (env-main bucket, admin bucket, or user/public bucket). /upload/complete
-- fetches staging chunks from the bucket they were uploaded to, re-encrypts,
-- and writes the encrypted chunks to the same bucket.

ALTER TABLE public.upload_sessions
  ADD COLUMN IF NOT EXISTS chunk_buckets jsonb;

-- Backfill only legacy API-uploaded files. Those chunks were written to the
-- env-main bucket ("BucketSQ1") and carry no clusterId. App-uploaded files
-- store a clusterId, so we leave them untouched (they resolve via clusterId).
-- tags is text[]; element 1 is a JSON string.
DO $$
BEGIN
  UPDATE public.files
  SET tags = ARRAY[
    jsonb_set(
      tags[1]::jsonb,
      '{chunks}',
      (
        SELECT jsonb_agg(
          CASE
            WHEN chunk.value ? 'bucket' OR chunk.value ? 'clusterId' THEN chunk.value
            WHEN chunk.value ->> 'repo' = 'b2' THEN chunk.value || jsonb_build_object('bucket', 'BucketSQ1')
            ELSE chunk.value
          END
        )
        FROM jsonb_array_elements(tags[1]::jsonb->'chunks') AS chunk
      ),
      true
    )::text
  ]
  WHERE storage_path = 'res54_distributed'
    AND encrypted = true
    AND tags IS NOT NULL
    AND jsonb_typeof(tags[1]::jsonb) = 'object'
    AND jsonb_typeof(tags[1]::jsonb->'chunks') = 'array';
END $$;
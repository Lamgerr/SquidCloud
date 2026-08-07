export const AI_AGENT_BASE_URL = 'https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api';

export const AI_AGENT_PROMPT = `You are integrating the CloudBliss API (SquidCloud) into an application. Follow these specs exactly — do not invent endpoints, query params, headers, or response fields. Everything documented here is verified working.

## Base URL
${AI_AGENT_BASE_URL}

## Authentication
Send EVERY request with header: X-SquidCloud-Key: <cb_... API key>
(Authorization: Bearer <key> also works). Keys are created in the CloudBliss dashboard under Developer API → API Keys, with scopes: read (download/list/stats), write (upload/rename/move), delete (delete files). Create keys with exactly the scopes your feature needs. A 401 means a missing or invalid key; a 403 means the key lacks the required scope or is disabled.

## Credits
Every JSON response includes: "credits": { "deducted": N, "remaining": N, "used_today": N, "daily_limit": N }. Deduction depends on the operation and bytes transferred (per-MB costs). A 402 response means insufficient credits — surface a friendly "out of credits" message.

## Upload flow (recommended — encryption is handled automatically)
1) POST /upload  body: { "name": "file.bin", "type": "application/octet-stream", "size": <exact byte length> }
   Response:
   {
     "upload_id": "uuid", "file_id": "uuid",
     "encryption_key": "<64 hex chars>",
     "urls": [ { "index": 0, "upload_url": "https://<signed B2 URL>", "path": "..." } ],
     "chunk_size": 524288, "total_chunks": N,
     "name": "file.bin", "type": "application/octet-stream", "size": 12345, "success": true
   }
   - chunk_size depends on file size (512KB under 10MB, 1MB 10–50MB, 2MB above). ALWAYS use the returned chunk_size — never hardcode it.
   - encryption_key is returned ONCE. Store it — the server only keeps a SHA-256 sentinel. You need it for client-side decryption via ?signed=true.
   - upload_urls are signed Backblaze B2 URLs, valid 24 hours.
2) Upload every chunk: PUT <upload_url> with the RAW BINARY bytes of the file slice [index * chunk_size, min((index + 1) * chunk_size, size)).
   Content-Type: application/octet-stream. Do NOT send JSON, do NOT base64-encode, do NOT re-sign the URLs.
3) POST /upload/complete  body: { "upload_id": "<uuid from /upload>" }
   The server verifies every chunk exists, re-encrypts them server-side (RES54 v2, AES-256-GCM), stores encrypted chunks on B2, deletes the plaintext staging chunks, and registers the file.
   Response: { "success": true, "file": { "id", "name", "type", "size", "created_at" }, "credits": {...} }
   Do not call complete before ALL chunks are uploaded — it returns an error if chunks are missing.

## Download flow
- Server-side (simplest, recommended for most apps): GET /download/<file_id>  → response BODY is the fully decrypted plaintext file (stream it to disk). Works for encrypted and unencrypted files alike.
- Client-side (signed): GET /download/<file_id>?signed=true → { "signed_urls": [<URL per encrypted chunk>], "file_name", "file_type", "file_size", "encryption_key": "<raw 64-hex>", "success", "credits" }
  Decrypt each chunk like this (RES54 v2):
  1) Fetch the signed URL as RAW BINARY bytes, then base64-encode them (the decryptor takes a base64 string).
  2) Read bytes 0–3 little-endian uint32 = header length. JSON header = { "version": 2, "chunks": N, "totalSize": <plaintext bytes>, "ivs": [ [12 byte values] x N ] }.
  3) After the header come N parts, each: [4B aadLen LE][aad bytes][4B encLen LE][AES-GCM ciphertext incl. 16-byte tag].
  4) AES key = UTF-8 bytes of encryption_key.slice(0, 32) — the FIRST 32 CHARACTERS of the hex key, nothing else. AES-256-GCM, iv = header.ivs[i], additionalData = the aad bytes, decrypt each part.
  5) Concatenate the N plaintext parts — total length must equal header.totalSize.
  Missing/changed headers that don't parse as v2 mean the chunk is corrupted or the wrong file was fetched — return a clear error rather than retrying with a broken parse.

## File operations
- GET /files?page=1&per_page=50 → { "files": [...], "folders": [...], "total_files", "total_folders", "page", "per_page", "success" }
- GET /files/<id>/metadata → file metadata and encryption info
- DELETE /files/<id> → soft delete (trash), requires delete scope
- GET /search?q=<query>&page=1&per_page=20 → search files and folders
- POST /batch/delete { "file_ids": [...] } (max 100) · POST /batch/move { "file_ids": [...], "folder_id": "..." } · POST /batch/copy { "file_ids": [...], "folder_id": "..." } · POST /batch/restore { "file_ids": [...] }

## Media streaming
- POST /stream/init { "file_id": "<id>" } → { "token", "stream_url", "expires_in": 120, "success" }
- GET /stream?id=<file_id>&token=<token> → server-side decrypting proxy; supports HTTP Range requests (seeking). Use it for video/audio playback.

## Account & stats
- GET /user (alias /whoami) → profile, storage usage, credits
- GET /stats/usage · GET /stats/credits?page=1&per_page=50 · GET /stats/storage
- GET /storage → { "storage_used", "file_count", "total_size", "success" }
- GET /keys → list your API keys
- POST /keys { "name": "...", "scopes": ["read","write","delete"] } → "raw_key" shown ONCE in the response — store it immediately.

## Error mapping (handle these exact HTTP codes)
- 400: invalid input or malformed encryption key format
- 401: missing or invalid API key
- 402: insufficient credits
- 403: key lacks scope / disabled / editor role required
- 404: file or upload session not found (session expires if never completed)
- 422: encryption key missing or wrong for an encrypted download
- 429: rate limit exceeded — retry with exponential backoff
- 503: API temporarily disabled (maintenance)

## Integration rules (violating these causes failures)
- Always use chunk_size from /upload; always PUT raw bytes; always complete with the upload_id from /upload.
- Never send file bytes inside JSON and never base64-encode uploads.
- Never derive the AES key from the whole encryption_key — only its first 32 characters.
- Save encryption_key (from /upload) and raw_key (from POST /keys) immediately — they are never returned again.
- Signed B2 URLs expire after 24h — if a download URL 403s with SignatureDoesNotMatch, re-initialize the operation instead of retrying the dead URL.
- Retry transient failures (429, 5xx, network) up to 3 times with backoff.
- Respect pagination (page, per_page) for list endpoints.

Implement the integration in my chosen language now.`;

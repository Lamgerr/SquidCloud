# SquidCloud CloudBliss API v4.0 — AI Agent Integration Guide

## Overview

CloudBliss API v4.0 is a credit-based file management API with encrypted media streaming. Every call deducts credits by operation type. Credits reset daily at midnight UTC.

**Base URL:** `https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api`

## Authentication

### API Key Header
All requests (except `/health`) require an API key:

```
X-SquidCloud-Key: <raw_api_key>
```

The key is verified via SHA-256(salt + raw_key). Prefix identifies the key; the full key is never stored.

### Optional HMAC Signing
If the key has `allow_hmac = true`, include:

```
X-Timestamp: <unix_ms>
X-Request-Nonce: <uuid>
X-Signature: HMAC-SHA256(timestamp + nonce + request_body, api_key)
```

### Encryption Key (for BYOK files)

```
X-SquidCloud-Encryption-Key: <user_key>
```

## Credit System

Every API response includes credit info when credits are deducted:

```json
{
  "credits": {
    "deducted": 1,
    "remaining": 842,
    "used_today": 158,
    "daily_limit": 1000
  }
}
```

### Guard Checks (in order)
1. **Global toggle** — `api_admin_config.api_globally_enabled` (503 if disabled)
2. **User disabled** — `profiles.api_disabled` (403)
3. **Key disabled** — `api_key_limits.is_disabled` (403)
4. **Subscription expired** — for non-free tiers via `check_subscription_validity` (402)

### Credit Deduction RPC
```sql
SELECT * FROM deduct_api_credits(
  p_user_id := 'uuid',
  p_api_key_id := 'uuid',
  p_operation := 'files.download',
  p_file_size := 1048576
);
```

## Endpoints

### Health
```http
GET /health
```
No auth required. Returns `{ status: "ok", version: "4.0", db: "connected" }`.

### Simple Upload (Recommended)

#### Initialize Upload
```http
POST /upload
Body: { "name": "file.mp4", "type": "video/mp4", "size": 10485760 }
Response: {
  "upload_id": "uuid",
  "file_id": "uuid",
  "encryption_key": "hex_string",
  "urls": [{ "index": 0, "path": "user/uploads/upload_id/0.bin", "upload_url": "https://..." }],
  "chunk_size": 1048576,
  "total_chunks": 10,
  "name": "file.mp4",
  "type": "video/mp4",
  "size": 10485760
}
```

Chunk size: 512KB (<10MB), 1MB (10-50MB), 2MB (>50MB). Server generates encryption key automatically.

#### Upload Chunks
PUT each chunk's data to its `upload_url`. Direct client-to-B2 upload.

#### Complete Upload
```http
POST /upload/complete
Body: { "upload_id": "uuid" }
Response: { "file": { "id", "name", "type", "size", "created_at" } }
```

Server verifies all chunks exist on B2, creates file record, cleans up session.

#### Upload with Server-Side Encryption
```http
POST /upload/encrypted
Body: {
  "name": "photo.jpg",
  "type": "image/jpeg",
  "size": 524288,
  "chunks": [{ "index": 0, "upload_url": "https://..." }]
}
```

Server downloads plaintext from upload URLs, encrypts with RES54 v2 format (AES-256-GCM), stores encrypted chunks on B2.

### Simple Download (Recommended)

#### Download File
```http
GET /download/:id
```

Server auto-detects encryption format, decrypts server-side, returns plaintext file. Supports all RES54 encryption formats (v2, legacy AAD, simple IV).

#### Download with Signed URLs
```http
GET /download/:id?signed=true
```

Returns signed B2 URLs for client-side decryption. Response:
```json
{
  "signed_urls": ["https://..."],
  "file_name": "file.mp4",
  "file_type": "video/mp4",
  "file_size": 10485760,
  "encryption_key": "hex_string"
}
```

#### BYOK Download
```http
GET /download/:id
Headers: X-SquidCloud-Encryption-Key: <user_key>
```

### Files (Legacy)

#### List Files
```http
GET /files?page=1&per_page=50&search=&folder_id=
```
Returns files + folders array with pagination.

#### File Metadata
```http
GET /files/:id/metadata
```

#### Download File
```http
GET /files/:id/download?signed=true
```
- `signed=true` → returns signed B2 URLs client-side
- Without `signed` → full server-side decrypt and stream
- BYOK files require `X-SquidCloud-Encryption-Key` header (422 if missing)

#### Initialize Upload (legacy)
```http
POST /files/upload/init
Body: { "name": "file.mp4", "type": "video/mp4", "size": 10485760 }
Response: { upload_id, urls: [{ index, upload_url, path }], chunk_size, total_chunks, encryption: { mode, key_required_for_complete } }
```

#### Complete Upload (legacy)
```http
POST /files/upload/complete
Body: { upload_id, file_id, chunks: [{ index, path, sha256 }] }
```

#### Soft Delete
```http
DELETE /files/:id
```

#### Restore
```http
POST /files/:id/restore
```

#### Rename
```http
PUT /files/:id/rename
Body: { "name": "new-name.pdf" }
```

#### Move
```http
POST /files/:id/move
Body: { "folder_id": "uuid" }
```

#### Copy
```http
POST /files/copy
Body: { "file_id": "uuid", "folder_id": "uuid", "new_name": "optional" }
```

### Media Streaming (Encrypted Server-Side Decrypt Proxy)

The streaming system provides encrypted media playback with server-side decryption. The client never holds the decryption key. Supports HTTP Range requests for seeking/scrubbing.

#### Initialize Stream Session
```http
POST /stream/init
Body: { "file_id": "uuid" }
Response: { token, stream_url, expires_in: 120 }
```

Returns a short-lived (120s) HMAC-signed session token scoped to the file and device.

**Token format:** `base64({fileId, userId, exp, deviceFingerprint, permissions}) + "." + hmac_signature`

#### Stream File
```http
GET /stream?id=<fileId>&token=<streamToken>
```
- Validates token (HMAC + expiry + file binding)
- Maps Range header to chunk boundaries
- Fetches encrypted chunks from B2
- Decrypts in-memory (AES-256-GCM, multi-format support)
- Streams decrypted bytes over TLS
- Returns 206 Partial Content with Content-Range headers

**Supported encryption formats:**
- v2: JSON header with chunk count + per-chunk IVs, followed by encrypted sub-chunks
- Legacy: 4-byte AAD length + AAD + 12-byte IV + ciphertext
- Simple: 12-byte IV + ciphertext

**Security properties:**
- Token is HMAC-signed, short-lived (120s), device-bound
- Decryption key never leaves the server
- Per-chunk AES-GCM encryption enables seeking without full-file decrypt
- No key on the wire — decrypted content exists only transiently in memory and over TLS

### Search

```http
GET /search?q=query&type=image&folder_id=uuid&page=1&per_page=20
```

### Batch Operations
All batch ops accept `{ file_ids: ["id1","id2"] }` with optional `folder_id`. Max 100 per batch.

```http
POST /batch/delete
POST /batch/move     Body: { file_ids, folder_id }
POST /batch/restore
POST /batch/copy     Body: { file_ids, folder_id }
```

### Stats

```http
GET /stats/usage
GET /stats/credits?page=1&per_page=50
GET /stats/storage
```

### Export

```http
GET /export/files?format=csv&folder_id=uuid
```

### API Key Management

```http
GET    /keys
POST   /keys            Body: { name, scopes: ["*"], expires_at }
PUT    /keys/:id        Body: { name, scopes, is_active }
DELETE /keys/:id
PUT    /keys/:id/limits Body: { custom_daily_limit, custom_rate_limit_rps }
```

### Storage

```http
GET /storage
Response: { storage_used, total_files, total_size }
```

### User / Whoami

```http
GET /user
GET /whoami
Response: { id, email, full_name, credits: { remaining, used_today, daily_limit } }
```

### Secrets (SquidVeil)

```http
GET    /secrets
POST   /secrets         Body: { name, value, storage: "database"|"res54" }
POST   /secrets/:name/verify Body: { value }
PATCH  /secrets/:id/rename   Body: { name }
DELETE /secrets/:id
```

### SquidShake (Ephemeral Sessions)

```http
POST /squidshake/handshake Body: { device_fingerprint, project_id, session_nonce }
POST /squidshake/ref       Body: { session_id, secret_name, device_fingerprint, ref_ttl, max_uses, ops_allowed }
POST /squidshake/audit     Body: { action, project_id, secret_name, ref_id, success, detail }
```

### VeilRef

```http
POST /veilref/verify  Body: { veil_ref_json }
POST /veilref/resolve Body: { veil_ref_json }
```

## Quick Reference: Upload Flow

### Simple (Recommended)
```
1. POST /upload → { upload_id, urls: [...] }
2. PUT each chunk to its upload_url
3. POST /upload/complete → { file: { id, name, ... } }
```

### Server-Side Encryption
```
1. POST /upload → { upload_id, urls: [...] }
2. PUT plaintext to upload_urls
3. POST /upload/encrypted → { file: { id, name, ... } }
```

### Legacy
```
1. POST /files/upload/init → { upload_id, urls: [...] }
2. PUT each chunk to its upload_url
3. POST /files/upload/complete → { file }
```

## Quick Reference: Download Flow

### Simple (Recommended)
```
GET /download/:id → decrypted file (plaintext)
GET /download/:id?signed=true → { signed_urls, encryption_key }
```

### Legacy
```
GET /files/:id/download → decrypted file
GET /files/:id/download?signed=true → { signed_urls }
```

## Streaming Integration (Player SDK)

### Simple Mode
Point `<video>` at the stream endpoint:
```html
<video controls src="https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api/stream?id=FILE_ID&token=STREAM_TOKEN"></video>
```

### Auto-Refresh Token Flow
```
1. POST /stream/init → get token (expires in 120s)
2. Set video src with token
3. Before token expires (e.g., at 100s), POST /stream/init again
4. Update video src with new token
5. Repeat
```

## Error Response Format

```json
{ "error": "message", "code": "ERROR_CODE", "success": false }
```

## Key Error Codes

| HTTP | Code | Meaning |
|------|------|---------|
| 401 | MISSING_API_KEY | No key header |
| 401 | INVALID_API_KEY | Key doesn't match hash |
| 401 | INVALID_SIGNATURE | HMAC validation failed |
| 401 | INVALID_TOKEN | Invalid or expired stream token |
| 403 | TOKEN_MISMATCH | Token doesn't match requested file |
| 402 | CREDIT_ERROR | Generic credit failure |
| 402 | INSUFFICIENT_CREDITS | Not enough credits |
| 402 | DAILY_LIMIT_EXCEEDED | Hit daily cap |
| 402 | SUBSCRIPTION_EXPIRED | Paid plan lapsed |
| 403 | USER_DISABLED | Account-level ban |
| 403 | KEY_DISABLED | Per-key ban |
| 503 | API_DISABLED | Global maintenance mode |
| 503 | HANDLER_ERROR | Route handler exception |

## Database Schema (relevant tables)

### `api_keys`
- `id`, `user_id`, `name`, `key_prefix`, `key_hash`, `key_salt`, `scopes`, `is_active`, `allow_hmac`, `request_timestamp_max_age`, `last_used_at`, `expires_at`, `created_at`

### `api_key_limits` (1:1 with api_keys)
- `api_key_id`, `custom_daily_limit`, `custom_rate_limit_rps`, `is_disabled`

### `api_credits` (1:1 with profiles)
- `user_id`, `credits_remaining`, `credits_used_today`, `daily_limit`, `last_reset_date`

### `api_credit_log`
- `id`, `user_id`, `api_key_id`, `operation`, `credits_deducted`, `file_size`, `created_at`

### `api_operation_costs`
- `id`, `operation`, `base_cost`, `per_mb`, `description`

### `api_admin_config`
- `id`, `key`, `value` (key-value: `api_globally_enabled`, `maintenance_message`, `api_credit_multiplier`)

### `upload_sessions`
- `id`, `upload_id` (unique), `encryption_key`, `user_id`, `file_name`, `file_size`, `total_chunks`, `created_at`, `expires_at` (24h TTL)

## Credit Reset

**Lazy reset:** On any API call, if `api_credits.last_reset_date < CURRENT_DATE`, credits are reset automatically. **Vercel cron** runs at 00:05 UTC as backup via `api/cron/reset-credits.js`.

## Troubleshooting

### 401 Unauthorized
1. Verify the key prefix matches `api_keys.key_prefix`
2. Ensure `api_keys.is_active = true`
3. Ensure `api_key_limits.is_disabled` is false or null
4. If using HMAC, verify timestamp is within ±5 minutes

### 401 Invalid Token (Stream)
1. Token may have expired (120s TTL) — call `POST /stream/init` for a new one
2. Token signature may be invalid — ensure HMAC verification passes
3. Token file_id doesn't match the requested file

### 402 Payment Required
1. Check `api_credits.credits_remaining > 0`
2. Check `api_credits.credits_used_today < api_credits.daily_limit`
3. If tier is non-free, verify subscription is active

### 403 Forbidden
1. Check `profiles.api_disabled` for the user
2. Check `api_key_limits.is_disabled` for the key
3. Check workspace role is at least viewer

### 503 Service Unavailable
1. Set `api_admin_config` key `api_globally_enabled` to `true`

### Stream Decryption Fails (422)
1. File uses BYOK — cannot stream via `/stream`, use `/download/:id` with encryption key
2. Encryption key mismatch — verify file's encryption key

### Upload Fails
1. Ensure file size matches `body.size` in `/upload`
2. Each chunk must be uploaded to its B2 signed URL via PUT
3. `/upload/complete` verifies chunks exist automatically — no SHA256 needed
4. Chunks must not exceed chunk_size from init response

## Rate Limiting

The Vercel proxy enforces:
- **200 requests per minute per IP** (sliding window)
- Timestamp validation (±5 min)

## File Storage

Files are stored using **RES54 distributed encryption**:
- File split into chunks (512KB–2MB)
- Each chunk AES-256-GCM encrypted with unique IV
- Encrypted chunks uploaded to B2 via signed URLs
- File metadata stored in `files.tags` as JSON
- During download/stream: chunks fetched from B2, decrypted in-memory, streamed over TLS

### RES54 v2 Encryption Format
```
[4-byte header length][JSON header][encrypted sub-chunks...]

JSON header: {
  "version": 2,
  "chunks": N,
  "ivs": ["base64_iv_1", "base64_iv_2", ...],
  "chunkSize": 65536
}
```

Each sub-chunk: AES-256-GCM(key, iv, plaintext)

## Function Architecture

The `cloudbliss-api` edge function is split into 3 files:

| File | Purpose |
|------|---------|
| `index.ts` | Entry point: CORS, auth, guards, routing, credit deduction, audit logging |
| `lib.ts` | Shared utilities: crypto, B2 client, workspace roles, secrets, stream tokens |
| `handlers.ts` | All API route handlers: files, stream, search, batch, stats, keys, secrets, etc. |

## Environment Variables

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
B2_ACCESS_KEY_ID
B2_SECRET_ACCESS_KEY
B2_ENDPOINT
B2_BUCKET_NAME
B2_REGION
STREAM_SESSION_SECRET (optional, falls back to SUPABASE_SERVICE_ROLE_KEY)
```

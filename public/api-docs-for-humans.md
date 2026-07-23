# SquidCloud CloudBliss API — User Guide

Welcome to the CloudBliss API! This guide helps you use our file management and encrypted media streaming API.

## Quick Start

### What You Need
1. **A SquidCloud account** — sign up at squidcloud.vercel.app
2. **An API key** — create one in your Developer Dashboard under "API Keys"
3. **The API address:**

```
https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api
```

### Your First Request
```bash
curl -H "X-SquidCloud-Key: YOUR_API_KEY" https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api/files
```

## Authentication

Every request needs an API key sent as a header:

```
X-SquidCloud-Key: your_api_key_here
```

For extra security (optional), enable HMAC signing in your key settings. This adds a digital signature to each request:
- `X-Timestamp` — current time in milliseconds
- `X-Request-Nonce` — a random ID for each request
- `X-Signature` — HMAC-SHA256 signature

If you use your own encryption key for files, send it as:
```
X-SquidCloud-Encryption-Key: your_encryption_key
```

## Credits

Each API call costs credits. Credits reset daily at midnight UTC.

Every response tells you:
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

## Working With Files

### List Your Files
```bash
curl -H "X-SquidCloud-Key: YOUR_KEY" https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api/files
```

### Upload a File (Simple)

**Step 1: Initialize** — send file metadata, get signed upload URLs:
```bash
curl -X POST -H "X-SquidCloud-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"video.mp4","type":"video/mp4","size":10485760}' \
  https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api/upload
```

Response:
```json
{
  "success": true,
  "upload_id": "abc-123",
  "file_id": "def-456",
  "encryption_key": "a1b2c3...",
  "urls": [
    {"index": 0, "path": "user/uploads/abc-123/0.bin", "upload_url": "https://..."}
  ],
  "chunk_size": 1048576,
  "total_chunks": 10
}
```

**Step 2: Upload each chunk** — PUT your file data to each `upload_url`:
```bash
# Split file into chunks, PUT each to its upload_url
curl -X PUT --upload-file chunk0.bin "https://signed-upload-url-0"
curl -X PUT --upload-file chunk1.bin "https://signed-upload-url-1"
# ... etc
```

**Step 3: Complete** — just send the upload_id:
```bash
curl -X POST -H "X-SquidCloud-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"upload_id":"abc-123"}' \
  https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api/upload/complete
```

That's it! The server verifies all chunks and registers your file.

### Upload with Server-Side Encryption

If you want the server to encrypt your file (you send plaintext, server encrypts):
```bash
# First get upload URLs
curl -X POST -H "X-SquidCloud-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"photo.jpg","type":"image/jpeg","size":524288}' \
  https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api/upload

# Then upload plaintext chunks to the URLs, then:
curl -X POST -H "X-SquidCloud-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"photo.jpg","type":"image/jpeg","size":524288,"chunks":[{"index":0,"upload_url":"..."}]}' \
  https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api/upload/encrypted
```

### Download a File (Simple)

```bash
curl -H "X-SquidCloud-Key: YOUR_KEY" \
  https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api/download/FILE_ID \
  -o myfile.pdf
```

The server auto-detects the encryption format and decrypts it for you. You get the plaintext file back.

Add `?signed=true` for direct B2 download URLs (client-side decryption):
```bash
curl -H "X-SquidCloud-Key: YOUR_KEY" \
  "https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api/download/FILE_ID?signed=true"
```

For BYOK (Bring Your Own Key) files:
```bash
curl -H "X-SquidCloud-Key: YOUR_KEY" \
  -H "X-SquidCloud-Encryption-Key: YOUR_KEY" \
  https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api/download/FILE_ID \
  -o myfile.pdf
```

## Encrypted Media Streaming

Stream encrypted video/audio with server-side decryption. The browser never holds the decryption key.

### How It Works
1. **Get a stream token** — short-lived (120s), scoped to one file
2. **Play the stream** — server decrypts on-the-fly, supports Range requests for seeking
3. **Token auto-refreshes** — player silently refreshes in the background

### Step 1: Get a Stream Token
```bash
curl -X POST -H "X-SquidCloud-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"file_id":"FILE_ID"}' \
  https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api/stream/init
```

Response:
```json
{
  "token": "eyJmaWxl...",
  "stream_url": "/stream?id=FILE_ID&token=eyJmaWxl...",
  "expires_in": 120,
  "success": true
}
```

### Step 2: Stream the File
```bash
curl -X GET "https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api/stream?id=FILE_ID&token=STREAM_TOKEN" -o -
```

### In HTML5 Video Player
```html
<video controls>
  <source src="https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api/stream?id=FILE_ID&token=STREAM_TOKEN" type="video/mp4">
</video>
```

**Security:** The token is HMAC-signed, short-lived, and device-bound. The decryption key never leaves the server. All chunks are decrypted in-memory and streamed over TLS.

## Searching Files
```bash
curl "https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api/search?q=document&page=1&per_page=20" \
  -H "X-SquidCloud-Key: YOUR_KEY"
```

## Batch Operations
Do things to multiple files at once (max 100):
```bash
curl -X POST -H "X-SquidCloud-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"file_ids":["ID1","ID2"]}' \
  https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api/batch/delete
```

Available: `delete`, `move`, `restore`, `copy`.

## Checking Your Stats
- **Credit usage:** `GET /stats/usage`
- **Credit history:** `GET /stats/credits?page=1&per_page=50`
- **Storage breakdown:** `GET /stats/storage`
- **Export file list:** `GET /export/files?format=csv`

## Managing API Keys
- **List:** `GET /keys`
- **Create:** `POST /keys` with `{"name":"My Key"}`
- **Update:** `PUT /keys/KEY_ID` with `{"name":"New Name"}`
- **Delete:** `DELETE /keys/KEY_ID`
- **Set limits:** `PUT /keys/KEY_ID/limits` with `{"custom_daily_limit":5000}`

**Important:** When you create a key, save the raw key immediately — we don't show it again.

## Secret Vault (SquidVeil)
Store sensitive information securely:
- **List secrets:** `GET /secrets`
- **Store:** `POST /secrets` with `{"name":"db-password","value":"s3cret!"}`
- **Verify:** `POST /secrets/my-secret/verify` with `{"value":"candidate"}`
- **Rename:** `PATCH /secrets/SECRET_ID/rename` with `{"name":"new-name"}`
- **Delete:** `DELETE /secrets/SECRET_ID`

## SquidShake & VeilRef (Advanced)
Ephemeral session protocol for secure device-bound secret sharing:
- **Handshake:** `POST /squidshake/handshake`
- **Issue VeilRef:** `POST /squidshake/ref`
- **Verify VeilRef:** `POST /veilref/verify`
- **Resolve VeilRef:** `POST /veilref/resolve`

## Error Codes

| Code | Meaning | What To Do |
|------|---------|------------|
| 200 | Success | All good! |
| 201 | Created | Upload or creation worked |
| 400 | Bad request | Check your input format |
| 401 | Unauthorized | Check your API key |
| 402 | Payment required | You need more credits |
| 403 | Forbidden | Key or account is disabled |
| 404 | Not found | File or resource doesn't exist |
| 409 | Conflict | Duplicate name |
| 422 | Encryption error | Wrong encryption key |
| 500 | Server error | Something broke on our end |
| 503 | Maintenance | API is temporarily down |

## Tips

1. **Keep your API key secret** — never share it or commit it to code
2. **Use simple upload** — `/upload` → upload chunks → `/upload/complete` is the easiest flow
3. **Use stream tokens for video** — encrypted streaming with server-side decryption
4. **Monitor your credits** — check `/stats/usage` regularly
5. **Set per-key limits** — prevent one key from using all your credits
6. **Use `?signed=true` for fast downloads** — client-side decryption with B2 URLs

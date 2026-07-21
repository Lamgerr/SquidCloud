# CloudBliss (SquidCloud) API — AI Agent Implementation Guide

> **Version:** 2.5  
> **Base URL:** `https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api`  
> **Last Updated:** 2026-07-19

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Core Concepts](#2-core-concepts)
3. [Endpoints Reference](#3-endpoints-reference)
   - [Files](#files-api)
   - [Storage](#storage-api)
   - [Keys](#keys-api)
   - [Secrets](#secrets-api)
   - [User](#user-api)
4. [Encryption Deep Dive](#4-encryption-deep-dive)
5. [Upload Flow (Step-by-Step)](#5-upload-flow-step-by-step)
6. [Download Flow (Step-by-Step)](#6-download-flow-step-by-step)
7. [Error Handling](#7-error-handling)
8. [Complete Code Examples](#8-complete-code-examples)
9. [Common Pitfalls](#9-common-pitfalls)

---

## 1. Authentication

Every request requires **two** headers:

```
Authorization: Bearer <SUPABASE_ANON_KEY>
x-squidcloud-key: <CLOUDBLISS_API_KEY>
```

**How it works:**
- `Authorization` header: Standard Supabase anon JWT (used by the edge function runtime to identify the project).
- `x-squidcloud-key`: Your CloudBliss API key. This is a `cb_` prefixed key generated in the app's Settings > API Keys. The server hashes it with a per-key salt and looks it up in the `api_keys` table.

**If you only have the anon key:** You cannot call the API. You must generate a CloudBliss API key first.

**Workspace scoping:** Append `?workspace_id=<uuid>` to any `/files` or `/storage` call to scope it to a specific workspace. If omitted, the default workspace is used.

---

## 2. Core Concepts

| Concept | Description |
|---------|-------------|
| **Workspace** | Every user has a default workspace. Files and folders belong to a workspace. Pass `?workspace_id=<uuid>` to scope. |
| **RES54 Encryption** | All files are encrypted client-side (or server-side via API) with AES-256-GCM. Chunks are stored as raw binary on Backblaze B2. |
| **Chunks** | Files are split into chunks (512KB–2MB depending on file size). Each chunk is encrypted independently and stored at `<userId>/<chunkId>.bin` on B2. |
| **BYOK** | "Bring Your Own Key" — the caller provides their own encryption key. The server stores `sha256:byok_encrypted` as a marker; the real key is never stored. |
| **Encryption Key** | A 64-character hex string (32 bytes). Generated server-side if not provided. Returned in the upload response — **you must store it** to download later. |
| **Chunk Metadata** | Stored in the `tags[0]` JSON field of the `files` table. Contains chunk paths, sizes, offsets, and the encryption key. |
| **Workspace Roles** | `viewer` (read), `editor` (upload/delete own), `admin` (delete any), `owner` (full control). Checked via RPC `get_workspace_role`. |

---

## 3. Endpoints Reference

### Base Response Format

All endpoints return JSON with a `success` boolean:

```json
{ "success": true, ... }   // 200/201
{ "success": false, "error": "message", "code": 400 }  // 4xx/5xx
```

---

### Files API

#### `GET /files`
List all files and folders in the workspace.

**Response:**
```json
{
  "success": true,
  "files": [ { "id": "uuid", "name": "photo.jpg", "type": "image/jpeg", "size": 1048576, ... } ],
  "folders": [ { "id": "uuid", "name": "Documents", ... } ],
  "total_files": 1,
  "total_folders": 1
}
```

#### `GET /files/<fileId>/metadata`
Get full metadata for a single file (including encryption info in `tags`).

**Response:**
```json
{
  "success": true,
  "file": {
    "id": "uuid",
    "name": "photo.jpg",
    "type": "image/jpeg",
    "size": 1048576,
    "storage_path": "res54_distributed",
    "encrypted": true,
    "encryption_key": "sha256:<hex>",
    "tags": ["{ \"fileName\": ..., \"chunks\": [...], \"encryptionKey\": \"<hex>\" }"],
    "workspace_id": "uuid"
  }
}
```

#### `GET /files/<fileId>/download?encryption_key=<hex>`
Download and decrypt a file. Returns raw binary file content with appropriate `Content-Type`.

**Query Parameter:**
- `encryption_key` (optional but required for BYOK files): The 64-char hex encryption key.

**Headers:**
- `x-squidcloud-encryption-key` OR `x-encryption-key` can替代 the query param.

**Response:** Raw binary file with headers:
```
Content-Type: <file's MIME type>
Content-Disposition: attachment; filename="<filename>"
```

**Error responses:**
- `422` — BYOK file without key, or wrong key (decryption fails)
- `404` — File not found or chunk missing from B2
- `500` — Decryption error or chunk processing failure

#### `POST /files/upload`
Upload a file. Encrypted and stored on B2. **No vault required.**

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | The file to upload |
| `folderId` | string | No | Parent folder UUID |
| `encryption_key` | string | No | Your own 64-char hex key (BYOK). If omitted, server generates one. |
| `x-squidcloud-encryption-key` | header | No | Alternative to form field for BYOK |

**Response (201):**
```json
{
  "success": true,
  "file": { "id": "uuid", "name": "photo.jpg", ... },
  "message": "File uploaded and encrypted successfully",
  "encryption": {
    "mode": "generated",
    "key_required_for_download": true
  }
}
```

**Critical:** Save the `encryption_key` from the file record's `tags[0].encryptionKey` or `encryption_key` field. You need it to download.

#### `DELETE /files/<fileId>`
Soft-delete a file (sets `is_deleted = true`). Requires `editor` role.

**Response:**
```json
{ "success": true, "message": "File deleted successfully" }
```

---

### Storage API

#### `GET /storage`
Get storage usage stats for the workspace.

**Response:**
```json
{
  "success": true,
  "storage_used": 104857600,
  "total_files": 42,
  "total_size": 104857600
}
```

---

### Keys API

#### `GET /keys`
List all API keys for the user.

**Response:**
```json
{
  "success": true,
  "keys": [
    {
      "id": "uuid",
      "name": "My Key",
      "key_prefix": "cb_abc1",
      "scopes": ["files:read", "files:write"],
      "created_at": "2026-01-01T00:00:00Z",
      "last_used_at": "2026-07-19T10:00:00Z",
      "is_active": true
    }
  ]
}
```

---

### Secrets API

Encrypted secret storage. Secrets are encrypted with a key derived from your API key.

#### `GET /secrets`
List all secrets (metadata only, no values).

**Response:**
```json
{
  "success": true,
  "secrets": [
    { "id": "uuid", "name": "DATABASE_URL", "scope": null, "storage_type": "database", "created_at": "..." }
  ]
}
```

#### `POST /secrets`
Create a new secret.

**Request Body:**
```json
{
  "name": "DATABASE_URL",
  "value": "postgresql://user:pass@host/db",
  "storage": "database"
}
```

`storage` options:
- `"database"` (default) — encrypted value stored in `squid_vault_secrets` table
- `"res54"` — encrypted value stored as a chunk on B2 (same as files)

**Response (201):**
```json
{ "success": true, "secret": { "id": "uuid", "name": "DATABASE_URL", "storage_type": "database" } }
```

#### `POST /secrets/<name>/verify`
Verify a secret value matches.

**Request Body:**
```json
{ "value": "postgresql://user:pass@host/db" }
```

**Response:**
```json
{ "success": true, "matched": true }
```

#### `PATCH /secrets/<id>/rename`
Rename a secret.

**Request Body:**
```json
{ "name": "NEW_NAME" }
```

#### `DELETE /secrets/<id>`
Delete a secret.

---

### User API

#### `GET /user` or `GET /whoami`
Get current user profile.

**Response:**
```json
{
  "success": true,
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "John Doe",
  "created_at": "2026-01-01T00:00:00Z",
  "storage_used": 104857600
}
```

---

## 4. Encryption Deep Dive

### Algorithm
- **AES-256-GCM** with 12-byte random IV
- Key: 64-char hex string (32 bytes)

### Wire Format (V2 — what the API uses)

```
[4 bytes: AAD length, little-endian]
[AAD bytes: "res54-v2-<timestamp>"]
[12 bytes: IV]
[remaining: AES-256-GCM ciphertext + auth tag]
```

This entire binary blob is then base64-encoded for storage.

### Key Derivation

The hex key is converted to bytes by taking the first 32 characters, encoding as UTF-8, and padding with `'0'` to exactly 32 bytes:

```
keyBytes = TextEncoder.encode(key.slice(0, 32).padEnd(32, '0'))
```

### AAD (Additional Authenticated Data)

Format: `res54-v2-<Date.now()>`  
Purpose: Ensures the ciphertext is bound to a specific time context. Different per-chunk.

### Key Generation (Server-Side)

If no BYOK key is provided, the server generates one:
```
crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
→ exportKey('raw') → hex string
```

---

## 5. Upload Flow (Step-by-Step)

```
┌──────────────┐     POST /files/upload      ┌──────────────┐
│   Your App   │ ──────────────────────────▶  │  cloudbliss  │
│              │   multipart/form-data        │     -api     │
│              │   file= <binary>             │              │
│              │                              │  1. Parse    │
│              │                              │  2. Split    │
│              │                              │     chunks   │
│              │                              │  3. Encrypt  │
│              │                              │     each     │
│              │                              │  4. PUT to   │
│              │                              │     B2       │
│              │                              │  5. INSERT   │
│              │                              │     to DB    │
│              │  ◀────────────────────────── │              │
│              │   { file, encryption }       │              │
└──────────────┘                              └──────────────┘
```

### What the server does internally:

1. **Parse** the multipart form to extract the file
2. **Split** into chunks: 512KB (< 10MB), 1MB (10-50MB), 2MB (> 50MB)
3. **Encrypt** each chunk with AES-256-GCM (V2 format)
4. **Upload** each chunk as raw binary to B2 at path `<userId>/<chunkId>.bin`
5. **Store** metadata in `files` table:
   - `storage_path`: `"res54_distributed"`
   - `encrypted`: `true`
   - `encryption_key`: hex key or `"sha256:byok_encrypted"`
   - `tags[0]`: JSON string containing chunk paths, sizes, offsets, encryption key

### Client-Side Upload (Alternative)

Instead of using `POST /files/upload`, you can:
1. Call `github-storage` with `action: 'get-upload-urls'` to get signed B2 PUT URLs
2. Encrypt chunks yourself (V2 format)
3. PUT raw binary directly to B2 signed URLs
4. Insert the file record yourself

This is what the web frontend does. The chunk format is identical: raw binary V2-encrypted data at `<userId>/<chunkId>.bin`.

---

## 6. Download Flow (Step-by-Step)

```
┌──────────────┐   GET /files/<id>/download   ┌──────────────┐
│   Your App   │ ──────────────────────────▶  │  cloudbliss  │
│              │   ?encryption_key=<hex>       │     -api     │
│              │                              │              │
│              │  1. Fetch file record        │              │
│              │  2. Parse tags[0] metadata   │              │
│              │  3. For each chunk:          │              │
│              │     a. GET signed URL from B2│              │
│              │     b. Fetch raw binary      │              │
│              │     c. Decrypt with key      │              │
│              │  4. Concatenate chunks       │              │
│              │  ◀────────────────────────── │              │
│              │   Raw binary file            │              │
└──────────────┘                              └──────────────┘
```

### What the server does internally:

1. **Fetch** file record from `files` table
2. **Parse** `tags[0]` JSON to get chunk metadata (paths, encryption key)
3. **Determine** if BYOK (key needed from caller) or server-generated (key in metadata)
4. **For each chunk:**
   - Generate a signed GET URL for B2
   - Fetch the raw binary from B2
   - Detect format: try JSON parse first (legacy), fallback to raw binary
   - Decrypt with AES-256-GCM using the V2 wire format
5. **Concatenate** all decrypted chunks into a single `ArrayBuffer`
6. **Return** as raw binary response with `Content-Type` and `Content-Disposition` headers

---

## 7. Error Handling

| Status | Meaning | Common Cause |
|--------|---------|--------------|
| `200` | Success | — |
| `201` | Created | Upload successful |
| `400` | Bad Request | Missing file, invalid params |
| `401` | Unauthorized | Missing/invalid API key |
| `403` | Forbidden | Insufficient workspace role |
| `404` | Not Found | File doesn't exist, chunk missing from B2 |
| `409` | Conflict | Duplicate secret name |
| `422` | Unprocessable | BYOK key missing, or wrong key (decryption fails) |
| `500` | Server Error | B2 upload/download failure, DB error |

### Decryption Error Messages

- `"Provided encryption key mismatch. Unable to decrypt file."` — Wrong key
- `"This file uses Bring Your Own Key (BYOK). Provide the encryption key via encryption_key parameter."` — BYOK file without key
- `"Empty content from storage for chunk N"` — Chunk missing from B2
- `"B2 download failed (403)"` — B2 signed URL expired or invalid

---

## 8. Complete Code Examples

### Example: Upload a file (Node.js / TypeScript)

```typescript
const BASE_URL = 'https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api';
const ANON_KEY = 'eyJ...'; // Supabase anon key
const API_KEY = 'cb_...';  // CloudBliss API key

async function uploadFile(filePath: string) {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));

  const res = await fetch(`${BASE_URL}/files/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'x-squidcloud-key': API_KEY,
    },
    body: formData,
  });

  const data = await res.json();
  if (!data.success) throw new Error(data.error);

  // IMPORTANT: Save this key! You need it to download.
  const encryptionKey = data.file.encryption_key;
  console.log('File ID:', data.file.id);
  console.log('Encryption Key:', encryptionKey);

  return { fileId: data.file.id, encryptionKey };
}
```

### Example: Upload with BYOK (your own key)

```typescript
const crypto = require('crypto');

// Generate a 64-char hex key (32 bytes)
const myKey = crypto.randomBytes(32).toString('hex');

const formData = new FormData();
formData.append('file', fileBlob);
formData.append('encryption_key', myKey);

const res = await fetch(`${BASE_URL}/files/upload`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ANON_KEY}`,
    'x-squidcloud-key': API_KEY,
  },
  body: formData,
});
```

### Example: Download a file (Node.js / TypeScript)

```typescript
async function downloadFile(fileId: string, encryptionKey: string) {
  const res = await fetch(
    `${BASE_URL}/files/${fileId}/download?encryption_key=${encryptionKey}`,
    {
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'x-squidcloud-key': API_KEY,
      },
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error);
  }

  const buffer = await res.arrayBuffer();
  fs.writeFileSync('downloaded-file', Buffer.from(buffer));
}
```

### Example: List files

```typescript
async function listFiles() {
  const res = await fetch(`${BASE_URL}/files`, {
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'x-squidcloud-key': API_KEY,
    },
  });

  const data = await res.json();
  console.log(`Found ${data.total_files} files`);

  for (const file of data.files) {
    console.log(`- ${file.name} (${file.size} bytes, ${file.type})`);
  }
}
```

### Example: Store and retrieve a secret

```typescript
// Store
await fetch(`${BASE_URL}/secrets`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ANON_KEY}`,
    'x-squidcloud-key': API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'API_TOKEN',
    value: 'sk-abc123...',
    storage: 'database',
  }),
});

// Verify
const verifyRes = await fetch(`${BASE_URL}/secrets/API_TOKEN/verify`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ANON_KEY}`,
    'x-squidcloud-key': API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ value: 'sk-abc123...' }),
});
const { matched } = await verifyRes.json(); // true
```

### Example: Get storage usage

```typescript
const res = await fetch(`${BASE_URL}/storage`, {
  headers: {
    'Authorization': `Bearer ${ANON_KEY}`,
    'x-squidcloud-key': API_KEY,
  },
});
const { storage_used, total_files } = await res.json();
```

---

## 9. Common Pitfalls

### 1. Losing the encryption key
The encryption key is **never stored in plaintext** on the server for BYOK files. If you lose it, the file is unrecoverable. For server-generated keys, it's stored in `tags[0].encryptionKey` and `encryption_key` field — always fetch it from the metadata after upload.

### 2. Wrong Content-Type on upload
Always use `multipart/form-data` for file upload. Do NOT send raw binary with `Content-Type: application/octet-stream` to `/files/upload`.

### 3. Mixing encryption versions
The API uses **V2 encryption only** (`res54-v2-{timestamp}` AAD). The web frontend can also use V3 (HKDF-based). Files uploaded via the API use V2. Files uploaded via the web frontend may use V3. The download endpoint handles both.

### 4. Chunk format mismatch
Chunks on B2 are stored as **raw binary V2-encrypted data** (not JSON). If you're implementing client-side chunk upload, upload the raw `ArrayBuffer` from the encrypt function — do NOT wrap it in JSON.

### 5. Workspace scoping
All `/files` and `/storage` calls are scoped to a workspace. If you get empty results, check that you're passing the correct `?workspace_id=<uuid>`.

### 6. BYOK detection
A file is BYOK if any of these are true:
- `file.encryption_key === 'sha256:byok_encrypted'`
- `metadata.encryptionKey === 'sha256:byok_encrypted'`
- `metadata.encryptionKey === 'byok_encrypted'`
- `metadata.encryptionKey === 'byok_protected'`
- `metadata.encryptionKey` is null or empty

### 7. Multipart form field name
The file field MUST be named `file` (not `upload`, not `data`).

### 8. Key format
Encryption keys are **64-character lowercase hex strings** (32 bytes). Example:
```
a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
```
Do NOT include `0x` prefix. Do NOT use base64.

### 9. Resumability
The upload is NOT resumable. If it fails partway, you may have orphaned chunks on B2. Re-upload the entire file. Orphaned chunks are eventually cleaned up.

### 10. File size limits
No hard limit enforced by the API, but:
- Files > 128MB will use 2MB chunks (many chunks = slow download)
- B2 has a 5GB per-object limit
- Edge function timeout is ~30 seconds per invocation

---

## Appendix: HTTP Headers Cheat Sheet

### Upload Request
```http
POST /functions/v1/cloudbliss-api/files/upload HTTP/1.1
Host: aouqcwbdoyrccjcrhzzi.supabase.co
Authorization: Bearer <ANON_KEY>
x-squidcloud-key: <API_KEY>
Content-Type: multipart/form-data; boundary=...

--boundary
Content-Disposition: form-data; name="file"; filename="photo.jpg"
Content-Type: image/jpeg

<binary data>
--boundary--
```

### Download Request
```http
GET /functions/v1/cloudbliss-api/files/<FILE_ID>/download?encryption_key=<KEY> HTTP/1.1
Host: aouqcwbdoyrccjcrhzzi.supabase.co
Authorization: Bearer <ANON_KEY>
x-squidcloud-key: <API_KEY>
```

### Download Response
```http
HTTP/1.1 200 OK
Content-Type: image/jpeg
Content-Disposition: attachment; filename="photo.jpg"
Access-Control-Allow-Origin: *

<binary data>
```

# SquidCloud Complete Architecture & Operations Reference

> **Generated**: 2026-06-02
> **Scope**: Full-stack analysis of ~49 edge functions, 3 variant storage pipelines, KZA security layer, frontend, and infrastructure.
> **Status**: Based on v10-DecaKe codebase

---

# TABLE OF CONTENTS

1. [HIGH-LEVEL ARCHITECTURE](#1-high-level-architecture)
2. [RES54 ENCRYPTION PIPELINE](#2-res54-encryption-pipeline)
3. [UPLOAD FLOW](#3-upload-flow)
4. [DOWNLOAD FLOW](#4-download-flow)
5. [STREAMING VIDEO FLOW](#5-streaming-video-flow)
6. [KZA SECURITY LAYER](#6-kza-security-layer)
7. [EDGE FUNCTIONS CATALOG](#7-edge-functions-catalog)
8. [DATABASE SCHEMA (INFERRED)](#8-database-schema-inferred)
9. [FRONTEND COMPONENT MAP](#9-frontend-component-map)
10. [SERVICES & INFRASTRUCTURE](#10-services--infrastructure)
11. [CRITICAL ISSUES & LOOPHOLES](#11-critical-issues--loopholes)
12. [PERFORMANCE BOTTLENECKS](#12-performance-bottlenecks)
13. [CODE QUALITY CONCERNS](#13-code-quality-concerns)
14. [ARCHITECTURAL RECOMMENDATIONS](#14-architectural-recommendations)

---

# 1. HIGH-LEVEL ARCHITECTURE

## 1.1 System Overview

SquidCloud is a zero-knowledge, encrypted, distributed file storage platform. Users upload files that are:
1. **AES-256-GCM encrypted** in the browser (client-side)
2. **Split into chunks** (1.5-2.5MB each)
3. **Stored across GitHub repositories** (as base64-encoded JSON blobs in private repos)
4. **Indexed in Supabase** (Postgres) for metadata

The system uses **Supabase Edge Functions** (Deno) as middleware for GitHub API proxying, security scanning, and file operations.

## 1.2 Deployment Topology

```
[Browser] ←→ [Vercel (Frontend)]
               ↓
         [Supabase]
            ├── Auth (JWT)
            ├── Postgres (Supabase DB)
            ├── Edge Functions (Deno)
            │    ├── github-storage (GitHub API proxy)
            │    ├── github-cluster (node selection)
            │    ├── cloudbliss-api (REST gateway)
            │    ├── kza-* (security layer)
            │    └── 40+ others
            └── Realtime (WebSocket)
               ↓
         [GitHub API]
            ├── User Repo 1 (account 1)
            ├── User Repo 2 (account 2)  [if multi-node]
            └── User Repo 3 (account 3)  [if multi-node]
```

## 1.3 Three Storage Backends (Paradoxical Over-Engineering)

The codebase contains **three separate, parallel implementations** of the same storage pipeline:

| Variant | File | Lines | Storage Backend | Active? |
|---------|------|-------|-----------------|---------|
| res54.ts | `src/lib/res54.ts` | 1714 | GitHub repos (cluster) | Primary |
| res54-r2.ts | `src/lib/res54-r2.ts` | 1684 | GitHub repos via GitHub API | Redundant |
| res54-r2-pipeline.ts | `src/lib/res54-r2-pipeline.ts` | 1410 | Cloudflare R2 presigned URLs | Experimental |

**~80% code duplication** across all three. The download flows are nearly identical but have subtle parameter/order differences (especially BYOK key resolution logic). This is the single largest maintenance liability in the codebase.

## 1.4 Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend Framework | React 18 + TypeScript + Vite |
| UI Components | shadcn/ui (Radix primitives) |
| Styling | Tailwind CSS v3 |
| Mobile | Capacitor (Android + Electron) |
| Backend | Supabase (Postgres + Auth + Edge Functions) |
| Edge Functions | Deno (TypeScript) |
| Storage Backend | GitHub API (private repos) |
| Security Layer | KZA (proprietary threat detection) |
| State Management | React contexts + hooks |
| Build | Vite + tsc |
| CI/CD | GitHub Actions + Vercel Deploy |

---

# 2. RES54 ENCRYPTION PIPELINE

## 2.1 Encryption Algorithm

```
Algorithm: AES-256-GCM (Galois/Counter Mode)
Key Derivation: key.slice(0, 32).padEnd(32, '0')  ← NO PBKDF2/Argon2
IV: 12 random bytes (crypto.getRandomValues)
Additional Data (AEAD): TextEncoder.encode(`res54-v2-${Date.now()}`)
Output Format: [4-byte AD length][AD bytes][12-byte IV][ciphertext]
Key Generation: CryptoJS.lib.WordArray.random(32).toString() (64-char hex)
```

### 2.1.1 Security Analysis of Encryption

| Property | Actual Implementation | Issue |
|----------|---------------------|-------|
| Key derivation | Direct truncation/padding | **Weak**: `"short".padEnd(32, '0')` → only 5 bytes of entropy for a 32-byte key |
| IV randomness | `crypto.getRandomValues(new Uint8Array(12))` | Secure |
| AEAD | Timestamp-based `Date.now()` | **Predictable**: attacker who knows the upload time knows the AD |
| Key storage | In `file.encryption_key` column + `file.tags` JSON | **Stored in plaintext** in DB |
| Key transmission | Over HTTPS in request body / query params | Leaks in server logs (query params) |
| Worker keys | Passed via `postMessage` to Web Workers | **Visible in Worker messages** |

### 2.1.2 Large File Encryption (files > threshold)

```javascript
// Pseudo-code of encryptLargeData
for each 10MB sub-chunk:
    iv = crypto.getRandomValues(12)
    ad = `res54-v2-${Date.now()}`  // Same AD for all sub-chunks!
    ciphertext = AES-256-GCM.encrypt(data, key, iv, ad)
    // Store per-sub-chunk IV for decryption
```

**Bug**: All sub-chunks use the same AEAD additional data (same millisecond timestamp). AEAD uniqueness is important for GCM security — reusing AD across sub-chunks weakens the authentication guarantees.

### 2.1.3 Legacy Fallback

```javascript
try {
    // AEAD format
    decryptAead(data, key)
} catch {
    // Legacy format: [12-byte IV][ciphertext]
    decryptLegacy(data, key)
}
```

The legacy fallback silently accepts unauthenticated ciphertext. If the AEAD parsing fails for any reason, it falls back to raw AES-GCM with **no authentication tag verification**. An attacker who corrupts the first 4 bytes of a chunk can force the older, weaker mode.

## 2.2 Web Worker Encryption Pool

```
Pool size: 4 workers (WORKER_POOL_SIZE)
Distribution: chunkIndex % poolSize
Timeout: 60 seconds per chunk
Lifecycle: Created on demand, terminated after upload, never reused
```

**Race Condition**: `encryptionWorkers` array is a **global module-level variable**. Multiple simultaneous `uploadFileWithRes54()` calls would share and corrupt the same pool.

## 2.3 Chunk Format (v2.3)

```json
{
  "v": "2.3",        // Version
  "i": 0,            // Chunk index
  "t": 10,           // Total chunks
  "d": "<base64>"    // Encrypted chunk data
}
```

**Old format** (legacy, still supported by download parser):
```json
{
  "chunkIndex": 0,
  "totalChunks": 10,
  "fileName": "...",
  "fileType": "...",
  "fileSize": 123,
  "chunkData": "<base64>"
}
```

---

# 3. UPLOAD FLOW

## 3.1 Full Upload Pipeline

```
User selects file
    ↓
1. Auth check (supabase.auth.getUser)
    ↓
2. Cluster info fetch (github-cluster → get-cluster-info)
    ↓
3. BYOK policy check (db lookup)
    │
    ├── BYOK enabled → prompt user for encryption key
    └── BYOK disabled → generateEncryptionKey() (random 32-byte hex)
    ↓
4. File chunking (adaptive size based on file size)
    │   <10MB  → 1.5MB chunks
    │   10-100MB → 2MB chunks
    │   100-500MB → 2.5MB chunks
    │   >500MB → 2MB chunks
    ↓
5. Encryption (Web Worker pool, 4 workers)
    ↓
6. Cluster node selection (per chunk, via github-cluster → select-node)
    │   Returns: { repoName, accountId, nodeId, username }
    ↓
7. Binary upload to github-storage
    │   POST /functions/v1/github-storage
    │   Content-Type: application/octet-stream
    │   Headers: X-Upload-*, Authorization
    │   Body: raw encrypted ArrayBuffer
    ↓
8. File metadata creation (secure-file-metadata edge function)
    │   Stores: file record in `files` table
    │   Stores: encryption key (plaintext!) in file record
    ↓
9. KZA Sentinel check (embedded in github-storage)
```

### 3.1.1 Adaptive Chunking

```javascript
// res54.ts:determineChunkingStrategy
function determineChunkingStrategy(fileSize) {
    if (fileSize < 10 * 1024 * 1024)
        return { chunkSize: 1.5 * 1024 * 1024, label: 'SMALL' };
    if (fileSize < 100 * 1024 * 1024)
        return { chunkSize: 2 * 1024 * 1024, label: 'MEDIUM' };
    if (fileSize < 500 * 1024 * 1024)
        return { chunkSize: 2.5 * 1024 * 1024, label: 'LARGE' };
    return { chunkSize: 2 * 1024 * 1024 * 1024, label: 'XLARGE' };
}
```

**Bug**: XLARGE returns `2 * 1024 * 1024 * 1024` = 2GB chunks, not 2MB. The calculation uses `(2 * 1024 * 1024 * 1024)` bytes → 2 **giga**bytes per chunk.

### 3.1.2 Binary Upload Protocol

The client sends raw encrypted binary to `github-storage` edge function:

```
POST https://<project>.supabase.co/functions/v1/github-storage
Authorization: Bearer <user-jwt>
Content-Type: application/octet-stream
X-Upload-FileName: res54_<timestamp>_<random>_<index>.json
X-Upload-Path: <userId>/res54_<timestamp>_<random>_<index>.json
X-Upload-Repo: SquidCloud_<random>
X-Upload-NodeId: <1-based-node-id>
X-Upload-UserId: <userId>
X-Upload-ChunkIndex: <index>
X-Upload-TotalChunks: <total>
Body: <raw encrypted ArrayBuffer bytes>
```

The edge function:
1. Receives raw binary → `req.arrayBuffer()`
2. Base64-encodes it: `btoa(String.fromCharCode(...))`
3. Wraps in `{v: '2.3', i, t, d}` JSON
4. Base64-encodes the wrapper
5. PUTs to `https://api.github.com/repos/<username>/<repo>/contents/<path>`

### 3.1.3 Node Selection (github-cluster)

The cluster function:
```
Query: SELECT * FROM repositories WHERE user_id = $1 AND status->>'healthy' = 'true'
Random selection: repos[Math.floor(Math.random() * repos.length)]
Node mapping: repo.account_id → cluster.nodes[repo.account_id - 1]
Response: { nodeId: node.id (1-based), accountId: node.id, repoName: repo.repo_name }
```

**The nodeId returned is 1-based** (1, 2, or 3). This conflicts with the 0-based `githubNodes[]` array in `github-storage`.

### 3.1.4 Known Bug: NodeId Off-by-One

The binary upload sends `X-Upload-NodeId` as 1-based (from cluster), but `github-storage` uses it as a 0-based array index into `githubNodes[]`:

```javascript
// github-storage upload handler (line 392-394)
let selectedNode = githubNodes[0]; // Default to first node
if (nodeId !== undefined && nodeId >= 0 && nodeId < githubNodes.length) {
    selectedNode = githubNodes[nodeId]; // nodeId=1 → githubNodes[1] = SECOND node!
}
```

With **multi-node config** (GITHUB_TOKEN_2, GITHUB_TOKEN_3 set):
- Upload: nodeId=1 → uses githubNodes[1] (second account) → writes to wrong account → 404
- Download: nodeId=0 (accountId-1) → uses githubNodes[0] (first account) → reads from first account → correct

**This causes upload failures on multi-node installs.** With single-node config (only GITHUB_TOKEN), the bug is masked because `githubNodes.length = 1` and the condition `nodeId >= 0 && nodeId < 1` is false for nodeId=1, so it always uses `githubNodes[0]`.

### 3.1.5 SHA-256 Integrity Hash

For files < 100MB, a SHA-256 hash is computed client-side before upload:

```javascript
if (file.size <= 100 * 1024 * 1024) {
    hash = await sha256(file);
    metadata.sha = hash; // Stored but NEVER verified on download!
}
```

For files > 100MB, the SHA-256 is explicitly skipped:
```javascript
// Skip expensive integrity hash for large files to reduce UI freezing
```

**The SHA-256 hash is computed but never verified during download** — it's stored in metadata but never checked before file assembly. This means:
- Silent data corruption is undetectable
- An attacker who modifies chunks in GitHub repos won't be detected
- The hash computation is wasted CPU

## 3.2 Upload Flow Diagram (res54.ts)

```
uploadFileWithRes54(file)
    │
    ├── supabase.auth.getUser()
    ├── github-cluster: get-cluster-info
    ├── BYOK policy check
    │
    ├── [< 100MB] Standard Upload
    │   ├── file.arrayBuffer() → chunks[]
    │   ├── processChunksInParallel(encrypt, 4 workers)
    │   ├── for each chunk:
    │   │   ├── github-cluster: select-node → {repoName, nodeId, ...}
    │   │   └── uploadChunkBinary(chunk)
    │   └── create file metadata (secure-file-metadata)
    │
    └── [> 100MB] Streaming Upload
        ├── for each batch of 6 chunks:
        │   ├── read batch from file
        │   ├── encrypt batch
        │   ├── select nodes for batch
        │   └── upload batch
        └── create file metadata
```

### 3.2.1 Upload Retry Chain

```
uploadChunkBinary(chunk, attempt=0)
    while attempt < MAX_RETRIES (5):
        POST binary to github-storage
        if response.ok: return response
        else: wait backoffDelay(attempt), attempt++
    throw Error
```

Backoff delays: 500ms, 1000ms, 2000ms, 4000ms, 8000ms (capped at 30s).

---

# 4. DOWNLOAD FLOW

## 4.1 Full Download Pipeline

```
User requests file preview/download
    ↓
1. Fetch file metadata from `files` table
2. Parse chunk metadata from `file.tags[0]`
    ↓
3. BYOK key resolution:
    ├── encryptionKey === 'byok_protected' → prompt user
    ├── BYOK policy + strictMode → prompt first, fallback to default
    └── No BYOK → use stored encryption key
    ↓
4. Parallel chunk download (processChunksInParallel)
    │   Concurrency: 6 (>500MB), 12 (>50MB), 16 (default)
    │   Each chunk:
    │   ├── downloadChunk(chunk)
    │   │   ├── POST to github-storage {action: download, path, repo, nodeId}
    │   │   ├── atob(response.content)
    │   │   ├── JSON.parse → {v, i, t, d}
    │   │   └── return {index, data: d}
    │   └── 5 retries with exponential backoff
    ↓
5. Decrypt chunks (in parallel, up to 6 at a time)
    │   decryptData(encryptedBase64, encryptionKey)
    │   → decrypt in Web Worker (optional)
    │   → parse AEAD/legacy format
    │   → return ArrayBuffer
    ↓
6. Assemble Blob: new Blob(decryptedChunks, {type: fileType})
    ↓
7. Return Blob to caller
```

## 4.2 downloadChunk Internal Flow

```
downloadChunk(chunk, attempt=0)
    │
    ├── POST to github-storage:
    │   {action: 'download', path, repo, nodeId: accountId-1}
    │
    ├── Validate response:
    │   ├── response.error → retry (wraps 404 as download error)
    │   ├── !responseData?.content → retry ("No content in response")
    │   └── OK → atob → JSON.parse
    │
    ├── Parse chunk format:
    │   ├── {v: '2.3', i, t, d} → new format
    │   └── {chunkIndex, totalChunks, chunkData, ...} → old format (deprecated)
    │
    └── Return {index, data, version}
```

### 4.2.1 Edge Function Download Handler

```
github-storage: download action
    │
    ├── GET https://api.github.com/repos/<user>/<repo>/contents/<path>
    │   ├── 404 → throw "GitHub API error: 404"
    │   └── 200 → data = response.json()
    │
    ├── Check content:
    │   ├── data.content present → use it directly (files < 1MB)
    │   └── !data.content && data.download_url → fetch download_url
    │       ├── GET <download_url> (raw content)
    │       ├── btoa(rawContent) → content
    │       └── !content → return 404
    │
    └── Return {success: true, content: base64, size, sha}
```

### 4.2.2 Large File Download (via download_url)

GitHub's Content API truncates `content` for files > 1MB. When this happens:
1. `data.content` is null
2. `data.download_url` is provided
3. Edge function fetches raw file from `download_url`
4. Edge function converts raw text to base64
5. Client receives base64 and decodes

**Potential issue**: `downloadResponse.text()` + `btoa()` round-trip for binary JSON data. If the raw JSON contains non-UTF-8 characters, `text()` may corrupt them. However, since the stored data is ASCII-safe JSON, this should be fine in practice.

## 4.3 Decryption Key Resolution

The BYOK (Bring Your Own Key) resolution is complex and differs between the three variants:

### res54.ts (standard) flow:
```
1. if encryptionKey === 'byok_protected' → prompt user for BYOK key
2. if BYOK policy enabled:
   a. tryDecrypt(defaultKey) → if works, done
   b. else prompt BYOK key
   c. tryDecrypt(BYOK key) → if works, done
   d. prompt BYOK again (retry once)
3. else → use default encryptionKey from metadata
```

### res54-r2-pipeline.ts (different!) flow:
```
1. if BYOK policy enabled AND (promptEveryDecrypt OR strictMode):
   a. prompt BYOK key FIRST
   b. tryDecrypt(BYOK key) → if works, done
   c. if default fallback allowed → tryDecrypt(defaultKey)
   d. prompt BYOK again
   e. tryDecrypt(defaultKey) AGAIN ← duplicate attempt bug
2. else → use default key
```

**Bug**: The pipeline variant has a duplicate default key attempt (step 1.e). This is dead code — if the default key worked on the first try, it would have returned at step 1.c. The duplicate is unreachable unless something weird happens.

---

# 5. STREAMING VIDEO FLOW

## 5.1 ProgressiveVideoLoader

```typescript
class ProgressiveVideoLoader {
    DOWNLOAD_CONCURRENCY = 6
    DECRYPT_CONCURRENCY = 4
    CHUNKS_PER_BLOB = 3     // Emit partial blob every 3 chunks
}
```

### Flow:
```
start(metadata)
    │
    ├── Fetch file metadata
    ├── Initialize downloadQueue with all chunk indices
    ├── Fire DOWNLOAD_CONCURRENCY (6) parallel downloadChunk calls
    │
    ├── On each chunk downloaded:
    │   ├── Push to pending queue
    │   └── tryDecrypt() (up to DECRYPT_CONCURRENCY = 4 parallel)
    │
    ├── On each chunk decrypted:
    │   ├── Store in this.decryptedChunks[index]
    │   ├── loadedCount++
    │   └── tryEmitPartial()
    │       └── if loadedCount % CHUNKS_PER_BLOB === 0:
    │           ├── Create Blob from decryptedChunks[0..loadedCount]
    │           ├── Revoke previous blobUrl
    │           └── Emit {type: 'partial', blobUrl}
    │
    └── On all chunks loaded:
        └── finalize() → emit {type: 'complete', blobUrl}
```

## 5.2 CBVideoPlayer Integration

```typescript
// EnhancedInstantPreviewModal.tsx
const handleStreamingVideo = async () => {
    const loader = new ProgressiveVideoLoader();
    loader.on('partial', ({ blobUrl, loadedBytes, totalBytes }) => {
        // Save current playback position
        const currentTime = videoRef.current?.currentTime || 0;
        // Set new blobUrl as src
        setBlobUrl(blobUrl);
        // Restore position after new src loads
        // Revoke old blob URL
    });
    await loader.start();
};
```

### 5.2.1 Blob URL Lifecycle (Critical Race)

The `CBVideoPlayer` manages blob URL lifecycle with position save/restore:

```javascript
// When src changes:
// 1. Save currentTime from previous video
// 2. Set new src (blobUrl)
// 3. On loadedmetadata: restore currentTime
// 4. Revoke OLD blob URL (not the new one)
```

**Bug (fixed)**: Previously, the cleanup effect ran `src=""` on deps change, causing "empty src attribute" error. Fixed by removing the `src=""` clearing and only revoking on unmount.

## 5.3 Streaming Issues

1. **Gap in partial blob**: `decryptedChunks` is an array indexed by chunk position. If chunk 0 is still decrypting while chunks 1-3 are done, `tryEmitPartial` won't fire because `loadedCount` only increments on decryption. But when chunk 0 finishes, `loadedCount` jumps from 0 to 4, triggering an emit for all 4 chunks. This is correct but could cause a sudden jump in playback.

2. **No seek map**: The video player can't seek beyond loaded chunks because there's no byte-range mapping.

3. **Memory**: All decrypted chunks are held in `this.decryptedChunks[]` indefinitely until `destroy()`.

4. **No BYOK prompt**: The ProgressiveVideoLoader doesn't include BYOK key resolution logic.

---

# 6. KZA SECURITY LAYER

KZA (Kylo's Zero-day Analyzer) is a multi-function security system comprising 4 edge functions and 1 honeypot.

## 6.1 Architecture

```
[Incoming Request]
    │
    ▼
KZA Phantom (Honeypot) ──── triggers on fake endpoints/credentials ──→ BLACK tier block
    │
    ▼
KZA Sentinel (Threat Detection)
    ├── Internal call? (x-kza-internal HMAC check) → skip
    ├── Admin check (profiles.is_admin)
    ├── Ban check (kza_banned_entities)
    │
    ├── Behavioral Profiling
    │   ├── Geo anomaly (+25)
    │   ├── Device anomaly (+15)
    │   ├── Velocity anomaly (+20)
    │   ├── Endpoint anomaly (+10)
    │   └── Time anomaly (+10)
    │
    ├── Threat Scoring
    │   ├── SQL injection (+60)
    │   ├── Path traversal (+70)
    │   ├── ID enumeration (+40/resource)
    │   ├── Bot detection (+35)
    │   ├── Token replay (+80)
    │   ├── Brute force (+80-100)
    │   └── Privilege escalation (+100)
    │
    ├── Tier Assignment
    │   ├── YELLOW (≥10) → log only
    │   ├── ORANGE (≥40) → rate limit (5 req/60s)
    │   ├── RED (≥70) → temp ban 24h + force logout
    │   └── BLACK (≥100) → permanent ban + force logout
    │
    ├── RED/BLACK Actions
    │   ├── Insert ban into kza_banned_entities
    │   ├── supabase.auth.admin.signOut(userId)
    │   ├── Create incident in kza_admin_incidents
    │   └── Call kza-oracle + kza-verdict
    │
    └── Return {ok: true, score, tier} or 403 KZA_BLOCKED
            │
            ▼
    KZA Oracle (Threat Intel) ──→ account linking, coordinated attack detection
            │
            ▼
    KZA Verdict (Incident Response) ──→ email alert, Realtime broadcast
```

## 6.2 KZA Phantom (Honeypot)

11 fake ghost endpoints:
- `/admin-old`, `/admin-backup`, `/api/internal`, `/api/v2/admin`, `/_admin`
- `/debug`, `/config.json`, `/.env`, `/management`, `/wp-admin`, `/phpmyadmin`
- `/api/users/export`, `/v1/admin`

6 fake files: `credentials.txt`, `admin-backup.pdf`, `users-export.csv`, `database-dump.sql`, `config-backup.json`, `secrets.env`

**2 hardcoded fake credential pairs** (visible in source code):
- `squidcloud_admin_backup` / `Sq!dCl0ud@dmin2024`
- `admin@squidcloud.app` / `SquidAdmin!2024`

**Issue**: Anyone who reads the source knows the exact honeypot values and can trivially avoid them.

## 6.3 KZA Sentinel Threat Rules

| Rule | Score | Bypass |
|------|-------|--------|
| SQL injection patterns | +60 | Encoding variations not in word list |
| Path traversal | +70 | Double encoding bypasses string matching |
| ID enumeration | +40/resource | Slow, distributed enumeration |
| Bot user agents | +35 | Change UA string |
| Precise request intervals | +35 | Add jitter |
| Token replay | +80 | Use fresh token per request |
| Missing Accept-Language | +35 | Bot signal, easy to fake |
| Privilege escalation | +100 | Use proper role |

**False positive rate**: First request from a new location triggers GEO_ANOMALY (+25). First request from a new device triggers DEVICE_ANOMALY (+15). Together that's +40 = ORANGE tier = rate limited immediately. Legitimate users with new devices/locations get throttled.

## 6.4 KZA Oracle (Threat Intel)

- **No authentication required** — anyone who discovers the endpoint can trigger analysis
- Account linking by IP/UA (±40 points for same IP)
- Coordinated attack detection: ≥3 unique users/IPs in 30 min
- Keyword-based skill inference (trivially faked)

## 6.5 KZA Verdict (Incident Response)

- **No authentication required** — open endpoint
- **MailChannels API with NO API key** — potential open email relay
- Incident data broadcast via Supabase Realtime (public channel)
- User emails exposed in incident payloads

### 6.5.1 Internal Call Bypass

KZA functions use an HMAC-based internal token to bypass re-scanning:

```javascript
const expectedHmac = crypto.subtle.sign('HMAC-SHA256', key, encoder.encode(bodyJson));
if (expectedHmac === providedHmac) { return { ok: true }; } // Skip scan
```

If the HMAC key (`KZA_INTERNAL_KEY`) is leaked, any external attacker can add `x-kza-internal: <hmac>` to bypass all KZA scanning.

---

# 7. EDGE FUNCTIONS CATALOG

## 7.1 Storage Functions

| Function | Purpose | Key Details |
|----------|---------|-------------|
| `github-storage` | GitHub API proxy for file CRUD | Upload/download/delete via GitHub Contents API. Binary upload path + JSON path. KZA guard at entry. 3-node cluster support. |
| `github-cluster` | Node selection for chunk distribution | Queries `repositories` table, selects random repo, returns nodeId (1-based) |
| `cloudbliss-api` | REST API gateway | API key auth (SHA-256 salt+hash), workspace RBAC, file CRUD, encryption/decryption |
| `file-operations` | ZIP compress/extract | **CRITICAL BUG**: trusts userId from request body, no auth verification |
| `file-key` | Return decrypted encryption key | Returns key in plaintext over network |
| `secure-file-metadata` | Create file records with key handling | Dynamic column discovery via `information_schema` |
| `download-shared-file` | Shared file download | Legacy shared file handling |
| `create-repos` | Create GitHub repos for storage | Round-robin across nodes, Gemini naming |

## 7.2 Security Functions

| Function | Purpose | Auth |
|----------|---------|------|
| `kza-sentinel` | Threat detection & rate limiting | Bearer JWT |
| `kza-phantom` | Honeypot/deception | Optional (anyone can trigger) |
| `kza-oracle` | Threat intelligence | **None** (internal only, but no auth) |
| `kza-verdict` | Incident reporting & email alerts | **None** (internal only, but no auth) |

## 7.3 Media/Streaming Functions

| Function | Purpose |
|----------|---------|
| `hls-generation` | HLS video segment generation |
| `media-manifest` | HLS manifest generation |
| `media-master-manifest` | Master playlist for adaptive bitrate |
| `media-playlist` | Media playlist serving |
| `media-segment` | Media segment serving with signature verification |
| `video-stream-proxy` | Video stream proxying with HMAC verification |
| `video-stream-url` | Signed video URL generation |
| `serve-pdf` | PDF serving |
| `serve-pdf-secure` | Secure PDF serving with access control |

## 7.4 API & Integration Functions

| Function | Purpose |
|----------|---------|
| `cloudbliss-api` | Main REST API (API key auth) |
| `cli-operations` | CLI tool backend |
| `api-file-upload` | Legacy file upload endpoint |
| `api-file-upload-tebi` | Large file upload (Tebi) |
| `api-file-delete` | Legacy file delete endpoint |
| `api-file-metadata` | Legacy file metadata endpoint |
| `api-key-management` | API key CRUD |
| `ink-ai` | AI integration (Ink) |
| `squid-ai-chat` | SquidAI chat endpoint |
| `gemini-api` | Google Gemini integration |

## 7.5 Auth & Admin Functions

| Function | Purpose |
|---------|---------|
| `admin-auth` | Admin authentication |
| `admin-data-access` | Admin data queries |
| `check-admin-status` | Admin status check |
| `verify-admin` | Admin verification |
| `verify-provider` | Storage provider verification |
| `migration-oauth` | OAuth migration |
| `migration-oauth-callback` | OAuth callback handler |
| `start-migration` | Data migration starter |

## 7.6 Other Functions

| Function | Purpose |
|---------|---------|
| `get-app-updates` | Mobile app update checker |
| `add-app-update` | Upload new app version |
| `store-provider` | Storage provider management |
| `trash-operations` | Trash/bin operations |
| `send-workspace-invite` | Workspace invitation emails |
| `validate-share` | Share link validation |
| `generate-pdf-url` | Signed PDF URL generation |
| `cloud-file-browser` | Cloud file browser backend |
| `start-cloud-import` | Import from cloud providers |
| `download-manager` | Download job management |

---

# 8. DATABASE SCHEMA (INFERRED)

Based on queries across all edge functions:

### 8.1 `files` Table (Core Storage)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK to auth.users |
| name | text | File name |
| type | text | MIME type |
| size | bigint | File size in bytes |
| storage_path | text | Path in storage backend |
| tags | jsonb | Chunk metadata (contains encryptionKey!) |
| encryption_key | text | **Plaintext AES key** (no BYOK) |
| encrypted_key | text | Server-keyring encrypted key (BYOK) |
| encrypted_key_nonce | text | Nonce for encryption |
| workspace_id | uuid | FK to workspaces |
| parent_folder | uuid | Folder hierarchy |
| storage_provider_id | text | 'res54_distributed' or 'res54_r2' |
| external_object_key | text | R2 key reference |
| processor | text | Processor type |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| deleted_at | timestamptz | Soft delete |
| is_shared | boolean | |
| share_token | text | |

### 8.2 `repositories` Table
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK |
| repo_name | text | GitHub repo name |
| github_username | text | Account that owns repo |
| node_id | integer | Cluster node index |
| account_id | integer | 1-based account index |
| status | jsonb | Health status |
| created_at | timestamptz | |

### 8.3 `profiles` Table
| Column | Type |
|--------|------|
| id | uuid (PK, FK to auth.users) |
| email | text |
| full_name | text |
| avatar_url | text |
| is_admin | boolean |
| repo_count | integer |
| storage_used | bigint |
| storage_limit | bigint |

### 8.4 `workspaces` Table
| Column | Type |
|--------|------|
| id | uuid PK |
| name | text |
| owner_id | uuid |

### 8.5 `workspace_members` Table
| Column | Type |
|--------|------|
| workspace_id | uuid |
| user_id | uuid |
| role | text (viewer/editor/admin/owner) |

### 8.6 Security Tables
| Table | Purpose |
|-------|---------|
| `kza_banned_entities` | Banned users/IPs with expiry |
| `kza_user_profiles` | Behavioral baselines |
| `kza_threat_events` | Threat event log |
| `kza_admin_incidents` | Incident reports |
| `kza_honeypot_hits` | Honeypot trigger log |
| `kza_linked_accounts` | Account linking (Oracle) |
| `kza_phantom_assets` | Honeypot token assets |
| `api_keys` | API key storage (salt+hash) |

---

# 9. FRONTEND COMPONENT MAP

## 9.1 Key Components

| Path | Purpose | Lines |
|------|---------|-------|
| `src/App.tsx` | Root layout, routing, providers | |
| `src/pages/` | Route pages (dashboard, files, settings, etc.) | |
| `src/components/EnhancedInstantPreviewModal.tsx` | File preview modal with streaming video | ~400 |
| `src/components/CBVideoPlayer.tsx` | Video player with blob URL lifecycle | ~200 |
| `src/lib/res54.ts` | Primary storage pipeline | 1714 |
| `src/lib/videoStreamer.ts` | Progressive video streaming | 218 |
| `src/services/SmartTransferQueue.ts` | Upload/download queue manager | 684 |
| `src/services/load-balancer.ts` | Concurrent operation balancer | 503 |
| `src/contexts/AuthContext.tsx` | Authentication context | |
| `src/workers/` | Web Workers for encryption/decryption | |

## 9.2 Auth Flow (Frontend)

```
App mounts
    ↓
AuthContext initializes
    ↓
supabase.auth.getSession() → check existing session
    ↓
Listen to onAuthStateChange → update user state
    ↓
Protected routes check user !== null
    ↓
API calls use supabase.auth.getSession() for JWT
```

**Bug**: `AuthContext.tsx` was calling `supabase.auth.getSession()` (local cache) instead of `supabase.auth.refreshSession()` (server token refresh) for session refresh — meaning expired tokens wouldn't be refreshed.

---

# 10. SERVICES & INFRASTRUCTURE

## 10.1 SmartTransferQueue

A browser-side service for resilient uploads/downloads with:
- **IndexedDB persistence** — survives page reloads
- **Resumable uploads** — chunk-level tracking
- **Priority queue** — sorted by priority + creation time
- **Network awareness** — pauses on offline, resumes on online
- **SHA-256 integrity** — computed per file
- **Max 3 concurrent transfers**

**Security concern**: `resumeData` stores the encryption key in IndexedDB — accessible via XSS or physical device access.

## 10.2 Load Balancer

A general-purpose concurrent operation manager:
- **500 max concurrent operations**
- **10,000 max queue size**
- **Circuit breaker** — opens after 50 failures, resets after 30s
- **Worker pools** — encryption(150), decryption(150), upload(200), download(200), general(100)
- **Exponential backoff** with priority escalation on retry

## 10.3 Vercel Configuration

```json
{
    "functions": { "maxDuration": 60 },
    "buildCommand": "npm run build",
    "outputDirectory": "dist"
}
```

60-second function timeout. Static SPA with API routes.

---

# 11. CRITICAL ISSUES & LOOPHOLES

## 11.1 CRITICAL: Authorization Bypass in file-operations

**File**: `supabase/functions/file-operations/index.ts`
**Severity**: CRITICAL

The function accepts `userId` from the request body and NEVER verifies it against the authenticated user:
```javascript
const { action, fileIds, userId, archiveName } = body; // userId from body!
// ... NO supabase.auth.getUser() check ...
const { data: files } = await supabase
    .from('files')
    .select('*')
    .in('id', fileIds)
    .eq('user_id', userId); // Uses body.userId directly
```

**Exploit**: Any authenticated user can set `userId` to any value in the request body and compress/extract any other user's files. The KZA Sentinel check forwards the body snapshot but doesn't enforce body/token consistency.

## 11.2 CRITICAL: Encryption Keys in Plaintext

**Files**: `cloudbliss-api/index.ts`, `secure-file-metadata/index.ts`
**Severity**: CRITICAL

Encryption keys are:
1. Stored in `file.encryption_key` column **in plaintext** in the database
2. Stored in `file.tags` JSON metadata **in plaintext**
3. Returned by `file-key` endpoint **in plaintext** over the network
4. Acceptable via URL query parameter `?encryption_key=...` (leaks in server logs)

**Exploit**: Any database breach, admin abuse, or HTTPS-interception exposes all file encryption keys. The "zero-knowledge" claim is false — the server has access to all keys.

## 11.3 CRITICAL: Unauthenticated KZA Endpoints

**Files**: `kza-oracle/index.ts`, `kza-verdict/index.ts`
**Severity**: CRITICAL

These functions have NO authentication:
```javascript
// kza-verdict - Anonymous email relay
const emailResult = await sendAdminEmail({
    to: ADMIN_EMAIL,
    subject: '...',
    htmlBody: incidentCard
});
```

**Exploit**: Anyone who discovers the endpoint URL can:
- Trigger email notifications via MailChannels (open relay — no API key)
- Create fake security incidents in the database
- Broadcast false incidents via Realtime channels

## 11.4 CRITICAL: Weak Key Derivation

**File**: `cloudbliss-api/index.ts` (and client-side encryption)
**Severity**: CRITICAL

```javascript
const keyBytes = new TextEncoder().encode(key.slice(0, 32).padEnd(32, '0'));
```

A 6-character password like `"secret"` becomes:
```
s  e  c  r  e  t  \0 \0 \0 ... (32 bytes total, 26 zero-bytes)
```

**Exploit**: A short encryption key is reduced to its actual entropy. No PBKDF2 or Argon2 key stretching. Brute-force is linear based on key length.

## 11.5 HIGH: API Key Prefix Leak

**File**: `cloudbliss-api/index.ts`
**Severity**: HIGH

```javascript
// Line 246: Extract cb_xxxxxx prefix (8 chars)
const apiKeyPrefix = apiKey.slice(0, 8); // First 8 chars: "cb_xxxx"
```

API key lookup uses only the first 8 characters as a prefix query (`WHERE key_prefix = $1`). This means:
- An attacker who observes an API key once can query by prefix to verify the full key
- The prefix is logged in console output

## 11.6 HIGH: Encryption Key via URL Parameter

**File**: `cloudbliss-api/index.ts`
**Severity**: HIGH

```javascript
// Query parameter encryption key
const encryptionKey = url.searchParams.get('encryption_key') || body.encryptionKey;
```

URL query parameters are logged by:
- Vercel access logs
- Supabase edge function logs
- Browser referer headers (when navigating)
- Proxy/load balancer logs

## 11.7 HIGH: body_snapshot Leaks Secrets

**File**: All KZA functions
**Severity**: HIGH

The KZA Sentinel receives `body_snapshot` containing the raw request body. This is logged and processed:
```javascript
bodySnapshot = await req.clone().text();
```

**Exploit**: Request bodies containing passwords, tokens, API keys, or encryption keys are forwarded to KZA Sentinel and may be persisted in `kza_threat_events` logs.

## 11.8 MEDIUM: IndexedDB Key Storage

**File**: `SmartTransferQueue.ts`
**Severity**: MEDIUM

```javascript
// resumeData stored in IndexedDB
transfer.resumeData = { fileId, encryptionKey, chunkIndex, ... };
```

IndexedDB is accessible via:
- Any JavaScript running on the same origin (XSS)
- Developer tools (physical access)
- Browser extension with storage permissions

## 11.9 MEDIUM: CORS Wildcard

**File**: All edge functions
**Severity**: MEDIUM

```javascript
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
};
```

**Exploit**: Any website can make authenticated requests to these endpoints if the user has an active session (cookie-based auth is not used, but JS can access the endpoints from any origin).

## 11.10 MEDIUM: SHA-256 Integrity Never Verified

**File**: `res54.ts` (and all variants)
**Severity**: MEDIUM

SHA-256 hash is computed during upload but NEVER checked during download. The metadata field exists but is unused:
```javascript
// Upload: hash computed and stored
metadata.sha = await sha256(file);

// Download: hash NEVER checked
// chunks decrypted and assembled without verification
```

## 11.11 MEDIUM: Chunk Size Overflow Bug

**File**: `res54.ts`, `res54-r2.ts`, `res54-r2-pipeline.ts` (determineChunkingStrategy)
**Severity**: MEDIUM

```javascript
if (fileSize > 500 * 1024 * 1024) {
    return { chunkSize: 2 * 1024 * 1024 * 1024, label: 'XLARGE' };
    //         ↑ 2 GB, not 2 MB!
}
```

Files > 500MB get 2GB chunks instead of 2MB. JavaScript numbers handle this fine but the edge function CPU timeout (2s) and request body limits (10MB) would reject these gigachunks.

## 11.12 MEDIUM: ValidateChunkFormat Never Matches

**File**: `res54.ts`, `res54-r2.ts`, `res54-r2-pipeline.ts`
**Severity**: MEDIUM

The `validateChunkFormat` function checks strictly typed fields:
```javascript
return (
    typeof chunk.chunkIndex === 'number' &&  // integer
    typeof chunk.totalChunks === 'number' &&  // integer
    typeof chunk.fileName === 'string' &&
    typeof chunk.fileType === 'string' &&
    typeof chunk.fileSize === 'number' &&     // integer
    typeof chunk.chunkData === 'string'       // base64 string
);
```

**But the new v2.3 format never has these fields!** The v2.3 format uses `{v, i, t, d}` instead. This validation is dead code for v2.3 chunks. It only exists for legacy backward compatibility.

## 11.13 MEDIUM: Web Worker Pool Contention

**File**: `res54.ts`, `res54-r2.ts`
**Severity**: MEDIUM

```javascript
// Module-level global state
let encryptionWorkers: Worker[] = [];

// Called by uploadFileWithRes54
const getEncryptionWorker = (index: number) => {
    if (!encryptionWorkers[index]) {
        encryptionWorkers[index] = new Worker(...);
    }
    return encryptionWorkers[index];
};
```

Multiple simultaneous uploads from different components would share and corrupt the same worker pool. Workers cannot be shared across concurrent operations.

## 11.14 MEDIUM: Legacy AEAD Fallback

**File**: `src/lib/encryption.ts`
**Severity**: MEDIUM

```javascript
try {
    return decryptAead(data, key);
} catch {
    return decryptLegacy(data, key); // No authentication!
}
```

If the first 4 bytes of a chunk are accidentally corrupted (not malicious), the AEAD parser throws, and the data is decrypted without authentication. This means:
- Bit flips in the AEAD header are silently accepted
- Legacy mode has no integrity check

## 11.15 MEDIUM: No Size Validation on ZIP Extraction

**File**: `file-operations/index.ts`
**Severity**: MEDIUM

```javascript
// No size check before extraction
const zip = await JSZip.loadAsync(fileData);
zip.forEach(async (relativePath, zipEntry) => {
    const content = await zipEntry.async('uint8array');
    // Upload to storage...
});
```

A malicious ZIP bomb could extract terabytes of data, consuming storage quota and edge function CPU time.

## 11.16 LOW: Hardcoded Honeypot Credentials

**File**: `kza-phantom/index.ts`
**Severity**: LOW

```javascript
const fakeCredentials = [
    { username: 'squidcloud_admin_backup', password: 'Sq!dCl0ud@dmin2024' },
    { username: 'admin@squidcloud.app', password: 'SquidAdmin!2024' }
];
```

The exact values are in the source code. Anyone with source access knows what to avoid.

## 11.17 LOW: global.gc() in Browser Code

**File**: `res54.ts`, `res54-r2.ts`, `res54-r2-pipeline.ts`
**Severity**: LOW

```javascript
if (global.gc) { global.gc(); } // No-op in browsers
```

`global.gc()` is only available in Node.js with `--expose-gc` flag. In browser/Deno environments, this is always falsy. Dead code.

## 11.18 LOW: Three Equivalent Storage Pipelines

**File**: `src/lib/res54.ts`, `src/lib/res54-r2.ts`, `src/lib/res54-r2-pipeline.ts`
**Severity**: LOW (maintenance)

~80% code duplication across 4,808 lines. The BYOK resolution order differs subtly between them, creating hard-to-trace bugs.

---

# 12. PERFORMANCE BOTTLENECKS

## 12.1 Memory: Full File in RAM

**Issue**: Standard upload reads the entire file into `chunks: ArrayBuffer[]` before encryption. For a 500MB file:
- 200+ chunks × 2.5MB = 500MB (file data)
- 200+ encrypted chunks × ~3.3MB = 660MB (encrypted + base64 overhead)
- Total: **~1.16GB** in browser memory simultaneously

Streaming mode (>100MB) mitigates this but the threshold is high.

## 12.2 Blob URL Leaks

**Issue**: Every `URL.createObjectURL()` creates a blob URL that holds memory until explicitly revoked. Multiple async paths can leak:
- Error paths that don't revoke
- Race conditions where old URLs aren't cleaned up before new ones are created
- Component unmount without cleanup

## 12.3 Sequential Chunk Upload

**Issue**: Chunks are uploaded sequentially via `uploadChunkBinary` inside `processChunksInParallel`, but each chunk upload is a single HTTP request. With 200 chunks at 1.5s each, that's 5 minutes for a 500MB file.

## 12.4 No Compression

**Issue**: `compressData` and `decompressData` functions exist but are never called. They encode as `btoa(unescape(encodeURIComponent(data)))` which is URL-encoding + base64, not compression. The functions are misnamed dead code.

## 12.5 Database Schema Introspection

**File**: `secure-file-metadata/index.ts`
**Issue**: Every metadata creation queries `information_schema.columns` to discover the table structure:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'files'
```

This adds latency and exposes DB schema to the client layer. The result is cached but only after the first request.

## 12.6 KZA Sentinel Adds Latency

**Issue**: Every edge function request passes through KZA Sentinel, which:
1. Makes an internal HTTP call to `kza-sentinel` edge function
2. That function queries `kza_banned_entities` (indexed query, but adds latency)
3. Queries `kza_user_profiles` for behavioral analysis
4. Computes threat score

For non-malicious traffic, this adds **250-600ms** of overhead per request.

---

# 13. CODE QUALITY CONCERNS

## 13.1 Massive Duplication

Three 1,400-1,700 line files with 80% identical code. The `downloadFileWithRes54` function alone is ~300 lines duplicated almost verbatim three times. Any bug fix must be applied in triplicate.

## 13.2 Stringly-Typed Routing

Storage backends are selected via string constant:
```javascript
const storagePath = 'res54_distributed'; // vs 'res54_r2'
```

No type safety. A typo silently falls through to the wrong handler.

## 13.3 Unused/Misnamed Functions

| Function | Status |
|----------|--------|
| `compressData` | Dead code (does URL encoding, not compression) |
| `decompressData` | Dead code |
| `processChunkData` | Dead code |
| `global.gc()` calls | No-op in browsers |
| `SECONDARY_NODES` env vars | Possibly unused |

## 13.4 Overly Complex BYOK Logic

The BYOK key resolution tries multiple key permutations:
1. Try default key
2. Prompt BYOK key
3. Try BYOK key
4. Prompt BYOK key again
5. Try default key again (pipeline variant only)

The retry logic is tangled and differs between variants. The pipeline variant has a duplicate default key attempt.

## 13.5 Fragile Base64 Conversion

```javascript
// res54.ts: binaryBytes → base64
let dBinary = '';
for (let i = 0; i < binaryBytes.length; i += subChunkSize) {
    const sub = binaryBytes.subarray(i, Math.min(i + subChunkSize, binaryBytes.length));
    dBinary += String.fromCharCode.apply(null, sub); // apply with large array hits call-stack limit!
}
const dValue = btoa(dBinary);
```

`Function.prototype.apply` has a call-stack limit (typically ~125k arguments on V8). With `subChunkSize = 0x8000` (32768), a chunk of 32800 bytes creates a sub-array of 32768 elements. `String.fromCharCode.apply(null, array32768)` may work but is at the boundary for some engines. The 32768 limit was previously hit:
```
// Previous: String.fromCharCode.apply(null, binaryBytes) ← hit call-stack limit!
// Fixed: Split into 0x8000 sub-chunks
```

---

# 14. ARCHITECTURAL RECOMMENDATIONS

## 14.1 Immediate Fixes (Security)

1. **Require workspace Role check in file-operations** — verify `userId` against auth token
2. **Add auth to kza-oracle and kza-verdict** — require internal HMAC token or service role key
3. **Remove encryption key from URL query params** — server logs expose keys
4. **Add proper key derivation** — Argon2id or at minimum PBKDF2 for user-provided keys
5. **Don't store encryption keys in plaintext** — use server-side keyring for all keys (not just BYOK)

## 14.2 Medium-Term Fixes

1. **Eliminate the three-variant mess** — pick one storage backend, remove the other two
2. **Verify SHA-256 during download** — integrity check costs little, enables corruption detection
3. **Fix XLARGE chunk size** — 2GB is wrong, should be 2MB
4. **Add ZIP extraction size limits** — prevent ZIP bomb DoS
5. **Encrypt `body_snapshot` or redact secrets** — KZA doesn't need raw passwords

## 14.3 Architectural Improvements

1. **Unify storage pipeline** — merge res54.ts/res54-r2.ts/res54-r2-pipeline.ts into one configurable pipeline
2. **Add Worker pool isolation** — per-operation pool, not shared global state
3. **Implement actual file integrity** — verify SHA-256 during download, report corruption
4. **Add key rotation support** — re-encrypt files with new keys
5. **Improve streaming** — add seek support via byte-range requests, avoid holding all chunks in memory

---

## Appendix: File Sizes & Complexity

| File | Lines | Complexity |
|------|-------|------------|
| `src/lib/res54.ts` | 1,714 | Main storage pipeline |
| `src/lib/res54-r2.ts` | 1,684 | Redundant pipeline (80% duplicate) |
| `src/lib/res54-r2-pipeline.ts` | 1,410 | Redundant pipeline (80% duplicate) |
| `src/services/SmartTransferQueue.ts` | 684 | Upload/download queue |
| `src/services/load-balancer.ts` | 503 | Concurrent operation balancer |
| `supabase/functions/cloudbliss-api/index.ts` | 948 | REST API gateway |
| `supabase/functions/github-storage/index.ts` | 1,097 | GitHub API proxy |
| `supabase/functions/kza-sentinel/index.ts` | 754 | Threat detection |
| `supabase/functions/file-operations/index.ts` | 539 | ZIP operations |
| `supabase/functions/secure-file-metadata/index.ts` | 218 | File metadata |
| `supabase/functions/file-key/index.ts` | 111 | Key retrieval |
| `src/lib/videoStreamer.ts` | 218 | Progressive streaming |
| `src/components/EnhancedInstantPreviewModal.tsx` | ~400 | Preview modal |
| **Total analyzed** | **~10,280** | |

### Node Count Verification

The cluster supports up to 3 GitHub nodes:
```javascript
// github-storage:89-97
const githubNodes = [{ token: GITHUB_TOKEN, username: GITHUB_USERNAME, nodeId: 0 }];
if (GITHUB_TOKEN_2 && GITHUB_USERNAME_2) githubNodes.push({...});
if (GITHUB_TOKEN_3 && GITHUB_USERNAME_3) githubNodes.push({...});
```

Only `GITHUB_TOKEN` and `GITHUB_USERNAME` are required. The _2 and _3 variants are optional. The code handles 1-3 nodes.

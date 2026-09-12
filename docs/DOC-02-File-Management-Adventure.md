---
title: "SquidCloud — Doc 2: How Files Travel"
subtitle: "Upload, Download, and Delete — The Exact Journey of Every File"
author: "SquidCloud Team"
date: "2026-08-27"
lang: "en"
---

# Hey, Captain!

You know encryption (Doc 1). Now let's see how your files actually *move*. Every file in SquidCloud is a row in a database plus a few locked chunks in cloud warehouses. Upload = make row + fill warehouses. Download = read row + fetch chunks + unlock. Delete = flip a flag.

No magic — just the real code.

---

# 1. What a File *Really* Is

A file is one row in the Postgres table `files`:

| Field | What it means |
| :--- | :--- |
| `id` | Its forever ID, like `270e323a...` (a UUID). |
| `name` | `mineral-india-map.jpg` — what you see. |
| `size` | Original size before encryption (669,382 bytes). |
| `user_id` | Your user ID — proves you own it. |
| `workspace_id` | Which workspace (team folder) it lives in. Default is your personal one. |
| `parent_folder` | Folder ID or empty = top level. |
| `storage_path` | Almost always `res54_distributed`. |
| `encrypted` | Should be `true` — means chunks are locked. Old CLI bug made it `false`. |
| `tags[0]` | The **treasure map** — a JSON string: `{ fileId, chunkSize, chunks: [{index, path, bucket, repo}], encryptionKey, created }`. The `path` like `userId/uploads/uploadId/0.bin` is where the locked chunk lives. The `encryptionKey` is the real secret (or a name-tag like `managed_key` if vaulted). |
| `is_deleted` | `false` = visible. `true` = in trash (still stored, just hidden). |

Helpers: `folders` rows (id, name, path, parent), `upload_sessions` sticky notes while uploading, and the locked blobs themselves in Backblaze B2 buckets.

---

# 2. Upload: How a New File Is Born

You pick `mineral-india-map.jpg` (669 KB) and press Upload.

## Step 1 — Ask for a Plan (`POST /upload`)

Your device says: *"I want to upload mineral-india-map.jpg, type image/jpeg, 669,382 bytes."*

The server (`handlers.ts:190`):

1. Checks you can write to this workspace (you need `editor` role — you have it for your own).
2. Creates a random secret key: 32 random bytes → 64 hex chars like `9aaf5e3d...`. Writes a sticky note in `upload_sessions`: `upload_id`, `encryption_key`, your info, total chunks, and which buckets to use.
3. Decides **chunk size**: <10 MB → 512 KB, 10–50 MB → 1 MB, >50 MB → 2 MB. Your file → 512 KB → **2 chunks**: 524,288 + 145,094 bytes.
4. Asks the **bucket manager** (`squidcloud-cluster`): "I need 2 empty spots." It looks at all buckets (main env bucket + admin buckets in `squidcloud_b2_buckets` + your own `storage_providers`) and picks 1–4 based on file size. Yours got both in `BucketSQ1`.
5. For each chunk, it asks that bucket for a **signed URL** — a normal URL plus `?X-Amz-Signature=...` that works for a short time without a password. Like a one-time ticket.

It replies with: `upload_id`, `encryption_key`, `chunk_size`, `total_chunks`, and the two ticket URLs + their paths.

## Step 2 — Lock and Ship (On Your Device)

Now *your* device does the real work:

*   Reads the whole file.
*   Splits by the server's `chunk_size` (524,288).
*   For each chunk, runs `encryptChunkCanonical(plain, encryption_key)` — the res54 v2 filing cabinet from Doc 1: split into 64 KB parts, each with its own IV and label `chunk-i-N-timestamp`, encrypt with `rawKey = UTF8(key.slice(0,32).padEnd)`, pack header + parts.

Then in parallel (up to 4 workers, 3 retries each):

```
PUT ticket_url_0 with body = lockedChunk0
PUT ticket_url_1 with body = lockedChunk1
```

No password header — the ticket *is* the permission.

## Step 3 — Seal It (`POST /upload/complete`)

Your device says: *"I filled both lockers for upload 9ef748a8..., chunk size 524288."*

The server:

1. Finds the sticky note `upload_sessions` for that upload_id and your user.
2. Makes a **brand new** forever ID: `fileId = randomUUID()` — this is the real file ID (the earlier temporary one is thrown away — the CLI used to report the wrong one!).
3. Builds the treasure map:

    ```json
    {
      "fileId": "270e323a...",
      "chunkSize": 524288,
      "chunks": [
        {"index":0, "path":"userId/uploads/9ef748a8.../0.bin", "bucket":"BucketSQ1", "repo":"b2"},
        {"index":1, "path":"userId/uploads/9ef748a8.../1.bin", "bucket":"BucketSQ1", "repo":"b2"}
      ],
      "encryptionKey": "9aaf5e3d...",
      "created": "2026-08-25T..."
    }
    ```

4. Inserts the `files` row: `id=fileId, name, type, size, storage_path='res54_distributed', encrypted=true, tags=[JSON string of map], workspace_id`.
5. Secretly nudges the automation engine: `POST squid-automation-engine {action: file-event, userId, path: fileName}` — so your "email me on new JPG" pipeline can wake up.
6. Deletes the sticky note and returns `{file:{id, name}}`. Your app shows "✓ uploaded".

That's it. Locked chests in warehouses, map in the card pocket.

---

# 3. Download: Three Doors, One Treasure

You click a file. Your device first fetches the card: `GET /files/:id/metadata` → gets the `files` row and peels `tags[0]` with `parseTags` (tries JSON parse a few times because old rows wrapped it weirdly).

Then it figures out the key:

*   If `tags[0].encryptionKey` looks real (not `managed_key`, not `sha256:...`, not `byok_...`), that's your key.
*   If it's a name-tag, it asks the vault: `POST /functions/v1/file-key {fileId}` with your token. The vault checks "is this file yours?" and unwraps the real key.

Now three doors, tried in order:

**Door A — Fast Web Road** (needs a fresh Supabase JWT, `sb_token`). Calls `squidcloud-cluster` with `action: download` for each chunk → gets signed GET tickets → fetches locked blobs → `decryptAny(blob, key)` → writes plain bytes to disk. This is what the browser usually uses.

If your web login expired, you get `WEB_SESSION_REQUIRED` and fall to...

**Door B — Signed Shortcut** (needs only your opaque CLI token). Asks the platform: `GET /download/:id?signed=true`. The platform checks you own the file, unwraps the right key if needed, asks the bucket manager for signed GET tickets, and returns `{ signed_urls: [ticket0, ticket1], encryption_key: theRealKey }`. Your device then loops:

```
for each url in signed_urls:
  blob = fetch(url)
  plain = decryptAny(blob, vaultKey_or_usableKey)
  write to file
```

No JWT needed — just your CLI token.

**Door C — SquidFS Bridge** (for drive-mounted files with `repo !== 'b2'`). Asks the bridge (`squidfs-bridge` action `resolve_download`) with a `cb_` API key to get tickets, same decrypt loop.

The web app has the same loop in `res54.ts:downloadFileWithRes54` (parallel workers, 5 retries). If decryption fails with a key error, it even asks you to type a BYOK key.

If all doors fail, you see `signed: ... · cluster: ... · squidfs-bridge: ...` joined together.

---

# 4. Delete: Just a Flag Flip

You press Delete.

1. Device calls `DELETE /files/:id` (or bridge `action: delete`).
2. Server checks: are you `editor` in this workspace, and is the file yours (or are you admin)?
3. It runs:

    ```sql
    UPDATE files SET is_deleted = true, deleted_at = now() WHERE id = fileId
    ```

That's it. The row stays. The locked chests stay orphaned in B2 (a future garbage collector will sweep them, but not yet). Every file list has `WHERE is_deleted = false`, so it vanishes. Trash view queries `is_deleted = true`. Restore (`POST /files/:id/restore`) flips it back to `false`.

Batch APIs (`/batch/delete|restore|copy`) just loop this for up to 100 ids.

---

# 5. The Warehouses in Detail

Where do the locked chests sleep? In **Backblaze B2 bucket pools**.

**Pool comes from three places** (`squidcloud-cluster` + `cloudbliss-api/lib.ts` with bridge):

1. Main bucket from env vars (`B2_BUCKET_NAME`, `B2_ENDPOINT` like `s3.us-west-004.backblazeb2.com`).
2. Admin buckets in table `squidcloud_b2_buckets` where `is_enabled=true`.
3. *Your* private buckets in `storage_providers` where you added creds (or public shared ones) — decrypted via `provider-vault`.

**How many warehouses per file?** `resolveBucketCount(fileSize, poolSize)`: <5 MB → 1, <50 MB → 2, else up to 4 (round-robin with random start offset). Your 669 KB file got 1 effective but asked 2.

**Golden tickets:** `AwsClient.sign(url, {method:"PUT"|"GET", aws:{signQuery:true}})`. It's a normal `https://f00.backblazeb2.com/file/bucket/path?X-Amz-Algorithm=...&X-Amz-Signature=...` that works without your password, just for that object and verb, for a short time.

**Paths** look like `userId/uploads/uploadId/0.bin` — your userId baked into the path prevents two users' chunks from colliding even with the same uploadId.

---

# 6. Remember This

*   **Upload = ask for plan + key + tickets → lock on your device → PUT to tickets → seal the map.**
*   **Download = read the map → get tickets + key → fetch locked blobs → unlock.**
*   **Delete = flip a flag.** Simple, safe, reversible.

Every step after the first one trusts the map in `tags[0]` and the key it points to. Get those right and the adventure always succeeds.


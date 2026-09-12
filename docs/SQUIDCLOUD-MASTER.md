---
title: "SquidCloud Master Guide"
subtitle: "Everything About SquidCloud — From Secret Codes to Super Tools, For Curious Kids and Future Builders"
author: "SquidCloud Team"
date: "2026-08-27"
lang: "en"
toc: true
toc-depth: 3
---

# SquidCloud Master Guide

> **How to use this book:** This is four small guides glued into one big adventure. Read them in order, or jump to the tool you love most. Everything here comes from the real code — no guessing!

---


\newpage

# Hey, Young Cryptographer!

You already know what encryption is: turning readable data into unreadable data with a key, so only someone with the right key can turn it back. **res54** is SquidCloud's name for *how* we do that — the exact rules for locking and unlocking every chunk of every file.

No fairy tales. Just the real code, explained simply.

---

# 1. The Big Idea

SquidCloud never sends your original file anywhere. Before upload, your device:

1. Cuts the file into small pieces called **chunks** (like slices of bread).
2. Locks each chunk with **AES-256-GCM** — a super-strong lock that also checks the label on the box hasn't been swapped.
3. The locked chunks go to warehouses (cloud buckets). The key never leaves your world except in a special sealed way (see Chapter 5).

To read the file, a trusted device fetches those locked chunks and unlocks them with the same key.

> Code home: `cli/src/lib/crypto/res54.ts` — the CLI copy — and the same code is embedded inside `cli/src/lib/host/decryptor.ts` so the local decryptor daemon speaks the identical language. The server's `supabase/functions/cloudbliss-api/handlers.ts` also encrypts/decrypts the same way.

---

# 2. How a Password Becomes a Real Key

Your secret might be `0f97f40f4f83916b7583...` (64 hex characters). The computer needs exactly 32 bytes.

**The rule is always:**

```ts
deriveRawKey(keyString) = UTF8( keyString.slice(0,32).padEnd(32, '0') )
```

Take the first 32 characters. If shorter, pad with `'0'` to reach 32. Turn those 32 characters into UTF-8 bytes. That's the **raw key**. We do *not* hex-decode — we treat it as text. Every place in SquidCloud does this same slicing, so everyone agrees.

**For the newest files (v3), we level up:**

1. **File Master Key** = `HKDF-SHA256( rawKey , info="v3-file-master" + fileId )`
2. **Chunk Key for chunk i** = `HKDF-SHA256( FileMasterKey , info="v3-chunk" + littleEndian32(i) )`

HKDF is like a key factory: you feed it one master key and a label, and it safely makes a new, unrelated 32-byte key for that exact purpose. Now each chunk of each file has its own unique key, all derived from your one secret. Steal one chunk's key and you learn nothing about the next.

> Code: `hkdfExpand` in `res54.ts:37` via `hkdf(sha256, ...)`.

---

# 3. The Three Locked Box Designs

Over time we made better boxes, but we still open all old ones so your old photos never break. The computer peeks at the first few bytes to know which box it sees.

## How It Guesses

* Bytes `0x52 0x45 0x03` ("R E 0x03") at the start → **v3**.
* Otherwise, read first 4 bytes as a little-endian number. If it's 8–128 and the blob is longer than `4 + that + 12`, peek inside: does bytes 4..(4+len) parse as JSON with `version>=2` and an `ivs` list? If yes → **v2 canonical**. If not, but length checks still pass → **v2 old style**.
* Anything else → **Legacy v1**.

> Code: `detectChunkVersion` and `parseCanonicalHeader` in `res54.ts:51,64`.

## v1 Legacy — The First Box

```
[12 random bytes: IV] [ encrypted data + 16-byte tag ]
```

The simplest: one IV, one ciphertext+tag under the raw key. No label check. Still supported forever.

> Code: `decryptLegacy` in `res54.ts:138`.

## v2 Old Style — The Box With a Sticky Label

```
[4 bytes: label length] [label bytes e.g. "res54-v2-1714000000000"] [12 bytes IV] [ encrypted data + tag ]
```

The label (AAD) is authenticated together with the ciphertext. Change the label even by one letter and decryption fails. Simple and effective for one chunk = one box.

> Code: `decryptV2` in `res54.ts:128`.

## v2 Canonical — The Filing Cabinet (What Your Browser Makes Today)

This is what you actually create now when you upload:

1. Split the chunk into **64 KB sub-parts** (a 512 KB chunk → 8 parts).
2. For each part `i` of `N` parts:
   * IV = 12 fresh random bytes
   * Label = `chunk-i-N-timestamp` (e.g., `chunk-0-8-1714000000000`)
   * Encrypted = `AES-GCM(rawKey, IV, label, 64KB_plaintext)` → ciphertext+tag
3. Build a **Table of Contents**:
   ```json
   { "version": 2, "chunks": 8, "totalSize": 524288, "ivs": [[12,34,...], [56,78,...], ...] }
   ```
   IVs are stored as number arrays (or base64 strings — both work).
4. Pack it:

```
[4 bytes: header length] [JSON Table of Contents]
  for each part:
    [4 bytes: label length] [label] [4 bytes: encrypted length] [encrypted part]
```

One blob, many independently locked sub-parts. Huge files decrypt in parallel, each part's label stops swapping attacks.

> Code: server `handlers.ts:108` `encryptChunkV2`, web `src/lib/encryption.ts:197` `encryptLargeData`, CLI `cli/src/lib/transfer.ts:37` `encryptChunkCanonical`, and `decryptV2Canonical` in `res54.ts:84`.

## v3 — The Identity-Locked Safe

Future design, tied to *who* and *where*:

```
[3 bytes magic 0x52 0x45 0x03] [4 bytes: original length] [12 bytes IV] [ ciphertext + tag ]
```

*   Key is the per-chunk derived Chunk Key (section 2), not the raw key.
*   Label is `res54-v3|<your user ID>|<file ID>|<chunk index>|<total chunks>`

You can't move chunk #2 to position #5, or copy Alice's chunk into Bob's file — the label check would fail instantly.

> Code: `decryptV3` in `res54.ts:109`.

---

# 4. How Unlocking Tries Every Box

When you download, the code has no idea which box version was used years ago. So it bravely tries them in order:

1. If it smells like v3, try v3 with your user/file context.
2. If it looks like canonical v2, try canonical v2.
3. Try old v2.
4. Try legacy.

First success wins. If all fail, you get `Decryption failed (10528B, v2): ...` with the size and guessed version — the most useful clue for fixing key problems.

> Code: `decryptAny` in `res54.ts:144`.

If the key is wrong, every attempt's tag check fails — you get a clear error, not garbled data.

---

# 5. Where Does the Key Come From?

*   **Normal upload:** The server creates a fresh 32-byte random key → shows as 64 hex characters (`generateKeyHex()` → `randomBytes(32).toString('hex')`). That string is your file's secret.
*   **BYOK / Managed:** Sometimes the row says `managed_key` or `sha256:byok_encrypted` — those are *name tags*, not keys. Your device must ask the vault: `POST /functions/v1/file-key {fileId}` with your login token. The server checks "does this file belong to you?" and if yes, unwraps the real key and hands it back.
*   **The bouncer:** `isUsableKey` rejects name tags so the code knows when to go fetch the real one.

That's the whole journey: random key → lock with res54 → store locked bytes → later fetch locked bytes → unlock with same key.

---

# 6. The One-Sentence Summary

**res54 turns every file into small, labeled, locked boxes that only your key can open, and the label on each box is checked before opening — v3 even checks *whose* box it is and *where* it belongs.**

Keep this in mind and Doc 2 (the travel adventure) will make perfect sense.


\newpage

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


\newpage

# Welcome to the Control Center

If files are books and res54 is the secret code, the **backend** is the city that makes the library run: the ID office that checks who you are, the buildings where every record is stored, and the workers who do jobs when you ask. This city runs on **Supabase** at `https://aouqcwbdoyrccjcrhzzi.supabase.co` — a service that gives us a Postgres database, an ID system, background workers, and storage.

No building analogies that confuse — just what each part does and the exact code that does it.

---

# 1. The City's Buildings: 132 Tables

We asked the city's clerk `supabase_list_tables` and counted 132 tables in the `public` area.

*   **125 have locked doors** (`RLS enabled = true`) — you need the right key to enter.
*   **7 have no locks** (`RLS disabled`) — a warning sign says "fully exposed to anyone with the public anon key, don't auto-lock without adding proper rules!"

The 7 unlocked ones to fix soon: `storage_cleanup_log`, `user_redeem_codes`, `redeem_codes`, `kza_health_checks`, `passkey_challenges`, `kza_prel_hmac_keys`, `kza_ip_rate_buckets`.

## What the Important Buildings Hold

**Your stuff:**
*   `files` (2,536 rows) — every file card (id, name, size, encrypted, tags map, owner, workspace, deleted flag).
*   `folders` (716) — shelves (id, name, path, parent).
*   `workspaces` (178) — teams/reading rooms (`is_default`, `storage_backend`).
*   `workspace_members` (184) — who is in which room.
*   `file_key_vault` (2,399) — for `managed_key` files, the real key wrapped with a master key.
*   `upload_sessions` (22) — temporary sticky notes while uploading (deleted after 24h).

**Sharing:**
*   `shares` (86) — public links: `share_id, file_id, share_secret_hash, view_only, max_views, allowed_ips, burn_after_reading`.
*   `share_audit_logs` (68) — who viewed what, from where.

**You:**
*   `profiles` (168) — one per login, stores `storage_used, is_premium`.
*   `cli_devices` (11) — your CLI logins: `device_code, token_hash (SHA256 of token, never plain), status: pending/authorized/active, aal2_verified_at`.
*   `api_keys` (149) — your `cb_` keys: `key_hash = SHA256(salt+key), key_prefix, scopes`.

**The Security Agency (KZA — 20 tables):**
*   `kza_prel_registry` (59) — rulebook: for each worker, does it need a PREL token? Second factor? Which auth?
*   `kza_prel_f2fa_seeds` (8) — per-user second-factor seeds.
*   `kza_threat_events` (2,815) — every suspicious thing the detective noticed.
*   `kza_banned_entities` (9) — who got banned (IP or device, TEMP/PERMANENT, even shadow bans that fake a 404).
*   `kza_user_profiles` (11) — baselines: typical countries, hours, devices.

---

# 2. The 84 Workers (Edge Functions)

These are tiny programs living at `https://.../functions/v1/<name>`. You call them and they answer JSON.

| Worker | Job |
| :--- | :--- |
| `cloudbliss-api` | The main receptionist — `/files`, `/upload`, `/download`, `/folders`, `/shares`, `/keys`. Checks your workspace role, deducts API credits, logs every request. |
| `file-key` / `store-file-key` | Vault clerks — unwrap/store the real key after checking the file is yours. |
| `cli-oauth` | CLI login bouncer: makes device codes, checks TOTP is enrolled (must have verified TOTP or `TOTP_REQUIRED`), mints the opaque token. |
| `cli-totp` | Your phone-code buddy: checks the 6-digit code against the real secret (HMAC-SHA1 ±1 window), bans *device* not account on 3 fails. |
| `kza-prel` | Token factory: issues short-lived PREL leases after checking identity, geo-speed, and second factor. |
| `kza-sentinel` | The detective: scores requests for SQL injection, brute force, weird timing; decides YELLOW/RED/BLACK. |
| `squid-automation-engine` | Runs your YAML pipelines (jobs → steps). |
| `squidcloud-cluster` | Warehouse manager: picks B2 buckets, signs URLs. |
| `storage-backend` | Older chunk store helper. |
| `media-*` family | Turns videos into HLS streaming playlists. |

You call them like: `supabase.functions.invoke('squid-automation-engine', {body:{action:'list-scripts'}})`

---

# 3. How the City Knows It's You (Three Doors)

## Browser Login

In `src/integrations/supabase/client.ts:48`:

```ts
createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession:true, autoRefreshToken:true, flowType:'pkce' }
})
```

You type email + password → Supabase gives you an **access token** (JWT, ~1 hour) and a refresh token. The anon key is public — it's just the street address, not your house key. Env fallback in `supabaseEnv.ts:4` hard-codes the same public anon key so APK builds without a `.env` still boot.

## CLI Login (Device Code Dance)

1. CLI → `cli-oauth POST /device` with `machine_id` (a permanent UUID in `~/.squidcloud/device-id`) → gets `device_code` pending in `cli_devices`.
2. You approve in the browser at the verification link.
3. CLI loops `POST /device/poll` → **TOTP Gate:** server checks `auth.mfa_factors` for a verified TOTP; if none, returns `TOTP_REQUIRED` (enroll at `/account/settings`). No TOTP, no CLI. Hard rule.
4. Server mints a 64-hex random token, stores only `SHA256(token)`, returns the plain token. CLI saves it in the secret store (`~/.squidcloud/credentials` is now metadata only; secrets live in OS keychain → encrypted vault → 0600 plain fallback). CLI also gets `sb_token` (short Supabase JWT) for cluster downloads.

## The Second Lock (TOTP Step-Up)

For dangerous jobs (`host api`, `fs mount`, `keys add`, etc.), the CLI demands a fresh 6-digit code from your authenticator app:

*   CLI asks `cli-totp {action:"status"}` → are you enrolled? Is this device banned?
*   You type the code → `cli-totp {action:"verify", code:"123456"}` with `Authorization Bearer <token>` + `X-SquidCloud-Machine`. Server fetches your TOTP secret from `auth.mfa_factors` via direct SQL, does RFC 6238 (HMAC-SHA1, ±1 window, constant-time compare). Success → stamps `aal2_verified_at`, creates a fresh KZA seed for `cli-guard`. Fail 3 times in 5 min → inserts two `kza_banned_entities` rows: one for this **DEVICE** and one for the **MACHINE** — both PERMANENT (your account stays fine, only that laptop is burned).

The CLI then turns that seed into an 8-digit F2FA code: `SHA256(seed + "cli-guard" + window)` → xor three pieces → `%100M`, and swaps it at `kza-prel/gateway` for a 15-minute PREL lease bound to your IP+User-Agent. One try only — no retry loop.

---

# 4. The Bouncers (RLS)

Every building's door has a bouncer list called **Row Level Security**.

*   **Most (125):** Enabled with rules like `user_id = auth.uid()` — you see only your rows, or service-role-only (`USING false`) for KZA tables your browser never touches (only edge workers with `SERVICE_ROLE_KEY` get in).
*   **The 7 unlocked:** Anyone with the public anon key could read every row. The warning says: don't enable RLS without adding proper policies first, or the workers get locked out too. Add `USING` rules, then flip the switch.

Your browser never holds the service role key; only `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` inside workers does.

---

# 5. How the App Talks to the City

Three phone lines:

1.  **Supabase client** (`src/lib/supabaseEnv.ts` + `client.ts`): For rows and workers. `supabase.from('files').select(...)` goes through PostgREST (checks RLS). Or `supabase.functions.invoke('storage-backend', ...)`.
2.  **KZA PREL client** (`src/lib/kza-prel-client.ts`): For sensitive jobs, it first asks `kza-prel/gateway` for a lease, solving a tiny proof-of-work if challenged, then attaches `X-PREL-Token` to the real call. The worker's `withPrelGateway` helper validates it.
3.  **CloudBliss API** (`cli/src/lib/api/client.ts`): `https://squidcloud.vercel.app/api/v1` for CLI/host-server calls. Same token types, same bouncers.

---

# 6. Try It Yourself

You now know enough to explore with the Supabase tools:

*   Run `supabase_list_tables` yourself, pick a table, ask `verbose=true` for its columns.
*   Peek at `supabase_list_extensions`.
*   Call `supabase_get_advisors` to see the same security warnings live.

The city is yours to walk — just remember: keys stay with you, envelopes stay in warehouses, and the bouncers check every door.


\newpage

# Hey, Tool Builder!

You now know the secret language (Doc 1), how files travel (Doc 2), and how the city works (Doc 3). Now let's meet the **coolest toys** SquidCloud gives you, look under the hood at what languages built them, and learn the most important promise we make: **zero-knowledge — we can't read your files even if we wanted to.**

And we'll keep it simple: you already know what encryption, a chunk, and a key are.

---

# 1. The Three Super Tools

SquidCloud isn't just a website. It's a toolbox with three superpowers. You can use one, two, or all three — they all talk to the same locked files.

## 1.1 The Developer API (The Remote Control)

Imagine SquidCloud has a remote control with buttons. Developers can press those buttons from their *own* apps, not just our website. That remote is the **Dev API**.

*   **Where it lives:** `https://squidcloud.vercel.app/api/v1` — a set of URLs handled by the big receptionist worker `supabase/functions/cloudbliss-api` (see Doc 3). Read `supabase/functions/cloudbliss-api/handlers.ts` for every button.
*   **What you can do with it:**

    | Button (endpoint) | What it does |
    | :--- | :--- |
    | `POST /upload` + `POST /upload/complete` | Start and seal an encrypted upload (Doc 2's plan). |
    | `GET /download/:id` | Ask the server to decrypt and stream the file to you. |
    | `GET /download/:id?signed=true` | Ask for golden tickets + the key to decrypt *yourself* (no server sees plaintext). |
    | `GET /files` | List your files and folders (page 1, 50 per page, search). |
    | `DELETE /files/:id` | Soft-delete (flip `is_deleted` flag). |
    | `POST /keys` | Create a `cb_...` storage key for your own scripts. |
    | `GET /files/:id/metadata` | Peek at the treasure map (`tags[0]`). |

*   **How you prove it's you:** Send `Authorization: Bearer <your-token>` where the token is either your opaque CLI token (64 hex), a `cb_...` API key (lookup by 8-char prefix + `SHA256(salt+key)`), or a Supabase JWT. The receptionist checks `kza_prel_registry` rules, deducts your daily API credits (`deduct_api_credits` RPC), and checks your workspace role (`viewer < editor < admin < owner`).
*   **For you to try:** Open `src/pages/DeveloperAPI.tsx` — it's the interactive playground where you can click buttons and see the raw `curl` commands.

## 1.2 The CLI — `squidcloudctl` (Your Computer's Voice)

The CLI is a program you install in your terminal. Type `npm i -g squidcloudctl` (version `3.1.9`, entry `dist/bin/squidcloud.js`, type `module`). It lets your *computer* talk directly to SquidCloud without opening a browser.

*   **Where the code lives:** `cli/` — Node.js + TypeScript, built with `sucrase`. The binary is started with `squidcloud` or `squidcloudctl`.
*   **What it can do:**

    ```
    squidcloud files up photo.jpg        — encrypted upload (now true res54 v2!)
    squidcloud files dl <id>             — download + auto-decrypt to disk
    squidcloud files ls                  — list with numbered refs like #1, #2
    squidcloud fs mount                  — mount your cloud as a real drive folder!
    squidcloud host api                  — start a local API that mirrors the cloud
    squidcloud login                     — device-code dance + mandatory TOTP
    ```

*   **How it connects:** It reads `~/.squidcloud/credentials` (the secret store — OS keychain → encrypted vault → 0600 plain file) for your opaque token + anon key. Its API client is in `cli/src/lib/api/client.ts` — tiny wrapper around `fetch` to `https://squidcloud.vercel.app/api/v1` with `Authorization` and `apikey` headers, rate-limited to 170ms between calls, 3 retries on `429`.

    That client is the same one your browser uses, just from the terminal.

## 1.3 SquidFS — Your Cloud as a Real Folder (The Magic Mount)

This one feels like magic. SquidFS takes your cloud files and makes them appear as a normal folder on your computer — like `Z:` on Windows or `/mnt/squidcloud` on Linux — so *any* app (Photoshop, VS Code, your video player) can open them like local files.

*   **Where the code lives:** Not in this repo's `cli/` — it's a separate Go project at `~/squidfs` (module `github.com/NaveenSingh9999/squidfs`), but this repo *builds* it. The CLI's `ensureSquidFsBinary` always prefers a local build from `~/squidfs` (`go build -trimpath -ldflags "-s -w"`) over a cached or downloaded release.
*   **How it works:**
    1.  The CLI's `fs mount` command first ensures the **decryptor daemon** is running (`ensureDecryptor` — health-check reuse on `127.0.0.1:6763`).
    2.  It spawns the Go binary `squidfs -webdav -port 8099` as a child, passing it environment variables: `SQUIDCLOUD_API_KEY` (the `cb_...` storage key), `SQUIDCLOUD_AUTH_TOKEN`, `SQUIDCLOUD_DECRYPTOR=http://127.0.0.1:6763`, and `SQUIDCLOUD_DECRYPTOR_AUTH` (the session secret from `decryptor.json`).
    3.  The Go binary (`cmd/squidfs/main.go` → `internal/webdav/server.go`) becomes a tiny WebDAV file server. Your OS mounts it.
    4.  Every read (`downloadFileBytes`) does **zero crypto itself** — it just `GET http://127.0.0.1:6763/file/<id>` with the session header `X-SquidFS-Auth`. The Node decryptor does the real work (Doc 1's exact crypto chain) with 8 parallel workers, then hands back plaintext bytes. Range reads (`206`) are sliced from that.
    5.  The dashboard shows a violet card `HOST|<hostId>|<hostname>|6763|decryptor|DECRYPTOR` while it's alive.

Think of it: the Go engine is the *waiter*, the decryptor daemon is the *chef* who knows the recipe, and your apps are hungry customers who just see food arrive.

---

# 2. What It's Built With (The Tech Stack)

If SquidCloud were a Lego set, here are the brick types we used for each tool:

| Tool | Language | Main Bricks | Why That Brick? |
| :--- | :--- | :--- | :--- |
| **Website (this repo)** | **TypeScript + React** | `react@18.3`, `vite@5.4` (fast dev/bundle), `tailwindcss@3.4` + `framer-motion@12` (style & smooth moves), `react-router-dom@6` (pages), `react-query@5` (server data), `radix-ui` (accessible dialogs), `capacitor@7` (wraps the same web code into Android/iOS apps), `monaco-editor` (code editor), `hls.js` (video), `pdfjs-dist` (PDFs), `argon2-browser` (password stretching) | React is like great Lego Technic — lets us build a big, interactive website that feels like an app. Vite makes it rebuild in milliseconds. Capacitor puts that same website inside a phone app. |
| **Backend Workers** | **TypeScript on Deno** | `Deno std@0.168`, `supabase-js@2`, `aws4fetch` (signing B2 URLs), `@supabase/functions-js` | Deno is where edge workers run — close to you, fast to wake up. Same TypeScript you already know. |
| **Database** | **PostgreSQL via Supabase** | 132 tables, Row Level Security, Realtime, Auth (Supabase Auth with PKCE + TOTP), Storage | Postgres is a super-reliable filing cabinet that also checks IDs at every drawer. |
| **CLI** | **TypeScript on Node.js** | `node@24`, `sucrase` (transpiles TS → JS without needing `tsc` on Android!), `chalk` (pretty terminal colors) | Node lets the same crypto code run on your computer as in the browser. Sucrase keeps builds working even on a phone. |
| **SquidFS** | **Go** | `net/http` WebDAV, `zeroconf` mDNS, no CGO (static binary `CGO_ENABLED=0`) | Go makes a tiny, fast, single-file program that never needs installing extra stuff — perfect for a mount. |
| **Storage** | **S3-compatible** | Backblaze B2 pool via `AwsClient.sign` (in `squidcloud-cluster` and `squidveil-api`) | B2 is cheap, S3 speaks a standard language, so BYOS can plug in AWS, R2, Wasabi later. |
| **Crypto everywhere** | Same math, many homes | `@noble/ciphers` (AES), `@noble/hashes` (HKDF/SHA256)  — used in web `encryption.ts`, CLI `res54.ts`, daemon `decryptor.ts`, and Deno `handlers.ts` | One lock recipe, copied exactly to 4 places, so a file locked by one can be opened by any. |

**Build quirks you might smile at:** On Android (Termux), `tsc` is broken, so the CLI builds with `sucrase` and fixes the shebang to `#!/data/data/com.termux/files/usr/bin/node` and uses symlinks (not copies) so ESM can still find `node_modules`.

---

# 3. Zero-Knowledge: How We *Can't* Read Your Files Even If We Wanted To

You know encryption (Doc 1). Now the promise.

**Step-by-step why the server is blind:**

1.  You type a file. Your device locks it (Doc 1) *before* it hits the network.
2.  The locked blobs go to B2 via golden tickets. The server *helped* make the tickets but never saw the key (you got it in the `POST /upload` response and used it locally).
3.  The server inserts the `files` row with `tags[0].encryptionKey = the same key` *inside* the JSON map. But the server *stores* it — does it read it? The row is there, yes, but the *guarantee* is: the server never uses that key to decrypt chunks in the normal download path that returns `signed: true` (it just hands you tickets + key to decrypt *yourself*). Only if you call the non-signed `GET /download/:id` does the server decrypt on your behalf — and that path is what the web viewer uses when you *ask* it to. For CLI/SquidFS, the server hands you tickets and you decrypt locally (the decryptor daemon). The vault path (`file-key` with `managed_key` + `sha256:byok...`) adds an extra wrap so even the tags key is a placeholder.

**What that looks like in code:**

*   File row: `encrypted=true`, `encryption_key=''` (empty), `tags[0].encryptionKey = "9aaf5e3d..."` — the key is *in the map*, not a separate column you'd query.
*   The column `encryption_key` often holds `managed_key` → real key is in `file_key_vault` where it's wrapped with HMAC+AES-GCM under a master key the server holds but *your file's key* is only handed out after checking `files.user_id == resolved_user`.

**The check:** `supabase/functions/cloudbliss-api/handlers.ts` and `file-key/index.ts` both do:

```ts
if (fileRow.user_id !== userId) return 403 Forbidden
```

Try to fetch another user's signed manifest and you get "Forbidden", not a key.

**Can an admin with the service role read your file?** Technically the service role can read any row (bypasses RLS). That's why BYOK exists — to put a second lock whose key *never hits the DB* in plaintext at all, only as a hash or user-held secret. For standard files, trust is in the hosted platform not keeping copies of derived keys beyond the tags row (which you could BYOK to avoid).

For a 10-year-old: **We can see the locked treasure chest sitting on our shelf, and we know which shelf is yours, but the key is either in *your* pocket or in a safe that only opens when *you* show your ID.**

---

# 4. BYOS and BYOK: Bring Your Own...

These sound similar but do opposite jobs!

## BYOS — Bring Your Own *Storage*

Think: "I don't trust/like your warehouses, I have my own."

*   Normally your chunks go to SquidCloud's managed B2 buckets (the pool from `squidcloud_b2_buckets` + env `B2_*`).
*   With BYOS, you go to Settings → Storage Providers and add your *own* bucket: AWS S3, Cloudflare R2, Wasabi, Tebi.io, Google Cloud Storage, or any S3-compatible endpoint. You paste `accessKeyId`, `secretAccessKey`, `bucketName`, `endpoint`, `region`. Those creds are stored in `storage_providers` encrypted via `provider-vault` (not plain).
*   The pool builder (`loadAllBuckets` in `squidcloud-cluster` and in `cloudbliss-api/lib.ts` / `squidfs-bridge`) now includes *your* bucket when `storage_providers.user_id == you OR is_public`. Your next upload's `chunkPaths` round-robin will land on *your* warehouse.
*   Docs at `src/pages/docs/guides.ts` line ~189 (`Bring Your Own Storage`) say: AWS S3 / Backblaze B2 / Cloudflare R2 / GCP / Oracle show "Coming soon" or "Tebi.io works; R2 is stubbed" depending on `src/pages/docs/architecture.ts` flags — but the code path is real and ready.

Kid version: **BYOS = you pick whose garage the locked boxes are parked in. We still don't have the key.**

## BYOK — Bring Your Own *Key*

Think: "I don't trust even your sticky note that holds the key."

*   Normally the server generates the file's key and writes it into `tags[0].encryptionKey` (plus `managed_key` placeholder handling via vault). The platform *does* store the key, albeit alongside the ciphertext (separate logical place, but same database).
*   With BYOK enabled (toggle in `user_encryption_settings.settings` checked by `getBYOKRuntimePolicy` in `res54.ts:54`), your upload does:
    *   `resolveUploadEncryptionKey` asks you to pick: `saved` key id like `v3_byok_<uuid>` (a key HKDF-derived per-file from your saved BYOK master), `custom` typed-in secret, or `unique` per-file random + vault wrap.
    *   The file row then says `encryption_key = 'sha256:byok_encrypted'` (or `byok_encrypted` / `byok_protected`) and `tags[0].encryptionKey` stays that placeholder — *not* the real key.
    *   The raw key is stored via `store-file-key` into `encrypted_keys` wrapped with your PBKDF2 master, or for per-file `unique` via `file_key_vault`.

When you download a BYOK file:

*   The platform's `GET /download/:id` sees `isBYOK` true and demands you supply the key: `X-SquidCloud-Encryption-Key` header or `?encryption_key=` query, else 422 `BYOK file — provide encryption key`. It will *not* auto-unwrap for you.
*   The web's `res54.ts:930` detects BYOK, pops `requestEphemeralBYOKKey` (a dialog: "Enter key for this file"), tries it, and on wrong key you get a prompt again (deduped via `attemptedKeys` set).
*   The CLI's `transfer.ts:432` similarly has `askByokKey(fileName)` readline prompt, cached per run.

Kid version: **BYOK = you bring your *own* key blank and keep it in your pocket. We write "KEY NOT HERE — ASK OWNER" on the map. To open the box you must hand us the key each time, we use it and forget it.**

| You bring... | Where chunks live? | Where key lives? | Who can open? |
| :--- | :--- | :--- | :--- |
| Nothing extra | Our B2 pool | `tags[0].encryptionKey` in DB | Anyone with your login (we check owner, then hand key) |
| BYOS | *Your* Bucket | Still in `tags` (or vault if BYOK too) | Same, but even bucket operator sees only locked blobs |
| BYOK | Our pool (or yours if both) | **Nowhere on server in plaintext** — only wrapped, or not at all | Only someone who types the correct key that moment |
| BYOS + BYOK | Your bucket + your key | Neither on server usefully | Only you, on a trusted device, with both |

---

# 5. Try It Yourself!

You now know the toys and the tech:

*   Open `supabase/functions/cloudbliss-api/handlers.ts` and find `getOptionalEncryptionKey` — that's the BYOK gate.
*   Open `cli/src/lib/transfer.ts` and watch `encryptChunkCanonical` build the filing cabinet with your own eyes.
*   Run `squidcloudctl fs mount` and see the `Decryptor: http://127.0.0.1:6763` line — that's the chef handing plates to the waiter.

Next: the master doc stitches all four of these guides together!


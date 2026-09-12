---
title: "SquidCloud — Doc 4: Tools, Tech Stack & Zero-Knowledge Magic"
subtitle: "The Cool Tools You Get, The Languages That Built Them, and How We Keep Your Secrets Even From Ourselves"
author: "SquidCloud Team"
date: "2026-08-27"
lang: "en"
---

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


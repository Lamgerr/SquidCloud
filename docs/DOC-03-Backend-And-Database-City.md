---
title: "SquidCloud — Doc 3: The Backend & Database City"
subtitle: "How the City Hall, Buildings, and 84 Workers Keep Everything Working — Plain and True"
author: "SquidCloud Team"
date: "2026-08-27"
lang: "en"
---

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


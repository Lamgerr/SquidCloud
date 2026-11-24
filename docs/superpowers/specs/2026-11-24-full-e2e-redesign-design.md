# SquidCloud: Full E2E, Cross-Device, Hardened — Design

Date: 2026-11-24
Status: DRAFT v2 (revision after independent security review; awaiting approval)
Supersedes: v1 draft (had a contradictory key hierarchy and an unsafe migration step)

## 1. Intent and why

Requirements: (1) seamless UX with no backend errors in normal use; (2) permanent cross-device sync — log in anywhere and all files are there; (3) maximum hardening; (4) **full E2E** — the server never obtains a usable plaintext file key.

Current state fails (4): the client sends raw AES keys to `store-file-key`; the server wraps them under a KEK derived from `SQUIDVEIL_MASTER_KEY` / service-role key (`file-key/index.ts:35-45,99-102`). A DB admin with that env var decrypts everything. The "zero-knowledge" claims (`docs/security.ts:15,41`, `SecurityCenter.tsx:620`) are false today. A 2026-11-24 audit also found live critical RLS/RPC exposure (enumerable shares with keys and access codes, anon-callable SECURITY DEFINER key oracles, dead password checks, a public bucket, anon EXECUTE on token primitives).

"Zero information to hackers" is not literally achievable — access times, file counts and IPs leak. The precise goal is: **no plaintext keys, filenames, or content, and no useful metadata beyond what sync requires.**

## 2. Goals / non-goals / anti-goals

**Goals**
- G1: No server component, DB admin, or edge operator can decrypt a v2 file, even with a full DB dump and all server secrets.
- G2: Content, filenames and folder names encrypted client-side; server stores opaque object ids, padded sizes, coarse timestamps.
- G3: One unlock gesture per session on a new device (passkey) or one vault passphrase; no per-file key entry.
- G4: Ciphertext sync runs while locked; decryption is on-demand after unlock.
- G5: Share links are E2E — key wrapped with a 256-bit secret that exists only in the URL fragment.
- G6: Close every critical/high audit finding before cutover.

**Non-goals**
- Server-side content search, preview generation, thumbnails or AI on file contents (require plaintext). These become client-side or explicit per-file user-approved operations.
- Recovering data for a user who loses every unlock factor. There is no admin backdoor.

**Anti-goals**
- Server-held master keys, escrow, or "temporary" plaintext key paths that outlive migration.
- Trusting identity fields from request bodies.
- Hiding key material in tags, headers, or metadata.

## 3. Threat model

| Adversary | Capability | Must not get |
|---|---|---|
| DB admin / Supabase support | All tables, all env secrets | v2 plaintext keys, names, content |
| Compromised edge function or BFF | Arbitrary RPC, service role, can serve JS | Usable v2 keys; **code-delivery integrity limits this** |
| Network attacker | TLS observer | Beyond ciphertext and opaque ids |
| Share-link holder | One URL | Any other file; owner's vault |
| XSS **during an unlocked session** | Script in page origin | **Full plaintext compromise — stated honestly** |
| Malicious origin / CDN | Serves altered JS | Defeats browser E2E; mitigated by signed builds + isolated asset origin, not solved |
| Stolen locked device | Disk access | Anything until unlock |

## 4. Approaches considered

- **A. BFF proxy only.** Fixes token theft/RPC surface; fails G1 (server still holds KEK). Rejected as an endpoint.
- **B. Reuse the account password as the E2E secret.** Password is sent to Supabase Auth, so a compromised auth path derives every key. Fails G1. Rejected.
- **C. Random vault MK, wrapped per factor (passkey PRF + passphrase), behind a BFF.** Meets all four requirements. **Selected.**
- **D. OPAQUE/aPAKE replacing Supabase Auth.** Cryptographically cleanest but a full auth replacement; deferred, and it does not solve malicious-served-JS either.

## 5. Selected architecture

### 5.1 Key hierarchy (corrected)

A **random 256-bit Master Key (MK)** is generated once at vault creation. Unlock factors do not derive MK directly; they unwrap copies of it:

```
vault (per user):
  salt_rand            -- public, per user, random
  MK                   -- random 256-bit, NEVER stored in plaintext anywhere
  wrapped_MK[credId]   = AEAD(HKDF(PRF_output(credId, prf_salt), "mk-wrap"), MK, aad)
  wrapped_MK[pass]     = AEAD(HKDF(Argon2id(passphrase, pass_salt), "mk-wrap"), MK, aad)
  verifier             = HKDF(MK, "verify")     -- constant-time compare, no plaintext MK
  version              -- encodes KDF params + PRF transcript version + AAD format

per file:
  FK                   = random 256-bit per file
  content              = AES-256-GCM(FK, padded chunks)
  wrapped_FK           = AEAD(HKDF(MK, "file-wrap"), MK, aad(file_id,user_id,version))
  encrypted_name       = AES-256-GCM(HKDF(MK,"name"), filename, aad(folder_id))
```

- **PRF path:** WebAuthn `hmac-secret` with a **persisted, deterministic per-credential PRF salt** stored in the vault. A fresh salt per assertion would derive a different key and lose data; the salt is bound into AAD so the server cannot substitute one. One wrapped-MK blob is stored **per enrolled credential**, keyed by `credentialId`.
- **Passphrase path:** Argon2id ≥64 MiB, t≥3, p≥4 (tuned for mobile), per-user random salt. **Always enrolled** — it is a first-class factor, not a "fallback", because PRF support on synced passkeys varies by platform and browser. Verify current platform support before launch.
- **New-device ceremony:** sign in → enroll passkey (PRF) or enter passphrase → unwrap MK → all files unlock. Adding a second passkey rewraps **MK only**, never file keys.
- MK is held in a strong reference in a closure and explicitly zeroed on lock/pagehide. JS cannot guarantee memory scrubbing; say so. Do not use `WeakRef` (non-deterministic collection).

### 5.2 Revocation and rotation

- **Remove one device:** delete that credential's wrapped-MK blob and revoke its sessions. Does not rewrap file keys.
- **Rotate MK:** rewrap all FKs and encrypted names **client-side** on an authorized device. No server ever sees MK or FK. Previously downloaded plaintext cannot be clawed back — document.
- **Anti-rollback:** a monotonic, client-authenticated version manifest; reject a server response that rolls back vault version or wrapped-FK commitment.

### 5.3 BFF and request boundary

- Browser → `/api/*` only; Supabase URL/keys are not referenced from `src/`.
- Session = opaque, HttpOnly, Secure, SameSite=Strict cookie; refresh tokens never in JS. Bind to server-side session state with signature, `exp/iss/aud` verification, active-user check, and CSRF/Origin validation.
- **Two-layer authz:** the BFF uses a **user-scoped Supabase JWT with RLS on** for ordinary data access; service role is reserved for narrow admin operations. This preserves defense in depth if the BFF is compromised.
- Identity comes **only** from the verified session. Any body field named `userId`/`ownerId` is ignored or rejected (closes the `resolveActingUserId` confused-deputy pattern).
- Sensitive ops require step-up bound to the session and the specific key operation.
- AAD commits each wrapped FK to `file_id + user_id + version`, so a compromised BFF cannot swap a key the client will trust.

### 5.4 Sharing (single coherent model)

- Generate a random 256-bit share secret in-browser. Only a slow-hash verifier (Argon2id, per-share salt) is stored server-side if human-readable passphrases are required; the **raw secret travels only in the URL fragment** and is consumed by page JS, never typed into a server form.
- `shares.shared_encryption_key` holds only the FK wrapped with the share secret. A holder of the share id can fetch this blob, but it is useless without the fragment secret.
- **No password is submitted to the server for share access.** If a human passphrase is used, it is verified client-side against the verifier; the server only releases the wrapped blob and rate-limits attempts.
- Revocation: rotate `share_id`, delete verifier and wrapped blob. Copied ciphertext + secret cannot be revoked — document.
- Folder shares use a group key wrapped per recipient; membership changes rekey the group, not each file.

### 5.5 Metadata minimization and residual leakage

Encrypt names/folders; pad chunks to fixed sizes; bucket timestamps. Residual by design: account identity, coarse access times, file counts, recipient IPs, share graph. State this explicitly in docs instead of claiming "no information".

## 6. Phase 0 — containment (before E2E work, correct order)

1. **Rotate first:** all secrets reachable through the anon-callable `get_secret`, the PREL HMAC key (invalidating all PREL tokens), the hardcoded backfill token, and any secret in git history / HAR / keystore files. Purge history. This must precede grant revocation so an attacker who already rotated cannot persist.
2. **Deploy the replacement share gateway** (minimal, audited, takes share id + verifier, returns metadata only) before converting old functions to SECURITY INVOKER, otherwise legitimate recipients break.
3. `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` on: `get_shared_file_info`, `get_file_for_share`, `get_folder_share_contents`, `update_share_options`, `get_secret`, `kza_prel_sign_token`, `kza_prel_verify_token`, `kza_prel_rotate_hmac_key`, `create_file_record`, `public.exec_sql`.
4. Rewrite `shares` / `files` SELECT policies owner-only; remove `shared = true` and `EXISTS(shares...)` from direct table SELECT.
5. Rewrite share RPCs as `SECURITY INVOKER` with an explicit column allow-list; never return `shared_encryption_key`, `storage_path`, `file_tags`, `file_encryption_key`, `encryption_key`, or chunk URLs. Fix the dead `access_code` checks in `validate-share` / `download-shared-file`.
6. Set `files` bucket `public = false`.
7. Remove raw-key fallback (`res54.ts:782-791`, `FileUpdateService.ts:109-120`); backfill into vault and strip from tags.
8. Remove the JWT bypass in `file-key/index.ts:132-143`; route through PREL.
9. Audit all `verify_jwt=false` functions (34 found) — enable verification or add in-code auth for every one touching keys/shares/secrets. Fix `verify_vault_password` / unsalted SHA-256 gating. Fix CORS `*`, `admin-data-access` authz, webhook signatures, and KZA fail-open.
10. Replace the markdown blocklist sanitizer with DOMPurify + strict CSP.
11. Verify with `has_function_privilege(...)` checks and an anon share-access test; add a CI regression check that enumerates all definer/grants and all RPC/REST responses for key/path/tag columns.

## 7. Migration of existing files — honest limits

Legacy files were encrypted with keys the server can unwrap. **They are not E2E and cannot be made so without a brief trusted operation**: the BFF must unwrap the legacy key once, return it to the client over a step-up-protected channel, and the client immediately re-encrypts the plaintext under a new v2 FK and deletes the old ciphertext. After that operation, the file is E2E and an old DB dump is useless for the new ciphertext.

- Per-file state machine: `pending → uploading → v2_ready → cutover → legacy_deleted`, with idempotency keys and decrypt-and-verify before cutover.
- Per-user migration lease so two devices cannot race.
- Quota accounting must not double-count both copies.
- **Cutover decision:** disable the legacy path once all active users are migrated; inactive users' legacy files remain server-recoverable until they return. Document this residual gap plainly.
- Full E2E claim applies only to v2 files; never claim it for unmigrated legacy data.

## 8. Seamless UX contract

- One unlock gesture per session; passkey preferred, passphrase always available.
- Auto-lock on idle with a single-gesture re-unlock.
- Sync indicator shows queued/synced; sync continues while locked.
- New-device flow: sign in → unlock vault → files appear.
- Explicit UI states for migration, lock, offline, quota — "no backend errors" is aspirational, not a guarantee.
- Onboarding must state: losing all factors means permanent data loss; server cannot recover files.

## 9. Coverage beyond the browser

CLI, SquidFS, Electron/mobile shells, API keys, webhooks, AI/preview paths currently handle keys outside the browser. Each must either implement the same E2E protocol or be listed as an explicit server-visible-key exception. Existing `files.encryption_key`, `tags[0].encryptionKey`, and `is_byok` columns must be nulled/dropped for v2. Workspaces/groups need a group KEK wrapped per member and rekeying on membership change.

## 10. Verification / acceptance criteria

- Full DB dump + all server secrets cannot decrypt any v2 file (no KEK exists).
- `anon` cannot EXECUTE any key/share/secret/token function; CI asserts this.
- No RPC/REST/edge response contains `shared_encryption_key`, `storage_path`, `file_encryption_key`, `file_tags`, `encryption_key`, or chunk URLs.
- `files` bucket private; signed URLs only, issued by the BFF.
- XSS tests with `<svg onload>`, `<iframe srcdoc>` in shared markdown do not execute.
- PRF-salt stability, multi-passkey enrollment, new-device unlock, device/share revocation, migration interruption/concurrency/resume, CSRF, and compromised-BFF key-substitution tests all pass.
- Cross-device: upload on A, unlock on B with passkey only, file opens with no manual key entry.

## 11. Calls made (my decisions, open to correction)

- Passkey PRF primary + passphrase always enrolled — PRF support on synced credentials varies; passphrase guarantees recoverability of access across devices.
- BFF in front of Supabase, with user-scoped RLS inside it — keeps existing auth while adding a single enforcement point.
- Filenames/folders encrypted, sizes padded — accepts loss of server-side search/thumbnails.
- No recovery backdoor — required by full E2E.
- Legacy migration uses a bounded, audited trusted-server operation; full E2E applies to v2 only.

## 12. Open decisions for the human

1. **Cutover for inactive users:** keep the legacy KEK path alive so absent users can migrate later (leaves their old files server-readable), or switch it off at cutover and require those users to recover via a fresh upload? My recommendation: keep a tightly firewalled legacy path for a published sunset window, then remove it.
2. **Scope of "all clients":** must CLI/SquidFS/API/webhooks implement the full E2E protocol in this project, or are web + mobile first with other clients following? My recommendation: web + native mobile first; others explicitly gated behind the same protocol before they are re-enabled.

# SquidCloud: Wallet-Style Keys, iCloud-Style UX — Design

Date: 2026-11-24
Status: DRAFT v4 (awaiting approval; no code written)
Supersedes: v1 (contradictory hierarchy), v2 (factor-based vault), v3 (iCloud ADP device-approval)

## 1. Intent

The user wants wallet-style key ownership (self-custody, recovery phrase, no server keys), iCloud-style seamlessness, and explicitly does **not** want emergency cross-device access to require a long migration or heavy cellular data.

The resolution: **borrow the wallet key model, not the wallet UX.** The recovery phrase is the universal key, but it is used only at restore time. Daily use stays device-keystore based. Critically, **unlock is not migration** — a restored device can decrypt any single file on demand with no bulk key sync.

## 2. The key decision: deterministic per-file keys

```
Recovery phrase (24 words, BIP39-style wordlist)  -- shown once, never transmitted
        |
        v
   seed = PBKDF2-HMAC-SHA512(phrase, "squidcloud", 2048)     [BIP39-style]
        |
        v
   MK = HKDF(seed, "squidcloud/v4/master")                    [master key]
        |
        +--> HKDF(MK, "name")     -> name key
        +--> HKDF(MK, "share")    -> share key
        +--> HKDF(MK, "file", file_id, version) -> FK          [per-file key]
```

**There are no wrapped-FK blobs to sync.** Each file's key is derived from MK + its id. A new device with the phrase can open file #500 without first downloading keys for files #1–499. That is the direct answer to the cellular/emergency requirement.

Trade-offs, stated honestly:
- Losing MK means losing all files — same as any wallet, and the required cost of no server escrow.
- A deterministic FK means key rotation is a vault-wide re-encrypt (version bump). There is no per-file forward secrecy beyond what MK already provides — but the old wrapped-FK model also let MK unwrap every FK, so nothing is lost.
- File ids become key material inputs; they are already server-visible opaque ids. Store a random `key_salt` per user in the vault record and bind it into every derivation so the server cannot influence derivation by choosing ids.

## 3. Device model (iCloud-like daily experience)

**First device:** sign in → generate recovery phrase → confirm it → MK derived on-device → deviceKey stored in hardware keystore (Android Keystore / iOS Keychain / WebAuthn PRF on web) → `wrapped_MK[deviceId] = AEAD(deviceKey, MK, aad(user,device,version))` uploaded. Files sync invisibly.

**New device, normal:** sign in → pending-device request → existing unlocked device shows approve prompt (biometric/PIN) → MK sent via ephemeral ECDH through the server (server sees only public keys + ciphertext) → new device generates its own deviceKey, uploads its wrapped MK.

**New device, emergency / no other device:** sign in → "Restore with recovery phrase" → type 24 words → MK derived → **immediate on-demand access to every file**. No migration step, no bulk download. The only network traffic is the ciphertext of the file actually opened. This works on cellular.

**Browser without keystore:** WebAuthn passkey PRF as deviceKey (persisted per-credential salt); recovery phrase is always available as first-class restore.

## 4. Why migration is no longer a blocker

- **New (v2) files:** no migration exists. Deterministic keys mean instant restore.
- **Legacy files (created under the old server-KEK escrow):** they still need one-time re-encryption. This is strictly **background and optional**:
  - Incremental, per-file, resumable state machine: `pending → v2_ready → cutover → legacy_deleted`.
  - Wi-Fi only by default; explicitly opt-in on cellular; never blocks opening a file.
  - Until a file is migrated, opening it on a restored device makes **one small legacy-key fetch** for that file only — never a bulk sync.
  - Quota accounting must not double-count; verify decrypt before deleting legacy ciphertext.
- Full E2E is claimed only for v2 files; the legacy gap is documented until its sunset window closes.

## 5. Crypto details

- Recovery phrase: 24 words from a standard 2048-word list (256 bits entropy) with checksum — wallet-standard, portable, human-copyable.
- Derivations: HKDF-SHA256 with domain-separated info strings; `key_salt` per user bound into AAD.
- Content: AES-256-GCM, random 96-bit IV per chunk, fixed-size padded chunks (e.g. 1 MiB), AAD = `file_id | user_id | version | chunk_index | commitment`.
- Names/folders: AES-256-GCM with the name key, AAD binds parent id.
- Verifier: `HKDF(MK,"verify")`, constant-time compare, never a plaintext key.
- Recovery phrase verifier on server: slow-hash (Argon2id) of the *phrase-derived seed*, rate-limited; or omit entirely and simply attempt an unwrapping operation. No fast hash.
- Anti-rollback: monotonic vault version in an authenticated manifest; reject server responses that roll it back.

## 6. Threat model

| Adversary | Must not get |
|---|---|
| DB admin / full dump + all server secrets | Plaintext keys, names, content — no KEK exists |
| Compromised BFF | Usable v2 keys; AAD binding prevents key substitution; signed builds + strict CSP + isolated asset origin limit JS tampering |
| Network | Beyond ciphertext and opaque ids |
| Share-link holder | Anything except the shared file |
| XSS while unlocked | Full plaintext compromise — stated honestly; mitigated by CSP, DOMPurify, short unlock windows, step-up before key ops |
| Stolen locked device | Nothing until unlock |
| Lost recovery phrase | Unrecoverable — same as iCloud ADP; no backdoor |

## 7. Backend boundary (BFF)

- Browser talks only to `/api/*`; Supabase URL/keys absent from `src/`.
- Session = opaque HttpOnly, Secure, SameSite=Strict cookie + server-side session state; CSRF/Origin checks.
- BFF uses a user-scoped Supabase JWT with RLS on for data; service role only for narrow admin ops.
- Identity only from verified session; body `userId`/`ownerId` ignored/rejected.
- Sensitive ops require step-up bound to session and operation.

## 8. Sharing

- Random 256-bit share secret, URL fragment only, consumed by share-page JS.
- FK wrapped with share secret; server stores wrapped blob + slow verifier; no password submitted to server.
- Revocation rotates share id and deletes wrapped blob; copied ciphertext + secret cannot be revoked.
- Folder shares: group key wrapped per recipient; rekey on membership change.

## 9. Phase 0 — containment before E2E work (correct order)

1. Rotate secrets reachable via anon `get_secret`, PREL HMAC key (invalidate tokens), hardcoded backfill token, git-history secrets; purge history.
2. Deploy a minimal audited share gateway before locking down old RPCs.
3. Revoke EXECUTE from `PUBLIC, anon, authenticated` on: `get_shared_file_info`, `get_file_for_share`, `get_folder_share_contents`, `update_share_options`, `get_secret`, `kza_prel_sign_token/verify/rotate`, `create_file_record`, `exec_sql`.
4. Owner-only `shares`/`files` SELECT policies; remove `shared = true` and `EXISTS(shares...)`.
5. Share RPCs → `SECURITY INVOKER`, explicit allow-lists; never return keys, `storage_path`, tags, chunk URLs. Fix dead `access_code` checks.
6. `files` bucket private.
7. Remove raw-key fallback (`res54.ts:782-791`, `FileUpdateService.ts:109-120`), backfill and strip tags.
8. Remove JWT bypass (`file-key/index.ts:132-143`); route through PREL.
9. Audit all `verify_jwt=false` functions; fix CORS `*`, admin authz, webhook signatures, KZA fail-open, unsalted vault password.
10. DOMPurify + strict CSP for markdown.
11. CI regression: enumerate grants/definers; assert no response contains key/path/tag columns.

## 10. UX contract

- Daily: sign in → files appear. Keys never surface.
- First use: generate and confirm recovery phrase once.
- New device: approve from existing device, or restore with phrase.
- Emergency restore: phrase → open any file immediately, on cellular, without migration.
- Sync indicator shows queued/synced; background migration is opt-in on cellular and never blocks access.
- Auto-lock with biometric/PIN; explicit lock/offline/quota states.
- Onboarding: losing every device and the phrase means permanent loss; server cannot recover.

## 10a. Lost / broken device: account recovery vs vault recovery

**Two separate locks — never conflate them in UI or copy:**

| Lock | What it protects | How it is recovered |
|---|---|---|
| **Account** | Signing in to SquidCloud | Email/password reset, OAuth, or synced passkey. The server *can* reset this — it is not tied to file encryption. |
| **Vault (MK)** | Decrypting files | Recovery phrase, an approved existing device, or social recovery shares. The server **cannot** reset this. |

A user who loses a device must always be able to get back into the *account*. Whether they get their *files* back depends on which vault factors survive. The UI must say which lock is being recovered at each step, or users will think they are locked out when only the account needs resetting.

### Recovery matrix

| Situation | Result |
|---|---|
| Device lost, recovery phrase available | Restore phrase on new device → **full access immediately**, any file, on cellular. |
| Device lost, another approved device available | Approve new device from existing one → **full access**, phrase never needed. |
| Phone replaced but passkey was platform-synced (iCloud Keychain / Google Password Manager) | New device obtains the passkey; if PRF output is stable and a wrapped-MK blob exists for that credential, **silent unlock**. Platform support varies — never the only path. |
| Device lost, phrase lost, trusted contacts enrolled | Social recovery (below) → **full access** after quorum. |
| Device lost, phrase lost, no contacts | **Files are permanently unrecoverable.** Account can be reset and used as a new, empty vault. This is the iCloud-ADP-equivalent truth and must be stated in onboarding. |
| Device stolen but still unlocked | Remote-revoke that device: delete its wrapped-MK blob, revoke sessions, trigger re-approval. Already-downloaded plaintext cannot be recalled. |
| Server unavailable during restore | Phrase still derives MK, but ciphertext cannot be fetched; show "offline — cached files only". |

### Social recovery (recommended second factor for the "neither" case)

- Split MK with **Shamir secret sharing**, threshold **3-of-5** by default.
- Shares are given to trusted contacts (who see opaque codes, never the user's data) or stored in independent places: password manager, printed sheet, hardware key, email to self.
- A share alone reveals nothing. The server stores only encrypted share envelopes and never holds enough shares to reconstruct MK.
- Recovery ceremony: new device collects 3 shares → reconstructs MK → generates a new deviceKey → uploads a new wrapped-MK blob. Contacts are notified and their shares are rotated (new shares of the same MK) so a past holder cannot retry later.
- Recovery must require the account login too — a share holder cannot enter without the account. Rate-limit and audit every recovery attempt.
- Threat: colluding contacts. 3-of-5 means 3 must collude; document this honestly. Offer 2-of-3 or 5-of-7 at setup.

### Recovery passphrase envelope (optional, for users who won't store a phrase)

- Store `AEAD(Argon2id(recovery_passphrase, salt), MK)` on the server.
- The passphrase is **never transmitted**; the server holds only the wrapped blob. This remains E2E.
- Must be distinct from the account password (which *is* sent to Supabase Auth) — reuse would break E2E. Enforce at setup by rejecting a match.
- Argon2id ≥64 MiB, t≥3, p≥4 + BFF rate limits, because a low-entropy passphrase is an offline brute-force target if the DB leaks.
- This is for convenience, not a replacement for the phrase; recommend users store both.

### Lost-device operational flow

1. User signs in on new device → account lock opens.
2. App detects no deviceKey for this device → shows "Unlock your vault" with three paths: approve from existing device, enter recovery phrase, start social recovery.
3. On success: generate new deviceKey, upload wrapped MK, mark device trusted.
4. Offer a one-time "review your recovery setup" screen — confirm contacts/phrase still valid.
5. If all paths fail: offer "Start a new empty vault" with explicit warning that old files cannot be recovered. Never silently discard old data.

### Device revocation and rotation

- Removing a device: delete its wrapped-MK blob, revoke its sessions, require re-approval for that device id. No re-encryption of files.
- Rotating MK (e.g. suspected compromise): rewrap all per-file keys **client-side** on an unlocked device; no server ever sees MK. Old devices' cached plaintext remains a residual risk — document.
- Rotating the recovery phrase: re-wrap MK under the new seed; file keys untouched.
- Social shares rotate after every recovery; contacts must be re-issued new shares.

## 11. Coverage

Web + native mobile first. CLI, SquidFS, Electron, API keys, webhooks, AI/preview paths must implement the same E2E protocol or stay gated. Workspaces need a group KEK wrapped per member. Null/drop `files.encryption_key`, `tags[0].encryptionKey`, `is_byok` for v2.

## 12. Verification

- Full DB dump + all server secrets cannot decrypt v2 files.
- `anon` cannot EXECUTE key/share/secret functions; CI asserts.
- No RPC/REST/edge response contains keys, paths, tags, chunk URLs.
- `files` bucket private; signed URLs only.
- XSS payloads in shared markdown do not execute.
- Tests: phrase checksum/derivation stability, device approval, phrase restore, device removal, MK rotation, migration interruption/resume on Wi-Fi vs cellular, CSRF, key substitution by malicious BFF, locked-device sync.
- Cross-device: upload on A, restore on B with phrase only, open file #500 on cellular without waiting for migration.

## 13. Decisions made (mine, open to correction)

- Wallet-style 24-word phrase as the universal recovery secret; wallet *key model*, not wallet *UI* (no token/chain language).
- Deterministic per-file key derivation — eliminates wrapped-FK sync and makes emergency restore instant.
- Migration is background-only, Wi-Fi-first, never a blocker.
- No server recovery backdoor; iCloud-ADP-equivalent loss semantics.
- Web + mobile first; other clients gated.

## 14. Open decisions for the human

1. Recovery factors at launch: phrase + synced passkey + optional 3-of-5 social recovery and recovery-passphrase envelope? My recommendation: all four, with social recovery offered during onboarding rather than bolted on later — it is the only path that helps when both device and phrase are gone.
2. Web + mobile first vs all clients at once? My recommendation: web + mobile first.
3. Legacy cutover: sunset window vs immediate shutdown? My recommendation: published sunset window.

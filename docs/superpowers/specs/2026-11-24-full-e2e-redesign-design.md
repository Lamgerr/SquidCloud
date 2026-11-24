# SquidCloud: Wallet-Style Keys, iCloud-Style UX — Design

Date: 2026-11-24
Status: DRAFT v5 — maximum-hardening pass (awaiting approval; no code written)
Supersedes: v1 (contradictory hierarchy), v2 (factor-based vault), v3 (iCloud ADP device-approval), v4 (deterministic keys + recovery)

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

---

# 15. Maximum-hardening pass (v5)

## 15.0 The honest bar

No system is unbreakable. The realistic target is: **a successful attacker must obtain one of a small set of expensive things** — the user's unlocked device, the user's recovery phrase/share quorum, or control of the code-delivery pipeline. A database dump, a stolen service-role key, a compromised BFF, or a network position must be worthless on its own.

Anything that violates that is rejected even if it improves convenience.

## 15.1 Hardening layers — and why each is invisible to users

| Layer | Control | User-visible? |
|---|---|---|
| Data | Per-file deterministic keys, AES-256-GCM, random IVs, AAD binding file/user/version/chunk | No — decrypt on open |
| Keys | No server KEK anywhere; phrase-derived MK in device keystore; wrapped MK per device | One-time phrase setup only |
| Code | Signed, reproducible builds; SRI; isolated immutable asset origin; strict CSP | No |
| Session | HttpOnly cookie, server-side session, short TTL, step-up for key ops, CSRF | No — biometric re-unlock only |
| Server | BFF with user-scoped RLS; service role never touches file data; no key columns in any response | No |
| Recovery | 3-of-5 Shamir, rate limits, notifications, share rotation | Setup once; recovery only |
| Detection | Audit logs, anomaly alerts, canary files, bug bounty | No |
| Operations | Key/version rotation, incident runbooks, third-party crypto audit | No |

## 15.2 Code-delivery integrity — the real ceiling of browser E2E

A browser E2E app is only as strong as the JavaScript it serves. If an attacker can alter the bundle, they harvest keys in the unlocked tab. Controls:

- **Reproducible builds** with pinned toolchain and lockfile; a third party can rebuild and compare hashes.
- **Signed release artifacts** with an offline signing key; signatures verified by CI and at deploy.
- **Subresource Integrity** on every script/style; no third-party scripts on the app or share page — ever.
- **Immutable, isolated static asset origin** with deploy credentials separate from the BFF and database. A BFF compromise must not permit shipping new JS.
- **Strict CSP** (`script-src 'self'` with hashes, no `unsafe-inline`, `object-src 'none'`, `frame-ancestors 'none'`, `require-trusted-types-for 'script'`).
- **Certificate pinning / transparency logs** in native mobile clients.
- Two-person review + signed commits for all files under `src/lib/crypto*` and `supabase/functions/*key*`.

## 15.3 Runtime and memory hygiene

- MK and FKs are derived/used inside a closure; never in React state, Redux, global variables, DOM attributes, or `localStorage`/`sessionStorage`/IndexedDB.
- Use **non-extractable WebCrypto `CryptoKey` objects** where possible so a script cannot read raw key bytes via `crypto.subtle.exportKey`.
- Zeroize derived byte arrays after use; zero on lock, pagehide, and tab background timeout. JS cannot guarantee physical memory scrubbing — document.
- Never log key material, wrapped keys, recovery shares, or decrypted content. Log only operation names, ids, and outcomes.
- Disable source maps in production; strip devtools-friendly debug globals.
- Auto-lock on idle (default 5 min, configurable), on tab hidden for extended period, and on network change to an untrusted network.
- Step-up (biometric/passkey/PIN) immediately before: reveal phrase, add/remove device, social recovery, MK rotation, share creation.

## 15.4 Crypto engineering requirements

- One reviewed crypto module; no ad-hoc `crypto.subtle` calls scattered through components.
- Domain-separated HKDF info strings and a format version byte in every ciphertext/wrapped blob.
- Random 96-bit IV per encryption; reject reused IVs. Derive IV from a CSPRNG, never from ids or counters.
- AAD on every AEAD operation: `user_id | file_id | version | chunk_index | commitment`. Decrypt fails closed on mismatch.
- Constant-time comparison for verifiers; rate-limit verifier checks.
- Argon2id ≥64 MiB, t≥3, p≥4 for passphrase paths; tune for low-end mobile and re-benchmark each release.
- Public `key_salt` bound into AAD so a server cannot substitute a salt it knows.
- Anti-rollback: authenticated monotonic version manifest; reject stale wrapped keys and stale vault versions.
- Independent cryptographic review and published test vectors before launch.

## 15.5 Server and database hardening

- No server component ever holds a usable plaintext key, recovery share, or plaintext name. Enforce with CI checks scanning all edge functions and RPC definitions for key-returning columns.
- BFF uses user-scoped JWT + RLS for all file data; service role only for narrow admin operations, never for reading file rows.
- All identity from verified session; reject body-supplied `userId`/`ownerId`.
- Every RPC/REST/edge response allow-listed; no `SELECT *`, no `row_to_json(f)` on files.
- Private storage bucket; signed, short-lived, user-bound URLs only.
- Secrets in a managed vault with rotation runbooks; no secrets in git, CI logs, edge function source, or mobile bundles.
- Network/egress allowlists for admin surfaces; MFA + hardware keys for all operator accounts.

## 15.6 Recovery hardening

- 3-of-5 Shamir by default; shares are opaque, per-device, and rotated after every recovery.
- Recovery requires account login + quorum + step-up; notify all devices and contacts on start and completion.
- Rate-limit and progressively back off recovery attempts; alert on unusual patterns.
- Optional recovery-passphrase envelope is Argon2id-wrapped and never transmitted; reject reuse of the account password.
- Never let support staff trigger or bypass recovery — no social-engineering path exists.
- Document that colluding contacts (3-of-5) or physical coercion can defeat recovery controls.

## 15.7 Detection and response

- Structured audit events: unlock, device added/removed, share created/revoked, recovery started/completed, key rotation, failed verifier attempts. No key material in logs.
- Anomaly alerts: new device + immediate bulk download, repeated failed verifier checks, recovery from new IP, unusual share creation volume.
- Canary files in each vault whose access triggers an alert.
- Incident runbooks: BFF compromise, build-pipeline compromise, contact collusion, lost phrase, extortion attempt.
- Public bug bounty with a clear safe-harbor and a crypto-specific scope.

## 15.8 UX-preservation contract (non-negotiable)

Every hardening above must satisfy: **no extra taps in the normal path.**
- Daily use: sign in → unlock (biometric/passkey) → files appear. Nothing else.
- New device: approve from existing device (one tap) or phrase restore.
- Emergency: phrase → open any file immediately on cellular; no migration wait.
- Background migration, key rotation, audit, and alerts are silent.
- The only unavoidable user burden is **one-time recovery setup** (phrase + optional contacts), matching iCloud ADP.

## 15.9 Residual risks — stated plainly

1. **XSS in an unlocked tab** can read plaintext. Mitigated by CSP/SRI/DOMPurify, not eliminated.
2. **Malicious code-delivery** defeats client E2E. Mitigated by signed reproducible builds and an isolated asset origin; a state-level supply-chain attack remains possible.
3. **Physical coercion** of an unlocked device cannot be defended by cryptography.
4. **Lost phrase + lost quorum** = permanent loss; support cannot help. Required for E2E.
5. **Metadata** (identity, coarse timing, counts, IPs) remains visible to the service.
6. **Legacy unmigrated files** remain server-recoverable until re-encrypted.
7. **Already-downloaded plaintext** on a revoked/stolen device cannot be clawed back.

## 15.10 Priority order for implementation

1. Phase 0 containment (section 9) — closes live critical exposure.
2. Crypto core + deterministic keys (sections 2–5) — the E2E foundation, with third-party review.
3. BFF + session/cookie + code-integrity controls (sections 7, 15.2, 15.3).
4. Device lifecycle + recovery (sections 3, 10a, 15.6).
5. Sharing (section 8).
6. Legacy migration (section 7).
7. Detection/response + audit + bug bounty (15.7).
8. Other clients and workspaces (section 11).


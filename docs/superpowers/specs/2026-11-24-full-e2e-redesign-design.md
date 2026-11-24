# SquidCloud: iCloud-Style Full E2E — Design

Date: 2026-11-24
Status: DRAFT v3 (awaiting approval; no code written)
Supersedes: v1 (contradictory key hierarchy), v2 (factor-based vault)

## 1. Intent — what "like iCloud / Google Drive" means

The user wants the *experience* of iCloud/Drive: sign in, files are just there, everything syncs silently across devices, no key management visible — plus full E2E and maximum hardening.

Honest constraint: **Google Drive is not E2E** — Google holds the keys and can read files. iCloud by default is also not fully E2E; **iCloud Advanced Data Protection (ADP)** is the mode where Apple can't decrypt. So "exactly like both + full E2E" is impossible. The correct model to copy is **iCloud ADP's UX with a stricter key model**:

- Device generates keys; hardware-backed keystore protects them.
- Server stores only ciphertext and wrapped keys; no server-held KEK exists.
- New device is approved from an existing device (or a recovery key) — no manual key typing in normal use.
- Sync runs in the background, including while locked; decrypt happens on access.

## 2. Requirements mapped to design

| Requirement | How it is met |
|---|---|
| Seamless UX | Keys live in device keystore; user only signs in and taps "Approve this device" on an existing device. No passphrase in daily use. |
| Permanent cross-device sync | Ciphertext + per-device wrapped MK sync through the BFF; independent of unlock state. |
| Maximum hardening | Per-file keys, hardware-backed device keys, AAD binding, no server KEK, recovery key held only by user, strict RLS behind BFF. |
| Full E2E | Server never sees plaintext keys, filenames or content; no recovery backdoor. |

## 3. Non-goals / anti-goals

- No server-side content search, thumbnails or AI on file contents.
- No admin recovery. Losing all devices **and** the recovery key means permanent data loss — same as iCloud ADP.
- No "temporary" plaintext key path that survives onboarding.
- No trust in body-supplied identity fields.

Residual metadata that cannot be hidden: account identity, coarse access times, file counts, recipient IPs. State this in docs; do not claim "zero information".

## 4. Architecture

### 4.1 Key hierarchy (iCloud ADP-style)

```
On first device at vault creation:
  MK          = random 256-bit master key, generated on-device
  RK          = random 256-bit recovery key, shown once as a 24-word phrase / QR
  deviceKey   = generated and stored in the device's secure keystore
                 (Android Keystore / iOS Keychain / WebAuthn PRF on web)

Stored on server (all ciphertext-only, no usable plaintext):
  wrapped_MK[deviceId] = AEAD(deviceKey, MK, aad(user_id, device_id, version))
  wrapped_MK[RK]       = AEAD(HKDF(Argon2id(RK, salt), "recovery"), MK, aad)
  verifier             = HKDF(MK, "verify")   -- constant-time, no plaintext
  salt, version        -- public; version encodes KDF params + AAD format

Per file:
  FK            = random 256-bit per file
  content       = AES-256-GCM(FK, fixed-size padded chunks)
  wrapped_FK    = AEAD(HKDF(MK,"file"), FK, aad(file_id,user_id,version,chunk_commit))
  name/folders  = AES-256-GCM(HKDF(MK,"name"), name, aad(parent_id))
```

- No master KEK exists on any server. There is nothing for a DB admin to derive.
- Per-file keys mean one compromised file does not expose the vault.
- Random 96-bit IV per encryption; AAD binds file/user/version/commitment so a malicious server cannot swap keys.
- MK lives in memory only while unlocked; zeroed on lock/pagehide (JS cannot guarantee memory scrubbing — documented).

### 4.2 Device lifecycle — the iCloud-like part

**First device (vault creation)**
1. Sign in to the account (session auth only).
2. Generate MK + recovery key on-device.
3. Store deviceKey in the hardware keystore; upload wrapped MK copies.
4. Show the recovery key once with a confirmation step. Files begin syncing invisibly.

**New device — normal path (no typing)**
1. Sign in on the new device.
2. It registers a pending device request with a short code.
3. An existing unlocked device shows an approval prompt; user taps approve (biometric/PIN).
4. Existing device sends MK wrapped with an ephemeral ECDH key agreed between devices through the server (server sees only public keys and ciphertext).
5. New device unwraps MK, generates its own deviceKey, uploads its wrapped MK copy, deletes the transient request.

**New device — no existing device available**
1. Sign in → enter the 24-word recovery key (or scan its QR).
2. Derive recovery KEK → unwrap MK → generate new deviceKey → upload wrapped copy.
3. This is the only case where the user types a secret, matching iCloud's recovery-key flow.

**Browser without a keystore:** use WebAuthn passkey PRF with a persisted per-credential salt as the deviceKey; require passphrase/recovery key enrollment as first-class fallback because PRF support on synced passkeys varies.

### 4.3 Sync while locked

Sync is pure ciphertext movement through the BFF and requires no keys. Queued uploads/downloads run in a background worker while the vault is locked. On unlock, the client decrypts names and content on demand. This is exactly iCloud's behavior.

### 4.4 Revocation and rotation

- **Remove a device:** delete its wrapped-MK blob and revoke its sessions. Its cached plaintext cannot be recalled — document.
- **Rotate MK/recovery key:** rewrap all FKs and names **client-side** on an unlocked device; no server ever sees MK or FK. Add anti-rollback version manifest.
- **Recovery key rotation:** unwrap MK with old RK, wrap with new RK, delete old blob — file keys untouched.

### 4.5 Sharing

- Random 256-bit share secret generated in-browser; only in URL fragment.
- FK wrapped with share secret; server stores only the wrapped blob and a slow verifier.
- Any holder of the share id may fetch the wrapped blob — it is useless without the fragment secret.
- Share page JS consumes the fragment; no password is sent to the server.
- Revocation rotates the share id and deletes the wrapped blob; copied ciphertext + secret cannot be revoked.
- Folder shares use a group key wrapped per recipient; membership changes rekey the group.

## 5. Backend boundary (BFF)

- Browser talks only to `/api/*`; Supabase URL and keys never appear in `src/`.
- Session = opaque HttpOnly, Secure, SameSite=Strict cookie + server-side session state; CSRF/Origin validation.
- The BFF uses a **user-scoped Supabase JWT with RLS on** for data access; service role only for narrow admin ops.
- Identity comes only from the verified session; body `userId`/`ownerId` ignored/rejected.
- AAD binds wrapped keys to file/user so a compromised BFF cannot substitute keys.
- Signed, reproducible builds; strict CSP; isolated immutable asset origin — a malicious origin serving altered JS defeats browser E2E, so this is a hard requirement, not a nice-to-have.

## 6. Phase 0 — containment before E2E work (correct order)

1. Rotate secrets reachable via anon `get_secret`, PREL HMAC key (invalidate tokens), hardcoded backfill token, secrets in git history/HAR/keystore; purge history.
2. Deploy a minimal audited share gateway before locking down old RPCs, so recipients are not broken.
3. Revoke EXECUTE from `PUBLIC, anon, authenticated` on: `get_shared_file_info`, `get_file_for_share`, `get_folder_share_contents`, `update_share_options`, `get_secret`, `kza_prel_sign_token/verify/rotate`, `create_file_record`, `exec_sql`.
4. Owner-only `shares` / `files` SELECT policies; remove `shared = true` and `EXISTS(shares...)` from direct table SELECT.
5. Rewrite share RPCs as `SECURITY INVOKER` with explicit allow-lists; never return keys, `storage_path`, tags, chunk URLs. Fix dead `access_code` checks.
6. Make `files` bucket private.
7. Remove raw-key fallback in `res54.ts:782-791` / `FileUpdateService.ts:109-120`; backfill and strip tags.
8. Remove JWT bypass in `file-key/index.ts:132-143`; route through PREL.
9. Audit all `verify_jwt=false` functions; fix CORS `*`, admin authz, webhook signatures, KZA fail-open, unsalted vault password gating.
10. DOMPurify + strict CSP for markdown.
11. CI regression: enumerate grants/definers and assert no RPC/REST response contains key/path/tag columns.

## 7. Migration of legacy files

Legacy files are not E2E. The BFF must unwrap the old key once under a step-up-protected channel, return it to the client, which re-encrypts plaintext under a new v2 FK and deletes the old ciphertext. After that the file is E2E and an old DB dump is useless for the new ciphertext.

- State machine: `pending → uploading → v2_ready → cutover → legacy_deleted`, idempotent, decrypt-and-verify before cutover.
- Per-user migration lease; quota must not double-count.
- Full E2E is claimed only for v2 files. Legacy gap documented until the sunset window closes.

## 8. UX contract

- Daily use: sign in → devices approve silently → files appear. No key management UI.
- First use: one-time recovery key setup with confirmation.
- New device: approve from existing device (one tap) or recovery key if no device available.
- Auto-lock with biometric/PIN re-unlock.
- Background sync indicator; offline queue.
- Explicit states for migration, lock, offline, quota.
- Onboarding states the iCloud-ADP-like truth: losing every device and the recovery key means permanent loss; the server cannot help.

## 9. Coverage

Web + native mobile first. CLI, SquidFS, Electron, API keys, webhooks and AI/preview paths must either implement the same E2E protocol or be explicitly gated off until they do. Workspaces/groups require a group KEK wrapped per member and rekey on membership change. Existing key columns (`files.encryption_key`, `tags[0].encryptionKey`, `is_byok`) nulled/dropped for v2.

## 10. Verification

- DB dump + all server secrets cannot decrypt v2 files (no KEK exists).
- `anon` cannot EXECUTE key/share/secret functions; CI asserts.
- No RPC/REST/edge response contains keys, paths, tags, or chunk URLs.
- `files` bucket private; signed URLs only.
- XSS payloads in shared markdown do not execute.
- Device approval flow, recovery-key flow, device removal, MK rotation, migration interruption/resume, CSRF, malicious-BFF key substitution all tested.
- Cross-device: upload on A, approve B from A, file opens on B with no manual key entry.
- Locked-device sync test: queued uploads complete while locked.

## 11. Decisions made (mine, open to correction)

- iCloud ADP is the model; Google Drive's key model is explicitly rejected because it is not E2E.
- Recovery key is shown once at vault creation; device approval is the normal onboarding path.
- Web uses WebAuthn PRF as a deviceKey with passphrase/recovery as first-class fallback.
- No server recovery backdoor.
- Legacy migration uses a bounded trusted operation; E2E applies to v2 only.

## 12. Open decisions for the human

1. Recovery method: 24-word phrase only, or also trusted contacts / printed QR? My recommendation: phrase + QR at launch; trusted contacts later.
2. Scope: web + mobile first (other clients gated), or all clients at once? My recommendation: web + mobile first.
3. Legacy cutover: sunset window for inactive users, or immediate shutdown? My recommendation: published sunset window.

# SquidCloud: Wallet-Style Keys, iCloud-Style UX — Design

Date: 2026-11-24
Status: DRAFT v10 — EXTREME ZERO-KNOWLEDGE + SEALED PREVIEW (awaiting approval; no code written)
Supersedes: v1–v6 and `2026-11-24-web-isolation-design.md` (merged into §16). Single canonical security design. §17 adds key transparency, forward secrecy, crypto-shredding and supply-chain hardening; §18 makes protection silent and automatic (the "Principal and Protection Detail" rule); §19 defines hard zero-knowledge invariants enforced by CI; `2026-11-24-preview-and-residual-hardening.md` is the companion spec for the sealed preview modal and residual-risk closure.

## 1. Intent

The user wants wallet-style key ownership (self-custody, recovery phrase, no server keys), iCloud-style seamlessness, and explicitly does **not** want emergency cross-device access to require a long migration or heavy cellular data.

The resolution: **borrow the wallet key model, not the wallet UX.** The recovery phrase is the universal key, but it is used only at restore time. Daily use stays device-keystore based. Critically, **unlock is not migration** — a restored device can decrypt any single file on demand with no bulk key sync.

## 2. The key decision: per-file random salts (crypto-shreddable)

```
Recovery phrase (24 words, BIP39-style wordlist)  -- shown once, never transmitted
        |
        v
   seed = PBKDF2-HMAC-SHA512(phrase, "squidcloud", 2048)     [BIP39-style]
        |
        v
   MK = HKDF(seed, "squidcloud/v7/master")                    [master key]
        |
        +--> HKDF(MK, "name")              -> name key
        +--> HKDF(MK, "share")             -> share key
        +--> HKDF(MK, "file", file_salt, version) -> FK        [per-file key]
```

`file_salt` is **32 random bytes generated on the client per file**, stored on the server as non-secret metadata and returned with the file on access. FK is derived only on an unlocked device.

**Why not pure `HKDF(MK, file_id)` (v4–v6):** that made every past ciphertext decryptable forever by anyone holding MK — including files the user had "deleted" but whose ciphertext a server had snapshotted. With a per-file salt, **deleting the salt is real crypto-shredding**: even a full DB dump plus MK cannot open that file afterwards. This is a material upgrade in "no fear of leaks".

**Why this still solves the emergency/cellular case:** the salt is 32 bytes and travels with the file's metadata. A device restored from the phrase fetches only the salt and ciphertext of the one file it opens — no bulk key download, no migration wait. The earlier objection was to syncing hundreds of wrapped-key blobs; a public salt per file is negligible and deliberately non-secret.

Trade-offs, stated honestly:
- Losing MK still loses all *existing* files — the required cost of no escrow.
- Salt loss for one file makes that file unrecoverable; back it up with the ciphertext.
- A server retaining both a deleted file's ciphertext **and its salt** can still decrypt it if it later obtains MK. Therefore deletion must propagate to every replica/backup of the salt, and clients verify shredding receipts. This is enforced by the key transparency log (§17.1).

## 3. Device model (iCloud-like daily experience)

**First device:** sign in → generate recovery phrase → confirm it → MK derived on-device → deviceKey stored in hardware keystore (Android Keystore / iOS Keychain / WebAuthn PRF on web) → `wrapped_MK[deviceId] = AEAD(deviceKey, MK, aad(user,device,version))` uploaded. Files sync invisibly.

**New device, normal:** sign in → pending-device request → existing unlocked device shows approve prompt (biometric/PIN) → MK sent via ephemeral ECDH through the server (server sees only public keys + ciphertext) → new device generates its own deviceKey, uploads its wrapped MK.

**New device, emergency / no other device:** sign in → "Restore with recovery phrase" → type 24 words → MK derived → **immediate on-demand access to every file**. No migration step, no bulk download. The only network traffic is the ciphertext of the file actually opened. This works on cellular.

**Browser without keystore:** WebAuthn passkey PRF as deviceKey (persisted per-credential salt); recovery phrase is always available as first-class restore.

## 4. Why migration is no longer a blocker

- **New (v7) files:** no migration exists. Per-file salts travel with metadata, so restore stays instant.
- **Legacy files (created under the old server-KEK escrow):** they still need one-time re-encryption. This is strictly **background and optional**:
  - Incremental, per-file, resumable state machine: `pending → v2_ready → cutover → legacy_deleted`.
  - Wi-Fi only by default; explicitly opt-in on cellular; never blocks opening a file.
  - Until a file is migrated, opening it on a restored device makes **one small legacy-key fetch** for that file only — never a bulk sync.
  - Quota accounting must not double-count; verify decrypt before deleting legacy ciphertext.
- Full E2E is claimed only for v2 files; the legacy gap is documented until its sunset window closes.

## 5. Crypto details

- Recovery phrase: 24 words from a standard 2048-word list (256 bits entropy) with checksum — wallet-standard, portable, human-copyable.
- Derivations: HKDF-SHA256 with domain-separated info strings; per-user `key_salt` and per-file `file_salt` both bound into AAD.
- Content: AES-256-GCM, random 96-bit IV per chunk, fixed-size padded chunks (e.g. 1 MiB), AAD = `file_id | user_id | file_salt | version | chunk_index | commitment`.
- Deletion = destroy every copy of `file_salt` and ciphertext; clients verify a shredding receipt from the transparency log (§17.1) before showing "deleted".
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
| Other tab / origin | No vault DOM, storage, keys, or opener reference — see §16 |
| Sandboxed/untrusted file content | No access to app origin, no network exfiltration, no key material |
| Browser extension / OS malware | Not stoppable by web controls; native client required — see §16.8 |

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
- A share alone reveals nothing. Each share is encrypted **to the recipient's device public key** (whose private key lives only in that recipient's hardware keystore). The server stores only these encrypted envelopes plus a commitment hash — it has no key that can open them and no path to reconstruct MK. An admin with the full database gets ciphertext plus hashes.
- Recovery ceremony: new device collects 3 shares → reconstructs MK → generates a new deviceKey → uploads a new wrapped-MK blob. Contacts are notified and their shares are rotated (new shares of the same MK) so a past holder cannot retry later.
- Recovery must require the account login too — a share holder cannot enter without the account. Rate-limit and audit every recovery attempt.
- Threat: colluding contacts. 3-of-5 means 3 must collude; document this honestly. Offer 2-of-3 or 5-of-7 at setup.

### Recovery key — REMOVED the memorable-passphrase option

Earlier drafts proposed storing `AEAD(Argon2id(recovery_passphrase, salt), MK)` so users could type a memorable passphrase. **That is deleted.** A low-entropy passphrase wrapped under a server-stored blob is offline-brute-forceable by anyone with a DB dump — including an admin — and therefore breaks the "no admin can decrypt" guarantee. Argon2id and rate limits only slow an offline attack; they do not prevent it.

Replacement rules:
- The only portable recovery secret is a **high-entropy 24-word phrase (256 bits)** or an equivalent random 256-bit recovery key/QR. No human-memorable secret is ever accepted as the sole input to MK recovery.
- The account password is **never** an input to MK derivation or recovery; it is sent to Supabase Auth and must stay separate. CI must assert no code path derives keys from the account password.
- If a user wants a second portable secret, it is another random 256-bit key stored as a QR — not a passphrase.
- This is a deliberate UX trade: restoring requires the phrase/QR, but no admin, DB dump, or offline attack can ever guess their way into a vault.

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
- Isolation verification: run the full matrix in §16.10 (cross-tab, sandbox escape, postMessage fuzz, Spectre probe, storage inspection).

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
4. Native client timing: web isolation first, native client next phase (§16.13)? My recommendation: yes — web isolation protects existing users immediately.

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
| Detection | Audit logs, anomaly alerts, canary files, CSP reports, bug bounty | No |
| **Isolation** | **Separate origins for app/preview/media/share/api, COOP+COEP+CORP, sandboxed untrusted content, crypto worker, strict storage partition — see §16** | **No — preview opens in place** |
| **Native** | **Optional hardened client for extension/OS-level threats — see §16.8** | **Optional install choice** |
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
- CSP violation reports and `report-to` endpoint (§16) feed anomaly alerts.
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
8. **Browser extension / OS-level malware** defeats web isolation (§16); native client required for that threat.
9. **Rendered plaintext** exists briefly in the preview frame; a compromised browser can screenshot it.

## 15.10 Priority order for implementation (superseded by §17.10 — use that one)

1. Phase 0 containment (section 9) — closes live critical exposure.
2. Crypto core + deterministic keys (sections 2–5) — the E2E foundation, with third-party review.
3. BFF + session/cookie + code-integrity controls (sections 7, 15.2, 15.3).
4. Web isolation (section 16): origin split, headers, sandboxed preview, crypto worker, storage partition — before exposing decrypted content in the browser.
5. Device lifecycle + recovery (sections 3, 10a, 15.6).
6. Sharing (section 8).
7. Legacy migration (section 4).
8. Detection/response + audit + bug bounty (15.7).
9. Native hardened client (§16.8) for extension/OS-level threats.
10. Other clients and workspaces (section 11).

## 16. Web Isolation System — intent and honest limits

Goal: make other tabs, scripts, injected content, and user-run code unable to read or influence SquidCloud's vault, keys, or decrypted data — without changing normal user behavior.

**What a web app cannot defend against:**
- OS-level malware (keyloggers, memory scraping, screenshots).
- A malicious browser extension with host permissions for the SquidCloud origin — content scripts run in a separate world but can read the DOM and network responses.
- The user opening DevTools on their own unlocked SquidCloud tab.
- A fully compromised browser.

Those require a **native client** (section 9). The web design below stops everything short of that: other origins, other tabs, untrusted file content, postMessage abuse, Spectre-class side channels, storage bleed, and malicious server-supplied JS.

## 16.1 Attack surfaces and controls

| Surface | Threat | Control |
|---|---|---|
| Other tabs / origins | Read vault data via DOM, storage, opener | Separate origins, COOP, no opener, partitioned storage |
| Untrusted file content (markdown, PDF, EPUB, SVG, video) | Script in vault origin, read keys | Sandboxed iframe on a dedicated untrusted origin |
| Extensions | Inject scripts, read DOM | CSP + isolated worlds limit but do not stop; native client for full defense |
| postMessage | Forge messages to crypto worker or app | Strict targetOrigin, schema validation, per-message nonce, no `*`. |
| Spectre / side channels | Cross-origin memory reads | `crossOriginIsolated` via COOP+COEP, CORP on all assets |
| Storage | Steal session/key via localStorage | HttpOnly/`__Host-` cookies, no keys in JS storage, Storage Buckets |
| Navigation | Tabnabbing, reverse tabjacking | `rel=noopener,noreferrer`, COOP, `frame-ancestors 'none'` |
| Third-party scripts | Supply-chain key theft | Zero third-party JS; SRI; signed reproducible builds |
| DNS / TLS | Domain takeover, MITM | HSTS preload, CAA, CT monitoring, TLS 1.3 only |

## 16.2 Origin topology

```
app.squidcloud.com        → vault UI, session cookie, crypto worker. No untrusted content.
preview.squidcloud.net    → sandboxed rendering of PDF/EPUB/markdown/SVG. Unique origin, no cookies.
media.squidcloud.net      → images/video/audio decoding. No DOM access to app.
share.squidcloud.net      → public share pages. Separate site; never shares cookies with app.
api.squidcloud.com        → BFF only; HttpOnly session cookie scoped to api origin.
```

Separate **sites** (different registrable domains where practical) so cookies and storage are partitioned by the browser itself. `app` never iframes `share`, and `share` never loads app scripts.

- Each origin gets its own CSP, Permissions-Policy, and deploy pipeline.
- No wildcard subdomains with live DNS records (prevents takeover).
- `app` sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (or `credentialless` where third-party media is unavoidable).
- All first-party assets send `Cross-Origin-Resource-Policy: same-site` or `same-origin`.

## 16.3 Strict headers on `app` and `api`

```
Content-Security-Policy:
  default-src 'none';
  script-src 'self' 'sha256-...' ;   /* per-build hashes, no unsafe-inline/eval */
  style-src 'self' 'sha256-...';
  img-src 'self' media.squidcloud.net blob: data:;
  media-src 'self' media.squidcloud.net blob:;
  worker-src 'self';
  connect-src 'self' api.squidcloud.com;
  frame-src preview.squidcloud.net;
  frame-ancestors 'none';
  form-action 'none';
  base-uri 'none';
  object-src 'none';
  require-trusted-types-for 'script';
  upgrade-insecure-requests
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(), microphone=(), geolocation=(), usb=(), serial=(),
  hid=(), bluetooth=(), payment=(), accelerometer=(), gyroscope=(),
  magnetometer=(), ambient-light-sensor=(), autoplay=(), encrypted-media=(),
  display-capture=(), idle-detection=(), local-fonts=(), xr=(), wake-lock=()
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

Cookies: `Set-Cookie: __Host-sqsession=...; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=...` scoped to the API origin. No JS-readable session token.

## 16.4 Untrusted content sandbox

All decrypted file rendering happens in a sandboxed iframe on `preview.squidcloud.net`:

```html
<iframe src="https://preview.squidcloud.net/..." sandbox="allow-scripts"
        csp="default-src 'none'; script-src 'self'; connect-src 'none';
             img-src blob: data:; style-src 'self' 'unsafe-inline';
             frame-ancestors https://app.squidcloud.com" />
```

- **No `allow-same-origin`** — the frame gets an opaque origin and cannot read app cookies, storage, or DOM.
- **No `allow-top-navigation`, no `allow-popups`, no `allow-forms`.**
- `connect-src 'none'` — the frame cannot exfiltrate to arbitrary hosts. It receives the file as a `MessageChannel` port from the parent; only the channel is allowed.
- The parent passes only the decrypted blob and a render token; the frame never receives MK or FK.
- Viewer code (PDF.js, EPUB engine) is served from the preview origin with SRI hashes and runs only there.
- Markdown sanitization still uses DOMPurify inside the sandbox as defense in depth.
- The iframe is recreated per file; no state persists between files.

For images/video/audio, use `media.squidcloud.net` with the same rules and no DOM scripting at all where possible.

## 16.5 Crypto worker isolation

- All key derivation, encryption and decryption runs in a dedicated `Worker` on `app`, with `worker-src 'self'` and no `importScripts`.
- Raw keys exist only inside the worker; the main thread receives plaintext only for the specific file being displayed, and hands it directly to the sandboxed preview frame via a transferred `MessagePort`.
- The worker enforces a per-operation authorization token issued by the BFF after step-up; a script injected into the main thread cannot call decrypt without that token.
- Messages are schema-validated with a runtime validator; any unknown field or wildcard origin is rejected. No `postMessage('*')` anywhere.

## 16.6 Storage and state isolation

- No vault data in `localStorage`, `sessionStorage`, `IndexedDB` on `app` except encrypted local cache blobs with no keys.
- Use the Storage Buckets API to partition cache per vault version; evict on lock/logout.
- Each preview origin has no persistent storage (`storage` permissions denied); file data is ephemeral per iframe.
- `__Host-` cookie prefix prevents subdomain injection; no cookie on `preview`/`media`/`share`.
- Service worker on `app` only; no service workers on preview/share origins. It caches only signed static assets, never decrypted data.

## 16.7 Cross-tab and navigation hardening

- `window.opener` is always null for any opened link; all external links use `rel="noopener noreferrer nofollow"`.
- `Cross-Origin-Opener-Policy: same-origin` prevents other tabs from holding a reference to the app window.
- No `window.name` use; no broad `postMessage` listeners — only channel-based, origin-checked handlers.
- If a second SquidCloud tab unlocks, the first is notified and locks immediately (single-active-vault policy) to reduce exposure.
- Share links open in a new tab on `share.squidcloud.net`, never in the app frame.

## 16.8 Extension and OS-level threat — native fallback

Web controls cannot stop a malicious extension with host permissions or OS malware. To meet the "hackers cry" bar for those threats, ship an **optional hardened native client**:

- Desktop/mobile app with the same E2E protocol; keys in OS keystore (Secure Enclave / Keystore / DPAPI), never in a browser.
- WebView2/WKWebView with host app enforcing TLS pinning and disabling devtools in production.
- No browser extensions in-process; OS sandbox + hardened runtime + code signing + notarization.
- Optional: dedicated kiosk/PWA window with browser profile that has all extensions disabled, managed by enterprise policy.
- The web app remains the convenience path; the native client is the "high security" path. Both share the same vault and protocol.

Document clearly: for users facing targeted attacks, the native client is required; the browser cannot promise the same guarantee.

## 16.9 Network/DNS hardening

- HSTS preload submission; CAA records limiting certificate issuance; Certificate Transparency monitoring with alerts.
- TLS 1.3 only on all origins; no mixed content.
- Separate API egress allowlist; BFF cannot reach arbitrary hosts.
- No third-party analytics, fonts, CDNs, or support widgets on any SquidCloud origin.
- CSP violation reports and `report-to` endpoint with anomaly alerts.

## 16.10 Verification (isolation)

- Automated header/CSP checks in CI for all origins.
- Cross-origin test suite: hostile tab attempts DOM/read/storage/opener access → all fail.
- Sandbox escape tests: `<script>`, `srcdoc`, `form`, `top.location`, `window.open`, `fetch` from preview → all blocked.
- postMessage fuzzing: forged origins, wildcard targets, extra fields → rejected.
- `crossOriginIsolated === true` on app; Spectre-style probe against preview fails.
- Extension simulation: content-script-like DOM injection cannot read worker keys (it can read rendered plaintext — documented).
- Storage inspection after lock: no keys, no plaintext, no session tokens in JS storage.
- Native client: keystore extraction attempt fails; devtools disabled in release build.

## 16.11 UX contract (isolation)

None of the above adds taps. Sign in → unlock → files appear. Preview opens in-place via the invisible sandboxed frame. Native client, if used, is a separate install choice with the same UI.

## 16.12 Residual risks (isolation)

- Browser/OS compromise or host-permission extension defeats web isolation.
- XSS in the unlocked app can still request decryption through the worker token path; step-up per op limits but does not eliminate.
- Rendered plaintext exists briefly in the preview frame; a compromised browser can screenshot it.
- Native client reduces but does not eliminate OS-level risk.

## 16.13 Open decision (native timing)

Should the native hardened client be built in this project, or should the web isolation ship first with the native client as a later phase? My recommendation: web isolation first (it protects the existing user base immediately), native client in the following phase for high-risk users.

---

# 17. Next-level hardening (v7)

## 17.0 Honest framing

"No fear of leaks" cannot be a promise. What v7 delivers is a precise property: **no single compromise short of the user's unlocked device, their recovery quorum, or the build pipeline yields plaintext.** Anything less — DB dump, service-role theft, BFF compromise, network position, subpoena, rogue admin — returns ciphertext and opaque metadata only. The residual list stays explicit (§17.9).

## 17.1 Key transparency log (KTL) — stops server-side key substitution

A compromised BFF or DB admin could otherwise swap a wrapped key or roll back a vault version without the client noticing. Fix with an append-only, client-verified log:

- Every event (device added/removed, MK wrapped for a device, recovery quorum change, MK rotation, file salt created/destroyed, share created/revoked) is appended as `hash(prev || event || signature)` — a hash chain, like Certificate Transparency.
- Each client stores the last head it saw and verifies the chain on every sync; any fork, rollback, or skipped event fails closed and locks the vault.
- Events are signed with a per-user key derived from MK, so the server cannot forge them.
- Witnesses: two independent, read-only services (one self-hostable by the user) cosign the head periodically. A user who runs their own witness gets detection even if the whole SquidCloud infrastructure is malicious.
- Deletion/shredding receipts live in the KTL — clients refuse to show "deleted" until the receipt is witnessed.

## 17.2 Post-compromise security (forward secrecy for the vault)

Current design: an attacker who steals MK can read every current file. Add epoch-based ratcheting:

- Vault has an `epoch` counter. Each file's FK is derived from `HKDF(MK_epoch, file_salt, version)`, and `MK_epoch+1 = HKDF(MK_epoch, "ratchet", epoch)` with the previous epoch key **destroyed** on all devices after re-encryption.
- Periodic background ratchet (e.g. weekly, or on any device removal/recovery) re-encrypts content under the new epoch. Old ciphertext becomes unreadable once old epoch keys are gone.
- A stolen *current* MK therefore does not decrypt files from prior epochs, and removing a compromised device and ratcheting restores confidentiality for future content.
- Ratchet is client-side, incremental, resumable, Wi-Fi-first, and silent — same engine as legacy migration (§4).

## 17.3 Security tiers — invisible, automatic, never in the user's face

Requiring a physical touch on every decrypt is annoying and breaks the seamless requirement. So the tiers below are **an internal policy engine, not an onboarding questionnaire**. The user never picks a tier in the normal flow — protection is chosen for them, silently, the way a protection detail works.

| Tier | Unlock | Per-file access | When it applies |
|---|---|---|---|
| **Balanced** | Device keystore / passkey once per session | Automatic, no prompt | Default for everyone |
| **High** | Same, plus step-up before sharing/recovery/device changes | Automatic reads | Applied automatically when risk rises, or by an org admin |
| **Maximum** | Hardware-bound | FIDO2/Passkey touch (or biometric) per decrypt | Auto-escalated on credible targeted-attack signals, or set by org policy |

Rules that keep it invisible:
- **No tier selection at vault creation.** Onboarding is: sign in → generate recovery phrase → done. The user is not asked to understand security modes.
- Tiers are **assigned by the risk engine or org policy**, not manually toggled. A user who never opens Settings still gets the right level.
- Risk-based escalation is automatic and silent: repeated failed verifier attempts, a new device plus bulk download, impossible travel, or a credible threat report can raise the tier temporarily. De-escalates when risk clears.
- Advanced users and org admins can pin a tier in a buried Advanced Settings screen — never surfaced, never badged, never nagging.
- Caching in Maximum: short configurable touch window (default 5 minutes, settable to zero) so several files in a row don't mean repeated taps.
- Enforcement: in Maximum the crypto worker holds only a wrapped MK and requires a fresh signed assertion per operation; keys never leave secure hardware.
- No security scores, warning banners, or "protect your account" notifications for users at normal risk. The only visible security moment is a genuine anomaly — and that prompt must be rare, specific and quick.

## 17.4 Duress and coercion resistance

- **Duress code:** a second recovery phrase that unlocks a realistic decoy vault and silently raises a high-priority alert to the user's trusted contacts and their other devices. Indistinguishable from a normal unlock to an observer.
- **Travel mode:** one tap strips wrapped-MK blobs from the device, leaving only encrypted cache; on return, re-approval from another device or phrase restores access. Border crossings and device searches yield nothing.
- **No support bypass:** support staff have no technical path to vault data, so social engineering of staff cannot produce a leak. Documented in training and in public policy.

## 17.5 Metadata and traffic-analysis defenses

- Fixed-size blocks (not just 1 MiB buckets) and constant-rate sync heartbeats so file size and access timing are harder to infer.
- Batch fetch: requesting one file also fetches a few adjacent padded blocks, hiding the exact access pattern.
- Coarse timestamp buckets; share graph and folder structure encrypted with the name key.
- IP addresses retained only in memory for rate limiting, never persisted in audit logs.
- Document residual: the service still knows who the account is and roughly when it is active. That is unavoidable for a cloud sync product and must not be overclaimed.

## 17.6 Supply chain and build integrity (SLSA-style)

- SLSA Level 3+ target for all release artifacts: hermetic, reproducible builds from a pinned toolchain with a generated SBOM.
- Signed commits and two-person review for `src/lib/crypto*`, `supabase/functions/*key*`, and isolation/CSP config.
- Dependency pinning, lockfile verification, `npm audit` + provenance checks in CI; no runtime dependency installation.
- Binary transparency: release hashes published to an append-only log; clients verify the hash of any update against the log and an independent witness before installing.
- Secrets scanning in pre-commit and CI; no secrets in git history, HAR files, keystores, or CI logs (cleanup from Phase 0 is mandatory, not optional).

## 17.7 Infrastructure hardening

- Private networking / mTLS between BFF, database and storage; no public database endpoint reachable from the internet.
- Service-role key restricted by network and by database role that can only call the narrow allow-listed RPCs.
- Immutable infrastructure, short-lived credentials, no SSH into production; all changes via reviewed pipeline.
- Backup ciphertext and salts are encrypted separately; a backup of one is useless without the other and without MK.

## 17.8 Recovery trust hardening

- Safety numbers for trusted contacts (Signal-style): verify out of band so a malicious server cannot substitute a contact's share.
- Recovery ceremonies require the account login + quorum + step-up + KTL witness, and notify all devices in real time.
- Progressive backoff, IP/device fingerprint rate limits, and mandatory cool-down after a failed recovery attempt.
- Social shares are one-time and rotated after every use; stale shares are rejected by the KTL.

## 17.9 Residual risks — final honest list

1. XSS in an unlocked tab can read plaintext — mitigated, not eliminated (§16).
2. Malicious code delivery defeats browser E2E — mitigated by signed reproducible builds, SRI, isolated origin, witnesses.
3. Browser extension / OS-level malware — web cannot stop it; the Maximum tier (§17.3) and native client are the only answers, both opt-in.
4. Physical coercion of an unlocked device — duress/travel modes help, cannot guarantee.
5. Lost phrase + lost quorum = permanent loss; support cannot help.
6. Metadata (identity, coarse timing, counts, IPs) remains visible by design.
7. Legacy unmigrated files remain server-recoverable until re-encrypted.
8. Plaintext already downloaded to a stolen device cannot be recalled.
9. A server that keeps a deleted file's ciphertext **and its salt** plus later obtains MK can still read it — hence witnessed shredding receipts are mandatory.

## 17.10 Updated implementation priority (governed by §18: zero-friction rule)

1. Phase 0 containment (§9) — close live critical exposure.
2. Crypto core: MK, per-file salts, AAD, transparency log (§§2, 5, 17.1) + third-party review.
3. BFF + session/cookie + code integrity (§§7, 15.2, 15.3, 17.6).
4. Web isolation (§16) before any decrypted content is rendered.
5. Device lifecycle + recovery + ratchet (§§3, 10a, 17.2, 17.8).
6. Sharing (§8).
7. Legacy migration (§4).
8. Duress/travel + security tiers (§§17.3, 17.4) — opt-in, no UX change by default; Balanced tier is default.
9. Detection, canaries, bug bounty, runbooks (§15.7).
10. Native hardened client (§16.8).
11. Other clients and workspaces (§11).

Every step above must satisfy §18: no routine security UI; background protection; prompts only on specific anomalies.

---

# 18. The "Principal and Protection Detail" principle

## 18.0 The analogy, made concrete

The user should be the oblivious principal: they sign in, their files are there, and nothing else is required of them. Everything in this plan is the **protection detail** — working continuously, invisibly, ahead of threats, and revealing itself only when there is a real, specific danger.

This is not a marketing metaphor; it is a hard design rule with testable consequences:

1. **Zero routine security UI.** No badges, scores, warning banners, "review your security" nags, tier pickers, or key-management screens in the normal path.
2. **Protection runs while the user is idle and locked.** Key ratchet (§17.2), legacy migration (§4), transparency-log verification (§17.1), canary checks, and audit reconciliation are background services. The user only sees a sync indicator.
3. **Advance verification before exposure.** Before any device is trusted or any large data transfer is allowed, the system silently verifies: device attestation, session binding, KTL head, risk signals. The user is not part of this ceremony unless it fails.
4. **Step forward only on real anomalies.** A prompt appears only for: new device, recovery attempt, unusual bulk access, impossible travel, repeated verifier failures. It is specific ("New device in Berlin — approve?") and one tap. Never generic.
5. **Deception and counterintelligence are invisible.** Canary files, decoy vaults (duress code, §17.4), and anomaly alerts require no user action and generate no routine UI.
6. **Recovery is a silent evacuation plan.** The quorum, rotated shares, safety numbers, and KTL receipts are all maintained in the background; the user encounters them only if they actually lose a device.

## 18.1 Risk engine (the detail's threat assessment)

- Inputs: device attestation, IP/ASN reputation, impossible travel, access volume, verifier failures, new share creation rate, recovery attempts, time since last unlock, network trust.
- Outputs: silently assign tier (§17.3), require step-up for a specific operation, lock other sessions, trigger ratchet, alert contacts, or create a canary alert.
- All decisions are audited in the KTL; none produce routine UI.
- Fail-safe: if the risk engine itself is unavailable, the system falls back to **Balanced + step-up for sensitive ops**, never to "allow everything" (no fail-open).

## 18.2 What the user actually experiences

| Moment | User sees | System does (invisible) |
|---|---|---|
| Sign in | Email/passkey → files appear | Device attestation, session binding, KTL verify, risk scoring |
| Unlock | Biometric once per session | MK unwrapped in isolated worker, zeroized on lock |
| Open a file | File appears | Per-file salt fetch, FK derivation, AAD verify, sandboxed render, canary check |
| Sync | Small "synced" indicator | Background ciphertext transfer, ratchet, migration, log verification |
| New device | "Approve this device?" on existing device | ECDH key exchange, wrapped MK, KTL entry, witness cosign |
| Genuine threat | One specific prompt | Auto-escalate tier, lock sessions, alert, ratchet |
| Recovery | Phrase/quorum flow only if needed | Share verification, safety numbers, notifications, KTL receipts |

## 18.3 Non-negotiable UX tests

- A user who never opens Settings must still receive full protection.
- No screen in the normal path may contain the words "security", "encryption key", "tier", or "warning" unless an actual anomaly is happening.
- Routine file open must not require more than the session unlock already performed.
- Background security work must not delay file availability, including on cellular.
- If a security prompt appears, it must name a specific event and be dismissible in one action with a safe default.

## 18.4 Honest tension

Absolute invisibility and absolute security conflict at the exact moment of a credible threat — the detail must show itself. The compromise is: **invisible by default, specific and rare when it matters**. A prompt the user never sees is worthless; a prompt they see every day is ignored. Both are bugs.

## 18.5 Decision impact

This principle supersedes the earlier "one-time tier choice at vault creation" idea: there is **no tier UI at onboarding at all**. Tiers are internal policy (§17.3). Open decision §16.13 (native client timing) and §14 items now assume the web plan alone already delivers the "principal" experience; native is the added protection detail for users who need it, also without daily UI.

---

# 19. Extreme zero-knowledge invariants (v9)

## 19.1 The single rule

**No person other than the user, and no component of SquidCloud, can obtain a usable key, a recovery share, or plaintext — even with full database access, all server secrets, service-role credentials, and source code.**

## 19.2 Hard invariants (CI must assert these, not just review them)

1. No server-side env var, secret, or config value can decrypt any v7+ file. There is no KEK, no master key, no escrow, and no "recovery" key on any server. A CI check fails the build if any edge function reads a key-like env var for decryption.
2. No table or RPC response contains a plaintext key, a recovery share, a share secret, `storage_path`, file tags, `encryption_key`, or chunk URLs. Enforced by allow-lists and an automated response-schema audit.
3. MK is derivable only from the 24-word phrase / random recovery key on a client device, or unwrapped from a device keystore key the server never sees. No password, email, or account-reset flow can produce MK.
4. Social-recovery shares are encrypted to recipient device public keys; the server holds only envelopes and commitments. No server-held key can open a share.
5. Account password is never an input to any crypto derivation. Adding such a path is a blocking security regression.
6. Admins/support have no technical path to user plaintext. Not "policy says no" — technically impossible. Any admin tooling that returns file data or keys from the server is rejected.
7. Device encryption for Maximum tier requires a fresh signed hardware assertion; the server cannot forge one.
8. Deletion cryptographically shreds `file_salt`; a witnessed receipt is required before UI shows "deleted".
9. Legacy escrowed files are explicitly outside the ZK guarantee and must be fully migrated before the legacy KEK path is disabled.
10. Every sensitive event is appended to the KTL and client-verified; a server cannot silently substitute a key, roll back a version, or forge a recovery.

## 19.3 What "no admin can decrypt" means in practice

- A malicious admin with production DB access sees: opaque object ids, padded ciphertext, coarse timestamps, wrapped MK blobs (unopenable), share envelopes (unopenable), and the KTL.
- A malicious admin with the service-role key additionally sees: whatever the BFF's user-scoped RLS allows — still ciphertext only, because plaintext is never stored.
- A subpoena to SquidCloud produces ciphertext; the company has no key to hand over. This is the strongest possible legal posture.
- The only way to read a v7+ file is on an unlocked user device holding MK. That is the definition of zero-knowledge we are implementing.

## 19.4 Explicitly rejected features (to prevent future "helpful" regressions)

- Server-side "forgot vault password" recovery.
- Admin key escrow, break-glass access, or "legal compliance" key release.
- Memorable passphrase as a recovery secret.
- Server-side content preview, search indexing, or AI over decrypted content without explicit per-file user action on their own device.
- Any SDK or integration that accepts a raw key from a server response.

## 19.5 Residual truth

Even with all of this: XSS on an unlocked device, a compromised build pipeline, a host-permission browser extension, OS-level malware, physical coercion, or loss of the phrase still defeat or endanger the guarantee. Those are listed in §17.9. Nothing in software removes them; the plan minimizes and, where possible, makes them detectable.

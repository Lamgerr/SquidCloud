# File pipeline review — current state and E2E roadmap

Status: research report only. No product code was changed.

## Scope

Read-only audit of the full file pipeline: upload, encryption, storage, share, preview, download, key management, authentication, recovery, and the canonical security spec. Four parallel audits were run and the highest-severity claims were verified directly in source.

## Bottom line

SquidCloud is **not fully end-to-end encrypted today**. Several paths are genuinely client-side encrypted, but the default managed path escrows raw AES keys to the server, and server-side decrypt endpoints exist. The product can honestly claim "ciphertext at rest with client-side encryption on some paths", not "only the user can decrypt".

## Current pipeline

1. Upload entry points converge on `src/lib/api.ts:687-883` (`uploadFile`).
2. If the vault is unlocked, `zkEncryptForUpload` (`src/lib/zk-mode.ts:23-34`) wraps the file in AES-256-GCM under a vault-derived key; otherwise the plain RES54 path runs.
3. RES54 encrypts chunks client-side, but `src/lib/res54.ts:774-791` sends the raw upload key to `store-file-key` and, on failure, writes it into `files.tags` and `files.encryption_key`.
4. `supabase/functions/store-file-key/index.ts:34-43` wraps that key under a server KEK; if `SQUIDVEIL_MASTER_KEY` is unset the KEK is derived from the service-role key. `file-key/index.ts:99-102` returns the plaintext key to callers.
5. Share links carry a 64-hex secret in the URL fragment; the wrapped file key and metadata are reachable through anon-callable `get_shared_file_info` before the password check.
6. Preview and download are mostly in the app origin, with sealed frames only for some media/markdown paths.
7. Key management is split across RES54 v2, v3/HKDF, BYOK, secure-key-manager, SDE, and native stubs. Several subsystems (social recovery, KTL guard, ratchet, native keystore) are unwired.

## Confirmed critical and high issues

- P0 raw key escrow: `src/lib/res54.ts:774-791`; `store-file-key/index.ts:34-43`; `file-key/index.ts:99-102`. Server can decrypt managed files. KEK fallback tied to leaked service-role key.
- P0 account takeover: `supabase/functions/passkey-auth/index.ts:131-169` verifies no WebAuthn assertion signature and returns a magic-link OTP.
- P0 anon share metadata/key: `get_shared_file_info` is granted to anon in `20261125000000_public_lockdown.sql:30` and returns wrapped key/metadata before password verification.
- P1 weak vault root: `src/lib/zk-vault-session.ts:25-31` derives the vault key from the account sign-in password with a deterministic salt `squidcloud-vault|${userId}`.
- P1 weak/inconsistent KDF: `key-derivation.ts:8` and `secure-key-manager.ts:56` use 100k PBKDF2; `byok-encryption.ts:39-64` is named Argon2id but implements PBKDF2 at 600k.
- P1 deterministic nonces: `encryption-v3.ts:168-171` and `packages/sde/src/.../SDEBrain.ts:138-139`; all-zero IV in per-file-key unwrap at `encryption-v3.ts:343-351`.
- P1 password change/reset never rewraps stored keys, so recovered accounts cannot open E2E files.
- P1 recovery and integrity are unwired: `reconstructFromShares`, `assertKtl`, `initRatchet`, native keystore have no callers; `zk_devices` stores empty `wrapped_mk`.
- P1 weak random passphrase: `BYOKMasterKeySetup.tsx:51-60` uses `Math.random()`.
- P1 app-origin plaintext: `EnhancedInstantPreviewModal.tsx:97-98,179,205,229`; PDF/EPUB/video viewers remain in the app origin.

## Recommended target architecture

One client-held master secret, never sent to the server:

- 24-word high-entropy recovery phrase, derived with a modern password KDF.
- Master key stays in a closure and hardware/WebAuthn PRF on devices.
- Per-file random 32-byte salt; `HKDF(MK, file_salt, version, file_id)` derives a per-file key.
- Per-chunk random 96-bit IV or a nonce-misuse-resistant mode.
- AAD binds user, file id, salt, version, chunk index, and commitment.
- Server stores ciphertext, salts, wrapped device keys, verifiers, and a key transparency log. It never receives plaintext keys.
- Sharing wraps only the per-file key with a URL-fragment secret; a password/slow verifier gates access, but never returns keys before that gate.
- Preview/decrypt happens in a sealed origin, returning only rendered output or opaque handles.

## Phased work plan

### Phase 0 — stop active harm (do first)

1. Rewrite `passkey-auth` with real WebAuthn verification: validate clientDataJSON origin/challenge/type and assertion signature; bind registration to an authenticated user; do not return OTPs to unauthenticated callers.
2. Fix share exposure: drop and recreate `get_shared_file_info` with a signature that cannot return raw keys/paths; gate metadata behind a password-verified BFF call; remove the branch that accepts the URL secret as a password.
3. Stop new raw-key escrow: default new uploads to v3 client-derived keys; remove `store-file-key` calls and the `files.tags` raw-key fallback. Mark legacy files explicitly.

### Phase 1 — crypto correctness

1. Replace deterministic vault salt with a stored random salt tied to `master_keys.kdf_salt` or BYOK salt; raise KDF to Argon2id or PBKDF2 at ≥600k.
2. Make all GCM nonces random; remove the zero IV in key unwrapping; bind all keys and chunks with AAD.
3. Use full 32-byte raw keys instead of truncating hex strings to 128 bits.
4. Replace `Math.random()` with `crypto.getRandomValues()`.
5. Rename `deriveKeyWithArgon2id` to match what it does, or actually implement Argon2id.

### Phase 2 — make E2E usable

1. Wire password change/reset to rewrap the master key and all per-file keys only after the current secret is supplied. If not supplied, route to recovery or honest destructive reset.
2. Wire social recovery: persist share envelopes and commitments; add a reconstruct flow.
3. Wire device approval and WebAuthn PRF: store PRF salt and wrapped MK in `zk_devices`.
4. Add KTL insert policy and enforce the guard on unlock/decrypt/share/reset.
5. Add background legacy migration, Wi-Fi-only by default, never blocking file access.

### Phase 3 — isolation and governance

1. Move PDF, EPUB, video, and markdown fully into the sealed origin; validate `postMessage` source and origin.
2. Tighten CSP with nonces/hashes and Trusted Types; add COEP/CORP on the isolated preview origin.
3. Route all sensitive operations through the BFF with verified identity, AAL, and short token age.
4. Add CI invariants that fail if anon can execute functions returning key/path columns, if raw keys can reach DB columns, or if any `verify_jwt=false` function handles key material without an audited alternative.
5. Align README and SECURITY-MODEL with what is actually shipped. Until Phase 1 completes, describe the product as "ciphertext at rest with optional client-held keys", not full E2E.

## One-sentence recommendation

Fix the account-takeover and anon-key leaks first, then make the existing v3 client-derived key path the default and delete the server escrow; the UX goal is one silent upload path, with recovery and device approval working in the background.

## Deferred or explicitly out of scope

- Rotate the leaked service-role key: previously deprioritized by the user, but required before claiming strong security.
- Duress/travel mode and security tiers: later, invisible by default.
- Native hardened client: valuable for targeted-threat users, but later than web E2E correctness.

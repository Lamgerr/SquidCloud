# SUMMARY — SquidCloud

## Done
- Full E2E file-pipeline hardening implemented and pushed (14 commits, `76abb4c5..8b3ef530` on `fresh-main`).
- New writes are client-only E2E v4: random per-file salt, random 96-bit IVs, full AAD, HKDF-derived file keys, no raw key to any server. Central gate inside `uploadFileWithRes54` covers every uploader (main UI, S3, GitHub clone, code editor, AI tools, file updates); the legacy Tebi raw-key path was removed.
- All existing v2/v3/managed/BYOK ciphertext stays readable; no migration rewrites or deletes files.
- Passkey login fixed and hardened: accepts JWK and legacy DER-SPKI verifiers, verifies DER and P1363 ECDSA signatures plus RSA, binds challenges to verified email, enforces expiry, and routes legacy rows through an emailed magic link instead of returning an OTP. Deployed.
- BFF share gate verifies password/country/device before releasing allow-listed metadata; password changes rewrap the same master key and roll back on failure.
- Sealed previews use opaque-origin frames with nonce-locked scripts and source-checked postMessage; no app-origin blob URLs for Markdown/image/video/PDF.
- CI invariant gate (`npm run check:e2e-invariants`) scans 702 files; docs now describe shipped guarantees instead of aspirational ones.
- Verification: 42 targeted tests pass, invariant gate passes, Vercel READY, independent final review verdict safe-to-push.

## In progress
- Nothing mid-edit. Working tree clean; remote `fresh-main` up to date.

## Blocked — needs a decision
- Live migration-history mismatch still prevents DB migrations. The anon grant on `get_shared_file_info` remains at the database layer; client access is gated through the BFF and the exception is time-boxed in `scripts/e2e-invariant-allowlist.json` (review by 2026-12-26).
- Service-role key from old history remains live; previously deprioritized by the user.
- Forgot-password/reset does not rewrap vault keys; only signed-in password change does.

## Queued next
1. Rotate the service-role key, then revoke anon EXECUTE on `get_shared_file_info` and remove both allowlist entries.
2. Chunk the v4 encryptor so very large files are not buffered whole in memory.
3. Re-enroll legacy passkeys (no stored verifier) to gain full signature verification.

Live: https://squidcloud.vercel.app · Repo: https://github.com/Lamgerr/SquidCloud

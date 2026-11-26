# SquidCloud Security Model

This document states what SquidCloud protects, how, and what it does not.
Read it before storing sensitive data.

## Modes

SquidCloud supports two write modes and several read modes:

1. **Legacy / standard writes (backward compatibility).** Older uploads used
   server-managed, BYOK, v2 or v3 keys, some escrowed through the service.
   These files remain readable — no ciphertext is migrated, rewritten or
   deleted. New uploads do **not** use these paths when the vault is unlocked.
2. **E2E v4 writes (new uploads).** With the vault unlocked, the file is
   encrypted entirely in the browser before upload: a random 32-byte per-file
   salt, a random 96-bit IV, a file key derived with HKDF, and AES-GCM with
   full AAD binding (user, file, salt, version, chunk index, total chunks).
   No raw AES key is sent to any server endpoint. Only ciphertext and a public
   salt leave the device; the master secret lives in memory only.

Reads are deliberately backward compatible: v2, v3, managed and v4 files all
decrypt through their original paths. A wrong key or altered AAD fails closed
rather than yielding plaintext. Previews render plaintext only inside an
opaque-origin sandboxed frame; no app-origin object URL is used for Markdown,
image, video or PDF previews.

Passkey sign-in now verifies the WebAuthn assertion server-side (origin,
challenge, user presence and signature) before issuing a one-time login. Both
JWK and legacy SPKI verifier formats are accepted so existing passkeys keep
working; rows with no stored verifier use the legacy challenge-only path and
should be re-enrolled to gain signature verification.

## Threat model

| Adversary | Protection |
|---|---|
| Database dump / SQL access | ZK files are ciphertext only; server has no usable key. Standard files are server-readable. |
| Compromised edge function / BFF | Least-privilege DB grants, RLS, no key-returning RPCs; AAD binds wrapped keys to files. |
| Other tabs / hostile origins | Origin separation, strict CSP, sandboxed preview frames, HttpOnly session cookies. |
| Network attacker | TLS 1.3, HSTS. |
| Share-link holder | Only the shared file; wrapped key is useless without the URL-fragment secret. |
| XSS in an unlocked tab | Severe: can read plaintext of the open file. Mitigated by CSP/sandboxing, not eliminated. |
| Browser extension / OS malware | Not preventable in a web app; use the native client or hardware-bound mode. |
| Loss of recovery phrase | Permanent data loss for ZK files. No backdoor exists. |

## What is NOT guaranteed

- Legacy ciphertext encrypted under escrowed keys is not zero-knowledge; the
  service can technically read it. It stays readable by design.
- Metadata (account identity, coarse timing, file counts, IPs) is visible to the service.
- A stolen unlocked device exposes whatever is currently decrypted, including
  the in-memory v4 master secret.
- Password reset (forgot-password) does not rewrap vault keys; only a signed-in
  password change does. Reset users must re-unlock with their recovery phrase.
- The legacy `get_shared_file_info` RPC still has an anon grant at the database
  layer. The live migration history mismatch currently blocks the corrective
  migration. Client access is gated through the BFF, which verifies password,
  country and device before releasing allow-listed fields. This is tracked as
  a time-boxed exception in `scripts/e2e-invariant-allowlist.json`.
- No software can make physical coercion harmless.

## CI invariants

`npm run check:e2e-invariants` (also run by the security-audit workflow) fails
the build on weak randomness in crypto paths, raw-key escrow calls in new E2E
paths, and anon grants on key-returning RPCs. Inline `e2e-invariant-allow`
comments and the allowlist file document the small number of deliberate,
non-secret exceptions; each carries a reason and a review date.

## Backend hardening

See [BACKEND-OPENSOURCE-PLAN.md](./BACKEND-OPENSOURCE-PLAN.md) for the live
least-privilege work (function grants, bucket privacy, RLS enforcement) that
contributors are expected to understand and preserve. SquidCloud is open
source for transparency and community contribution, not as a self-hosting kit.

## Reporting

Security issues: see [SECURITY.md](../SECURITY.md). Do not file public issues
for vulnerabilities.

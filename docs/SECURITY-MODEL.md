# SquidCloud Security Model

This document states what SquidCloud protects, how, and what it does not.
Read it before storing sensitive data.

## Modes

SquidCloud supports two encryption modes:

1. **Standard (default for legacy files).** Files are encrypted at rest with
   keys escrowed by the server. The operator can technically decrypt these
   files. This is encryption at rest, not zero-knowledge.
2. **Zero-knowledge vault / ZK files.** When the vault is unlocked with a
   BIP39 recovery phrase, new uploads are encrypted in the browser with a
   client-held key. The server stores only ciphertext and a public per-file
   salt. Deleting the salt cryptographically shreds the file.

A file's mode is determined by the presence of a `zk_files` metadata row.
Files without it use the standard path.

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

- Standard (non-vault) files are not zero-knowledge.
- Metadata (account identity, coarse timing, file counts, IPs) is visible to the service.
- A stolen unlocked device exposes whatever is currently decrypted.
- No software can make physical coercion harmless.

## Backend hardening

See [BACKEND-OPENSOURCE-PLAN.md](./BACKEND-OPENSOURCE-PLAN.md) for the live
least-privilege work (function grants, bucket privacy, RLS enforcement) and
the steps required when deploying your own instance.

## Reporting

Security issues: see [SECURITY.md](../SECURITY.md). Do not file public issues
for vulnerabilities.

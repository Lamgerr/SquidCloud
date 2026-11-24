# Security Policy

## Reporting a Vulnerability

If you discover a security issue in SquidCloud, **do not open a public issue**.

- Use GitHub's private vulnerability reporting for this repository (Security → "Report a vulnerability"), if enabled.
- If private reporting is unavailable, contact the maintainers through a private channel listed in the repository profile/README and include: affected component, reproduction steps, impact assessment, and any suggested fix.
- Please allow reasonable time for triage and remediation before public disclosure.

## Scope & Notes

- SquidCloud handles user files and encryption-related flows. Reports involving authentication bypass, authorization/RLS flaws, secret exposure, cryptographic weaknesses, edge-function abuse, or supply-chain compromise are especially important.
- **Never commit secrets** (API keys, service-role keys, tokens, private keys, HAR captures, `.env` files). Use `.env.example` for placeholders only.
- Supabase **anon/publishable** keys are public by design; **service role** keys, DB passwords, webhook secrets, and third-party API keys are not.

## Supported Versions

Security fixes target the actively maintained default branch and current production deployment. Older branches, forks, and archived artifacts are unsupported.

## Maintainer Pre-Publication Checklist

Before making the repository public, complete the blocking items in [`docs/audits/security-audit.md`](docs/audits/security-audit.md) (credential rotation/revocation, git-history purge, RLS/function hardening, edge-function auth review).

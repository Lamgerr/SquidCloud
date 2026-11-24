# Backend Open-Source Readiness Plan

Date: 2026-11-24 · Repo: `Lamgerr/SquidCloud`

## 1. What I checked

- Local `supabase/` dir: 3 migrations, 88 edge-function dirs, config.toml, .temp link
- Live DB via `supabase db query --linked`: 150 tables, 185 functions, 288 policies, 10 buckets
- Full tracked-repo secret scan (subagent, read-only)
- Diff between local migrations and live state

A schema snapshot of live is committed at `docs/LIVE-SUPABASE-SNAPSHOT.md`.

## 2. Secret scan result

**No real secrets in tracked code.** No service-role JWT, GitHub PAT, payment key, `sk-`/`sb_secret_`/`AIza`/`AKIA` patterns. All payment/AI keys load from `Deno.env` or `system_config`. `.env.example` is clean placeholders. Docs use placeholder tokens.

Fixed today (were real hardcoded values):
- `backfill-file-keys/index.ts` — hardcoded privileged token → now `Deno.env.get("BACKFILL_TOKEN")`, fails closed when unset
- `backfill-provider-credentials/index.ts` — hardcoded token → `PROVIDER_BACKFILL_TOKEN`, fails closed
- `middleware.ts` and `src/lib/supabaseEnv.ts` — hardcoded production anon key → env-driven

**Still required (outside code):** rotate the Supabase service-role key exposed in purged git history (confirmed live, exp 2035), admin key/password, and generate a new Android signing keystore.

## 3. Live DB — findings that block open-source

| Severity | Finding | Live evidence | Fix |
|---|---|---|---|
| **Critical** | `exec_sql` executable by `anon` and `PUBLIC` | introspection: anon_exec includes `exec_sql` | `REVOKE ALL ON FUNCTION public.exec_sql(text,jsonb) FROM PUBLIC, anon, authenticated;` drop if unused |
| **Critical** | `generate_api_key` anon-executable | anon_exec list | restrict to `service_role` |
| **Critical** | `rotate_master_key` anon-executable | anon_exec list | restrict to `service_role` only |
| **High** | 171 functions executable by `PUBLIC`, 172 by anon | counts | revoke `PUBLIC`/`anon` EXECUTE by default; grant explicitly |
| **High** | 158 SECURITY DEFINER functions | count | reduce to a reviewed allow-list; pin `search_path` |
| **High** | 7 public storage buckets | `apidoc, avatars, book-covers, extension-manifests, extensions, go-mod, squid-sites` | make private unless genuinely public assets; signed URLs only |
| **High** | 34 edge functions with `verify_jwt=false` in `config.toml` | config | inventory each; enforce auth in code or enable verify_jwt |
| **Medium** | ~40 sensitive-named functions still anon-executable (`check_share_access`, `create_file_share`, `get_shared_file_info`, `increment_share_*`, KZA admin fns, `hash_file_encryption_key`, …) | anon_exec list | least-privilege grant matrix |

Note: the earlier hardening migration already revoked `get_secret`, PREL sign/verify/rotate, `create_file_record`, `get_file_for_share`, fixed `update_share_options` ownership, replaced permissive policies, and made `files` bucket private. The counts above are the *remaining* surface.

## 4. Local `supabase/` dir — what to change before publishing

1. **Add a single consolidated hardening migration** (`20261125000000_public_lockdown.sql`) that:
   - revokes `PUBLIC`/`anon`/`authenticated` EXECUTE on all functions, then grants back only a reviewed allow-list
   - specifically kills `exec_sql`, `generate_api_key`, `rotate_master_key` for anon
   - sets `search_path = public` on every remaining SECURITY DEFINER function
   - makes the 7 public buckets private (except truly public asset buckets like `avatars`/`book-covers`, documented)
   - adds `ALTER DEFAULT PRIVILEGES ... REVOKE ALL ... FROM PUBLIC, anon, authenticated`
2. **Keep `config.toml` generic**: project_id is fine, but document that deploy-time secrets come from the platform, not this file. Add a comment header explaining env setup.
3. **Remove `supabase/.temp/` from git** (project ref / org metadata). Add `supabase/.temp/` to `.gitignore`. It's local CLI state.
4. **Document the baseline**: `20261110000000_prod_baseline.sql` is a production-derived snapshot. Add a README in `supabase/migrations/` explaining it is a schema baseline, how it was generated, and that it may contain implementation-specific objects new contributors shouldn't assume are canonical.
5. **Edge functions**: rotate the two backfill tokens (env now), update the `kza_*` functions to fail closed if their HMAC secret is missing, and add a `supabase/functions/README.md` with the auth model per function class.
6. **CI**: keep `.github/workflows/security-audit.yml`; extend it to assert the function-grant matrix and assert no bucket is public unless allow-listed.

## 5. How real open-source projects protect themselves

Patterns used by mature projects (Supabase, PostHog, Appwrite, Nextcloud, Signal, etc.):

- **Secrets never in the repo.** Only `.env.example` with placeholders. Real values live in the hosting platform's secret manager and are injected at deploy. CI has a gitleaks/trufflehog scan on every PR.
- **Least privilege everywhere.** DB roles are scoped per service; service-role key is never used for ordinary reads. RLS is enabled and tested with role simulation (`SET LOCAL role anon; SELECT ...` in CI). No `SECURITY DEFINER` by default.
- **Default-deny grants.** New functions/tables start with no grants; access is granted explicitly. Automated checks fail the build if a function is executable by `PUBLIC`/`anon`.
- **Migration discipline.** Numbered, immutable migrations; a single baseline for new installs; no editing old migrations. Locally reproduced with Docker before PR.
- **Automated security gates in CI** — dependency audit (`npm audit`/`osv-scanner`), secret scan, SAST, CSP/header checks, container image scanning, and a "no public bucket" assertion.
- **Code owners / review.** Sensitive paths (`supabase/migrations`, `src/lib/*crypto*`, auth code) require 2 reviewers via `CODEOWNERS`.
- **Threat model & SECURITY.md** documenting what is and isn't protected, a disclosure process, and supported versions.
- **Reproducible builds + signed releases** (SLSA-style) so users can verify the published artifact matches source — critical for a security product.
- **Bug bounty** and a security@ contact; fast patch process; CVE-style advisories.
- **Separate deploy keys** per environment; rotation runbooks; short-lived credentials (OIDC) instead of long-lived PATs where possible.

For this repo specifically: the biggest gap between "clean code" and "hardened project" is **automated enforcement** — CI must fail when someone reintroduces a permissive grant or hardcodes a key. The code scan found nothing; the live DB is where the risk sits.

## 6. Recommended order

1. Apply the live lockdown migration (Phase 0) and verify with `scripts/security-audit.sql`.
2. Rotate the remaining credentials (service-role, admin, keystore).
3. Add `.temp` to gitignore, write the supabase README + migration README.
4. Extend CI with grant/bucket assertions + secret scan (already partly there).
5. Publish.

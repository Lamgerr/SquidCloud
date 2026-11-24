# 2026-11-24-supabase-hardening.md (SUPERSEDED)

This document has been **merged into** the single canonical security design:
`docs/superpowers/specs/2026-11-24-full-e2e-redesign-design.md` (v12).
Content preserved below for history only.

# Extreme Supabase Backend Hardening (v11)

Date: 2026-11-24
Status: DRAFT (awaiting approval; no code written)
Part of canonical plan: `2026-11-24-full-e2e-redesign-design.md`

## 1. Scope and goal

The backend must be hardened to the point where **compromising any single backend component yields no user plaintext and no usable key**, and where an administrator with full SQL access still cannot decrypt user data. This spec covers Postgres/RLS/functions, storage, auth, edge functions, secrets, network, audit, and CI enforcement.

Current exposure that motivated this: ~88 edge functions (many with `verify_jwt = false` in `supabase/config.toml`), ~160 `SECURITY DEFINER` definitions in the baseline migration, permissive share/file policies, a public `files` bucket, an anon-callable vault-secret reader, and token-signing primitives executable by `anon`.

## 2. Hardening layers at a glance

| Layer | Goal | User-visible? |
|---|---|---|
| Postgres roles/grants | Least privilege; no PUBLIC/anonEXECUTE on sensitive objects | No |
| RLS | One explicit policy per table; deny by default | No |
| Functions | No SECURITY DEFINER for data paths; allow-listed columns | No |
| Storage | Private buckets; signed short-lived URLs only | No — downloads still work |
| Auth | MFA, short sessions, rate limits, no email-only admin | Login only |
| Edge functions | Authenticate every caller; no service-role data reads | No |
| Secrets/network | Rotated secrets, private DB, mTLS, egress allowlist | No |
| Audit/detection | pgaudit, anomaly alerts, canaries | No |
| CI enforcement | Automated assertions on grants/policies/responses | No |

## 3. Postgres role and privilege model

### 3.1 Revoke by default
```
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
```
Then grant explicitly, per object, only what the application needs. No `GRANT ALL`, no broad `PUBLIC EXECUTE`.

### 3.2 Role separation
- `anon_gateway` — only the handful of functions needed for public share pages; no table privileges.
- `authenticated_user` — table access only through RLS; no direct function execution on key/share/secret functions.
- `bff_service` — narrow role used by the BFF's user-scoped JWT; can execute only allow-listed RPCs.
- `admin_ops` — no SELECT on `files`, `shares`, `file_key_vault`, or any key table; used for operational maintenance only.
- `service_role` — reserved for migrations and narrow admin operations; never used by data-plane functions that return file data.

### 3.3 Function inventory
Build a machine-readable manifest of all functions with: name, `prosecdef`, owner, grants, and whether it returns key/path/tag columns. CI fails on:
- Any `SECURITY DEFINER` function owned by `postgres` executable by `anon`/`authenticated`.
- Any function returning `encryption_key`, `wrapped_key`, `shared_encryption_key`, `storage_path`, tags, or chunk URLs to a non-service role.
- `row_to_json(files)` or `SELECT *` from `files` in any function body.

Target: reduce ~160 SECURITY DEFINER definitions to a short, reviewed allow-list (ideally zero on data paths).

## 4. RLS policy model

### 4.1 Rules
- Every table in `public` has RLS enabled and **at least one explicit policy**; tables with no legitimate user access have zero policies (deny all).
- `FORCE ROW LEVEL SECURITY` on all user-data tables.
- One SELECT policy per role per table, no overlapping permissive policies that OR into broader access.
- No `USING (true)` for `anon`/`authenticated`.
- No policy based solely on `is_public = true` or `shared = true` granting full rows; share access goes through the audited gateway function.
- `shares` and `files` policies owner-only; public recipients use the share gateway.
- `github_connections`, `file_key_vault`, `master_keys`, `security_keyring`, `kza_prel_*` remain owner/service-only with no extra permissive policies.

### 4.2 CI verification
Query `pg_policies` and `information_schema.role_table_grants` on every deploy; fail if any policy matches forbidden patterns, or if any key-bearing table has a policy for `anon`/`authenticated`.

## 5. Function hardening

- Convert `get_shared_file_info`, `get_file_for_share`, `get_folder_share_contents`, `update_share_options` to `SECURITY INVOKER` with explicit allow-lists and password/quorum checks in the BFF.
- Revoke `get_secret`, `kza_prel_sign_token`, `kza_prel_verify_token`, `kza_prel_rotate_hmac_key`, `create_file_record`, `exec_sql` from all non-service roles.
- `search_path` pinned on every remaining SECURITY DEFINER function; no unqualified references.
- No function accepts a user id from a caller and acts on it — identity from `auth.uid()` or the BFF session only.
- Mandatory `security_barrier` views where filters must not leak via function pushdown.

## 6. Storage hardening

- `files` bucket `public = false`; all access via short-lived (≤60 s), user-bound signed URLs from the BFF.
- No direct `/storage/v1/object/public/...` path for private data.
- Object keys opaque; no user-supplied names in paths.
- Separate buckets for ciphertext, previews, and exports with distinct policies.
- Lifecycle rules: delete old temp artifacts; encrypted cache only.
- Storage policies audited in CI: no public read on private buckets.

## 7. Auth hardening

- MFA required for accounts with sharing/admin capabilities; passkeys/WebAuthn preferred.
- Short JWT expiry (≤1 h) with refresh token rotation; BFF holds refresh tokens in server-side session only.
- Password policy: breach checks, rate limits, no password reuse, no password-derived keys (§19).
- Signup/email verification required; no anonymous account creation for vault features.
- Session invalidation on new-device approval, password change, or risk-engine escalation.
- Admin actions require hardware-key MFA and a separate admin session, never the user session.

## 8. Edge function hardening

- Inventory all ~88 functions; classify each as public, user, admin, or internal.
- Every function touching keys/shares/secrets must call `auth.getUser()` or validate a service token in code — `verify_jwt = false` is allowed only for genuinely public endpoints with their own strict validation (e.g. share gateway with verifier).
- Service-role key used only in narrow functions that never return file rows or keys.
- Egress allowlist per function; no arbitrary fetch from user-controlled URLs.
- No secrets in source; all from env/vault with rotation runbooks.
- Deploy pipeline signs artifacts; runtime verifies integrity (§17.6).
- Remove or secure the hardcoded backfill token; audit `admin-data-access` authorization.

## 9. Secrets and network

- Rotate all secrets exposed by the anon-callable `get_secret` (past and present), the PREL HMAC key (invalidating tokens), hardcoded tokens, and anything in git history/HAR/keystore files.
- Secrets stored in a managed vault with versioned rotation and short-lived credentials.
- Supabase database **not publicly reachable**; BFF connects over private networking/mTLS.
- IP allowlists on admin APIs; no SSH into production.
- CAA records, HSTS preload, CT monitoring, TLS 1.3 only.

## 10. Audit, detection, and response

- `pgaudit` enabled for DDL and access to sensitive tables; logs shipped to a separate, append-only store.
- Alerts: new SECURITY DEFINER function, broadened grant, policy change, failed auth spike, bulk share creation, recovery anomaly, service-role use outside allow-list.
- Canary rows in sensitive tables; reading them triggers an alert.
- Runbooks: DB role compromise, function privilege regression, secret leak, malicious admin, share-gateway abuse.
- Quarterly external review and continuous bug bounty.

## 11. Backup and recovery of the backend (not user vaults)

- Encrypted backups with separate key custody; restore drills quarterly.
- Backups never contain plaintext keys — enforced by column exclusion and a post-backup scan.
- Point-in-time recovery tested; no admin can restore a "convenient" older key state because no keys exist server-side.

## 12. CI enforcement (the real guarantee)

A dedicated CI job runs on every migration/function change:
1. Enumerate all `pg_proc` grants; fail on forbidden roles for sensitive functions.
2. Enumerate all policies; fail on forbidden patterns.
3. Enumerate all RPC/REST responses via schema introspection; fail on key/path/tag columns.
4. Scan all function sources for `SECURITY DEFINER`, `row_to_json`, `SELECT *`, hard-coded tokens.
5. Verify every bucket is private unless explicitly allow-listed.
6. Verify no service-role credential appears in any function that returns user data.
7. Verify `search_path` pinning on remaining definer functions.

No migration merges without this job passing.

## 13. Verification

- Anon caller cannot execute any sensitive function (`has_function_privilege` asserts).
- Authenticated user cannot enumerate shares or read another user's rows.
- Share gateway returns metadata only; password/quorum verified before wrapped blob release.
- Storage private; signed URLs expire and are user-bound.
- Secrets rotate without downtime; old PREL tokens invalidated.
- Audit alerts fire in test for each forbidden pattern.

## 14. UX contract

None of this changes the user experience. Sign in, unlock, files appear. Downloads work via signed URLs. The backend hardening is invisible.

## 15. Decision for the human

Should the backend hardening (§3–§12) ship as Phase 0 before the E2E crypto work? My recommendation: **yes** — it closes live critical exposure immediately and is independent of the key-model migration.

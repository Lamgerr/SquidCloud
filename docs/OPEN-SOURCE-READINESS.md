# Open Source Readiness & Repository Organization Report

**Generated:** 2026-11-10 (local)  
**Branch:** `fresh-main` (`18b6e245` at analysis start)  
**Scope:** organization, branch hygiene, dead/deprecated code, security risk scan, and Supabase local maintenance. This report accompanies the detailed audits in `docs/audits/`.

---

## 1) Executive Status

| Area | Status | Notes |
|---|---|---|
| Dead/deprecated audit | **Done** | `docs/audits/dead-code-audit.md` — ~30.9% of `src/` unreachable (46k LOC), 21 deps dead-only, 47 unreferenced, 8 edge fns zero-ref, notable bugs (sonner host missing, dead duplicate hook). |
| Security audit | **Done** | `docs/audits/security-audit.md` — **critical blockers**: secrets in git history, tracked HAR, PAT in local git remote, `exec_sql`/`get_secret` EXECUTE granted to PUBLIC, risky edge-function auth/CORS/RLS patterns. **Not safe to publish yet.** |
| Supabase migrations baseline | **Done (local)** | 101 migrations archived to `supabase/migrations_archive/pre-2026-11-10/`; new production-derived baseline `supabase/migrations/20261110000000_prod_baseline.sql` (schema snapshot, public+squidveil). |
| Tracked HAR removal | **Done (index)** | HAR removed from git index and `*.har` added to `.gitignore`. **History still contains it** until rewritten. |
| Contributor docs | **Added** | `SECURITY.md`, `CONTRIBUTING.md`, this report. |
| Default branch = `fresh-main` | **Pending (remote/admin)** | Remote default is currently `origin/main` (`git symbolic-ref refs/remotes/origin/HEAD`). Requires GitHub repo admin/API auth. |
| Delete other branches | **Pending (remote/admin)** | 4 local + 42 remote branches observed (46 refs total). Requires remote admin; do after default-branch switch and protection rules. |
| Git history purge (secrets/HAR) | **Pending (destructive, coordinated)** | Required before public release; rewrites all SHAs and requires force-push + reclones. |

---

## 2) Branch Inventory & Cleanup Plan

### Observed state
- **Current/local:** `fresh-main` (tracks `origin/fresh-main`, 2026-11-01), `backup/pre-date-rewrite`, `main` (tracks `origin/main`, 2026-09-01), `lamgpt/main`.
- **Remotes:** `origin` → `https://github.com/NaveenSingh9999/cloudbliss-storage.git` (default `origin/main`), `lamgpt` → `https://ghp_…@github.com/LamGPT123/cloudbliss-storage.git` (**PAT embedded locally — revoke & remove; see security audit SEC-003**).
- **Remote branches (sample/categories):** `origin/main`, `origin/fresh-main`, many `origin/claude/*`, `origin/copilot/*`, `origin/dev`, `origin/feature/*`, and misc (`ce`, `jko`, `kloik`, `nerfd`, `Atishaydeveloper`, etc.). Total refs: 46.

### Target state (requested)
- Default branch: **`fresh-main`**
- Keep only: **`fresh-main`** (and optionally a protected archival tag, not a branch) after verification.
- Delete: all other local and remote branches.

### Safe execution sequence (requires GitHub admin privileges)

> **Prereqs:** rotate/revoke leaked credentials first if repo may be exposed; ensure CI, Vercel, Supabase deploy hooks, and branch protection rules point to `fresh-main`; communicate to collaborators (history/branch rewrite will break clones).

```bash
# 1) Verify fresh-main is pushed and green
git checkout fresh-main
git pull --ff-only origin fresh-main
git push origin fresh-main

# 2) Set default branch on GitHub (repo admin)
gh auth status                    # must be an admin of NaveenSingh9999/cloudbliss-storage
gh repo edit NaveenSingh9999/cloudbliss-storage --default-branch fresh-main
# or: GitHub UI → Settings → General → Default branch → fresh-main

# 3) Delete remote branches except fresh-main (review list before running)
git fetch --prune origin
for b in $(git for-each-ref --format='%(refname:strip=3)' refs/remotes/origin | grep -v '^fresh-main$' | grep -v '^HEAD$'); do
  echo "Deleting origin/$b"; git push origin --delete "$b";
done

# 4) Delete local branches except fresh-main
for b in $(git for-each-ref --format='%(refname:short)' refs/heads | grep -v '^fresh-main$'); do
  git branch -D "$b";
done

# 5) Remove stale remote refs / misconfigured remotes
git remote prune origin
git remote remove lamgpt          # after revoking embedded PAT (SEC-003)

# 6) Update remote HEAD locally
git remote set-head origin -a
```

**Caution:** deleting `main`/other branches is irreversible for unmerged work; archive important tips as tags before deletion if needed (`git tag archive/<branch> origin/<branch>` then push tags selectively). `backup/pre-date-rewrite` and `lamgpt/main` may contain unique history — inspect before deleting.

**Current environment limitation:** `gh auth status` could not be verified here (timed out earlier) and no confirmed GitHub admin token is available; therefore remote default/branch deletion was **not** executed.

---

## 3) Deprecated, Unused, and Suspect Code (Research Summary)

Primary source: **`docs/audits/dead-code-audit.md`** (read-only analysis, 2026-11-10). Key takeaways:

### High-signal removals / cleanup candidates
- **Unreachable `src/` code:** 214 files / ~46,245 LOC (30.9%) unreachable from `src/main.tsx` by import graph (BFS). Largest clusters: dead `components/ui` shadcn set, `components/landing`, pipeline/editor clusters, backup `Dashboard-bkp11-10-26`, duplicate `src/hooks/use-mobile.tsx`, M3-superseded nav remnants, `res54-r2*` calling non-existent `get-r2-presigned-url`.
- **Dependencies:** of 158 deps — 21 dead-only, 47 unreferenced, 21 config/runtime-only; duplicates/deprecated candidates include `@codemirror/basic-setup` (deprecated), `xlsx@0.18.5` (abandoned/CVE-prone line — verify), `electron` in prod deps, `browserify-fs`/polyfills, `react-helmet`, duplicated motion libs (`framer-motion` vs `motion`). Validate before removal (Capacitor/plugins, Tailwind, dynamic usage).
- **Edge functions:** 8 zero-reference dirs reported (verify against cron/dashboard/manual invocations); duplicates/overlaps exist (e.g. upload variants, download-manager vs download-shared-file, `cloudbliss-api/index-selfcontained.ts` & `index-minimal.ts` large).
- **Known bugs in dead/partial wiring:** `sonner` toasts called but `<Sonner />` host not mounted; duplicate mobile hook; dead R2 presign invocations.
- **Stale artifacts/config:** both `bun.lockb` and `package-lock.json`, typo `publlic/`, many untouched legacy files (82% of sampled src ≤ 2026-07-31 due to repo history shape), 4 TODO/FIXME/HACK/XXX in src, 157 `console.log` in src.

### Suggested deprecation policy
- Mark candidates as **deprecated** (doc + lint/console warning where runtime-relevant) for one release cycle, then remove.
- Delete obvious backups/byte-identical artifacts and `.disabled` stubs first; gate removals of landing/vault/games/edge functions behind usage verification (analytics, cron, external clients).
- Track deprecations in `CHANGELOG.md` and `docs/architecture/decisions/` (or ADR log) with owner + removal date.

---

## 4) Security & Hack-Vulnerability Suspects

Primary source: **`docs/audits/security-audit.md`**. Treat all Critical/High items as **release blockers** for a public repo.

### Most urgent suspects
1. **Secrets in git history:** committed `.env` blobs (service role, GitHub token, MXLPY, admin creds, KZA secrets) across multiple commits — **must rotate + purge history**.
2. **Tracked HAR with auth material:** `squidcloud.vercel.app_Archive [26-10-12 23-39-13].har` (removed from index now; still in history).
3. **Local git remote PAT:** `lamgpt` remote URL embeds a GitHub PAT — revoke and remove.
4. **Dangerous DB functions:** `public.get_secret` (returns decrypted vault secrets) and `public.exec_sql` are `SECURITY DEFINER` with `EXECUTE` granted to `PUBLIC` — lock down immediately.
5. **Edge-function trust boundaries:** 34 functions `verify_jwt=false`; custom/admin gateways and maintenance routes need strict authz/signature/rate-limit review (notably `admin-data-access`, webhook/payment handlers, paid AI/GitHub-backed endpoints).
6. **RLS policy review:** RLS enabled everywhere in public, but several `USING/WITH CHECK (true)` policies for broad roles (including some `public` policies) require intent verification.
7. **ZK/key handling risk:** server-side persistence of `encryption_key` in upload paths must be reconciled with zero-knowledge claims.
8. **Supply chain:** `xlsx`, unpinned `esm.sh` imports in Deno, `electron` in prod deps, dual lockfiles, Action pinning.

### Immediate commands (operators)
```bash
# Secret scan (install gitleaks or trufflehog)
gitleaks detect --source . --verbose
# DB lockdown (review before running in prod)
# REVOKE EXECUTE ON FUNCTION public.get_secret(text) FROM PUBLIC, anon, authenticated;
# REVOKE EXECUTE ON FUNCTION public.exec_sql(text, jsonb) FROM PUBLIC, anon, authenticated;
```

---

## 5) Supabase Local Maintenance (Completed / How to Use)

### What was done
- **Archived:** all 101 existing SQL migrations → `supabase/migrations_archive/pre-2026-11-10/`.
- **Baseline created:** `supabase/migrations/20261110000000_prod_baseline.sql` generated from live production (`aouqcwbdoyrccjcrhzzi`) via Supabase Management API SQL queries.
  - Contents: extensions, `squidveil` schema, enums, 155 tables (columns/defaults/constraints), indexes, 1 view, 187 functions, triggers, RLS enablement, 312 policies.
  - **Caveat:** this is a best-effort schema snapshot (not a byte-identical `pg_dump`). Managed Supabase schemas (`auth`, `storage`, `realtime`, `vault` internals) are not fully included. Validate on a fresh local stack.

### Recommended workflow going forward
```bash
# Link local CLI to your (dev) project — do NOT target production for experiments
supabase login
supabase link --project-ref <dev-project-ref>

# Local dev (Docker required)
supabase start
supabase db reset                 # applies migrations from supabase/migrations

# Create new migrations for changes (incremental, reviewable)
supabase migration new <descriptive_name>
# ...edit SQL...
supabase db diff --use-migra -f <descriptive_name>   # if local DB reflects desired state

# Regenerate a fresh baseline only when intentionally squashing history (document why)
# Prefer periodic baseline snapshots in a separate audit branch/tag, not frequent rewrites.
```

### If you need an exact `pg_dump`-grade copy
Use a machine with Docker or direct DB credentials:
```bash
supabase db dump --linked -f supabase/schema.sql          # schema
supabase db dump --linked --data-only -f supabase/seed.sql # optional, sanitize PII/secrets
# or: pg_dump --schema-only "$DATABASE_URL" > ...
```
Direct pooler access from this environment lacked the DB password and Docker was unavailable, so the baseline was generated via the Management API instead.

---

## 6) Documentation & File Organization (Target State)

### Problems today
- ~80+ markdown files at repo root (status reports, fix logs, proposals) — hard to navigate, many stale/duplicative.
- `docs/` mixes polished docs, PDFs, SQL snippets, and ad-hoc notes; `473` tracked markdown files total.
- Duplicates/typos and sensitive artifacts: `CLOUDBLISS-API-GUIDE.md` vs `CLOUDBLISS_API_GUIDE.md`, `publlic/` vs `public/`, tracked HAR (now untracked from index), large binaries/PDFs committed.

### Proposed structure
```
/
├─ README.md                    # product overview, quickstart, links
├─ CONTRIBUTING.md              # dev workflow, PR standards
├─ SECURITY.md                  # vuln reporting, policy
├─ LICENSE
├─ CHANGELOG.md                 # curated releases (not patch-note dumps)
├─ .env.example
├─ docs/
│  ├─ README.md                 # docs index
│  ├─ architecture/             # system design, data flow, crypto model, ADRs
│  ├─ guides/                   # user/dev how-tos (CLI, mobile, deploy)
│  ├─ api/                      # API/edge-function references
│  ├─ operations/               # runbooks, Supabase/Vercel/incident ops
│  ├─ audits/                   # security, dead-code, perf audits (dated)
│  └─ archive/
│     ├─ legacy-reports/        # historical *_FIX*, *_SUMMARY*, *_COMPLETE* reports
│     └─ legacy-docs/           # superseded manuals/guides
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/               # active baseline + forward migrations only
│  ├─ migrations_archive/       # historical SQL (read-only)
│  └─ functions/
├─ src/  cli/  android/  scripts/  packages/  ...
└─ (avoid root-level report sprawl; avoid committing captures/binaries)
```

### Cleanup actions (recommended, incremental)
1. **Keep at root:** `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`, `CHANGELOG.md`, `CLAUDE.md`/agent notes only if intentionally maintained.
2. **Move root reports to `docs/archive/legacy-reports/`:** `*_FIX*.md`, `*_SUMMARY*.md`, `*_COMPLETE*.md`, `*_IMPROVEMENTS*.md`, `SESSION_SUMMARY.md`, `FINAL_*`, `PATCH_NOTES_SUMMARY.md`, one-off analyses — preserve history but declutter.
3. **Consolidate canonical docs:** merge duplicates (API guides, CLI usage), keep one source of truth under `docs/guides/` or `docs/api/`.
4. **Remove or externalize large binaries:** PDFs/HARs/screenshots/zips not needed for build → Git LFS, releases, or external storage; never commit secrets/captures.
5. **Triage stray dirs:** `publlic/` (typo), `.backups/`, `.glasscn-backup/`, `cx/`, `keplr/` — confirm ownership/purpose; move to archive or delete if unused.
6. **Add `docs/README.md` index** and keep it updated; link from root README.
7. **Enforce hygiene:** CI checks for secret scanning, lint, typecheck, and (optionally) a rule preventing new root-level `*.md` except allowlist.

### Safe migration commands (example)
```bash
# example: archive root report-style markdown (review list first!)
mkdir -p docs/archive/legacy-reports
git mv FIXES_APPLIED.md FINAL_CHECKLIST.md SESSION_SUMMARY.md docs/archive/legacy-reports/
# update internal links after moves; search for old paths
rg -n "FIXES_APPLIED.md|FINAL_CHECKLIST.md" -S
```

---

## 7) Priority Action Plan

### P0 — Blockers before making repo public
- [ ] Rotate/revoke all credentials exposed in history/local config/HAR (Supabase keys, GitHub PATs, MXLPY, admin/KZA/Gemini secrets, tokens).
- [ ] Purge git history of `.env` blobs and `*.har` (filter-repo/BFG), force-push, coordinate reclones.
- [ ] Revoke `exec_sql`/`get_secret` PUBLIC execute; audit definer grants.
- [ ] Review/fix high-risk edge functions (admin-data-access authz, webhooks, CORS, rate limits).
- [ ] Remove embedded PAT from any git remote configs; enable GitHub secret scanning & push protection.

### P1 — Repository hygiene
- [ ] Set `fresh-main` as default; delete stale branches after audit/tagging.
- [ ] Consolidate root docs into `docs/` structure; resolve duplicates.
- [ ] Remove/replace deprecated deps (`xlsx`, deprecated Codemirror setup, etc.) and dead code per audit.
- [ ] Validate baseline migration on clean Supabase local/dev project; document gaps.

### P2 — Maintainer experience
- [ ] Add `CHANGELOG.md`, issue/PR templates, CI (lint/typecheck/build/secret scan).
- [ ] Architecture + threat-model docs reflecting actual crypto/auth boundaries.
- [ ] Ownership/codeowners for security-sensitive paths (`supabase/functions/_shared`, auth/crypto libs, migrations).

---

## 8) Artifacts Produced in This Pass

- `docs/audits/dead-code-audit.md` — dead/deprecated code analysis (subagent-generated, evidence-based).
- `docs/audits/security-audit.md` — security findings and pre-publication checklist.
- `docs/OPEN-SOURCE-READINESS.md` — this report.
- `SECURITY.md`, `CONTRIBUTING.md` — baseline contributor/security policies.
- `supabase/migrations/20261110000000_prod_baseline.sql` — production-derived schema baseline.
- `supabase/migrations_archive/pre-2026-11-10/` — archived historical migrations (+ README).
- `.gitignore` updated to include `*.har`; tracked HAR removed from index (history purge still required).

*End of report.*

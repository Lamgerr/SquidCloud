# Open-Source Release Runbook

Status: **BLOCKED** on credential rotation + history rewrite. Do not publish until all steps below are complete and verified.

## Why blocked

The current tree is clean (dead code removed, deps trimmed, docs organized), but git **history** still contains:
- `.env` blobs with a real Supabase service-role JWT, GitHub token, admin credentials (SEC-001)
- `squidcloud.keystore` / `android/app/squidcloud.keystore` (Android signing key) (audit §7)
- a 552K HAR with live bearer tokens (SEC-002)
- a GitHub PAT embedded in a local git remote URL (SEC-003)

Publishing before these are purged leaks all of them to every clone.

## Step 1 — Rotate every exposed credential (DO THIS FIRST)

Assume everything in history is compromised:
- Supabase service-role key + anon/publishable keys → rotate in Supabase dashboard
- GitHub PATs (all `ghp_…` in `.env` history and `.git/config` remote) → revoke on GitHub
- Admin passwords/keys, MXLPY key, KZA secrets, payment keys → rotate at providers
- **Android signing keystore** → generate a NEW keystore; the old one is compromised. Update Android signing config and any app-store upload keys.
- Revoke active Supabase sessions (all users) after rotating JWT secrets.

## Step 2 — Remove the PAT from local git config

```bash
git remote -v | grep ghp_   # confirm
git remote set-url lamgpt https://github.com/LamGPT123/cloudbliss-storage.git
# or: git remote remove lamgpt
```

## Step 3 — Purge history with git-filter-repo

```bash
# install git-filter-repo (not part of repo)
pip install git-filter-repo  # or apt/brew

git clone --mirror https://github.com/NaveenSingh9999/cloudbliss-storage.git /tmp/clean-mirror
cd /tmp/clean-mirror

git filter-repo --invert-paths \
  --path .env \
  --path .env.local \
  --path squidcloud.keystore \
  --path android/app/squidcloud.keystore \
  --path 'squidcloud.vercel.app_Archive [26-10-12 23-39-13].har' \
  --path deploy_payload.json \
  --path l0g.txt

# verify nothing sensitive remains
git log --all --name-only --format= | grep -iE '\.env$|\.keystore$|\.har$' || echo CLEAN
```

## Step 4 — Force-push rewritten refs (coordinated)

Warning: rewrites all SHAs. All collaborators must re-clone.

```bash
git remote add origin https://github.com/NaveenSingh9999/cloudbliss-storage.git
git push --force --all origin
git push --force --tags origin
```

## Step 5 — Repo hygiene after rewrite

- Default branch → `fresh-main` (GitHub settings)
- Delete stale branches (46 refs currently; keep only `fresh-main` + optional archival tag)
- Add/verify LICENSE file (none currently)
- Enable branch protection on `fresh-main`
- Re-run CI security audit workflow (`.github/workflows/security-audit.yml`)

## Step 6 — Re-verify before going public

```bash
# secret scan
git grep -n -I -E 'ghp_[A-Za-z0-9]{20,}|sb_secret_[A-Za-z0-9]{20,}' || echo CLEAN

# keystore not tracked
git ls-files | grep -iE '\.(keystore|jks|p12)$' || echo CLEAN

# history check
git log --all --name-only --format= | grep -iE '\.env$|\.keystore$|\.har$' || echo CLEAN

# build
vercel --prod --yes
```

Only after all checks print CLEAN and the build passes should the repo be made public.

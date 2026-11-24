# Remove stale PR refs by recreating the repo

GitHub will not let anyone delete `refs/pull/*` on an existing repo
(`deny updating a hidden ref`, REST 422) — even with a full-admin PAT. The only
way to get a repo with zero old PR refs is to create a new repo from the clean
history and retire the old one.

## Prepared and verified
- Clean history bundle: `/data/data/com.termux/files/usr/tmp/opencode/squidcloud-clean-final.bundle`
- Fresh-clone verification already done: no sensitive paths, no secret blobs
- Current repo settings (to reapply): default_branch=fresh-main, has_issues=true,
  has_projects=true, has_wiki=false, merge options all true, delete_branch_on_merge=false,
  0 deploy keys, 0 webhooks

## Steps

### 1. Rotate credentials first (do not skip)
The service-role key is confirmed live. Rotate before publishing:
- Supabase service-role key (+ anon/publishable if rotating JWT secret)
- Admin access key / password
- Android signing keystore (generate new)
- Anything ever stored in the Supabase vault

### 2. Create the new repo (PAT with repo scope)
```bash
TOKEN="ghp_…"
curl -X POST https://api.github.com/user/repos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -d '{"name":"cloudbliss-storage-clean","private":true,"has_issues":true,"has_projects":true,"has_wiki":false}'
```

### 3. Push clean history
```bash
git clone /data/data/com.termux/files/usr/tmp/opencode/squidcloud-clean-final.bundle /tmp/newrepo
cd /tmp/newrepo
git remote add new https://x-access-token:$TOKEN@github.com/Lamgerr/cloudbliss-storage-clean.git
git push new refs/heads/fresh-main:refs/heads/fresh-main
```

### 4. Reapply settings + point deploys at the new repo
```bash
gh api -X PATCH repos/Lamgerr/cloudbliss-storage-clean \
  -f default_branch=fresh-main -f delete_branch_on_merge=false
```
- Update Vercel project → new repo (or keep Vercel and just rename).
- Update any Supabase/GitHub Actions checkout URLs, badges, docs links.

### 5. Verify the new repo is clean
```bash
git clone git@github.com:Lamgerr/cloudbliss-storage-clean.git /tmp/verify
cd /tmp/verify
git ls-remote origin | grep refs/pull/   # expect 0
git log --all --name-only --format= | grep -iE '(\.env$|\.keystore$|\.har$)'  # expect none
```

### 6. Retire the old repo (DESTRUCTIVE — your call)
Only after the new repo is verified and all deploys point at it:
```bash
gh repo delete Lamgerr/cloudbliss-storage --yes
gh repo rename cloudbliss-storage-clean --new-name cloudbliss-storage
```
Then re-clone everywhere, re-point Vercel, re-add branch protection, add a LICENSE.

# What happened while you were away

## Done
- **Legacy file downloads fixed.** Old chunks stored only a repo name + account index; the edge functions guessed the owner from global env accounts that no longer own those repos, so GitHub returned 404. Live CLI SQL and a direct GitHub API test confirmed the repos live under `LamGPT123`. Both `squidcloud-cluster` and `github-storage` now resolve the owner at read time: a dedicated storage credential first, then the requesting user's GitHub connection, then the legacy accounts and public access. Both functions were redeployed. The supplied token was stored only as a Supabase secret — it is not in the repo.
- **Books / DeepRead deprecated in the UI.** Removed the Books tab and catalog from the Dashboard and all standalone reader mounts across FileCard, MobileEnhancedUI, ManageFileRequests and SharePage. EPUBs remain readable inline in the instant preview modal.
- Committed `de2baf40`. Web app **READY** at `https://cloudbliss-storage-5yw6gy30f-sqc.vercel.app`.

## In progress
- Nothing actively being edited. Please retry an old file in the app.

## Blocked / needs a decision
- No local `tsc`/`deno`; Vercel build and Supabase CLI deploy are authoritative.
- An anonymous invoke of the edge function is blocked by the app's PREL token (`KZA_PREL_MISSING`); the exact GitHub fetch behind the fix was independently verified at HTTP 200.

## Queued next
- If any specific repo still 404s, identify its owner and add a credential or repo-owner mapping.

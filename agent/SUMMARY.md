# SUMMARY — SquidCloud

## Done
- **Auth**: monochrome, dashboard-consistent, glass segmented switcher, Apple-style shake on failed sign-in, proper passkey/OAuth SVGs.
- **AccountSettings**: centred shell, no boxed rail, TOTP panel with real QR + six-digit input, vault security in Security, encryption cards monochrome glass. Background seam (fixed attachment) removed.
- **Vault reset is BFF-gated**: browser calls `POST /api/internal/vault` (`op: reset-vault`) with the session JWT; the BFF verifies identity and invokes the Supabase edge function server-side. No direct Supabase call from the client. Edge function requires verified email, fresh session, TOTP `aal2` if enrolled, passkey verification if registered, and typed `ERASE`; deletes folders, files, keys, shares and all storage objects under the user prefix. Deployed via Supabase CLI (`verify_jwt=true`, unauthenticated call returns 401).
- **Skills**: 99 installed globally, including OWASP secure-agent-playbook, briiirussell cybersecurity skills, `headless-bff-architecture`, and the 37 UI/UX skills.
- Repo public/clean, release v13.0.38. Vercel READY.

## Blocked — needs a decision
- Supabase service-role key from old history still live; user deprioritized rotation.
- No local browser rendering; cannot self-verify visual quality.
- BFF endpoint returned curl 000 from this sandbox (network limitation); its live response was not verified here. Edge function unauthenticated gate was verified.

## Queued next
1. Await user verdict on the BFF-gated reset and settings layout.
2. Apply the same BFF pattern to any other destructive Supabase operation if requested.

Live: https://squidcloud.vercel.app · Repo: https://github.com/Lamgerr/SquidCloud

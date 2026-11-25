# SUMMARY — SquidCloud

## Done
- **Auth**: monochrome, dashboard-consistent, glass segmented switcher with EnterpriseSidebar spring physics, proper passkey/OAuth SVGs, Apple-style shake on failed sign-in.
- **AccountSettings**: layout bug fixed — boxed rail removed (floating items + glass active thumb), shell centred, content pane constrained to 720px. TOTP setup redesigned: real QR image, two-step panel, six segmented OTP cells. Vault security panel inside Security. Encryption cards monochrome glass. Apple shake on MFA/password errors. Vault recovery card added with typed ERASE confirmation and visible formatting progress.
- **Vault unlock dialog**: no white tints, Apple shake on wrong password.
- **Uploads**: silently use the account key; key choice is opt-in.
- **DeveloperAPI**: light consistency layer.

## Blocked — needs a decision
- **vault-reset purge endpoint is NOT implemented.** Recovery UI invokes a `vault-reset` function that does not exist; it will fail until an authorized server-side purge is built. Per AGENTS.md, irreversible deletion of live DB rows/file chunks was not performed or wired autonomously.
- Supabase service-role key from old history still live; user deprioritized rotation.
- No local browser rendering; cannot self-verify visual quality.

## Queued next
1. Await verdict on settings layout, rail, TOTP and shake.
2. With explicit authorization: implement the irreversible vault-reset edge function (auth-verified, typed confirmation, purge DB rows + storage chunks), then deploy.

Live: https://squidcloud.vercel.app · Repo: https://github.com/Lamgerr/SquidCloud

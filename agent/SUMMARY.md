# SUMMARY — SquidCloud

## Done
- **BFF hang fixed**: `POST /api/internal/vault` was timing out because the handler returned objects instead of writing to `res`. All responses now use `res.status().json()`; live unauthenticated call returns 401 immediately.
- **Vault reset gates corrected**: removed the self-imposed 10-minute session-age gate that produced edge 403. Keeps verified email, TOTP `aal2` when enrolled, passkey verification when registered, and typed `ERASE`. Edge function redeployed.
- **Settings layout seam fixed**: the global `body::before` wash was viewport-fixed and ended at 100vh; it is now disabled on settings pages and the wash is painted on the page root. Rail forced transparent/borderless at all widths.
- Auth and other settings UI work from earlier turns remains in place. Vercel READY.

## Blocked — needs a decision
- Supabase service-role key from old history still live; user deprioritized rotation.
- No local browser rendering; cannot self-verify visual quality.

## Queued next
1. User to retest the reset flow and screenshot the settings page.
2. If reset returns 428, complete the requested TOTP/passkey step-up in the dialog.

Live: https://squidcloud.vercel.app · Repo: https://github.com/Lamgerr/SquidCloud

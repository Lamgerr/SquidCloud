# SquidCloud backlog (ranked)

## Now
- [x] **Live v4 pipeline verification pass (HTTP-level; X11 display unavailable for browser sweep).** Upload a real file on production; verify preview (text/image/markdown), video streaming, full download, share link with password, and vault unlock in the same session. Fix any break found. The last several days were a cascade of preview/video regressions found one at a time by the user — needs one systematic sweep, not another patch cycle.
- [x] **Forgot-password vault key recovery.** Password reset does not rewrap master keys; a user who resets password can lose access to v4 files. Need a recovery-phrase-backed rewrap path and a clear UI warning.

## Next
- [x] **Rotate the leaked service-role key** — SKIPPED, needs a human; runbook at docs/SECURITY-KEY-ROTATION-RUNBOOK.md. (long-standing security blocker, previously deprioritized). After rotation, revoke/replace any derived tokens and re-run the invariant gate.
- [x] **Client error telemetry.** Add a rate-limited BFF `client-error` op so decrypt/stream failures arrive as structured events instead of screenshots. Include file format, step, and error code — never key material or plaintext.
- [x] **Optional v4 upgrade for legacy files.** Client-side "upgrade my files" action that decrypts legacy ciphertext and re-encrypts as chunked v4, with progress, resume, and no server key escrow. Must remain opt-in and backward-compatible reads must stay.

## Later
- [x] Retention policies for `security_events`, `kza_threat_events`, and webhook logs; remove the 4 empty buckets if no external consumers.
- [x] Adaptive preview budget (stop fetching after the first complete frame instead of a fixed chunk count).
- [x] Re-enroll legacy passkeys so they gain real WebAuthn signature verification instead of the emailed magic-link step.
- [ ] Make preview chunk budget and KTL cache TTL configurable rather than hardcoded.
- [ ] SKIPPED — needs a human: empty bucket deletion (Supabase blocks direct SQL deletes; no MCP delete tool).

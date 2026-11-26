# SUMMARY — SquidCloud

## Done
- Full file pipeline reviewed: upload/encryption, storage, share/preview/download, key management, auth/recovery, and canonical security docs. High-severity claims were verified directly in source.
- Wrote `docs/superpowers/specs/2026-11-26-file-pipeline-security-review.md` with current state, confirmed gaps, target architecture, and a four-phase roadmap. No product code changed.
- Earlier: all non-marketing pages use shared floating glass navigation and symmetric monochrome shells; share guard accepts password or encryption key; vault/share BFF flows and UI fixes in place. Vercel READY.

## Critical finding
- The product is **not fully E2E today**: default uploads send raw AES keys to the server (`res54.ts:774-791`), the server KEK can derive from the leaked service-role key, `passkey-auth` skips WebAuthn verification and returns an OTP, and anon can reach share metadata/wrapped key before the password check.

## Blocked / needs a decision
- Supabase service-role key from old history remains live; user previously deprioritized rotation, but real E2E requires rotating it.
- Migration-history mismatch blocks DB migrations; schema fixes currently done at BFF layer.
- Canonical E2E spec is still marked awaiting approval while README describes ZK as live; docs need alignment after implementation.

## Queued next
1. Phase 0 from the review: fix passkey auth, close anon share key leak, stop raw-key escrow for new uploads.
2. Then crypto correctness and E2E usability phases.

Live: https://squidcloud.vercel.app · Repo: https://github.com/Lamgerr/SquidCloud

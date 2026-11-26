# SUMMARY — SquidCloud

## Done
- E2E hardening, Supabase cleanup (380 MB → 67 MB), and anon share-RPC closure all shipped and pushed.
- Instant preview fixed: new v4 uploads use 1 MiB independently decryptable frames, and the modal fetches only the first chunks instead of reconstructing the whole file. Existing v4 ciphertext remains readable.

## In progress
- Nothing mid-edit. Working tree clean.

## Blocked — needs a decision
- Service-role key from old history remains live (previously deprioritized).
- PDF/EPUB previews still require full files.

## Queued next
1. Make the preview chunk budget adaptive (stop after the first complete frame).
2. Rotate the leaked service-role key.

Live: https://squidcloud.vercel.app · Repo: https://github.com/Lamgerr/SquidCloud

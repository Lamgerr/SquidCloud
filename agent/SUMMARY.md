# SUMMARY — SquidCloud

## Done
- Vault unlock works via master-key verification through BFF.
- Settings layout verified live in your existing Zen browser via a new `x11-computer` MCP: rail compacted so "System" is fully visible, no seam, no enclosing rail box.
- Share decrypt logging routed through BFF; share-access diagnostics deployed.
- OpenCode Supabase MCP uses PAT header (OAuth redirect was rejected).
- Dedicated computer-use tooling for OpenCode CLI built locally because agent-browser/orca/open-computer-use/Playwright cannot attach to existing Firefox-based Zen on Termux Android. `x11-computer` MCP is connected and attached to your browser.
- Vercel READY, pushed to `fresh-main`.

## Blocked / needs data
- `wrong_password` needs one retry so new diagnostics show submitted vs stored lengths (no secrets logged).
- Supabase migration-history mismatch blocks DB migrations; fixes done at BFF layer.
- Supabase service-role key from old history still live (user deprioritized rotation).

## Queued next
1. Confirm the current settings screenshot is the correct issue resolved.
2. Read share-access diagnostics after user retries.

Live: https://squidcloud.vercel.app · Repo: https://github.com/Lamgerr/SquidCloud

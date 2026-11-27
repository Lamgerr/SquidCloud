# Service-role key rotation (owner action required)

The service-role key from the public repository history is still live. There is
no Supabase MCP or CLI tool that rotates it, so this must be done in the
dashboard by an owner:

1. Supabase dashboard → Project settings → API → **Rotate** the `service_role` key.
2. Update every consumer of the old key:
   - Vercel project environment variables (`SUPABASE_SERVICE_ROLE_KEY`) — set
     the new value for Production **and** Preview.
   - Any GitHub Actions secrets that hold it.
   - Local `.env` files (never commit them).
3. Redeploy the app (`vercel --prod --yes`) and redeploy Edge Functions that use
   the service key (the BFF reads it from Vercel env).
4. Verify: a signed-in request to `/api/internal/vault` op `vault-state`
   succeeds (200, not 503/500), and `node scripts/check-e2e-invariants.mjs`
   passes.
5. Confirm the old key is rejected (401) with a direct REST call.

Log the rotation date here: `__________`.

This item is intentionally **SKIPPED — needs a human** in the agent loop.

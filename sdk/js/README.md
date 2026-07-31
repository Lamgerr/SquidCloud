# @squidcloud-kodai/squidveil-js

Official JavaScript/TypeScript SDK for [SquidVeil](https://squidcloud.vercel.app), the standalone secrets manager.

Zero runtime dependencies (uses the platform `fetch`). Strict TypeScript. Retries with jittered backoff. Optional TTL caching. Typed errors. No secret ever written to logs.

```bash
npm install @squidcloud-kodai/squidveil-js
```

## Server usage (Node 18+)

```ts
import { SquidVeilClient } from "@squidcloud-kodai/squidveil-js";

const client = new SquidVeilClient({
  url: process.env.SQUIDVEIL_URL,      // or env var SQUIDVEIL_URL
  token: process.env.SQUIDVEIL_TOKEN,  // or env var SQUIDVEIL_TOKEN
  cacheTtlMs: 60_000,
});

const secret = await client.getSecret("prod/db-password");
use(secret.value);                     // in memory only
```

## Consumer flow with VeilRefs

Issue a signed, one-time reference on the app server — the consumer needs no token of their own:

```ts
// app server
const ref = await client.issueVeilRef("prod/db-password", {
  maxUses: 1,
  refTtl: 300,
  opsAllowed: ["resolve"],
});
// hand ref.json to the consumer

// consumer (no token)
const resolved = await client.resolveVeilRef(ref.json);
console.log(resolved.value);
```

## Browser usage (verify only)

The browser build exports only `verifyVeilRef` — it takes no token and never transports a secret value:

```ts
import { verifyVeilRef } from "@squidcloud-kodai/squidveil-js/browser";

const ok = await verifyVeilRef(refJson, {
  url: "https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/squidveil-api",
});
if (ok.verified) { /* ref is valid, version ok */ }
```

Never use the server client in a browser — it holds a token and can read values.

## Features

- **Secrets**: `getSecret(name, version?)`, `listSecrets()`, `listVersions(name)`, `createSecret(...)`, `rotateSecret(name)`, `configureRotation(...)`, `softDelete(name)`, `undelete(name)`, `destroy(name)`
- **VeilRefs**: `issueVeilRef(...)`, `verifyVeilRef(json)`, `resolveVeilRef(json)` with device binding via `deviceFingerprint`
- **Audit**: `auditVerify()` — HMAC chain integrity check
- **Caching**: `cacheTtlMs` — thread-safe in-memory cache per `(name, version)`; `clearCache()`
- **Resilience**: exponential backoff with full jitter on 429/5xx/network errors, honors `Retry-After`, per-request `timeoutMs`, configurable `maxRetries`

## Errors

All failures throw a `SquidVeilError` subclass with a stable `.code`:

```ts
import { VeilRefError, RateLimitedError, PermissionError } from "@squidcloud-kodai/squidveil-js";

try {
  await client.resolveVeilRef(refJson);
} catch (e) {
  if (e instanceof VeilRefError) console.log(e.code);      // CONSUMED / EXPIRED / BAD_SIGNATURE ...
  if (e instanceof RateLimitedError) console.log(e.retryAfterMs);
}
```

Errors never contain secret values or tokens.

## Examples by stack

**Next.js (server route only)**

```ts
// app/api/config/route.ts
import { SquidVeilClient } from "@squidcloud-kodai/squidveil-js";

export async function GET() {
  const client = new SquidVeilClient({ cacheTtlMs: 60_000 });
  const secret = await client.getSecret("prod/api-key");
  return Response.json({ apiKey: secret.value });
}
```

**Express**

```ts
import { SquidVeilClient } from "@squidcloud-kodai/squidveil-js";

const client = new SquidVeilClient({ cacheTtlMs: 60_000 });

app.get("/api/config", async (_req, res) => {
  res.json({ apiKey: (await client.getSecret("prod/api-key")).value });
});
```

**Plain HTML** — the browser never touches SquidVeil. Your server proxies:

```html
<script>
  const config = await fetch("/api/config").then(r => r.json());
  // config.apiKey — served by your backend, resolved via SquidVeil server-side
</script>
```

## Development

```bash
npm install
npm run build      # ESM + CJS + types
npm test           # unit tests (offline)
```

## Security

- Zero runtime dependencies (no supply-chain surface)
- Secrets never appear in logs, exceptions, or `toString()`
- Token redacted in `toString()`: `<SquidVeilClient url=... token=***>`
- Browser build cannot read values by construction

## License

Apache-2.0

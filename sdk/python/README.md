# squidveil — Python SDK

Official Python SDK for [SquidVeil](https://squidcloud.vercel.app), the standalone secrets manager.

Zero runtime dependencies. Typed errors. Retries with jittered backoff. Optional TTL caching. No secret ever written to logs.

```bash
pip install squidveil
```

## Quick start

```python
from squidveil import SquidVeilClient

client = SquidVeilClient.from_env()   # reads SQUIDVEIL_URL + SQUIDVEIL_TOKEN

secret = client.get_secret("prod/db-password", cache_ttl=60)
db_connect(secret.value)              # value lives in memory only
```

Environment variables:

| Variable | Meaning |
|---|---|
| `SQUIDVEIL_URL` | Base URL of the SquidVeil API |
| `SQUIDVEIL_TOKEN` | Access token (`sv_...`) |

## Consumer flow with VeilRefs

Issue a signed, one-time reference on the app server — hand it to the consumer, who needs no token of their own:

```python
# app server (has a token)
ref = client.issue_veilref("prod/db-password", max_uses=1, ref_ttl=300, ops_allowed=["resolve"])
print(ref.json)   # the only thing the consumer needs

# consumer (no token, any language)
result = client.resolve_veilref(ref_json)
print(result.value)
```

Use `verify_veilref()` when you only need a yes/no — the value never crosses the wire.

## Features

- **Secrets**: `get_secret(name, version=...)`, `list_secrets()`, `list_versions(name)`, `create_secret(...)`, `rotate_secret(name)`, `configure_rotation(...)`, `soft_delete(name)`, `undelete(name)`, `destroy(name)`
- **VeilRefs**: `issue_veilref(...)`, `verify_veilref(json)`, `resolve_veilref(json)` with device binding via `device_fingerprint=`
- **Audit**: `audit_verify()` — HMAC chain integrity check
- **Caching**: `SquidVeilClient(url, token, cache_ttl=60)` — thread-safe, in-memory, per `(name, version)`; `clear_cache()`
- **Resilience**: exponential backoff with full jitter on 429/5xx/network errors, honors `Retry-After`, configurable `timeout` and `max_retries`

## Errors

All failures raise a `SquidVeilError` subclass with a stable `.code` — match on codes, never on messages:

```python
from squidveil import VeilRefError, PermissionError, NotFoundError, RateLimitedError

try:
    client.resolve_veilref(ref_json)
except VeilRefError as e:      # CONSUMED / EXPIRED / BAD_SIGNATURE / DEVICE_MISMATCH
    print(e.code)
except RateLimitedError as e:
    print(e.retry_after)
```

Errors never contain secret values or tokens.

## Examples by stack

**FastAPI**

```python
from fastapi import FastAPI
from squidveil import SquidVeilClient

app = FastAPI()
client = SquidVeilClient.from_env(cache_ttl=60)

@app.get("/api/config")
def config():
    return {"api_key": client.get_secret("prod/api-key").value}
```

**Django**

```python
from squidveil import SquidVeilClient

client = SquidVeilClient.from_env(cache_ttl=60)

def api_config(request):
    return JsonResponse({"api_key": client.get_secret("prod/api-key").value})
```

**Next.js (server route only — never from the browser)**

```ts
// app/api/config/route.ts
const client = new SquidVeilClient({ token: process.env.SQUIDVEIL_TOKEN }); // npm: @squidveil/js

export async function GET() {
  const secret = await client.getSecret("prod/api-key");
  return Response.json({ apiKey: secret.value });
}
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
python3 -m unittest discover -s tests          # unit tests (offline)
SQUIDVEIL_LIVE=1 python3 -m unittest discover -s tests   # + live integration tests
```

## Security

- Zero runtime dependencies (no supply-chain surface)
- Secrets never appear in logs, exceptions, or `repr()`
- Token redacted in `repr()` (`<SquidVeilClient url=... token=***>`)
- HTTP only: pass `https://` URLs

## License

Apache-2.0

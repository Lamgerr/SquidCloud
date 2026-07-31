# squidveil-go

Official Go SDK for [SquidVeil](https://squidcloud.vercel.app), the standalone secrets manager.

Standard library only — zero external dependencies. Context-aware, retries with jittered backoff, optional TTL caching, typed errors with stable codes.

```bash
go get squidveil.vercel.app/squidveil-go
```

## Quick start

```go
import (
    "context"
    squidveil "squidveil.vercel.app/squidveil-go"
)

func main() {
    ctx := context.Background()
    client, err := squidveil.NewFromEnv(squidveil.WithCacheTTL(60*time.Second))
    if err != nil { panic(err) }

    secret, err := client.GetSecret(ctx, "prod/db-password")
    if err != nil { panic(err) }
    connect(secret.Value) // in memory only
}
```

Environment variables: `SQUIDVEIL_URL`, `SQUIDVEIL_TOKEN`.

## Consumer flow with VeilRefs

```go
// app server
ref, err := client.IssueVeilRef(ctx, "prod/db-password", squidveil.VeilRefIssueOptions{
    MaxUses: 1, RefTTL: 300, OpsAllowed: []string{"resolve"},
})
// hand ref.JSON to the consumer — it is the only thing they need

// consumer (no token)
resolved, err := client.ResolveVeilRef(ctx, ref.JSON)
fmt.Println(resolved.Value)
```

## Features

- **Secrets**: `GetSecret(name, version...)`, `ListSecrets()`, `ListVersions(name)`, `CreateSecret(...)`, `RotateSecret(name)`, `ConfigureRotation(...)`, `SoftDelete(name)`, `Undelete(name)`, `Destroy(name)`
- **VeilRefs**: `IssueVeilRef(...)`, `VerifyVeilRef(json)`, `ResolveVeilRef(json)` with device binding via `WithDeviceFingerprint`
- **Audit**: `AuditVerify()` — HMAC chain integrity check
- **Caching**: `WithCacheTTL(d)` — in-memory, per `(name, version)`; `ClearCache()`
- **Resilience**: exponential backoff with full jitter on 429/5xx/network failures, honors `Retry-After`, per-request timeout, configurable `WithMaxRetries`

## Errors

All failures are `*squidveil.Error` with stable `.Code` and `.Status`. Match on codes, never on messages:

```go
resolved, err := client.ResolveVeilRef(ctx, ref.JSON)
if err != nil {
    switch {
    case squidveil.IsVeilRefConsumed(err): // CONSUMED
    case squidveil.IsNotFound(err):        // NOT_FOUND
    case squidveil.IsPermission(err):      // FORBIDDEN
    case squidveil.IsRateLimited(err):     // RATE_LIMITED
    }
}
```

Errors never contain secret values or tokens.

## Example by stack

**Any HTTP service (net/http, gin, chi, echo...)**

```go
var client *squidveil.Client // init once at startup with caching

func configHandler(w http.ResponseWriter, r *http.Request) {
    secret, err := client.GetSecret(r.Context(), "prod/api-key")
    if err != nil {
        http.Error(w, "upstream unavailable", http.StatusServiceUnavailable)
        return
    }
    _ = json.NewEncoder(w).Encode(map[string]string{"apiKey": secret.Value})
}
```

**Cron job / CLI**

```go
func main() {
    client, _ := squidveil.NewFromEnv()
    ok, err := client.RotateSecret(context.Background(), "prod/db-password")
    // ok, err — rotate on schedule, consumers re-resolve next time
}
```

## Development

```bash
go test ./...   # unit tests (offline)
SQUIDVEIL_LIVE=1 go test -run Live   # + live integration tests
```

## Security

- Zero external dependencies (no supply-chain surface)
- Secrets never appear in logs, errors, or `String()`
- Token redacted in `String()`: `<SquidVeilClient url=... token=***>`
- All requests carry `Accept: application/json` and a stable `User-Agent`

## License

Apache-2.0

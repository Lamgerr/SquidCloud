# Edge function auth inventory

Generated 2026-11-25 from `supabase/config.toml` + function sources.
34 functions are configured `verify_jwt = false`. Each must authenticate in
code. This inventory records the mechanism each uses so regressions are visible.

| Function | Auth mechanism(s) |
|---|---|
| api-key-management | PREL, service-role |
| api-file-upload | PREL, `cb_` API key, signature?, service-role |
| api-file-delete | PREL, `cb_` API key, service-role |
| api-file-metadata | PREL, `cb_` API key, service-role |
| get-app-updates | PREL, service-role |
| admin-auth | PREL, service-role |
| admin-data-access | JWT + PREL, service-role |
| cloudbliss-api | API key, signature?, service-role |
| github-storage | PREL, service-role |
| hls-generation | PREL, service-role |
| media-master-manifest | PREL, signature?, service-role |
| media-playlist | PREL, signature?, service-role |
| media-segment | PREL, signature?, service-role |
| kza-prel | JWT, `cb_` token, signature?, service-role |
| cli-oauth | JWT, service-role |
| cloud-file-browser | PREL, service-role |
| download-shared-file | PREL, service-role |
| generate-pdf-url | PREL, service-role |
| github-api | PREL, service-role |
| github-cluster | PREL |
| kza-oracle | PREL, service-role |
| kza-phantom | API key, PREL, signature?, service-role |
| kza-sentinel | PREL, signature?, service-role |
| kza-verdict | PREL, service-role |
| kza-heartbeat | PREL, signature?, service-role |
| kza-admin | PREL, signature?, service-role |
| serve-pdf | JWT, PREL, service-role |
| serve-pdf-secure | PREL, service-role |
| verify-provider | PREL |
| video-stream-proxy | PREL, signature?, service-role |
| storage-backend | PREL, service-role |
| video-stream-url | PREL, signature?, service-role |
| subscription-manager | JWT, signature?, service-role |
| squidfs-bridge | signature?, service-role |

## Assessment

No function is completely unauthenticated — all pass through at least PREL,
JWT, API key, or signature validation. The residual risk is **PREL
misconfiguration or fail-open behavior**, not missing auth code.

## Required follow-up

- Verify `withPrelGateway` fails closed when its HMAC secret is absent (add an
  explicit guard if not present).
- For webhook functions (`maxelpay-webhook`, `cloudbliss-api` inbound), verify
  provider signature verification is mandatory, not best-effort.
- `get-app-updates` is effectively public data; confirm PREL allows read-only
  anonymous access deliberately and rate-limits it.
- Add a CI check that any new `verify_jwt = false` function must appear in this
  table with an explicit auth mechanism.

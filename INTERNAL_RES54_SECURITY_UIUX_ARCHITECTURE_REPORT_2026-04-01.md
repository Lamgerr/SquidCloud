# Internal Security, UI/UX, and RES54 Architecture Report

Creation date: 2026-04-01
Audience: Internal engineering, security, and product teams
Scope: Frontend codebase, Supabase backend/database/functions, and RES54 data flow

## 1) Executive Summary

This audit identifies multiple critical security issues across the current RES54 and Supabase integration. The most severe risks are unauthenticated edge-function exposure, client-side key-material leakage through metadata, and stored XSS vectors in markdown/editor previews. 

The UI/UX layer is visually mature and responsive, but has reliability and trust-impacting gaps (broken route links, unsafe preview rendering). The current RES54 architecture is effective for throughput and distribution goals, but key management and trust boundaries are not production-safe yet.

### Overall posture

- Security posture: High risk
- UI/UX maturity: Good, with important reliability/security blockers
- Architecture maturity: Functional for scale, not yet hardened for adversarial conditions

## 2) Methodology and Data Sources

### Codebase review

- RES54 orchestrator and crypto paths:
  - [src/lib/res54.ts](src/lib/res54.ts#L97)
  - [src/lib/encryption.ts](src/lib/encryption.ts#L13)
- Edge Functions (auth, storage, media, sharing):
  - [supabase/functions](supabase/functions)
- Rendering/execution sinks:
  - [src/components/EnhancedMarkdownPreview.tsx](src/components/EnhancedMarkdownPreview.tsx#L193)
  - [src/components/EnhancedTextEditor.tsx](src/components/EnhancedTextEditor.tsx#L785)
  - [src/pages/cbCode.tsx](src/pages/cbCode.tsx#L495)

### Supabase MCP live checks

- Tables and RLS state (live)
- Security advisors and performance advisors (live)
- Edge function deployment metadata (live)
- SQL-based hardening checks for functions/search_path and security-definer usage (live)

## 3) Scoring Model

### Security risk score

$$
R_{security} = \sum_{i=1}^{n} w_i \cdot s_i, \quad s_i \in [0,10], \quad \sum w_i = 1
$$

Where higher score means higher risk exposure.

### UI/UX score

$$
S_{ux} = 0.25\,S_{navigation} + 0.20\,S_{accessibility} + 0.20\,S_{interaction} + 0.15\,S_{consistency} + 0.20\,S_{performance}
$$

Where each component score is in [0, 10].

## 4) Security Findings

## 4.1 Critical Findings

| ID | Severity | Finding | Evidence | Impact |
|---|---|---|---|---|
| SEC-01 | Critical | Unauthenticated privileged edge proxies | [supabase/functions/github-api/index.ts](supabase/functions/github-api/index.ts#L25), [supabase/functions/github-api/index.ts](supabase/functions/github-api/index.ts#L49), [supabase/functions/gemini-api/index.ts](supabase/functions/gemini-api/index.ts#L25), [supabase/functions/gemini-api/index.ts](supabase/functions/gemini-api/index.ts#L35), [supabase/functions/github-storage/index.ts](supabase/functions/github-storage/index.ts#L77), [supabase/functions/create-repos/index.ts](supabase/functions/create-repos/index.ts#L16) | Abuse of server-side tokens, arbitrary proxy calls, storage manipulation, and cost amplification |
| SEC-02 | Critical | RES54 key material included in persisted metadata payload | [src/lib/res54.ts](src/lib/res54.ts#L307), [src/lib/res54.ts](src/lib/res54.ts#L897), [src/lib/res54.ts](src/lib/res54.ts#L1162) | Confidentiality break if metadata is exposed; decryption material and chunk map are co-located |
| SEC-03 | Critical | Stored XSS risk in markdown/editor preview pipelines | [src/components/EnhancedMarkdownPreview.tsx](src/components/EnhancedMarkdownPreview.tsx#L193), [src/components/EnhancedMarkdownPreview.tsx](src/components/EnhancedMarkdownPreview.tsx#L17), [src/components/EnhancedTextEditor.tsx](src/components/EnhancedTextEditor.tsx#L785), [src/components/EnhancedTextEditor.tsx](src/components/EnhancedTextEditor.tsx#L1041) | Session compromise, credential theft, malicious script execution in trusted origin |

### Critical notes

- Supabase edge deployment metadata indicates a broad verify_jwt disabled surface (majority of active functions), which magnifies SEC-01 if any function lacks strict internal authz checks.
- validate-share currently returns internal fields including encryption-related fields and owner id:
  - [supabase/functions/validate-share/index.ts](supabase/functions/validate-share/index.ts#L80)
  - [supabase/functions/validate-share/index.ts](supabase/functions/validate-share/index.ts#L81)
- Share RPC definition explicitly returns encryption_key and grants execution to anon:
  - [supabase/migrations/20250914_enhance_file_shares.sql](supabase/migrations/20250914_enhance_file_shares.sql#L39)
  - [supabase/migrations/20250914_enhance_file_shares.sql](supabase/migrations/20250914_enhance_file_shares.sql#L49)
  - [supabase/migrations/20250914_enhance_file_shares.sql](supabase/migrations/20250914_enhance_file_shares.sql#L68)
  - [supabase/migrations/20250914_enhance_file_shares.sql](supabase/migrations/20250914_enhance_file_shares.sql#L80)

## 4.2 High Findings

| ID | Severity | Finding | Evidence | Impact |
|---|---|---|---|---|
| SEC-04 | High | Predictable fallback secret for stream URL signatures | [supabase/functions/video-stream-url/index.ts](supabase/functions/video-stream-url/index.ts#L103), [supabase/functions/video-stream-proxy/index.ts](supabase/functions/video-stream-proxy/index.ts#L41), [supabase/functions/media-manifest/index.ts](supabase/functions/media-manifest/index.ts#L289), [supabase/functions/media-master-manifest/index.ts](supabase/functions/media-master-manifest/index.ts#L147), [supabase/functions/media-playlist/index.ts](supabase/functions/media-playlist/index.ts#L173), [supabase/functions/media-segment/index.ts](supabase/functions/media-segment/index.ts#L328) | Signature forgery possible if env secret is unset or misconfigured |
| SEC-05 | High | Placeholder RES54 crypto in edge PDF path (XOR placeholder) | [supabase/functions/serve-pdf/res54.ts](supabase/functions/serve-pdf/res54.ts#L2), [supabase/functions/serve-pdf/res54.ts](supabase/functions/serve-pdf/res54.ts#L20), [supabase/functions/serve-pdf/res54.ts](supabase/functions/serve-pdf/res54.ts#L46) | Non-production cryptography, data confidentiality/integrity risk |
| SEC-06 | High | RLS disabled on 5 of 56 public tables, including passkeys table with policies present | Supabase live SQL audit on 2026-04-01: rls_disabled_tables = 5, includes user_passkeys with 4 policies but RLS disabled | Potential unintended row exposure and policy bypass |

### RLS-disabled tables (live)

- account_health_logs
- share_audit_logs
- share_collection_files
- share_collections
- user_passkeys (policy_count = 4 while RLS disabled)

## 4.3 Medium Findings

| ID | Severity | Finding | Evidence | Impact |
|---|---|---|---|---|
| SEC-07 | Medium | Public functions missing fixed search_path | Supabase live SQL audit: public_functions_without_search_path = 45, public_security_definer_functions_without_search_path = 27 | Increases risk of function hijack behavior via search_path manipulation patterns |
| SEC-08 | Medium | Route between share/access logic and table model appears drifted | [supabase/functions/video-stream-url/index.ts](supabase/functions/video-stream-url/index.ts#L79), [supabase/functions/media-manifest/index.ts](supabase/functions/media-manifest/index.ts#L96), [supabase/functions/media-segment/index.ts](supabase/functions/media-segment/index.ts#L83) plus live schema showing shares table but no file_shares table | Access checks may fail unpredictably (deny-by-error or incorrect branch behavior) |
| SEC-09 | Medium | Sensitive request-header logging in API edge path | [supabase/functions/cloudbliss-api/index.ts](supabase/functions/cloudbliss-api/index.ts#L148) | Credential leakage risk in logs (authorization or API key traces) |
| SEC-10 | Medium | In-app code execution via eval on dynamic content | [src/pages/cbCode.tsx](src/pages/cbCode.tsx#L488), [src/pages/cbCode.tsx](src/pages/cbCode.tsx#L495) | Unsafe code execution if untrusted code is loaded and run in app origin |

## 5) Supabase Backend and DB Snapshot

### Database hardening snapshot (live)

- Public tables: 56
- RLS disabled tables: 5
- Public functions without explicit search_path: 45
- Security-definer public functions without explicit search_path: 27

### Edge-function auth surface snapshot (live)

- Active functions observed: 40
- verify_jwt enabled: 5
- verify_jwt disabled: 35

Interpretation: verify_jwt disabled is acceptable only if every such function has strict internal authentication and authorization checks. Several high-impact functions currently do not.

## 6) RES54 Architecture Breakdown (Current)

## 6.1 Why this architecture exists

The current model is optimized for throughput and quota distribution:

- Chunking and parallelism reduce large-upload bottlenecks.
- Multi-repo/node distribution spreads API usage and retries.
- Hybrid cluster-selection attempts to avoid single-node saturation.

References:

- [README.md](README.md#L76)
- [HYBRID_SYSTEM_EXPLAINED.md](HYBRID_SYSTEM_EXPLAINED.md#L1)
- [src/lib/res54.ts](src/lib/res54.ts#L434)

## 6.2 How current RES54 works

1. Client chunks file and generates encryption key.
2. Client encrypts each chunk.
3. For each chunk, client asks github-cluster for node/repo assignment.
4. Client uploads encrypted chunk payload via github-storage.
5. Client stores metadata into files.tags (including chunk map and key-bearing metadata object).
6. Download path reads metadata, fetches chunks in parallel, decrypts, reconstructs blob.

Core references:

- [src/lib/res54.ts](src/lib/res54.ts#L434)
- [src/lib/res54.ts](src/lib/res54.ts#L897)
- [src/lib/res54.ts](src/lib/res54.ts#L1126)

## 6.3 Major structural weaknesses in current RES54

1. Key and metadata co-location
- metadata object includes encryptionKey and is persisted in tags path.

2. Over-trust in edge proxies
- storage and external API operations rely on edge functions where JWT gate is broadly disabled.

3. Signature and media chain fragility
- stream signing uses default-secret fallback; media functions use mixed auth models.

4. Drift between schema and function assumptions
- functions reference file_shares while schema/migrations center around shares.

## 7) Current Flow Map (As-Is)

RES54 upload and download flow map:

Client Browser
-> res54 orchestrator in [src/lib/res54.ts](src/lib/res54.ts#L434)
-> chunking and encryption in [src/lib/encryption.ts](src/lib/encryption.ts#L13)
-> node selection via github-cluster
-> chunk upload via github-storage
-> GitHub repos store encrypted chunk blobs
-> Supabase files row stores metadata and pointers in tags

Download:

Client/Dashboard/Share
-> read file metadata from files row
-> parallel chunk download from github-storage
-> client decrypts with metadata-derived key
-> reconstruct Blob for preview/download

Trust boundary concern:

The metadata path currently acts as both locator and key carrier, which collapses separation-of-secrets.

## 8) Recommended Better Flow Map (Target)

Proposed hardened architecture:

Client Browser
-> Authenticated Upload API (verify_jwt = true)
-> Key Service issues per-file DEK and wraps DEK with tenant KEK
-> Client or edge encrypts chunks with DEK (never persisted in plaintext)
-> Object storage write (GitHub/S3/Supabase Storage)
-> Metadata DB stores only:
   - chunk pointers
   - wrapped DEK
   - integrity hashes
   - no plaintext key material

Download and sharing:

Viewer Request
-> AuthZ Service validates owner/share policy
-> Time-bound scoped token generation (strict, fail-closed secret policy)
-> Chunk fetch + integrity validation
-> DEK unwrap in secure boundary
-> Decrypt and stream/assemble

Operational controls:

- Mandatory verify_jwt for all non-public functions.
- Explicit allowlist for any external API proxy operation.
- Per-function rate limiting and abuse detection.
- Header redaction before logging.
- CSP and HTML sanitization in all preview surfaces.

## 9) UI/UX Scorecard

### Weighted scoring

| Dimension | Weight | Score (0-10) | Notes |
|---|---:|---:|---|
| Navigation and IA | 0.25 | 6.4 | Rich route surface, but broken landing links reduce trust and discoverability |
| Accessibility | 0.20 | 6.2 | Good use of labels in forms, but dynamic HTML injection paths and inconsistent semantics in custom renderers |
| Interaction quality | 0.20 | 7.6 | Strong feedback patterns, keyboard shortcuts, mobile-aware controls |
| Visual consistency | 0.15 | 8.1 | Cohesive component styling and modern dashboard language |
| Perceived performance | 0.20 | 7.4 | Chunking, lazy loading, and mobile adaptations are strong |

Computed UI/UX score:

$$
S_{ux} = 0.25(6.4)+0.20(6.2)+0.20(7.6)+0.15(8.1)+0.20(7.4)=7.05
$$

Final UI/UX score: 7.1 / 10

### Key UI/UX issues impacting quality

1. Broken footer links on landing page
- [src/pages/Index.tsx](src/pages/Index.tsx#L389), [src/pages/Index.tsx](src/pages/Index.tsx#L395)
- Route definitions live at [src/App.tsx](src/App.tsx#L158) and [src/App.tsx](src/App.tsx#L162)

2. Trust and safety erosion due to unsafe preview rendering
- [src/components/EnhancedMarkdownPreview.tsx](src/components/EnhancedMarkdownPreview.tsx#L193)
- [src/components/EnhancedTextEditor.tsx](src/components/EnhancedTextEditor.tsx#L1041)

3. Developer-mode execution safety gap
- [src/pages/cbCode.tsx](src/pages/cbCode.tsx#L495)

## 10) Prioritized Remediation Plan

## 10.1 Immediate (0-7 days)

1. Enforce verify_jwt = true for all private edge functions.
2. Add explicit authz checks and scope validation in github-storage, github-api, gemini-api, create-repos.
3. Remove default-secret fallback; fail deployment/runtime if STREAM_SIGNING_SECRET is missing.
4. Disable or gate placeholder serve-pdf RES54 path until real crypto implementation is deployed.
5. Remove plaintext key-bearing metadata from tags and redact sensitive fields from share responses.

## 10.2 Near-term (1-4 weeks)

1. Introduce wrapped-DEK model and migrate existing files metadata schema.
2. Add HTML sanitization (strict allowlist) before any dangerouslySetInnerHTML render.
3. Replace direct eval in cbCode with sandboxed execution model (iframe/worker isolation, capability-limited API).
4. Fix route mismatches on landing and add route integrity tests.

## 10.3 Mid-term (1-2 months)

1. Normalize share table references (shares vs file_shares) and add integration tests around authz.
2. Set explicit search_path on all public functions; review SECURITY DEFINER usage.
3. Add abuse controls: per-key quotas, anomaly detection, and edge-level circuit breakers.

## 11) Closing Assessment

RES54 is architecturally promising for distribution and large-file throughput, but security boundaries are currently too permissive for production adversarial conditions. The highest-value improvement is to separate encryption keys from metadata and to collapse the unauthenticated edge-function surface immediately. Once those are addressed, the platform can retain current performance strengths while materially improving confidentiality and operational safety.

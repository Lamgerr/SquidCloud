# KZA-PREL: Proactive Request Entropy Layer

## SquidCloud Unified Authentication Gateway - System Design Document

**Version:** 1.0.0
**Classification:** INTERNAL — SQUIDCLOUD CORE INFRASTRUCTURE
**Author:** KZA Security Division
**Date:** 2026-06-20

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Threat Landscape](#current-threat-landscape)
3. [System Architecture Overview](#system-architecture-overview)
4. [PREL Token System](#prel-token-system)
5. [Layer 1: Identity Verification](#layer-1-identity-verification)
6. [Layer 2: Client Integrity Proof (CIP)](#layer-2-client-integrity-proof-cip)
7. [Layer 3: F2FA - Function 2-Factor Authentication](#layer-3-f2fa---function-2-factor-authentication)
8. [Token Chaining Protocol](#token-chaining-protocol)
9. [Edge Function Integration Matrix](#edge-function-integration-matrix)
10. [Gateway Middleware Layer](#gateway-middleware-layer)
11. [Hacker Bypass Matrix](#hacker-bypass-matrix)
12. [Implementation Phases](#implementation-phases)
13. [Rollback Strategy](#rollback-strategy)

---

## Executive Summary

KZA-PREL is a centralized, triple-layered authentication gateway that replaces the current fragmented auth model across all 48 SquidCloud edge functions. It unifies JWT validation, API key verification, client integrity attestation, and a proprietary rolling-code 2FA system into a single, mandatory entry point for every function invocation.

**Current state:** 5 different auth mechanisms, 17 functions with `verify_jwt=false`, 3 inconsistent API key hashing systems, service role key used as bearer token, encryption keys stored in plaintext in `tags[]`, and 7 functions that bypass KZA sentinel entirely.

**Target state:** Zero-trust architecture where every request — including internal function-to-function calls — passes through three independent verification layers before receiving an ephemeral, context-bound PREL token. No token = no execution. No exceptions.

---

## Current Threat Landscape

### 2.1 Fragmented Authentication

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CURRENT AUTH LANDSCAPE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  JWT         ──→ 27 functions    — supabase.auth.getUser()          │
│  API Key A   ──→ cloudbliss-api  — SHA-256(salt + key)             │
│  API Key B   ──→ api-file-*      — SHA-256(key) [NO SALT]          │
│  HMAC URL    ──→ 4 media fns     — STREAM_SIGNING_SECRET            │
│  Bearer Key  ──→ github-storage  — SUPABASE_SERVICE_ROLE_KEY        │
│  No Auth     ──→ 7 functions     — Bypass KZA entirely              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Critical Attack Vectors

| Vector | Impact | Current Mitigation |
|--------|--------|-------------------|
| `files.tags[0]` exposes encryption key in plaintext | Full file decryption without ownership | None — trigger only hashes `encryption_key` column, not `tags` |
| Anonymous SELECT on `files` via `FIX_SHARE_ACCESS.sql` | Anyone with a share link reads all file metadata | None — `TO anon` policy exists |
| Service role key accepted as bearer token in `github-storage` | Download any user's encrypted chunks | Weak — path prefix check, bypassed by internal flag |
| Inconsistent API key hashing | Keys from `api-key-management` fail in `api-file-*` and vice versa | None — two incompatible systems deployed |
| `file-operations` trusts `userId` from request body | Perform operations on any user's files | None — no JWT comparison against body userId |
| 7 functions skip KZA sentinel entirely | Blind to threat detection | None — no sentinel call at all |
| `media-segment` uses incompatible Res54 decryption format | Media decryption silently produces garbage | None — simplified format doesn't parse additionalData header |

### 2.3 The PREL Solution

KZA-PREL addresses every vector above by:

1. **Eliminating fragmented auth** — One gateway, one protocol, one token format
2. **Removing sensitive data from client-accessible tables** — PREL tokens never expose encryption keys or chunk metadata
3. **Ending service role key as bearer token** — `github-storage` validates PREL tokens, not raw keys
4. **Unifying API key hashing** — Single salt-based verification with consistent algorithm
5. **Enforcing caller identity in every request** — Body `userId` must match PREL token context, not just JWT
6. **Mandatory for ALL 48 functions** — Gateway middleware blocks unauthenticated invocations at the edge
7. **Binding function identity to decryption context** — Each function receives a context-bound token specifying exactly which operations it may perform

---

## System Architecture Overview

### 3.1 High-Level Architecture

```
                          ┌─────────────────────────────┐
                          │     CLIENT / EXTERNAL        │
                          │   (Browser, CLI, API, SDK)   │
                          └──────────┬──────────────────┘
                                     │ HTTP Request
                                     │ Authorization: Bearer <JWT>
                                     │ X-CIP: <client_integrity_proof>
                                     │ X-F2FA: <rolling_code>
                                     ▼
                    ┌──────────────────────────────────┐
                    │     SUPABASE EDGE GATEWAY         │
                    │  (Middleware interception layer)  │
                    │  ┌──────────────────────────────┐ │
                    │  │  Missing X-PREL-Token?       │ │
                    │  │  → Route to kza-prel         │ │
                    │  │  Has X-PREL-Token?           │ │
                    │  │  → Validate via kza-prel     │ │
                    │  └──────────────────────────────┘ │
                    └──────────┬───────────────────────┘
                               │
                               ▼
              ┌────────────────────────────────────┐
              │           KZA-PREL GATEWAY          │
              │  (supabase/functions/kza-prel)      │
              ├────────────────────────────────────┤
              │                                    │
              │  ┌──────────────────────────────┐  │
              │  │  LAYER 1 — IDENTITY CHECK    │  │
              │  │  • JWT validation            │  │
              │  │  • API key hash verification │  │
              │  │  • Client fingerprint match  │  │
              │  │  • Geo-velocity gate         │  │
              │  └──────────┬───────────────────┘  │
              │             ▼                       │
              │  ┌──────────────────────────────┐  │
              │  │  LAYER 2 — CIP VERIFICATION  │  │
              │  │  • Client Integrity Proof    │  │
              │  │  • Timing delta analysis     │  │
              │  │  • Entropy scoring           │  │
              │  │  • Build version attestation │  │
              │  └──────────┬───────────────────┘  │
              │             ▼                       │
              │  ┌──────────────────────────────┐  │
              │  │  LAYER 3 — F2FA VERIFICATION │  │
              │  │  • Rolling code validation   │  │
              │  │  • Time-window (±1 drift)    │  │
              │  │  • Seed rotation check       │  │
              │  │  • Rate-gate brute force     │  │
              │  └──────────┬───────────────────┘  │
              │             ▼                       │
              │  ┌──────────────────────────────┐  │
              │  │  PREL TOKEN ISSUANCE         │  │
              │  │  • userId, sessionId, fn, op │  │
              │  │  • HMAC-SHA512 signed        │  │
              │  │  • TTL: 45s (configurable)   │  │
              │  │  • Chain parent ref          │  │
              │  └──────────────────────────────┘  │
              └──────────┬─────────────────────────┘
                         │ { prel_token, context }
                         ▼
              ┌────────────────────────────────────┐
              │     TARGET EDGE FUNCTION            │
              │  (Receives PREL token, processes    │
              │   within token scope)               │
              │                                     │
              │  TOKEN VALIDATION:                  │
              │  • Calls kza-prel/validate           │
              │  • Checks function_id match         │
              │  • Checks user_id match             │
              │  • Checks operation scope           │
              │  • Issues child token for downstream│
              └────────────────────────────────────┘
```

### 3.2 Component Roles

| Component | Responsibility | State |
|-----------|----------------|-------|
| **kza-prel/gateway** | Entry point for all auth requests. Runs triple-check. Issues PREL tokens. | Stateless (reads from registry) |
| **kza-prel/validate** | Validates existing PREL tokens. Checks chain integrity. Issues child tokens. | Stateless |
| **kza-prel/registry** | Table of registered functions + their auth requirements. | Persistent (DB) |
| **kza-prel/sessions** | Active session tracking. Token chain state. Expiration management. | Persistent (DB) |
| **Gateway Middleware** | Inline at Supabase Edge Gateway. Intercepts all function invocations. Routes to kza-prel if no token. | Stateless (configuration) |
| **Client SDK Layer** | In-browser CIP generator + F2FA code calculator. Bundled into SquidCloud client builds. | Client-side |

### 3.3 Supporting Tables

#### `kza_prel_registry`

```sql
kza_prel_registry (
  function_id         TEXT PRIMARY KEY,          -- fully qualified name
  required_auth_level TEXT NOT NULL,              -- 'jwt' | 'api_key' | 'hmac' | 'any'
  required_min_role   workspace_role,             -- minimum workspace role if applicable
  allowed_operations  TEXT[],                     -- permitted operation scopes
  f2fa_required       BOOLEAN DEFAULT true,       -- whether F2FA code is mandatory
  cip_required        BOOLEAN DEFAULT true,       -- whether CIP proof is mandatory
  chain_depth_limit   INT DEFAULT 5,              -- max downstream token chain depth
  rate_limit_rps      INT DEFAULT 10,             -- max requests per second per user
  allowed_callers     TEXT[],                     -- parent functions allowed to call this
  is_active           BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT now()
)
```

#### `kza_prel_sessions`

```sql
kza_prel_sessions (
  token_hash          TEXT PRIMARY KEY,           -- SHA-512 of PREL token
  user_id             UUID NOT NULL,
  session_id          TEXT NOT NULL,
  parent_token_hash   TEXT,                       -- reference to parent chain
  function_id         TEXT NOT NULL,
  operation_scope     TEXT[],                     -- authorized operations
  issued_at           TIMESTAMPTZ NOT NULL,
  expires_at          TIMESTAMPTZ NOT NULL,       -- TTL enforcement
  consumed_at         TIMESTAMPTZ,                -- single-use enforcement
  chain_depth         INT DEFAULT 0,
  cip_score           INT,                        -- Layer 2 score at issuance
  f2fa_window         INT,                        -- F2FA time-window used
  metadata            JSONB                       -- additional context
)
```

#### `kza_prel_f2fa_seeds`

```sql
kza_prel_f2fa_seeds (
  seed_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL,
  function_id         TEXT NOT NULL,
  day_seed            TEXT NOT NULL,              -- deterministic per day
  seed_derived        TEXT NOT NULL,              -- HMAC(user + fn + day)
  is_active           BOOLEAN DEFAULT true,
  rotates_at          TIMESTAMPTZ,                -- forced rotation time
  created_at          TIMESTAMPTZ DEFAULT now()
)
```

---

## PREL Token System

### 4.1 Token Structure

Every PREL token is an opaque, HMAC-signed string that encodes the full authorization context. The token structure is:

```
PREL_v1.{base64_payload}.{base64_signature}
```

The payload encodes (never exposes in plaintext):

| Field | Bits | Description |
|-------|------|-------------|
| `version` | 8 | Token format version (currently 1) |
| `user_id` | 128 | UUID of authenticated user |
| `session_id` | 128 | Cryptographic session identifier |
| `function_id` | 64 | Hash of target function name |
| `operation` | 16 | Bitmask of authorized operations |
| `chain_depth` | 8 | Current depth in token chain |
| `parent_hash` | 128 | SHA-512 of parent token (null for root) |
| `issued_at` | 48 | Unix timestamp milliseconds |
| `expires_at` | 48 | Expiry timestamp milliseconds |
| `cip_hash` | 128 | SHA-256 of CIP presented at Layer 2 |
| `f2fa_window` | 32 | F2FA time-window number |
| `nonce` | 64 | Cryptographic nonce for uniqueness |

Total payload: ~848 bits (106 bytes uncompressed)

### 4.2 Token Lifecycle

```
REQUEST ──→ TRIPLE CHECK ──→ TOKEN ISSUANCE ──→ FUNCTION EXECUTION ──→ CONSUMPTION
                │                  │                    │                    │
           L1: Identity        TTL: 45s           Validate token       Mark consumed
           L2: CIP             Scope: fn+op        Check chain         Issue child
           L3: F2FA            Chain: parent       Check expiry        Or expire
```

### 4.3 Token Validation Rules

1. **HMAC integrity** — Signature must verify with function-specific key
2. **Expiry** — `expires_at` must be in the future
3. **Single-use** — `consumed_at` must be NULL
4. **Function binding** — `function_id` must match the invoked function
5. **User binding** — `user_id` must match the caller's authenticated identity
6. **Chain integrity** — `parent_hash` must match a previously consumed parent token
7. **Depth limit** — `chain_depth` must not exceed registry limit for this function
8. **CIP hash match** — If the function requires CIP, the hash must match the stored value
9. **F2FA window match** — If the function requires F2FA, the window must be within ±1 of current

---

## Layer 1: Identity Verification

### 5.1 Unified Authentication Flow

Layer 1 consolidates all current auth mechanisms into a single decision tree:

```
                    ┌─────────────────────┐
                    │  INCOMING REQUEST    │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Authorization       │
                    │  header present?     │
                    └──────┬───────┬──────┘
                       NO  │       │ YES
                           │       │
                    ┌──────▼──┐ ┌──▼──────────────┐
                    │ Is this │ │  Prefix check:   │
                    │ a media │ │  "cb_" → API key │
                    │ HMAC    │ │  "Bearer "→ JWT  │
                    │ URL?    │ │  else → reject   │
                    └────┬────┘ └──┬───────────────┘
                    YES  │    NO   │
                    ┌────▼──┐ ┌───▼──────────────┐
                    │HMAC   │ │  Function         │
                    │verify │ │  registry lookup  │
                    └───┬───┘ └───┬──────────────┘
                   FAIL │ PASS    │
                    ┌───▼┐ ┌──▼──┐ │
                    │REJ │ │GO TO│ │
                    └────┘ │L2  │ │
                           └────┘ │
                           ┌──────▼──────────────┐
                           │  JWT verify          │
                           │  supabase.auth       │
                           │  .getUser(token)     │
                           └──────┬───────────────┘
                          FAIL    │    PASS
                     ┌──────────┐ │ ┌──────────────┐
                     │ API key  │ │ │ Extract       │
                     │ fallback │ │ │ user_id,      │
                     │ (salt    │ │ │ session from  │
                     │  verify) │ │ │ JWT claims   │
                     └────┬─────┘ │ └──────┬───────┘
                    FAIL  │ PASS  │        │
                     ┌────▼┐ ┌──▼──┐ ┌─────▼──────┐
                     │ REJ │ │GOTO│ │ GOTO Layer 2│
                     └─────┘ │ L2 │ └─────────────┘
                             └────┘
```

### 5.2 Unified API Key Verification

KZA-PREL eliminates the two incompatible API key systems and provides a single verification path:

**Key generation (standardized):**
```
1. key_prefix  = "cb_" + random(8 hex)          → 11 chars (visible)
2. api_key     = key_prefix + random(32 bytes hex) → 75 chars total
3. salt        = random(32 bytes)               → stored as base64
4. key_hash    = SHA-256(salt_bytes + api_key_bytes) → stored as hex
5. KEY HASH IS COMPARED, NEVER THE RAW KEY
```

**Key verification (unified):**
```
1. Extract key_prefix = api_key.substring(0, 11)
2. Query api_keys WHERE key_prefix = $prefix AND is_active = true
3. For each candidate:
     computed = SHA-256(atob(key_salt) + encoder.encode(api_key))
     if constant_time_compare(computed, key_hash) → match found
4. Use keyData.user_id for downstream PREL token binding
```

**Critical change:** The new system stores `key_prefix` as 11 characters (`cb_` + 8 hex) instead of 8, making prefix collisions exponentially less likely. All existing keys generated by both old systems remain valid — they are migrated to the new verification path transparently.

### 5.3 Fingerprint Verification

Layer 1 matches the current request's fingerprint against the user's known profile from `kza_user_profiles`:

```
Checklist:
  ✓ User-Agent in typical_devices fingerprints
  ✓ Country in typical_countries
  ✓ Current hour in typical_active_hours
  ✓ Request interval > avg_request_interval_ms / 3
  ✓ IP reputation score (if available)
  ✓ Endpoint in typical_endpoints

Score deduction for each mismatch:
  - New country       → -15 points
  - Unknown UA        → -10 points
  - Velocity anomaly  → -20 points
  - Off-hours access  → -5 points
  - Unknown endpoint  → -5 points

  Total < 40 → PASS (continue to Layer 2)
  Total ≥ 40 → ESCALATE (forced CIP re-verification in Layer 2)
  Total ≥ 70 → BLOCK (PREL request denied, KZA incident created)
```

---

## Layer 2: Client Integrity Proof (CIP)

### 6.1 What CIP Proves

CIP is a cryptographic attestation embedded in the SquidCloud client at build time. It proves that the request originated from the official SquidCloud client application — not from curl, Postman, Chrome DevTools "Copy as fetch", a bot, or a reverse-engineered API wrapper.

### 6.2 CIP Generation Algorithm (Client-Side)

The CIP is generated by a Web Worker embedded in the SquidCloud client SDK. The proof is a concatenation of multiple entropy sources processed through a deterministic but obfuscated reduction function:

**Entropy Sources (gathered at runtime):**

| Source | Description | Bits | Anti-Spoofing |
|--------|-------------|------|---------------|
| `build_challenge` | Embeded at compile time, rotates per build | 256 | Changes every CI build, unknown to attacker |
| `webgl_vendor` | WebGL renderer string | Variable | Headless browsers report different values |
| `canvas_hash` | Canvas fingerprint (deterministic draw) | 128 | Canvas fingerprinting is passive, hard to fake |
| `audio_hash` | AudioContext oscillator fingerprint | 64 | Requires complete AudioContext simulation |
| `timing_delta` | `performance.now()` delta since page load | 32 | Curl/scripts start at 0ms, browsers at 50-500ms |
| `hardware_concurrency` | `navigator.hardwareConcurrency` | 8 | Headless browsers often report 1 or 2 |
| `device_memory` | `navigator.deviceMemory` | 8 | API not available in non-browser environments |
| `build_version` | Semver of SquidCloud client build | 32 | Must match current deployment version |
| `session_entropy` | Previously established session entropy | 128 | From initial auth handshake |

**Reduction Function (proprietary):**

The reduction function is a multi-round sponge construction using HMAC-SHA256 as the underlying primitive. It is:

1. **Obfuscated across 3 Web Workers** — No single worker knows the complete algorithm
2. **Dynamically parameterized** — The round constants and permutation order are derived from the `build_challenge`
3. **Timing-sensitive** — The proof must be generated within a specific time window (50-500ms after page load). Generation outside this window produces a different result
4. **Build-versioned** — Each CI build generates different reduction parameters

**Output:** A 256-byte hex string sent as `X-CIP: <proof>` header.

### 6.3 CIP Verification (Server-Side)

```
1. Fetch registry entry for this function_id
2. If cip_required = false → skip (legacy compatibility)
3. Check build_version matches current deployment
4. Recompute expected CIP using server-side algorithm:
     a. Extract entropy from the request context
     b. Apply same reduction function with current build parameters
     c. Compute expected proof
5. constant_time_compare(expected_proof, received_proof)
6. Check timing_delta is within acceptable window (50-500ms)
7. Score the proof quality:
     - Full match + valid timing  → PASS (score: 100)
     - Full match + borderline timing → DEGRADED (score: 60, flag for review)
     - Mismatch or invalid timing → FAIL (KZA_BLOCKED)
```

### 6.4 Why Network Tab / Curl Cannot Spoof CIP

| Attack | Why It Fails |
|--------|-------------|
| **Chrome DevTools "Copy as fetch"** | DevTools replay has a timing delta of 300-8000ms (manual interaction). CIP expects 50-500ms. Replay also lacks the live WebGL/AudioContext entropy that was present during original page execution. The canvas fingerprint at replay time differs because the page may be partially rendered or scrolled differently. |
| **curl with copied CIP header** | The CIP is bound to a specific build version + session + timing window. Copying a CIP from a valid response and replaying it in a new request fails because: (1) the session_entropy differs, (2) the timing_delta is outside the window, (3) the function_id embedded in the reduction is different. CIP is NOT a static token — it is context-dependent. |
| **Selenium / Puppeteer** | Headless Chrome reports different WebGL vendor strings (`Google SwiftShader` vs `NVIDIA`), has no `deviceMemory` API, and `hardwareConcurrency` often reports 1. The reduction function detects these discrepancies and produces a non-matching proof. |
| **Python requests with full header copy** | No browser runtime → no WebGL, no canvas, no AudioContext, no performance.now() in the correct format. The reduction function requires at least 3 of the 9 entropy sources to be present and valid. A script providing 0/9 produces a fundamentally different hash. |
| **Reverse engineer the Web Worker** | The reduction function is split across 3 Web Workers communicating via `postMessage`. Each worker's code is minified and the worker URLs rotate per build (non-deterministic filenames). Even with the complete source, the `build_challenge` changes every CI deployment, making each build's algorithm unique. The attacker would need to reverse engineer and reimplement the algorithm for EVERY build. |

---

## Layer 3: F2FA - Function 2-Factor Authentication

### 7.1 Concept

F2FA is a proprietary rolling-code authentication system for edge function invocations. Like Google TOTP, it generates time-based codes. Unlike TOTP, the code is:

1. **Context-bound** — Tied to function_id + user_id + day_seed, not just a shared secret
2. **Variable-length** — Code length changes based on security level (6-10 digits)
3. **Session-anchored** — Seeds rotate per session, not per token
4. **Algorithm-proprietary** — Not RFC 6238, uses a custom reduction function

### 7.2 F2FA Seed Derivation

```
ROOT SEED        = HMAC-SHA256(global_f2fa_master_secret, "squidcloud-f2fa-v1")
                    [Stored in pgsodium keyring, never in code]

DAY SEED          = HMAC-SHA256(ROOT_SEED, YYYY-MM-DD)
                    [Rotates daily, deterministic from master]

FUNCTION SEED     = HMAC-SHA256(DAY_SEED, function_id)
                    [Each function gets a unique daily seed]

USER SEED         = HMAC-SHA256(FUNCTION_SEED, user_id || session_id)
                    [Each user in each session gets a unique seed]

SESSION SEED      = HMAC-SHA256(USER_SEED, session_nonce)
                    [Rotates on every new PREL authentication request]
```

The client receives the `SESSION_SEED` during initial auth handshake (encrypted in the auth response). All subsequent F2FA codes in that session are derived from this seed.

### 7.3 F2FA Code Generation

```
TIME_WINDOW      = floor(current_unix_timestamp / 30)
                   [30-second windows, like TOTP]

WINDOW_BYTES     = uint64_to_bytes(TIME_WINDOW)
                   [8 bytes, little-endian]

CODE_INPUT       = SESSION_SEED || WINDOW_BYTES || function_name_bytes
                   [Concatenation, not XOR]

CODE_HASH        = HMAC-SHA256(CODE_INPUT)
                   [256-bit output]

CODE_DYNAMIC     = CODE_HASH[0:8] XOR CODE_HASH[8:16] XOR CODE_HASH[16:24]
                   [Truncation via XOR, not truncation via offset]

SECURITY_LEVEL   = determined by function registry:
                   admin functions     → 10 digits
                   file operations     → 8 digits
                   read-only ops       → 6 digits
                   media streaming     → 6 digits

F2FA_CODE        = CODE_DYNAMIC % (10 ^ SECURITY_LEVEL)
                   [Padded with leading zeros to SECURITY_LEVEL digits]
```

### 7.4 Server-Side Verification

```
1. Fetch SESSION_SEED from kza_prel_f2fa_seeds
2. Compute expected codes for three time windows:
     a. current = floor(now / 30)
     b. previous = current - 1
     c. next = current + 1
   [±1 window drift tolerance for clock skew]
3. constant_time_compare each against received F2FA code
4. If match at "previous" window → force re-sync (client clock drift)
5. If match at "next" window → flag for monitoring (possible replay)
6. If no match → FAIL → increment failure counter
7. If failure counter > 3 in 5 minutes → KZA_BLACK ban on this session
```

### 7.5 Why F2FA Cannot Be Bypassed

| Attack | Why It Fails |
|--------|-------------|
| **Extract algorithm from client** | The F2FA generator is in a Web Worker loaded from a dynamic blob URL. The seed derivation uses HMAC-SHA256 which requires the `global_f2fa_master_secret` — which NEVER reaches the client. The client only has the `SESSION_SEED` which is derived from the master secret server-side. Knowing the algorithm WITHOUT the master secret yields different codes. |
| **Brute force 6-digit code** | 10^6 = 1,000,000 possibilities. At 3 attempts per 30-second window, brute force would take 10^6 / 3 * 30 = ~10,000,000 seconds = ~115 days. After 3 failed attempts, the session is permanently banned. |
| **Replay captured F2FA code** | F2FA codes are single-window valid (30 seconds). Even within the valid window, each code is tied to a specific function_id and session_id. Replaying a `cloudbliss-api` code against `admin-data-access` produces a different expected value because the `function_name_bytes` in `CODE_INPUT` differs. |
| **Steal SESSION_SEED from memory** | Even with the seed, the attacker needs the exact algorithm implementation. The client-side F2FA generator uses a proprietary reduction (not standard HMAC truncation). They'd also need the correct `function_name_bytes` encoding which includes a build-time salt. |
| **Timing attack on comparison** | All comparisons use `constant_time_compare` which executes in fixed time regardless of match position. |

---

## Token Chaining Protocol

### 8.1 Chain Topology

Every function invocation creates a token chain. The chain ensures that:

1. **No function executes without authentication** — Token must exist and be valid
2. **Downstream calls are traceable** — Every child token references its parent
3. **Attack surface is bounded** — Chain depth limit prevents infinite cascades
4. **Replay is impossible** — Single-use tokens with parent hash verification

```
ROOT CHAIN (from client):
  Client ──→ kza-prel ──→ token_A  (depth: 0, TTL: 45s)
                              │
                    ┌─────────┼─────────┐
                    │         │         │
                    ▼         ▼         ▼
               cloudbliss  file-key  media-manifest
                  -api       -api
                    │                   │
               token_B              token_D
              (depth: 1)          (depth: 1)
                    │
                    │
                    ▼
              github-storage
              token_C (depth: 2)
```

### 8.2 Chain Validation Rules

```
For token_N (depth N):

1. If N = 0 (ROOT):
     - Must be issued by kza-prel/gateway
     - parent_hash must be NULL
     - Must correspond to a function that accepts external requests

2. If N > 0 (CHILD):
     - Must reference a consumed parent via parent_hash
     - Parent must have been issued by the calling function
     - function_id of parent must be in allowed_callers of registry
     - N must not exceed chain_depth_limit for this function

3. CONSUMPTION:
     - A token is consumed atomically (DB transaction)
     - If consumption fails (race condition), only one caller succeeds
     - Consumed tokens are marked with timestamp and function_id that consumed them

4. EXPIRY:
     - Token expires after configured TTL (default 45s)
     - Expired tokens cannot be consumed even if unconsumed
     - Parent expiry propagates to children (child TTL ≤ parent TTL)
```

### 8.3 Cross-Function Authorization

The registry table `allowed_callers` controls which functions may call which other functions:

```sql
-- cloudbliss-api can call github-storage
INSERT INTO kza_prel_registry (function_id, allowed_callers)
VALUES ('github-storage', ARRAY['cloudbliss-api', 'file-key', 'media-segment']);

-- admin-data-access can ONLY be called by admin-auth
INSERT INTO kza_prel_registry (function_id, allowed_callers)
VALUES ('admin-data-access', ARRAY['admin-auth']);
```

If a function calls another function outside its allowed callers, the PREL validation fails with `401 KZA_UNAUTHORIZED_CALLER`.

---

## Edge Function Integration Matrix

### 9.1 Function Classification

All 48 edge functions are classified into 7 integration tiers based on their role and sensitivity:

#### Tier 1: Critical File Operations (Highest Security)

| Function | Current Auth | PREL Config | Special Requirements |
|----------|-------------|-------------|---------------------|
| `github-storage` | Service role bearer + optional JWT | `auth: jwt, cip: true, f2fa: true, depth: 2` | Remove service_role bearer. Only callable by `cloudbliss-api`, `file-key`, `media-segment`, `serve-pdf` |
| `cloudbliss-api` | API key (salted) | `auth: api_key, cip: true, f2fa: true, depth: 3` | External entry point. CIP + F2FA mandatory. Issues child tokens for github-storage |
| `file-key` | JWT | `auth: jwt, cip: true, f2fa: true, depth: 1` | Must validate user_id matches file owner. Can issue child tokens for github-storage |
| `file-operations` | JWT | `auth: jwt, cip: true, f2fa: true, depth: 2` | **FIX:** body userId must match PREL token userId. No longer trusts request body blindly |

#### Tier 2: Admin Functions (Maximum Restriction)

| Function | Current Auth | PREL Config | Special Requirements |
|----------|-------------|-------------|---------------------|
| `admin-auth` | Admin secret | `auth: jwt, cip: true, f2fa: true, depth: 1` | Admin secret verification preserved as additional check beyond PREL |
| `admin-data-access` | Admin secret | `auth: jwt, cip: true, f2fa: true, depth: 1` | Caller must be `admin-auth`. No external access allowed |
| `check-admin-status` | JWT | `auth: jwt, cip: true, f2fa: true, depth: 1` | CIP required — admin endpoints are high-value targets |
| `verify-admin` | JWT | `auth: jwt, cip: true, f2fa: false, depth: 0` | F2FA exempt (called internally by other functions for role checks) |

#### Tier 3: Media Streaming (HMAC + Token)

| Function | Current Auth | PREL Config | Special Requirements |
|----------|-------------|-------------|---------------------|
| `media-segment` | HMAC signed URL | `auth: hmac, cip: false, f2fa: false, depth: 1` | HMAC URL signature verified by kza-prel as Layer 1 alternative. Validated URL generates PREL token for downstream github-storage calls |
| `media-playlist` | HMAC signed URL | `auth: hmac, cip: false, f2fa: false, depth: 0` | No downstream calls. HMAC URL → PREL token → playlist generation |
| `media-manifest` | HMAC + JWT | `auth: hmac_jwt, cip: false, f2fa: true, depth: 0` | Dual auth: HMAC for URL, JWT for user context |
| `media-master-manifest` | HMAC signed URL | `auth: hmac, cip: false, f2fa: false, depth: 0` | Same as media-playlist |
| `hls-generation` | JWT | `auth: jwt, cip: false, f2fa: false, depth: 1` | Long-running operation. Token TTL extended to 300s |
| `video-stream-proxy` | HMAC + KZA | `auth: hmac, cip: false, f2fa: false, depth: 0` | Proxy role — PREL token validates stream access |

#### Tier 4: KZA Internal Functions (Service Role)

| Function | Current Auth | PREL Config | Special Requirements |
|----------|-------------|-------------|---------------------|
| `kza-sentinel` | Service role | `auth: prel_only, cip: false, f2fa: false, depth: 0` | Called by other functions as part of their PREL flow. Not directly accessible |
| `kza-verdict` | Service role | `auth: prel_only, cip: false, f2fa: false, depth: 1` | Only callable by `kza-sentinel` |
| `kza-oracle` | Service role | `auth: prel_only, cip: false, f2fa: false, depth: 1` | Only callable by `kza-sentinel` |
| `kza-phantom` | Service role | `auth: prel_only, cip: false, f2fa: false, depth: 1` | Only callable by `kza-prel/gateway` when ghost endpoint detection triggers |

#### Tier 5: API File Operations (API Key)

| Function | Current Auth | PREL Config | Special Requirements |
|----------|-------------|-------------|---------------------|
| `api-file-upload` | API key (unsalted) | `auth: api_key, cip: false, f2fa: true, depth: 0` | Unified API key verification via kza-prel Layer 1. Old unsalted keys migrated |
| `api-file-delete` | API key (unsalted) | `auth: api_key, cip: false, f2fa: true, depth: 0` | Same migration |
| `api-file-metadata` | API key (unsalted) | `auth: api_key, cip: false, f2fa: true, depth: 0` | Same migration |
| `api-file-upload-tebi` | JWT | `auth: jwt, cip: false, f2fa: true, depth: 0` | Same as Tier 1 but without CIP (external SDKs cannot generate CIP) |
| `api-key-management` | JWT | `auth: jwt, cip: true, f2fa: true, depth: 0` | CIP required (key management is sensitive) |

#### Tier 6: Utility Functions (Standard JWT)

| Function | Current Auth | PREL Config | Special Requirements |
|----------|-------------|-------------|---------------------|
| `serve-pdf` | JWT | `auth: jwt, cip: true, f2fa: true, depth: 1` | CIP mandatory (PDF viewing is a common attack target) |
| `serve-pdf-secure` | JWT | `auth: jwt, cip: true, f2fa: true, depth: 0` | Same |
| `generate-pdf-url` | JWT | `auth: jwt, cip: true, f2fa: false, depth: 1` | F2FA exempt (called internally for signed URL generation) |
| `download-shared-file` | Service role | `auth: hmac, cip: false, f2fa: false, depth: 1` | HMAC signature for share link. Can call github-storage |
| `download-manager` | JWT | `auth: jwt, cip: true, f2fa: true, depth: 0` | Standard PREL flow |
| `trash-operations` | JWT | `auth: jwt, cip: true, f2fa: true, depth: 0` | Same |
| `secure-file-metadata` | JWT | `auth: jwt, cip: true, f2fa: true, depth: 0` | Same |
| `validate-share` | Service role | `auth: jwt, cip: false, f2fa: false, depth: 0` | Called internally |

#### Tier 7: Third-Party / External Integrations

| Function | Current Auth | PREL Config | Special Requirements |
|----------|-------------|-------------|---------------------|
| `github-storage` | See Tier 1 | Already defined above | --- |
| `github-api` | JWT | `auth: jwt, cip: true, f2fa: true, depth: 1` | CIP required (GitHub token access) |
| `github-cluster` | JWT | `auth: jwt, cip: true, f2fa: true, depth: 1` | Same |
| `create-repos` | JWT | `auth: jwt, cip: true, f2fa: true, depth: 0` | Same |
| `gemini-api` | JWT | `auth: jwt, cip: true, f2fa: true, depth: 0` | CIP required (AI API key access) |
| `ink-ai` | JWT | `auth: jwt, cip: true, f2fa: false, depth: 0` | F2FA exempt (AI agent, non-interactive) |
| `squid-ai-chat` | JWT | `auth: jwt, cip: true, f2fa: false, depth: 0` | Same |
| `migration-oauth` | JWT | `auth: jwt, cip: false, f2fa: false, depth: 1` | OAuth flow — CIP breaks redirect |
| `migration-oauth-callback` | JWT | `auth: jwt, cip: false, f2fa: false, depth: 0` | Same |
| `start-migration` | JWT | `auth: jwt, cip: false, f2fa: false, depth: 0` | F2FA exempt (long-running background job) |
| `start-cloud-import` | JWT | `auth: jwt, cip: false, f2fa: false, depth: 0` | Same |
| `store-provider` | JWT | `auth: jwt, cip: true, f2fa: true, depth: 0` | CIP required (provider credentials configured) |
| `verify-provider` | JWT | `auth: jwt, cip: true, f2fa: false, depth: 0` | **FIX:** Must bind provider check to authenticated user |

#### Tier 8: Admin / Operational Utilities

| Function | Current Auth | PREL Config | Special Requirements |
|----------|-------------|-------------|---------------------|
| `get-app-updates` | Public | `auth: none, cip: false, f2fa: false, depth: 0` | Only function that remains public. No token required |
| `add-app-update` | JWT | `auth: jwt, cip: true, f2fa: true, depth: 0` | CIP + F2FA mandatory (admin-only, app store manipulation) |
| `send-workspace-invite` | JWT | `auth: jwt, cip: true, f2fa: true, depth: 0` | **ADD KZA CALL:** Currently skips KZA entirely. Must add PREL mandatory |
| `cli-operations` | JWT | `auth: jwt, cip: true, f2fa: true, depth: 1` | CLI sessions get extended TTL. Can call github-api |
| `cloud-file-browser` | JWT | `auth: jwt, cip: true, f2fa: true, depth: 1` | Same as cli-operations |

### 9.2 Standard Integration Pattern (Example: `cloudbliss-api`)

```
BEFORE (current):
  1. Handle CORS
  2. Call kza-sentinel (optional threat check)
  3. Create supabase client with service_role
  4. Manually verify API key (salted SHA-256)
  5. Manually extract user_id from API key lookup
  6. Manually check workspace role via RPC
  7. Process request
  8. Call github-storage with service role context

AFTER (PREL):
  1. Handle CORS (unchanged)
  2. Call kza-prel/authenticate with:
     - Authorization header
     - X-CIP header
     - X-F2FA header
     - Request context (url, method, body)
  3. kza-prel/gateway runs triple-check:
     - Layer 1: API key verification (unified) → user_id
     - Layer 2: CIP verification → client attestation
     - Layer 3: F2FA verification → rolling code
  4. kza-prel/gateway returns:
     - prel_token (opaque, HMAC-signed)
     - context { user_id, workspace_id, role, session_id }
  5. Process request using context (no need for workspace role RPC — already in context)
  6. Call github-storage WITH:
     - X-PREL-Token: <child_token from kza-prel/validate>
  7. github-storage validates child token via kza-prel/validate
```

### 9.3 What Changes in Each Function

| Component | Change |
|-----------|--------|
| **Imports** | Add `kzaPrelClient` module (shared utility) instead of direct `fetch` to kza-sentinel |
| **CORS handling** | Unchanged |
| **KZA sentinel call** | Replaced with kza-prel/authenticate call |
| **Auth logic (JWT/API key)** | REMOVED from function. Handled by kza-prel Layer 1 |
| **User ID extraction** | From PREL context, not from request body or JWT parsing |
| **Service role client creation** | Still needed for DB operations, but NOT for auth decisions |
| **Downstream function calls** | Include X-PREL-Token header with child token from kza-prel/validate |
| **Workspace role check** | From PREL context if included in scope, OR via RPC if not |
| **Error responses** | Unchanged format, but kza-prel errors are standardized |

---

## Gateway Middleware Layer

### 10.1 Architecture

The Gateway Middleware runs at the Supabase Edge Gateway level, BEFORE any edge function handler executes. It intercepts all incoming HTTP requests and:

1. **Checks if the target function is in the `kza_prel_registry`**
2. **If registered and not public** (`get-app-updates` only):
   - If `X-PREL-Token` is present: validate via kza-prel/validate
   - If `X-PREL-Token` is absent: redirect to kza-prel/gateway for full auth
3. **If the function does not exist in the registry**: block with `501 KZA_UNREGISTERED_FUNCTION`
4. **If the function is public** (`get-app-updates`): pass through

### 10.2 Middleware Injection Point

The middleware is injected at the Supabase project configuration level:

```toml
[functions]
middleware = "kza-gateway"    # Runs before every function invocation

[functions.kza-gateway]
verify_jwt = false             # Handles its own auth
```

Unlike `verify_jwt` which only validates Supabase JWT tokens, the KZA gateway middleware validates ALL token types (JWT, API key, HMAC, PREL) through kza-prel.

### 10.3 Middleware Bypass Prevention

The middleware cannot be bypassed because:

1. **Supabase Edge Gateway order is fixed** — The middleware runs BEFORE the target function. There is no route that skips the middleware layer.
2. **No raw function URLs** — Supabase does not expose functions at raw URLs without going through the gateway.
3. **Internal function-to-function calls** — Even calls made via `supabase.functions.invoke()` go through the gateway. The `X-PREL-Token` must be present and valid.
4. **Service role bypass is eliminated** — Previously, functions using the service role key could bypass auth. Under KZA-PREL, even internal service role calls must present a valid PREL token. The service role key alone is no longer sufficient for any function execution.
5. **All-or-nothing enforcement** — If the middleware is down, ALL function calls fail (fail-closed). There is no fallback to unauthenticated mode.

---

## Hacker Bypass Matrix

### 11.1 Attack Tree Analysis

```
Goal: Execute an edge function without authorization
│
├── 1.0 Capture valid PREL token
│   ├── 1.1 Intercept network traffic
│   │   └── 1.1.1 Token is HTTPS-encrypted in transit → BLOCKED (TLS)
│   │
│   ├── 1.2 Extract from browser memory
│   │   ├── 1.2.1 XSS injection → Token bound to session, attacker lacks F2FA seed
│   │   └── 1.2.2 Memory dump → Token expires in 45s, already consumed
│   │
│   └── 1.3 Replay captured PREL token
│       └── 1.3.1 Single-use enforcement → First caller consumes, rest get 409
│
├── 2.0 Bypass token validation
│   ├── 2.1 Send request without PREL token
│   │   └── 2.1.1 Gateway middleware intercepts → redirected to kza-prel
│   │
│   ├── 2.2 Send request directly to edge function URL (bypass middleware)
│   │   └── 2.2.1 Supabase architecture doesn't expose direct function URLs → BLOCKED
│   │
│   └── 2.3 Modify API spec to skip middleware
│       └── 2.3.1 Attacker cannot modify Supabase project config → BLOCKED
│
├── 3.0 Forge PREL token
│   ├── 3.1 Brute force HMAC signature
│   │   └── 3.1.1 HMAC-SHA512 with 256-bit key → computationally infeasible
│   │
│   ├── 3.2 Steal HMAC signing key
│   │   ├── 3.2.1 Key stored in pgsodium keyring → only accessible via RPC
│   │   └── 3.2.2 Key never in environment variables or code → BLOCKED
│   │
│   └── 3.3 Reuse token across functions
│       └── 3.3.1 Token bound to function_id in HMAC payload → signature mismatch
│
├── 4.0 Bypass Layer 2 (CIP)
│   ├── 4.1 Generate CIP without browser
│   │   ├── 4.1.1 Need 9 entropy sources using proprietary reduction → infeasible
│   │   └── 4.1.2 build_challenge rotates per deployment → must reverse each build
│   │
│   ├── 4.2 Replay captured CIP
│   │   └── 4.2.1 CIP bound to session_entropy + timing_delta → different context produces different expected CIP
│   │
│   └── 4.3 Disable CIP requirement
│       └── 4.3.1 Registry requires CIP for the function → only changeable by admin
│
├── 5.0 Bypass Layer 3 (F2FA)
│   ├── 5.1 Brute force 8-digit code
│   │   └── 5.1.1 10^8 = 100M. 3 attempts per 30s window. 3 attempts = KZA_BLACK → infeasible
│   │
│   ├── 5.2 Extract SESSION_SEED
│   │   └── 5.2.1 Seed delivered encrypted in auth response → requires key compromise
│   │
│   └── 5.3 Predict next code
│       └── 5.3.1 Without MASTER_SECRET, cannot compute DAY_SEED or FUNCTION_SEED
│
├── 6.0 Exploit internal function-to-function calls
│   ├── 6.1 Call github-storage without cloudbliss-api
│   │   └── 6.1.1 allowed_callers = ['cloudbliss-api', 'file-key', 'media-segment']
│   │           Calling from any other function → KZA_UNAUTHORIZED_CALLER
│   │
│   └── 6.2 Chain depth exhaustion
│       └── 6.2.1 github-storage chain_depth_limit = 2
│               Token at depth 3 → KZA_CHAIN_DEPTH_EXCEEDED
│
├── 7.0 Exploit token TTL
│   ├── 7.1 Use token near expiry
│   │   └── 7.1.1 expires_at checked before execution → expired token = KZA_EXPIRED
│   │
│   └── 7.2 Race condition on token consumption
│       └── 7.2.1 Atomic DB transaction → at most one caller succeeds
│
└── 8.0 Social engineering / Insider threat
    ├── 8.1 Admin creates registry exception
    │   └── 8.1.1 Registry changes logged to kza_admin_incidents → auditable
    │
    └── 8.2 Developer deploys backdoor function
        └── 8.2.1 Function must be registered in kza_prel_registry → unknown functions blocked
                8.2.2 Code review required for registry changes → CI/CD gate
```

### 11.2 Scoring Methodology

Each bypass attempt is scored on four axes:

| Axis | Weight | Description |
|------|--------|-------------|
| **Feasibility** | 40% | How realistic is this attack? (1-10) |
| **Impact** | 30% | If successful, what's the damage? (1-10) |
| **Detection Evasion** | 20% | Can KZA detect and respond? (1-10, higher = harder to detect) |
| **Effort** | 10% | How much effort/resources required? (1-10, higher = more effort) |

**Final score = Feasibility × 0.4 + Impact × 0.3 + Detection Evasion × 0.2 + Effort × 0.1**

Score interpretation:
- **0-2**: Trivial block — KZA-PREL handles this automatically
- **2-4**: Moderate challenge — requires monitoring but no immediate action
- **4-6**: Serious concern — requires registry hardening or algorithm update
- **6-8**: Critical — must be addressed before deployment
- **8-10**: Showstopper — architecture must change

### 11.3 Attack Scorecard

| Attack | Feas. | Impact | Evasion | Effort | Final | Verdict |
|--------|-------|--------|---------|--------|-------|---------|
| Replay captured PREL token | 3 | 8 | 1 | 1 | **3.6** | ✅ Mitigated (single-use) |
| Brute force F2FA 6-digit code | 1 | 6 | 2 | 8 | **3.0** | ✅ Mitigated (rate gate) |
| Brute force F2FA 8-digit code | 1 | 6 | 2 | 9 | **3.1** | ✅ Mitigated (rate gate) |
| Extract CIP algorithm from minified Web Workers | 2 | 7 | 4 | 9 | **4.6** | ⚠️ Monitor (rotates per build) |
| Steal HMAC signing key from pgsodium | 2 | 10 | 5 | 9 | **5.4** | ⚠️ Monitor (key rotation policy) |
| Social engineering admin to disable PREL | 3 | 10 | 8 | 2 | **5.6** | ⚠️ Process control (CI/CD gates) |
| Race condition on token consumption | 2 | 5 | 3 | 3 | **3.0** | ✅ Mitigated (atomic transaction) |
| Bypass gateway middleware | 1 | 10 | 1 | 9 | **3.6** | ✅ Mitigated (Supabase architecture) |
| DevTools "Copy as fetch" replay | 3 | 6 | 4 | 1 | **3.6** | ✅ Mitigated (CIP timing delta) |
| curl with stolen JWT + F2FA | 2 | 7 | 2 | 4 | **3.4** | ✅ Mitigated (no CIP, no F2FA) |
| Python requests with full header replication | 3 | 7 | 4 | 6 | **4.7** | ⚠️ Monitor (CIP entropy check) |
| Leaked service role key as bearer | 4 | 10 | 3 | 1 | **4.9** | ✅ Mitigated (service role alone insufficient) |
| Extract F2FA seed from browser storage | 2 | 8 | 3 | 5 | **4.0** | ✅ Mitigated (seed is session-bound + encrypted) |

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)

| Task | Deliverable | Dependencies |
|------|-------------|--------------|
| Create `kza_prel_registry` table | SQL migration | None |
| Create `kza_prel_sessions` table | SQL migration | None |
| Create `kza_prel_f2fa_seeds` table | SQL migration | None |
| Implement `kza-prel/gateway` edge function | Edge function (without CIP/F2FA initially) | Registry table |
| Implement `kza-prel/validate` edge function | Edge function | Sessions table |
| Create `global_f2fa_master_secret` in pgsodium keyring | Key stored | pgsodium extension |
| Register first 10 functions in registry | Registry entries | Registry table |
| Deploy gateway middleware configuration | Supabase config change | Registry table |

**Phase 1 Test:** 10 functions can authenticate via kza-prel with JWT only (no CIP, no F2FA).

### Phase 2: Client SDK + F2FA (Week 3-4)

| Task | Deliverable | Dependencies |
|------|-------------|--------------|
| Implement F2FA code generator in Web Worker | `src/lib/kza/f2fa.worker.ts` | Phase 1 |
| Implement CIP generator across 3 Web Workers | `src/lib/kza/cip-*.worker.ts` | Phase 1 |
| Integrate CIP + F2FA into `src/lib/supabase-proxy.ts` | Modified client SDK | CIP/F2FA workers |
| Add `X-CIP` and `X-F2FA` header generation to SDK | Client SDK change | CIP/F2FA integration |
| Build-time challenge injection in CI/CD pipeline | Build script modification | CI/CD access |
| Implement F2FA seed derivation server-side | kza-prel/gateway Layer 3 | Phase 1 |
| Implement F2FA verification (+/-1 window drift) | kza-prel/gateway Layer 3 | Phase 1 |

**Phase 2 Test:** Browser client can authenticate with JWT + CIP + F2FA. Curl requests with same JWT are blocked.

### Phase 3: Full Migration (Week 5-8)

| Task | Deliverable | Dependencies |
|------|-------------|--------------|
| Migrate `cloudbliss-api` to PREL | Replaces API key logic | Phase 2 |
| Migrate `github-storage` to PREL | Removes service_role bearer | Phase 2 |
| Migrate all Tier 1-2 functions | 12 functions converted | Phase 2 |
| Migrate all Tier 3-4 functions | 9 functions converted | Phase 2 |
| Migrate all Tier 5-6 functions | 10 functions converted | Phase 2 |
| Migrate all Tier 7-8 functions | 12 functions converted | Phase 2 |
| Remove old auth logic from migrated functions | Code cleanup | Migration complete |
| Unify API key verification (salt-based) | Single code path | Phase 2 |
| Fix `file-operations` userId trust issue | PREL context replaces body userId | Phase 2 |
| Fix `verify-provider` user binding | PREL context bound to authenticated user | Phase 2 |
| Add PREL call to `send-workspace-invite` | PREL mandatory | Phase 2 |

**Phase 3 Test:** ALL 48 functions authenticate through kza-prel. No function accepts service_role bearer. All API keys use unified salt-based verification. Body userId always matches PREL context userId.

### Phase 4: Hardening + Monitoring (Week 9-10)

| Task | Deliverable | Dependencies |
|------|-------------|--------------|
| Implement dynamic CIP algorithm rotation | CI/CD generates new params per build | Phase 2 |
| Add anomaly detection on F2FA timing patterns | kza-oracle integration | Phase 3 |
| Deploy automated penetration testing suite | Weekly scans against PREL | Phase 3 |
| Rate limiting per PREL chain | kza-prel/gateway Layer 2 enhancement | Phase 3 |
| Geo-velocity scoring | kza-prel/gateway Layer 1 enhancement | Phase 3 |
| Admin dashboard for PREL incidents | Supabase dashboard integration | Phase 3 |
| Token chain visualization (debug tool) | Developer tooling | Phase 3 |

**Phase 4 Test:** No bypass vector scores above 5.0 in attack tree analysis. All bypass attempts generate KZA incidents.

---

## Rollback Strategy

### 13.1 Rollback Triggers

| Event | Action | Timeline |
|-------|--------|----------|
| PREL gateway returns 5xx for >1% of requests | Roll back gateway middleware, keep registry | Immediate |
| F2FA false positive rate exceeds 0.1% | Disable Layer 3 (fall back to JWT + CIP only) | Within 1 hour |
| CIP false positive rate exceeds 1% | Disable Layer 2 (fall back to JWT only) | Within 1 hour |
| Client SDK update breaks >5% of sessions | Roll back client SDK to previous version | Immediate |
| Security vulnerability discovered in PREL | Full rollback to pre-PREL auth | Within 24 hours |

### 13.2 Rollback Mechanism

Each PREL feature has a kill switch via environment variable:

```toml
[functions.kza-prel]
KZA_PREL_ENABLED = true          # Master switch
KZA_PREL_LAYER1_ENABLED = true   # Identity check
KZA_PREL_LAYER2_ENABLED = true   # CIP verification  
KZA_PREL_LAYER3_ENABLED = true   # F2FA verification
KZA_PREL_GATEWAY_ENABLED = true  # Gateway middleware
```

Setting `KZA_PREL_ENABLED = false` reverts all functions to their pre-PREL auth mechanisms. Individual layers can be disabled independently:

- **Layer 3 disabled** → Functions fall back to JWT + CIP only
- **Layer 2 + 3 disabled** → Functions fall back to JWT only
- **All layers disabled** → Functions revert to original auth (maintains backward compatibility)

### 13.3 Backward Compatibility

All existing auth mechanisms remain functional during the migration period:

| Old Mechanism | Transition Path | Cutoff |
|---------------|----------------|--------|
| JWT via `supabase.auth.getUser()` | Validated through PREL Layer 1 | After Phase 3 |
| API key (salted, System A) | Unified in PREL Layer 1 | After Phase 3 |
| API key (unsalted, System B) | Migrated to salt-based in PREL Layer 1 | After Phase 3 |
| HMAC signed URLs | Validated through PREL Layer 1 alternative path | After Phase 3 |
| Service role as bearer | REMOVED — replaced by PREL token | Phase 3 (breaking change) |

The service role key as bearer token is the ONLY breaking change. All other mechanisms remain backwards-compatible during migration.

---

## Appendix A: PREL Error Codes

| Code | HTTP Status | Meaning | Action |
|------|-------------|---------|--------|
| `KZA_PREL_MISSING` | 401 | No PREL token in request | Call kza-prel/gateway first |
| `KZA_PREL_EXPIRED` | 401 | PREL token TTL expired | Request new token |
| `KZA_PREL_CONSUMED` | 409 | Token already used by another request | Request new token |
| `KZA_PREL_INVALID_SIG` | 403 | HMAC signature doesn't match | Token corruption or forgery attempt |
| `KZA_PREL_WRONG_FN` | 403 | Token bound to different function | Use correct token for this function |
| `KZA_PREL_WRONG_USER` | 403 | Token bound to different user | Authenticate as the correct user |
| `KZA_PREL_CHAIN_DEPTH` | 403 | Token chain depth exceeded | Restructure call chain |
| `KZA_PREL_UNAUTHORIZED_CALLER` | 403 | Function not in allowed_callers | Check registry configuration |
| `KZA_PREL_CIP_FAILED` | 403 | Client Integrity Proof invalid | Not a legitimate SquidCloud client |
| `KZA_PREL_F2FA_FAILED` | 403 | F2FA code invalid or expired | Re-authenticate to get new seed |
| `KZA_PREL_F2FA_BRUTE` | 429 | Too many F2FA failures | Session banned for 24 hours |
| `KZA_PREL_RATE_LIMIT` | 429 | Too many requests per second | Slow down request rate |
| `KZA_PREL_UNREGISTERED` | 501 | Function not in kza_prel_registry | Register function before use |

## Appendix B: Token Chain Example (curl Trace)

```
=== REQUEST 1: Browser to cloudbliss-api ===
POST /cloudbliss-api/files/upload
Headers:
  Authorization: Bearer <JWT>
  X-CIP: <build-version-3-cip-proof>
  X-F2FA: <8-digit-code>

=== KZA-PREL PROCESSING ===
1. Layer 1: JWT verified → user_id = "u_abc123"
            Fingerprint match → PASS (score: 85)
2. Layer 2: CIP verified → build: v3, timing: 142ms → PASS (score: 100)
3. Layer 3: F2FA verified → window: 1847293 → PASS (score: 100)
4. Token issued: PREL_v1.{tokA_payload}.{tokA_sig}
   → TTL: 45s, function: cloudbliss-api, scope: upload

=== REQUEST 2: cloudbliss-api to github-storage ===
POST /github-storage
Headers:
  X-PREL-Token: PREL_v1.{tokA_payload}.{tokA_sig}
  (forwarding original PREL token for validation)

=== KZA-PREL/validate ===
1. Token A exists? ✓ (not expired, not consumed)
2. Token A function match? cloudbliss-api = cloudbliss-api ✓
3. Allowed caller check? github-storage.allowed_callers
   contains cloudbliss-api ✓
4. Issue child token: PREL_v1.{tokB_payload}.{tokB_sig}
   → parent: tokA_hash, depth: 1, function: github-storage
5. Mark Token A as consumed

=== REQUEST EXECUTION ===
github-storage processes upload using Token B context
Token B expires in 45s (or when operation completes)
```

---

*Document version 1.0.0 — KZA Security Division — SquidCloud Infrastructure*
*Next review: 2026-07-20*

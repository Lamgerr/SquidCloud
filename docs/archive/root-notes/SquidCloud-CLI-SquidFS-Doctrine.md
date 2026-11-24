---
title: "SQUIDCLOUD COMMAND INFRASTRUCTURE"
subtitle: "Consolidated Technical Doctrine — squidcloudctl & SquidFS"
author: "Office of Platform Engineering — Systems Doctrine Division"
date: "August 2026"
lang: en
---

# DOCUMENT CONTROL

| Field | Value |
|---|---|
| Document identifier | SC-DOCTRINE-2026-0847 |
| Classification | INTERNAL — HANDLE VIA SQUIDCLOUD CHANNELS EXCLUSIVELY |
| Distribution | Platform Engineering; Storage Infrastructure; Security Engineering; On-call rotation leads only |
| Handling caveat | Contains complete architectural exposition of authentication bypass surfaces, cryptographic envelope formats, and incident post-mortems. Disclosure outside the named distribution constitutes a reportable security event. |
| Review cycle | Semi-annual, or upon any change to the PREL registry schema, res54 envelope versions, or decryptor wire protocol |
| Supersedes | SC-DOCTRINE-2026-0612 (partial), all prior runbook fragments for fs mount and host api |
| Custodian | Systems Doctrine Division |

## REVISION LEDGER

| Rev | Date | Authoring Cell | Substance of Amendment |
|---|---|---|---|
| 0.1 | 2026-05 | Storage Infra | Initial assembly of SquidFS WebDAV notes |
| 0.4 | 2026-06 | Security Eng | KZA/PREL gateway annex; F2FA seed doctrine drafted |
| 0.7 | 2026-07 | Platform Eng | Decryptor daemon specification; res54 v3 envelope ratified |
| 0.9 | 2026-08 early | Platform Eng | Host API profiles; micro-redis internals; audit pipeline |
| 1.0 | 2026-08 late | Joint Cells | Mandatory TOTP regime; device-scoped banning; secret tier doctrine; consolidated post-mortem annex; this revision |

## PURPOSE AND AUTHORITY

This document is the single authoritative exposition of the design, behavior, failure modes, and operational doctrine of two coupled artifacts: the **squidcloudctl** command-line instrument (hereinafter "the CLI") and the **SquidFS** native engine (Go binary providing WebDAV/FUSE surface over encrypted cloud storage). It exists so that an engineer arriving with no prior exposure can achieve, within one reading: (a) a correct mental model of every moving part; (b) the ability to reason about failures without source access; (c) knowledge of which compromises are deliberate engineering trade-offs versus defects; and (d) the operational discipline expected when handling credential material and privileged commands.

Where this document conflicts with observed runtime behavior, the discrepancy is itself intelligence: file a discrepancy report against the custodian. Where this document is silent, the source repository is authoritative, and this document must be amended in the next revision cycle.

## READING PROTOCOL

Sections are ordered by epistemic dependency, not by component alphabet. A reader who skips Section IV (Identity) will not correctly understand Section VI (KZA/PREL); a reader who skips Section VII (res54) cannot reason about Section IX (Decryptor). Cross-references are given as §-numbers. Paragraph-level citation takes the form §IX.14, meaning Part IX, paragraph 14. Annexes (A–E) carry post-mortems, glossary, port ledger, decision register, and verification matrices.

\newpage

# PART I — SYSTEM DOCTRINE AND THREAT POSTURE

## §1. Mission Statement of the Coupled System

The coupled system exists to place a user's cloud-resident, end-to-end-encrypted files onto their local machine as if they were ordinary files — readable by any local application through WebDAV or FUSE semantics — while ensuring that **no plaintext ever exists on server infrastructure**, and that the decryption capability is confined to a hardware-adjacent, loopback-bound daemon under the user's exclusive control. The CLI is the operator's instrument for identity, provisioning, and lifecycle; SquidFS is the data-plane engine. Neither is independently sufficient: the CLI without SquidFS cannot serve byte ranges to applications; SquidFS without the CLI has no identity with which to negotiate keys.

The design accepts an uncomfortable truth and engineers around it: any system that can show plaintext to a local application can be compelled to show plaintext to a local adversary. The doctrine therefore does not pretend to defeat a fully compromised endpoint. Instead it draws a precise perimeter: **compromise of the network, the storage substrate, or the platform API must yield only ciphertext; compromise of the endpoint is contained by minimizing credential lifetime, scoping every token, and making privileged actions require a fresh human-presence proof (TOTP).**

## §2. The Three Trust Domains

All reasoning about the system begins with partitioning the world into three domains with distinct trust characteristics.

**Domain T1 — Endpoint (user device).** Hosts the CLI process, the decryptor daemon, the SquidFS engine, and all secret material in its tiered store. Adversary presence here is *assumed eventual*; controls are therefore aimed at blast-radius reduction (short TTLs, per-device bans, least-privilege scopes) rather than prevention.

**Domain T2 — Platform control plane.** The Vercel-hosted REST surface (`/api/v1/...`), Supabase Postgres, edge functions (cloudbliss-api, file-key, cli-oauth, cli-totp, kza-prel, kza-admin, squidfs-bridge). Code and service-role credentials live here; user plaintext must never be reconstructible here even though ciphertext chunks transit and rest here.

**Domain T3 — Object storage substrate.** Backblaze B2 bucket pool (and historically other clusters), addressed exclusively through short-lived signed URLs minted by T2. Holds only res54-enveloped ciphertext, keyed by path segments embedding the owner's user identifier.

Every paragraph of this document can be read as an elaboration of one sentence: *keys live in T1; envelopes in T3; authorization logic in T2; and the boundaries between them are crossed only by signed, scoped, time-boxed instruments.*

## §3. Standing Threat Model

The following adversary capabilities are considered within scope and drive specific mechanisms cited throughout:

| Ref | Adversary Capability | Primary Countermeasure | Section |
|---|---|---|---|
| TH-01 | Passive network observation (LAN or transit) | TLS everywhere; loopback-only daemons; no plaintext egress | §IX, §X |
| TH-02 | Active LAN peer attempting direct daemon access | Loopback bind default; mandatory WebDAV password for any non-loopback bind; mDNS opt-in | §X |
| TH-03 | Theft of flat credential files | Tiered secret store (OS keychain → encrypted vault → 0600 fallback); secrets absent from metadata file | §XII |
| TH-04 | Replay/reuse of stolen opaque CLI tokens | Server-side token_hash lookup (never reversible), revocation endpoints, device ban entities | §IV |
| TH-05 | Online guessing of second factor | RFC-6238 ±1 window with constant-time compare; 3 failures / 5 minutes ⇒ permanent DEVICE+MACHINE ban, never account ban | §VI |
| TH-06 | Privileged-command abuse by malware running as the user | Mandatory fresh TOTP attestation before mount/API-server/keys/destructive ops; KZA-PREL token required, bound to IP|UA | §VI, §VIII |
| TH-07 | Cross-tenant read (IDOR) via guessed file identifiers | Ownership assertion `files.user_id == resolved_user` plus workspace scoping on every download/key path | §IV, §VIII |
| TH-08 | Supply-chain substitution of the engine binary | Release checksum verification against published checksums.txt; build-from-source precedence order | §XIII |
| TH-09 | Malicious or misbehaving web origin driving localhost daemons (DNS rebinding) | Custom-header session requirement on decryptor; absence of CORS reflection; loopback bind | §IX |
| TH-10 | Storage-substrate compromise | Only res54 envelopes at rest; per-file data keys wrapped in platform-side vault; envelope AEAD with AAD binding identity+file+index | §VII |

Explicitly out of scope (documented so future readers do not relitigate): kernel-level keyloggers, memory-scraping of the decryptor process while it holds key material in RAM, and physical extraction. These are acknowledged residual risks; the mitigation is operational (device hygiene), not architectural.

## §4. Doctrine of Deliberate Asymmetries

Four asymmetries recur and should be recognized as intentional:

1. **Asymmetry of verification.** Opaque tokens are stored server-side only as SHA-256 hashes; presentation is verified against hash. Loss of the database therefore does not leak usable bearer material.
2. **Asymmetry of locality.** Anything that touches plaintext (decryptor, SquidFS content path) binds to loopback; anything that must be reachable (platform API) handles only ciphertext or metadata.
3. **Asymmetry of privilege.** Read-everything commands run on a stale-able bearer token; state-changing or exfiltration-grade commands (mount, api server, key minting, destructive storage ops) demand a human-present second factor whose attestation expires in minutes.
4. **Asymmetry of blame.** Brute-force punishment lands on the *instrument* (device row + machine fingerprint), never on the *person* (account). An attacker brute-forcing from a stolen laptop burns that laptop, not the victim's access.

\newpage

# PART II — ARCHITECTURE ATLAS

## §5. Component Inventory and Port Ledger

| Component | Runtime | Default Bind | Purpose (one line) |
|---|---|---|---|
| squidcloudctl | Node ≥20 ESM single binary entry | n/a (client) | Identity, provisioning, command dispatch, guard enforcement |
| Decryptor daemon | Node ESM script materialized from embedded source | 127.0.0.1:6763 | Sole plaintext reconstruction authority on endpoint |
| SquidFS engine | Go static binary (CGO disabled) | 127.0.0.1:8099 (WebDAV) | Filesystem semantics over cloud objects |
| Host API | Node HTTP server | 127.0.0.1:8065 | Local REST mirror of platform file operations |
| MicroRedis | Node TCP server | 127.0.0.1:8066 (port+1 of host api) | In-memory KV/rate-limit backing for host api |
| Platform REST | Vercel functions | public HTTPS | Control plane: metadata, signed URL minting, key custody |
| Bridge (squidfs-bridge) | Supabase edge fn | public HTTPS | Path-oriented listing/meta/upload negotiation for SquidFS |
| file-key | Supabase edge fn | public HTTPS | Wrapped-key unwrapping service (ownership-checked) |
| cli-oauth | Supabase edge fn | public HTTPS | Device-code issuance/poll/token for CLI login |
| cli-totp | Supabase edge fn | public HTTPS | TOTP verification + AAL2 attestation + seed issuance |
| kza-prel / kza-admin / kza-* | Supabase edge fns | public HTTPS | Token gateway and security administration stack |
| Dashboard | Next.js/Vercel SPA | public HTTPS | Device management, Security Center, CliAuthorize consent |

The port ledger is normative: 6763 decryptor, 8099 WebDAV default, 8065 host api, redis = host+1 unless overridden. Any change requires revision of this document.

## §6. Process Topology at Steady State

During a typical mounted session the endpoint runs three cooperating processes: the CLI parent (which may exit after spawning), the detached decryptor daemon, and the SquidFS engine. The spawn graph matters operationally: the CLI provisions the decryptor first (health-check reuse or fresh detached spawn), then launches SquidFS as a child with an environment containing the bridge URL, the storage key, the decryptor URL, the decryptor session secret, and optionally the WebDAV PBKDF2 hash-file path. SquidFS writes its pid to a session file so `host stop`/`fs stop` can terminate deterministically; the decryptor intentionally survives CLI exit (detached, stdio discarded) so subsequent mounts within the secret's lifetime reuse it via health check.

Failure topology follows the same seams: if the decryptor cannot bind 6763 the mount aborts before SquidFS starts (fail-closed); if SquidFS cannot bind its port the session file is not written; if the platform is unreachable, listing degrades to cached entries and downloads fail per-request rather than terminating the daemon.

## §7. Data Flow Canonical Walkthrough

The canonical read path, cited throughout later parts, proceeds:

1. Local application issues WebDAV GET for a path.
2. Engine resolves the path through its listing cache into file metadata containing a UUID identifier and chunk manifest.
3. Engine requests `http://127.0.0.1:6763/file/<uuid>` carrying the session header.
4. Decryptor authenticates the session header, fetches signed chunk URLs and (if needed) the unwrapped file key from T2, pulls chunks concurrently from T3, strips envelopes, reassembles, and returns plaintext bytes.
5. Engine applies range arithmetic and writes bytes to the WebDAV response.

Every hardening decision in Parts VI–X is a reinforcement of one hop of this chain. Memorize the chain; everything else is annotation.

\newpage

# PART III — IDENTITY AND CREDENTIAL LIFECYCLE

## §8. Identity Instruments Inventory

The endpoint may hold, at various moments, up to five credential instruments. Their custody, lifetime, and scope are tabulated here and elaborated in following paragraphs.

| Instrument | Form | Custody | Typical Lifetime | Scope |
|---|---|---|---|---|
| CLI opaque device token | 64-char random, no dots | Secret store tier; server keeps SHA-256 only | 30 days sliding per policy | Full user-scope REST access, non-privileged |
| Supabase JWT (sb_token) | Three-segment JWT | Secret store tier | ≤55 minutes shelf | Direct Supabase-authenticated calls when available |
| Anon key | Public JWT constant | Metadata file / env | Indefinite (public) | Gateway passage; not a secret by design |
| Storage key (cb_) | Prefixed random | Process environment of engine child | Session-scoped mint or pre-existing | Bridge + storage negotiation for SquidFS |
| Decryptor session secret | 48-hex random | decryptor.json (0600) | Daemon lifetime | Sole authority for 6763 /file calls |
| WebDAV password verifier | PBKDF2 hash file | 0600 hash file; plaintext in secret store | Until regenerated | WebDAV Basic gate |

Doctrine: **no plaintext secret ever resides in the metadata JSON.** The metadata file records email, expiry epochs, device identifier, token prefix (first 8 chars, for display), and the chosen secret-backend marker — never the instruments themselves.

## §9. Device-Code Login Flow (Authoritative Narrative)

Login proceeds through the OAuth device-authorization grant adapted to the platform:

1. CLI generates a **persistent machine identifier** (random UUID, written once to the configuration directory with 0600). This is the permanent install fingerprint referenced by the banning regime; it deliberately survives re-login and reinstallation of the CLI but not deletion of the config directory.
2. CLI posts machine id, hostname, and platform string to `cli-oauth/device`, receiving a device code, a human verification URL, an interval, and an expiry.
3. The operator authenticates in a browser at the verification URL. The consent surface (`CliAuthorize`) enforces an AAL2 gate when TOTP enrollment exists: if the web session's current authenticator assurance level is not already AAL2, the inline MFA challenge screen intercepts approval.
4. On approval the device row transitions pending → authorized. The CLI polls `device/poll` at the prescribed interval.
5. The poll handler now applies the **TOTP mandatory gate**: if the owning account lacks any verified TOTP factor, issuance is refused with code `TOTP_REQUIRED` and the enrollment URL, regardless of prior behavior. This check reads factor state through service-role SQL against `auth.mfa_factors` and fails closed on infrastructure error (HTTP 500, `TOTP_GATE_ERROR`) rather than issuing a token under doubt.
6. Upon success the server mints the opaque token, stores only its SHA-256 as `token_hash`, marks the row active, stamps authorization time, and returns token, prefix, email, device id, expiry, and anon key.
7. The CLI then invokes the login-time TOSP enforcement described in §11, writes metadata, persists secrets into the tiered store, prints the success banner, and exits cleanly (explicit connection teardown prevents keep-alive sockets from hanging the terminal).

Failure semantics worth memorizing: slow_down responses extend polling cadence by three seconds; expiry produces a distinct terminal message; network errors during poll are retried until expiry rather than aborting.

## §10. Opaque Token Verification Contract

Every edge function that accepts the opaque instrument implements an identical resolution contract, referred to herein as **resolveCliDevice**: reject tokens containing a dot (those are JWTs and take a different path); compute SHA-256 over the UTF-8 token; select from `cli_devices` where `token_hash` equals the digest; refuse if the row is banned, revoked, or expired. The contract's security property is that the database never contains presentation material — a full dump yields digests requiring brute-force against a 256-bit search space.

Two consequences follow. First, any *new* function that authenticates CLI callers must use this exact contract rather than inventing a lookup; divergence has historically produced the class of bugs catalogued in Annex A (stale-key 401s). Second, because resolution returns the row (not merely the user id), functions can and should consult `aal2_verified_at` and ban state in the same read.

## §11. Login-Time TOTP Enforcement

After token issuance the CLI performs an interactive attestation:

- It queries `cli-totp {action:"status"}` carrying the bearer token and machine header. Response distinguishes three worlds: enrolled-and-clean, enrolled-but-this-device-banned (`KZA_DEVICE_BANNED`), and unenrolled.
- Unenrolled ⇒ hard stop. The doctrine sentence is printed with the enrollment URL; exit code 1. There is no bypass flag. Non-interactive logins (CI) are permitted to defer the *prompt* but not the *policy*: privileged commands will still demand a live verification, so headless operators must complete one interactive attestation whose seed they persist via environment passphrase unlock.
- Enrolled ⇒ prompt for the six-digit code, submit `{action:"verify"}`. Success stores the returned KZA seed in the secret store under the attestation slot and clears any stale PREL token; failure decrements the visible attempt budget; third failure within the window triggers the device-ban path and immediate exit.

The attestation UX mirrors the web `MfaChallengeScreen`: six digits, numeric-only input handling, explicit remaining-attempt feedback, and a distinct terminal state for bans so operators do not confuse "wrong code" with "instrument burned."

## §12. Token Revocation and Expiry Discipline

Revocation operates along four independent axes, any one sufficient: (i) `cli-oauth/revoke` by the user (marks authorizations and devices revoked); (ii) local metadata deletion plus secret-slot removal on logout; (iii) expiry epoch checked at every load, with automatic local cleanup on staleness; (iv) administrative revocation via kza-admin (sessions consumed, seeds deactivated, auth sign-out). Doctrine requires that logout remove secrets from all tiers, not merely unlink the metadata file — an early implementation gap noted in Annex A.

\newpage

# PART IV — THE SECRET STORAGE TIERS

## §13. Tier Hierarchy and Selection Order

Secret custody follows a strict tier hierarchy evaluated in this order:

**Tier I — OS-native credential manager**, accessed through a prebuilt native binding (no compilation toolchain required on consumer machines). Service name is fixed ("SquidCloud CLI"); each instrument occupies one account slot (token, anon_key, sb_token, webdav, aal2_seed, aal2_prel). Availability is proven by a probe write/read/delete cycle before selection, not assumed from import success.

**Tier II — Encrypted vault file** for capable-but-headless Linux hosts lacking a keyring daemon. AES-256-GCM envelope; key derived by scrypt (N=16384, r=8, p=1, 32-byte output) from a passphrase supplied once interactively at vault creation or subsequently at unlock; salt randomized per write; nonce randomized per write; artifact stored 0600. Passphrase may be furnished by environment variable for automation; interactive creation rejects passphrases shorter than eight characters.

**Tier III — Plain JSON fallback** (0600) for environments where neither tier can exist — notably Android/Termux, which offers no Secret Service daemon and no DPAPI. Selection prints a standing warning so operators never mistake Tier III for a deliberate choice.

Selection is sticky: the resolved tier is recorded in metadata and honored on subsequent runs so that secrets never straddle tiers (which would make logout incomplete). If a previously recorded Tier I vanishes (keyring removed), the system warns explicitly that old entries are unrecoverable from the new tier and proceeds with fresh entries rather than failing closed.

## §14. Migration Doctrine

Legacy installations stored instruments directly in the metadata JSON. The migration routine executes opportunistically at login: detect legacy keys present in plaintext metadata, move each into the resolved tier, rewrite metadata without them. The operation is idempotent and silent unless it moves something. Audit expectation: after any 3.x-era login, plaintext inspection of the metadata file must yield no bearer material whatsoever.

## §15. File Mode Ledger

| Path | Mode | Contents permitted |
|---|---|---|
| ~/.squidcloud/credentials | 0600 dir 0700 | Metadata only — email, expiries, prefixes, backend marker, device id |
| ~/.squidcloud/secrets.plain.json | 0600 | Tier III instruments (warning-printed fallback) |
| ~/.squidcloud/vault.enc | 0600 | Tier II sealed envelope |
| ~/.squidcloud/decryptor.json | 0600 | Daemon pid/port/session secret/version/start epoch |
| ~/.squidcloud/device-id | 0600 | Permanent machine identifier |
| ~/.squidcloud/webdav-auth | 0600 | PBKDF2 verifier line (§X format) |
| ~/.squidcloud/host-audit.log | default | Append-only audit lines (non-secret) |
| ~/.squidfs/cache/** | default | Chunk cache (ciphertext only, see §XVII) |

Any future artifact holding bearer material must be added to this ledger with mode justification; the ledger is auditable during review cycles.

\newpage

# PART V — THE res54 CRYPTOGRAPHIC REGIME

## §16. Design Intent

res54 is the house envelope format family for all user file bytes. Its requirements, in priority order: (1) client-side encryptability in a browser (WebCrypto-expressible primitives only); (2) per-file key separation with platform-side wrapped custody so the server can serve ciphertext without ever holding usable keys; (3) chunk-level parallelism for large files; (4) format evolution without breaking legacy objects; (5) authenticated binding of each ciphertext chunk to (user identity, file identity, chunk index) so chunks cannot be reordered, transplanted between files, or truncated undetected.

Three envelope generations coexist. Readers must internalize that **version detection is content-based**, not metadata-based: the decryptor inspects leading bytes of each chunk blob and selects a strategy, attempting candidates in order until AEAD verification succeeds.

## §17. Key Material Hierarchy

| Layer | Notation | Origin | Notes |
|---|---|---|---|
| Master/file key string | K | Generated at upload (random) or supplied BYOK | Treated as an opaque string; only its first 32 bytes matter |
| Raw AES key | K_raw | UTF-8 bytes of first 32 chars of K, zero-padded to 32 | Deliberately *not* hex-decoded; historical compatibility constraint |
| v3 file master | FK_v3 | HKDF-SHA256(ikm=K_raw, salt=∅, info="v3-file-master"‖fileId), 32B | Per-file subkey derivation |
| v3 chunk key | CK_i | HKDF-SHA256(ikm=FK_v3, salt=∅, info="v3-chunk"‖u32le(i)), 32B | Per-index domain separation |

The zero-padding derivation is doctrine-critical: keys are strings like random alphanumerics; taking UTF-8 of `K[0:32].padEnd(32, '\0')` is the single canonical mapping used by web frontend, CLI decryptor, and server-side decrypt paths alike. Any new implementation that hex-decodes will silently produce garbage that fails AEAD — the failure signature is uniform decryption failure across all versions for one file while other files succeed.

## §18. Envelope Version 2 (Canonical Client Format)

Framing, byte-accurate:

| Offset | Size | Field |
|---|---|---|
| 0 | 4 | Header length L, little-endian uint32 |
| 4 | L | JSON header (UTF-8) |
| 4+L | … | Concatenated part records |

JSON header fields: version=2; totalSize; chunks=N; ivs=[12-byte arrays as number lists].

Each part record:

| Offset | Size | Field |
|---|---|---|
| +0 | 4 | AAD length D, LE |
| +4 | D | AAD bytes (ASCII context string embedding chunk ordinal/count/timestamp) |
| +4+D | 4 | Ciphertext length E, LE |
| +8+D | E | AES-256-GCM ciphertext ‖ 16-byte tag |

AEAD inputs: key=K_raw, nonce=per-part 12 bytes from header, AAD=embedded record. Detection heuristic: first four bytes read as LE uint32 land in (0,1000) AND parse as JSON satisfying version≥2/chunks>0/ivs-array ⇒ v2.

A legacy API-side variant exists where parts lack explicit AAD records (bare ciphertext runs sized by header sizes[] or uniform chunkSize, base64 IV strings). The detector treats absence of numeric/array-typed first IV as this variant and decrypts runs without AAD.

## §19. Envelope Version 3 (Current Ratified Format)

V3 abandons JSON headers for compactness and binds identity cryptographically:

| Offset | Size | Field |
|---|---|---|
| 0 | 3 | Magic bytes 0x52 0x45 0x03 ("R","E",version) |
| 3 | 1 | reserved (zero) |
| 4 | 3 | reserved (zero) |
| 7 | 12 | Nonce |
| 19 | … | Ciphertext ‖ tag |

AEAD inputs: key=CK_i (HKDF chain per §17), nonce from frame, AAD = exact string `res54-v3|<userId>|<fileId>|<chunkIndex>|<totalChunks>`.

The AAD binding is the format's principal security advance: transplanting a chunk between files, users, or positions fails authentication rather than yielding shifted plaintext. Cost: decryption now requires knowing userId/fileId/index/total — hence the decryptor's signed-download response includes user_id, and the engine passes index/total context alongside each chunk.

Detection: bytes 0..2 equal the magic triple ⇒ v3, unconditionally preceding v2 heuristics.

## §20. Legacy Envelope (Generation 1)

Oldest objects: 12-byte nonce followed by ciphertext‖tag under K_raw, no AAD, no framing. Detector falls through to it last. No migration program exists or is planned; legacy objects decrypt on demand indefinitely.

## §21. Version Negotiation Procedure

The canonical attempt order is: v3 (if magic) → v2-canonical → v2-legacy → generation-1. Each attempt surfaces failure as AEAD OperationError; the procedure reports the winning version and byte length on success, and on total failure raises a composite error carrying attempted-version and blob size — the single most valuable diagnostic field when triaging "decryption failed" tickets (Annex E triage matrix references this paragraph).

\newpage

# PART VI — THE KZA/PREL AUTHORIZATION STACK

## §22. Stack Overview

KZA (the security substrate family) exposes PREL — Privileged Resource Lease — as the sole mechanism by which sensitive operations obtain short-lived authority. Mental model: *a PREL token is a signed lease stating who may do what, until when, proven how, from where.* Components:

- **Registry** (`kza_prel_registry`): one row per protectable function id declaring required auth level, minimum role, F2FA requirement, CIP requirement, TTLs, rate limits, allowed caller functions, chain-depth ceiling, geo policies.
- **Issuer** (`kza-prel/gateway`): evaluates layers, then mints an HMAC-signed token via database RPC (`kza_prel_sign_token`), recording its hash in `kza_prel_sessions`.
- **Validator** (`kza-prel/validate` or embedded gateway helpers): downstream functions present token+function-id for verification; RPC re-verifies signature and expiry.
- **Administration** (`kza-admin`): ban/unban/revoke/export verbs; revocation cascades sessions, seeds, and auth sign-out.
- **Sentinel/Verdict/Phantom/Oracle/Heartbeat**: detection tier feeding `kza_threat_events` and ban entities (out of scope here except as consumers).

## §23. Registry Semantics

Required auth levels observed in production: `none`/`any` (anonymous passage), `jwt`, `api_key` (cb_ prefix instruments), `hmac`/`hmac_gateway`/`hmac_jwt`, `prel_only`. Identity resolution order within the gateway: service-role bearer (internal function-to-function) → JWT via Supabase auth → cb_ api-key digest match → **opaque CLI device token via resolveCliDevice contract** (added in the hardening cycle; see §IV) → refuse.

Operation scoping: if `allowed_operations` is non-empty, requested operation must be a member. Chain depth: tokens carry parent hashes; a child minted via `/refresh` increments depth and refuses beyond registry ceiling, preventing infinite delegation ladders. Binding: every issued token embeds SHA-256(IP‖User-Agent); validation recomputes and compares unless the caller presents the service role (internal calls exempt).

## §24. Token Anatomy

Token payload (JSON, HMAC-wrapped by RPC):

| Field | Meaning |
|---|---|
| version / kid | Format epoch and signing-key identifier |
| userId / sessionId | Principal and session grouping |
| functionId / operation | What the lease authorizes |
| chainDepth / parentHash | Delegation lineage |
| issuedAt / expiresAt | Validity window (registry TTL governs) |
| cipHash | Digest of client-integrity score when CIP layer engaged |
| f2faWindow | The 30-second window index during which second-factor proof was made |
| isLongOp / longOpExpiresAt | Extended validity for long operations |
| binding | IP‖UA fingerprint digest |

Doctrine: treat any code path that constructs these fields outside the issuer as a defect. The RPC is the only signing authority.

## §25. The F2FA Layer (Seed-Derived Second Factor)

Distinct from Supabase TOTP, F2FA protects *each privileged call* using a seed the platform issues after human verification:

1. Seed issuance (today solely by `cli-totp` upon successful TOTP verify): deactivate prior active seeds for (user, function='cli-guard'); insert row with fresh 64-hex `seed_derived`, non-null day_seed and session_nonce, active flag, issuer stamp.
2. Client derives an eight-digit code: concatenate seed‖functionId; append the 30-second window index as little-endian uint64; SHA-256; fold bytes 0–23 by XOR of three little-endian uint32 pairs (offsets i*8 and i*8+4 for i∈{0,1,2}); render decimal, mod 10⁸, left-pad zeros. **Sign matters:** the XOR accumulation yields a signed int32, so rendered codes may legitimately begin with '-' — clients must mirror exactly, never take absolute value.
3. Gateway verifies against the newest active seed, accepting window drift −1/0/+1, constant-time comparison implied by equality-after-computation symmetry.
4. Failure handling: each mismatch inserts a YELLOW `F2FA_FAILURE` threat event; ≥3 events within five minutes flips responses to brute-force refusal (429) and feeds the ban pipeline.

**Historical defect (fixed, Annex A/PM-07):** the original encoder built the u64 with `window >> (i*8)`; JavaScript shifts are int32, so bytes four through seven wrapped to repeats of bytes zero–three. Both encoder and any correct client disagreed; because the layer had been dormant, the divergence lay undetected until live exercise. The ratified encoding is explicit modulo/division construction — implementers must not "simplify" back to shifts.

## §26. cli-guard: The Privileged Command Lease

The registry defines function id **cli-guard** requiring JWT-level identity (satisfied by opaque-token resolution), F2FA required, CIP off, TTL 900 seconds, allowed operations exactly: host api, fs mount, fs webdav, keys add, keys rm, storage rm. Flow: operator command → CLI guard module checks cached attestation (seed + PREL + local shelf-life) → if stale/absent, interactive TOTP prompt → cli-totp returns seed → single gateway exchange (no drift retry loop; drift is server-side) → PREL cached → command proceeds. Non-interactive contexts fail closed before doing any work.

## §27. Device-Scoped Banning Regime

TOTP brute force punishes instruments, never persons:

| Entity type | Value | Effect |
|---|---|---|
| DEVICE | cli_devices.id | That registered device cannot pass cli-totp status/verify (403 `KZA_DEVICE_BANNED`) |
| MACHINE | permanent install fingerprint | Re-imaged CLI on same box remains excluded |
| USER / IP | legacy types | Reserved for other KZA tiers; not set by cli-totp |

Ban rows are PERMANENT with RED tier and reason `CLI_TOTP_BRUTE_FORCE`; lifting requires kza-admin unban by an administrator — deliberately manual. The account itself retains full web access throughout; only CLI privileged step-up is affected. This asymmetry implements Doctrine §4.4.

## §28. Administrative Surface Summary

kza-admin verbs (service-role gated): ban (with tier BLACK ⇒ forced auth sign-out; shadow bans supported), unban (deactivates matching active bans), revoke (consumes sessions, deactivates seeds, signs out auth), export (veil profile dump for incident review). Operators should assume all verbs are audited upstream.

\newpage

# PART VII — TOTP ATTESTATION SERVICE (cli-totp)

## §29. Function Contract

Endpoint: `POST /functions/v1/cli-totp`, deployed with gateway JWT verification disabled (the function performs its own opaque-token authentication; the platform gateway would otherwise reject non-JWT bearers before dispatch — a deployment footgun recorded in Annex A/PM-05).

Request headers: standard bearer (opaque CLI token); machine header carrying the permanent install fingerprint; optional device-id header (server prefers the row-resolved id).

Actions:

| Action | Input | Success output |
|---|---|---|
| status | – | enrolled flag, aal2_recently flag |
| verify | code (6 digits) | success, function_id='cli-guard', seed, ttl_seconds=900 |

## §30. Verification Mechanics

Factor secrets are read directly from `auth.mfa_factors` over a short-lived direct SQL connection (service database URL from environment), filtered to verified TOTP factors. Rationale: the admin MFA API's response shape varies across client-library versions and omits secrets entirely; SQL is authoritative and stable. Connection discipline: pool size one, five-second end timeout, connection closed in a finally clause.

Code verification is RFC-6238 SHA-1/6-digit over the base32-decoded secret with drift {−1,0,+1} on the 30-second window and **constant-time string equality** (length check then XOR-fold compare). Multiple factors are tried in turn; first acceptance wins.

## §31. Failure Accounting and Ban Insertion

Every failed verify: insert YELLOW `F2FA_FAILURE` threat event embedding device id and hashed machine fingerprint, endpoint tag `/cli-totp/verify`. Then count same-type events for the user within five minutes; at three or more, insert PERMANENT RED ban rows for DEVICE (row id) and MACHINE (fingerprint) and respond 403 `KZA_DEVICE_BANNED` thereafter. Pre-check ordering matters: ban lookup precedes all actions so banned instruments cannot even poll status meaningfully (they receive the ban error, which the CLI renders as its terminal instrument-burned state).

Attempt-budget messaging returns remaining attempts (`2 attempts left…`) computed as limit minus current count, giving operators honest feedback while preserving the threshold.

## §32. Success Path Side Effects

On acceptance: stamp `aal2_verified_at` on the device row; deactivate prior active cli-guard seeds for the user (single-seed doctrine); mint and persist the new seed (with required day_seed/session_nonce columns populated); return seed + TTL. The returned seed never leaves TLS except to the operator's endpoint, and it authorizes only the cli-guard lease family for fifteen minutes.

Deployment note: this function must always carry the no-verify-jwt flag on redeploy. A redeploy that forgets it will surface as `UNAUTHORIZED_INVALID_JWT_FORMAT` reaching clients — the signature symptom recorded in PM-05.

\newpage

# PART VIII — THE DECRYPTOR DAEMON

## §33. Existence and Authority

The decryptor is the single component permitted to reconstruct plaintext on the endpoint. It materializes at runtime from source embedded within the CLI package (so binary and script versions cannot diverge), written into the package's module cache directory where native dependency resolution succeeds — an ESM constraint: Node resolves imports by walking up from the script's own directory, ignoring environment search paths, hence the cache placement doctrine recorded in PM-02.

It binds loopback only, port 6763 fixed (env override exists but is not exposed on any command). Startup writes `decryptor.json` (pid, port, session secret, version, start epoch) with mode 0600; concurrent-start semantics: a loser of the bind race exits zero without touching the state file, preserving the winner's secret — supervisor reuse logic depends on this.

## §34. Session Authentication

All routes except `/health` require header X-SquidFS-Auth equal to the session secret (48 hex chars, randomBytes(24)). The health route intentionally leaks nothing but liveness/version/port and exists solely for supervisor reuse decisions. Cross-origin exposure is blunted three ways: loopback bind, absence of any CORS reflection, and the requirement of a custom header (which browser cross-site requests cannot attach without a preflight the server never satisfies).

## §35. File Route Pipeline

`GET /file/<id>` where `<id>` matches a permissive single-segment-plus-slashes pattern (Cloudbliss identifiers are UUIDs today; the pattern deliberately tolerates slash-bearing historical path-ids after the incident in PM-03, decoding URI escapes before use):

1. Re-read credential instruments from disk (**live re-read doctrine**: re-login takes effect on the next request without daemon restart — the fix for the stale-key 401 class, PM-04).
2. Signed download against platform `/api/v1/download/<id>?signed=true` → manifest containing signed_urls[], file name/type/size, encryption_key or placeholder, user_id.
3. If the manifest key is a placeholder/fingerprint (managed_key, sha256:* prefix family, byok_* family — detection by exact-match regex list), fetch the real key from `file-key` with bearer+anon headers.
4. Fetch chunks concurrently (eight workers, indices pulled from a shared counter), each through retry×3 with backoff 400ms·attempt.
5. Strip envelopes via §21 negotiation passing userId/fileId/index/total context for v3 AAD.
6. Concatenate in index order; respond with content-type, length, and filename header.

Error semantics: upstream "file not found" maps to HTTP 404 (not 502) precisely so the engine can translate to ErrNotExist and serve clean WebDAV 404s rather than falling back to ciphertext-refetch paths (PM-04 fix); other failures are 502 with JSON error body.

In-flight de-duplication: identical file ids share a promise, preventing thundering-herd on directory listings that stat many files simultaneously.

## §36. Dashboard Presence

At listen, the daemon registers presence by minting (or reusing) a dashboard API key named with the structured convention HOST|<hostId>|<hostname>|6763|decryptor|DECRYPTOR where hostId is sha256(hostname‖":6763") truncated to sixteen hex chars, scopes ['*'] — a deliberate visibility artifact so Settings→Developer→CLI Devices shows a live violet card with heartbeat. Heartbeat = periodic whoami under the minted key. On SIGINT/SIGTERM the card is suffixed :OFFLINE. Doctrine note: the wildcard scope here is a known, accepted trade-off (visibility value vs least-privilege); flagged in Annex D as candidate for scope-narrowing when the dashboard grows key-scoped rendering.

## §37. Supervisor Contract

The supervisor (inside CLI) implements ensureDecryptor: read state → health-probe 6763 → if healthy and pid alive per state, reuse (return existing secret); if healthy but owner unknown/stale, terminate owner, wait 400ms, spawn fresh; if unhealthy-but-pid-alive (zombie), same replacement path. Spawn is detached with stdio discarded; readiness waits up to eight seconds polling health at 250ms; final state-file read must yield the secret or the operation throws (fail-closed before SquidFS launch).

\newpage

# PART IX — SQUIDFS ENGINE INTERNALS

## §38. Binary Provenance Order

Engine acquisition follows strict precedence: environment override path → build-from-local-source (if a Go module checkout exists in home; built with trimpath/stripped symbols, CGO disabled, output to universal location, marked executable) → cached universal binary → PATH copy → official release download **with mandatory checksum verification** against the release's checksums.txt (sha256 match else hard refusal with explicit tamper message; absent checksums.txt yields a loud skip-warning, not silent trust). This order exists because the local-build path once masked a newer engine behind a stale cached binary (PM-01) — precedence was inverted deliberately so source-truth wins.

## §39. Server Composition

The engine embeds a standards-compliant WebDAV handler (filesystem interface backed by cloud semantics, in-memory lock system, prefixed routing) wrapped in a custom outer handler that intercepts GET/HEAD for content proxying and PROPFIND for XML framing, plus the authentication gate (§X) and error-stripping writer that prevents internal messages leaking into DAV responses.

State held in memory: name→id maps, path→file metadata, path→folder metadata, listing caches keyed by directory path with timestamps (TTL fifteen seconds) — the listing cache is why repeated directory views are fast and why external mutations take up to TTL to appear.

## §40. Path Resolution Semantics

Resolution splits the WebDAV path on first segment (host/folder namespace) then delegates to listing-by-name bridge calls. `statFor` consults fileInfo first; on miss lists the parent (populating caches) and retries; persistent miss ⇒ os.ErrNotExist ⇒ DAV 404. This is the gate that keeps phantom probes (e.g., favicon.ico, untitled.txt) cheap — they resolve to not-exist without touching the decryptor, unless a genuine object shares the probe name (in which case normal serving applies).

OpenFile branches: write-intent on root creates staging file objects flagged new; read paths construct file handles whose Read() pulls whole-content bytes via the download path (below) — the engine is a *whole-object* server at heart; ranges are arithmetic slices of fetched plaintext, not partial-chunk streaming, except where the lazy-range optimization applies to res54 manifests (chunk-aligned reads avoid pulling the full object when Range headers permit).

## §41. Content Path Doctrine

All remote encrypted files proxy through downloadFileBytes regardless of storage-path flavor — the earlier conditional (res54-only proxying) produced the infamous zero-byte GET class (PM-03b): objects whose storage flavor differed hit a stub branch returning empty bodies with HTTP 200. Post-fix invariant: **any resolvable file either serves decrypted bytes or fails loudly; empty-success is impossible.**

fetchDecrypted order: decryptor first (GET /file/id with session header; status<300 ⇒ bytes; 404 ⇒ propagate not-exist; any other HTTP ⇒ no fallback, return engine error — rationale: the decryptor is authoritative for crypto, and platform fallback would refetch ciphertext with a possibly-stale token producing misleading 401s, PM-04); only transport-level failure (daemon unreachable) falls back to platform REST download using the engine's api token.

Caching: successful plaintext results populate a chunk-cache layer keyed by file id + offset-zero marker, bounded 500MB, honoring TTL — repeated media plays do not re-hit the decryptor.

Range handling: byte-range parser accepting suffix form and first-range-of-many; satisfied ranges emit 206 with Content-Range; unsatisfiable/absent ⇒ 200 full body. Accept-Ranges advertised for res54-flavored objects.

## §42. Upload Path

Write-intent handles buffer locally, then negotiate upload URLs through the bridge, PUT chunks to signed targets, and finalize via complete action which verifies each chunk (HEAD existence) before registering the file record with res54 metadata tags. Renames/moves/deletes translate to bridge verbs keyed by resolved ids; deletions are soft (is_deleted flag) with restore verb available platform-side.

## §43. mDNS and Advertisement Policy

Advertisement is opt-in (flag-gated), auto-suppressed for loopback binds, and registers the conventional service type with TXT records carrying path/version/port. Default-off doctrine follows TH-02: a loopback daemon gains nothing from announcement and a LAN-exposed one should advertise only under explicit operator intent.

\newpage

# PART X — WEBDAV AUTHENTICATION AND EXPOSURE DOCTRINE

## §44. The Password Verifier Format

The WebDAV gate authenticates HTTP Basic credentials against a PBKDF2-SHA256 verifier stored as a single line in a 0600 file:

`pbkdf2$sha256$<iterations>$<salt-base64>$<hash-base64>`

Parameters: salt 16 random bytes; output 32 bytes; iterations fixed at 210,000 on the CLI minting side; Go-side parser rejects iteration counts below 10,000 (anti-downgrade). Verification recomputes PBKDF2 over the presented password with the file's salt/iterations and compares via constant-time primitive. Username is accepted but ignored — single-tenant semantics: **the password is the secret, not the username.**

Plaintext password custody: generated passwords (twenty characters from an unambiguous alphabet — digits sans 0/1, uppercase/lowercase sans confusables, limited symbol set) are displayed exactly once and persisted into the secret store tier; operator-supplied passwords follow the same custody. The engine child receives only the hash-file path via environment.

## §45. Bind Doctrine

Default bind is loopback for every listener in the system. A non-loopback bind is *permitted only* when a verifier file is present; startup otherwise aborts with the refusal message before opening the socket (defense at process start, not request time). This implements TH-02 structurally: misconfiguration cannot silently publish decrypted files.

Loopback binds may run auth-free only through explicit opt-out flag; default behavior auto-provisions a generated password on first mount/webdav invocation. The banner prints the effective exposure line so operators always see current posture.

## §46. Method Coverage Invariant

The authentication gate wraps the entire outer handler — GET/HEAD custom path, PROPFIND framing, and the pass-through DAV handler (PUT/MKCOL/COPY/MOVE/DELETE/PROPPATCH/LOCK) alike. The historical vulnerability class (unauthenticated full read proven by live exploit during audit) closed precisely because the gate sits *outside* method dispatch, not inside individual verbs. Regression rule: no future verb may bypass the outer wrapper.

## §47. Range and Cache Interplay

Authenticated range requests traverse the same decryptor/cache pipeline; cached plaintext serves 206s without re-decryption. Cache poisoning is bounded by single-user semantics of the daemon; multi-user endpoint scenarios are out of model (§3).

\newpage

# PART XI — HOST API SERVER AND MICROREDIS

## §48. Host API Purpose

The host API mirrors platform file operations onto loopback REST for local tooling: same numbered-reference ergonomics as the CLI (`#n`, id-prefix, name matching), same res54 transfer engine, zero platform rate-limit interference. It composes three subsystems: security layer (profiles), route table, micro-redis backing.

## §49. Security Profiles

| Profile | requireKey | requireHmac | requireTimestamp | Body cap | rps/key (burst) | Nonce TTL |
|---|---|---|---|---|---|---|
| standard | no | no | no | 512MB | 50 (100) | 60s |
| hardened | yes | no | yes | 512MB | 120 (240) | 300s |
| paranoid | yes | yes | yes | 64MB | 200 (400) | 600s |

Mode override: open forces keyless (loopback posture), keyed forces key requirement. Overrides additionally accept per-key rps, body cap string (512mb style), and IP allowlist replacement. Default allowlist is loopback v4+v6; non-loopback entries demand explicit operator intent. HMAC mode requires per-request signature over body with timestamp and nonce replay protection (nonce cache TTL from profile).

Authentication resolution order: bearer cb_ key digest match against redis-stored key hashes → anonymous passage only when profile permits. Denials are audited with reason codes; successes log route/key/duration.

## §50. Route Surface (Normative)

| Method & Path | Semantics |
|---|---|
| GET /health | Liveness; profile echo; redis stats |
| GET /v1/files?search= | Listing incl. numbered refs |
| GET /v1/files/:ref | Metadata; ref = #n ‖ id-prefix ‖ exact-name |
| POST /v1/files/:ref/rename | Body name field; rename translation |
| DELETE /v1/files/:ref | Soft delete to trash |
| POST /v1/upload?filename= | Raw-body ingest through res54 pipeline |
| GET /v1/download/:ref | Decrypted plaintext stream |
| POST /v1/share | Share creation (file ref or folder), optional expiry/max-downloads/view-only |
| GET /v1/secrets | Secret inventory (names/presence, not values) |
| POST /v1/exec | Ops: whoami ‖ storage.search ‖ stats |

Ref-resolution precedence is deterministic and documented to operators: `#n` wins over id-prefix over name; ambiguity in name matching resolves to most-recent-created.

## §51. MicroRedis Internals

A purpose-built RESP-02-compatible in-memory store: inline and array command framing, PING/GET/SET/INCR/TTL/KEYS/DEL family, integer counters with atomic increments, key-expiry wheel via monotonic timestamps. Role: rate-limit buckets (fixed-window counters keyed by key-prefix+window-index), nonce replay cache, HMAC secret storage (value never leaves server), health stats source.

Transport hardening (PM-08): every accepted socket carries an error handler; resets/pipes destroy silently; unusual socket errors log one line. The HTTP layer mirrors with clientError handling; the daemon entry installs an uncaughtException filter that swallows transport resets and performs orderly shutdown otherwise. Doctrine: a local daemon must degrade under hostile traffic, never die from it.

## §52. Audit Pipeline

Append-only lines to host-audit.log: ISO timestamp, verdict (OK/DENY/ERR), route or op, key identity when authenticated, duration for OK, denial reason and peer address for DENY. The stream is fire-and-forget write; durability expectation is best-effort (crash may lose tail). Operators triaging incidents should correlate audit lines against decryptor console lines and platform audit tables.

\newpage

# PART XII — STORAGE SUBSTRATE AND BRIDGE PROTOCOL

## §53. Bucket Pool Dispatch

Upload negotiation returns per-chunk targets across a bucket pool (cluster abstraction: bucket + optional cluster id). Paths embed owner user id, an upload session uuid, and index — path uniqueness prevents cross-tenant collision even before authorization. Signed URL minting is cluster-aware; download resolution accepts manifest chunk records carrying repo/bucket/clusterId and returns time-boxed URLs.

Doctrine: clients never possess substrate credentials; every byte movement crosses a short-lived signed URL whose capability is exactly put-one-object or get-one-object.

## §54. Upload Session State Machine

init (POST /upload or legacy files/upload/init): validates name/size, generates file+upload ids and encryption key, computes chunk count from size-tiered chunk sizes (512KB base; 1MB >10MB; 2MB >50MB), persists upload_sessions row (key included), returns signed PUT urls. complete: verifies each chunk exists (HEAD via signed URL), registers files row (res54 flavor; metadata JSON serialized into tags[0] containing fileId/chunkSize/chunks[]/encryptionKey/created/previewAvailable), deletes session row. Encrypted-server variant (/upload/encrypted) accepts plaintext chunks server-side, envelopes them (v2 canonical format) and stores — used where clients cannot perform client-side crypto.

## §55. Bridge Action Grammar

squidfs-bridge speaks action-dispatched JSON:

| action | params | notes |
|---|---|---|
| list | folder_id (name-form) | Returns folders[]+files[] with ids, names, encryption_key fingerprints, sizes |
| file_meta | file_id | Single record fetch |
| create_folder | name, parent_folder | Name-form parentage (host/folder namespace) |
| delete/rename/move | file_id (+args) | Translated to platform mutations |
| file_key | file_id | Key retrieval path used historically by engine |

Auth: anon key header plus user bearer; the embedded anon constant inside engine sources is public-by-design (gateway passage), not a credential. Listing responses feed the engine's caches directly; ids returned are authoritative UUIDs (path-style identifiers were a legacy artifact addressed in PM-03).

## §56. Platform REST Surface Exercised by Clients

Endpoints of operational relevance: /files (paged listing, search, folder filter), /files/:id/metadata, /download/:id (?signed=true for manifests+keys, else server-side decrypt streaming), /files/:id/download variants, /upload family, /folders, /shares, /keys (mint/list/revoke), /user/whoami, trash restore/rename/move/copy verbs. Download handler contract details that matter to client authors: workspace-scoped query plus is_deleted check precede any bytes; BYOK detection triggers 422 demanding key parameter; signed responses include signed_urls[], chunk_buckets, name/type/size, encryption_key (real key when held), user_id (required by v3 AAD); server-side decrypt path aggregates chunks and streams combined plaintext.

\newpage

# PART XIII — PROVISIONING, DISTRIBUTION, AND SUPPLY-CHAIN CONTROLS

## §57. Release Engineering Norms

Engine releases are tagged vX.Y.Z with six platform artifacts (linux/darwin × amd64/arm64, windows × amd64/arm64) built with CGO disabled, trimpath, stripped symbol tables — producing deterministic-ish static binaries that run on glibc-less and musl hosts alike. checksums.txt (sha256) accompanies every release and is itself an asset of record. Release notes must enumerate security-relevant deltas; the hardening releases (v2.3.x–v2.4.0) set the precedent.

CLI distribution is npm; version bumps are mandatory per functional delta (the ledger shows 3.0.13→3.1.3 within one hardening cycle — each increment maps to a user-visible fix or doctrine change). Post-install on exotic platforms requires the two-step shim discipline: entry shebang rewritten to the platform node path, bin links as symlinks into the package tree (ESM resolution walks the real path; copies break module lookup — recorded in PM-02).

## §58. Acquisition Precedence (Restated as Policy)

1. Explicit environment override.
2. Local source build when a Go checkout exists — **source truth wins**; output overwrites the universal cache so staleness cannot persist (PM-01).
3. Cached universal binary (executable-probe).
4. PATH discovery under any local name.
5. Release download + **checksum enforcement**; missing checksum file ⇒ loud warning; mismatch ⇒ hard refusal with tamper messaging.

No other acquisition path may be added without a supply-chain review note in this document.

## §59. Integrity Failure Handling

Checksum mismatch is treated as attempted compromise, not transient error: refusal message names expected/got digest prefixes, instructs manual re-acquisition or override, and never falls through to execution. Operators encountering mismatches should preserve the downloaded artifact for analysis and treat the distribution channel as suspect until provenance is confirmed.

\newpage

# PART XIV — DASHBOARD INTEGRATION SURFACE

## §60. CLI Devices Registry View

Settings → Developer → CLI devices renders every cli_devices row for the account: device name/platform, status lifecycle (pending/authorized/active/revoked/expired), last-used, and — post-hardening — AAL2 attestation recency where present. Revocation here propagates to token_hash invalidation at next resolve.

The DECRYPTOR presence card renders from the structured key-name convention (§36) as a violet instrument card with live heartbeat; :OFFLINE suffix denotes graceful daemon shutdown. Parsing rule: pipe-delimited fields HOST|<hostId>|<hostname>|<port>|<role>|<label>.

## §61. CliAuthorize Consent Surface

The device-approval page implements the human side of §9: session check → AAL2 evaluation via getAuthenticatorAssuranceLevel → if below AAL2 with enrolled factors, inline MfaChallengeScreen intercepts; approval posts redirect_uri/state binding to cli-oauth/authorize. Unenrolled accounts may approve here (the CLI poll will still refuse issuance — defense in depth across surfaces).

## §62. Security Center Coupling

Enrollment/unenrollment flows live in the dashboard's security center; the CLI references it by canonical URL in every enforcement message. Doctrine: CLI never enrolls or unenrolls factors itself — factor custody remains web-session-bound, keeping the TOTP secret off the endpoint entirely.

\newpage

# PART XV — OPERATIONAL PROCEDURES

## §63. Standard Operator Runbook

**Login.** Invoke login (device flow default). Browser consent (AAL2-gated). Poll completes; TOTP prompt appears; enter authenticator code. Expected banner sequence: authorized-as line, two-factor verified line, credentials-saved line. Headless variant: complete once interactively to seed attestation; thereafter export passphrase env for vault unlock; privileged commands still demand fresh codes interactively.

**Mount/WebDAV.** Invoke fs mount (webdav default). Expect: engine build-or-reuse line, installed line, WebDAV banner with loopback URL, decryptor-ready line with pid, engine startup lines (bridge URL, decryptor URL, mDNS only if enabled), password banner if freshly generated. Verify posture: loopback bind line present; password-enabled line present unless explicitly opted out. Stop with Ctrl+C or stop directive.

**Host API.** Invoke host api with profile/mode flags as required. Expect liveness banner enumerating routes, redis port (=api+1), limits echo, audit path. Smoke: health route returns profile+stats. Stop via stop directive or SIGINT.

**Keys.** Minting lists via keys subcommands are gated (keys add/rm); listing-only commands remain ungated. Every minted raw key displays once — custody transfers to operator immediately.

## §64. Troubleshooting Matrix

| Symptom | First hypothesis | Confirmatory probe | Remedy |
|---|---|---|---|
| Mount aborts "decryptor failed to start" | 6763 held by zombie | Health curl 6763; state-file pid alive? | Kill stale pid; rerun |
| GET yields 401 on WebDAV | Password gate active | Check hash file exists / password from store | Supply Basic creds; or regenerate |
| Downloads zero bytes | Engine older than PM-03b fix | Banner lacks decryptor URL line | Update CLI; rebuild engine |
| "Invalid verification code" repeatedly | Clock skew >90s or wrong factor | Compare device clock to NTP | Sync clock; verify correct factor selected |
| KZA_DEVICE_BANNED | Brute threshold tripped | Attempt count events ≥3 in window | Admin unban; investigate cause first |
| F2FA code invalid on correct TOTP | Seed/window encoder divergence | Compare client/server encoders (PM-07) | Upgrade both to ratified encoder |
| ECONNRESET kills api server | Pre-3.1.3 binary | Version line | Upgrade; guards verified in 3.1.3 |
| randomUUID undefined at login | Broken install shim | Module import smoke | Reinstall latest |
| 401 INVALID_API_KEY on fallback | Stale engine api token vs re-login | Decryptor unreachable? | Restart mount (supervisor reuses daemon with live creds) |
| Listing stale after external change | 15s TTL cache | Wait TTL or force refresh flag | Use refresh option |

## §65. Clean-State Procedure

Full local teardown: stop directives for host/fs; terminate decryptor via state pid; remove secret slots (all tiers) and metadata file; retain device-id ONLY if same-machine re-enrollment intended (retention keeps machine-ban linkage coherent; deletion creates a new fingerprint — operators must not delete it to evade bans, which is an audit-visible evasion pattern).

\newpage

# PART XVI — POST-MORTEM ANNEX (INCIDENT REGISTER)

Format per entry: identifier; class; discovery context; mechanism; corrective actions; doctrinal residue. These are the canonical war stories; future engineers must internalize them because each encodes a class of defect, not a one-off.

## PM-01 — Stale Binary Masquerade

Class: provisioning precedence inversion. Discovery: mount sessions logged no decryptor line and downloads 404'd despite decryptor code existing in source. Mechanism: universal cached binary predated decryptor support; acquisition checked cache before local build, so the stale artifact always won. Corrections: precedence reordered to source-first with overwrite semantics; banner prints build provenance. Residue: §58 order is normative; never reorder without re-reading this entry.

## PM-02 — ESM Resolution and Platform Shims

Class: packaging/runtime divergence, two sub-incidents. (a) Supervisor script materialized into a directory outside the package tree; ESM import resolution walks upward from script location only, environment search paths are ignored for module graphs — native crypto imports failed at spawn though the same script worked when hand-run from inside the package. Correction: materialize into the package's module cache subtree. (b) Termux-class platforms lack the conventional env interpreter path; global bin shims required platform-node shebang rewrite plus symlink-not-copy linking so real-path resolution reaches sibling modules; a stray unpatch reverted a shebang producing bad-interpreter launch failures. Residue: shim doctrine lives in §57; any packager change must re-verify on the exotic platform before release.

## PM-03 — Identifier Shape and the Phantom-Name Class

Class: contract drift between components. Sub(a): decryptor route pattern accepted only slash-free ids; historical path-style identifiers (host/filename) returned route-miss 404s which the engine then treated as fallback-worthy, compounding confusion. Correction: permissive single-capture pattern with URI decoding + explicit not-found mapping (404 vs 502 split). Sub(b): GET handler branched on storage flavor; non-res54 flavors fell through to an empty-body success path — live exploit showed HTTP 200 with zero bytes for a real document. Correction: unconditional proxy-through doctrine (§41 invariant). Sub(c): benign probes (favicon.ico / untitled.txt) generated recurring not-exist noise every five seconds from an external poller — diagnosed via method+path error logging; classified benign; logging improvement retained permanently.

## PM-04 — The Stale-Key 401 Cascade

Class: credential lifecycle across process boundaries. Discovery: after account re-login, engine downloads degraded to 401 INVALID_API_KEY while web access remained fine. Mechanism chain: daemon and engine loaded instruments once at startup; re-login rewrote files but running processes retained old bearers; decryptor failure triggered engine platform-fallback carrying its own stale token ⇒ misleading auth errors far from the true cause. Corrections: decryptor performs live credential re-read per file request; engine restricts fallback to transport-unreachable conditions and maps upstream not-found to clean 404; supervisor reuse logic now tolerates secret continuity across CLI generations. Residue: any new long-lived process must adopt the live-re-read doctrine at design time.

## PM-05 — Gateway JWT Precheck Swallowing Dispatch

Class: deployment configuration. Symptom: new attestation function answered UNAUTHORIZED_INVALID_JWT_FORMAT for valid opaque tokens. Mechanism: platform gateway validates Authorization as JWT before function dispatch unless the function is flagged otherwise; opaque-token functions must deploy with verification disabled and self-authenticate. Residue: deployment checklist item; signature symptom recorded in §VII.

## PM-06 — Schema Drift Between Repo Migrations and Live Registry

Class: infrastructure state divergence. Live registry lacked columns present in repo migrations (operation allowlist), and seed table enforced NOT NULL day/session columns absent from first-pass inserts — both surfaced as migration/insert failures during hardening rollout. Corrections: introspect-before-write discipline; inserts populate all mandated columns; migration files amended to match reality. Residue: Annex D records the schema assumptions the stack now depends on.

## PM-07 — The F2FA Window Encoder Divergence (Flagship Defect)

Class: cryptographic wire-format bug with silent-failure profile. Mechanism: encoder used arithmetic-shift window byte extraction; JS shifts are int32 so high bytes wrapped, repeating low four bytes — server and any correct client disagreed; because the F2FA layer was dormant until the TOTP rollout, zero traffic exercised it; first real user exercise produced "gateway rejected step-up (F2FA code invalid)" immediately after successful human verification, then brute-lockout on the third attempt due to retry amplification doubling failure events. Diagnosis path preserved here because it generalizes: (1) extract deployed client function verbatim and execute against gateway → reproduced; (2) diff implementations across windows → wholesale mismatch, not sign noise; (3) compare raw combined buffers byte-wise → divergence localized to high window bytes; (4) root cause int32 shift wrap. Corrections: ratified modulo/division encoder on both ends; single-attempt exchange policy; exact signed-arithmetic mirror documented (§25) including the negative-code rendering quirk. Residue: **never "simplify" the encoder**; add cross-vector test vectors whenever either side changes.

## PM-08 — Transport Reset Daemon Death

Class: resilience. One probe RST mid-response on micro-redis killed the entire host api via unhandled socket error event. Corrections: three-layer guards (socket handlers, HTTP clientError, daemon-level uncaughtException filter); verified by adversarial connect/RST harness followed by healthy-client liveness. Residue: §51 doctrine sentence.

## PM-09 — Login Crash via Removed Import

Class: refactor hygiene. Persistent-machine-id refactor deleted a crypto import still referenced by OAuth state generation; login crashed at runtime post-publish. Correction: restore import; smoke-import gate adopted for command modules before publish. Residue: publish checklist includes module-load smoke for touched commands.

## PM-10 — Zero-Length Attestation Shelf-Life Ambiguity

Class: cache semantics. Local PREL shelf-life derivation from token payload shape proved fragile; corrected to store explicit expiry alongside seed/token in the secret tier with conservative clamp to lease TTL. Residue: attestation triple (seed, prel, exp) is the canonical stored shape.

\newpage

# PART XVII — VERIFICATION AND ASSURANCE MATRICES

## §66. Security Control Verification Ledger

| Control | Verification performed | Result epoch | Re-verify trigger |
|---|---|---|---|
| WebDAV auth gate | No-cred GET ⇒ 401; wrong-cred ⇒ 401; correct ⇒ 200 full plaintext | Hardening cycle | Any handler refactor |
| Loopback default | Listener address inspection; external interface connect refused | Hardening cycle | Bind flag changes |
| Fail-closed remote bind | Non-loopback start without verifier aborts pre-listen | Hardening cycle | Startup path edits |
| Privileged gate (non-interactive) | Gated command exits 1 with enrollment messaging | Hardening cycle | Guard module edits |
| cli-totp wrong-code accounting | Countdown decrement observed; ban threshold honored | Hardening cycle | Verify-path edits |
| Device-ban scoping | Ban rows typed DEVICE/MACHINE; account untouched | Hardening cycle | Ban pipeline edits |
| Poll-time mandatory TOTP | Unenrolled issuance refused w/ TOTP_REQUIRED | Hardening cycle | Poll handler edits |
| KZA end-to-end lease | Opaque token+seed ⇒ PREL issued; negative codes accepted symmetrically | Post PM-07 fix | Either encoder change |
| Checksum enforcement | Mismatch refusal message path unit-exercised | Hardening cycle | Acquisition edits |
| Secret tier fallback | Keyring-absent host warns and selects Tier III; metadata carries no secrets | Hardening cycle | Store edits |
| RST resilience | Adversarial connect/RST then healthy PONG | 3.1.3 | Transport edits |

## §67. Functional Regression Vectors

Canonical happy paths that must survive every release: fresh-login full sequence incl. attestation; mount→list→range-download→PUT→GET roundtrip identity; api-server boot→health→authored download→abusive-RST survival; stop directives terminate cleanly writing session teardown; logout removes secrets across tiers.

\newpage

# PART XVIII — DECISION REGISTER AND OPEN ITEMS

## §68. Ratified Decisions (Abridged Register)

| id | Decision | Rationale in one line |
|---|---|---|
| D-01 | Decryptor holds sole plaintext authority | Single audited chokepoint beats distributed crypto |
| D-02 | Opaque tokens hashed server-side | Dump-resistant bearer model |
| D-03 | TOTP secrets never touch endpoint | Factor custody stays web-bound |
| D-04 | Device-scoped bans | Punish instruments, spare persons |
| D-05 | Negative F2FA renderings legal | Signed XOR accumulation is canonical; changing breaks both sides |
| D-06 | Whole-object proxy over lazy streaming (default) | Simplicity; range optimization remains for chunk-aligned reads |
| D-07 | mDNS opt-in only | Announcement ≠ default posture |
| D-08 | Wildcard dashboard presence key | Visibility value outweighs scope purity today |
| D-09 | Vault passphrase min length 8 | Usability floor for Tier II headless hosts |
| D-10 | Engine child receives hash-file path, never password plaintext | Minimize env-secret surface |

## §69. Open Items (Tracked, Not Scheduled)

OI-1: Narrow decryptor presence-key scopes when dashboard supports scoped rendering. OI-2: Chunk-aligned lazy range reads for large media beyond current whole-object fast path. OI-3: Formal test vectors for F2FA/F2FA-encoder published into repo fixtures to prevent PM-07 recurrence class. OI-4: Audit-line durability upgrade (fsync policy decision). OI-5: Windows service-wrapper story for daemons. OI-6: Consider per-operation PREL tokens if lease-sharing abuse emerges.

\newpage

# ANNEX B — CLI COMMAND REFERENCE (NORMATIVE)

Organization: single-purpose top-level commands first, then two-part families. For each: purpose, authentication class (P=public, A=authenticated non-privileged, G=privileged/TOTP-gated), notable flags, behavioral contract, failure modes. Flags marked † imply secret handling.

## B.1 Identity Family

**login** (P→A/G). Default child: oauth browser flow; explicit code flag selects pure device-code entry. Behavioral contract: persistent machine id minted on first run; legacy plaintext secrets migrated opportunistically; poll loop honors interval/slow-down/expiry; post-issuance mandatory attestation per §11; clean process exit with socket teardown. Failure modes: TOTP_REQUIRED (unenrolled), consent declined (pending until expiry), network interruption (retry till expiry), vault passphrase rejection.

**logout** (A). Removes metadata and all secret slots across tiers; does not touch server-side rows except nothing — server revocation is a separate dashboard action by design (local logout ≠ global revoke). Idempotent.

**whoami** (A). Resolves identity via platform whoami under current token; prints email, plan markers, token prefix, expiry horizon. Used as canonical liveness probe in scripts.

## B.2 Files Family

**files ls** (A). Paged listing with optional search substring and folder filter; local listing cache consulted unless refresh flag supplied; output includes numbered references (#n) assigned in stable order for downstream ref usage. Failure: auth expiry prompts re-login path in interactive sessions.

**files up** (A). Streaming upload: negotiates chunk plan, reads stdin/file argument, encrypts client-side into ratified envelope generation, PUTs chunks to signed targets concurrently, finalizes session. Quiet flag suppresses progress instrumentation. Failure semantics: partial uploads leave session rows reaper-collectable; retry-safe by design.

**files rm / mv / cp / rename** (A). Thin translations to platform verbs using ref resolution identical to host api precedence (#n > id-prefix > name). Destructive rm is soft-delete only.

**files share** (A). Creates share link with optional expiry, download cap, view-only restriction; prints public URL. Shares are platform-resident; revocation managed web-side.

**files dl** (A). Download to file/stdout through decryptor-or-platform path identical to engine content pipeline; honors existing daemon when reachable.

## B.3 Storage Family

**storage ls/rm/search** (A except rm=G). Search executes platform-side indexed query returning ref-numbered results consumable by other commands. **rm is privileged**: requires live attestation; performs soft delete; audit line emitted locally regardless.

## B.4 Keys Family

**keys add** (G). Mints platform key; raw displayed once; prefix persisted to metadata for identification; name defaults to date-stamped instrument tag. **keys rm** (G) revokes by id/prefix match. **keys ls** (A) lists metadata only — raw values are unrecoverable by design after mint.

## B.5 FS Family

**fs mount** (G). Full sequence per §63; flags: mount target, force-webdav, port, password†, no-password opt-out, bind override, mdns enable. Contract: fail-closed ordering = binary acquisition → key negotiation → decryptor ensure → webdav verifier provision → engine spawn with composed environment → session record. Any prior stage failure aborts before spawn.

**fs webdav** (G). Alias surface of mount forcing webdav mode; identical flags.

**fs status** (A). Reads session pidfile; liveness-probes pid; reports mode/port/mount/uptime; stale detection cleans pidfile.

**fs stop** (A). SIGTERM to recorded pid; awaits exit; pidfile removed; decryptor intentionally left running (reuse doctrine) — explicit decryptor termination is an operator decision documented in §65.

## B.6 Host Family

**host api** (G). Boots profile-configured listener set (api port, redis port+1); seeds bootstrap keys in keyed mode (displayed once); installs audit stream; installs transport guards (PM-08). Flags: ports, profile selector, mode open/keyed, extra key minting, hmac secret†, rps/body-cap/IP overrides.

**host status / host stop** (A). Symmetric with fs family against host pidfile; status includes redis stats passthrough.

## B.7 Utility Surface

**util version / doctor** (P/A). Version banner includes runtime triple. Doctor (A): environment sanity sweep — config dir modes, secret tier probe result, daemon reachability, engine provenance line, clock skew hint. Doctor is the first triage step before any Annex E matrix row.

\newpage

# ANNEX C — ERROR CODE AND MESSAGE CATALOG

Authoritative strings as emitted by current builds; triage must match exactly (fuzzy matching has historically delayed diagnosis).

## C.1 CLI-Totp Domain

| Code / message | Producer state | Operator action |
|---|---|---|
| TOTP_REQUIRED | Poll-time gate; account unenrolled | Enroll at settings URL; rerun login |
| KZA_DEVICE_BANNED | Ban entity active for device/machine | Admin unban after cause review |
| Invalid verification code. N attempts left… | Failed verify, pre-threshold | Re-enter carefully; mind clock |
| Too many failed codes — device banned | Threshold crossed at this call | As banned row above |
| Server configuration error | Factor lookup infrastructure fault | Escalate infra; do not retry-spam |

## C.2 KZA Gateway Domain

| Code | Meaning |
|---|---|
| KZA_PREL_MISSING | No lease presented to validator |
| KZA_PREL_INVALID_SIG | Signature verify failure (tamper/version skew) |
| KZA_PREL_EXPIRED | Lease window elapsed |
| KZA_PREL_F2FA_MISSING | F2FA required but header absent |
| KZA_PREL_F2FA_FAILED | Seed/window mismatch (see PM-07 checklist) |
| KZA_PREL_F2FA_BRUTE | ≥3 failures/5min — cooling enforced |
| KZA_PREL_UNREGISTERED | Function id absent/inactive in registry |
| KZA_PREL_OPERATION_DENIED | Op outside allowlist |
| KZA_PREL_UNAUTHORIZED_CALLER | Caller function not in allowed_callers |
| KZA_PREL_BINDING | IP‖UA fingerprint drift |
| KZA_PREL_CIP_FAILED | Client-integrity score rejected |

## C.3 Engine / Transport Domain

| Signal | Meaning |
|---|---|
| HTTP 401 INVALID_API_KEY from fallback | Stale bearer in fallback leg — see PM-04 |
| decryptor: HTTP 404 | Upstream not-found surfaced cleanly |
| decryptor unreachable — falling back | Daemon down; supervisor should be engaged |
| refusing to bind non-loopback without --auth-hash | Structural refusal (§45) |
| WebDAV error: <method> <path>: file does not exist | Benign probe noise (PM-03c) unless path is user data |
| write ECONNRESET (microredis/host) | Pre-3.1.3 build lacking guards — upgrade |

## C.4 Login/Install Domain

| Signal | Meaning |
|---|---|
| randomUUID is not defined | Broken shim/import — reinstall latest (PM-09) |
| bad interpreter: env no such file | Shim shebang unpatched for platform (PM-02b) |
| __dirname is not defined in ES module scope | Pre-fix artifact artifact of embedded script placement (PM-02a) |
| Device code expired | Restart login |
| vault passphrase required | Headless unlock needs env passphrase |

\newpage

# ANNEX C2 — ENVIRONMENT AND CONFIGURATION REGISTER

| Variable | Consumer | Effect |
|---|---|---|
| SQUIDCLOUD_API_KEY | Engine child; host api | Storage cb_ instrument; bypasses minting |
| SQUIDCLOUD_AUTH_TOKEN | Engine child | Legacy bearer alias used by fallback legs |
| SQUIDCLOUD_DECRYPTOR / _AUTH | Engine child | Daemon URL + session secret wiring |
| SQUIDCLOUD_WEBDAV_AUTH_HASH | Engine child | Verifier-file path enabling Basic gate |
| SQUIDFS_BIN | CLI provisioning | Explicit binary override (precedence 1) |
| SQUIDCLOUD_VAULT_PASSPHRASE | Secret store | Headless vault unlock/create |
| SQUIDCLOUD_NONINTERACTIVE | Guard/login UX | Forces fail-closed prompts to exits |
| SQUIDCLOUD_DECRYPTOR_PORT | Decryptor | Port override (undocumented-on-purpose) |
| SQUIDCLOUD_API_BASE / SUPABASE_URL variants | Tests/staging | Control-plane redirection |
| KZA_PREL_ENABLED | kza-prel | Emergency gateway disable (anonymous passage) — incident-only lever |

Registry of forbidden practice: none of the above may carry values across trust domains in logs; audit scrubber treats their names as redact-triggers.

\newpage

# ANNEX D — SCHEMA AND WIRE-FORMAT DEPENDENCY REGISTER

This annex records the live-database shape the stack depends upon as of revision 1.0. Any migration touching these tables requires re-verification of the listed consumers.

## D.1 cli_devices (identity substrate)

Columns consumed: id (device ban value), user_id, machine_id (permanent fingerprint source), token_hash (opaque resolution), status lifecycle, is_banned, expires_at/authorized_at, aal2_verified_at (attestation recency). Consumers: cli-oauth (register/poll/token/revoke/ban), cli-totp (resolve+stamp), kza-prel gateway identity branch, file-key resolver, dashboard devices view.

## D.2 kza_prel_registry

Columns consumed: function_id PK; required_auth_level enum {jwt, api_key, hmac, hmac_gateway, hmac_jwt, prel_only, none, any}; required_min_role nullable; f2fa_required; cip_required; chain_depth_limit; rate_limit_rps/burst; allowed_callers[]; allowed_operations[] (added during hardening — verify exists pre-deploy); ttl_seconds; long_op_ttl_seconds; geo flags; veil_no_log; is_active. Notable row: cli-guard per §26.

## D.3 kza_prel_f2fa_seeds

Mandated non-null: day_seed, session_nonce (both discovered by insertion failure — PM-06). Consumed: seed_derived (the secret), function_id scoping, is_active single-seed doctrine via deactivate-before-insert, created_at ordering for newest-selection. issued_by stamps provenance ('cli-totp').

## D.4 kza_prel_sessions / signing RPC

Sessions record token_hash, user, session grouping, lineage hashes, window scores, expiry epochs; signing via database RPC keeps HMAC keys off function code entirely. Validators call sibling verify RPC with target function id.

## D.5 kza_banned_entities

Legacy columns (ban_type TEMP/PERMANENT constraint, tier, reason, summary, until, by, active) plus hardening additions entity_type enum {USER,IP,DEVICE,MACHINE} and entity_value with partial index on active rows. cli-totp writes DEVICE+MACHINE pairs only.

## D.6 kza_threat_events

Write model from cli-totp: YELLOW tier, type F2FA_FAILURE, description, payload snapshot (device id + hashed machine), endpoint tag, method, ip. Counted for brute threshold; consumed by sentinel tier dashboards.

## D.7 auth.mfa_factors (platform-owned)

Read-only consumer contract: select secret where user/status/factor_type filtered. Never written from application code; enrollment remains exclusively web-session-bound (D-03).

## D.8 files / folders / upload_sessions / shares / api_keys / file_key_vault

files: id uuid, owner, workspace binding, storage flavor, encrypted flag, encryption_key column (may hold placeholder), tags[0] res54 metadata JSON, soft-delete pair. upload_sessions: plan + key custody through completion. shares: share_id/access_code duality, limits. api_keys: prefix-indexed digest verification with per-key salt concatenation scheme (prefix ‖ salt ‖ token hashed). file_key_vault: wrapped key + iv per file unwrapped under platform master-derived KEK (HMAC(master,'file-key-vault-v1')).

\newpage

# ANNEX D2 — WIRE FORMAT CATALOG (NON-CODE SPECIFICATIONS)

## D2.1 Opaque CLI Token Resolution Digest

Input: exact bearer string bytes (UTF-8). Transform: SHA-256. Comparison: equality against stored lowercase hex. Rejection precedence: dot-containing strings route to JWT path before digesting.

## D2.2 Storage Key Verification Scheme

Keys present as cb_ + body. Lookup by 11-char prefix narrows candidates; verification computes SHA-256 over concatenation(salt-bytes ‖ token-bytes) compared to stored hash. Salt stored base64; decode before concat; ordering is salt-first — historical defect class when reordered.

## D2.3 File-Key Vault Unwrap Chain

master = env 64-hex if configured else SHA-256("squidveil-master-v1:" ‖ serviceKey); KEK = HMAC-SHA256(master, "file-key-vault-v1") rendered hex then bytes; unwrap = AES-256-GCM decrypt(wrapped, iv) yielding plaintext key string returned to authorized caller only after ownership assertion.

## D2.4 TOTP Factor Verification Parameters

RFC-6238; HMAC-SHA1; 6 digits; step 30s; drift ±1; dynamic truncation standard nibble; base32 alphabet canonical (A–Z2–7), padding stripped, whitespace ignored; compare constant-time length-then-XOR-fold.

## D2.5 F2FA Code Derivation (Ratified)

See §25 steps verbatim. Test vectors obligation: OI-3 tracks fixture publication; interim vectors exist only in this register's review history and must not be transcribed into tickets.

## D2.6 Decryptor Session Header Contract

Header name X-SquidFS-Auth; value exact 48-hex session secret; constant-time equality; absence ⇒ 403 JSON forbidden; health route exempt.

## D2.7 WebDAV Basic Gate Contract

Realm literal SquidFS; username ignored; password verified per §44 parameters; failure emits WWW-Authenticate challenge; success proceeds to outer handler unchanged.

\newpage

# ANNEX E — TRIAGE MATRICES AND RUNBOOKS

## E.1 "Decryption failed" Decision Tree

1. Which version attempted? (composite error carries vN and blob size). 
2. v3 attempts failing while v2 succeeds ⇒ context fields (userId/fileId/index/total) wrong at caller — inspect manifest completeness.
3. All versions fail for one file, others fine ⇒ key mismatch class: confirm placeholder detection routed to vault fetch; check file-key response ownership errors (403 vs 404 distinction).
4. Uniform failure across many files post-relogin ⇒ stale daemon (PM-04 signature): bounce decryptor, confirm live-reread line in logs.
5. Failures isolated to legacy objects ⇒ generation-1 path; verify detector fall-through order untouched.

## E.2 "Mount fails at decryptor stage" Runbook

Health endpoint reachable? → yes: state pid alive? yes ⇒ reuse should have occurred (supervisor bug — escalate); no ⇒ kill pid, retry. Health unreachable but port occupied? → foreign process owns 6763 (identify; do NOT blind-kill system processes); free port; retry. Port free but spawn fails? → script materialization path broken (PM-02a class); verify cache-dir placement in installed build.

## E.3 "Operator reports device banned" Intake Script

Confirm ban rows (type/value/timestamp). Establish whether failures correlate with operator's own retries (education outcome) or foreign fingerprint activity (compromise signal — trigger incident lane). Admin unban ONLY after cause documented. Machine-type bans persist across reinstalls by design; explain evasion-attempt linkage if user requests fingerprint reset.

## E.4 "Whole account locked out" (should be impossible) Escalation

Doctrine guarantees no cli-totp path bans accounts. If observed: treat as P1 defect; capture ban rows proving USER type provenance; suspect manual kza-admin action or other KZA tier; do not normalize.

\newpage

# PART XIX — KZA DETECTION TIER AND SUPPORTING SERVICES

## §70. Threat Event Lifecycle

Threat events are the substrate's nervous system. Producers span the entire stack: cli-totp (F2FA_FAILURE), kza-prel gateway (binding/CIP/F2FA anomalies), sentinel-tier analyzers, host api audit correlation jobs. Each event carries tier (GREEN/YELLOW/RED/BLACK), type taxonomy, free-text description, JSON payload snapshot, endpoint tag, method, ip. Consumers: brute-force counters (windowed counts by user+type), ban pipeline, dashboard security center visualizations, veil profile exports.

Tier semantics doctrine: YELLOW = anomalous but plausibly benign (counted, not punished alone); RED = pattern confirmed abusive (ban-eligible); BLACK = existential (forced auth sign-out accompanies any ban). Shadow bans — rows flagged shadow — permit traffic to appear accepted while responses are poisoned downstream; used against active scanners to avoid tipping off tooling. Operators must never disclose shadow status to subjects.

## §71. Ban Pipeline Mechanics

kza-admin/ban accepts subject selectors (user id and/or ip), tier, shadow flag; BLACK additionally forces auth revocation server-side. Active-ban uniqueness is enforced per selector pair; unban deactivates rather than deletes (forensics preserved). Recheck_at supports temporary bans with scheduled reevaluation. The DEVICE/MACHINE additions from the hardening cycle integrate through the same table with entity typing — consumers that predate entity columns must treat NULL entity_type as legacy USER/IP semantics.

## §72. Supporting Services Sketch

**Signals** — typed event emission helper standardizing inter-function telemetry envelopes (event name, subject, severity, redaction-aware payload pruning). All new functions should emit through it rather than ad-hoc logging.

**Provider vault** — credential custody for third-party integrations (storage clusters, notification transports); envelope-at-rest under platform KEK family; access audited; never returns material to browser contexts.

**Webhook emitters** — outbound event fan-out with signature headers and retry/backoff discipline; recipients verified at registration time; delivery failures surface as YELLOW signals after threshold.

These services are adjacent to CLI/SquidFS scope but appear in incident chains (e.g., cluster key rotation invalidating signed-URL minting manifests as burst download failures) — hence their inclusion here as recognition aids.

\newpage

# PART XX — CRYPTOGRAPHIC GOVERNANCE

## §73. Primitive Inventory (Approved List)

| Purpose | Primitive | Parameters |
|---|---|---|
| File AEAD | AES-256-GCM | 12B nonce; AAD per generation spec |
| Key derivation (v3 chain) | HKDF-SHA256 | salt=∅; info strings ratified in §17 |
| Passphrase KDF (vault) | scrypt | N=16384 r=8 p=1 → 32B |
| Password verifier KDF (WebDAV) | PBKDF2-SHA256 | 210k iterations; 16B salt; 32B out |
| Factor verification | HMAC-SHA1 (RFC-6238) | 30s step; 6 digits |
| F2FA fold | SHA-256 + uint32 XOR-fold | §25 construction |
| Token integrity | HMAC via DB RPC | Key custody platform-side |
| Identity digests | SHA-256 | token_hash, machine hash in events, binding fingerprint |
| Nonce/secret generation | CSPRNG only | randomBytes/randomUUID-class |

## §74. Prohibited Practices

Hex-decoding res54 keys (§17 warning); absolute-value normalization of F2FA codes; int32-shift byte extraction for multi-byte integers; non-constant-time secret comparison in new code; plaintext secret transit via environment where a file-channel exists; silent catch around AEAD failures (must surface version+size diagnostics).

## §75. Rotation and Evolution Policy

Envelope generations are additive forever — no re-encryption campaigns of legacy objects absent a concrete cryptanalytic driver. Wire-format changes require: dual-side fixture vectors merged in same changeset; staged rollout (server accepts old+new for one release train); this document amended before deploy. Key rotation of platform master affects only wrapped-custody layer; per-file keys never rotate retroactively.

\newpage

# PART XXI — PERFORMANCE AND CAPACITY DOCTRINE

## §76. Concurrency Model Constants

Decryptor chunk concurrency fixed at eight workers regardless of link class — chosen as knee point on consumer links where per-chunk TLS handshakes amortize; raising it historically increased substrate 403/429 noise without throughput gain. Retry policy: three attempts, linear 400ms×attempt backoff, failures surface per-chunk with index context.

Engine listing TTL fifteen seconds balances directory freshness against bridge invocation cost; refresh flag bypass exists for automation needing immediacy. Chunk cache ceiling 500MB with LRU eviction; ciphertext-only cache artifacts never (cache stores post-decrypt buffers keyed for reuse).

## §77. Rate Limit Posture

Platform-side limits apply to control-plane calls only; the architecture's stated advantage is data-plane decoupling ("zero platform rate limits in between") — content bytes flow endpoint↔substrate directly under signed URLs. Host api imposes local limits per profile (§49) using microredis fixed-window counters; bursts sized 2× sustained by convention.

Capacity planning rules-of-thumb for operators: decryptor steady-state RSS scales with active inflight promises (bounded small); engine RSS dominated by chunk cache ceiling; host api body cap is the memory high-water marker per request (512MB profiles assume dedicated boxes).

\newpage

# PART XXII — COMPLIANCE, AUDIT, AND CHANGE CONTROL

## §78. Audit Surface Inventory

Local: host-audit.log lines (§52), CLI command audit trail (dispatch writes argv summary + exit code). Platform: threat events, sessions ledger, admin verb logs, storage access via signed-URL server logs (substrate-side retention). Doctrine: every privileged action must be reconstructible from at least two independent surfaces (local + platform); gaps are defects.

## §79. Change Classes and Required Evidence

| Class | Examples | Required evidence before ship |
|---|---|---|
| Crypto wire | envelope, F2FA encoder, verifier format | Dual fixtures; staged acceptance; doc amendment |
| Auth flow | login, poll, attestation | Full happy/adverse matrix run; PM cross-check |
| Transport | daemon listeners, guards | Adversarial RST harness; liveness probe |
| Schema | registry/seeds/devices | Introspection diff vs live; migration dry-run |
| Distribution | acquisition order, checksums | Tamper-simulation exercise |

## §80. Review Cadence Checklist (per semi-annual cycle)

Re-verify ledger §66 end-to-end on current builds; re-run Annex E drills; confirm port ledger unchanged; sweep for drift between this document and repo migrations; interview one operator incident from the period and fold lessons into Annex A if novel; bump revision ledger; custodian sign-off.

\newpage

# PART XXIII — DEEP WALKTHROUGHS (NARRATIVE PROTOCOL TRACES)

These traces describe full protocol exchanges in operator-legible narrative form. They are the antidote to abstraction: when debugging, reproduce the trace mentally step by step before touching tooling.

## §81. Trace One — Cold Login to First Mounted Read

The operator invokes login on a fresh machine. The CLI detects absence of configuration directory and creates it with restrictive modes; generates the permanent machine fingerprint and stores it; probes secret tiers — no keyring daemon responds to the probe cycle, no vault file exists, interactive TTY is present so the vault-creation prompt appears; the operator supplies a passphrase; an empty sealed vault is written. Legacy migration finds nothing.

Device registration posts the fingerprint with hostname/platform; response carries user code and verification URL. Browser opens; the consent surface evaluates assurance level; because this account maintains an enrolled authenticator but the web session predates it, the inline challenge intercepts; six digits later, approval posts binding redirect state to the OAuth function; device row flips authorized.

Polling loop wakes at interval; poll handler resolves the pending row, applies the mandatory-factor gate via direct SQL (a verified factor exists), mints the opaque token, stores only its digest, stamps lifecycle fields, returns the envelope including anon passage key. CLI persists metadata (no secrets) and writes token into Tier II vault under its slot; then performs login-time attestation: status confirms enrollment; prompt collects six digits; verify path opens the SQL pool once, pulls factor secrets, folds HMAC over drift windows, matches constant-time; success stamps the device row's attestation epoch, deactivates any prior guard seeds, inserts a fresh seed with mandated non-null day/session columns, returns seed+TTL; CLI stores seed in the vault, clears stale lease slots, prints the two-factor verified line, tears down sockets, exits zero.

Operator invokes mount. Dispatch recognizes the privileged family; guard loads attestation triple from vault; shelf-life check passes but no lease exists yet (fresh login stored seed only), so guard derives the eight-digit fold over seed‖guard-id‖window, exchanges once at the gateway; gateway resolves identity through opaque-token branch (digest match on device row), consults registry (guard requires F2FA), verifies newest active seed across drift, records session ledger entry, returns signed lease bound to IP‖UA; guard caches lease with clamped shelf-life; command proceeds.

Provisioning: engine acquisition walks precedence — source checkout present, Go build runs quietly, universal cache overwritten, provenance line printed. Key negotiation mints a session storage instrument unless override supplied. Supervisor health-probes 6763: absent ⇒ materializes embedded script into module-cache subtree, spawns detached, polls readiness up to eight seconds, reads back published state (pid/port/secret). Verifier provisioning: none stored yet → generated password displayed once, PBKDF2 line written 0600, hash-path exported to child environment. Engine spawns with composed environment; banner sequence prints; listener binds loopback; password gate armed; decryptor URL wired.

Operator points a client at the WebDAV root with Basic credentials. PROPFIND traverses: outer gate validates; handler frames XML; listing-by-name bridge call returns folder/file arrays; caches populate; entries render. Operator GETs a document: statFor resolves manifest; content path requests plaintext from daemon with session header; daemon live-rereads credentials (fresh post-login instruments), fetches signed manifest (server includes owner id for AAD context), placeholder-detected key routes to vault unwrap service returning real key, eight workers pull chunks, v3 magic detected, HKDF chain derives per-index keys, AEAD verifies against identity-bound AAD, parts concatenate, bytes return; engine slices per range semantics; application renders. Total cold-path latency dominated by chunk fan-in; subsequent reads hit cache.

## §82. Trace Two — Adversarial Week

Monday 09:14: LAN peer port-scans; finds nothing (all daemons loopback; no advertisement). Tuesday: phishing yields endpoint malware running as user. It enumerates home directory: metadata reveals email/expiry/prefix only; vault file is opaque without passphrase; plain-tier absent (keyring host); hash-file present but verifier-only. Malware attempts localhost API ports: host api not running; engine not running; daemon IS running from morning mount. It calls /health (liveness ok) then /file/<guessed-uuid> without header ⇒ 403. It attempts header replay by reading daemon state file — blocked by same-user file permissions? No: same-user malware CAN read it (residual risk acknowledged §3) — it now holds session capability until daemon restart. Mitigation surface that remains: TTL of exposure bounded by operator session length; platform-side anomaly detection sees unusual file-id sweep pattern from one origin; sentinel flags YELLOW→RED; next business day the mount's lease renewals fail with banned-instrument semantics? — no: bans attach to TOTP brute force, not content sweeps. This trace is retained deliberately: it marks the boundary of current architecture and motivates OI-item discussion of per-session capability scoping.

Thursday: attacker pivots to phishing the operator's web session instead; consent page for a NEW device authorization appears mid-session — AAL2 gate intercepts because session assurance lapsed; attacker cannot pass challenge; operator notices consent attempt notification. Doctrine vindicated: human-presence proof gates both instrument minting and privileged use.

\newpage

# PART XXIV — INTERFACE CONTRACTS WITH LOCAL APPLICATIONS

## §83. WebDAV Client Compatibility Matrix

| Client class | Verified behaviors | Known caveats |
|---|---|---|
| macOS Finder (CMD-K) | PROPFIND depth-1 browsing; GET ranges; PUT overwrite | Lock discovery may add latency; LOCK system is in-memory |
| Windows Explorer mapping | Basic auth prompt honored; drive letter mapping | Requires non-loopback bind or port-proxy on same-host scenarios; loopback SMB-style mapping limitations are OS-side |
| Linux davfs2 | Mount over loopback; cached writes | Alignment flag recommendations apply |
| rclone serve consumers | Read/write streams; checksum offload unsupported | Partial-write semantics follow DAV |
| curl-class scripting | All methods; Basic header; Range | Probe noise paths expected (PM-03c) |

Contract statement: the engine promises standards-conformant DAV semantics within the capabilities of the backing object store — immediate consistency on completed uploads, eventual visibility (≤TTL) for out-of-band mutations.

## §84. Host API Consumer Contract

JSON envelopes; error shape {error, profile?}; numbered refs stable within a listing generation; ref-resolution precedence fixed (#n > prefix > name, recency tie-break); download streams plaintext with content-type best-effort from record; upload consumes raw body within profile cap and returns record envelope incl. ref; exec ops limited to enumerated verbs — extension requires doctrine amendment.

Rate-limit headers expose remaining budget when keyed profiles active; 429 bodies include window reset hint. Consumers should treat 4401 (auth-classified route error) as re-login signal distinct from generic 401 (transport credential issue).

\newpage

# PART XXV — DATA CLASSIFICATION HANDLING RULES

## §85. Material Classes

| Class | Examples | Handling |
|---|---|---|
| CREDENTIAL-LIVE | tokens, seeds, passwords, factor secrets | Secret tier only; never tickets/logs/screenshots; display-once discipline |
| CRYPTO-SPEC | envelope layouts, derivation chains, encoder quirks | This document + repo fixtures; publication requires custodian approval |
| TOPOLOGY | ports, hosts, registry rows | Internal docs; sanitize in external comms |
| OPERATIONAL | runbooks, banners, audit formats | Freely internal |

## §86. Redaction Standards for Escalations

When attaching logs to incidents: replace bearer prefixes beyond first four chars; replace machine fingerprints entirely; replace emails with account alias assigned during intake; keep timestamps/timezones intact (forensic value outweighs privacy here under internal policy); never truncate error JSON bodies mid-code-field.

\newpage

# PART XXVI — TRAINING AND CERTIFICATION CURRICULUM

## §87. Curriculum Structure

Engineer onboarding to this system is gated through four graded modules. Completion evidence attaches to the personnel training ledger; privileged production access requires Module IV sign-off by a current custodian.

**Module I — Mental Model (2h guided).** Candidate reproduces, unprompted: three trust domains; canonical read chain (§7); instrument inventory table from memory at 90% fidelity; the four asymmetries. Assessment: whiteboard walkthrough of Trace One with examiner injecting two faults ("daemon absent", "re-login mid-session") requiring correct reasoning about supervisor reuse and live-reread doctrine.

**Module II — Failure Archaeology (3h).** Candidate reads Annex A unsupervised, then is presented sanitized logs from three historical incidents with identifiers scrubbed; must attribute PM-numbers and explain mechanism class within twenty minutes each. Passing criterion: zero misattribution between PM-04 (stale-key cascade) and PM-07 (encoder divergence) — these two account for the majority of real-world misdiagnoses.

**Module III — Adversarial Lab (4h practical).** In a sandboxed environment the candidate executes: unauthenticated-GET exploit against a deliberately reverted build (demonstrating why gate placement outside method dispatch matters); brute-force path against attestation service observing device-scoped ban semantics without account impact; checksum-mismatch refusal via artifact tampering; RST-harness against pre-guard microredis witnessing daemon death then post-guard survival. Written reflection required mapping each observation to its doctrinal paragraph.

**Module IV — Change Stewardship (2h + supervised ship).** Candidate performs one real low-risk change end-to-end under supervision: schema introspection diff, migration authoring per D-register conventions, staged deploy, matrix execution (§66 relevant rows), document amendment, revision-ledger entry. Custodian countersigns.

## §88. Recurring Drills (Quarterly)

Drill Alpha — Credential rotation fire-drill: revoke primary token out-of-band; measure operator recovery time against runbook (target <10 minutes to restored mount). Drill Bravo — Substrate failure simulation: revoke bucket access; verify clean degradation messaging and no plaintext leakage in error paths. Drill Charlie — Ban-lift exercise: intentionally trip device ban in sandbox; execute intake script E.3 verbatim including documentation duties. Drill Delta — Supply-chain rehearsal: publish canary release with corrupted artifact; confirm refusal chain across fleet canaries before real rollout procedures are exercised.

\newpage

# PART XXVII — DESIGN REVIEW CHECKLISTS

## §89. Checklist: Touching the Decryptor

- [ ] Live credential re-read preserved on request path
- [ ] Session header check precedes any state mutation
- [ ] 404/502 semantic split intact (not-found must not trigger engine fallback)
- [ ] Bind remains loopback; state file write mode 0600; bind-loser exits without touching state
- [ ] Embedded-source materialization path resolves module graph from cache location
- [ ] Presence-key convention unchanged or dashboard parser updated same-train
- [ ] Version string bumped; supervisor readiness probe still passes ≤8s budget

## §90. Checklist: Touching Authentication Flows

- [ ] resolveCliDevice contract reused, not reimplemented
- [ ] Fail-closed on infrastructure error in any issuance path
- [ ] Attempt-budget messaging accurate post-change
- [ ] Ban insertion scoped DEVICE/MACHINE only; no USER writes
- [ ] Non-interactive contexts exit before prompts, never hang
- [ ] Enrollment URL constant matches canonical settings address
- [ ] Attestation triple storage shape respected (seed/prel/exp)

## §91. Checklist: Touching Transport Listeners

- [ ] Default bind loopback; non-loopback demands verifier at startup
- [ ] Outer auth gate wraps method dispatch (no verb-level bypass)
- [ ] Socket/clientError handlers present; reset-class silent
- [ ] Daemon-level uncaught filter distinguishes transport noise
- [ ] mDNS remains opt-in and suppressed for loopback
- [ ] Port ledger updated if defaults moved

## §92. Checklist: Touching Storage/Bridge Contracts

- [ ] Ownership assertion (owner==resolved user) precedes byte service
- [ ] Workspace scoping retained on all record queries
- [ ] Signed-URL capability minimal (single object single verb)
- [ ] Manifest completeness includes owner id for v3 context
- [ ] Placeholder-key detection regex list synchronized with vault-fetch routing

\newpage

# PART XXVIII — HISTORICAL ARCHITECTURE NOTES (PRE-HARDENING BASELINE)

Preserved so future readers understand why specific paragraphs exist, and so "restore simplicity" proposals meet their full context.

## §93. The Permissive Era (pre-audit)

Original engine bound all interfaces, advertised over mDNS unconditionally, served content without inbound credentials, branched content-path on storage flavor leaving an empty-success stub, and fell back from decryptor errors to platform refetch using whatever bearer it had booted with. The decryptor existed but was frequently bypassed by stale processes holding superseded instruments. Provisioning preferred cached binaries over source builds. Secret custody was a single flat JSON with mode discipline but no tiering; login machine identifiers regenerated per attempt, defeating any future device-scoped logic. The F2FA layer existed in registry schema with a dormant encoder that had never once succeeded in production. None of this was malicious — it was the natural growth pattern of a prototype achieving product-market velocity. The hardening cycle converted each item into a doctrinal paragraph plus a verification row; this section exists to prevent romanticizing the simpler skeleton.

## §94. Why Not X (Rejected Alternatives Register)

**mTLS client certificates instead of TOTP step-up:** rejected — certificate provisioning UX on consumer endpoints exceeds organizational maturity; human-presence proof was the requirement, not channel authentication.
**Server-side decryption everywhere (drop client crypto):** rejected — violates founding ciphertext-only control-plane constraint (§2).
**Per-file keys in URL fragments to browser clients:** rejected — leaks capability into history/referrers; signed-manifest+vault-fetch model keeps keys off URLs.
**FUSE-first architecture:** deferred — WebDAV achieves cross-platform reach without kernel module distribution burden; FUSE path remains scaffolded for high-performance POSIX semantics later.
**Ban-the-account on second-factor brute force:** rejected after explicit operator directive — instrument-scoped punishment preserves innocent-user availability while still raising attacker cost (D-04).
**Retry-with-drift loops client-side:** removed — server owns drift tolerance; client loops multiply brute-force accounting and were an active contributor to PM-07 user-visible lockouts.

\newpage

# PART XXIX — OPERATIONAL STATEMENTS OF LIMITATION

Honesty about limits is a security control. This part is the canonical statement; marketing and support materials must not contradict it.

## §95. What This System Does Not Protect Against

An attacker with execution privileges as the operating-system user, for the duration of an active daemon lifetime, can exercise the decryptor's session capability by reading the 0600 state file owned by that same user. The architecture treats endpoint compromise as game-over-in-progress and optimizes detection (anomalous sweep patterns), containment (lease TTLs, ban scoping), and recovery (revocation, rotation) — not prevention. Statements implying otherwise are inaccurate.

Shoulder-surfing of the one-time generated WebDAV password or minted API keys defeats display-once discipline; operators in shared physical spaces should prefer operator-supplied passwords entered privately.

Clock skew beyond the drift window silently breaks factor verification; environments without time synchronization will experience unexplained verification failures. Doctor surfaces skew hints for this reason.

## §96. Known Cosmetic Behaviors (Do Not File)

Negative-rendered F2FA codes are correct output, not corruption. The five-second not-exist probe lines from foreign pollers are expected noise with method+path attribution. Vault warnings on keyring-less hosts print every process invocation by design (they are the tier-selection disclosure requirement). Decryptor presence cards persisting as :OFFLINE after unclean shutdown self-heal at next registration.

\newpage

# PART XXX — CONSOLIDATED REFERENCE TABLES

## §97. Master Identifier Glossary

| Term | Definition |
|---|---|
| AAL2 | Authenticator Assurance Level 2 — possession-factor verified session state |
| AAD | Additional Authenticated Data bound into AEAD verification |
| AEAD | Authenticated Encryption with Associated Data |
| Binding | PREL token fingerprint of request origin (IP‖UA digest) |
| Bridge | Path-oriented edge function serving SquidFS listing/meta/upload negotiation |
| CIP | Client Integrity Protocol — scored attestation layer in KZA gateway |
| Decryptor | Loopback daemon holding exclusive plaintext reconstruction authority |
| Device row | cli_devices record binding machine, user, token digest, lifecycle |
| Envelope | res54 container generation wrapping file/chunk bytes |
| F2FA | Function-scoped second factor: seed-derived per-window code at KZA layer |
| Guard | CLI module enforcing privileged-command attestation + lease exchange |
| Host API | Local REST mirror server (8065) over platform operations |
| Lease | Informal synonym for PREL token |
| Machine id | Permanent install fingerprint (device-id artifact) |
| MicroRedis | Embedded RESP-compatible store backing host api |
| PREL | Privileged Resource Lease — signed short-lived authorization token |
| Registry | kza_prel_registry policy table governing protectable functions |
| res54 | House envelope family (generations 1/2/3) |
| Seed | Server-issued secret enabling client-side F2FA derivation |
| Session secret | Decryptor bearer for loopback /file calls |
| Tier I/II/III | Secret custody hierarchy: keychain/vault/plain |
| TOTP | Time-based one-time passcode (Supabase-enrolled authenticator) |
| Veil | KZA privacy/profiling export subsystem |
| Workspace | Tenancy partition scoping files/folders queries |

## §98. Port and Path Quick Reference

| Identifier | Value |
|---|---|
| Decryptor port | 6763 (loopback) |
| WebDAV default | 8099 (loopback default bind) |
| Host api | 8065 (loopback) |
| MicroRedis | host+1 → 8066 (loopback) |
| Config dir | ~/.squidcloud |
| Engine cache dir | ~/.squidfs/cache |
| Audit log | ~/.squidcloud/host-audit.log |
| Enrollment URL | squidcloud.vercel.app/account/settings |
| Platform base | squidcloud.vercel.app/api/v1 |
| Functions base | <project-ref>.supabase.co/functions/v1 |

## §99. Numeric Constants Ledger

| Constant | Value | Where |
|---|---|---|
| Listing cache TTL | 15 s | Engine |
| Chunk cache ceiling | 500 MB | Engine |
| Decryptor chunk workers | 8 | Daemon |
| Chunk retry/backoff | 3 × (400 ms·attempt) | Daemon |
| Attestation lease TTL | 900 s (15 min) | cli-guard registry |
| TOTP brute threshold | 3 failures / 5 min | cli-totp |
| PBKDF2 iterations (WebDAV) | 210,000 | CLI minting |
| scrypt params (vault) | N=16384 r=8 p=1 | Tier II |
| Session secret entropy | 24 bytes hex (48 chars) | Daemon |
| Generated password length | 20 chars unambiguous alphabet | WebDAV provisioning |
| sb_token shelf life | ≤55 min | JWT persistence clamp |
| Opaque token validity | ~30 days | Policy |
| Body cap standard/hardened | 512 MB | Profiles |
| Body cap paranoid | 64 MB | Profiles |

\newpage

# PART XXXI — FREQUENTLY RAISED QUESTIONS (ENGINEERING ANSWERS)

## §100. FAQ

**Q. Why does my correctly typed authenticator code sometimes fail right after a success?** Window boundary traversal combined with single-attempt exchange policy; retry once after the next clock tick. Persistent failure ⇒ skew investigation.

**Q. Why can't the CLI enroll TOTP directly?** Factor custody is deliberately web-session-bound so the shared secret never transits nor rests on endpoints (D-03).

**Q. Why did my mount re-download instead of using the running daemon?** Transport-unreachable fallback engaged — check supervisor health line; if daemon was up, inspect session-header wiring (env propagation through spawn composition).

**Q. Are negative eight-digit codes a bug?** No. Signed XOR accumulation is canonical on both encoder sides; padStart simply never applies to negatives (PM-07 residue).

**Q. Can two mounts share one decryptor?** Yes — that is the reuse doctrine; secrets match via state file while the daemon lives.

**Q. Why does logout not revoke server-side?** Local logout is posture hygiene; global revocation is an explicit operator act on dashboard to avoid surprise session termination semantics across machines.

**Q. Is the anon key secret?** No — it is a public passage constant by platform design; treating it as classified misdirects audits.

**Q. Why 210k PBKDF2 iterations?** OWASP-era guidance midpoint balancing sub-second verification on mobile-class hardware against offline-crack cost given 20-char generated passwords.

**Q. Where do deleted files go?** Soft-delete flag with restore verb; substrate objects persist until purge policy runs platform-side.

**Q. Can I run daemons on custom ports?** Engine/redis yes via flags (ledger update required); decryptor port override exists but is intentionally undocumented surface for testing only.

\newpage

# ANNEX F — EXPANDED DATA DICTIONARY

Column-level documentation of every table the coupled system touches. Types are informational; the live catalog is authoritative. Each entry lists: column · role · writers · invariants.

## F.1 cli_devices

| Column | Role | Writers | Invariants / Notes |
|---|---|---|---|
| id | Primary identifier; DEVICE ban value | register | UUID; immutable |
| user_id | Owning principal | authorize | Present before any issuance path proceeds |
| auth_id | Linked web auth identity when consented | dashboard flows | Nullable pre-consent |
| device_name | Human label surfaced in dashboard | register / consent | Hostname or UA string |
| machine_id | Permanent install fingerprint; MACHINE ban value | CLI (persistent artifact) | Stable across re-login by design |
| machine_fingerprint | Secondary derived fingerprint slot | legacy writers | Retained for forensics continuity |
| ip_address | First-seen/last consent network coordinate | register/poll | Informational; binding uses runtime IP separately |
| user_agent | Consent-time agent string | authorize | Forensics |
| platform | OS/arch string from CLI | register | Display |
| status | Lifecycle enum | poll/authorize/revoke | pending→authorized→active; revoked/expired terminal |
| last_used_at | Most recent authenticated activity | resolution paths | Sliding telemetry |
| created_at | Row birth | register | Ordering anchor |
| device_code | Device-flow correlation secret | register | Single-use through activation |
| client_id | Instrument family tag | register | 'squidcloud-cli' today |
| scope | Granted scope string | consent | Read/write baseline |
| token_hash | SHA-256 of opaque bearer — never plaintext | poll/token | Resolution contract key (§10) |
| is_banned | Legacy boolean ban flag | ban verb | Superseded by entity bans; still honored first |
| banned_at | Ban epoch | ban verb | Forensics |
| expires_at | Device-code expiry | register | Pre-activation only |
| authorized_at | Consent epoch | poll success | Audit |
| aal2_verified_at | Latest successful TOTP attestation on this device | cli-totp | Drives recency displays; advisory |

## F.2 kza_prel_registry

| Column | Role | Invariants |
|---|---|---|
| function_id | Protectable surface name (PK) | Consumers must match exactly |
| function_name / description | Human metadata | Non-null enforced |
| required_auth_level | Identity layer selector | Enum-constrained; 'none'/'any' short-circuit anonymous |
| cip_required | Integrity scoring gate | Off for guard-class rows |
| f2fa_required | Second-factor gate | True ⇒ X-F2FA mandatory at issue |
| chain_depth_limit | Delegation ceiling | 0 forbids child minting |
| rate_limit_rps / burst | Issuer throttles | Fixed-window counters |
| allowed_callers[] | Function-to-function ACL | Empty = unrestricted internal callers |
| allowed_operations[] | Op whitelist | Empty list disables op filtering (gateway semantics) |
| ttl_seconds / long_op_ttl_seconds | Lease windows | Guard uses 900/900 |
| geo_velocity_check / geo_max_speed_kmh | Impossibility travel heuristics | Advisory scoring |
| geo_fence_check | Region fence gate | Off by default rows |
| veil_no_log | Privacy suppression for veil exports | Honored by export verb |
| required_min_role | Role floor | Null = none |
| is_active | Kill switch | Inactive ⇒ UNREGISTERED refusals |

## F.3 kza_prel_f2fa_seeds

| Column | Role | Notes |
|---|---|---|
| seed_id | PK | — |
| user_id | Owner scoping | Lookup key with function_id |
| function_id | Lease family ('cli-guard') | Verify matches requested id exactly |
| day_seed | Daily rotation input slot | NOT NULL — populate always |
| session_nonce | Session grouping | NOT NULL — populate always |
| seed_derived | The client-held derivation secret | Newest-active wins verification |
| is_active | Single-seed doctrine switch | Deactivate-then-insert pattern mandatory |
| rotated_at / created_at | Epochs | Ordering |
| issued_by | Provenance stamp ('cli-totp') | Added during hardening |

## F.4 kza_prel_sessions

Ledger of minted leases: token_hash PK; user/session grouping; parent linkage enabling chain audits; function/operation scope snapshot; issued/expiry epochs; chain_depth; cip/f2fa/geo scores; binding digest; long-op extension fields. Consumed by revoke cascades and anomaly sweeps (session velocity).

## F.5 kza_banned_entities

| Column | Notes |
|---|---|
| entity_type / entity_value | Hardening additions; DEVICE/MACHINE from cli-totp; NULL pair = legacy USER/IP row |
| ban_type | TEMP/PERMANENT check constraint |
| ban_tier | YELLOW/RED/BLACK taxonomy alignment |
| ban_reason | Machine-readable cause (e.g., CLI_TOTP_BRUTE_FORCE) |
| attack_summary | One-line human context |
| banned_until / recheck_at | Temp-ban machinery |
| shadow | Poison-response mode flag — never disclose to subject |
| ban_source / banned_by | Automation vs admin attribution |

## F.6 kza_threat_events

Append-mostly telemetry: tier, type taxonomy (F2FA_FAILURE et al.), description, payload_snapshot JSON (redaction-aware pruning applies), endpoint_hit/method, ip_address, user binding. Window counters derive brute decisions; retention follows platform log policy.

## F.7 Storage-domain tables (files/folders/upload_sessions/shares/api_keys/file_key_vault)

files: uuid id; owner; workspace binding; name/type/size; storage flavor ('res54_distributed' current); encrypted boolean; encryption_key column (may be placeholder); tags[0] canonical res54 metadata JSON envelope manifest; parent_folder; soft-delete pair (is_deleted/deleted_at). folders: parallel tree with path strings. upload_sessions: plan custody until completion (key inside!). shares: share_id/access_code duality, limits, view-only. api_keys: prefix-indexed digest scheme (prefix‖salt‖token). file_key_vault: wrapped_key+iv per file; unwrap under KEK chain §D2.3.

\newpage

# ANNEX G — PLATFORM API ENDPOINT CATALOG (CONSUMERS' VIEW)

Every endpoint the coupled system exercises, with contract notes an integrator needs. Auth column: O=opaque CLI token, J=JWT/web session, K=cb_ storage key, A=anon passage, S=service-role internal.

## G.1 Identity & Instruments

| Endpoint | Auth | Contract highlights |
|---|---|---|
| POST /functions/v1/cli-oauth/device | P | Registers machine; returns code/user_code/verification_url/interval/expires_in |
| POST /functions/v1/cli-oauth/device/poll | P | Pending/slow_down/authorized transitions; mandatory-factor gate at issuance; returns token envelope incl. device_id, anon key |
| POST /functions/v1/cli-oauth/token | P | Authorization-code exchange for browser-flow logins; same envelope |
| POST /functions/v1/cli-oauth/authorize | J | Consent binding redirect_uri/state → device row transition |
| POST /functions/v1/cli-oauth/revoke | J | Marks authorizations/devices revoked for owner |
| POST /functions/v1/cli-totp | O | §VII contract; gateway JWT check disabled |
| GET /api/v1/user/whoami | O/J/K | Principal echo; heartbeat target |

## G.2 Files Surface

| Endpoint | Auth | Highlights |
|---|---|---|
| GET /api/v1/files | O/J | Pagination page/per_page≤100; search ilike name; folder filter; workspace-scoped; soft-deleted excluded |
| GET /api/v1/files/:id/metadata | O/J | Full record incl. tags manifest |
| GET /api/v1/download/:id | O/J | Non-signed: server-side decrypt streaming; 422 BYOK demand; 404 deleted/not-found distinction |
| GET /api/v1/download/:id?signed=true | O/J | Manifest: signed_urls[], chunk_buckets, name/type/size, encryption_key (real when held), user_id — v3 context source |
| GET /api/v1/files/:id/download[?signed=true] | O/J | Variant with repo-filtered chunk resolution (legacy b2-tagged chunks) |
| POST /api/v1/upload | E(J) | Plan mint: file/upload ids, generated key, tiered chunk sizing, signed PUT urls |
| POST /api/v1/upload/complete | E(J) | HEAD-verify chunks; register files row w/ res54 tags; consume session |
| POST /api/v1/upload/encrypted | E(J) | Server-side envelope path for crypto-less clients |
| POST /api/v1/files/upload/init | E(J) | Legacy plan mint (key may be client-supplied) |
| POST /api/v1/files/upload/complete | E(J) | Legacy finalize w/ per-chunk verification |
| DELETE /api/v1/files/:id | O/J(editor) | Soft delete; admin-or-owner guard |
| POST /api/v1/files/:id/restore | O/J(editor) | Trash restore |
| PUT /api/v1/files/:id/rename | O/J(editor) | Name mutation |
| POST /api/v1/files/:id/move | O/J(editor) | Parent change |
| POST /api/v1/files/copy | O/J(editor) | Record-level copy sharing manifest/tags |

## G.3 Folders / Shares / Keys

| Endpoint | Auth | Highlights |
|---|---|---|
| POST /api/v1/folders | O/J(editor) | Path string composition parent/id |
| POST /api/v1/shares | O/J(editor) | share_id==access_code today (known simplification); optional expiry/caps/view-only; public URL form |
| POST /api/v1/keys | O/J | Mint; raw displayed once; prefix+digest persisted |
| GET /api/v1/keys/:id | O/J | Metadata fetch (presence-card reuse) |
| PUT /api/v1/keys/:id | O/J | Rename/offline-suffix flows |

## G.4 Key Custody & Bridge

| Endpoint | Auth | Highlights |
|---|---|---|
| POST /functions/v1/file-key | O/J | Ownership assertion then unwrap; 403 vs 404 semantics distinct; diag block leaks only master-env presence boolean |
| POST /functions/v1/squidfs-bridge | K+A | Action grammar §55; anon header constant is public passage |
| POST /functions/v1/kza-prel/gateway | O/J/K/S | Layered issue; cli-guard family per §26 |
| POST /functions/v1/kza-prel/validate | S(+token) | Downstream verification helper |
| kza-admin verbs | S | ban/unban/revoke/export per §28 |

## G.5 Response Envelope Conventions

Success bodies carry success:true plus resource payloads. Error bodies: {error, success:false} optionally {code} for machine triage and rarely {diag}. HTTP mapping philosophy: 400 malformed, 401 identity, 403 policy/ownership, 404 existence, 409 collision (unique id), 422 well-formed but unsatisfiable (BYOK missing/key mismatch), 429 throttle/brute, 500 infra, 501 unregistered function, 503 substrate exhaustion.

\newpage

# ANNEX H — INCIDENT RESPONSE PLAYBOOKS

Playbooks are numbered IR-n and reference Annex C codes and E-runnables. Each states: trigger signature, immediate containment, evidence capture, eradication, recovery, post-incident duties.

## IR-1 Suspected Stolen Endpoint with Active Daemons

Trigger: report of lost device while mount/api sessions were live. Containment: dashboard revoke of that device row (kills opaque resolution) + kza-admin revoke user-scope sessions if web cookie theft suspected; instruct remote wipe if MDM exists. Evidence: pull sessions ledger rows bound to device id in window; decryptor presence card offline suffix epoch; audit tail from host-audit if synced. Eradication: machine-type bans are NOT applied here (device loss ≠ brute force); instead rely on revocation + factor already mandatory. Recovery: fresh login on replacement hardware mints new fingerprint. Post: annotate whether plaintext exposure window bounded by daemon lifetime; record lesson to D-register if control gap observed.

## IR-2 Second-Factor Brute Pattern from Single Instrument

Trigger: ≥3 F2FA_FAILURE events, DEVICE/MACHINE bans auto-inserted. Containment: automatic (bans). Verify account untouched (no USER rows). Evidence: export veil profile; snapshot event window. Decision: education outreach vs compromise lane (fingerprint foreign?). Unban only via E.3 intake with documented cause. Post: confirm no credential stuffing against poll (token_hash lookups absent).

## IR-3 Distribution Tamper Signal

Trigger: checksum refusal reports from fleet canaries or operator. Containment: freeze release channel; yank latest tag if artifact confirmed altered; rotate any publishing credentials potentially involved. Evidence: preserve refused artifact + expected/got digests from message. Eradication: rebuild from pinned source commit; republish checksums; force cache invalidation messaging. Recovery: operators instructed manual re-acquisition path (override or source build). Post: supply-chain review note appended to this document.

## IR-4 Mass 401 Cascade Following Platform Credential Rotation

Trigger: burst INVALID_API_KEY across installs after rotation event. Containment: identify which leg (fallback bearer vs bridge key) via error provenance lines. Eradication: redeploy corrected constants/configs; daemon live-reread doctrine limits endpoint-side action to process bounce. Recovery: banner-driven restart guidance. Post: PM-04 cross-reference updated with new vector.

## IR-5 Anomalous Content Sweep via Daemon Capability

Trigger: sentinel flags single-origin sequential file-id enumeration matching session capability. Containment: terminate implicated daemon remotely impossible by design ⇒ instruct operator kill; rotate instruments; consider shadow-ban of origin IP at platform edge for scrape patterns. Evidence: decryptor request pattern reconstruction from inflight logs (if enabled) + platform download manifests access logs. Eradication: endpoint hygiene (malware scan). Recovery: standard. Post: feed OI backlog item on per-session capability scoping.

## IR-6 Registry Misconfiguration Lockout

Trigger: broad KZA_PREL_UNREGISTERED / OPERATION_DENIED surge. Containment: registry is_active flip-back via controlled SQL (change-controlled). Evidence: diff registry rows vs Annex D baseline. Root-cause: migration drift class (PM-06). Post: amend introspection tooling checklist.

\newpage

# ANNEX I — DECISION RECORDS (FULL TEXT)

Each record: context, options weighed, resolution, consequences, revisit trigger.

## DR-01 Sole Plaintext Authority (Decryptor)

Context: early designs decrypted inside the engine and separately inside web flows, producing three crypto implementations drifting apart. Options: (a) engine-embedded crypto; (b) server-side decrypt everywhere; (c) dedicated local daemon as single authority. Resolution: (c). Consequences: one implementation to audit; engine simplified to proxy semantics; new failure domain (daemon availability) mitigated by supervisor + fallback-to-platform for transport only. Revisit: if WebAssembly in-engine parity ever becomes strategically necessary, envelope fixtures (OI-3) become prerequisite.

## DR-02 Hashed Opaque Bearer Custody

Context: bearer theft from server compromise. Options: encrypted-at-rest plaintext tokens vs digest-only. Resolution: digest-only with brute-force-infeasible entropy. Consequences: token prefix display requires storing first-eight separately (accepted); logout cannot "erase" server-side presentation — revocation is row-state based. 

## DR-03 Factor Custody Stays Web-Bound

Context: CLI convenience could allow direct enrollment via challenge APIs. Options: CLI-enrolled factors vs web-only. Resolution: web-only. Consequences: TOTP secrets never cross endpoint boundary; enrollment UX lives entirely in dashboard security center; CLI enforcement messages deep-link canonical URL.

## DR-04 Instrument-Scoped Punishment

Context: second-factor brute force response policy. Options: account lockout (industry default), IP lockout (NAT collateral), device+machine scoping. Resolution: device+machine. Consequences: innocent account availability preserved; attacker cost shifts to hardware acquisition; admin lift remains manual to force human review. Explicit operator directive during hardening cycle.

## DR-05 Canonical Signed F2FA Rendering

Context: XOR accumulation yields signed int32; naive absolute-value normalization diverges from gateway. Options: normalize both sides to unsigned; mirror signed exactly. Resolution: mirror signed (minimal diff at time of fix); encoder byte-construction simultaneously corrected to true u64LE. Consequences: codes may render with leading '-'; documentation calls this out in three places to prevent future "fixes" re-introducing divergence.

## DR-06 Whole-Object Content Proxy Default

Context: streaming per-chunk ranges adds complexity and partial-failure modes. Options: universal whole-object fetch+slice; chunk-aligned lazy reads universally. Resolution: whole-object default; lazy path retained where manifests permit aligned reads. Consequences: small-file latency optimal; large-media memory bounded by cache ceiling rather than range logic; revisit under OI-2 if telemetry shows pain.

## DR-07 Advertisement Opt-In

Context: discoverability convenience vs TH-02. Resolution: opt-in only; suppressed automatically for loopback binds since announcement would be false signaling. Consequences: LAN discovery workflows require explicit flag; zero default broadcast.

## DR-08 Wildcard Dashboard Presence Key

Context: presence heartbeat needs an instrument; least-privilege scopes unsupported by dashboard renderer at design time. Resolution: mint wildcard-scoped visibility key with structured name; flagged D-register. Consequences: accepted in-memory exposure trade-off; OI-1 tracks narrowing.

## DR-09 Vault Passphrase Floor

Context: Tier II passphrase policy for headless hosts. Options: 8-char floor vs 12. Resolution: 8 with generation guidance; scrypt cost compensates partially. Consequences: documented residual risk for weak operator choices; drill Delta covers rotation hygiene.

## DR-10 Hash-File Channel to Engine Child

Context: conveying WebDAV credential without env plaintext. Options: env var password; stdin handshake; hash file path. Resolution: hash-file path (env carries path not secret). Consequences: verifier-only exposure in process environment; plaintext confined to secret tier + one-time display.

## DR-11 Live Credential Re-read Doctrine

Context: PM-04 class. Resolution: request-time re-read in daemon. Consequences: negligible IO cost; eliminates entire stale-process credential class; any future caching must preserve invalidation-on-change semantics.

## DR-12 Single-Attempt Lease Exchange

Context: PM-07 amplification. Resolution: client sends one code; server owns drift. Consequences: honest brute accounting; transient window-boundary misses resolve on next tick rather than same-call retries.

## DR-13 Fail-Closed Infrastructure Posture

Context: factor-gate SQL failures during issuance could either issue-under-doubt or refuse. Resolution: refuse (TOTP_GATE_ERROR). Consequences: availability depends on config correctness — accepted for privileged surface only.

## DR-14 Checksum Enforcement With Loud Degradation

Context: missing checksums.txt handling. Options: silent skip; refusal. Resolution: proceed-with-warning (availability) but mismatch ⇒ hard refusal (integrity). Asymmetric by design: absence ≠ evidence of tampering.

\newpage

# ANNEX J — DEPLOYMENT AND PLATFORM MATRICES

## J.1 Endpoint Platform Support Grid

| Platform | CLI runtime | Keyring tier | Engine artifact | Notes |
|---|---|---|---|---|
| macOS amd64/arm64 | Node ≥20 | Keychain (Tier I) | darwin-* static | Gatekeeper quarantine: remove xattr on manual installs |
| Linux glibc/musl ×64/arm64 | Node ≥20 | Secret Service if daemon present else II/III | linux-* static | Headless servers expect env passphrase |
| Windows amd64/arm64 | Node ≥20 | Credential Manager (Tier I) | windows-*.exe | ExecutionPolicy irrelevant (native binary); Defender heuristics occasionally flag unsigned Go binaries — allowlist guidance |
| Android/Termux | Termux node + shim discipline | None → Tier III warning | linux-arm64 via source-build precedence | Shebang rewrite + symlink doctrine mandatory (PM-02b) |

## J.2 First-Run Sequences Per Platform

Uniform logical order (§63) with platform deltas: credential-manager permission prompts (macOS/Win) on first secret write; keyring daemon absence messaging variants (Linux DE-dependent); Termux package prerequisites (node, go for source builds, binutils for shasum equivalences).

## J.3 Banner Message Catalog (Canonical Strings)

Provenance line: building-from-source / installed-from-cache / downloaded-checksum-verified / override-path. Exposure line: loopback-only vs bound address with auth-enabled note. Daemon lines: decryptor ready with pid; engine dev-start block (bridge URL, decryptor URL, optional mdns line). Attestation lines: two-factor verified; headless-deferred notice. Ban terminal: instrument-burned phrasing distinct from wrong-code phrasing. Any wording change touching triage strings (Annex C) requires catalog amendment same-train.

\newpage

# ANNEX K — TEST FIXTURE AND VECTOR DOCTRINE

## K.1 Vector Classes Owed to the Repository (OI-3)

Class V-1: F2FA derivation vectors across window boundaries including negative-rendering case and multi-byte window values crossing 2²⁴. Class V-2: res54 envelope round-trips per generation incl. AAD transplant-negative tests. Class V-3: PBKDF2/scrypt parameter pinning vectors guarding accidental parameter drift. Class V-4: opaque-digest known-answer pairs. Publication format: JSON fixture files consumed by both TS and Go test harnesses — single source of truth preventing dual-maintenance drift (the exact failure mode PM-07 institutionalized).

## K.2 Adversarial Harness Inventory

H-RST: connect/RST mid-response against every listener (survival assertion). H-TAMPER: bit-flip release artifact → refusal chain assertion. H-PROBE: unauthenticated method sweep → uniform gate refusals. H-CLOCK: skew injection ±(step+ε) → deterministic verification outcomes. H-REPLAY: lease reuse post-binding-change → binding mismatch refusal.

## K.3 Release Gate Composition

Ship requires: unit suites green; harness inventory green on all six artifacts; Annex C catalog diff-clean or amended; revision ledger entry; checksums published; canary soak ≥24h for transport-touching changes.

\newpage

# ANNEX L — EXTENDED GLOSSARY AND ACRONYM REGISTER

Terms defined once here; sections cite rather than redefine. Acronyms expanded at first use and cross-linked.

AAL — Authenticator Assurance Level; AAL2 denotes possession-factor-verified sessions.
AAD — Additional Authenticated Data; associated bytes authenticated but not encrypted; res54 binds identity context here.
AEAD — Authenticated Encryption with Associated Data; GCM is the instantiated primitive throughout.
Anon key — Public passage constant for gateway traversal; explicitly not classified.
Attestation triple — Stored shape {seed, lease, expiry} backing guard reuse.
Binding — Origin fingerprint digest embedded in leases and recomputed at validation.
Bridge — Path-oriented function serving engine listing/meta/upload negotiation.
Brute threshold — Failure count/time window triggering instrument bans (3/5min).
CIP — Client Integrity Protocol; scored attestation evaluated by gateway when registry demands.
Chunk manifest — tags[0] JSON describing per-chunk paths/buckets/indexes/key pointer.
Claim check — Pattern of storing capability server-side and passing references (signed URLs).
Cold path — First-decrypt flow including key fetch and full fan-in.
Consent surface — Dashboard page approving device authorization requests.
Custodian — Named role accountable for this document's accuracy.
Daemon set — Decryptor + engine (+ host api when active).
Data plane — Chunk byte movement between endpoint and substrate.
Day seed — Non-null custody column in seed rows; rotation input slot.
DECRYPTOR card — Dashboard presence artifact from structured key naming.
Digest resolution — SHA-256 lookup contract for opaque bearers.
Display-once — Discipline governing minted secrets shown exactly once.
Doctor — Environment sanity sweep command; first triage step.
Drift — Allowed ±1 verification window offset on time-based factors.
Envelope generation — res54 v1/v2/v3 container family member.
Fail-closed — Policy of refusing under doubt, including infra errors.
Fingerprint — Machine identity artifact surviving re-login.
Fixture — Repository-pinned test vector consumed cross-language.
FUSE — Kernel filesystem interface; scaffolded future mode.
Gateway — kza-prel issuer endpoint evaluating layered policy.
Guard — CLI module mediating privileged commands.
HKDF — HMAC-based Extract-and-Expand KDF; drives v3 chain.
Host api — Local REST mirror daemon.
Hot path — Cached or repeated request servicing route.
IDOR — Insecure Direct Object Reference; mitigated via ownership assertions.
Inflight map — Daemon de-duplication structure for concurrent identical fetches.
Instrument — Any credential artifact (token, key, password, seed).
Issuer — Gateway role minting signed leases.
KEK — Key Encryption Key wrapping per-file keys platform-side.
Lease — PREL token colloquial.
Listing TTL — Fifteen-second cache validity for directory views.
Live re-read — Doctrine of reloading instruments at request time.
Loopback doctrine — Default bind restriction to 127.0.0.1.
Machine id — Permanent install fingerprint artifact.
Manifest — Signed download descriptor: urls, buckets, metadata, key/user context.
MicroRedis — Embedded RESP store backing host api limits/nonces.
mDNS — Multicast DNS advertisement; opt-in only.
Nonce replay cache — Anti-replay store for signed-request timestamps.
Opaque token — Random bearer verified by digest lookup.
Ownership assertion — files.user_id == resolved principal check.
PBKDF2 — Password-based KDF used for WebDAV verifier.
PIDFILE — Session record enabling deterministic stop.
Plaintext boundary — Architectural line crossing which bytes become readable.
PREL — Privileged Resource Lease.
Probe cycle — Keyring availability test via set/get/delete round-trip.
Profile — Host api security preset (standard/hardened/paranoid).
Range arithmetic — Byte-slicing semantics over whole-object buffers.
Reaper — Session cleanup policy for abandoned upload plans.
Registry — Policy table gating protectable functions.
res54 — House envelope family name.
RESP — Redis serialization protocol dialect spoken by MicroRedis.
Revocation cascade — kza-admin revoke consuming sessions/seeds/auth.
Root-caused residue — Doctrinal paragraph born from an incident.
Scrypt — Memory-hard KDF for vault master derivation.
Seed — Server-issued F2FA derivation secret.
Sentinel tier — Detection services feeding threat events.
Session ledger — kza_prel_sessions record of minted leases.
Shadow ban — Poison-response mode concealed from subject.
Shelf-life — Local conservative clamp on stored lease reuse.
Signed URL — Time-boxed single-object capability URL.
Soft delete — is_deleted flag pattern with restore verb.
SquidFS — Go data-plane engine.
Sticky tier — Backend persistence rule preventing secret straddling.
STRIDE — Spoof/Tamper/Repudiate/Info-disclose/DoS/Elevate taxonomy.
Substrate — Object storage pool holding envelopes.
Supervisor — CLI component ensuring singleton daemon ownership.
T1/T2/T3 — Trust domains: endpoint/platform/substrate.
Tier I/II/III — Secret storage hierarchy.
TOTP — RFC-6238 time factor enrolled web-side.
Trace — Narrative protocol walkthrough (Part XXIII).
Trust domain — Partition with distinct adversary assumptions (§2).
u64LE fold — Ratified F2FA byte construction (§25).
Veil — Privacy/profiling export subsystem.
Verifier file — PBKDF2 line enabling WebDAV gate.
WebDAV gate — Outer Basic-auth wrapper around method dispatch.
Whitelist ops — Registry allowlist semantics for operations.
Workspace — Tenancy partition scoping queries.
Zero-byte class — PM-03b empty-success defect family.

\newpage

# ANNEX M — COMPLETE MESSAGE AND LOG-LINE CATALOG

Canonical operator-facing strings. Triage tooling may match exactly; wording changes touching these require catalog amendment (§J.3). Format: source component · string · meaning · action.

## M.1 Provisioning and Banner Lines

| Source | String fragment | Meaning | Action |
|---|---|---|---|
| CLI/provisioning | building squidfs from ~/squidfs … | Source-truth build engaged (precedence 2) | None; wait for installed line |
| CLI/provisioning | installed → ~/.squidcloud/bin/squidfs | Universal cache refreshed | None |
| CLI/provisioning | downloaded official squidfs → … (checksum verified) | Release path with integrity pass | None |
| CLI/provisioning | warning: checksums.txt unavailable — skipping integrity check | Degraded trust acquisition | Investigate channel; prefer override/source |
| CLI/provisioning | squidfs provision failed: sha256 mismatch… | Tamper refusal (DR-14) | Preserve artifact; treat channel suspect |
| CLI/mount | SquidFS WebDAV → http://localhost:<port>/ | Mode banner | None |
| CLI/mount | files stay encrypted end-to-end; edits sync back automatically. Ctrl+C to stop. | Posture reminder | None |
| CLI/mount | WebDAV password (generated — shown once…) | Fresh credential display | Store in manager now; never re-displayed |

## M.2 Daemon Lifecycle Lines

| Source | Fragment | Meaning | Action |
|---|---|---|---|
| Supervisor | decryptor: replacing stale instance on :6763 | Ownership recycle | None |
| Supervisor | decryptor: ready on 127.0.0.1:6763 (pid N) | Healthy singleton | None |
| Engine | squidfs dev starting… | Boot begins | None |
| Engine | Bridge: <url> | Control endpoint wired | None |
| Engine | Decryptor: http://127.0.0.1:6763 | Proxy authority wired (absence ⇒ pre-PM-01 binary) | Upgrade if absent unexpectedly |
| Engine | mDNS registered: <host>._webdav._tcp.local on port N | LAN advertisement active (opt-in only) | Confirm intent |
| Engine | WebDAV server on port N / http://<host>:N | Listener up | Verify bind host matches posture |
| Engine | WebDAV error: <method> <path>: file does not exist | Not-found surfacing w/ attribution | Benign for probe paths (PM-03c); investigate user-data paths |
| Engine | [decryptor] <id-prefix>: HTTP 404 (no fallback) | Upstream not found surfaced cleanly | Expected for missing ids |
| Engine | [decryptor] unreachable (<err>) — falling back to API | Transport failure leg | Check daemon; supervisor bounce |
| Host api | Local API host listening http://127.0.0.1:8065 | Liveness | None |
| Host api | profile <p> · mode=<m> | Posture echo | Confirm intended |
| Host api | micro-redis 127.0.0.1:8066 (…) | Backing store port | None |
| Host api | limits <rps>/key · body ≤ <cap> · ips=<list> | Effective limits | Confirm allowlist intent |
| Host api | audit ~/.squidcloud/host-audit.log | Trail location | Ship with incidents |
| Host api | WebDAV password auth: enabled / none (loopback-only bind) | Gate state at boot | Non-loopback+none cannot occur (refusal) |
| Host api | refusing to bind non-loopback without --auth-hash | Structural abort (§45) | Provide verifier or revert bind |

## M.3 Attestation and Guard Lines

| Source | Fragment | Meaning | Action |
|---|---|---|---|
| CLI guard | TOTP code (6 digits): | Interactive challenge | Enter authenticator code |
| CLI guard | AAL2 verified | Lease established | Proceeds |
| CLI guard | ⚠ no OS keyring available — secrets stored 0600-plain… | Tier III selection disclosure | Acknowledge; consider Tier II passphrase |
| CLI guard | vault passphrase (new): | Tier II creation | Choose ≥8 chars; headless uses env |
| CLI login | Two-factor verified | Login attestation success | None |
| CLI login | TOTP two-factor authentication is mandatory…Enroll at <settings URL> | Unenrolled hard stop | Enroll then retry |
| CLI guard | This device has been permanently banned… | Instrument burned | Admin intake E.3 |
| CLI guard | Invalid verification code. N attempts left… | Countdown feedback | Careful retry; check clock |
| CLI guard | Too many failed codes — this device has been permanently banned. | Threshold crossed now | Intake script |
| CLI guard | KZA gateway rejected step-up (<detail>) | Lease exchange failure post-TOTP-success | PM-07 checklist; upgrade both sides |
| CLI guard | Privileged command '<op>' requires a fresh TOTP verification. | Non-interactive fail-closed | Run interactively |

## M.4 Failure Signatures (Cross-Reference)

Full code tables live in Annex C; this catalog intentionally excludes duplicated bodies to keep one authoritative source per string class.

\newpage

# ANNEX N — EXIT CODES, SIGNALS, AND LIFECYCLE STATE MACHINES

## N.1 Exit Code Ledger

| Code | Producer context |
|---|---|
| 0 | Success paths incl. deliberate clean exits after async teardown |
| 1 | User-facing failures: auth absent, attestation refused/banned/three-strikes, enrollment gate, device-code expiry, tamper refusal, non-interactive privileged block |
| 130-style propagation | SIGINT passthrough where child owns terminal session (mount/api) |

Doctrine: scripts should branch only on zero/non-zero plus Annex C message capture; finer granularity reserved for future contract amendment.

## N.2 Signal Disposition

| Signal | Daemon set behavior |
|---|---|
| SIGINT/SIGTERM | Graceful shutdown: unregister mDNS, close listeners, flush audit tail (best-effort), presence-card OFFLINE suffix (decryptor), pidfile removal (engine/host), exit 0 |
| SIGHUP | Unhandled (default terminate) — daemonization is explicitly out of scope; process managers own restart policy |
| SIGKILL | Unclean: stale pidfile/presence-card residue expected; self-heal on next start (§96) |

## N.3 State Machines

**Device row:** pending → authorized → active → {revoked | expired}. Guards: banned flag orthogonal overlay consulted before lifecycle transitions matter.

**Upload session:** init(plan minted) → chunks PUT(n/total) → complete(verify HEAD each) → registered(file row) & consumed. Abandonment ⇒ reaper policy platform-side.

**Share:** created(active) → constraints evaluated per access (expiry, download cap, view-only) → deactivated(admin/user).

**Attestation (client-side):** empty → seed-held(login verify) → leased(exchange success) → expired(shelf elapsed) → re-prompt loop. Ban path exits machine from any state.

**Daemon ownership (6763):** free → spawning(winner writes state) → ready(health 200) → reused(by supervisors while secret matches) → replaced(stale/zombie recycle path) .

\newpage

# ANNEX O — STRIDE ANALYSIS PER COMPONENT

Method: for each component, enumerate S/T/R/I/D/E with standing mitigations and residual risk rating (Low/Med/High). Residuals feed the open-items register.

## O.1 Decryptor Daemon

| Threat | Vector | Mitigation | Residual |
|---|---|---|---|
| S | Local process impersonates daemon post-crash (bind steal) | State-file secret continuity check; supervisor replaces stale owners | Med — race window pre-recycle |
| T | Response tamper en route loopback | Loopback only; no cross-host path | Low |
| R | Deniability of plaintext service | Session header + audit absence by design | High-by-design (local trust) |
| I | State-file read by same-user malware → capability theft | 0600; acknowledged §95 | **High accepted** |
| D | Request flood of unique ids | Inflight dedup bounds concurrency; upstream rate limits | Med |
| E | N/A (no privilege boundary crossed) | — | — |

## O.2 SquidFS Engine

| Threat | Mitigation | Residual |
|---|---|---|
| S remote caller identity spoof | Auth gate outer wrap; Basic verifier | Low w/ password; n/a loopback-no-auth posture is explicit opt-out |
| T cache poisoning | Single-user model; keyed by file id | Low |
| R audit | Platform-side access logs via signed URLs | Med (endpoint-local ops unaudited centrally) |
| I zero-byte/empty-success class | PM-03b invariant (§41) | Low post-fix |
| D listing stampede | TTL cache; bridge call coalescing per miss | Low-Med |
| E verb-level bypass regression | Checklist §91 gate placement rule | Low |

## O.3 cli-totp

| Threat | Mitigation | Residual |
|---|---|---|
| S bearer replay from logs | Digest resolution; redaction scrubbers | Low |
| T factor secret exfil via SQL surface | Service-role isolation; read-only select | Low |
| R attempt accounting disputes | Threat-event rows w/ snapshots | Low |
| I secret exposure in responses | Never returned; only derived acceptance | Low |
| D brute window exhaustion vs legit user | Device-scoped bans spare account (D-04); admin lift | Accepted |
| E gateway flag misconfig (PM-05) | Deploy checklist item | Med process-risk |

## O.4 KZA Gateway

| Threat | Mitigation | Residual |
|---|---|---|
| S identity confusion across token classes | Ordered branch precedence incl. opaque-token tail | Low |
| T token mint outside RPC | RPC sole signer; function code holds no keys | Low |
| R repudiation of privileged lease use | Sessions ledger + binding fingerprint | Low-Med (NAT-shared IP caveat) |
| I context over-broad in responses | Minimal ctx fields; f2fa_window numeric only | Low |
| D registry-wide disable lever exists (env) | Incident-only; change-controlled | Process risk |
| E chain-depth bypass | Depth ceiling + parent hash lineage | Low |

## O.5 Host API / MicroRedis

| Threat | Mitigation | Residual |
|---|---|---|
| S key forgery | Prefix-indexed digest verify w/ salt concat order fixed | Low |
| T redis value tamper local | Same-user trust domain | Accepted |
| R DENY/OK lines | Audit stream §52 best-effort | Med durability |
| I secrets inventory endpoint | Names/presence only, never values | Low |
| D body-cap memory pressure | Profile caps; paranoid shrinks 8× | Med on standard profile dedicated boxes |
| E profile downgrade via override flags | Operator intent explicit at boot line | Low |

## O.6 Secret Store Tiers

| Threat | Mitigation | Residual |
|---|---|---|
| S keyring prompt spoof by malware | OS-native dialogs; user training | Med |
| T vault ciphertext tamper | GCM auth tag | Low |
| R — | n/a local | — |
| I Tier III plain file | 0600 + loud warning; acknowledged Android reality | **High accepted** (platform limit) |
| D vault lockout via forgotten passphrase | Env override path; recovery = re-login | Med UX |
| E tier-straddling logout gaps | Sticky backend marker + migrate-on-login | Low |

\newpage

# ANNEX P — CAPACITY AND TUNING GUIDE

## P.1 Sizing Classes

| Class | Profile suggestion | Cache ceiling note | Expected concurrent mounts |
|---|---|---|---|
| Laptop solo | standard, keyed optional | default 500MB | 1 engine + shared daemon |
| Workstation team box | hardened, keyed, ips=operator subnet | consider lower ceiling if RAM-tight | ≤3 engines (ports distinct) sharing one daemon |
| Headless build box | paranoid + env passphrase | minimal cache | automation only; non-interactive attestation constraints apply (§11) |
| Android/Termux | standard, loopback, Tier III | small cache advisable | single mount; avoid parallel engines |

## P.2 Tuning Knobs and Effects

| Knob | Raise when | Cost |
|---|---|---|
| rps/burst per key | Legit automation bursts observed | Memory trivial; platform upstream limits still bind control plane |
| Body cap | Large raw uploads via host api | Per-request RSS high-water |
| Listing TTL (code const) | Very churny directories cause staleness complaints | More bridge calls |
| Chunk workers (code const) | Rarely; high-BDP links with proven substrate headroom | 403/429 noise historically (§76) |
| mDNS enable | LAN discovery workflows demanded | TH-02 surface returns deliberately |

## P.3 Observability Baseline

Healthy steady-state signatures: decryptor inflight map drains to empty between bursts; engine cache hit ratio visible via repeat-read latency collapse; host api audit OK-line durations stable p95 < platform round-trip; zero DENY lines from own IP (self-inflicted auth churn). Deviations triage via Annex E matrices before tuning changes.

\newpage

# ANNEX Q — REVIEWER QUESTION BANK (ASSESSMENT INSTRUMENT)

Used in Module II/IV examinations and periodic control re-certification. Each question lists the expected answer locus (§ reference) — examiners grade against doctrine fidelity, not verbosity.

1. Walk the canonical read chain end-to-end naming every hop, port, and header. (§7)
2. Why is key material UTF-8-sliced rather than hex-decoded, and what failure signature betrays an implementation that got this wrong? (§17)
3. Recite the v3 AAD template exactly and explain each bound field's attack value. (§19)
4. Which envelope generation lacks identity binding, and what transplant attack does that permit? (§20 vs §19)
5. State the single-seed doctrine and its insertion-side preconditions. (§32, D.3)
6. Why must the attestation function deploy with gateway JWT verification disabled? (PM-05)
7. Give the two distinct HTTP statuses the daemon may return for a missing file and the engine behaviors each triggers. (§35, §41)
8. What class of defect does "HTTP 200 with zero bytes" indicate, and which invariant now forbids it? (PM-03b; §41)
9. Explain why fallback-to-platform fires only on transport failure. (PM-04; §41)
10. Derive by hand the F2FA byte-construction for window 59,000,000 and explain why shift-based extraction was wrong. (§25, PM-07)
11. May a rendered F2FA code begin with '-'? Justify from the folding semantics. (DR-05)
12. Why does the client make exactly one lease-exchange attempt? (DR-12)
13. Which ban entity types can cli-totp write, and which is it forbidden to write? (§27)
14. An operator demands account-level lockout after brute attempts. Cite the directive and respond. (D-04)
15. Where do TOTP shared secrets live end-to-end, and why can the CLI never enroll them? (DR-03)
16. Name the three secret tiers, their selection order, and the stickiness rule. (§13)
17. What must the metadata file never contain, and what proves compliance after login? (§12–14)
18. Which precedence step overwrites the universal binary cache and why was that order chosen? (PM-01; §58)
19. What distinguishes missing-checksums behavior from mismatched-checksums behavior, and why the asymmetry? (DR-14)
20. Point to where the WebDAV auth gate sits relative to method dispatch and explain the historical exploit that motivates it. (§46)
21. Under what condition will the engine refuse to open a non-loopback listener? (§45)
22. Why is mDNS suppressed for loopback binds even when enabled? (§43)
23. List the three transport-guard layers added after PM-08. (Annex M/N; §51)
24. What does the presence-card name grammar encode, and what suffix marks graceful shutdown? (§36)
25. Why does /health intentionally omit authentication? (§34)
26. Which registry columns were discovered missing at deploy time, and what process gap did that expose? (PM-06)
27. State the exact TTLs: listing cache, lease, sb_token shelf, opaque token validity. (§99)
28. What is the only sanctioned lever that disables the entire PREL gateway, and what class of event justifies it? (Annex C2 register)
29. Describe the ownership assertion sequence on a download request including deleted-state handling. (§G.2)
30. Why are BYOK responses 422 rather than 403? (§G.5 philosophy)

## Q.II Scenario Bank (Orals)

S1: Post-relogin mount serves 401s via fallback leg. Diagnose aloud citing PM numbers. 
S2: User reports "banned" but insists codes were correct. Reconstruct PM-07 timeline and identify which shipped build pair exhibits it. 
S3: Canary fleet reports checksum refusals simultaneously. Execute IR-3 containment order verbally. 
S4: Auditor asks to prove no plaintext transits T2. Select evidence from Parts V/IX/XII. 
S5: New engineer proposes moving auth gate inside GET handler for clarity. Refuse with §46/§91 citations and offer the correct refactor shape.

\newpage

# ANNEX R — HARDENING CYCLE CHRONOLOGY (CONTEMPORANEOUS LOG DISTILLED)

Entries are ordered as executed during the consolidated hardening cycle; each notes the doctrinal artifact it produced.

| Seq | Action | Doctrine output |
|---|---|---|
| 01 | Supervisor script relocation into package module-cache subtree | §33 materialization doctrine; PM-02a |
| 02 | Engine acquisition precedence inversion (source-first) | §58; PM-01 closure |
| 03 | Decryptor route pattern widened + not-found status split | §35; PM-03a |
| 04 | Content-path unconditional proxy invariant | §41; PM-03b closure |
| 05 | Live credential re-read per file request | §35 step 1; DR-11; PM-04 closure |
| 06 | Fallback restriction to transport-unreachable | §41; PM-04 |
| 07 | ESM dirname shim correction in supervisor | PM-02 family |
| 08 | CLI releases 3.0.14→3.0.16 through fix ladder | Revision ledger context |
| 09 | WebDAV outer auth gate + PBKDF2 verifier format ratified | Part X; DR-10 |
| 10 | Loopback default bind + fail-closed remote rule | §45 |
| 11 | mDNS opt-in suppression logic | §43; DR-07 |
| 12 | Binary checksum enforcement | §58; DR-14 |
| 13 | Secret tier store implementation + legacy migration | Part IV |
| 14 | Persistent machine identifier artifact | §9; enables D-04 |
| 15 | Login-time mandatory attestation flow | §11 |
| 16 | Poll-time issuance gate (server) | §9 step 5 |
| 17 | cli-totp function authored/deployed (no-verify-jwt lesson PM-05) | Part VII |
| 18 | Seed insert column conformance fixes (day/session NOT NULL) | PM-06; D.3 |
| 19 | kza-prel opaque-token identity branch | §23 |
| 20 | computeF2FACode buffer-view repair (first latent bug) | PM-07 phase 1 |
| 21 | Encoder divergence discovery via deployed-impl diffing | PM-07 phase 2 methodology |
| 22 | Ratified u64LE encoder both sides + single-attempt policy | §25; DR-05/12 |
| 23 | Device-scoped ban entities live | §27; D-04 |
| 24 | Guard wiring across privileged command set | §26 |
| 25 | Dashboard consent AAL2 gate + devices rendering refresh | Part XIV |
| 26 | Transport guards (microredis/http/daemon filter) release 3.1.3 | §51; PM-08 |
| 27 | Full KZA chain live-fire: opaque token → seed → lease issued | §66 ledger row |

\newpage

# ANNEX G2 — ENDPOINT DOSSIERS (DEEP REFERENCE)

Format per dossier: Purpose ¶ · Request contract table · Response fields table · Error matrix · Consumers · Invariants · Behavioral trace. These expand Annex G rows into standalone reference pages.

## D-EP-01 POST cli-oauth/device

Purpose: initiate device-authorization grant; create pending row bound to machine fingerprint.

| Field sent | Type | Constraint |
|---|---|---|
| client_id | string | Fixed instrument family tag |
| machine_id | 32-hex | Persistent artifact; stable across logins |
| device_name | string | Hostname or label |
| platform | string | os-arch composite |

| Field returned | Meaning |
|---|---|
| device_code | Poll correlation secret |
| user_code | Human transcription code |
| verification_url / verify_url | Consent deep link (code embedded) |
| interval | Poll cadence seconds |
| expires_in | Grant lifetime seconds |

Errors: malformed body ⇒ 400 family; infrastructure ⇒ 500. No auth required (pre-identity bootstrap).

Consumers: login-device primary; login-oauth uses sibling /token exchange instead.

Invariants: machine_id persisted by caller before call; device_code never logged at info level by callers.

Trace: register → consent pending → (later) authorized transition visible via poll status field.

## D-EP-02 POST cli-oauth/device/poll

Purpose: redeem authorized device row for instrument envelope.

Request: client_id + device_code.

Response branches:

| Branch | Shape |
|---|---|
| pending | {status:"pending", authorization_pending:true} |
| slow_down | {error/slow_down} — caller adds 3s cadence penalty |
| TOTP gate refusal | 403 {error, code:TOTP_REQUIRED, enrollment_url} |
| issued | token envelope (below) |
| expired | terminal expired flag |

Token envelope fields: token + access_token duplication (compat), token_prefix, user_email, user_id, device_id, expires_in (~30d), scope, anon_key.

Invariants: TOTP mandatory factor check precedes mint (fail-closed 500 on lookup infra error); token stored server-side only as digest; single redemption (status flips active).

## D-EP-03 POST cli-totp (action dispatch)

Covered exhaustively in Part VII; dossier restates wire essentials: headers bearer(opaque)+machine(+optional device-id); actions status/verify; verify success returns seed + ttl 900; failure countdown strings; ban pre-check ordering; constant-time factor compare; ±1 drift; SQL pool max 1 closed in finally.

## D-EP-04 GET /api/v1/files

Query params: page≥1; per_page∈[1,100] default 50; search substring (ilike name); folder_id exact parent filter.

| Response field | Notes |
|---|---|
| files[] | Full records incl. tags manifest JSON stringified first element |
| folders[] | Sibling tree slice |
| total_files/folders, page, per_page, total_pages | Pagination envelope |

Invariants: workspace scoping always applied; is_deleted excluded; order created_at desc (recency tie-break doctrine for name resolution).

## D-EP-05 GET /api/v1/download/:id (non-signed)

Preconditions sequence: resolve by id+workspace → 404 if absent; is_deleted ⇒ 404 deleted-message; flavor routing:

| Flavor | Behavior |
|---|---|
| res54_distributed + encrypted | Manifest parse → BYOK demand (422) when placeholder family → server decrypt aggregate stream |
| res54_distributed + plain | Chunk concat passthrough stream |
| other storage_path | Supabase-storage object download |

Headers: attachment disposition with record name; content-type from record.

Error matrix: invalid metadata JSON ⇒ 500; missing chunks ⇒ 500; chunk fetch fail ⇒ 500 w/index; AEAD mismatch ⇒ 422 key-mismatch phrasing; BYOK missing key ⇒ 422 demand phrasing.

## D-EP-06 GET /api/v1/download/:id?signed=true

Returns manifest only (no bytes): signed_urls[] aligned to filtered chunks; chunk_buckets map index→bucket; file_name/type/size; encryption_key populated with usable key when held (placeholder otherwise); user_id mandatory for v3 AAD context. Consumer invariant: treat urls as single-object get-one capabilities; never persist beyond TTL.

## D-EP-07 POST /api/v1/upload (plan mint)

Inputs name/type/size/folder_id. Server computes tiered chunk size (512K base; 1M >10MB; 2M >50MB), chunk count, path template userId/uploads/<uploadId>/<i>.bin; persists session row incl. generated key; returns upload_id, file_id (pre-minted), encryption_key, signed PUT url array with bucket assignments, chunk_size, totals.

Consumer contract: PUT bodies exactly chunk_size except final; completion HEAD-verifies existence — zero-byte success impossible.

## D-EP-08 POST /api/v1/upload/complete

Inputs upload_id (+legacy variants accept file_id/chunks/key). Verifies each declared chunk exists via signed HEAD; builds canonical res54 metadata JSON; inserts files row (encrypted true/false per legacy semantics); deletes session. Uniqueness violation ⇒ 409.

## D-EP-09 POST /api/v1/upload/encrypted

Server-crypto variant: accepts plaintext chunk references, downloads, envelopes via canonical v2 builder (64KB sub-chunks; AAD embedding ordinal/count/timestamp), uploads ciphertext, registers record with encrypted=true and real key column value.

## D-EP-10 file-key

Body fileId. Auth precedence: opaque digest resolution → JWT getUser → PREL fallback lane. Ownership assertion precedes vault read. Vault miss ⇒ 404 'not available'. Unwrap failure ⇒ 500 with diag{reason-prefix, master_env presence}. Success ⇒ {success, key} plaintext string (TLS-only transit).

## D-EP-11 squidfs-bridge action:list

Input folder_id name-form ('' root). Returns folders[]+files[] with authoritative UUID ids, names, sizes, encryption_key fingerprints, timestamps. Engine caches directly keyed by dirPath composition rules (§39). Auth: anon passage + user bearer.

## D-EP-12 kza-prel/gateway

Layered pipeline recap with branch table:

| Layer | Pass condition | Failure shape |
|---|---|---|
| Registry | active row present | 501 UNREGISTERED |
| Op scope | op ∈ allowed_operations (if non-empty) | 403 OPERATION_DENIED |
| Identity | service-role ‖ JWT ‖ cb_ digest ‖ opaque-device | 401 MISSING after all branches |
| F2FA (if flagged) | newest-active seed drift-match | 401 MISSING / 403 FAILED / 429 BRUTE |
| CIP (if flagged) | score ≥ threshold header | 403 CIP_FAILED |

Issue side-effects: sessions ledger insert; binding embed; TTL from registry (guard=900).

## D-EP-13 kza-admin verbs

ban(user/ip,tier,shadow) — BLACK forces auth signOut; unban deactivates matches; revoke cascades sessions+seeds+signOut; export returns veil profile. All service-role gated; assumed audited upstream.

\newpage

# ANNEX B2 — COMMAND DOSSIERS (DEEP REFERENCE)

Per-command: contract narrative, argument/flag table, side effects, exit semantics, inter-process interactions, triage hooks.

## CD-01 login (device default / oauth variant)

Narrative: establishes identity instrument set for the endpoint. The device path prints code+URL and loops polling; the oauth path spins a loopback listener for redirect capture. Both converge on post-issuance attestation.

| Aspect | Detail |
|---|---|
| Flags | --code <usercode> selects explicit device entry |
| Secrets written | token→tier slot; sb_token when callback supplies JWT; anon key slot |
| Side effects | machine-id artifact; legacy migration; device row activation server-side |
| Exit | 0 success incl. clean socket teardown; 1 expiry/refusal/ban/three-strikes |
| Interactions | Supervisor untouched; existing daemons continue with old instruments until live-reread picks new ones |

Triage: Annex C login domain; PM-09 for shim crashes; PM-05 signature on UNAUTHORIZED_INVALID_JWT_FORMAT reaching cli-totp.

## CD-02 logout

Removes metadata file and every secret slot in resolved tier. Does not touch server rows. Idempotent; safe in scripts.

## CD-03 whoami

Liveness echo: email, plan markers, prefix, horizon. Non-privileged by doctrine (usable in health scripts without step-up).

## CD-04 files ls

Cache-aware listing; refresh flag bypasses TTL. Output rows carry stable numbered refs consumed by sibling commands. Failure: auth prompts interactive re-login when TTY else error.

## CD-05 files up

Streaming pipeline command: plan → read → envelope → parallel PUT → complete. Quiet flag silences progress. Partial failure leaves session row; retry safe (new session recommended over resume — resume unimplemented by doctrine).

## CD-06 files rm/mv/cp/rename

Ref-resolution identical to host api (#n > id-prefix > name, recency tie-break). rm soft-deletes. All non-privileged except storage rm (G).

## CD-07 files share

Creates platform share with optional constraints; prints URL. View-only and caps enforced platform-side at redemption.

## CD-08 files dl

Content pipeline reuse: daemon-first, transport-fallback otherwise. Output to path or stdout; range flags pass through where applicable.

## CD-09 storage search/rm

Search executes indexed query returning ref-numbered results consumable downstream. rm is privileged-gated soft delete with local audit line regardless of outcome.

## CD-10 keys add / rm / ls

add (G): mint, display-once raw, persist prefix metadata. rm (G): revoke by id/prefix match. ls (A): metadata-only listing — raw unrecoverable post-mint by design.

## CD-11 fs mount

Full orchestration per §63 sequence. Flag table:

| Flag | Effect |
|---|---|
| --mount <path> | FUSE-mode target (scaffolded) |
| --webdav | Force WebDAV mode |
| --port <n> | Listener port (default 8099) |
| --password † | Operator-supplied verifier source |
| --no-password | Explicit opt-out; loopback-only enforcement still applies structurally |
| --bind <host> | Bind override (non-loopback demands verifier) |
| --mdns | Enable LAN advertisement |

Side effects: engine binary acquisition; cb_ key negotiation or override; decryptor ensure; verifier file 0600 write; child spawn env composition (api/auth tokens, decryptor url+secret, hash path); pidfile write; fresh-password one-time display.

Exit semantics: stage-order failures abort pre-spawn; runtime child exit propagates code; SIGINT cascades graceful teardown.

## CD-12 fs webdav

Alias forcing webdav mode; identical flag surface and pipeline.

## CD-13 fs status / fs stop

Status reads pidfile, probes liveness, reports mode/port/uptime; stale detection cleans record. Stop sends TERM, awaits exit, removes pidfile; decryptor intentionally survives (reuse doctrine) — §65 covers full teardown.

## CD-14 host api

Boots profile-configured listeners (api 8065, redis +1). Flags: ports, profile, mode, extra mints, hmac secret†, rps/body-cap/ip overrides. Installs audit stream + three-layer transport guards. Bootstrap keys displayed once in keyed mode.

## CD-15 host status / stop

Symmetric lifecycle pair against host pidfile; status includes redis stats passthrough.

## CD-16 util version / doctor

Version banner includes runtime triple (node/platform/arch). Doctor executes environment sweep producing a posture report: config dir modes, tier probe result and marker, daemon reachability matrix, engine provenance line, clock-skew hint, enrollment state summary. Doctor output is the expected attachment for any support intake per §65/E-runnables.

\newpage

# ANNEX C3 — ERROR CODE DOSSIERS

Each dossier: exact code · producer · trigger conditions · client-visible shape · operator remedy · related doctrine.

## EC-01 TOTP_REQUIRED
Producer: poll handler gate. Trigger: authorized transition with zero verified factors. Shape: 403 JSON {error,code,enrollment_url}. Remedy: enroll at canonical settings URL; rerun login. Doctrine: §9 step 5; DR-13.

## EC-02 KZA_DEVICE_BANNED
Producer: cli-totp pre-check. Trigger: active DEVICE/MACHINE ban entity for resolved device/fingerprint. Shape: 403 {error,code}. Remedy: E.3 intake; admin unban only post-cause documentation. Doctrine: §27; D-04.

## EC-03 KZA_TOTP_FAILED (countdown family)
Producer: verify path mismatch pre-threshold. Shape: 403 with remaining-attempt sentence. Remedy: careful re-entry; clock skew check via doctor. Doctrine: §31.

## EC-04 KZA_PREL_F2FA_MISSING / FAILED / BRUTE
Producer: gateway layer-3. FAILED ⇒ seed/window divergence (PM-07 checklist); BRUTE ⇒ ≥3 events/5min. Remedy: upgrade both encoders; wait window for BRUTE; never client-side drift-loop (DR-12).

## EC-05 KZA_PREL_BINDING
Producer: validation fingerprint compare. Trigger: origin IP/UA drift vs issuance. Remedy: re-step-up from stable network; VPN transitions expected cause. Doctrine: §24 binding row.

## EC-06 KZA_PREL_EXPIRED
Producer: lease shelf elapsed. Remedy: guard auto re-prompts; cached triple cleared.

## EC-07 KZA_PREL_UNREGISTERED / OPERATION_DENIED / UNAUTHORIZED_CALLER
Producer: registry policy layers. Remedy: registry diff vs Annex D baseline; change-controlled correction (IR-6).

## EC-08 INVALID_API_KEY (platform fallback leg)
Producer: engine fallback download with stale bearer. Remedy: process bounce (live-reread daemon), confirm supervisor wiring. Doctrine: PM-04.

## EC-09 UNAUTHORIZED_INVALID_JWT_FORMAT
Producer: functions gateway precheck. Trigger: opaque bearer against verify-jwt-enabled deployment of an opaque-auth function. Remedy: redeploy with no-verify-jwt (PM-05).

## EC-10 refusing-to-bind message family
Producer: engine startup structural check. Remedy: supply verifier or revert bind. Doctrine: §45 invariant.

## EC-11 vault passphrase required
Producer: Tier II unlock in non-TTY without env passphrase. Remedy: export SQUIDCLOUD_VAULT_PASSPHRASE or run interactively once.

## EC-12 randomUUID is not defined / bad interpreter / __dirname ESM
Family: install-shim integrity (PM-09/02b/02a). Remedy: reinstall current release; verify symlink discipline.

\newpage

# ANNEX U — INVARIANT CATALOGUE

Every standing invariant, numbered for citation in reviews and PR descriptions. Format: ID · statement · enforcement locus.

## U.1 Identity & Credential Invariants

INV-001 The metadata file shall contain no bearer material. — store migration + writeCredentials discipline
INV-002 Opaque tokens are stored server-side solely as SHA-256 digests. — resolveCliDevice contract
INV-003 Every opaque-auth function resolves identity through the shared contract; no bespoke lookups. — §10
INV-004 Issuance paths fail closed on infrastructure fault. — DR-13
INV-005 Machine fingerprint persists across logins; its deletion is an auditable evasion pattern. — §65
INV-006 Logout removes instruments from every resolved tier. — §12/§IV
INV-007 Secret tiers are sticky per installation. — §13 marker rule

## U.2 Attestation & KZA Invariants

INV-008 Privileged commands execute only with a live lease; non-interactive contexts exit before work. — §26
INV-009 Exactly one gateway exchange per step-up attempt. — DR-12
INV-010 F2FA byte construction uses modulo/division u64LE on both sides; shift extraction prohibited. — PM-07
INV-011 F2FA rendering preserves signed arithmetic; absolute-value normalization prohibited. — DR-05
INV-012 Seed insertion populates all mandated columns (day_seed/session_nonce). — D.3
INV-013 Single active guard seed per user: deactivate-before-insert. — §32
INV-014 TOTP brute punishment writes DEVICE/MACHINE entities only; USER forbidden from this path. — §27
INV-015 Ban pre-check precedes status and verify actions. — §31 ordering

## U.3 Crypto Invariants

INV-016 res54 keys map via UTF-8 first-32 zero-pad; hex-decoding prohibited. — §17
INV-017 Version detection is content-based with ratified attempt order v3→v2→legacy. — §21
INV-018 v3 AAD template is byte-exact; field order/values immutable. — §19
INV-019 AEAD failures surface version+size diagnostics; silent catch prohibited. — §21/§74
INV-020 CSPRNG for every nonce/salt/secret generation. — §73
INV-021 Constant-time comparison for all secret equality checks. — §30/§44/§74

## U.4 Engine & Transport Invariants

INV-022 Any resolvable file serves decrypted bytes or fails loudly; empty-success impossible. — §41
INV-023 Decryptor 404 ⇒ clean not-found propagation; decryptor HTTP error ≠ fallback trigger; fallback reserved for transport-unreachable. — §41
INV-024 Outer auth gate wraps method dispatch; verb-level bypass prohibited. — §46
INV-025 Default bind loopback; non-loopback requires verifier at startup or refuses. — §45
INV-026 mDNS opt-in only; auto-suppressed for loopback. — §43
INV-027 Accepted sockets carry error handlers; reset-class noise silent. — PM-08
INV-028 Daemon-level uncaught filter distinguishes transport resets from fatal defects. — N.2/§51
INV-029 Range responses honor 206 semantics with Content-Range when satisfied. — §41
INV-030 Listing TTL staleness bounded at fifteen seconds; refresh bypass exists. — §39/§76

## U.5 Provisioning & Distribution Invariants

INV-031 Acquisition precedence order fixed; source build overwrites cache. — §58/PM-01
INV-032 Checksum mismatch hard-refuses execution. — DR-14
INV-033 Embedded decryptor source materializes inside module-resolution subtree. — §33/PM-02a
INV-034 Platform shims use rewritten shebang plus symlink linking. — §57/PM-02b

## U.6 Storage Invariants

INV-035 Ownership assertion (owner==resolved principal) precedes any byte service or key unwrap. — G.2/D-EP-10
INV-036 Workspace scoping present on record queries. — §G.2
INV-037 Signed URLs are single-object single-verb time-boxed capabilities. — §53
INV-038 Upload completion verifies chunk existence before registration. — D-EP-08
INV-039 Session rows deleted on completion; abandoned plans reaper-collected. — D-EP-07

\newpage

# ANNEX V — CONFIGURATION DECISION TREES

## V.1 Selecting Host API Profile

Start → Is the box single-operator? 
— yes → Do local tools need keyless access? yes ⇒ standard/open · no ⇒ standard/keyed.
— no → Is network path to listeners restricted to operator subnet? 
—— yes ⇒ hardened + ips override.
—— no ⇒ paranoid (+ hmac if scripts can sign).

## V.2 Choosing Secret Tier Override Behavior

Keyring probe succeeds? → Tier I (never downgrade silently). 
Else vault file exists? → Tier II unlock required. 
Else interactive TTY? → offer Tier II creation; decline ⇒ Tier III with warning. 
Headless env var present? → Tier II without prompt. 
Otherwise Tier III warning printed (disclosure requirement).

## V.3 Mount Failure Routing

Binary stage failure → check precedence inputs (override/source/cache/PATH/release). 
Key negotiation failure → platform reachability; keys surface in dashboard manually. 
Decryptor stage failure → E.2 runbook. 
Verifier stage failure → inspect secret tier availability + flags. 
Spawn failure → env composition/path audit; engine provenance line absent ⇒ acquisition anomaly.

## V.4 Post-Incident Re-Enable Decision Tree (Device Ban)

Cause = operator typos? → educate; unban. 
Cause = unknown origin? → compromise lane: preserve events, rotate instruments, delay unban pending review. 
Cause = clock skew storm? → fix time sync; unban; annotate vector. 
Never unban without recorded cause (E.3).

\newpage

# ANNEX W — BANNER AND POSTURE REPORTING STANDARD

Every daemon banner must communicate, in order: identity line (component/version/runtime triple), exposure line (bind host:port + auth posture), dependency lines (bridge URL, decryptor URL when wired), capability summary lines (routes or mode notes), lifecycle hint (stop mechanism). Rationale: triage begins from screenshots; a compliant banner answers five questions without log access.

Compliance examples: engine banner sequence §M.2; host api block §M.2; absence of any mandated line is itself a defect report against the emitting component.

Posture line grammar: <bind-host>:<port> · auth=<none|password|keyed|hmac> · profile=<p> where applicable. Non-loopback binds MUST render an explicit exposure warning token adjacent to the posture segment — enforced by review checklist §91.

\newpage

# ANNEX X — ASSURANCE EVIDENCE MAP

Maps each Part/Annex control claim to its verification artifact so assessors traverse claim⇒proof without archaeology.

| Claim locus | Evidence artifact | Freshness trigger |
|---|---|---|
| WebDAV gate (Part X) | Live exploit transcript (audit cycle) + §66 row | Gate refactor |
| Loopback doctrine | ss/netstat capture during session | Bind changes |
| Fail-closed remote bind | fail.log refusal capture | Startup edits |
| Mandatory attestation | Non-interactive exit capture; enrollment message | Guard edits |
| Countdown accuracy | Wrong-code response bodies | Verify-path edits |
| Device-ban scoping | Entity rows snapshot post-drill Charlie | Pipeline edits |
| Poll gate | Unenrolled issuance refusal capture | Poll edits |
| KZA end-to-end lease | Gateway issue transcript w/ expiry | Encoder edits |
| Checksum refusal | Tamper harness output | Acquisition edits |
| Tier fallback warnings | Termux capture | Store edits |
| RST resilience | Harness output (survive+PONG) | Transport edits |

Evidence retention: transcripts stored alongside revision tags; superseded evidence archived, never deleted (repudiation value).

\newpage

# ANNEX T — MASTER HEADING INDEX

# DOCUMENT CONTROL
  ## REVISION LEDGER
  ## PURPOSE AND AUTHORITY
  ## READING PROTOCOL
# PART I — SYSTEM DOCTRINE AND THREAT POSTURE
  ## §1. Mission Statement of the Coupled System
  ## §2. The Three Trust Domains
  ## §3. Standing Threat Model
  ## §4. Doctrine of Deliberate Asymmetries
# PART II — ARCHITECTURE ATLAS
  ## §5. Component Inventory and Port Ledger
  ## §6. Process Topology at Steady State
  ## §7. Data Flow Canonical Walkthrough
# PART III — IDENTITY AND CREDENTIAL LIFECYCLE
  ## §8. Identity Instruments Inventory
  ## §9. Device-Code Login Flow (Authoritative Narrative)
  ## §10. Opaque Token Verification Contract
  ## §11. Login-Time TOTP Enforcement
  ## §12. Token Revocation and Expiry Discipline
# PART IV — THE SECRET STORAGE TIERS
  ## §13. Tier Hierarchy and Selection Order
  ## §14. Migration Doctrine
  ## §15. File Mode Ledger
# PART V — THE res54 CRYPTOGRAPHIC REGIME
  ## §16. Design Intent
  ## §17. Key Material Hierarchy
  ## §18. Envelope Version 2 (Canonical Client Format)
  ## §19. Envelope Version 3 (Current Ratified Format)
  ## §20. Legacy Envelope (Generation 1)
  ## §21. Version Negotiation Procedure
# PART VI — THE KZA/PREL AUTHORIZATION STACK
  ## §22. Stack Overview
  ## §23. Registry Semantics
  ## §24. Token Anatomy
  ## §25. The F2FA Layer (Seed-Derived Second Factor)
  ## §26. cli-guard: The Privileged Command Lease
  ## §27. Device-Scoped Banning Regime
  ## §28. Administrative Surface Summary
# PART VII — TOTP ATTESTATION SERVICE (cli-totp)
  ## §29. Function Contract
  ## §30. Verification Mechanics
  ## §31. Failure Accounting and Ban Insertion
  ## §32. Success Path Side Effects
# PART VIII — THE DECRYPTOR DAEMON
  ## §33. Existence and Authority
  ## §34. Session Authentication
  ## §35. File Route Pipeline
  ## §36. Dashboard Presence
  ## §37. Supervisor Contract
# PART IX — SQUIDFS ENGINE INTERNALS
  ## §38. Binary Provenance Order
  ## §39. Server Composition
  ## §40. Path Resolution Semantics
  ## §41. Content Path Doctrine
  ## §42. Upload Path
  ## §43. mDNS and Advertisement Policy
# PART X — WEBDAV AUTHENTICATION AND EXPOSURE DOCTRINE
  ## §44. The Password Verifier Format
  ## §45. Bind Doctrine
  ## §46. Method Coverage Invariant
  ## §47. Range and Cache Interplay
# PART XI — HOST API SERVER AND MICROREDIS
  ## §48. Host API Purpose
  ## §49. Security Profiles
  ## §50. Route Surface (Normative)
  ## §51. MicroRedis Internals
  ## §52. Audit Pipeline
# PART XII — STORAGE SUBSTRATE AND BRIDGE PROTOCOL
  ## §53. Bucket Pool Dispatch
  ## §54. Upload Session State Machine
  ## §55. Bridge Action Grammar
  ## §56. Platform REST Surface Exercised by Clients
# PART XIII — PROVISIONING, DISTRIBUTION, AND SUPPLY-CHAIN CONTROLS
  ## §57. Release Engineering Norms
  ## §58. Acquisition Precedence (Restated as Policy)
  ## §59. Integrity Failure Handling
# PART XIV — DASHBOARD INTEGRATION SURFACE
  ## §60. CLI Devices Registry View
  ## §61. CliAuthorize Consent Surface
  ## §62. Security Center Coupling
# PART XV — OPERATIONAL PROCEDURES
  ## §63. Standard Operator Runbook
  ## §64. Troubleshooting Matrix
  ## §65. Clean-State Procedure
# PART XVI — POST-MORTEM ANNEX (INCIDENT REGISTER)
  ## PM-01 — Stale Binary Masquerade
  ## PM-02 — ESM Resolution and Platform Shims
  ## PM-03 — Identifier Shape and the Phantom-Name Class
  ## PM-04 — The Stale-Key 401 Cascade
  ## PM-05 — Gateway JWT Precheck Swallowing Dispatch
  ## PM-06 — Schema Drift Between Repo Migrations and Live Registry
  ## PM-07 — The F2FA Window Encoder Divergence (Flagship Defect)
  ## PM-08 — Transport Reset Daemon Death
  ## PM-09 — Login Crash via Removed Import
  ## PM-10 — Zero-Length Attestation Shelf-Life Ambiguity
# PART XVII — VERIFICATION AND ASSURANCE MATRICES
  ## §66. Security Control Verification Ledger
  ## §67. Functional Regression Vectors
# PART XVIII — DECISION REGISTER AND OPEN ITEMS
  ## §68. Ratified Decisions (Abridged Register)
  ## §69. Open Items (Tracked, Not Scheduled)
# ANNEX B — CLI COMMAND REFERENCE (NORMATIVE)
  ## B.1 Identity Family
  ## B.2 Files Family
  ## B.3 Storage Family
  ## B.4 Keys Family
  ## B.5 FS Family
  ## B.6 Host Family
  ## B.7 Utility Surface
# ANNEX C — ERROR CODE AND MESSAGE CATALOG
  ## C.1 CLI-Totp Domain
  ## C.2 KZA Gateway Domain
  ## C.3 Engine / Transport Domain
  ## C.4 Login/Install Domain
# ANNEX C2 — ENVIRONMENT AND CONFIGURATION REGISTER
# ANNEX D — SCHEMA AND WIRE-FORMAT DEPENDENCY REGISTER
  ## D.1 cli_devices (identity substrate)
  ## D.2 kza_prel_registry
  ## D.3 kza_prel_f2fa_seeds
  ## D.4 kza_prel_sessions / signing RPC
  ## D.5 kza_banned_entities
  ## D.6 kza_threat_events
  ## D.7 auth.mfa_factors (platform-owned)
  ## D.8 files / folders / upload_sessions / shares / api_keys / file_key_vault
# ANNEX D2 — WIRE FORMAT CATALOG (NON-CODE SPECIFICATIONS)
  ## D2.1 Opaque CLI Token Resolution Digest
  ## D2.2 Storage Key Verification Scheme
  ## D2.3 File-Key Vault Unwrap Chain
  ## D2.4 TOTP Factor Verification Parameters
  ## D2.5 F2FA Code Derivation (Ratified)
  ## D2.6 Decryptor Session Header Contract
  ## D2.7 WebDAV Basic Gate Contract
# ANNEX E — TRIAGE MATRICES AND RUNBOOKS
  ## E.1 "Decryption failed" Decision Tree
  ## E.2 "Mount fails at decryptor stage" Runbook
  ## E.3 "Operator reports device banned" Intake Script
  ## E.4 "Whole account locked out" (should be impossible) Escalation
# PART XIX — KZA DETECTION TIER AND SUPPORTING SERVICES
  ## §70. Threat Event Lifecycle
  ## §71. Ban Pipeline Mechanics
  ## §72. Supporting Services Sketch
# PART XX — CRYPTOGRAPHIC GOVERNANCE
  ## §73. Primitive Inventory (Approved List)
  ## §74. Prohibited Practices
  ## §75. Rotation and Evolution Policy
# PART XXI — PERFORMANCE AND CAPACITY DOCTRINE
  ## §76. Concurrency Model Constants
  ## §77. Rate Limit Posture
# PART XXII — COMPLIANCE, AUDIT, AND CHANGE CONTROL
  ## §78. Audit Surface Inventory
  ## §79. Change Classes and Required Evidence
  ## §80. Review Cadence Checklist (per semi-annual cycle)
# PART XXIII — DEEP WALKTHROUGHS (NARRATIVE PROTOCOL TRACES)
  ## §81. Trace One — Cold Login to First Mounted Read
  ## §82. Trace Two — Adversarial Week
# PART XXIV — INTERFACE CONTRACTS WITH LOCAL APPLICATIONS
  ## §83. WebDAV Client Compatibility Matrix
  ## §84. Host API Consumer Contract
# PART XXV — DATA CLASSIFICATION HANDLING RULES
  ## §85. Material Classes
  ## §86. Redaction Standards for Escalations
# PART XXVI — TRAINING AND CERTIFICATION CURRICULUM
  ## §87. Curriculum Structure
  ## §88. Recurring Drills (Quarterly)
# PART XXVII — DESIGN REVIEW CHECKLISTS
  ## §89. Checklist: Touching the Decryptor
  ## §90. Checklist: Touching Authentication Flows
  ## §91. Checklist: Touching Transport Listeners
  ## §92. Checklist: Touching Storage/Bridge Contracts
# PART XXVIII — HISTORICAL ARCHITECTURE NOTES (PRE-HARDENING BASELINE)
  ## §93. The Permissive Era (pre-audit)
  ## §94. Why Not X (Rejected Alternatives Register)
# PART XXIX — OPERATIONAL STATEMENTS OF LIMITATION
  ## §95. What This System Does Not Protect Against
  ## §96. Known Cosmetic Behaviors (Do Not File)
# PART XXX — CONSOLIDATED REFERENCE TABLES
  ## §97. Master Identifier Glossary
  ## §98. Port and Path Quick Reference
  ## §99. Numeric Constants Ledger
# PART XXXI — FREQUENTLY RAISED QUESTIONS (ENGINEERING ANSWERS)
  ## §100. FAQ
# ANNEX F — EXPANDED DATA DICTIONARY
  ## F.1 cli_devices
  ## F.2 kza_prel_registry
  ## F.3 kza_prel_f2fa_seeds
  ## F.4 kza_prel_sessions
  ## F.5 kza_banned_entities
  ## F.6 kza_threat_events
  ## F.7 Storage-domain tables (files/folders/upload_sessions/shares/api_keys/file_key_vault)
# ANNEX G — PLATFORM API ENDPOINT CATALOG (CONSUMERS' VIEW)
  ## G.1 Identity & Instruments
  ## G.2 Files Surface
  ## G.3 Folders / Shares / Keys
  ## G.4 Key Custody & Bridge
  ## G.5 Response Envelope Conventions
# ANNEX H — INCIDENT RESPONSE PLAYBOOKS
  ## IR-1 Suspected Stolen Endpoint with Active Daemons
  ## IR-2 Second-Factor Brute Pattern from Single Instrument
  ## IR-3 Distribution Tamper Signal
  ## IR-4 Mass 401 Cascade Following Platform Credential Rotation
  ## IR-5 Anomalous Content Sweep via Daemon Capability
  ## IR-6 Registry Misconfiguration Lockout
# ANNEX I — DECISION RECORDS (FULL TEXT)
  ## DR-01 Sole Plaintext Authority (Decryptor)
  ## DR-02 Hashed Opaque Bearer Custody
  ## DR-03 Factor Custody Stays Web-Bound
  ## DR-04 Instrument-Scoped Punishment
  ## DR-05 Canonical Signed F2FA Rendering
  ## DR-06 Whole-Object Content Proxy Default
  ## DR-07 Advertisement Opt-In
  ## DR-08 Wildcard Dashboard Presence Key
  ## DR-09 Vault Passphrase Floor
  ## DR-10 Hash-File Channel to Engine Child
  ## DR-11 Live Credential Re-read Doctrine
  ## DR-12 Single-Attempt Lease Exchange
  ## DR-13 Fail-Closed Infrastructure Posture
  ## DR-14 Checksum Enforcement With Loud Degradation
# ANNEX J — DEPLOYMENT AND PLATFORM MATRICES
  ## J.1 Endpoint Platform Support Grid
  ## J.2 First-Run Sequences Per Platform
  ## J.3 Banner Message Catalog (Canonical Strings)
# ANNEX K — TEST FIXTURE AND VECTOR DOCTRINE
  ## K.1 Vector Classes Owed to the Repository (OI-3)
  ## K.2 Adversarial Harness Inventory
  ## K.3 Release Gate Composition
# ANNEX L — EXTENDED GLOSSARY AND ACRONYM REGISTER
# ANNEX M — COMPLETE MESSAGE AND LOG-LINE CATALOG
  ## M.1 Provisioning and Banner Lines
  ## M.2 Daemon Lifecycle Lines
  ## M.3 Attestation and Guard Lines
  ## M.4 Failure Signatures (Cross-Reference)
# ANNEX N — EXIT CODES, SIGNALS, AND LIFECYCLE STATE MACHINES
  ## N.1 Exit Code Ledger
  ## N.2 Signal Disposition
  ## N.3 State Machines
# ANNEX O — STRIDE ANALYSIS PER COMPONENT
  ## O.1 Decryptor Daemon
  ## O.2 SquidFS Engine
  ## O.3 cli-totp
  ## O.4 KZA Gateway
  ## O.5 Host API / MicroRedis
  ## O.6 Secret Store Tiers
# ANNEX P — CAPACITY AND TUNING GUIDE
  ## P.1 Sizing Classes
  ## P.2 Tuning Knobs and Effects
  ## P.3 Observability Baseline
# ANNEX Q — REVIEWER QUESTION BANK (ASSESSMENT INSTRUMENT)
  ## Q.II Scenario Bank (Orals)
# ANNEX R — HARDENING CYCLE CHRONOLOGY (CONTEMPORANEOUS LOG DISTILLED)
# ANNEX G2 — ENDPOINT DOSSIERS (DEEP REFERENCE)
  ## D-EP-01 POST cli-oauth/device
  ## D-EP-02 POST cli-oauth/device/poll
  ## D-EP-03 POST cli-totp (action dispatch)
  ## D-EP-04 GET /api/v1/files
  ## D-EP-05 GET /api/v1/download/:id (non-signed)
  ## D-EP-06 GET /api/v1/download/:id?signed=true
  ## D-EP-07 POST /api/v1/upload (plan mint)
  ## D-EP-08 POST /api/v1/upload/complete
  ## D-EP-09 POST /api/v1/upload/encrypted
  ## D-EP-10 file-key
  ## D-EP-11 squidfs-bridge action:list
  ## D-EP-12 kza-prel/gateway
  ## D-EP-13 kza-admin verbs
# ANNEX B2 — COMMAND DOSSIERS (DEEP REFERENCE)
  ## CD-01 login (device default / oauth variant)
  ## CD-02 logout
  ## CD-03 whoami
  ## CD-04 files ls
  ## CD-05 files up
  ## CD-06 files rm/mv/cp/rename
  ## CD-07 files share
  ## CD-08 files dl
  ## CD-09 storage search/rm
  ## CD-10 keys add / rm / ls
  ## CD-11 fs mount
  ## CD-12 fs webdav
  ## CD-13 fs status / fs stop
  ## CD-14 host api
  ## CD-15 host status / stop
  ## CD-16 util version / doctor
# ANNEX C3 — ERROR CODE DOSSIERS
  ## EC-01 TOTP_REQUIRED
  ## EC-02 KZA_DEVICE_BANNED
  ## EC-03 KZA_TOTP_FAILED (countdown family)
  ## EC-04 KZA_PREL_F2FA_MISSING / FAILED / BRUTE
  ## EC-05 KZA_PREL_BINDING
  ## EC-06 KZA_PREL_EXPIRED
  ## EC-07 KZA_PREL_UNREGISTERED / OPERATION_DENIED / UNAUTHORIZED_CALLER
  ## EC-08 INVALID_API_KEY (platform fallback leg)
  ## EC-09 UNAUTHORIZED_INVALID_JWT_FORMAT
  ## EC-10 refusing-to-bind message family
  ## EC-11 vault passphrase required
  ## EC-12 randomUUID is not defined / bad interpreter / __dirname ESM
# ANNEX U — INVARIANT CATALOGUE
  ## U.1 Identity & Credential Invariants
  ## U.2 Attestation & KZA Invariants
  ## U.3 Crypto Invariants
  ## U.4 Engine & Transport Invariants
  ## U.5 Provisioning & Distribution Invariants
  ## U.6 Storage Invariants
# ANNEX V — CONFIGURATION DECISION TREES
  ## V.1 Selecting Host API Profile
  ## V.2 Choosing Secret Tier Override Behavior
  ## V.3 Mount Failure Routing
  ## V.4 Post-Incident Re-Enable Decision Tree (Device Ban)
# ANNEX W — BANNER AND POSTURE REPORTING STANDARD
# ANNEX X — ASSURANCE EVIDENCE MAP

--- END OF DOCUMENT ---

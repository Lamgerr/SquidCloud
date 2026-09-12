---
title: "SquidCloud Dispersal Engine"
subtitle: "Decentralized Encrypted File Storage — Technical Whitepaper"
date: "September 2026"
author: "SquidCloud"
geometry: margin=2.5cm
fontsize: 11pt
toc: true
toc-depth: 3
numbersections: true
colorlinks: true
linkcolor: "#6366f1"
urlcolor: "#6366f1"
header-includes: |
  \usepackage{fancyhdr}
  \pagestyle{fancy}
  \fancyhead[L]{\small SquidCloud Dispersal Engine}
  \fancyhead[R]{\small v1.0 — September 2026}
  \fancyfoot[C]{\thepage}
  \usepackage{xcolor}
  \definecolor{indigo}{RGB}{99,102,241}
  \usepackage{tcolorbox}
---

\newpage

# Executive Summary

The **SquidCloud Dispersal Engine (SDE)** is a decentralized file storage system that eliminates single points of failure by splitting files into encrypted chunks and distributing them across multiple independent internet storage networks. Recovery requires only a single human-readable token — no passwords, no servers, no central authority.

Traditional cloud storage relies on centralized providers. If the provider goes down, gets hacked, or changes terms, your data is at risk. SDE takes a fundamentally different approach: your file is encrypted, chunked, and dispersed across **IPFS** (a global content-addressed network) and the **BitTorrent DHT** (the world's largest distributed hash table). No single entity controls your data.

**Key properties:**

- **Zero-knowledge encryption** — all encryption happens client-side; the server never sees plaintext
- **Single-token recovery** — one Base58-encoded string recovers the entire file
- **Multi-network redundancy** — chunks stored on IPFS + BitTorrent DHT simultaneously
- **Deterministic re-derivation** — keys are mathematically derived from a local secret, never stored
- **Device-portable** — same secret on any device recovers all files

\newpage

# The Problem

## Centralized Storage Risks

Every major cloud storage provider presents the same fundamental risks:

- **Single point of failure** — one outage and your files are inaccessible
- **Provider lock-in** — switching providers means re-uploading everything
- **Trust dependency** — you must trust the provider not to lose, corrupt, or misuse your data
- **Key management complexity** — traditional encryption requires managing separate keys, passwords, and recovery mechanisms

## What SDE Solves

SDE addresses these by **removing the central point entirely**. Files are not stored "on SquidCloud servers." They are dispersed across the internet's own infrastructure — the same networks that power peer-to-peer file sharing, decentralized applications, and global content distribution.

\newpage

# Architecture Overview

## High-Level Flow

```
┌─────────────────────────────────────────────────────────┐
│                     USER'S DEVICE                       │
│                                                         │
│  File ──► Encrypt ──► Chunk ──► Route ──► Disperse      │
│                                                         │
│  Recall Token ◄── signed ◄── metadata ◄── hash          │
└──────────┬──────────────┬──────────────┬────────────────┘
           │              │              │
           ▼              ▼              ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │   IPFS   │   │ BitTorrent│   │  Local   │
    │ (Helia)  │   │   DHT    │   │  Cache   │
    └──────────┘   └──────────┘   └──────────┘
```

## Design Principles

1. **Client-side only** — All encryption, decryption, and key derivation happen on the user's device. The server only stores metadata (file names, sizes, types) — never content.

2. **Deterministic derivation** — Given the same master secret and file hash, all keys, chunk IDs, and routing paths are mathematically re-derived. Nothing is randomly generated at download time.

3. **Pluggable substrates** — The storage backend is abstracted behind a simple interface. Today it's IPFS + BitTorrent. Tomorrow it could include Arweave, Nostr, or any new decentralized network.

4. **Fail-safe redundancy** — Each chunk is replicated across 4 independent substrates. If one network goes down, the others still have the data.

\newpage

# Cryptographic Foundation

## Device Master Secret (DMS)

The entire system begins with a single 32-byte (256-bit) random secret generated on the user's device. This is the **root of trust** for all encryption.

- Generated once per device using `crypto.getRandomValues()` (CSPRNG)
- Stored in IndexedDB (browser) or encrypted file (Node.js)
- Never leaves the device, never transmitted to any server
- All other keys are mathematically derived from it

If the DMS is lost and no recovery phrase was created, the data is **permanently unrecoverable**. This is by design — it means no one else can recover it either.

## Key Derivation Hierarchy

All encryption keys are derived using **HKDF-SHA256** (HMAC-based Key Derivation Function), a NIST-standardized key derivation function. The hierarchy is:

```
Device Master Secret (32 bytes)
    │
    ├──► Identity Root (64 bytes)
    │       │
    │       ├──► Blob Secret (64 bytes, per file)
    │       │       │
    │       │       ├──► Chunk Key (32 bytes, per chunk)
    │       │       ├──► Chunk ID (32 bytes, per chunk)
    │       │       ├──► Route Seed (16 bytes, per chunk)
    │       │       └──► Verifier (16 bytes, per file)
    │       │
    │       └──► Recall Token Sign Key (32 bytes)
    │
    └──► Recovery Phrase (12 words, optional backup)
```

**Domain separation** ensures that keys for different purposes never collide, even if derived from the same parent. Each derivation uses a unique `info` string (e.g., `"key0"`, `"id0"`, `"route0"`, `"rtsign.v1"`).

## Encryption: AES-256-GCM

Each chunk is encrypted with **AES-256-GCM** (Galois/Counter Mode), providing both confidentiality and integrity:

- **Key size:** 256 bits (32 bytes)
- **Nonce:** 12 bytes, derived from `deriveChunkKey(blobSecret, i + 1000000)` — domain-separated from the encryption key
- **Auth tag:** 128 bits (maximum security)
- **AAD (Additional Authenticated Data):** `SHA-256(chunkId || index || totalChunks)` — binds ciphertext to its position in the file

If any bit of the ciphertext is modified, decryption fails with an authentication error. This prevents tampering.

## Hashing

- **Primary:** SHA-256 via WebCrypto Subtle API
- **Planned upgrade:** BLAKE3 (faster, parallelizable) in v1.2
- **XOF (Extensible Output Function):** SHAKE128, currently implemented via HKDF-SHA256 expansion, with native SHAKE128 planned for v1.2

## WebCrypto Subtle

All cryptographic operations use the browser's native **WebCrypto Subtle API**, which provides:

- Hardware-accelerated encryption/decryption
- Constant-time comparison operations
- Protection against timing attacks
- No external cryptographic dependencies

\newpage

# The Recall Token

## What Is a Recall Token?

The recall token is a **single Base58-encoded string** that contains everything needed to recover a dispersed file. It is the only credential the user needs to store.

## Token Format (96 bytes, v1.1)

| Byte Range | Size | Field | Description |
|:-----------|:-----|:------|:------------|
| 0–31 | 32 bytes | File Hash | SHA-256 hash of the original file |
| 32–35 | 4 bytes | Total Chunks | Number of chunks (u32 big-endian) |
| 36–39 | 4 bytes | Original Size | File size in bytes (u32 big-endian) |
| 40–41 | 2 bytes | Version | Protocol version (currently 1) |
| 42–57 | 16 bytes | Verifier | First 16 bytes of `deriveVerifier(blobSecret)` |
| 58–89 | 32 bytes | Nonce | Random nonce for token uniqueness |
| 90–95 | 6 bytes | HMAC | Truncated HMAC-SHA256 signature |

## How It Works

1. **Upload:** After encrypting and dispersing all chunks, the system builds a recall token containing the file's metadata and a cryptographic signature. The user receives this token.

2. **Download:** The user provides the recall token. The system decodes it, verifies the signature, re-derives all chunk keys from the Device Master Secret + file hash, fetches chunks from the storage networks, and decrypts them.

3. **Verification:** The 6-byte HMAC in the token proves it was created by a device holding the correct Device Master Secret. The 16-byte verifier confirms the DMS matches before any network requests are made.

## Token Properties

- **Self-contained** — No server lookup needed to verify authenticity
- **Compact** — 96 bytes encodes to ~130 Base58 characters (copy-pasteable)
- **Device-bound** — Only devices with the original DMS can generate valid tokens
- **Forward-secure** — The token does not reveal the DMS or any chunk keys

\newpage

# Chunking and Envelope Format

## Adaptive Chunking

Files are split into chunks sized between **256 KB and 8 MB**, adaptively chosen based on the storage substrate's capabilities. Larger chunks reduce overhead; smaller chunks improve parallelism and fault tolerance.

## Envelope Structure

Each encrypted chunk is wrapped in a plaintext envelope (48-byte header + ciphertext):

| Byte Range | Size | Field | Description |
|:-----------|:-----|:------|:------------|
| 0–31 | 32 bytes | Chunk ID | Unique content identifier for this chunk |
| 32–35 | 4 bytes | Index | Chunk position in the file (u32 BE) |
| 36–39 | 4 bytes | Total Chunks | Total number of chunks (u32 BE) |
| 40–43 | 4 bytes | Ciphertext Length | Size of encrypted payload (u32 BE) |
| 44–47 | 4 bytes | Hash Prefix | First 4 bytes of `SHA-256(ciphertext)` |
| 48+ | variable | Ciphertext | AES-256-GCM encrypted data + auth tag |

The envelope header is **not encrypted** — it contains routing metadata needed to locate and decrypt the chunk. The integrity of the ciphertext itself is protected by the AES-GCM auth tag.

\newpage

# Storage Substrate System

## The Substrate Interface

SDE abstracts storage behind a simple interface:

```
put(chunkId, payload) → Locator
get(locator) → plaintext bytes
probe() → health status
```

Any storage backend that implements this interface can be plugged into SDE. This means SDE is not tied to any specific network — it adapts as new decentralized storage technologies emerge.

## Substrate Tiers

Substrates are classified into durability tiers:

| Tier | Description | Examples |
|:-----|:------------|:---------|
| **DEEP** | High durability, global distribution | IPFS, BitTorrent DHT |
| **PERSISTENT** | Long-term storage, moderate availability | Arweave, S3 |
| **SWARM** | Peer-to-peer, variable availability | WebRTC mesh |
| **SURFACE** | Ephemeral, high availability | CDN edge nodes |
| **FRAGILE** | Temporary, may disappear | Browser caches |

The system enforces tier invariants during substrate selection: at least one DEEP substrate, at least one PERSISTENT substrate, and at most one FRAGILE substrate per chunk.

## Deterministic Routing

Each chunk is routed to substrates using a **deterministic algorithm** based on the route seed:

1. The route seed (16 bytes) is expanded to 256 bytes via SHAKE128
2. Each substrate receives a score based on the expanded seed
3. Substrates are sorted by health (highest first) and score
4. The top 4 substrates are selected

This means the same chunk always goes to the same substrates, but the selection is unpredictable without knowing the route seed.

\newpage

# Hybrid DHT: IPFS + BitTorrent

## Why Two Networks?

Using both IPFS and BitTorrent DHT provides complementary strengths:

| Property | IPFS (Helia) | BitTorrent DHT |
|:---------|:-------------|:---------------|
| **Addressing** | Content-addressed (CID) | Key-value (info_hash) |
| **Data storage** | Full chunk data | CID references only |
| **Retrieval** | Direct block fetch | CID lookup → IPFS fetch |
| **Network size** | ~100K nodes | ~10M nodes |
| **Persistence** | Pinning required | Distributed (BEP44) |

## How Chunks Are Stored

When a chunk is uploaded:

1. **IPFS:** The chunk is stored as a raw block with a CID (Content Identifier) derived from its SHA-256 hash. This provides content-addressed deduplication — if two users upload the same file, only one copy exists on IPFS.

2. **BitTorrent DHT:** A small reference (~60 bytes) containing the IPFS CID is published as a BEP44 immutable item. This acts as a distributed index — even if the IPFS node is offline, other nodes can discover the CID through the BitTorrent network.

3. **localStorage:** The chunk is cached locally for instant re-access on the same device.

## Retrieval Flow

```
Memory Cache → localStorage → IPFS (via CID) → BitTorrent DHT (CID lookup → IPFS)
```

Each layer is a fallback. In practice, most retrievals hit the memory or localStorage cache. IPFS serves as the primary distributed backend. BitTorrent DHT provides discovery resilience.

\newpage

# Upload Process

## Step-by-Step

1. **File Hash:** SHA-256 the entire file to produce a `fileHash` (32 bytes).

2. **Key Derivation:** Using the Device Master Secret and file hash, derive the `blobSecret`, then for each chunk: `chunkKey`, `chunkId`, `routeSeed`, and `nonce`.

3. **Chunking:** Split the file into chunks of 256KB–8MB.

4. **Encryption:** Each chunk is encrypted with AES-256-GCM using its unique key, nonce, and AAD.

5. **Envelope Construction:** Wrap each encrypted chunk with a 48-byte routing header.

6. **Substrate Selection:** For each chunk, deterministically select 4 storage substrates from the route seed.

7. **Dispersal:** Write each envelope to all 4 substrates in parallel. Failed writes are logged but do not block the upload.

8. **Recall Token:** Build and sign a 96-byte recall token containing file metadata and an HMAC.

9. **Storage:** The file record (metadata only — no content) is stored in Supabase. The recall token is stored in a separate table linked to the file.

10. **Delivery:** The recall token is returned to the user.

\newpage

# Download Process

## Step-by-Step

1. **Token Decode:** Base58-decode the recall token back to 96 raw bytes.

2. **HMAC Verification:** Verify the 6-byte HMAC signature using the Recall Token Sign Key derived from the Device Master Secret.

3. **DMS Check:** Derive the expected 16-byte verifier and compare it against the token's verifier. This confirms the current device holds the same DMS that created the file.

4. **Key Re-derivation:** From the file hash in the token, re-derive the `blobSecret`, then for each chunk: `chunkKey`, `chunkId`, `routeSeed`, and `nonce`.

5. **Parallel Fetch:** Fetch all chunks in parallel across the storage substrates. The system races the top 3 substrate targets, falls back to the 4th, and after a 30-second delay tries all remaining substrates.

6. **Decryption:** Each chunk is decrypted with AES-256-GCM using the re-derived key and nonce.

7. **Reassembly:** All plaintext chunks are concatenated in order to reconstruct the original file.

8. **Output:** A `File` object with the original name and MIME type.

\newpage

# Recovery Phrase

## BIP39 Backup

SDE supports **12-word recovery phrases** following the BIP39 standard (used by Bitcoin and other cryptocurrency wallets).

### How It Works

1. **Generation:** 128 bits of cryptographically secure entropy are generated. A 4-bit checksum is appended, and the resulting 132 bits are split into 12 groups of 11 bits, each mapping to a word from the BIP39 English wordlist.

2. **DMS Wrapping:** The recovery phrase is used to derive an encryption key via PBKDF2 (204,800 iterations, SHA-256). The DMS is encrypted with this key using AES-256-GCM.

3. **Storage:** The wrapped DMS can be stored anywhere — a password manager, a piece of paper, a safe.

4. **Recovery:** Entering the 12 words re-derives the PBKDF2 key, decrypts the DMS, and re-derives the entire key hierarchy. All files become accessible again.

### Security Properties

- **Brute-force resistant:** 204,800 PBKDF2 iterations make offline attacks computationally expensive
- **Standard format:** Compatible with existing BIP39 infrastructure and tools
- **No server dependency:** Recovery works entirely offline

\newpage

# Security Model

## Threat Model

| Threat | Mitigation |
|:-------|:-----------|
| **Server compromise** | Server never sees plaintext or encryption keys |
| **Man-in-the-middle** | All encryption is client-side; TLS for transport |
| **Chunk tampering** | AES-256-GCM auth tag detects any modification |
| **Recall token theft** | Token is device-bound; requires DMS to be useful |
| **Brute-force on token** | 6-byte HMAC (v1.1), upgrading to 16-byte (v2) |
| **DMS compromise** | DMS never leaves device; encrypted at rest |
| **Single network failure** | 4x replication across independent networks |
| **Key reuse** | Each file and chunk derives unique keys via domain separation |

## What the Server Sees

- File name, type, size
- `processor: 'sde'` flag
- A Base58 recall token (encrypted content is not recoverable from it without the DMS)
- **Never:** plaintext, encryption keys, chunk data, or the Device Master Secret

## What the User Must Protect

1. **Device Master Secret** — stored in browser IndexedDB, encrypted at rest
2. **Recall Token** — the single credential for file recovery
3. **Recovery Phrase** (optional) — 12-word backup for DMS recovery

\newpage

# Technology Stack

## Core Cryptography

| Component | Technology | Standard |
|:----------|:-----------|:---------|
| Symmetric encryption | AES-256-GCM | NIST SP 800-38D |
| Key derivation | HKDF-SHA256 | RFC 5869 |
| Hashing | SHA-256 | FIPS 180-4 |
| Message authentication | HMAC-SHA256 | RFC 2104 |
| Random generation | WebCrypto `getRandomValues()` | W3C WebCrypto |

## Storage Networks

| Network | Library | Purpose |
|:--------|:--------|:--------|
| IPFS | Helia v5 | Content-addressed chunk storage |
| BitTorrent DHT | bittorrent-dht v10 | Distributed CID index (BEP44) |
| Local cache | localStorage | Instant same-device re-access |

## Key Derivation

| Function | Output | Purpose |
|:---------|:-------|:--------|
| `deriveIdentityRoot` | 64 bytes | Root of the identity hierarchy |
| `deriveBlobSecret` | 64 bytes | Per-file encryption root |
| `deriveChunkKey` | 32 bytes | Per-chunk AES key |
| `deriveChunkId` | 32 bytes | Per-chunk content identifier |
| `deriveRouteSeed` | 16 bytes | Per-chunk substrate routing |
| `deriveRtSign` | 32 bytes | Recall token signing key |
| `deriveVerifier` | 16 bytes | DMS ownership proof |

## Client Platform

- **Runtime:** Browser (WebCrypto Subtle API)
- **Framework:** React + TypeScript
- **Build:** Vite with ES2020 target
- **Module system:** ES Modules with dynamic imports for code splitting

\newpage

# Performance Characteristics

## Upload

- **Chunking:** Linear scan, O(n) where n = file size
- **Encryption:** AES-GCM with hardware acceleration (AES-NI)
- **Dispersal:** 4 parallel writes per chunk across independent networks
- **Bottleneck:** Network ITPut latency to IPFS and BitTorrent DHT

## Download

- **Key derivation:** Deterministic, sub-millisecond per chunk
- **Fetch:** Parallel across 3–4 substrates per chunk, with fallback
- **Decryption:** AES-GCM with hardware acceleration
- **Assembly:** Single concatenation pass

## Scalability

- Chunk count scales linearly with file size
- Substrate count is independent of file count
- No server-side computation for encryption/decryption
- Storage overhead: ~48 bytes envelope header per chunk

\newpage

# Roadmap

## v1.0 (Current)

- [x] AES-256-GCM encryption with WebCrypto
- [x] HKDF-SHA256 hierarchical key derivation
- [x] 96-byte Base58 recall token (v1.1)
- [x] BIP39 12-word recovery phrase
- [x] IPFS (Helia) + BitTorrent DHT hybrid storage
- [x] localStorage caching layer
- [x] Adaptive chunking (256KB–8MB)
- [x] Deterministic substrate routing
- [x] Client-side toggle in Account Settings

## v1.2 (Planned)

- [ ] BLAKE3 hashing (parallelizable, faster than SHA-256)
- [ ] Native SHAKE128 XOF
- [ ] WASM crypto isolation (linear memory protection)
- [ ] Self-healing: automatic re-replication of under-replicated chunks
- [ ] Health monitoring dashboard
- [ ] Multi-device DMS sync via encrypted relay

## v2.0 (Future)

- [ ] 112-byte recall token with 16-byte HMAC
- [ ] Arweave permanent storage integration
- [ ] WebRTC peer-to-peer chunk exchange
- [ ] Threshold cryptography (N-of-M recovery)
- [ ] Zero-knowledge proofs for chunk integrity verification

\newpage

# Glossary

| Term | Definition |
|:-----|:-----------|
| **AAD** | Additional Authenticated Data — metadata encrypted alongside ciphertext in AES-GCM |
| **AES-GCM** | Advanced Encryption Standard in Galois/Counter Mode — authenticated encryption |
| **BIP39** | Bitcoin Improvement Proposal 39 — mnemonic code for generating deterministic keys |
| **BEP44** | BitTorrent Enhancement Proposal 44 — mutable/immutable DHT items |
| **CID** | Content Identifier — IPFS address derived from content hash |
| **CSPRNG** | Cryptographically Secure Pseudo-Random Number Generator |
| **DHT** | Distributed Hash Table — decentralized key-value store |
| **DMS** | Device Master Secret — root 32-byte secret on each device |
| **HKDF** | HMAC-based Key Derivation Function (RFC 5869) |
| **Helia** | JavaScript implementation of IPFS |
| **HMAC** | Hash-based Message Authentication Code |
| **Nonce** | Number used once — random value ensuring identical plaintexts produce different ciphertexts |
| **Recall Token** | 96-byte Base58 string containing everything needed to recover a dispersed file |
| **Route Seed** | 16-byte value determining which substrates store a given chunk |
| **Substrate** | A storage backend implementing the put/get/probe interface |
| **Substrate Tier** | Durability classification: DEEP, PERSISTENT, SWARM, SURFACE, FRAGILE |

\vfill

---

*This document describes the SquidCloud Dispersal Engine v1.0. For questions, feedback, or contributions, visit [squidcloud.vercel.app](https://squidcloud.vercel.app).*

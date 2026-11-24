# SquidCloud CLI Platform — Concept Document v0.1

> *Replace cloudbliss-api (Supabase Edge Functions) with a universal CLI binary. No API. No SaaS dependency. One binary handles everything: auth, storage, encryption, routing.*

---

## 1. Philosophy

### The Problem with the Current Architecture
- cloudbliss-api is a single Supabase Edge Function (982 lines) handling all file operations
- Supabase dependency: Auth, Postgres, Edge Functions, Realtime — all external services
- No offline mode, no on-prem, no air-gap
- Vendor lock-in at the infrastructure level
- API-first design forces every client to speak HTTP

### The New Vision: `squidctl`
`squidctl` is a **single static binary** (like `flect`, like `k3s`, like `sqlite`) that IS the SquidCloud platform. It runs everywhere — laptop, server, Raspberry Pi, Android Termux, Docker, air-gapped network.

**Core principle**: The platform is the CLI. There is no "backend API" that the CLI talks to — the CLI IS the backend. It starts a local daemon when needed, peers with other instances, and handles all file operations natively.

### "Protects every file like its own"
SquidCloud's cryptographic guarantee: every file stored through squidctl is encrypted, replicated, integrity-checked, and access-logged with the same rigor that a intelligence agency would apply to its own classified documents. The platform treats user data with the same protection as its own infrastructure secrets.

---

## 2. Architecture Overview

```
[squidctl binary — single static build, ~15MB]
├── Daemon Mode (squidctl daemon)
│   ├── Embedded SQLite (data/auth/cache)
│   ├── Embedded RES54 Engine (AES-256-GCM enc/dec)
│   ├── Embedded KZA Sentinel (threat detection)
│   ├── Storage Backend Abstraction
│   │   ├── Local FS
│   │   ├── MinIO / S3 / R2
│   │   ├── WebDAV
│   │   └── P2P Mesh (cluster mode)
│   ├── gRPC Server (internal IPC for local clients)
│   ├── REST Bridge (optional, for legacy web UI)
│   └── WebSocket Hub (real-time sync between peers)
├── CLI Mode (squidctl <command>)
│   ├── init / config / auth
│   ├── put / get / ls / rm / cp / mv / share
│   ├── vault (ephemeral containers)
│   ├── key (key management)
│   ├── peer (P2P mesh management)
│   ├── credit (usage tracking)
│   └── admin (system management)
└── Embedded Runtime
    ├── SQLite (file catalog, metadata, audit logs)
    ├── BadgerDB (key-value store for session/peer state)
    └── Libsodium / Go Cryptography (RES54 engine)
```

---

## 3. Replacing cloudbliss-api

### Current (Supabase Edge Functions)

```
Browser → Supabase Edge Function (cloudbliss-api/index.ts) → GitHub API / R2
         → Supabase Auth (JWT)
         → Supabase Postgres (metadata, keys)
         → Supabase Realtime (KZA alerts)
```

### New (squidctl)

```
Terminal / Web UI → squidctl daemon (localhost:gRPC) → Storage Backend (local/S3/R2)
                 → Embedded SQLite (metadata, audit, keys)
                 → Embedded libsodium (RES54 enc/dec)
                 → P2P mesh (cluster replication)
                 → Optional: squidctl cloud relay (for public routing)
```

### What Each cloudbliss-api Endpoint Maps To

| Current API Route | New CLI Command | Notes |
|---|---|---|
| `POST /upload` | `squidctl put <file>` | Encrypts locally, stores via backend abstraction |
| `GET /download/:id` | `squidctl get <id>` | Decrypts locally, writes to stdout or file |
| `DELETE /files/:id` | `squidctl rm <id>` | Marks deleted, purges after retention |
| `POST /share` | `squidctl share <id> --ttl <duration>` | Generates capability URL |
| `GET /metadata/:id` | `squidctl ls <id>` | Reads from embedded SQLite |
| `POST /auth/login` | `squidctl auth login` | Cryptographic challenge-response (no password) |
| `POST /keys/generate` | `squidctl key generate` | Ed25519 keypair generation |
| `GET /admin/stats` | `squidctl admin stats` | Reads from embedded analytics |

---

## 4. Identity & Auth (No Supabase Auth)

### Cryptographic Identity
No email, no password, no OAuth. Every user is an Ed25519 keypair:

```
squidctl init
  → Generates Ed25519 keypair
  → Stores private key in OS keychain (or encrypted file)
  → Public key = identity (squid:ed25519:<base58>)
  → Username derived from first 12 chars (squid:7X9mL2pR)
```

### Authentication Flows
- **Challenge-response**: Server sends random nonce, client signs with private key
- **Peer-to-peer**: Mutual authentication via signed handshake
- **Session tokens**: Short-lived capability tokens (not JWT, not Supabase)
- **Recovery**: Mnemonic seed phrase (BIP-39, 24 words) for key recovery

### Multi-Identity Support
```
squidctl config identity add --name work
squidctl config identity add --name personal
squidctl --identity work put document.pdf
```

---

## 5. Storage Backend Abstraction

The CLI doesn't care WHERE data is stored. It encrypts everything first, then routes to the configured backend:

```
squidctl config storage add local --path /data/vault
squidctl config storage add s3 --bucket my-bucket --region us-east-1
squidctl config storage add p2p --mesh mycluster
squidctl config storage add tape --device /dev/st0  # cold archive
```

### Built-in Backends
| Backend | Type | Credit Cost |
|---|---|---|
| Local FS | Filesystem directory | Free |
| MinIO / S3 / R2 | S3-compatible object store | Free |
| WebDAV | Remote filesystem | Free |
| P2P Mesh | Cluster of squidctl peers | Free (within cluster) |
| SquidCloud Relay | Public relay nodes | Consumes credits |
| Tape Archive | LTO tape (cold storage) | Free (local) |

### SquidCloud Relay (Public/Free Tier)
For users who want "it just works" without self-hosting storage:
- Free tier: 1GB storage, 100MB/month egress, 1 identity
- Dev tier: 10GB storage, 1GB/month egress, 5 identities, unlimited vaults
- Paid tiers: More storage, egress, identities

Relay nodes are global squidctl instances operated by the project. They store encrypted blobs — they never see plaintext, never hold keys.

---

## 6. Encryption Model (RES54 v4)

### Layered Encryption (Defense in Depth)

```
Layer 1 — Transport: Noise Protocol (Noise_XK_25519_ChaChaPoly_Blake2b)
  → All squidctl-to-squidctl communication, including relay traffic
  → Forward secrecy, mutual authentication

Layer 2 — File Content: AES-256-GCM with HKDF-derived keys
  → Each file gets a unique 256-bit key
  → Each chunk gets a unique 96-bit IV
  → AAD includes file ID + chunk index + timestamp

Layer 3 — Key Wrapping: X25519 + Blake2b KDF
  → File keys wrapped with recipient's public key
  → Shared files: each recipient gets individually wrapped key

Layer 4 — Metadata: Encrypted SQLite + ORC (Oblivious RAM)
  → File names, sizes, timestamps encrypted at rest
  → ORC prevents metadata leakage from access patterns

Layer 5 — Integrity: Merkle Tree over all chunks
  → Root hash committed to tamper-proof log
  → Every download verifies full Merkle path
```

### "Protects like its own" Guarantees
- **Redundancy**: Files replicated across N backends (configurable, default 3)
- **Integrity**: Continuous background verification of Merkle roots
- **Anti-tamper**: Any modification detected, corrupted chunks auto-repaired from replicas
- **Immutable history**: Append-only audit log (no deletion, only revocation)
- **Blast radius**: Each identity's keys isolated; compromise of one doesn't affect others

---

## 7. Usage Credits & Free Tier

### Credit System
Every operation costs credits. Credits are NOT money — they're rate-limit units that prevent abuse on the public relay:

| Operation | Credit Cost |
|---|---|
| 1 MB stored (per day) | 1 credit |
| 1 MB downloaded | 10 credits |
| API key creation | 100 credits |
| Share link generation | 5 credits |
| Peer connection (per hour) | 1 credit |

### Free Tier (Public)
```
Credit allowance: 10,000 credits/day (refresh 00:00 UTC)
Storage limit: 1 GB
Identities: 1
Max file size: 25 MB
Clusters: 0 (relay-only)
Vaults: 3
```

### Dev Tier (Registered Users)
```
Credit allowance: 100,000 credits/day
Storage limit: 10 GB
Identities: 5
Max file size: 100 MB
Clusters: 3 nodes
Vaults: unlimited
Egress: 1 GB/month relay, unlimited local
```

### Enterprise Tier
```
Credit allowance: unlimited
Storage: unlimited
Identities: unlimited
On-prem deployment: full
HSM integration: optional
SLA: best-effort
Egress: unlimited all backends
```

### How Credit Limits Work
```
squidctl put bigfile.iso
  → CLI checks: credit balance >= 5000? (file size * days)
  → If yes: deducts, starts upload
  → If no: "Insufficient credits. Free tier: 1GB max. Upgrade or use local storage."

squidctl credit balance
  → Shows: 8,420 / 10,000 credits remaining (refresh in 6h)
  
squidctl credit buy --amount 100000
  → Not implemented in v1 — credits are always free, refresh daily
  → Future: paid credit packs for heavy relay users
```

---

## 8. Vault System (Ephemeral Containers)

Replaces the current share system with a more powerful concept:

```
squidctl vault create --name "M&A Data Room Q3" \
  --ttl 72h \
  --max-access 5 \
  --approval 2-of-3 \
  --watermark true

→ Creates an isolated encryption domain
→ 3 designated approvers (key holders)
→ Any 2 of 3 must approve each access
→ Files auto-purge after 72h or 5 total reads
→ Downloads are watermarked with viewer identity
```

Vaults work with local storage too — no relay needed. They're just signed capability contracts verified by the squidctl daemon.

---

## 9. CLI-First Design (Not API-First)

### Principles
1. Every API endpoint is a CLI command, not the other way around
2. The CLI is the primary interface; the REST bridge is legacy compatibility
3. Output is machine-parseable by default (JSON, NDJSON, or protobuf)
4. Piping between CLI instances is first-class:
   ```
   squidctl get document.pdf | squidctl put --vault "review" -  # pipe across instances
   squidctl ls --json | jq '.[] | select(.size > 1e9)' | squidctl admin notify
   ```

### Command Tree
```
squidctl
├── init          Initialize identity and config
├── auth          Authentication operations
│   ├── login     Authenticate to relay
│   ├── logout    Clear session
│   └── whoami    Show current identity
├── put           Upload file(s)
├── get           Download file(s)
├── ls            List files
├── rm            Remove file(s)
├── cp            Copy within/between backends
├── mv            Move / rename
├── share         Create share link
│   ├── create    Generate capability URL
│   ├── revoke    Invalidate share
│   └── list      Show active shares
├── vault         Ephemeral vault management
│   ├── create    New vault
│   ├── close     Destroy vault
│   ├── approve   Approve access request
│   ├── list      List vaults
│   └── status    Vault health
├── key           Key management
│   ├── generate  New keypair
│   ├── export    Export public key
│   ├── import    Import peer's public key
│   └── rotate    Rotate file keys
├── peer          P2P cluster management
│   ├── join      Join a mesh
│   ├── leave     Leave mesh
│   ├── list      List peers
│   └── sync      Force sync
├── credit        Usage credit management
│   ├── balance   Show credits
│   ├── history   Show credit usage
│   └── buy       Purchase credits (future)
├── config        Configuration
│   ├── get       Get config value
│   ├── set       Set config value
│   └── storage   Storage backend config
├── daemon        Start/stop daemon
├── admin         Administrative operations
│   ├── stats     System stats
│   ├── log       View audit log
│   └── backup    Backup SQLite database
└── help          Show help
```

---

## 10. Implementation Phases

### Phase 1 — Core CLI (Months 1-2)
- Identity: Ed25519 keypair generation, mnemonic recovery
- Storage: Local FS backend, SQLite metadata
- Commands: `init`, `put`, `get`, `ls`, `rm`, `config`
- Encryption: AES-256-GCM with per-file keys, SHA-256 integrity
- Daemon: Single-process, gRPC server for local clients
- **Replaces**: Basic file CRUD from cloudbliss-api

### Phase 2 — Vaults & Sharing (Month 3)
- Vault system: Ephemeral containers with TTL
- Share: Capability URLs, recipient key wrapping
- Multi-identity: Switch between profiles
- **Replaces**: Share system, vault concept

### Phase 3 — P2P & Cluster (Month 4)
- Noise Protocol transport
- Peer discovery via mDNS / DHT
- Mesh sync: Replicate encrypted blobs between peers
- Conflict resolution: CRDT-based metadata sync
- **Replaces**: GitHub cluster backend

### Phase 4 — Relay & Credits (Month 5)
- Public relay nodes (cloud squidctl instances)
- Credit accounting system
- Free tier enforcement (rate limits)
- Usage analytics
- **Replaces**: Supabase relay, cloudbliss-api public endpoints

### Phase 5 — Advanced Security (Month 6)
- ORAM for metadata privacy
- Merkle tree integrity verification
- Background integrity scanner with auto-repair
- Watermarking for shared downloads
- **Completes**: "Protects like its own" guarantee

---

## 11. Technical Decisions

### Language: Go
- Single static binary (like flect)
- Cross-compile to Linux/macOS/Windows/Android
- Excellent cryptographic library support (golang.org/x/crypto)
- Embedded database support (go-sqlite3, badger)
- gRPC native (connect-go / grpc-go)

### Database: SQLite (via go-sqlite3 / modernc.org/sqlite)
- Zero-configuration, no server process
- WAL mode for concurrent reads
- Encrypted at rest via SQLite Encryption Extension (SEE) or custom page-level encryption
- Easy to backup: `cp squidcloud.db squidcloud.db.bak`

### Key-Value Store: BadgerDB
- Embedded, LSM-tree based
- Session cache, peer state, temporary tokens
- No encryption needed (contains only derived/transient data)

### Transport: gRPC (connect-go)
- HTTP/2 native, bidirectional streaming
- Protocol Buffers for strict schema
- gRPC-Web bridge for browser clients (via Envoy / connect-go)
- REST bridge auto-generated from proto definitions

### Crypto: Standard Library + Libsodium (go-sodium / curve25519-voi)
- Ed25519 for identity
- X25519 for key exchange
- AES-256-GCM or XChaCha20-Poly1305 for file encryption
- Blake2b for hashing (faster than SHA-3, no length-extension)
- HKDF for key derivation
- BIP-39 for mnemonic phrases

---

## 12. Key Differentiators

| Feature | Dropbox / Box | Telegram | Current SquidCloud | New squidctl |
|---|---|---|---|---|
| Zero-knowledge | No | No | Partial | **Full** |
| No cloud dependency | No | No | No (Supabase) | **Yes (SQLite)** |
| CLI-native | No | No | No | **Yes** |
| P2P replication | No | No | No | **Yes** |
| Offline mode | No | No | No | **Yes** |
| Ephemeral vaults | No | Self-destruct msgs | No | **Yes** |
| N-of-M approval | No | No | No | **Yes** |
| Plausible deniability | No | No | No | **Hidden volumes** |
| Private key custody | No | No | Shared | **User-only** |
| Single binary deploy | No | No | No | **Yes** |
| Free for public | 2GB | Yes | No | **Yes (with credits)** |
| Protect like its own | No | Yes (messages) | Partial | **Yes (full)** |

---

## 13. Migration Path from cloudbliss-api

1. **Build squidctl v0.1** with Phase 1 features
2. **Run alongside cloudbliss-api** — new users use squidctl, existing users continue via web UI
3. **Export tool**: `squidctl import from-supabase` — migrates files from Supabase storage to local/relay
4. **Web UI compatibility** — squidctl daemon serves a REST bridge that the existing React frontend can target
5. **Deprecate** cloudbliss-api once squidctl covers all functionality and migration is complete

The React frontend continues to work during migration — only the backend changes. Instead of `fetch(SUPABASE_URL/functions/v1/cloudbliss-api/...)`, it talks to `localhost:squidctl-grpc/...` (via gRPC-Web or REST bridge).

---

## 14. Open Questions for Review

- **Credit system**: Should credits be free always, or eventually monetized? Concept assumes always-free with daily refresh.
- **Relay infrastructure**: Self-host the relay nodes, or decentralized (anyone can run a relay)?
- **Web UI**: Build a new TUI (terminal UI) alongside the React web UI, or keep React as primary?
- **P2P discovery**: mDNS (LAN only), DHT (Kademlia, global), or both?
- **Mobile**: Do we build a native squidctl for Android (Termux) / iOS (a-shell), or wrap in a GUI?
- **Naming**: `squidctl`, `squid`, `cloudbliss`, or something new?
- **Credit limits for local-only users**: Should users who self-host storage still be credit-limited? (Concept assumes no — credits only apply to relay usage.)

---

*This document is a concept draft. Review and refine before implementation begins.*

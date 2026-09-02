# SquidCloud Dispersal Engine (SDE) — Design Spec v1.1 (Hardened)

**Status:** Approved (2026-09-02) — Approach A (Pure Phantom Math, hardened)
**Author:** Platform Engineering + User Spec v1.0
**Mode:** Parallel to current system (`AccountSettings → Encryption → default | sde(beta)`)

## 0. Premise

The internet itself is the database. Every surface that can hold bytes is a valid substrate. User uploads a file and gets back a single **recall token** — that is the entire user-facing interface. No keys to manage, no backends to configure, no accounts to link. SquidCloud figures out the rest autonomously. Data is thrown across the world's deepest and most resilient internet substrates in encrypted, unidentifiable, unlinked chunks that no observer — including SquidCloud — can trace, correlate, or reassemble without the recall token.

SDE runs **parallel** alongside the current B2/S3 + `res54` pipeline. Existing files untouched.

---

## 1. Mode Routing (Parallel Guarantee)

```ts
type EncryptionMode = "default" | "sde-beta"; // in user_preferences / user_encryption_settings
```

- `AccountSettings → Encryption` category: toggle `default` (current `src/services/secure-upload.ts` → B2) vs `sde(beta)` (new `SDEBrain.upload`)
- Check at upload entry: `if (mode === "sde-beta") return SDEBrain.upload(file)` else legacy
- Existing files keep their substrate; switching mode only affects **future** uploads
- Feature flag: `VITE_SDE_ENABLED` (Vercel env), `beta_enrollments.feature='substrate-agnostic'` enroll gate at `/beta/substrate`

## 2. Identity and Key Architecture (Zero Setup, Hardened)

**Device Master Secret (DMS):** 32 random bytes via `crypto.getRandomValues` **inside WASM** (never leaves linear memory cleartext).

- Store: (a) IndexedDB via `idb` (browser) or (b) OS secure keystore (Electron/Tauri `secureStore`), fallback `0600` JSON with warning. **No** screen-res/timezone/canvas fingerprint blending — it breaks recovery and is fingerprintable.
- Recovery shard: **12-word BIP39** (128-bit, not 6-word/66-bit) → PBKDF2 → AES-GCM wraps DMS. Shown once: “Write this down to recover on a new device.” Optional — skip = device-bound. Verify by re-enter → unwrap test.
- All crypto derives from DMS. User never touches a key again.

**Derivation tree (HKDF-SHA256, inside WASM only, handles opaque to TS):**

```
DMS(32)
└─ identity_root = HKDF(DMS, "squid.identity.v1", 64)
   ├─ blob_secret = HKDF(identity_root, file_hash(32), 64)
   │   ├─ chunk_key[i]  = HKDF(blob_secret, "key"||u32(i), 32)   // AES-256-GCM
   │   ├─ chunk_id[i]   = HKDF(blob_secret, "id" ||u32(i), 32)   // opaque DHT/key
   │   └─ route_seed[i] = HKDF(blob_secret, "route"||u32(i), 16) // phantom routing
   └─ rtsign = HKDF(identity_root, "rtsign.v1", 32)              // token HMAC
```

Deterministic from `DMS + file_hash`. Given DMS + recall token, engine reconstructs ALL ids/keys/seeds — **no stored manifest exists anywhere**.

## 3. Recall Token (96 bytes → ~131 base58, QR/DNS/TXT/URL safe)

| Bytes | Field |
|-------|-------|
| 0-31  | `file_hash = BLAKE3(plaintext)` (not ciphertext — stable) |
| 32-35 | `total_chunks:u32BE` |
| 36-39 | `original_size:u32BE` (≤4 GiB per blob; >4 GiB = multi-blob) |
| 40-41 | `version:u16BE = 1` |
| 42-57 | `verifier = HKDF(blob_secret,"verify",16)[0:16]` — confirms correct DMS |
| 58-89 | `nonce:32` random — makes two tokens for same file look unrelated; IV for optional token-encrypt |
| 90-95 | `HMAC-SHA256(rtsign, bytes0-89)[0:16]` — **hardened: was 6B (48-bit) → 16B (128-bit)** |

Human form: `base58(96 bytes)`. Contains **nothing** about backends, count, identity, device, time, name, type. Without DMS, token reveals nothing; verifier is meaningless without DMS.

## 4. Dispersal Chunk Address Protocol (DCAP) — Phantom Routing

**Chunk identity:** `chunk_id[i] = HKDF(blob_secret,"id"||u32(i),32)` — globally unique, opaque, unlinkable across `i`, indistinguishable from random.

**Encryption (WASM only, key never leaves WASM):**
- `key = chunk_key[i]`; `nonce = HKDF(key,"nonce"||i,12)[0:12]`
- `aad = BLAKE3(chunk_id[i] || u32(i) || total_chunks)` — **hardened: was XOR** — binds position+count, anti-swap/truncation
- `ciphertext = AES-256-GCM(plaintext, key, nonce, aad)`
- Envelope: `[0-31:chunk_id][32-35:i][36-39:total][40-43:ct_len][44-47:blake3(ct)[0:4]][48+:ct] + HMAC(key, envelope)` — outer HMAC enables fast verify before decrypt

**Routing:**
- `route_seed[i] → SHAKE128 → 256 pseudo-random bytes`
- Substrate list `N` with live `healthScore 0..1` (EWMA of probe success+latency)
- Weighted random (8-byte windows) picks `replication=4` copies; invariants: **≥1 DEEP, ≥1 PERSISTENT, ≤1 FRAGILE** (FRAGILE only if DEEP already picked)
- Stored **nowhere** — re-derived on retrieval. Observer without DMS cannot predict backends. This is the **Phantom Routing Table**.

## 5. Storage Substrate Registry

```ts
interface StorageSubstrate {
  id: string; tier: "DEEP"|"PERSISTENT"|"SWARM"|"SURFACE"|"FRAGILE";
  anonymity: 0-5; maxPayload: number; avgLatency: number; health: 0..1;
  put(id:Uint8Array, payload:Uint8Array): Promise<Locator>;
  get(loc:Locator): Promise<Uint8Array>;
  probe(): Promise<Health>;
}
```

**V1 core (must-ship, proves “deepest points + unlimited + untrackable”):**
- DEEP: `MAINLINE_DHT` (BEP-44, 1000B limit → pointer+magnet+WebSeed for >1 KiB), `IPFS/Helia`, `NOSTR` (12 relays, kind 1065, eph pubkey `HKDF(chunk_key,"nostr",32)`), `I2P` (optional), `HYPHANET`
- PERSISTENT: `ARWEAVE` (tx_id), `INTERNET_ARCHIVE` (S3, id `base58(chunk_id[0:16])`), `FILECOIN` (web3.storage CID)

**Flagged off in v1 (adapters implement interface, health=0, enabled via `substrate_registry` flag, no code change to enable later):**
- SWARM: `TORRENT_WEBSEED`, `WEBRTC_SWARM`, `MATRIX`
- SURFACE: `GITHUB_GIST`, `GITLAB_SNIPPETS`, `PASTEBIN_CLUSTER`, `DNS_TXT`, `BLOCKCHAIN_CALLDATA` (Arbitrum/Optimism)
- FRAGILE: `DISCORD_CDN`, `TELEGRAM_BOT`, `STEGO_IMAGING` (LSB, cover pool lazy-loaded, not 10k bundled in WASM)

**Hardening vs v1.0:** DHT large-chunk sharding explicit; STEGO cover set lazy pool; chunk size `min(maxPayload)` per selected substrates (256 KiB floor, 8 MiB cap; STEGO = image capacity).

## 6. Brain (SDEBrain) — Autonomous Orchestration

- **Health:** DEEP 10m, PERSISTENT 30m, SWARM 5m, SURFACE/FRAGILE 2m; tiny known chunk probe; EWMA; 3 fails → quarantine
- **Chunk size:** per-chunk `min(maxPayload)` → 256 KiB–8 MiB; STEGO by image capacity; varies per chunk if substrates differ
- **Anonymity infer (no user toggle):** >100 MB → speed, <1 MB → max anonymity, Tor detected → DEEP-only, default = DEEP+PERSISTENT+SURFACE mix
- **Write:** WASM WebWorker pool (`hardwareConcurrency` workers) encrypts all chunks in parallel; dispatches puts concurrently; does NOT block on slow substrates; recall token issued when **≥4 copies of every chunk confirmed**; background locators still recorded
- **Read:** re-derive ids+seeds in WASM (instant) → per-chunk parallel race top-3 substrates → first checksum-verified win cancels others → WASM decrypt pool → ordered streaming output. On total miss: wait 30s → try next tier from seed expansion → if still missing, partial error with missing indices
- **Self-healing (background):** after successful read, any chunk from FRAGILE/SWARM is silently re-put to DEEP+PERSISTENT (same `route_seed`, next healthy pick) — invisible to user, keeps blob alive

## 7. WASM Module (AssemblyScript, Current Stack Only)

```
assembly/crypto/{hkdf,aes_gcm,blake3,shake128,hmac,stego}.ts
assembly/identity/{dms,derivation}.ts
assembly/chunker/{chunker,assembler}.ts
assembly/recall/token.ts
assembly/routing/{dcap,selector}.ts
assembly/index.ts  // exports
```

**Exports (TS only passes opaque Uint8Array handles, WASM validates allocation):**
`generateDMS()→32`, `deriveIdentityRoot(dms)→64`, `deriveBlobSecret(root,hash)→64`, `deriveChunkKey/Id/RouteSeed(blobSecret,i)`, `expandRouteSeed(seed)→256`, `encryptChunk(key,i,pt,id)→ct`, `decryptChunk(key,i,env,id)→pt`, `buildRecallToken(blobSecret,rtsign,total,hash)→96`, `parseRecallToken(token,rtsign)→fields`, `stegoEmbed/Extract`, `blake3`

Hardened: no export takes `(plaintext+key)` as separate JS values — chained handles only.

## 8. Tech Stack and File Layout

- **Stack:** AssemblyScript→WASM (crypto/DCAP/chunking/token) + TypeScript (brain/adapters/SDK) + Bun (CLI/daemon) + React (toggle at `src/pages/AccountSettings.tsx` + `/beta/substrate`) + IndexedDB (`idb`) + WebWorkers + WebSockets (health) + WebRTC (swarm)
- **Deps:** `assemblyscript`, `helia`, `bittorrent-dht`, `nostr-tools`, `webtorrent`, `matrix-js-sdk`, `arweave`, `idb`
- **Layout:**

```
packages/sde/
├── assembly/{crypto/{hkdf,aes_gcm,blake3,shake128,hmac,stego},identity/{dms,derivation},chunker/{chunker,assembler},recall/token,routing/{dcap,selector},index.ts}
├── src/
│   ├── brain/{SDEBrain.ts,HealthMonitor.ts,ChunkRouter.ts,SelfHealer.ts}
│   ├── substrates/{base.ts,deep/{DHT,IPFS,Nostr,I2P,Freenet},persistent/{Arweave,Archive,Filecoin},swarm/{Torrent,WebRTCSwarm,Matrix},surface/{Gist,GitLab,Pastebin,DNS,Blockchain},fragile/{Discord,Telegram,Stego}}
│   ├── identity/{DeviceMasterSecret.ts,RecoveryPhrase.ts}
│   ├── workers/EncryptWorker.ts
│   ├── sdk/{upload.ts,download.ts,SDE.ts}
│   └── wasm/loader.ts
├── build/sde.wasm
├── asconfig.json
└── package.json
```

**Public SDK:**
```ts
SDE.upload(file: File, onChunk?: (i,total)=>void) => Promise<{recallToken:string, fileHash:string}>
SDE.download(recallToken:string, onStream:(Uint8Array)=>void) => Promise<File>
```

## 9. Hardening vs v1.0 Spec (What Changed)

1. DMS: remove canvas/screen fingerprint blending → IndexedDB + secureStore only, 0600 fallback with warning (privacy + recovery)
2. Recovery: 6-word → **12-word BIP39** (128-bit) — 6-word brute-forceable
3. Token HMAC: 6B → **16B** (48→128-bit unforgeability); `file_hash = BLAKE3(plaintext)` clarified
4. AAD: XOR → **BLAKE3(chunk_id||i||total)** (anti-swap/truncation)
5. DHT: explicit **1000B BEP-44 sharding** via pointer+magnet+WebSeed
6. STEGO: 10k cover pool **lazy-loaded**, not bundled in WASM
7. Health: **EWMA + quarantine**, per-tier cadence, weighted picks respect `healthScore`

## 10. Open Decisions for Implementation Plan

- Billing for PERSISTENT (Arweave/Filecoin) — free tier vs user-pays vs SquidCloud credits?
- GC/expiry for SURFACE/FRAGILE — self-healing covers, but do we expose TTL in UI?
- Multi-blob (>4 GiB) — sequential recall tokens or single token with blob chain?
- WASM build CI — `asbuild` in `vite` vs `bun` task?

---
*This spec is parallel-safe: SDE never writes to `files`/`encrypted_keys`/`master_keys`; only to its own `sde_chunks`/`sde_health` (or ephemeral, since locators are derivable). Current system unchanged when `mode=default`.*

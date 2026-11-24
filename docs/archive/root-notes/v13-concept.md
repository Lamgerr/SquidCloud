# SquidCloud v13 — Architectural Specification & Conceptual Framework

**Document Version:** 1.0
**Classification:** Internal — Product Architecture
**Target Release:** v13 "Octolus Continuum"

---

## Preamble

This document delineates the architectural vision and conceptual underpinnings for SquidCloud v13, denominated "Octolus Continuum." The forthcoming release constitutes a paradigmatic expansion of the platform's sharing substrate, introducing five interrelated capabilities that collectively transform SquidCloud from a conventional encrypted file repository into a comprehensive, multi-vector data distribution ecosystem. Each feature is articulated herein through its axiomatic foundations, systemic interdependencies, user interaction models, security ramifications, and anticipated operational impact.

The enumerated capabilities — Folder Sharing, Push-to-Device Transfers, Version Timeline, Drop Points (File Inboxes), and Immutable Snapshots — represent a deliberate departure from incremental feature accretion. They are conceived as orthogonal expansions of the platform's architectural envelope, each addressing a distinct lacuna in contemporary encrypted file sharing paradigms while maintaining strict adherence to SquidCloud's foundational zero-knowledge, client-side encryption doctrine.

---

## 1. Folder Sharing — Collective Encrypted Distribution

### 1.1 Conceptual Foundation

The extant sharing architecture operates exclusively at the file-level granularity, necessitating the discrete and repetitive invocation of share creation for each constituent file within a directory hierarchy. This singular-file paradigm imposes substantial cognitive overhead upon users engaged in multi-file distribution workflows — a limitation particularly acute for professionals disseminating project bundles, design packages, or document collections.

Folder Sharing rectifies this architectural impediment by elevating the sharing primitive from the file to the directory abstraction. A single cryptographic share identifier shall henceforth encapsulate an entire folder's contents, recursively resolving to all constituent files while preserving the hierarchical organizational structure. The recipient is presented not with a singular file download but with an interactive directory browser affording granular per-file access or bulk retrieval.

### 1.2 Systemic Architecture

The implementation necessitates a bifurcation of the existing `shares` table schema to accommodate folder-level associations. A nullable `folder_id` foreign key referencing the `folders` table shall be introduced alongside the existing `file_id` column, with an exclusion constraint ensuring that each share record references precisely one entity type — either a file or a folder, never both.

The `create_folder_share` stored procedure shall perform a recursive resolution of the folder's descendant file set, generating a materialized file listing at share-creation time. This materialization strategy, as opposed to dynamic resolution on every access, confers two cardinal advantages: it provides the share recipient with a consistent snapshot irrespective of subsequent folder modifications, and it obviates recursive directory traversal on each page load, mitigating latency for deep hierarchies.

The `get_folder_share_info` function shall return a composite payload comprising folder metadata (name, creation timestamp, aggregate size) alongside a paginated enumeration of constituent files with their respective types, sizes, and individual encryption statuses. The existing AES-256-GCM encryption per-file remains unmodified — the folder abstraction is purely a metadata-container with no cryptographic implications at the aggregate level. Each file within the folder retains its autonomous encryption key and chunk manifest.

### 1.3 User Interaction Model

The share creation dialog shall detect the shared entity's type via the `type` property and, upon folder identification, present the user with a confirmation interface enumerating the folder's file count and aggregate size. The dialog's existing "Folder sharing restricted" inhibition shall be supplanted by the folder share creation pathway.

The share recipient, upon navigating to the `/s/:shareId` URL, shall encounter a reimagined landing page featuring a directory-style file listing with sortable columns (name, size, type, modification date), individual download buttons per file, a "Download All" trigger that initiates sequential or parallel chunk retrieval for all enumerated files, and visual indicators for encrypted status and file type icons.

Security provisions extend to all pre-existing share parameters — password protection, expiration schedules, download limitations, view-only mode, and email collection — each applying uniformly to every file within the folder share. Revocation of the folder share atomically invalidates access to all constituent files.

### 1.4 Operational Semantics

Post-creation mutations to the underlying folder warrant careful consideration. The chosen materialization strategy implies that files added to the folder after share creation shall not be automatically accessible via the existing share link. This design decision, while introducing a minor operational constraint, prevents the scenario wherein an actor gains access to files appended to a folder subsequent to their authorization. Should the user desire to extend the share to encompass newly added files, the share must be regenerated — a deliberate friction point preserving access control intentionality.

---

## 2. Push-to-Device Transfers — Proximity-Independent Cross-Device Propagation

### 2.1 Conceptual Foundation

The canonical file transfer paradigm presupposes that both the transmitting and receiving entities possess authenticated accounts within the platform. This assumption collapses in numerous practical scenarios: transferring a file from one's workstation to a colleague's mobile device during a meeting, delivering a document to a client's laptop in a conference room, or moving a file between one's own devices without navigating through the cloud storage interface.

Push-to-Device transcends these limitations by establishing a ephemeral, proximity-independent transfer channel requiring no recipient authentication. The system generates a human-transmissible one-time code that, when entered on the receiving device, establishes a secure conduit for file delivery. The architectural substrate leverages Supabase Realtime for signaling, WebRTC or server-relayed chunk transmission for the data plane, and a purpose-built `device_transfers` table for state orchestration.

### 2.2 Systemic Architecture

The `device_transfers` table shall serve as the authoritative state store for all in-flight transfers, encompassing the following columnar schema:

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID PRIMARY KEY | Uniquely identifies the transfer record |
| `code` | VARCHAR(6) | Human-transmissible alphanumeric identifier |
| `user_id` | UUID | The transmitting user's identifier |
| `file_id` | UUID REFERENCES files(id) | The file being transferred |
| `share_link` | TEXT | Pre-generated share URL (fallback pathway) |
| `status` | transfer_status | Enum: pending, claimed, expired, cancelled |
| `created_at` | TIMESTAMPTZ | Transfer initiation timestamp |
| `expires_at` | TIMESTAMPTZ | Absolute expiry (creation + 5 minutes) |
| `claimed_at` | TIMESTAMPTZ | Timestamp of recipient claim |

The transfer lifecycle proceeds through four discrete states:

1. **PENDING** — The transmitting user initiates a transfer via the "Push to Device" action. The system invokes the `request-device-transfer` edge function, which generates a statistically unique 6-character alphanumeric code (derived from `crypto.randomBytes` with base-62 encoding, yielding approximately 56.8 billion possible combinations) and inserts a pending record. The code is presented to the transmitting user alongside a countdown timer reflecting the 5-minute validity window.

2. **CLAIMED** — The recipient, on any device, navigates to the `/receive` endpoint and enters the transmitted code. The `claim-device-transfer` edge function validates the code against the `device_transfers` table, confirms non-expiry, and transitions the status to `claimed`. The edge function returns the file's metadata (name, size, type) and a pre-authorized one-time download URL to the recipient. Concurrently, a Realtime broadcast on channel `device-transfer:{code}` notifies the transmitting user's UI of the successful claim, displaying a confirmation animation.

3. **COMPLETED** — Upon successful download completion on the recipient device, the transfer record transitions to `completed`. The one-time download URL is invalidated.

4. **EXPIRED** — A pg_cron edge function (`transfer-poller`) executes at 5-minute intervals, transitioning all records with `expires_at < NOW()` to the expired state, thereby rendering their codes non-claimable.

### 2.3 Data Plane Architecture

Two transmission modalities shall be supported, selected based on network topology:

**Direct Relay (Primary):** The file chunks are transmitted through a server-mediated relay via a dedicated edge function. The edge function retrieves the encrypted chunks from the GitHub storage backend and serves them sequentially to the recipient. This modality imposes minimal latency and operates reliably across heterogeneous network configurations, including NAT traversal scenarios where direct connectivity is infeasible.

**Direct Peer-to-Peer (Fallback):** Upon mutual capability discovery, the system may elect to establish a WebRTC `RTCPeerConnection` between the transmitting and receiving browsers, negotiating an SDP exchange through the Supabase Realtime signaling channel. The file is transmitted directly between peers with end-to-end encryption, eliminating server-side data transit. This modality is contingent upon both peers supporting WebRTC and being reachable through NAT traversal mechanisms (ICE, STUN, TURN).

The chosen modality is transparent to both users — the abstraction layer selects the optimal pathway based on an ICE connectivity check performed during the claiming handshake.

### 2.4 Security Considerations

The 5-minute temporal window and 6-character alphanumeric code strike a deliberate balance between security and usability. The temporal constraint limits brute-force exposure, while the code space (56.8 billion combinations) renders random guessing computationally improbable within the available window. Furthermore, each transfer record permits a single state transition from `pending` to `claimed` — subsequent claim attempts against the same code are rejected, even if valid.

No persistent recipient identity is established. The transfer operates on a zero-trust, single-use basis. The file remains encrypted throughout transit; the recipient receives the encrypted payload and, in the direct relay modality, the decryption key is transmitted through a separate logical channel.

---

## 3. Version Timeline — Chronological Mutation Visualization

### 3.1 Conceptual Foundation

File versioning, while present in SquidCloud's substrate via the `file_versions` table, has historically operated as an invisible infrastructure layer — versions accumulate beneath the surface with no user-visible interface for traversal, comparison, or restoration. The Version Timeline rectifies this omission by surfacing version history as a first-class navigable visualization, transforming the implicit version log into an interactive chronological map of a file's evolutionary trajectory.

The timeline transcends mere historical display by embedding actionable primitives — per-version download, restoration, snapshot creation, and metadata inspection — within the temporal visualization itself. This convergence of visualization and action constitutes a paradigm shift from version-as-implementation-detail to version-as-user-facing-artifact.

### 3.2 Systemic Architecture

The existing `file_versions` table, with its columns for `file_id`, `version_number`, `storage_path`, `size`, `created_at`, `created_by`, `change_description`, `encryption_key`, and `is_current`, provides an adequate substrate for the timeline's data requirements. Two additional stored procedures shall be introduced:

**`get_file_versions(file_id UUID)`:** Returns a comprehensively enriched version list, joining against the `auth.users` table to resolve `created_by` into a human-readable actor identifier (email or display name), computing relative timestamps via PostgreSQL's `AGE()` function, and calculating per-version size deltas relative to the preceding version.

**`restore_file_version(version_id UUID):`** Effects a version restoration by copying the designated version's `storage_path` and `encryption_key` back to the parent file record, inserting a new version record (with incremented `version_number`) to preserve the restoration as an auditable event, and updating the `is_current` flag across all versions.

The timeline component shall fetch version data asynchronously upon mounting, with incremental rendering to ensure responsive interaction even for files with extensive version histories (exceeding 100 revisions). Client-side caching with configurable staleness thresholds prevents redundant refetching during navigation within the same session.

### 3.3 Visual Design Language

The timeline shall adopt a vertical, left-aligned rail metaphor with the following visual strata:

- **Temporal Axis:** A continuous vertical line spanning the timeline's full height, with equidistant node markers at each version's position. The line's color gradient transitions from opaque (most recent) to translucent (oldest), conveying temporal depth.

- **Version Nodes:** Circular indicators at each version point, rendered in two visual states:
  - **Current Version:** Filled primary-color circle with a pulsing "CURRENT" badge adjacent.
  - **Historical Versions:** Outlined circles with reduced opacity, scaling proportionally to temporal distance from present.

- **Detail Cards:** Horizontally offset cards at each node containing:
  - Version number (prefixed with `v`)
  - Relative timestamp (e.g., "3 days ago") with tooltip exposing absolute ISO-8601
  - File size at that version
  - Actor identifier (email or display name)
  - Optional change description (user-supplied or auto-generated "Uploaded via [method]")
  - Size delta indicator (green for reduction, red for growth, gray for identical)

- **Action Overlays:** On hover or focus, each detail card reveals a contextual action bar offering:
  - "Download this version" (retrieves file at that version's state)
  - "Restore to this version" (with confirmation dialog)
  - "Freeze as snapshot" (invokes the Snapshot subsystem, §5)
  - "Copy version link" (generates a direct URL to this specific version)

### 3.4 Interaction Semantics

The timeline supports both linear scrolling for extensive histories and a "compact mode" that collapses versions beyond a configurable threshold (default: 20 visible) into a "Show all N versions" expander. The expanded view employs virtualized rendering (via `react-window` or equivalent) to maintain performance with version counts in the hundreds.

Restoration actions shall trigger a multi-step confirmation cascade:
1. A modal enumerating the consequences (current version becomes historical, new version record created)
2. An optional change description input field
3. PIN verification via the existing `verifyOperationNow` infrastructure
4. Optimistic UI update with rollback on failure

---

## 4. Drop Points — Asymmetric, Anonymous File Ingestion

### 4.1 Conceptual Foundation

The prevailing sharing paradigm is symmetric — the share creator designates a file for consumption by others. This unidirectional model, while suitable for distribution workflows, provides no mechanism for the inverse operation: allowing external parties to deposit files into one's SquidCloud environment without requiring sender authentication or platform membership.

Drop Points invert the sharing polarity, establishing receive-only conduits that enable asymmetric file ingestion. A Drop Point is a cryptographically anchored, time-bound receptacle that accepts file uploads from unauthenticated parties through a simple web interface. The uploaded files traverse the identical encryption pipeline as user-initiated uploads — chunk splitting, AES-256-GCM encryption, GitHub repository dispersal — but under a temporary session key that is subsequently re-encrypted with the Drop Point owner's key material.

This capability finds immediate application in numerous professional contexts: attorneys receiving client documents, educators collecting student submissions, designers aggregating stakeholder assets, and enterprises operating vendor file intake portals.

### 4.2 Systemic Architecture

The Drop Point subsystem introduces two new tables and three edge functions:

**`drop_points` Table:**

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID PRIMARY KEY | Unique drop point identifier |
| `user_id` | UUID REFERENCES auth.users(id) | Drop point owner |
| `title` | TEXT | Human-readable label (e.g., "Client Assets Q3") |
| `target_folder` | TEXT | Destination folder path in owner's hierarchy |
| `access_code` | TEXT | Optional alphanumeric upload passcode |
| `is_active` | BOOLEAN | Toggle for accepting/rejecting uploads |
| `max_file_size` | BIGINT | Per-file upload limit (default: 500MB) |
| `expires_at` | TIMESTAMPTZ | Automatic deactivation timestamp |
| `created_at` | TIMESTAMPTZ | Drop point creation timestamp |
| `file_count` | INTEGER | Denormalized counter of received files |
| `last_activity_at` | TIMESTAMPTZ | Timestamp of most recent upload |

**`drop_point_files` Table:**

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID PRIMARY KEY | Unique record identifier |
| `drop_point_id` | UUID REFERENCES drop_points(id) | Parent drop point |
| `file_id` | UUID REFERENCES files(id) | The ingested file record |
| `original_name` | TEXT | Uploader's original filename |
| `uploaded_at` | TIMESTAMPTZ | Ingestion timestamp |
| `uploader_ip` | INET | Uploader's IP address (audit) |
| `uploader_user_agent` | TEXT | Uploader's User-Agent header |

**Edge Functions:**

1. **`serve-drop-point/index.ts`:** The primary ingress point, serving both the HTML upload interface (for browser-based access) and the multipart upload API (for programmatic access). The function:
   - Validates the drop point's active status and expiry
   - Renders a minimalist, mobile-responsive upload page with drag-and-drop zone
   - Accepts multipart/form-data POST requests containing file payloads
   - Generates a temporary AES-256 key for in-transit encryption
   - Invokes the chunking pipeline against the file payload
   - Dispatches encrypted chunks to the GitHub storage backend
   - Creates a `files` record under the drop point owner's identity
   - Records the ingestion in `drop_point_files`
   - Re-encrypts the temporary key with the owner's key material
   - Broadcasts a Realtime notification to the owner's dashboard

2. **`drop-point-cleanup/index.ts`:** A pg_cron-triggered function executing daily, enumerating drop points with `expires_at < NOW()` and transitioning `is_active` to `false`, preventing further uploads through expired conduits.

3. **`drop-point-notify/index.ts`:** A triggered function executing on `drop_point_files` insertion, composing and delivering in-app and (optionally) push notifications to the drop point owner summarizing the ingestion event.

### 4.3 Cryptographic Considerations

Anonymous uploads present a fundamental cryptographic challenge: the platform cannot delegate client-side encryption to an unauthenticated, untrusted browser session without exposing the encryption pipeline to manipulation. The solution employs a two-phase encryption strategy:

**Phase 1 — Edge-Side Encryption:** Upon receiving the file payload, the edge function generates a transient AES-256-GCM key (`temp_key`) derived from a cryptographically secure random seed. The file is chunked (256KB per chunk), each chunk encrypted with `temp_key`, and the encrypted chunks dispatched to GitHub storage. A manifest is constructed referencing the dispersed chunks.

**Phase 2 — Key Re-Encryption:** The `temp_key` is itself encrypted using the drop point owner's public encryption key (retrieved from the user's `encryption_keys` table or derived from their session key material). This encrypted key envelope is stored alongside the file record. When the owner subsequently accesses the file, their client decrypts the envelope using their private key, recovering `temp_key`, and uses it to decrypt the individual chunks.

This design ensures that the edge function never possesses the owner's key material, maintains the zero-knowledge property (SquidCloud cannot decrypt user files), and allows anonymous uploaders to deposit encrypted files without any client-side cryptography.

### 4.4 Upload Interface Design

The Drop Point landing page (served at `/drop/:shareId`) shall present a purpose-built, minimalist interface comprising:

- A branded header displaying the drop point's title (as configured by the owner)
- A full-viewport drag-and-drop zone with visual feedback states (idle, hover, uploading, success, error)
- File size and type constraints displayed beneath the drop zone
- A progress indicator for multi-file uploads with per-file completion status
- A confirmation panel summarizing successfully uploaded files with their original names
- The upload passcode input (if the drop point is configured with access code protection)
- No navigation, no advertising, no extraneous UI elements — the interface is deliberately constrained to the upload primitive

---

## 5. Immutable Snapshots — Temporal State Freezing

### 5.1 Conceptual Foundation

File versioning, as conventionally implemented, maintains a linear mutation history, but it does not guarantee perpetual accessibility of any particular version. Versions may be pruned by retention policies, overwritten by restoration operations, or rendered inaccessible through share link revocation. Immutable Snapshots address this ephemerality by establishing an orthogonal persistence primitive: a frozen, cryptographically anchored representation of a file at a specific version, bound to its own independent share identifier and immune to subsequent mutations of the source file.

Each snapshot constitutes an autonomous, self-describing artifact — it references the identical encrypted chunk set as the source version without duplicating any chunk data (a zero-copy pointer architecture), but it possesses its own encryption key envelope, its own share link, and its own access control configuration. The snapshot persists independently of the source file's lifecycle; deletion of the source file does not affect the snapshot's accessibility, provided the underlying chunks remain available.

### 5.2 Systemic Architecture

The `file_snapshots` table formalizes the snapshot abstraction:

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID PRIMARY KEY | Unique snapshot identifier |
| `file_id` | UUID REFERENCES files(id) | Source file identifier |
| `version_number` | INTEGER | Source version at freeze moment |
| `storage_path` | TEXT | Immutable reference to chunk locations |
| `encryption_key` | TEXT | Independent encryption key envelope |
| `size` | BIGINT | File size at freeze moment |
| `file_name` | TEXT | File name at freeze moment (preserved even if renamed) |
| `file_type` | TEXT | MIME type at freeze moment |
| `frozen_at` | TIMESTAMPTZ | Immutable freeze timestamp |
| `share_id` | TEXT UNIQUE | Independent share identifier |
| `is_revoked` | BOOLEAN | Share revocation flag |

The snapshot creation procedure (`create_file_snapshot`) executes the following operations transactionally:

1. **Version Identification:** Retrieves the current state of the specified `version_number` from `file_versions`, or, if no version number is specified, captures the file's current state.

2. **Manifest Duplication:** Rather than duplicating the encrypted chunk data (which may span multiple gigabytes across distributed GitHub repositories), the procedure copies the storage manifest — a JSON document enumerating chunk locations, provider references, and chunk indices — into the snapshot's `storage_path` column. This manifest is re-encrypted with a newly generated snapshot-specific AES-256 key, ensuring cryptographic isolation from the source file.

3. **Share Creation:** Generates a unique `share_id` (employing the existing `generate_share_id` function) and creates a dedicated record in the `shares` table referencing the snapshot rather than a file or folder. This share record operates under the same access control mechanisms (password protection, expiry, download limits) but is independent of any file-level shares.

4. **Metadata Capture:** Preserves the file's `name` and `type` at the moment of freezing, immunizing the snapshot against subsequent renames or type changes.

The snapshot retrieval procedure (`get_snapshot_info`) returns the frozen metadata and serves the chunk manifest for decryption. The recipient experiences the snapshot as a standard file download/presentation, indistinguishable from a live file share but for the presence of a "Frozen Snapshot" indicator.

### 5.3 Zero-Copy Data Architecture

The cardinal design decision is the zero-copy approach to snapshot data. A 2GB file with 8,192 encrypted chunks distributed across three GitHub repositories would require the duplication of all 8,192 chunks and their re-encryption under a new key — an operation imposing approximately 30–60 seconds of processing time and consuming 2GB of additional storage. The zero-copy architecture eliminates both the temporal and spatial overhead by:

1. Copying only the manifest JSON (typically 50–200KB), not the chunk payloads
2. Generating a new encryption key for the manifest copy, not the chunk data
3. Referencing the original chunk locations, which remain immutable (GitHub objects are content-addressed and append-only within the storage model)

The security implication warrants explicit articulation: the snapshot and the source file share the same encrypted chunk data but possess distinct encryption keys. An actor with access to the source file's key cannot decrypt the snapshot's chunks, and vice versa, despite the chunks being physically identical. This cryptographic isolation is achieved through the independent key envelope stored in each entity's metadata record.

### 5.4 Lifecycle and Governance

Snapshots persist until explicitly revoked by their creator or deleted through the snapshot management interface. They are not subject to the source file's version retention policy, trash bin expiration, or deletion lifecycle. A source file may be permanently deleted from the platform while its snapshots remain accessible — provided the chunk storage providers retain the underlying data.

The `revoke_snapshot_share` procedure transitions the `is_revoked` flag to `true` and marks the associated share record as inactive. The snapshot data remains intact within the database, enabling potential reactivation, but the share link returns a 404 response.

Management of all snapshots across a user's account shall be integrated into the `ShareManagementDialog` component, with a dedicated "Snapshots" tab enumerating each frozen artifact alongside its source file, freeze date, size, and an option to copy the snapshot's share link or revoke access.

---

## Systemic Interdependencies

The five capabilities enumerated herein, while independently operable, exhibit synergistic interactions when deployed in concert:

- **Version Timeline → Snapshots:** The timeline provides the primary access point for snapshot creation, with each version node offering a "Freeze as snapshot" action. The snapshot, once created, appears as a distinct entity in both the timeline and the share management interface.

- **Drop Points → Folder Sharing:** Drop Points may be configured to deposit ingested files into a shared folder, enabling a workflow wherein external parties deposit files into a folder that is simultaneously shared with a designated audience. The folder share and the drop point operate on orthogonal axes — one for egress, one for ingress — but intersect at the shared folder node.

- **Push-to-Device → Snapshots:** A frozen snapshot may be transmitted via Push-to-Device, combining the immutability guarantee of the snapshot with the proximity convenience of ephemeral transfer. This composite workflow is particularly germane to legal and compliance scenarios requiring auditable, immutable document delivery.

- **Folder Sharing → Push-to-Device:** The recipient of a Push-to-Device transfer may receive a folder share link rather than a singular file, enabling bulk device-to-device transfers of entire project directories.

---

## Security Posture Summary

| Feature | Encryption Model | Authentication Requirement | Key Isolation |
|---------|-----------------|---------------------------|---------------|
| Folder Sharing | Per-file AES-256 (unchanged) | Creator: Full auth; Recipient: Share link | Files retain independent keys |
| Push-to-Device | In-transit TLS + chunk encryption | Creator: Full auth; Recipient: One-time code | Temporary session key |
| Version Timeline | Per-version AES-256 (unchanged) | Full auth | Per-version keys |
| Drop Points | Edge-side AES-256 → Re-encrypted | Creator: Full auth; Uploader: None (link) | Two-phase key envelope |
| Snapshots | Independent AES-256 key per snapshot | Creator: Full auth; Recipient: Share link | Cryptographically isolated from source |

---

## Appendix: Terminology

| Term | Definition |
|------|------------|
| **Share Primitive** | The fundamental access control entity — a file, folder, or snapshot associated with a share identifier |
| **Key Envelope** | An encrypted container storing a file's symmetric encryption key, itself encrypted with the owner's public key material |
| **Zero-Copy Pointer** | A reference to existing encrypted chunk data that avoids duplicating the underlying payload |
| **Materialized Snapshot** | A frozen version's file listing captured at share-creation time (as opposed to dynamically resolved) |
| **Asymmetric Ingestion** | The capacity for unauthenticated parties to deposit files into an authenticated user's storage environment |
| **Temporal Isolation** | The property whereby a snapshot's encryption key is independent of the source file's key, preventing cross-decryption |

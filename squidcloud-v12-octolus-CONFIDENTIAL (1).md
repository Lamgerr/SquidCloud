# SquidCloud v12 — Octolus Update
### Internal Technical Architecture & Feature Specification

---

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                        ⚠  HIGHLY CONFIDENTIAL  ⚠                           ║
║                                                                              ║
║  This document is classified as INTERNAL — RESTRICTED ACCESS.               ║
║  Documentation embargo active until: June 17, 2026                         ║
║  Planned public release date:        July 10, 2026                         ║
║                                                                              ║
║  Unauthorized distribution, reproduction, or disclosure of any content      ║
║  within this document prior to the embargo lift date is strictly             ║
║  prohibited and constitutes a breach of internal policy.                    ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

**Document Version:** `v12.0.0-internal`
**Classification:** RESTRICTED / INTERNAL
**Author:** SquidCloud Core Team
**Embargo Lift:** June 17, 2026
**Release Target:** July 10, 2026
**Codename:** `octolus`

---

## Table of Contents

1. [Overview](#1-overview)
2. [v12 Feature Summary](#2-v12-feature-summary)
3. [Feature I — Dynamic Credit Quota System (DCQS)](#3-feature-i--dynamic-credit-quota-system-dcqs)
4. [Feature II — Collaborative Workspaces & RBAC](#4-feature-ii--collaborative-workspaces--rbac)
5. [Feature III — Webhook Engine & API Key Management](#5-feature-iii--webhook-engine--api-key-management)
6. [Feature IV — FLE21: File Latency Elimination Engine, Generation 21](#6-feature-iv--fle21-file-latency-elimination-engine-generation-21)
   - 6.1 [Philosophy & Goals](#61-philosophy--goals)
   - 6.2 [System Architecture](#62-system-architecture)
   - 6.3 [Component Breakdown](#63-component-breakdown)
   - 6.4 [Core Algorithm — Full Mathematical Specification](#64-core-algorithm--full-mathematical-specification)
   - 6.5 [CDN Routing Matrix (CRM)](#65-cdn-routing-matrix-crm)
   - 6.6 [Delta Compression Pipeline (DCP)](#66-delta-compression-pipeline-dcp)
   - 6.7 [Predictive Cache Warmer (PCW)](#67-predictive-cache-warmer-pcw)
   - 6.8 [Throughput Normalizer & Arbiter (TNA)](#68-throughput-normalizer--arbiter-tna)
   - 6.9 [Credit Integration with ASQ](#69-credit-integration-with-asq)
   - 6.10 [FLE21 Action Flow Diagram](#610-fle21-action-flow-diagram)
7. [Release Timeline](#7-release-timeline)

---

## 1. Overview

SquidCloud v12, internally codenamed **Octolus**, represents the most architecturally significant update to the platform since its initial deployment. This release is not an incremental patch — it is a systems-level rearchitecture of four foundational pillars:

- **Resource fairness** via a mathematically-grounded credit quota model
- **Team productivity** via collaborative workspaces with role-based access
- **Extensibility** via a first-class webhook engine and API key infrastructure
- **Infrastructure intelligence** via FLE21, a novel file delivery and optimization engine that acts as the execution backbone of all file actions

Every feature introduced in v12 is designed to operate in concert with FLE21. The credit system feeds off FLE21's stress calculations. The collaboration system routes workspace file operations through FLE21's CDN matrix. Webhooks are triggered by event emissions from FLE21's action pipeline. This unified design eliminates redundancy and produces a platform that is measurably faster, cheaper to operate, and architecturally more defensible than v11.

---

## 2. v12 Feature Summary

| # | Feature | Category | Complexity |
|---|---------|----------|------------|
| 1 | Dynamic Credit Quota System (DCQS) | Resource Management | High |
| 2 | Collaborative Workspaces + RBAC + Real-Time Presence | Collaboration | High |
| 3 | Webhook Engine + API Key Management | Extensibility | Medium |
| 4 | FLE21 — File Latency Elimination Engine, Gen 21 | Core Infrastructure | Very High |

---

## 3. Feature I — Dynamic Credit Quota System (DCQS)

### 3.1 Concept

The Dynamic Credit Quota System (DCQS) introduces a **stress-proportional, action-aware credit model** that replaces flat-rate usage tracking. Every action a user performs — uploading, downloading, previewing, or sharing a file — consumes credits proportional to the real computational and I/O load it induces on the infrastructure.

This is not a billing mechanism. It is a **fairness and throttling layer** — ensuring that no single user can exhaust shared infrastructure resources while giving power users on custom storage plans virtually unrestricted headroom.

### 3.2 Quota Tiers

| User Tier | Daily Credit Limit ($Q_{max}$) | Reset Cadence |
|-----------|-------------------------------|---------------|
| Default (all users) | **200 credits/day** | Midnight UTC |
| Custom Storage Provider | **100,000 credits/day** | Midnight UTC |

> **Design rationale:** The 500× difference between tiers is intentional. Custom storage users run their own storage backends — SquidCloud's server acts as a thin orchestration and routing layer, incurring minimal marginal cost. Default users consume SquidCloud's managed infrastructure, where resource budgeting is critical.

### 3.3 Base Credit Cost Table

The following represents the baseline cost matrix **before** FLE21 stress adjustment. FLE21 applies dynamic multipliers on top of these base values (detailed in Section 6.9).

| Action | Base Cost | Notes |
|--------|-----------|-------|
| Upload (≤ 1 MB) | 2–3 credits | Low I/O, minimal DB write |
| Upload (1–10 MB) | 5–10 credits | Moderate chunked write |
| Upload (10–100 MB) | 15–30 credits | High throughput, multipart |
| Upload (> 100 MB) | 25–50 credits | Full multipart + metadata indexing |
| Download (any size) | 1 credit (base) + size factor | CDN-routed, cheaper than upload |
| File Preview (open/view) | 1 credit (base) | Tab open, no render |
| File Preview + Render (≤ 10 MB) | 12–15 credits | Thumbnail gen + stream |
| File Preview + Render (> 10 MB) | 20–40 credits | Full render pipeline activation |
| Share Link Generation | 3 credits | Signed URL creation + DB record |
| Workspace Invite | 5 credits | Auth record + notification |
| Webhook Trigger (outbound) | 1 credit | Fire-and-forget HTTP POST |

### 3.4 Preview Credit Calculation — Worked Example

For a **10 MB image file** being previewed:

```
Base view credit:         1
Preview render credit:   12  (10 MB × 1.2 render factor)
                        ────
Total deducted:          13 credits
```

For a **25 MB PDF** being previewed:

```
Base view credit:         1
Preview render credit:   25  (25 MB × 1.0 render factor for PDF)
                        ────
Total deducted:          26 credits
```

This model ensures that a user casually browsing file names never exhausts quota, while heavy rendering operations are costed accurately.

### 3.5 Remaining Quota Formula

At any point during a user's day, their remaining credit balance is:

$$Q_{\text{remaining}}(u, d) = Q_{\max}(u) - \sum_{i=1}^{n} C(a_i, f_i, u)$$

Where:
- $u$ = user identity
- $d$ = current calendar day (UTC)
- $n$ = number of actions performed on day $d$
- $C(a_i, f_i, u)$ = credit cost of action $a_i$ on file $f_i$ for user $u$ (defined in Section 6.9)
- $Q_{\max}(u)$ = tier-based quota ceiling

### 3.6 Quota Enforcement Behaviour

When $Q_{\text{remaining}}(u, d) \leq 0$:

- All upload and download actions are **blocked** with a `429 Quota Exceeded` response
- File **viewing** (metadata only, no render) is **permitted** at 0 additional cost
- Share links already generated remain **active** — generation of new ones is blocked
- Webhook outbound triggers are **queued** and fire upon next-day reset
- Users receive a warning notification at **20% remaining** and **5% remaining**

### 3.7 Frontend Quota Display

- Persistent quota pill in the top navigation bar showing `Credits: 143 / 200`
- Color transitions: green (>50%) → amber (20–50%) → red (<20%)
- Tooltip on hover shows per-action cost breakdown for the current day

---

## 4. Feature II — Collaborative Workspaces & RBAC

### 4.1 Concept

Shared Workspaces transform SquidCloud from a personal cloud storage tool into a team-grade collaboration platform. A **Workspace** is a first-class entity — separate from a user's personal storage — that multiple users can be invited to and operate within under defined permission roles.

### 4.2 Role Hierarchy

```
Owner
  └── Admin
        └── Editor
              └── Viewer
```

| Permission | Viewer | Editor | Admin | Owner |
|-----------|--------|--------|-------|-------|
| View files | ✅ | ✅ | ✅ | ✅ |
| Download files | ✅ | ✅ | ✅ | ✅ |
| Upload files | ❌ | ✅ | ✅ | ✅ |
| Delete files | ❌ | ✅ (own) | ✅ | ✅ |
| Invite members | ❌ | ❌ | ✅ | ✅ |
| Manage roles | ❌ | ❌ | ✅ | ✅ |
| Delete workspace | ❌ | ❌ | ❌ | ✅ |
| Configure webhooks | ❌ | ❌ | ✅ | ✅ |

### 4.3 Real-Time Presence

All active workspace members are visible in real-time via a **WebSocket-based presence channel** (one persistent socket per workspace session):

- **Avatar stack** in top-right showing who is currently in the workspace
- **File-level indicators** — ghost cursor shows which file another user is viewing or editing
- **Presence heartbeat** every 10 seconds — user marked offline after 30s of missed heartbeats
- **Join/leave system messages** in the activity feed

### 4.4 Workspace Data Model (Simplified)

```typescript
type Workspace = {
  id: string
  name: string
  owner_id: string
  created_at: Date
  storage_backend: 'managed' | 'custom'
  member_limit: number
}

type WorkspaceMember = {
  workspace_id: string
  user_id: string
  role: 'viewer' | 'editor' | 'admin' | 'owner'
  invited_by: string
  joined_at: Date
}

type PresenceRecord = {
  workspace_id: string
  user_id: string
  current_file_id: string | null
  last_heartbeat: Date
  socket_id: string
}
```

### 4.5 Credit Attribution in Workspaces

File actions within a workspace are credited against the **acting user's** quota, not the workspace owner's. This prevents resource abuse via shared workspaces while keeping the credit model fair and auditable.

---

## 5. Feature III — Webhook Engine & API Key Management

### 5.1 Webhook Architecture

SquidCloud v12 introduces a **first-class event emission system** that allows users and workspace owners to register HTTP endpoints to receive real-time notifications on file lifecycle events.

### 5.2 Supported Trigger Events

| Event | Payload Includes |
|-------|-----------------|
| `file.uploaded` | file_id, name, size, uploader_id, workspace_id, timestamp |
| `file.deleted` | file_id, name, deleted_by, workspace_id, timestamp |
| `file.shared` | file_id, share_link, recipient, expiry, timestamp |
| `file.downloaded` | file_id, downloaded_by, ip_hash, timestamp |
| `file.preview_opened` | file_id, viewer_id, render_triggered, timestamp |
| `workspace.member_added` | workspace_id, new_member_id, role, invited_by |
| `workspace.member_removed` | workspace_id, removed_member_id, removed_by |
| `quota.warning` | user_id, remaining_credits, threshold_hit (20% or 5%) |

### 5.3 Webhook Delivery Guarantees

- **At-least-once delivery** with exponential backoff retry (3 attempts: 5s, 30s, 5min)
- **HMAC-SHA256 signature** on every outbound payload (header: `X-SquidCloud-Signature`)
- **Delivery log** — last 100 webhook deliveries visible per endpoint in dashboard
- **Dead-letter queue** — failed deliveries after 3 retries stored for 72 hours, manually re-triggerable

### 5.4 API Key Management

Each user and workspace can issue scoped API keys:

```
sqd_live_<tier>_<32-char-random>
```

| Scope | Permitted Operations |
|-------|---------------------|
| `read` | List files, download, get metadata |
| `write` | Upload, delete, move, rename |
| `webhooks` | Register, delete, list webhook endpoints |
| `admin` | All of the above + member management |

- Keys are shown **once** at generation — not stored in plaintext
- Keys can be revoked individually without affecting other keys
- Per-key rate limiting configurable (default: 100 req/min, burst: 200)

---

## 6. Feature IV — FLE21: File Latency Elimination Engine, Generation 21

---

### 6.1 Philosophy & Goals

**FLE21** — *File Latency Elimination Engine, Generation 21* — is the execution engine that underlies every file action in SquidCloud v12. It is not a feature visible to end users; it is the infrastructure layer that makes all other features perform at their best.

FLE21's design philosophy rests on three axioms:

1. **Every byte transferred has a cost** — computational, financial, and temporal. FLE21 exists to minimise all three simultaneously.
2. **Routing intelligence beats raw bandwidth** — a file routed to the right CDN node on a moderate pipe outperforms a file sent from origin over a fat pipe.
3. **Prediction is cheaper than reaction** — pre-warming a cache entry before a user requests a file is orders of magnitude cheaper than serving it cold from origin.

FLE21 does not replace the storage backend. It sits **between the application layer and the storage/CDN layer**, acting as a unified intelligent broker for all I/O.

### 6.2 System Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                        SquidCloud Application Layer                   │
│          (Next.js API Routes / Edge Functions / Auth Layer)            │
└──────────────────────────────┬────────────────────────────────────────┘
                               │  All file I/O requests
                               ▼
┌───────────────────────────────────────────────────────────────────────┐
│                         FLE21 GATEWAY                                  │
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │     ASQ      │  │    CDN-RM    │  │     DCP      │  │    PCW    │ │
│  │ Adaptive     │  │  CDN Routing │  │    Delta     │  │Predictive │ │
│  │  Stress      │  │   Matrix     │  │ Compression  │  │   Cache   │ │
│  │ Quantifier   │  │              │  │  Pipeline    │  │  Warmer   │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │
│         │                 │                  │                │       │
│  ┌──────▼─────────────────▼──────────────────▼────────────────▼─────┐ │
│  │                  TNA — Throughput Normalizer & Arbiter            │ │
│  │            (Token Bucket · Load Balancer · Queue Manager)         │ │
│  └──────────────────────────────┬────────────────────────────────────┘ │
│                                 │                                      │
│  ┌──────────────────────────────▼────────────────────────────────────┐ │
│  │                    CDE — Credit Deduction Engine                  │ │
│  │           (Reads ASQ output → deducts from DCQS quota)            │ │
│  └──────────────────────────────┬────────────────────────────────────┘ │
└──────────────────────────────────┼────────────────────────────────────┘
                                   │  Routed, optimised I/O
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                     ▼
     ┌────────────────┐  ┌─────────────────┐  ┌──────────────────┐
     │  CDN Edge Nodes│  │  Object Storage │  │  Custom Provider │
     │  (Global PoPs) │  │  (Managed)      │  │  (BYOK / S3 /    │
     │                │  │                 │  │   R2 / GCS)      │
     └────────────────┘  └─────────────────┘  └──────────────────┘
```

### 6.3 Component Breakdown

| Component | Full Name | Responsibility |
|-----------|-----------|----------------|
| **ASQ** | Adaptive Stress Quantifier | Calculates real-time server stress score for any given action + file combination |
| **CDN-RM** | CDN Routing Matrix | Selects the globally optimal CDN edge node based on latency, load, and geographic proximity |
| **DCP** | Delta Compression Pipeline | Determines whether a file action can be reduced to a delta operation, and executes compression |
| **PCW** | Predictive Cache Warmer | ML-based access predictor that pre-warms cache entries at CDN edges before user requests |
| **TNA** | Throughput Normalizer & Arbiter | Token-bucket rate limiter, concurrent request arbitrator, and priority queue manager |
| **CDE** | Credit Deduction Engine | Consumes ASQ output and atomically deducts credits from the user's DCQS balance |

---

### 6.4 Core Algorithm — Full Mathematical Specification

#### 6.4.1 Notation Glossary

| Symbol | Definition |
|--------|------------|
| $f$ | File object |
| $S(f)$ | File size in bytes |
| $a$ | Action type $\in \{upload, download, preview, share\}$ |
| $u$ | User identity |
| $\sigma(a, f)$ | Stress score for action $a$ on file $f$ |
| $\phi(S)$ | Byte-weight function — maps file size to a normalised load scalar |
| $\kappa(t)$ | Temporal congestion factor at time $t$ |
| $\mu(f)$ | File type complexity coefficient |
| $\nu(n)$ | Concurrent load factor given $n$ active requests |
| $\alpha_a, \beta_a, \gamma_a, \delta_a$ | Action-specific tunable weight coefficients |
| $C(a, f, u)$ | Final credit cost of action $a$ on file $f$ for user $u$ |
| $\tau(u)$ | User tier multiplier |
| $\rho$ | Global credit scaling constant |

---

#### 6.4.2 The FLE21 Stress Function — ASQ

The central innovation of FLE21 is the **Adaptive Stress Score** $\sigma$, a real-valued scalar computed per-action in under 2ms. It is defined as a weighted linear combination of four independent factors:

$$\boxed{\sigma(a, f) = \alpha_a \cdot \phi\bigl(S(f)\bigr) + \beta_a \cdot \kappa(t) + \gamma_a \cdot \mu(f) + \delta_a \cdot \nu(n)}$$

Each factor is described below.

---

#### 6.4.3 Byte-Weight Function $\phi(S)$

The relationship between file size and server stress is **not linear**. Small files have disproportionately high per-byte overhead (metadata writes, connection setup, index updates). Large files stress throughput and memory buffers. FLE21 models this with a **three-regime piecewise function**:

$$\phi(S) = \begin{cases} \log_2\!\left(\dfrac{S}{1024} + 1\right) & \text{if } S \leq 10 \cdot 2^{20} \text{ B (≤ 10 MB)} \\[10pt] \sqrt{\dfrac{S}{2^{20}}} & \text{if } 10 \cdot 2^{20} < S \leq 100 \cdot 2^{20} \text{ B (10–100 MB)} \\[10pt] \dfrac{S}{2^{20} \cdot k} & \text{if } S > 100 \cdot 2^{20} \text{ B (> 100 MB)} \end{cases}$$

Where $k = 4.0$ is the large-file attenuation constant. This ensures that very large files do not produce runaway stress scores — their cost grows linearly but slowly.

**Empirically derived output examples:**

| File Size | $\phi(S)$ |
|-----------|-----------|
| 512 KB | ~0.47 |
| 1 MB | ~0.59 |
| 5 MB | ~0.96 |
| 10 MB | ~1.08 |
| 50 MB | ~7.07 |
| 100 MB | ~10.0 |
| 500 MB | ~125.0 |
| 1 GB | ~256.0 |

---

#### 6.4.4 Temporal Congestion Factor $\kappa(t)$

Server load varies cyclically. FLE21 models the time-of-day congestion using a **superposition of sinusoidal harmonics** calibrated against observed traffic patterns:

$$\kappa(t) = 1 + A_1 \sin\!\left(\frac{2\pi t}{T} + \varphi_1\right) + A_2 \sin\!\left(\frac{4\pi t}{T} + \varphi_2\right)$$

Where:
- $t$ = seconds elapsed since UTC midnight
- $T = 86400$ s (one full day)
- $A_1 = 0.30$, $\varphi_1 = -\pi/3$ (primary peak: ~14:00 UTC)
- $A_2 = 0.10$, $\varphi_2 = \pi/4$ (secondary peak: ~09:00 UTC)

This yields $\kappa(t) \in [0.60, 1.40]$, with peak congestion at midday UTC and lowest load at ~04:00 UTC. Actions performed at off-peak hours are proportionally cheaper in credit terms.

---

#### 6.4.5 File Type Complexity Coefficient $\mu(f)$

Different file types demand different levels of server-side processing. A raw binary upload requires minimal post-processing; a video file triggers thumbnail generation, format validation, and metadata extraction. FLE21 encodes this as a static lookup:

$$\mu(f) = \begin{cases} 0.5 & \text{plaintext, } \texttt{.txt}, \texttt{.csv}, \texttt{.json} \\ 0.8 & \text{document: } \texttt{.pdf}, \texttt{.docx}, \texttt{.xlsx} \\ 1.0 & \text{image: } \texttt{.jpg}, \texttt{.png}, \texttt{.webp} \\ 1.5 & \text{archive: } \texttt{.zip}, \texttt{.tar.gz} \\ 2.0 & \text{video: } \texttt{.mp4}, \texttt{.mkv}, \texttt{.mov} \\ 2.5 & \text{raw/unknown binary} \end{cases}$$

---

#### 6.4.6 Concurrent Load Factor $\nu(n)$

The marginal cost of an action rises when the server is already under concurrent load. FLE21 models this as a **sub-linear growth function** to avoid runaway costs during traffic spikes:

$$\nu(n) = 1 + \frac{\ln(n + 1)}{\ln(N_{\max} + 1)}$$

Where:
- $n$ = current number of active file I/O requests across the system
- $N_{\max}$ = configured maximum concurrent requests (default: 5000)

This yields $\nu(n) \in [1.0, 2.0]$.

---

#### 6.4.7 Action Weight Coefficients

Each action type has a distinct sensitivity profile. The following table defines the four coefficients per action:

| Action $a$ | $\alpha_a$ | $\beta_a$ | $\gamma_a$ | $\delta_a$ |
|------------|-----------|-----------|-----------|-----------|
| `upload` | 1.00 | 0.30 | 0.50 | 0.20 |
| `download` | 0.50 | 0.20 | 0.30 | 0.15 |
| `preview` | 0.30 | 0.15 | 0.80 | 0.10 |
| `share` | 0.10 | 0.10 | 0.10 | 0.05 |

> Uploads are the most server-intensive action (highest $\alpha_a$). Previews are disproportionately affected by file type ($\gamma_a = 0.80$) because rendering a video vs. a text file produces vastly different load profiles.

---

#### 6.4.8 Credit Deduction Formula — CDE

The Credit Deduction Engine converts the continuous stress score $\sigma$ into a discrete integer credit cost:

$$\boxed{C(a, f, u) = \left\lceil \sigma(a, f) \cdot \tau(u) \cdot \rho \right\rceil}$$

Where:
- $\tau(u) = 1.0$ for default users
- $\tau(u) = 0.002$ for custom storage providers (effectively 500× cheaper, reflecting their reduced infrastructure load)
- $\rho = 3.5$ is the global credit scalar (tunable per deployment)

**Concrete worked example — 10 MB image upload, default user, off-peak time:**

$$\phi(10 \cdot 2^{20}) = \sqrt{10} \approx 3.16$$
$$\kappa(t_{\text{off-peak}}) \approx 0.72$$
$$\mu(f_{\text{image}}) = 1.0$$
$$\nu(n = 200) = 1 + \frac{\ln(201)}{\ln(5001)} \approx 1 + \frac{5.30}{8.52} \approx 1.62$$

$$\sigma = (1.00)(3.16) + (0.30)(0.72) + (0.50)(1.0) + (0.20)(1.62)$$
$$\sigma = 3.16 + 0.216 + 0.50 + 0.324 = 4.20$$

$$C = \lceil 4.20 \times 1.0 \times 3.5 \rceil = \lceil 14.70 \rceil = \mathbf{15 \text{ credits}}$$

---

### 6.5 CDN Routing Matrix (CRM)

For every file action request $r$ originating from a user at geographic location $L$, CRM selects the **globally optimal CDN edge node** from the set of available nodes $\mathcal{N}$:

$$\text{node}^* = \arg\min_{n \in \mathcal{N}} \;\left[ \lambda \cdot d(L, n) + (1 - \lambda) \cdot \frac{\text{load}(n)}{\text{capacity}(n)} \right]$$

Where:
- $d(L, n)$ = estimated round-trip latency (ms) from user location to node $n$, approximated via geodesic haversine distance weighted by known backbone topology
- $\text{load}(n)$ = current active request count at node $n$
- $\text{capacity}(n)$ = maximum rated concurrent requests for node $n$
- $\lambda = 0.65$ = proximity preference weight (tunable; higher values favour latency over load balancing)

**Haversine distance approximation used internally:**

$$d_{\text{geo}}(L, n) = 2R \arcsin\!\sqrt{\sin^2\!\left(\frac{\Delta\phi}{2}\right) + \cos\phi_L \cos\phi_n \sin^2\!\left(\frac{\Delta\lambda}{2}\right)}$$

Where $R = 6371$ km, $\phi$ = latitude, $\lambda_{\text{coord}}$ = longitude.

The geodesic distance is then converted to latency via a linear approximation calibrated per backbone region:

$$\hat{t}(L, n) = c_0 + c_1 \cdot d_{\text{geo}}(L, n)$$

With empirical constants $c_0 = 12$ ms (base handshake overhead), $c_1 = 0.0085$ ms/km.

**Node selection is re-evaluated on every request** — there is no sticky routing. If a node degrades between consecutive requests from the same user, the second request is transparently rerouted.

---

### 6.6 Delta Compression Pipeline (DCP)

When a file is **updated** (re-uploaded with the same name/ID), DCP determines whether a full upload or a delta-only transfer is more efficient.

#### 6.6.1 Delta Eligibility

A file update is eligible for delta transfer if:

$$\frac{|\Delta f|}{|f_{\text{new}}|} < \theta_{\Delta}$$

Where:
- $|\Delta f|$ = size of the binary delta between old and new file versions
- $|f_{\text{new}}|$ = full size of the new file
- $\theta_{\Delta} = 0.60$ = delta efficiency threshold (if delta is more than 60% the size of the full file, full upload is used instead)

#### 6.6.2 Delta Computation

FLE21 uses a **rolling-hash chunked diffing algorithm** (derivative of rsync's algorithm) for efficient delta computation:

1. Divide $f_{\text{old}}$ into fixed-size blocks of size $B = 4096$ bytes
2. Compute weak Adler-32 checksum and strong MD5 for each block
3. Slide a window of size $B$ over $f_{\text{new}}$, matching against $f_{\text{old}}$ checksums
4. Emit **copy instructions** for matched blocks and **literal bytes** for unmatched regions
5. Encode the delta stream as: `[COPY, offset, length]` and `[LITERAL, len, bytes...]`

#### 6.6.3 Efficiency Ratio

$$\eta_{\Delta}(f) = 1 - \frac{|\Delta f|}{|f_{\text{new}}|}$$

For a 50 MB log file with a 2 MB append:
$$\eta_{\Delta} = 1 - \frac{2}{50} = 0.96 \quad (96\% \text{ transfer reduction})$$

Credit cost for a delta upload is computed using $|\Delta f|$ as the effective $S(f)$ in the stress function — not $|f_{\text{new}}|$. This makes incremental saves extremely cheap.

---

### 6.7 Predictive Cache Warmer (PCW)

PCW anticipates which files a user is likely to access next and pre-positions them at the nearest CDN edge node — **before the user requests them**.

#### 6.7.1 Access Probability Model

For a given user $u$ and file $f$, PCW computes the access probability at time $t$ using a **temporal decay model**:

$$P(f, u, t) = \frac{\text{freq}(f, u) \cdot e^{-\lambda_d (t - t_{\text{last}}(f, u))}}{\displaystyle\sum_{f' \in \mathcal{F}_u} \text{freq}(f', u) \cdot e^{-\lambda_d (t - t_{\text{last}}(f', u))}}$$

Where:
- $\text{freq}(f, u)$ = total historical access count of file $f$ by user $u$
- $t_{\text{last}}(f, u)$ = timestamp of last access of $f$ by $u$
- $\lambda_d = 0.0001$ s$^{-1}$ = decay constant (half-life ≈ 2 hours)
- $\mathcal{F}_u$ = set of all files the user has ever accessed

#### 6.7.2 Warm Threshold

A file $f$ is pre-warmed to the user's nearest CDN edge node if:

$$P(f, u, t) > \theta_{\text{warm}}$$

Where $\theta_{\text{warm}} = 0.15$ (top ~15% probability files are pre-cached).

Pre-warming is performed **asynchronously** via a background job that runs every 5 minutes per active user. The CDN edge TTL for pre-warmed entries is set to 30 minutes, after which they are evicted unless the probability model still justifies their presence.

---

### 6.8 Throughput Normalizer & Arbiter (TNA)

TNA prevents any single user or workspace from saturating I/O channels, using a **dual-bucket token model** (one bucket for burst capacity, one for sustained throughput):

#### 6.8.1 Token Bucket Model

For each user $u$, TNA maintains two token buckets:

**Burst bucket** — governs short-term request spikes:

$$r_{\text{burst}}(t + \Delta t) = \min\!\left(r_{\text{burst}}(t) + \mu_{\text{burst}} \cdot \Delta t,\; C_{\text{burst}}\right)$$

**Sustained bucket** — governs long-term average throughput:

$$r_{\text{sustained}}(t + \Delta t) = \min\!\left(r_{\text{sustained}}(t) + \mu_{\text{sustained}} \cdot \Delta t,\; C_{\text{sustained}}\right)$$

Default parameters:

| Parameter | Default Value | Custom Storage |
|-----------|--------------|----------------|
| $C_{\text{burst}}$ (burst capacity) | 10 tokens | 200 tokens |
| $\mu_{\text{burst}}$ (burst refill rate) | 2 tokens/s | 40 tokens/s |
| $C_{\text{sustained}}$ (sustained capacity) | 60 tokens | 2000 tokens |
| $\mu_{\text{sustained}}$ (sustained refill rate) | 1 token/s | 20 tokens/s |

Each file I/O request consumes 1 token from both buckets. If either bucket is empty, the request is **queued** (not rejected) with a maximum queue depth of 50 per user. Requests exceeding queue depth return `503 Throughput Exceeded`.

---

### 6.9 Credit Integration with ASQ

The CDE component reads the ASQ stress score $\sigma(a, f)$ and applies the credit deduction formula atomically via a **database transaction** to prevent race conditions on the quota counter:

```
BEGIN TRANSACTION
  current_credits = SELECT credits_remaining FROM quotas WHERE user_id = u AND day = today
  IF current_credits < C(a, f, u):
    ROLLBACK → return 429 Quota Exceeded
  UPDATE quotas SET credits_remaining = current_credits - C(a, f, u)
    WHERE user_id = u AND day = today
  INSERT INTO credit_log (user_id, action, file_id, cost, timestamp)
    VALUES (u, a, f.id, C(a, f, u), NOW())
COMMIT
```

This guarantees that credit deduction and action execution are **atomic** — a user can never proceed past quota limits due to a race condition.

---

### 6.10 FLE21 Action Flow Diagram

```
User triggers action (upload / download / preview / share)
                    │
                    ▼
         ┌──────────────────┐
         │   TNA — Check    │
         │  Token Buckets   │
         └────────┬─────────┘
           empty? │ tokens available
           queue  │
                  ▼
         ┌──────────────────┐
         │  ASQ — Compute   │
         │  Stress Score σ  │
         └────────┬─────────┘
                  │ σ value
                  ▼
         ┌──────────────────┐
         │  CDE — Deduct    │
         │  Credits C(a,f,u)│
         └────────┬─────────┘
         quota ok?│  quota exceeded? → 429
                  ▼
       ┌──────────────────────┐
       │  DCP — Delta check   │
       │  (uploads only)      │
       │  η > 0.40? → delta   │
       └──────────┬───────────┘
                  │
                  ▼
       ┌──────────────────────┐
       │  CDN-RM — Select     │
       │  optimal edge node   │
       └──────────┬───────────┘
                  │
                  ▼
       ┌──────────────────────┐
       │  Execute I/O via     │
       │  selected CDN node   │
       └──────────┬───────────┘
                  │
                  ▼
       ┌──────────────────────┐
       │  Emit webhook event  │
       │  (if registered)     │
       └──────────┬───────────┘
                  │
                  ▼
       ┌──────────────────────┐
       │  PCW — Update access │
       │  probability model   │
       └──────────────────────┘
                  │
                  ▼
              Response to client
```

---

## 7. Release Timeline

| Milestone | Date |
|-----------|------|
| Feature freeze | May 30, 2026 |
| Internal QA begins | June 1, 2026 |
| Documentation embargo lift | **June 17, 2026** |
| Public beta (invite-only) | June 24, 2026 |
| **v12 (Octolus) General Release** | **July 10, 2026** |

---

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                        ⚠  HIGHLY CONFIDENTIAL  ⚠                           ║
║  Do not share, publish, or distribute this document before June 17, 2026.  ║
║  Classification: INTERNAL — RESTRICTED                                      ║
║  SquidCloud Core Team © 2026. All rights reserved.                          ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

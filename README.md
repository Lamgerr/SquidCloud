<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./cx/SquidCloud%20-%20Secure%20Unlimited%20Cloud%20Storage.png">
    <img alt="SquidCloud" src="./cx/SquidCloud%20-%20Secure%20Unlimited%20Cloud%20Storage.png" width="120">
  </picture>
  <h1>SquidCloud</h1>
  <p><strong>Secure, Unlimited Cloud Storage with Visual Automation</strong></p>

  [![Version](https://img.shields.io/badge/v11.0.22-Feijoa-8B5CF6?style=flat-square)](https://squidcloud.vercel.app)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](https://opensource.org/licenses/MIT)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
  [![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
  [![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase)](https://supabase.io/)
  [![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel)](https://vercel.com)
</div>

---

**SquidCloud** is a next-generation privacy-first cloud storage platform — now with visual automation pipelines and one-click website publishing. Powered by the Res54 distributed architecture, it offers uncapped storage, military-grade encryption, and an integrated automation engine—all from your browser.

---

## Table of Contents

- [What Makes SquidCloud Different?](#what-makes-squidcloud-different)
- [Feature Deep Dives](#feature-deep-dives)
- [What's New in v11](#whats-new-in-v11)
- [Platform Preview](#platform-preview)
- [Security & Privacy](#security--privacy)
- [Getting Started](#getting-started)
- [Support](#support)

---

## What Makes SquidCloud Different?

| Capability | SquidCloud | Traditional Cloud |
|---|---|---|
| Storage Limit | **Unlimited** | 5–15 GB free |
| File Size Limit | **None** | 5–50 GB |
| Client-Side Encryption | **AES-256-GCM + Argon2id** | Server-side only |
| Visual Pipeline Automation | **Built-in drag & drop** | Not available |
| Website Publishing | **One-click from storage** | Not available |
| Privacy Model | **Zero-knowledge** | Provider has access |
| Embedded IDE | **Monaco-powered cbCode** | Not available |

---

## Feature Deep Dives

### SquidActions — Visual Automation Pipelines

Skip the scripting. Build automated file workflows by dragging components onto a canvas — no coding required.

- **Visual Pipeline Builder** — React Flow canvas with drag-and-drop components, edge connections, and real-time configuration
- **100+ Pre-built Components** — Triggers, file operations, notifications, AI/ML, data transformation, networking, security, and more — organized into 12 categories
- **Auto-YAML Generation** — Every visual change instantly produces executable YAML. Switch between the visual canvas and the raw YAML editor at any time
- **Smart Variables** — 200+ contextual variables (file metadata, user info, session data, analytics) accessible through a searchable panel. Just click to copy
- **Sub-Component Config** — Expandable inline configuration forms inside each node — select dropdowns, checkboxes, and text inputs for fine-grained control
- **Multiple Triggers** — Manual, scheduled (cron), webhook, file change events, or pipeline chaining
- **Execution History** — Every run is tracked with job and step-level logging
- **AI-Ready** — Copy the SquidActions AI Skill document into any AI assistant (Claude, ChatGPT, etc.) and it can build complete pipelines for you instantly

Examples of pipelines you can build in minutes:

- Scan uploaded files for malware, then notify via Slack
- Create daily compressed backups and push to S3
- Resize images on upload and publish to a static site
- Watch a folder for changes and trigger multi-channel notifications

### SquidSites — One-Click Website Publishing

Turn any HTML file in your storage into a published website — instantly.

- **Upload to Publish** — Right-click any `.html` file and select Publish. Your site goes live in seconds
- **Public & Private Modes** — Choose between publicly accessible or authentication-gated
- **Smart Routing** — Root requests serve `index.html`, directory requests serve `{dir}/index.html`, explicit file paths resolve directly
- **Custom Badge** — Published pages include a subtle, closable "Made with SquidCloud" badge (with localStorage persistence)
- **Manage Published Sites** — Toggle visibility, unpublish, or re-publish from a dedicated management panel on desktop and mobile
- **Vercel Edge Delivery** — HTML is served through Vercel's global edge network with correct `Content-Type` headers — no rewriting

### Res54 Distributed Storage

The backbone of SquidCloud — a proprietary file distribution system built for unlimited scale and resilience.

- **Chunking** — Files are split into optimized 1.5–4 MB chunks based on file type
- **Client-Side Encryption** — Every chunk is encrypted with AES-256-GCM before leaving your device
- **Distributed Repositories** — Encrypted chunks are spread across multiple Res54 storage repositories
- **Parallel Transfers** — Uploads and downloads use parallel chunk streaming for maximum throughput
- **Resume Support** — Interrupted transfers pick up where they left off
- **Load Balancing** — Automatic distribution ensures no single repository becomes a bottleneck

### Cross-Platform Ecosystem

- **Web App** — Full-featured dashboard in any browser
- **PWA** — Installable native-like experience
- **Desktop (Electron)** — System tray, native file integration, offline support
- **Mobile (Capacitor)** — iOS and Android apps
- **CLI Tool** — Command-line access for automation

### Embedded Development Tools

- **cbCode IDE** — A fully-featured Monaco editor embedded in your workspace environment for scripting, data exploration, and automation
- **SquidLab SDK** — Build custom extensions with access to SquidCloud APIs
- **REST API** — Full programmatic access to files, folders, shares, and automation
- **Smart File Previews** — Built-in viewers for PDFs, images, videos, audio, code, spreadsheets, and 3D models

---

## What's New in v11

### SquidActions — The Automation Engine

The centerpiece of the v11 Feijoa release. Build, edit, and run automation pipelines without leaving the dashboard.

- **Visual Editor** — Drag components from a categorized palette onto an interactive canvas. Connect them with edges. Configure sub-options inline. All in real-time
- **YAML Editor** — For power users, a full Monaco YAML editor with syntax highlighting and auto-completion. Changes sync automatically when switching between visual and code views
- **Pipeline Dashboard** — A dedicated management interface showing all pipelines, their last run status, total runs, and quick-action buttons for trigger, edit, and delete
- **Component Registry** — 130+ typed components across 12 categories: triggers, file operations, data transformation, networking, security, AI/ML, media processing, notifications, control flow, utilities, external storage, and system
- **Variable Registry** — 200+ contextual variables extracted from actual platform data structures — file paths, user profiles, share links, analytics summaries, pipeline metadata, and more
- **Edge Function Backend** — Action-based Supabase Edge Function handles script CRUD, trigger management, run tracking, vault secrets, and template variable resolution

### SquidSites — Website Publishing

Transform any storage HTML file into a live website.

- One-click publish from the file context menu
- Public or authentication-gated visibility
- Smart URL routing with fallback to `index.html`
- Vercel Edge Network delivery
- Full management dashboard for all published sites

### Platform Improvements

- Res54 architecture integration for unlimited storage
- Enhanced BYOK with per-file multi-key encryption
- Passkey and biometric authentication (WebAuthn)
- PIN-based app protection
- cbCode IDE powered by Monaco Editor

---

## Platform Preview

<div align="center">
  <table>
    <tr>
      <td align="center"><strong>Pipeline Canvas</strong></td>
      <td align="center"><strong>Dashboard</strong></td>
    </tr>
    <tr>
      <td><img src="./cx/Screenshot%202026-04-03%20at%2010-48-58%20SquidCloud%20-%20Secure%20Unlimited%20Cloud%20Storage.png" alt="Pipeline Canvas Editor" width="100%"></td>
      <td><img src="./cx/Screenshot%202026-04-03%20at%2010-48-58%20SquidCloud%20-%20Secure%20Unlimited%20Cloud%20Storage.png" alt="SquidCloud Dashboard" width="100%"></td>
    </tr>
  </table>
</div>

---

## Security & Privacy

### Encryption Architecture

All encryption happens client-side in your browser before data leaves your device.

- **AES-256-GCM** — Industry-standard symmetric encryption with unique IV per file
- **Argon2id Key Derivation** — Memory-hard KDF with configurable time, memory, and parallelism parameters — protects against GPU and ASIC attacks
- **Per-File Keys** — Each file uses a unique encryption key, independent from others
- **Zero-Knowledge Architecture** — The server stores encrypted blobs and has no ability to read your data

### Bring Your Own Key (BYOK)

Two levels of key control:

| Level | Description |
|---|---|
| **Account-Level** | Define a master key using Argon2id. Key lives in RAM only — never persisted. Automatic timeout after inactivity |
| **Per-File** | Assign unique encryption keys to individual files. Perfect for compartmentalized sharing |

### Authentication Methods

| Method | Details |
|---|---|
| Email & Password | Standard auth with bcrypt hashing |
| OAuth SSO | Google, GitHub, Discord |
| Passkeys (WebAuthn) | Passwordless, phishing-resistant |
| TOTP MFA | Time-based one-time passwords |
| PIN Protection | Biometric-friendly app-level security |

### Data Protection

- **TLS 1.3** for all transport
- **Row-Level Security** on every database table
- **Session Management** with rolling expiration
- **SquidVault** — An additional encrypted vault layer for your most sensitive files, with separate password protection and auto-lock

---

## Getting Started

### Two Minutes to First Upload

| Step | Action |
|---|---|
| 1. Visit | [squidcloud.vercel.app](https://squidcloud.vercel.app) |
| 2. Sign Up | Create an account with email or OAuth |
| 3. Onboarding | Quick setup wizard introduces the dashboard |
| 4. Upload | Drag files anywhere on the page, or click the upload button |
| 5. Publish | Right-click any HTML file → Publish Website |
| 6. Automate | Head to SquidActions to build your first pipeline |

### Quick Navigation

- **`Ctrl/Cmd + K`** — Command palette
- **`Ctrl/Cmd + U`** — Upload files
- **`Ctrl/Cmd + F`** — Global search
- **`Space`** — Quick file preview
- **`Delete`** — Move to trash

---

## Support

| Channel | Where |
|---|---|
| Documentation | [squidcloud.inflate.live](https://squidcloud.inflate.live) |
| Issues | [GitHub Issues](https://github.com/NaveenSingh9999/cloudbliss-storage/issues) |
| Email | hello@inflate.live |

---

<div align="center">
  <p><strong>SquidCloud</strong> — Upload. Automate. Publish.</p>
  <sub>MIT License</sub>
</div>

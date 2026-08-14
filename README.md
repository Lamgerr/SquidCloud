<div align="center">
  <img src="./public/logo.svg" alt="SquidCloud" width="120" />
  <h1>SquidCloud</h1>
  <p><strong>Secure, Unlimited Cloud Storage Platform — <em>v12.0.18</em></strong></p>

  [![Version](https://img.shields.io/badge/version-12.0.18-blue.svg)](https://squidcloud.vercel.app)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?logo=typescript)](https://www.typescriptlang.org/)
  [![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
  [![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa)](https://squidcloud.vercel.app)
</div>

<br />

> **SquidCloud** is a next-generation, privacy-first cloud storage solution powered by the **Res54 Distributed Architecture**. Uncapped storage capacity, military-grade end-to-end encryption, and high-performance delivery — all seamlessly integrated into a modern web, desktop, and mobile ecosystem.

---

## Latest Version

| Component | Version | Status |
|---|---|---|
| Web Platform | 12.0.18 | ✅ Live |
| Android APK | 11.1.0 | ✅ Available |
| SquidLab SDK | 1.1.0 | ✅ Stable |

Current release: **v12.0.18** — [squidcloud.vercel.app](https://squidcloud.vercel.app)

---

## Table of Contents

- [What is SquidCloud?](#what-is-squidcloud)
- [Key Features](#key-features)
- [Storage Options](#storage-options)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Security](#security)
- [Getting Started](#getting-started)
- [Mobile & Desktop](#mobile--desktop)
- [Legal](#legal)

---

## What is SquidCloud?

SquidCloud is a next-generation cloud storage platform that combines the convenience of traditional cloud storage with advanced security features and unlimited capacity. Unlike conventional cloud providers, SquidCloud uses a unique distributed storage system called **Res54** that fragments, encrypts, and distributes your files across multiple secure repositories.

SquidCloud is free to use, independently operated, and built with a privacy-first philosophy. We do not sell your data, run ads, or train AI on your files.

---

## Key Features

### Smart Ingestion

**Remote URL Upload**
Fetch any file directly from a public shareable link. The server handles the download stream, bypassing browser CORS restrictions, with a unified real-time progress indicator. Paste a URL into the upload dialog and the file lands in your workspace — no intermediate downloads, no copy-paste.

### Instant Preview & Reading

**DeepRead Reader**
Open any document in an immersive, distraction-free reading mode. DeepRead renders text content with adjustable typography, clean layout, and zero chrome — designed for focused consumption of long documents, notes, and exported content.

### Developer Tooling

**API Keys & Usage Analytics**
Generate scoped API keys directly from the dashboard. Each key is bound to your account with granular permissions. Access a built-in analytics panel showing request volumes, latency distributions, and usage trends over the last 90 days — all without leaving the platform.

### Sharing & Publishing

**Publish as Website (SquidVeil)**
Turn any folder in your workspace into a live, publicly accessible static website with one click. SquidVeil handles HTTPS, caching, and CDN delivery. Ideal for documentation, landing pages, and personal sites — your content, your infrastructure, your domain.

### Encryption & Zero-Knowledge

**Bring Your Own Key (BYOK)**
Supply your own encryption key. All encryption and decryption happens client-side. SquidCloud is cryptographically incapable of reading your data in BYOK mode. Your key is never transmitted to or stored on our servers.

### AI & Productivity

**SquidAI Assistant**
An integrated AI assistant for workspace tasks — file search, content summarization, and smart suggestions. Accessible from anywhere in the dashboard without leaving your current context.

**Keyboard-First Navigation**
A comprehensive shortcut map and command palette (⌘K) for power users. Navigate, search, and perform actions at full speed without reaching for the mouse.

**Bookmarks & Favorites**
Pin important files with color tags and quick-access bookmarks. Build a personalized workspace view that surfaces what matters most.

---

## Storage Options

SquidCloud gives you full control over where your data lives.

### Native GitHub Storage (Default)
Your files are chunked, encrypted with AES-256-GCM, serialized as JSON blobs, and stored in GitHub repositories managed by SquidCloud. The stored blobs are opaque — no filename, file type, or content can be identified from them by any party, including GitHub and SquidCloud. Only your account with the correct decryption credentials can reassemble and decrypt the original files.

**Best for:** Zero-configuration setup with no external accounts required.

### Bring Your Own Storage (BYOS)
Connect your own external storage provider. SquidCloud acts as your interface — your files go directly to your infrastructure, not ours.

**Supported providers:**
- **Tebi.io** — S3-compatible object storage
- **Cloudflare R2** — zero egress fee object storage
- **Amazon S3** — industry-standard cloud object storage

**Best for:** Users who want full infrastructure ownership, compliance control, or are already paying for cloud storage.

### Bring Your Own Key (BYOK)
Supply your own encryption key for complete zero-knowledge encryption. Your key is never transmitted to or stored by SquidCloud.

> If you lose your BYOK encryption key, SquidCloud cannot recover your data. Keep a secure independent backup of your key at all times.

**Best for:** Users with strict security requirements, developers, and enterprise use cases.

---

## How It Works

```
Your File
    │
    ▼
Client-side chunking
    │
    ▼
AES-256-GCM Encryption (Res54 Engine)
    │
    ▼
Serialized as JSON blobs
    │
    ├──► Native: GitHub Repositories (opaque blobs)
    ├──► BYOS: Your S3 / R2 / Tebi bucket
    └──► BYOK: Encrypted with your own key before any of the above
```

Metadata (filename, size, type, timestamps) is stored separately in Supabase. File content and metadata are never stored together.

---

## Architecture

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| UI | Shadcn/ui + Tailwind CSS |
| Backend / Auth | Supabase |
| Native Storage | GitHub API (encrypted blobs) |
| External Storage | Tebi.io / Cloudflare R2 / Amazon S3 (BYOS) |
| Encryption | Res54 (AES-256-GCM, block-split, optional entropy) |
| Hosting | Vercel |
| Android | Capacitor + signed APK via GitHub Actions |
| SDK | SquidLab SDK v1.1.0 |

---

## Security

| Feature | Status |
|---|---|
| AES-256-GCM Encryption | ✅ Enabled |
| Client-side Encryption | ✅ Before upload |
| BYOK (Zero-knowledge) | ✅ Available |
| HTTPS Enforced | ✅ Global |
| Passkey / WebAuthn | ✅ Supported |
| PIN Authorization | ✅ On share and delete |
| OAuth PKCE Flow | ✅ Mobile hardened |
| No plaintext storage | ✅ Guaranteed |
| No AI training on files | ✅ Never |
| No data selling | ✅ Never |

We do not access, read, or analyze your file content under any circumstance. In BYOK mode, we are cryptographically incapable of doing so.

---

## Getting Started

### Web
Visit [squidcloud.vercel.app](https://squidcloud.vercel.app) and create a free account.

### Android
Download the latest signed APK from the releases section of this repository. Requires Android 7.0 or later.

### API
Generate an API key from your dashboard. Every key is scoped to your account and logged for security purposes.

Full API documentation is available in your dashboard after signing in.

### CLI
The SquidCloud CLI supports automation and scripting via your API key. See the CLI documentation in your dashboard for setup instructions.

---

## Mobile & Desktop

| Platform | Version | Status |
|---|---|---|
| Web (PWA) | 12.0.18 | ✅ Live |
| Android (APK) | 11.1.0 | ✅ Available |
| iOS | — | Planned |
| Desktop (Electron) | — | Planned |

The Android app is built with Capacitor and distributed as a signed APK. It supports full feature parity with the web platform including BYOS, BYOK, file upload with background worker, and OAuth sign-in.

---

## Legal

SquidCloud is an independent project operated by its founders. All services are free to use.

- [Privacy Policy](https://squidcloud.vercel.app/privacy)
- [Terms of Service](https://squidcloud.vercel.app/terms)

Governed by the laws of India. Compliant with the Digital Personal Data Protection Act, 2023 (DPDP Act).

For support or legal inquiries: **hellosquidcloud@gmail.com**

---

## SquidLab SDK

Build on top of SquidCloud with the SquidLab SDK (v1.1.0). The SDK provides programmatic access to storage, file management, and authentication flows.

See the SDK repository for full documentation and examples.

---

<div align="center">
  <p>Built and maintained with care by Lamgerr</p>
  <p>
    <a href="https://squidcloud.vercel.app">Platform</a> ·
    <a href="https://squidcloud.vercel.app/privacy">Privacy</a> ·
    <a href="https://squidcloud.vercel.app/terms">Terms</a> ·
    <a href="mailto:hellosquidcloud@gmail.com">Contact</a>
  </p>
  <p><i>SquidCloud v12.0.18</i></p>
</div>

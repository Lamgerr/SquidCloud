import { Lock, Cloud, ShieldAlert, Sparkles } from '@/lib/icon-map';
import type { DocArticle } from './types';

export const architectureArticles: DocArticle[] = [
  {
    id: 'res54-encryption',
    title: 'RES54 Encryption',
    description: 'Client-side AES-256-GCM chunked encryption and key derivation.',
    icon: Lock,
    category: 'architecture',
    tags: ['encryption', 'res54', 'aes-256-gcm', 'chunking'],
    updated: '2026-07-18',
    content: `# RES54 Encryption

RES54 is the client-side encryption pipeline. **Plaintext never leaves the
device.** All cryptographic work runs in the browser with the Web Crypto API,
parallelized across a pool of 4 Web Workers.

## Pipeline

1. A **per-file key** is derived (HKDF / \`generatePerFileKey\`).
2. The file is split into chunks (see sizing below).
3. Each chunk is encrypted with **AES-256-GCM** using a per-chunk key
   (\`encryptChunkV3\`), with a random IV and additional authenticated data.
4. Encrypted chunks are uploaded; their manifest (index, path, verification
   flag) is stored as file metadata.
5. On download, chunks are fetched and decrypted in the browser.

A V3 magic header (\`0x52 0x45 0x03\`) marks the new format. Older v1/v2
formats are still detected via \`detectEncryptionVersion\` for backward
compatibility.

## Chunk sizing (current)

| File size | Chunk size |
|-----------|------------|
| < 10 MB   | 2 MB |
| 10–500 MB | 8 MB |
| > 500 MB  | 4 MB |

> Older documentation quoting 1.5 MB / 2.5 MB chunks is **stale** — those
> thresholds no longer apply.

## Known limitation

The main-thread fallback derives its key with
\`key.slice(0, 32).padEnd(32, '0')\`, which **truncates** longer keys to 32
bytes. When possible, the Web Worker path (which uses the full derived key) is
preferred; this gap is tracked for a future fix.
`,
  },
  {
    id: 'storage-backends',
    title: 'Storage Backends',
    description: 'The default B2 backend and Bring-Your-Own-Storage (BYOS) providers.',
    icon: Cloud,
    category: 'architecture',
    tags: ['storage', 'backblaze', 'b2', 'tebi', 'r2', 'byos'],
    updated: '2026-07-18',
    content: `# Storage Backends

Encrypted chunks land in an object store. SquidCloud supports a server-managed
default backend plus opt-in Bring-Your-Own-Storage (BYOS) providers.

## Default backend — Backblaze B2

The active pipeline (\`res54.ts\`) records each chunk with \`repo: 'b2'\` and
downloads it from the B2 CDN. Storage is **server-managed and S3-compatible**:
you don't configure anything — SquidCloud owns the bucket and credentials.

> Despite historical "github" naming in the code and Edge Function names
> (\`github-storage\`, \`github-cluster\`), the current production backend is
> **Backblaze B2**, not GitHub repos.

## BYOS providers

You can bring your own S3-compatible storage. The \`storage_providers\` table
allows \`squidcloud\`, \`r2\`, \`tebi\`, \`s3\`, and \`gcp\`. Current status:

| Provider | Status |
|----------|--------|
| **Tebi.io** | ✅ Live & working — S3-compatible presigned uploads via \`api-file-upload-tebi\` |
| **Cloudflare R2** | ⚠️ Stubbed — \`get-r2-presigned-url\` is not deployed; not yet routable |
| **AWS S3** | 🧪 Modal + DB enum only; no routing yet |
| **Google Cloud Storage** | 🧪 Modal + DB enum only; no routing yet |
| **Wasabi** | ❌ Not referenced anywhere |

The \`ProviderSetupModal\` collects your endpoint, bucket, and keys; the
\`verify-provider\` function currently only computes endpoints for \`r2\` and
\`tebi\`. For Tebi, credentials are encrypted at rest.

## Per-workspace isolation

Storage is namespaced per workspace and per provider at the database level, so a
workspace can only read its own objects.
`,
  },
  {
    id: 'kza-security',
    title: 'KZA Security Layer',
    description: 'Sentinel, Phantom, Oracle, Verdict, and the PREL gateway.',
    icon: ShieldAlert,
    category: 'architecture',
    tags: ['kza', 'security', 'fraud', 'scoring', 'prel'],
    updated: '2026-07-18',
    content: `# KZA Security Layer

KZA is SquidCloud's behavioral security and risk-scoring system. It sits in front
of sensitive operations (secret verification, VeilRef resolve, etc.) and assigns
a risk tier before the action is allowed to proceed.

## Components

| Function | Role |
|----------|------|
| \`kza-sentinel\` | Front-line signal collection and initial scoring |
| \`kza-phantom\` | Honeypot — traps and fingerprints abusive traffic |
| \`kza-oracle\` | Enriches signals (e.g. geo via \`kza-locale\`) |
| \`kza-verdict\` | Produces the final allow / challenge / deny decision |
| \`kza-prel\` | Unified **PREL** gateway — \`/gateway\`, \`/validate\`, \`/refresh\`, \`/revoke\` |

The client talks to PREL through \`kza-prel-client\` (\`gateway\`, \`validate\`,
\`refresh\`, \`revoke\`).

## Risk tiers

KZA uses a four-tier scoring model:

- **YELLOW** — elevated but allowed
- **ORANGE** — challenge / extra verification
- **RED** — blocked pending review
- **BLACK** — hard deny / banned signal

This is what protects zero-knowledge operations like VeilRef verification from
brute-force and abuse.
`,
  },
  {
    id: 'accessibility',
    title: 'Accessibility',
    description: 'What is and isn\'t implemented: reduced motion, focus, keyboard nav, dark-only theme.',
    icon: Sparkles,
    category: 'architecture',
    tags: ['a11y', 'accessibility', 'keyboard', 'dark-mode', 'reduced-motion'],
    updated: '2026-07-18',
    content: `# Accessibility

SquidCloud follows standard web accessibility practices. There is **no separate
"accessibility mode"** toggle — the a11y behavior below is always on.

## Implemented

- **Reduced motion** — \`prefers-reduced-motion\` is honored in CSS so animations
  are suppressed for users who request it.
- **Screen-reader text** — \`sr-only\` utility classes label icon-only controls.
- **Focus visibility** — \`focus-visible\` rings are configured in the Tailwind
  theme so keyboard focus is always visible.
- **Keyboard navigation** — the [Command Palette](/help/docs/command-palette)
  is fully keyboard-operable.
- **ARIA roles** — dialogs and modals declare proper ARIA roles and focus
  management.

## Theme

The app is **dark-mode only**. \`ThemeContext\` locks the theme to \`dark\` and
its \`toggleTheme\` is a no-op; the \`ThemeToggle\` component is not rendered.
Similarly, the \`SquidsetThemeContext\` (\`default\` / \`squidset\` modes) and its
\`SquidsetThemeToggle\` are wired in \`App.tsx\` but the toggle is not mounted, so
they are effectively dead code. A light theme is **not** currently available.

## Known gaps

- No skip-to-content link on some long pages.
- Focus-visible consistency varies inside the Squidset surfaces.
`,
  },
];

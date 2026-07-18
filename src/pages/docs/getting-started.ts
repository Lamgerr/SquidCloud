import { Book, Boxes, KeyRound } from '@/lib/icon-map';
import type { DocArticle } from './types';

export const gettingStartedArticles: DocArticle[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Create an account, upload your first files, and share them securely.',
    icon: Book,
    category: 'getting-started',
    tags: ['beginner', 'setup', 'introduction'],
    updated: '2026-07-18',
    content: `# Getting Started with SquidCloud Storage

SquidCloud Storage is a secure, cross-platform cloud storage platform. Files are
encrypted **client-side** before they ever leave your device, and the default
backend stores encrypted chunks across a distributed object store. This guide gets
you from zero to your first secure upload.

## Create your account

1. Open the app or visit the web client and choose **Sign Up**.
2. Verify your email address from the confirmation message.
3. (Optional) Register a **passkey** in *Account Settings → Security* for
   passwordless, phishing-resistant login.

## Upload your first file

- Click **Upload** or drag a file anywhere onto the dashboard.
- Large files are split into encrypted chunks automatically — you don't need to
  do anything special.
- Progress, encryption stage, and verification status stream live in the upload
  panel.

## Organize with folders and workspaces

- Create **folders** to group related files.
- Switch **workspaces** (top bar) to keep separate projects or teams isolated.
  Each workspace gets its own storage namespace
  (\`userId/workspaceId/chunkId.bin\`).

## Share securely

Open any file and choose **Share**:

- **Public link** — anyone with the link can view/download.
- **Password protected** — the link requires a password you set.
- **Expiration** — the link stops working after a date you choose.

> Files shared through SquidCloud remain encrypted at rest. Recipients decrypt
> them in the browser using keys that never touch our servers in plaintext.

## Where to go next

- [File management](/help/docs/file-management)
- [Secure sharing](/help/docs/secure-sharing)
- [Security model](/help/docs/security-overview)
- [Developer API](/help/docs/api-overview)
`,
  },
  {
    id: 'platform-overview',
    title: 'Platform Overview',
    description: 'What SquidCloud is, what it is built on, and how the pieces fit together.',
    icon: Boxes,
    category: 'getting-started',
    tags: ['overview', 'architecture', 'concepts'],
    updated: '2026-07-18',
    content: `# Platform Overview

SquidCloud Storage is a React + TypeScript web app packaged for the web, desktop,
and mobile (via Capacitor). The backend is a set of Supabase Edge Functions
(written in Deno/TypeScript) together with a Postgres database.

## Core building blocks

| Layer | Technology |
|-------|------------|
| Client | React 18, TypeScript, Vite, Tailwind, shadcn/Radix |
| Native shell | Capacitor (Android/iOS) |
| Backend | Supabase Edge Functions (Deno) |
| Database | Supabase Postgres |
| Encryption | Web Crypto (AES-256-GCM), HKDF key derivation |
| Auth | Supabase Auth + passkeys (WebAuthn) |

## What runs where

- **Your device** encrypts and decrypts every file. Plaintext never leaves the
  client.
- **Edge Functions** handle key exchange, storage routing, and metadata — but
  they only ever see ciphertext and opaque key material.
- **Postgres** stores file metadata, workspace membership, and (when enabled)
  your zero-knowledge account key *hash*, never the key itself.

## Current release

The shipping build is **v12.0.17**. Release notes live at
[/help/docs/notes](/help/docs/notes).
`,
  },
  {
    id: 'accounts-security-basics',
    title: 'Accounts & Sign-in',
    description: 'Email sign-in, passkeys, and the BYOK zero-knowledge option.',
    icon: KeyRound,
    category: 'getting-started',
    tags: ['account', 'auth', 'passkey', 'byok'],
    updated: '2026-07-18',
    content: `# Accounts & Sign-in

## Email + password

The default sign-in method is email and password, verified through Supabase Auth.

## Passkeys (WebAuthn)

Enable a passkey in *Account Settings → Security* to sign in with a biometric or
hardware key. Passkeys are phishing-resistant: there is no password to steal and
the credential is bound to the origin.

## Bring Your Own Key (BYOK)

BYOK is an optional, **zero-knowledge** mode. You supply a master key that is
used to derive per-file and per-chunk keys. Depending on your policy, SquidCloud
can:

- prompt for the key on every decrypt,
- allow a fallback to the default key, or
- enforce strict mode (no fallback — lose the key and the data is unrecoverable).

In strict BYOK mode, SquidCloud cannot read your files even if compelled to. The
server only stores a hash of your account key for verification.
`,
  },
];

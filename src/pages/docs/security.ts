import { Shield, Lock, EyeOff, Calendar } from '@/lib/icon-map';
import type { DocArticle } from './types';

export const securityArticles: DocArticle[] = [
  {
    id: 'security-overview',
    title: 'Security Overview',
    description: 'Zero-knowledge design, client-side encryption, and BYOK.',
    icon: Shield,
    category: 'security',
    tags: ['security', 'zero-knowledge', 'encryption', 'byok'],
    updated: '2026-07-18',
    content: `# Security Overview

SquidCloud is built on a **zero-knowledge** principle: the server stores only
ciphertext and opaque key references. Plaintext and usable keys never leave your
device.

## What we can and cannot see

| Data | Visible to server? |
|------|---------------------|
| Encrypted file chunks | ✅ Yes (ciphertext only) |
| File metadata (name, size, path) | ✅ Yes |
| Plaintext file contents | ❌ No |
| Usable decryption keys | ❌ No |
| Secret values (SquidVeil) | ❌ No (hashed reference only) |

## Layers

- **RES54** — client-side AES-256-GCM chunked encryption
  ([details](/help/docs/res54-encryption)).
- **KZA** — behavioral risk scoring in front of sensitive operations
  ([details](/help/docs/kza-security)).
- **BYOK** — optional bring-your-own-key mode where even SquidCloud cannot
  decrypt your data ([details](/help/docs/byok)).
- **Passkeys** — phishing-resistant WebAuthn sign-in.

## Threat model

We assume the server (and anyone who compromises it) cannot decrypt user data
without the user's keys. The residual risks are client-side compromise (malware
on your device) and loss of a BYOK key (data becomes unrecoverable in strict
mode). See [RES54 & KZA deep dive](/help/docs/res54-kza) for internals.
`,
  },
  {
    id: 'res54-kza',
    title: 'RES54 & KZA Deep Dive',
    description: 'How encryption, chunk distribution, and risk scoring combine.',
    icon: Lock,
    category: 'security',
    tags: ['res54', 'kza', 'deep-dive', 'security'],
    updated: '2026-07-18',
    content: `# RES54 & KZA Deep Dive

A closer look at how SquidCloud keeps data confidential while still operating a
multi-tenant backend.

## Encryption at rest and in transit

Every file is split and encrypted client-side with AES-256-GCM. The V3 path
(\`encryption-v3.ts\`) derives a per-file key (HKDF) and a per-chunk key, then
encrypts each chunk with a random IV and additional authenticated data. Chunks are
uploaded with \`verified: true\` once the backend confirms receipt.

Three parallel pipelines exist in the client today:

- \`res54.ts\` — the **active** pipeline; routes chunks to the **B2** backend.
- \`res54-r2.ts\` / \`res54-r2-pipeline.ts\` — R2-oriented pipelines
  (~80% duplicated code; R2 presigning is not yet deployed).

## Distribution

Historically chunks were sharded across multiple storage accounts; in the current
B2-backed build each chunk is recorded with \`repo: 'b2'\` and an
\`accountId\` of 0, with the manifest tracking chunk index and path.

## KZA in the loop

Sensitive actions — secret verification, VeilRef resolve, key selection — pass
through the KZA layer. \`kza-sentinel\` collects signals, \`kza-phantom\`
traps abuse, \`kza-oracle\` enriches (geo, etc.), and \`kza-verdict\` returns a
tier (YELLOW / ORANGE / RED / BLACK). The unified \`kza-prel\` gateway exposes
\`/gateway\`, \`/validate\`, \`/refresh\`, and \`/revoke\`.

## Known weaknesses

- The main-thread encryption fallback truncates keys with
  \`key.slice(0, 32).padEnd(32, '0')\`.
- The R2 pipelines are duplicated and not yet wired to a live presign endpoint.

Both are tracked for remediation and do not affect the confidentiality of data
stored through the active B2 pipeline.
`,
  },
  {
    id: 'byok',
    title: 'Bring Your Own Key (BYOK)',
    description: 'Zero-knowledge key control and strict-mode tradeoffs.',
    icon: EyeOff,
    category: 'security',
    tags: ['byok', 'zero-knowledge', 'keys', 'strict-mode'],
    updated: '2026-07-18',
    content: `# Bring Your Own Key (BYOK)

BYOK lets **you** hold the master key. SquidCloud derives per-file and per-chunk
keys from it and never stores the usable key — only a hash for verification.

## Policies

The runtime policy (stored in \`user_encryption_settings\`) controls behavior:

- **enabled** — turn BYOK on/off.
- **strictMode** — when on, there is no fallback; losing your key means the data
  is unrecoverable (by design).
- **allowDefaultFallback** — when strict mode is off, fall back to the default
  key if yours is unavailable.
- **promptEveryDecrypt** — ask for the key on every decrypt.

## Ephemeral prompts

\`ephemeral-byok-prompt\` can request a key on demand (\`requestEphemeralBYOKKey\`,
\`requestKeySelection\`, \`requestMandatoryBYOKSetup\`) so you're prompted only
when a decrypt actually needs it.

## Tradeoff

BYOK maximizes confidentiality at the cost of recoverability. Choose strict mode
only if you have a safe, redundant backup of your key.
`,
  },
  {
    id: 'release-notes',
    title: 'Release Notes',
    description: 'Version history and how to read the changelog.',
    icon: Calendar,
    category: 'releases',
    tags: ['releases', 'changelog', 'versions'],
    updated: '2026-07-18',
    content: `# Release Notes

Full, dated release notes live at [/help/docs/notes](/help/docs/notes). Each entry
lists the version, date, type (major / minor / patch / security), and highlights.

## Current build

The shipping web build is **v12.0.17** (see \`package.json\`). The native
Android shell carries its own version (\`versionName "11.1.0"\`) because it ships
on a separate release cadence.

## Types

- **major** — breaking changes or big feature drops
- **minor** — backward-compatible features
- **patch** — bug fixes
- **security** — security-focused fixes that should be prioritized

## Staying current

The in-app \`VersionChecker\` compares your runtime version against the latest
published update and notifies you when a new build is available.
`,
  },
];

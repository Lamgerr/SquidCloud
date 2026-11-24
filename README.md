<div align="center">
  <img src="./public/logo.svg" alt="SquidCloud" width="110" />
  <h1>SquidCloud</h1>
  <p><strong>Privacy-first cloud storage. Your files, your keys, your infrastructure.</strong></p>

  [![Version](https://img.shields.io/badge/version-13.0.38-blue.svg)](https://github.com/Lamgerr/SquidCloud/releases)
  [![License](https://img.shields.io/badge/license-SCPL--1.0-green.svg)](./LICENSE)
  [![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
  [![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)
</div>

---

## What this is

SquidCloud is a self-hostable cloud storage platform with a web app, CLI, and
mobile/desktop targets. It stores files in encrypted chunks, supports large
files, secure sharing, a developer API, and an AI assistant that runs within
the user's own account.

The project is open source under the [SquidCloud Public License](./LICENSE):
you may run it, fork it, modify it, ship it commercially, and send upstream
patches freely. The only hard limit is that it may not be used for unlawful
activity (breaching, counterfeiting, malware, fraud, and similar harms).

**Read the security model before trusting it with real data:**
[docs/SECURITY-MODEL.md](./docs/SECURITY-MODEL.md) and [SECURITY.md](./SECURITY.md).

---

## Features

- **Res54 storage** — files split into encrypted chunks with resumable uploads
  and parallel downloads; legacy GitHub-repo chunks remain readable.
- **Zero-knowledge vault** — optional client-held key (BIP39 recovery phrase),
  AES-GCM with per-file salts; the server stores ciphertext only. See
  [docs/superpowers/specs/2026-11-24-full-e2e-redesign-design.md](./docs/superpowers/specs/2026-11-24-full-e2e-redesign-design.md).
- **Preview** — full-screen PDF, image, video, audio, text, EPUB, spreadsheet,
  archive and 3D viewers in one floating-dock interface.
- **Sharing** — share links with optional password, wrapped keys, and revoked access.
- **Developer API** — REST endpoints under `/api/v1/*` and an SDK in `sdk/`.
- **CLI & mobile** — `cli/` and Capacitor targets for Android/iOS.
- **Multiple storage backends** — SquidCloud clusters, S3-compatible providers,
  B2, and legacy GitHub repos.

---

## Quick start

```bash
git clone https://github.com/Lamgerr/SquidCloud.git
cd SquidCloud
npm install
cp .env.example .env.local     # fill with your own Supabase + provider values
npm run dev
```

To run against your own Supabase project:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
supabase functions deploy --all
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full local setup and
[docs/BACKEND-OPENSOURCE-PLAN.md](./docs/BACKEND-OPENSOURCE-PLAN.md) for the
backend hardening requirements you should apply to your own instance.

Requirements: Node 18+, npm, and optionally the Supabase CLI and Docker for
local database work.

---

## Repository layout

| Path | Purpose |
|---|---|
| `src/` | React 18 + TypeScript + Vite web application |
| `supabase/migrations/` | Database baseline and hardening migrations |
| `supabase/functions/` | 88 Deno edge functions |
| `api/` | Vercel serverless functions (proxy, cron, media serving) |
| `cli/` | Command-line client |
| `sdk/` | JavaScript/TypeScript SDK |
| `android/`, `ios/` | Capacitor mobile projects |
| `docs/` | Architecture, security audits, specs, and runbooks |
| `scripts/` | Developer and CI scripts |

---

## Security

- Never commit secrets. `.env.example` contains placeholders only.
- Supabase anon/publishable keys are public by design; service-role keys,
  database passwords, and webhook secrets are not.
- Report vulnerabilities privately — see [SECURITY.md](./SECURITY.md).
- Automated invariant checks: `.github/workflows/security-audit.yml` and
  `scripts/security-audit.sql`.

---

## Contributing

Pull requests are welcome: features, bug fixes, rewrites, and architecture
improvements. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening
one. Sensitive paths (crypto, migrations, auth) require extra review.

This project follows the
[SquidCloud Public License](./LICENSE): broad freedom to build, strict
prohibition on using the software for illegal activity.

---

## Documentation

- [UI/UX standard](./docs/UI-UX-STANDARD.md)
- [Backend open-source plan](./docs/BACKEND-OPENSOURCE-PLAN.md)
- [Live Supabase snapshot](./docs/LIVE-SUPABASE-SNAPSHOT.md)
- [Security audit](./docs/audits/security-audit.md)
- [E2E design](./docs/superpowers/specs/2026-11-24-full-e2e-redesign-design.md)
- [Open-source runbook](./docs/OPEN-SOURCE-RUNBOOK.md)

---

## License

[SquidCloud Public License v1.0](./LICENSE) — permissive for lawful use,
including commercial use and modification. Prohibits unlawful activity.
This is not legal advice; have counsel review the license before relying on it.

Version 13.0.38 · Built by the SquidCloud contributors.

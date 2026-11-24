# Contributing to SquidCloud

Thanks for your interest in contributing. This guide is the starting point for running, changing, and reviewing SquidCloud safely.

## Project at a Glance

- **Web app:** React 18 + TypeScript + Vite (`src/`), Tailwind + shadcn/ui patterns.
- **Backend:** Supabase (Postgres/Auth/Storage/Realtime/Edge Functions) in `supabase/`.
- **CLI:** `cli/` (TypeScript). **Mobile:** Capacitor (`android/`, `ios/` configs/templates). **Desktop/Electron:** optional targets present in repo.
- **Package manager/scripts:** npm (`package.json`). Node 18+ recommended.

## Getting Started

```bash
git clone <repo-url>
cd SquidCloud
npm install
cp .env.example .env.local   # fill with your own project values; never commit
npm run dev
```

Required env vars are documented in `.env.example` (Supabase URL/anon key, app URL, etc.). Do **not** use production secrets locally.

## Supabase (Local & Schema)

- Supabase project config: `supabase/config.toml` (linked project ref may be present; use your own project for development).
- **Migrations:** `supabase/migrations/20261110000000_prod_baseline.sql` is a production-derived schema baseline (2026-11-10). Historical migrations are archived in `supabase/migrations_archive/pre-2026-11-10/`.
- **Edge Functions:** `supabase/functions/*`. Shared helpers in `supabase/functions/_shared/`.
- Local stack (requires Docker): `supabase start`, `supabase db reset`, `supabase functions serve`. If Docker/DB password is unavailable, validate schema changes against a dev Supabase project.

## Development Workflow

1. Create a focused branch from the default branch.
2. Keep changes scoped; match existing patterns and naming.
3. Run relevant checks before opening a PR:
   - `npm run lint`
   - `npm run build` (or `npm run build:dev`; note: some environments lack native SWC bindings — CI/Vercel is the source of truth)
   - `npx tsc --noEmit` for type checks when applicable
4. Do not commit build artifacts, `.env*` (except `.env.example`), HAR/log captures, or credentials.
5. Open a PR with: problem, approach, testing performed, screenshots for UI changes, and any migration/security implications.

## Codebase Organization (Target)

- `src/pages` — route-level screens; `src/components` — UI and feature components; `src/lib`/`src/services`/`src/hooks` — shared logic.
- `docs/` — canonical documentation (architecture, guides, API, operations, audits). Legacy reports are being consolidated under `docs/archive/`.
- Prefer deleting or archiving dead code over leaving "just in case" copies; see `docs/audits/dead-code-audit.md`.

## Security & Privacy

- Treat this as a security-sensitive, encryption-focused product. Read `SECURITY.md` and `docs/audits/security-audit.md`.
- Never weaken RLS, auth checks, webhook verification, or key-handling to "make it work".
- Avoid introducing `dangerouslySetInnerHTML`, permissive CORS, or unauthenticated privileged endpoints.

## Documentation

- Update relevant docs when behavior, APIs, or operations change.
- Put durable knowledge in `docs/` (not root-level one-off markdown files). Archive historical status reports instead of expanding them.

## License

By contributing, you agree that your contributions will be licensed under the repository's license (see `LICENSE`, if present). Confirm licensing with maintainers before large external contributions.

import {
  FolderOpen,
  FileText,
  Book,
  Share2,
  ChartBar,
  Package,
  Users,
  Database,
  Globe,
  KeyRound,
  Shield,
  Settings,
  ShieldAlert,
  LineChart,
  Sparkles,
  Workflow,
  FileCode,
  Activity,
  Boxes,
  Terminal,
  GitBranch,
  Zap,
  Lock,
  Calendar,
} from '@/lib/icon-map';
import type { DocArticle } from './types';

export const featureArticles: DocArticle[] = [
  // ── Core file & sharing ──────────────────────────────────────────────
  {
    id: 'ui-dashboard',
    title: 'Dashboard (File Manager)',
    description: 'The main authenticated browser: upload, organize, share, and manage files.',
    icon: FolderOpen,
    category: 'features',
    tags: ['dashboard', 'files', 'upload', 'workspaces', 'ui'],
    updated: '2026-07-18',
    content: `# Dashboard — File Manager

Route: \`/dashboard\`. The central authenticated workspace.

## What you can do

- **Browse & navigate** files and folders with a breadcrumb path bar, drill into
  subfolders, and go back up.
- **Upload** by drag-and-drop, the upload button, or mobile quick-upload. Uploads
  run through a background service and are encrypted client-side (RES54).
- **Create folders**, **download** single or bulk-selected files (including RES54
  decryption), and **delete** to trash (with biometric/PIN confirmation).
- **Share** a file or folder (opens the share dialog) and **move** files between
  folders.
- **Preview** files inline, including keyboard arrow navigation between siblings.
- **Search** (debounced), **filter** (all / shared / files), and **sort** by
  name / date / size.
- **Select & bulk-act** via a selection mode and toolbar, with keyboard
  shortcuts (⌘K spotlight, \`u\` upload, \`n\` new folder, \`s\` share,
  \`d\` download, Delete).
- **Per-file notes & embeds**, **open in code view**, **switch storage provider**
  (SquidCloud / Tebi.io / R2 coming soon), and **manage workspaces**
  (switch, create, collaborators, settings).
- **Command palette** (⌘K) for keyboard-first navigation.

## Tabs

Files · Shared · Trash · File Requests (premium) · Analytics · Secrets
(SquidVeil) · Storage · Scripts · Settings.
`,
  },
  {
    id: 'ui-file-preview',
    title: 'File Preview',
    description: 'Inline preview of images, video, audio, PDF, and more.',
    icon: FileText,
    category: 'features',
    tags: ['preview', 'files', 'ui'],
    updated: '2026-07-18',
    content: `# File Preview

Open any file from the Dashboard to preview it inline in the
\`EnhancedInstantPreviewModal\`. Previewable types (images, video, audio, PDF,
text/code) render directly; others show a file card with download and properties.
Preview supports keyboard arrow navigation between sibling files in the current
folder.

Decryption for encrypted (RES54 / BYOK) files happens in the browser before
the preview is rendered.
`,
  },
  {
    id: 'ui-notes',
    title: 'Notes',
    description: 'Hybrid drawing/text note editor and per-file note panels.',
    icon: Book,
    category: 'features',
    tags: ['notes', 'ui'],
    updated: '2026-07-18',
    content: `# Notes

Route: \`/notes\` renders the hybrid drawing + text note editor
(\`HybridNoteEditor\`). In addition, every file and folder in the Dashboard has a
per-entity **Notes panel** (\`NotesPanel\`) where you can jot notes tied to that
specific item; a note-count badge appears on the file.

Notes live alongside your files but are not encrypted the same way file chunks are —
treat them as workspace-scoped annotations.
`,
  },
  {
    id: 'ui-share-links',
    title: 'Share Links & Public View',
    description: 'Create protected share links; recipients open them via the SharePage.',
    icon: Share2,
    category: 'features',
    tags: ['sharing', 'share', 'public', 'ui'],
    updated: '2026-07-18',
    content: `# Share Links & Public View

## Creating a link

From any file or folder in the Dashboard, use **Share** to open the enhanced
share dialog. You can create a public link, a password-protected link, or set an
expiration. For folders, the link resolves to a folder view listing each contained
file with per-file download.

## Opening a shared link

Route: \`/s/:shareId\` (legacy \`/share/:shareId\` and \`/file/:id\` redirect
here). Recipients may need to pass **access guards**: a password, required email
collection, or region/device locks. Files download with client-side RES54
decryption, and burn-after-reading / download-limit rules are enforced. If the file
is BYOK-protected, the recipient enters the key in a bottom sheet.

Encrypted badges, expiry dates, and self-destruct notices are shown on the page.
`,
  },
  {
    id: 'ui-manage-shares',
    title: 'Share Manager & Analytics',
    description: 'Track, revoke, and analyze every share link and file request.',
    icon: ChartBar,
    category: 'features',
    tags: ['sharing', 'analytics', 'ui'],
    updated: '2026-07-18',
    content: `# Share Manager & Analytics

Route: \`/manage/shares\`. A full-screen manager (renders
\`MobileShareManagerContent\`) with two tabs: **Shared Links** and **File
Requests**.

- Search and filter shares by All / Active / Expired.
- Copy a link, open it in a new tab, or **revoke** it.
- Expand a share to view **analytics**: views, downloads, events, geo, and an
  activity timeline.
- Toggle active/paused and delete file requests.
- A realtime subscription on \`share_decrypt_logs\` pulses a surveillance alert when a
  protected share is accessed.
`,
  },
  {
    id: 'ui-file-requests',
    title: 'File Requests (SquidForms)',
    description: 'Public upload forms others use to send files to you.',
    icon: Package,
    category: 'features',
    tags: ['file-requests', 'forms', 'squidforms', 'ui'],
    updated: '2026-07-18',
    content: `# File Requests (SquidForms)

Route: \`/r/:slug\`. A public upload form (may require sign-in per request).

## As the owner

Create a file request from the Dashboard (premium). Set constraints: max files,
max size per file, allowed types, and expiry. Manage requests in
[/manage/shares](/help/docs/ui-manage-shares) and via the CLI
(\`squidcloudctl filereq ...\`).

## As a submitter

Open the public link, optionally enter your name/email, pick files, and submit.
Client-side validation enforces the constraints and shows upload progress. Submissions
are recorded and visible to the owner.
`,
  },
  {
    id: 'ui-workspaces-collab',
    title: 'Workspaces & Collaboration',
    description: 'Isolated spaces and per-folder collaborator management.',
    icon: Users,
    category: 'features',
    tags: ['workspaces', 'collaboration', 'sharing', 'ui'],
    updated: '2026-07-18',
    content: `# Workspaces & Collaboration

## Workspaces

Workspaces isolate projects or teams. Switch, create, and configure them from the
Dashboard. Each workspace gets its own storage namespace
(\`userId/workspaceId/chunkId.bin\`) and can be scoped to a storage provider.

## Collaboration

Invite collaborators to a folder from the **Collaborators** dialog
(\`WorkspaceCollaboratorsModal\`): invite by email, list members, assign roles,
remove members, and view invitations. Accepting an invite happens on
\`/workspace/invite/:token\` (or \`/workspace/invite\`), which calls
\`accept_workspace_invite\` and sets the active workspace.

The CLI mirrors this with \`squidcloudctl collab invite|list|remove|activity|leave|transfer\`.
`,
  },
  {
    id: 'ui-storage-page',
    title: 'Storage Page & Providers',
    description: 'The storage-management surface and BYOS provider selection.',
    icon: Database,
    category: 'features',
    tags: ['storage', 'byos', 'providers', 'ui'],
    updated: '2026-07-18',
    content: `# Storage Page & Providers

Route: \`/storage\` renders a file-repository browser (\`StorageTab\` with
\`EnhancedFileManager\` / \`FileManager\`). Unauthenticated visitors are redirected
to \`/auth\`.

## Bring-Your-Own-Storage (BYOS)

Provider selection happens during **onboarding** and from the Dashboard provider
switcher. Currently only **SquidCloud** (the managed Backblaze B2 backend) is
enabled; **AWS S3 / GCP / Oracle** show "Coming soon". See
[Storage backends](/help/docs/storage-backends) for the live status of each provider
(Tebi.io works; R2 is stubbed).
`,
  },
  {
    id: 'ui-embeds',
    title: 'SquidEmbed',
    description: 'Frameless, themed embeds of files and folders.',
    icon: Globe,
    category: 'features',
    tags: ['embed', 'share', 'ui'],
    updated: '2026-07-18',
    content: `# SquidEmbed

Route: \`/embed/:token\`. A frameless, themed viewer for embedding a file or
folder into another site via an iframe.

- Theme (\`?theme=dark|light\`), layout (\`?layout=grid|list|gallery\`), and
  border radius are controlled by URL params or the stored embed config.
- Files render inline by type: image, video (with controls), audio player, PDF
  (iframe), or a generic card with a download link to \`/api/serve-file/{id}\`.
- Folder embeds list contained files in grid / list / gallery layouts.
- Optional "Powered by SquidCloud" branding.

Embeds are created from the file/folder context menu (via \`SquidEmbedModal\` on the
Dashboard).
`,
  },

  // ── Account, settings, security ───────────────────────────────────────
  {
    id: 'ui-auth',
    title: 'Sign In & Sign Up',
    description: 'Email/password, passkeys, OAuth, and password recovery.',
    icon: KeyRound,
    category: 'features',
    tags: ['auth', 'login', 'passkey', 'oauth', 'ui'],
    updated: '2026-07-18',
    content: `# Sign In & Sign Up

Route: \`/auth\`.

- **Email + password** sign in / sign up, with a live password-strength meter.
- **Forgot password?** triggers a reset email; a recovery deep link sets a new
  password.
- **Passkey / biometric login** (WebAuthn) when the device supports it.
- **OAuth** continue-with GitHub, Google, or Discord.
- Password visibility toggle and Terms/Privacy links.

All sign-in attempts are audited with the client IP (\`securityService.trackLogin\`).
`,
  },
  {
    id: 'ui-profile',
    title: 'Profile',
    description: 'Read-only view of your account email and user ID.',
    icon: Users,
    category: 'features',
    tags: ['profile', 'account', 'ui'],
    updated: '2026-07-18',
    content: `# Profile

Route: \`/profile\`. A read-only page showing your account **email** and
**user ID**. There are no editable controls here — account edits live in
[Account Settings](/help/docs/ui-account-settings).
`,
  },
  {
    id: 'ui-settings-security',
    title: 'Settings: BYOK & Passkeys',
    description: 'Security score, BYOK encryption, and passkey management.',
    icon: Shield,
    category: 'features',
    tags: ['settings', 'byok', 'passkey', 'security', 'ui'],
    updated: '2026-07-18',
    content: `# Settings — BYOK & Passkeys

Route: \`/settings\`. A control center showing a live **Security Score** (BYOK +
passkey weighted) and status badges.

- **BYOK encryption** via the embedded \`BYOKSettingsCard\` — set up, unlock,
  lock, rotate, or disable your key, and tune the decryption policy (strict mode,
  allow default fallback, prompt every decrypt).
- **Passkeys / biometric** — register, test, update, or remove a WebAuthn
  credential (stored in \`user_passkeys\`).
- A link routes to the fuller [Account Settings](/help/docs/ui-account-settings).

> The user-facing encryption control is BYOK via \`useBYOK\`. This is separate from
> the Security Center's encryption tab (see below).
`,
  },
  {
    id: 'ui-account-settings',
    title: 'Account Settings Hub',
    description: 'Profile, security, API keys, webhooks, plans, migration, advanced.',
    icon: Settings,
    category: 'features',
    tags: ['account', 'settings', 'api-keys', 'webhooks', 'subscription', 'ui'],
    updated: '2026-07-18',
    content: `# Account Settings Hub

Route: \`/settings/account\`. A full account hub with a left category nav:

- **Profile** — edit display/full name (email is read-only).
- **Security** — register/test/update/remove a passkey, enable/disable device
  biometric, and change password (verify current first).
- **Developer API** — manage API keys (\`ApiKeyManagement\`) and a link to
  [/developer-api](/help/docs/ui-developer-api).
- **Webhooks** — manage webhooks (\`WebhookManager\`) and a link to
  [/webhooks](/help/docs/ui-webhooks).
- **Plans & Subscription** — view plan, storage/files stats, payment history,
  redeem a premium code, and cancel.
- **Migration** — track ZIP / cloud migration jobs (start, cancel, view).
- **Encryption** — configure BYOK.
- **Advanced** — ~20 preference toggles (security hardening, operation guards,
  data-saver, sync diagnostics, arcade) plus notification prefs, and **Sign Out**.
`,
  },
  {
    id: 'ui-security-center',
    title: 'Security Center',
    description: 'Security dashboard: threats, encryption policies, access control.',
    icon: ShieldAlert,
    category: 'features',
    tags: ['security', 'threats', 'access-control', 'compliance', 'ui'],
    updated: '2026-07-18',
    content: `# Security Center

Route: \`/security\`. A monitoring dashboard with tabs:

- **Overview** — security score, active threats, failed-logins, access-policy
  counts, recent security events and threat alerts. Refresh or **export a JSON
  security report**.
- **Threat Detection** — critical/high/resolved counts and all alerts.
- **Encryption** — algorithm (AES-256 / ChaCha20 / RSA-4096), key-rotation days,
  client-side encryption, zero-knowledge mode, HSM, and custom key provider
  (BYOK) switches.
- **Access Control** — create / enable-disable / delete policies, including a
  "Require MFA" rule.
- **Audit & Compliance** — GDPR / HIPAA / SOX readiness and 30-day metrics.

> Data here comes from the \`securityService\` aggregator and represents the
> policy/monitoring layer. The actual user-facing cipher is BYOK (see
> [Settings](/help/docs/ui-settings-security)).
`,
  },
  {
    id: 'ui-analytics',
    title: 'Analytics',
    description: 'Read-only usage dashboards: storage, activity, performance.',
    icon: LineChart,
    category: 'features',
    tags: ['analytics', 'usage', 'metrics', 'ui'],
    updated: '2026-07-18',
    content: `# Analytics

Route: \`/analytics\`. Read-only usage dashboards across four tabs (refreshable):

- **Overview** — metric cards, activity-over-time, storage distribution.
- **Storage** — total/used/available, file-type pie, storage-by-type bar. An
  unlimited plan shows "Unlimited · Res54".
- **Activity** — uploads/downloads/shares/views, access-pattern bars, popular
  files.
- **Performance** — upload/download speed, uptime, error rate, bandwidth usage,
  system health.

No write actions; purely observational. Also reachable from the Dashboard
"Analytics" tab.
`,
  },
  {
    id: 'ui-onboarding',
    title: 'First-Run Onboarding',
    description: '3-step setup: profile, workspace + provider, security.',
    icon: Sparkles,
    category: 'features',
    tags: ['onboarding', 'setup', 'workspace', 'byok', 'ui'],
    updated: '2026-07-18',
    content: `# First-Run Onboarding

Route: \`/onboarding\`. A 3-step (plus summary) setup wizard shown on first run:

1. **Profile** — set username and upload a profile photo.
2. **Workspace** — name a workspace and pick a storage provider. Only
   **SquidCloud** is enabled; AWS S3 / GCP / Oracle show "Coming soon".
3. **Security** — optionally set up a passkey/biometric and a BYOK encryption key
   (min 8 chars, "cannot be recovered" warning).

On finish it uploads the avatar, calls \`complete_onboarding\`, and routes to the
Dashboard. If onboarding is already complete, it skips straight through.
`,
  },

  // ── Developer & automation ────────────────────────────────────────────
  {
    id: 'ui-squidscripts',
    title: 'SquidScripts (Automation)',
    description: 'Build, run, and manage automation pipelines.',
    icon: Workflow,
    category: 'features',
    tags: ['automation', 'scripts', 'pipelines', 'ui'],
    updated: '2026-07-18',
    content: `# SquidScripts (Automation)

Route: \`/scripts\`. View all your automation pipelines ("SquidActions"), see per-
pipeline status (running / success / failed / idle) and run counts, and create,
run, edit, or delete pipelines. Clicking a pipeline opens its run history.

Pipelines are composed from the component registry (HTTP, GitHub Actions,
variables, and more). See [Extensions & Automation](/help/docs/extensions) for the
component model. The CLI mirrors this with \`squidcloudctl scripts ...\`.
`,
  },
  {
    id: 'ui-script-editor',
    title: 'Pipeline Editor',
    description: 'Visual node canvas and YAML with live two-way sync.',
    icon: FileCode,
    category: 'features',
    tags: ['scripts', 'editor', 'yaml', 'ui'],
    updated: '2026-07-18',
    content: `# Pipeline Editor

Routes: \`/scripts/new\` and \`/scripts/:id/edit\`. Build a pipeline either
visually (drag-and-drop node canvas) or by writing YAML, with **live two-way
sync** between the two. Set name/description, copy YAML, download as
\`.squid.yaml\`, toggle a tips sidebar, go fullscreen, load a starter template
from the gallery, and save (Ctrl+S).
`,
  },
  {
    id: 'ui-run-history',
    title: 'Pipeline Run History',
    description: 'Inspect logs and per-step status for each pipeline run.',
    icon: Activity,
    category: 'features',
    tags: ['scripts', 'runs', 'logs', 'ui'],
    updated: '2026-07-18',
    content: `# Pipeline Run History

Route: \`/scripts/:id/runs\`. View the run history of a specific pipeline, select
any run to inspect its live logs and per-job/per-step status, manually trigger a new
run, download logs as \`.txt\`, and toggle auto-refresh. Runs auto-poll (list every
3s, selected run every 2s while running).
`,
  },
  {
    id: 'ui-extension-lab',
    title: 'Extension Lab',
    description: 'Browse, search, and install approved extensions.',
    icon: Boxes,
    category: 'features',
    tags: ['extensions', 'marketplace', 'ui'],
    updated: '2026-07-18',
    content: `# Extension Lab

Route: \`/extensions\`. A marketplace of approved/active extensions. Search by
name/description, filter by category tabs, view details (author, version,
downloads, rating, verified badge), and install or uninstall for your account.
Installs write to the \`installed_extensions\` table.
`,
  },
  {
    id: 'ui-developer-api',
    title: 'Developer API Console',
    description: 'Manage keys, test endpoints, and view usage and logs.',
    icon: Terminal,
    category: 'features',
    tags: ['developer', 'api', 'keys', 'playground', 'ui'],
    updated: '2026-07-18',
    content: `# Developer API Console

Route: \`/developer-api\`. Tabs:

- **Overview** — endpoint count, uptime, latency, base URL, and a curl
  quick-start.
- **API Keys** — manage keys via \`ApiKeyManagement\`.
- **Playground** — pick a method/endpoint, enter your API key (and optional
  encryption key), send the request, and view the formatted JSON response.
- **Status** — per-endpoint health/latency, usage charts, and request logs.
- **Docs** — authentication, full endpoint reference (copy cURL / "Try in
  Playground"), and HTTP status-code reference.

Endpoints are live-checked (HEAD) on load and every 60s. Base URL points at the
\`cloudbliss-api\` function. See [API Overview](/help/docs/api-overview).
`,
  },
  {
    id: 'ui-webhooks',
    title: 'Webhooks',
    description: 'Create webhooks, read docs, and inspect delivery logs.',
    icon: GitBranch,
    category: 'features',
    tags: ['webhooks', 'integrations', 'ui'],
    updated: '2026-07-18',
    content: `# Webhooks

Route: \`/webhooks\`. Tabs:

- **Overview** — usage chart and feature cards (Quick Start, Signed Payloads,
  Automatic Retries).
- **Webhooks** — create/manage webhooks via \`WebhookManager\`.
- **Docs** — how webhooks work, setup guides, signature-verification snippet,
  and templates for Slack / Discord / GitHub / Custom.
- **Event Logs** — delivery logs.
- **Events Reference** — grouped event list (File, Website, Share, Pipeline, API)
  with payloads.

Payloads are signed so you can verify authenticity. All code blocks are copy-to-
clipboard.
`,
  },
  {
    id: 'ui-api-status',
    title: 'API Status',
    description: 'Public system-health and per-service status page.',
    icon: Zap,
    category: 'features',
    tags: ['status', 'uptime', 'health', 'ui'],
    updated: '2026-07-18',
    content: `# API Status

Route: \`/cc/api/status\` (public). Shows overall system health, per-service
uptime/response-time (upload, download, delete, info, auth, storage APIs), system
metrics (average response time, active incidents, scheduled maintenance), and a
manual refresh (auto-refreshes every 30s).
`,
  },
  {
    id: 'ui-admin-console',
    title: 'Admin Console',
    description: 'The enterprise control plane is hosted on a separate admin platform.',
    icon: Lock,
    category: 'features',
    tags: ['admin', 'enterprise', 'ui'],
    updated: '2026-08-06',
    content: `# Admin Console

Admin operations have moved to a dedicated, hardened admin platform
(separate deployment) with multi-step auth and KZA security layers.

This consumer platform no longer ships any admin routes or admin UI.
`,
  },

  // ── Product surfaces ───────────────────────────────────────────────────
  {
    id: 'ui-squidsites',
    title: 'SquidSites (Publish as Website)',
    description: 'Turn a file or folder into a hosted static site.',
    icon: Globe,
    category: 'features',
    tags: ['sites', 'deploy', 'static', 'ui'],
    updated: '2026-07-18',
    content: `# SquidSites (Publish as Website)

There is **no dedicated route** — SquidSites is a contextual dialog launched from
a file/folder's context menu ("Publish as Website" / "Manage Published Site").

- Set a site name and choose **public or private**.
- Publish, re-publish, toggle visibility, and unpublish.
- Manage all published sites from the published-sites manager.

Backed by the \`sites-api\` (publish/manage) and \`serve-site\` (serve) edge
functions. The CLI mirrors this with \`squidcloudctl deploy\` and \`squidcloudctl sites ...\`.
`,
  },
  {
    id: 'ui-squidtime-sign',
    title: 'SquidTime & SquidSign',
    description: 'Time-locking and digital signatures — currently CLI-only.',
    icon: ShieldAlert,
    category: 'features',
    tags: ['squidtime', 'squidsign', 'cli', 'ui'],
    updated: '2026-07-18',
    content: `# SquidTime & SquidSign

Two product features exist in the platform but **do not have a dedicated web UI** —
they are driven through the CLI (\`squidcloudctl\`):

- **SquidTime** — time-lock a file or folder so it cannot be opened until a
  release time, plus cryptographic existence proofs. Commands: \`squidcloudctl time
  lock|unlock|status|list|proof\`.
- **SquidSign** — request, track, verify, and download digitally signed
  documents. Commands: \`squidcloudctl sign request|status|list|cancel|verify|download\`.

Both route through the generic \`cli-operations\` edge-function dispatcher. Watch
the UI for these to gain in-app surfaces in a future release.
`,
  },
  {
    id: 'ui-pricing-checkout',
    title: 'Plans, Pricing & Checkout',
    description: 'Compare plans and purchase a subscription via crypto (MaxelPay).',
    icon: Package,
    category: 'features',
    tags: ['pricing', 'plans', 'checkout', 'subscription', 'ui'],
    updated: '2026-07-18',
    content: `# Plans, Pricing & Checkout

## Pricing

Route: \`/pricing\` (public). Compare **Free / Supporter / Supporter+**, switch
billing cadence (Weekly / Monthly / Annual with a "4 months free" badge), expand
FAQ accordions, and select a plan. Free routes to sign-up; paid plans route to
checkout pre-filled from the chosen billing.

## Checkout

Route: \`/checkout\` (redirects unauthenticated users to \`/auth\`). Review the
plan summary and features, apply a discount code (validated / optionally redeemed
free), toggle Test Mode (admins), and pay via **MaxelPay** crypto checkout. On
return with a \`sessionId\`, the plan is activated through the
\`subscription-manager/activate\` edge function and your profile refreshes.
`,
  },
  {
    id: 'ui-landing',
    title: 'Landing Page',
    description: 'Public marketing page with product highlights and nav.',
    icon: Boxes,
    category: 'features',
    tags: ['landing', 'marketing', 'home', 'ui'],
    updated: '2026-07-18',
    content: `# Landing Page

Route: \`/\` (public). The marketing/home page. It is informational only — the
only actions are navigation: Sign in / Sign up (→ \`/auth\`), Dashboard (→
\`/dashboard\` when signed in), and nav links to Extensions, Pricing, Docs, and
the CLI. Feature sections highlight unlimited storage, the developer API,
encryption, and the RES54 architecture.
`,
  },
];

import { FolderOpen, Share2, Command, Smartphone, Boxes, Users } from '@/lib/icon-map';
import type { DocArticle } from './types';

export const guideArticles: DocArticle[] = [
  {
    id: 'file-management',
    title: 'File Management',
    description: 'Uploads, folders, versioning, trash, and bulk operations.',
    icon: FolderOpen,
    category: 'guides',
    tags: ['files', 'folders', 'versions', 'trash'],
    updated: '2026-07-18',
    content: `# File Management

## Uploading

Drag files onto the dashboard or use the **Upload** button. Files are:

1. Split into chunks (see [RES54 encryption](/help/docs/res54-encryption)).
2. Encrypted in the browser with a Web Worker pool (4 workers by default).
3. Uploaded to the active storage backend.
4. Verified after upload (\`verified: true\` in chunk metadata).

## Folders

Folders are logical containers stored as metadata. Create them from the dashboard
and nest as needed. Moving a file between folders only updates metadata — chunk
data is not re-uploaded.

## Versioning

Edited files keep prior versions. Open a file and choose **History** to preview,
download, or roll back to an earlier version.

## Trash

Deleted files move to trash and can be restored until permanently purged.
Trash operations are handled by the \`trash-operations\` Edge Function.

## Bulk operations

Multi-select files to move, delete, or share them in bulk. Large selections are
processed in batches to keep the UI responsive.
`,
  },
  {
    id: 'secure-sharing',
    title: 'Secure Sharing',
    description: 'Public links, passwords, expirations, and zero-exposure secrets.',
    icon: Share2,
    category: 'guides',
    tags: ['sharing', 'links', 'secrets', 'veilref'],
    updated: '2026-07-18',
    content: `# Secure Sharing

## Share links

Every file and folder can produce a share link with optional:

- **Password** — the link requires a password you set (\`share-access\` validates it).
- **Expiration** — the link is rejected after the date (\`validate-share\`).
- **Access scope** — view vs. download.

Files stay encrypted at rest; recipients decrypt in the browser.

## Zero-exposure secrets (VeilRef / SquidVeil)

For credentials and secrets you don't want stored in plaintext anywhere, SquidCloud
offers **SquidVeil**, a zero-knowledge secrets layer. Secrets are referenced by a
token and verified through the KZA security layer. The CLI \`squidcloudctl\` manages
secrets from the terminal:

\`\`\`bash
squidcloudctl secrets list
squidcloudctl secrets create <name> <value>
squidcloudctl secrets verify <name> <value>
\`\`\`

See the [SquidVeil docs](/help/squidveil) and the
[API secrets reference](/help/docs/api-secrets) for details.
`,
  },
  {
    id: 'command-palette',
    title: 'Command Palette',
    description: 'Keyboard-first navigation for power users.',
    icon: Command,
    category: 'guides',
    tags: ['keyboard', 'productivity', 'navigation'],
    updated: '2026-07-18',
    content: `# Command Palette

The command palette provides full keyboard navigation across the app. Open it with
the global shortcut (or from the search affordance) and start typing to jump to
files, folders, settings, or actions.

## Why it matters for accessibility

- Every command is reachable without a mouse.
- Focus is managed so screen-reader users hear each result.
- The same ARIA roles used by dialogs are applied here.

See [Accessibility](/help/docs/accessibility) for the full picture.
`,
  },
  {
    id: 'mobile-app',
    title: 'Mobile & Desktop Apps',
    description: 'Capacitor-packaged native apps for Android, iOS, and desktop.',
    icon: Smartphone,
    category: 'guides',
    tags: ['mobile', 'capacitor', 'android', 'ios'],
    updated: '2026-07-18',
    content: `# Mobile & Desktop Apps

The same React codebase is packaged with **Capacitor** to ship native apps for
Android and iOS, plus desktop builds. Encryption runs entirely on-device using
the Web Crypto API, so the mobile apps provide the same zero-knowledge guarantees
as the web client.

## Notes

- Android app versioning is tracked separately from the web build
  (e.g. \`versionName "11.1.0"\` in the native shell).
- Push, background sync, and file-provider integrations are layered on top of the
  shared web bundle.
`,
  },
  {
    id: 'workspaces',
    title: 'Workspaces',
    description: 'Isolate projects and teams with separate storage namespaces.',
    icon: Users,
    category: 'guides',
    tags: ['workspaces', 'teams', 'isolation'],
    updated: '2026-07-18',
    content: `# Workspaces

Workspaces let you separate files by project, client, or team. Each workspace gets
its own storage namespace: chunk paths are prefixed with
\`userId/workspaceId/chunkId.bin\`, and storage providers can be scoped per
workspace.

## Switching

Use the workspace switcher in the top bar. The active workspace id is persisted in
local storage (\`squid_active_workspace_id\`) and applied to every upload and
download.

## Isolation

A migration enforces per-workspace and per-provider storage isolation at the
database level, so a workspace can only read its own objects.
`,
  },
  {
    id: 'extensions',
    title: 'Extensions & Automation',
    description: 'Compose automations from reusable components and triggers.',
    icon: Boxes,
    category: 'guides',
    tags: ['extensions', 'automation', 'components'],
    updated: '2026-07-18',
    content: `# Extensions & Automation

SquidCloud includes an automation engine (\`squid-automation-engine\`) that runs
scripts you compose from a registry of components (HTTP requests, GitHub Actions,
variables, and more). Scripts can be triggered manually or on a schedule.

## Components

The component registry defines each available block — for example a
\`github-action\` component that triggers a GitHub Actions workflow, or HTTP and
variable components for building pipelines.

## Managing scripts

\`\`\`ts
listScripts()      // list your automation scripts
getScript(id)      // fetch a script definition
createScript(...)  // create a new script
triggerRun(id)     // run a script now
listRuns(id)       // view run history and logs
\`\`\`
`,
  },
];

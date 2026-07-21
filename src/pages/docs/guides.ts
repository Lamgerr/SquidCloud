import { FolderOpen, Share2, Command, Smartphone, Boxes, Users, HardDrive } from '@/lib/icon-map';
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
  {
    id: 'bring-your-own-storage',
    title: 'Bring Your Own Storage (BYOS)',
    description: 'Connect your own S3-compatible storage buckets to the platform.',
    icon: HardDrive,
    category: 'guides',
    tags: ['byos', 'storage', 's3', 'backblaze', 'r2', 'wasabi', 'tebi', 'gcp', 'aws'],
    updated: '2026-07-20',
    content: `# Bring Your Own Storage (BYOS)

BYOS lets you connect your own cloud storage buckets to the platform. Instead of relying solely on the built-in storage, you can use buckets from AWS S3, Backblaze B2, Cloudflare R2, Google Cloud Storage, Wasabi, Tebi, or any S3-compatible service.

---

## Supported Providers

| Provider | Type | Notes |
|---|---|---|
| **AWS S3** | \`s3\` | Any AWS region; use IAM credentials |
| **Backblaze B2** | \`backblaze\` / \`b2\` | Application Key ID + Key (not master) |
| **Cloudflare R2** | \`r2\` | Account ID required; region: auto |
| **Google Cloud Storage** | \`gcp\` | HMAC key created via GCP Console |
| **Tebi** | \`tebi\` | Endpoint: \`https://s3.tebi.io\` |
| **Wasabi** | \`wasabi\` | Region-specific endpoint |
| **Azure Blob** | \`azure\` | S3-compatible mode |
| **Custom S3-Compatible** | \`custom\` | Any service implementing the S3 API |

---

## Adding a Bucket

1. Open the **Storage Providers** dialog from the sidebar.
2. Click **Add Storage Bucket**.
3. Select your provider.
4. Enter the credentials and bucket details.
5. The system verifies the connection and adds it to your list.

Credentials are encrypted at rest and never exposed client-side. All transfers use time-limited presigned URLs.

---

## Managing Buckets

Each bucket shows:
- **Health status** — healthy, unknown, or error
- **Storage usage** — current usage vs limit (if set)
- **Read/Write toggles** — independent controls per bucket
- **Last health check** — when it was last verified

### Read & Write Permissions

Every bucket has independent read and write toggles:

- **Read ON** — Files on this bucket can be downloaded and viewed.
- **Read OFF** — Downloads from this bucket are blocked. Existing shares stop working.
- **Write ON** — New uploads can be stored on this bucket.
- **Write OFF** — The bucket stops accepting new uploads. Existing files remain readable.

Toggling a permission off shows a confirmation warning explaining the impact.

---

## Storage Settings

The **Settings** panel in the Storage Providers dialog lets you configure:

### Fallback Behavior
Controls what happens when no custom provider is selected:
- **SquidCloud only** — Always use built-in storage
- **My buckets only** — Only use your connected buckets
- **SquidCloud first, fallback to mine** — Default to built-in, use buckets as backup
- **My buckets first, fallback to SquidCloud** — Use your buckets when available

### Upload Distribution
When multiple buckets are connected:
- **Round-robin** — Even distribution across all active buckets
- **Least used first** — Fill the bucket with the most free space
- **Primary bucket only** — Always use the selected active bucket

### Public Sharing
Mark a bucket as public to make it available for the network's donation storage system. This is entirely optional.

---

## Limits

- Maximum **20 buckets** per account
- No per-bucket file size or count limits (enforced by your provider)
- Optional per-bucket storage limit you set when adding a bucket
- Connecting your own storage is **free** — you only pay your provider

---

## Troubleshooting

**"Bucket not accessible"** — Verify credentials, bucket name, region, and that permissions include \`s3:ListBucket\`, \`s3:GetObject\`, \`s3:PutObject\`, \`s3:DeleteObject\`.

**"Read access is disabled"** — Open the Storage Providers dialog, find the bucket, and toggle Read back to ON.

**"Write access is disabled"** — Same steps, toggle Write back to ON.

**Uploads fail** — Check write access is enabled, verify the bucket has space, and check your provider's status.

**Downloads fail** — Check read access is enabled and the file still exists in your provider's bucket.

For further help, open the **BYOS Guide** from the Storage Providers dialog or contact support.`,
  },
];

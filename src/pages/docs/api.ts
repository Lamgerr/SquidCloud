import { Code, Database, KeyRound, Terminal } from '@/lib/icon-map';
import type { DocArticle } from './types';

export const apiArticles: DocArticle[] = [
  {
    id: 'api-overview',
    title: 'API Overview',
    description: 'Base URL, authentication, and how the web client proxies requests.',
    icon: Code,
    category: 'api',
    tags: ['api', 'auth', 'rest', 'x-squidcloud-key'],
    updated: '2026-07-18',
    content: `# API Overview

The CloudBliss API is exposed through the \`cloudbliss-api\` Supabase Edge
Function. It is a thin, authenticated gateway over file and secret operations.

## Authentication

Every request must include your API key in the \`X-SquidCloud-Key\` header:

\`\`\`http
GET /files
X-SquidCloud-Key: <your-api-key>
\`\`\`

API keys are managed by the \`api-key-management\` function and can be created,
listed, and revoked from *Account Settings → Developer*.

## From the web client

The web app proxies \`/api/v1/<path>\` through \`api/v1/[...path].js\`, which
forwards the call to the \`cloudbliss-api\` function and attaches your key
server-side. This keeps the key off the client bundle.

\`\`\`text
Browser ── /api/v1/files ──▶ api/v1/[...path].js ──▶ cloudbliss-api
\`\`\`

## Response shape

Responses are JSON. Successful reads return the requested resource; errors return
a standard error object with an HTTP status you can branch on.

## Reference

- [Files](/help/docs/api-files)
- [Secrets & VeilRef](/help/docs/api-secrets)
- [API keys](/help/docs/api-keys)
- [CLI (squidcloudctl)](/help/docs/api-cli)
`,
  },
  {
    id: 'api-files',
    title: 'Files API',
    description: 'List, upload, download, and delete encrypted files.',
    icon: Database,
    category: 'api',
    tags: ['api', 'files', 'upload', 'download'],
    updated: '2026-07-18',
    content: `# Files API

All file endpoints require the \`X-SquidCloud-Key\` header.

## List files

\`\`\`http
GET /files
\`\`\`

## File metadata

\`\`\`http
GET /files/:id/metadata
\`\`\`

Returns the file record, including its chunk manifest (chunk index, storage path,
and verification flags). It does **not** return plaintext.

## Download

\`\`\`http
GET /files/:id/download
\`\`\`

Returns a URL (or stream) the client uses to fetch encrypted chunks, which are
then decrypted in the browser. For shared files the \`download-shared-file\`
function handles access-controlled retrieval.

## Upload

\`\`\`http
POST /files/upload
\`\`\`

Initiates an upload. The actual chunk bytes are pushed to the active storage
backend (see [Storage backends](/help/docs/storage-backends)); this endpoint
registers the file and its manifest.

## Delete

\`\`\`http
DELETE /files/:id
\`\`\`

Removes the file record and schedules cleanup of its stored chunks
(\`storage-cleanup\`).

> The API only ever moves ciphertext and metadata. Decryption keys are never sent
> to these endpoints.
`,
  },
  {
    id: 'api-secrets',
    title: 'Secrets & VeilRef API',
    description: 'Zero-knowledge secret storage, verification, and VeilRef handshake.',
    icon: KeyRound,
    category: 'api',
    tags: ['api', 'secrets', 'veilref', 'squidveil'],
    updated: '2026-07-18',
    content: `# Secrets & VeilRef API

Secrets are stored zero-knowledge: the server holds only an opaque, verifiable
reference — never the plaintext value.

## List secrets

\`\`\`http
GET /secrets
\`\`\`

## Create / update a secret

\`\`\`http
POST /secrets
\`\`\`

## Verify a value

\`\`\`http
POST /secrets/:id/verify
\`\`\`

Checks a supplied value against the stored secret **without** exposing the stored
value. Verification is performed server-side against the hashed reference.

## Rename / delete

\`\`\`http
PATCH /secrets/:id/rename
DELETE /secrets/:id
\`\`\`

## VeilRef

VeilRef is the protocol behind zero-exposure secret references used by SquidVeil.
It exposes handshake, reference, audit, verify, and resolve operations:

\`\`\`http
POST /veilref/handshake
POST /veilref/ref
POST /veilref/audit
POST /veilref/verify
POST /veilref/resolve
\`\`\`

These are scored and gated by the KZA security layer (see
[RES54 & KZA](/help/docs/res54-kza)). For day-to-day use, prefer the
[SquidVeil CLI](/help/docs/api-cli) or the SquidVeil docs
([/help/squidveil](/help/squidveil)).
`,
  },
  {
    id: 'api-keys',
    title: 'API Keys',
    description: 'Create, list, and revoke developer API keys.',
    icon: KeyRound,
    category: 'api',
    tags: ['api', 'keys', 'developer'],
    updated: '2026-07-18',
    content: `# API Keys

Developer API keys authenticate requests to the CloudBliss API via the
\`X-SquidCloud-Key\` header.

## Managing keys

Keys are managed by the \`api-key-management\` Edge Function and surfaced in
*Account Settings → Developer*. You can:

- create a new key (with an optional label),
- list your active keys, and
- revoke a key (immediately invalidates it).

## Best practice

- Store keys in a secrets manager, not in source control.
- Use a dedicated key per integration so you can revoke one without breaking others.
- Rotate keys periodically.
`,
  },
  {
    id: 'api-cli',
    title: 'CLI (squidcloudctl)',
    description: 'The squidcloudctl command-line client — storage, sites, secrets, and more.',
    icon: Terminal,
    category: 'api',
    tags: ['cli', 'squidcloudctl', 'squidveil', 'terminal', 'automation'],
    updated: '2026-07-18',
    content: `# CLI — squidcloudctl

\`squidcloudctl\` (binary \`squidcloud\`) is the official SquidCloud command-line
client. It covers storage, sites, automations, file requests, time-locks,
signatures, collaboration, secrets, and monitoring — all against the same
CloudBliss API used by the web app.

## Install

\`\`\`bash
npm install -g squidcloudctl
\`\`\`

## Authentication

\`\`\`bash
squidcloudctl login          # interactive device auth
squidcloudctl logout         # clear local session
squidcloudctl whoami        # show current account
squidcloudctl auth status    # session health
squidcloudctl auth sessions  # list active sessions
squidcloudctl auth revoke   # revoke a/all sessions
\`\`\`

## Storage

\`\`\`bash
squidcloudctl storage ls            # list files/folders
squidcloudctl storage upload <p>   # upload file/folder
squidcloudctl storage download <p>  # download
squidcloudctl storage cp|mv|rm     # copy / move / delete
squidcloudctl storage mkdir <name>  # create folder
squidcloudctl storage cat <file>    # print to stdout
squidcloudctl storage info <file>   # metadata
squidcloudctl storage share <file>  # create share link
squidcloudctl storage unshare <file> # revoke share links
squidcloudctl storage tag <file>    # add/remove tags
squidcloudctl storage search <q>    # find by name
squidcloudctl storage diff           # compare local vs remote
squidcloudctl storage clean         # clean orphaned files
\`\`\`

## Sites (SquidSites)

\`\`\`bash
squidcloudctl deploy                 # deploy static site
squidcloudctl sites list|info|open
squidcloudctl sites unpublish|delete
squidcloudctl sites visibility <v>   # public/private
squidcloudctl sites rename|rollback|deploys
squidcloudctl sites logs|analytics|purge
\`\`\`

## Automations (SquidScripts)

\`\`\`bash
squidcloudctl scripts list|run|logs|validate|init
squidcloudctl scripts enable|disable|delete
squidcloudctl scripts status|cancel|watch
\`\`\`

## File Requests (SquidForms)

\`\`\`bash
squidcloudctl filereq list|create|info
squidcloudctl filereq submissions|export|clear|delete|embed
\`\`\`

## SquidTime (time-locks)

\`\`\`bash
squidcloudctl time lock|unlock|status|list|proof
\`\`\`

## Collaboration

\`\`\`bash
squidcloudctl collab invite|list|remove|activity|leave|transfer
\`\`\`

## SquidSign (signatures)

\`\`\`bash
squidcloudctl sign request|status|list|cancel|verify|download
\`\`\`

## SquidVeil secrets

\`\`\`bash
squidcloudctl secrets list|create|rename|delete
squidcloudctl secrets verify|export|audit|init
\`\`\`

## Monitoring & logs

\`\`\`bash
squidcloudctl monitor [sites|pipelines|storage|automations]
squidcloudctl logs tail|search|export
\`\`\`

## Utility

\`\`\`bash
squidcloudctl doctor            # system diagnostics
squidcloudctl config list|set|get|delete|reset
squidcloudctl completion        # shell completion
squidcloudctl feedback         # report a bug
squidcloudctl update           # self-update
\`\`\`

Most commands support \`--output json\` for scripting (CI-safe commands are
marked in the registry). A fuller, rendered CLI reference lives at [/cli](/cli).
`,
  },
];

---
title: "SquidCloud Static Site Publication Engine"
subtitle: "Architecture, Implementation, and Deployment"
author: "SquidCloud Engineering"
date: \today
geometry: margin=1in
fontsize: 11pt
toc: true
numbersections: true
---

# Introduction

SquidCloud's Static Site Publication Engine transforms user-uploaded HTML
resources --- both individual `.html` files and entire directory hierarchies ---
into publicly addressable, production-grade static websites. The system
orchestrates a multi-tier architecture spanning client-side React components,
Supabase-managed metadata and object storage, Deno-deployed edge functions, and
Vercel-hosted API proxies that circumvent platform-level Content-Type
restrictions endemic to free-tier Supabase deployments.

# Architectural Overview

The publication pipeline comprises five discrete strata, each with clearly
delineated responsibilities:

1.  **Presentation Layer:** React/TypeScript UI components that expose
    publish, republish, visibility toggling, and unpublish workflows.
2.  **API Abstraction Layer:** A thin client-side API module
    (`src/lib/api.ts`) that marshals invocations to a Supabase-managed
    Deno edge function via `supabase.functions.invoke`.
3.  **Orchestration Layer:** The `sites-api` edge function (Deno),
    which executes CRUD operations against the `site_publications` table
    and interfaces with the `squid-sites` Storage bucket for artifact
    lifecycle management.
4.  **Storage & Metadata Layer:** PostgreSQL (via Supabase) for
    publication records and Row-Level Security policy enforcement;
    Supabase Storage for immutable site artifacts with MIME-type
    annotations.
5.  **Serving Layer:** A Vercel Edge Function (`api/serve/[...path].js`)
    that resolves publication metadata, authenticates private-site
    requests, fetches objects from Supabase Storage, and returns them
    with canonical HTTP headers --- notably circumventing Supabase's
    free-plan `text/html` → `text/plain` Content-Type rewrite.

# Data Model

## The `site_publications` Table

The publication metadata schema, provisioned directly against the Supabase
Postgres instance, is defined as:

```sql
CREATE TABLE public.site_publications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id     TEXT NOT NULL,
    resource_type   TEXT NOT NULL CHECK (resource_type IN ('file', 'folder')),
    owner_id        UUID NOT NULL REFERENCES auth.users(id),
    site_slug       TEXT NOT NULL,
    site_url        TEXT NOT NULL,
    visibility      TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    status          TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'unpublished', 'error')),
    published_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    file_count      INTEGER NOT NULL DEFAULT 0,
    total_size_bytes BIGINT NOT NULL DEFAULT 0
);
```

### Row-Level Security Policies

Three RLS policies govern access to this relation:

```sql
-- Authenticated users: full CRUD on owned rows
CREATE POLICY "Users can create own publications"
    ON site_publications FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can view own publications"
    ON site_publications FOR SELECT TO authenticated
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can update own publications"
    ON site_publications FOR UPDATE TO authenticated
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own publications"
    ON site_publications FOR DELETE TO authenticated
    USING (auth.uid() = owner_id);

-- Anonymous access: public site metadata only
CREATE POLICY "Anyone can view public sites"
    ON site_publications FOR SELECT TO anon, authenticated
    USING (visibility = 'public');
```

The final policy is critical: it permits the Vercel edge serving function,
which authenticates via the Supabase anon key, to resolve `visibility` and
`status` for any row marked `visibility = 'public'`. Private-site lookups
require the requesting user's JWT and are validated via `auth.uid()`.

## The `squid-sites` Storage Bucket

A dedicated Supabase Storage bucket, `squid-sites`, houses all published site
artifacts. The bucket is configured with **public read access** --- any entity
possessing the object URL (including unauthenticated clients) may retrieve
artifacts. This is safe because:

-   Object paths incorporate the `site_slug`, which is a non-guessable
    application-level identifier.
-   Private-site access control is enforced at the metadata layer (the
    Vercel edge function), not at the storage layer.
-   Write access is restricted to authenticated users possessing a valid
    service-role JWT, enforced via Supabase Storage RLS:

    ```sql
    CREATE POLICY "Authenticated users can manage own sites"
        ON storage.objects FOR ALL TO authenticated
        USING (bucket_id = 'squid-sites' AND auth.role() = 'authenticated');
    ```

# Client-Side Architecture

## React Hooks: `usePublishState` and `usePublish`

The publication lifecycle is managed through two composable React hooks housed
in `src/hooks/usePublish.ts`.

### `usePublishState(resourceId)`

A lightweight hook that accepts a `resourceId` (or `null` for no-op) and
returns `{ publication, loading, error, refresh }`. On mount and whenever
`resourceId` changes, it invokes `checkPublishStatus()` --- which dispatches an
`action: 'status'` message to the `sites-api` edge function. This hook is used
by action menus to conditionally render "Publish as Website" vs. "Manage
Published Site" labels.

### `usePublish()`

A heavier orchestrator hook that exposes:

| Method | Description |
|---|---|
| `doPublish` | Creates a publication record, uploads artifacts, updates metadata |
| `doRepublish` | Re-uploads artifacts for an existing slug |
| `doUnpublish` | Purges storage artifacts and deletes the publication record |
| `doToggleVisibility` | Flips `public` ↔ `private` |
| `fetchAll` | Retrieves all publications for the authenticated user |

The hook maintains internal state for `progress` (a `PublishProgress`
interface with `current`, `total`, `stage`, and `percent` fields), `error`, and
`loading`. Progress is propagated via an optional callback that downstream
consumers (e.g., `PublishWebsiteModal`) use to render an animated progress
bar.

## Artifact Upload Logic

### Single-File Publication

```typescript
const publishSingleFile = async (fileId: string, slug: string) => {
    const blob = await downloadFile(fileId);
    await uploadFileToSite(slug, 'index.html', blob);
    return { fileCount: 1, totalBytes: blob.size };
};
```

The `downloadFile()` utility (from `src/lib/api.ts`) handles decryption and
potentially chunked retrieval of the source object from SquidCloud's primary
storage. The resulting `Blob` is then uploaded to the `squid-sites` bucket at
path `{slug}/index.html` with Content-Type inferred from an extension-based
MIME map.

### Folder Publication

```typescript
const publishFolder = async (folderId: string, slug: string) => {
    const files = await fetchFolderContents(folderId);
    for (const file of files) {
        const blob = await downloadFile(file.id);
        const relativePath = deriveRelativePath(file, folderId);
        await uploadFileToSite(slug, relativePath, blob);
    }
    return { fileCount: files.length, totalBytes: sum(sizes) };
};
```

Folder publication iterates all descendant files, preserving the relative
directory structure. Each file is downloaded, re-uploaded to the appropriate
path under `{slug}/`, and counted for metadata updates.

### MIME-Type Mapping

A comprehensive map ensures correct Content-Type assignment:

```typescript
const MIME_MAP: Record<string, string> = {
    html: 'text/html',
    htm:  'text/html',
    css:  'text/css',
    js:   'application/javascript',
    // ... image types, font types, etc.
};
```

This is essential because the upstream `downloadFile()` produces opaque binary
blobs; the MIME map restores semantic type information that the storage layer
retains as object metadata.

## UI Components

### `PublishWebsiteModal`

A React component rendered via the project's responsive `Dialog` primitive,
which automatically resolves to a centered modal on desktop viewports and a
Vaul-powered bottom drawer on mobile (breakpoint: 768px). The component
manages three rendering states:

1.  **Unpublished:** A form presenting a slug input field and a
    public/private `Switch` toggle.
2.  **In-Progress:** An animated `ProgressBar` driven by the
    `PublishProgress` interface.
3.  **Published:** A success pane displaying the canonical site URL with
    controls for visibility toggling, republishing, and unpublishing.

### `PublishedSitesManager` (Desktop)

A `Dialog`-hosted aggregate view listing all of the user's publications.
Each row presents the site slug, file count, relative timestamp, and action
buttons for external navigation, visibility toggling, and deletion.

### `MobilePublishedSitesManager`

A mobile-native bottom sheet (wrapping Vaul's `Drawer` via the `MobileSheet`
abstraction) that presents published sites as card-style entries. Each card
features:

-   A header section with a Globe icon, the site slug, metadata
    (file count, relative timestamp, private badge), and
-   A three-button action bar: **Open** (external link), **Private/public
    toggle**, and **Unpublish** (destructive).

Haptic feedback (`navigator.vibrate(30)`) is emitted on all interactive
gestures, consistent with the platform's `MobileFileActionSheet` pattern.

The mobile manager is bridged into the desktop `PublishWebsiteModal` via a
conditional "Manage All Published Sites" button that only renders on mobile
viewports (`useIsMobile()`).

# Serving Architecture

## The Supabase Content-Type Constraint

Supabase's free-tier compute gateway unconditionally rewrites `Content-Type:
text/html` response headers to `Content-Type: text/plain` for all responses
served from edge functions and Storage public URLs. This is a documented
platform limitation intended to reserve HTML serving for paid plans. The
constraint manifests as:

```
Request:  GET /functions/v1/serve-site/{userId}/{slug}
Response: Content-Type: text/plain  (rewritten from text/html by gateway)
```

This renders Supabase edge functions and Storage URLs unsuitable as direct
serving endpoints for published HTML sites. The symptom in browser contexts
is raw HTML source rendering rather than DOM interpretation.

## Vercel Edge Function: `api/serve/[...path].js`

To bypass Supabase's Content-Type coercion, SquidCloud deploys a Vercel Edge
Function at the catch-all route `/api/serve/[...path]`. Vercel's Edge
Network does not apply any Content-Type rewriting, enabling canonical HTML
serving.

### Request Resolution Flow

```
Browser → https://squidcloud.vercel.app/api/serve/{ownerId}/{slug}/{path}
                      │
                      ▼
           vercel.json rewrite rule:
           "/api/serve/:path*" → "/api/serve/[...path]"
                      │
                      ▼
           Vercel Edge Function (api/serve/[...path].js)
                      │
           ┌──────────┼──────────┐
           ▼          ▼          ▼
    1. Parse URL  2. Query     3. Auth check
       path          site_        (if private)
                     publications
                     (anon key)
                      │
                      ▼
           Fetch from Supabase Storage
           /object/public/squid-sites/{slug}/{file}
                      │
                      ▼
           Return Response with:
           Content-Type: text/html (or resolved MIME)
           Cache-Control: public, max-age=3600
           Access-Control-Allow-Origin: *
```

### Path Resolution Logic

The function implements an intelligent file-resolution algorithm:

```javascript
function resolvePath(filePath) {
    if (!filePath) return 'index.html';              // root → index.html
    if (!filePath.includes('.')) return filePath + '/index.html';  // dir → dir/index.html
    return filePath;                                 // explicit file
}
```

This enables three URL patterns to all resolve correctly:

| URL | Resolved Path |
|---|---|
| `/api/serve/{uid}/{slug}` | `index.html` |
| `/api/serve/{uid}/{slug}/` | `index.html` |
| `/api/serve/{uid}/{slug}/assets` | `assets/index.html` |
| `/api/serve/{uid}/{slug}/style.css` | `style.css` |

A fallback mechanism retries `index.html` when the primary fetch returns a
non-2xx status, providing graceful degradation for missing paths.

### Authentication for Private Sites

When a publication's `visibility` attribute equals `'private'`, the edge
function:

1.  Extracts the `Authorization: Bearer {jwt}` header from the request.
2.  Validates the JWT against Supabase Auth's `/auth/v1/user` endpoint.
3.  Confirms the authenticated user's `id` matches the `ownerId` encoded
    in the URL path.

This decouples privacy enforcement from the storage layer: the bucket remains
public, but the serving function gates access.

## Supabase Edge Function: `serve-site` (Redirect)

The original `serve-site` Deno edge function now functions exclusively as a
redirect gateway:

```typescript
serve(async (req) => {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/serve-site\/?/, '');
    const vercelUrl = `https://squidcloud.vercel.app/api/serve/${path}`;
    return new Response(null, {
        status: 302,
        headers: { 'Location': vercelUrl },
    });
});
```

This ensures backward compatibility: any clients or bookmarks referencing the
original `supabase.co/functions/v1/serve-site/{path}` URL are transparently
redirected to the Vercel-hosted serving endpoint.

# API Specification: `sites-api` Edge Function

The `sites-api` Deno edge function implements a command-pattern interface
where each request specifies an `action` field. This pattern was chosen over
RESTful resource routing because the `supabase.functions.invoke()` client
abstraction does not support arbitrary HTTP methods or path segments when
targeting edge functions.

## Endpoint

```
POST https://{project}.supabase.co/functions/v1/sites-api
Authorization: Bearer {user_jwt}
Content-Type: application/json
```

## Actions

### `create`

Creates a publication record and returns the assigned slug and URL. The slug
is derived from the resource name via a sanitization pipeline:
lowercasing → non-alphanumeric replacement → deduplication → length
clamping (3--48 characters). Collision detection appends a numeric suffix.

**Request:**
```json
{
    "action": "create",
    "resourceId": "uuid",
    "resourceType": "file|folder",
    "siteName": "optional-override",
    "visibility": "public|private"
}
```

**Response:**
```json
{
    "publication": { "...SitePublication record..." },
    "siteSlug": "my-site",
    "siteUrl": "https://squidcloud.vercel.app/api/serve/{uid}/my-site"
}
```

### `list`

Retrieves all publications for the authenticated user, ordered by
`published_at DESC`.

### `status`

Returns the publication associated with a given `resourceId`, or `null` if
the resource is not published.

### `update`

Updates mutable publication fields (`visibility`, `file_count`,
`total_size_bytes`) for a given `slug`.

### `visibility`

Toggles the `visibility` field between `'public'` and `'private'`. Exists as
a distinct action from `update` to enforce the allowed-value constraint.

### `unpublish`

Performs a two-phase teardown: (1) enumerates and deletes all objects under
`{slug}/` in the `squid-sites` bucket, then (2) deletes the publication
record. This is intentionally non-reversible.

# Deployment Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser / Client                          │
└──────────────────┬──────────────────────────────────────────────┘
                   │
         ┌─────────┴──────────┐
         │  squidcloud.vercel.app  │
         │  (Vercel Edge Network)  │
         └────┬──────────┬───────┘
              │          │
              ▼          ▼
    ┌─────────────────┐  ┌──────────────────────┐
    │  /api/v1/*      │  │  /api/serve/*        │
    │  API Proxy      │  │  Site Serving         │
    │  (Edge Function)│  │  (Edge Function)      │
    └────────┬────────┘  └──────────┬───────────┘
             │                      │
             ▼                      ▼
    ┌─────────────────┐  ┌──────────────────────┐
    │  cloudbliss-api   │  │  Supabase Storage    │
    │  (Supabase FN)    │  │  (squid-sites bucket)│
    └─────────────────┘  └──────────────────────┘
             │
             ▼
    ┌──────────────────────┐
    │  Supabase PostgreSQL  │
    │  site_publications    │
    │  auth.users           │
    └──────────────────────┘
             │
             ▼
    ┌──────────────────────┐
    │  sites-api (Deno FN) │
    │  CRUD operations     │
    └──────────────────────┘
```

## Key Deployment Artifacts

| Artifact | Location | Runtime |
|---|---|---|
| Site serving endpoint | `api/serve/[...path].js` | Vercel Edge |
| API proxy | `api/v1/[...path].js` | Vercel Edge |
| Publication CRUD | `supabase/functions/sites-api/index.ts` | Deno (Supabase) |
| Redirect gateway | `supabase/functions/serve-site/index.ts` | Deno (Supabase) |
| Build config | `vercel.json` | Vercel |

# Error Handling and Edge Cases

## Slug Collision

When a generated slug collides with an existing publication, the `sites-api`
function queries the count of existing publications for the user and appends
an incrementing numeric suffix: `{slug}-{n}`. This ensures deterministic
non-collision without requiring user intervention.

## Storage Cleanup on Unpublish

The `unpublish` action lists up to 1,000 objects under the slug prefix and
issues a batch delete. This is a best-effort cleanup; orphaned objects may
accumulate if the threshold is exceeded (mitigated by the 1,000-object list
limit) or if the deletion partially fails.

## Private Site Authorization Failure

If an unauthenticated or unauthorized client requests a private site, the
Vercel edge function returns `401 Unauthorized` or `403 Forbidden` with
`Content-Type: text/plain`. No redirect to an authentication page occurs;
the client is expected to handle the status code.

## Missing File Fallback

For path requests where the resolved file does not exist, the edge function
attempts a fallback fetch of `index.html` in the same directory. This
accommodates SPA-style routing where client-side routers handle path
resolution after serving the root document.

# Performance Characteristics

-   **Cold start (Vercel Edge):** ~50ms (V8 isolate instantiation).
-   **Metadata resolution:** ~100--200ms (Supabase REST query + network
    round trip).
-   **Storage fetch:** Variable based on object size; cached at Vercel
    Edge via `Cache-Control: public, max-age=3600`.
-   **Client-side publish (single file):** Download time + upload time;
    typically 1--5 seconds for a 100KB HTML file over a broadband
    connection.
-   **Client-side publish (folder):** Linear in file count; each file
    incurs a download-upload cycle. A 50-file folder may take 30--120
    seconds.

# Appendix: Supabase Free-Plan Content-Type Quirk

The Supabase gateway's Content-Type rewrite behavior is documented in:

-   [Supabase Development Tips](https://supabase.com/docs/guides/functions/development-tips)
-   [Community Issue #1396601649853759599](https://www.answeroverflow.com/m/1396601649853759599)

The rewrite applies to all `text/html` responses from both edge functions
and Storage public URLs on free-tier projects. Paid plans (Pro, Team,
Enterprise) do not exhibit this behavior. SquidCloud's architecture
accommodates the constraint by routing all HTML traffic through Vercel's
edge infrastructure, which does not apply any Content-Type transformation.

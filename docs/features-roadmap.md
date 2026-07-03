# Feature Roadmap

## 2. Smart Share Links

### Goal
Transform basic share links into fully-configurable, trackable sharing with expiration, access control, and per-link analytics.

### Existing Infrastructure
- `shares` table with columns: `expires_at`, `access_code`, `download_limit`, `view_only`, `require_email`, `share_views`, `download_count`
- `share_audit_logs` table tracking every view/download event
- `EnhancedShareDialog` — UI for creating/revoking shares
- `ShareManagementPanel`/`ShareManagementDialog` — list all shares
- `SharePage` (route: `/s/:shareId`) — public view of shared file

### What Needs Building

| Component | File | Description |
|-----------|------|-------------|
| Share option sections | `EnhancedShareDialog` | Add UI for expiration, password, download limit, view-only, email collection |
| ShareLinkAnalytics | `components/ShareLinkAnalytics.tsx` | Chart of views/downloads from `share_audit_logs` |
| share-access-notify | `supabase/functions/share-access-notify/index.ts` | Email sender on share access |
| Download limit enforcement | `SharePage.tsx` | Block download when limit reached |
| Revocation reason | `shareFile` / API | Pass reason in revoke flow |

### Database Changes
- `share_audit_logs`: ensure `event_type` distinguishes `view` vs `download`
- Edge function trigger on `share_audit_logs` INSERT

---

## 4. File Request Links

### Goal
Let users create a public upload link so anyone (even unauthenticated) can submit files to a specified folder, with configurable limits and notifications.

### Existing Infrastructure
- `uploadFile()` — full upload pipeline with encryption
- `BackgroundUploadService` — background upload with progress
- No file-request concept exists yet

### What Needs Building

| Component | File | Description |
|-----------|------|-------------|
| Schema | `supabase/migrations/*_file_requests.sql` | New tables `file_requests`, `file_request_submissions` |
| CreateFileRequestDialog | `components/CreateFileRequestDialog.tsx` | Dashboard form: title, description, folder, max files, max size, allowed types, expiry |
| ManageFileRequests | `components/ManageFileRequests.tsx` | List file requests with submission count, copy link, toggle active/disable |
| FileRequestPage | `pages/FileRequestPage.tsx` | Public page at `/r/:slug` — upload UI with drag-drop, name/email fields |
| API functions | `lib/api.ts` | `createFileRequest()`, `submitFileToRequest()`, `getFileRequest()`, `getFileRequestSubmissions()` |
| RPCs | `supabase/rpc/` | `create_file_request`, `submit_file_request`, `get_file_request_by_slug` |
| Notify edge function | `supabase/functions/file-request-notify` | Email owner on each submission |

### Database Tables

**`file_requests`**
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | |
| `user_id` | uuid FK→users | Owner |
| `folder_path` | text | Target folder for uploads |
| `title` | text | Display title |
| `description` | text | Optional description |
| `slug` | text UNIQUE | URL identifier |
| `max_files` | int | Max submissions allowed |
| `max_size_per_file` | bigint | Per-file size limit |
| `allowed_types` | text[] | MIME type whitelist |
| `expires_at` | timestamptz | Expiration |
| `is_active` | bool | Toggle on/off |
| `created_at` | timestamptz | |

**`file_request_submissions`**
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | |
| `file_request_id` | uuid FK→file_requests | Parent request |
| `uploader_name` | text | Optional name |
| `uploader_email` | text | Optional email |
| `file_id` | uuid FK→files | Uploaded file |
| `file_name` | text | Original filename |
| `file_size` | bigint | Size in bytes |
| `created_at` | timestamptz | |

---

## 6. Inline Preview Everything

### Goal
Every file type opens instantly for preview — no download required. Add 6 new renderers and a Space-bar Quick Look.

### Existing Infrastructure
- `EnhancedInstantPreviewModal` — main preview dialog dispatching to renderers by type
- Renderers: PDF (`OptimizedPDFViewer`), Image (`AdvancedImageViewer`), Video (`CBVideoPlayer`), Audio (`<audio>`), Spreadsheet (`SpreadsheetViewer`), Text/Code (`EnhancedTextEditor`)
- `ArchiveViewerModal` for archives (not yet wired into `EnhancedInstantPreviewModal`)

### What Needs Building

| Renderer | File | Library/Tool |
|----------|------|-------------|
| ModelViewer | `components/ModelViewer.tsx` | `<model-viewer>` or Three.js |
| ImageFormatExpander | `components/ImageFormatExpander.tsx` | `heic2any` + conversion edge function |
| FontPreviewer | `components/FontPreviewer.tsx` | Inline `<textarea>` with applied font |
| NotebookViewer | `components/NotebookViewer.tsx` | `@nteract/notebook-render` or server HTML |
| Preview conversion | `supabase/functions/convert-preview` | Server-side (PSD/AI/RAW → PNG) |
| ArchiveViewer wiring | `EnhancedInstantPreviewModal` | Route `.zip/.rar/.7z/.tar.gz` to ArchiveViewerModal |
| QuickLookOverlay | `components/QuickLookOverlay.tsx` | Full-screen overlay on Space key |
| useQuickLook | `hooks/useQuickLook.ts` | Keyboard listener, tracks focused file |

### Type Detection Registry (in `EnhancedInstantPreviewModal`)

```typescript
const previewRegistry: Record<string, {
  component: React.FC;
  mimeTypes: string[];
  extensions: string[];
}> = {
  pdf: { component: OptimizedPDFViewer, mimeTypes: ['application/pdf'], extensions: ['.pdf'] },
  image: { component: AdvancedImageViewer, mimeTypes: ['image/*'], extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'] },
  video: { component: CBVideoPlayer, mimeTypes: ['video/*'], extensions: ['.mp4', '.webm', '.mkv', '.mov'] },
  audio: { component: AudioPreviewer, mimeTypes: ['audio/*'], extensions: ['.mp3', '.wav', '.ogg', '.flac'] },
  spreadsheet: { component: SpreadsheetViewer, mimeTypes: [], extensions: ['.xlsx', '.csv', '.ods'] },
  text: { component: EnhancedTextEditor, mimeTypes: ['text/*'], extensions: ['.txt', '.md', '.json', '.js', '.ts', '.py', '.html', '.css'] },
  '3d': { component: ModelViewer, mimeTypes: ['model/*'], extensions: ['.glb', '.gltf', '.stl', '.obj'] },
  ipynb: { component: NotebookViewer, mimeTypes: [], extensions: ['.ipynb'] },
  archive: { component: ArchiveViewerModal, mimeTypes: ['application/zip', 'application/x-rar-compressed', 'application/gzip', 'application/x-7z-compressed'], extensions: ['.zip', '.rar', '.7z', '.tar.gz', '.tgz'] },
  font: { component: FontPreviewer, mimeTypes: ['font/*'], extensions: ['.ttf', '.otf', '.woff', '.woff2'] },
  design: { component: ConvertedImagePreview, mimeTypes: [], extensions: ['.psd', '.ai'] },
  raw: { component: ConvertedImagePreview, mimeTypes: [], extensions: ['.heic', '.heif', '.raw', '.cr2', '.nef'] },
}
```

### Edge Function: `convert-preview`

Converts unsupported formats (PSD, AI, HEIC, RAW) to PNG via libraries (e.g., `sharp`, `heic-convert`) on the server and returns the image data. Caches results by file hash + page number.

### Quick Look

Space-key handler at Dashboard level:
1. Tracks the currently focused/hovered file
2. Pressing Space opens full-screen overlay showing the rendered preview
3. Pressing Space again (or Escape) closes
4. Arrow keys navigate between files
5. Same rendering as `EnhancedInstantPreviewModal` but full-screen, no dialog chrome

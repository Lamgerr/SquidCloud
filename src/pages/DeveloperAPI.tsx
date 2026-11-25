import { PAGES_POLISH } from "@/components/polish/pages-polish.css";
import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, Code, FileText, Key, Play, Settings2, Sliders } from '@/lib/icon-map';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileScrollToTop from '@/components/MobileScrollToTop';
import ApiKeyManagement from '@/components/ApiKeyManagement';
import ApiUsageChart from '@/components/ApiUsageChart';
import ApiRequestLogs from '@/components/ApiRequestLogs';
import DeveloperAPIMobile from '@/components/DeveloperAPIMobile';
import { supabase } from '@/integrations/supabase/client';
import { toast as sonnerToast } from 'sonner';
import { AI_AGENT_PROMPT } from '@/lib/ai-agent-prompt';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AppShell, AppTheme, TopBar, Wrap, Panel, Row, Pill, Dot, Kbd, Meter, Note,
  Empty, SkelRows, Spinner, Ico, CodeBlock, CopyLine,
  btn, useHashState, useDocTitle, useSearchShortcut,
} from '@/components/custom/squid-app';
import { SPRING, JELLY } from '@/components/FloatingDock';

const TAB_IDS = ['overview', 'keys', 'playground', 'status', 'docs'] as const;
type TabId = (typeof TAB_IDS)[number];

const DV_CSS = `
.dv-root {
  --lq-spring: cubic-bezier(0.34, 1.4, 0.64, 1);
  --lq-jelly: cubic-bezier(0.34, 1.56, 0.64, 1);
  --g-ink: var(--sa-text, #e8e7e1);
  --g-mute: var(--sa-mute, #8d8f89);
  --g-fill: var(--sa-bg-2, #0e1110);
  --g-fill-hi: var(--sa-bg-4, #1b201d);
  --g-line: var(--sa-line, #1f2221);
  --g-rim: var(--sa-rim, #2f3230);
}
@supports (transition-timing-function: linear(0, 1)) {
  .dv-root { --lq-spring: ${SPRING}; --lq-jelly: ${JELLY}; }
}

/* Floating top section dock */
.dv-dock-wrap {
  position: sticky;
  top: 58px;
  z-index: 35;
  display: flex;
  justify-content: center;
  padding: 12px var(--sa-gut) 4px;
  pointer-events: none;
}
.dv-dock {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: 999px;
  background: linear-gradient(180deg, var(--sa-bg-4, #1b201d), var(--sa-bg-2, #0e1110));
  border: 1px solid var(--g-line);
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  box-shadow: inset 0 1px 0 rgba(232, 231, 225, 0.06), 0 16px 38px -14px rgba(0, 0, 0, 0.82);
}
.dv-dock-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 15px;
  border: 0;
  border-radius: 999px;
  background: none;
  color: var(--g-mute);
  font: 500 12.5px/1 var(--sa-f);
  cursor: pointer;
  white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
  transition: color 0.18s !important;
}
.dv-dock-btn:hover,
.dv-dock-btn[aria-selected="true"] {
  color: var(--g-ink);
}
.dv-dock-thumb {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: linear-gradient(180deg, var(--sa-bg-4, #1b201d), var(--sa-bg-3, #141816));
  border: 1px solid var(--g-rim);
  box-shadow: inset 0 1px 0 rgba(232, 231, 225, 0.08), 0 4px 12px -2px rgba(0, 0, 0, 0.6);
}
.dv-dock-lbl {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.dv-dock-cnt {
  font: 400 10.5px/1 var(--sa-mono);
  color: var(--g-mute);
}

/* Dark liquid-glass overrides for panels & buttons */
.dv-root .sa-panel {
  border-radius: 16px;
  background: var(--g-fill);
  border: 1px solid var(--g-line);
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);
  box-shadow: inset 0 1px 0 rgba(232, 231, 225, 0.1), 0 18px 42px -20px rgba(0, 0, 0, 0.78);
  overflow: hidden;
}
.dv-root .sa-panel-h {
  border-bottom-color: var(--g-line);
  padding: 14px 18px;
}
.dv-root .sa-row {
  padding: 13px 18px;
}
.dv-root .sa-row + .sa-row,
.dv-root .sa-panel-b.flush > .sa-row:not(:first-child) {
  border-top-color: var(--g-line);
}
.dv-root .sa-btn {
  border-radius: 999px;
  background: var(--sa-bg-3, #141816);
  border: 1px solid var(--g-line);
  color: var(--g-ink);
  box-shadow: inset 0 1px 0 rgba(232, 231, 225, 0.06);
  transition: transform 0.55s var(--lq-jelly), background 0.18s, border-color 0.18s;
}
.dv-root .sa-btn:hover {
  background: var(--sa-bg-4, #1b201d);
  border-color: var(--g-rim);
}
.dv-root .sa-btn:active {
  transform: scaleX(0.93) scaleY(0.87);
}
.dv-root .sa-btn.primary {
  background: var(--g-fill-hi);
  color: var(--g-ink);
  border-color: var(--g-rim);
  box-shadow: inset 0 1px 0 rgba(232, 231, 225, 0.12), 0 10px 24px -10px rgba(0, 0, 0, 0.8);
}
.dv-root .sa-btn.primary:hover {
  background: var(--sa-bg-4, #1b201d);
  border-color: var(--g-ink);
}
.dv-root .sa-input {
  border-radius: 999px;
  height: 36px;
  padding: 0 14px;
  background: var(--sa-bg, #090b0a);
  border-color: var(--g-line);
}
.dv-root .sa-input.pl { padding-left: 34px; }
.dv-root .sa-input.pr { padding-right: 42px; }
.dv-root textarea.sa-input {
  border-radius: 14px;
  padding: 12px 14px;
}

/* Numbers-only minimal stat strip */
.dv-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.dv-chip-stat {
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
  padding: 10px 18px;
  border-radius: 999px;
  background: var(--g-fill);
  border: 1px solid var(--g-line);
  box-shadow: inset 0 1px 0 rgba(232, 231, 225, 0.06);
}
.dv-chip-stat span {
  font: 400 10.5px/1 var(--sa-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--g-mute);
}
.dv-chip-stat b {
  font: 400 18px/1 var(--sa-mono);
  font-variant-numeric: tabular-nums;
  color: var(--g-ink);
}

.dv-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start; }
.dv-split > *, .dv-col, .dv-col > *, .dv-lines > * { min-width: 0; }
.dv-split > .sa-panel + .sa-panel, .dv-col > .sa-panel + .sa-panel { margin-top: 16px; }
.dv-split .sa-code.inline { display: flex; width: 100%; border-radius: 999px; }
.dv-split .sa-code.inline code { flex: 1; min-width: 0; }
.dv-sticky { position: sticky; top: 112px; }
@media (max-width: 1100px) { .dv-split { grid-template-columns: minmax(0, 1fr); } .dv-sticky { position: static; } }

/* Docs floating vertical pill dock */
.dv-docs { display: grid; grid-template-columns: 184px minmax(0, 1fr); gap: 28px; align-items: start; }
.dv-docs > *, .dv-docs .sa-panel-b > * { min-width: 0; }
.dv-docs-nav {
  position: sticky;
  top: 112px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 6px;
  border-radius: 20px;
  background: var(--g-fill);
  border: 1px solid var(--g-line);
  box-shadow: inset 0 1px 0 var(--g-rim);
}
.dv-doc-pill {
  position: relative;
  display: flex;
  align-items: center;
  height: 34px;
  padding: 0 13px;
  border-radius: 999px;
  font: 400 12.5px/1 var(--sa-f);
  color: var(--g-mute);
  text-decoration: none;
  transition: color 0.18s;
}
.dv-doc-pill:hover,
.dv-doc-pill.on {
  color: var(--g-ink);
}
.dv-doc-thumb {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: linear-gradient(180deg, var(--sa-bg-4, #1b201d), var(--sa-bg-3, #141816));
  border: 1px solid var(--g-rim);
  box-shadow: inset 0 1px 0 rgba(232, 231, 225, 0.08);
}
.dv-doc-lbl {
  position: relative;
  z-index: 1;
}
@media (max-width: 1100px) { .dv-docs { grid-template-columns: minmax(0, 1fr); gap: 16px; } .dv-docs-nav { display: none; } }

.dv-sec { scroll-margin-top: 116px; }
.dv-sec + .dv-sec { margin-top: 16px; }
.dv-m { min-width: 52px; justify-content: center; }
.dv-form { display: grid; gap: 12px; padding: 16px; }
.dv-form .g2 { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 10px; }
.dv-form .g2 > *, .dv-dl > * { min-width: 0; }
.dv-ta { height: auto; font-family: var(--sa-mono); font-size: 12.5px; line-height: 1.6; resize: vertical; }
.dv-send { display: flex; align-items: center; gap: 10px; }
.dv-send .sa-btn { flex: 1; }

.dv-ep { border-top: 1px solid var(--g-line); }
.dv-ep:first-child { border-top: 0; }
.dv-ep > summary { list-style: none; display: grid; grid-template-columns: 60px minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 12px 18px; cursor: pointer; transition: background 0.15s; }
.dv-ep > summary::-webkit-details-marker { display: none; }
.dv-ep > summary:hover, .dv-ep[open] > summary { background: var(--sa-bg-3, #141816); }
.dv-ep .path { font: 500 12.5px/1.3 var(--sa-mono); color: var(--g-ink); word-break: break-all; }
.dv-ep .sum { margin-top: 3px; font-size: 12px; line-height: 1.45; color: var(--g-mute); }
.dv-ep .scopes { display: flex; gap: 4px; align-items: center; }
.dv-ep .chev { color: var(--g-mute); transition: transform 0.35s var(--lq-spring); }
.dv-ep[open] .chev { transform: rotate(90deg); }
.dv-ep .body { display: grid; gap: 12px; padding: 8px 18px 18px; }
.dv-ep .acts { display: flex; gap: 6px; flex-wrap: wrap; }
@media (max-width: 720px) { .dv-ep > summary { grid-template-columns: 56px minmax(0, 1fr); } .dv-ep .scopes { display: none; } }

.dv-inline { padding: 2px 7px; border: 1px solid var(--g-line); border-radius: 999px; background: var(--sa-bg-3, #141816); font: 400 11.5px/1 var(--sa-mono); color: var(--g-ink); }
.dv-p { margin: 0; font-size: 13px; line-height: 1.6; color: var(--g-mute); }
.dv-lines { display: grid; gap: 6px; }
.dv-dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; padding: 16px; }
@media (max-width: 720px) { .dv-dl { grid-template-columns: 1fr; } }
.dv-dl a { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: 1px solid var(--g-line); border-radius: 14px; background: var(--sa-bg, #090b0a); text-decoration: none; transition: transform 0.45s var(--lq-jelly), background 0.18s, border-color 0.18s; }
.dv-dl a:hover { background: var(--sa-bg-4, #1b201d); border-color: var(--g-rim); transform: scale(1.015); }
.dv-dl a:active { transform: scale(0.97); }
.dv-dl b { display: block; font: 500 13px/1.3 var(--sa-f); }
.dv-dl small { display: block; margin-top: 2px; font-size: 11.5px; color: var(--g-mute); }
.dv-health { display: flex; align-items: center; gap: 8px; font: 400 11.5px/1 var(--sa-mono); color: var(--g-mute); }
${ PAGES_POLISH }
`;

const methodTone = (m: string) =>
  m === 'GET' ? 'info' : m === 'POST' ? 'ok' : m === 'PUT' ? 'warn' : m === 'DELETE' ? 'err' : 'neutral';

function MethodTag({ method }: { method: string }) {
  return <Pill tone={methodTone(method) as any}><span className="dv-m" style={{ display: 'inline-flex' }}>{method}</span></Pill>;
}

const statusTone = (code: string) => (code.startsWith('2') ? 'ok' : code.startsWith('5') ? 'err' : 'warn');

type Endpoint = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  scopes: string[];
  statusPath: string | null;
  example: string;
  sampleResponse?: string;
};

type EndpointHealth = {
  status: 'checking' | 'online' | 'offline';
  latency?: number;
};

const BASE_URL = 'https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cloudbliss-api';

const endpoints: Endpoint[] = [
  {
    method: 'POST',
    path: '/upload',
    description: 'Initialize upload — get signed B2 URLs + raw encryption key (simple, recommended)',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/upload \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"video.mp4","type":"video/mp4","size":10485760}'`,
    sampleResponse: `{
  "upload_id": "uuid",
  "file_id": "uuid",
  "encryption_key": "64_char_hex",
  "urls": [{"index":0,"upload_url":"https://...","path":"..."}],
  "chunk_size": 524288,
  "total_chunks": 20,
  "name": "video.mp4",
  "type": "video/mp4",
  "size": 10485760,
  "success": true
}`,
  },
  {
    method: 'POST',
    path: '/upload/complete',
    description: 'Complete upload — just send upload_id; server verifies chunks, re-encrypts them (RES54 v2, AES-256-GCM) and registers the file',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/upload/complete \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"upload_id":"uuid"}'`,
    sampleResponse: `{
  "success": true,
  "file": {
    "id": "uuid",
    "name": "video.mp4",
    "type": "video/mp4",
    "size": 10485760,
    "created_at": "2026-08-06T00:00:00.000Z"
  },
  "credits": {"deducted": 3, "remaining": 48, "used_today": 952, "daily_limit": 1000}
}`,
  },
  {
    method: 'POST',
    path: '/upload/encrypted',
    description: 'Upload plaintext chunks, server encrypts with RES54 and stores on B2',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/upload/encrypted \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"photo.jpg","type":"image/jpeg","size":524288,"chunks":[{"index":0,"upload_url":"..."}]}'`,
  },
  {
    method: 'GET',
    path: '/download/:id',
    description: 'Download file — auto-decrypts encrypted files, returns plaintext. Add ?signed=true to get B2 URLs + raw encryption key for client-side RES54 v2 decryption',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET ${BASE_URL}/download/FILE_ID -H "X-SquidCloud-Key: YOUR_API_KEY" -o file.pdf`,
    sampleResponse: `// GET /download/FILE_ID?signed=true
{
  "signed_urls": ["https://.../encrypted/FILE_ID/0.bin", "..."],
  "file_name": "video.mp4",
  "file_type": "video/mp4",
  "file_size": 10485760,
  "encryption_key": "64_char_hex",
  "success": true,
  "credits": {"deducted": 1, "remaining": 47, "used_today": 953, "daily_limit": 1000}
}`,
  },
  {
    method: 'GET',
    path: '/files',
    description: 'List all files and folders for the authenticated user (paginated, searchable)',
    scopes: ['read'],
    statusPath: '/files',
    example: `curl -X GET ${BASE_URL}/files?page=1&per_page=50 -H "X-SquidCloud-Key: YOUR_API_KEY"`,
    sampleResponse: `{
  "files": [...],
  "folders": [...],
  "total_files": 50,
  "total_folders": 2,
  "page": 1,
  "per_page": 50,
  "success": true
}`,
  },
  {
    method: 'GET',
    path: '/files/:id/metadata',
    description: 'Get metadata and encryption info for a file',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET ${BASE_URL}/files/FILE_ID/metadata -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'GET',
    path: '/files/:id/download',
    description: 'Download decrypted file. Optional ?signed=true returns direct B2 URLs.',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET ${BASE_URL}/files/FILE_ID/download -H "X-SquidCloud-Key: YOUR_API_KEY" -o downloaded-file.pdf`,
  },
  {
    method: 'POST',
    path: '/files/upload/init',
    description: 'Legacy: Initialize a chunked upload — get signed B2 URLs',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/files/upload/init \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"video.mp4","type":"video/mp4","size":10485760}'`,
  },
  {
    method: 'POST',
    path: '/files/upload/complete',
    description: 'Legacy: Complete a chunked upload — verify chunks and register file',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/files/upload/complete \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"upload_id":"uuid","file_id":"uuid","chunks":[{"index":0,"path":"...","sha256":"..."}]}'`,
  },
  {
    method: 'DELETE',
    path: '/files/:id',
    description: 'Soft delete a file (moves to trash)',
    scopes: ['delete'],
    statusPath: null,
    example: `curl -X DELETE ${BASE_URL}/files/FILE_ID -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'POST',
    path: '/files/:id/restore',
    description: 'Restore a soft-deleted file from trash',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/files/FILE_ID/restore \\
  -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'PUT',
    path: '/files/:id/rename',
    description: 'Rename a file',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X PUT ${BASE_URL}/files/FILE_ID/rename \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"new-name.pdf"}'`,
  },
  {
    method: 'POST',
    path: '/files/:id/move',
    description: 'Move a file to a different folder',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/files/FILE_ID/move \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"folder_id":"TARGET_FOLDER_ID"}'`,
  },
  {
    method: 'POST',
    path: '/files/copy',
    description: 'Copy a file within the same workspace',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/files/copy \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"file_id":"SOURCE_FILE_ID","new_name":"copy-name.pdf"}'`,
  },
  {
    method: 'POST',
    path: '/stream/init',
    description: 'Get a short-lived streaming session token for encrypted media playback',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/stream/init \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"file_id":"FILE_ID"}'`,
    sampleResponse: `{
  "token": "eyJmaWxl...",
  "stream_url": "/stream?id=FILE_ID&token=eyJmaWxl...",
  "expires_in": 120,
  "success": true
}`,
  },
  {
    method: 'GET',
    path: '/stream',
    description: 'Stream encrypted file via server-side decrypting proxy (Range requests, seeking)',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET "${BASE_URL}/stream?id=FILE_ID&token=STREAM_TOKEN" -o -`,
  },
  {
    method: 'GET',
    path: '/search',
    description: 'Search files by name, type, or metadata with pagination',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET "${BASE_URL}/search?q=document&type=image&page=1&per_page=20" -H "X-SquidCloud-Key: YOUR_API_KEY"`,
    sampleResponse: `{
  "files": [...],
  "folders": [...],
  "total": 10,
  "page": 1,
  "per_page": 20,
  "success": true
}`,
  },
  {
    method: 'POST',
    path: '/batch/delete',
    description: 'Batch delete multiple files by ID (max 100)',
    scopes: ['delete'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/batch/delete \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"file_ids":["ID1","ID2"]}'`,
    sampleResponse: `{
  "action": "delete",
  "results": [...],
  "succeeded": 2,
  "failed": 0,
  "success": true
}`,
  },
  {
    method: 'POST',
    path: '/batch/move',
    description: 'Batch move files to a different folder',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/batch/move \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"file_ids":["ID1","ID2"],"folder_id":"TARGET_FOLDER_ID"}'`,
    sampleResponse: `{
  "action": "move",
  "results": [...],
  "succeeded": 2,
  "failed": 0,
  "success": true
}`,
  },
  {
    method: 'POST',
    path: '/batch/restore',
    description: 'Batch restore multiple files from trash by ID',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/batch/restore \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"file_ids":["ID1","ID2"]}'`,
  },
  {
    method: 'POST',
    path: '/batch/copy',
    description: 'Batch copy files to a different folder',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/batch/copy \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"file_ids":["ID1","ID2"],"folder_id":"TARGET_FOLDER_ID"}'`,
  },
  {
    method: 'GET',
    path: '/stats/usage',
    description: 'Get daily/weekly/monthly credit usage statistics',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET ${BASE_URL}/stats/usage -H "X-SquidCloud-Key: YOUR_API_KEY"`,
    sampleResponse: `{
  "usage": {
    "today": {"credits_used": 42, "daily_limit": 1000},
    "this_week": {"credits_used": 210},
    "this_month": {"credits_used": 840},
    "total_requests_today": 42,
    "credits_remaining": 958
  },
  "success": true
}`,
  },
  {
    method: 'GET',
    path: '/stats/credits',
    description: 'Get detailed credit usage log with pagination',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET "${BASE_URL}/stats/credits?page=1&per_page=50" \\
  -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'GET',
    path: '/stats/storage',
    description: 'Get storage breakdown by file type and encryption status',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET ${BASE_URL}/stats/storage \\
  -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'GET',
    path: '/export/files',
    description: 'Export file metadata as CSV or JSON for backup',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET "${BASE_URL}/export/files?format=csv" -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'GET',
    path: '/keys',
    description: 'List API keys for the authenticated user',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET ${BASE_URL}/keys -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'POST',
    path: '/keys',
    description: 'Create a new API key with optional scopes and expiration',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/keys \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"My Key","scopes":["*"]}'`,
    sampleResponse: `{
  "key": {"id":"...","name":"My Key","key_prefix":"cb_..."},
  "raw_key": "cb_...",
  "message": "Save the raw key — it will not be shown again.",
  "success": true
}`,
  },
  {
    method: 'PUT',
    path: '/keys/:id',
    description: 'Update API key name, scopes, or active status',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X PUT ${BASE_URL}/keys/KEY_ID \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Updated Key","is_active":false}'`,
  },
  {
    method: 'DELETE',
    path: '/keys/:id',
    description: 'Permanently delete an API key',
    scopes: ['delete'],
    statusPath: null,
    example: `curl -X DELETE ${BASE_URL}/keys/KEY_ID \\
  -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'PUT',
    path: '/keys/:id/limits',
    description: 'Set per-key custom daily limit and rate limit',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X PUT ${BASE_URL}/keys/KEY_ID/limits \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"custom_daily_limit":5000,"custom_rate_limit_rps":100}'`,
  },
  {
    method: 'GET',
    path: '/storage',
    description: 'Get storage usage, file count, and total size',
    scopes: ['read'],
    statusPath: '/storage',
    example: `curl -X GET ${BASE_URL}/storage -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'GET',
    path: '/user',
    description: 'Get user profile with credit balance and storage usage',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET ${BASE_URL}/user \\
  -H "X-SquidCloud-Key: YOUR_API_KEY"`,
    sampleResponse: `{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "User Name",
  "storage_used": 1048576,
  "total_files": 42,
  "credits": {"remaining": 850, "used_today": 150, "daily_limit": 1000},
  "success": true
}`,
  },
  {
    method: 'GET',
    path: '/whoami',
    description: 'Alias for GET /user',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET ${BASE_URL}/whoami \\
  -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'GET',
    path: '/secrets',
    description: 'List all stored secrets (values not returned)',
    scopes: ['read'],
    statusPath: null,
    example: `curl -X GET ${BASE_URL}/secrets \\
  -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'POST',
    path: '/secrets',
    description: 'Create an encrypted secret stored in SquidVeil vault',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/secrets \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"db-password","value":"s3cret!","storage":"database"}'`,
    sampleResponse: `{
  "secret": {"id":"...","name":"db-password","storage_type":"database"},
  "success": true
}`,
  },
  {
    method: 'POST',
    path: '/secrets/:name/verify',
    description: 'Verify if a candidate value matches a stored secret',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/secrets/db-password/verify \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"value":"s3cret!"}'`,
    sampleResponse: `{
  "matched": true,
  "success": true
}`,
  },
  {
    method: 'PATCH',
    path: '/secrets/:id/rename',
    description: 'Rename a stored secret',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X PATCH ${BASE_URL}/secrets/SECRET_ID/rename \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"new-name"}'`,
  },
  {
    method: 'DELETE',
    path: '/secrets/:id',
    description: 'Permanently delete a secret',
    scopes: ['delete'],
    statusPath: null,
    example: `curl -X DELETE ${BASE_URL}/secrets/SECRET_ID \\
  -H "X-SquidCloud-Key: YOUR_API_KEY"`,
  },
  {
    method: 'POST',
    path: '/squidshake/handshake',
    description: 'Initiate a SquidShake handshake for ephemeral session',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/squidshake/handshake \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"device_fingerprint":"device-id","project_id":"my-app"}'`,
  },
  {
    method: 'POST',
    path: '/squidshake/ref',
    description: 'Issue a VeilRef for a secret within an active session',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/squidshake/ref \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"session_id":"...","secret_name":"db-password","device_fingerprint":"..."}'`,
  },
  {
    method: 'POST',
    path: '/squidshake/audit',
    description: 'Log an audit entry for a SquidShake action',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/squidshake/audit \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"resolve","project_id":"my-app","secret_name":"db-password","success":true}'`,
  },
  {
    method: 'POST',
    path: '/veilref/verify',
    description: 'Verify a VeilRef is valid and not expired',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/veilref/verify \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"veil_ref_json":"..."}'`,
  },
  {
    method: 'POST',
    path: '/veilref/resolve',
    description: 'Resolve a VeilRef to retrieve the underlying secret value',
    scopes: ['write'],
    statusPath: null,
    example: `curl -X POST ${BASE_URL}/veilref/resolve \\
  -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"veil_ref_json":"..."}'`,
  },
  {
    method: 'GET',
    path: '/health',
    description: 'Health check endpoint returning server status and version (no auth required)',
    scopes: ['read'],
    statusPath: '/health',
    example: `curl -X GET ${BASE_URL}/health`,
    sampleResponse: `{
  "status": "ok",
  "version": "4.0",
  "timestamp": "...",
  "db": "connected",
  "uptime": 12345,
  "success": true
}`,
  },
];

const DeveloperAPI = () => {
  const isMobile = useIsMobile();
  const reduce = !!useReducedMotion();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useHashState<TabId>('tab', 'overview', TAB_IDS);
  const [endpointStatus, setEndpointStatus] = useState<Record<string, EndpointHealth>>({});
  const [activeDoc, setActiveDoc] = useState<string>('dv-auth');

  useEffect(() => {
    if (activeTab !== 'docs') return;
    const ids = ['dv-auth', 'dv-agent', 'dv-endpoints', 'dv-costs', 'dv-credits', 'dv-codes', 'dv-downloads'];
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (!visible.length) return;
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        setActiveDoc(visible[0].target.id);
      },
      { rootMargin: '-120px 0px -70% 0px' },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [activeTab]);

  const [playgroundMethod, setPlaygroundMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'>('GET');
  const [playgroundEndpoint, setPlaygroundEndpoint] = useState('/files');
  const [playgroundApiKey, setPlaygroundApiKey] = useState('');
  const [playgroundEncryptionKey, setPlaygroundEncryptionKey] = useState('');
  const [playgroundBody, setPlaygroundBody] = useState('');
  const [playgroundResponse, setPlaygroundResponse] = useState('');
  const [playgroundLoading, setPlaygroundLoading] = useState(false);

  const [creditInfo, setCreditInfo] = useState<{ used: number; daily_limit: number; remaining: number } | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [operationCosts, setOperationCosts] = useState<any[]>([]);
  const [costFilter, setCostFilter] = useState('');
  const [costsOpen, setCostsOpen] = useState(false);

  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [customLimits, setCustomLimits] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [configKey, setConfigKey] = useState<any>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configForm, setConfigForm] = useState<Record<string, any>>({});
  const [savingConfig, setSavingConfig] = useState(false);

  const [accountCredits, setAccountCredits] = useState<any>(null);
  const [accountWeeklyLog, setAccountWeeklyLog] = useState<any>(null);
  const [accountMonthlyLog, setAccountMonthlyLog] = useState<any>(null);
  const [accountRequestCount, setAccountRequestCount] = useState(0);
  const [statusLoading, setStatusLoading] = useState(false);
  const [resetCountdown, setResetCountdown] = useState('');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: 'Code copied to clipboard' });
  };

  useEffect(() => {
    let isMounted = true;

    const checkEndpointStatus = async () => {
      const targets = endpoints.filter((e) => e.statusPath);

      for (const endpoint of targets) {
        if (!endpoint.statusPath) continue;
        const key = endpoint.path;

        if (!isMounted) return;
        setEndpointStatus((prev) => ({ ...prev, [key]: { status: 'checking' } }));

        try {
          const start = performance.now();
          const response = await fetch(`${BASE_URL}${endpoint.statusPath}`, {
            method: 'HEAD',
            headers: {
              'X-SquidCloud-Key': 'status-check',
            },
          });
          const latency = Math.round(performance.now() - start);

          if (!isMounted) return;
          if (response.status === 200 || response.status === 401) {
            setEndpointStatus((prev) => ({ ...prev, [key]: { status: 'online', latency } }));
          } else {
            setEndpointStatus((prev) => ({ ...prev, [key]: { status: 'offline' } }));
          }
        } catch (_error) {
          if (!isMounted) return;
          setEndpointStatus((prev) => ({ ...prev, [key]: { status: 'offline' } }));
        }
      }
    };

    checkEndpointStatus();
    const interval = setInterval(checkEndpointStatus, 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchUserAndCredits = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMounted) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('tier')
        .eq('id', user.id)
        .single();

      if (!isMounted) return;
      if (profileData) setProfile(profileData);

      setLoadingCredits(true);
      try {
        const apiKey = user.email || '';
        const [userRes] = await Promise.allSettled([
          fetch(`${BASE_URL}/user`, { headers: { 'X-SquidCloud-Key': apiKey } }),
          fetch(`${BASE_URL}/stats/usage`, { headers: { 'X-SquidCloud-Key': apiKey } }),
        ]);

        if (userRes.status === 'fulfilled' && userRes.value.ok) {
          const data = await userRes.value.json();
          if (isMounted && data.credits) {
            setCreditInfo(data.credits);
          }
        }
      } catch {
      } finally {
        if (isMounted) setLoadingCredits(false);
      }

      const { data: keysData } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', user.id);
      if (!isMounted) return;
      if (keysData) {
        setApiKeys(keysData);
        const limits: Record<string, string> = {};
        keysData.forEach((k) => { limits[k.id] = String(k.custom_daily_limit ?? ''); });
        setCustomLimits(limits);
      }
    };

    fetchUserAndCredits();
    fetchAccountData();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchCosts = async () => {
      const { data } = await supabase
        .from('api_operation_costs')
        .select('*')
        .order('operation');
      if (!isMounted) return;
      if (data) setOperationCosts(data);
    };

    fetchCosts();
    return () => { isMounted = false; };
  }, []);

  const testEndpoint = async () => {
    if (!playgroundEndpoint.trim() || !playgroundApiKey.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please provide endpoint path and API key',
        variant: 'destructive',
      });
      return;
    }

    setPlaygroundLoading(true);
    setPlaygroundResponse('');

    try {
      const headers: Record<string, string> = {
        'X-SquidCloud-Key': playgroundApiKey.trim(),
      };

      if (playgroundEncryptionKey.trim()) {
        headers['X-SquidCloud-Encryption-Key'] = playgroundEncryptionKey.trim();
      }

      const options: RequestInit = {
        method: playgroundMethod,
        headers,
      };

      if (playgroundMethod !== 'GET') {
        headers['Content-Type'] = 'application/json';
        if (playgroundBody.trim()) {
          options.body = playgroundBody;
        }
      }

      const start = performance.now();
      const response = await fetch(`${BASE_URL}${playgroundEndpoint}`, options);
      const latency = Math.round(performance.now() - start);

      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await response.json()
        : await response.text();

      const formatted = {
        status: response.status,
        statusText: response.statusText,
        latency: `${latency}ms`,
        headers: Object.fromEntries(response.headers.entries()),
        body: payload,
      };

      setPlaygroundResponse(JSON.stringify(formatted, null, 2));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setPlaygroundResponse(JSON.stringify({ error: message }, null, 2));
      toast({
        title: 'Request Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setPlaygroundLoading(false);
    }
  };

  const fetchAccountData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setStatusLoading(true);
    try {
      const [creditsRes, weekRes, monthRes, reqsRes] = await Promise.all([
        supabase.from('api_credits').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('api_credit_log').select('credits_deducted').gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()).eq('user_id', user.id),
        supabase.from('api_credit_log').select('credits_deducted').gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()).eq('user_id', user.id),
        supabase.from('api_request_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', new Date().toISOString().slice(0, 10)),
      ]);
      if (creditsRes.data) setAccountCredits(creditsRes.data);
      if (weekRes.data) setAccountWeeklyLog(weekRes.data.reduce((s: number, r: any) => s + (r.credits_deducted || 0), 0));
      if (monthRes.data) setAccountMonthlyLog(monthRes.data.reduce((s: number, r: any) => s + (r.credits_deducted || 0), 0));
      setAccountRequestCount(reqsRes.count || 0);
    } catch {} finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    const calcCountdown = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setUTCHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setResetCountdown(`${h}h ${m}m ${s}s`);
    };
    calcCountdown();
    const interval = setInterval(calcCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const [endpointFilter, setEndpointFilter] = useState('');
  const filterRef = useRef<HTMLInputElement>(null);
  useSearchShortcut(filterRef);
  useDocTitle('Developer API');

  if (isMobile) {
    return (
      <>
        <AppTheme />
        <DeveloperAPIMobile />
      </>
    );
  }

  let respStatus: number | null = null;
  let respLatency = '';
  try {
    const r = JSON.parse(playgroundResponse);
    if (typeof r?.status === 'number') {
      respStatus = r.status;
      respLatency = r.latency || '';
    }
  } catch {}

  const q = endpointFilter.trim().toLowerCase();
  const shownEndpoints = endpoints.filter(
    (e) => !q || e.path.toLowerCase().includes(q) || e.method.toLowerCase().includes(q) || e.description.toLowerCase().includes(q),
  );
  const healthTargets = endpoints.filter((e) => e.statusPath);
  const onlineCount = healthTargets.filter((e) => endpointStatus[e.path]?.status === 'online').length;
  const stillChecking = healthTargets.some((e) => !endpointStatus[e.path] || endpointStatus[e.path].status === 'checking');

  const calm = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });

  const DOC_SECTIONS = [
    ['dv-auth', 'Authentication'],
    ['dv-agent', 'AI Agent Prompt'],
    ['dv-endpoints', 'Endpoints'],
    ['dv-costs', 'Credit Costs'],
    ['dv-credits', 'Credits'],
    ['dv-codes', 'Status Codes'],
    ['dv-downloads', 'Downloads'],
  ] as const;

  const TABS: Array<{ id: TabId; label: string; count?: number }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'keys', label: 'Keys', count: apiKeys.length || undefined },
    { id: 'playground', label: 'Playground' },
    { id: 'status', label: 'Status' },
    { id: 'docs', label: 'Docs' },
  ];

  const keyLabel = (key: any) => key.name || key.key_prefix || key.key?.substring(0, 12);
  const thumbSpring = reduce ? { duration: 0.01 } : { type: 'spring' as const, stiffness: 380, damping: 21, mass: 0.8 };
  const pageSpring = reduce ? { duration: 0.01 } : { type: 'spring' as const, stiffness: 330, damping: 26, mass: 0.9 };

  return (
    <AppShell>
      <style>{DV_CSS}</style>
      <MobileScrollToTop />

      <div className="dv-root">
        <TopBar crumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'API' }]}>
          <span className="hide-sm"><Pill>v4.0</Pill></span>
        </TopBar>

        <div className="dv-dock-wrap">
          <div className="dv-dock" role="tablist" aria-label="Developer API sections">
            {TABS.map((t) => {
              const on = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className="dv-dock-btn"
                  onClick={() => setActiveTab(t.id)}
                >
                  {on && <motion.span layoutId="dv-dock-thumb" className="dv-dock-thumb" transition={thumbSpring} />}
                  <span className="dv-dock-lbl">
                    {t.label}
                    {t.count !== undefined && <span className="dv-dock-cnt">{t.count}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <Wrap>
          <AnimatePresence mode="wait" initial={false}>
            {/* ═════════ Overview ═════════ */}
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.99 }}
                transition={pageSpring}
              >
                <div className="dv-strip">
                  <div className="dv-chip-stat"><span>Endpoints</span><b>{endpoints.length}</b></div>
                  <div className="dv-chip-stat"><span>Uptime</span><b>99.9%</b></div>
                  <div className="dv-chip-stat"><span>Latency</span><b>&lt;100ms</b></div>
                  {creditInfo && (
                    <div className="dv-chip-stat">
                      <span>Credits left</span>
                      <b>{creditInfo.remaining}</b>
                    </div>
                  )}
                </div>

                <div className="dv-split">
                  <div className="dv-col">
                    <Panel
                      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Code className="h-3.5 w-3.5" /> Base &amp; Quick Start</span>}
                    >
                      <div style={{ display: 'grid', gap: 16 }}>
                        <div>
                          <div className="sa-label">Endpoint</div>
                          <CopyLine value={BASE_URL} />
                        </div>
                        <div>
                          <div className="sa-label">cURL</div>
                          <CodeBlock
                            lang="bash"
                            code={`curl -H "X-SquidCloud-Key: YOUR_API_KEY" \\
  -H "X-SquidCloud-Encryption-Key: OPTIONAL_USER_KEY" \\
  ${BASE_URL}/files`}
                            copyText={`curl -H "X-SquidCloud-Key: YOUR_API_KEY" -H "X-SquidCloud-Encryption-Key: OPTIONAL_USER_KEY" ${BASE_URL}/files`}
                            wrap
                          />
                        </div>
                      </div>
                    </Panel>
                  </div>

                  <div className="dv-col">
                    <Panel
                      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Activity className="h-3.5 w-3.5" /> Daily Quota</span>}
                      actions={loadingCredits ? <Spinner /> : undefined}
                    >
                      {creditInfo ? (
                        <div style={{ display: 'grid', gap: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }} className="sa-num">
                            <span>{creditInfo.used} / {creditInfo.daily_limit}</span>
                            <span className="sa-mute">{creditInfo.remaining} left</span>
                          </div>
                          <Meter value={creditInfo.used} max={creditInfo.daily_limit} label="Credits used today" />
                        </div>
                      ) : loadingCredits ? (
                        <SkelRows rows={1} />
                      ) : (
                        <p className="dv-p">Sign in to view quota</p>
                      )}
                    </Panel>

                    {apiKeys.length > 0 && (
                      <Panel
                        title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Sliders className="h-3.5 w-3.5" /> Key Limits</span>}
                        flush
                      >
                        {apiKeys.map((key) => (
                          <Row
                            key={key.id}
                            label={
                              <span title={String(keyLabel(key))} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0, maxWidth: '100%' }}>
                                <Key className="h-3.5 w-3.5 sa-mute" style={{ flex: 'none' }} />
                                <code className="sa-mono" style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, maxWidth: 220 }}>
                                  {keyLabel(key)}
                                </code>
                              </span>
                            }
                          >
                            <Dialog
                              open={configDialogOpen && configKey?.id === key.id}
                              onOpenChange={(open) => {
                                setConfigDialogOpen(open);
                                if (open) {
                                  setConfigKey(key);
                                  setConfigForm({
                                    custom_daily_limit: String(key.custom_daily_limit ?? ''),
                                    custom_rate_limit_rps: String(key.custom_rate_limit_rps ?? ''),
                                    allow_hmac: key.allow_hmac ?? false,
                                    is_disabled: key.is_disabled ?? false,
                                  });
                                }
                              }}
                            >
                              <DialogTrigger asChild>
                                <button
                                  type="button"
                                  className={btn('default', 'sm')}
                                  onClick={() => {
                                    setConfigKey(key);
                                    setConfigForm({
                                      custom_daily_limit: String(key.custom_daily_limit ?? ''),
                                      custom_rate_limit_rps: String(key.custom_rate_limit_rps ?? ''),
                                      allow_hmac: key.allow_hmac ?? false,
                                      is_disabled: key.is_disabled ?? false,
                                    });
                                  }}
                                >
                                  <Settings2 className="h-3 w-3" />
                                  Limits
                                </button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Key Configuration</DialogTitle>
                                  <DialogDescription>
                                    Limits for <code className="dv-inline">{key.name || key.key_prefix}</code>
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-2">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                      <Label className="text-xs text-muted-foreground">Daily Credit Limit</Label>
                                      <Input
                                        className="h-9 text-sm"
                                        type="number"
                                        min="0"
                                        placeholder="Default"
                                        value={configForm.custom_daily_limit}
                                        onChange={(e) => setConfigForm((p) => ({ ...p, custom_daily_limit: e.target.value }))}
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label className="text-xs text-muted-foreground">Rate Limit (req/s)</Label>
                                      <Input
                                        className="h-9 text-sm"
                                        type="number"
                                        min="0"
                                        placeholder="Default"
                                        value={configForm.custom_rate_limit_rps}
                                        onChange={(e) => setConfigForm((p) => ({ ...p, custom_rate_limit_rps: e.target.value }))}
                                      />
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between h-10 px-3 rounded-md border border-border">
                                    <Label className="text-sm">Require HMAC Signing</Label>
                                    <Switch
                                      checked={configForm.allow_hmac}
                                      onCheckedChange={(v) => setConfigForm((p) => ({ ...p, allow_hmac: v }))}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between h-10 px-3 rounded-md border border-border">
                                    <Label className="text-sm">Disable Key</Label>
                                    <Switch
                                      checked={configForm.is_disabled}
                                      onCheckedChange={(v) => setConfigForm((p) => ({ ...p, is_disabled: v }))}
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <button type="button" className={btn()} onClick={() => setConfigDialogOpen(false)}>
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    className={btn('primary')}
                                    disabled={savingConfig}
                                    onClick={async () => {
                                      setSavingConfig(true);
                                      try {
                                        const body: Record<string, any> = {};
                                        if (configForm.custom_daily_limit) body.custom_daily_limit = parseInt(configForm.custom_daily_limit) || 0;
                                        if (configForm.custom_rate_limit_rps) body.custom_rate_limit_rps = parseInt(configForm.custom_rate_limit_rps) || 0;
                                        body.allow_hmac = !!configForm.allow_hmac;
                                        body.is_disabled = !!configForm.is_disabled;

                                        await supabase
                                          .from('api_key_limits')
                                          .upsert({
                                            api_key_id: configKey.id,
                                            custom_daily_limit: body.custom_daily_limit || null,
                                            custom_rate_limit_rps: body.custom_rate_limit_rps || null,
                                            is_disabled: body.is_disabled,
                                          });

                                        if (configKey.allow_hmac !== body.allow_hmac) {
                                          await supabase
                                            .from('api_keys')
                                            .update({ allow_hmac: body.allow_hmac })
                                            .eq('id', configKey.id);
                                        }

                                        setConfigDialogOpen(false);
                                        sonnerToast.success('Key configuration saved');
                                      } catch {
                                        sonnerToast.error('Failed to save configuration');
                                      } finally {
                                        setSavingConfig(false);
                                      }
                                    }}
                                  >
                                    {savingConfig ? <Spinner size={12} /> : 'Save'}
                                  </button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </Row>
                        ))}
                      </Panel>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ═════════ API keys ═════════ */}
            {activeTab === 'keys' && (
              <motion.div
                key="keys"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.99 }}
                transition={pageSpring}
              >
                <ApiKeyManagement />
              </motion.div>
            )}

            {/* ═════════ Playground ═════════ */}
            {activeTab === 'playground' && (
              <motion.div
                key="playground"
                className="dv-split"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.99 }}
                transition={pageSpring}
              >
                <div
                  className="dv-col"
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !playgroundLoading) {
                      e.preventDefault();
                      testEndpoint();
                    }
                  }}
                >
                  <Panel
                    title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Play className="h-3.5 w-3.5" /> Request</span>}
                    flush
                  >
                    <div className="dv-form">
                      <div className="g2">
                        <div>
                          <label className="sa-label">Method</label>
                          <Select value={playgroundMethod} onValueChange={(value) => setPlaygroundMethod(value as typeof playgroundMethod)}>
                            <SelectTrigger className="h-9 rounded-full text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="GET" className="text-xs">GET</SelectItem>
                              <SelectItem value="POST" className="text-xs">POST</SelectItem>
                              <SelectItem value="PUT" className="text-xs">PUT</SelectItem>
                              <SelectItem value="PATCH" className="text-xs">PATCH</SelectItem>
                              <SelectItem value="DELETE" className="text-xs">DELETE</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="sa-label" htmlFor="pg-path">Path</label>
                          <input id="pg-path" className="sa-input sa-mono" value={playgroundEndpoint} onChange={(e) => setPlaygroundEndpoint(e.target.value)} placeholder="/files" spellCheck={false} autoComplete="off" />
                        </div>
                      </div>
                      <div>
                        <label className="sa-label" htmlFor="pg-key">API Key</label>
                        <input id="pg-key" className="sa-input sa-mono" type="password" value={playgroundApiKey} onChange={(e) => setPlaygroundApiKey(e.target.value)} placeholder="cb_your_api_key" autoComplete="off" spellCheck={false} />
                      </div>
                      <div>
                        <label className="sa-label" htmlFor="pg-enc">Encryption Key <span className="sa-mute" style={{ fontWeight: 400 }}>(optional)</span></label>
                        <input id="pg-enc" className="sa-input sa-mono" type="password" value={playgroundEncryptionKey} onChange={(e) => setPlaygroundEncryptionKey(e.target.value)} placeholder="User encryption key" autoComplete="off" spellCheck={false} />
                      </div>
                      {playgroundMethod !== 'GET' && (
                        <div>
                          <label className="sa-label" htmlFor="pg-body">JSON Body</label>
                          <textarea id="pg-body" className="sa-input dv-ta" rows={5} value={playgroundBody} onChange={(e) => setPlaygroundBody(e.target.value)} placeholder='{"key":"value"}' spellCheck={false} />
                        </div>
                      )}
                      <div className="dv-send">
                        <button type="button" onClick={testEndpoint} disabled={playgroundLoading} className={btn('primary', 'lg')}>
                          {playgroundLoading ? <><Spinner /> Sending…</> : <><Play className="h-3.5 w-3.5" /> Send</>}
                        </button>
                        <span className="hide-sm" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }} aria-hidden="true"><Kbd>⌘</Kbd><Kbd>↵</Kbd></span>
                      </div>
                    </div>
                  </Panel>
                </div>

                <div className="dv-col dv-sticky">
                  <Panel
                    title="Response"
                    actions={
                      respStatus !== null ? (
                        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                          <Pill tone={statusTone(String(respStatus)) as any}>{respStatus}</Pill>
                          <span className="sa-num sa-mute" style={{ fontSize: 12 }}>{respLatency}</span>
                        </span>
                      ) : undefined
                    }
                    flush={!!playgroundResponse}
                  >
                    {playgroundResponse ? (
                      <CodeBlock code={playgroundResponse} lang="json" maxHeight={560} />
                    ) : (
                      <p className="dv-p">Run a request to inspect output.</p>
                    )}
                  </Panel>
                </div>
              </motion.div>
            )}

            {/* ═════════ Status ═════════ */}
            {activeTab === 'status' && (
              <motion.div
                key="status"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.99 }}
                transition={pageSpring}
              >
                {accountCredits ? (
                  <>
                    <div className="dv-strip">
                      <div className="dv-chip-stat"><span>Used today</span><b>{accountCredits.credits_used_today}</b></div>
                      <div className="dv-chip-stat"><span>Remaining</span><b>{accountCredits.credits_remaining < 0 ? '∞' : accountCredits.credits_remaining}</b></div>
                      <div className="dv-chip-stat"><span>Limit</span><b>{accountCredits.daily_limit < 0 ? '∞' : accountCredits.daily_limit}</b></div>
                      <div className="dv-chip-stat"><span>Requests</span><b>{accountRequestCount}</b></div>
                      <div className="dv-chip-stat"><span>7d</span><b>{accountWeeklyLog ?? '-'}</b></div>
                      <div className="dv-chip-stat"><span>30d</span><b>{accountMonthlyLog ?? '-'}</b></div>
                      <div className="dv-chip-stat"><span>Reset</span><b>{resetCountdown}</b></div>
                    </div>

                    {accountCredits.daily_limit > 0 && (
                      <Panel
                        title="Quota Usage"
                        actions={
                          <button type="button" onClick={fetchAccountData} disabled={statusLoading} className={btn('default', 'sm')}>
                            {statusLoading ? <Spinner size={12} /> : <Activity className="h-3 w-3" />}
                            Refresh
                          </button>
                        }
                      >
                        <Meter value={accountCredits.credits_used_today} max={accountCredits.daily_limit} label="Credits used today" />
                      </Panel>
                    )}
                  </>
                ) : statusLoading ? (
                  <Panel><SkelRows rows={2} /></Panel>
                ) : (
                  <Panel><Empty icon={<Activity className="h-4 w-4" />} title="No credit data" /></Panel>
                )}

                <div className="dv-split" style={{ marginTop: 16 }}>
                  <Panel
                    title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Key className="h-3.5 w-3.5" /> Active Keys</span>}
                    flush
                  >
                    {apiKeys.length > 0 ? apiKeys.map((key) => {
                      const limit = key.custom_daily_limit || key.daily_limit;
                      return (
                        <Row
                          key={key.id}
                          label={
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                              <code className="sa-mono" style={{ fontSize: 12.5 }}>{key.name || key.key_prefix}</code>
                              {!key.is_active && <Pill tone="err">Disabled</Pill>}
                            </span>
                          }
                        >
                          <span className="sa-num sa-mute" style={{ fontSize: 12 }}>
                            {limit ? `${limit}/day` : 'Unlimited'} · {key.allow_hmac ? 'HMAC' : 'Standard'}
                          </span>
                        </Row>
                      );
                    }) : (
                      <Empty icon={<Key className="h-4 w-4" />} title="No keys" />
                    )}
                  </Panel>

                  <Panel
                    title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Activity className="h-3.5 w-3.5" /> Health</span>}
                    actions={
                      <span className="dv-health">
                        {stillChecking ? <Spinner size={11} /> : <Dot tone={onlineCount === healthTargets.length ? 'ok' : 'warn'} />}
                        {onlineCount}/{healthTargets.length}
                      </span>
                    }
                    flush
                  >
                    {healthTargets.map((endpoint) => {
                      const status = endpointStatus[endpoint.path];
                      return (
                        <Row
                          key={endpoint.path}
                          label={
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                              <MethodTag method={endpoint.method} />
                              <code className="sa-mono" style={{ fontSize: 12.5 }}>{endpoint.path}</code>
                            </span>
                          }
                        >
                          <span className="dv-health">
                            {status?.status === 'online' && <><Dot tone="ok" /><span style={{ color: 'var(--sa-ok)' }}>{status.latency ? `${status.latency}ms` : 'Online'}</span></>}
                            {status?.status === 'offline' && <><Dot tone="err" /><span style={{ color: 'var(--sa-err)' }}>Offline</span></>}
                            {(!status || status.status === 'checking') && <><Spinner size={11} /><span>Checking</span></>}
                          </span>
                        </Row>
                      );
                    })}
                  </Panel>
                </div>

                <div style={{ marginTop: 16 }}><ApiUsageChart /></div>
                <div style={{ marginTop: 16 }}><ApiRequestLogs /></div>
              </motion.div>
            )}

            {/* ═════════ Docs ═════════ */}
            {activeTab === 'docs' && (
              <motion.div
                key="docs"
                className="dv-docs"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.99 }}
                transition={pageSpring}
              >
                <nav className="dv-docs-nav" aria-label="On this page">
                  {DOC_SECTIONS.map(([id, label]) => {
                    const on = activeDoc === id;
                    return (
                      <a
                        key={id}
                        href={`#${id}`}
                        className={`dv-doc-pill${on ? ' on' : ''}`}
                        aria-current={on ? 'true' : undefined}
                        onClick={(e) => { e.preventDefault(); setActiveDoc(id); jump(id); }}
                      >
                        {on && <motion.span layoutId="dv-doc-thumb" className="dv-doc-thumb" transition={thumbSpring} />}
                        <span className="dv-doc-lbl">{label}</span>
                      </a>
                    );
                  })}
                </nav>

                <div style={{ minWidth: 0 }}>
                  <section id="dv-auth" className="dv-sec">
                    <Panel title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Key className="h-3.5 w-3.5" /> Authentication</span>}>
                      <div style={{ display: 'grid', gap: 12 }}>
                        <div className="dv-lines">
                          <CopyLine value="X-SquidCloud-Key: cb_your_api_key_here" />
                          <CopyLine value="Authorization: Bearer cb_your_api_key_here" display="Authorization: Bearer cb_your_api_key_here" />
                          <CopyLine value="X-SquidCloud-Encryption-Key: optional_user_encryption_key" />
                          <CopyLine value="X-Timestamp: 1700000000000" display="X-Timestamp: 1700000000000 (±5 min)" />
                          <CopyLine value="X-Signature: HMAC-SHA256(timestamp+nonce+body, apiKey)" />
                        </div>
                        <Note tone="warn">
                          Invalid key format returns 400; mismatched encryption key returns 422.
                        </Note>
                      </div>
                    </Panel>
                  </section>

                  <section id="dv-agent" className="dv-sec">
                    <Panel
                      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Code className="h-3.5 w-3.5" /> AI Agent Prompt</span>}
                      actions={
                        <button type="button" onClick={() => copyToClipboard(AI_AGENT_PROMPT)} className={btn('primary', 'sm')}>
                          <Ico.Copy size={12} /> Copy Prompt
                        </button>
                      }
                    >
                      <textarea
                        readOnly
                        rows={8}
                        value={AI_AGENT_PROMPT}
                        onFocus={(e) => e.currentTarget.select()}
                        className="sa-input dv-ta"
                        aria-label="AI agent prompt"
                      />
                    </Panel>
                  </section>

                  <section id="dv-endpoints" className="dv-sec">
                    <Panel
                      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><FileText className="h-3.5 w-3.5" /> Endpoints ({shownEndpoints.length})</span>}
                      actions={
                        <div className="sa-field-wrap" style={{ width: 220 }}>
                          <Ico.Search size={13} />
                          <input
                            ref={filterRef}
                            className={`sa-input pl${endpointFilter ? '' : ' pr'}`}
                            style={{ height: 32 }}
                            placeholder="Filter…"
                            value={endpointFilter}
                            onChange={(e) => setEndpointFilter(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Escape') { setEndpointFilter(''); e.currentTarget.blur(); } }}
                            aria-label="Filter endpoints"
                            spellCheck={false}
                          />
                          {!endpointFilter && <span className="end" aria-hidden="true"><Kbd>/</Kbd></span>}
                        </div>
                      }
                      flush
                    >
                      {shownEndpoints.length === 0 && <Empty title="No matching endpoints" />}
                      {shownEndpoints.map((endpoint) => (
                        <details key={`${endpoint.method}-${endpoint.path}`} className="dv-ep">
                          <summary>
                            <MethodTag method={endpoint.method} />
                            <div style={{ minWidth: 0 }}>
                              <div className="path">{endpoint.path}</div>
                              <div className="sum">{endpoint.description}</div>
                            </div>
                            <div className="scopes">
                              {endpoint.scopes.map((scope) => (
                                <Pill key={scope}>{scope}</Pill>
                              ))}
                              <Ico.Chevron className="chev" />
                            </div>
                          </summary>
                          <div className="body">
                            <CodeBlock code={endpoint.example} lang="curl" wrap />
                            {endpoint.sampleResponse && <CodeBlock code={endpoint.sampleResponse} lang="response" />}
                            <div className="acts">
                              <button
                                type="button"
                                className={btn('default', 'sm')}
                                onClick={() => {
                                  setPlaygroundMethod(endpoint.method);
                                  setPlaygroundEndpoint(endpoint.path.replace(':id', 'FILE_ID'));
                                  setActiveTab('playground');
                                }}
                              >
                                <Play className="h-3 w-3" />
                                Open in Playground
                              </button>
                            </div>
                          </div>
                        </details>
                      ))}
                    </Panel>
                  </section>

                  <section id="dv-costs" className="dv-sec">
                    <Panel
                      title="Credit Costs"
                      actions={
                        <button type="button" onClick={() => setCostsOpen(!costsOpen)} className={btn('default', 'sm')} aria-expanded={costsOpen}>
                          {costsOpen ? 'Hide' : 'Show'}
                        </button>
                      }
                      flush
                    >
                      {costsOpen && (
                        <div>
                          <div style={{ padding: 14, borderBottom: '1px solid var(--g-line)' }}>
                            <input
                              className="sa-input"
                              placeholder="Filter operations…"
                              value={costFilter}
                              onChange={(e) => setCostFilter(e.target.value)}
                              aria-label="Filter operations"
                            />
                          </div>
                          <div className="sa-tablewrap">
                            <table className="sa-table">
                              <thead>
                                <tr>
                                  <th>Operation</th>
                                  <th>Base</th>
                                  <th>Per MB</th>
                                  <th>Description</th>
                                </tr>
                              </thead>
                              <tbody>
                                {operationCosts
                                  .filter((c) => !costFilter || c.operation.toLowerCase().includes(costFilter.toLowerCase()))
                                  .map((cost) => (
                                    <tr key={cost.id || cost.operation}>
                                      <td className="k sa-mono">{cost.operation}</td>
                                      <td className="sa-num">{cost.base_cost}</td>
                                      <td className="sa-num">{cost.per_mb ?? '-'}</td>
                                      <td>{cost.description || '-'}</td>
                                    </tr>
                                  ))}
                                {operationCosts.length === 0 && (
                                  <tr>
                                    <td colSpan={4} style={{ textAlign: 'center' }} className="sa-mute">No cost data</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </Panel>
                  </section>

                  <section id="dv-credits" className="dv-sec">
                    <Panel title="Credit Envelope">
                      <CodeBlock
                        lang="response"
                        code={`{
  "credits": {
    "deducted": 1,
    "remaining": 842,
    "used_today": 158,
    "daily_limit": 1000
  }
}`}
                      />
                    </Panel>
                  </section>

                  <section id="dv-codes" className="dv-sec">
                    <Panel title="Status Codes" flush>
                      {[
                        { code: '200 OK', desc: 'Request succeeded' },
                        { code: '201 Created', desc: 'Resource created' },
                        { code: '400 Bad Request', desc: 'Invalid input or key format' },
                        { code: '401 Unauthorized', desc: 'Missing or invalid API key' },
                        { code: '402 Payment Required', desc: 'Insufficient credits' },
                        { code: '403 Forbidden', desc: 'Key disabled or missing scope' },
                        { code: '404 Not Found', desc: 'Resource not found' },
                        { code: '409 Conflict', desc: 'Duplicate resource' },
                        { code: '422 Unprocessable Entity', desc: 'Encryption key mismatch' },
                        { code: '503 Service Unavailable', desc: 'Maintenance' },
                        { code: '500 Server Error', desc: 'Internal server error' },
                      ].map((item) => (
                        <Row
                          key={item.code}
                          label={
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                              <Dot tone={statusTone(item.code) as any} />
                              <code className="sa-mono" style={{ fontSize: 12.5 }}>{item.code}</code>
                            </span>
                          }
                        >
                          <span className="sa-mute" style={{ fontSize: 12.5 }}>{item.desc}</span>
                        </Row>
                      ))}
                    </Panel>
                  </section>

                  <section id="dv-downloads" className="dv-sec">
                    <Panel
                      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><FileText className="h-3.5 w-3.5" /> Markdown Specs</span>}
                      flush
                    >
                      <div className="dv-dl">
                        <a
                          href="https://aouqcwbdoyrccjcrhzzi.supabase.co/storage/v1/object/public/apidoc/api-docs-for-ai-agents.md"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <FileText className="h-4 w-4" />
                          <div style={{ minWidth: 0 }}>
                            <b>AI Agent Guide</b>
                            <small>Full spec for coding agents</small>
                          </div>
                          <Ico.ArrowUpRight style={{ marginLeft: 'auto' }} />
                        </a>
                        <a
                          href="https://aouqcwbdoyrccjcrhzzi.supabase.co/storage/v1/object/public/apidoc/api-docs-for-humans.md"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <FileText className="h-4 w-4" />
                          <div style={{ minWidth: 0 }}>
                            <b>Developer Guide</b>
                            <small>Human-readable reference</small>
                          </div>
                          <Ico.ArrowUpRight style={{ marginLeft: 'auto' }} />
                        </a>
                      </div>
                    </Panel>
                  </section>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Wrap>
      </div>
    </AppShell>
  );
};

export default DeveloperAPI;

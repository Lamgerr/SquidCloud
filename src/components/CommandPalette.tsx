import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { 
  Search, 
  Command,
  Folder,
  FolderOpen,
  Upload,
  FileText,
  Trash2,
  Share2,
  Download,
  Grid3X3,
  List,
  Calendar,
  FileType,
  HardDrive,
  Star,
  Clock,
  Settings,
  BarChart3,
  Plus,
  Eye,
  ArrowRight,
  X,
  CornerDownLeft,
  History,
  File,
  Image,
  Video,
  Music,
  Archive,
  Code,
  FileSpreadsheet,
  Presentation,
  FileIcon,
  User,
  KeyRound,
  RefreshCw,
  LogOut,
  Sparkles
} from '@/lib/icon-map';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { BottomSheet, BottomSheetContent } from '@/components/ui/bottom-sheet';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { squidAgent, type AgentStep } from '@/services/squid-agent';
import { useToast } from '@/hooks/use-toast';

/* ── Squid Search · floating-dock glass + Squid AI mode ── */
const SPRING = 'linear(0, 0.03, 0.107, 0.214, 0.337, 0.464, 0.586, 0.699, 0.797, 0.881, 0.948, 0.999, 1.037, 1.062, 1.077, 1.083, 1.083, 1.078, 1.07, 1.06, 1.05, 1.039, 1.029, 1.02, 1.013, 1.007, 1.002, 0.998, 0.996, 0.994, 0.993, 0.993, 0.993, 0.994, 0.995, 0.995, 0.996, 0.997, 1)';

/* Fine fractal grain — the "nano texture" that makes the glass read frosted
   instead of flat/see-through. Alpha is baked low into the SVG itself. */
const NANO_TEXTURE = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.92' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='linear' slope='.055'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const SQUID_CSS = `
.spot-shell.spot-shell { top: 16vh !important; left: 50% !important; translate: -50% 0 !important; transform: none !important; max-width: 680px; width: calc(100% - 32px);
  background: transparent !important; border: 0 !important; box-shadow: none !important; -webkit-backdrop-filter: none !important; backdrop-filter: none !important;
  animation: none !important; border-radius: 0 !important; padding: 0 !important; overflow: visible !important; }
.spot-shell > button { display: none !important; }
.spot-root { --ink: #e8e7e1; --mute: rgba(232,231,225,.55); --glass: rgba(16,17,18,.94); --fog: rgba(50,54,72,.34); --hi: rgba(232,231,225,.05); --line: rgba(232,231,225,.1); --rim: rgba(232,231,225,.16);
  display: flex; flex-direction: column; gap: 12px; color: var(--ink); font-family: var(--sa-f, -apple-system, 'SF Pro Text', system-ui, sans-serif); }
html.light .spot-root, html[data-theme="light"] .spot-root { --ink: #e8e7e1; --glass: rgba(16,17,18,.94); --fog: rgba(50,54,72,.34); --hi: rgba(232,231,225,.05); --line: rgba(232,231,225,.1); --rim: rgba(232,231,225,.16); }
.spot-root[data-mobile="true"] { flex: 1; min-height: 0; gap: 0; padding: 18px 14px 0; }
.spot-top { display: flex; align-items: center; gap: 10px; }
.spot-orbs { display: flex; gap: 8px; }

/* Foggy frosted glass: dense tint + soft fog gradient + fine nano grain.
   Grain is a background layer (not a pseudo-element) so the AI colour layer
   on ::before stays free. */
.spot-glass { position: relative; isolation: isolate;
  background-image: ${NANO_TEXTURE}, linear-gradient(180deg, var(--fog), transparent 55%);
  background-color: var(--glass); background-size: 180px 180px, auto;
  border: 1px solid var(--line);
  -webkit-backdrop-filter: blur(30px) saturate(1.3); backdrop-filter: blur(30px) saturate(1.3);
  box-shadow: inset 0 1px 0 var(--rim), 0 16px 38px -16px rgba(0,0,0,.8); }
.spot-pill { flex: 1; min-width: 0; height: 54px; border-radius: 999px; display: flex; align-items: center; gap: 10px; padding: 0 14px 0 16px; }
.spot-root[data-mobile="true"] .spot-pill { height: 46px; background-color: var(--glass); background-image: ${NANO_TEXTURE}, linear-gradient(180deg, var(--fog), transparent 55%); background-size: 180px 180px, auto; box-shadow: inset 0 1px 0 var(--rim); }
.spot-round { width: 52px; height: 52px; min-width: 52px; min-height: 52px; aspect-ratio: 1 / 1; border-radius: 9999px !important; display: grid; place-items: center; color: var(--ink); cursor: pointer; transition: scale .6s ${SPRING}, background-color .2s; }
.spot-round:hover { scale: 1.06; } .spot-round:active { scale: .92; transition-duration: .12s; }
.spot-round[data-on="true"] { background: rgba(232,231,225,.14); box-shadow: inset 0 0 0 1px rgba(232,231,225,.22); }
.spot-lead { display: grid; place-items: center; color: var(--mute); width: 22px; flex: none; }
.spot-input.spot-input.spot-input { all: unset; flex: 1; min-width: 0; font-size: 20px; letter-spacing: -.01em; color: var(--ink); caret-color: #8fa4ff; background: none !important; border: 0 !important; box-shadow: none !important; }
.spot-input::placeholder { color: var(--mute); }
.spot-clear, .spot-close { display: grid; place-items: center; flex: none; border-radius: 50%; color: var(--mute); cursor: pointer; border: 0; background: transparent; }
.spot-clear { width: 24px; height: 24px; } .spot-clear:hover, .spot-close:hover { color: var(--ink); background: var(--hi); }
.spot-close { width: 40px; height: 40px; }
.spot-token { flex: none; font-size: 14px; padding: 4px 11px; border-radius: 999px; background: color-mix(in srgb, #8fa4ff 24%, transparent); border: 1px solid color-mix(in srgb, #8fa4ff 40%, transparent); color: var(--ink); cursor: pointer; }
.spot-hint, .spot-go { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--mute); white-space: nowrap; }
.spot-root kbd { font: 500 11px/1 var(--sa-f, system-ui); padding: 3px 6px; border-radius: 6px; background: var(--hi); border: 1px solid var(--line); color: var(--mute); }

/* Squid AI mode — bring back the soft colour, but keep the dock shape */
.spot-pill::before, .spot-ai::before, .spot-pill::after, .spot-ai::after { content: ''; position: absolute; border-radius: inherit; pointer-events: none; opacity: 0; transition: opacity .7s ease; }
.spot-pill::before, .spot-ai::before { inset: 0; z-index: -1; background-size: 220% 220%; }
.spot-pill::after, .spot-ai::after { inset: -1px; z-index: 1; border: 1px solid rgba(255,255,255,.34); box-shadow: 0 0 22px rgba(140,150,255,.3), 0 0 2px rgba(255,255,255,.5), inset 0 0 18px rgba(170,160,255,.14); }
.spot-pill[data-ai="true"] { --ink: #fff; --mute: rgba(255,255,255,.62); background-color: rgba(14,15,24,.95);
  background-image: ${NANO_TEXTURE}, linear-gradient(180deg, rgba(34,36,52,.9), rgba(10,11,20,.97));
  border-color: rgba(255,255,255,.16);
  animation: spot-swell .8s ${SPRING} both; box-shadow: inset 0 1px 0 rgba(255,255,255,.28), 0 28px 70px -22px rgba(90,100,200,.45); }
.spot-pill[data-ai="true"]::before { opacity: 1; animation: spot-drift 7s ease-in-out infinite alternate; background-image:
  radial-gradient(48% 90% at 18% 110%, rgba(122,142,255,.62), transparent 70%), radial-gradient(44% 90% at 52% 120%, rgba(176,140,255,.52), transparent 70%),
  radial-gradient(40% 80% at 84% 115%, rgba(244,164,200,.46), transparent 70%), radial-gradient(30% 70% at 66% -20%, rgba(255,206,160,.3), transparent 70%); }
.spot-pill[data-ai="true"]::after, .spot-ai[data-on="true"]::after { opacity: .95; animation: spot-glow 3.4s ease-in-out infinite; }
.spot-ai[data-on="true"]::before { opacity: 1; background-image: radial-gradient(70% 90% at 20% 110%, rgba(122,142,255,.62), transparent 70%), radial-gradient(60% 90% at 85% 110%, rgba(244,164,200,.52), transparent 70%); }
.spot-pill[data-busy="true"]::before { animation-duration: 2.2s; } .spot-pill[data-busy="true"]::after { animation-duration: 1.4s; }
.spot-orb { display: block; width: 20px; height: 20px; border-radius: 50%; flex: none; background-color: #1a1c2c; background-size: 220% 220%;
  background-image: radial-gradient(circle at 28% 24%, rgba(255,255,255,.75), transparent 34%), radial-gradient(circle at 25% 80%, #7a8eff, transparent 60%), radial-gradient(circle at 80% 75%, #f4a4c8, transparent 58%), radial-gradient(circle at 70% 20%, #b08cff, transparent 60%);
  box-shadow: inset 0 1px 1px rgba(255,255,255,.6), 0 0 14px rgba(150,150,255,.5); animation: spot-drift 5s ease-in-out infinite alternate; }
.spot-orb[data-busy="true"] { animation-duration: 1.6s; } .spot-orb.big { width: 44px; height: 44px; }
/* panel */
.spot-panel { border-radius: 30px; display: grid; grid-template-rows: 0fr; opacity: 0; translate: 0 -10px; scale: .97; transform-origin: top center; pointer-events: none;
  transition: grid-template-rows .7s ${SPRING}, opacity .25s ease, translate .7s ${SPRING}, scale .7s ${SPRING}; }
.spot-panel[data-open="true"] { grid-template-rows: 1fr; opacity: 1; translate: 0 0; scale: 1; pointer-events: auto; }
.spot-panel[data-ai="true"] { background: linear-gradient(180deg, rgba(255,255,255,.3), var(--glass)); }
.spot-panel > * { min-height: 0; } .spot-panel > .spot-clip { overflow: hidden; border-radius: 30px 30px 0 0; display: flex; flex-direction: column; }
.spot-panel > .spot-foot { overflow: hidden; }
.spot-root[data-mobile="true"] .spot-panel { flex: 1; grid-template-rows: 1fr; opacity: 1; translate: none; scale: 1; pointer-events: auto; background: none; border: 0; box-shadow: none; -webkit-backdrop-filter: none; backdrop-filter: none; }
.spot-root[data-mobile="true"] .spot-panel > .spot-clip { border-radius: 0; }
/* Scope chips — quiet dark segmented pills, never a white block */
.spot-chips { display: flex; gap: 4px; padding: 12px 14px 6px; overflow-x: auto; scrollbar-width: none; flex: none; }
.spot-chips button { flex: none; padding: 5px 12px; border-radius: 999px; font-size: 12.5px; color: var(--mute);
  background: transparent; border: 1px solid transparent; cursor: pointer; transition: background-color .2s ${SPRING}, color .2s; }
.spot-chips button:hover { background: rgba(232,231,225,.06); color: var(--ink); }
.spot-chips button[data-on="true"] { background: rgba(232,231,225,.11); color: var(--ink); border-color: var(--line); }
.spot-list { overflow-y: auto; min-height: 0; padding: 4px 10px 10px; scrollbar-width: thin; max-height: min(400px, 50vh); }
.spot-root[data-mobile="true"] .spot-list { max-height: none; flex: 1; }
.spot-group-label { font-size: 11.5px; font-weight: 500; text-transform: uppercase; letter-spacing: .08em; color: var(--mute); padding: 10px 12px 5px; }
.spot-row.spot-row { position: relative; display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 16px; cursor: pointer; color: var(--ink); list-style: none; background: transparent !important; }
.spot-row-thumb { position: absolute; inset: 0; border-radius: 16px; background: linear-gradient(180deg, rgba(255,255,255,.22), rgba(255,255,255,.1)); box-shadow: inset 0 1px 0 var(--rim); }
.spot-ico { position: relative; z-index: 1; width: 34px; height: 34px; flex: none; border-radius: 10px; display: grid; place-items: center; color: var(--ink); box-shadow: inset 0 1px 0 rgba(255,255,255,.5), 0 4px 10px -4px rgba(0,0,0,.45); }
.spot-ico.spot-ico-ai { background: rgba(20,20,28,.6); }
.spot-main { position: relative; z-index: 1; flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.spot-label { font-size: 15.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .spot-label b { font-weight: 700; }
.spot-desc { font-size: 12.5px; color: var(--mute); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.spot-kbd, .spot-enter { position: relative; z-index: 1; } .spot-enter { color: var(--mute); }
.spot-empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 40px 24px; color: var(--mute); gap: 6px; font-size: 13.5px; }
.spot-empty p { margin: 0; font-size: 15px; color: var(--ink); }

/* ask */
.spot-ask { padding: 20px 24px 22px; min-height: 120px; max-height: min(420px, 55vh); overflow-y: auto; flex: 1; }
.spot-ask-empty { display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; color: var(--mute); padding: 8px 0; }
.spot-ask-empty p { margin: 0; font-size: 15px; }
.spot-suggest { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.spot-suggest button { padding: 7px 14px; border-radius: 999px; font-size: 13.5px; color: var(--ink); background: var(--hi); border: 1px solid var(--line); cursor: pointer; }
.spot-answer { margin: 0; font-size: 15px; line-height: 1.6; color: var(--ink); animation: spot-rise .6s ${SPRING} both; }
.spot-answer p { margin: 0 0 10px; } .spot-answer p:last-child { margin-bottom: 0; }
.spot-answer strong { color: var(--ink); font-weight: 600; }
.spot-answer ul, .spot-answer ol { margin: 8px 0; padding-left: 20px; } .spot-answer li { margin: 4px 0; }
.spot-answer code { font: 400 12.5px/1.5 var(--sa-mono, ui-monospace, monospace); padding: 2px 5px; border-radius: 5px;
  background: rgba(232,231,225,.08); border: 1px solid var(--line); color: #c9b8ff; }
.spot-answer pre { margin: 10px 0; padding: 12px 14px; border-radius: 10px; overflow-x: auto;
  background: rgba(0,0,0,.4); border: 1px solid var(--line); }
.spot-answer pre code { padding: 0; background: none; border: 0; color: var(--ink); }
.spot-answer a { color: #b7a6ff; text-underline-offset: 3px; }
.spot-answer h1, .spot-answer h2, .spot-answer h3 { font-size: 16px; font-weight: 600; margin: 14px 0 6px; }
.spot-answer blockquote { margin: 10px 0; padding-left: 12px; border-left: 2px solid var(--line); color: var(--mute); }
.spot-answer hr { border: 0; border-top: 1px solid var(--line); margin: 14px 0; }
.spot-steps { display: flex; flex-direction: column; gap: 6px; margin: 2px 0 16px; }
.spot-step { display: flex; align-items: center; gap: 9px; padding: 6px 4px; border-radius: 8px; border: 0;
  background: transparent; font-size: 12.5px; color: var(--mute); }
.spot-step[data-kind="tool"] b { color: var(--ink); font-weight: 500; }
.spot-step .spot-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--mute); flex: none; }
.spot-step[data-status="running"] .spot-dot { background: #b7a6ff; animation: spot-glow 1s ease-in-out infinite; }
.spot-step[data-status="done"] .spot-dot { background: #8fc98f; }
.spot-step[data-status="failed"] .spot-dot { background: #d98080; }
.spot-step-args { font: 400 10.5px/1 var(--sa-mono, ui-monospace, monospace); color: var(--mute); opacity: .8; }
.spot-searching { display: inline-block; font-size: 18px; font-weight: 500; padding: 4px 0 10px; color: transparent; background: linear-gradient(100deg, var(--mute) 30%, var(--ink) 50%, var(--mute) 70%) 0 0 / 250% 100%; -webkit-background-clip: text; background-clip: text; animation: spot-shimmer 1.6s linear infinite; text-shadow: 0 0 18px rgba(150,160,255,.35); }
.spot-foot { display: flex; gap: 18px; padding: 10px 20px; border-top: 1px solid var(--line); font-size: 12px; color: var(--mute); white-space: nowrap; overflow-x: auto; }
.spot-foot > span { display: inline-flex; align-items: center; gap: 6px; }

.spot-root button:focus-visible { outline: 2px solid #8fa4ff; outline-offset: 2px; }
@keyframes spot-drift { from { background-position: 0% 40%; } to { background-position: 100% 60%; } }
@keyframes spot-glow { 50% { opacity: .45; } }
@keyframes spot-shimmer { from { background-position: 150% 0; } to { background-position: -50% 0; } }
@keyframes spot-swell { 0% { scale: .9 .8; } 100% { scale: 1; } }
@keyframes spot-rise { from { opacity: 0; translate: 0 8px; } to { opacity: 1; translate: 0 0; } }
@media (prefers-reduced-motion: reduce) { .spot-root *, .spot-root *::before, .spot-root *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; } }
`;

type CommandCategory = 'files' | 'navigation' | 'actions' | 'view' | 'create' | 'recent' | 'ai';
type Scope = 'all' | 'commands' | 'folder' | 'doc' | 'image' | 'code';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  category: CommandCategory;
  shortcut?: string;
  action: () => void;
  keywords?: string[];
  kind?: 'folder' | 'doc' | 'image' | 'code' | 'other';
}

// File item interface for search
interface SearchableFile {
  id: string;
  name: string;
  type: string;
  size: number;
  path?: string;
  parent_folder?: string;
  is_folder?: boolean;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  
  // Navigation actions
  onNavigateToFiles?: () => void;
  onNavigateToShared?: () => void;
  onNavigateToFolder?: (path: string) => void;
  onNavigateToTrash?: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToAnalytics?: () => void;
  onNavigateToAccount?: () => void;
  onNavigateToDeveloperApi?: () => void;
  onOpenQuickJump?: () => void;
  onRefresh?: () => void;
  onSignOut?: () => void;
  
  // File actions
  onUploadFile?: () => void;
  onCreateFolder?: () => void;
  onCreateTextFile?: () => void;
  onDeleteSelected?: () => void;
  onShareSelected?: () => void;
  onDownloadSelected?: () => void;
  
  // View actions
  onSetViewMode?: (mode: 'grid' | 'list') => void;
  onSetGroupBy?: (groupBy: 'none' | 'date' | 'type' | 'size') => void;
  onTogglePeekSidebar?: () => void;
  
  // Context
  currentViewMode?: 'grid' | 'list';
  currentGroupBy?: 'none' | 'date' | 'type' | 'size';
  selectedFilesCount?: number;
  recentFolders?: Array<{ path: string; name: string }>;
  
  // File search
  files?: SearchableFile[];
  folders?: Array<{ id: string; name: string; path: string }>;
  onOpenFile?: (file: SearchableFile) => void;

  // Squid AI (Tab, or the "Ask Squid AI" row)
  aiContext?: { fileName?: string; fileType?: string; filePath?: string; fileContent?: string };
  currentFolder?: string;
  onActionComplete?: () => void;
}

const categoryLabels: Record<CommandCategory, string> = {
  files: 'Files',
  recent: 'Recent',
  navigation: 'Navigation',
  actions: 'Actions',
  view: 'View',
  create: 'Create',
  ai: 'Squid AI',
};

const categoryOrder: CommandCategory[] = ['files', 'recent', 'navigation', 'actions', 'view', 'create', 'ai'];

const scoreTextMatch = (text: string, query: string): number => {
  const target = text.toLowerCase();
  if (target === query) return 0;
  if (target.startsWith(query)) return 1;
  const includesAt = target.indexOf(query);
  return includesAt >= 0 ? 10 + includesAt : Number.POSITIVE_INFINITY;
};

// Helper function to get file icon based on type
const getFileIcon = (type: string, name: string) => {
  const mimeType = type.toLowerCase();
  const ext = name.split('.').pop()?.toLowerCase() || '';
  
  if (mimeType.startsWith('image/')) return <Image className="w-4 h-4 text-pink-400" />;
  if (mimeType.startsWith('video/')) return <Video className="w-4 h-4 text-purple-400" />;
  if (mimeType.startsWith('audio/')) return <Music className="w-4 h-4 text-green-400" />;
  if (mimeType === 'application/pdf') return <FileText className="w-4 h-4 text-red-400" />;
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <Archive className="w-4 h-4 text-amber-400" />;
  }
  if (mimeType.includes('spreadsheet') || ['xlsx', 'xls', 'csv'].includes(ext)) {
    return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
  }
  if (mimeType.includes('presentation') || ['pptx', 'ppt'].includes(ext)) {
    return <Presentation className="w-4 h-4 text-orange-400" />;
  }
  if (mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('json') || mimeType.includes('html') || mimeType.includes('css') || ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'go', 'rs', 'rb', 'php', 'swift', 'kt'].includes(ext)) {
    return <Code className="w-4 h-4 text-primary" />;
  }
  if (mimeType.startsWith('text/') || ['txt', 'md', 'rtf', 'doc', 'docx'].includes(ext)) {
    return <FileText className="w-4 h-4 text-gray-400" />;
  }
  
  return <File className="w-4 h-4 text-muted-foreground" />;
};

const CODE_EXT = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'json', 'html', 'css', 'sql', 'sh'];
const getKind = (type: string, name: string): 'doc' | 'image' | 'code' | 'other' => {
  const m = (type || '').toLowerCase();
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (m.startsWith('image/')) return 'image';
  if (CODE_EXT.includes(ext) || /javascript|typescript|json|html|css/.test(m)) return 'code';
  if (m === 'application/pdf' || m.startsWith('text/') || /spreadsheet|presentation|word/.test(m) || ['pdf', 'txt', 'md', 'rtf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx'].includes(ext)) return 'doc';
  return 'other';
};
const TINT: Record<string, string> = {
  folder: 'rgba(232,231,225,.10)', image: 'rgba(232,231,225,.10)', doc: 'rgba(232,231,225,.10)',
  code: 'rgba(232,231,225,.10)', other: 'rgba(232,231,225,.10)', navigation: 'rgba(232,231,225,.10)',
  actions: 'rgba(232,231,225,.10)', view: 'rgba(232,231,225,.10)', create: 'rgba(232,231,225,.10)',
  recent: 'rgba(232,231,225,.10)', danger: 'rgba(217,128,128,.14)',
};
const DANGER = ['action-delete', 'action-signout', 'nav-trash'];
const SCOPES: { id: Scope; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'commands', label: 'Commands' }, { id: 'folder', label: 'Folders' },
  { id: 'doc', label: 'Documents' }, { id: 'image', label: 'Images' }, { id: 'code', label: 'Code' },
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onOpenChange,
  onNavigateToFiles,
  onNavigateToShared,
  onNavigateToFolder,
  onNavigateToTrash,
  onNavigateToSettings,
  onNavigateToAnalytics,
  onNavigateToAccount,
  onNavigateToDeveloperApi,
  onOpenQuickJump,
  onRefresh,
  onSignOut,
  onUploadFile,
  onCreateFolder,
  onCreateTextFile,
  onDeleteSelected,
  onShareSelected,
  onDownloadSelected,
  onSetViewMode,
  onSetGroupBy,
  onTogglePeekSidebar,
  currentViewMode = 'grid',
  currentGroupBy = 'none',
  selectedFilesCount = 0,
  recentFolders = [],
  files = [],
  folders = [],
  onOpenFile,
  aiContext,
  currentFolder = '',
  onActionComplete,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const reduce = !!useReducedMotion();
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase();
  const [scope, setScope] = useState<Scope>('all');
  const [mode, setMode] = useState<'search' | 'ask'>('search');
  const [response, setResponse] = useState('');
  const [shown, setShown] = useState('');
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const askRef = useRef<(q?: string) => void>(() => {});
  const { toast } = useToast();

  const ask = async (raw?: string) => {
    const query = (raw ?? searchQuery).trim();
    if (!query || isLoading) return;
    setMode('ask'); setSearchQuery(query); setIsLoading(true);
    setResponse(''); setShown(''); setSteps([]);
    try {
      // Runs as a background job — closing the palette does not cancel it.
      const result = await squidAgent.ask(query, { ...aiContext, currentFolder });
      setSteps(result.steps);
      setResponse(result.message);
      if (result.steps.some(s => s.status === 'done')) onActionComplete?.();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setResponse('Something went wrong. Try asking again.');
    } finally {
      setIsLoading(false);
    }
  };
  askRef.current = ask;

  // answer types in word by word
  useEffect(() => {
    if (!response) { setShown(''); return; }
    if (reduce) { setShown(response); return; }
    const w = response.split(/(\s+)/);
    let i = 0;
    const id = setInterval(() => { i += 2; setShown(w.slice(0, i).join('')); if (i >= w.length) clearInterval(id); }, 28);
    return () => clearInterval(id);
  }, [response, reduce]);

  // Build command list
  const commands = useMemo((): CommandItem[] => {
    const items: CommandItem[] = [];

    // Recent folders
    recentFolders.slice(0, 3).forEach((folder, idx) => {
      items.push({
        id: `recent-${idx}`,
        label: folder.name || 'Root',
        description: folder.path || 'Go to root folder',
        icon: <History className="w-4 h-4 text-muted-foreground" />,
        category: 'recent',
        action: () => {
          onNavigateToFolder?.(folder.path);
          onOpenChange(false);
        },
        keywords: ['recent', 'history', folder.name.toLowerCase()],
      });
    });

    // Navigation commands
    if (onNavigateToFiles) {
      items.push({
        id: 'nav-files',
        label: 'Go to files',
        description: 'Open your file workspace',
        icon: <FileIcon className="w-4 h-4 text-primary" />,
        category: 'navigation',
        shortcut: '⌘1',
        action: () => {
          onNavigateToFiles();
          onOpenChange(false);
        },
        keywords: ['files', 'workspace', 'home'],
      });
    }

    if (onNavigateToShared) {
      items.push({
        id: 'nav-shared',
        label: 'Go to shared',
        description: 'Open shared files view',
        icon: <Share2 className="w-4 h-4 text-primary" />,
        category: 'navigation',
        shortcut: '⌘2',
        action: () => {
          onNavigateToShared();
          onOpenChange(false);
        },
        keywords: ['shared', 'collaboration', 'links'],
      });
    }

    if (onOpenQuickJump) {
      items.push({
        id: 'nav-jump',
        label: 'Go to folder...',
        description: 'Jump to any folder quickly',
        icon: <FolderOpen className="w-4 h-4 text-primary" />,
        category: 'navigation',
        shortcut: '⌘G',
        action: () => {
          onOpenQuickJump();
          onOpenChange(false);
        },
        keywords: ['go', 'jump', 'folder', 'navigate', 'open'],
      });
    }

    items.push({
      id: 'nav-home',
      label: 'Go to home',
      description: 'Navigate to root folder',
      icon: <Folder className="w-4 h-4 text-primary" />,
      category: 'navigation',
      action: () => {
        onNavigateToFolder?.('');
        onOpenChange(false);
      },
      keywords: ['home', 'root', 'main'],
    });

    if (onNavigateToTrash) {
      items.push({
        id: 'nav-trash',
        label: 'Go to trash',
        description: 'View deleted files',
        icon: <Trash2 className="w-4 h-4 text-red-400" />,
        category: 'navigation',
        action: () => {
          onNavigateToTrash();
          onOpenChange(false);
        },
        keywords: ['trash', 'deleted', 'recycle', 'bin'],
      });
    }

    if (onNavigateToSettings) {
      items.push({
        id: 'nav-settings',
        label: 'Open settings',
        description: 'Account and app settings',
        icon: <Settings className="w-4 h-4 text-gray-400" />,
        category: 'navigation',
        action: () => {
          onNavigateToSettings();
          onOpenChange(false);
        },
        keywords: ['settings', 'preferences', 'account', 'config'],
      });
    }

    if (onNavigateToAccount) {
      items.push({
        id: 'nav-account',
        label: 'Open account',
        description: 'Profile and security settings',
        icon: <User className="w-4 h-4 text-indigo-400" />,
        category: 'navigation',
        action: () => {
          onNavigateToAccount();
          onOpenChange(false);
        },
        keywords: ['account', 'profile', 'security', 'user'],
      });
    }

    if (onNavigateToDeveloperApi) {
      items.push({
        id: 'nav-dev-api',
        label: 'Open developer API',
        description: 'API keys and developer tools',
        icon: <KeyRound className="w-4 h-4 text-emerald-400" />,
        category: 'navigation',
        action: () => {
          onNavigateToDeveloperApi();
          onOpenChange(false);
        },
        keywords: ['api', 'developer', 'keys', 'webhooks'],
      });
    }

    if (onNavigateToAnalytics) {
      items.push({
        id: 'nav-analytics',
        label: 'View analytics',
        description: 'Storage and usage statistics',
        icon: <BarChart3 className="w-4 h-4 text-green-400" />,
        category: 'navigation',
        action: () => {
          onNavigateToAnalytics();
          onOpenChange(false);
        },
        keywords: ['analytics', 'stats', 'usage', 'storage'],
      });
    }

    // File actions
    if (selectedFilesCount > 0) {
      if (onDeleteSelected) {
        items.push({
          id: 'action-delete',
          label: `Delete ${selectedFilesCount} file${selectedFilesCount > 1 ? 's' : ''}`,
          description: 'Move selected files to trash',
          icon: <Trash2 className="w-4 h-4 text-red-400" />,
          category: 'actions',
          shortcut: '⌫',
          action: () => {
            onDeleteSelected();
            onOpenChange(false);
          },
          keywords: ['delete', 'remove', 'trash'],
        });
      }

      if (onShareSelected) {
        items.push({
          id: 'action-share',
          label: `Share ${selectedFilesCount} file${selectedFilesCount > 1 ? 's' : ''}`,
          description: 'Create share links',
          icon: <Share2 className="w-4 h-4 text-primary" />,
          category: 'actions',
          action: () => {
            onShareSelected();
            onOpenChange(false);
          },
          keywords: ['share', 'link', 'send'],
        });
      }

      if (onDownloadSelected) {
        items.push({
          id: 'action-download',
          label: `Download ${selectedFilesCount} file${selectedFilesCount > 1 ? 's' : ''}`,
          description: 'Download selected files',
          icon: <Download className="w-4 h-4 text-green-400" />,
          category: 'actions',
          shortcut: '⌘D',
          action: () => {
            onDownloadSelected();
            onOpenChange(false);
          },
          keywords: ['download', 'save', 'export'],
        });
      }
    }

    if (onRefresh) {
      items.push({
        id: 'action-refresh',
        label: 'Refresh workspace',
        description: 'Reload files and folders',
        icon: <RefreshCw className="w-4 h-4 text-cyan-400" />,
        category: 'actions',
        shortcut: '⌘R',
        action: () => {
          onRefresh();
          onOpenChange(false);
        },
        keywords: ['refresh', 'reload', 'sync', 'update'],
      });
    }

    if (onSignOut) {
      items.push({
        id: 'action-signout',
        label: 'Sign out',
        description: 'Sign out of SquidCloud',
        icon: <LogOut className="w-4 h-4 text-rose-400" />,
        category: 'actions',
        action: () => {
          onSignOut();
          onOpenChange(false);
        },
        keywords: ['logout', 'sign out', 'exit'],
      });
    }

    // View commands
    if (onSetViewMode) {
      items.push({
        id: 'view-grid',
        label: 'Switch to grid view',
        description: currentViewMode === 'grid' ? 'Currently active' : 'Show files in a grid',
        icon: <Grid3X3 className={cn("w-4 h-4", currentViewMode === 'grid' ? 'text-primary' : 'text-muted-foreground')} />,
        category: 'view',
        action: () => {
          onSetViewMode('grid');
          onOpenChange(false);
        },
        keywords: ['grid', 'tiles', 'icons'],
      });

      items.push({
        id: 'view-list',
        label: 'Switch to list view',
        description: currentViewMode === 'list' ? 'Currently active' : 'Show files in a list',
        icon: <List className={cn("w-4 h-4", currentViewMode === 'list' ? 'text-primary' : 'text-muted-foreground')} />,
        category: 'view',
        action: () => {
          onSetViewMode('list');
          onOpenChange(false);
        },
        keywords: ['list', 'rows', 'details'],
      });
    }

    if (onSetGroupBy) {
      items.push({
        id: 'view-group-date',
        label: 'Group by date',
        description: currentGroupBy === 'date' ? 'Currently active' : 'Group files by creation date',
        icon: <Calendar className={cn("w-4 h-4", currentGroupBy === 'date' ? 'text-primary' : 'text-muted-foreground')} />,
        category: 'view',
        action: () => {
          onSetGroupBy('date');
          onOpenChange(false);
        },
        keywords: ['group', 'date', 'time', 'sort'],
      });

      items.push({
        id: 'view-group-type',
        label: 'Group by type',
        description: currentGroupBy === 'type' ? 'Currently active' : 'Group files by file type',
        icon: <FileType className={cn("w-4 h-4", currentGroupBy === 'type' ? 'text-primary' : 'text-muted-foreground')} />,
        category: 'view',
        action: () => {
          onSetGroupBy('type');
          onOpenChange(false);
        },
        keywords: ['group', 'type', 'kind', 'category'],
      });

      items.push({
        id: 'view-group-size',
        label: 'Group by size',
        description: currentGroupBy === 'size' ? 'Currently active' : 'Group files by file size',
        icon: <HardDrive className={cn("w-4 h-4", currentGroupBy === 'size' ? 'text-primary' : 'text-muted-foreground')} />,
        category: 'view',
        action: () => {
          onSetGroupBy('size');
          onOpenChange(false);
        },
        keywords: ['group', 'size', 'large', 'small'],
      });

      items.push({
        id: 'view-group-none',
        label: 'Remove grouping',
        description: currentGroupBy === 'none' ? 'Currently active' : 'Show all files without groups',
        icon: <List className={cn("w-4 h-4", currentGroupBy === 'none' ? 'text-primary' : 'text-muted-foreground')} />,
        category: 'view',
        action: () => {
          onSetGroupBy('none');
          onOpenChange(false);
        },
        keywords: ['ungroup', 'flat', 'all'],
      });
    }

    if (onTogglePeekSidebar) {
      items.push({
        id: 'view-peek',
        label: 'Toggle peek sidebar',
        description: 'Show/hide the file preview sidebar',
        icon: <Eye className="w-4 h-4 text-muted-foreground" />,
        category: 'view',
        shortcut: 'Space',
        action: () => {
          onTogglePeekSidebar();
          onOpenChange(false);
        },
        keywords: ['peek', 'preview', 'sidebar', 'panel'],
      });
    }

    // Create commands
    if (onCreateFolder) {
      items.push({
        id: 'create-folder',
        label: 'New folder',
        description: 'Create a new folder',
        icon: <Plus className="w-4 h-4 text-primary" />,
        category: 'create',
        action: () => {
          onCreateFolder();
          onOpenChange(false);
        },
        keywords: ['new', 'folder', 'create', 'directory'],
      });
    }

    if (onUploadFile) {
      items.push({
        id: 'create-upload',
        label: 'Upload file',
        description: 'Upload files from your device',
        icon: <Upload className="w-4 h-4 text-green-400" />,
        category: 'create',
        shortcut: '⌘U',
        action: () => {
          onUploadFile();
          onOpenChange(false);
        },
        keywords: ['upload', 'add', 'import', 'file'],
      });
    }

    if (onCreateTextFile) {
      items.push({
        id: 'create-text',
        label: 'New text file',
        description: 'Create a new text document',
        icon: <FileText className="w-4 h-4 text-gray-400" />,
        category: 'create',
        action: () => {
          onCreateTextFile();
          onOpenChange(false);
        },
        keywords: ['new', 'text', 'file', 'document', 'note'],
      });
    }

    return items;
  }, [
    selectedFilesCount,
    currentViewMode,
    currentGroupBy,
    recentFolders,
    onOpenChange,
    onNavigateToFiles,
    onNavigateToShared,
    onNavigateToFolder,
    onNavigateToTrash,
    onNavigateToSettings,
    onNavigateToAnalytics,
    onNavigateToAccount,
    onNavigateToDeveloperApi,
    onOpenQuickJump,
    onRefresh,
    onSignOut,
    onUploadFile,
    onCreateFolder,
    onCreateTextFile,
    onDeleteSelected,
    onShareSelected,
    onDownloadSelected,
    onSetViewMode,
    onSetGroupBy,
    onTogglePeekSidebar,
  ]);

  // Helper to format file size
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Search files and folders when query exists
  const fileSearchResults = useMemo((): CommandItem[] => {
    const browse = !normalizedSearchQuery && ['folder', 'doc', 'image', 'code'].includes(scope);
    if ((!normalizedSearchQuery || normalizedSearchQuery.length < 2) && !browse) return [];
    if (scope === 'commands') return [];

    const query = normalizedSearchQuery;
    const hit = (name: string) => (browse ? 0 : scoreTextMatch(name, query));
    const results: CommandItem[] = [];

    const folderMatches = (scope === 'all' || scope === 'folder' ? folders : ([] as typeof folders))
      .map(folder => ({ folder, score: hit(folder.name) }))
      .filter(item => Number.isFinite(item.score))
      .sort((a, b) => (a.score - b.score) || a.folder.name.length - b.folder.name.length)
      .slice(0, 6);

    folderMatches.forEach(({ folder }) => {
        results.push({
          id: `folder-${folder.id}`,
          label: folder.name,
          description: folder.path ? `Folder  ·  ${folder.path}` : 'Folder  ·  Root',
          kind: 'folder',
          icon: <FolderOpen className="w-4 h-4 text-primary" />,
          category: 'files',
          action: () => {
            onNavigateToFolder?.(folder.path);
            onOpenChange(false);
          },
          keywords: ['folder', folder.name.toLowerCase()],
        });
      });

    const fileMatches = (scope === 'folder' ? ([] as typeof files) : files)
      .filter(file => !file.is_folder && (scope === 'all' || getKind(file.type, file.name) === scope))
      .map(file => ({ file, score: hit(file.name) }))
      .filter(item => Number.isFinite(item.score))
      .sort((a, b) => (a.score - b.score) || a.file.name.length - b.file.name.length)
      .slice(0, 14);

    fileMatches.forEach(({ file }) => {
        const folderPath = file.parent_folder || file.path || '';
        results.push({
          id: `file-${file.id}`,
          label: file.name,
          description: `${formatSize(file.size)}${folderPath ? `  ·  ${folderPath}` : ''}`,
          kind: getKind(file.type, file.name),
          icon: getFileIcon(file.type, file.name),
          category: 'files',
          action: () => {
            if (onOpenFile) {
              onOpenFile(file);
            }
            onOpenChange(false);
          },
          keywords: [file.name.toLowerCase(), file.type],
        });
      });

    return results;
  }, [normalizedSearchQuery, scope, files, folders, onNavigateToFolder, onOpenFile, onOpenChange]);

  const commandSearchIndex = useMemo(() => {
    return commands.map(cmd => ({
      cmd,
      blob: `${cmd.label} ${cmd.description || ''} ${(cmd.keywords || []).join(' ')}`.toLowerCase(),
    }));
  }, [commands]);

  // Filter commands based on search + scope, then append the Squid AI row
  const flatCommands = useMemo((): CommandItem[] => {
    const q = normalizedSearchQuery;
    const showCmds = scope === 'all' || scope === 'commands';
    let list: CommandItem[];
    if (!q) {
      list = scope === 'commands' || (isMobile && scope === 'all') ? commands : fileSearchResults;
    } else {
      const cmdResults = showCmds ? commandSearchIndex.filter(item => item.blob.includes(q)).map(item => item.cmd) : [];
      list = [...fileSearchResults, ...cmdResults].slice(0, 80);
    }
    if (q) {
      list = [...list, {
        id: 'ask-ai',
        label: `Ask Squid AI “${deferredSearchQuery.trim()}”`,
        description: list.length ? 'Get an answer, or let Squid do it for you' : 'Nothing matches. Squid can help instead',
        icon: <Sparkles className="w-4 h-4" />,
        category: 'ai',
        action: () => askRef.current(deferredSearchQuery),
      }];
    }
    return list;
  }, [commands, normalizedSearchQuery, deferredSearchQuery, scope, isMobile, fileSearchResults, commandSearchIndex]);

  // Group filtered commands by category
  const groupedCommands = useMemo(() => {
    const groups = new Map<CommandCategory, CommandItem[]>();
    
    flatCommands.forEach(cmd => {
      if (!groups.has(cmd.category)) {
        groups.set(cmd.category, []);
      }
      groups.get(cmd.category)!.push(cmd);
    });
    
    return categoryOrder
      .filter(cat => groups.has(cat))
      .map(cat => ({
        category: cat,
        label: categoryLabels[cat],
        items: groups.get(cat)!,
      }));
  }, [flatCommands]);


  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSearchQuery(''); setSelectedIndex(0); setScope('all'); setMode('search'); setResponse(''); setShown('');
      const frame = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
  }, [open]);

  useEffect(() => setSelectedIndex(0), [scope]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (mode === 'ask') {
        if (e.key === 'Enter') { e.preventDefault(); askRef.current(); }
        else if (e.key === 'Tab') { e.preventDefault(); setMode('search'); setResponse(''); }
        else if (e.key === 'Escape') onOpenChange(false);
        return;
      }
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (!flatCommands.length && !searchQuery && scope === 'all') setScope('commands');
          else setSelectedIndex(prev => Math.min(prev + 1, flatCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          flatCommands[selectedIndex]?.action();
          break;
        case 'Tab':
          e.preventDefault();
          if (searchQuery.trim()) askRef.current(); else setMode('ask');
          break;
        case 'Backspace':
          // Only reset scope when the input is actually empty — never while typing
          if (!searchQuery && scope !== 'all') setScope('all');
          break;
        case 'Escape':
          onOpenChange(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, flatCommands, selectedIndex, onOpenChange, mode, scope, searchQuery]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    
    const selectedEl = list.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Keep selectedIndex in bounds
  useEffect(() => {
    if (selectedIndex >= flatCommands.length) {
      setSelectedIndex(Math.max(0, flatCommands.length - 1));
    }
  }, [flatCommands.length, selectedIndex]);

  let currentIndex = 0;
  const aiOn = mode === 'ask';
  const panelOpen = isMobile || aiOn || flatCommands.length > 0 || scope !== 'all';
  const tintFor = (cmd: CommandItem) => (DANGER.includes(cmd.id) ? TINT.danger : TINT[cmd.kind || cmd.category]);
  const labelWithMatch = (text: string) => {
    const q = normalizedSearchQuery;
    const i = q ? text.toLowerCase().indexOf(q) : -1;
    return i < 0 ? text : <>{text.slice(0, i)}<b>{text.slice(i, i + q.length)}</b>{text.slice(i + q.length)}</>;
  };
  const pickScope = (s: Scope) => { setMode('search'); setScope(prev => (prev === s && s !== 'all' ? 'all' : s)); inputRef.current?.focus(); };

  // Shared content for both mobile and desktop
  const commandContent = (
    <div className="spot-root" data-mobile={isMobile}>
      <style>{SQUID_CSS}</style>

      {/* Pill + round glass buttons (Commands / Files / Folders / Ask AI) */}
      <div className="spot-top">
        <div className="spot-glass spot-pill" data-ai={aiOn} data-busy={isLoading}>
          <span className="spot-lead">{aiOn ? <i className="spot-orb" data-busy={isLoading} /> : <Search className="w-5 h-5" />}</span>

          <input
            ref={inputRef}
            type="text"
            spellCheck={false}
            autoComplete="off"
            placeholder={aiOn ? 'Ask Squid AI…' : isMobile ? 'Search or ask…' : 'Search SquidCloud'}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSelectedIndex(0); if (mode === 'ask') { setMode('search'); setResponse(''); } }}
            className="spot-input"
            aria-label="Search files and commands, or ask Squid AI"
          />
          {searchQuery && (
            <button type="button" className="spot-clear" aria-label="Clear search"
              onClick={() => { setSearchQuery(''); setSelectedIndex(0); setResponse(''); setMode('search'); inputRef.current?.focus(); }}>
              <X className="w-4 h-4" />
            </button>
          )}
          {!isMobile && !!searchQuery && !aiOn && <span className="spot-hint">Ask <kbd>tab</kbd></span>}
        </div>
        {!isMobile ? (
          <div className="spot-orbs">
            <button type="button" className="spot-glass spot-round" data-on={scope === 'commands'} onClick={() => pickScope('commands')} aria-label="Commands" title="Commands"><Command className="w-5 h-5" /></button>
            <button type="button" className="spot-glass spot-round" data-on={scope === 'doc'} onClick={() => pickScope('doc')} aria-label="Files" title="Files"><FileText className="w-5 h-5" /></button>
            <button type="button" className="spot-glass spot-round" data-on={scope === 'folder'} onClick={() => pickScope('folder')} aria-label="Folders" title="Folders"><Folder className="w-5 h-5" /></button>
            <button type="button" className="spot-glass spot-round spot-ai" data-on={aiOn} onClick={() => { setMode(aiOn ? 'search' : 'ask'); inputRef.current?.focus(); }} aria-label="Ask Squid AI" title="Ask Squid AI"><Sparkles className="w-5 h-5" /></button>
          </div>
        ) : (
          <button type="button" className="spot-close" aria-label="Close search" onClick={() => onOpenChange(false)}><X className="w-5 h-5" /></button>
        )}
      </div>

      <div className="spot-glass spot-panel" data-open={panelOpen} data-ai={aiOn}>
        <div className="spot-clip">
          {!aiOn && (
            <>
              <div className="spot-chips" role="tablist">
                {SCOPES.map(s => (
                  <button key={s.id} type="button" role="tab" aria-selected={scope === s.id} data-on={scope === s.id}
                    onClick={() => { setScope(s.id); inputRef.current?.focus(); }}>{s.label}</button>
                ))}
              </div>

              {/* Results: grouped, one sliding selection thumb */}
              <div ref={listRef} className="spot-list">
                {groupedCommands.map((group) => (
                  <div key={group.category}>
                    {group.category !== 'ai' && <div className="spot-group-label">{group.label}</div>}
                    {group.items.map((cmd) => {
                      const itemIndex = currentIndex++;
                      const isSelected = !isMobile && itemIndex === selectedIndex;
                      return (
                        <motion.div
                          key={cmd.id}
                          data-index={itemIndex}
                          role="option"
                          aria-selected={isSelected}
                          onClick={cmd.action}
                          onMouseEnter={() => !isMobile && setSelectedIndex(itemIndex)}
                          whileTap={reduce ? undefined : { scale: 0.985 }}
                          className="spot-row"
                          data-selected={isSelected}
                        >
                          {isSelected && (
                            <motion.span
                              layoutId="sq-selected"
                              className="spot-row-thumb"
                              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 34, mass: 0.9 }}
                            />
                          )}
                          {cmd.category === 'ai' ? (
                            <span className="spot-ico spot-ico-ai"><i className="spot-orb" /></span>
                          ) : (
                            <span className="spot-ico" style={{ background: tintFor(cmd) }}>
                              {React.cloneElement(cmd.icon as React.ReactElement, { className: 'w-[19px] h-[19px] text-white' })}
                            </span>
                          )}
                          <span className="spot-main">
                            <span className="spot-label">{labelWithMatch(cmd.label)}</span>
                            {cmd.description && <span className="spot-desc">{cmd.description}</span>}
                          </span>
                          {!isMobile && cmd.shortcut && <kbd className="spot-kbd">{cmd.shortcut}</kbd>}
                          {!isMobile && isSelected && (cmd.category === 'ai'
                            ? <span className="spot-go">Ask <CornerDownLeft className="w-3.5 h-3.5" /></span>
                            : <CornerDownLeft className="spot-enter w-4 h-4 shrink-0" />)}
                          {isMobile && <ArrowRight className="spot-enter w-4 h-4 shrink-0" />}
                        </motion.div>
                      );
                    })}
                  </div>
                ))}

                {flatCommands.length === 0 && (
                  <div className="spot-empty" role="status">
                    <Search className="w-8 h-8 opacity-40" />
                    <p>Nothing here yet</p>
                    <span>{scope === 'all' ? 'Start typing to search' : 'Type to narrow down this filter'}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {aiOn && (
            <div className="spot-ask" role="status" aria-live="polite">
              {!response && !isLoading && (
                <div className="spot-ask-empty">
                  <i className="spot-orb big" />
                  <p>Ask about your files, or tell Squid what to do.</p>
                  <div className="spot-suggest">
                    {['Organize my files', 'Create a new folder', 'Generate README'].map(p => (
                      <button key={p} type="button" onClick={() => ask(p)}>{p}</button>
                    ))}
                  </div>
                </div>
              )}
              {steps.length > 0 && (
                <div className="spot-steps">
                  {steps.map((s, i) => (
                    <div key={i} className="spot-step" data-kind={s.kind} data-status={s.status || 'running'}>
                      <span className="spot-dot" />
                      {s.kind === 'tool' ? (
                        <>
                          <b>{s.label}</b>
                          {s.name && <span className="spot-step-args">{s.name}()</span>}
                          {s.detail && <span className="spot-step-args" style={{ marginLeft: 'auto' }}>{s.detail}</span>}
                        </>
                      ) : (
                        <span>{s.label}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {isLoading && <div className="spot-searching">Searching…</div>}
              {shown && <div className="spot-answer"><ReactMarkdown>{shown}</ReactMarkdown></div>}
            </div>
          )}
        </div>

        {/* Footer hints — desktop only */}
        {!isMobile && (
          <div className="spot-foot">
            <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
            <span><kbd>↵</kbd> {aiOn ? 'Send' : 'Run'}</span>
            <span><kbd>tab</kbd> {aiOn ? 'Back to search' : 'Ask Squid AI'}</span>
            <span><kbd>esc</kbd> Close</span>
          </div>
        )}
      </div>
    </div>
  );

  // Mobile: sheet from bottom, same glass language
  if (isMobile) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange}>
        <BottomSheetContent className="flex h-[85dvh] max-h-[85dvh] min-h-0 flex-col p-0 overflow-hidden">
          {commandContent}
        </BottomSheetContent>
      </BottomSheet>
    );
  }

  // Desktop: the search emerges from a small pill at the top, with a springy overshoot
  return (
    <AnimatePresence>
      {open && (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="spot-shell p-0 gap-0 [&>[data-slot='dialog-close']]:hidden">
            <motion.div
              style={{ transformOrigin: 'top center' }}
              initial={reduce ? false : { opacity: 0, scaleX: 0.4, scaleY: 0.55, y: -24, filter: 'blur(12px)' }}
              animate={{ opacity: 1, scaleX: 1, scaleY: 1, y: 0, filter: 'blur(0px)' }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 20, mass: 0.9 }}
            >
              {commandContent}
            </motion.div>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;

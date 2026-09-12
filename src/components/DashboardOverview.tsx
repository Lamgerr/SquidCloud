import React, { useMemo } from 'react';
import {
  Folder as FolderIcon, Search, Lock,
  ArrowUpRight, HardDrive, FileStack, Users,
} from '@/lib/icon-map';
import { StatsPanel } from '@/components/ui/StatsPanel';
import type { FileItem, FolderItem } from '@/lib/api';
import { formatFileSize } from '@/lib/utils';

/* ── Home overview: presentational only. All data + callbacks come
   from Dashboard state; nothing here fetches, mutates or stores. ── */

const MONO = { fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" };
const LIME = '#c8f04b';

interface OverviewProps {
  files: FileItem[];
  folders: FolderItem[];
  totalSize: number;
  displayName: string;
  planLabel: string;
  onFileClick: (f: FileItem) => void;
  onOpenFolder: (f: FolderItem) => void;
  onGoToTab: (tab: string) => void;
  onSearchOpen: () => void;
  onFilterChange?: (f: string) => void;
  activeFilter?: string;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* Restrained file-type coding — muted tint chip per family. */
function typeTint(name: string): { bg: string; fg: string; tag: string } {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['pdf'].includes(ext)) return { bg: 'rgba(248,113,113,0.12)', fg: '#f87171', tag: 'PDF' };
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'heic'].includes(ext)) return { bg: 'rgba(167,139,250,0.12)', fg: '#a78bfa', tag: 'IMG' };
  if (['mp4', 'mkv', 'mov', 'webm', 'avi'].includes(ext)) return { bg: 'rgba(96,165,250,0.12)', fg: '#60a5fa', tag: 'VID' };
  if (['mp3', 'wav', 'flac', 'ogg', 'm4a'].includes(ext)) return { bg: 'rgba(52,211,153,0.12)', fg: '#34d399', tag: 'AUD' };
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { bg: 'rgba(251,191,36,0.12)', fg: '#fbbf24', tag: 'ZIP' };
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'json', 'html', 'css'].includes(ext)) return { bg: 'rgba(200,240,75,0.10)', fg: '#c8f04b', tag: 'CODE' };
  if (['doc', 'docx', 'txt', 'md'].includes(ext)) return { bg: 'rgba(148,163,184,0.12)', fg: '#94a3b8', tag: 'DOC' };
  return { bg: 'rgba(255,255,255,0.06)', fg: '#a3a39a', tag: 'FILE' };
}

const Overview: React.FC<OverviewProps> = ({
  files, folders, totalSize, displayName, planLabel,
  onFileClick, onOpenFolder, onGoToTab, onSearchOpen,
  onFilterChange, activeFilter,
}) => {
  const recents = useMemo(
    () => [...files].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)).slice(0, 6),
    [files]
  );
  const recentFolders = useMemo(() => folders.slice(0, 4), [folders]);
  const sharedCount = useMemo(() => files.filter((f) => f.shared).length, [files]);
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const quickActions = [
    { id: 'files', label: 'Browse files', hint: `${files.length + folders.length} items`, icon: FileStack },
    { id: 'search', label: 'Search vault', hint: '⌘K', icon: Search },
    { id: 'shared', label: 'Shared', hint: `${sharedCount} links`, icon: Users },
    { id: 'secrets', label: 'Secrets', hint: 'sealed', icon: Lock },
  ];

  return (
    <div className="sq-tab-enter mx-auto w-full max-w-[1440px] space-y-8 px-4 py-6 lg:px-8 lg:py-8">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500" style={MONO}>{today}</p>
          <h1 className="mt-2 text-[26px] font-semibold tracking-tight text-foreground lg:text-[32px]">
            {greeting()}, {displayName}.
          </h1>
          <p className="mt-1.5 flex items-center gap-2 text-[13px] text-muted-foreground">
            <span className="sq-live-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: LIME }} />
            Vault sealed · {planLabel} plan · everything encrypted before upload
          </p>
        </div>
        <button
          onClick={onSearchOpen}
          className="sq-press flex h-10 items-center gap-2.5 rounded-full border border-border/70 bg-card/60 px-4 text-[13px] text-muted-foreground hover:border-white/20 hover:text-foreground"
        >
          <Search className="h-4 w-4" />
          <span>Search files…</span>
          <kbd className="rounded border border-border/70 bg-background px-1.5 py-0.5 font-mono text-[10px]" style={MONO}>⌘K</kbd>
        </button>
      </div>

      {/* Storage overview */}
      <section aria-label="Storage overview">
        <StatsPanel
          files={files}
          folders={folders}
          totalSize={totalSize}
          activeFilter={activeFilter}
          onFilterChange={onFilterChange}
        />
      </section>

      {/* Quick actions */}
      <section aria-label="Quick actions">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {quickActions.map((a) => (
            <button
              key={a.id}
              onClick={() => (a.id === 'search' ? onSearchOpen() : onGoToTab(a.id))}
              className="sq-press group flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-4 text-left hover:border-white/20"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.05]">
                <a.icon className="h-4 w-4 text-neutral-300" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-medium text-foreground">{a.label}</span>
                <span className="block font-mono text-[10.5px] text-muted-foreground" style={MONO}>{a.hint}</span>
              </span>
              <ArrowUpRight className="ml-auto h-3.5 w-3.5 shrink-0 text-neutral-600 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent files */}
        <section aria-label="Recent files" className="overflow-hidden rounded-xl border border-border/60 bg-card/60">
          <button
            onClick={() => onGoToTab('files')}
            className="flex w-full items-center justify-between px-5 pb-1 pt-4 text-left"
          >
            <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500" style={MONO}>Recent files</h2>
            <span className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
              View all <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </button>
          {recents.length === 0 ? (
            <p className="px-5 py-8 text-[13px] text-muted-foreground">
              Nothing here yet — upload your first sealed file to get started.
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.05] px-2 pb-2">
              {recents.map((f) => {
                const tint = typeTint(f.name);
                return (
                <li key={f.id}>
                  <button
                    onClick={() => onFileClick(f)}
                    className="sq-press flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-white/[0.04]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-[9px] font-bold" style={{ background: tint.bg, color: tint.fg, ...MONO }}>
                      {tint.tag}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-foreground">{f.name}</span>
                      <span className="block font-mono text-[10.5px] tabular-nums text-muted-foreground" style={MONO}>
                        {formatFileSize(f.size)} · {shortDate(f.updated_at)}{f.shared ? ' · shared' : ''}
                      </span>
                    </span>
                    {f.encrypted && <Lock className="h-3.5 w-3.5 shrink-0 text-neutral-600" />}
                  </button>
                </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Folders */}
        <section aria-label="Folders" className="overflow-hidden rounded-xl border border-border/60 bg-card/60">
          <button
            onClick={() => onGoToTab('files')}
            className="flex w-full items-center justify-between px-5 pb-1 pt-4 text-left"
          >
            <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500" style={MONO}>Folders</h2>
            <span className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
              View all <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </button>
          {recentFolders.length === 0 ? (
            <p className="px-5 py-8 text-[13px] text-muted-foreground">
              No folders yet — organize uploads into folders from the Files tab.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 p-4 pt-3 sm:grid-cols-2">
              {recentFolders.map((fd) => (
                <li key={fd.id}>
                  <button
                    onClick={() => onOpenFolder(fd)}
                    className="sq-press flex w-full items-center gap-3 rounded-lg border border-border/50 bg-background/60 p-3.5 text-left hover:border-white/20"
                  >
                    <FolderIcon className="h-5 w-5 shrink-0" style={{ color: LIME }} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-foreground">{fd.name}</span>
                      <span className="block truncate font-mono text-[10.5px] text-muted-foreground" style={MONO}>{fd.path || '/'}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {/* Storage note */}
          <div className="mx-4 mb-4 flex items-center gap-2.5 rounded-lg border border-border/50 bg-background/60 px-3.5 py-3">
            <HardDrive className="h-4 w-4 shrink-0 text-neutral-500" />
            <p className="font-mono text-[10.5px] leading-relaxed text-muted-foreground" style={MONO}>
              {formatFileSize(totalSize)} sealed across the pool · no node holds a complete file
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Overview;

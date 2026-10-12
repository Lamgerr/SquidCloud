import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Folder as FolderIcon, Search, Lock,
  ArrowUpRight, HardDrive, FileStack, Zap,
} from '@/lib/icon-map';
import { StatsPanel } from '@/components/ui/StatsPanel';
import { usePlanLimits } from '@/hooks/use-plan-limits';
import type { FileItem, FolderItem } from '@/lib/api';
import { formatFileSize } from '@/lib/utils';
import { cn } from '@/lib/utils';

/* ── Home overview: presentational only, except the plan-limits hook
   which owns its own fetch. All file data + callbacks come from
   Dashboard state; nothing here mutates or stores. ── */

const MONO = { fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" };

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
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'json', 'html', 'css'].includes(ext)) return { bg: 'hsl(var(--primary) / 0.12)', fg: 'hsl(var(--primary))', tag: 'CODE' };
  if (['doc', 'docx', 'txt', 'md'].includes(ext)) return { bg: 'rgba(148,163,184,0.12)', fg: '#94a3b8', tag: 'DOC' };
  return { bg: 'rgba(255,255,255,0.06)', fg: '#a3a39a', tag: 'FILE' };
}

const fadeUp = (delay: number): React.CSSProperties => ({
  animationDelay: `${delay}ms`,
});

function LimitBar({ value, max }: { value: number; max: number | null }) {
  if (max === null) {
    return (
      <div className="h-1 overflow-hidden rounded-full bg-muted/60" aria-hidden="true">
        <div className="h-full w-full rounded-full bg-primary/50" />
      </div>
    );
  }
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const hot = pct >= 90;
  return (
    <div className="h-1 overflow-hidden rounded-full bg-muted/60" role="progressbar" aria-valuenow={value} aria-valuemax={max} aria-label="Daily usage">
      <div
        className={cn('h-full rounded-full transition-[width] duration-700 ease-out', hot ? 'bg-amber-400' : 'bg-primary')}
        style={{ width: `${Math.max(pct, 2)}%` }}
      />
    </div>
  );
}

const Overview: React.FC<OverviewProps> = ({
  files, folders, totalSize, displayName, planLabel,
  onFileClick, onOpenFolder, onGoToTab, onSearchOpen,
  onFilterChange, activeFilter,
}) => {
  const limits = usePlanLimits();

  const recents = useMemo(
    () => [...files].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)).slice(0, 6),
    [files]
  );
  const recentFolders = useMemo(() => folders.slice(0, 4), [folders]);
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const activity = useMemo(() => {
    const days: Array<{ key: string; label: string; count: number; isToday: boolean }> = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const count = files.filter(f => f.created_at && f.created_at.startsWith(key)).length;
      days.push({
        key,
        label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        count,
        isToday: i === 0,
      });
    }
    const max = Math.max(1, ...days.map(d => d.count));
    const total = days.reduce((a, d) => a + d.count, 0);
    return { days, max, total };
  }, [files]);

  return (
    <div className="sq-tab-enter mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 lg:px-8 lg:py-8">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4 animate-fade-up [animation-fill-mode:both]" style={fadeUp(0)}>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500" style={MONO}>{today}</p>
          <h1 className="mt-2 text-[26px] font-semibold tracking-tight text-foreground lg:text-[32px]">
            {greeting()}, {displayName}.
          </h1>
          <p className="mt-1.5 flex items-center gap-2 text-[13px] text-muted-foreground">
            <span className="sq-live-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Vault sealed · {planLabel} plan · {files.length} files, {folders.length} folders
          </p>
        </div>
        <button
          onClick={onSearchOpen}
          className="sq-press flex h-10 items-center gap-2.5 rounded-full border border-border/70 bg-card/60 px-4 text-[13px] text-muted-foreground transition-all duration-150 hover:border-foreground/25 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <Search className="h-4 w-4" />
          <span>Search files…</span>
          <kbd className="rounded border border-border/70 bg-background px-1.5 py-0.5 font-mono text-[10px]" style={MONO}>⌘K</kbd>
        </button>
      </div>

      {/* Today: daily limits */}
      <section aria-label="Today's limits" className="animate-fade-up [animation-fill-mode:both]" style={fadeUp(60)}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-card/60 p-4 transition-colors duration-150 hover:border-border">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground" style={MONO}>Uploads today</span>
              <FileStack className="h-3.5 w-3.5 text-muted-foreground/70" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
              {limits ? limits.uploadsUsedToday : '—'}
              <span className="text-sm font-normal text-muted-foreground">
                {' '}of {limits ? (limits.dailyUploadLimit ?? '∞') : '—'}
              </span>
            </p>
            <div className="mt-3">
              {limits ? <LimitBar value={limits.uploadsUsedToday} max={limits.dailyUploadLimit} /> : <div className="h-1 rounded-full bg-muted/60 animate-pulse" />}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground/70">Resets midnight UTC</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card/60 p-4 transition-colors duration-150 hover:border-border">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground" style={MONO}>API calls today</span>
              <Zap className="h-3.5 w-3.5 text-muted-foreground/70" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
              {limits ? limits.apiUsedToday.toLocaleString() : '—'}
              <span className="text-sm font-normal text-muted-foreground">
                {' '}of {limits ? (limits.apiDaily?.toLocaleString() ?? '∞') : '—'}
              </span>
            </p>
            <div className="mt-3">
              {limits ? <LimitBar value={limits.apiUsedToday} max={limits.apiDaily} /> : <div className="h-1 rounded-full bg-muted/60 animate-pulse" />}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground/70">Resets midnight UTC</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card/60 p-4 transition-colors duration-150 hover:border-border">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground" style={MONO}>Plan</span>
              <HardDrive className="h-3.5 w-3.5 text-muted-foreground/70" />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground capitalize">{planLabel}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/80">
              {limits ? (
                limits.maxFileBytes !== null
                  ? <>Up to {formatFileSize(limits.maxFileBytes)} per file · {limits.concurrentUploads !== null ? `${limits.concurrentUploads} at once` : 'unlimited parallel'}</>
                  : <>Unlimited file size · unlimited parallel</>
              ) : 'Loading plan details…'}
            </p>
            {planLabel === 'Free' && (
              <Link to="/pricing" className="mt-1 inline-block text-[11px] font-medium text-primary hover:underline underline-offset-4">
                Compare plans
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Storage overview */}
      <section aria-label="Storage overview" className="animate-fade-up [animation-fill-mode:both]" style={fadeUp(120)}>
        <StatsPanel
          files={files}
          folders={folders}
          totalSize={totalSize}
          activeFilter={activeFilter}
          onFilterChange={onFilterChange}
        />
      </section>

      {/* Activity */}
      <section aria-label="Recent activity" className="overflow-hidden rounded-xl border border-border/60 bg-card/60 p-5 animate-fade-up [animation-fill-mode:both]" style={fadeUp(180)}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500" style={MONO}>Activity · 14 days</h2>
          <span className="text-[12px] tabular-nums text-muted-foreground">{activity.total} uploads</span>
        </div>
        <div className="mt-4 flex h-20 items-end gap-1" role="img" aria-label={`Upload activity, ${activity.total} files in the last 14 days`}>
          {activity.days.map((d, i) => (
            <div
              key={d.key}
              title={`${d.label}: ${d.count} upload${d.count === 1 ? '' : 's'}`}
              className={cn(
                'min-w-0 flex-1 rounded-sm transition-all duration-500',
                d.count === 0 ? 'bg-muted/50' : d.isToday ? 'bg-primary' : 'bg-primary/45 hover:bg-primary/70'
              )}
              style={{ height: `${d.count === 0 ? 4 : Math.max(8, Math.round((d.count / activity.max) * 100))}%`, transitionDelay: `${i * 18}ms` }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground/60" style={MONO} aria-hidden="true">
          <span>{activity.days[0]?.label}</span>
          <span>{activity.days[activity.days.length - 1]?.label}</span>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent files */}
        <section aria-label="Recent files" className="overflow-hidden rounded-xl border border-border/60 bg-card/60 animate-fade-up [animation-fill-mode:both]" style={fadeUp(240)}>
          <button
            onClick={() => onGoToTab('files')}
            className="flex w-full items-center justify-between px-5 pb-1 pt-4 text-left rounded-t-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40"
          >
            <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500" style={MONO}>Recent files</h2>
            <span className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
              View all <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </button>
          {recents.length === 0 ? (
            <p className="px-5 py-8 text-[13px] text-muted-foreground">
              Nothing here yet — upload your first sealed file to get started.
            </p>
          ) : (
            <ul className="divide-y divide-border/50 px-2 pb-2">
              {recents.map((f) => {
                const tint = typeTint(f.name);
                return (
                <li key={f.id}>
                  <button
                    onClick={() => onFileClick(f)}
                    className="sq-press flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-150 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40"
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
        <section aria-label="Folders" className="overflow-hidden rounded-xl border border-border/60 bg-card/60 animate-fade-up [animation-fill-mode:both]" style={fadeUp(300)}>
          <button
            onClick={() => onGoToTab('files')}
            className="flex w-full items-center justify-between px-5 pb-1 pt-4 text-left rounded-t-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40"
          >
            <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500" style={MONO}>Folders</h2>
            <span className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
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
                    className="sq-press flex w-full items-center gap-3 rounded-lg border border-border/50 bg-background/60 p-3.5 text-left transition-all duration-150 hover:border-foreground/25 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <FolderIcon className="h-5 w-5 shrink-0 text-primary" />
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

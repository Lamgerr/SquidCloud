import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Folder as FolderIcon, Search, Lock, ArrowUpRight,
  HardDrive, FileStack, Zap, Settings2, Check,
} from '@/lib/icon-map';
import { usePlanLimits } from '@/hooks/use-plan-limits';
import type { FileItem, FolderItem } from '@/lib/api';
import { formatFileSize } from '@/lib/utils';
import { cn } from '@/lib/utils';

/* ── Home overview — presentational.
      Monochromatic tier, spring physics, one lead element (the greeting).
      Preferences persist locally. All data comes from Dashboard state. ── */

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

/* Motion vocabulary — shared with the dock / segment */
const SPRING = { type: 'spring' as const, stiffness: 360, damping: 28, mass: 0.8 };
const PRESS = { scale: 0.97 };
const HOVER = { scale: 1.02 };

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
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* Monochrome file tag — no hue competition, just tone. */
function fileTag(name: string): string {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['pdf'].includes(ext)) return 'PDF';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'heic'].includes(ext)) return 'IMG';
  if (['mp4', 'mkv', 'mov', 'webm', 'avi'].includes(ext)) return 'VID';
  if (['mp3', 'wav', 'flac', 'ogg', 'm4a'].includes(ext)) return 'AUD';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'ZIP';
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'json', 'html', 'css'].includes(ext)) return 'CODE';
  if (['doc', 'docx', 'txt', 'md'].includes(ext)) return 'DOC';
  return 'FILE';
}

/* Persisted preferences */
function usePref(key: string, fallback: boolean) {
  const [v, setV] = useState(() => {
    try { const raw = localStorage.getItem(key); return raw === null ? fallback : raw === 'true'; }
    catch { return fallback; }
  });
  useEffect(() => { try { localStorage.setItem(key, String(v)); } catch { /* ignore */ } }, [key, v]);
  return [v, setV] as const;
}

function LimitBar({ value, max }: { value: number; max: number | null }) {
  const pct = max && max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="ov-bar-track" role="progressbar" aria-valuenow={value} aria-valuemax={max ?? undefined} aria-label="Daily usage">
      <motion.div className="ov-bar-fill" initial={false} animate={{ scaleX: Math.max(0.02, pct / 100) }}
        transition={{ type: 'spring', stiffness: 180, damping: 26 }} />
    </div>
  );
}

const Overview: React.FC<OverviewProps> = ({
  files, folders, totalSize, displayName, planLabel,
  onFileClick, onOpenFolder, onGoToTab, onSearchOpen,
}) => {
  const reduce = !!useReducedMotion();
  const limits = usePlanLimits();
  const [compact, setCompact] = usePref('sq.home.compact', false);
  const [showActivity, setShowActivity] = usePref('sq.home.activity', true);
  const [prefsOpen, setPrefsOpen] = useState(false);

  const recents = useMemo(
    () => [...files].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)).slice(0, compact ? 4 : 6),
    [files, compact]
  );
  const recentFolders = useMemo(() => folders.slice(0, compact ? 3 : 4), [folders, compact]);
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const activity = useMemo(() => {
    const days: Array<{ key: string; label: string; count: number; isToday: boolean }> = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const count = files.filter(f => f.created_at && f.created_at.startsWith(key)).length;
      days.push({ key, label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), count, isToday: i === 0 });
    }
    const max = Math.max(1, ...days.map(d => d.count));
    return { days, max, total: days.reduce((a, d) => a + d.count, 0) };
  }, [files]);

  const enter = (i: number) => reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 };
  const anim = (i: number) => reduce ? { duration: 0 } : { ...SPRING, delay: 0.03 * i };

  return (
    <div className="ov-root">
      <style>{OV_CSS}</style>

      {/* Lead: greeting */}
      <motion.div className="ov-lead" initial={enter(0)} animate={{ opacity: 1, y: 0 }} transition={anim(0)}>
        <div className="min-w-0">
          <p className="ov-kicker">{today}</p>
          <h1 className="ov-title">{greeting()}, {displayName}.</h1>
          <p className="ov-sub">
            <span className="ov-dot" aria-hidden="true" />
            Vault sealed · {planLabel} plan · {files.length} files, {folders.length} folders
          </p>
        </div>
        <div className="ov-lead-actions">
          <motion.button type="button" className="ov-pill" onClick={onSearchOpen}
            whileHover={reduce ? undefined : HOVER} whileTap={reduce ? undefined : PRESS}>
            <Search size={16} /> <span className="hidden sm:inline">Search files…</span>
            <kbd className="ov-kbd">⌘K</kbd>
          </motion.button>
          <motion.button type="button" className={cn('ov-pill ov-icon', prefsOpen && 'ov-on')}
            onClick={() => setPrefsOpen(o => !o)} aria-label="Home preferences" title="Preferences"
            aria-expanded={prefsOpen}
            whileHover={reduce ? undefined : HOVER} whileTap={reduce ? undefined : PRESS}>
            <Settings2 size={16} />
          </motion.button>
        </div>
      </motion.div>

      {/* Preferences sheet — springs open under the gear */}
      <AnimatePresence>
        {prefsOpen && (
          <motion.div className="ov-prefs" role="region" aria-label="Home preferences"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scaleY: 0.9 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }} exit={{ opacity: 0, y: -6, scaleY: 0.92 }}
            transition={reduce ? { duration: 0 } : SPRING}>
            <span className="ov-kicker">Preferences</span>
            <Toggle label="Compact lists" checked={compact} onChange={setCompact} reduce={reduce} />
            <Toggle label="Show activity" checked={showActivity} onChange={setShowActivity} reduce={reduce} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick actions */}
      <motion.div className="ov-actions" initial={enter(1)} animate={{ opacity: 1, y: 0 }} transition={anim(1)}>
        {[
          { id: 'files', label: 'Files', icon: <FileStack size={16} /> },
          { id: 'shared', label: 'Shared', icon: <ArrowUpRight size={16} /> },
          { id: 'analytics', label: 'Analytics', icon: <Zap size={16} /> },
        ].map(a => (
          <motion.button key={a.id} type="button" className="ov-pill ov-action" onClick={() => onGoToTab(a.id)}
            whileHover={reduce ? undefined : HOVER} whileTap={reduce ? undefined : PRESS}>
            {a.icon}<span>{a.label}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* Today — one calm surface, three inline metrics */}
      <motion.section className="ov-panel" aria-label="Today" initial={enter(2)} animate={{ opacity: 1, y: 0 }} transition={anim(2)}>
        <div className="ov-metric">
          <span className="ov-kicker">Uploads today</span>
          <p className="ov-value">{limits ? limits.uploadsUsedToday : '—'}<span className="ov-unit"> / {limits ? (limits.dailyUploadLimit ?? '∞') : '—'}</span></p>
          <LimitBar value={limits?.uploadsUsedToday ?? 0} max={limits?.dailyUploadLimit ?? null} />
        </div>
        <div className="ov-metric">
          <span className="ov-kicker">API calls today</span>
          <p className="ov-value">{limits ? limits.apiUsedToday.toLocaleString() : '—'}<span className="ov-unit"> / {limits ? (limits.apiDaily?.toLocaleString() ?? '∞') : '—'}</span></p>
          <LimitBar value={limits?.apiUsedToday ?? 0} max={limits?.apiDaily ?? null} />
        </div>
        <div className="ov-metric">
          <span className="ov-kicker">Plan</span>
          <p className="ov-value ov-cap">{planLabel}</p>
          <p className="ov-hint">
            {limits ? (limits.maxFileBytes !== null
              ? `${formatFileSize(limits.maxFileBytes)} per file · ${limits.concurrentUploads ?? 'unlimited'} parallel`
              : 'Unlimited file size · unlimited parallel') : 'Loading…'}
          </p>
          {planLabel === 'Free' && <Link to="/pricing" className="ov-link">Compare plans <ArrowUpRight size={12} /></Link>}
        </div>
      </motion.section>

      {/* Storage — single hairline bar */}
      <motion.section className="ov-panel ov-storage" aria-label="Storage" initial={enter(3)} animate={{ opacity: 1, y: 0 }} transition={anim(3)}>
        <div className="ov-storage-head">
          <span className="ov-kicker">Storage</span>
          <span className="ov-value">{formatFileSize(totalSize)}</span>
          <span className="ov-hint">{files.length} files · {folders.length} folders</span>
        </div>
        <div className="ov-bar-track"><motion.div className="ov-bar-fill" initial={false} animate={{ scaleX: 1 }} transition={{ type: 'spring', stiffness: 120, damping: 24 }} /></div>
        <p className="ov-hint">Sealed across the pool — no node holds a complete file.</p>
      </motion.section>

      {/* Activity */}
      {showActivity && (
        <motion.section className="ov-panel" aria-label="Recent activity" initial={enter(4)} animate={{ opacity: 1, y: 0 }} transition={anim(4)}>
          <div className="ov-row-head">
            <span className="ov-kicker">Activity · 14 days</span>
            <span className="ov-hint">{activity.total} uploads</span>
          </div>
          <div className="ov-chart" role="img" aria-label={`${activity.total} uploads in the last 14 days`}>
            {activity.days.map((d, i) => (
              <motion.span key={d.key} title={`${d.label}: ${d.count} upload${d.count === 1 ? '' : 's'}`}
                className={cn('ov-bar', d.isToday && 'ov-bar-today')}
                initial={reduce ? false : { scaleY: 0 }} animate={{ scaleY: 1 }}
                transition={reduce ? { duration: 0 } : { ...SPRING, delay: 0.015 * i }}
                style={{ height: `${d.count === 0 ? 6 : Math.max(10, Math.round((d.count / activity.max) * 100))}%` }} />
            ))}
          </div>
        </motion.section>
      )}

      {/* Recents + Folders */}
      <div className="ov-grid">
        <motion.section className="ov-panel" aria-label="Recent files" initial={enter(5)} animate={{ opacity: 1, y: 0 }} transition={anim(5)}>
          <button type="button" className="ov-row-head ov-head-btn" onClick={() => onGoToTab('files')}>
            <span className="ov-kicker">Recent files</span>
            <span className="ov-hint ov-more">View all <ArrowUpRight size={13} /></span>
          </button>
          {recents.length === 0 ? <p className="ov-empty">Nothing here yet — upload your first sealed file.</p> : (
            <ul className="ov-list">
              {recents.map(f => (
                <li key={f.id}>
                  <motion.button type="button" className="ov-list-row" onClick={() => onFileClick(f)}
                    whileHover={reduce ? undefined : { x: 2 }} whileTap={reduce ? undefined : PRESS}>
                    <span className="ov-tag">{fileTag(f.name)}</span>
                    <span className="ov-name">
                      <span className="truncate">{f.name}</span>
                      <span className="ov-hint">{formatFileSize(f.size)} · {shortDate(f.updated_at)}{f.shared ? ' · shared' : ''}</span>
                    </span>
                    {f.encrypted && <Lock size={13} className="ov-muted" />}
                  </motion.button>
                </li>
              ))}
            </ul>
          )}
        </motion.section>

        <motion.section className="ov-panel" aria-label="Folders" initial={enter(6)} animate={{ opacity: 1, y: 0 }} transition={anim(6)}>
          <button type="button" className="ov-row-head ov-head-btn" onClick={() => onGoToTab('files')}>
            <span className="ov-kicker">Folders</span>
            <span className="ov-hint ov-more">View all <ArrowUpRight size={13} /></span>
          </button>
          {recentFolders.length === 0 ? <p className="ov-empty">No folders yet — organize uploads in Files.</p> : (
            <ul className="ov-folder-grid">
              {recentFolders.map(fd => (
                <li key={fd.id}>
                  <motion.button type="button" className="ov-folder" onClick={() => onOpenFolder(fd)}
                    whileHover={reduce ? undefined : HOVER} whileTap={reduce ? undefined : PRESS}>
                    <FolderIcon size={17} />
                    <span className="truncate">{fd.name}</span>
                  </motion.button>
                </li>
              ))}
            </ul>
          )}
        </motion.section>
      </div>
    </div>
  );
};

function Toggle({ label, checked, onChange, reduce }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; reduce: boolean;
}) {
  return (
    <button type="button" className="ov-toggle" role="switch" aria-checked={checked}
      onClick={() => onChange(!checked)}>
      <span>{label}</span>
      <motion.span className={cn('ov-switch', checked && 'ov-switch-on')}
        animate={{ backgroundColor: checked ? 'var(--sa-text)' : 'rgba(232,231,225,0.10)' }}
        transition={reduce ? { duration: 0 } : SPRING}>
        <motion.span className="ov-knob" layout transition={reduce ? { duration: 0 } : SPRING}
          style={{ marginLeft: checked ? 14 : 2 }} />
      </motion.span>
    </button>
  );
}

export default Overview;

/* ── Styles: one near-black tier, hairline rules, mono micro-labels. ── */
const OV_CSS = `
.ov-root { display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 1180px; margin: 0 auto; padding: 14px 4px 96px; }
.ov-kicker { font: 500 10px/1.4 var(--sa-mono, ui-monospace, monospace); letter-spacing: 0.14em; text-transform: uppercase; color: var(--sa-mute); }
.ov-title { margin-top: 8px; font-size: 28px; font-weight: 400; letter-spacing: -0.025em; line-height: 1.15; color: var(--sa-text); }
.ov-sub { margin-top: 8px; display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--sa-text-2, var(--sa-mute)); }
.ov-dot { width: 6px; height: 6px; border-radius: 999px; background: var(--sa-ok, #8fc98f); }
.ov-lead { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; padding: 8px 2px 4px; }
.ov-lead-actions { display: flex; align-items: center; gap: 8px; flex: none; }
.ov-pill { display: inline-flex; align-items: center; gap: 9px; height: 38px; padding: 0 14px; border-radius: 999px;
  border: 1px solid var(--sa-line); background: color-mix(in srgb, var(--sa-bg-2, #141612) 88%, transparent);
  color: var(--sa-text); font-size: 13px; -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); cursor: pointer; }
.ov-pill:hover { border-color: var(--sa-line-2); }
.ov-icon { width: 38px; padding: 0; justify-content: center; }
.ov-on { border-color: var(--sa-text-2); }
.ov-kbd { font: 400 10px/1 var(--sa-mono, ui-monospace, monospace); padding: 3px 6px; border-radius: 4px;
  border: 1px solid var(--sa-line); color: var(--sa-mute); }
.ov-prefs { transform-origin: top right; margin: -4px 2px 0 auto; width: min(280px, 92vw); padding: 12px 14px;
  border: 1px solid var(--sa-line); border-radius: 12px; background: var(--sa-bg-2);
  box-shadow: 0 18px 40px -16px rgba(0,0,0,0.7); display: flex; flex-direction: column; gap: 8px; }
.ov-toggle { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%;
  padding: 6px 0; border: 0; background: none; color: var(--sa-text-2, var(--sa-text)); font-size: 12.5px; cursor: pointer; }
.ov-switch { position: relative; display: flex; align-items: center; width: 32px; height: 18px; border-radius: 999px; flex: none; }
.ov-knob { width: 14px; height: 14px; border-radius: 999px; background: var(--sa-bg); }
.ov-actions { display: flex; gap: 8px; padding: 2px; }
.ov-action { color: var(--sa-text-2, var(--sa-text)); }
.ov-panel { border: 1px solid var(--sa-line); border-radius: 12px; background: color-mix(in srgb, var(--sa-bg-2, #141612) 70%, transparent);
  padding: 18px; }
.ov-metric { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.ov-root > .ov-panel:first-of-type { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 22px; }
.ov-value { font-size: 22px; font-weight: 400; letter-spacing: -0.02em; color: var(--sa-text); line-height: 1.1; }
.ov-unit { font-size: 12px; color: var(--sa-mute); }
.ov-cap { text-transform: capitalize; }
.ov-hint { font-size: 11.5px; color: var(--sa-mute); line-height: 1.5; }
.ov-link { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; color: var(--sa-text); text-underline-offset: 4px; }
.ov-bar-track { height: 2px; width: 100%; border-radius: 2px; background: rgba(232,231,225,0.12); overflow: hidden; }
.ov-bar-fill { display: block; height: 100%; width: 100%; transform-origin: left; background: var(--sa-text); }
.ov-storage-head { display: flex; align-items: baseline; gap: 12px; }
.ov-storage-head .ov-value { font-size: 18px; }
.ov-storage .ov-bar-track { margin: 12px 0 8px; }
.ov-row-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; width: 100%; }
.ov-head-btn { border: 0; background: none; text-align: left; cursor: pointer; padding: 0; }
.ov-more { display: inline-flex; align-items: center; gap: 4px; }
.ov-chart { display: flex; align-items: flex-end; gap: 3px; height: 68px; margin-top: 14px; }
.ov-bar { flex: 1; min-width: 0; border-radius: 2px; transform-origin: bottom; background: rgba(232,231,225,0.18); }
.ov-bar-today { background: var(--sa-text); }
.ov-grid { display: grid; gap: 12px; grid-template-columns: 1fr; }
@media (min-width: 860px) { .ov-grid { grid-template-columns: 1.2fr 1fr; } }
.ov-list { list-style: none; margin: 12px 0 0; padding: 0; }
.ov-list-row { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 6px; border: 0; border-radius: 8px;
  background: none; text-align: left; cursor: pointer; color: var(--sa-text); }
.ov-list-row:hover { background: rgba(232,231,225,0.04); }
.ov-tag { display: grid; place-items: center; width: 34px; height: 30px; flex: none; border-radius: 6px;
  border: 1px solid var(--sa-line); font: 500 9px/1 var(--sa-mono, ui-monospace, monospace); color: var(--sa-mute); }
.ov-name { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; font-size: 12.5px; }
.ov-muted { color: var(--sa-mute); flex: none; }
.ov-empty { margin: 16px 0 4px; font-size: 12.5px; color: var(--sa-mute); }
.ov-folder-grid { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 8px; grid-template-columns: repeat(2, minmax(0,1fr)); }
.ov-folder { display: flex; align-items: center; gap: 9px; width: 100%; height: 40px; padding: 0 12px; border-radius: 8px;
  border: 1px solid var(--sa-line); background: rgba(232,231,225,0.02); color: var(--sa-text); font-size: 12.5px; cursor: pointer; }
@media (max-width: 620px) { .ov-root > .ov-panel:first-of-type { grid-template-columns: 1fr; gap: 16px; } .ov-title { font-size: 24px; } }
@media (prefers-reduced-motion: reduce) { .ov-pill, .ov-folder, .ov-list-row { transition-duration: 0.01ms !important; } }
`;

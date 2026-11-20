import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Search, Settings2, Lock } from '@/lib/icon-map';
import { usePlanLimits } from '@/hooks/use-plan-limits';
import type { FileItem, FolderItem } from '@/lib/api';
import { formatFileSize } from '@/lib/utils';
import { cn } from '@/lib/utils';

/* ── Home — extremely minimal. One header, one stat strip, one recent list.
      No banners, no explanatory copy, no decorative cards. ── */

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

const SPRING = { type: 'spring' as const, stiffness: 380, damping: 28, mass: 0.8 };
const TAP = { scale: 0.96 };

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
function tag(name: string): string {
  const e = (name.split('.').pop() || '').toLowerCase();
  if (['pdf'].includes(e)) return 'PDF';
  if (['png','jpg','jpeg','webp','gif','svg','heic'].includes(e)) return 'IMG';
  if (['mp4','mkv','mov','webm'].includes(e)) return 'VID';
  if (['mp3','wav','flac','ogg','m4a'].includes(e)) return 'AUD';
  if (['zip','rar','7z','tar','gz'].includes(e)) return 'ZIP';
  if (['ts','tsx','js','jsx','py','rs','go','json','html','css'].includes(e)) return 'CODE';
  return 'FILE';
}
function usePref(key: string, fallback: boolean) {
  const [v, setV] = useState(() => { try { const r = localStorage.getItem(key); return r === null ? fallback : r === 'true'; } catch { return fallback; } });
  useEffect(() => { try { localStorage.setItem(key, String(v)); } catch { /* ignore */ } }, [key, v]);
  return [v, setV] as const;
}

const Overview: React.FC<OverviewProps> = ({
  files, folders, totalSize, displayName,
  onFileClick, onSearchOpen,
}) => {
  const reduce = !!useReducedMotion();
  const limits = usePlanLimits();
  const [prefs, setPrefs] = useState(false);
  const [spark, setSpark] = usePref('sq.home.spark', true);

  const recents = useMemo(() => [...files].sort((a,b) => +new Date(b.updated_at) - +new Date(a.updated_at)).slice(0, 6), [files]);
  const sparkDays = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now); d.setDate(now.getDate() - (13 - i));
      const key = d.toISOString().split('T')[0];
      return files.filter(f => f.created_at && f.created_at.startsWith(key)).length;
    });
  }, [files]);
  const sparkMax = Math.max(1, ...sparkDays);

  const anim = (i: number) => reduce ? { duration: 0 } : { ...SPRING, delay: 0.03 * i };
  const enter = { opacity: 0, y: 10 };

  return (
    <div className="hm-root">
      <style>{HM_CSS}</style>

      {/* One lead row — greeting + search + preferences */}
      <motion.div className="hm-head" initial={reduce ? false : enter} animate={{ opacity: 1, y: 0 }} transition={anim(0)}>
        <div className="min-w-0">
          <p className="hm-kicker">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
          <h1 className="hm-title">{greeting()}, {displayName}.</h1>
        </div>
        <div className="hm-tools">
          <motion.button type="button" className="hm-icon" onClick={onSearchOpen} aria-label="Search" title="Search"
            whileTap={reduce ? undefined : TAP}>
            <Search size={17} />
          </motion.button>
          <motion.button type="button" className={cn('hm-icon', prefs && 'hm-icon-on')} onClick={() => setPrefs(p => !p)}
            aria-label="Preferences" aria-expanded={prefs} title="Preferences" whileTap={reduce ? undefined : TAP}>
            <Settings2 size={17} />
          </motion.button>
        </div>
      </motion.div>

      <AnimatePresence>
        {prefs && (
          <motion.div className="hm-prefs" initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scaleY: 0.9 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }} exit={{ opacity: 0, y: -6, scaleY: 0.92 }}
            transition={reduce ? { duration: 0 } : SPRING}>
            <button type="button" className="hm-toggle" role="switch" aria-checked={spark} onClick={() => setSpark(!spark)}>
              <span>Activity sparkline</span>
              <motion.span className={cn('hm-switch', spark && 'hm-switch-on')} layout transition={reduce ? { duration: 0 } : SPRING}>
                <motion.span className="hm-knob" layout transition={reduce ? { duration: 0 } : SPRING} style={{ marginLeft: spark ? 14 : 2 }} />
              </motion.span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stat strip — numbers only, no bars or explanations */}
      <motion.div className="hm-stats" initial={reduce ? false : enter} animate={{ opacity: 1, y: 0 }} transition={anim(1)}>
        {[
          ['Files', String(files.length)],
          ['Folders', String(folders.length)],
          ['Storage', formatFileSize(totalSize)],
          ['Uploads today', limits ? String(limits.uploadsUsedToday) : '—'],
        ].map(([k, v]) => (
          <div key={k} className="hm-stat">
            <span className="hm-stat-k">{k}</span>
            <span className="hm-stat-v">{v}</span>
          </div>
        ))}
        {spark && (
          <div className="hm-spark" role="img" aria-label="Upload activity, last 14 days">
            {sparkDays.map((n, i) => (
              <motion.span key={i} className="hm-spark-bar" initial={reduce ? false : { scaleY: 0 }} animate={{ scaleY: 1 }}
                transition={reduce ? { duration: 0 } : { ...SPRING, delay: 0.012 * i }}
                style={{ height: `${n === 0 ? 8 : Math.max(12, Math.round((n / sparkMax) * 100))}%` }} />
            ))}
          </div>
        )}
      </motion.div>

      {/* Recent files — one quiet list */}
      <motion.section className="hm-recent" aria-label="Recent files" initial={reduce ? false : enter} animate={{ opacity: 1, y: 0 }} transition={anim(2)}>
        <div className="hm-section-head">
          <span className="hm-kicker">Recent</span>
          <button type="button" className="hm-all" onClick={() => onSearchOpen()}>Search all</button>
        </div>
        {recents.length === 0 ? (
          <p className="hm-empty">Nothing yet.</p>
        ) : (
          <ul>
            {recents.map(f => (
              <li key={f.id}>
                <motion.button type="button" className="hm-row" onClick={() => onFileClick(f)}
                  whileHover={reduce ? undefined : { x: 2 }} whileTap={reduce ? undefined : TAP}>
                  <span className="hm-tag">{tag(f.name)}</span>
                  <span className="hm-name truncate">{f.name}</span>
                  <span className="hm-meta">{shortDate(f.updated_at)}</span>
                  {f.encrypted && <Lock size={12} className="hm-lock" />}
                </motion.button>
              </li>
            ))}
          </ul>
        )}
      </motion.section>
    </div>
  );
};

export default Overview;

const HM_CSS = `
.hm-root { display: flex; flex-direction: column; gap: 14px; width: 100%; max-width: 1080px; margin: 0 auto; padding: 16px 2px 96px; }
.hm-kicker { font: 500 10px/1.4 var(--sa-mono, ui-monospace, monospace); letter-spacing: 0.14em; text-transform: uppercase; color: var(--sa-mute); }
.hm-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
.hm-title { margin-top: 8px; font-size: 27px; font-weight: 400; letter-spacing: -0.025em; line-height: 1.15; color: var(--sa-text); }
.hm-tools { display: flex; gap: 8px; flex: none; }
.hm-icon { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 999px; border: 1px solid var(--sa-line);
  background: color-mix(in srgb, var(--sa-bg-2, #141612) 88%, transparent); color: var(--sa-text); cursor: pointer;
  -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); }
.hm-icon:hover { border-color: var(--sa-line-2); }
.hm-icon-on { border-color: var(--sa-text-2); }
.hm-prefs { transform-origin: top right; margin: -6px 0 0 auto; width: min(240px, 92vw); padding: 12px 14px;
  border: 1px solid var(--sa-line); border-radius: 10px; background: var(--sa-bg-2);
  box-shadow: 0 18px 40px -16px rgba(0,0,0,0.7); }
.hm-toggle { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%;
  border: 0; background: none; color: var(--sa-text-2, var(--sa-text)); font-size: 12.5px; cursor: pointer; }
.hm-switch { position: relative; width: 32px; height: 18px; border-radius: 999px; background: rgba(232,231,225,0.10); display: flex; align-items: center; flex: none; }
.hm-switch-on { background: var(--sa-text); }
.hm-knob { width: 14px; height: 14px; border-radius: 999px; background: var(--sa-bg); }
.hm-stats { display: flex; align-items: center; gap: 0; border: 1px solid var(--sa-line); border-radius: 10px;
  background: color-mix(in srgb, var(--sa-bg-2, #141612) 70%, transparent); padding: 14px 18px; min-height: 72px; }
.hm-stat { display: flex; flex-direction: column; gap: 6px; padding-right: 22px; margin-right: 22px; border-right: 1px solid var(--sa-line); min-width: 0; }
.hm-stat:last-of-type { border-right: 0; }
.hm-stat-k { font: 500 10px/1 var(--sa-mono, ui-monospace, monospace); letter-spacing: 0.1em; text-transform: uppercase; color: var(--sa-mute); white-space: nowrap; }
.hm-stat-v { font-size: 18px; font-weight: 400; letter-spacing: -0.02em; color: var(--sa-text); white-space: nowrap; }
.hm-spark { flex: 1; display: flex; align-items: flex-end; gap: 3px; height: 36px; min-width: 80px; margin-left: 4px; }
.hm-spark-bar { flex: 1; min-width: 0; border-radius: 2px; transform-origin: bottom; background: rgba(232,231,225,0.22); }
.hm-recent { border: 1px solid var(--sa-line); border-radius: 10px; background: color-mix(in srgb, var(--sa-bg-2, #141612) 70%, transparent); overflow: hidden; }
.hm-section-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px 10px; border-bottom: 1px solid var(--sa-line); }
.hm-all { border: 0; background: none; color: var(--sa-mute); font-size: 11.5px; cursor: pointer; }
.hm-all:hover { color: var(--sa-text); }
.hm-recent ul { list-style: none; margin: 0; padding: 6px; }
.hm-row { display: flex; align-items: center; gap: 12px; width: 100%; height: 40px; padding: 0 12px; border: 0; border-radius: 8px;
  background: none; color: var(--sa-text); cursor: pointer; text-align: left; }
.hm-row:hover { background: rgba(232,231,225,0.04); }
.hm-tag { display: grid; place-items: center; width: 30px; height: 26px; flex: none; border-radius: 6px;
  border: 1px solid var(--sa-line); font: 500 9px/1 var(--sa-mono, ui-monospace, monospace); color: var(--sa-mute); }
.hm-name { flex: 1; min-width: 0; font-size: 13px; }
.hm-meta { font: 400 10.5px/1 var(--sa-mono, ui-monospace, monospace); color: var(--sa-mute); flex: none; }
.hm-lock { color: var(--sa-mute); flex: none; }
.hm-empty { margin: 0; padding: 32px 18px; text-align: center; font-size: 12.5px; color: var(--sa-mute); }
@media (max-width: 640px) { .hm-title { font-size: 23px; } .hm-stats { flex-wrap: wrap; gap: 14px; } .hm-stat { border-right: 0; margin: 0; padding: 0; } .hm-spark { flex-basis: 100%; } }
@media (prefers-reduced-motion: reduce) { .hm-icon, .hm-row, .hm-switch { transition-duration: 0.01ms !important; } }
`;

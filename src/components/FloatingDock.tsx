/**
 * SquidCloud · Floating dock
 *
 *   ┌──────────────┐  ┌────┐
 *   │ ↑ Upload     │  │ +  │      bottom-right
 *   └──────────────┘  └────┘
 *        └ activity sheet extends upward on hover / while uploading
 *
 * House rules (see docs/UI-UX-STANDARD.md):
 *   - one surface tier: near-black glass, hairline rim, no white fill
 *   - motion is spring physics, never CSS easing theatre
 *   - one lead action (Upload); Create is the satellite
 *   - the dock owns transfer feedback: no duplicate toasts elsewhere
 *
 * Exports: FloatingDock, DropGlow, UploadOrb, GlassSegment, Icons, DOCK_CSS
 * Place at: src/components/FloatingDock.tsx
 */

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { backgroundUploadService } from '@/services/backgroundUpload';
import { FullScreenTransferModal } from './FullScreenTransferModal';
import { haptics } from '@/utils/mobile';

/* ── Icons (local, inline SVG, currentColor — never emoji) ──── */

type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };
const make =
  (paths: ReactNode) =>
  ({ size = 20, ...p }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
      {paths}
    </svg>
  );

const FOLDER = 'M3.5 7.5a2 2 0 0 1 2-2h3.2a2 2 0 0 1 1.6.8l.9 1.2h6.3a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2z';
const FILE = 'M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z';

export const Icons = {
  Upload: make(<><path d="M12 15.5V4.5" /><path d="m7.5 9 4.5-4.5L16.5 9" /><path d="M5 14.5V17a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 17v-2.5" /></>),
  Plus: make(<path d="M12 5v14M5 12h14" />),
  Folder: make(<path d={FOLDER} />),
  FolderPlus: make(<><path d={FOLDER} /><path d="M12 11.5v5M9.5 14h5" /></>),
  FolderUp: make(<><path d={FOLDER} /><path d="M12 16.5v-5M9.7 13.7 12 11.4l2.3 2.3" /></>),
  File: make(<><path d={FILE} /><path d="M14 3.5V8h4.5" /></>),
  FilePlus: make(<><path d={FILE} /><path d="M14 3.5V8h4.5" /><path d="M12 11.5v5M9.5 14h5" /></>),
  Branch: make(<><path d="M6 3v12" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></>),
  Inbox: make(<><path d="M3.5 13h5l1.5 2.5h4l1.5-2.5h5" /><path d="M5.6 5.6 3.5 13v4.5a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2V13l-2.1-7.4a2 2 0 0 0-1.9-1.1h-9a2 2 0 0 0-1.9 1.1z" /></>),
  Check: make(<path d="m5 12.5 4.5 4.5L19 7.5" />),
  CircleCheck: make(<><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12.3 2.4 2.4 4.6-4.9" /></>),
  Home: make(<><path d="M4 11 12 4l8 7" /><path d="M6 9.5V19a1 1 0 0 0 1 1h3.5v-5h3v5H17a1 1 0 0 0 1-1V9.5" /></>),
  ChevronLeft: make(<path d="m14.5 5.5-6.5 6.5 6.5 6.5" />),
  ChevronRight: make(<path d="m9.5 5.5 6.5 6.5-6.5 6.5" />),
  Grid: make(<><rect x="4.5" y="4.5" width="6" height="6" rx="1.6" /><rect x="13.5" y="4.5" width="6" height="6" rx="1.6" /><rect x="4.5" y="13.5" width="6" height="6" rx="1.6" /><rect x="13.5" y="13.5" width="6" height="6" rx="1.6" /></>),
  Dense: make(<>{[4.6, 10.3, 16].flatMap((y) => [4.6, 10.3, 16].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="3.4" height="3.4" rx="1" />))}</>),
  List: make(<><path d="M9.5 7h10M9.5 12h10M9.5 17h10" /><path d="M4.8 7h.01M4.8 12h.01M4.8 17h.01" /></>),
  Sort: make(<><path d="M8 19V5M4.5 8.5 8 5l3.5 3.5" /><path d="M16 5v14M12.5 15.5 16 19l3.5-3.5" /></>),
  Refresh: make(<><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" /></>),
  Search: make(<><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>),
  X: make(<path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />),
  Drive: make(<><rect x="3.5" y="13" width="17" height="6.5" rx="2" /><path d="M5.5 13 7.4 6.2a2 2 0 0 1 1.9-1.5h5.4a2 2 0 0 1 1.9 1.5L18.5 13" /><path d="M7.5 16.2h.01" /></>),
  Share: make(<><path d="M12 15V4.5M8 8l4-4 4 4" /><path d="M7 11.5H5.5A1.5 1.5 0 0 0 4 13v5a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 18v-5a1.5 1.5 0 0 0-1.5-1.5H17" /></>),
  Alert: make(<><circle cx="12" cy="12" r="8.5" /><path d="M12 8v4.5M12 15.8h.01" /></>),
  Pause: make(<><path d="M9 6v12M15 6v12" /></>),
  Play: make(<path d="m8 5.5 10 6.5-10 6.5z" />),
  Expand: make(<><path d="M9 4.5H4.5V9M15 4.5h4.5V9M9 19.5H4.5V15M15 19.5h4.5V15" /></>),
  Rotate: make(<><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" /></>),
  Trash: make(<><path d="M4.5 7h15M9 7V4.5h6V7M6.5 7l1 12.5h9L17.5 7" /></>),
};

/* ── Formatting ─────────────────────────────────────────────── */

const formatBytes = (n?: number) => {
  if (!n || !Number.isFinite(n)) return '0 B';
  if (n < 1024) return `${Math.round(n)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v >= 10 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
};
const formatEta = (ms?: number) => {
  if (!ms || ms <= 0) return '—';
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s left`;
  const m = Math.floor(s / 60);
  return `${m}m ${String(s % 60).padStart(2, '0')}s left`;
};
const formatSpeed = (bps?: number) => {
  if (!bps || bps <= 0) return '—';
  return `${formatBytes(bps)}/s`;
};

/* ── Upload activity (the merged transfer surface) ─────────── */

type DockTask = {
  id: string;
  name: string;
  size: number;
  progress: number;   // 0..1
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  speed?: string;
  eta?: number;
  error?: string;
};

function useUploadActivity() {
  const [tasks, setTasks] = useState<DockTask[]>([]);

  useEffect(() => {
    return backgroundUploadService.subscribe((list: any[]) => {
      const now = Date.now();
      setTasks(list.map((t) => {
        const raw = typeof t.progress === 'number' ? t.progress : 0;
        const p = Math.max(0, Math.min(1, raw > 1 ? raw / 100 : raw));
        const started = t.createdAt || now;
        const elapsed = Math.max(1000, now - started);
        const speedBytes = p > 0 && p < 1 ? ((t.file?.size || 0) * p) / (elapsed / 1000) : 0;
        return {
          id: t.id,
          name: t.file?.name || 'file',
          size: t.file?.size || 0,
          progress: p,
          status: t.status,
          speed: speedBytes ? formatSpeed(speedBytes) : undefined,
          eta: t.estimatedTimeRemaining,
          error: t.error,
        };
      }));
    });
  }, []);

  const active = tasks.some((t) => t.status === 'uploading' || t.status === 'pending');
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const failed = tasks.filter((t) => t.status === 'failed').length;
  const known = tasks.filter((t) => t.status !== 'failed');
  const overall = known.length && known.every((t) => t.progress != null)
    ? known.reduce((a, t) => a + t.progress, 0) / known.length
    : null;

  return { tasks, active, completed, failed, overall };
}

/* ── Pointer glint (specular highlight follows the cursor) ──── */

function useGlint<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const onPointerMove = useCallback((e: React.PointerEvent<T>) => {
    if (e.pointerType === 'touch') return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  }, []);
  return { ref, onPointerMove };
}

const buzz = () => { try { haptics.medium(); } catch { /* not a touch device */ } };

/* ── Dock ──────────────────────────────────────────────────── */

export interface DockAction {
  id: string;
  label: string;
  icon: ReactNode;
  run: () => void;
}

export interface FloatingDockProps {
  onUploadFiles: (files: File[]) => void;
  actions?: DockAction[];
  dragging?: boolean;
  hidden?: boolean;
  disabled?: boolean;
  onDisabledClick?: () => void;
}

const ROW = 56; // menu item height (44) + gap (12)

export function FloatingDock({ onUploadFiles, actions = [], dragging, hidden, disabled, onDisabledClick }: FloatingDockProps) {
  const reduce = !!useReducedMotion();
  const { tasks, active, completed, failed, overall } = useUploadActivity();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const wasBusy = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);
  const plusRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const upGlint = useGlint<HTMLButtonElement>();
  const plusGlint = useGlint<HTMLButtonElement>();

  useEffect(() => {
    if (active) { wasBusy.current = true; setDone(false); return; }
    if (wasBusy.current) {
      wasBusy.current = false;
      setDone(true);
      const t = window.setTimeout(() => setDone(false), 2400);
      return () => window.clearTimeout(t);
    }
  }, [active]);

  const items: DockAction[] = [
    ...actions,
    { id: 'upload-folder', label: 'Upload folder', icon: <Icons.FolderUp size={20} />, run: () => dirRef.current?.click() },
  ];

  const close = useCallback((refocus = false) => {
    setOpen(false);
    if (refocus) plusRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(true); }
    };
    window.addEventListener('keydown', onKey, true);
    const raf = requestAnimationFrame(() => itemRefs.current[0]?.focus());
    return () => { window.removeEventListener('keydown', onKey, true); cancelAnimationFrame(raf); };
  }, [open, close]);

  useEffect(() => {
    if (hidden || dragging) { setOpen(false); setPinned(false); }
  }, [hidden, dragging]);

  const pickFiles = () => {
    if (disabled) return onDisabledClick?.();
    buzz();
    fileRef.current?.click();
  };
  const togglePlus = () => {
    if (disabled) return onDisabledClick?.();
    buzz();
    setOpen((o) => !o);
  };
  const runItem = (a: DockAction) => { close(); window.setTimeout(a.run, 90); };

  const onMenuKey = (e: React.KeyboardEvent) => {
    const i = itemRefs.current.findIndex((el) => el === document.activeElement);
    if (e.key === 'ArrowUp') { e.preventDefault(); itemRefs.current[Math.min(items.length - 1, i + 1)]?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (i <= 0) plusRef.current?.focus(); else itemRefs.current[i - 1]?.focus(); }
    else if (e.key === 'Tab') close();
  };

  const state = disabled ? 'off' : dragging ? 'drag' : active ? 'busy' : done ? 'done' : 'idle';
  const jelly = reduce ? { duration: 0.01 } : { type: 'spring' as const, stiffness: 520, damping: 15, mass: 0.8 };
  const enter = reduce ? { duration: 0.01 } : { type: 'spring' as const, stiffness: 240, damping: 20 };
  const tab = hidden ? -1 : 0;
  const press = reduce ? undefined : { scaleX: 0.93, scaleY: 0.86 };
  const hoverFx = reduce ? undefined : { scale: 1.045 };

  // The activity sheet is the single source of transfer truth. It extends when
  // work is happening, or when the user hovers/focuses the dock.
  const showActivity = tasks.length > 0 && !hidden && (active || done || hover || pinned || showAll);
  const visibleTasks = useMemo(() => (showAll ? tasks : tasks.slice(0, 4)), [tasks, showAll]);

  const statusLine = active
    ? `${tasks.filter((t) => t.status === 'uploading' || t.status === 'pending').length} uploading`
    : failed ? `${failed} failed`
    : done || completed ? `${completed} complete`
    : '';

  return (
    <>
      <style>{DOCK_CSS}</style>

      <input ref={fileRef} type="file" multiple tabIndex={-1} style={{ display: 'none' }}
        onChange={(e) => { const picked = Array.from(e.target.files || []); e.target.value = ''; if (picked.length) onUploadFiles(picked); }} />
      <input ref={dirRef} type="file" multiple tabIndex={-1} style={{ display: 'none' }}
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        onChange={(e) => {
          const picked = Array.from(e.target.files || []);
          e.target.value = '';
          picked.forEach((f) => {
            const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
            if (rel) (f as File & { path?: string }).path = rel;
          });
          if (picked.length) onUploadFiles(picked);
        }} />

      <AnimatePresence>
        {open && (
          <motion.div key="scrim" className="sq-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }} onPointerDown={() => close()} />
        )}
      </AnimatePresence>

      <motion.div
        className="sq-dock"
        aria-hidden={hidden || undefined}
        initial={reduce ? false : { y: 70, opacity: 0, scaleX: 0.8, scaleY: 1.2 }}
        animate={hidden ? { y: 50, opacity: 0, scale: 0.9 } : { y: 0, opacity: 1, scaleX: 1, scaleY: 1, scale: 1 }}
        transition={{ ...enter, delay: hidden ? 0 : 0.15 }}
        style={{ pointerEvents: hidden ? 'none' : 'auto' }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* ── Activity sheet: extends out of the dock with spring physics ── */}
        <AnimatePresence>
          {showActivity && (
            <motion.div
              key="activity"
              className="sq-activity"
              role="region"
              aria-label="Upload activity"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 26, scale: 0.94, scaleY: 0.72 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, scaleY: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.96, scaleY: 0.8 }}
              transition={reduce ? { duration: 0.01 } : { type: 'spring', stiffness: 330, damping: 24, mass: 0.9 }}
              onMouseEnter={() => setPinned(true)}
              onMouseLeave={() => setPinned(false)}
            >
              <div className="sq-act-head">
                <span className="sq-act-kicker">Transfers</span>
                <span className="sq-act-status">{statusLine}</span>
                <div className="sq-act-tools">
                  {tasks.some((t) => t.status === 'uploading') && (
                    <button type="button" className="sq-act-tool" title="Pause" aria-label="Pause uploads" onClick={() => backgroundUploadService.pauseAll()}>
                      <Icons.Pause size={15} />
                    </button>
                  )}
                  {tasks.some((t) => t.status === 'pending') && (
                    <button type="button" className="sq-act-tool" title="Resume" aria-label="Resume uploads" onClick={() => backgroundUploadService.resumeAll()}>
                      <Icons.Play size={15} />
                    </button>
                  )}
                  <button type="button" className="sq-act-tool" title="Transfer center" aria-label="Open transfer center" onClick={() => setShowAll(true)}>
                    <Icons.Expand size={15} />
                  </button>
                </div>
              </div>

              <div className="sq-act-overall">
                <motion.div className="sq-act-bar" initial={false}
                  animate={{ scaleX: overall == null ? 0 : Math.max(0.02, overall) }}
                  transition={{ type: 'spring', stiffness: 180, damping: 26 }}
                  data-tone={failed && !active ? 'bad' : 'ok'} />
              </div>

              <div className="sq-act-list">
                <AnimatePresence initial={false}>
                  {visibleTasks.map((t) => {
                    const open = expandedId === t.id;
                    const activeRow = t.status === 'uploading' || t.status === 'pending';
                    return (
                      <motion.div
                        key={t.id}
                        layout
                        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scaleY: 0.8 }}
                        animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scaleY: 1 }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24, transition: { duration: 0.18 } }}
                        transition={{ type: 'spring', stiffness: 380, damping: 24 }}
                        className="sq-act-row"
                        onMouseEnter={() => setExpandedId(t.id)}
                        onMouseLeave={() => setExpandedId((id) => (id === t.id ? null : id))}
                      >
                        <div className="sq-act-rowmain">
                          <span className="sq-act-icon" data-state={t.status}>
                            {t.status === 'completed' ? <Icons.Check size={15} />
                              : t.status === 'failed' ? <Icons.Alert size={15} />
                              : activeRow ? <Icons.Upload size={15} /> : <Icons.File size={15} />}
                          </span>
                          <span className="sq-act-name" title={t.name}>{t.name}</span>
                          <motion.span className="sq-act-pct" key={activeRow ? 'p' : t.status}
                            initial={reduce ? {} : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.14 }} data-state={t.status}>
                            {activeRow ? `${Math.round(t.progress * 100)}%`
                              : t.status === 'completed' ? 'Done'
                              : t.status === 'failed' ? 'Failed' : 'Queued'}
                          </motion.span>
                        </div>
                        <div className="sq-act-rowbar">
                          <motion.span initial={false} animate={{ scaleX: Math.max(0.02, t.progress) }}
                            transition={{ type: 'spring', stiffness: 200, damping: 26 }}
                            data-state={t.status} />
                        </div>
                        {/* Full info on hover — springs open, no layout jump */}
                        <AnimatePresence initial={false}>
                          {open && (
                            <motion.div key="detail" className="sq-act-detail"
                              initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                              animate={reduce ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                              exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                              transition={{ type: 'spring', stiffness: 320, damping: 30 }}>
                              <div><span>Size</span><b>{formatBytes(t.size)}</b></div>
                              <div><span>Transferred</span><b>{formatBytes(t.size * t.progress)}</b></div>
                              <div><span>Speed</span><b>{t.speed || '—'}</b></div>
                              <div><span>Remaining</span><b>{activeRow ? formatEta(t.eta) : '—'}</b></div>
                              {t.error && <div className="sq-act-err"><span>Error</span><b>{t.error}</b></div>}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {tasks.length > 4 && !showAll && (
                  <button type="button" className="sq-act-more" onClick={() => setShowAll(true)}>+ {tasks.length - 4} more</button>
                )}
              </div>

              <div className="sq-act-foot">
                {failed > 0 && (
                  <button type="button" className="sq-act-btn" onClick={() => backgroundUploadService.retryFailed()}>
                    <Icons.Rotate size={14} /> Retry failed
                  </button>
                )}
                {completed > 0 && (
                  <button type="button" className="sq-act-btn quiet" onClick={() => backgroundUploadService.clearCompleted()}>
                    <Icons.Trash size={14} /> Clear done
                  </button>
                )}
                <span className="sq-act-hint">Hover a file for details</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload — the single lead action */}
        <div className="sq-slot" data-state={state}>
          <button ref={upGlint.ref} type="button" className="sq-hit" aria-label="Upload files" title="Upload"
            tabIndex={tab} onClick={pickFiles} onPointerMove={upGlint.onPointerMove}>
            <motion.span className="sq-face sq-pill" whileHover={hoverFx} whileTap={press}
              animate={{ scale: active ? 1.06 : 1 }} transition={jelly}>
              <span className="sq-glyph">
                <Icons.Upload className="sq-ico-up" size={20} />
                <svg className="sq-ico-ring" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="trk" cx="12" cy="12" r="10.5" />
                  <g transform="rotate(-90 12 12)">
                    <circle className="arc" cx="12" cy="12" r="10.5" strokeDasharray="66"
                      strokeDashoffset={66 * (1 - (overall ?? 0))} />
                  </g>
                </svg>
                <Icons.Check className="sq-ico-ok" size={20} />
              </span>
              <span className="sq-lab">
                <span>{active ? `${Math.round((overall ?? 0) * 100)}%` : done ? 'Done' : 'Upload'}</span>
              </span>
            </motion.span>
          </button>
        </div>

        {/* Create (+) — separate satellite circle */}
        <div className="sq-slot sq-plus" data-open={open} data-state={disabled ? 'off' : 'idle'}>
          <AnimatePresence>
            {open && (
              <motion.div key="menu" className="sq-menu" role="menu" aria-label="Create" onKeyDown={onMenuKey}>
                {items.map((a, i) => (
                  <motion.button key={a.id} ref={(el) => { itemRefs.current[i] = el; }} type="button" role="menuitem"
                    className="sq-hit sq-item" aria-label={a.label}
                    initial={reduce ? false : { opacity: 0, y: (i + 1) * ROW, scaleX: 0.55, scaleY: 1.55 }}
                    animate={{ opacity: 1, y: 0, scaleX: 1, scaleY: 1 }}
                    exit={{ opacity: 0, y: (i + 1) * ROW, scaleX: 0.6, scaleY: 0.7, transition: { duration: 0.2, delay: (items.length - 1 - i) * 0.02 } }}
                    transition={reduce ? { duration: 0.01 } : { type: 'spring', stiffness: 320, damping: 15, mass: 0.9, delay: i * 0.04 }}
                    onClick={() => runItem(a)}>
                    <span className="sq-tip">{a.label}</span>
                    <motion.span className="sq-face sq-round sq-sm" whileHover={hoverFx} whileTap={press} transition={jelly}>{a.icon}</motion.span>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <button ref={(el) => { plusRef.current = el; plusGlint.ref.current = el; }} type="button" className="sq-hit"
            aria-label="Create" aria-haspopup="menu" aria-expanded={open} title="Create"
            tabIndex={tab} onClick={togglePlus} onPointerMove={plusGlint.onPointerMove}>
            <motion.span className="sq-face sq-round" whileHover={hoverFx} whileTap={press} transition={jelly}>
              <Icons.Plus className="sq-ico-plus" size={22} />
            </motion.span>
          </button>
        </div>

        <span className="sq-sr" role="status" aria-live="polite">{statusLine}</span>
      </motion.div>

      <FullScreenTransferModal isOpen={showAll} onClose={() => setShowAll(false)} />
    </>
  );
}

/* ── Drop target: a dark glass droplet falls in ──────────────── */

export function DropGlow({ active }: { active: boolean }) {
  const reduce = !!useReducedMotion();
  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      <style>{DOCK_CSS}</style>
      <AnimatePresence>
        {active && (
          <motion.div className="sq-drop" role="status" aria-live="polite"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <motion.div className="sq-droplet"
              initial={reduce ? false : { y: '-46vh', scaleX: 0.5, scaleY: 1.9, opacity: 0 }}
              animate={{ y: 0, scaleX: 1, scaleY: 1, opacity: 1 }}
              exit={{ y: '-46vh', scaleX: 0.55, scaleY: 1.6, opacity: 0, transition: { duration: 0.32 } }}
              transition={reduce ? { duration: 0.01 } : { type: 'spring', stiffness: 140, damping: 12, mass: 1.1 }}>
              <span className="sq-ripple" /><span className="sq-ripple r2" />
              <span className="sq-face sq-orb sq-orb-lg"><Icons.Upload size={36} className="sq-bob" /></span>
            </motion.div>
            <span className="sq-sr">Drop to upload</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
}

/* ── Empty-state target ────────────────────────────────────── */

export function UploadOrb({ onClick, label = 'Upload files' }: { onClick: () => void; label?: string }) {
  const reduce = !!useReducedMotion();
  const glint = useGlint<HTMLButtonElement>();
  return (
    <div className="sq-slot sq-orb-slot" data-state="idle">
      <style>{DOCK_CSS}</style>
      <button ref={glint.ref} type="button" className="sq-hit" aria-label={label} title={label} onClick={onClick} onPointerMove={glint.onPointerMove}>
        <motion.span className="sq-face sq-orb"
          initial={reduce ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          whileHover={reduce ? undefined : { scale: 1.07 }} whileTap={reduce ? undefined : { scaleX: 0.92, scaleY: 0.84 }}
          transition={reduce ? { duration: 0.01 } : { type: 'spring', stiffness: 420, damping: 14, mass: 0.9 }}>
          <Icons.Upload size={30} className="sq-ico-up" />
        </motion.span>
      </button>
    </div>
  );
}

/* ── Icon-only segmented control ───────────────────────────── */

export interface GlassSegmentOption<T extends string> { value: T; label: string; icon: ReactNode; }

export function GlassSegment<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: GlassSegmentOption<T>[]; label: string;
}) {
  const id = useId();
  const reduce = !!useReducedMotion();
  return (
    <div className="sq-seg" role="group" aria-label={label}>
      <style>{DOCK_CSS}</style>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" className="sq-seg-b" aria-pressed={on} aria-label={o.label} title={o.label} onClick={() => onChange(o.value)}>
            {on && <motion.span layoutId={`seg-${id}`} className="sq-seg-thumb"
              transition={reduce ? { duration: 0.01 } : { type: 'spring', stiffness: 380, damping: 21, mass: 0.8 }} />}
            <motion.span className="sq-seg-i" whileTap={reduce ? undefined : { scale: 0.78 }} transition={{ type: 'spring', stiffness: 600, damping: 16 }}>{o.icon}</motion.span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Styles: restrained dark glass, one tier, hairline rim ──── */

export const SPRING = 'linear(0, 0.03, 0.107, 0.214, 0.337, 0.464, 0.586, 0.699, 0.797, 0.881, 0.948, 0.999, 1.037, 1.062, 1.077, 1.083, 1.083, 1.078, 1.07, 1.06, 1.05, 1.039, 1.029, 1.02, 1.013, 1.007, 1.002, 0.998, 0.996, 0.994, 0.993, 0.993, 0.993, 0.994, 0.995, 0.995, 0.996, 0.997, 1)';
export const JELLY = 'linear(0, 0.067, 0.235, 0.453, 0.681, 0.885, 1.047, 1.158, 1.218, 1.233, 1.215, 1.174, 1.122, 1.069, 1.022, 0.986, 0.961, 0.948, 0.946, 0.951, 0.961, 0.973, 0.985, 0.996, 1.004, 1.01, 1.012, 1.013, 1.011, 1.009, 1.006, 1.003, 1.001, 0.999, 0.998, 0.997, 0.997, 0.997, 1)';

const RIM_MASK = `
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;`;

export const DOCK_CSS = `
.sq-dock, .sq-orb-slot, .sq-drop, .sq-seg, .sq-scrim, .sq-activity {
  --lq-spring: cubic-bezier(0.34, 1.4, 0.64, 1);
  --lq-jelly: cubic-bezier(0.34, 1.56, 0.64, 1);
  --g-ink: #e8e7e1;
  --g-fill: rgba(13, 14, 13, 0.86);
  --g-line: rgba(232, 231, 225, 0.10);
  --g-rim: rgba(232, 231, 225, 0.16);
}
@supports (transition-timing-function: linear(0, 1)) {
  .sq-dock, .sq-orb-slot, .sq-drop, .sq-seg, .sq-scrim, .sq-activity { --lq-spring: ${SPRING}; --lq-jelly: ${JELLY}; }
}
.sq-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

/* placement */
.sq-dock { position: fixed; right: max(20px, env(safe-area-inset-right)); bottom: calc(20px + env(safe-area-inset-bottom) + var(--sq-dock-lift, 0px)); z-index: 45; display: flex; align-items: flex-end; gap: 10px; color: var(--g-ink); font-family: var(--sa-f, 'Hanken Grotesk', system-ui, -apple-system, sans-serif); -webkit-font-smoothing: antialiased; }
.sq-dock[data-hidden="true"] { pointer-events: none; }
.sq-scrim { position: fixed; inset: 0; z-index: 40; background: rgba(0, 0, 0, 0.28); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
.sq-slot { position: relative; display: grid; }

/* one tier: near-black glass, hairline rim, no white fill */
.sq-face { position: relative; display: flex; align-items: center; justify-content: center; height: 52px; border-radius: 999px; color: var(--g-ink);
  background: var(--g-fill); border: 1px solid var(--g-line);
  -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
  box-shadow: inset 0 1px 0 var(--g-rim), 0 12px 28px -14px rgba(0, 0, 0, 0.75);
  transition: padding 0.6s var(--lq-jelly), opacity 0.28s, border-color 0.2s; will-change: transform; }
.sq-face::before { content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1px; pointer-events: none; opacity: 0.55;
  background: conic-gradient(from 205deg at 50% 50%, var(--g-rim), transparent 80deg, transparent 160deg, var(--g-rim) 220deg, transparent 300deg, var(--g-rim));
  ${RIM_MASK} }
.sq-hit:hover .sq-face { border-color: rgba(232, 231, 225, 0.2); }
.sq-face > :not(.sq-face) { position: relative; z-index: 1; }
.sq-pill { padding: 0 22px 0 18px; gap: 10px; }
.sq-round { width: 52px; }
.sq-sm { width: 44px; height: 44px; }

/* buttons: visuals live on children so springs aren't fought by app transitions */
.sq-dock .sq-hit, .sq-orb-slot .sq-hit { transition: none !important; scale: none !important; position: relative; display: block; margin: 0; padding: 0; border: 0; background: none; color: inherit; font: inherit; cursor: pointer; border-radius: 999px; -webkit-tap-highlight-color: transparent; }
.sq-dock .sq-hit:focus-visible, .sq-orb-slot .sq-hit:focus-visible, .sq-activity button:focus-visible { outline: 2px solid rgba(232, 231, 225, 0.8); outline-offset: 3px; }
.sq-slot[data-state="off"] .sq-face { opacity: 0.45; }

/* upload label / glyph */
.sq-lab { display: grid; overflow: hidden; max-width: 96px; transition: max-width 0.6s var(--lq-jelly), opacity 0.25s; }
.sq-lab > span { font: 500 15px/1 var(--sa-f, 'Hanken Grotesk', system-ui, sans-serif); letter-spacing: -0.01em; white-space: nowrap; }
[data-state="busy"] .sq-lab, [data-state="drag"] .sq-lab, [data-state="done"] .sq-lab { opacity: 0.9; }
.sq-glyph { position: relative; display: grid; place-items: center; width: 24px; height: 24px; flex: none; }
.sq-glyph > svg { grid-area: 1 / 1; }
.sq-ico-up { transition: transform 0.6s var(--lq-jelly), opacity 0.25s; }
.sq-hit:hover .sq-ico-up { transform: translateY(-2px); }
[data-state="drag"] .sq-ico-up, .sq-bob { animation: sq-bob 1.1s ease-in-out infinite; }
.sq-ico-ring { width: 24px; height: 24px; opacity: 0; transition: opacity 0.3s; overflow: visible; }
.sq-ico-ring .trk { stroke: currentColor; stroke-width: 1.8; opacity: 0.18; }
.sq-ico-ring .arc { stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; transition: stroke-dashoffset 0.5s var(--lq-spring); }
[data-state="busy"] .sq-ico-ring { opacity: 1; }
[data-state="busy"] .sq-ico-up { transform: scale(0.5); }
.sq-ico-ok { opacity: 0; transform: scale(0.3); transition: opacity 0.2s, transform 0.7s var(--lq-jelly); }
[data-state="done"] .sq-ico-ok { opacity: 1; transform: scale(1); }
[data-state="done"] .sq-ico-up { opacity: 0; }
.sq-ico-plus { transition: transform 0.7s var(--lq-jelly); }
.sq-plus[data-open="true"] .sq-ico-plus { transform: rotate(135deg); }
@keyframes sq-spin { to { transform: rotate(360deg); } }
@keyframes sq-bob { 0%, 100% { transform: translateY(2px); } 50% { transform: translateY(-3px); } }

/* ── activity sheet (merged transfer panel) ── */
/* hover bridge: keeps the sheet open while the pointer crosses the 12px gap */
.sq-activity::after { content: ''; position: absolute; left: 0; right: 0; top: 100%; height: 14px; background: transparent; }
.sq-activity { position: absolute; right: 0; bottom: calc(100% + 12px); width: max-content; min-width: 300px; max-width: min(92vw, 360px);
  transform-origin: bottom right; padding: 14px 14px 10px;
  border-radius: 18px; border: 1px solid var(--g-line); background: var(--g-fill);
  -webkit-backdrop-filter: blur(22px); backdrop-filter: blur(22px);
  box-shadow: inset 0 1px 0 var(--g-rim), 0 24px 50px -18px rgba(0, 0, 0, 0.8);
  color: var(--g-ink); font-size: 13px; }
.sq-act-head { display: flex; align-items: center; gap: 10px; }
.sq-act-kicker { font: 500 10px/1 var(--sa-mono, ui-monospace, monospace); letter-spacing: 0.12em; text-transform: uppercase; color: rgba(232, 231, 225, 0.55); }
.sq-act-status { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: var(--g-ink); }
.sq-act-tools { display: flex; gap: 2px; }
.sq-act-tool { display: grid; place-items: center; width: 26px; height: 26px; border: 0; border-radius: 6px; background: transparent; color: rgba(232, 231, 225, 0.6); cursor: pointer; transition: background 0.2s, color 0.2s; }
.sq-act-tool:hover { background: rgba(232, 231, 225, 0.08); color: var(--g-ink); }
.sq-act-overall { height: 2px; margin: 12px 0 10px; border-radius: 2px; background: rgba(232, 231, 225, 0.12); overflow: hidden; }
.sq-act-bar { display: block; height: 100%; width: 100%; transform-origin: left; background: var(--g-ink); }
.sq-act-bar[data-tone="bad"] { background: #d98080; }
.sq-act-list { display: flex; flex-direction: column; gap: 2px; max-height: 248px; overflow-y: auto; scrollbar-width: thin; }
.sq-act-row { padding: 8px 6px; border-radius: 9px; transition: background 0.2s; }
.sq-act-row:hover { background: rgba(232, 231, 225, 0.045); }
.sq-act-rowmain { display: flex; align-items: center; gap: 9px; }
.sq-act-icon { display: grid; place-items: center; width: 22px; height: 22px; flex: none; border-radius: 6px; color: var(--g-ink); background: rgba(232, 231, 225, 0.08); }
.sq-act-icon[data-state="completed"] { color: #8fc98f; background: rgba(143, 201, 143, 0.12); }
.sq-act-icon[data-state="failed"] { color: #d98080; background: rgba(217, 128, 128, 0.12); }
.sq-act-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; }
.sq-act-pct { flex: none; font: 500 11px/1 var(--sa-mono, ui-monospace, monospace); color: rgba(232, 231, 225, 0.75); }
.sq-act-pct[data-state="completed"] { color: #8fc98f; }
.sq-act-pct[data-state="failed"] { color: #d98080; }
.sq-act-rowbar { height: 2px; margin: 7px 0 0 31px; border-radius: 2px; background: rgba(232, 231, 225, 0.1); overflow: hidden; }
.sq-act-rowbar > span { display: block; height: 100%; width: 100%; transform-origin: left; background: rgba(232, 231, 225, 0.7); }
.sq-act-rowbar > span[data-state="completed"] { background: #8fc98f; }
.sq-act-rowbar > span[data-state="failed"] { background: #d98080; }
.sq-act-detail { overflow: hidden; margin: 9px 0 2px 31px; display: grid; gap: 5px; }
.sq-act-detail > div { display: flex; justify-content: space-between; gap: 12px; font-size: 11.5px; }
.sq-act-detail span { color: rgba(232, 231, 225, 0.5); }
.sq-act-detail b { font: 500 11.5px/1.3 var(--sa-mono, ui-monospace, monospace); }
.sq-act-detail .sq-act-err b { color: #d98080; }
.sq-act-more { width: 100%; padding: 8px; border: 0; background: transparent; color: rgba(232, 231, 225, 0.55); font-size: 11px; cursor: pointer; }
.sq-act-more:hover { color: var(--g-ink); }
.sq-act-foot { display: flex; align-items: center; gap: 8px; margin-top: 10px; padding-top: 9px; border-top: 1px solid var(--g-line); }
.sq-act-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 9px; border: 1px solid var(--g-line); border-radius: 7px; background: rgba(232, 231, 225, 0.06); color: var(--g-ink); font-size: 11px; cursor: pointer; transition: background 0.2s; }
.sq-act-btn:hover { background: rgba(232, 231, 225, 0.12); }
.sq-act-btn.quiet { background: transparent; color: rgba(232, 231, 225, 0.6); }
.sq-act-hint { margin-left: auto; font-size: 10.5px; color: rgba(232, 231, 225, 0.4); }

/* create menu: droplets rise out of the + */
.sq-menu { position: absolute; right: 0; bottom: calc(100% + 14px); display: flex; flex-direction: column-reverse; align-items: flex-end; gap: 12px; padding-right: 4px; }
.sq-dock .sq-hit.sq-item { display: flex; align-items: center; gap: 12px; }
.sq-tip { padding: 8px 14px; border-radius: 999px; font: 500 13px/1 var(--sa-f, 'Hanken Grotesk', system-ui, sans-serif); white-space: nowrap; color: var(--g-ink);
  background: var(--g-fill); border: 1px solid var(--g-line); box-shadow: inset 0 1px 0 var(--g-rim), 0 8px 20px -8px rgba(0,0,0,0.6);
  opacity: 0; transform: translateX(10px) scale(0.92); transition: opacity 0.2s, transform 0.6s var(--lq-jelly); pointer-events: none; }
.sq-item:hover .sq-tip, .sq-item:focus-visible .sq-tip { opacity: 1; transform: none; }
@media (hover: none) { .sq-tip { opacity: 1; transform: none; } }

/* drop target */
.sq-drop { position: fixed; inset: 0; z-index: 100; pointer-events: none; display: grid; place-items: center; background: rgba(0,0,0,0.4); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
.sq-droplet { position: relative; width: 116px; height: 116px; }
.sq-ripple { position: absolute; inset: 0; border-radius: 999px; border: 1px solid rgba(232, 231, 225, 0.35); animation: sq-ripple 2.4s ease-out infinite; }
.sq-ripple.r2 { animation-delay: 1.2s; }
@keyframes sq-ripple { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(2.7); opacity: 0; } }
.sq-orb { width: 96px; height: 96px; }
.sq-orb-lg { width: 116px; height: 116px; }
.sq-orb-slot { display: inline-grid; }

/* icon-only segmented control */
.sq-seg { position: relative; display: inline-flex; gap: 2px; padding: 3px; border-radius: 999px;
  background: rgba(232, 231, 225, 0.07); border: 1px solid var(--g-line); -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
  box-shadow: inset 0 1px 0 var(--g-rim); }
.sq-seg-b { position: relative; display: grid; place-items: center; width: 38px; height: 30px; border: 0; border-radius: 999px; background: none; color: rgba(232, 231, 225, 0.55); cursor: pointer; -webkit-tap-highlight-color: transparent; transition: color 0.2s !important; scale: none !important; }
.sq-seg-b:hover, .sq-seg-b[aria-pressed="true"] { color: var(--g-ink); }
.sq-seg-thumb { position: absolute; inset: 0; border-radius: 999px; background: rgba(232, 231, 225, 0.11); box-shadow: inset 0 1px 0 var(--g-rim), 0 4px 12px -2px rgba(0,0,0,0.35); }
.sq-seg-i { position: relative; display: grid; place-items: center; }

@media (prefers-reduced-motion: reduce) {
  .sq-ripple, .sq-bob, [data-state="drag"] .sq-ico-up { animation: none !important; }
  .sq-face, .sq-lab, .sq-ico-plus, .sq-ico-ok { transition-duration: 0.01ms !important; }
}
`;

export default FloatingDock;

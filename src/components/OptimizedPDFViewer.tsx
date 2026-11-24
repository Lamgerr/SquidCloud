/**
 * OptimizedPDFViewer — macOS Preview-style PDF viewer.
 *
 *  • Continuous scroll (default), single page, or two-up. Scroll is virtualised: only pages near the
 *    viewport hold a canvas; zoom stretches the existing bitmap instantly and re-renders crisp after 140ms.
 *  • Chrome is a set of floating glass docks (no bars): sidebar+view / title+page / zoom+tools, a markup dock
 *    that drops in below, a transient page HUD, and a floating sidebar island (a bottom sheet on mobile).
 *  • Markup works like Preview: select text → highlight / underline / strike. Draw, Text, Note, Eraser, Undo/Redo.
 *    Annotations are stored in page-normalised, rotation-independent coordinates, so they follow zoom and rotate.
 *  • Everything springs: buttons squash, docks pop from their anchor, pages slide, the sheet is draggable.
 */
import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

if (typeof window !== 'undefined' && 'Worker' in window) {
  import('pdfjs-dist/build/pdf.worker.mjs?worker')
    .then((m) => { pdfjsLib.GlobalWorkerOptions.workerPort = new m.default(); })
    .catch(() => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    });
}

interface OptimizedPDFViewerProps {
  file: { id?: string; name: string; size?: number };
  blobUrl?: string | null;
  pdfBlob?: Blob | null;
  onClose?: () => void;
  onDownload?: () => void;
}

type Layout = 'scroll' | 'single' | 'dual';
type Theme = 'light' | 'sepia' | 'dark';
type ZoomMode = 'width' | 'page' | 'actual' | 'custom';
type Panel = 'thumbs' | 'outline' | 'notes' | 'marks';
type Menu = null | 'view' | 'zoom' | 'more';
type Tool = 'select' | 'highlight' | 'underline' | 'strike' | 'draw' | 'text' | 'note' | 'erase';
type Pt = { x: number; y: number };
type Rect = { x: number; y: number; w: number; h: number };
interface Ann {
  id: string; kind: 'highlight' | 'underline' | 'strike' | 'draw' | 'text' | 'note';
  page: number; color: string; rects?: Rect[]; pts?: Pt[]; x?: number; y?: number; text?: string; createdAt: number;
}
interface Mark { page: number; label: string }
interface OutlineNode { title: string; dest: any; items: OutlineNode[] }
type NewAnn = Omit<Ann, 'id' | 'createdAt'>;

const JELLY = { type: 'spring' as const, stiffness: 520, damping: 15, mass: 0.8 };
const POP = { type: 'spring' as const, stiffness: 380, damping: 17, mass: 0.9 };
const SOFT = { type: 'spring' as const, stiffness: 300, damping: 28, mass: 0.9 };
const GAP = 14, PAD = 28, SIDEBAR = 232, SIDE_INSET = SIDEBAR + 32;
const ZMIN = 0.25, ZMAX = 5;
const COLORS = ['#FFD60A', '#32D74B', '#64D2FF', '#FF6B9A', '#FF9F0A', '#BF5AF2'];
const FILTERS: Record<Theme, string> = { light: 'none', sepia: 'sepia(.38) saturate(1.05) brightness(.97)', dark: 'invert(.9) hue-rotate(180deg) contrast(.92)' };
const THEMES: { id: Theme; label: string; sw: string }[] = [
  { id: 'light', label: 'Light', sw: '#fff' }, { id: 'sepia', label: 'Sepia', sw: '#efe0bd' }, { id: 'dark', label: 'Dark', sw: '#1c1c1e' },
];

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const clamp01 = (n: number) => clamp(n, 0, 1);
const stop = (e: React.SyntheticEvent) => e.stopPropagation();
const uid = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* rotation-independent annotation space: store unrotated, rotate for display */
const rotPt = (p: Pt, r: number): Pt => (r === 90 ? { x: 1 - p.y, y: p.x } : r === 180 ? { x: 1 - p.x, y: 1 - p.y } : r === 270 ? { x: p.y, y: 1 - p.x } : p);
const rotRect = (q: Rect, r: number): Rect => {
  const a = rotPt({ x: q.x, y: q.y }, r), b = rotPt({ x: q.x + q.w, y: q.y + q.h }, r);
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
};

function loadPrefs() {
  try { return { theme: 'light' as Theme, layout: 'scroll' as Layout, sidebar: true, color: COLORS[0], ...JSON.parse(localStorage.getItem('pdv-prefs') || '{}') }; }
  catch { return { theme: 'light' as Theme, layout: 'scroll' as Layout, sidebar: true, color: COLORS[0] }; }
}

/* ── icons: 24px grid, 1.7 stroke, same language as the dock ── */
const G: Record<string, React.ReactNode> = {
  sidebar: <><rect x="3.5" y="5" width="17" height="14" rx="3.2" /><path d="M9.5 5v14" /></>,
  grid: <><rect x="4" y="4" width="6.6" height="6.6" rx="1.7" /><rect x="13.4" y="4" width="6.6" height="6.6" rx="1.7" /><rect x="4" y="13.4" width="6.6" height="6.6" rx="1.7" /><rect x="13.4" y="13.4" width="6.6" height="6.6" rx="1.7" /></>,
  list: <path d="M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01" />,
  bubble: <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4 3.5V16h-.5A2.5 2.5 0 0 1 5 13.5z" />,
  bookmark: <path d="M7.5 4.5h9a1 1 0 0 1 1 1V20l-5.5-3.8L6.5 20V5.5a1 1 0 0 1 1-1z" />,
  zin: <><circle cx="10.5" cy="10.5" r="6.2" /><path d="m15.2 15.2 4.8 4.8M8 10.5h5M10.5 8v5" /></>,
  zout: <><circle cx="10.5" cy="10.5" r="6.2" /><path d="m15.2 15.2 4.8 4.8M8 10.5h5" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.2" /><path d="m15.2 15.2 4.8 4.8" /></>,
  markup: <><circle cx="12" cy="12" r="8.5" /><path d="m8.6 15.4.7-3 4.9-4.9 2.3 2.3-4.9 4.9z" /></>,
  highlight: <path d="m13.6 5.6 4.8 4.8-7 7H6.6v-4.8zM4.5 20.5h15" />,
  underline: <path d="M7 5v6.4a5 5 0 0 0 10 0V5M5 20h14" />,
  strike: <path d="M5.5 12h13M16.5 8c-.4-1.7-2.2-3-4.4-3-2.3 0-4.1 1.2-4.1 3 0 1.6 1.2 2.4 4 3M8 16c.5 1.8 2.3 3 4.4 3 2.4 0 4.1-1.2 4.1-3.1 0-.9-.4-1.6-1.2-2.1" />,
  draw: <path d="m4.5 19.5.9-3.8L16.9 4.2a2 2 0 0 1 2.8 2.8L8.3 18.6zM14.6 6.5l2.9 2.9" />,
  text: <path d="M5 7V5.5h14V7M12 5.5v13M9.3 18.5h5.4" />,
  note: <><path d="M5.5 5h13a1 1 0 0 1 1 1v8.6l-5 4.9h-9a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /><path d="M19.5 14.6h-5v4.9" /></>,
  erase: <path d="M9 19.5h10M5.4 14.6l7.5-7.5a2 2 0 0 1 2.8 0l2.4 2.4a2 2 0 0 1 0 2.8L12.6 19.5H9.2L5.4 15.7a1.1 1.1 0 0 1 0-1.1zM9.5 10.5l5 5" />,
  undo: <path d="M9 6 4.5 10.5 9 15M5 10.5h8.5a5 5 0 0 1 0 10H10" />,
  redo: <path d="m15 6 4.5 4.5L15 15M19 10.5h-8.5a5 5 0 0 0 0 10H14" />,
  rotate: <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4" />,
  more: <path d="M5.5 12h.01M12 12h.01M18.5 12h.01" strokeWidth={3.2} />,
  single: <rect x="6.5" y="4" width="11" height="16" rx="2" />,
  scroll: <><rect x="6.5" y="2.8" width="11" height="8.2" rx="1.8" /><rect x="6.5" y="13" width="11" height="8.2" rx="1.8" /></>,
  dual: <><rect x="3.5" y="5.5" width="8" height="13" rx="1.8" /><rect x="12.5" y="5.5" width="8" height="13" rx="1.8" /></>,
  down: <path d="M12 4.5v10.5M7.5 11l4.5 4.5 4.5-4.5M5 19.5h14" />,
  full: <path d="M9 4.5H4.5V9M15 4.5h4.5V9M9 19.5H4.5V15M15 19.5h4.5V15" />,
  exit: <path d="M9 4.5V9H4.5M15 4.5V9h4.5M9 19.5V15H4.5M15 19.5V15h4.5" />,
  x: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  up: <path d="m6 14.5 6-6 6 6" />, dn: <path d="m6 9.5 6 6 6-6" />,
  left: <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />, right: <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  copy: <><rect x="8.5" y="8.5" width="11" height="11" rx="2.4" /><path d="M15.5 8.5v-1a2.4 2.4 0 0 0-2.4-2.4H7.4A2.4 2.4 0 0 0 5 7.5v5.7a2.4 2.4 0 0 0 2.4 2.4h1.1" /></>,
  alert: <><circle cx="12" cy="12" r="8.5" /><path d="M12 8v4.5M12 15.8h.01" /></>,
};
const Ico: React.FC<{ n: string; size?: number; fill?: boolean }> = ({ n, size = 20, fill }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{G[n]}</svg>
);

const Btn: React.FC<{ label: string; onClick: (e: React.MouseEvent) => void; reduce: boolean; on?: boolean; size?: number; disabled?: boolean; children: React.ReactNode }> =
  ({ label, onClick, reduce, on, size = 38, disabled, children }) => (
    <motion.button type="button" className="pdv-btn" data-on={on} aria-label={label} title={label} aria-pressed={on} disabled={disabled}
      style={{ width: size, height: size }} onClick={(e) => { e.stopPropagation(); onClick(e); }}
      whileHover={reduce || disabled ? undefined : { scale: 1.1 }} whileTap={reduce || disabled ? undefined : { scaleX: 0.88, scaleY: 0.8 }}
      transition={reduce ? { duration: 0.01 } : JELLY}>{children}</motion.button>
  );
const Pop: React.FC<{ origin: string; dy?: number; className?: string; reduce: boolean; children: React.ReactNode }> = ({ origin, dy = -8, className, reduce, children }) => (
  <motion.div className={cn('pdv-g pdv-pop', className)} data-pdv-pop role="menu" style={{ transformOrigin: origin }} onClick={stop} onPointerDown={stop}
    initial={reduce ? false : { opacity: 0, scale: 0.84, y: dy }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: dy / 2 }}
    transition={reduce ? { duration: 0.01 } : POP}>{children}</motion.div>
);
const Row: React.FC<{ label: string; checked?: boolean; hint?: string; sw?: string; onClick: () => void; disabled?: boolean }> = ({ label, checked, hint, sw, onClick, disabled }) => (
  <button type="button" role="menuitem" className="pdv-row" onClick={onClick} disabled={disabled}>
    <span className="pdv-chk">{checked && <Ico n="check" size={15} />}</span>
    {sw && <i className="pdv-sw" style={{ background: sw }} />}
    <span className="pdv-rl">{label}</span>{hint && <span className="pdv-hint">{hint}</span>}
  </button>
);

/* ═══════════════ one page: bitmap + text layer + annotation layer ═══════════════ */

function markHits(el: HTMLElement | null, q: string) {
  if (!el) return;
  const n = q.trim().toLowerCase();
  el.querySelectorAll('span').forEach((s) => s.classList.toggle('pdv-hit', !!n && (s.textContent || '').toLowerCase().includes(n)));
}

interface PageProps {
  doc: pdfjsLib.PDFDocumentProxy; num: number; w: number; h: number; scale: number; rotation: number; theme: Theme;
  query: string; tool: Tool; color: string; anns: Ann[];
  onAdd: (a: NewAnn) => string; onUpdate: (id: string, p: Partial<Ann>) => void; onRemove: (id: string) => void; reduce: boolean;
}
const PageView = memo(function PageView(p: PageProps) {
  const { doc, num, w, h, scale, rotation, tool } = p;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const queryRef = useRef(p.query); queryRef.current = p.query;
  const [renderScale, setRenderScale] = useState(scale);
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState<Pt[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {   // zoom: stretch instantly, re-render crisp once it settles
    if (renderScale === scale) return;
    const t = setTimeout(() => setRenderScale(scale), 140);
    return () => clearTimeout(t);
  }, [scale, renderScale]);

  useEffect(() => {
    let cancelled = false; let task: pdfjsLib.RenderTask | null = null;
    (async () => {
      try {
        const page = await doc.getPage(num);
        let k = Math.min(window.devicePixelRatio || 1, 2) * renderScale;
        let vp = page.getViewport({ scale: k, rotation });
        if (vp.width * vp.height > 12e6) { k *= Math.sqrt(12e6 / (vp.width * vp.height)); vp = page.getViewport({ scale: k, rotation }); }   // iOS canvas ceiling
        const off = document.createElement('canvas');
        off.width = Math.ceil(vp.width); off.height = Math.ceil(vp.height);
        const octx = off.getContext('2d', { alpha: false }); if (!octx) return;
        task = page.render({ canvasContext: octx, viewport: vp }); await task.promise;
        if (cancelled || !canvasRef.current) return;
        const c = canvasRef.current; c.width = off.width; c.height = off.height;   // swap in one go: no blank frame
        c.getContext('2d')!.drawImage(off, 0, 0); setReady(true);

        const tc = await page.getTextContent().catch(() => null);
        const el = textRef.current; if (cancelled || !tc || !el) return;
        const tv = page.getViewport({ scale: renderScale, rotation });
        el.replaceChildren(); el.style.width = `${tv.width}px`; el.style.height = `${tv.height}px`;
        el.style.setProperty('--scale-factor', String(renderScale)); el.style.setProperty('--total-scale-factor', String(renderScale));
        const lib = pdfjsLib as any;
        if (typeof lib.renderTextLayer === 'function') lib.renderTextLayer({ textContentSource: tc, container: el, viewport: tv });
        else if (lib.TextLayer) await new lib.TextLayer({ textContentSource: tc, container: el, viewport: tv }).render();
        markHits(el, queryRef.current);
      } catch (e: any) { if (e?.name !== 'RenderingCancelledException') console.error(e); }
    })();
    return () => { cancelled = true; try { task?.cancel(); } catch { /* done */ } };
  }, [doc, num, renderScale, rotation]);
  useEffect(() => { markHits(textRef.current, p.query); }, [p.query]);

  const toNorm = (e: { clientX: number; clientY: number }): Pt => {
    const r = layerRef.current!.getBoundingClientRect();
    const q = { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) };
    return rotPt(q, (360 - rotation) % 360);
  };
  const active = tool === 'draw' || tool === 'text' || tool === 'note';
  const erase = tool === 'erase';
  const stroke = (pts: Pt[]) => pts.map((q) => { const r = rotPt(q, rotation); return `${r.x},${r.y}`; }).join(' ');

  return (
    <div className="pdv-page" data-pdv-page={num} style={{ width: w, height: h, ['--pdv-s' as any]: scale }}>
      <canvas ref={canvasRef} className="pdv-canvas" data-ready={ready} style={{ filter: FILTERS[p.theme] }} />
      <div className="pdv-textwrap" style={{ transform: `scale(${scale / renderScale})` }}><div ref={textRef} className="pdv-text" /></div>
      <svg className="pdv-svg" viewBox="0 0 1 1" preserveAspectRatio="none">
        {p.anns.map((a) => {
          const kill = erase ? { onClick: () => p.onRemove(a.id), style: { pointerEvents: 'all' as const, cursor: 'pointer' } } : {};
          if (a.kind === 'highlight') return a.rects!.map((q, i) => { const r = rotRect(q, rotation); return <rect key={a.id + i} x={r.x} y={r.y} width={r.w} height={r.h} fill={a.color} opacity={0.42} style={{ mixBlendMode: 'multiply', ...(kill as any).style }} onClick={(kill as any).onClick} />; });
          if (a.kind === 'underline' || a.kind === 'strike') return a.rects!.map((q, i) => { const r = rotRect(q, rotation); const y = a.kind === 'underline' ? r.y + r.h * 0.94 : r.y + r.h * 0.54;
            return <line key={a.id + i} x1={r.x} x2={r.x + r.w} y1={y} y2={y} stroke={a.color} strokeWidth={erase ? 12 : 1.7} strokeLinecap="round" vectorEffect="non-scaling-stroke" style={erase ? (kill as any).style : undefined} onClick={(kill as any).onClick} />; });
          if (a.kind === 'draw') return <polyline key={a.id} points={stroke(a.pts!)} fill="none" stroke={a.color} strokeWidth={erase ? 12 : 2.6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={erase ? (kill as any).style : undefined} onClick={(kill as any).onClick} />;
          return null;
        })}
        {draft && <polyline points={stroke(draft)} fill="none" stroke={p.color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
      </svg>
      {p.anns.filter((a) => a.kind === 'text' || a.kind === 'note').map((a) => {
        const q = rotPt({ x: a.x!, y: a.y! }, rotation);
        const pos = { left: `${q.x * 100}%`, top: `${q.y * 100}%` };
        if (a.kind === 'text') return (
          <div key={a.id} className="pdv-ann pdv-textbox" contentEditable suppressContentEditableWarning spellCheck={false} style={{ ...pos, color: a.color }}
            ref={(el) => { if (el && editing === a.id) { el.focus(); setEditing(null); } }}
            onPointerDown={(e) => { e.stopPropagation(); if (erase) p.onRemove(a.id); }}
            onBlur={(e) => { const t = e.currentTarget.innerText.trim(); if (t) p.onUpdate(a.id, { text: t }); else p.onRemove(a.id); }}>{a.text}</div>);
        return (
          <div key={a.id} className="pdv-ann pdv-note" style={pos} onPointerDown={stop}>
            <motion.button type="button" aria-label="Note" style={{ color: a.color }} whileTap={p.reduce ? undefined : { scaleX: 0.85, scaleY: 0.75 }} transition={JELLY}
              onClick={() => (erase ? p.onRemove(a.id) : setEditing(editing === a.id ? null : a.id))}><Ico n="note" size={22} fill /></motion.button>
            <AnimatePresence>
              {editing === a.id && (
                <motion.textarea className="pdv-g pdv-notebox" autoFocus defaultValue={a.text} placeholder="Note" onBlur={(e) => { p.onUpdate(a.id, { text: e.target.value }); setEditing(null); }}
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={POP} style={{ transformOrigin: 'top left' }} />
              )}
            </AnimatePresence>
          </div>);
      })}
      <div ref={layerRef} className="pdv-layer" data-tool={tool} style={{ pointerEvents: active ? 'auto' : 'none', touchAction: tool === 'draw' ? 'none' : 'auto' }}
        onPointerDown={(e) => {
          if (tool === 'draw') { e.currentTarget.setPointerCapture(e.pointerId); setDraft([toNorm(e)]); }
          else if (tool === 'text' || tool === 'note') {
            const q = toNorm(e);
            const id = p.onAdd({ kind: tool, page: num, color: p.color, x: q.x, y: q.y, text: '' });
            setEditing(id);
          }
        }}
        onPointerMove={(e) => { if (draft) { const q = toNorm(e), l = draft[draft.length - 1]; if (Math.hypot(q.x - l.x, q.y - l.y) > 0.0015) setDraft([...draft, q]); } }}
        onPointerUp={() => { if (draft && draft.length > 1) p.onAdd({ kind: 'draw', page: num, color: p.color, pts: draft }); setDraft(null); }}
        onPointerCancel={() => setDraft(null)} />
      {!ready && <div className="pdv-skel" aria-hidden="true" />}
    </div>
  );
}, (a, b) => a.doc === b.doc && a.num === b.num && a.w === b.w && a.h === b.h && a.scale === b.scale && a.rotation === b.rotation && a.theme === b.theme &&
  a.query === b.query && a.tool === b.tool && a.color === b.color && a.anns === b.anns);

/* ═══════════════ sidebar bits ═══════════════ */

const THUMB_W = 150;
const Thumb = memo(function Thumb({ doc, num, ar, active, marked, onGo }: { doc: pdfjsLib.PDFDocumentProxy; num: number; ar: number; active: boolean; marked: boolean; onGo: () => void }) {
  const box = useRef<HTMLButtonElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const el = box.current; if (!el || done) return;
    let dead = false;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.disconnect();
      (async () => {
        const page = await doc.getPage(num);
        const k = (THUMB_W * Math.min(window.devicePixelRatio || 1, 2)) / page.getViewport({ scale: 1 }).width;
        const vp = page.getViewport({ scale: k }); const c = cv.current; if (!c || dead) return;
        c.width = vp.width; c.height = vp.height;
        await page.render({ canvasContext: c.getContext('2d', { alpha: false })!, viewport: vp }).promise;
        if (!dead) setDone(true);
      })().catch(() => {});
    }, { rootMargin: '240px' });
    io.observe(el);
    return () => { dead = true; io.disconnect(); };
  }, [doc, num, done]);
  return (
    <button ref={box} type="button" className="pdv-thumb" data-active={active} onClick={onGo} aria-label={`Page ${num}`}>
      <span className="pdv-thumbimg" style={{ aspectRatio: String(ar) }}><canvas ref={cv} data-done={done} />{marked && <i className="pdv-ribbon"><Ico n="bookmark" size={14} fill /></i>}</span>
      <span className="pdv-thumbnum">{num}</span>
    </button>
  );
});
const OutlineList: React.FC<{ items: OutlineNode[]; onJump: (d: any) => void; depth?: number }> = ({ items, onJump, depth = 0 }) => (
  <>{items.map((it, i) => (
    <React.Fragment key={i}>
      <button type="button" className="pdv-ol" style={{ paddingLeft: 10 + depth * 14 }} onClick={() => onJump(it.dest)}>{it.title}</button>
      {it.items?.length > 0 && <OutlineList items={it.items} onJump={onJump} depth={depth + 1} />}
    </React.Fragment>))}</>
);

/* ═══════════════ viewer ═══════════════ */

export default function OptimizedPDFViewer({ file, blobUrl, pdfBlob, onDownload }: OptimizedPDFViewerProps) {
  const reduce = !!useReducedMotion();
  const sheetCtl = useDragControls();
  const docId = file.id || file.name;
  const prefs = useRef(loadPrefs());
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const textCache = useRef(new Map<number, string[]>());
  const searchTok = useRef(0);
  const anchorRef = useRef<{ cx: number; cy: number; px: number; py: number; r: number } | null>(null);

  const [doc, setDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sizes, setSizes] = useState<{ w: number; h: number }[]>([]);
  const [outline, setOutline] = useState<OutlineNode[]>([]);
  const [box, setBox] = useState({ w: 1000, h: 700 });
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [dir, setDir] = useState(1);
  const [scale, setScale] = useState(1);
  const [fitted, setFitted] = useState(false);
  const [zoomMode, setZoomMode] = useState<ZoomMode>('width');
  const [rotation, setRotation] = useState(0);
  const [layout, setLayout] = useState<Layout>(prefs.current.layout);
  const [theme, setTheme] = useState<Theme>(prefs.current.theme);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => prefs.current.sidebar && (typeof window === 'undefined' || window.innerWidth >= 720));
  const [panel, setPanel] = useState<Panel>('thumbs');
  const [menu, setMenu] = useState<Menu>(null);
  const [markup, setMarkup] = useState(false);
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState<string>(prefs.current.color);
  const [palette, setPalette] = useState(false);
  const [anns, setAnns] = useState<Ann[]>([]);
  const [undoS, setUndoS] = useState<Ann[][]>([]);
  const [redoS, setRedoS] = useState<Ann[][]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<{ page: number; k: number }[]>([]);
  const [hitIdx, setHitIdx] = useState(0);
  const [range, setRange] = useState<[number, number]>([0, 6]);
  const [fs, setFs] = useState(false);
  const [idle, setIdle] = useState(false);
  const [scrollHidden, setScrollHidden] = useState(false);
  const [hud, setHud] = useState(false);
  const [selBox, setSelBox] = useState<{ x: number; y: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const compact = box.w < 720;
  const n = doc?.numPages ?? 0;
  const topInset = compact ? 62 : 78, botInset = compact ? 92 : 84;
  const inset = sidebarOpen && !compact ? SIDE_INSET : 0;
  const availW = box.w - inset;
  const scaleRef = useRef(scale); scaleRef.current = scale;
  const pageRef = useRef(page); pageRef.current = page;
  const dim = useCallback((i: number) => { const s = sizes[i] || sizes[0] || { w: 612, h: 792 }; return rotation % 180 ? { w: s.h, h: s.w } : s; }, [sizes, rotation]);

  /* prefs + per-document persistence */
  useEffect(() => { try { localStorage.setItem('pdv-prefs', JSON.stringify({ theme, layout, sidebar: box.w < 720 ? prefs.current.sidebar : sidebarOpen, color })); } catch { /* quota */ } }, [theme, layout, sidebarOpen, color, box.w]);
  useEffect(() => {
    try { const raw = JSON.parse(localStorage.getItem(`pdv:${docId}`) || 'null'); setAnns(raw?.anns || []); setMarks(raw?.marks || []); } catch { setAnns([]); setMarks([]); }
    setUndoS([]); setRedoS([]);
  }, [docId]);
  useEffect(() => { const t = setTimeout(() => { try { localStorage.setItem(`pdv:${docId}`, JSON.stringify({ anns, marks })); } catch { /* quota */ } }, 400); return () => clearTimeout(t); }, [anns, marks, docId]);

  useLayoutEffect(() => {
    const el = rootRef.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el); setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [loading, error]);

  /* load document (same sources as before) + measure every page lazily so scroll height is exact */
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true); setError(null); setDoc(null); setFitted(false); textCache.current.clear();
      try {
        let task: pdfjsLib.PDFDocumentLoadingTask;
        if (pdfBlob) task = pdfjsLib.getDocument({ data: new Uint8Array(await pdfBlob.arrayBuffer()) });
        else if (blobUrl && blobUrl.startsWith('blob:')) task = pdfjsLib.getDocument({ data: new Uint8Array(await (await fetch(blobUrl)).arrayBuffer()) });
        else if (blobUrl) task = pdfjsLib.getDocument({ url: blobUrl });
        else throw new Error('No PDF payload available');
        const d = await task.promise; if (!active) return;
        const p1 = (await d.getPage(1)).getViewport({ scale: 1 });
        setSizes(Array.from({ length: d.numPages }, () => ({ w: p1.width, h: p1.height })));
        setDoc(d); setPage(1); setPageInput('1'); setRotation(0); setLoading(false);
        d.getOutline().then((o) => active && setOutline((o as OutlineNode[]) || [])).catch(() => {});
        const real = Array.from({ length: d.numPages }, () => ({ w: p1.width, h: p1.height }));
        let changed = false;
        for (let i = 2; i <= d.numPages && active; i++) {
          const v = (await d.getPage(i)).getViewport({ scale: 1 });
          if (Math.abs(v.width - real[i - 1].w) > 0.5 || Math.abs(v.height - real[i - 1].h) > 0.5) { real[i - 1] = { w: v.width, h: v.height }; changed = true; }
          if (changed && (i % 24 === 0 || i === d.numPages)) { setSizes(real.slice()); changed = false; }
        }
      } catch (err: any) { if (active) { setError(err?.message || 'Failed to load PDF.'); setLoading(false); } }
    })();
    return () => { active = false; };
  }, [blobUrl, pdfBlob, docId]);

  /* geometry for continuous scroll */
  const geo = useMemo(() => {
    const tops: number[] = [], hs: number[] = []; let y = topInset, maxW = 0;
    for (let i = 0; i < n; i++) { const d = dim(i), w = d.w * scale, h = d.h * scale; tops.push(y); hs.push(h); y += h + GAP; maxW = Math.max(maxW, w); }
    return { tops, hs, total: y - GAP + botInset, maxW };
  }, [n, dim, scale, topInset, botInset]);
  const geoRef = useRef(geo); geoRef.current = geo;

  const computeFit = useCallback((mode: ZoomMode) => {
    const d = dim(0), aw = availW - PAD * 2, ah = box.h - topInset - botInset;
    const cols = layout === 'dual' ? 2 : 1, spreadW = d.w * cols + (cols - 1) * GAP;
    if (mode === 'actual') return 1;
    const byW = aw / spreadW, byH = ah / d.h;
    return clamp(mode === 'page' || layout !== 'scroll' && mode !== 'width' ? Math.min(byW, byH) : byW, ZMIN, ZMAX);
  }, [dim, availW, box.h, topInset, botInset, layout]);

  const setAnchor = (px: number, py: number, next: number) => {
    const el = scrollerRef.current; if (!el) return;
    anchorRef.current = { cx: el.scrollLeft + px, cy: el.scrollTop + py, px, py, r: next / scaleRef.current };
  };
  useLayoutEffect(() => {
    const a = anchorRef.current, el = scrollerRef.current;
    if (a && el) { el.scrollLeft = a.cx * a.r - a.px; el.scrollTop = a.cy * a.r - a.py; }
    anchorRef.current = null;
  }, [scale]);

  useEffect(() => {   // fit modes follow the container; debounced so the sidebar spring doesn't thrash
    if (!doc || !sizes[0] || zoomMode === 'custom') return;
    const t = setTimeout(() => {
      const s = computeFit(zoomMode);
      if (Math.abs(s - scaleRef.current) > 0.002) { const el = scrollerRef.current; if (el) setAnchor(el.clientWidth / 2, el.clientHeight / 2, s); setScale(s); }
      setFitted(true);
    }, fitted ? 120 : 0);
    return () => clearTimeout(t);
  }, [doc, zoomMode, computeFit, sizes, fitted]);

  const zoomBy = useCallback((f: number, at?: { x: number; y: number }) => {
    const el = scrollerRef.current; const next = clamp(scaleRef.current * f, ZMIN, ZMAX);
    if (el) { const r = el.getBoundingClientRect(); setAnchor(at ? at.x - r.left : el.clientWidth / 2, at ? at.y - r.top : el.clientHeight / 2, next); }
    setZoomMode('custom'); setScale(next);
  }, []);

  /* navigation */
  const step = layout === 'dual' ? 2 : 1;
  const scrollToPage = useCallback((num: number, smooth = true) => {
    const el = scrollerRef.current, g = geoRef.current; if (!el || !g.tops[num - 1]) return;
    el.scrollTo({ top: Math.max(0, g.tops[num - 1] - topInset + 14), behavior: smooth && !reduce ? 'smooth' : 'auto' });
  }, [topInset, reduce]);
  const goTo = useCallback((num: number) => {
    const t = clamp(Math.round(num) || 1, 1, Math.max(1, n));
    if (layout === 'scroll') { setPage(t); setPageInput(String(t)); scrollToPage(t); }
    else { const s = layout === 'dual' && t % 2 === 0 ? t - 1 : t; setDir(s >= pageRef.current ? 1 : -1); setPage(s); setPageInput(String(s)); }
    setHud(true);
  }, [n, layout, scrollToPage]);
  useEffect(() => { setPageInput(String(page)); }, [page]);
  useEffect(() => {   // changing layout keeps the page you were on
    if (!doc) return;
    if (layout === 'scroll') requestAnimationFrame(() => scrollToPage(pageRef.current, false));
    else setPage((p) => (layout === 'dual' && p % 2 === 0 ? p - 1 : p));
  }, [layout, doc, scrollToPage]);
  useEffect(() => { if (!hud) return; const t = setTimeout(() => setHud(false), 1800); return () => clearTimeout(t); }, [hud, page]);

  const jumpOutline = async (dest: any) => {
    if (!doc || !dest) return;
    try {
      const d = typeof dest === 'string' ? await doc.getDestination(dest) : dest;
      if (d && d[0]) { goTo((await doc.getPageIndex(d[0])) + 1); if (compact) setSidebarOpen(false); }
    } catch { /* bad destination */ }
  };

  /* virtual window + current page from scroll position */
  const lastY = useRef(0);
  const syncScroll = useCallback(() => {
    const el = scrollerRef.current; if (!el || layout !== 'scroll') return;
    const { tops, hs } = geoRef.current; if (!tops.length) return;
    const st = el.scrollTop, vh = el.clientHeight;
    let lo = 0, hi = tops.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (tops[mid] <= st + vh * 0.35) lo = mid; else hi = mid - 1; }
    if (lo + 1 !== pageRef.current) { setPage(lo + 1); setHud(true); }
    let a = 0; while (a < tops.length - 1 && tops[a] + hs[a] < st - vh) a++;
    let b = a; while (b < tops.length - 1 && tops[b + 1] < st + vh * 2) b++;
    setRange((r) => (r[0] === a && r[1] === b ? r : [a, b]));
    const dy = st - lastY.current;
    if (Math.abs(dy) > 14) { setScrollHidden(dy > 0 && st > 60); lastY.current = st; }
  }, [layout]);
  useEffect(() => {
    const el = scrollerRef.current; if (!el) return;
    let raf = 0; const on = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; syncScroll(); }); };
    el.addEventListener('scroll', on, { passive: true });
    return () => { el.removeEventListener('scroll', on); cancelAnimationFrame(raf); };
  }, [syncScroll, loading]);
  useEffect(() => { syncScroll(); }, [geo, syncScroll]);

  /* annotations */
  const annsRef = useRef(anns); annsRef.current = anns;
  const commit = useCallback((next: Ann[] | ((l: Ann[]) => Ann[])) => {
    const cur = annsRef.current, val = typeof next === 'function' ? next(cur) : next;
    setUndoS((u) => [...u.slice(-30), cur]); setRedoS([]); annsRef.current = val; setAnns(val);
  }, []);
  const addAnn = useCallback((a: NewAnn) => { const id = uid(); commit((l) => [...l, { ...a, id, createdAt: Date.now() }]); return id; }, [commit]);
  const updAnn = useCallback((id: string, patch: Partial<Ann>) => setAnns((l) => l.map((a) => (a.id === id ? { ...a, ...patch } : a))), []);
  const delAnn = useCallback((id: string) => commit((l) => l.filter((a) => a.id !== id)), [commit]);
  const undo = () => { if (!undoS.length) return; const prev = undoS[undoS.length - 1]; setRedoS((r) => [...r, annsRef.current]); annsRef.current = prev; setAnns(prev); setUndoS((u) => u.slice(0, -1)); };
  const redo = () => { if (!redoS.length) return; const next = redoS[redoS.length - 1]; setUndoS((u) => [...u, annsRef.current]); annsRef.current = next; setAnns(next); setRedoS((r) => r.slice(0, -1)); };
  const pageAnns = useMemo(() => { const m = new Map<number, Ann[]>(); for (const a of anns) { const l = m.get(a.page); if (l) l.push(a); else m.set(a.page, [a]); } return m; }, [anns]);
  const NONE = useMemo<Ann[]>(() => [], []);

  /* text selection → markup (Preview behaviour): pick a tool, select text, it's marked */
  const selectionRects = useCallback((kind: 'highlight' | 'underline' | 'strike') => {
    const sel = window.getSelection(); if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !rootRef.current) return 0;
    const range = sel.getRangeAt(0), byPage = new Map<number, Rect[]>();
    rootRef.current.querySelectorAll<HTMLElement>('.pdv-text span').forEach((span) => {
      if (!range.intersectsNode(span)) return;
      const r = document.createRange(); r.selectNodeContents(span);
      const tn = span.firstChild; if (tn && range.startContainer === tn) r.setStart(tn, range.startOffset); if (tn && range.endContainer === tn) r.setEnd(tn, range.endOffset);
      const b = r.getBoundingClientRect(), pg = span.closest<HTMLElement>('[data-pdv-page]'); if (!pg || b.width < 1) return;
      const pr = pg.getBoundingClientRect(), num = +pg.dataset.pdvPage!;
      const q = rotRect({ x: (b.left - pr.left) / pr.width, y: (b.top - pr.top) / pr.height, w: b.width / pr.width, h: b.height / pr.height }, (360 - rotation) % 360);
      (byPage.get(num) || byPage.set(num, []).get(num)!).push(q);
    });
    if (!byPage.size) return 0;
    const add: Ann[] = []; byPage.forEach((rects, pg) => add.push({ id: uid(), kind, page: pg, color, rects, createdAt: Date.now() }));
    commit((l) => [...l, ...add]); sel.removeAllRanges(); setSelBox(null);
    return add.length;
  }, [color, commit, rotation]);

  useEffect(() => {   // marker tools commit as soon as the pointer lifts
    if (tool !== 'highlight' && tool !== 'underline' && tool !== 'strike') return;
    const up = () => setTimeout(() => selectionRects(tool), 30);
    document.addEventListener('pointerup', up); document.addEventListener('touchend', up);
    return () => { document.removeEventListener('pointerup', up); document.removeEventListener('touchend', up); };
  }, [tool, selectionRects]);
  useEffect(() => {   // select mode: a small contextual dock appears over the selection
    let t: ReturnType<typeof setTimeout>;
    const on = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0 || tool !== 'select') { setSelBox(null); return; }
        const node = sel.anchorNode as Node | null;
        if (!node || !(node.parentElement?.closest('.pdv-text'))) { setSelBox(null); return; }
        const r = sel.getRangeAt(0).getBoundingClientRect(); setSelBox({ x: r.left + r.width / 2, y: r.top });
      }, 160);
    };
    document.addEventListener('selectionchange', on);
    return () => { clearTimeout(t); document.removeEventListener('selectionchange', on); };
  }, [tool]);
  const copySel = async () => {
    const t = window.getSelection()?.toString().trim(); if (!t) return;
    try { await navigator.clipboard.writeText(t); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch { /* denied */ }
    window.getSelection()?.removeAllRanges(); setSelBox(null);
  };

  /* bookmarks */
  const marked = marks.some((m) => m.page === page);
  const toggleMark = () => {
    if (marked) {
      setMarks((l) => l.filter((m) => m.page !== page));
      try { supabase.from('pdf_bookmarks').delete().eq('document_id', docId).eq('page_number', page).then(() => {}); } catch { /* offline */ }
    } else {
      setMarks((l) => [...l, { page, label: `Page ${page}` }].sort((a, b) => a.page - b.page));
      try { supabase.from('pdf_bookmarks').insert({ document_id: docId, page_number: page, label: `Page ${page}`, color }).then(() => {}); } catch { /* offline */ }
    }
  };

  /* search: text items are the unit of a "match", so the count matches the highlights you see */
  const runSearch = useCallback(async (raw: string) => {
    const tok = ++searchTok.current, needle = raw.trim().toLowerCase();
    if (!needle || !doc) { setHits([]); setHitIdx(0); return; }
    const out: { page: number; k: number }[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      if (tok !== searchTok.current) return;
      let strs = textCache.current.get(p);
      if (!strs) { const tc = await (await doc.getPage(p)).getTextContent(); strs = (tc.items as any[]).map((i) => i.str || '').filter(Boolean); textCache.current.set(p, strs); }
      let k = 0; for (const s of strs) if (s.toLowerCase().includes(needle)) out.push({ page: p, k: k++ });
      if (p % 10 === 0) setHits(out.slice());
    }
    if (tok !== searchTok.current) return;
    setHits(out); const first = out.findIndex((h) => h.page >= pageRef.current); setHitIdx(first < 0 ? 0 : first);
  }, [doc]);
  useEffect(() => { const t = setTimeout(() => runSearch(query), 180); return () => clearTimeout(t); }, [query, runSearch]);
  useEffect(() => {
    const h = hits[hitIdx]; if (!h || !searching) return;
    if (h.page !== pageRef.current) goTo(h.page);
    const focus = () => {
      rootRef.current?.querySelectorAll('.pdv-cur').forEach((e) => e.classList.remove('pdv-cur'));
      const el = rootRef.current?.querySelectorAll(`[data-pdv-page="${h.page}"] .pdv-hit`)[h.k];
      if (el) { el.classList.add('pdv-cur'); el.scrollIntoView({ block: 'center', inline: 'center', behavior: reduce ? 'auto' : 'smooth' }); return true; }
      return false;
    };
    const t1 = setTimeout(() => { if (!focus()) setTimeout(focus, 400); }, 160);
    return () => clearTimeout(t1);
  }, [hitIdx, hits, searching]); // eslint-disable-line react-hooks/exhaustive-deps
  const closeSearch = () => { setSearching(false); setQuery(''); setHits([]); };
  const hitStep = (d: number) => hits.length && setHitIdx((i) => (i + d + hits.length) % hits.length);

  /* fullscreen + idle */
  const toggleFs = useCallback(() => { const el = rootRef.current; if (!document.fullscreenElement) el?.requestFullscreen?.().catch(() => {}); else document.exitFullscreen().catch(() => {}); }, []);
  useEffect(() => { const f = () => setFs(!!document.fullscreenElement); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f); }, []);
  useEffect(() => {
    if (!fs) { setIdle(false); return; }
    let t: ReturnType<typeof setTimeout>; const wake = () => { setIdle(false); clearTimeout(t); t = setTimeout(() => setIdle(true), 2600); };
    document.addEventListener('mousemove', wake); document.addEventListener('touchstart', wake); wake();
    return () => { document.removeEventListener('mousemove', wake); document.removeEventListener('touchstart', wake); clearTimeout(t); };
  }, [fs]);

  /* gestures: pinch (touch), ctrl+wheel / trackpad pinch, double-tap, swipe between pages in paged layouts */
  useEffect(() => {
    const el = scrollerRef.current, content = contentRef.current; if (!el || !content) return;
    let d0 = 0, f = 1, mid = { x: 0, y: 0 }, pinching = false, tap = 0, sx = 0, sy = 0, st = 0;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const ts = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinching = true; d0 = dist(e.touches); f = 1;
        mid = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 };
        const r = el.getBoundingClientRect(); content.style.transformOrigin = `${el.scrollLeft + mid.x - r.left}px ${el.scrollTop + mid.y - r.top}px`;
      } else { sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); }
    };
    const tm = (e: TouchEvent) => {
      if (!pinching || e.touches.length !== 2) return;
      e.preventDefault(); f = clamp(dist(e.touches) / d0, ZMIN / scaleRef.current, ZMAX / scaleRef.current); content.style.transform = `scale(${f})`;
    };
    const te = (e: TouchEvent) => {
      if (pinching && e.touches.length < 2) { pinching = false; content.style.transform = ''; if (Math.abs(f - 1) > 0.02) zoomBy(f, mid); return; }
      if (e.changedTouches.length !== 1 || e.touches.length) return;
      const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy, now = Date.now();
      if (!window.getSelection()?.isCollapsed) return;
      if (layout !== 'scroll' && Math.abs(dx) > 70 && Math.abs(dy) < 40 && now - st < 400 && scaleRef.current <= computeFit('page') * 1.05) { goTo(pageRef.current + (dx < 0 ? step : -step)); return; }
      if (now - tap < 280 && Math.abs(dx) < 10 && Math.abs(dy) < 10) {   // double tap: fit ⇄ 2.2×
        const fit = computeFit(layout === 'scroll' ? 'width' : 'page');
        if (scaleRef.current > fit * 1.3) { setZoomMode(layout === 'scroll' ? 'width' : 'page'); } else zoomBy((fit * 2.2) / scaleRef.current, { x: t.clientX, y: t.clientY });
        tap = 0;
      } else tap = now;
    };
    const wheel = (e: WheelEvent) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); zoomBy(Math.exp(-e.deltaY * 0.01), { x: e.clientX, y: e.clientY }); };
    el.addEventListener('touchstart', ts, { passive: true }); el.addEventListener('touchmove', tm, { passive: false });
    el.addEventListener('touchend', te); el.addEventListener('wheel', wheel, { passive: false });
    return () => { el.removeEventListener('touchstart', ts); el.removeEventListener('touchmove', tm); el.removeEventListener('touchend', te); el.removeEventListener('wheel', wheel); };
  }, [loading, layout, step, goTo, zoomBy, computeFit]);

  /* keyboard. Capture phase so an open popover can swallow Esc, and arrows only get consumed when they turn a page
     (otherwise they fall through to the modal's previous/next file). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t?.closest('input, textarea, [contenteditable="true"]');
      const eat = () => { e.preventDefault(); e.stopPropagation(); };
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Escape') {
        if (menu) { eat(); setMenu(null); } else if (palette) { eat(); setPalette(false); } else if (searching) { eat(); closeSearch(); }
        else if (tool !== 'select') { eat(); setTool('select'); } else if (markup) { eat(); setMarkup(false); }
        return;
      }
      if (mod && e.key.toLowerCase() === 'f') { eat(); setSearching(true); return; }
      if (mod && e.key.toLowerCase() === 'z') { if (typing) return; eat(); if (e.shiftKey) redo(); else undo(); return; }
      if (typing) return;
      if (mod && (e.key === '=' || e.key === '+')) { eat(); zoomBy(1.2); return; }
      if (mod && e.key === '-') { eat(); zoomBy(1 / 1.2); return; }
      if (mod && e.key === '0') { eat(); setZoomMode(layout === 'scroll' ? 'width' : 'page'); return; }
      if (mod) return;
      const k = e.key;
      if (k === 'ArrowRight' || k === 'ArrowLeft') {
        if (layout === 'scroll') return;
        const to = pageRef.current + (k === 'ArrowRight' ? step : -step);
        if (to < 1 || to > n) return;
        eat(); goTo(to);
      } else if (k === 'PageDown' || k === ' ') {
        eat(); if (layout === 'scroll') scrollerRef.current?.scrollBy({ top: (scrollerRef.current?.clientHeight || 600) * (e.shiftKey ? -0.9 : 0.9), behavior: reduce ? 'auto' : 'smooth' }); else goTo(pageRef.current + (e.shiftKey ? -step : step));
      } else if (k === 'PageUp') { eat(); if (layout === 'scroll') scrollerRef.current?.scrollBy({ top: -(scrollerRef.current?.clientHeight || 600) * 0.9, behavior: reduce ? 'auto' : 'smooth' }); else goTo(pageRef.current - step); }
      else if (k === 'Home') { eat(); goTo(1); } else if (k === 'End') { eat(); goTo(n); }
      else if (k.toLowerCase() === 'b') { eat(); toggleMark(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }); // re-bound every render on purpose: handlers close over fresh state, listener is cheap

  /* outside click closes popovers */
  useEffect(() => {
    if (!menu && !palette) return;
    const f = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest('[data-pdv-pop], [data-pdv-anchor]')) { setMenu(null); setPalette(false); } };
    window.addEventListener('pointerdown', f, true);
    return () => window.removeEventListener('pointerdown', f, true);
  }, [menu, palette]);

  /* reading progress (best effort) */
  const progressRef = useRef({ page, scale, theme, layout }); progressRef.current = { page, scale, theme, layout };
  useEffect(() => {
    if (!doc) return;
    const save = () => { try { supabase.from('pdf_reading_progress').upsert({ document_id: docId, document_name: file.name, last_page: progressRef.current.page, total_pages: doc.numPages, zoom: progressRef.current.scale, theme: progressRef.current.theme, layout: progressRef.current.layout, last_read_at: new Date().toISOString() } as any).then(() => {}); } catch { /* offline */ } };
    const iv = setInterval(save, 60000); return () => { clearInterval(iv); save(); };
  }, [doc, docId, file.name]);

  const exportNotes = () => {
    if (!anns.length) return;
    const md = anns.map((a) => `- **${a.kind}** (page ${a.page})${a.text ? `: ${a.text}` : ''}`).join('\n');
    const url = URL.createObjectURL(new Blob([`# Annotations — ${file.name}\n\n${md}\n`], { type: 'text/markdown' }));
    const l = document.createElement('a'); l.href = url; l.download = `${file.name.replace(/\.pdf$/i, '')}_annotations.md`; l.click(); URL.revokeObjectURL(url);
  };
  const rotate = (d: number) => setRotation((r) => (r + d + 360) % 360);
  const pickTool = (t: Tool) => { setTool((c) => (c === t ? 'select' : t)); setPalette(false); window.getSelection()?.removeAllRanges(); };
  const openMenu = (m: Exclude<Menu, null>) => { setMenu((c) => (c === m ? null : m)); setPalette(false); };
  const zoomPct = Math.round(scale * 100);
  const hidden = (fs && idle) || (compact && scrollHidden && !menu && !markup && !searching);
  const T = reduce ? { duration: 0.01 } : JELLY;

  /* ─────────── states ─────────── */
  if (error) return (
    <div className="pdv pdv-stage"><style>{CSS}</style>
      <motion.div className="pdv-g pdv-card" initial={reduce ? false : { opacity: 0, scale: 0.88, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={POP}>
        <span className="pdv-cico"><Ico n="alert" size={26} /></span><h3>Can’t open this PDF</h3><p>{error}</p>
        {onDownload && <button type="button" className="pdv-pill" onClick={onDownload}>Download instead</button>}
      </motion.div></div>);
  if (loading || !doc) return (
    <div className="pdv pdv-stage"><style>{CSS}</style>
      <div className="pdv-g pdv-spin"><svg viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="14" /></svg></div></div>);

  /* ─────────── chrome pieces ─────────── */
  const sizeBtn = compact ? 44 : 38;
  const searchField = (
    <motion.div key="search" className="pdv-g pdv-search" initial={reduce ? false : { opacity: 0, scaleX: 0.7 }} animate={{ opacity: 1, scaleX: 1 }} exit={{ opacity: 0, scaleX: 0.8 }} transition={T} style={{ transformOrigin: '50% 50%' }}>
      <Ico n="search" size={17} />
      <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); hitStep(e.shiftKey ? -1 : 1); } }} />
      <span className="pdv-count">{query.trim() ? (hits.length ? `${hitIdx + 1} of ${hits.length}` : 'No results') : ''}</span>
      <Btn reduce={reduce} size={30} label="Previous match" disabled={!hits.length} onClick={() => hitStep(-1)}><Ico n="up" size={17} /></Btn>
      <Btn reduce={reduce} size={30} label="Next match" disabled={!hits.length} onClick={() => hitStep(1)}><Ico n="dn" size={17} /></Btn>
      <Btn reduce={reduce} size={30} label="Close search" onClick={closeSearch}><Ico n="x" size={16} /></Btn>
    </motion.div>
  );
  const titleChip = (
    <motion.div key="title" className="pdv-g pdv-dock pdv-title" initial={reduce ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} transition={T}>
      <Btn reduce={reduce} size={32} label="Previous page" disabled={page <= 1} onClick={() => goTo(page - step)}><Ico n="left" size={18} /></Btn>
      <span className="pdv-name" title={file.name}>{file.name.replace(/\.pdf$/i, '')}</span>
      <i className="pdv-vsep" />
      <input className="pdv-pg" inputMode="numeric" aria-label="Page number" value={pageInput} style={{ width: `${Math.max(2, pageInput.length) + 0.6}ch` }}
        onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))} onFocus={(e) => e.target.select()}
        onKeyDown={(e) => { if (e.key === 'Enter') { goTo(parseInt(pageInput, 10) || page); (e.target as HTMLInputElement).blur(); } }} onBlur={() => setPageInput(String(page))} />
      <span className="pdv-of">of {n}</span>
      <Btn reduce={reduce} size={32} label="Next page" disabled={page + step > n} onClick={() => goTo(page + step)}><Ico n="right" size={18} /></Btn>
    </motion.div>
  );
  const viewMenu = menu === 'view' && (
    <Pop origin="top left" reduce={reduce} className="pdv-popl">
      {([['scroll', 'Continuous Scroll'], ['single', 'Single Page'], ['dual', 'Two Pages']] as const).map(([id, l]) => <Row key={id} label={l} checked={layout === id} onClick={() => { setLayout(id); setZoomMode(id === 'scroll' ? 'width' : 'page'); setMenu(null); }} />)}
      <div className="pdv-sep" />
      {THEMES.map((t) => <Row key={t.id} label={t.label} sw={t.sw} checked={theme === t.id} onClick={() => { setTheme(t.id); setMenu(null); }} />)}
    </Pop>);
  const zoomMenu = menu === 'zoom' && (
    <Pop origin="top right" reduce={reduce} className="pdv-popr">
      <Row label="Zoom In" hint="⌘ +" onClick={() => zoomBy(1.25)} /><Row label="Zoom Out" hint="⌘ −" onClick={() => zoomBy(0.8)} /><div className="pdv-sep" />
      <Row label="Actual Size" checked={zoomMode === 'actual'} onClick={() => { setZoomMode('actual'); setMenu(null); }} />
      <Row label="Fit Width" checked={zoomMode === 'width'} onClick={() => { setZoomMode('width'); setMenu(null); }} />
      <Row label="Fit Page" checked={zoomMode === 'page'} onClick={() => { setZoomMode('page'); setMenu(null); }} />
    </Pop>);
  const moreMenu = menu === 'more' && (
    <Pop origin={compact ? 'bottom right' : 'top right'} dy={compact ? 8 : -8} reduce={reduce} className={compact ? 'pdv-popup' : 'pdv-popr'}>
      {compact && <>
        {([['scroll', 'Continuous Scroll'], ['single', 'Single Page'], ['dual', 'Two Pages']] as const).map(([id, l]) => <Row key={id} label={l} checked={layout === id} onClick={() => { setLayout(id); setZoomMode(id === 'scroll' ? 'width' : 'page'); setMenu(null); }} />)}
        <div className="pdv-sep" />{THEMES.map((t) => <Row key={t.id} label={t.label} sw={t.sw} checked={theme === t.id} onClick={() => { setTheme(t.id); setMenu(null); }} />)}
        <div className="pdv-sep" /><Row label="Fit Width" checked={zoomMode === 'width'} onClick={() => { setZoomMode('width'); setMenu(null); }} />
        <Row label="Fit Page" checked={zoomMode === 'page'} onClick={() => { setZoomMode('page'); setMenu(null); }} /><div className="pdv-sep" />
      </>}
      <Row label="Search" hint="⌘F" onClick={() => { setSearching(true); setMenu(null); }} />
      <Row label={marked ? 'Remove Bookmark' : 'Bookmark Page'} checked={marked} onClick={() => { toggleMark(); setMenu(null); }} />
      <Row label="Markup" checked={markup} onClick={() => { setMarkup((m) => !m); if (markup) setTool('select'); setMenu(null); }} />
      <div className="pdv-sep" />
      <Row label="Rotate Left" onClick={() => { rotate(-90); setMenu(null); }} /><Row label="Rotate Right" onClick={() => { rotate(90); setMenu(null); }} /><div className="pdv-sep" />
      {onDownload && <Row label="Download" onClick={() => { onDownload(); setMenu(null); }} />}
      <Row label="Export Annotations" disabled={!anns.length} onClick={() => { exportNotes(); setMenu(null); }} />
      <Row label={fs ? 'Exit Full Screen' : 'Full Screen'} onClick={() => { toggleFs(); setMenu(null); }} />
    </Pop>);

  const markupDock = markup && (
    <motion.div key="markup" className={cn('pdv-g pdv-markup', compact && 'pdv-markup-m')} data-pdv-anchor onClick={stop} onDoubleClick={stop}
      initial={reduce ? false : { opacity: 0, y: compact ? 16 : -16, scaleX: 0.88, scaleY: 0.78 }} animate={{ opacity: 1, y: 0, scaleX: 1, scaleY: 1 }} exit={{ opacity: 0, y: compact ? 12 : -12, scaleX: 0.92, scaleY: 0.85 }} transition={T}
      style={{ transformOrigin: compact ? '50% 100%' : '50% 0%' }}>
      {([['highlight', 'Highlight'], ['underline', 'Underline'], ['strike', 'Strikethrough']] as const).map(([t, l]) => <Btn key={t} reduce={reduce} size={sizeBtn} label={l} on={tool === t} onClick={() => pickTool(t)}><Ico n={t} /></Btn>)}
      <i className="pdv-vsep" />
      {([['draw', 'Draw'], ['text', 'Text'], ['note', 'Note']] as const).map(([t, l]) => <Btn key={t} reduce={reduce} size={sizeBtn} label={l} on={tool === t} onClick={() => pickTool(t)}><Ico n={t} /></Btn>)}
      <i className="pdv-vsep" />
      <span className="pdv-colorwrap" data-pdv-anchor>
        <Btn reduce={reduce} size={sizeBtn} label="Color" on={palette} onClick={() => setPalette((p) => !p)}><i className="pdv-dot" style={{ background: color }} /></Btn>
        <AnimatePresence>{palette && (
          <Pop origin={compact ? 'bottom center' : 'top center'} dy={compact ? 8 : -8} reduce={reduce} className="pdv-colors">
            {COLORS.map((c) => <motion.button key={c} type="button" className="pdv-swatch" aria-label={`Color ${c}`} data-on={c === color} style={{ background: c }} onClick={() => { setColor(c); setPalette(false); }}
              whileHover={reduce ? undefined : { scale: 1.15 }} whileTap={reduce ? undefined : { scale: 0.85 }} transition={JELLY} />)}
          </Pop>)}</AnimatePresence>
      </span>
      <Btn reduce={reduce} size={sizeBtn} label="Eraser" on={tool === 'erase'} onClick={() => pickTool('erase')}><Ico n="erase" /></Btn>
      <i className="pdv-vsep" />
      <Btn reduce={reduce} size={sizeBtn} label="Undo" disabled={!undoS.length} onClick={undo}><Ico n="undo" /></Btn>
      <Btn reduce={reduce} size={sizeBtn} label="Redo" disabled={!redoS.length} onClick={redo}><Ico n="redo" /></Btn>
    </motion.div>);

  const sideBody = (
    <>
      <div className="pdv-tabs" role="tablist">
        {([['thumbs', 'grid', 'Pages'], ['outline', 'list', 'Contents'], ['notes', 'bubble', 'Annotations'], ['marks', 'bookmark', 'Bookmarks']] as const)
          .filter(([id]) => id !== 'outline' || outline.length > 0).map(([id, ic, l]) => (
            <Btn key={id} reduce={reduce} size={compact ? 42 : 34} label={l} on={panel === id} onClick={() => setPanel(id)}><Ico n={ic} size={compact ? 20 : 18} /></Btn>))}
      </div>
      <div className={cn('pdv-sidebody', compact && 'pdv-sidebody-m')}>
        {panel === 'thumbs' && (<div className={cn('pdv-thumbs', compact && 'pdv-thumbs-m')}>{Array.from({ length: n }, (_, i) => (
          <Thumb key={i} doc={doc} num={i + 1} ar={dim(i).w / dim(i).h} active={page === i + 1 || (layout === 'dual' && page + 1 === i + 1)} marked={marks.some((m) => m.page === i + 1)}
            onGo={() => { goTo(i + 1); if (compact) setSidebarOpen(false); }} />))}</div>)}
        {panel === 'outline' && <OutlineList items={outline} onJump={jumpOutline} />}
        {panel === 'notes' && (anns.length ? anns.slice().sort((a, b) => a.page - b.page || a.createdAt - b.createdAt).map((a) => (
          <div key={a.id} className="pdv-li"><button type="button" onClick={() => { goTo(a.page); if (compact) setSidebarOpen(false); }}>
            <i className="pdv-dot" style={{ background: a.color }} /><span className="pdv-lit">{a.text || (a.kind === 'draw' ? 'Drawing' : a.kind[0].toUpperCase() + a.kind.slice(1))}</span><span className="pdv-hint">p. {a.page}</span></button>
            <Btn reduce={reduce} size={26} label="Delete" onClick={() => delAnn(a.id)}><Ico n="x" size={14} /></Btn></div>)) : <p className="pdv-empty">No annotations yet.<br />Open Markup and select text.</p>)}
        {panel === 'marks' && (marks.length ? marks.map((m) => (
          <div key={m.page} className="pdv-li"><button type="button" onClick={() => { goTo(m.page); if (compact) setSidebarOpen(false); }}><Ico n="bookmark" size={16} fill /><span className="pdv-lit">{m.label}</span></button>
            <Btn reduce={reduce} size={26} label="Remove" onClick={() => setMarks((l) => l.filter((x) => x.page !== m.page))}><Ico n="x" size={14} /></Btn></div>)) : <p className="pdv-empty">No bookmarks.<br />Press B to bookmark a page.</p>)}
      </div>
    </>);

  /* ─────────── pages ─────────── */
  const pv = (num: number) => {
    const d = dim(num - 1);
    return <PageView key={num} doc={doc} num={num} w={d.w * scale} h={d.h * scale} scale={scale} rotation={rotation} theme={theme} query={searching ? query : ''} tool={tool} color={color}
      anns={pageAnns.get(num) || NONE} onAdd={addAnn} onUpdate={updAnn} onRemove={delAnn} reduce={reduce} />;
  };
  const contentW = Math.max(availW, geo.maxW + PAD * 2);
  const spread = layout === 'dual' ? [page, page + 1].filter((p) => p <= n) : [page];

  return (
    <div ref={rootRef} className="pdv" data-compact={compact} data-theme={theme} data-tool={tool}>
      <style>{CSS}</style>

      <motion.div className="pdv-scroller" ref={scrollerRef} initial={false} animate={{ left: inset }} transition={reduce ? { duration: 0.01 } : SOFT}
        onClick={() => { if (menu || palette) { setMenu(null); setPalette(false); } else if (compact && tool === 'select' && window.getSelection()?.isCollapsed) setScrollHidden((h) => !h); }}>
        <div ref={contentRef} className="pdv-wrap">
        {fitted && (layout === 'scroll' ? (
          <div className="pdv-content" style={{ width: contentW, height: geo.total }}>
            {geo.tops.length > 0 && Array.from({ length: Math.min(range[1], n - 1) - range[0] + 1 }, (_, k) => range[0] + k).map((i) => (
              <div key={i} className="pdv-slot" style={{ top: geo.tops[i], left: (contentW - dim(i).w * scale) / 2 }}>{pv(i + 1)}</div>))}
          </div>
        ) : (
          <div className="pdv-paged" style={{ padding: `${topInset}px ${PAD}px ${botInset}px` }}>
            <AnimatePresence mode="popLayout" custom={dir} initial={false}>
              <motion.div key={spread.join('-') + rotation} className="pdv-spread" style={{ gap: GAP }} custom={dir}
                variants={{ in: (d: number) => ({ opacity: 0, x: reduce ? 0 : 56 * d, scale: 0.97 }), on: { opacity: 1, x: 0, scale: 1 }, out: (d: number) => ({ opacity: 0, x: reduce ? 0 : -56 * d, scale: 0.97 }) }}
                initial="in" animate="on" exit="out" transition={reduce ? { duration: 0.01 } : SOFT}>{spread.map(pv)}</motion.div>
            </AnimatePresence>
          </div>
        ))}
        </div>
      </motion.div>

      {/* floating sidebar island (desktop) */}
      <AnimatePresence>
        {sidebarOpen && !compact && (
          <motion.aside className="pdv-g pdv-side" data-pdv-anchor initial={reduce ? false : { opacity: 0, x: -34, scale: 0.94 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -28, scale: 0.95 }} transition={T} style={{ transformOrigin: '0% 50%' }}>
            {sideBody}
          </motion.aside>)}
      </AnimatePresence>

      {/* top docks */}
      <motion.div className="pdv-top" animate={{ y: hidden ? -90 : 0, opacity: hidden ? 0 : 1 }} transition={T} style={{ pointerEvents: hidden ? 'none' : undefined }}>
        {!compact && (
          <>
            <div className="pdv-anchor pdv-a-l" data-pdv-anchor>
              <div className="pdv-g pdv-dock">
                <Btn reduce={reduce} label="Sidebar" on={sidebarOpen} onClick={() => setSidebarOpen((s) => !s)}><Ico n="sidebar" /></Btn>
                <Btn reduce={reduce} label="View" on={menu === 'view'} onClick={() => openMenu('view')}><Ico n={layout} /></Btn>
              </div>
              <AnimatePresence>{viewMenu}</AnimatePresence>
            </div>
            <div className="pdv-a-c"><AnimatePresence mode="wait" initial={false}>{searching ? searchField : titleChip}</AnimatePresence></div>
            <div className="pdv-anchor pdv-a-r" data-pdv-anchor>
              <div className="pdv-g pdv-dock">
                <Btn reduce={reduce} label="Zoom out" onClick={() => zoomBy(0.8)}><Ico n="zout" /></Btn>
                <button type="button" className="pdv-pct" data-on={menu === 'zoom'} onClick={() => openMenu('zoom')} aria-label="Zoom options">{zoomPct}%</button>
                <Btn reduce={reduce} label="Zoom in" onClick={() => zoomBy(1.25)}><Ico n="zin" /></Btn>
                <i className="pdv-vsep" />
                <Btn reduce={reduce} label="Search" on={searching} onClick={() => (searching ? closeSearch() : setSearching(true))}><Ico n="search" /></Btn>
                <Btn reduce={reduce} label="More" on={menu === 'more'} onClick={() => openMenu('more')}><Ico n="more" /></Btn>
              </div>
              <AnimatePresence>{zoomMenu}{moreMenu}</AnimatePresence>
            </div>
          </>
        )}
        {compact && (
          <div className="pdv-a-m"><AnimatePresence mode="wait" initial={false}>
            {searching ? searchField : (
              <motion.button key="mt" type="button" className="pdv-g pdv-title pdv-title-m" onClick={() => setSidebarOpen(true)} initial={reduce ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} transition={T}>
                <span className="pdv-name">{file.name.replace(/\.pdf$/i, '')}</span><i className="pdv-vsep" /><span className="pdv-of">{page} / {n}</span></motion.button>)}
          </AnimatePresence></div>
        )}
      </motion.div>

      {!compact && <div className="pdv-row2" data-hidden={hidden}><AnimatePresence>{markupDock}</AnimatePresence></div>}

      {/* mobile dock, left-aligned so the modal's own dock keeps the right corner */}
      {compact && (
        <motion.div className="pdv-botm" animate={{ y: hidden ? 110 : 0, opacity: hidden ? 0 : 1 }} transition={T} style={{ pointerEvents: hidden ? 'none' : undefined }}>
          <AnimatePresence>{markupDock}</AnimatePresence>
          <div className="pdv-anchor" data-pdv-anchor>
            <AnimatePresence>{moreMenu}</AnimatePresence>
            <div className="pdv-g pdv-dock">
              <Btn reduce={reduce} size={44} label="Pages" on={sidebarOpen} onClick={() => setSidebarOpen((s) => !s)}><Ico n="grid" /></Btn>
              <Btn reduce={reduce} size={44} label="Markup" on={markup} onClick={() => { setMarkup((m) => !m); if (markup) setTool('select'); }}><Ico n="markup" /></Btn>
              <Btn reduce={reduce} size={44} label="More" on={menu === 'more'} onClick={() => openMenu('more')}><Ico n="more" /></Btn>
            </div>
          </div>
        </motion.div>
      )}

      {/* mobile sidebar: draggable bottom sheet */}
      <AnimatePresence>
        {sidebarOpen && compact && (
          <>
            <motion.div key="scrim" className="pdv-dim" onClick={() => setSidebarOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div key="sheet" className="pdv-g pdv-sheet" data-pdv-anchor drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.04, bottom: 0.7 }} dragListener={false} dragControls={sheetCtl}
              onDragEnd={(_: unknown, i: PanInfo) => { if (i.offset.y > 110 || i.velocity.y > 500) setSidebarOpen(false); }}
              initial={reduce ? false : { y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={reduce ? { duration: 0.01 } : { type: 'spring', stiffness: 380, damping: 32 }}>
              <div className="pdv-grab" onPointerDown={(e) => sheetCtl.start(e)}><i /></div>
              {sideBody}
            </motion.div>
          </>)}
      </AnimatePresence>

      {/* selection dock: contextual, springs in over the selected text */}
      <AnimatePresence>
        {selBox && tool === 'select' && (
          <div key="selw" className="pdv-selwrap" style={{ left: selBox.x, top: Math.max(76, selBox.y - 10) }}>
          <motion.div className="pdv-g pdv-sel" onPointerDown={(e) => e.preventDefault()} style={{ transformOrigin: '50% 100%' }}
            initial={reduce ? false : { opacity: 0, scale: 0.8, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={T}>
            <Btn reduce={reduce} size={36} label="Highlight" onClick={() => selectionRects('highlight')}><Ico n="highlight" /></Btn>
            <Btn reduce={reduce} size={36} label="Underline" onClick={() => selectionRects('underline')}><Ico n="underline" /></Btn>
            <Btn reduce={reduce} size={36} label="Strikethrough" onClick={() => selectionRects('strike')}><Ico n="strike" /></Btn>
            <i className="pdv-vsep" /><Btn reduce={reduce} size={36} label="Copy" onClick={copySel}><Ico n="copy" /></Btn>
          </motion.div></div>)}
        {copied && <motion.div key="cp" className="pdv-g pdv-toast" initial={{ opacity: 0, y: 12, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={T}><Ico n="check" size={16} />Copied</motion.div>}
      </AnimatePresence>
    </div>
  );
}

/* ── Same glass tokens as the dashboard dock (fill / hairline / rim / 18px blur), springs everywhere else ── */
const CSS = `
.pdv { --ink: #e8e7e1; --dim: rgba(232,231,225,.58); --fill: rgba(13,14,13,.86); --line: rgba(232,231,225,.10); --rim: rgba(232,231,225,.14);
  position: relative; width: 100%; height: 100%; overflow: hidden; background: #161714; color: var(--ink);
  font-family: var(--sa-f, 'Hanken Grotesk', system-ui, -apple-system, sans-serif); -webkit-font-smoothing: antialiased; -webkit-tap-highlight-color: transparent; }
.pdv-stage { display: grid; place-items: center; padding: 24px; }
/* one glass tier: soft vertical falloff, hairline rim, clean drop — no white gloss */
.pdv-g { background: linear-gradient(180deg, rgba(36,37,33,.86), rgba(15,16,13,.92)); border: 1px solid var(--line);
  -webkit-backdrop-filter: blur(22px) saturate(160%); backdrop-filter: blur(22px) saturate(160%);
  box-shadow: inset 0 1px 0 var(--rim), inset 0 -1px 0 rgba(0,0,0,.35), 0 18px 40px -18px rgba(0,0,0,.85); }
.pdv[data-tool="draw"] { cursor: crosshair; } .pdv[data-tool="erase"] { cursor: pointer; }

/* buttons */
.pdv-btn { display: grid; place-items: center; flex: none; padding: 0; border: 0; border-radius: 999px; background: transparent; color: var(--dim); cursor: pointer; transition: background .2s, color .2s; }
.pdv-btn:hover { background: rgba(232,231,225,.1); color: var(--ink); }
.pdv-btn[data-on="true"] { background: rgba(232,231,225,.16); color: var(--ink); }
.pdv-btn:disabled { opacity: .3; pointer-events: none; }
.pdv-btn:focus-visible, .pdv-row:focus-visible, .pdv-pct:focus-visible, .pdv-pill:focus-visible, .pdv-thumb:focus-visible { outline: 2px solid rgba(232,231,225,.85); outline-offset: 2px; }
.pdv-dot { display: block; width: 16px; height: 16px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.35); }
.pdv-vsep { flex: none; width: 1px; height: 20px; margin: 0 4px; background: var(--line); }

/* docks */
.pdv-top { position: absolute; z-index: 30; left: 16px; right: 16px; top: max(14px, env(safe-area-inset-top)); display: grid; grid-template-columns: 1fr auto 1fr; align-items: start; gap: 12px; pointer-events: none; }
.pdv-anchor { position: relative; pointer-events: auto; }
.pdv-a-l { justify-self: start; } .pdv-a-r { justify-self: end; }
.pdv-a-c { display: flex; justify-content: center; pointer-events: none; } .pdv-a-c > * { pointer-events: auto; }
.pdv-a-m { grid-column: 1 / -1; display: flex; pointer-events: none; } .pdv-a-m > * { pointer-events: auto; }
.pdv-top:has(.pdv-a-m) { grid-template-columns: 1fr; left: max(14px, env(safe-area-inset-left)); right: max(14px, env(safe-area-inset-right)); }
.pdv-dock { display: flex; align-items: center; gap: 2px; padding: 4px; border-radius: 999px; }
.pdv-pct { min-width: 54px; height: 38px; padding: 0 6px; border: 0; border-radius: 999px; background: transparent; color: var(--ink); font: 500 12.5px/1 inherit; font-variant-numeric: tabular-nums; cursor: pointer; transition: background .2s; }
.pdv-pct:hover, .pdv-pct[data-on="true"] { background: rgba(232,231,225,.12); }
.pdv-title { display: flex; align-items: center; gap: 4px; height: 46px; padding: 4px 6px; border-radius: 999px; max-width: 100%; }
.pdv-title .pdv-name { padding-left: 8px; }
.pdv-title-m { height: 44px; padding: 0 16px; max-width: min(72vw, 320px); color: var(--ink); cursor: pointer; font-family: inherit; }
.pdv-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 260px; font: 600 13.5px/1 inherit; letter-spacing: -.005em; }
.pdv-of { color: var(--dim); font: 500 13px/1 inherit; white-space: nowrap; font-variant-numeric: tabular-nums; }
.pdv-pg { padding: 6px 4px; border: 0; outline: 0; border-radius: 8px; background: rgba(232,231,225,.1); color: var(--ink); text-align: center; font: 500 13px/1 inherit; font-variant-numeric: tabular-nums; transition: background .2s; }
.pdv-pg:focus { background: rgba(232,231,225,.2); }
.pdv-search { display: flex; align-items: center; gap: 6px; height: 46px; width: min(440px, 100%); padding: 0 8px 0 16px; border-radius: 999px; }
.pdv-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: var(--ink); font: 500 14px/1 inherit; }
.pdv-search input::placeholder { color: var(--dim); }
.pdv-count { color: var(--dim); font: 500 12px/1 inherit; white-space: nowrap; font-variant-numeric: tabular-nums; }
.pdv-row2 { position: absolute; z-index: 29; left: 16px; right: 16px; top: calc(max(14px, env(safe-area-inset-top)) + 58px); display: flex; justify-content: center; pointer-events: none; transition: opacity .3s; }
.pdv-row2 > * { pointer-events: auto; } .pdv-row2[data-hidden="true"] { opacity: 0; pointer-events: none; }
.pdv-markup { display: flex; align-items: center; gap: 2px; padding: 4px; border-radius: 999px; }
.pdv-markup-m { flex-wrap: wrap; justify-content: center; max-width: min(calc(100vw - 28px), 320px); border-radius: 26px; }
.pdv-markup-m .pdv-vsep { display: none; }
.pdv-colorwrap { position: relative; display: grid; }
.pdv-bot { position: absolute; z-index: 30; left: 0; right: 0; bottom: max(20px, env(safe-area-inset-bottom)); display: flex; justify-content: center; pointer-events: none; }
.pdv-bot > * { pointer-events: auto; }
.pdv-hud { gap: 6px; padding: 5px; } .pdv-hudtxt { min-width: 92px; text-align: center; font: 500 13px/1 inherit; font-variant-numeric: tabular-nums; }
.pdv-botm { position: absolute; z-index: 30; left: max(14px, env(safe-area-inset-left)); bottom: max(20px, env(safe-area-inset-bottom)); display: flex; flex-direction: column; align-items: flex-start; gap: 10px; pointer-events: none; }
.pdv-botm > * { pointer-events: auto; }

/* popovers */
.pdv-pop { position: absolute; z-index: 40; min-width: 224px; padding: 6px; border-radius: 18px; }
.pdv-popl { left: 0; top: calc(100% + 10px); } .pdv-popr { right: 0; top: calc(100% + 10px); } .pdv-popup { left: 0; bottom: calc(100% + 10px); }
.pdv-colors { display: flex; gap: 8px; min-width: 0; width: max-content; padding: 10px 12px; border-radius: 999px; left: 0; right: 0; margin: 0 auto; top: calc(100% + 10px); }
.pdv-markup-m .pdv-colors { top: auto; bottom: calc(100% + 10px); }
.pdv-swatch { width: 26px; height: 26px; padding: 0; border: 0; border-radius: 50%; cursor: pointer; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.3); }
.pdv-swatch[data-on="true"] { box-shadow: 0 0 0 2px var(--fill), 0 0 0 4px var(--ink); }
.pdv-row { display: flex; align-items: center; gap: 8px; width: 100%; height: 36px; padding: 0 12px 0 6px; border: 0; border-radius: 11px; background: none; color: var(--ink); font: 500 13.5px/1 inherit; text-align: left; cursor: pointer; transition: background .15s; }
.pdv[data-compact="true"] .pdv-row { height: 44px; font-size: 15px; }
.pdv-row:hover { background: rgba(232,231,225,.12); } .pdv-row:disabled { opacity: .35; pointer-events: none; }
.pdv-chk { display: grid; place-items: center; width: 20px; flex: none; }
.pdv-rl { flex: 1; } .pdv-hint { color: var(--dim); font-size: 12px; font-variant-numeric: tabular-nums; }
.pdv-sw { flex: none; width: 14px; height: 14px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(255,255,255,.28); }
.pdv-sep { height: 1px; margin: 5px 8px; background: var(--line); }

/* sidebar island + mobile sheet */
.pdv-side { position: absolute; z-index: 20; left: 16px; top: calc(max(14px, env(safe-area-inset-top)) + 60px); bottom: 16px; width: ${SIDEBAR}px; display: flex; flex-direction: column; overflow: hidden; border-radius: 22px; }
.pdv-tabs { display: flex; justify-content: center; gap: 2px; padding: 8px 8px 4px; flex: none; }
.pdv-sidebody { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 8px 10px 14px; scrollbar-width: thin; scrollbar-color: rgba(232,231,225,.2) transparent; }
.pdv-sidebody-m { padding: 8px 14px calc(14px + env(safe-area-inset-bottom)); }
.pdv-thumbs { display: grid; gap: 14px; justify-items: center; } .pdv-thumbs-m { grid-template-columns: repeat(3, 1fr); }
.pdv-thumb { display: grid; justify-items: center; gap: 7px; width: 100%; padding: 0; border: 0; background: none; color: var(--dim); font: 500 11.5px/1 inherit; cursor: pointer; }
.pdv-thumbimg { position: relative; display: block; width: min(100%, 150px); border-radius: 6px; overflow: hidden; background: #fff; box-shadow: 0 6px 16px -8px rgba(0,0,0,.8); transition: box-shadow .3s cubic-bezier(.34,1.56,.64,1), transform .3s cubic-bezier(.34,1.56,.64,1); }
.pdv-thumb:hover .pdv-thumbimg { transform: scale(1.03); } .pdv-thumb:active .pdv-thumbimg { transform: scale(.96); }
.pdv-thumb[data-active="true"] .pdv-thumbimg { box-shadow: 0 0 0 2.5px var(--ink), 0 8px 20px -8px rgba(0,0,0,.8); }
.pdv-thumb[data-active="true"] .pdv-thumbnum { padding: 3px 9px; border-radius: 999px; background: var(--ink); color: #121310; }
.pdv-thumbimg canvas { display: block; width: 100%; height: 100%; opacity: 0; transition: opacity .3s; } .pdv-thumbimg canvas[data-done="true"] { opacity: 1; }
.pdv-ribbon { position: absolute; top: -2px; right: 7px; color: #ff453a; line-height: 0; }
.pdv-ol { display: block; width: 100%; padding: 8px 10px; border: 0; border-radius: 9px; background: none; color: var(--ink); font: 400 13px/1.3 inherit; text-align: left; cursor: pointer; transition: background .15s; }
.pdv-ol:hover { background: rgba(232,231,225,.1); }
.pdv-li { display: flex; align-items: center; gap: 4px; }
.pdv-li > button:first-child { display: flex; flex: 1; min-width: 0; align-items: center; gap: 10px; padding: 9px 8px; border: 0; border-radius: 10px; background: none; color: var(--ink); font: 400 13px/1.3 inherit; text-align: left; cursor: pointer; }
.pdv-li > button:first-child:hover { background: rgba(232,231,225,.1); }
.pdv-li .pdv-dot { width: 10px; height: 10px; flex: none; } .pdv-lit { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pdv-empty { margin: 28px 8px; text-align: center; color: var(--dim); font-size: 12.5px; line-height: 1.7; }
.pdv-dim { position: absolute; inset: 0; z-index: 55; background: rgba(0,0,0,.45); }
.pdv-sheet { position: absolute; z-index: 60; left: 8px; right: 8px; bottom: 8px; height: 62%; display: flex; flex-direction: column; overflow: hidden; border-radius: 28px 28px 22px 22px; }
.pdv-grab { flex: none; display: grid; place-items: center; height: 24px; cursor: grab; touch-action: none; } .pdv-grab i { width: 38px; height: 4px; border-radius: 99px; background: rgba(232,231,225,.3); }

/* pages */
.pdv-scroller { position: absolute; top: 0; right: 0; bottom: 0; overflow: auto; overscroll-behavior: contain; touch-action: pan-x pan-y; scrollbar-width: thin; scrollbar-color: rgba(232,231,225,.22) transparent; }
.pdv-wrap { min-width: 100%; min-height: 100%; width: max-content; }
.pdv-content { position: relative; margin: 0 auto; } .pdv-slot { position: absolute; }
.pdv-paged { min-height: 100%; display: grid; } .pdv-spread { display: flex; margin: auto; }
.pdv-page { position: relative; flex: none; border-radius: 3px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.4), 0 16px 44px -14px rgba(0,0,0,.7); }
.pdv[data-theme="sepia"] .pdv-page { background: #efe0bd; } .pdv[data-theme="dark"] .pdv-page { background: #1c1c1e; }
.pdv-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; border-radius: inherit; opacity: 0; transition: opacity .25s, filter .3s; } .pdv-canvas[data-ready="true"] { opacity: 1; }
.pdv-skel { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; background: linear-gradient(100deg, transparent 30%, rgba(128,128,128,.12) 50%, transparent 70%) 0 0 / 200% 100%; animation: pdv-sh 1.3s linear infinite; }
@keyframes pdv-sh { to { background-position: -200% 0; } }
.pdv-textwrap { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.pdv-text { position: relative; overflow: hidden; line-height: 1; -webkit-text-size-adjust: none; text-size-adjust: none; }
.pdv-text span, .pdv-text br { position: absolute; color: transparent; white-space: pre; cursor: text; transform-origin: 0 0; }
.pdv-text ::selection { background: rgba(10,132,255,.35); }
.pdv-text span.pdv-hit { background: rgba(255,214,10,.5); border-radius: 2px; } .pdv-text span.pdv-cur { background: rgba(255,149,0,.8); }
.pdv-svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.pdv-layer { position: absolute; inset: 0; z-index: 4; } .pdv-layer[data-tool="draw"] { cursor: crosshair; } .pdv-layer[data-tool="text"] { cursor: text; } .pdv-layer[data-tool="note"] { cursor: copy; }
.pdv-ann { position: absolute; z-index: 3; }
.pdv-textbox { min-width: 36px; padding: 2px 5px; border-radius: 6px; outline: none; white-space: pre-wrap; cursor: text; font: 500 calc(15px * var(--pdv-s, 1)) / 1.25 var(--sa-f, system-ui, sans-serif); }
.pdv-textbox:focus { background: rgba(255,255,255,.75); box-shadow: 0 0 0 1.5px currentColor; } .pdv-textbox:empty::before { content: 'Text'; opacity: .45; }
.pdv-note { translate: -50% -100%; } .pdv-note > button { padding: 0; border: 0; background: none; cursor: pointer; filter: drop-shadow(0 2px 3px rgba(0,0,0,.45)); line-height: 0; }
.pdv-notebox { position: absolute; left: 0; top: calc(100% + 6px); width: 210px; min-height: 88px; padding: 10px 12px; border-radius: 14px; resize: none; outline: none; color: var(--ink); font: 400 13px/1.45 inherit; }
.pdv-selwrap { position: fixed; z-index: 70; width: 0; height: 0; }
.pdv-sel { position: absolute; left: 0; bottom: 0; translate: -50% 0; display: flex; align-items: center; gap: 2px; padding: 4px; border-radius: 999px; }
.pdv-toast { position: absolute; z-index: 80; left: 50%; bottom: 96px; translate: -50% 0; display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 999px; font: 500 13px/1 inherit; }

/* states */
.pdv-spin { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 50%; } .pdv-spin svg { animation: pdv-rot 1s linear infinite; }
.pdv-spin circle { fill: none; stroke: var(--ink); stroke-width: 2.4; stroke-linecap: round; stroke-dasharray: 56 88; } @keyframes pdv-rot { to { transform: rotate(360deg); } }
.pdv-card { display: grid; justify-items: center; gap: 12px; width: min(400px, 100%); padding: 28px 26px 24px; border-radius: 26px; text-align: center; }
.pdv-card h3 { margin: 4px 0 0; font: 600 17px/1.2 inherit; } .pdv-card p { margin: 0; font-size: 13px; line-height: 1.5; color: var(--dim); }
.pdv-cico { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 50%; background: rgba(232,231,225,.1); }
.pdv-pill { height: 44px; padding: 0 22px; border: 1px solid var(--line); border-radius: 999px;
  background: linear-gradient(180deg, rgba(36,37,33,.9), rgba(15,16,13,.94)); color: var(--ink); font: 600 14px/1 inherit; cursor: pointer; transition: transform .35s cubic-bezier(.34,1.4,.64,1), background .2s; }
.pdv-pill:hover { background: linear-gradient(180deg, rgba(48,49,44,.92), rgba(20,21,18,.94)); }
.pdv-pill:hover { transform: scale(1.04); } .pdv-pill:active { transform: scale(.94, .88); }

@media (prefers-reduced-motion: reduce) { .pdv-skel, .pdv-spin svg { animation: none !important; } .pdv-thumbimg, .pdv-pill { transition-duration: .01ms !important; } }
`;

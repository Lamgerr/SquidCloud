import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion';
import { GRAIN_CSS } from './grain';

export interface StackTab { id: string; title: string; kind: string }
interface Props {
  tabs: StackTab[];
  activeId?: string | null;
  onRestore: (id: string) => void;   // maximize this tab
  onClose: (id: string) => void;     // remove this tab
  onCloseAll: () => void;
}

const W = 164, H = 108, PEEK = 44;
const SPRING = { type: 'spring' as const, stiffness: 340, damping: 26, mass: 0.85 };
const INSTANT = { duration: 0.01 };

const CSS = `${GRAIN_CSS}
.ps-hit { position: fixed; right: 0; top: 50%; transform: translateY(-50%); z-index: 70; }
.ps-card { position: absolute; right: 0; top: ${-H / 2}px; width: ${W}px; height: ${H}px; transform-origin: 100% 50%; }
.ps-face { position: relative; width: 100%; height: 100%; overflow: hidden; cursor: pointer; padding: 12px 14px;
  border-radius: 18px 0 0 18px; touch-action: pan-y; color: #e8e7e1;
  background: linear-gradient(165deg, rgba(48,49,44,.8), rgba(20,21,18,.88));
  -webkit-backdrop-filter: blur(18px) saturate(150%); backdrop-filter: blur(18px) saturate(150%);
  box-shadow: inset 0 1px 0 rgba(232,231,225,.12), 0 16px 32px -14px rgba(0,0,0,.75); }
.ps-face[data-active="true"] { background: linear-gradient(165deg, rgba(66,67,60,.84), rgba(26,27,23,.9)); }
.ps-kind { font: 500 9.5px/1 var(--sa-mono, ui-monospace, monospace); letter-spacing: .14em; text-transform: uppercase; opacity: .5; }
.ps-title { margin-top: 9px; font: 500 13px/1.3 var(--sa-sans, system-ui, sans-serif); display: -webkit-box;
  -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
.ps-x { position: absolute; top: 8px; right: 8px; width: 22px; height: 22px; display: grid; place-items: center; padding: 0;
  border: 0; border-radius: 999px; color: inherit; background: rgba(232,231,225,.1); cursor: pointer; opacity: 0; transition: opacity .15s, background .15s; }
.ps-face:hover .ps-x, .ps-x:focus-visible { opacity: 1; } .ps-x:hover { background: rgba(217,128,128,.35); }
.ps-ctl { position: relative; width: 34px; height: 34px; display: grid; place-items: center; padding: 0;
  border: 0; border-radius: 999px; color: #e8e7e1; cursor: pointer; overflow: visible;
  background: linear-gradient(180deg, rgba(44,45,40,.78), rgba(18,19,16,.85));
  -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
  box-shadow: inset 0 1px 0 rgba(232,231,225,.14), 0 10px 22px -10px rgba(0,0,0,.7); }
.ps-ctl .pv-grain { border-radius: 999px; }
.ps-lbl { position: absolute; top: calc(100% + 9px); left: 50%; white-space: nowrap; opacity: 0; pointer-events: none; transform: translate(-50%, -3px);
  font: 500 10px/1 var(--sa-mono, ui-monospace, monospace); letter-spacing: .1em; text-transform: uppercase; color: rgba(232,231,225,.75);
  transition: opacity .18s, transform .18s; }
.ps-ctl:hover .ps-lbl, .ps-ctl:focus-visible .ps-lbl { opacity: 1; transform: translate(-50%, 0); }
.ps-handle { position: absolute; right: 0; top: -26px; width: 14px; height: 52px; padding: 0; border: 0; cursor: pointer;
  border-radius: 999px 0 0 999px; background: rgba(232,231,225,.22); }
.ps-face:focus-visible, .ps-ctl:focus-visible, .ps-handle:focus-visible { outline: 2px solid rgba(232,231,225,.8); outline-offset: 2px; }
`;

const Face: React.FC<{ tab: StackTab; active: boolean; interactive: boolean; reduce: boolean;
  onOpen: () => void; onClose: () => void; onReveal: () => void }> = ({ tab, active, interactive, reduce, onOpen, onClose, onReveal }) => {
  const controls = useDragControls();
  const dragged = useRef(false);
  return (
    <motion.div className="ps-face" data-active={active} role="button" tabIndex={0}
      aria-label={`Open ${tab.title}`}
      drag={reduce ? false : 'x'} dragControls={controls} dragListener={false}
      dragConstraints={{ left: 0, right: 0 }} dragElastic={{ left: 0.75, right: 0.6 }} dragSnapToOrigin
      whileDrag={{ scale: 1.05 }}
      onPointerDown={(e) => { if (interactive && !(e.target as HTMLElement).closest('button')) controls.start(e); }}
      onDragStart={() => { dragged.current = true; }}
      onDragEnd={(_, i) => {
        window.setTimeout(() => { dragged.current = false; }, 0);
        if (i.offset.x < -70 || i.velocity.x < -520) onOpen();            // pull out → maximize
        else if (i.offset.x > 90 || i.velocity.x > 620) onClose();        // flick away → close
      }}
      onClick={() => { if (dragged.current) return; interactive ? onOpen() : onReveal(); }}
      onFocus={onReveal}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}>
      <span className="pv-grain" />
      <div className="ps-kind">{tab.kind}</div>
      <div className="ps-title">{tab.title}</div>
      <button type="button" className="ps-x" aria-label={`Close ${tab.title}`}
        onClick={(e) => { e.stopPropagation(); onClose(); }}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" /></svg>
      </button>
    </motion.div>
  );
};

const MinimizedPreviewStack: React.FC<Props> = ({ tabs, activeId, onRestore, onClose, onCloseAll }) => {
  const reduce = !!useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [vh, setVh] = useState(() => (typeof window === 'undefined' ? 800 : window.innerHeight));
  const root = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<number>();
  const prevCount = useRef(tabs.length);
  const n = tabs.length;

  useEffect(() => {
    const f = () => setVh(window.innerHeight);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);

  // a freshly minimized tab always brings the stack back
  useEffect(() => { if (n > prevCount.current) setHidden(false); prevCount.current = n; }, [n]);

  // touch: tap anywhere else to tuck the stack back
  useEffect(() => {
    if (!expanded) return;
    const f = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setExpanded(false); };
    window.addEventListener('pointerdown', f);
    return () => window.removeEventListener('pointerdown', f);
  }, [expanded]);

  const enter = useCallback((e: React.PointerEvent) => {
    window.clearTimeout(leaveTimer.current);
    if (e.pointerType === 'mouse' && !hidden) setExpanded(true);
  }, [hidden]);
  const leave = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => { setExpanded(false); setHover(null); }, 320);
  }, []);
  const reveal = useCallback(() => { window.clearTimeout(leaveTimer.current); setHidden(false); setExpanded(true); }, []);

  if (!n) return null;

  const open = expanded && !hidden;
  const step = Math.max(30, Math.min(H - 20, (vh * 0.6 - H) / Math.max(n - 1, 1)));
  const lift = hover !== null ? H - step : 0;
  const mid = (n - 1) / 2;
  const top = -(mid * step) - H / 2 - (lift ? lift / 2 : 0);
  const spring = reduce ? INSTANT : SPRING;

  const target = (i: number) => {
    const rel = i - mid;
    if (hidden) return { x: W + 28, y: rel * 6, rotate: 0, scale: 1, opacity: 1 };
    if (!open) return { x: W - PEEK, y: rel * 8, rotate: rel * 2.6, scale: 1, opacity: 1 };   // fanned deck tucked at the edge
    const push = hover !== null && i > hover ? lift : 0;
    const shift = push - (lift ? lift / 2 : 0);
    return { x: hover === i ? -30 : -14, y: rel * step + shift, rotate: 0, scale: hover === i ? 1.05 : 1, opacity: 1 };
  };

  return (
    <div ref={root} className="ps-hit" onPointerEnter={enter} onPointerLeave={leave}
      style={{ width: open ? W + 70 : hidden ? 28 : PEEK + 26, height: Math.min(vh, (n - 1) * step + H + lift + 150) }}>
      <style>{CSS}</style>

      <AnimatePresence>
        {open && (
          <motion.div key="ctl" style={{ position: 'absolute', right: 16, top: '50%', display: 'flex', gap: 14 }}
            initial={{ opacity: 0, y: top - 40 }} animate={{ opacity: 1, y: top - 52 }} exit={{ opacity: 0, y: top - 36 }} transition={spring}>
            <button type="button" className="ps-ctl" aria-label="Hide all previews" onClick={() => { setHidden(true); setExpanded(false); }}>
              <span className="pv-grain" /><span className="ps-lbl">Hide all</span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l4 4-4 4M7.5 3l4 4-4 4" /></svg>
            </button>
            <button type="button" className="ps-ctl" aria-label="Close all previews" onClick={() => { setExpanded(false); onCloseAll(); }}>
              <span className="pv-grain" /><span className="ps-lbl">Close all</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M2 2l8 8M10 2l-8 8" /></svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ position: 'absolute', right: 0, top: '50%', width: 0, height: 0 }}>
        <AnimatePresence initial={false}>
          {tabs.map((t, i) => (
            <motion.div key={t.id} className="ps-card"
              style={{ zIndex: hover === i ? 99 : i }}
              initial={reduce ? false : { x: -vh * 0.5, y: -vh * 0.12, scale: 2.6, rotate: -6, opacity: 0 }}
              animate={target(i)}
              exit={{ x: W + 40, scale: 0.88, opacity: 0 }}
              transition={reduce ? INSTANT : { ...(open ? SPRING : { ...SPRING, stiffness: 300, damping: 20 }), delay: open ? i * 0.018 : (n - 1 - i) * 0.012 }}
              onPointerEnter={() => open && setHover(i)}>
              <Face tab={t} active={t.id === activeId} interactive={open} reduce={reduce}
                onOpen={() => { setExpanded(false); setHover(null); onRestore(t.id); }}
                onClose={() => { setHover(null); onClose(t.id); }}
                onReveal={reveal} />
            </motion.div>
          ))}
        </AnimatePresence>
        {hidden && <button type="button" className="ps-handle" aria-label="Show previews" onClick={reveal} onPointerEnter={(e) => e.pointerType === 'mouse' && reveal()} />}
      </div>
    </div>
  );
};

export default MinimizedPreviewStack;

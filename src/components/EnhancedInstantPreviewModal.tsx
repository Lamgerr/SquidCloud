import React, { useCallback, useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import {
  AlertCircle, Download, FileText, Layers,
} from '@/lib/icon-map';
import { cn } from '@/lib/utils';
import { downloadFilePreview } from '@/lib/res54';
import { smartDownload, createFileShare } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Loader } from '@/components/ui/Loader';
import { useIsMobile } from '@/hooks/use-mobile';

// Viewers — one frame, type-specific body
import CBVideoPlayer from './cbVideoPlayer';
import MobileVideoPlayer from './MobileVideoPlayer';
import AudioPlayer from './AudioPlayer';
import EnhancedTextEditor from './EnhancedTextEditor';
import AdvancedImageViewer from '@/components/AdvancedImageViewer';
import SpreadsheetViewer from '@/components/spreadsheet/SpreadsheetViewer';
import OptimizedPDFViewer from '@/components/OptimizedPDFViewer';
import ModelViewer from '@/components/ModelViewer';
import FontPreviewer from '@/components/FontPreviewer';
import ArchiveViewerModal from '@/components/ArchiveViewerModal';
import EnhancedMarkdownPreview from './EnhancedMarkdownPreview';
import DeepReadReader from './DeepReadReader';
import { previewTabs, detectKind, type PreviewKind } from '@/services/preview-tabs';
import { GRAIN_CSS } from './grain';
import { DOCK_CSS, Icons } from '@/components/FloatingDock';   // the dashboard dock's own tokens + icons: identical look, zero drift

const decryptedBlobCache = new Map<string, { blob: Blob; url: string; timestamp: number }>();
const MAX_CACHE_ITEMS = 15;

const SPRING = { type: 'spring' as const, stiffness: 360, damping: 28, mass: 0.8 };

const PREVIEW_CSS = `${GRAIN_CSS}
.pv-root { --pv-line: rgba(232,231,225,.10); color: #e8e7e1; }
.pv-stage { position: relative; flex: 1; min-height: 0; overflow: hidden; background: var(--sa-bg, #0c0d09); }
.pv-chrome { position: absolute; inset: 0; z-index: 80; pointer-events: none; }

/* The dock is the only hit-target: when submerged just its visible sliver catches the pointer,
   so the viewer underneath keeps every pixel of the corner. */
/* Dock visuals come from DOCK_CSS (.sq-face / .sq-round / .sq-hit): the exact faces of the dashboard dock.
   Only placement + the jelly shell live here. Open position === dashboard dock position. */
/* Anchor with plain CSS, never with animated inline values: on wide viewports
   a moving right/bottom can leave the dock stranded off-screen. */
.pv-dock.sq-orb-slot { position: absolute !important; display: block !important;
  right: max(20px, env(safe-area-inset-right)) !important;
  bottom: calc(20px + env(safe-area-inset-bottom)) !important;
  min-width: 114px; min-height: 52px; pointer-events: auto; touch-action: none; cursor: pointer; }
.pv-dock.sq-orb-slot[data-edge="true"] { top: 50% !important; bottom: auto !important; min-width: 52px; min-height: 114px; }
.pv-dock.sq-orb-slot::before { display: none !important; }   /* no glossy conic rim */
.pv-blob { position: absolute; inset: 0; height: auto; border-radius: inherit; pointer-events: none; }
.pv-dock-row { position: absolute; display: flex; gap: 10px; }

.pv-pill { display: grid; place-items: center; width: 42px; height: 42px; padding: 0; border-radius: 999px;
  border: 1px solid var(--pv-line); background: rgba(13,14,13,.86); color: #e8e7e1; cursor: pointer; }
.pv-loading { display: grid; place-items: center; gap: 14px; height: 100%; color: rgba(232,231,225,.5); font: 400 11px/1 var(--sa-mono, ui-monospace, monospace); }
.pv-error { display: grid; place-items: center; gap: 10px; height: 100%; text-align: center; padding: 24px; }
.pv-generic { display: grid; place-items: center; gap: 16px; height: 100%; text-align: center; }
.pv-generic-ico { width: 72px; height: 72px; display: grid; place-items: center; border-radius: 999px;
  border: 1px solid var(--pv-line); background: rgba(13,14,13,.86); color: #e8e7e1; }
`;

const CustomDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Popup>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Popup>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay className="z-[90] bg-background transition-opacity duration-200" />
    <DialogPrimitive.Popup ref={ref} className={cn('pv-root fixed inset-0 z-[90] flex flex-col w-screen h-screen max-w-none rounded-none border-0 bg-background text-foreground overflow-hidden', className)} {...props}>
      {children}
    </DialogPrimitive.Popup>
  </DialogPortal>
));
CustomDialogContent.displayName = 'CustomDialogContent';

interface EnhancedInstantPreviewModalProps {
  file: any; isOpen: boolean; onClose: () => void;
  onDownload?: () => void; onShare?: () => void; onNext?: () => void;
  onPrevious?: () => void; hasNext?: boolean; hasPrevious?: boolean;
  currentIndex?: number; totalFiles?: number; shareId?: string;
  onOpenEpubReader?: (file: any) => void; onShareChange?: () => void;
  siblingFiles?: any[]; onNavigateToFile?: (file: any) => void;
}

const EnhancedInstantPreviewModal: React.FC<EnhancedInstantPreviewModalProps> = ({
  file, isOpen, onClose, onDownload, onShare, onNext, onPrevious,
  hasNext = false, hasPrevious = false, shareId, onShareChange,
}) => {
  const reduce = !!useReducedMotion();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decodedBlob, setDecodedBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const loadGen = useRef(0);
  const closing = useRef(false);
  const kind: PreviewKind = file ? detectKind(file) : 'other';
  // CBVideoPlayer owns the bottom edge with its controls → the dock parks on the right-centre wall instead
  const isCbVideo = kind === 'video' && !!file?.encrypted && file?.storage_path === 'res54_distributed';


  // Register the open file as a tab when the modal opens
  useEffect(() => {
    if (isOpen && file) previewTabs.open(file, kind, file.name || 'Preview');
  }, [isOpen, file?.id, kind]);

  // Esc / viewers' own onClose / history-back → minimize (tab stays in the stack).
  // The dock's X → close (tab is removed). Two different intents, two different paths.
  const leave = useCallback((remove: boolean) => {
    if (closing.current) return;
    closing.current = true;
    if (remove && file?.id) previewTabs.close(file.id); // ASSUMED API — see notes
    else previewTabs.minimize();
    if (document.fullscreenElement) (document as any).exitFullscreen?.();
    if (window.history.state?.previewModal) window.history.back();
    onClose();
  }, [onClose, file?.id]);
  const close = useCallback(() => leave(false), [leave]);
  useEffect(() => {
    if (!isOpen) { closing.current = false; return; }
    window.history.pushState({ previewModal: true }, '');
    const onPop = () => { if (!closing.current) { closing.current = true; onClose(); } };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'ArrowRight' && hasNext) onNext?.();
      if (e.key === 'ArrowLeft' && hasPrevious) onPrevious?.();
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('keydown', onKey); };
  }, [isOpen, close, onClose, hasNext, hasPrevious, onNext, onPrevious]);

  // Decrypt (skip for streaming video/3D handled by their own loaders)
  useEffect(() => {
    if (!isOpen || !file?.id) return;
    const gen = ++loadGen.current;
    if (kind === 'video' && file?.encrypted && file?.storage_path === 'res54_distributed') {
      setBlobUrl('virtual-hls-stream'); setLoading(false); return;
    }
    if (kind === 'model') { setLoading(false); return; }
    const cached = decryptedBlobCache.get(file.id);
    if (cached) { setDecodedBlob(cached.blob); setBlobUrl(cached.url); setLoading(false); return; }
    setLoading(true); setError(null);
    (async () => {
      try {
        const quick = kind === 'text' || kind === 'markdown' || kind === 'image';
        let blob: Blob;
        if (quick) {
          const p = await downloadFilePreview(file.id, 3, { shareId });
          blob = p.blob;
          if (p.isPartial) {
            smartDownload(file.id, { reason: 'preview', fileName: file.name, shareId })
              .then(full => {
                if (loadGen.current !== gen) return;
                const url = URL.createObjectURL(full);
                if (decryptedBlobCache.size >= MAX_CACHE_ITEMS) {
                  const k = decryptedBlobCache.keys().next().value;
                  if (k) { URL.revokeObjectURL(decryptedBlobCache.get(k)!.url); decryptedBlobCache.delete(k); }
                }
                decryptedBlobCache.set(file.id, { blob: full, url, timestamp: Date.now() });
                setDecodedBlob(full); setBlobUrl(url);
              }).catch(() => {});
          }
        } else {
          blob = await smartDownload(file.id, { reason: 'preview', fileName: file.name, shareId });
        }
        if (loadGen.current !== gen) return;
        const url = URL.createObjectURL(blob);
        if (decryptedBlobCache.size >= MAX_CACHE_ITEMS) {
          const k = decryptedBlobCache.keys().next().value;
          if (k) { URL.revokeObjectURL(decryptedBlobCache.get(k)!.url); decryptedBlobCache.delete(k); }
        }
        decryptedBlobCache.set(file.id, { blob, url, timestamp: Date.now() });
        setDecodedBlob(blob); setBlobUrl(url); setLoading(false);
      } catch (e: any) {
        if (loadGen.current === gen) { setError(e?.message || 'Unable to load preview'); setLoading(false); }
      }
    })();
  }, [isOpen, file?.id, kind, shareId]);

  const handleDownload = useCallback(async () => {
    if (onDownload) { onDownload(); return; }
    try {
      const blob = decodedBlob || await smartDownload(file.id, { reason: 'download', fileName: file.name, shareId });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e: any) { toast({ title: 'Download failed', description: e?.message, variant: 'destructive' }); }
  }, [onDownload, decodedBlob, file?.id, file?.name, shareId, toast]);

  const handleShare = useCallback(async () => {
    if (onShare) { await onShare(); onShareChange?.(); return; }
    try { const { shareUrl } = await createFileShare(file.id); await navigator.clipboard.writeText(shareUrl); toast({ title: 'Share link copied' }); onShareChange?.(); }
    catch (e: any) { toast({ title: 'Share failed', description: e?.message, variant: 'destructive' }); }
  }, [onShare, file?.id, onShareChange, toast]);

  if (!file) return null;

  const renderBody = () => {
    if (kind === 'video') {
      if (file?.encrypted && file?.storage_path === 'res54_distributed') return <CBVideoPlayer file={file} autoPlay className="h-full w-full" shareId={shareId} />;
      if (!blobUrl) return <Loading />;
      return isMobile
        ? <MobileVideoPlayer file={file} blobUrl={blobUrl} onClose={close} />
        : <div className="h-full w-full grid place-items-center"><video src={blobUrl} controls className="max-h-full max-w-full" /></div>;
    }
    if (kind === 'audio') return blobUrl ? <AudioPlayer file={file} src={blobUrl} open onClose={close} onDownload={handleDownload} onShare={handleShare} /> : <Loading />;
    if (kind === 'epub') return <DeepReadReader file={file} source="local" isOpen onClose={close} />;
    if (loading) return <Loading />;
    if (error) return <div className="pv-error"><AlertCircle size={28} /><p className="text-sm">{error}</p></div>;
    if (!blobUrl && kind !== 'model') return <Loading />;

    switch (kind) {
      case 'pdf': return <OptimizedPDFViewer file={file} blobUrl={blobUrl!} pdfBlob={decodedBlob!} onClose={close} onDownload={handleDownload} />;
      case 'image': return <AdvancedImageViewer src={blobUrl!} alt={file.name} file={{ name: file.name, size: file.size, type: file.type }} onDownload={handleDownload} onShare={handleShare} />;
      case 'text': return <EnhancedTextEditor file={file} decodedBlob={decodedBlob!} onSave={async () => {}} onDownload={handleDownload} onShare={handleShare} readonly={false} />;
      case 'markdown': return <MarkdownBody blob={decodedBlob} />;
      case 'spreadsheet': return <SpreadsheetViewer src={blobUrl!} fileName={file.name} onDownload={handleDownload} onClose={close} />;
      case 'font': return <FontPreviewer src={blobUrl!} fileName={file.name} />;
      case 'archive': return <div className="pv-generic"><div className="pv-generic-ico"><Layers size={28} /></div><button className="pv-pill" onClick={() => setArchiveOpen(true)}>Browse</button><ArchiveViewerModal open={archiveOpen} onClose={() => setArchiveOpen(false)} file={{ id: file.id, name: file.name, url: blobUrl! }} onDownload={handleDownload} /></div>;
      case 'model': return <ModelViewer src={blobUrl || file.url || ''} fileName={file.name} fileType={file.type} />;
      default: return <div className="pv-generic"><div className="pv-generic-ico"><FileText size={28} /></div><p className="text-sm text-muted-foreground">No inline preview — download to open.</p><button className="pv-pill" onClick={handleDownload}><Download size={17} /></button></div>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) close(); }}>
      <CustomDialogContent>
        <style>{DOCK_CSS}</style>
        <style>{PREVIEW_CSS}</style>
        <DialogPrimitive.Title className="sr-only">Preview {file.name}</DialogPrimitive.Title>
        <DialogPrimitive.Description className="sr-only">Full-screen file preview.</DialogPrimitive.Description>
        <motion.div className="pv-stage" initial={reduce ? false : { opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING}>
          {renderBody()}
        </motion.div>

        <div className="pv-chrome">
          <FloatingDock reduce={reduce} side={isCbVideo ? 'edge' : 'corner'} resetKey={file.id} onMinimize={close} onClose={() => leave(true)} />
        </div>
      </CustomDialogContent>
    </Dialog>
  );
};

/* ── The one floating dock. Looks and sits exactly like the dashboard dock (two 52px faces, 10px gap,
      20px from the corner), so opening/closing a preview never shifts the UI.
      After 2s it is thrown into the wall as jelly: square where it touches, round where it is free,
      wobbling to rest. Magnetic: bulges toward an approaching cursor, pops open on contact, can be pulled
      like tethered gel. 'edge' mode (CBVideoPlayer) parks it on the right-centre wall, away from the
      player's controls. ── */
type DockSide = 'corner' | 'edge';
const GEO = {
  corner: { open: { w: 114, h: 52 }, dock: { w: 58, h: 54 }, r: [28, 8, 0, 8] },   // radii: TL TR BR BL
  edge:   { open: { w: 52, h: 114 }, dock: { w: 34, h: 68 }, r: [17, 0, 0, 17] },
} as const;
const OPEN_R = 26;
const spring = (stiffness: number, damping: number, extra: object = {}) => ({ type: 'spring' as const, stiffness, damping, mass: 1, ...extra });
const rubber = (d: number) => (d > 0 ? 44 * (1 - Math.exp(-d / 140)) : 0);   // gentle, capped stretch
const faceSpring = { type: 'spring' as const, stiffness: 320, damping: 30, mass: 1 };

const MinimizeGlyph: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 4.5V9H4.5M15 4.5V9h4.5M9 19.5V15H4.5M15 19.5V15h4.5" />
  </svg>
);

const FloatingDock: React.FC<{ reduce: boolean; side: DockSide; resetKey: unknown; onMinimize: () => void; onClose: () => void }> = ({ reduce, side, resetKey, onMinimize, onClose }) => {
  const edge = side === 'edge';
  const g = GEO[side];
  const geo = useRef<typeof GEO[DockSide]>(g); geo.current = g;

  const w = useMotionValue<number>(g.open.w), h = useMotionValue<number>(g.open.h);
  const rTL = useMotionValue(OPEN_R), rTR = useMotionValue(OPEN_R), rBR = useMotionValue(OPEN_R), rBL = useMotionValue(OPEN_R);
  const mw = useSpring(0, { stiffness: 240, damping: 26, mass: 1 });
  const mh = useSpring(0, { stiffness: 240, damping: 26, mass: 1 });
  const width = useTransform([w, mw], ([a, b]: number[]) => Math.max(24, a + b));
  const height = useTransform([h, mh], ([a, b]: number[]) => Math.max(24, a + b));
  const radius = useTransform([rTL, rTR, rBR, rBL], (v: number[]) => v.map((n) => `${Math.max(0, n)}px`).join(' '));
  const y = useTransform(height, (v) => (geo.current === GEO.edge ? -v / 2 : 0));
  const rowOpacity = useTransform([w, h], ([a, b]: number[]) => {   // 0 = jelly blob, 1 = open faces
    const G = geo.current, e = G === GEO.edge, v = e ? b : a, lo = e ? G.dock.h : G.dock.w, hi = e ? G.open.h : G.open.w;
    return Math.min(1, Math.max(0, (v - lo - 6) / (hi - lo - 18)));
  });
  const rowScale = useTransform(rowOpacity, (o) => 0.55 + 0.45 * o);
  const rowEvents = useTransform(rowOpacity, (o) => (o > 0.6 ? 'auto' : 'none'));
  const blobOpacity = useTransform(rowOpacity, (o) => 1 - Math.min(1, o * 1.15));

  const isOpen = useRef(true), panning = useRef(false), timer = useRef<number>();

  const settle = useCallback((open: boolean) => {
    isOpen.current = open;
    const G = geo.current;
    if (open) { mw.set(0); mh.set(0); }
    if (reduce) {
      w.set(open ? G.open.w : G.dock.w); h.set(open ? G.open.h : G.dock.h);
      [rTL, rTR, rBR, rBL].forEach((v, i) => v.set(open ? OPEN_R : G.r[i]));
      return;
    }
    if (open) {
      animate(w, G.open.w, spring(320, 30));
      animate(h, G.open.h, spring(320, 30));
      [rTL, rTR, rBR, rBL].forEach((v) => animate(v, OPEN_R, spring(300, 30)));
    } else {
      animate(w, G.dock.w, spring(300, 32));
      animate(h, G.dock.h, spring(300, 32));
      [rTL, rTR, rBR, rBL].forEach((v, i) => animate(v, G.r[i], spring(320, 34)));
    }
  }, [reduce, w, h, rTL, rTR, rBR, rBL, mw, mh]);
  const settleRef = useRef(settle); settleRef.current = settle;

  const hold = () => window.clearTimeout(timer.current);
  const hideIn = (ms: number) => { hold(); timer.current = window.setTimeout(() => settleRef.current(false), ms); };
  const reveal = (autoHide?: number) => { hold(); if (!isOpen.current) settleRef.current(true); if (autoHide) hideIn(autoHide); };

  useEffect(() => { reveal(2000); return hold; }, [resetKey]);          // new file → show 2s, then throw into the wall
  useEffect(() => { settleRef.current(isOpen.current); }, [side]);       // moved to another wall → re-shape

  useEffect(() => {   // magnetism: lean toward the cursor
    if (reduce) return;
    const move = (e: PointerEvent) => {
      if (isOpen.current || panning.current || e.pointerType !== 'mouse') return;
      const ed = geo.current === GEO.edge;
      const dx = window.innerWidth - e.clientX;
      const dy = ed ? Math.abs(e.clientY - window.innerHeight / 2) : window.innerHeight - e.clientY;
      const d = Math.hypot(dx, dy) || 1, R = 240;
      if (d >= R) { mw.set(0); mh.set(0); return; }
      const pull = Math.pow(1 - d / R, 2) * 16;
      mw.set((pull * dx) / d); mh.set(((ed ? 0.7 : 1) * pull * dy) / d);
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, [reduce, mw, mh]);

  const stretchY = (oy: number) => (edge ? rubber(Math.abs(oy)) * 0.5 : rubber(-oy));
  const press = reduce ? undefined : { scaleX: 0.97, scaleY: 0.95 };
  const hoverFx = reduce ? undefined : { scale: 1.02 };
  const rowStyle: React.CSSProperties = edge
    ? { right: 0, top: '50%', marginTop: -57, width: 52, height: 114, flexDirection: 'column', transformOrigin: '100% 50%' }
    : { right: 0, bottom: 0, width: 114, height: 52, flexDirection: 'row', transformOrigin: '100% 100%' };

  return (
    <motion.div className="pv-dock sq-orb-slot" role="toolbar" aria-label="Preview controls" data-edge={edge || undefined}
      style={{ top: edge ? '50%' : 'auto', y, width, height, borderRadius: radius }}
      onPanStart={() => { panning.current = true; hold(); }}
      onPan={(_, i) => { if (!isOpen.current) { mw.set(rubber(-i.offset.x)); mh.set(stretchY(i.offset.y)); } }}
      onPanEnd={(_, i) => {
        window.setTimeout(() => { panning.current = false; }, 0);
        if (isOpen.current) return;
        const pulled = Math.hypot(rubber(-i.offset.x), stretchY(i.offset.y));
        if (pulled > 40 || i.velocity.x < -300) reveal(3000);
        else { mw.set(0); mh.set(0); }                                   // let go early: gel snaps back and wobbles
      }}
      onClick={() => { if (!panning.current && !isOpen.current) reveal(3000); }}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') reveal(); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') hideIn(650); }}
      onFocusCapture={() => reveal()} onBlurCapture={() => hideIn(1200)}>
      <motion.span className="sq-face pv-blob" style={{ opacity: blobOpacity }} />
      <motion.div className="pv-dock-row" style={{ ...rowStyle, opacity: rowOpacity, scale: rowScale, pointerEvents: rowEvents }}>
        <button type="button" className="sq-hit" aria-label="Minimize" title="Minimize" onClick={onMinimize}>
          <motion.span className="sq-face sq-round" whileHover={hoverFx} whileTap={press} transition={reduce ? { duration: 0.01 } : faceSpring}>
            <MinimizeGlyph size={20} />
          </motion.span>
        </button>
        <button type="button" className="sq-hit" aria-label="Close" title="Close" onClick={onClose}>
          <motion.span className="sq-face sq-round" whileHover={hoverFx} whileTap={press} transition={reduce ? { duration: 0.01 } : faceSpring}>
            <Icons.X size={22} />
          </motion.span>
        </button>
      </motion.div>
    </motion.div>
  );
};

const Loading: React.FC = () => (
  <div className="pv-loading"><Loader size="lg" /><span>Decrypting preview…</span></div>
);

/** Text body read asynchronously — keeps the render path sync. */
const MarkdownBody: React.FC<{ blob: Blob | null }> = ({ blob }) => {
  const [text, setText] = useState('');
  useEffect(() => {
    let alive = true;
    if (blob) blob.text().then(t => { if (alive) setText(t); }).catch(() => {});
    return () => { alive = false; };
  }, [blob]);
  return <div className="h-full overflow-auto p-8"><EnhancedMarkdownPreview content={text} /></div>;
};

export default EnhancedInstantPreviewModal;

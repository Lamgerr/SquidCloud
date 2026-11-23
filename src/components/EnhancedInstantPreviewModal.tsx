import React, { useCallback, useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import {
  AlertCircle, Download, FileText, Minimize, X, Layers,
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

const decryptedBlobCache = new Map<string, { blob: Blob; url: string; timestamp: number }>();
const MAX_CACHE_ITEMS = 15;

const SPRING = { type: 'spring' as const, stiffness: 360, damping: 28, mass: 0.8 };

const PREVIEW_CSS = `${GRAIN_CSS}
.pv-root { --pv-line: rgba(232,231,225,.10); color: #e8e7e1; }
.pv-stage { position: relative; flex: 1; min-height: 0; overflow: hidden; background: var(--sa-bg, #0c0d09); }
.pv-chrome { position: absolute; inset: 0; z-index: 80; pointer-events: none; }

/* The dock is the only hit-target: when submerged just its visible sliver catches the pointer,
   so the viewer underneath keeps every pixel of the corner. */
.pv-dock { position: absolute; overflow: hidden; pointer-events: auto; touch-action: none; cursor: pointer;
  background: linear-gradient(180deg, rgba(36,37,33,.6), rgba(14,15,12,.72));
  -webkit-backdrop-filter: blur(28px) saturate(170%); backdrop-filter: blur(28px) saturate(170%);
  box-shadow: inset 0 1px 0 rgba(232,231,225,.18), inset 0 -1px 0 rgba(0,0,0,.4), 0 18px 40px -16px rgba(0,0,0,.75); }
/* buttons keep their own size and stay pinned to the corner; the jelly shell grows/shrinks around them */
.pv-dock-row { position: absolute; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; gap: 6px; transform-origin: 100% 100%; }
.pv-dock-btn { position: relative; z-index: 1; display: grid; place-items: center; width: 46px; height: 46px; padding: 0;
  border: 0; border-radius: 999px; cursor: pointer; color: #e8e7e1; background: rgba(232,231,225,.07);
  transition: background .2s, color .2s; }
.pv-dock-btn:hover { background: rgba(232,231,225,.17); }
.pv-dock-btn[data-close="true"]:hover { background: rgba(217,128,128,.3); color: #ffd2d2; }
.pv-dock-btn:focus-visible { outline: 2px solid rgba(232,231,225,.85); outline-offset: 1px; }

.pv-pill { display: grid; place-items: center; width: 42px; height: 42px; padding: 0; border-radius: 999px;
  border: 1px solid var(--pv-line); background: rgba(13,14,13,.86); color: #e8e7e1; cursor: pointer; }
.pv-loading { display: grid; place-items: center; gap: 14px; height: 100%; color: rgba(232,231,225,.5); font: 400 11px/1 var(--sa-mono, ui-monospace, monospace); }
.pv-error { display: grid; place-items: center; gap: 10px; height: 100%; text-align: center; padding: 24px; }
.pv-generic { display: grid; place-items: center; gap: 16px; height: 100%; text-align: center; }
.pv-generic-ico { width: 72px; height: 72px; display: grid; place-items: center; border-radius: 999px;
  border: 1px solid var(--pv-line); background: rgba(13,14,13,.86); color: #e8e7e1; }
@media (max-width: 640px) { .pv-dock-btn { width: 42px; height: 42px; } }
@media (prefers-reduced-motion: reduce) { .pv-dock-btn { transition-duration: 0.01ms !important; } }
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
        <style>{PREVIEW_CSS}</style>
        <DialogPrimitive.Title className="sr-only">Preview {file.name}</DialogPrimitive.Title>
        <DialogPrimitive.Description className="sr-only">Full-screen file preview.</DialogPrimitive.Description>
        <motion.div className="pv-stage" initial={reduce ? false : { opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING}>
          {renderBody()}
        </motion.div>

        <div className="pv-chrome">
          <FloatingDock reduce={reduce} compact={isMobile} resetKey={file.id} onMinimize={close} onClose={() => leave(true)} />
        </div>
      </CustomDialogContent>
    </Dialog>
  );
};

/* ── The one floating dock, as jelly. It never leaves the screen: after 2s it is thrown into the
      bottom-right corner, squashes flat against both walls (square corners where it touches, round
      where it is free) and wobbles to rest. Magnetic: the blob bulges toward an approaching cursor,
      pops open on contact, and can be pulled like a tethered gel, release past the threshold and it
      springs open, otherwise it snaps back. Shape is driven by underdamped springs on width / height /
      per-corner radius; height gets an opposite starting velocity so volume feels conserved. ── */
const DOCK = { w: 58, h: 54 };
const spring = (stiffness: number, damping: number, extra: object = {}) => ({ type: 'spring' as const, stiffness, damping, mass: 1, ...extra });
const rubber = (d: number) => (d > 0 ? 96 * (1 - Math.exp(-d / 120)) : 0);   // soft-capped stretch

const FloatingDock: React.FC<{ reduce: boolean; compact: boolean; resetKey: unknown; onMinimize: () => void; onClose: () => void }> = ({ reduce, compact, resetKey, onMinimize, onClose }) => {
  const btn = compact ? 42 : 46;
  const OPEN = { w: btn * 2 + 20, h: btn + 14, m: compact ? 14 : 20 };
  const geo = useRef(OPEN); geo.current = OPEN;

  const w = useMotionValue(OPEN.w), h = useMotionValue(OPEN.h), m = useMotionValue(OPEN.m);
  const rTL = useMotionValue(OPEN.h / 2), rTR = useMotionValue(OPEN.h / 2), rBR = useMotionValue(OPEN.h / 2), rBL = useMotionValue(OPEN.h / 2);
  const mw = useSpring(0, { stiffness: 190, damping: 13, mass: 0.8 });   // magnetic / pull stretch, x
  const mh = useSpring(0, { stiffness: 190, damping: 13, mass: 0.8 });   // magnetic / pull stretch, y
  const width = useTransform([w, mw], ([a, b]: number[]) => Math.max(24, a + b));
  const height = useTransform([h, mh], ([a, b]: number[]) => Math.max(24, a + b));
  const radius = useTransform([rTL, rTR, rBR, rBL], (v: number[]) => v.map((n) => `${Math.max(0, n)}px`).join(' '));
  const rowOpacity = useTransform(w, [DOCK.w + 16, OPEN.w - 12], [0, 1], { clamp: true });
  const rowScale = useTransform(w, [DOCK.w, OPEN.w], [0.5, 1], { clamp: true });
  const rowEvents = useTransform(rowOpacity, (o) => (o > 0.6 ? 'auto' : 'none'));

  const isOpen = useRef(true), panning = useRef(false), timer = useRef<number>();

  const settle = useCallback((open: boolean) => {
    isOpen.current = open;
    const g = geo.current, r = g.h / 2;
    if (open) { mw.set(0); mh.set(0); }
    if (reduce) {
      w.set(open ? g.w : DOCK.w); h.set(open ? g.h : DOCK.h); m.set(open ? g.m : 0);
      [rTL, rTR, rBR, rBL].forEach((v, i) => v.set(open ? r : [28, 8, 0, 8][i]));
      return;
    }
    if (open) {            // pop out of the corner: overshoot, settle
      animate(m, g.m, spring(320, 17));
      animate(w, g.w, spring(300, 12));
      animate(h, g.h, spring(320, 13, { velocity: -140 }));
      [rTL, rTR, rBR, rBL].forEach((v) => animate(v, r, spring(260, 15)));
    } else {               // thrown into the corner: slam, flatten against the walls, wobble
      animate(m, 0, spring(520, 26));
      animate(w, DOCK.w, spring(210, 9));
      animate(h, DOCK.h, spring(240, 10, { velocity: 260 }));   // squashed wide → bulges tall
      animate(rTL, 28, spring(300, 16)); animate(rTR, 8, spring(300, 12));
      animate(rBL, 8, spring(300, 12));  animate(rBR, 0, spring(700, 40));  // wall-touching corner goes square instantly
    }
  }, [reduce, w, h, m, rTL, rTR, rBR, rBL, mw, mh]);
  const settleRef = useRef(settle); settleRef.current = settle;

  const hold = () => window.clearTimeout(timer.current);
  const hideIn = (ms: number) => { hold(); timer.current = window.setTimeout(() => settleRef.current(false), ms); };
  const reveal = (autoHide?: number) => { hold(); if (!isOpen.current) settleRef.current(true); if (autoHide) hideIn(autoHide); };

  useEffect(() => { reveal(2000); return hold; }, [resetKey]);   // new file → show 2s, then throw into the corner

  // magnetism: the blob leans toward the cursor as it approaches the corner
  useEffect(() => {
    if (reduce) return;
    const move = (e: PointerEvent) => {
      if (isOpen.current || panning.current || e.pointerType !== 'mouse') return;
      const dx = window.innerWidth - e.clientX, dy = window.innerHeight - e.clientY;
      const d = Math.hypot(dx, dy) || 1, R = 240;
      if (d >= R) { mw.set(0); mh.set(0); return; }
      const pull = Math.pow(1 - d / R, 2) * 46;
      mw.set((pull * dx) / d); mh.set((pull * dy) / d);
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, [reduce, mw, mh]);

  return (
    <motion.div className="pv-dock" role="toolbar" aria-label="Preview controls"
      style={{ right: m, bottom: m, width, height, borderRadius: radius }}
      onPanStart={() => { panning.current = true; hold(); }}
      onPan={(_, i) => { if (!isOpen.current) { mw.set(rubber(-i.offset.x)); mh.set(rubber(-i.offset.y)); } }}
      onPanEnd={(_, i) => {
        window.setTimeout(() => { panning.current = false; }, 0);
        if (isOpen.current) return;
        const pulled = Math.hypot(rubber(-i.offset.x), rubber(-i.offset.y));
        if (pulled > 40 || i.velocity.x < -300 || i.velocity.y < -300) reveal(3000);
        else { mw.set(0); mh.set(0); }                                  // let go early: gel snaps back and wobbles
      }}
      onClick={() => { if (!panning.current && !isOpen.current) reveal(3000); }}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') reveal(); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') hideIn(650); }}
      onFocusCapture={() => reveal()} onBlurCapture={() => hideIn(1200)}>
      <span className="pv-grain" />
      <motion.div className="pv-dock-row" style={{ width: OPEN.w, height: OPEN.h, opacity: rowOpacity, scale: rowScale, pointerEvents: rowEvents }}>
        <motion.button type="button" className="pv-dock-btn" aria-label="Minimize" title="Minimize" onClick={onMinimize}
          whileHover={reduce ? undefined : { scale: 1.08 }} whileTap={reduce ? undefined : { scale: 0.9 }} transition={SPRING}>
          <Minimize size={18} />
        </motion.button>
        <motion.button type="button" className="pv-dock-btn" data-close="true" aria-label="Close" title="Close" onClick={onClose}
          whileHover={reduce ? undefined : { scale: 1.08 }} whileTap={reduce ? undefined : { scale: 0.9 }} transition={SPRING}>
          <X size={19} />
        </motion.button>
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

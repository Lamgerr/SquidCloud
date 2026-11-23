import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
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

const decryptedBlobCache = new Map<string, { blob: Blob; url: string; timestamp: number }>();
const MAX_CACHE_ITEMS = 15;

const SPRING = { type: 'spring' as const, stiffness: 360, damping: 28, mass: 0.8 };

/* ── Full-screen preview frame: ONE floating dock, nothing else on screen.
      Grainy + translucent + springy. Visible 2s → submerges into corner;
      hover the corner or pull the dock to reveal minimize + close. ── */
const GRAIN_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 220 220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const PREVIEW_CSS = `
.pv-root { --pv-line: rgba(232,231,225,.10); color: #e8e7e1; }
.pv-stage { position: relative; flex: 1; min-height: 0; overflow: hidden; background: var(--sa-bg, #0c0d09); }
.pv-chrome { position: absolute; inset: 0; z-index: 80; pointer-events: none; }

/* nano-texture grain overlay — reused by dock + palette + tabs */
.pv-grain, .sq-grain { position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background-image: ${GRAIN_BG}; background-size: 160px 160px;
  opacity: .14; mix-blend-mode: overlay; }

/* corner hot-zone: stationary so hover never flickers while the dock moves */
.pv-dock-zone { position: fixed; right: 0; bottom: 0; width: 210px; height: 128px;
  z-index: 95; pointer-events: auto; touch-action: none; }
.pv-dock-shell { position: absolute; right: 22px; bottom: 22px; pointer-events: auto;
  filter: drop-shadow(0 20px 34px rgba(0,0,0,.55)); will-change: transform; }
.pv-dock { position: relative; display: flex; align-items: center; gap: 8px; padding: 9px 12px 9px 10px;
  border-radius: 999px; overflow: hidden; cursor: grab;
  border: 1px solid rgba(232,231,225,.13);
  background: linear-gradient(180deg, rgba(30,31,28,.74), rgba(12,13,11,.8));
  -webkit-backdrop-filter: blur(26px) saturate(160%); backdrop-filter: blur(26px) saturate(160%);
  box-shadow: inset 0 1px 0 rgba(232,231,225,.16), inset 0 -1px 0 rgba(0,0,0,.45), 0 10px 30px -14px rgba(0,0,0,.8); }
.pv-dock:active { cursor: grabbing; }
.pv-dock-grip { position: relative; z-index: 1; width: 8px; height: 30px; flex: none; margin-right: 2px;
  border-radius: 999px; background: rgba(232,231,225,.16); }
.pv-dock-grip::after { content: ''; position: absolute; inset: 9px 2px; border-radius: 999px;
  background: rgba(232,231,225,.5); }
.pv-dock-btn { position: relative; z-index: 1; display: grid; place-items: center; width: 44px; height: 44px;
  padding: 0; border-radius: 999px; cursor: pointer; color: #e8e7e1;
  border: 1px solid rgba(232,231,225,.09); background: rgba(232,231,225,.05);
  transition: background .2s, border-color .2s, color .2s; }
.pv-dock-btn:hover { background: rgba(232,231,225,.14); border-color: rgba(232,231,225,.2); }
.pv-dock-btn:focus-visible { outline: 2px solid rgba(232,231,225,.85); outline-offset: 2px; }
.pv-dock-btn[data-close="true"] { background: rgba(217,128,128,.12); border-color: rgba(217,128,128,.26); color: #e8a0a0; }
.pv-dock-btn[data-close="true"]:hover { background: rgba(217,128,128,.22); }

.pv-pill { display: grid; place-items: center; width: 42px; height: 42px; padding: 0; border-radius: 999px;
  border: 1px solid var(--pv-line); background: rgba(13,14,13,.86); color: #e8e7e1; cursor: pointer; }
.pv-loading { display: grid; place-items: center; gap: 14px; height: 100%; color: rgba(232,231,225,.5); font: 400 11px/1 var(--sa-mono, ui-monospace, monospace); }
.pv-error { display: grid; place-items: center; gap: 10px; height: 100%; text-align: center; padding: 24px; }
.pv-generic { display: grid; place-items: center; gap: 16px; height: 100%; text-align: center; }
.pv-generic-ico { width: 72px; height: 72px; display: grid; place-items: center; border-radius: 999px;
  border: 1px solid var(--pv-line); background: rgba(13,14,13,.86); color: #e8e7e1; }
@media (max-width: 640px) { .pv-dock-zone { width: 172px; height: 112px; } .pv-dock-shell { right: 16px; bottom: 16px; } .pv-dock-btn { width: 40px; height: 40px; } }
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
  // The single dock starts expanded for 2s, then submerges into the corner.
  // Hovering the corner hot-zone or dragging the dock back out reveals it.
  const [dockOpen, setDockOpen] = useState(true);
  const [dockHover, setDockHover] = useState(false);
  const [dockPulled, setDockPulled] = useState(false);
  const loadGen = useRef(0);
  const closing = useRef(false);
  const kind: PreviewKind = file ? detectKind(file) : 'other';

  // Auto-submerge: dock is fully visible for 2s on open, then snaps into the corner.
  useEffect(() => {
    if (!isOpen) return;
    setDockOpen(true);
    setDockPulled(false);
    setDockHover(false);
    const t = window.setTimeout(() => setDockOpen(false), 2000);
    return () => window.clearTimeout(t);
  }, [isOpen, file?.id]);

  const dockRevealed = dockOpen || dockHover || dockPulled;

  // Register the open file as a tab when the modal opens
  useEffect(() => {
    if (isOpen && file) previewTabs.open(file, kind, file.name || 'Preview');
  }, [isOpen, file?.id, kind]);

  // History / ESC
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    previewTabs.minimize();
    if (document.fullscreenElement) (document as any).exitFullscreen?.();
    if (window.history.state?.previewModal) window.history.back();
    onClose();
  }, [onClose]);
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

        {/* ONE floating dock. Grainy + translucent + springy. Visible 2s, then
            submerges into the corner; hover the corner or pull to reveal. */}
        <div className="pv-chrome">
          <div className="pv-dock-zone"
            onPointerEnter={() => setDockHover(true)}
            onPointerLeave={() => { setDockHover(false); setDockPulled(false); }}>
            <motion.div className="pv-dock-shell"
              animate={{ x: dockRevealed ? '0%' : '74%', y: dockRevealed ? '0%' : '62%', scale: dockRevealed ? 1 : 0.9, opacity: 1 }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 240, damping: 17, mass: 0.9 }}>
              <motion.div className="pv-dock"
                drag={reduce ? false : true}
                dragConstraints={{ top: -52, bottom: 6, left: -70, right: 26 }}
                dragElastic={0.16}
                dragSnapToOrigin
                onDragStart={() => setDockPulled(true)}
                whileDrag={reduce ? undefined : { scale: 1.04 }}>
                <span className="pv-grain" />
                <span className="pv-dock-grip" aria-hidden="true" />
                <motion.button type="button" className="pv-dock-btn" aria-label="Minimize" title="Minimize"
                  onClick={close}
                  whileHover={reduce ? undefined : { scale: 1.08 }} whileTap={reduce ? undefined : { scale: 0.9 }} transition={SPRING}>
                  <Minimize size={18} />
                </motion.button>
                <motion.button type="button" className="pv-dock-btn" data-close="true" aria-label="Close" title="Close"
                  onClick={close}
                  whileHover={reduce ? undefined : { scale: 1.08 }} whileTap={reduce ? undefined : { scale: 0.9 }} transition={SPRING}>
                  <X size={19} />
                </motion.button>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </CustomDialogContent>
    </Dialog>
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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import {
  AlertCircle, ChevronLeft, ChevronRight, Download, FileText, Share2,
  Maximize, Minimize, X, Info, Layers,
} from '@/lib/icon-map';
import { cn, formatFileSize } from '@/lib/utils';
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

/* ── Full-screen preview frame: floating dock language, zero decoration.
      One circular X, minimize, type-aware tools, minimal on-screen UI. ── */
const PREVIEW_CSS = `
.pv-root { --pv-line: rgba(232,231,225,.10); --pv-fill: rgba(13,14,13,.86); color: #e8e7e1; }
.pv-stage { position: relative; flex: 1; min-height: 0; overflow: hidden; background: var(--sa-bg, #0c0d09); }
.pv-chrome { position: absolute; inset: 0; z-index: 80; pointer-events: none; }
.pv-top { position: absolute; top: 18px; left: 18px; right: 18px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.pv-id { min-width: 0; padding: 10px 16px; border-radius: 16px; pointer-events: auto;
  border: 1px solid var(--pv-line); background: var(--pv-fill);
  -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
  box-shadow: inset 0 1px 0 rgba(232,231,225,.12), 0 12px 28px -14px rgba(0,0,0,.7); }
.pv-name { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 38vw; }
.pv-meta { font: 400 10px/1 var(--sa-mono, ui-monospace, monospace); color: rgba(232,231,225,.5); margin-top: 5px; }
.pv-tools { display: flex; align-items: center; gap: 8px; pointer-events: auto; }
/* every control is a true circle — no rectangles */
.pv-pill { display: grid; place-items: center; width: 42px; height: 42px; padding: 0; border-radius: 999px;
  border: 1px solid var(--pv-line); background: var(--pv-fill); color: #e8e7e1; cursor: pointer;
  -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
  box-shadow: inset 0 1px 0 rgba(232,231,225,.12), 0 12px 28px -14px rgba(0,0,0,.7); }
.pv-pill:hover { border-color: rgba(232,231,225,.24); }
.pv-pill:focus-visible { outline: 2px solid rgba(232,231,225,.8); outline-offset: 3px; }
.pv-pill[data-on="true"] { background: rgba(232,231,225,.16); }
.pv-pill[data-close="true"] { background: rgba(217,128,128,.14); border-color: rgba(217,128,128,.3); color: #e8a0a0; }
.pv-pill[data-close="true"]:hover { background: rgba(217,128,128,.24); }
.pv-nav { display: flex; align-items: center; gap: 6px; }
.pv-hint { font: 400 10px/1 var(--sa-mono, ui-monospace, monospace); color: rgba(232,231,225,.4); padding: 0 4px; }
.pv-foot { position: absolute; bottom: 18px; left: 50%; translate: -50% 0; display: flex; gap: 8px; pointer-events: auto; }
.pv-info { position: absolute; bottom: 18px; right: 18px; pointer-events: auto; max-width: 250px; padding: 12px 14px;
  border-radius: 16px; border: 1px solid var(--pv-line); background: var(--pv-fill);
  -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
  box-shadow: inset 0 1px 0 rgba(232,231,225,.12), 0 12px 28px -14px rgba(0,0,0,.7);
  font: 400 11px/1.6 var(--sa-mono, ui-monospace, monospace); color: rgba(232,231,225,.65); }
.pv-info b { color: #e8e7e1; font-weight: 400; }
.pv-loading { display: grid; place-items: center; gap: 14px; height: 100%; color: rgba(232,231,225,.5); font: 400 11px/1 var(--sa-mono, ui-monospace, monospace); }
.pv-error { display: grid; place-items: center; gap: 10px; height: 100%; text-align: center; padding: 24px; }
.pv-generic { display: grid; place-items: center; gap: 16px; height: 100%; text-align: center; }
.pv-generic-ico { width: 72px; height: 72px; display: grid; place-items: center; border-radius: 999px;
  border: 1px solid var(--pv-line); background: var(--pv-fill); color: #e8e7e1; }
@media (max-width: 640px) { .pv-name { max-width: 46vw; } .pv-top { top: 12px; left: 12px; right: 12px; } .pv-pill { width: 38px; height: 38px; } }
@media (prefers-reduced-motion: reduce) { .pv-pill { transition-duration: 0.01ms !important; } }
`;

const KIND_LABEL: Record<PreviewKind, string> = {
  pdf: 'PDF', image: 'Image', video: 'Video', audio: 'Audio', text: 'Text', epub: 'Book',
  spreadsheet: 'Sheet', font: 'Font', archive: 'Archive', model: '3D', markdown: 'Markdown', other: 'File',
};

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
  hasNext = false, hasPrevious = false, currentIndex, totalFiles, shareId,
  onOpenEpubReader, onShareChange, siblingFiles, onNavigateToFile,
}) => {
  const reduce = !!useReducedMotion();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decodedBlob, setDecodedBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const loadGen = useRef(0);
  const closing = useRef(false);
  const kind: PreviewKind = file ? detectKind(file) : 'other';

  // Register the open file as a tab when the modal opens
  useEffect(() => {
    if (isOpen && file) previewTabs.open(file, kind, file.name || 'Preview');
  }, [isOpen, file?.id, kind]);

  // Fullscreen sync
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  const toggleFullscreen = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    if (!document.fullscreenElement) (el as any).requestFullscreen?.()?.catch?.(() => {});
    else (document as any).exitFullscreen?.();
  }, []);

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

  const Pill: React.FC<{ label: string; onClick: () => void; children: React.ReactNode; on?: boolean; danger?: boolean }> =
    ({ label, onClick, children, on, danger }) => (
      <motion.button type="button" className="pv-pill" aria-label={label} title={label} onClick={onClick}
        data-on={on ? 'true' : undefined} data-close={danger ? 'true' : undefined}
        whileHover={reduce ? undefined : { scale: 1.06 }} whileTap={reduce ? undefined : { scale: 0.9 }} transition={SPRING}>
        {children}
      </motion.button>
    );

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) close(); }}>
      <CustomDialogContent ref={contentRef}>
        <style>{PREVIEW_CSS}</style>
        <DialogPrimitive.Title className="sr-only">Preview {file.name}</DialogPrimitive.Title>
        <DialogPrimitive.Description className="sr-only">Full-screen file preview.</DialogPrimitive.Description>
        <motion.div className="pv-stage" initial={reduce ? false : { opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING}>
          {renderBody()}
        </motion.div>

        {/* Floating chrome — circles only, minimal on-screen UI */}
        <div className="pv-chrome">
          <div className="pv-top">
            <div className="pv-id">
              <div className="pv-name">{file.name}</div>
              <div className="pv-meta">{KIND_LABEL[kind]} · {formatFileSize(file.size || 0)}{currentIndex != null && totalFiles ? ` · ${currentIndex + 1}/${totalFiles}` : ''}</div>
            </div>
            <div className="pv-tools">
              {(hasNext || hasPrevious) && (
                <div className="pv-nav">
                  {hasPrevious && <Pill label="Previous" onClick={() => onPrevious?.()}><ChevronLeft size={18} /></Pill>}
                  {hasNext && <Pill label="Next" onClick={() => onNext?.()}><ChevronRight size={18} /></Pill>}
                </div>
              )}
              <Pill label={showInfo ? 'Hide info' : 'Info'} onClick={() => setShowInfo(v => !v)} on={showInfo}><Info size={17} /></Pill>
              <Pill label="Share" onClick={handleShare}><Share2 size={17} /></Pill>
              <Pill label="Download" onClick={handleDownload}><Download size={17} /></Pill>
              <Pill label={isFullscreen ? 'Exit full screen' : 'Full screen'} onClick={toggleFullscreen}><Maximize size={17} /></Pill>
              <Pill label="Minimize" onClick={close}><Minimize size={17} /></Pill>
              <Pill label="Close" onClick={close} danger><X size={19} /></Pill>
            </div>
          </div>

          {/* Open-file strip — floating dots, no box */}
          {siblingFiles && siblingFiles.length > 1 && (
            <div className="pv-foot">
              {siblingFiles.slice(0, 12).map((sf, i) => (
                <motion.button key={sf.id || i} type="button"
                  aria-label={sf.name} title={sf.name}
                  onClick={() => onNavigateToFile?.(sf)}
                  className="pv-pill"
                  data-on={sf.id === file.id ? 'true' : undefined}
                  whileHover={reduce ? undefined : { scale: 1.1 }} whileTap={reduce ? undefined : { scale: 0.9 }}
                  transition={SPRING}>
                  <span style={{ fontSize: 10, fontFamily: 'var(--sa-mono, monospace)' }}>{i + 1}</span>
                </motion.button>
              ))}
            </div>
          )}

          <AnimatePresence>
            {showInfo && (
              <motion.div className="pv-info" initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.96 }} transition={SPRING}>
                <div><b>{file.name}</b></div>
                <div>{KIND_LABEL[kind]} · {formatFileSize(file.size || 0)}</div>
                <div>{file.encrypted ? 'End-to-end encrypted' : 'Unencrypted'}</div>
                {file.created_at && <div>Added {new Date(file.created_at).toLocaleDateString()}</div>}
              </motion.div>
            )}
          </AnimatePresence>
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

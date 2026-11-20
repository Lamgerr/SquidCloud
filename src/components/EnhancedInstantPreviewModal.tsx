import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Button } from '@/components/ui/button';
import {
  AlertCircle, ChevronLeft, ChevronRight, Download, FileText,
  Image as ImageIcon, Lock, Music, Share2, Video, X, Box,
  Maximize, Minimize,
} from '@/lib/icon-map';
import { cn, formatFileSize } from '@/lib/utils';
import { downloadFileWithRes54, downloadFilePreview } from '@/lib/res54';
import { smartDownload } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Loader } from '@/components/ui/Loader';
import CBVideoPlayer from './cbVideoPlayer';
import MobileVideoPlayer from './MobileVideoPlayer';
import EnhancedTextEditor from './EnhancedTextEditor';
import AdvancedImageViewer from '@/components/AdvancedImageViewer';
import SpreadsheetViewer from '@/components/spreadsheet/SpreadsheetViewer';
import { useIsMobile } from '@/hooks/use-mobile';
import OptimizedPDFViewer from '@/components/OptimizedPDFViewer';
import ModelViewer from '@/components/ModelViewer';
import FontPreviewer from '@/components/FontPreviewer';
import ArchiveViewerModal from '@/components/ArchiveViewerModal';
import { createFileShare } from '@/lib/api';

const decryptedBlobCache = new Map<string, { blob: Blob; url: string; timestamp: number }>();
const MAX_CACHE_ITEMS = 15;

/* ── Preview chrome: the floating-dock language, applied to a full-screen
      surface. One near-black tier, circular pill controls, spring physics. ── */
const PREVIEW_CSS = `
.pv-root { --pv-line: rgba(232,231,225,0.10); --pv-fill: rgba(13,14,13,0.86); color: #e8e7e1; }
.pv-head { display: flex; align-items: center; justify-content: space-between; gap: 12px;
  height: 56px; padding: 0 16px; border-bottom: 1px solid var(--pv-line);
  background: linear-gradient(180deg, rgba(13,14,13,0.9), rgba(13,14,13,0.7));
  -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); flex: none; }
.pv-name { font-size: 13px; font-weight: 400; letter-spacing: -0.01em; color: #e8e7e1;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pv-meta { font: 400 10px/1 var(--sa-mono, ui-monospace, monospace); color: rgba(232,231,225,0.45); margin-top: 4px; }
.pv-tools { display: flex; align-items: center; gap: 8px; flex: none; }
.pv-pill { display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  height: 38px; min-width: 38px; padding: 0 14px; border-radius: 999px;
  border: 1px solid var(--pv-line); background: var(--pv-fill);
  -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
  box-shadow: inset 0 1px 0 rgba(232,231,225,0.12), 0 8px 20px -10px rgba(0,0,0,0.6);
  color: #e8e7e1; font-size: 12.5px; cursor: pointer; }
.pv-pill:hover { border-color: rgba(232,231,225,0.2); }
.pv-pill:focus-visible { outline: 2px solid rgba(232,231,225,0.8); outline-offset: 3px; }
.pv-icon { width: 38px; padding: 0; }
.pv-count { font: 400 10px/1 var(--sa-mono, ui-monospace, monospace); color: rgba(232,231,225,0.5); padding: 0 4px; }
.pv-stage { position: relative; flex: 1; min-height: 0; overflow: hidden; background: var(--sa-bg, #0c0d09); }
.pv-float { position: absolute; z-index: 80; display: flex; gap: 8px; }
@media (prefers-reduced-motion: reduce) { .pv-pill { transition-duration: 0.01ms !important; } }
`;

const CustomDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Popup>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Popup>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay className="z-[60] bg-background sm:bg-background/95 sm:backdrop-blur-2xl transition-opacity duration-200 ease-out" />
    <DialogPrimitive.Popup
      ref={ref}
      className={cn(
        'pv-root fixed inset-0 z-[60] flex flex-col w-screen h-screen max-w-none rounded-none border-0 bg-background text-foreground shadow-2xl overflow-hidden',
        'data-[open]:opacity-100 data-[closed]:opacity-0',
        'transition-all duration-200 ease-out will-change-transform',
        className
      )}
    >
      {children}
    </DialogPrimitive.Popup>
  </DialogPortal>
));
CustomDialogContent.displayName = 'CustomDialogContent';

interface CarouselFile { id: string; name: string; type: string; size?: number; }

interface EnhancedInstantPreviewModalProps {
  file: any; isOpen: boolean; onClose: () => void;
  onDownload?: () => void; onShare?: () => void; onNext?: () => void;
  onPrevious?: () => void; hasNext?: boolean; hasPrevious?: boolean;
  currentIndex?: number; totalFiles?: number; shareId?: string;
  onOpenEpubReader?: (file: any) => void;
  onShareChange?: () => void;
}

const getFileTypeLabel = (file: any) => {
  if (!file) return 'File';
  if (file.type?.startsWith('image/')) return 'Image';
  if (file.type?.startsWith('video/')) return 'Video';
  if (file.type?.startsWith('audio/')) return 'Audio';
  if (file.type === 'application/pdf') return 'PDF';
  if (file.type?.includes('spreadsheet') || file.name?.match(/\.(xlsx?|csv|ods)$/i)) return 'Sheet';
  if (file.type?.startsWith('text/') || file.name?.match(/\.(txt|md|json|js|ts|tsx|jsx|html|css|yml|yaml|sqd)$/i)) return 'Text';
  return 'File';
};

const EnhancedInstantPreviewModal: React.FC<EnhancedInstantPreviewModalProps> = ({
  file, isOpen, onClose, onDownload, onShare, onNext, onPrevious,
  hasNext = false, hasPrevious = false, currentIndex, totalFiles, shareId,
  onOpenEpubReader, onShareChange,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decodedBlob, setDecodedBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const { toast } = useToast();
  const isMobile = useIsMobile();
  const reduce = !!useReducedMotion();
  const pillTap = reduce ? undefined : { scale: 0.92 };
  const loadGenRef = useRef(0);
  const isClosingRef = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Keep the toggle icon in sync with real fullscreen state (incl. ESC / OS exit).
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      const req: any = (el as any).requestFullscreen?.();
      if (req && typeof req.catch === 'function') req.catch(() => {});
    } else {
      (document as any).exitFullscreen?.();
    }
  }, []);


  const is3DModel = file?.name?.match(/\.(glb|gltf|stl|obj)$/i);
  const isArchive = file?.name?.match(/\.(zip|rar|7z|tar\.gz|tgz)$/i);
  const isFont = file?.name?.match(/\.(ttf|otf|woff|woff2)$/i);
  const isStreamingVideo = file?.type?.startsWith('video/') && file?.encrypted && file?.storage_path === 'res54_distributed';
  const canProgressiveLoad = !isArchive && !isStreamingVideo && (
    file?.type?.startsWith('text/') || file?.type === 'application/json' ||
    file?.name?.match(/\.(txt|md|json|js|ts|tsx|jsx|py|html|css|scss|yml|yaml|xml|sql|log|sqd)$/i)
  );

  // 🚀 FOOLPROOF CLOSE HANDLER: Instantly closes UI & safely unpops history
  const handleClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

     // Immediately trigger React state close
     onClose();
     // Exit OS fullscreen if it was engaged
     if (document.fullscreenElement) (document as any).exitFullscreen?.();

    // Clean up mobile history state silently without double-firing popstate
    if (window.history.state?.previewModal) {
      window.history.back();
    }
  }, [onClose]);

  // Handle hardware navigation & ESC key
  useEffect(() => {
    if (!isOpen) {
      isClosingRef.current = false;
      return;
    }

    // Push virtual history entry
    window.history.pushState({ previewModal: true }, '');

    const handlePopState = () => {
      // If user presses physical phone back button or swipes back
      if (!isClosingRef.current) {
        isClosingRef.current = true;
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, handleClose]);

  useEffect(() => {
    if (!isOpen || !file?.id) return;
    const gen = ++loadGenRef.current;

    if (isArchive) { setLoading(false); return; }
    if (isStreamingVideo) {
      setBlobUrl('virtual-hls-stream');
      setDecodedBlob(new Blob(['streaming'], { type: file.type }));
      setLoading(false);
      return;
    }

    const cached = decryptedBlobCache.get(file.id);
    if (cached) {
      setDecodedBlob(cached.blob);
      setBlobUrl(cached.url);
      setLoading(false);
      setError(null);
      return;
    }

    if (canProgressiveLoad) {
      const loadProgressive = async () => {
        setLoading(true); setError(null);
        try {
          const preview = await downloadFilePreview(file.id, 3, { shareId });
          if (loadGenRef.current !== gen) return;
          const partialUrl = URL.createObjectURL(preview.blob);
          setDecodedBlob(preview.blob); setBlobUrl(partialUrl);
          setLoading(false);

          if (preview.isPartial) {
            smartDownload(file.id, { reason: 'preview', fileName: file.name, shareId }).then((fullBlob) => {
              if (loadGenRef.current !== gen) return;
              const fullUrl = URL.createObjectURL(fullBlob);
              
              if (decryptedBlobCache.size >= MAX_CACHE_ITEMS) {
                const oldestKey = decryptedBlobCache.keys().next().value;
                if (oldestKey) {
                  URL.revokeObjectURL(decryptedBlobCache.get(oldestKey)!.url);
                  decryptedBlobCache.delete(oldestKey);
                }
              }
              decryptedBlobCache.set(file.id, { blob: fullBlob, url: fullUrl, timestamp: Date.now() });

              setDecodedBlob(fullBlob); setBlobUrl(fullUrl);
            }).catch(() => {});
          }
        } catch (err: any) {
          if (loadGenRef.current === gen) {
            setError(err?.message || 'Unable to load preview');
            setLoading(false);
          }
        }
      };
      loadProgressive();
      return;
    }

    const load = async () => {
      setLoading(true); setError(null);
      try {
        const blob = await smartDownload(file.id, { reason: 'preview', fileName: file.name, shareId });
        if (loadGenRef.current !== gen) return;
        const nextUrl = URL.createObjectURL(blob);
        
        if (decryptedBlobCache.size >= MAX_CACHE_ITEMS) {
          const oldestKey = decryptedBlobCache.keys().next().value;
          if (oldestKey) {
            URL.revokeObjectURL(decryptedBlobCache.get(oldestKey)!.url);
            decryptedBlobCache.delete(oldestKey);
          }
        }
        decryptedBlobCache.set(file.id, { blob, url: nextUrl, timestamp: Date.now() });

        setDecodedBlob(blob); setBlobUrl(nextUrl);
      } catch (err: any) {
        if (loadGenRef.current === gen) setError(err?.message || 'Unable to load preview');
      } finally {
        if (loadGenRef.current === gen) setLoading(false);
      }
    };
    load();
  }, [isOpen, file?.id]);

  // Auto-handoff: if file is EPUB, close this modal and open DeepReadReader
  const isEpub = file?.name?.toLowerCase().endsWith('.epub') || file?.type === 'application/epub+zip';
  useEffect(() => {
    if (isOpen && isEpub && onOpenEpubReader) {
      onOpenEpubReader(file);
      onClose();
    }
  }, [isOpen, isEpub, file, onOpenEpubReader, onClose]);

  const handleDownload = useCallback(async () => {
    if (onDownload) { onDownload(); return; }
    if (!decodedBlob && file?.id) {
      try {
        const blob = await smartDownload(file.id, { reason: 'download', fileName: file.name, shareId });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = file.name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      } catch (err: any) {
        toast({ title: 'Download failed', description: err?.message, variant: 'destructive' });
      }
      return;
    }
    if (!decodedBlob || !file?.name) return;
    const downloadUrl = URL.createObjectURL(decodedBlob);
    const a = document.createElement('a'); a.href = downloadUrl; a.download = file.name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }, [decodedBlob, file?.name, file?.id, onDownload, toast]);

  const handleShare = useCallback(async () => {
    if (onShare) { await onShare(); onShareChange?.(); return; }
    try {
      const { shareUrl } = await createFileShare(file.id);
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: 'Share Link Copied' });
      onShareChange?.();
    } catch (error: any) {
      toast({ title: 'Share failed', description: error.message, variant: "destructive" });
    }
  }, [file?.id, onShare, onShareChange, toast]);

  if (!file) return null;

  const isImage = file.type?.startsWith('image/');
  const isVideo = file.type?.startsWith('video/');
  const isPDF = file.type === 'application/pdf';
  const isSpreadsheet = file.type?.includes('spreadsheet') || file.type === 'text/csv' || file.name?.match(/\.(xlsx?|csv|ods)$/i);
  const isText = file.type?.startsWith('text/') || file.type === 'application/json' || file.name?.match(/\.(txt|md|json|js|ts|tsx|jsx|py|html|css|scss|yml|yaml|xml|sql|log|sqd)$/i);

  const renderPreview = () => {
    if (isArchive) {
      return (
        <div className="flex h-full items-center justify-center bg-muted">
          <div className="text-center space-y-4 max-w-sm p-8 rounded-2xl bg-card border border-border">
            <Box className="h-12 w-12 mx-auto text-foreground/60" />
            <h3 className="text-base font-semibold text-foreground">{file.name}</h3>
            <Button onClick={() => setArchiveOpen(true)} className="w-full">Browse Archive</Button>
            <ArchiveViewerModal open={archiveOpen} onClose={() => setArchiveOpen(false)} file={{ id: file.id, name: file.name, url: blobUrl || undefined }} onDownload={handleDownload} />
          </div>
        </div>
      );
    }
    if (isEpub) return (
      <div className="grid h-full w-full place-items-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader size="lg" />
          <p className="text-xs font-mono text-muted-foreground animate-pulse">Opening reader…</p>
        </div>
      </div>
    );
    if (isStreamingVideo) return <div className="h-full w-full bg-black"><CBVideoPlayer file={file} shareId={shareId} autoPlay className="h-full w-full" /></div>;
    if (loading) return <div className="grid h-full w-full place-items-center bg-background"><div className="flex flex-col items-center gap-3"><Loader size="lg" /><p className="text-xs font-mono text-muted-foreground animate-pulse">Decrypting file stream...</p></div></div>;
    if (error) return <div className="flex h-full items-center justify-center px-6 bg-background"><div className="p-6 rounded-2xl bg-card border border-border text-center max-w-sm space-y-2"><p className="text-sm font-semibold text-destructive">Failed to render preview</p><p className="text-xs text-muted-foreground">{error}</p></div></div>;
    if (!decodedBlob || !blobUrl) return <div className="flex h-full items-center justify-center text-muted-foreground bg-background"><FileText className="h-6 w-6" /></div>;

    if (is3DModel) return <ModelViewer src={blobUrl} fileName={file.name} fileType={file.type} />;
    if (isFont) return <FontPreviewer src={blobUrl} fileName={file.name} />;
    if (isPDF) return <div className="h-full w-full bg-background overflow-hidden"><OptimizedPDFViewer file={file} blobUrl={blobUrl} pdfBlob={decodedBlob} onClose={handleClose} onDownload={handleDownload} /></div>;
    if (isImage) return <AdvancedImageViewer src={blobUrl} alt={file.name} file={{ name: file.name, size: file.size, type: file.type }} onDownload={handleDownload} onShare={handleShare} />;
    if (isVideo) return isMobile ? <div className="h-full w-full bg-black"><MobileVideoPlayer file={file} blobUrl={blobUrl} onClose={handleClose} /></div> : <div className="h-full w-full bg-black flex items-center justify-center"><video src={blobUrl} controls className="max-h-full max-w-full" /></div>;
    if (isSpreadsheet) return <SpreadsheetViewer src={blobUrl} fileName={file.name} onClose={handleClose} onDownload={handleDownload} />;
    if (isText) return <div className="relative h-full w-full overflow-hidden bg-muted"><EnhancedTextEditor file={file} decodedBlob={decodedBlob} onSave={async () => {}} onDownload={handleDownload} onShare={handleShare} readonly={false} /></div>;

    return <div className="flex h-full items-center justify-center bg-background"><p className="text-sm text-muted-foreground">Preview not supported</p></div>;
  };

  const Pill: React.FC<{ label: string; onClick: () => void; children: React.ReactNode; wide?: boolean }> =
    ({ label, onClick, children, wide }) => (
      <motion.button type="button" onClick={onClick} aria-label={label} title={label}
        className={cn('pv-pill', !wide && 'pv-icon')} whileTap={pillTap}>
        {children}
      </motion.button>
    );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <CustomDialogContent ref={contentRef}>
        <style>{PREVIEW_CSS}</style>
        <DialogPrimitive.Title className="sr-only">Preview {file?.name || 'file'}</DialogPrimitive.Title>
        <DialogPrimitive.Description className="sr-only">Full-screen document preview.</DialogPrimitive.Description>

        <header className="pv-head">
          <div className="min-w-0">
            <motion.h2 key={file.name} className="pv-name"
              initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}>
              {file.name}
            </motion.h2>
            <div className="pv-meta">{getFileTypeLabel(file)} · {formatFileSize(file.size || 0)}{currentIndex != null && totalFiles ? ` · ${currentIndex + 1}/${totalFiles}` : ''}</div>
          </div>

          <div className="pv-tools">
            {totalFiles && totalFiles > 1 && (
              <span className="pv-count">{hasPrevious ? 'prev' : ''}{hasPrevious && hasNext ? ' · ' : ''}{hasNext ? 'next' : ''}</span>
            )}
            {hasPrevious && <Pill label="Previous" onClick={onPrevious!}><ChevronLeft className="h-[18px] w-[18px]" /></Pill>}
            {hasNext && <Pill label="Next" onClick={onNext!}><ChevronRight className="h-[18px] w-[18px]" /></Pill>}
            <Pill label={isFullscreen ? 'Exit full screen' : 'Full screen'} onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Pill>
            <Pill label="Share" onClick={handleShare}><Share2 className="h-4 w-4" /></Pill>
            {!isArchive && <Pill label="Download" onClick={handleDownload}><Download className="h-4 w-4" /></Pill>}
            <Pill label="Close" onClick={handleClose}><X className="h-[18px] w-[18px]" /></Pill>
          </div>
        </header>

        <motion.div className="pv-stage" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>
          {renderPreview()}
        </motion.div>
      </CustomDialogContent>
    </Dialog>
  );
};

export default EnhancedInstantPreviewModal;

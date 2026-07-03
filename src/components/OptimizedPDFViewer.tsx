import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, LayoutGrid, 
  Loader2, FileText, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(
      new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url),
      { type: 'module' }
    );
  } catch (e) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  }
}

interface OptimizedPDFViewerProps {
  file: { id?: string; name: string; size?: number };
  blobUrl?: string | null;
  pdfBlob?: Blob | null;
  onClose?: () => void;
  onDownload?: () => void;
}

export default function OptimizedPDFViewer({
  file, blobUrl, pdfBlob, onDownload
}: OptimizedPDFViewerProps) {
  const isMobile = useIsMobile();
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(isMobile ? 1.0 : 1.3);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  // 🚀 TOUCH GESTURE ZOOM & PAN FOR MOBILE
  const [touchZoom, setTouchZoom] = useState(1);
  const [touchPan, setTouchPan] = useState({ x: 0, y: 0 });
  const [isPinching, setIsPinching] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [lastTouchDistance, setLastTouchDistance] = useState(0);
  const [lastTouchCenter, setLastTouchCenter] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const lastTap = useRef<number>(0);

  const renderContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const loadDocument = async () => {
      setLoading(true);
      setError(null);
      try {
        let loadingTask: pdfjsLib.PDFDocumentLoadingTask;
        if (pdfBlob) {
          const arrayBuffer = await pdfBlob.arrayBuffer();
          loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        } else if (blobUrl && blobUrl.startsWith('blob:')) {
          const res = await fetch(blobUrl);
          const arrayBuffer = await res.arrayBuffer();
          loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        } else if (blobUrl) {
          loadingTask = pdfjsLib.getDocument({ url: blobUrl });
        } else {
          throw new Error('No PDF payload available');
        }

        const doc = await loadingTask.promise;
        if (active) {
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          setLoading(false);
        }
      } catch (err: any) {
        if (active) {
          setError(err?.message || 'Failed to initialize PDF document.');
          setLoading(false);
        }
      }
    };
    loadDocument();
    return () => { active = false; };
  }, [blobUrl, pdfBlob]);

  const renderActivePage = useCallback(async () => {
    if (!pdfDoc || !renderContainerRef.current) return;
    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: scale * (window.devicePixelRatio || 1), rotation });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.style.width = `${viewport.width / (window.devicePixelRatio || 1)}px`;
      canvas.style.height = `${viewport.height / (window.devicePixelRatio || 1)}px`;
      canvas.className = 'shadow-2xl rounded-sm bg-white mx-auto';

      renderContainerRef.current.innerHTML = '';
      renderContainerRef.current.appendChild(canvas);
      await page.render({ canvasContext: context, viewport }).promise;
    } catch (e) {
      console.error('Page composition failed:', e);
    }
  }, [pdfDoc, currentPage, scale, rotation]);

  useEffect(() => {
    renderActivePage();
    setTouchZoom(1);
    setTouchPan({ x: 0, y: 0 });
  }, [renderActivePage]);

  const adjustZoom = (delta: number) => setScale(prev => Math.min(Math.max(0.5, prev + delta), 3.0));
  const changePage = (num: number) => {
    const target = Math.min(Math.max(1, num), totalPages);
    setCurrentPage(target);
    setPageInput(String(target));
  };

  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touches: React.TouchList) => {
    if (touches.length < 2) return { x: 0, y: 0 };
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  };

  // 🚀 NATIVE MOBILE TOUCH PINCH TO ZOOM & PAN
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touches = e.touches;
    if (touches.length === 2) {
      setIsPinching(true);
      setIsDragging(false);
      setLastTouchDistance(getTouchDistance(touches));
      setLastTouchCenter(getTouchCenter(touches));
    } else if (touches.length === 1 && touchZoom > 1) {
      setIsDragging(true);
      setDragStart({ x: touches[0].clientX - touchPan.x, y: touches[0].clientY - touchPan.y });
    }
  }, [touchZoom, touchPan]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touches = e.touches;
    if (isPinching && touches.length === 2) {
      const newDistance = getTouchDistance(touches);
      const delta = newDistance / (lastTouchDistance || 1);
      const newCenter = getTouchCenter(touches);
      setTouchZoom(prev => Math.min(Math.max(prev * delta, 1), 5));
      setTouchPan(prev => ({
        x: prev.x + (newCenter.x - lastTouchCenter.x),
        y: prev.y + (newCenter.y - lastTouchCenter.y)
      }));
      setLastTouchDistance(newDistance);
      setLastTouchCenter(newCenter);
    } else if (isDragging && touches.length === 1 && touchZoom > 1) {
      setTouchPan({ x: touches[0].clientX - dragStart.x, y: touches[0].clientY - dragStart.y });
    }
  }, [isPinching, isDragging, lastTouchDistance, lastTouchCenter, dragStart, touchZoom]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (isPinching) {
      setIsPinching(false);
      if (touchZoom < 1.05) {
        setTouchZoom(1);
        setTouchPan({ x: 0, y: 0 });
      }
      return;
    }

    const now = Date.now();
    if (now - lastTap.current < 280 && e.changedTouches.length === 1) {
      if (touchZoom > 1) {
        setTouchZoom(1);
        setTouchPan({ x: 0, y: 0 });
      } else {
        setTouchZoom(2.2);
      }
    }
    lastTap.current = now;
    setIsDragging(false);
  }, [isPinching, touchZoom]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background p-6 text-center">
        <div className="p-6 rounded-2xl bg-card border border-border max-w-sm space-y-3">
          <p className="text-sm font-medium text-foreground">Unable to render PDF</p>
          <p className="text-xs text-muted-foreground">{error}</p>
          {onDownload && <Button onClick={onDownload} size="sm" className="w-full mt-2">Download Directly</Button>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full bg-background text-foreground select-none overflow-hidden font-sans">
      <header className="flex items-center justify-between px-3 sm:px-4 h-12 sm:h-14 bg-card border-b border-border/80 shrink-0 gap-2 z-30">
        <div className="flex items-center gap-2 min-w-0">
          {!isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <LayoutGrid className="w-4 h-4" />
            </Button>
          )}
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-foreground shrink-0" />
            <span className="text-xs sm:text-sm font-medium truncate max-w-[120px] sm:max-w-xs">{file.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-muted border border-border rounded-lg p-0.5 sm:p-1">
          <Button variant="ghost" size="icon" disabled={currentPage <= 1} onClick={() => changePage(currentPage - 1)} className="h-6 w-6 sm:h-7 sm:w-7 text-muted-foreground">
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <Input
            value={pageInput}
            onChange={e => setPageInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') changePage(parseInt(pageInput, 10) || 1); }}
            className="w-8 sm:w-12 h-6 px-1 text-center font-mono text-xs bg-background/40 border-border/60 rounded"
          />
          <span className="text-xs font-mono text-muted-foreground px-1">/ {totalPages || '-'}</span>
          <Button variant="ghost" size="icon" disabled={currentPage >= totalPages} onClick={() => changePage(currentPage + 1)} className="h-6 w-6 sm:h-7 sm:w-7 text-muted-foreground">
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1">
          <Button variant="ghost" size="icon" onClick={() => adjustZoom(-0.2)} className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground">
            <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>
          <span className="text-[11px] sm:text-xs font-mono text-muted-foreground w-9 sm:w-12 text-center hidden xs:inline-block">
            {Math.round(scale * touchZoom * 100)}%
          </span>
          <Button variant="ghost" size="icon" onClick={() => adjustZoom(0.2)} className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground">
            <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>
          {!isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setRotation(r => (r + 90) % 360)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <RotateCw className="w-4 h-4" />
            </Button>
          )}
          {onDownload && (
            <Button variant="ghost" size="icon" onClick={onDownload} className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground">
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-1 relative overflow-hidden">
        {!isMobile && (
          <aside className={cn(
            "w-52 bg-card/95 border-r border-border/80 overflow-y-auto shrink-0 p-3 space-y-3",
            sidebarOpen ? "block" : "hidden"
          )}>
            <div className="grid grid-cols-1 gap-2.5">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                <button
                  key={num}
                  onClick={() => changePage(num)}
                  className={cn(
                    "flex flex-col items-center p-2 rounded-lg border text-xs transition-colors",
                    currentPage === num ? "bg-primary/10 border-primary/50 text-primary font-medium" : "bg-background/40 border-border/60 text-muted-foreground hover:border-border"
                  )}
                >
                  <div className="w-full aspect-[1/1.4] bg-border/60 rounded mb-1 flex items-center justify-center font-mono text-[10px]">{num}</div>
                  Page {num}
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* TOUCH GESTURE VIEWPORT */}
        <main 
          className={cn(
            "flex-1 bg-background overflow-hidden flex items-center justify-center p-2 sm:p-6 relative",
            touchZoom > 1 ? "cursor-grab" : "cursor-default",
            isDragging && "cursor-grabbing"
          )}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-foreground" />
              <span className="text-xs sm:text-sm font-mono">Rendering page...</span>
            </div>
          ) : (
            <div 
              ref={renderContainerRef} 
              className={cn(
                "max-w-full max-h-full flex items-center justify-center will-change-transform",
                !isPinching && !isDragging ? "transition-transform duration-200 ease-out" : ""
              )}
              style={{
                transform: `translate3d(${touchPan.x}px, ${touchPan.y}px, 0px) scale3d(${touchZoom}, ${touchZoom}, 1)`
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

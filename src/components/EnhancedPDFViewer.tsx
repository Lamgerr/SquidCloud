import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Minimize2, 
  Download, Share2, Search, RotateCw, LayoutGrid, X, Loader2, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

// Configure Web Worker safely for Vite/Webpack build targets
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface OptimizedPDFViewerProps {
  file: { id?: string; name: string; size?: number };
  blobUrl?: string | null;
  pdfBlob?: Blob | null;
  onClose?: () => void;
  onDownload?: () => void;
}

export default function OptimizedPDFViewer({
  file, blobUrl, pdfBlob, onClose, onDownload
}: OptimizedPDFViewerProps) {
  const isMobile = useIsMobile();
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const renderContainerRef = useRef<HTMLDivElement>(null);

  // 1. Load document stream immediately into memory buffer
  useEffect(() => {
    let active = true;
    const loadDocument = async () => {
      setLoading(true);
      try {
        let sourceUrl = blobUrl;
        if (!sourceUrl && pdfBlob) {
          sourceUrl = URL.createObjectURL(pdfBlob);
        }
        if (!sourceUrl) throw new Error('No PDF data payload available');

        const loadingTask = pdfjsLib.getDocument({ url: sourceUrl });
        const doc = await loadingTask.promise;
        if (active) {
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          setLoading(false);
        }
      } catch (err) {
        console.error('Core PDF engine initialization failed:', err);
        if (active) setLoading(false);
      }
    };
    loadDocument();
    return () => { active = false; };
  }, [blobUrl, pdfBlob]);

  // 2. Hardware-Accelerated Virtual Canvas Page Renderer
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
      canvas.className = 'shadow-xl rounded-sm transition-opacity duration-150 ease-out bg-white mx-auto';

      renderContainerRef.current.innerHTML = '';
      renderContainerRef.current.appendChild(canvas);

      await page.render({ canvasContext: context, viewport }).promise;
    } catch (e) {
      console.error('Page canvas composition failed:', e);
    }
  }, [pdfDoc, currentPage, scale, rotation]);

  useEffect(() => {
    renderActivePage();
  }, [renderActivePage]);

  // Zoom & Navigation Actions
  const adjustZoom = (delta: number) => setScale(prev => Math.min(Math.max(0.6, prev + delta), 3.0));
  const changePage = (step: number) => setCurrentPage(prev => Math.min(Math.max(1, prev + step), totalPages));

  return (
    <div 
      ref={containerRef} 
      className={cn(
        "flex flex-col w-full h-full bg-neutral-950 text-neutral-100 select-none overflow-hidden font-sans",
        isFullscreen && "fixed inset-0 z-50"
      )}
    >
      {/* Top Application Bar */}
      <header className="flex items-center justify-between px-4 h-14 bg-neutral-900 border-b border-neutral-800/80 shrink-0 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="h-8 w-8 text-neutral-400 hover:text-white">
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="text-sm font-medium truncate">{file.name}</span>
          </div>
        </div>

        {/* Central Controls (Desktop) */}
        {!isMobile && (
          <div className="flex items-center gap-1 bg-neutral-950/80 border border-neutral-800 rounded-lg p-1">
            <Button variant="ghost" size="icon" disabled={currentPage <= 1} onClick={() => changePage(-1)} className="h-7 w-7 text-neutral-300">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs font-mono px-2 text-neutral-300">
              {currentPage} / {totalPages || '-'}
            </span>
            <Button variant="ghost" size="icon" disabled={currentPage >= totalPages} onClick={() => changePage(1)} className="h-7 w-7 text-neutral-300">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Utility Actions */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => adjustZoom(-0.2)} className="h-8 w-8 text-neutral-400 hover:text-white">
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs font-mono text-neutral-400 w-12 text-center hidden sm:inline-block">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="ghost" size="icon" onClick={() => adjustZoom(0.2)} className="h-8 w-8 text-neutral-400 hover:text-white">
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setRotation(r => (r + 90) % 360)} className="h-8 w-8 text-neutral-400 hover:text-white hidden sm:flex">
            <RotateCw className="w-4 h-4" />
          </Button>
          <div className="h-4 w-px bg-neutral-800 mx-1 hidden sm:block" />
          {onDownload && (
            <Button variant="ghost" size="icon" onClick={onDownload} className="h-8 w-8 text-neutral-400 hover:text-white">
              <Download className="w-4 h-4" />
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-neutral-400 hover:text-white">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* Thumbnail Sidebar Drawer */}
        <aside className={cn(
          "w-56 bg-neutral-900/90 border-r border-neutral-800/80 overflow-y-auto transition-all duration-200 shrink-0 p-3 space-y-3",
          sidebarOpen ? "block" : "hidden"
        )}>
          <p className="text-[11px] font-semibold tracking-wider text-neutral-400 uppercase px-1">Pages</p>
          <div className="grid grid-cols-1 gap-3">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
              <button
                key={num}
                onClick={() => setCurrentPage(num)}
                className={cn(
                  "flex flex-col items-center p-2 rounded-lg border text-xs transition-colors",
                  currentPage === num 
                    ? "bg-blue-500/10 border-blue-500/50 text-blue-400 font-medium" 
                    : "bg-neutral-950/40 border-neutral-800/60 text-neutral-400 hover:border-neutral-700"
                )}
              >
                <div className="w-full aspect-[1/1.4] bg-neutral-800/60 rounded mb-1.5 flex items-center justify-center font-mono">
                  {num}
                </div>
                Page {num}
              </button>
            ))}
          </div>
        </aside>

        {/* Core Canvas Viewport */}
        <main className="flex-1 bg-neutral-950 overflow-auto flex items-center justify-center p-4 sm:p-8">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-neutral-400">
              <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
              <span className="text-sm">Rendering PDF stream...</span>
            </div>
          ) : (
            <div ref={renderContainerRef} className="max-w-full max-h-full flex items-center justify-center" />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      {isMobile && (
        <footer className="flex items-center justify-between px-6 h-14 bg-neutral-900 border-t border-neutral-800/80 shrink-0">
          <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => changePage(-1)} className="h-8 bg-neutral-950 border-neutral-800 text-xs">
            Previous
          </Button>
          <span className="text-xs font-mono text-neutral-300">
            {currentPage} of {totalPages || '-'}
          </span>
          <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => changePage(1)} className="h-8 bg-neutral-950 border-neutral-800 text-xs">
            Next
          </Button>
        </footer>
      )}
    </div>
  );
}

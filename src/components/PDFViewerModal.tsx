import React, { useState, useEffect, useRef } from 'react';
import pdfjsLib from '@/lib/pdfjs-config';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  Search,
  X,
  RotateCw,
  Maximize2,
  Minimize2
} from '@/lib/icon-map';

interface PDFViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
  onDownload?: () => void;
}

const PDFViewerModal: React.FC<PDFViewerModalProps> = ({
  isOpen,
  onClose,
  fileUrl,
  fileName,
  onDownload
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen || !fileUrl) return;

    const loadPDF = async () => {
      try {
        setLoading(true);

        const loadingTask = pdfjsLib.getDocument({
          url: fileUrl,
          cMapUrl: '/pdfjs/cmaps/',
          cMapPacked: true,
        });

        const pdfDoc = await loadingTask.promise;
        setPdf(pdfDoc);
        setTotalPages(pdfDoc.numPages);
      } catch (err) {
        console.error('Error loading PDF:', err);
        toast({
          title: "PDF Loading Error",
          description: "Failed to load PDF. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadPDF();
  }, [isOpen, fileUrl, toast]);

  useEffect(() => {
    if (!isOpen && fileUrl) {
      import('@/services/pdfSecurity').then(({ PDFSecurityService }) => {
        PDFSecurityService.cleanupPDFUrl(fileUrl);
      });
    }
  }, [isOpen, fileUrl]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;

    const renderPage = async () => {
      try {
        const page = await pdf.getPage(currentPage);
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d')!;

        const viewport = page.getViewport({ scale, rotation });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          canvas: canvas
        };

        await page.render(renderContext).promise;
      } catch (error) {
        console.error('Error rendering page:', error);
        toast({
          title: "Rendering Error",
          description: `Failed to render page ${currentPage}`,
          variant: "destructive",
        });
      }
    };

    renderPage();
  }, [pdf, currentPage, scale, rotation, toast]);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleZoomIn = () => {
    setScale(prevScale => Math.min(prevScale * 1.2, 3.0));
  };

  const handleZoomOut = () => {
    setScale(prevScale => Math.max(prevScale / 1.2, 0.5));
  };

  const handleRotate = () => {
    setRotation(prevRotation => (prevRotation + 90) % 360);
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined' && window.print) {
      window.print();
    } else {
      toast({
        title: "Print Unavailable",
        description: "Printing is not available in this environment",
        variant: "destructive",
      });
    }
  };

  const handleSearch = () => {
    if (!searchTerm.trim()) return;

    toast({
      title: "Search",
      description: `Searching for "${searchTerm}" - Feature coming soon`,
    });
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleDownloadClick = () => {
    if (onDownload) {
      onDownload();
    } else {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          'flex flex-col p-0 gap-0 bg-card/95 backdrop-blur-2xl border border-border/50',
          isFullscreen ? 'max-w-[100vw] max-h-[100vh] w-full h-full' : 'max-w-6xl max-h-[90vh]'
        )}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Glass toolbar */}
        <div className="liquid-glass-nav flex items-center justify-between px-4 py-3 rounded-t-xl border-b border-border/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-2 h-2 rounded-full bg-primary/60" />
            <span className="text-sm font-medium text-foreground truncate max-w-md">{fileName}</span>
            {totalPages > 0 && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">({totalPages} pages)</span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Navigation */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePreviousPage}
              disabled={currentPage <= 1 || loading}
              className="liquid-glass-button w-8 h-8"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>

            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={currentPage}
                onChange={(e) => {
                  const page = parseInt(e.target.value);
                  if (page >= 1 && page <= totalPages) {
                    setCurrentPage(page);
                  }
                }}
                className="w-14 h-7 text-xs text-center border-border/50 bg-card/60"
                min={1}
                max={totalPages}
              />
              <span className="text-xs text-muted-foreground">/ {totalPages}</span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextPage}
              disabled={currentPage >= totalPages || loading}
              className="liquid-glass-button w-8 h-8"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>

            <div className="w-px h-5 bg-border/40 mx-1" />

            {/* Zoom */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              disabled={loading}
              className="liquid-glass-button w-8 h-8"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs font-mono text-foreground min-w-[40px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              disabled={loading}
              className="liquid-glass-button w-8 h-8"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>

            <div className="w-px h-5 bg-border/40 mx-1" />

            {/* Rotate */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRotate}
              disabled={loading}
              className="liquid-glass-button w-8 h-8"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </Button>

            <div className="w-px h-5 bg-border/40 mx-1" />

            {/* Search */}
            <div className="flex items-center gap-1">
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-28 h-7 text-xs border-border/50 bg-card/60"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSearch}
                disabled={!searchTerm.trim() || loading}
                className="liquid-glass-button w-7 h-7"
              >
                <Search className="h-3 w-3" />
              </Button>
            </div>

            <div className="w-px h-5 bg-border/40 mx-1" />

            {/* Actions */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownloadClick}
              disabled={loading}
              className="liquid-glass-button w-8 h-8"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrint}
              disabled={loading}
              className="liquid-glass-button w-8 h-8"
            >
              <Printer className="h-3.5 w-3.5" />
            </Button>

            <div className="w-px h-5 bg-border/40 mx-1" />

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="liquid-glass-button w-8 h-8"
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="liquid-glass-button w-8 h-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* PDF Canvas Container */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-muted/30 p-6 min-h-[500px] flex items-center justify-center"
        >
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 border-2 border-white/20 rounded-full" />
                <div className="absolute inset-0 border-2 border-transparent border-t-white rounded-full animate-spin" />
              </div>
              <p className="text-sm text-muted-foreground">Loading PDF...</p>
            </div>
          ) : pdf ? (
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-full shadow-2xl rounded-sm bg-white"
              style={{
                imageRendering: 'crisp-edges',
                filter: 'none'
              }}
            />
          ) : (
            <div className="text-center">
              <p className="text-muted-foreground">Failed to load PDF</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PDFViewerModal;

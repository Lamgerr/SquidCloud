import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import {
  ZoomIn,
  ZoomOut,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCw
} from '@/lib/icon-map';
import pdfjsLib from '@/lib/pdfjs-config';
import { cn } from '@/lib/utils';

interface PDFViewerProps {
  file: {
    id: string;
    name: string;
    type: string;
    size: number;
  };
  src: string;
  open: boolean;
  onClose: () => void;
  onDownload?: () => void;
}

const PDFViewer: React.FC<PDFViewerProps> = ({
  file,
  src,
  open,
  onClose,
  onDownload
}) => {
  if (!file?.name) {
    console.warn('PDFViewer: Missing required file prop or file.name');
    return null;
  }
  return (
    <PDFViewerInner
      file={file}
      src={src}
      open={open}
      onClose={onClose}
      onDownload={onDownload}
    />
  );
};

const PDFViewerInner: React.FC<PDFViewerProps> = ({
  file,
  src,
  open,
  onClose,
  onDownload
}) => {
  const [scale, setScale] = useState(1);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [rotation, setRotation] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && src) {
      loadPDF();
    }
  }, [open, src]);

  useEffect(() => {
    if (pdfDoc && pageNum) {
      renderPage();
    }
  }, [pdfDoc, pageNum, scale, rotation]);

  const loadPDF = async () => {
    try {
      setLoading(true);
      const loadingTask = pdfjsLib.getDocument({ url: src });
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      setPageNum(1);
    } catch (error) {
      console.error('Error loading PDF:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderPage = async () => {
    if (!pdfDoc || !canvasRef.current) return;

    try {
      const page = await pdfDoc.getPage(pageNum);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      const viewport = page.getViewport({ scale, rotation });
      canvas.height = viewport.height;
      canvas.width = viewport.width;

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
    }
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev * 1.2, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev / 1.2, 0.5));
  };

  const handlePrevPage = () => {
    if (pageNum > 1) {
      setPageNum(pageNum - 1);
    }
  };

  const handleNextPage = () => {
    if (pageNum < numPages) {
      setPageNum(pageNum + 1);
    }
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-5xl h-[92vh] flex flex-col p-0 gap-0 bg-card/95 backdrop-blur-2xl border border-border/50"
        aria-describedby="pdf-viewer-description"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="hidden">
          <p id="pdf-viewer-description">View and interact with your PDF document</p>
        </div>

        {/* Glass toolbar */}
        <div className="liquid-glass-nav flex items-center justify-between px-4 py-3 rounded-t-xl border-b border-border/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-2 h-2 rounded-full bg-primary/60" />
            <span className="text-sm font-medium text-foreground truncate max-w-md">{file.name}</span>
            {numPages > 0 && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">({numPages} pages)</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              disabled={scale <= 0.5 || loading}
              className="liquid-glass-button w-8 h-8"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs font-mono text-foreground min-w-[44px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              disabled={scale >= 3 || loading}
              className="liquid-glass-button w-8 h-8"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <div className="w-px h-5 bg-border/40 mx-1" />
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
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevPage}
              disabled={pageNum <= 1 || loading}
              className="liquid-glass-button w-8 h-8"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs font-mono text-foreground min-w-[44px] text-center">
              {pageNum}{numPages > 0 && <span className="text-muted-foreground">/{numPages}</span>}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextPage}
              disabled={pageNum >= numPages || loading}
              className="liquid-glass-button w-8 h-8"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            {onDownload && (
              <>
                <div className="w-px h-5 bg-border/40 mx-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDownload}
                  className="liquid-glass-button w-8 h-8"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            <div className="w-px h-5 bg-border/40 mx-1" />
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

        {/* Canvas area */}
        <div className="flex-1 overflow-auto bg-muted/30 relative flex items-center justify-center p-6">
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 border-2 border-white/20 rounded-full" />
                <div className="absolute inset-0 border-2 border-transparent border-t-white rounded-full animate-spin" />
              </div>
              <p className="text-sm text-muted-foreground">Loading PDF...</p>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className="shadow-2xl rounded-sm bg-white"
              style={{ maxWidth: '100%', height: 'auto' }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PDFViewer;

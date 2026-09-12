import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { X, Maximize2, Minimize2, Download, Share2 } from '@/lib/icon-map';
import { smartDownload } from '@/lib/api';
import { formatFileSize, cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Loader } from '@/components/ui/Loader';
import CBVideoPlayer from './cbVideoPlayer';
import AdvancedImageViewer from './AdvancedImageViewer';
import SpreadsheetViewer from './spreadsheet/SpreadsheetViewer';
import EnhancedTextEditor from './EnhancedTextEditor';
import MobilePDFViewer from './MobilePDFViewer';

interface MobilePreviewModalProps {
  file: any;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  onShareChange?: () => void;
}

const MobilePreviewModal: React.FC<MobilePreviewModalProps> = ({
  file,
  isOpen,
  onClose,
  onDownload,
  onShare,
  onShareChange,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decodedBlob, setDecodedBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen || !file) return;

    const loadFile = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const blob = await smartDownload(file.id, {
          reason: 'preview',
          fileName: file.name,
        });
        setDecodedBlob(blob);
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch (err) {
        console.error('Failed to load file:', err);
        setError('Failed to load file preview');
      } finally {
        setLoading(false);
      }
    };

    loadFile();

    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [isOpen, file?.id]);

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    }
  };

  const handleShare = () => {
    if (onShare) {
      onShare();
      onShareChange?.();
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-[#0a0a12]">
          <div className="text-center">
            <Loader size="xl" />
            <p className="mt-4 text-sm text-[#6b6b80]">Loading preview...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-[#0a0a12]">
          <div className="text-center px-6">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        </div>
      );
    }

    if (!blobUrl || !decodedBlob) {
      return null;
    }

    const isVideo = file.type?.startsWith('video/');
    const isImage = file.type?.startsWith('image/');
    const isPDF = file.type === 'application/pdf';
    const isSpreadsheet = file.type?.includes('spreadsheet') || 
                          file.type?.includes('csv') ||
                          file.name?.endsWith('.csv') ||
                          file.name?.endsWith('.xlsx');
    const isText = file.type?.startsWith('text/') ||
                   file.name?.match(/\.(txt|md|json|js|ts|jsx|tsx|css|html|xml|yaml|yml|sqd)$/i);

    if (isVideo) {
      return (
        <div className="relative w-full h-full bg-black">
          <CBVideoPlayer
            file={file}
            src={blobUrl}
            autoPlay={false}
            muted={false}
            onDownload={handleDownload}
            onShare={handleShare}
            className="w-full h-full"
          />
        </div>
      );
    }

    if (isImage) {
      return (
        <div className="relative w-full h-full bg-black flex items-center justify-center">
          <AdvancedImageViewer
            src={blobUrl}
            alt={file.name}
            file={file}
            onDownload={handleDownload}
            onShare={handleShare}
          />
        </div>
      );
    }

    if (isPDF) {
      return (
        <MobilePDFViewer
          file={file}
          pdfBlob={decodedBlob}
          onClose={onClose}
          onDownload={handleDownload}
          onShare={handleShare}
        />
      );
    }

    if (isSpreadsheet) return null; // handled at top level

    if (isText) {
      return (
        <EnhancedTextEditor
          file={file}
          decodedBlob={decodedBlob}
          readonly={true}
        />
      );
    }

    return (
      <div className="flex h-full items-center justify-center p-6 bg-[#0a0a12]">
        <div className="text-center">
          <p className="text-[#6b6b80] mb-4 text-sm">
            Preview not available for this file type
          </p>
          <button 
            onClick={handleDownload}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl mx-auto",
              "bg-blue-600 hover:bg-blue-500 text-white",
              "text-sm font-medium",
              "transition-all duration-150 active:scale-95"
            )}
          >
            <Download className="h-4 w-4" strokeWidth={1.8} />
            Download File
          </button>
        </div>
      </div>
    );
  };

  const isSpreadsheet = file?.type?.includes('spreadsheet') ||
                        file?.type?.includes('csv') ||
                        file?.name?.endsWith('.csv') ||
                        file?.name?.endsWith('.xlsx');

  if (isSpreadsheet && blobUrl) {
    return <SpreadsheetViewer src={blobUrl} fileName={file.name} onClose={onClose} onDownload={handleDownload} />;
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn(
          "p-0 rounded-t-3xl",
          "bg-[#0a0a12] border-t border-[#1f1f2e]",
          isFullscreen ? 'h-screen' : 'h-[90vh]'
        )}
      >
        {/* Header */}
        <SheetHeader className={cn(
          "border-b border-[#1f1f2e]/60",
          "px-4 py-3 flex flex-row items-center justify-between space-y-0",
          "bg-[#0f0f17]/80 backdrop-blur-sm"
        )}>
          <div className="flex-1 min-w-0">
            <SheetTitle className="text-base font-semibold text-[#e8e8f0] truncate">
              {file?.name}
            </SheetTitle>
            {file && (
              <p className="text-xs text-[#6b6b80] mt-0.5">
                {formatFileSize(file.size)}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-1.5 ml-4">
            <button
              onClick={toggleFullscreen}
              className={cn(
                "flex items-center justify-center",
                "h-9 w-9 rounded-lg",
                "text-[#6b6b80] hover:text-[#e8e8f0]",
                "hover:bg-[#1f1f2e]/60",
                "transition-all duration-150"
              )}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" strokeWidth={1.8} />
              ) : (
                <Maximize2 className="h-4 w-4" strokeWidth={1.8} />
              )}
            </button>
            
            {onShare && (
              <button
                onClick={handleShare}
                className={cn(
                  "flex items-center justify-center",
                  "h-9 w-9 rounded-lg",
                  "text-[#6b6b80] hover:text-[#e8e8f0]",
                  "hover:bg-[#1f1f2e]/60",
                  "transition-all duration-150"
                )}
              >
                <Share2 className="h-4 w-4" strokeWidth={1.8} />
              </button>
            )}
            
            {onDownload && (
              <button
                onClick={handleDownload}
                className={cn(
                  "flex items-center justify-center",
                  "h-9 w-9 rounded-lg",
                  "text-[#6b6b80] hover:text-[#e8e8f0]",
                  "hover:bg-[#1f1f2e]/60",
                  "transition-all duration-150"
                )}
              >
                <Download className="h-4 w-4" strokeWidth={1.8} />
              </button>
            )}
            
            <button
              onClick={onClose}
              className={cn(
                "flex items-center justify-center",
                "h-9 w-9 rounded-lg",
                "text-[#6b6b80] hover:text-[#e8e8f0]",
                "hover:bg-[#1f1f2e]/60",
                "transition-all duration-150"
              )}
            >
              <X className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex flex-col h-[calc(100%-60px)] bg-[#0a0a12]">
          <div className="flex-1 overflow-auto">
            {renderContent()}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobilePreviewModal;

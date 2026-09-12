import React, { useState, useRef, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { formatBytes, FileItem as FileItemType } from '@/lib/api';
import { FileText, Image, Video, Music, Archive, File, MoreVertical, Star, Share2 } from '@/lib/icon-map';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import FileActionMenu from './FileActionMenu';
import MobileFileActionSheet from './MobileFileActionSheet';
import FileViewer from './FileViewer';

interface FileItemProps {
  file: FileItemType;
  viewMode: 'grid' | 'list' | 'compact';
  isSelected?: boolean;
  onToggleSelect?: (fileId: string) => void;
  onClick?: (file: FileItemType) => void;
  onPreview?: () => void;
  onDelete?: (file: FileItemType) => void;
  onShare?: (file: FileItemType) => void;
  onDownload?: (file: FileItemType) => void;
  onMoveToFolder?: (file: FileItemType) => void;
  // Accepted for caller compatibility; FileItem has no internal share/info
  // UI, so these are intentionally not consumed here.
  onViewInfo?: (file: FileItemType) => void;
  onOpenInCbCode?: (file: FileItemType) => void;
  onShareRevoked?: (id: string) => void;
  onShareChange?: (id: string) => void;
}

const getFileConfig = (name: string, type: string) => {
  const ext = name.split('.').pop()?.toUpperCase() || 'FILE';
  if (type.startsWith('image/') || ['JPG', 'PNG', 'WEBP', 'GIF', 'SVG'].includes(ext)) {
    return { label: ext, icon: Image };
  }
  if (type.startsWith('video/') || ['MP4', 'MKV', 'AVI', 'MOV', 'WEBM'].includes(ext)) {
    return { label: ext, icon: Video };
  }
  if (type.startsWith('audio/') || ['MP3', 'WAV', 'FLAC', 'AAC'].includes(ext)) {
    return { label: ext, icon: Music };
  }
  if (['ZIP', 'RAR', '7Z', 'TAR', 'GZ', 'DEB', 'WHL'].includes(ext)) {
    return { label: ext, icon: Archive };
  }
  if (['PDF'].includes(ext)) {
    return { label: ext, icon: FileText };
  }
  return { label: ext, icon: FileText };
};

const FileItem: React.FC<FileItemProps> = ({
  file, viewMode, isSelected = false, onToggleSelect, onClick, onPreview, onDelete, onShare, onDownload, onMoveToFolder
}) => {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout>>();
  const isMobile = useIsMobile();
  const cfg = getFileConfig(file.name, file.type);
  const IconComponent = cfg.icon;

  const handleTouchStart = useCallback(() => {
    longPressRef.current = setTimeout(() => setMobileSheetOpen(true), 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    clearTimeout(longPressRef.current);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      onToggleSelect?.(file.id);
    } else if (onClick) {
      onClick(file);
    } else {
      onPreview ? onPreview() : setViewerOpen(true);
    }
  };

  const handleMobileMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setMobileSheetOpen(true);
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  };

  const isGrid = viewMode === 'grid' || viewMode === 'compact';

  if (isGrid) {
    return (
      <>
        <div
          data-kbd-item
          className={cn(
            'group relative flex flex-col p-2.5 rounded-[10px] cursor-pointer transition-colors duration-150 select-none border',
            'bg-card/50 border-border/60 hover:bg-accent/40 hover:border-border',
            isSelected && 'bg-accent ring-1 ring-foreground/50 border-transparent'
          )}
          onClick={handleClick}
          onDoubleClick={() => setViewerOpen(true)}
          onTouchStart={isMobile ? handleTouchStart : undefined}
          onTouchEnd={isMobile ? handleTouchEnd : undefined}
          onTouchMove={isMobile ? handleTouchEnd : undefined}
          onContextMenu={isMobile ? (e) => { e.preventDefault(); setMobileSheetOpen(true); } : undefined}
        >
          {/* Preview canvas */}
          <div className="relative w-full aspect-[4/3] rounded-md bg-muted/30 border border-border/40 flex flex-col items-center justify-center mb-3 overflow-hidden">
            <IconComponent className="w-8 h-8 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors duration-150" />

            {cfg.label !== 'FILE' && (
              <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-muted/80 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                {cfg.label}
              </span>
            )}

            {file.shared && (
              <div className="absolute top-2 left-2 p-1 rounded bg-muted/70 text-muted-foreground">
                <Share2 className="w-3 h-3" />
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="w-full min-w-0 px-0.5 flex flex-col justify-between flex-1">
            <span className="text-[13px] font-medium text-foreground truncate leading-snug tracking-tight" title={file.name}>
              {file.name}
            </span>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1 tabular-nums">
              <span>{formatBytes(file.size)}</span>
              <span>
                {formatDistanceToNow(new Date(file.created_at || Date.now()), { addSuffix: true }).replace('about ', '')}
              </span>
            </div>
          </div>

          {/* Grid hover action menu trigger */}
          <div className="absolute top-2.5 right-2.5 z-10" onClick={e => e.stopPropagation()}>
            {isMobile ? (
              <button
                onClick={handleMobileMenuClick}
                className="w-7 h-7 rounded-md bg-background/90 border border-border hover:bg-accent flex items-center justify-center text-foreground transition-colors"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <FileActionMenu
                  file={file}
                  onView={() => setViewerOpen(true)}
                  onShare={() => onShare?.(file)}
                  onDownload={() => onDownload?.(file)}
                  onDelete={() => onDelete?.(file)}
                  onMoveToFolder={() => onMoveToFolder?.(file)}
                  trigger={
                    <button className="w-7 h-7 rounded-md bg-background/90 border border-border hover:bg-accent flex items-center justify-center text-foreground transition-colors">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  }
                />
              </div>
            )}
          </div>
        </div>
        <FileViewer file={file} open={viewerOpen} onClose={() => setViewerOpen(false)} onDelete={onDelete} onShare={onShare} onDownload={onDownload} />
        {isMobile && (
          <MobileFileActionSheet
            isOpen={mobileSheetOpen}
            onClose={() => setMobileSheetOpen(false)}
            file={file}
            onView={() => setViewerOpen(true)}
            onDownload={() => onDownload?.(file)}
            onShare={() => onShare?.(file)}
            onDelete={() => onDelete?.(file)}
          />
        )}
      </>
    );
  }

  // macOS Finder List Table Row
  return (
    <>
      <div
        data-kbd-item
        className={cn(
          'group grid grid-cols-[1fr_100px_140px_36px] md:grid-cols-[1fr_110px_150px_100px_36px] items-center px-3 h-10 rounded-md cursor-pointer transition-colors duration-150 select-none border border-transparent',
          'hover:bg-accent/40',
          isSelected && 'bg-accent ring-1 ring-foreground/40'
        )}
        onClick={handleClick}
        onDoubleClick={() => setViewerOpen(true)}
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
        onTouchMove={isMobile ? handleTouchEnd : undefined}
        onContextMenu={isMobile ? (e) => { e.preventDefault(); setMobileSheetOpen(true); } : undefined}
      >
        <div className="flex items-center gap-3 min-w-0 pr-3">
          <div className="w-7 h-7 rounded-md bg-muted/50 border border-border/60 flex items-center justify-center shrink-0">
            <IconComponent className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <span className="text-[13px] font-medium text-foreground truncate" title={file.name}>
            {file.name}
          </span>
        </div>

        <span className="text-[11px] text-muted-foreground hidden md:block uppercase tracking-wider font-mono">
          {cfg.label}
        </span>

        <span className="text-xs text-muted-foreground truncate tabular-nums">
          {formatDistanceToNow(new Date(file.created_at || Date.now()), { addSuffix: true })}
        </span>

        <span className="text-xs text-muted-foreground font-mono tabular-nums">
          {formatBytes(file.size)}
        </span>

        <div className="flex justify-end shrink-0" onClick={e => e.stopPropagation()}>
          {isMobile ? (
            <button
              onClick={handleMobileMenuClick}
              className="w-7 h-7 rounded-md hover:bg-accent flex items-center justify-center transition-colors"
            >
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </button>
          ) : (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
              <FileActionMenu
                file={file}
                onView={() => setViewerOpen(true)}
                onShare={() => onShare?.(file)}
                onDownload={() => onDownload?.(file)}
                onDelete={() => onDelete?.(file)}
                onMoveToFolder={() => onMoveToFolder?.(file)}
                trigger={
                  <button className="w-7 h-7 rounded-md hover:bg-accent flex items-center justify-center">
                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                  </button>
                }
              />
            </div>
          )}
        </div>
      </div>
      <FileViewer file={file} open={viewerOpen} onClose={() => setViewerOpen(false)} onDelete={onDelete} onShare={onShare} onDownload={onDownload} />
      {isMobile && (
        <MobileFileActionSheet
          isOpen={mobileSheetOpen}
          onClose={() => setMobileSheetOpen(false)}
          file={file}
          onView={() => setViewerOpen(true)}
          onDownload={() => onDownload?.(file)}
          onShare={() => onShare?.(file)}
          onDelete={() => onDelete?.(file)}
        />
      )}
    </>
  );
};

export default React.memo(FileItem);
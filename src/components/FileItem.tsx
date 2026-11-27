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
  // Passed by the dashboard. selectionMode keeps the checkboxes visible;
  // the other two are accepted and not consumed here.
  selectionMode?: boolean;
  onNotes?: (file: FileItemType) => void;
  onEmbed?: (file: FileItemType) => void;
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

/* Relative time for the row, exact time on hover. A malformed created_at
   renders nothing instead of throwing and taking the whole grid down. */
const whenOf = (file: FileItemType) => {
  const d = new Date(file.created_at || Date.now());
  if (Number.isNaN(d.getTime())) return { rel: '', exact: '', iso: undefined as string | undefined };
  return {
    rel: formatDistanceToNow(d, { addSuffix: true }).replace('about ', ''),
    exact: d.toLocaleString(),
    iso: d.toISOString(),
  };
};

/* Selection box. Shown on hover / focus, always while something is selected or
   the dashboard is in selection mode. Not a tab stop: files are reached with
   the arrow keys and toggled with Space. */
const SelectBox: React.FC<{ checked: boolean; label: string; visible: boolean; onToggle: () => void; className?: string }> = ({
  checked, label, visible, onToggle, className,
}) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    aria-label={label}
    tabIndex={-1}
    onClick={(e) => { e.stopPropagation(); onToggle(); }}
    onDoubleClick={(e) => e.stopPropagation()}
    className={cn(
      'flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border transition-[opacity,background-color,border-color] duration-100',
      checked
        ? 'border-foreground bg-foreground text-background'
        : 'border-input bg-background/90 text-transparent hover:border-foreground',
      visible || checked
        ? 'opacity-100'
        : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100',
      className,
    )}
  >
    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="2.5 6.5 5 9 9.5 3.5" />
    </svg>
  </button>
);

const FileItem: React.FC<FileItemProps> = ({
  file, viewMode, isSelected = false, selectionMode = false, onToggleSelect, onClick, onPreview, onDelete, onShare, onDownload, onMoveToFolder
}) => {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout>>();
  const isMobile = useIsMobile();
  const cfg = getFileConfig(file.name, file.type);
  const IconComponent = cfg.icon;
  const when = whenOf(file);

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

  /* Space on a focused file toggles its selection (the keyboard twin of ⌘/Ctrl-click).
     Only when the item itself has focus, so buttons inside it keep their own Space. */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || !onToggleSelect) return;
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect(file.id);
    }
  };

  const isGrid = viewMode === 'grid' || viewMode === 'compact';
  const isCompact = viewMode === 'compact';
  const boxLabel = `Select ${file.name}`;
  const menuLabel = `Actions for ${file.name}`;

  if (isGrid) {
    return (
      <>
        <div
          data-kbd-item
          data-selected={isSelected ? 'true' : undefined}
          tabIndex={-1}
          className={cn(
            'group relative flex flex-col rounded-[var(--radius-file)] cursor-pointer transition-colors duration-100 select-none border',
            isCompact ? 'p-2' : 'p-2.5',
            'bg-card border-border hover:bg-accent/50 hover:border-input',
            isSelected && 'bg-accent border-foreground/60 hover:border-foreground/60'
          )}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onDoubleClick={() => setViewerOpen(true)}
          onTouchStart={isMobile ? handleTouchStart : undefined}
          onTouchEnd={isMobile ? handleTouchEnd : undefined}
          onTouchMove={isMobile ? handleTouchEnd : undefined}
          onContextMenu={isMobile ? (e) => { e.preventDefault(); setMobileSheetOpen(true); } : undefined}
        >
          {/* Preview canvas */}
          <div className="relative w-full aspect-[4/3] rounded-[calc(var(--radius-file)-2px)] bg-muted/40 border border-border/70 flex flex-col items-center justify-center mb-2.5 overflow-hidden">
            <IconComponent className="w-8 h-8 text-muted-foreground group-hover:text-foreground transition-colors duration-150" />

            {cfg.label !== 'FILE' && (
              <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-background/80 border border-border/60 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {cfg.label}
              </span>
            )}

            {file.shared && (
              <div className="absolute bottom-1.5 left-1.5 p-1 rounded bg-background/80 border border-border/60 text-muted-foreground" title="Shared">
                <Share2 className="w-3 h-3" />
                <span className="sr-only">Shared</span>
              </div>
            )}

            {onToggleSelect && (
              <SelectBox
                checked={isSelected}
                label={boxLabel}
                visible={selectionMode}
                onToggle={() => onToggleSelect(file.id)}
                className="absolute top-1.5 left-1.5"
              />
            )}
          </div>

          {/* Metadata */}
          <div className="w-full min-w-0 px-0.5 flex flex-col justify-between flex-1">
            <span className="text-[13px] font-medium text-foreground truncate leading-snug tracking-tight" title={file.name}>
              {file.name}
            </span>
            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground mt-1 tabular-nums">
              <span>{formatBytes(file.size)}</span>
              {!isCompact && (
                <time dateTime={when.iso} title={when.exact} className="truncate">
                  {when.rel}
                </time>
              )}
            </div>
          </div>

          {/* Grid action menu trigger: hover, keyboard focus, or while the menu is open */}
          <div className="absolute top-2 right-2 z-10" onClick={e => e.stopPropagation()}>
            {isMobile ? (
              <button
                type="button"
                aria-label={menuLabel}
                onClick={handleMobileMenuClick}
                className="gm-trigger w-9 h-9 rounded-md bg-background/90 border border-border hover:bg-accent flex items-center justify-center text-foreground"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            ) : (
              <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100 transition-opacity duration-100">
                <FileActionMenu
                  file={file}
                  onView={() => setViewerOpen(true)}
                  onShare={() => onShare?.(file)}
                  onDownload={() => onDownload?.(file)}
                  onDelete={() => onDelete?.(file)}
                  onMoveToFolder={() => onMoveToFolder?.(file)}
                  trigger={
                    <button type="button" aria-label={menuLabel} className="gm-trigger w-7 h-7 rounded-md bg-background/90 border border-border hover:bg-accent flex items-center justify-center text-foreground">
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

  // List row. Column templates match LazyFileGrid's header exactly.
  return (
    <>
      <div
        data-kbd-item
        data-selected={isSelected ? 'true' : undefined}
        tabIndex={-1}
        className={cn(
          'group grid grid-cols-[1fr_100px_140px_36px] md:grid-cols-[1fr_110px_150px_100px_36px] items-center px-3 h-10 rounded-[var(--radius-file)] cursor-pointer transition-colors duration-100 select-none border border-transparent',
          'hover:bg-accent/50',
          isSelected && 'bg-accent border-foreground/40 hover:bg-accent'
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onDoubleClick={() => setViewerOpen(true)}
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
        onTouchMove={isMobile ? handleTouchEnd : undefined}
        onContextMenu={isMobile ? (e) => { e.preventDefault(); setMobileSheetOpen(true); } : undefined}
      >
        <div className="flex items-center gap-3 min-w-0 pr-3">
          {/* Icon swaps for the selection box on hover / in selection mode */}
          <div className="relative w-7 h-7 shrink-0">
            <div
              className={cn(
                'absolute inset-0 rounded-md bg-muted/50 border border-border/70 flex items-center justify-center transition-opacity duration-100',
                onToggleSelect && (selectionMode || isSelected)
                  ? 'opacity-0'
                  : onToggleSelect ? 'group-hover:opacity-0 group-focus-within:opacity-0' : ''
              )}
            >
              <IconComponent className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            {onToggleSelect && (
              <div className="absolute inset-0 flex items-center justify-center">
                <SelectBox checked={isSelected} label={boxLabel} visible={selectionMode} onToggle={() => onToggleSelect(file.id)} />
              </div>
            )}
          </div>
          <span className="text-[13px] font-medium text-foreground truncate" title={file.name}>
            {file.name}
          </span>
          {file.shared && (
            <span className="shrink-0 text-muted-foreground" title="Shared">
              <Share2 className="w-3 h-3" />
              <span className="sr-only">Shared</span>
            </span>
          )}
        </div>

        <span className="text-[11px] text-muted-foreground hidden md:block uppercase tracking-wider font-mono">
          {cfg.label}
        </span>

        <time dateTime={when.iso} title={when.exact} className="text-xs text-muted-foreground truncate tabular-nums">
          {when.rel}
        </time>

        <span className="text-xs text-muted-foreground font-mono tabular-nums">
          {formatBytes(file.size)}
        </span>

        <div className="flex justify-end shrink-0" onClick={e => e.stopPropagation()}>
          {isMobile ? (
            <button
              type="button"
              aria-label={menuLabel}
              onClick={handleMobileMenuClick}
              className="gm-trigger w-9 h-9 rounded-md hover:bg-accent flex items-center justify-center"
            >
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </button>
          ) : (
            <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100 transition-opacity duration-100">
              <FileActionMenu
                file={file}
                onView={() => setViewerOpen(true)}
                onShare={() => onShare?.(file)}
                onDownload={() => onDownload?.(file)}
                onDelete={() => onDelete?.(file)}
                onMoveToFolder={() => onMoveToFolder?.(file)}
                trigger={
                  <button type="button" aria-label={menuLabel} className="gm-trigger w-7 h-7 rounded-md hover:bg-accent flex items-center justify-center">
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

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { formatBytes, FileItem as FileItemType } from '@/lib/api';
import { FileText, Image, Video, Music, Archive, File, MoreVertical, Star, Share2 } from '@/lib/icon-map';
import { cn } from '@/lib/utils';
import FileActionMenu from './FileActionMenu';
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
}

const getFileConfig = (name: string, type: string) => {
  const ext = name.split('.').pop()?.toUpperCase() || 'FILE';
  if (type.startsWith('image/') || ['JPG', 'PNG', 'WEBP', 'GIF', 'SVG'].includes(ext)) {
    return { label: ext, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: Image };
  }
  if (type.startsWith('video/') || ['MP4', 'MKV', 'AVI', 'MOV', 'WEBM'].includes(ext)) {
    return { label: ext, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', badgeBg: 'bg-red-500/20 text-red-300 border-red-500/30', icon: Video };
  }
  if (type.startsWith('audio/') || ['MP3', 'WAV', 'FLAC', 'AAC'].includes(ext)) {
    return { label: ext, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: Music };
  }
  if (['ZIP', 'RAR', '7Z', 'TAR', 'GZ', 'DEB', 'WHL'].includes(ext)) {
    return { label: ext, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: Archive };
  }
  if (['PDF'].includes(ext)) {
    return { label: ext, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30', icon: FileText };
  }
  return { label: ext, color: 'text-neutral-300', bg: 'bg-white/[0.04] border-white/[0.08]', badgeBg: 'bg-white/10 text-neutral-300 border-white/15', icon: FileText };
};

const FileItem: React.FC<FileItemProps> = ({
  file, viewMode, isSelected = false, onToggleSelect, onClick, onPreview, onDelete, onShare, onDownload, onMoveToFolder
}) => {
  const [viewerOpen, setViewerOpen] = useState(false);
  const cfg = getFileConfig(file.name, file.type);
  const IconComponent = cfg.icon;

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

  const isGrid = viewMode === 'grid' || viewMode === 'compact';

  if (isGrid) {
    return (
      <>
        <div
          data-kbd-item
          className={cn(
            'group relative flex flex-col p-3 rounded-2xl cursor-pointer transition-all duration-200 select-none border',
            'bg-[#1a1a24]/40 border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12] hover:-translate-y-0.5 hover:shadow-xl',
            isSelected && 'bg-[#007AFF]/15 border-[#007AFF]/60 shadow-[0_0_20px_rgba(0,122,255,0.2)]'
          )}
          onClick={handleClick}
          onDoubleClick={() => setViewerOpen(true)}
        >
          {/* Top Preview Canvas */}
          <div className={cn(
            "relative w-full aspect-[4/3] rounded-xl flex flex-col items-center justify-center border transition-transform duration-200 mb-3 overflow-hidden",
            cfg.bg
          )}>
            <IconComponent className={cn("w-9 h-9 transition-transform duration-200 group-hover:scale-110 drop-shadow-md", cfg.color)} />
            
            {/* Category Pill Overlay */}
            <div className={cn(
              "absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold border tracking-wider uppercase shadow-sm backdrop-blur-md",
              cfg.badgeBg
            )}>
              {cfg.label}
            </div>

            {/* Shared Indicator Icon */}
            {file.shared && (
              <div className="absolute top-2 left-2 p-1 rounded-md bg-black/50 border border-white/10 text-blue-400 backdrop-blur-md">
                <Share2 className="w-3 h-3" />
              </div>
            )}
          </div>

          {/* Metadata Footer */}
          <div className="w-full min-w-0 px-0.5 flex flex-col justify-between flex-1">
            <span className="text-[13px] font-medium text-neutral-100 truncate leading-snug tracking-tight" title={file.name}>
              {file.name}
            </span>
            <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono mt-1">
              <span>{formatBytes(file.size)}</span>
              <span className="text-[10px] text-neutral-500 font-sans">
                {formatDistanceToNow(new Date(file.created_at || Date.now()), { addSuffix: true }).replace('about ', '')}
              </span>
            </div>
          </div>

          {/* Grid Hover Action Menu Trigger */}
          <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity z-10" onClick={e => e.stopPropagation()}>
            <FileActionMenu
              file={file}
              onView={() => setViewerOpen(true)}
              onShare={() => onShare?.(file)}
              onDownload={() => onDownload?.(file)}
              onDelete={() => onDelete?.(file)}
              onMoveToFolder={() => onMoveToFolder?.(file)}
              trigger={
                <button className="w-7 h-7 rounded-lg bg-black/60 border border-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-md transition-colors shadow-lg">
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              }
            />
          </div>
        </div>
        <FileViewer file={file} open={viewerOpen} onClose={() => setViewerOpen(false)} onDelete={onDelete} onShare={onShare} onDownload={onDownload} />
      </>
    );
  }

  // macOS Finder List Table Row
  return (
    <>
      <div
        data-kbd-item
        className={cn(
          'group grid grid-cols-[1fr_100px_140px_36px] md:grid-cols-[1fr_110px_150px_100px_36px] items-center px-4 h-11 rounded-xl cursor-pointer transition-all duration-100 select-none border border-transparent',
          'hover:bg-white/[0.04]',
          isSelected && 'bg-[#007AFF]/15 border-[#007AFF]/40 text-white shadow-sm'
        )}
        onClick={handleClick}
        onDoubleClick={() => setViewerOpen(true)}
      >
        <div className="flex items-center gap-3 min-w-0 pr-3">
          <div className={cn("w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 shadow-sm", cfg.bg)}>
            <IconComponent className={cn("w-3.5 h-3.5", cfg.color)} />
          </div>
          <span className="text-[13px] font-medium text-neutral-200 truncate" title={file.name}>
            {file.name}
          </span>
        </div>

        <span className="text-xs text-neutral-400 hidden md:block uppercase tracking-wider font-mono text-[11px]">
          {cfg.label} File
        </span>

        <span className="text-xs text-neutral-400 truncate">
          {formatDistanceToNow(new Date(file.created_at || Date.now()), { addSuffix: true })}
        </span>

        <span className="text-xs text-neutral-400 font-mono">
          {formatBytes(file.size)}
        </span>

        <div className="flex justify-end shrink-0" onClick={e => e.stopPropagation()}>
          <FileActionMenu
            file={file}
            onView={() => setViewerOpen(true)}
            onShare={() => onShare?.(file)}
            onDownload={() => onDownload?.(file)}
            onDelete={() => onDelete?.(file)}
            onMoveToFolder={() => onMoveToFolder?.(file)}
            trigger={
              <button className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="w-4 h-4 text-neutral-400" />
              </button>
            }
          />
        </div>
      </div>
      <FileViewer file={file} open={viewerOpen} onClose={() => setViewerOpen(false)} onDelete={onDelete} onShare={onShare} onDownload={onDownload} />
    </>
  );
};

export default React.memo(FileItem);
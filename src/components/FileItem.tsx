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

const getFileBadge = (name: string, type: string) => {
  const ext = name.split('.').pop()?.toUpperCase() || 'FILE';
  if (type.startsWith('image/')) return { label: ext, color: 'bg-blue-500/20 text-blue-300 border-blue-500/40', icon: Image };
  if (type.startsWith('video/')) return { label: ext, color: 'bg-red-500/20 text-red-300 border-red-500/40', icon: Video };
  if (type.startsWith('audio/')) return { label: ext, color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', icon: Music };
  if (/ZIP|RAR|7Z|TAR|GZ/i.test(ext)) return { label: ext, color: 'bg-amber-500/20 text-amber-300 border-amber-500/40', icon: Archive };
  return { label: ext, color: 'bg-neutral-800 text-neutral-300 border-neutral-700', icon: FileText };
};

const FileItem: React.FC<FileItemProps> = ({
  file, viewMode, isSelected = false, onToggleSelect, onClick, onPreview, onDelete, onShare, onDownload, onMoveToFolder
}) => {
  const [viewerOpen, setViewerOpen] = useState(false);
  const badge = getFileBadge(file.name, file.type);
  const IconComponent = badge.icon;

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
            'group relative flex flex-col items-center p-3 rounded-2xl cursor-pointer transition-all duration-150 select-none border border-transparent',
            'hover:bg-white/[0.04]',
            isSelected && 'bg-[#007AFF]/15 border-[#007AFF]/50 shadow-[0_0_15px_rgba(0,122,255,0.15)]'
          )}
          onClick={handleClick}
          onDoubleClick={() => setViewerOpen(true)}
        >
          {/* Finder Document Sheet Icon */}
          <div className="relative w-14 h-16 mb-2.5 flex items-center justify-center rounded-xl bg-gradient-to-b from-neutral-800 to-neutral-900 border border-white/10 shadow-lg group-hover:-translate-y-0.5 transition-transform">
            <IconComponent className="w-6 h-6 text-neutral-400 opacity-80" />
            <div className={cn("absolute -bottom-1.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border shadow-md uppercase tracking-wider", badge.color)}>
              {badge.label}
            </div>
          </div>

          <div className="w-full text-center min-w-0 px-1">
            <span className="text-xs font-medium text-neutral-200 block truncate" title={file.name}>
              {file.name}
            </span>
            <span className="text-[10px] text-neutral-500 font-mono mt-0.5 block">
              {formatBytes(file.size)}
            </span>
          </div>
        </div>
        <FileViewer file={file} open={viewerOpen} onClose={() => setViewerOpen(false)} onDelete={onDelete} onShare={onShare} onDownload={onDownload} />
      </>
    );
  }

  // macOS Finder Table Row
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
        {/* Name */}
        <div className="flex items-center gap-3 min-w-0 pr-3">
          <div className="w-7 h-7 rounded-lg bg-neutral-800/80 border border-white/10 flex items-center justify-center shrink-0">
            <IconComponent className="w-3.5 h-3.5 text-neutral-300" />
          </div>
          <span className="text-[13px] font-medium text-neutral-200 truncate" title={file.name}>
            {file.name}
          </span>
        </div>

        {/* Kind */}
        <span className="text-xs text-neutral-400 hidden md:block uppercase tracking-wider font-mono text-[11px]">
          {badge.label} File
        </span>

        {/* Date Modified */}
        <span className="text-xs text-neutral-400 truncate">
          {formatDistanceToNow(new Date(file.created_at || Date.now()), { addSuffix: true })}
        </span>

        {/* Size */}
        <span className="text-xs text-neutral-400 font-mono">
          {formatBytes(file.size)}
        </span>

        {/* Action Menu */}
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

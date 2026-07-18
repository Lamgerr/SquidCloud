import React from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { formatFileSize } from '@/lib/utils';
import FileCardMenu from '@/components/FileCardMenu';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import {
  Image, Video, Music, Archive,
  Code, FileJson, FileText, Lock, Share2
} from '@/lib/icon-map';

interface FileItem {
  id: string;
  name: string;
  type?: string;
  size?: number;
  created_at: string;
  encrypted?: boolean;
  shared?: boolean;
}

interface EnhancedFileCardProps {
  file: FileItem;
  viewMode: 'grid' | 'list';
  onClick: () => void;
  onView: () => void;
  onDownload: () => void;
  onShare: () => void;
  onDelete: () => void;
  onInfo: () => void;
  onVersionHistory: () => void;
  onExtract?: () => void;
}

const EnhancedFileCard: React.FC<EnhancedFileCardProps> = ({
  file,
  viewMode,
  onClick,
  onView,
  onDownload,
  onShare,
  onDelete,
  onInfo,
  onVersionHistory,
  onExtract,
}) => {

  const isImageFile = (type: string) => type?.startsWith('image/');
  const isVideoFile = (type: string) => type?.startsWith('video/');
  const isAudioFile = (type: string) => type?.startsWith('audio/');
  const isArchiveFile = (name: string) => /\.(zip|rar|7z|tar|gz)$/i.test(name);
  const isCodeFile = (name: string) => /\.(js|jsx|ts|tsx|py|html|css|json|md|php|rb|go|rs|c|cpp|java|sql)$/i.test(name);

  // Monochrome: every file type reads as silver — shape carries meaning, not hue.
  const getFileIcon = () => {
    const fileType = file.type || '';
    const iconClass = "h-4 w-4 text-foreground/70";
    if (isImageFile(fileType)) return <Image className={iconClass} />;
    if (isVideoFile(fileType)) return <Video className={iconClass} />;
    if (isAudioFile(fileType)) return <Music className={iconClass} />;
    if (isArchiveFile(file.name)) return <Archive className={iconClass} />;
    if (isCodeFile(file.name)) return <Code className={iconClass} />;
    if (file.name.endsWith('.json')) return <FileJson className={iconClass} />;
    return <FileText className={iconClass} />;
  };

  const truncateFileName = (name: string, maxLength: number = 22) => {
    if (name.length <= maxLength) return name;
    const ext = name.lastIndexOf('.');
    if (ext > 0 && name.length - ext <= 5) {
      const baseName = name.slice(0, ext);
      const extension = name.slice(ext);
      const truncatedBase = baseName.slice(0, maxLength - extension.length - 2);
      return `${truncatedBase}…${extension}`;
    }
    return `${name.slice(0, maxLength - 1)}…`;
  };

  const formatDate = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  };

  return (
    <motion.div
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.985 }}
      transition={springs.soft}
      className="mono-sheen rounded-2xl"
    >
      <div
        data-view-mode={viewMode}
        className={cnCard(viewMode)}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (
            target.closest('button') ||
            target.closest('[role="menuitem"]') ||
            target.closest('[data-radix-dropdown-menu-item]')
          ) {
            return;
          }
          onClick();
        }}
      >
        <div className={`p-3 ${viewMode === 'list' ? '' : 'space-y-2'}`}>
          <div className="flex items-center gap-3">
            {/* Icon container */}
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/8">
              {getFileIcon()}
            </div>

            {/* File info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight text-foreground" title={file.name}>
                {truncateFileName(file.name)}
              </p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(file.size || 0)}
                </span>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(file.created_at)}
                </span>
                {file.encrypted && (
                  <Lock className="ml-1 h-3 w-3 text-foreground/60" />
                )}
                {file.shared && (
                  <Share2 className="ml-0.5 h-3 w-3 text-foreground/60" />
                )}
              </div>
            </div>

            {/* Menu */}
            <div className="flex-shrink-0">
              <FileCardMenu
                file={file}
                onView={onView}
                onDownload={onDownload}
                onShare={onShare}
                onInfo={onInfo}
                onDelete={onDelete}
                onVersionHistory={onVersionHistory}
                onExtract={isArchiveFile(file.name) ? onExtract : undefined}
              />
            </div>
          </div>

          {/* Grid-specific layout adjustments */}
          {viewMode === 'grid' && (
            <div className="flex items-center gap-1.5 pt-0.5 text-[10px] text-muted-foreground">
              {file.encrypted && (
                <Badge variant="secondary" className="h-4 rounded-md px-1.5 py-0 text-[10px] font-normal">
                  Encrypted
                </Badge>
              )}
              {file.shared && (
                <Badge variant="outline" className="h-4 rounded-md border-white/15 px-1.5 py-0 text-[10px] font-normal">
                  Shared
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const cnCard = (viewMode: 'grid' | 'list') =>
  cn(
    'group cursor-pointer transition-shadow duration-200',
    'hover:shadow-[0_18px_50px_-22px_rgba(0,0,0,0.7)]',
    viewMode === 'list' ? 'p-0' : 'p-0'
  );

export default EnhancedFileCard;

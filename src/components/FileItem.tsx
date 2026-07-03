import React, { useState, useRef, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Image, Video, Music, Archive, File, MoreVertical, Star, Share2 } from '@/lib/icon-map';
import { formatBytes, FileItem as FileItemType } from '@/lib/api';
import FileActionMenu from './FileActionMenu';
import FileViewer from './FileViewer';
import UniversalContextMenu from './UniversalContextMenu';
import MobileFileActionSheet from './MobileFileActionSheet';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useBookmarks } from '@/hooks/use-bookmarks';
import { cn } from '@/lib/utils';
import { haptics } from '@/utils/mobile';
import { revokeFileShare } from '@/lib/api';
import ShareManagementDialog from './ShareManagementDialog';
import { usePublishState } from '@/hooks/usePublish';
import { PublishWebsiteModal } from './publish/PublishWebsiteModal';

interface FileItemProps {
  file: FileItemType;
  viewMode: 'grid' | 'list' | 'compact';
  onDelete?: (file: FileItemProps['file']) => void;
  onShare?: (file: FileItemProps['file']) => void;
  onDownload?: (file: FileItemProps['file']) => void;
  onClick?: (file: FileItemProps['file']) => void;
  onViewInfo?: (file: any) => void;
  onPreview?: () => void;
  onMoveToFolder?: (file: FileItemProps['file']) => void;
  selected?: boolean;
  showVaultActions?: boolean;
  onMoveToVault?: (file: FileItemProps['file']) => void;
  onRemoveFromVault?: (file: FileItemProps['file']) => void;
  onShareRevoked?: (fileId: string) => void;
  onShareChange?: (fileId: string) => void;
  onExtract?: (file: FileItemProps['file']) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (fileId: string) => void;
  onOpenInCbCode?: (file: FileItemProps['file']) => void;
  onNotes?: (file: FileItemProps['file']) => void;
  onEmbed?: (file: FileItemProps['file']) => void;
}

const typeIcons: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  image: { icon: Image, color: 'text-blue-300', bg: 'bg-[#1A3A5C]' },
  video: { icon: Video, color: 'text-red-300', bg: 'bg-[#3A1A4A]' },
  audio: { icon: Music, color: 'text-emerald-300', bg: 'bg-[#1A3A2A]' },
  pdf: { icon: FileText, color: 'text-rose-300', bg: 'bg-[#4A1A1A]' },
  archive: { icon: Archive, color: 'text-amber-300', bg: 'bg-[#1A2A3A]' },
  text: { icon: FileText, color: 'text-sky-300', bg: 'bg-[#2D333B]' },
  spreadsheet: { icon: FileText, color: 'text-emerald-300', bg: 'bg-[#2D333B]' },
  code: { icon: FileText, color: 'text-violet-300', bg: 'bg-[#2D333B]' },
  default: { icon: File, color: 'text-muted-foreground', bg: 'bg-[#2D333B]' },
};

const getIconConfig = (type: string, name: string) => {
  const t = type.toLowerCase();
  const n = name.toLowerCase();
  if (t.startsWith('image/')) return typeIcons.image;
  if (t.startsWith('video/')) return typeIcons.video;
  if (t.startsWith('audio/')) return typeIcons.audio;
  if (t.includes('pdf')) return typeIcons.pdf;
  if (t.includes('zip') || t.includes('rar') || t.includes('7z') || t.includes('tar') || t.includes('gz') || t.includes('archive')) return typeIcons.archive;
  if (n.endsWith('.txt') || t.includes('text')) return typeIcons.text;
  if (n.endsWith('.csv') || n.endsWith('.xls') || n.endsWith('.xlsx')) return typeIcons.spreadsheet;
  if (n.endsWith('.js') || n.endsWith('.ts') || n.endsWith('.py') || n.endsWith('.jsx') || n.endsWith('.tsx') || n.endsWith('.json') || n.endsWith('.html') || n.endsWith('.css')) return typeIcons.code;
  return typeIcons.default;
};

const FileItem: React.FC<FileItemProps> = ({
  file, viewMode, onDelete, onShare, onDownload, onClick, onViewInfo, onPreview, onMoveToFolder,
  showVaultActions = false, onMoveToVault, onRemoveFromVault, onShareRevoked, onShareChange, onExtract,
  selectionMode = false, isSelected = false, onToggleSelect, onOpenInCbCode, onNotes, onEmbed
}) => {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const { publication: pubStatus } = usePublishState(!publishModalOpen ? file.id : null);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { isBookmarked } = useBookmarks();

  const bookmarked = isBookmarked(file.id);
  const iconCfg = getIconConfig(file.type, file.name);
  const IconComp = iconCfg.icon;
  const isHtmlFile = /\.html?$/i.test(file.name);

  const isCompact = viewMode === 'compact';

  const handleDelete = () => { haptics.heavy(); if (onDelete) onDelete(file); else toast({ title: "Delete failed", description: "Delete not available", variant: "destructive" }); };
  const handleView = () => { haptics.light(); onPreview ? onPreview() : setViewerOpen(true); };
  const handleShare = () => { haptics.light(); if (onShare) onShare(file); };
  const handleDownload = () => { haptics.medium(); if (onDownload) onDownload(file); else toast({ title: "Download started", description: `Downloading ${file.name}...` }); };
  const handleRevokeShare = async () => {
    try {
      const success = await revokeFileShare(file.id);
      if (success) {
        onShareRevoked?.(file.id);
        toast({ title: "Share revoked", description: "Share link has been disabled" });
      }
    } catch {
      toast({ title: "Revoke failed", description: "Could not revoke share", variant: "destructive" });
    }
  };
  const handleOpenShareManager = () => setShareDialogOpen(true);
  const handleNotes = onNotes ? () => onNotes(file) : undefined;
  const handleEmbed = onEmbed ? () => onEmbed(file) : undefined;

  const fileWithDefaults = { ...file, updated_at: file.updated_at || file.created_at } as FileItemType;

  const longPressTriggered = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleTouchStart = useCallback(() => {
    if (!isMobile || selectionMode) return;
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      haptics.medium();
      setActionSheetOpen(true);
    }, 500);
  }, [isMobile, selectionMode, file.id]);

  const handleTouchEnd = useCallback(() => {
    clearTimeout(longPressTimer.current);
  }, []);

  const handleTouchMove = useCallback(() => {
    clearTimeout(longPressTimer.current);
  }, []);

  const handleItemClick = (e: React.MouseEvent) => {
    if (isMobile && longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    if (selectionMode && onToggleSelect) { e.stopPropagation(); onToggleSelect(file.id); return; }
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="menuitem"]') || target.closest('[role="menu"]') || target.closest('[data-checkbox]')) return;
    if (onClick) onClick(file); else if (onPreview) onPreview(); else setViewerOpen(true);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMobile) return;
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  const menuTrigger = (className?: string) => (
    <button className={cn("flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[#2D333B] transition-colors", className)}>
      <MoreVertical className="w-3.5 h-3.5 text-[#768390]" />
    </button>
  );

  if (viewMode === 'list') {
    return (
      <>
        <div
          className={cn(
            'group flex items-center gap-3 px-4 h-12 rounded-xl transition-all duration-150',
            isMobile
              ? 'bg-card border border-border/40'
              : 'hover:bg-card/70 border border-transparent hover:border-border/30',
            isSelected && 'ring-1 ring-primary/20 border-primary/20 bg-primary/[0.03]'
          )}
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          onClick={handleItemClick}
        >
          {selectionMode && (
            <div data-checkbox onClick={e => { e.stopPropagation(); onToggleSelect?.(file.id); }}>
              <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect?.(file.id)} className="h-4 w-4" />
            </div>
          )}
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', iconCfg.bg)}>
            <IconComp className={cn('w-4 h-4', iconCfg.color)} />
          </div>
          <p className="flex-1 min-w-0 text-sm font-medium text-foreground truncate" title={file.name}>
            {bookmarked && <Star className="w-3 h-3 inline-flex flex-shrink-0 fill-yellow-400 text-yellow-400 mr-1.5 -mt-0.5" />}
            {file.name}
          </p>
          <span className="text-xs text-muted-foreground whitespace-nowrap hidden md:inline">{formatBytes(file.size)}</span>
          <span className="text-xs text-muted-foreground whitespace-nowrap hidden lg:inline">{formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}</span>
          {file.shared && (
            <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
              <Share2 className="w-2.5 h-2.5" />
              Shared
            </span>
          )}
          {!selectionMode && (
            <div className="flex-shrink-0">
              {isMobile ? (
                <button
                  onClick={e => { e.stopPropagation(); setActionSheetOpen(true); }}
                  className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[#2D333B] transition-colors"
                >
                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                </button>
              ) : (
                <FileActionMenu
                  file={file} onView={handleView} onShare={handleShare} onViewInfo={onViewInfo}
                  onDelete={handleDelete} onDownload={handleDownload}
                  onMoveToFolder={onMoveToFolder ? () => onMoveToFolder(file) : undefined}
                  onMoveToVault={onMoveToVault} onRemoveFromVault={onRemoveFromVault}
                  showVaultActions={showVaultActions} onShareRevoked={onShareRevoked}
                  onShareChange={onShareChange} onExtract={onExtract ? () => onExtract(file) : undefined}
                  onOpenInCbCode={onOpenInCbCode ? () => onOpenInCbCode(file) : undefined}
                  onNotes={handleNotes}
                  onEmbed={handleEmbed}
                  trigger={menuTrigger()}
                />
              )}
            </div>
          )}
        </div>
        <FileViewer file={fileWithDefaults} open={viewerOpen} onClose={() => setViewerOpen(false)} onDelete={onDelete} onShare={onShare} onDownload={onDownload} />
        {contextMenu && (
          <UniversalContextMenu
            x={contextMenu.x} y={contextMenu.y} item={file} onClose={closeContextMenu}
            onView={handleView} onDownload={handleDownload} onShare={handleShare}
            onDelete={handleDelete} onInfo={() => onViewInfo?.(file)}
            onPublish={isHtmlFile ? () => setPublishModalOpen(true) : undefined}
            isPublished={isHtmlFile ? pubStatus?.status === 'live' : undefined}
            onNotes={handleNotes}
            onEmbed={handleEmbed}
          />
        )}
        <MobileFileActionSheet
          isOpen={actionSheetOpen}
          onClose={() => setActionSheetOpen(false)}
          file={fileWithDefaults}
          onView={handleView}
          onDownload={handleDownload}
          onShare={handleShare}
          onInfo={() => onViewInfo?.(file)}
          onMove={() => onMoveToFolder?.(file)}
          onDelete={handleDelete}
          onOpenInCbCode={onOpenInCbCode ? () => onOpenInCbCode(file) : undefined}
          onExtract={onExtract ? () => onExtract(file) : undefined}
          showVaultActions={showVaultActions}
          onMoveToVault={onMoveToVault ? () => onMoveToVault(file) : undefined}
          onRemoveFromVault={onRemoveFromVault ? () => onRemoveFromVault(file) : undefined}
          isShared={!!file.shared}
          isArchive={/\.(zip|rar|7z|tar|gz|tgz|bz2|tar\.gz|tar\.bz2)$/i.test(file.name)}
          onRevokeShare={handleRevokeShare}
          onManageShares={handleOpenShareManager}
        />
        <ShareManagementDialog open={shareDialogOpen} onOpenChange={setShareDialogOpen} />
        <PublishWebsiteModal
          open={publishModalOpen}
          onOpenChange={setPublishModalOpen}
          resourceId={file.id}
          resourceType="file"
          resourceName={file.name}
        />
      </>
    );
  }

  const gridPadding = isCompact ? 'p-3' : 'p-4';
  const iconSize = isCompact ? 'w-10 h-10 rounded-[10px]' : 'w-12 h-12 rounded-[12px]';
  const iconInner = isCompact ? 'w-[18px] h-[18px]' : 'w-[22px] h-[22px]';
  const gap = isCompact ? 'gap-3' : 'gap-4';

  return (
    <>
      <div
        data-kbd-item
        className={cn(
          'group relative rounded-xl transition-all duration-120',
          isMobile
            ? 'bg-card border border-border/40 active:scale-[0.97]'
            : 'bg-card/50 border border-border/30 hover:bg-card hover:border-border/50 active:scale-[0.98]',
          isSelected && 'ring-1 ring-primary/30 border-primary/20'
        )}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onClick={handleItemClick}
      >
        {bookmarked && (
          <div className="absolute top-2 right-2 z-10">
            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400 drop-shadow-sm" />
          </div>
        )}
        {selectionMode && (
          <div data-checkbox className="absolute top-2 left-2 z-10" onClick={e => { e.stopPropagation(); onToggleSelect?.(file.id); }}>
            <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect?.(file.id)} className="h-4 w-4 bg-black/40" />
          </div>
        )}
        <div onClick={handleItemClick} className={cn(gridPadding, isMobile && selectionMode && 'pt-8')}>
          {isMobile ? (
            <>
              <div className="flex items-start justify-between mb-2.5">
                <div className={cn(iconSize, 'flex items-center justify-center flex-shrink-0', iconCfg.bg)}>
                  <IconComp className={cn(iconInner, iconCfg.color)} />
                </div>
                {!selectionMode && (
                  <button
                    onClick={e => { e.stopPropagation(); setActionSheetOpen(true); }}
                    className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[#2D333B] transition-colors -mt-0.5 -mr-0.5"
                  >
                    <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate leading-snug" title={file.name}>
                  {file.name}
                </p>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                  <span className="truncate">{formatBytes(file.size)}</span>
                  {file.shared && (
                    <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                      <Share2 className="w-2.5 h-2.5" />
                    </span>
                  )}
                  <span>&middot;</span>
                  <span className="truncate">{formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}</span>
                </div>
              </div>
            </>
          ) : (
            <div className={cn('flex items-start', gap)}>
              <div className={cn(iconSize, 'flex items-center justify-center flex-shrink-0', iconCfg.bg)}>
                <IconComp className={cn(iconInner, iconCfg.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate leading-snug" title={file.name}>
                  {file.name}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                  <span className="truncate">{formatBytes(file.size)}</span>
                  {file.shared && (
                    <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                      <Share2 className="w-2.5 h-2.5" />
                    </span>
                  )}
                  <span>&middot;</span>
                  <span className="truncate">{formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}</span>
                </div>
              </div>
              {!selectionMode && (
                <FileActionMenu
                    file={file} onView={handleView} onShare={handleShare} onViewInfo={onViewInfo}
                    onDelete={handleDelete} onDownload={handleDownload}
                    onMoveToFolder={onMoveToFolder ? () => onMoveToFolder(file) : undefined}
                    onMoveToVault={onMoveToVault} onRemoveFromVault={onRemoveFromVault}
                    showVaultActions={showVaultActions} onShareRevoked={onShareRevoked}
                    onShareChange={onShareChange} onExtract={onExtract ? () => onExtract(file) : undefined}
                    onOpenInCbCode={onOpenInCbCode ? () => onOpenInCbCode(file) : undefined}
                    onNotes={handleNotes}
                    onEmbed={handleEmbed}
                    trigger={menuTrigger()}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      <FileViewer file={fileWithDefaults} open={viewerOpen} onClose={() => setViewerOpen(false)} onDelete={onDelete} onShare={onShare} onDownload={onDownload} />
      <MobileFileActionSheet
        isOpen={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        file={fileWithDefaults}
        onView={handleView}
        onDownload={handleDownload}
        onShare={handleShare}
        onInfo={() => onViewInfo?.(file)}
        onMove={() => onMoveToFolder?.(file)}
        onDelete={handleDelete}
        onOpenInCbCode={onOpenInCbCode ? () => onOpenInCbCode(file) : undefined}
        onExtract={onExtract ? () => onExtract(file) : undefined}
        showVaultActions={showVaultActions}
        onMoveToVault={onMoveToVault ? () => onMoveToVault(file) : undefined}
        onRemoveFromVault={onRemoveFromVault ? () => onRemoveFromVault(file) : undefined}
        isShared={!!file.shared}
        isArchive={/\.(zip|rar|7z|tar|gz|tgz|bz2|tar\.gz|tar\.bz2)$/i.test(file.name)}
        onRevokeShare={handleRevokeShare}
        onManageShares={handleOpenShareManager}
      />
      <ShareManagementDialog open={shareDialogOpen} onOpenChange={setShareDialogOpen} />
      <PublishWebsiteModal
        open={publishModalOpen}
        onOpenChange={setPublishModalOpen}
        resourceId={file.id}
        resourceType="file"
        resourceName={file.name}
      />
      {contextMenu && (
        <UniversalContextMenu
          x={contextMenu.x} y={contextMenu.y} item={file} onClose={closeContextMenu}
          onView={handleView} onDownload={handleDownload} onShare={handleShare}
          onDelete={handleDelete} onInfo={() => onViewInfo?.(file)}
          onPublish={isHtmlFile ? () => setPublishModalOpen(true) : undefined}
          isPublished={isHtmlFile ? pubStatus?.status === 'live' : undefined}
          onNotes={handleNotes}
          onEmbed={handleEmbed}
        />
      )}
    </>
  );
};

export default React.memo(FileItem, (prevProps, nextProps) => {
  return (
    prevProps.file.id === nextProps.file.id &&
    prevProps.file.updated_at === nextProps.file.updated_at &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.selectionMode === nextProps.selectionMode
  );
});

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Folder, MoreHorizontal, Trash2, Star, Palette, FolderOpen, Code2, Share2, AlertTriangle, Globe,
} from '@/lib/icon-map';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub,
  DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EnhancedShareDialog } from '../EnhancedShareDialog';
import UniversalContextMenu from '../UniversalContextMenu';
import { usePublishState } from '@/hooks/usePublish';
import { PublishWebsiteModal } from '../publish/PublishWebsiteModal';

const FOLDER_COLORS = [
  { name: 'Default', value: '' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Cyan', value: '#06b6d4' },
];

interface FolderCardProps {
  folder: { id: string; name: string; path: string; created_at: string };
  viewMode: 'grid' | 'list';
  color?: string;
  isBookmarked?: boolean;
  onOpen: () => void;
  onDelete?: () => void;
  onToggleBookmark: () => void;
  onSetColor: (color: string) => void;
  onOpenInCbCode?: () => void;
}

const MenuDropdown = ({ menuOpen, setMenuOpen, onOpen, onOpenInCbCode, onToggleBookmark, isBookmarked, onSetColor, color, setShowEnhancedShareDialog, onDelete, handleDeleteClick, isPublished, onPublish }: any) => (
  <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
    <DropdownMenuTrigger asChild>
      <button
        className="flex items-center justify-center w-7 h-7 rounded-md text-[#8B949E] hover:bg-[#2D333B] transition-colors duration-160"
        aria-label="Folder actions"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="end"
      className="bg-[#1C2128] border border-[#2D333B] rounded-lg shadow-lg p-1 min-w-[160px] data-[side=bottom]:animate-in data-[side=bottom]:fade-in-0 data-[side=bottom]:slide-in-from-top-1"
      style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
      onClick={e => e.stopPropagation()}
    >
      <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-sm text-[#E6EDF3] focus:bg-[#2D333B] focus:text-[#E6EDF3]" onClick={onOpen}>
        <FolderOpen className="w-4 h-4 text-[#8B949E]" /> Open
      </DropdownMenuItem>
      {onOpenInCbCode && (
        <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-sm text-[#E6EDF3] focus:bg-[#2D333B] focus:text-[#E6EDF3]" onClick={onOpenInCbCode}>
          <Code2 className="w-4 h-4 text-[#8B949E]" /> Open in cbCode
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator className="bg-[#2D333B]" />
      <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-sm text-[#E6EDF3] focus:bg-[#2D333B] focus:text-[#E6EDF3]" onClick={onToggleBookmark}>
        <Star className={cn('w-4 h-4 text-[#8B949E]', isBookmarked && 'fill-yellow-400 text-yellow-400')} />
        {isBookmarked ? 'Unfavorite' : 'Favorite'}
      </DropdownMenuItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="rounded-md gap-2 cursor-pointer text-sm text-[#E6EDF3] focus:bg-[#2D333B] focus:text-[#E6EDF3]">
          <Palette className="w-4 h-4 text-[#8B949E]" /> Set color
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="bg-[#1C2128] border border-[#2D333B] rounded-lg p-1 shadow-lg">
          {FOLDER_COLORS.map(c => (
            <DropdownMenuItem key={c.name} className="rounded-md gap-2.5 cursor-pointer text-sm text-[#E6EDF3] focus:bg-[#2D333B]" onClick={() => onSetColor(c.value)}>
              <div className={cn('w-3.5 h-3.5 rounded-full', !c.value && 'border border-dashed border-[#484F58]')} style={c.value ? { backgroundColor: c.value } : {}} />
              {c.name}{color === c.value && <span className="ml-auto text-[#58A6FF] text-xs">✓</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator className="bg-[#2D333B]" />
      <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-sm text-[#E6EDF3] focus:bg-[#2D333B] focus:text-[#E6EDF3]" onClick={() => { setMenuOpen(false); onPublish?.(); }}>
        <Globe className="w-4 h-4 text-[#8B949E]" />
        {isPublished ? 'Manage Published Site' : 'Publish as Website'}
      </DropdownMenuItem>
      <DropdownMenuSeparator className="bg-[#2D333B]" />
      <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-sm text-[#E6EDF3] focus:bg-[#2D333B] focus:text-[#E6EDF3]" onClick={() => { setMenuOpen(false); setShowEnhancedShareDialog(true); }}>
        <Share2 className="w-4 h-4 text-[#8B949E]" /> Share
      </DropdownMenuItem>
      {onDelete && (
        <>
          <DropdownMenuSeparator className="bg-[#2D333B]" />
          <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-sm text-[#F85149] focus:bg-[#F85149]/10 focus:text-[#F85149]" onClick={handleDeleteClick}>
            <Trash2 className="w-4 h-4 text-[#F85149]" /> Delete
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
);

export const EnterpriseFolderCard: React.FC<FolderCardProps> = ({
  folder, viewMode, color, isBookmarked, onOpen, onDelete, onToggleBookmark, onSetColor, onOpenInCbCode,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showEnhancedShareDialog, setShowEnhancedShareDialog] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const { publication: pubStatus } = usePublishState(!publishModalOpen ? folder.id : null);

  const handleDeleteClick = () => { setMenuOpen(false); setDeleteConfirmOpen(true); };
  const handleDeleteConfirm = () => { setDeleteConfirmOpen(false); onDelete?.(); };
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };
  const closeContextMenu = () => setContextMenu(null);

  const sharedMenuProps = { menuOpen, setMenuOpen, onOpen, onOpenInCbCode, onToggleBookmark, isBookmarked, onSetColor, color, setShowEnhancedShareDialog, onDelete, handleDeleteClick, isPublished: pubStatus?.status === 'live', onPublish: () => setPublishModalOpen(true) };

  if (viewMode === 'list') {
    return (
      <>
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-[10px] cursor-pointer bg-[#161B22] border border-[#2D333B] transition-all duration-160 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[#1C2128] hover:border-[#444C56] hover:shadow-[0_4px_16px_rgba(0,0,0,0.35)] hover:-translate-y-px active:bg-[#222930] active:translate-y-0 active:shadow-none active:duration-80"
          onClick={onOpen}
          onContextMenu={handleContextMenu}
        >
          <div className="w-9 h-9 rounded-[8px] bg-[#2D333B] border border-[#373E47] flex items-center justify-center shrink-0">
            <Folder className="w-[18px] h-[18px] text-[#8B949E]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#E6EDF3] truncate" title={folder.name}>{folder.name}</p>
          </div>
          <span className="text-[12px] text-[#768390] whitespace-nowrap">{formatDistanceToNow(new Date(folder.created_at), { addSuffix: true })}</span>
          {isBookmarked && <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400 shrink-0" />}
          <div className="shrink-0 opacity-0 group-hover:opacity-100" onClick={e => e.stopPropagation()}>
            <MenuDropdown {...sharedMenuProps} />
          </div>
        </div>
        <EnhancedShareDialog open={showEnhancedShareDialog} onClose={() => setShowEnhancedShareDialog(false)} file={{ ...folder, type: 'folder' }} />
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete folder?</AlertDialogTitle>
              <AlertDialogDescription><strong>{folder.name}</strong> and all its contents will be permanently deleted.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {contextMenu && (
          <UniversalContextMenu
            x={contextMenu.x} y={contextMenu.y}
            item={{ ...folder, type: 'folder' }}
            onClose={closeContextMenu}
            onView={onOpen}
            onDelete={handleDeleteClick}
            onShare={() => { closeContextMenu(); setShowEnhancedShareDialog(true); }}
            onPublish={() => setPublishModalOpen(true)}
            isPublished={pubStatus?.status === 'live'}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div
        className="relative rounded-[10px] cursor-pointer bg-[#161B22] border border-[#2D333B] transition-all duration-160 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[#1C2128] hover:border-[#444C56] hover:shadow-[0_4px_16px_rgba(0,0,0,0.35)] hover:-translate-y-px active:bg-[#222930] active:translate-y-0 active:shadow-none active:duration-80"
        onClick={onOpen}
        onContextMenu={handleContextMenu}
      >
        {isBookmarked && (
          <div className="absolute top-2.5 right-2.5 z-10">
            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400 drop-shadow-sm" />
          </div>
        )}
        <div className="p-[14px_16px]">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-[10px] bg-[#2D333B] border border-[#373E47] flex items-center justify-center shrink-0">
              <Folder className="w-[22px] h-[22px] text-[#8B949E]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[#E6EDF3] leading-snug line-clamp-2" title={folder.name}>{folder.name}</p>
              <p className="text-[12px] text-[#768390] mt-[3px]">{formatDistanceToNow(new Date(folder.created_at), { addSuffix: true })}</p>
            </div>
            <div className="shrink-0 opacity-0 group-hover:opacity-100 absolute top-2 right-2" onClick={e => e.stopPropagation()}>
              <MenuDropdown {...sharedMenuProps} />
            </div>
          </div>
        </div>
      </div>
      <EnhancedShareDialog open={showEnhancedShareDialog} onClose={() => setShowEnhancedShareDialog(false)} file={{ ...folder, type: 'folder' }} />
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription><strong>{folder.name}</strong> and all its contents will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {contextMenu && (
        <UniversalContextMenu
          x={contextMenu.x} y={contextMenu.y}
          item={{ ...folder, type: 'folder' }}
          onClose={closeContextMenu}
          onView={onOpen}
          onDelete={handleDeleteClick}
          onShare={() => { closeContextMenu(); setShowEnhancedShareDialog(true); }}
          onPublish={() => setPublishModalOpen(true)}
          isPublished={pubStatus?.status === 'live'}
        />
      )}

      <PublishWebsiteModal
        open={publishModalOpen}
        onOpenChange={setPublishModalOpen}
        resourceId={folder.id}
        resourceType="folder"
        resourceName={folder.name}
      />
    </>
  );
};

export default EnterpriseFolderCard;

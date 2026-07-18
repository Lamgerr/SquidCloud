import React, { useState, useRef, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Folder, MoreVertical, Share2, Trash2, Pencil, Download, Move, Plus, ChevronDown, MessageSquare } from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogContent,
} from '@/components/ui/alert-dialog';
import { FolderItem } from '@/lib/api';

interface FolderRowProps {
  folder: FolderItem;
  selected?: boolean;
  viewMode?: 'grid' | 'list' | 'compact';
  onOpen: () => void;
  onDelete?: () => void;
  onRename?: (name: string) => void;
  onMove?: () => void;
  onDownload?: () => void;
  onNotes?: () => void;
}

const FolderRow: React.FC<FolderRowProps> = ({
  folder, selected, viewMode = 'list', onOpen, onDelete, onRename, onMove, onDownload, onNotes
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  const handleRenameConfirm = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== folder.name) onRename?.(trimmed);
    setRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRenameConfirm();
    if (e.key === 'Escape') { setRenameValue(folder.name); setRenaming(false); }
  };

  const handleDeleteClick = () => { setMenuOpen(false); setDeleteConfirmOpen(true); };

  const isGrid = viewMode === 'grid' || viewMode === 'compact';

  return (
    <>
      {isGrid ? (
        <div
          data-kbd-item
          className={cn(
            'group relative flex flex-col items-center p-3.5 rounded-2xl cursor-pointer transition-all duration-150 select-none border border-transparent',
            'bg-[#1a1a24]/40 hover:bg-white/[0.05] active:scale-[0.98]',
            selected && 'bg-[#007AFF]/15 border-[#007AFF]/50 shadow-[0_0_15px_rgba(0,122,255,0.15)]'
          )}
          onClick={onOpen}
          onDoubleClick={() => setRenaming(true)}
          role="gridcell"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
        >
          <div className="relative w-16 h-12 mb-2.5 transition-transform duration-200 group-hover:-translate-y-0.5">
            <div className="absolute inset-0 bg-gradient-to-b from-[#3a8dff] via-[#1a6eff] to-[#0a4ed9] rounded-xl shadow-md border border-[#63a4ff]/40 flex items-center justify-center">
              <div className="absolute -top-1.5 left-1.5 w-5 h-2 bg-gradient-to-t from-[#3a8dff] to-[#63a4ff] rounded-t-md border-t border-l border-[#8bc0ff]/50" />
              <Folder className="w-5 h-5 text-white/30" />
            </div>
          </div>

          <div className="w-full text-center min-w-0 px-1">
            {renaming ? (
              <input
                ref={inputRef}
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={handleRenameConfirm}
                onKeyDown={handleRenameKeyDown}
                className="bg-neutral-900 border border-[#007AFF] rounded px-1.5 py-0.5 text-xs text-white text-center w-full outline-none shadow-sm"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="text-xs font-medium text-neutral-200 block truncate tracking-tight" title={folder.name}>
                {(folder as any).shared && <Share2 className="w-3 h-3 text-[#007AFF] inline-flex mr-1 -mt-0.5" />}
                {folder.name}
              </span>
            )}
            <p className="text-[10px] text-neutral-500 font-mono mt-0.5 block truncate">
              {formatDistanceToNow(new Date(folder.created_at), { addSuffix: true })}
            </p>
          </div>

          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-white/10 transition-colors">
                  <MoreVertical className="w-3.5 h-3.5 text-neutral-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 p-1 bg-[#1a1a24] border-white/10 text-white shadow-2xl">
                <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-xs" onClick={() => { setMenuOpen(false); setRenaming(true); }}>
                  <Pencil className="w-3.5 h-3.5" />Rename
                </DropdownMenuItem>
                {onMove && (
                  <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-xs" onClick={() => { setMenuOpen(false); onMove(); }}>
                    <Move className="w-3.5 h-3.5" />Move
                  </DropdownMenuItem>
                )}
                {onDownload && (
                  <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-xs" onClick={() => { setMenuOpen(false); onDownload(); }}>
                    <Download className="w-3.5 h-3.5" />Download
                  </DropdownMenuItem>
                )}
                {onNotes && (
                  <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-xs" onClick={() => { setMenuOpen(false); onNotes(); }}>
                    <MessageSquare className="w-3.5 h-3.5" />Notes
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-xs text-red-400 focus:text-red-300 focus:bg-red-500/10" onClick={handleDeleteClick}>
                  <Trash2 className="w-3.5 h-3.5" />Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ) : (
        <div
          data-kbd-item
          className={cn(
            'group grid grid-cols-[1fr_100px_140px_36px] md:grid-cols-[1fr_110px_150px_100px_36px] items-center px-4 h-11 rounded-xl cursor-pointer transition-all duration-100 select-none border border-transparent',
            'bg-card/40 hover:bg-white/[0.04]',
            selected && 'bg-[#007AFF]/15 border-[#007AFF]/40 text-white shadow-sm'
          )}
          onClick={onOpen}
          onDoubleClick={() => setRenaming(true)}
          role="row"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
        >
          <div className="flex items-center gap-3 min-w-0 pr-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-b from-[#3a8dff] to-[#0a4ed9] border border-[#63a4ff]/30 flex items-center justify-center shrink-0 shadow-sm">
              <Folder className="w-3.5 h-3.5 text-white" />
            </div>

            <div className="min-w-0 flex-1">
              {renaming ? (
                <input
                  ref={inputRef}
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={handleRenameConfirm}
                  onKeyDown={handleRenameKeyDown}
                  className="bg-neutral-900 border border-[#007AFF] rounded px-2 py-0.5 text-sm text-white w-full outline-none"
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span className="text-[13px] font-medium text-neutral-200 block truncate" title={folder.name}>
                  {(folder as any).shared && <Share2 className="w-3 h-3 text-[#007AFF] inline-flex mr-1.5 -mt-0.5" />}
                  {folder.name}
                </span>
              )}
            </div>
          </div>

          <span className="text-xs text-neutral-400 hidden md:block uppercase tracking-wider font-mono text-[11px]">
            Folder
          </span>

          <span className="text-xs text-neutral-400 truncate">
            {formatDistanceToNow(new Date(folder.created_at), { addSuffix: true })}
          </span>

          <span className="text-xs text-neutral-500 font-mono">--</span>

          <div className="flex justify-end shrink-0" onClick={e => e.stopPropagation()}>
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-white/10 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                  aria-label="Folder actions"
                >
                  <MoreVertical className="w-4 h-4 text-neutral-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 p-1 bg-[#1a1a24] border-white/10 text-white shadow-2xl">
                <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-xs" onClick={() => { setMenuOpen(false); setRenaming(true); }}>
                  <Pencil className="w-3.5 h-3.5" />Rename
                </DropdownMenuItem>
                {onMove && (
                  <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-xs" onClick={() => { setMenuOpen(false); onMove(); }}>
                    <Move className="w-3.5 h-3.5" />Move
                  </DropdownMenuItem>
                )}
                {onDownload && (
                  <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-xs" onClick={() => { setMenuOpen(false); onDownload(); }}>
                    <Download className="w-3.5 h-3.5" />Download
                  </DropdownMenuItem>
                )}
                {onNotes && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="rounded-md gap-2 cursor-pointer text-xs">
                      <span>Additional</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-44 p-1 bg-[#1a1a24] border-white/10 text-white shadow-2xl">
                      <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-xs" onClick={() => { setMenuOpen(false); onNotes(); }}>
                        <MessageSquare className="w-3.5 h-3.5" />Notes
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-xs text-red-400 focus:text-red-300 focus:bg-red-500/10" onClick={handleDeleteClick}>
                  <Trash2 className="w-3.5 h-3.5" />Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription className="text-neutral-400">
              <strong className="text-white">{folder.name}</strong> and all its contents will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10 text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setDeleteConfirmOpen(false); onDelete?.(); }} className="bg-red-600 text-white hover:bg-red-500">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

interface FolderListViewProps {
  folders: FolderItem[];
  loading: boolean;
  selectedId?: string;
  viewMode?: 'grid' | 'list' | 'compact';
  onOpen: (folder: FolderItem) => void;
  onDelete?: (folder: FolderItem) => void;
  onRename?: (folder: FolderItem, name: string) => void;
  onMove?: (folder: FolderItem) => void;
  onDownload?: (folder: FolderItem) => void;
  onCreateFolder?: () => void;
}

export const FolderListView: React.FC<FolderListViewProps> = ({
  folders, loading, selectedId, viewMode = 'list', onOpen, onDelete, onRename, onMove, onDownload, onCreateFolder
}) => {
  const [expanded, setExpanded] = useState(true);
  const showEmpty = !loading && folders.length === 0;

  return (
    <section>
      <div className="flex items-center justify-between px-1 pb-2">
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="flex items-center gap-1.5 select-none"
        >
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 text-neutral-500 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
              !expanded && '-rotate-90'
            )}
          />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Folders</h2>
          {folders.length > 0 && (
            <span className="text-[11px] text-neutral-400 bg-white/[0.06] px-[7px] py-[1px] rounded-[10px]">
              {folders.length}
            </span>
          )}
        </button>
        <button
          onClick={onCreateFolder}
          className="flex items-center justify-center w-7 h-7 rounded-md text-neutral-500 hover:bg-white/10 hover:text-white transition-colors"
          aria-label="New Folder"
          title="New Folder"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        className={cn(
          'overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          expanded ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          maxHeight: expanded ? (loading ? 400 : folders.length > 0 ? folders.length * 76 + 200 : 400) : 0,
        }}
      >
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-[14px_16px] bg-card/40 border border-white/5 rounded-xl animate-pulse">
                <div className="w-8 h-8 rounded-lg bg-white/5 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-[40%] rounded bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        )}

        {showEmpty && (
          <div className="flex flex-col items-center justify-center min-h-[200px] px-4 py-8">
            <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center mb-3">
              <Plus className="w-6 h-6 text-neutral-500" />
            </div>
            <h3 className="text-[14px] font-semibold text-white mb-1">No folders yet</h3>
            <p className="text-[12px] text-neutral-400 mb-4 text-center">Create a folder to organize your files</p>
            <Button size="sm" className="rounded-lg bg-[#007AFF] hover:bg-[#0062cc] text-white" onClick={onCreateFolder}>New folder</Button>
          </div>
        )}

        {!loading && folders.length > 0 && (
          <div className={cn(viewMode === 'grid' || viewMode === 'compact' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3' : 'space-y-0.5', 'stagger-card')}>
            {folders.map(f => (
              <FolderRow
                key={f.id}
                folder={f}
                viewMode={viewMode}
                selected={f.id === selectedId}
                onOpen={() => onOpen(f)}
                onDelete={() => onDelete?.(f)}
                onRename={(name) => onRename?.(f, name)}
                onMove={() => onMove?.(f)}
                onDownload={() => onDownload?.(f)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default FolderRow;

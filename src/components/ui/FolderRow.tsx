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
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
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

  const isGrid = viewMode === 'grid';
  const isCompact = viewMode === 'compact';

  return (
    <>
      {isGrid ? (
        <div
          data-kbd-item
          className={cn(
            'group flex flex-col p-3 rounded-xl cursor-pointer transition-all duration-150',
            'bg-card border border-border/40',
            'hover:bg-card/80 hover:border-border/60',
            'active:scale-[0.97]',
            selected && 'ring-1 ring-primary/30 border-primary/20'
          )}
          onClick={onOpen}
          onDoubleClick={() => setRenaming(true)}
          role="gridcell"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
        >
          <div className="flex items-start justify-between mb-2.5">
            <div className="w-11 h-11 rounded-xl bg-muted/60 border border-border/40 flex items-center justify-center shrink-0">
              <Folder className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="shrink-0" onClick={e => e.stopPropagation()}>
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-muted/60 focus-visible:outline-none transition-colors"
                    aria-label="Folder actions"
                  >
                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 p-1">
                  <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-sm" onClick={() => { setMenuOpen(false); setRenaming(true); }}>
                    <Pencil className="w-4 h-4" />Rename
                  </DropdownMenuItem>
                  {onMove && (
                    <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-sm" onClick={() => { setMenuOpen(false); onMove(); }}>
                      <Move className="w-4 h-4" />Move
                    </DropdownMenuItem>
                  )}
                  {onDownload && (
                    <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-sm" onClick={() => { setMenuOpen(false); onDownload(); }}>
                      <Download className="w-4 h-4" />Download
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-border/50" />
                  <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-sm text-destructive focus:text-destructive focus:bg-destructive/10" onClick={handleDeleteClick}>
                    <Trash2 className="w-4 h-4" />Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="min-w-0">
            {renaming ? (
              <input
                ref={inputRef}
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={handleRenameConfirm}
                onKeyDown={handleRenameKeyDown}
                className="bg-transparent border-b border-muted-foreground text-sm font-medium outline-none w-full"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="text-sm font-medium text-foreground block truncate" title={folder.name}>
                {(folder as any).shared && <Share2 className="w-3 h-3 text-primary inline-flex mr-1 -mt-0.5" />}
                {folder.name}
              </span>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Modified {formatDistanceToNow(new Date(folder.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
      ) : (
        <div
          data-kbd-item
          className={cn(
            'group flex items-center gap-3 p-[14px_16px] rounded-[10px] cursor-pointer transition-all duration-150',
            'bg-card border border-border/30',
            'hover:bg-card/80 hover:border-border/50',
            'active:scale-[0.99]',
            selected && 'ring-1 ring-primary/30 border-primary/20'
          )}
          onClick={onOpen}
          onDoubleClick={() => setRenaming(true)}
          role="row"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
        >
          <div className={cn(
            'rounded-[10px] bg-muted/40 border border-border/30 flex items-center justify-center shrink-0',
            isCompact ? 'w-9 h-9' : 'w-11 h-11'
          )}>
            <Folder className={cn('text-muted-foreground', isCompact ? 'w-[18px] h-[18px]' : 'w-[22px] h-[22px]')} />
          </div>

          <div className="min-w-0 flex-1">
            {renaming ? (
              <input
                ref={inputRef}
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={handleRenameConfirm}
                onKeyDown={handleRenameKeyDown}
                className="bg-transparent border-b border-muted-foreground text-foreground text-[15px] font-medium outline-none w-full"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className={cn('text-foreground block truncate', isCompact ? 'text-[14px]' : 'text-[15px] font-medium')} title={folder.name}>
                {(folder as any).shared && <Share2 className="w-3.5 h-3.5 text-primary inline-flex mr-1.5 -mt-0.5" />}
                {folder.name}
              </span>
            )}
            <p className="text-xs text-muted-foreground mt-[3px]">
              Modified {formatDistanceToNow(new Date(folder.created_at), { addSuffix: true })}
            </p>
          </div>

          <div className="shrink-0" onClick={e => e.stopPropagation()}>
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-accent/50 focus-visible:outline-none transition-colors"
                  aria-label="Folder actions"
                >
                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 p-1">
                <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-sm" onClick={() => { setMenuOpen(false); setRenaming(true); }}>
                  <Pencil className="w-4 h-4" />Rename
                </DropdownMenuItem>
                {onMove && (
                  <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-sm" onClick={() => { setMenuOpen(false); onMove(); }}>
                    <Move className="w-4 h-4" />Move
                  </DropdownMenuItem>
                )}
                {onDownload && (
                  <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-sm" onClick={() => { setMenuOpen(false); onDownload(); }}>
                    <Download className="w-4 h-4" />Download
                  </DropdownMenuItem>
                )}
                {onNotes && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="rounded-md gap-2 cursor-pointer text-sm">
                      <span>Additional</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-44 p-1">
                      <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-sm" onClick={() => { setMenuOpen(false); onNotes(); }}>
                        <MessageSquare className="w-4 h-4" />Notes
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                <DropdownMenuSeparator className="bg-border/50" />
                <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-sm text-destructive focus:text-destructive focus:bg-destructive/10" onClick={handleDeleteClick}>
                  <Trash2 className="w-4 h-4" />Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{folder.name}</strong> and all its contents will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setDeleteConfirmOpen(false); onDelete?.(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
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
          className="flex items-center gap-1.5"
        >
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 text-muted-foreground/60 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
              !expanded && '-rotate-90'
            )}
          />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Folders</h2>
          {folders.length > 0 && (
            <span className="text-[11px] text-muted-foreground bg-muted/60 px-[7px] py-[1px] rounded-[10px]">
              {folders.length}
            </span>
          )}
        </button>
        <button
          onClick={onCreateFolder}
          className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground/60 hover:bg-accent/50 hover:text-foreground transition-colors"
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
            <div key={i} className="flex items-center gap-3 p-[14px_16px] bg-card border border-border/30 rounded-[10px]">
              <div className="w-11 h-11 rounded-[10px] bg-muted/30 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-[60%] rounded bg-muted/30 animate-pulse" />
                <div className="h-2.5 w-[30%] rounded bg-muted/20 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {showEmpty && (
        <div className="flex flex-col items-center justify-center min-h-[240px] px-4 py-12">
          <div className="w-12 h-12 rounded-xl bg-muted/40 border border-border/30 flex items-center justify-center mb-4">
            <Plus className="w-6 h-6 text-muted-foreground/60" />
          </div>
          <h3 className="text-[15px] font-semibold text-foreground mb-1">No folders yet</h3>
          <p className="text-[13px] text-muted-foreground mb-4 text-center">Create a folder to get started</p>
          <Button size="sm" className="rounded-lg" onClick={onCreateFolder}>New folder</Button>
        </div>
      )}

      {!loading && folders.length > 0 && (
        <div className={cn(viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5' : 'space-y-2', 'stagger-card')}>
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

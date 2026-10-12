import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Folder, ChevronRight, ArrowLeft, Home, Check } from '@/lib/icon-map';
import { type FolderItem } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { emitWebhookEvent } from '@/lib/webhook-events';

interface MoveToFolderDialogProps {
  open: boolean;
  onClose: () => void;
  fileIds: string[];
  onMoved: () => void;
  /** Moving a folder instead of files: blocks moving into itself or its descendants. */
  folderId?: string | null;
}

export const MoveToFolderDialog: React.FC<MoveToFolderDialogProps> = ({
  open, onClose, fileIds, onMoved, folderId = null,
}) => {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [pathHistory, setPathHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    loadFolders('');
    setCurrentPath('');
    setPathHistory([]);
  }, [open]);

  // Build the set of paths that belong to the folder being moved (itself +
  // every descendant) so they can never be offered as a destination.
  const loadDescendantPaths = async (): Promise<Set<string>> => {
    if (!folderId) return new Set();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Set();
    const { data, error } = await supabase
      .from('folders')
      .select('id, path, parent_folder')
      .eq('user_id', user.id);
    if (error || !data) return new Set();
    const rows = data as any[];
    const pathById = new Map<string, string>(rows.map(r => [r.id, r.path]));
    const isDescendant = (id: string): boolean => {
      let cur: any = rows.find(r => r.id === id);
      let guard = 0;
      while (cur && guard++ < 1000) {
        if (cur.id === folderId) return true;
        cur = cur.parent_folder ? rows.find(r => r.id === cur.parent_folder) : null;
      }
      return false;
    };
    return new Set(rows.filter(r => isDescendant(r.id)).map(r => r.path));
  };

  const loadFolders = async (parentPath: string) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      if (error) throw error;
      const blocked = await loadDescendantPaths();
      const filtered = (data || []).filter((f: any) => {
        if (!parentPath) return !f.parent_folder || f.parent_folder === '';
        return f.parent_folder === parentPath;
      }).filter((f: any) => !blocked.has(f.path));
      setFolders(filtered.map((f: any) => ({
        id: f.id, name: f.name, path: f.path,
        created_at: f.created_at, is_folder: true,
        parent_folder: f.parent_folder, user_id: f.user_id,
      })));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = (folder: FolderItem) => {
    setPathHistory(prev => [...prev, currentPath]);
    const newPath = currentPath ? `${currentPath}/${folder.name}` : folder.name;
    setCurrentPath(newPath);
    loadFolders(newPath);
  };

  const handleGoUp = () => {
    const prev = pathHistory[pathHistory.length - 1] || '';
    setPathHistory(prev => prev.slice(0, -1));
    setCurrentPath(prev);
    loadFolders(prev);
  };

  const handleGoRoot = () => {
    setPathHistory([]);
    setCurrentPath('');
    loadFolders('');
  };

  const handleMove = async () => {
    setMoving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      if (!fileIds.length && !folderId) throw new Error('Nothing to move');
      const targetPath = currentPath || null;
      for (const fileId of fileIds) {
        const { error } = await supabase
          .from('files')
          .update({ parent_folder: targetPath })
          .eq('id', fileId)
          .eq('user_id', user.id);
        if (error) throw error;
      }
      if (folderId) {
        // Re-point the folder row and its children so the whole subtree travels.
        const folderName = (await supabase
          .from('folders').select('name').eq('id', folderId).single()).data?.name as string;
        const oldPath = (await supabase
          .from('folders').select('path').eq('id', folderId).single()).data?.path as string;
        const newPath = targetPath ? `${targetPath}/${folderName}` : folderName;
        const { error: folderErr } = await supabase
          .from('folders')
          .update({ parent_folder: targetPath || null, path: newPath })
          .eq('id', folderId);
        if (folderErr) throw folderErr;
        if (oldPath) {
          const { data: children } = await supabase
            .from('folders').select('id, path').eq('user_id', user.id);
          const toUpdate = (children || []).filter((c: any) => c.path.startsWith(`${oldPath}/`));
          for (const c of toUpdate) {
            const rel = c.path.slice(oldPath.length);
            await supabase.from('folders').update({ path: `${newPath}${rel}` }).eq('id', c.id);
          }
        }
      }
      for (const fileId of fileIds) {
        void emitWebhookEvent('file.moved', {
          file_id: fileId,
          old_folder_id: null,
          new_folder_id: targetPath,
          moved_by: user.id,
        });
      }
      toast({
        title: 'Moved',
        description: `${fileIds.length} file${fileIds.length > 1 ? 's' : ''} moved${currentPath ? ` to "${currentPath}"` : ' to root'}`,
      });
      onMoved();
      onClose();
    } catch (err: any) {
      toast({ title: 'Move failed', description: err.message, variant: 'destructive' });
    } finally {
      setMoving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Move to folder</DialogTitle>
          <DialogDescription>
            Select a destination folder for {fileIds.length ? `${fileIds.length} file${fileIds.length > 1 ? 's' : ''}` : 'this folder'}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2 px-0.5">
          <button onClick={handleGoRoot} className="hover:text-foreground transition-colors"><Home className="w-3.5 h-3.5" /></button>
          {currentPath.split('/').filter(Boolean).map((part, i, arr) => (
            <React.Fragment key={i}>
              <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
              <span className={i === arr.length - 1 ? 'text-foreground font-medium' : ''}>{part}</span>
            </React.Fragment>
          ))}
        </div>

        {pathHistory.length > 0 && (
          <button onClick={handleGoUp} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-0.5 py-1 rounded-lg hover:bg-accent/50 transition-colors">
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
        )}

        <div className="max-h-48 overflow-y-auto space-y-0.5 -mx-1">
          {loading ? (
            <p className="text-xs text-muted-foreground px-2 py-4 text-center">Loading folders...</p>
          ) : folders.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-4 text-center">
              {currentPath ? 'This folder is empty' : 'No folders yet. Create one first.'}
            </p>
          ) : (
            folders.map(folder => (
              <button
                key={folder.id}
                onClick={() => handleFolderClick(folder)}
                className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm hover:bg-accent/50 transition-colors text-left group"
              >
                <Folder className="w-4 h-4 text-primary/60 flex-shrink-0" />
                <span className="flex-1 truncate">{folder.name}</span>
                <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors flex-shrink-0" />
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/20 mt-2">
          <span className="text-xs text-muted-foreground">
            Target: <span className="font-mono text-foreground/60">{currentPath || 'Root'}</span>
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleMove} disabled={moving || loading} className="gap-1.5">
              {moving ? 'Moving...' : <><Check className="w-3.5 h-3.5" /> Move</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MoveToFolderDialog;

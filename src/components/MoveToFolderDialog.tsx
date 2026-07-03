import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Folder, ChevronRight, ArrowLeft, Home, Check } from '@/lib/icon-map';
import { type FolderItem } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MoveToFolderDialogProps {
  open: boolean;
  onClose: () => void;
  fileIds: string[];
  onMoved: () => void;
}

export const MoveToFolderDialog: React.FC<MoveToFolderDialogProps> = ({
  open, onClose, fileIds, onMoved,
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
      const filtered = (data || []).filter((f: any) => {
        if (!parentPath) return !f.parent_folder || f.parent_folder === '';
        return f.parent_folder === parentPath;
      });
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
      const targetPath = currentPath || null;
      for (const fileId of fileIds) {
        const { error } = await supabase
          .from('files')
          .update({ parent_folder: targetPath })
          .eq('id', fileId)
          .eq('user_id', user.id);
        if (error) throw error;
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
            Select a destination folder for {fileIds.length} file{fileIds.length > 1 ? 's' : ''}.
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

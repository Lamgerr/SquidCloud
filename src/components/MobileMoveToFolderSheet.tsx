import React, { useState, useEffect } from 'react';
import MobileSheet from '@/components/ui/MobileSheet';
import { Folder, ChevronRight, ArrowLeft, Home, Check } from '@/lib/icon-map';
import { type FolderItem } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { emitWebhookEvent } from '@/lib/webhook-events';

interface MobileMoveToFolderSheetProps {
  open: boolean;
  onClose: () => void;
  fileIds: string[];
  onMoved: () => void;
  type?: 'file' | 'folder';
}

const MobileMoveToFolderSheet: React.FC<MobileMoveToFolderSheetProps> = ({
  open, onClose, fileIds, onMoved, type = 'file',
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
      const table = type === 'folder' ? 'folders' : 'files';
      for (const id of fileIds) {
        const { error } = await supabase
          .from(table)
          .update({ parent_folder: targetPath })
          .eq('id', id)
          .eq('user_id', user.id);
        if (error) throw error;
      }
      if (type === 'file') {
        for (const fileId of fileIds) {
          void emitWebhookEvent('file.moved', {
            file_id: fileId,
            old_folder_id: null,
            new_folder_id: targetPath,
            moved_by: user.id,
          });
        }
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
    <MobileSheet
      open={open}
      onOpenChange={onClose}
      title="Move to folder"
      subtitle={`Select a destination for ${fileIds.length} file${fileIds.length > 1 ? 's' : ''}`}
    >
      <div className="px-5 py-3">
        <div className="flex items-center gap-1.5 text-xs text-[#768390] mb-2.5">
          <button onClick={handleGoRoot} className="hover:text-[#E6EDF3] transition-colors"><Home className="w-3.5 h-3.5" /></button>
          {currentPath.split('/').filter(Boolean).map((part, i, arr) => (
            <React.Fragment key={i}>
              <ChevronRight className="w-3 h-3 text-[#768390]/40" />
              <span className={i === arr.length - 1 ? 'text-[#E6EDF3] font-medium' : 'text-[#768390]'}>{part}</span>
            </React.Fragment>
          ))}
        </div>

        {pathHistory.length > 0 && (
          <button
            onClick={handleGoUp}
            className="flex items-center gap-1.5 text-xs text-[#768390] hover:text-[#E6EDF3] px-0.5 py-2 rounded-lg w-full transition-colors"
          >
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
        )}
      </div>

      <div className="max-h-52 overflow-y-auto px-2 pb-2">
        {loading ? (
          <p className="text-xs text-[#768390] py-6 text-center">Loading folders...</p>
        ) : folders.length === 0 ? (
          <p className="text-xs text-[#768390] py-6 text-center">
            {currentPath ? 'This folder is empty' : 'No folders yet. Create one first.'}
          </p>
        ) : (
          <div className="space-y-0.5">
            {folders.map(folder => (
              <button
                key={folder.id}
                onClick={() => handleFolderClick(folder)}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-[#E6EDF3] hover:bg-[#2D333B] transition-colors text-left group"
              >
                <Folder className="w-4 h-4 text-[#58A6FF] shrink-0" />
                <span className="flex-1 truncate">{folder.name}</span>
                <ChevronRight className="w-3 h-3 text-[#768390]/30 group-hover:text-[#768390]/60 transition-colors shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-t border-[#2D333B] mt-1">
        <span className="text-xs text-[#768390]">
          Target: <span className="font-mono text-[#E6EDF3]/60">{currentPath || 'Root'}</span>
        </span>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="h-8 px-3.5 rounded-lg text-xs font-medium text-[#768390] hover:text-[#E6EDF3] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={moving || loading}
            className="h-8 px-3.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {moving ? 'Moving...' : <><Check className="w-3.5 h-3.5" /> Move</>}
          </button>
        </div>
      </div>
    </MobileSheet>
  );
};

export default MobileMoveToFolderSheet;

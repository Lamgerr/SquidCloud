import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Trash2, RotateCcw, Clock, AlertTriangle, HardDrive, AlertCircle } from '@/lib/icon-map';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getActiveWorkspaceId } from '@/lib/api';

interface TrashedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  deleted_at: string;
  original_parent_folder: string;
}

interface TrashTabProps {
  workspaceId?: string | null;
}

const TrashTab: React.FC<TrashTabProps> = ({ workspaceId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [trashedFiles, setTrashedFiles] = useState<TrashedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const activeWorkspaceId = workspaceId ?? getActiveWorkspaceId();

  useEffect(() => {
    if (user) {
      fetchTrashedFiles();
    }
  }, [user, activeWorkspaceId]);

  const fetchTrashedFiles = async () => {
    try {
      let query: any = supabase
        .from('files')
        .select('id, name, type, size, deleted_at, original_parent_folder')
        .eq('is_deleted', true)
        .order('deleted_at', { ascending: false });

      if (activeWorkspaceId) {
        query = query.eq('workspace_id', activeWorkspaceId);
      } else {
        query = query.eq('user_id', user?.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTrashedFiles(data || []);
    } catch (error) {
      console.error('Error fetching trashed files:', error);
      toast({
        title: "Error",
        description: "Failed to load trashed files.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const restoreFile = async (fileId: string) => {
    try {
      const { error } = await supabase.rpc('restore_from_trash', {
        file_uuid: fileId
      });

      if (error) throw error;

      toast({
        title: "File Restored",
        description: "File has been restored to its original location.",
      });

      fetchTrashedFiles();
    } catch (error) {
      console.error('Error restoring file:', error);
      toast({
        title: "Error",
        description: "Failed to restore file.",
        variant: "destructive",
      });
    }
  };

  const permanentDelete = async (fileId: string) => {
    try {
      const { error } = await supabase
        .from('files')
        .delete()
        .eq('id', fileId);

      if (error) throw error;

      toast({
        title: "File Permanently Deleted",
        description: "File has been permanently removed.",
      });

      fetchTrashedFiles();
    } catch (error) {
      console.error('Error permanently deleting file:', error);
      toast({
        title: "Error",
        description: "Failed to permanently delete file.",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getDaysUntilDeletion = (deletedAt: string) => {
    const deleteDate = new Date(deletedAt);
    const expiryDate = new Date(deleteDate.getTime() + (30 * 24 * 60 * 60 * 1000));
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const totalSize = trashedFiles.reduce((acc, f) => acc + (f.size || 0), 0);

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent border border-red-500/20 p-5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/15 text-red-400 shadow-sm">
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Trash</h1>
              <p className="mt-0.5 text-sm text-white/50">Files auto-delete after 30 days</p>
            </div>
          </div>
          {trashedFiles.length > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 px-3 py-1.5">
              <Trash2 className="h-3.5 w-3.5 text-red-400" />
              <span className="text-sm font-medium text-white">{trashedFiles.length} files</span>
            </div>
          )}
        </div>
      </div>

      {trashedFiles.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl bg-white/[0.06] border border-white/10 px-4 py-2.5 flex-1">
            <HardDrive className="h-4 w-4 text-white/50" />
            <span className="text-[13px] text-white/50">Reclaimable:</span>
            <span className="text-sm font-semibold text-white">{formatFileSize(totalSize)}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm(`Permanently delete all ${trashedFiles.length} files? This cannot be undone.`)) {
                trashedFiles.forEach(f => permanentDelete(f.id));
              }
            }}
            className="gap-2 rounded-xl border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          >
            <AlertCircle className="h-4 w-4" />
            Empty Trash
          </Button>
        </div>
      )}

      {trashedFiles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-12 text-center backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06] border border-white/10">
              <Trash2 className="h-7 w-7 text-white/30" />
            </div>
            <div>
              <h3 className="text-base font-medium text-white/70">Trash is empty</h3>
              <p className="mt-1 text-sm text-white/40">Deleted files appear here and can be restored within 30 days.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {trashedFiles.map((file) => {
            const daysLeft = getDaysUntilDeletion(file.deleted_at);
            const isExpiringSoon = daysLeft <= 7;

            return (
              <div key={file.id} className={cn(
                'rounded-2xl bg-white/[0.04] border backdrop-blur-sm p-4 transition-all hover:bg-white/[0.06]',
                isExpiringSoon ? 'border-red-500/25' : 'border-white/10'
              )}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'h-2 w-2 rounded-full flex-shrink-0',
                        isExpiringSoon ? 'bg-red-400' : 'bg-white/20'
                      )} />
                      <h3 className="text-[15px] font-medium text-white truncate">
                        {file.name.length > 30 ? `${file.name.slice(0, 30)}...` : file.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 ml-4">
                      <span className="text-[12px] text-white/40">{formatFileSize(file.size)}</span>
                      <span className="text-[12px] text-white/30">•</span>
                      <span className="text-[12px] text-white/40">Deleted {format(new Date(file.deleted_at), 'MMM d')}</span>
                      <span className="text-[12px] text-white/30">•</span>
                      <span className="text-[12px] text-white/40">From: {file.original_parent_folder || 'Root'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isExpiringSoon ? (
                      <Badge className="bg-red-500/15 text-red-400 border-red-500/30 rounded-full px-2.5">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {daysLeft}d left
                      </Badge>
                    ) : (
                      <Badge className="bg-white/[0.06] text-white/50 border-white/10 rounded-full px-2.5">
                        <Clock className="h-3 w-3 mr-1" />
                        {daysLeft}d left
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => restoreFile(file.id)}
                      className="h-8 gap-1.5 rounded-xl bg-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.1] border border-white/10"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span className="text-xs">Restore</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('Permanently delete this file? This cannot be undone.')) {
                          permanentDelete(file.id);
                        }
                      }}
                      className="h-8 gap-1.5 rounded-xl text-red-400/60 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="text-xs">Delete</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TrashTab;
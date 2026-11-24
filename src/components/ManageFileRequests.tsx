import React, { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  getMyFileRequests, toggleFileRequest, deleteFileRequest, getFileRequestSubmissions, downloadFile,
} from '@/lib/api';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Inbox, Copy, ExternalLink, Trash2, Eye, Download, Move, Loader2, Calendar } from '@/lib/icon-map';
import { formatDistanceToNow } from 'date-fns';
import { formatBytes } from '@/lib/api';
import EnhancedInstantPreviewModal from './EnhancedInstantPreviewModal';
import { MoveToFolderDialog } from './MoveToFolderDialog';

interface FileRequestItem {
  id: string;
  title: string;
  description: string;
  slug: string;
  folder_path: string;
  max_files: number;
  max_size_per_file: number;
  allowed_types: string[] | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface ManageFileRequestsProps {
  refreshToken?: number;
}

export const ManageFileRequests: React.FC<ManageFileRequestsProps> = ({ refreshToken = 0 }) => {
  const isMobile = useIsMobile();
  const [requests, setRequests] = useState<FileRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState<any>(null);
  const [readingEpubFile, setReadingEpubFile] = useState<any>(null);
  const [moveFileIds, setMoveFileIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const { toast } = useToast();

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await getMyFileRequests();
      setRequests(data);
    } catch (err: any) {
      toast({ title: 'Failed to load', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, [refreshToken]);

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/r/${slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Copied', description: 'Link copied to clipboard' });
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await toggleFileRequest(id, isActive);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, is_active: isActive } : r));
      toast({ title: isActive ? 'Activated' : 'Deactivated' });
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { id, title } = deleteTarget;
    try {
      await deleteFileRequest(id);
      setRequests(prev => prev.filter(r => r.id !== id));
      toast({ title: 'Deleted', description: `"${title}" removed` });
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setSubmissionsLoading(true);
    try {
      const data = await getFileRequestSubmissions(id);
      setSubmissions(data);
    } catch (err: any) {
      toast({ title: 'Failed to load submissions', description: err.message, variant: 'destructive' });
    } finally {
      setSubmissionsLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Inbox className="h-5 w-5" /> File Requests</CardTitle>
          <CardDescription>Loading your file requests...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const btnClass = isMobile ? "h-10 w-10 p-0" : "h-8 w-8 p-0";

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Inbox className="h-5 w-5" /> File Requests</CardTitle>
              <CardDescription>{requests.length} request{requests.length !== 1 ? 's' : ''}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Inbox className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No file requests yet</p>
              <p className="text-sm mt-2">Create a file request to get uploads from anyone.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map(req => (
                <div key={req.id} className="border rounded-lg overflow-hidden">
                  {isMobile ? (
                    <div className="p-3 hover:bg-accent/50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium truncate text-sm">{req.title}</h4>
                            <Badge variant={req.is_active ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                              {req.is_active ? 'Active' : 'Paused'}
                            </Badge>
                            {req.expires_at && new Date(req.expires_at) < new Date() && (
                              <Badge variant="destructive" className="text-[10px] shrink-0">Expired</Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            <span className="truncate max-w-[140px]">/r/{req.slug}</span>
                            {req.folder_path && <span className="truncate max-w-[120px]">→ {req.folder_path}</span>}
                            {req.expires_at && (
                              <span className="flex items-center gap-1 shrink-0">
                                <Calendar className="w-3 h-3" />
                                {formatDistanceToNow(new Date(req.expires_at), { addSuffix: true })}
                              </span>
                            )}
                          </div>
                        </div>
                        <Switch checked={req.is_active} onCheckedChange={(v) => handleToggle(req.id, v)} className="shrink-0 ml-2" />
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Button variant="ghost" size="sm" className={btnClass} onClick={() => toggleExpand(req.id)} title="View submissions">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className={btnClass} onClick={() => copyLink(req.slug)} title="Copy link">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className={btnClass} onClick={() => window.open(`/r/${req.slug}`, '_blank')} title="Open link">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className={`${btnClass} text-destructive`} onClick={() => setDeleteTarget({ id: req.id, title: req.title })} title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium truncate">{req.title}</h4>
                          <Badge variant={req.is_active ? 'default' : 'secondary'} className="text-[10px]">
                            {req.is_active ? 'Active' : 'Paused'}
                          </Badge>
                          {req.expires_at && new Date(req.expires_at) < new Date() && (
                            <Badge variant="destructive" className="text-[10px]">Expired</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>/r/{req.slug}</span>
                          {req.folder_path && <span>→ {req.folder_path}</span>}
                          {req.expires_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDistanceToNow(new Date(req.expires_at), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 ml-3 shrink-0">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => toggleExpand(req.id)} title="View submissions">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => copyLink(req.slug)} title="Copy link">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => window.open(`/r/${req.slug}`, '_blank')} title="Open link">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Switch checked={req.is_active} onCheckedChange={(v) => handleToggle(req.id, v)} />
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => setDeleteTarget({ id: req.id, title: req.title })} title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {expandedId === req.id && (
                    <div className="border-t bg-muted/20 px-4 py-3 animate-fade-in">
                      {submissionsLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : submissions.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No submissions yet</p>
                      ) : (
                        <div className="space-y-2">
                          {submissions.map((sub: any) => (
                            <div key={sub.id} className="flex items-center justify-between rounded-lg bg-card px-3 py-2 text-sm border">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
                                  <Download className="w-3.5 h-3.5 text-emerald-500" />
                                </span>
                                <span className="truncate font-medium">{sub.file_name}</span>
                                <span className="text-xs text-muted-foreground shrink-0">{formatBytes(sub.file_size)}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={async () => {
                                    try {
                                      const blob = await downloadFile(sub.file_id);
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = sub.file_name;
                                      a.click();
                                      URL.revokeObjectURL(url);
                                    } catch (err: any) {
                                      toast({ title: 'Download failed', description: err.message, variant: 'destructive' });
                                    }
                                  }}
                                  className={`${isMobile ? 'h-9 w-9' : 'h-7 w-7'} rounded-md hover:bg-accent/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors`}
                                  title="Download"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setPreviewFile(sub)}
                                  className={`${isMobile ? 'h-9 w-9' : 'h-7 w-7'} rounded-md hover:bg-accent/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors`}
                                  title="Preview"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setMoveFileIds([sub.file_id])}
                                  className={`${isMobile ? 'h-9 w-9' : 'h-7 w-7'} rounded-md hover:bg-accent/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors`}
                                  title="Move"
                                >
                                  <Move className="w-3.5 h-3.5" />
                                </button>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground ml-1">
                                  {sub.uploader_name && <span className="hidden sm:inline">{sub.uploader_name}</span>}
                                  <span className="whitespace-nowrap">{formatDistanceToNow(new Date(sub.created_at), { addSuffix: true })}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {previewFile && (
        <EnhancedInstantPreviewModal
          file={{ id: previewFile.file_id, name: previewFile.file_name, type: previewFile.file?.type || '', size: previewFile.file_size }}
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
          onDownload={async () => {
            try {
              const blob = await downloadFile(previewFile.file_id);
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = previewFile.file_name;
              a.click();
              URL.revokeObjectURL(url);
            } catch (err: any) {
              toast({ title: 'Download failed', description: err.message, variant: 'destructive' });
            }
          }}
          onOpenEpubReader={() => { setPreviewFile(null); setReadingEpubFile(previewFile); }}
        />
      )}
      <MoveToFolderDialog
        open={moveFileIds.length > 0}
        onClose={() => setMoveFileIds([])}
        fileIds={moveFileIds}
        onMoved={() => setMoveFileIds([])}
      />
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file request?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.title}” and all of its submissions will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ManageFileRequests;

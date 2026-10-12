import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import MobileSheet from '@/components/ui/MobileSheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import {
  Share2, XCircle, Copy, ExternalLink, Eye, Download as DownloadIcon,
  RefreshCw, BarChart3, ChevronDown, ChevronUp, ShieldAlert, Globe,
  MapPin, Smartphone, Clock, TriangleAlert as Flame, Lock, Search, Filter, MoreHorizontal
} from '@/lib/icon-map';
import { formatFileSize } from '@/lib/utils';
import { revokeFileShare, getShareAnalytics, updateShareOptions } from '@/lib/api';
import { buildPublicUrl } from '@/lib/appLinks';
import { useShareSurveillance } from '@/hooks/use-share-surveillance';
import { Folder } from '@/lib/icon-map';

interface ShareRow {
  id: string; file_id: string | null; folder_id: string | null; share_id: string; created_at: string;
  expires_at: string | null; share_views: number; download_count: number;
  is_active: boolean; view_only: boolean; burn_after_reading: boolean;
  max_views: number | null; max_downloads: number | null;
  allowed_countries: string[] | null; blocked_countries: string[] | null;
  device_fingerprint: string | null; watermark_email: boolean;
  require_email: boolean; access_code: string | null;
  file: { id: string; name: string; type: string; size: number; } | null;
  folder: { id: string; name: string; } | null;
  is_folder_share: boolean;
}

interface ShareManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ShareAnalyticsPanel({ shareId, fileId }: { shareId: string; fileId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const { notifyDecryptAttempt } = useShareSurveillance(shareId);

  useEffect(() => {
    getShareAnalytics(shareId).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [shareId]);

  if (loading) return <div className="text-xs text-muted-foreground py-4 text-center">Loading analytics...</div>;
  if (!data) return null;

  const { logs = [], share } = data;
  const views = logs.filter((l: any) => l.event_type === 'view');
  const downloads = logs.filter((l: any) => l.event_type === 'download');

  return (
    <div className="space-y-2">
      {share && (
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded bg-muted/20">
            <div className="text-lg font-bold text-foreground">{share.share_views || 0}</div>
            <div className="text-[10px] text-muted-foreground">Views</div>
          </div>
          <div className="text-center p-2 rounded bg-muted/20">
            <div className="text-lg font-bold text-foreground">{share.download_count || 0}</div>
            <div className="text-[10px] text-muted-foreground">Downloads</div>
          </div>
          <div className="text-center p-2 rounded bg-muted/20">
            <div className="text-lg font-bold text-foreground">{logs.length}</div>
            <div className="text-[10px] text-muted-foreground">Events</div>
          </div>
        </div>
      )}

      {/* Geo map */}
      {logs.some((l: any) => l.geo_country) && (
        <div className="flex flex-wrap gap-1">
          {[...new Set(logs.filter((l: any) => l.geo_country).map((l: any) => l.geo_country))].map(country => (
            <Badge key={country} variant="outline" className="text-[10px]">
              <MapPin className="w-2.5 h-2.5 mr-0.5" /> {country}
            </Badge>
          ))}
        </div>
      )}

      {/* Event log */}
      <div className="max-h-40 overflow-y-auto space-y-0.5">
        {logs.slice(0, 50).map((log: any, i: number) => (
          <div key={i} className="flex items-center justify-between text-[10px] py-1 px-1.5 rounded hover:bg-muted/10">
            <div className="flex items-center gap-1.5">
              <span className={log.event_type === 'view' ? 'text-blue-400' : log.event_type === 'download' ? 'text-green-400' : 'text-orange-400'}>
                {log.event_type === 'view' ? <Eye className="w-2.5 h-2.5" /> :
                 log.event_type === 'download' ? <DownloadIcon className="w-2.5 h-2.5" /> :
                 <ShieldAlert className="w-2.5 h-2.5" />}
              </span>
              <span className="text-muted-foreground">{log.event_type}</span>
              {log.geo_country && <span className="text-muted-foreground/60">{log.geo_country}</span>}
            </div>
            <span className="text-muted-foreground/40">{new Date(log.created_at).toLocaleTimeString()}</span>
          </div>
        ))}
        {logs.length === 0 && <p className="text-[10px] text-muted-foreground/40 text-center py-2">No events yet</p>}
      </div>
    </div>
  );
}

export const ShareManagementDialog: React.FC<ShareManagementDialogProps> = ({ open, onOpenChange }) => {
  const [sharedFiles, setSharedFiles] = useState<ShareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedAnalytics, setExpandedAnalytics] = useState<string | null>(null);
  const [surveillanceAlerts, setSurveillanceAlerts] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'expired'>('all');
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const { notifyDecryptAttempt } = useShareSurveillance(expandedAnalytics || '');

  useEffect(() => {
    if (!open) return;
    const channel = supabase
      .channel('share-surveillance-global')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'share_decrypt_logs' },
        (payload: any) => {
          const event = payload.new;
          if (event?.share_id) {
            setSurveillanceAlerts(prev => new Set(prev).add(event.share_id));
            setTimeout(() => setSurveillanceAlerts(prev => { const n = new Set(prev); n.delete(event.share_id); return n; }), 10000);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [open]);

  useEffect(() => { if (open) fetchSharedFiles(); }, [open]);

  const fetchSharedFiles = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [fileSharesRes, folderSharesRes] = await Promise.all([
        supabase
          .from('shares')
          .select(`id, file_id, folder_id, share_id, created_at, expires_at, share_views, download_count, is_active, view_only, burn_after_reading, max_views, max_downloads, allowed_countries, blocked_countries, device_fingerprint, watermark_email, require_email, access_code, file:files(id, name, type, size)`)
          .eq('user_id', user.id)
          .not('share_id', 'is', null)
          .is('folder_id', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('shares')
          .select(`id, file_id, folder_id, share_id, created_at, expires_at, share_views, download_count, is_active, view_only, burn_after_reading, max_views, max_downloads, allowed_countries, blocked_countries, device_fingerprint, watermark_email, require_email, access_code, folder:folders(id, name)`)
          .eq('user_id', user.id)
          .not('share_id', 'is', null)
          .not('folder_id', 'is', null)
          .order('created_at', { ascending: false }),
      ]);

      if (fileSharesRes.error) throw fileSharesRes.error;
      if (folderSharesRes.error) throw folderSharesRes.error;

      const fileShares = (fileSharesRes.data || []).map((s: any) => ({ ...s, is_folder_share: false }));
      const folderShares = (folderSharesRes.data || []).map((s: any) => ({ ...s, is_folder_share: true, file: null }));

      setSharedFiles([...fileShares, ...folderShares].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) as any || []);
    } catch (error: any) {
      toast({ title: "Failed to load shares", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const copyShareLink = (shareId: string) => {
    navigator.clipboard.writeText(buildPublicUrl(`/s/${shareId}`));
    toast({ title: "Link copied" });
  };

  const handleRevokeShare = async (share: ShareRow) => {
    try {
      if (share.is_folder_share) {
        await supabase.from('shares').delete().eq('share_id', share.share_id);
      } else {
        await revokeFileShare(share.file_id!);
      }
      const name = share.is_folder_share ? share.folder?.name : share.file?.name;
      toast({ title: "Share revoked", description: `"${name}" disabled` });
      fetchSharedFiles();
    } catch (error: any) {
      toast({ title: "Revoke failed", description: error.message, variant: "destructive" });
    }
    setConfirmRevoke(null);
  };

  const openShareLink = (shareId: string) => window.open(buildPublicUrl(`/s/${shareId}`), '_blank');

  const filtered = sharedFiles.filter(s => {
    if (filterActive === 'active' && !s.is_active) return false;
    if (filterActive === 'expired') {
      const expired = s.expires_at && new Date(s.expires_at) < new Date();
      if (!expired) return false;
    }
    if (search) {
      const name = s.is_folder_share ? s.folder?.name : s.file?.name;
      if (!name?.toLowerCase().includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const content = (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-5 py-2 border-b border-border/20">
        <div className="relative flex-1">
          <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
          <input type="text" placeholder="Search shares..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-7 pl-7 pr-2 text-xs rounded-md border border-border bg-transparent text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50" />
        </div>
        <select value={filterActive} onChange={e => setFilterActive(e.target.value as any)}
          className="h-7 px-2 text-xs rounded-md border border-border bg-transparent text-foreground focus:outline-none">
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
        </select>
        <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={fetchSharedFiles} disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* List */}
      {loading && filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-20 animate-spin" />
          <p className="text-sm">Loading...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Share2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm">No shared items</p>
          <p className="text-xs mt-1">Share files or folders from the context menu</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {filtered.map(share => {
            const isExpired = share.expires_at && new Date(share.expires_at) < new Date();
            const isExpanded = expandedAnalytics === share.share_id;
            return (
              <div key={share.id} className="border border-border/30 rounded-lg overflow-hidden bg-card/50">
                <div className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/10 transition-colors">
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="flex items-center gap-2">
                      {share.is_folder_share ? (
                        <h4 className="font-medium text-sm text-foreground truncate flex items-center gap-1.5">
                          <Folder className="w-3.5 h-3.5 text-primary shrink-0" />
                          {share.folder?.name || 'Unnamed folder'}
                        </h4>
                      ) : (
                        <h4 className="font-medium text-sm text-foreground truncate">{share.file?.name}</h4>
                      )}
                      {surveillanceAlerts.has(share.share_id) && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-500/20 animate-pulse shrink-0">
                          <ShieldAlert className="w-2.5 h-2.5 mr-0.5" /> Alert
                        </Badge>
                      )}
                      {share.burn_after_reading && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-orange-500/10 text-orange-600 border-orange-500/20 shrink-0">
                          <Flame className="w-2.5 h-2.5 mr-0.5" /> Burn
                        </Badge>
                      )}
                      {share.is_active && !isExpired ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-600 border-green-500/20 shrink-0">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-gray-500/10 text-gray-600 border-gray-500/20 shrink-0">{isExpired ? 'Expired' : 'Inactive'}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {share.is_folder_share ? (
                        <span className="flex items-center gap-1"><Folder className="h-3 w-3" />Folder</span>
                      ) : (
                        <span>{formatFileSize(share.file?.size || 0)}</span>
                      )}
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{share.share_views || 0}</span>
                      <span className="flex items-center gap-1"><DownloadIcon className="h-3 w-3" />{share.download_count || 0}</span>
                      {share.expires_at && (
                        <span className={isExpired ? 'text-red-500' : 'text-orange-500'}>
                          <Clock className="h-2.5 w-2.5 inline mr-0.5" />
                          {new Date(share.expires_at).toLocaleDateString()}
                        </span>
                      )}
                      {share.access_code && <Lock className="h-2.5 w-2.5 text-yellow-500" />}
                      {share.allowed_countries?.length ? <Globe className="h-2.5 w-2.5 text-primary" /> : null}
                      {share.device_fingerprint && <Smartphone className="h-2.5 w-2.5 text-purple-400" />}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                      onClick={() => setExpandedAnalytics(isExpanded ? null : share.share_id)} title="Analytics">
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <BarChart3 className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => copyShareLink(share.share_id)} title="Copy link">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openShareLink(share.share_id)} title="Open">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    {confirmRevoke === share.share_id ? (
                      <div className="flex gap-1">
                        <Button size="sm" className="h-7 px-2 text-[10px]" onClick={() => handleRevokeShare(share)}>Confirm</Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => setConfirmRevoke(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmRevoke(share.share_id)} title="Revoke">
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-border/20 px-3 py-2 bg-muted/5">
                    <ShareAnalyticsPanel shareId={share.share_id} fileId={share.file_id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <MobileSheet open={open} onOpenChange={v => { if (!v) setExpandedAnalytics(null); onOpenChange(v); }} title="Manage Shares">
        {content}
      </MobileSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { setExpandedAnalytics(null); setConfirmRevoke(null); } onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-5 pt-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Manage Shares
          </DialogTitle>
          <DialogDescription>
            {sharedFiles.length} share{sharedFiles.length !== 1 ? 's' : ''} · {sharedFiles.filter(s => s.is_active).length} active
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
};

export default ShareManagementDialog;

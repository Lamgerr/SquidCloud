import React, { useState, useEffect, useCallback, useRef } from 'react';
import MobileSheet from '@/components/ui/MobileSheet';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Share2, XCircle, Copy, ExternalLink, Eye, Download as DownloadIcon,
  RefreshCw, ChevronDown, ChevronUp, ShieldAlert, Globe,
  MapPin, Smartphone, Clock, TriangleAlert as Flame, Lock, Search,
  Inbox, Link as LinkIcon, Filter as FilterIcon,
  CheckCircle2, AlertCircle, SlidersHorizontal, Trash2,
  FileText, ChevronRight, Zap, History,
} from '@/lib/icon-map';
import { formatFileSize } from '@/lib/utils';
import {
  revokeFileShare, getShareAnalytics, updateShareOptions,
  getMyFileRequests, toggleFileRequest, deleteFileRequest,
} from '@/lib/api';
import { buildPublicUrl } from '@/lib/appLinks';
import { useShareSurveillance } from '@/hooks/use-share-surveillance';
import { EnhancedShareDialog } from './EnhancedShareDialog';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface ShareRow {
  id: string; file_id: string; share_id: string; created_at: string;
  expires_at: string | null; share_views: number; download_count: number;
  is_active: boolean; view_only: boolean; burn_after_reading: boolean;
  max_views: number | null; max_downloads: number | null;
  allowed_countries: string[] | null; blocked_countries: string[] | null;
  device_fingerprint: string | null; watermark_email: boolean;
  require_email: boolean; access_code: string | null;
  file: { id: string; name: string; type: string; size: number; };
}

interface FileRequestItem {
  id: string; slug: string; title: string; description: string;
  is_active: boolean; expires_at: string | null; created_at: string;
  max_files: number; max_size_per_file: number; submission_count?: number;
}

const haptics = {
  light: () => { if ('vibrate' in navigator) navigator.vibrate(10); },
  medium: () => { if ('vibrate' in navigator) navigator.vibrate(20); },
  heavy: () => { if ('vibrate' in navigator) navigator.vibrate(40); },
  selection: () => { if ('vibrate' in navigator) navigator.vibrate(15); },
  success: () => { if ('vibrate' in navigator) { navigator.vibrate(30); setTimeout(() => navigator.vibrate(15), 50); } },
  error: () => { if ('vibrate' in navigator) { navigator.vibrate(50); setTimeout(() => navigator.vibrate(50), 80); } },
};

// ─── Share Analytics Panel ───────────────────────────────────────────────────
function ShareAnalyticsPanel({ shareId, isOpen }: { shareId: string; isOpen: boolean }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useShareSurveillance(shareId);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getShareAnalytics(shareId).then(setData).catch(() => {}).finally(() => setLoading(false));
    }
  }, [shareId, isOpen]);

  if (!isOpen) return null;
  if (loading) return <div className="flex items-center justify-center py-6"><RefreshCw className="w-4 h-4 animate-spin text-[#768390]" /></div>;
  if (!data) return null;

  const { logs = [], share } = data;
  const dayBuckets: Record<string, any[]> = {};
  logs.forEach((l: any) => {
    const day = new Date(l.created_at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    if (!dayBuckets[day]) dayBuckets[day] = [];
    dayBuckets[day].push(l);
  });

  return (
    <div className="px-4 pb-4 pt-2 space-y-3">
      {/* Stats row */}
      <div className="flex gap-2">
        {[
          { label: 'Views', value: share?.share_views || 0, icon: Eye, color: 'text-[#58A6FF]' },
          { label: 'Downloads', value: share?.download_count || 0, icon: DownloadIcon, color: 'text-[#3FB950]' },
          { label: 'Events', value: logs.length, icon: Zap, color: 'text-[#D29922]' },
        ].map((stat, i) => (
          <div key={i} className="flex-1 bg-[#161B22] rounded-xl p-3 text-center border border-[#2D333B]">
            <stat.icon className={cn('w-4 h-4 mx-auto mb-1', stat.color)} />
            <div className="text-[18px] font-bold text-[#E6EDF3]">{stat.value}</div>
            <div className="text-[10px] text-[#768390] mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Geo badges */}
      {logs.some((l: any) => l.geo_country) && (
        <div className="flex flex-wrap gap-1.5">
          {[...new Set(logs.filter((l: any) => l.geo_country).map((l: any) => l.geo_country))].map(country => (
            <span key={country} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#161B22] border border-[#2D333B] text-[#8B949E]">
              <MapPin className="w-2.5 h-2.5 text-[#58A6FF]" /> {country}
            </span>
          ))}
        </div>
      )}

      {/* Event timeline grouped by day */}
      <div className="max-h-36 overflow-y-auto space-y-1 scrollbar-thin">
        <div className="text-[11px] font-semibold text-[#8B949E] flex items-center gap-1.5 sticky top-0 bg-[#161B22] py-1 z-10">
          <History className="w-3 h-3" /> Activity
        </div>
        {Object.entries(dayBuckets).map(([day, dayLogs]) => (
          <div key={day}>
            <div className="text-[10px] text-[#484F58] font-medium px-1 py-0.5">{day}</div>
            {dayLogs.slice(0, 10).map((log: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-[#1C2128] transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                    log.event_type === 'view' ? 'bg-[#58A6FF]/10' :
                    log.event_type === 'download' ? 'bg-[#3FB950]/10' : 'bg-[#D29922]/10'
                  )}>
                    {log.event_type === 'view' ? <Eye className="w-2.5 h-2.5 text-[#58A6FF]" /> :
                     log.event_type === 'download' ? <DownloadIcon className="w-2.5 h-2.5 text-[#3FB950]" /> :
                     <ShieldAlert className="w-2.5 h-2.5 text-[#D29922]" />}
                  </div>
                  <span className="text-[11px] text-[#E6EDF3] capitalize">{log.event_type}</span>
                  {log.geo_country && <span className="text-[10px] text-[#768390]">{log.geo_country}</span>}
                </div>
                <span className="text-[9px] text-[#484F58] shrink-0">
                  {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            {dayLogs.length > 10 && <div className="text-[9px] text-[#484F58] px-2">+{dayLogs.length - 10} more</div>}
          </div>
        ))}
        {logs.length === 0 && <p className="text-[11px] text-[#484F58] text-center py-3">No activity yet</p>}
      </div>
    </div>
  );
}

// ─── Share Row Card ──────────────────────────────────────────────────────────
function ShareRowCard({
  share, onRevoke, onCopy, onOpen, isAlert, isExpanded, onToggleExpand,
}: {
  share: ShareRow; onRevoke: () => void; onCopy: () => void; onOpen: () => void;
  isAlert: boolean; isExpanded: boolean; onToggleExpand: () => void;
}) {
  const isExpired = share.expires_at && new Date(share.expires_at) < new Date();
  const canBeActive = share.is_active && !isExpired;

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden transition-all duration-200',
      canBeActive ? 'border-[#2D333B] bg-[#161B22]' : 'border-[#21262D] bg-[#161B22]/60',
      isAlert && 'border-[#D29922]/40 shadow-[0_0_12px_rgba(210,153,34,0.08)]',
    )}>
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="w-10 h-10 rounded-xl bg-[#1C2128] border border-[#2D333B] flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4 text-[#8B949E]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[14px] font-medium text-[#E6EDF3] truncate">{share.file.name}</span>
            {isAlert && <ShieldAlert className="w-3 h-3 text-[#D29922] shrink-0 animate-pulse" />}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-[#768390]">{formatFileSize(share.file.size)}</span>
            <span className="text-[10px] text-[#484F58]">·</span>
            <span className="flex items-center gap-0.5 text-[11px] text-[#8B949E]">
              <Eye className="w-2.5 h-2.5" /> {share.share_views || 0}
            </span>
            <span className="text-[10px] text-[#484F58]">·</span>
            <span className="flex items-center gap-0.5 text-[11px] text-[#8B949E]">
              <DownloadIcon className="w-2.5 h-2.5" /> {share.download_count || 0}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {share.burn_after_reading && (
            <div className="w-7 h-7 rounded-lg bg-[#D29922]/10 flex items-center justify-center" title="Burn after reading">
              <Flame className="w-3.5 h-3.5 text-[#D29922]" />
            </div>
          )}
          {share.access_code && (
            <div className="w-7 h-7 rounded-lg bg-[#58A6FF]/10 flex items-center justify-center" title="Password protected">
              <Lock className="w-3.5 h-3.5 text-[#58A6FF]" />
            </div>
          )}
          {share.allowed_countries?.length ? (
            <div className="w-7 h-7 rounded-lg bg-[#3FB950]/10 flex items-center justify-center" title="Geo-locked">
              <Globe className="w-3.5 h-3.5 text-[#3FB950]" />
            </div>
          ) : null}
          {share.device_fingerprint && (
            <div className="w-7 h-7 rounded-lg bg-[#BC8CFF]/10 flex items-center justify-center" title="Device locked">
              <Smartphone className="w-3.5 h-3.5 text-[#BC8CFF]" />
            </div>
          )}
          <button onClick={onToggleExpand}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8B949E] hover:bg-[#1C2128] active:bg-[#2D333B] transition-colors">
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Footer: status + actions */}
      <div className="flex items-center justify-between px-4 pb-3">
        <div className="flex items-center gap-1.5">
          {canBeActive ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#3FB950]/10 text-[#3FB950] border border-[#3FB950]/20">
              <CheckCircle2 className="w-2.5 h-2.5" /> Active
            </span>
          ) : isExpired ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F85149]/10 text-[#F85149] border border-[#F85149]/20">
              <AlertCircle className="w-2.5 h-2.5" /> Expired
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#484F58]/20 text-[#8B949E] border border-[#484F58]/30">
              Inactive
            </span>
          )}
          {share.expires_at && (
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border',
              isExpired ? 'bg-[#F85149]/5 text-[#F85149] border-[#F85149]/15' : 'bg-[#D29922]/5 text-[#D29922] border-[#D29922]/15'
            )}>
              <Clock className="w-2.5 h-2.5" />
              {isExpired ? 'Expired' : new Date(share.expires_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => { haptics.light(); onCopy(); }}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#8B949E] hover:bg-[#1C2128] active:bg-[#2D333B] transition-colors">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { haptics.light(); onOpen(); }}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#8B949E] hover:bg-[#1C2128] active:bg-[#2D333B] transition-colors">
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button onClick={onRevoke}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#F85149] hover:bg-[#F85149]/10 active:bg-[#F85149]/20 transition-colors">
            <XCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Analytics expandable */}
      <div className={cn(
        'overflow-hidden transition-all duration-300 ease-out',
        isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
      )}>
        <div className="border-t border-[#2D333B] mx-4" />
        <ShareAnalyticsPanel shareId={share.share_id} isOpen={isExpanded} />
      </div>
    </div>
  );
}

// ─── File Request Card ──────────────────────────────────────────────────────
const FileRequestCard: React.FC<{
  req: FileRequestItem;
  onToggle: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onOpen: () => void;
}> = ({ req, onToggle, onDelete, onCopy, onOpen }) => (
  <div className="rounded-2xl border border-[#2D333B] bg-[#161B22] overflow-hidden">
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#D29922]/10 border border-[#D29922]/20 flex items-center justify-center shrink-0">
          <Inbox className="w-4 h-4 text-[#D29922]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-medium text-[#E6EDF3] truncate">{req.title}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-[#768390]">/r/{req.slug}</span>
            {req.expires_at && (
              <span className="text-[10px] text-[#D29922]">
                Exp {new Date(req.expires_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>
        <button onClick={onToggle}
          className={cn(
            'px-3 h-7 rounded-lg text-[11px] font-medium border transition-all',
            req.is_active
              ? 'bg-[#3FB950]/10 text-[#3FB950] border-[#3FB950]/20'
              : 'bg-[#484F58]/10 text-[#8B949E] border-[#484F58]/30'
          )}>
          {req.is_active ? 'Active' : 'Paused'}
        </button>
      </div>
    </div>
    <div className="flex items-center justify-between px-4 pb-3.5">
      <div className="flex items-center gap-2">
        <button onClick={onCopy}
          className="h-8 px-3 rounded-lg text-[11px] font-medium bg-[#1C2128] border border-[#2D333B] text-[#8B949E] hover:border-[#58A6FF]/30 flex items-center gap-1.5">
          <Copy className="w-3 h-3" /> Copy Link
        </button>
        <button onClick={onOpen}
          className="h-8 px-3 rounded-lg text-[11px] font-medium bg-[#1C2128] border border-[#2D333B] text-[#8B949E] hover:border-[#58A6FF]/30 flex items-center gap-1.5">
          <ExternalLink className="w-3 h-3" /> Open
        </button>
      </div>
      <button onClick={onDelete}
        className="h-8 w-8 rounded-lg flex items-center justify-center text-[#F85149] hover:bg-[#F85149]/10 transition-colors">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

// ─── Main Content (used by both sheet and page variants) ────────────────────
interface MobileShareManagerContentProps {
  onClose?: () => void;
}

export const MobileShareManagerContent: React.FC<MobileShareManagerContentProps> = ({ onClose }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [tab, setTab] = useState<'shares' | 'requests'>('shares');
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [requests, setRequests] = useState<FileRequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'expired'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [surveillanceAlerts, setSurveillanceAlerts] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const channel = supabase
      .channel('mobile-share-surveillance')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'share_decrypt_logs' },
        (payload: any) => {
          const event = payload.new;
          if (event?.share_id) {
            setSurveillanceAlerts(prev => new Set(prev).add(event.share_id));
            haptics.error();
            setTimeout(() => setSurveillanceAlerts(prev => { const n = new Set(prev); n.delete(event.share_id); return n; }), 8000);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchShares(), fetchRequests()]);
    setLoading(false);
  };

  const fetchShares = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('shares')
        .select(`id, file_id, share_id, created_at, expires_at, share_views, download_count, is_active, view_only, burn_after_reading, max_views, max_downloads, allowed_countries, blocked_countries, device_fingerprint, watermark_email, require_email, access_code, file:files(id, name, type, size)`)
        .eq('user_id', user.id)
        .not('share_id', 'is', null)
        .order('created_at', { ascending: false });
      setShares(data as any || []);
    } catch (e: any) {
      toast({ title: "Failed to load shares", description: e.message, variant: "destructive" });
    }
  };

  const fetchRequests = async () => {
    try {
      const data = await getMyFileRequests();
      setRequests(data || []);
    } catch {}
  };

  const handleCopy = (shareId: string) => {
    navigator.clipboard.writeText(buildPublicUrl(`/s/${shareId}`));
    haptics.success();
    toast({ title: "Link copied" });
  };

  const handleCopyRequest = (slug: string) => {
    navigator.clipboard.writeText(buildPublicUrl(`/r/${slug}`));
    haptics.success();
    toast({ title: "Link copied" });
  };

  const handleOpen = (shareId: string) => {
    window.open(buildPublicUrl(`/s/${shareId}`), '_blank');
  };

  const handleRevoke = async (share: ShareRow) => {
    try {
      haptics.heavy();
      await revokeFileShare(share.file_id);
      haptics.success();
      toast({ title: "Share revoked", description: `"${share.file.name}" disabled` });
      fetchShares();
    } catch (e: any) {
      haptics.error();
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const handleToggleRequest = async (id: string, active: boolean) => {
    try {
      await toggleFileRequest(id, active);
      haptics.selection();
      fetchRequests();
    } catch {}
  };

  const handleDeleteRequest = async (id: string) => {
    try {
      await deleteFileRequest(id);
      haptics.success();
      fetchRequests();
    } catch {}
  };

  const filteredShares = shares.filter(s => {
    if (filterTab === 'active' && (!s.is_active || (s.expires_at && new Date(s.expires_at) < new Date()))) return false;
    if (filterTab === 'expired') {
      const expired = s.expires_at && new Date(s.expires_at) < new Date();
      if (!expired) return false;
    }
    if (search && !s.file.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredRequests = requests.filter(r =>
    !search || r.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[#0D1117]">
      {/* Search */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[20px] font-bold text-[#E6EDF3]">Shares</h2>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[#768390] bg-[#161B22] px-2.5 py-1 rounded-full border border-[#2D333B]">
              {shares.filter(s => s.is_active).length} active
            </span>
            <button onClick={fetchData}
              className="w-8 h-8 rounded-xl bg-[#161B22] border border-[#2D333B] flex items-center justify-center text-[#8B949E] active:bg-[#1C2128] transition-colors">
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#484F58]" />
          <input type="text" placeholder="Search shares..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-[14px] rounded-xl bg-[#161B22] border border-[#2D333B] text-[#E6EDF3] placeholder:text-[#484F58] focus:outline-none focus:border-[#58A6FF]/50 focus:ring-1 focus:ring-[#58A6FF]/20 transition-all" />
        </div>

        {/* Shares / Requests tabs */}
        <div className="flex gap-1 p-0.5 rounded-xl bg-[#161B22] border border-[#2D333B] mb-3">
          {[
            { key: 'shares' as const, label: 'Shared Links', icon: LinkIcon },
            ...(profile?.is_premium ? [{ key: 'requests' as const, label: 'File Requests', icon: Inbox }] : []),
          ].map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); haptics.selection(); }}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-[13px] font-medium transition-all duration-200',
                tab === t.key ? 'bg-[#1C2128] text-[#E6EDF3] shadow-sm' : 'text-[#8B949E] hover:text-[#E6EDF3]'
              )}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {/* Sub-filter for shares tab */}
        {tab === 'shares' && (
          <div className="flex gap-1.5">
            {(['all', 'active', 'expired'] as const).map(f => (
              <button key={f} onClick={() => { setFilterTab(f); haptics.selection(); }}
                className={cn(
                  'px-3 h-7 rounded-lg text-[11px] font-medium transition-all duration-200',
                  filterTab === f ? 'bg-[#58A6FF] text-white' : 'bg-[#161B22] text-[#8B949E] border border-[#2D333B] hover:border-[#58A6FF]/30'
                )}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Scrollable list */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 pb-6 space-y-2.5 scrollbar-thin">
        {/* Loading */}
        {loading && shares.length === 0 && tab === 'shares' && (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full bg-[#58A6FF]/10 animate-ping" style={{ animationDuration: '2s' }} />
              <div className="absolute inset-[3px] rounded-full bg-[#58A6FF]/20 animate-pulse" style={{ animationDuration: '1.5s' }} />
              <div className="absolute inset-[6px] rounded-full bg-[#1C2128] border border-[#2D333B] flex items-center justify-center">
                <Share2 className="w-5 h-5 text-[#58A6FF]" />
              </div>
            </div>
            <p className="text-sm text-[#768390] animate-pulse" style={{ animationDuration: '1.5s' }}>Loading shares...</p>
          </div>
        )}

        {/* Empty shares */}
        {!loading && tab === 'shares' && filteredShares.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-[#161B22] border border-[#2D333B] flex items-center justify-center mb-4">
              <Share2 className="w-7 h-7 text-[#484F58]" />
            </div>
            <p className="text-[15px] font-medium text-[#8B949E]">No shared files</p>
            <p className="text-[12px] text-[#484F58] mt-1">Share a file to see it here</p>
          </div>
        )}

        {/* Shares */}
        {tab === 'shares' && filteredShares.map(share => (
          <ShareRowCard
            key={share.id}
            share={share}
            isAlert={surveillanceAlerts.has(share.share_id)}
            isExpanded={expandedId === share.share_id}
            onToggleExpand={() => { setExpandedId(expandedId === share.share_id ? null : share.share_id); haptics.light(); }}
            onRevoke={() => handleRevoke(share)}
            onCopy={() => handleCopy(share.share_id)}
            onOpen={() => handleOpen(share.share_id)}
          />
        ))}

        {/* Empty requests */}
        {!loading && tab === 'requests' && filteredRequests.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-[#161B22] border border-[#2D333B] flex items-center justify-center mb-4">
              <Inbox className="w-7 h-7 text-[#484F58]" />
            </div>
            <p className="text-[15px] font-medium text-[#8B949E]">No file requests</p>
            <p className="text-[12px] text-[#484F58] mt-1">Create one from the file manager</p>
          </div>
        )}

        {/* File requests */}
        {tab === 'requests' && filteredRequests.map(req => (
          <FileRequestCard
            key={req.id}
            req={req}
            onToggle={() => handleToggleRequest(req.id, !req.is_active)}
            onDelete={() => handleDeleteRequest(req.id)}
            onCopy={() => handleCopyRequest(req.slug)}
            onOpen={() => window.open(`/r/${req.slug}`, '_blank')}
          />
        ))}

        <div className="h-4" />
      </div>
    </div>
  );
};

// ─── Sheet variant (for action sheet) ──────────────────────────────────────
interface MobileShareManagerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MobileShareManagerSheet: React.FC<MobileShareManagerSheetProps> = ({ open, onOpenChange }) => (
  <MobileSheet
    open={open}
    onOpenChange={onOpenChange}
    title={
      <div className="flex items-center gap-2.5 px-1">
        <div className="w-9 h-9 rounded-xl bg-[#58A6FF]/10 flex items-center justify-center">
          <Share2 className="w-4 h-4 text-[#58A6FF]" />
        </div>
        <div>
          <span className="text-[16px] font-semibold text-[#E6EDF3]">Share Manager</span>
          <span className="text-[11px] text-[#768390] block -mt-0.5">Manage all shared links</span>
        </div>
      </div>
    }
  >
    <div className="max-h-[80vh] overflow-hidden">
      <MobileShareManagerContent onClose={() => onOpenChange(false)} />
    </div>
  </MobileSheet>
);

export default MobileShareManagerSheet;

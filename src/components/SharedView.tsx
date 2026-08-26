import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { cn, formatFileSize } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import type { FileItem } from '@/lib/api';
import FileItemComponent from '@/components/FileItem';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Share2, HardDrive, Clock, RefreshCw, Loader2,
  Users, FileText, Image, Video, Music, Archive, File as FileIcon,
  Folder, X, Check, ChevronsUpDown, Search
} from '@/lib/icon-map';

type SortKey = 'name-asc' | 'name-desc' | 'date-desc' | 'date-asc' | 'size-desc' | 'size-asc';

interface FolderShareItem {
  share_id: string;
  folder_id: string;
  folder_name: string;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
  share_views: number;
  download_count: number;
}

interface SharedViewProps {
  files: FileItem[];
  onFileDownload: (f: FileItem) => void;
  onFileShare: (f: FileItem) => void;
  onFileDelete: (f: FileItem) => void;
  onFileClick: (f: FileItem) => void;
  onOpenFileInCbCode: (f: FileItem) => void;
  onRefresh: () => void;
  onViewInfo?: (f: FileItem) => void;
  onFolderShareClick?: (shareId: string) => void;
}

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'name-asc', label: 'Name A-Z' },
  { key: 'name-desc', label: 'Name Z-A' },
  { key: 'date-desc', label: 'Newest' },
  { key: 'date-asc', label: 'Oldest' },
  { key: 'size-desc', label: 'Largest' },
  { key: 'size-asc', label: 'Smallest' },
];

const getFileTypeIcon = (file: FileItem) => {
  const t = (file.type || '').toLowerCase();
  const n = file.name.toLowerCase();
  if (t.startsWith('image/')) return { icon: Image, color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
  if (t.startsWith('video/')) return { icon: Video, color: 'text-rose-400', bg: 'bg-rose-500/10' };
  if (t.startsWith('audio/')) return { icon: Music, color: 'text-violet-400', bg: 'bg-violet-500/10' };
  if (t.includes('pdf') || n.endsWith('.pdf')) return { icon: FileText, color: 'text-rose-400', bg: 'bg-rose-500/10' };
  if (/\.(zip|rar|7z|tar|gz)$/i.test(n)) return { icon: Archive, color: 'text-amber-400', bg: 'bg-amber-500/10' };
  return { icon: FileIcon, color: 'text-blue-400', bg: 'bg-blue-500/10' };
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  try { return formatDistanceToNow(new Date(dateStr), { addSuffix: true }); }
  catch { return ''; }
};

const SharedView: React.FC<SharedViewProps> = ({
  files, onFileDownload, onFileShare, onFileDelete,
  onFileClick, onOpenFileInCbCode, onRefresh, onViewInfo, onFolderShareClick
}) => {
  const isMobile = useIsMobile();
  const [sharedIds, setSharedIds] = useState<Set<string>>(new Set());
  const [folderShares, setFolderShares] = useState<FolderShareItem[]>([]);
  const [loadingShared, setLoadingShared] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date-desc');
  const { pullDistance, refreshing, onTouchStart, onTouchMove, onTouchEnd } = usePullToRefresh(onRefresh, loadingShared);

  useEffect(() => {
    let mounted = true;
    const loadSharedIds = async () => {
      try {
        setLoadingShared(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [fileSharesRes, folderSharesRes] = await Promise.all([
          supabase
            .from('shares')
            .select('file_id')
            .eq('user_id', user.id)
            .is('folder_id', null),
          supabase
            .from('shares')
            .select('share_id, folder_id, created_at, expires_at, is_active, share_views, download_count, folder:folders(id, name)')
            .eq('user_id', user.id)
            .not('folder_id', 'is', null)
            .not('share_id', 'is', null),
        ]);

        if (fileSharesRes.error) throw fileSharesRes.error;
        if (folderSharesRes.error) throw folderSharesRes.error;

        if (mounted) {
          setSharedIds(new Set((fileSharesRes.data || []).map(s => s.file_id)));
          const fShares = (folderSharesRes.data || []).map((s: any) => ({
            share_id: s.share_id,
            folder_id: s.folder_id,
            folder_name: s.folder?.name || 'Unknown Folder',
            created_at: s.created_at,
            expires_at: s.expires_at,
            is_active: s.is_active,
            share_views: s.share_views || 0,
            download_count: s.download_count || 0,
          }));
          setFolderShares(fShares);
        }
      } catch (err: any) {
        console.error('Failed to load shared files:', err);
      } finally {
        if (mounted) setLoadingShared(false);
      }
    };
    loadSharedIds();
    return () => { mounted = false; };
  }, []);

  const sharedFiles = useMemo(() => {
    const fromFilter = files.filter(f => f.shared);
    const fromShares = files.filter(f => sharedIds.has(f.id));
    const merged = new Map<string, FileItem>();
    for (const f of [...fromFilter, ...fromShares]) merged.set(f.id, f);
    return Array.from(merged.values());
  }, [files, sharedIds]);

  const totalSharedCount = sharedFiles.length + folderShares.length;

  const processedFiles = useMemo(() => {
    let result = sharedFiles;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f => f.name.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => {
      switch (sortKey) {
        case 'name-asc': return a.name.localeCompare(b.name);
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'date-desc': return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
        case 'date-asc': return new Date(a.updated_at || a.created_at).getTime() - new Date(b.updated_at || b.created_at).getTime();
        case 'size-desc': return (b.size || 0) - (a.size || 0);
        case 'size-asc': return (a.size || 0) - (b.size || 0);
        default: return 0;
      }
    });
  }, [sharedFiles, searchQuery, sortKey]);

  const sharedSize = useMemo(
    () => sharedFiles.reduce((sum, file) => sum + (file.size || 0), 0),
    [sharedFiles]
  );

  const recentlyShared = useMemo(() => {
    if (sharedFiles.length === 0) return null;
    return [...sharedFiles].sort((a, b) => (
      new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
    ))[0];
  }, [sharedFiles]);

  const currentSortLabel = sortOptions.find(o => o.key === sortKey)?.label || 'Newest';

  if (isMobile) {
    return (
      <div className="space-y-3" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        {refreshing && (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="ml-2 text-xs text-muted-foreground">Refreshing...</span>
          </div>
        )}
        {pullDistance > 10 && !refreshing && (
          <div
            className="flex items-center justify-center transition-all"
            style={{ transform: `translateY(${Math.min(pullDistance, 40)}px)`, opacity: Math.min(pullDistance / 80, 1) }}
          >
            <svg
              className={cn('h-5 w-5 text-muted-foreground', pullDistance > 60 && 'text-primary')}
              style={{ transform: `rotate(${pullDistance * 1.5}deg)` }}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        )}

        <div className="relative">
          <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-muted-foreground/60" />
          </div>
          <input
            type="text"
            placeholder="Search shared files..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-card border border-border/40 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 transition-colors"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-card border border-border/40 p-3">
            <div className="w-6 h-6 rounded-lg bg-blue-500/15 flex items-center justify-center mb-1.5">
              <Share2 className="w-3 h-3 text-blue-400" />
            </div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Shared</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{totalSharedCount}</p>
          </div>
          <div className="rounded-xl bg-card border border-border/40 p-3">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/15 flex items-center justify-center mb-1.5">
              <HardDrive className="w-3 h-3 text-emerald-400" />
            </div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Size</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{formatFileSize(sharedSize)}</p>
          </div>
          <div className="rounded-xl bg-card border border-border/40 p-3">
            <div className="w-6 h-6 rounded-lg bg-purple-500/15 flex items-center justify-center mb-1.5">
              <Users className="w-3 h-3 text-purple-400" />
            </div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Links</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{totalSharedCount}</p>
          </div>
        </div>

        {loadingShared ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : processedFiles.length === 0 && folderShares.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-[18px] bg-muted/60 border border-border/40 flex items-center justify-center mb-4">
              <Share2 className="w-7 h-7 text-muted-foreground/60" />
            </div>
            <p className="text-[15px] font-semibold text-foreground mb-1">
              {searchQuery ? 'No matching files' : 'No shared items'}
            </p>
            <p className="text-[13px] text-muted-foreground max-w-[240px]">
              {searchQuery ? 'Try a different search term' : 'Share a file or folder to create a link'}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {folderShares.map(fs => (
              <div
                key={fs.share_id}
                className="bg-card border border-border/40 rounded-xl px-4 py-3.5 flex items-center gap-3 cursor-pointer active:scale-[0.99] transition-all duration-150"
                onClick={() => onFolderShareClick?.(fs.share_id)}
              >
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                  <Folder className="w-5 h-5 text-purple-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-foreground block truncate" title={fs.folder_name}>
                    {fs.folder_name}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">Folder share</span>
                    <span className="text-muted-foreground/30">·</span>
                    <span className="text-xs text-muted-foreground">{formatDate(fs.created_at)}</span>
                    {fs.share_views > 0 && (
                      <>
                        <span className="text-muted-foreground/30">·</span>
                        <span className="text-xs text-muted-foreground">{fs.share_views} views</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {processedFiles.map(f => (
              <div
                key={f.id}
                className="bg-card border border-border/40 rounded-xl px-4 py-3.5 flex items-center gap-3 cursor-pointer active:scale-[0.99] transition-all duration-150"
                onClick={() => onFileClick(f)}
              >
                {(() => {
                  const cfg = getFileTypeIcon(f);
                  const Icon = cfg.icon;
                  return (
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', cfg.bg)}>
                      <Icon className={cn('w-5 h-5', cfg.color)} />
                    </div>
                  );
                })()}
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-foreground block truncate" title={f.name}>
                    {f.name}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{formatFileSize(f.size || 0)}</span>
                    <span className="text-muted-foreground/30">·</span>
                    <span className="text-xs text-muted-foreground">{formatDate(f.updated_at || f.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="lg-title">Shared</h1>
          <p className="lg-caption mt-1">Manage links, files, and folders from one place.</p>
        </div>
        <div className="flex items-center gap-2.5">
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
          <div className="relative w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Filter by name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-9 pr-3 rounded-lg bg-muted/30 border border-border/40 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/30 transition-colors"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-[12px] font-medium">
                <ChevronsUpDown className="w-3.5 h-3.5" />
                {currentSortLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {sortOptions.map(opt => (
                <DropdownMenuItem
                  key={opt.key}
                  onClick={() => setSortKey(opt.key)}
                  className="text-[12px]"
                >
                  <span className="flex-1">{opt.label}</span>
                  {sortKey === opt.key && (
                    <Check className="w-3.5 h-3.5 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={onRefresh} className="gap-1.5 h-8">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border/30 bg-card/60 p-4.5 hover:bg-card/80 transition-all duration-150">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/12 text-blue-400">
              <Share2 className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">Shared</p>
              <p className="mt-0.5 text-2xl font-bold text-foreground tabular-nums">{totalSharedCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border/30 bg-card/60 p-4.5 hover:bg-card/80 transition-all duration-150">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-400">
              <HardDrive className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">Total Shared Size</p>
              <p className="mt-0.5 text-2xl font-bold text-foreground tabular-nums">{formatFileSize(sharedSize)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border/30 bg-card/60 p-4.5 hover:bg-card/80 transition-all duration-150">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/12 text-purple-400">
              <Clock className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">Latest Shared</p>
              <p className="mt-0.5 text-sm font-medium text-foreground truncate max-w-[200px]">
                {recentlyShared ? recentlyShared.name : folderShares.length > 0 ? folderShares[0].folder_name : 'No shared items yet'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* File List */}
      {loadingShared ? (
        <div className="rounded-xl border border-border/30 bg-card/40 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/15">
            <div className="h-1 w-5 rounded-full bg-muted/30" />
            <div className="h-3 w-28 rounded bg-muted/20 animate-pulse" />
          </div>
          <div className="p-2 space-y-1">
            {[1,2,3].map(i => (
              <div key={i} className="flex items-center gap-3 px-4 h-12 rounded-xl animate-pulse">
                <div className="w-8 h-8 rounded-lg bg-muted/20 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/5 rounded bg-muted/20" />
                  <div className="h-2.5 w-1/4 rounded bg-muted/10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : processedFiles.length === 0 && folderShares.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-border/15 bg-card/20">
          <div className="w-14 h-14 rounded-[16px] bg-muted/50 border border-border/30 flex items-center justify-center mb-4 text-muted-foreground">
            <Share2 className="w-6 h-6" />
          </div>
          <p className="text-[15px] font-semibold text-foreground mb-1">
            {searchQuery ? 'No matching items' : 'No shared items yet'}
          </p>
          <p className="text-[13px] text-muted-foreground max-w-[280px]">
            {searchQuery
              ? 'Try a different name or clear the filter'
              : 'Share a file or folder to generate a link and manage access from one place.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/30 bg-card/40 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/15">
            <span className="w-1 h-4 rounded-full bg-primary/30" />
            <h2 className="text-[13px] font-semibold text-foreground">All Shared</h2>
            <span className="text-[11px] text-muted-foreground/50 ml-auto tabular-nums">
              {totalSharedCount} item{totalSharedCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="p-1.5 space-y-0.5">
            {folderShares.map((fs, idx) => (
              <div
                key={fs.share_id}
                style={{ animationDelay: `${idx * 30}ms` }}
                className="animate-fadeInUp flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-accent/30 cursor-pointer transition-colors"
                onClick={() => onFolderShareClick?.(fs.share_id)}
              >
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                  <Folder className="w-5 h-5 text-purple-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-foreground truncate">{fs.folder_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-muted-foreground">Folder share</span>
                    <span className="text-muted-foreground/30">·</span>
                    <span className="text-[11px] text-muted-foreground">{formatDate(fs.created_at)}</span>
                    {fs.share_views > 0 && (
                      <>
                        <span className="text-muted-foreground/30">·</span>
                        <span className="text-[11px] text-muted-foreground">{fs.share_views} views</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {processedFiles.map((f, idx) => (
              <div
                key={f.id}
                style={{ animationDelay: `${(folderShares.length + idx) * 30}ms` }}
                className="animate-fadeInUp"
              >
                <FileItemComponent
                  file={f}
                  viewMode="list"
                  onOpenInCbCode={onOpenFileInCbCode}
                  onDelete={onFileDelete}
                  onDownload={onFileDownload}
                  onShare={onFileShare}
                  onViewInfo={onViewInfo ? (file) => onViewInfo(file) : undefined}
                  onClick={onFileClick}
                  onPreview={() => onFileClick(f)}
                  onShareRevoked={onRefresh}
                  onShareChange={onRefresh}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SharedView;

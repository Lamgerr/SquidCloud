import React, { useState, useEffect, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { formatFileSize } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import type { FileItem } from '@/lib/api';
import FileItemComponent from '@/components/FileItem';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Share2, RefreshCw, Loader2,
  Folder, X, Check, ChevronsUpDown, Search,
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

/* Same spring vocabulary as the floating dock / segment */
const SPRING = { type: 'spring' as const, stiffness: 380, damping: 26, mass: 0.8 };
const TAP = { scale: 0.96 };

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  try { return formatDistanceToNow(new Date(dateStr), { addSuffix: true }); }
  catch { return ''; }
};

const SharedView: React.FC<SharedViewProps> = ({
  files, onFileDownload, onFileShare, onFileDelete,
  onFileClick, onOpenFileInCbCode, onRefresh, onViewInfo, onFolderShareClick,
}) => {
  const reduce = !!useReducedMotion();
  const [sharedIds, setSharedIds] = useState<Set<string>>(new Set());
  const [folderShares, setFolderShares] = useState<FolderShareItem[]>([]);
  const [loadingShared, setLoadingShared] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date-desc');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoadingShared(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const [fileSharesRes, folderSharesRes] = await Promise.all([
          supabase.from('shares').select('file_id').eq('user_id', user.id).is('folder_id', null),
          supabase.from('shares').select('share_id, folder_id, created_at, expires_at, is_active, share_views, download_count, folder:folders(id, name)')
            .eq('user_id', user.id).not('folder_id', 'is', null).not('share_id', 'is', null),
        ]);
        if (fileSharesRes.error) throw fileSharesRes.error;
        if (folderSharesRes.error) throw folderSharesRes.error;
        if (mounted) {
          setSharedIds(new Set((fileSharesRes.data || []).map(s => s.file_id)));
          setFolderShares((folderSharesRes.data || []).map((s: any) => ({
            share_id: s.share_id, folder_id: s.folder_id,
            folder_name: s.folder?.name || 'Folder', created_at: s.created_at,
            expires_at: s.expires_at, is_active: s.is_active,
            share_views: s.share_views || 0, download_count: s.download_count || 0,
          })));
        }
      } catch (e) { console.error('Failed to load shared files:', e); }
      finally { if (mounted) setLoadingShared(false); }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const sharedFiles = useMemo(() => {
    const merged = new Map<string, FileItem>();
    for (const f of [...files.filter(f => f.shared), ...files.filter(f => sharedIds.has(f.id))]) merged.set(f.id, f);
    return Array.from(merged.values());
  }, [files, sharedIds]);

  const totalSharedCount = sharedFiles.length + folderShares.length;
  const sharedSize = useMemo(() => sharedFiles.reduce((s, f) => s + (f.size || 0), 0), [sharedFiles]);

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

  const currentSortLabel = sortOptions.find(o => o.key === sortKey)?.label || 'Newest';
  const empty = processedFiles.length === 0 && folderShares.length === 0;

  return (
    <div className="sh-root">
      <style>{SH_CSS}</style>

      {/* One compact header — pill controls only */}
      <motion.div className="sh-head" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}>
        <h1 className="sh-title">Shared</h1>
        <div className="sh-tools">
          <div className="sh-search">
            <Search size={15} />
            <input type="text" placeholder="Filter" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)} aria-label="Filter shared items" />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear filter"><X size={13} /></button>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <motion.button type="button" className="sh-pill" whileTap={reduce ? undefined : TAP}>
                <ChevronsUpDown size={14} /><span>{currentSortLabel}</span>
              </motion.button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {sortOptions.map(opt => (
                <DropdownMenuItem key={opt.key} onClick={() => setSortKey(opt.key)} className="text-[12px]">
                  <span className="flex-1">{opt.label}</span>
                  {sortKey === opt.key && <Check className="w-3.5 h-3.5" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <motion.button type="button" className="sh-pill sh-icon" onClick={onRefresh} aria-label="Refresh" title="Refresh" whileTap={reduce ? undefined : TAP}>
            <RefreshCw size={15} />
          </motion.button>
        </div>
      </motion.div>

      {/* Numbers only — no strip, no box (matches Files tab stats) */}
      <motion.div className="sh-stats" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.04 }}>
        <span><b>{totalSharedCount}</b> links</span>
        <i aria-hidden="true" />
        <span><b>{formatFileSize(sharedSize)}</b> shared</span>
        <i aria-hidden="true" />
        <span><b>{folderShares.length}</b> folders</span>
      </motion.div>

      {loadingShared ? (
        <div className="sh-loading"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : empty ? (
        <motion.div className="sh-empty" initial={reduce ? false : { opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING}>
          <div className="sh-empty-ico"><Share2 size={22} /></div>
          <p>{searchQuery ? 'No matches' : 'Nothing shared'}</p>
        </motion.div>
      ) : (
        <motion.div className="sh-list" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.08 }}>
          {folderShares.map((fs, i) => (
            <motion.button key={fs.share_id} type="button" className="sh-row"
              onClick={() => onFolderShareClick?.(fs.share_id)}
              initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={reduce ? { duration: 0 } : { ...SPRING, delay: Math.min(i * 0.02, 0.2) }}
              whileHover={reduce ? undefined : { x: 2 }} whileTap={reduce ? undefined : TAP}>
              <span className="sh-tag"><Folder size={15} /></span>
              <span className="sh-main">
                <span className="sh-name">{fs.folder_name}</span>
                <span className="sh-meta">Folder · {formatDate(fs.created_at)}{fs.share_views > 0 ? ` · ${fs.share_views} views` : ''}</span>
              </span>
            </motion.button>
          ))}
          {processedFiles.map((f, i) => (
            <motion.div key={f.id} className="sh-file"
              initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={reduce ? { duration: 0 } : { ...SPRING, delay: Math.min((folderShares.length + i) * 0.02, 0.2) }}>
              <FileItemComponent
                file={f} viewMode="list"
                onOpenInCbCode={onOpenFileInCbCode} onDelete={onFileDelete} onDownload={onFileDownload}
                onShare={onFileShare} onViewInfo={onViewInfo ? (file) => onViewInfo(file) : undefined}
                onClick={onFileClick} onPreview={() => onFileClick(f)}
                onShareRevoked={onRefresh} onShareChange={onRefresh}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
};

export default SharedView;

const SH_CSS = `
/* All controls use the floating-dock glass tier: dark, hairline rim, circle */
.sh-root { display: flex; flex-direction: column; gap: 14px; width: 100%; max-width: 1180px; margin: 0 auto; padding: 16px 2px 96px; }
.sh-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.sh-title { font-size: 24px; font-weight: 400; letter-spacing: -0.02em; color: var(--sa-text); }
.sh-tools { display: flex; align-items: center; gap: 8px; }
.sh-search, .sh-pill { display: inline-flex; align-items: center; height: 40px; border-radius: 999px;
  border: 1px solid rgba(232,231,225,0.10); background: rgba(13,14,13,0.86);
  -webkit-backdrop-filter: blur(18px) saturate(1.4); backdrop-filter: blur(18px) saturate(1.4);
  box-shadow: inset 0 1px 0 rgba(232,231,225,0.12), 0 8px 20px -10px rgba(0,0,0,0.6);
  color: #e8e7e1; font-size: 12.5px; }
.sh-search { gap: 8px; padding: 0 14px; color: rgba(232,231,225,0.6); }
.sh-search input { width: 150px; border: 0; outline: none; background: none; color: #e8e7e1; font-size: 12.5px; }
.sh-search input::placeholder { color: rgba(232,231,225,0.45); }
.sh-search button { border: 0; background: none; color: rgba(232,231,225,0.6); cursor: pointer; display: grid; place-items: center; }
.sh-pill { gap: 7px; padding: 0 16px; cursor: pointer; }
.sh-pill:hover, .sh-search:hover { border-color: rgba(232,231,225,0.2); }
.sh-icon { width: 40px; padding: 0; justify-content: center; }
/* stats: plain text like the Files tab — no box */
.sh-stats { display: flex; align-items: center; gap: 12px; font: 400 11px/1 var(--sa-mono, ui-monospace, monospace);
  color: var(--sa-mute); letter-spacing: 0.04em; }
.sh-stats b { font-size: 14px; font-weight: 400; color: var(--sa-text); }
.sh-stats i { width: 1px; height: 12px; background: var(--sa-line); }
.sh-loading { display: grid; place-items: center; padding: 60px; color: var(--sa-mute); }
/* empty state: no box, just one circular face + one line */
.sh-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 96px 20px; text-align: center; }
.sh-empty-ico { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 999px;
  border: 1px solid rgba(232,231,225,0.10); background: rgba(13,14,13,0.86);
  -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
  box-shadow: inset 0 1px 0 rgba(232,231,225,0.12), 0 10px 24px -10px rgba(0,0,0,0.6);
  color: #e8e7e1; }
.sh-empty p { margin: 0; font-size: 13.5px; color: var(--sa-text); }
/* list: no outer box — rows are quiet hairline-separated text */
.sh-list { display: flex; flex-direction: column; }
.sh-row { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 52px; padding: 8px 10px; border: 0;
  border-bottom: 1px solid var(--sa-line); border-radius: 0; background: none; color: var(--sa-text); cursor: pointer; text-align: left; }
.sh-row:hover { background: rgba(232,231,225,0.035); }
.sh-tag { display: grid; place-items: center; width: 40px; height: 40px; flex: none; border-radius: 999px;
  border: 1px solid rgba(232,231,225,0.10); background: rgba(13,14,13,0.7); color: #e8e7e1;
  -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); }
.sh-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
.sh-name { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sh-meta { font: 400 10.5px/1 var(--sa-mono, ui-monospace, monospace); color: var(--sa-mute); }
.sh-file { border-radius: 0; border-bottom: 1px solid var(--sa-line); }
@media (max-width: 560px) { .sh-search input { width: 96px; } .sh-title { font-size: 22px; } }
@media (prefers-reduced-motion: reduce) { .sh-pill, .sh-row { transition-duration: 0.01ms !important; } }
`;

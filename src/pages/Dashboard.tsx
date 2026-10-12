/**
 * SquidCloud Enterprise Dashboard
 * - StatsPanel replaces StatsBar (no icons, modern usage panel)
 * - Squircle shapes throughout
 * - LazyFileGrid lazy loading fixed
 * - Clean professional UI/UX
 */

import React, {
  useState, useEffect, useCallback, useRef, useMemo, memo
} from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useBookmarks } from '@/hooks/use-bookmarks';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { useKeyboardShortcutsContext } from '@/components/KeyboardShortcuts';
import { haptics } from '@/utils/mobile';
import { NotesPanel, NoteCountIndicator } from '@/components/NotesPanel';
import { SquidEmbedModal } from '@/components/SquidEmbedModal';
import { cn, formatFileSize } from '@/lib/utils';
import { downloadFileWithRes54 } from '@/lib/res54';
import {
  getFiles, getAllFiles, getFolders, deleteFile,
  downloadFile, createFileShare, formatBytes,
  createFolder,
  type FileItem as FileItemType,
  type FolderItem,
} from '@/lib/api';

// UI Components
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { SettingsCard, SettingsDivider } from '@/components/SettingsRow';

// Dashboard sub-components
import FileItem from '@/components/FileItem';
import FileInfoModal from '@/components/FileInfoModal';
import EnhancedInstantPreviewModal from '@/components/EnhancedInstantPreviewModal';
import DeepReadCatalog from '@/components/DeepReadCatalog';
import DeepReadReader from '@/components/DeepReadReader';
import BackgroundUploadPanel from '@/components/BackgroundUploadPanel';
import TrashTab from '@/components/TrashTab';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import StorageTab from '@/components/StorageTab';
import Scripts from '@/pages/Scripts';
import MobileBottomNavbar from '@/components/MobileBottomNavbar';
import MobileNavHeader from '@/components/MobileNavHeader';
import { SignalsBell } from '@/components/SignalsBell';
import CreateUploadSegmented from '@/components/CreateUploadSegmented';
import { CommandPalette } from '@/components/CommandPalette';
import { backgroundUploadService } from '@/services/backgroundUpload';
import { AppStartupBiometricCheck } from '@/components/AppStartupBiometricCheck';
import DragDropUpload from '@/components/DragDropUpload';
import BulkActionsToolbar from '@/components/BulkActionsToolbar';
import { useBiometricAuthContext } from '@/contexts/BiometricAuthContext';
import StorageProviderManager from '@/components/StorageProviderManager';
import WorkspaceCollaboratorsModal, { WorkspaceRole } from '@/components/WorkspaceCollaboratorsModal';
import { WorkspaceSettingsModal } from '@/components/WorkspaceSettingsModal';
import { useSubscriptionNotifications } from '@/hooks/useSubscriptionNotifications';
import SubscriptionBanner from '@/components/SubscriptionBanner';
import SubscriptionPopup from '@/components/SubscriptionPopup';
import { downloadAndSaveBlob } from '@/utils/downloadHelper';
import { backgroundDownloadService } from '@/services/backgroundDownload';

// Enterprise components
import { EnterpriseSidebar } from '@/components/ui/EnterpriseSidebar';
import { FolderListView } from '@/components/ui/FolderRow';
import { MobileFolderList } from '@/components/ui/MobileFolderCard';
import { LazyFileGrid } from '@/components/ui/LazyFileGrid';
import { StatsPanel } from '@/components/ui/StatsPanel';
import { RecencyFadeWrapper } from '@/components/ui/RecencyFadeWrapper';
import { FileViewInfoContext } from '@/contexts/FileViewInfoContext';
import CreateFileRequestDialog from '@/components/CreateFileRequestDialog';
import ManageFileRequests from '@/components/ManageFileRequests';
import { MoveToFolderDialog } from '@/components/MoveToFolderDialog';
import { EnhancedShareDialog } from '@/components/EnhancedShareDialog';
import SharedView from '@/components/SharedView';
import Overview from '@/components/DashboardOverview';
import SquidVeilSecrets from '@/components/SquidVeilSecrets';
import SquidVeilSecretsMobile from '@/components/SquidVeilSecretsMobile';
import GitHubRepoCloneDialog from '@/components/GitHubRepoCloneDialog';
import { TabHeader } from '@/components/dashboard/TabHeader';
import { AppTheme } from '@/components/custom/squid-app';
// Icons
import {
  Search, Grid3X3, List, RefreshCw, ChevronLeft, ChevronRight,
  Home, ArrowLeft, Upload, Files, HardDrive, Share2, Folder,
  Star, CheckSquare, X, Plus, SlidersHorizontal, Trash2, BarChart3,
  FileText, Image, Video, Music, Archive, Code,
  AlertCircle, Shield, Lock, ChevronsUpDown, Check, Briefcase,
  FileStack, Users, Activity, Book, Database, Settings2, Cloud, Inbox,
  LogOut, Key, User, Clock, Loader2, Crown, LayoutGrid
} from '@/lib/icon-map';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface DashboardProps {
  defaultTab?: string;
  openUpload?: boolean;
}

interface WorkspaceItem {
  id: string;
  user_id?: string;
  name: string;
  is_default: boolean;
  created_at: string;
  storage_backend?: string;
  member_limit?: number | null;
}

type ProviderType = string;

const ACTIVE_WORKSPACE_STORAGE_KEY = 'squid_active_workspace_id';
const ACTIVE_PROVIDER_TYPE_STORAGE_KEY = 'squid_active_provider_type';
const ACTIVE_PROVIDER_ID_STORAGE_KEY = 'squid_active_provider_id';

const WORKSPACE_ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─────────────────────────────────────────────────────────
// Breadcrumb / path bar
// ─────────────────────────────────────────────────────────

const PathBar = memo(({
  currentFolder,
  onNavigate,
}: {
  currentFolder: string;
  onNavigate: (path: string) => void;
}) => {
  if (!currentFolder) return null;
  const parts = currentFolder.split('/').filter(Boolean);
  return (
    <nav aria-label="Folder path" className="flex items-center gap-0.5 text-[12px] text-muted-foreground select-none mt-1 min-w-0">
      <button
        onClick={() => onNavigate('')}
        aria-label="Root folder"
        className="hover:text-foreground transition-colors flex items-center gap-1 px-0.5 rounded"
      >
        <Home className="w-3 h-3" />
      </button>
      {parts.map((part, i) => {
        const path = parts.slice(0, i + 1).join('/');
        const isLast = i === parts.length - 1;
        return (
          <React.Fragment key={path}>
            <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/50" />
            <button
              onClick={() => !isLast && onNavigate(path)}
              aria-current={isLast ? 'page' : undefined}
              className={cn(
                'transition-colors max-w-[180px] truncate rounded px-1 py-0.5',
                isLast
                  ? 'text-foreground font-medium cursor-default'
                  : 'hover:text-foreground hover:bg-accent'
              )}
            >
              {part}
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
});
PathBar.displayName = 'PathBar';

// ─────────────────────────────────────────────────────────
// Back card
// ─────────────────────────────────────────────────────────

const BackCard = memo(({
  viewMode,
  onClick,
}: {
  viewMode: 'grid' | 'list' | 'compact';
  onClick: () => void;
}) => (
  <div
    role="button"
    tabIndex={0}
    aria-label="Go back"
    onClick={onClick}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    className={cn(
      'group relative overflow-hidden rounded-xl border border-dashed border-border bg-muted/20 text-muted-foreground',
      'transition-all duration-150 cursor-pointer select-none',
      'hover:border-foreground/30 hover:bg-muted/40 hover:text-foreground'
    )}
  >
    {viewMode === 'grid' ? (
      <div className="p-4 flex flex-col gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-background/80 border border-border/50">
          <ArrowLeft className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium">Back</p>
          <p className="text-[11px] text-muted-foreground">Up one level</p>
        </div>
      </div>
    ) : (
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-background/80 border border-border/50">
          <ArrowLeft className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium">Back</p>
        </div>
      </div>
    )}
  </div>
));
BackCard.displayName = 'BackCard';

// ─────────────────────────────────────────────────────────
// Vault entry card
// ─────────────────────────────────────────────────────────

const VaultCard = memo(({ viewMode, onClick }: any) => { return null; });
VaultCard.displayName = 'VaultCard';

// Empty state
// ─────────────────────────────────────────────────────────

const EmptyState = memo(({ searchQuery }: { searchQuery: string }) => (
  <div key={searchQuery || 'empty'} className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
    <div className="w-12 h-12 rounded-md bg-card border border-border flex items-center justify-center mb-4 text-muted-foreground">
      <Files className="w-5 h-5" />
    </div>
    <h3 className="lg-body font-medium mb-1">
      {searchQuery ? 'No files found' : 'No files here yet'}
    </h3>
    <p className="lg-caption max-w-sm">
      {searchQuery
        ? `Try a different search term or clear the filter.`
        : 'Folders help you organize your files. Use the Create & Upload buttons above to get started.'}
    </p>
    {!searchQuery && (
      <p className="lg-caption max-w-sm mt-2">Or drop files anywhere on this page.</p>
    )}
  </div>
));
EmptyState.displayName = 'EmptyState';

// ─────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────

const Dashboard: React.FC<DashboardProps> = ({ defaultTab = 'home' }) => {
  // ── State ──────────────────────────────────────────────
  const [files, setFiles]               = useState<FileItemType[]>([]);
  const [folders, setFolders]           = useState<FolderItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [totalSize, setTotalSize]       = useState(0);
  const [currentFolder, setCurrentFolder] = useState('');
  const [rawSearch, setRawSearch]       = useState('');
  const [workspaces, setWorkspaces]     = useState<WorkspaceItem[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activeWorkspaceRole, setActiveWorkspaceRole] = useState<WorkspaceRole | null>(null);
  const [workspaceManageOpen, setWorkspaceManageOpen] = useState(false);
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false);
  const searchQuery                     = useDebounce(rawSearch, 250);
  const [viewMode, setViewMode]         = useState<'grid' | 'list' | 'compact'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'grid' : 'list'
  );
  const [activeTab, setActiveTab]       = useState(defaultTab);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    typeof window !== 'undefined' &&
    localStorage.getItem('squid_sidebar_collapsed') === 'true'
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [previewFile, setPreviewFile]   = useState<FileItemType | null>(null);
  const [readingFile, setReadingFile]   = useState<FileItemType | null>(null);
  const [readingSource, setReadingSource] = useState<'local' | 'remote'>('local');
  const [fileInfoFile, setFileInfoFile] = useState<FileItemType | null>(null);
  const handleViewInfo = (f: FileItemType) => setFileInfoFile(f);
  const handleBookOpen = useCallback((f: FileItemType, source?: 'local' | 'remote') => {
    const isPdf = f.name?.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      setPreviewFile(f);
    } else {
      setReadingSource(source || 'local');
      setReadingFile(f);
    }
  }, []);
  const [shareFile, setShareFile] = useState<FileItemType | null>(null);
  const [shareFolder, setShareFolder] = useState<FolderItem | null>(null);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [moveDialogFile, setMoveDialogFile] = useState<{ ids: string[] } | null>(null);
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const [showVaultAuth, setShowVaultAuth] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  const [repoCount, setRepoCount]       = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const [fileRequestOpen, setFileRequestOpen] = useState(false);
  const [showFileRequests, setShowFileRequests] = useState(false);
  const [fileRequestsRefreshToken, setFileRequestsRefreshToken] = useState(0);
  const [isStorageManagerOpen, setIsStorageManagerOpen] = useState(false);
  const [notesPanel, setNotesPanel] = useState<{ entityId: string; entityType: 'file' | 'folder'; entityName: string } | null>(null);
  const [embedModal, setEmbedModal] = useState<{ entityId: string; entityType: 'file' | 'folder'; entityName: string } | null>(null);
  const [noteCounts, setNoteCounts] = useState<Map<string, number>>(new Map());
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [activeProviderType, setActiveProviderType] = useState<ProviderType>(() => {
    if (typeof window === 'undefined') return 'squidcloud';
    const saved = localStorage.getItem(ACTIVE_PROVIDER_TYPE_STORAGE_KEY);
    return saved || 'squidcloud';
  });
  const [activeProviderId, setActiveProviderId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACTIVE_PROVIDER_ID_STORAGE_KEY);
  });

  // ── Hooks ───────────────────────────────────────────────
  const { user, signOut, profile } = useAuth();
  const { toast }                  = useToast();
  const navigate                   = useNavigate();
  const isMobile                   = useIsMobile();
  const { verifyOperationNow }     = useBiometricAuthContext();
  const { bookmarks, isBookmarked, getColor, toggleBookmark, setColor } = useBookmarks();
  const {
    popups, banners, hasPopup, hasBanner,
    dismiss: dismissNotification, snooze: snoozeNotification,
  } = useSubscriptionNotifications();

  // ── Keyboard shortcuts ──────────────────────────────────
  useKeyboardShortcut(
    () => setIsSpotlightOpen(true),
    { key: 'k', ctrlKey: true, metaKey: true, preventDefault: true }
  );
  useKeyboardShortcut(
    () => { if (isSpotlightOpen) setIsSpotlightOpen(false); else setPreviewFile(null); },
    { key: 'Escape', preventDefault: false }
  );
  useKeyboardShortcut(
    () => selectAll(),
    { key: 'a', ctrlKey: true, metaKey: true, preventDefault: true }
  );
  useKeyboardShortcut(
    () => { if (currentFolder) handleGoBack(); },
    { key: 'z', ctrlKey: true, metaKey: true, preventDefault: true }
  );
  useKeyboardShortcut(
    () => { uploadInputRef.current?.click(); },
    { key: 'u', preventDefault: true }
  );
  useKeyboardShortcut(
    () => { handleCreateFolder(); },
    { key: 'n', preventDefault: true }
  );
  useKeyboardShortcut(
    () => { setIsSpotlightOpen(true); },
    { key: '/', preventDefault: true }
  );
  useKeyboardShortcut(
    () => { if (selectedFiles.size > 0) handleBulkDownload(); },
    { key: 'd', preventDefault: true }
  );
  useKeyboardShortcut(
    () => { if (selectedFiles.size > 0) handleBulkDelete(); },
    { key: 'Delete', preventDefault: true }
  );
  useKeyboardShortcut(
    () => {
      if (selectedFiles.size === 1) {
        const file = filteredFiles.find(f => selectedFiles.has(f.id));
        if (file) handleFileShare(file);
      } else if (selectedFiles.size > 1) {
        handleBulkShare();
      }
    },
    { key: 's', preventDefault: true }
  );
  useKeyboardShortcut(
    () => {
      if (selectedFiles.size === 1 && previewFile) {
        window.open(`/cbcode/${previewFile.parent_folder || 'current'}?file=${encodeURIComponent(previewFile.name)}`, '_blank');
      } else {
        const first = filteredFiles[0];
        if (first) window.open(`/cbcode/${first.parent_folder || 'current'}?file=${encodeURIComponent(first.name)}`, '_blank');
      }
    },
    { key: 'p', preventDefault: true }
  );
  useKeyboardShortcut(
    () => {
      if (previewFile) {
        const idx = filteredFiles.findIndex(f => f.id === previewFile.id);
        if (idx > 0) setPreviewFile(filteredFiles[idx - 1]);
      }
    },
    { key: 'ArrowLeft', preventDefault: true }
  );
  useKeyboardShortcut(
    () => {
      if (previewFile) {
        const idx = filteredFiles.findIndex(f => f.id === previewFile.id);
        if (idx < filteredFiles.length - 1) setPreviewFile(filteredFiles[idx + 1]);
      }
    },
    { key: 'ArrowRight', preventDefault: true }
  );

  // ── Derived ─────────────────────────────────────────────
  const filteredFiles = useMemo(() => {
    let result = files;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f => f.name.toLowerCase().includes(q));
    }
    if (filterMode === 'shared') {
      result = result.filter(f => f.shared);
    }
    const sorted = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'name-asc': return a.name.localeCompare(b.name);
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'date-asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'date-desc': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'size-asc': return (a.size || 0) - (b.size || 0);
        case 'size-desc': return (b.size || 0) - (a.size || 0);
        default: return 0;
      }
    });
    return sorted;
  }, [files, searchQuery, filterMode, sortBy]);

  const filteredFolders = useMemo(() => {
    let result = folders;
    if (filterMode === 'files' || filterMode === 'shared') {
      return [];
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f => f.name.toLowerCase().includes(q));
    }
    const sorted = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'name-asc': return a.name.localeCompare(b.name);
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'date-asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'date-desc': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default: return 0;
      }
    });
    return sorted;
  }, [folders, searchQuery, filterMode, sortBy]);

  const activeWorkspace = useMemo(() => {
    if (!activeWorkspaceId) return null;
    return workspaces.find(workspace => workspace.id === activeWorkspaceId) || null;
  }, [workspaces, activeWorkspaceId]);

  const canUpload = useMemo(() => {
    if (!activeWorkspaceRole) return false;
    return WORKSPACE_ROLE_RANK[activeWorkspaceRole] >= WORKSPACE_ROLE_RANK.editor;
  }, [activeWorkspaceRole]);

  const canAdministerWorkspace = useMemo(() => {
    if (!activeWorkspaceRole) return false;
    return WORKSPACE_ROLE_RANK[activeWorkspaceRole] >= WORKSPACE_ROLE_RANK.admin;
  }, [activeWorkspaceRole]);

  const canModifyItem = useCallback((ownerId?: string) => {
    if (!activeWorkspaceRole) return false;
    const rank = WORKSPACE_ROLE_RANK[activeWorkspaceRole];
    if (rank >= WORKSPACE_ROLE_RANK.admin) return true;
    if (rank >= WORKSPACE_ROLE_RANK.editor) return ownerId === user?.id;
    return false;
  }, [activeWorkspaceRole, user?.id]);

  const handleCreateBlocked = useCallback(() => {
    toast({
      title: 'Insufficient permissions',
      description: 'You need editor access to create or upload in this workspace.',
      variant: 'destructive',
    });
  }, [toast]);

  const fetchWorkspaces = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { error: defaultWorkspaceError } = await supabase.rpc('get_or_create_default_workspace', {
        p_user_id: user.id,
      });

      if (defaultWorkspaceError) {
        console.warn('Default workspace RPC failed (non-fatal):', defaultWorkspaceError);
      }

      const { data, error } = await supabase
        .from('workspaces')
        .select('id, name, is_default, created_at, user_id, storage_backend, member_limit')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      const workspaceList = (data || []) as WorkspaceItem[];
      setWorkspaces(workspaceList);

      if (workspaceList.length === 0) {
        setActiveWorkspaceId(null);
        return;
      }

      const savedWorkspaceId = typeof window !== 'undefined'
        ? localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY)
        : null;

      const initialWorkspace = workspaceList.find(workspace => workspace.id === savedWorkspaceId)
        || workspaceList.find(workspace => workspace.is_default)
        || workspaceList[0];

      if (!initialWorkspace) {
        return;
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, initialWorkspace.id);
      }

      setActiveWorkspaceId(initialWorkspace.id);
    } catch (err: any) {
      toast({
        title: 'Workspace error',
        description: err.message || 'Failed to load workspaces',
        variant: 'destructive',
      });
    }
  }, [user?.id, toast]);

  useEffect(() => {
    if (!user?.id) {
      setWorkspaces([]);
      setActiveWorkspaceId(null);
      return;
    }

    fetchWorkspaces();
  }, [user?.id, fetchWorkspaces]);

  useEffect(() => {
    if (!user?.id || !activeWorkspaceId) {
      setActiveWorkspaceRole(null);
      return;
    }

    const loadRole = async () => {
      try {
        const { data, error } = await supabase.rpc('get_workspace_role', {
          p_workspace_id: activeWorkspaceId,
          p_user_id: user.id,
        });

        if (error) {
          throw error;
        }

        setActiveWorkspaceRole(data || null);
      } catch (err: any) {
        console.error('Failed to load workspace role:', err);
        setActiveWorkspaceRole(null);
      }
    };

    void loadRole();
  }, [activeWorkspaceId, user?.id]);

  useEffect(() => {
    setWorkspaceManageOpen(false);
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!activeWorkspaceId || !user?.id) return;

    const sendHeartbeat = async () => {
      try {
        await supabase.rpc('upsert_workspace_presence', {
          p_workspace_id: activeWorkspaceId,
          p_current_file_id: previewFile?.id || null,
          p_socket_id: null,
        });
      } catch (err) {
        console.error('Failed to update workspace presence:', err);
      }
    };

    void sendHeartbeat();
    const interval = window.setInterval(sendHeartbeat, 10000);
    return () => window.clearInterval(interval);
  }, [activeWorkspaceId, previewFile?.id, user?.id]);

  const handleSwitchWorkspace = useCallback((workspaceId: string) => {
    if (workspaceId === activeWorkspaceId) return;

    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, workspaceId);
    }

    setActiveWorkspaceId(workspaceId);
    setCurrentFolder('');
    setRawSearch('');
    setSelectedFiles(new Set());
    setSelectionMode(false);
  }, [activeWorkspaceId]);

  const handleCreateWorkspace = useCallback(async () => {
    if (!user?.id) return;

    const rawName = window.prompt('Enter a name for your new workspace');
    if (!rawName) return;

    const name = rawName.trim();
    if (!name) {
      toast({
        title: 'Workspace name required',
        description: 'Please enter a valid workspace name.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('workspaces')
        .insert({
          user_id: user.id,
          name,
          is_default: false,
        })
        .select('id, name, is_default, created_at')
        .single();

      if (error) {
        throw error;
      }

      const createdWorkspace = data as WorkspaceItem;
      setWorkspaces(prev => {
        const next = [...prev, createdWorkspace];
        return next.sort((a, b) => {
          if (a.is_default !== b.is_default) {
            return a.is_default ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
      });

      if (typeof window !== 'undefined') {
        localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, createdWorkspace.id);
      }

      setActiveWorkspaceId(createdWorkspace.id);
      setCurrentFolder('');
      setRawSearch('');
      setSelectedFiles(new Set());
      setSelectionMode(false);

      toast({
        title: 'Workspace created',
        description: `Switched to ${createdWorkspace.name}`,
      });
    } catch (err: any) {
      toast({
        title: 'Unable to create workspace',
        description: err.message || 'Please try a different name.',
        variant: 'destructive',
      });
    }
  }, [user?.id, toast]);

  const persistActiveProvider = useCallback((providerType: string, providerId: string | null) => {
    setActiveProviderType(providerType);
    setActiveProviderId(providerId);

    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_PROVIDER_TYPE_STORAGE_KEY, providerType);
      if (providerId) {
        localStorage.setItem(ACTIVE_PROVIDER_ID_STORAGE_KEY, providerId);
      } else {
        localStorage.removeItem(ACTIVE_PROVIDER_ID_STORAGE_KEY);
      }
    }

    setCurrentFolder('');
    setRawSearch('');
    setSelectedFiles(new Set());
    setSelectionMode(false);
  }, []);

  const handleProviderSelect = useCallback((providerType: string, providerId: string | null) => {
    persistActiveProvider(providerType || 'squidcloud', providerId);
  }, [persistActiveProvider]);

  // ── Data fetching ────────────────────────────────────────
  const fetchFiles = useCallback(async () => {
    if (!user?.id) return;

    if (!activeWorkspaceId) {
      setFiles([]);
      setFolders([]);
      setTotalSize(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: providersData } = await supabase
        .from('storage_providers')
        .select('id, provider_type, is_default')
        .eq('user_id', user.id);

      let effectiveProviderType: ProviderType = activeProviderType;
      let effectiveProviderId: string | null = activeProviderId;

      if (effectiveProviderType !== 'squidcloud' && effectiveProviderId) {
        const matchedProvider = (providersData || []).find((p: any) => p.id === effectiveProviderId && p.is_enabled !== false);

        if (!matchedProvider) {
          effectiveProviderType = 'squidcloud';
          effectiveProviderId = null;
          setActiveProviderType('squidcloud');
          setActiveProviderId(null);
          if (typeof window !== 'undefined') {
            localStorage.setItem(ACTIVE_PROVIDER_TYPE_STORAGE_KEY, 'squidcloud');
            localStorage.removeItem(ACTIVE_PROVIDER_ID_STORAGE_KEY);
          }
        }
      }

      let query: any = supabase
        .from('files')
        .select('*')
        .eq('workspace_id', activeWorkspaceId)
        .eq('is_deleted', false);

      if (effectiveProviderType === 'squidcloud') {
        query = query.is('storage_provider_id', null);
      } else if (effectiveProviderId) {
        query = query.eq('storage_provider_id', effectiveProviderId);
      } else {
        query = query.eq('storage_provider_id', '00000000-0000-0000-0000-000000000000');
      }

      if (currentFolder) {
        query = query.eq('parent_folder', currentFolder);
      } else {
        query = query.is('parent_folder', null);
      }

      const { data: filesData, error: filesError } = await query.order('created_at', { ascending: false });
      if (filesError) throw filesError;

      const unified = (filesData || []).map(f => ({
        ...f,
        content_type: f.type,
        file_path: f.storage_path,
      }));
      setFiles(unified);
      setTotalSize(unified.reduce((a, f) => a + (f.size || 0), 0));

      let folderQuery: any = supabase
        .from('folders')
        .select('*')
        .eq('workspace_id', activeWorkspaceId)
        .order('created_at', { ascending: false });

      if (effectiveProviderType === 'squidcloud') {
        folderQuery = folderQuery.is('storage_provider_id', null);
      } else if (effectiveProviderId) {
        folderQuery = folderQuery.eq('storage_provider_id', effectiveProviderId);
      } else {
        folderQuery = folderQuery.eq('storage_provider_id', '00000000-0000-0000-0000-000000000000');
      }

      const { data: foldersData, error: foldersError } = await folderQuery;
      if (foldersError) throw foldersError;

      const fetchedFolders = (foldersData || []).filter((folder: any) => {
        if (!currentFolder) return !folder.parent_folder || folder.parent_folder === '';
        return folder.parent_folder === currentFolder;
      });
      setFolders(fetchedFolders as FolderItem[]);
    } catch (err: any) {
      setError(err.message || 'Failed to load files');
      toast({
        title: 'Error',
        description: err.message || 'Failed to load files',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, activeWorkspaceId, currentFolder, activeProviderType, activeProviderId, toast]);

  useEffect(() => { if (user) fetchFiles(); }, [user, fetchFiles]);

  // Onboarding / repo check
  useEffect(() => {
    const check = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('repo_count, onboarding_complete')
        .eq('id', user.id)
        .single();
      setRepoCount(data?.repo_count || 0);
    };
    check();
  }, [user]);

  // Re-fetch after background upload completes; surface failures loudly
  // so a blocked upload is never silent.
  useEffect(() => {
    let wasActive = false;
    const notifiedFailed = new Set<string>();
    const unsub = backgroundUploadService.subscribe(tasks => {
      const hasCompleted = tasks.some(t => t.status === 'completed');
      const hasActive    = tasks.some(t => t.status === 'uploading' || t.status === 'pending');
      if (hasActive) wasActive = true;
      if (wasActive && hasCompleted && !hasActive) {
        wasActive = false;
        const count = tasks.filter(t => t.status === 'completed').length;
        toast({ title: 'Upload complete', description: `${count} file(s) uploaded successfully` });
        setTimeout(fetchFiles, 800);
      }
      for (const t of tasks) {
        if (t.status === 'failed' && !notifiedFailed.has(t.id)) {
          notifiedFailed.add(t.id);
          toast({
            title: `Upload failed: ${t.file?.name || 'file'}`,
            description: t.error || 'Upload failed. Open the upload panel to retry.',
            variant: 'destructive',
          });
        }
      }
    });
    return unsub;
  }, [fetchFiles, toast]);

  // Sidebar collapse persistence
  const handleToggleCollapse = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('squid_sidebar_collapsed', String(next));
      return next;
    });
  }, []);

  // ── Navigation ───────────────────────────────────────────
  const handleNavigateTo = useCallback((path: string) => {
    setCurrentFolder(path);
    setRawSearch('');
    setSelectedFiles(new Set());
    setSelectionMode(false);
  }, []);

  const handleGoBack = useCallback(() => {
    haptics.light();
    if (!currentFolder) return;
    const parts = currentFolder.split('/').filter(Boolean);
    parts.pop();
    handleNavigateTo(parts.join('/'));
  }, [currentFolder, handleNavigateTo]);

  const handleOpenFolder = useCallback((folder: FolderItem) => {
    haptics.light();
    handleNavigateTo(folder.path);
  }, [handleNavigateTo]);

  const openCbCode = useCallback((folderId: string | null, fileName?: string) => {
    const targetFolder = folderId || 'current';
    sessionStorage.setItem('cbcode_last_folder', targetFolder);
    const query = fileName ? `?file=${encodeURIComponent(fileName)}` : '';
    navigate(`/cbcode/${targetFolder}${query}`);
  }, [navigate]);

  const handleOpenFolderInCbCode = useCallback((folder: FolderItem) => {
    openCbCode(folder.id);
  }, [openCbCode]);

  const handleCreateFolder = useCallback(async () => {
    if (!canUpload) {
      handleCreateBlocked();
      return;
    }
    const name = window.prompt('Folder name');
    if (!name || !name.trim()) return;
    try {
      await createFolder(name.trim(), currentFolder);
      await fetchFiles();
      toast({ title: 'Folder created', description: name.trim() });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  }, [canUpload, currentFolder, handleCreateBlocked, fetchFiles, toast]);

  const handleOpenFileInCbCode = useCallback((file: FileItemType) => {
    openCbCode(file.parent_folder || null, file.name);
  }, [openCbCode]);

  // ── File actions ─────────────────────────────────────────
  const handleFileClick = useCallback((file: FileItemType) => {
    if (selectionMode) {
      setSelectedFiles(prev => {
        const next = new Set(prev);
        if (next.has(file.id)) {
          next.delete(file.id);
        } else {
          next.add(file.id);
        }
        return next;
      });
      return;
    }
    setPreviewFile(file);
  }, [selectionMode]);

  const handleFileDownload = useCallback(async (file: FileItemType) => {
    haptics.medium();
    const taskId = `download_${file.id}_${Date.now()}`;
    backgroundDownloadService.startTask({
      id: taskId,
      fileName: file.name,
      fileSize: file.size || 0,
    });

    try {
      let blob: Blob;
      if (file.encrypted && file.storage_path === 'res54_distributed') {
        blob = await downloadFileWithRes54(
          file.id,
          (progress) => {
            backgroundDownloadService.updateProgress(taskId, progress);
          },
          {
            reason: 'download',
            fileName: file.name,
          }
        );
      } else {
        blob = await downloadFile(file.id, (progress) => {
          backgroundDownloadService.updateProgress(taskId, progress);
        });
      }
      await downloadAndSaveBlob(blob, file.name);
      backgroundDownloadService.completeTask(taskId);
      toast({ title: 'Download complete', description: 'Your file has been downloaded.' });
    } catch (e: any) {
      backgroundDownloadService.failTask(taskId, e.message);
      toast({ title: 'Download failed', description: e.message, variant: 'destructive' });
    }
  }, [toast]);

  const handleFileDelete = useCallback(async (file: FileItemType) => {
    haptics.heavy();
    if (!canModifyItem(file.user_id)) {
      const rank = activeWorkspaceRole ? WORKSPACE_ROLE_RANK[activeWorkspaceRole] : 0;
      toast({
        title: 'Action not allowed',
        description: rank >= WORKSPACE_ROLE_RANK.editor
          ? 'Only admins can delete other members\' files.'
          : 'You need editor access to delete files in this workspace.',
        variant: 'destructive',
      });
      return;
    }
    if (!confirm(`Move "${file.name}" to trash?`)) return;

    const authorized = await verifyOperationNow('delete_files');
    if (!authorized) {
      toast({ title: 'PIN required', description: 'PIN verification is required to delete files', variant: 'destructive' });
      return;
    }

    try {
      const { error: rpcError } = await supabase.rpc('move_to_trash_secure', { file_uuid: file.id });
      
      if (rpcError) {
        const { error: directError } = await supabase
          .from('files')
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            original_parent_folder: currentFolder || null,
          })
          .eq('id', file.id);
        if (directError) throw new Error(directError.message || 'Failed to move file to trash');
      }
      
      setFiles(prev => prev.filter(f => f.id !== file.id));
      setTotalSize(prev => prev - (file.size || 0));
      if (previewFile?.id === file.id) setPreviewFile(null);
      toast({ title: 'Moved to trash', description: file.name });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  }, [activeWorkspaceRole, canModifyItem, previewFile, toast, verifyOperationNow]);

  const handleFileShare = useCallback((file: FileItemType) => {
    setShareFile(file);
  }, []);

  const handleFolderShare = useCallback((folder: FolderItem) => {
    setShareFolder(folder);
  }, []);

  const handleFileMoveToFolder = useCallback((file: FileItemType) => {
    setMoveDialogFile({ ids: [file.id] });
  }, []);

  const handleFolderDelete = useCallback(async (folder: FolderItem) => {
    if (!canModifyItem(folder.user_id)) {
      const rank = activeWorkspaceRole ? WORKSPACE_ROLE_RANK[activeWorkspaceRole] : 0;
      toast({
        title: 'Action not allowed',
        description: rank >= WORKSPACE_ROLE_RANK.editor
          ? 'Only admins can delete other members\' folders.'
          : 'You need editor access to delete folders in this workspace.',
        variant: 'destructive',
      });
      return;
    }
    if (!confirm(`Delete "${folder.name}" and all its contents?`)) return;

    const authorized = await verifyOperationNow('delete_files');
    if (!authorized) {
      toast({ title: 'PIN required', description: 'PIN verification is required to delete folders', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase.rpc('delete_folder_secure', { folder_uuid: folder.id });
      if (error) {
        throw new Error(error.message || 'Failed to delete folder');
      }
      setFolders(prev => prev.filter(f => f.id !== folder.id));
      toast({ title: 'Folder deleted', description: folder.name });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  }, [activeWorkspaceRole, canModifyItem, toast, verifyOperationNow]);

  const onFolderMove = useCallback((folder: FolderItem) => {
    setMoveDialogFile({ ids: [folder.id], folderId: folder.id });
  }, []);

  // ── Selection / Bulk ─────────────────────────────────────
  const clearSelection = useCallback(() => {
    setSelectedFiles(new Set());
    setSelectionMode(false);
  }, []);

  const handleToggleSelect = useCallback((fileId: string) => {
    if (!selectionMode) {
      setSelectionMode(true);
    }
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }, [selectionMode]);

  const selectAll = useCallback(() => {
    setSelectedFiles(new Set(filteredFiles.map(f => f.id)));
  }, [filteredFiles]);

  const handleBulkDelete = useCallback(async () => {
    const toDelete = filteredFiles.filter(f => selectedFiles.has(f.id));
    if (toDelete.length === 0) return;

    if (!activeWorkspaceRole || WORKSPACE_ROLE_RANK[activeWorkspaceRole] < WORKSPACE_ROLE_RANK.editor) {
      toast({
        title: 'Action not allowed',
        description: 'You need editor access to delete files in this workspace.',
        variant: 'destructive',
      });
      return;
    }

    const canDeleteAll = WORKSPACE_ROLE_RANK[activeWorkspaceRole] >= WORKSPACE_ROLE_RANK.admin;
    const deletable = canDeleteAll ? toDelete : toDelete.filter(f => f.user_id === user?.id);

    if (deletable.length === 0) {
      toast({
        title: 'Action not allowed',
        description: 'Only admins can delete other members\' files.',
        variant: 'destructive',
      });
      return;
    }

    if (!confirm(`Delete ${deletable.length} file(s)?`)) return;

    const authorized = await verifyOperationNow('delete_files');
    if (!authorized) {
      toast({ title: 'PIN required', description: 'PIN verification is required to delete files', variant: 'destructive' });
      return;
    }

    try {
      await Promise.all(deletable.map(f => deleteFile(f.id)));
      const deletableIds = new Set(deletable.map(f => f.id));
      setFiles(prev => prev.filter(f => !deletableIds.has(f.id)));
      clearSelection();
      toast({ title: 'Deleted', description: `${deletable.length} files deleted` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  }, [activeWorkspaceRole, filteredFiles, selectedFiles, clearSelection, toast, user?.id, verifyOperationNow]);

  const handleBulkDownload = useCallback(async () => {
    const toDownload = filteredFiles.filter(f => selectedFiles.has(f.id));
    if (toDownload.length === 1) return handleFileDownload(toDownload[0]);
    toast({ title: 'Downloading...', description: `Preparing ${toDownload.length} files` });
    for (const f of toDownload) await handleFileDownload(f);
    clearSelection();
  }, [filteredFiles, selectedFiles, handleFileDownload, clearSelection, toast]);

  const handleBulkShare = useCallback(async () => {
    const toShare = filteredFiles.filter(f => selectedFiles.has(f.id));
    const authorized = await verifyOperationNow('create_share');
    if (!authorized) {
      toast({ title: 'PIN required', description: 'PIN verification is required to create shares', variant: 'destructive' });
      return;
    }

    const links: string[] = [];
    for (const f of toShare) {
      try {
        const { shareUrl } = await createFileShare(f.id);
        links.push(`${f.name}: ${shareUrl}`);
      } catch { /* skip */ }
    }
    await navigator.clipboard.writeText(links.join('\n'));
    toast({ title: 'Links copied', description: `${links.length} share links copied` });
    clearSelection();
  }, [filteredFiles, selectedFiles, clearSelection, toast, verifyOperationNow]);

  // ── Drag & Drop ──────────────────────────────────────────
  const handleFilesDropped = useCallback(async (droppedFiles: File[], folderPath?: string) => {
    if (!canUpload) {
      handleCreateBlocked();
      return;
    }
    const target = folderPath || currentFolder;
    const folderCache = new Map<string, string>();

    for (const f of droppedFiles) {
      const filePath = (f as any).path;
      let uploadTarget = target;

      if (filePath) {
        const parts = filePath.split('/');
        parts.pop();
        if (parts.length > 0) {
          const cacheKey = parts.join('/');
          if (folderCache.has(cacheKey)) {
            uploadTarget = folderCache.get(cacheKey)!;
          } else {
            let parentFolder = target;
            for (let i = 0; i < parts.length; i++) {
              const subKey = parts.slice(0, i + 1).join('/');
              if (folderCache.has(subKey)) {
                parentFolder = folderCache.get(subKey)!;
                continue;
              }
              try {
                const created = await createFolder(parts[i], parentFolder);
                parentFolder = created.path || `${parentFolder ? parentFolder + '/' : ''}${parts[i]}`;
                folderCache.set(subKey, parentFolder);
              } catch {
                break;
              }
            }
            uploadTarget = parentFolder;
            folderCache.set(cacheKey, uploadTarget);
          }
        }
      }

      await backgroundUploadService.addTask(f, uploadTarget);
    }
    toast({ title: `${droppedFiles.length} file(s) queued`, description: 'Uploading in background...' });
  }, [canUpload, currentFolder, handleCreateBlocked, toast]);

  const handleMobileQuickUpload = useCallback(() => {
    if (!canUpload) {
      handleCreateBlocked();
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;

    input.onchange = async () => {
      const selectedFiles = Array.from(input.files || []);
      if (selectedFiles.length === 0) return;

      try {
        for (const selectedFile of selectedFiles) {
          await backgroundUploadService.addTask(selectedFile, currentFolder || '');
        }

        toast({
          title: `${selectedFiles.length} file(s) queued`,
          description: 'Uploading in background...',
        });
      } catch (error: any) {
        toast({
          title: 'Upload failed',
          description: error?.message || 'Could not queue files for upload',
          variant: 'destructive',
        });
      }
    };

    input.click();
  }, [canUpload, currentFolder, handleCreateBlocked, toast]);

  // ── Adjacent files for preview navigation ────────────────
  const findAdjacent = useCallback((file: FileItemType) => {
    const i = filteredFiles.findIndex(f => f.id === file.id);
    return {
      previous: i > 0 ? filteredFiles[i - 1] : null,
      next: i < filteredFiles.length - 1 ? filteredFiles[i + 1] : null,
    };
  }, [filteredFiles]);

  const previewAdjacents = useMemo(() => {
    if (!previewFile) {
      return { previous: null as FileItemType | null, next: null as FileItemType | null };
    }
    return findAdjacent(previewFile);
  }, [previewFile, findAdjacent]);

  const handleOpenNotes = useCallback((file: FileItemType) => {
    setNotesPanel({
      entityId: file.id,
      entityType: 'file',
      entityName: file.name,
    });
  }, []);

  const handleOpenEmbed = useCallback((file: FileItemType) => {
    setEmbedModal({
      entityId: file.id,
      entityType: 'file',
      entityName: file.name,
    });
  }, []);

  const previewCurrentIndex = useMemo(() => {
    if (!previewFile) return -1;
    return filteredFiles.findIndex(f => f.id === previewFile.id);
  }, [previewFile, filteredFiles]);

  const previewSiblingFiles = useMemo(
    () => filteredFiles.map(f => ({ id: f.id, name: f.name, type: f.type, size: f.size })),
    [filteredFiles]
  );

  // ─────────────────────────────────────────────────────────
  // Mobile layout
  // ─────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <FileViewInfoContext.Provider value={handleViewInfo}>
      <AppTheme />
      <AppStartupBiometricCheck>
        <DragDropUpload
          onFilesDropped={handleFilesDropped}
          onDragStateChange={setIsDragActive}
          currentFolder={currentFolder}
          allowFolderUpload
        >
          <div className="min-h-screen bg-background">
            <MobileNavHeader
              onSearchClick={() => setIsSpotlightOpen(true)}
              onMenuClick={() => setMobileSidebarOpen(true)}
              title={
                activeTab === 'files'
                  ? 'My Files'
                  : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)
              }
            />

            {banners.map(b => (
              <SubscriptionBanner
                key={b.id}
                notification={b}
                onDismiss={dismissNotification}
                onSnooze={snoozeNotification}
              />
            ))}

            <main className="px-3 pb-24 pt-2">
              {activeTab === 'home' && (
                <Overview
                  files={files}
                  folders={folders}
                  totalSize={totalSize}
                  displayName={profile?.full_name || user?.email?.split('@')[0] || 'there'}
                  planLabel={profile?.is_premium ? (profile?.tier === 'supporter-plus' ? 'Supporter+' : 'Supporter') : 'Free'}
                  onFileClick={handleFileClick}
                  onOpenFolder={handleOpenFolder}
                  onGoToTab={(t) => { setActiveTab(t); }}
                  onSearchOpen={() => setIsSpotlightOpen(true)}
                  onFilterChange={setFilterMode}
                  activeFilter={filterMode}
                />
              )}

              {activeTab === 'files' && (
                <MobileFilesView
                  loading={loading}
                  currentFolder={currentFolder}
                  filteredFolders={filteredFolders}
                  filteredFiles={filteredFiles}
                  filesCount={files.length}
                  foldersCount={folders.length}
                  totalSize={totalSize}
                  workspaceName={activeWorkspace?.name}
                  searchQuery={searchQuery}
                  viewMode={viewMode}
                  setViewMode={setViewMode}
                  onRefresh={fetchFiles}
                  onGoBack={handleGoBack}
                  onOpenFolder={handleOpenFolder}
                  onOpenFolderInCbCode={handleOpenFolderInCbCode}
                  onFileClick={handleFileClick}
                  onOpenFileInCbCode={handleOpenFileInCbCode}
                  onFileDownload={handleFileDownload}
                  onFileDelete={handleFileDelete}
                  onFileShare={handleFileShare}
                  onFileMoveToFolder={handleFileMoveToFolder}
                  onFolderDelete={handleFolderDelete}
                  onFolderShare={handleFolderShare}
                  onVaultOpen={() => setShowVaultAuth(true)}
                  bookmarks={bookmarks}
                  getColor={getColor}
                  isBookmarked={isBookmarked}
                  onToggleBookmark={toggleBookmark}
                  onSetColor={setColor}
                  selectionMode={selectionMode}
                  selectedFiles={selectedFiles}
                  onToggleSelection={() => {
                    setSelectionMode(!selectionMode);
                    setSelectedFiles(new Set());
                  }}
                  onToggleSelect={handleToggleSelect}
                  onFileCreated={fetchFiles}
                  onUploadComplete={fetchFiles}
                  onViewInfo={handleViewInfo}
                  onCreateFolder={handleCreateFolder}
                  onNotes={handleOpenNotes}
                  onEmbed={handleOpenEmbed}
                />
              )}

              {activeTab === 'trash' && (
                <div className="rounded-lg border border-border/50 bg-card/80 p-3">
                  <div className="sq-tab-enter">
                  <TrashTab workspaceId={activeWorkspaceId} />
                  </div>
                </div>
              )}

              {activeTab === 'analytics' && (
                <div className="sq-tab-enter">
                <AnalyticsDashboard />
                </div>
              )}
              {activeTab === 'secrets' && (
                <div className="sq-tab-enter">
                <SquidVeilSecretsMobile />
                </div>
              )}
              {activeTab === 'file-requests' && (
                profile?.is_premium ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-border/50 bg-card/80 p-3">
                      <div className="flex items-center justify-between mb-3">
                        <div className="min-w-0">
                          <h2 className="text-sm font-semibold text-foreground">File Requests</h2>
                          <p className="text-xs text-muted-foreground mt-0.5">Public upload links for anyone to submit files.</p>
                        </div>
                        <Button size="sm" onClick={() => setFileRequestOpen(true)} className="gap-1.5 h-8">
                          <Plus className="w-3.5 h-3.5" />
                          New
                        </Button>
                      </div>
                      <ManageFileRequests refreshToken={fileRequestsRefreshToken} />
                    </div>
                    <CreateFileRequestDialog
                      open={fileRequestOpen}
                      onClose={() => setFileRequestOpen(false)}
                      currentFolder={currentFolder}
                      onCreated={() => {
                        setFileRequestOpen(false);
                        setShowFileRequests(true);
                        setFileRequestsRefreshToken(prev => prev + 1);
                      }}
                    />
                  </div>
                ) : (
                  <div className="pt-8 px-4 text-center">
                    <div className="rounded-lg border border-border/40 bg-card p-6">
                      <div className="w-10 h-10 rounded-md border border-border bg-muted flex items-center justify-center mx-auto mb-3">
                        <Crown className="h-5 w-5 text-foreground" />
                      </div>
                      <h3 className="text-sm font-bold text-foreground mb-1">Supporter feature</h3>
                      <p className="text-xs text-muted-foreground mb-4 max-w-xxs mx-auto">
                        Upgrade to create unlimited public file upload links.
                      </p>
                      <Button size="sm" onClick={() => navigate('/pricing')} className="rounded-xl">
                        <Crown className="h-3.5 w-3.5 mr-1.5" /> See Plans
                      </Button>
                    </div>
                  </div>
                )
              )}

              {activeTab === 'shared' && (
                <div className="sq-tab-enter">
                <SharedView
                  files={files}
                  onFileDownload={handleFileDownload}
                  onFileShare={handleFileShare}
                  onFileDelete={handleFileDelete}
                  onFileClick={handleFileClick}
                  onOpenFileInCbCode={handleOpenFileInCbCode}
                  onRefresh={fetchFiles}
                  onViewInfo={handleViewInfo}
                  onFolderShareClick={(shareId) => window.open(`/s/${shareId}`, '_blank')}
                />
                </div>
              )}
              {activeTab === 'books' && (
                <div className="sq-tab-enter">
                <DeepReadCatalog
                  files={files}
                  onBookOpen={handleBookOpen}
                  onSaved={fetchFiles}
                />
                </div>
              )}

              {activeTab === 'settings' && (
                <SettingsCard>
                  <button onClick={() => navigate('/settings/account')} className="flex w-full items-center gap-2.5 px-3 h-10 hover:bg-accent/50 text-left transition-colors group">
                    <User className="w-4 h-4 text-muted-foreground/70 flex-shrink-0" />
                    <span className="text-[13px] flex-1 font-medium text-foreground">Account</span>
                    <span className="text-[11px] text-muted-foreground/50">Profile, password &amp; passkey</span>
                    <ChevronRight className="w-3 h-3 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <SettingsDivider />
                  <button onClick={() => navigate('/developer-api')} className="flex w-full items-center gap-2.5 px-3 h-10 hover:bg-accent/50 text-left transition-colors group">
                    <Key className="w-4 h-4 text-muted-foreground/70 flex-shrink-0" />
                    <span className="text-[13px] flex-1 font-medium text-foreground">API Keys</span>
                    <span className="text-[11px] text-muted-foreground/50">Webhooks &amp; developer tools</span>
                    <ChevronRight className="w-3 h-3 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <SettingsDivider />
                  <button onClick={signOut} className="flex w-full items-center gap-2.5 px-3 h-10 hover:bg-destructive/10 text-left transition-colors group rounded-b-2xl">
                    <LogOut className="w-4 h-4 text-destructive/70 flex-shrink-0" />
                    <span className="text-[13px] flex-1 font-medium text-destructive">Sign out</span>
                    <span className="text-[11px] text-destructive/50">End current session</span>
                    <ChevronRight className="w-3 h-3 text-destructive/30 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </SettingsCard>
              )}
            </main>

            <MobileBottomNavbar
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onUploadClick={handleMobileQuickUpload}
              createDisabled={!canUpload}
              onCreateDisabled={handleCreateBlocked}
              currentPath={currentFolder}
              onFileCreated={fetchFiles}
            />

            <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
              <SheetContent
                side="left"
                className="w-[82vw] max-w-[320px] border-r border-border/50 bg-background p-0"
              >
                <div className="flex h-full flex-col">
                  <div className="border-b border-border/40 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)]">
                    <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Workspace</p>
                    <p className="mt-1 truncate text-sm font-medium text-foreground">
                      {activeWorkspace?.name || 'Default workspace'}
                    </p>
                  </div>

                  <div data-scroll-container="true" className="flex-1 overscroll-y-contain overflow-y-auto px-3 py-3">
                    <div className="space-y-1">
                      {[
                        { id: 'home', label: 'Home', icon: Home },
                        { id: 'files', label: 'Files', icon: FileStack },
                        { id: 'shared', label: 'Shared', icon: Users },
                        { id: 'books', label: 'Books', icon: Book },
                        { id: 'trash', label: 'Trash', icon: Trash2 },
                        { id: 'file-requests', label: 'File Requests', icon: Inbox },
                      ].map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setActiveTab(item.id);
                              setMobileSidebarOpen(false);
                            }}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150 active:scale-[0.97]',
                              isActive
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            {item.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-4 px-1 pb-1.5">
                      <p className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-widest">Tools</p>
                    </div>
                    <div className="space-y-1">
                      {[
                        { id: 'analytics', label: 'Analytics', icon: Activity },
                        { id: 'secrets', label: 'Secrets', icon: Lock },
                        { id: 'settings', label: 'Settings', icon: Settings2, link: '/settings/account' },
                      ].map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              if (item.link) { navigate(item.link); setMobileSidebarOpen(false); return; }
                              setActiveTab(item.id);
                              setMobileSidebarOpen(false);
                            }}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150 active:scale-[0.97]',
                              isActive
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            {item.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 px-1">
                        <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Storage provider</p>
                      </div>
                      <button
                        onClick={() => {
                          setIsStorageManagerOpen(true);
                          setMobileSidebarOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-all duration-150 active:scale-[0.97] bg-primary/5 text-primary"
                      >
                        <div className="flex items-center gap-2">
                          <HardDrive className="h-3.5 w-3.5" />
                          <span className="truncate">Manage Providers</span>
                        </div>
                        <span className="text-[10px]">{activeProviderType === 'squidcloud' ? 'Default' : 'Custom'}</span>
                      </button>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between px-1">
                        <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Workspaces</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            handleCreateWorkspace();
                            setMobileSidebarOpen(false);
                          }}
                          className="h-7 rounded-lg px-2 text-xs transition-all duration-150"
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          New
                        </Button>
                      </div>

                      {activeWorkspaceId && canAdministerWorkspace && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setWorkspaceManageOpen(true);
                            setMobileSidebarOpen(false);
                          }}
                          className="h-7 w-full justify-start rounded-lg px-2 text-xs text-muted-foreground transition-all duration-150"
                        >
                          <Users className="mr-1.5 h-3.5 w-3.5" />
                          Collaborators
                        </Button>
                      )}
                      {activeWorkspaceId && canAdministerWorkspace && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setWorkspaceSettingsOpen(true);
                            setMobileSidebarOpen(false);
                          }}
                          className="h-7 w-full justify-start rounded-lg px-2 text-xs text-muted-foreground transition-all duration-150"
                        >
                          <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                          Settings
                        </Button>
                      )}

                      <div className="mt-2 space-y-1.5">
                        {workspaces.map((workspace) => {
                          const isActive = workspace.id === activeWorkspaceId;
                          return (
                            <button
                              key={workspace.id}
                              onClick={() => {
                                handleSwitchWorkspace(workspace.id);
                                setMobileSidebarOpen(false);
                              }}
                              className={cn(
                                'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-all duration-150 active:scale-[0.97]',
                                isActive
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                              )}
                            >
                              <span className="truncate">{workspace.name}</span>
                              {isActive && <Check className="h-3.5 w-3.5" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* ── Mobile Modals ── */}
          {previewFile && (
            <EnhancedInstantPreviewModal
              file={previewFile}
              isOpen={!!previewFile}
              onClose={() => setPreviewFile(null)}
              onDownload={() => handleFileDownload(previewFile)}
              onShare={() => handleFileShare(previewFile)}
              onNext={() => {
                if (previewAdjacents.next) setPreviewFile(previewAdjacents.next);
              }}
              onPrevious={() => {
                if (previewAdjacents.previous) setPreviewFile(previewAdjacents.previous);
              }}
              hasNext={!!previewAdjacents.next}
              hasPrevious={!!previewAdjacents.previous}
              currentIndex={previewCurrentIndex >= 0 ? previewCurrentIndex : undefined}
              totalFiles={filteredFiles.length}
              siblingFiles={previewSiblingFiles}
              onNavigateToFile={(target) => {
                const selected = filteredFiles.find(f => f.id === target.id);
                if (selected) setPreviewFile(selected);
              }}
              onOpenEpubReader={(f) => { setPreviewFile(null); setReadingFile(f); }}
            />
          )}

          <CommandPalette
            open={isSpotlightOpen}
            onOpenChange={setIsSpotlightOpen}
            files={filteredFiles}
            folders={filteredFolders.map(folder => ({ id: folder.id, name: folder.name, path: folder.path || '' }))}
            onOpenFile={(file) => {
              const selected = filteredFiles.find(f => f.id === file.id);
              if (selected) setPreviewFile(selected);
            }}
            onNavigateToFiles={() => setActiveTab('files')}
            onNavigateToShared={() => setActiveTab('shared')}
            onNavigateToTrash={() => setActiveTab('trash')}
            onNavigateToAnalytics={() => setActiveTab('analytics')}
            onNavigateToSettings={() => navigate('/settings/account')}
            onNavigateToAccount={() => navigate('/settings/account')}
            onNavigateToDeveloperApi={() => navigate('/developer-api')}
            onNavigateToFolder={handleNavigateTo}
            onSetViewMode={setViewMode}
            currentViewMode={viewMode}
            selectedFilesCount={selectedFiles.size}
          />

          <StorageProviderManager
            isOpen={isStorageManagerOpen}
            onClose={() => setIsStorageManagerOpen(false)}
            activeProviderType={activeProviderType}
            activeProviderId={activeProviderId}
            onProviderSelect={handleProviderSelect}
          />

          <WorkspaceCollaboratorsModal
            open={workspaceManageOpen}
            onClose={() => setWorkspaceManageOpen(false)}
            workspaceId={activeWorkspaceId}
            workspaceName={activeWorkspace?.name || 'Workspace'}
            currentRole={activeWorkspaceRole}
            currentUserId={user?.id || ''}
          />
          <WorkspaceSettingsModal
            open={workspaceSettingsOpen}
            onClose={() => setWorkspaceSettingsOpen(false)}
            workspaceId={activeWorkspaceId}
            workspaceName={activeWorkspace?.name || 'Workspace'}
            currentRole={activeWorkspaceRole}
            currentUserId={user?.id || ''}
            onWorkspaceUpdated={(newName) => {
              setWorkspaces(prev => prev.map(w =>
                w.id === activeWorkspaceId ? { ...w, name: newName } : w
              ));
            }}
            onWorkspaceDeleted={() => {
              setWorkspaces(prev => prev.filter(w => w.id !== activeWorkspaceId));
              if (typeof window !== 'undefined') {
                localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
              }
              setActiveWorkspaceId(null);
              setActiveWorkspaceRole(null);
            }}
          />
        </DragDropUpload>

        <input
          ref={uploadInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={async (e) => {
            const files = e.target.files;
            if (!files || !canUpload) return;
            for (const f of Array.from(files)) {
              await backgroundUploadService.addTask(f, currentFolder || '');
            }
            toast({ title: `${files.length} file(s) queued`, description: 'Uploading in background...' });
            e.target.value = '';
          }}
        />

        {notesPanel && (
          <NotesPanel
            open={!!notesPanel}
            onClose={() => setNotesPanel(null)}
            entityId={notesPanel.entityId}
            entityType={notesPanel.entityType}
            entityName={notesPanel.entityName}
            onNoteCountChange={(count) => {
              setNoteCounts(prev => {
                const next = new Map(prev);
                next.set(notesPanel.entityId, count);
                return next;
              });
            }}
          />
        )}

        {embedModal && (
          <SquidEmbedModal
            open={!!embedModal}
            onClose={() => setEmbedModal(null)}
            entityId={embedModal.entityId}
            entityType={embedModal.entityType}
            entityName={embedModal.entityName}
          />
        )}
        {popups.map(p => (
          <SubscriptionPopup
            key={p.id}
            notification={p}
            onDismiss={dismissNotification}
          />
        ))}
        {readingFile && (
          <DeepReadReader
            file={readingFile}
            source={readingSource}
            isOpen={true}
            onClose={() => setReadingFile(null)}
          />
        )}
      </AppStartupBiometricCheck>
      </FileViewInfoContext.Provider>
    );
  }

  // ─────────────────────────────────────────────────────────
  // Desktop layout
  // ─────────────────────────────────────────────────────────
  return (
    <FileViewInfoContext.Provider value={handleViewInfo}>
    <AppTheme />
    <AppStartupBiometricCheck>
      <DragDropUpload
        onFilesDropped={handleFilesDropped}
        onDragStateChange={setIsDragActive}
        currentFolder={currentFolder}
        allowFolderUpload
      >
        {/* Drop overlay */}
        {isDragActive && (
          <div className="fixed inset-0 z-[100] bg-background/75 backdrop-blur-sm flex items-center justify-center pointer-events-none" role="status" aria-live="polite">
            <div className="bg-card border border-dashed border-foreground/40 rounded-md px-12 py-10 text-center shadow-2xl">
              <Upload className="w-6 h-6 text-foreground mx-auto mb-3" />
              <p className="text-base font-medium">Drop to upload</p>
              <p className="text-sm text-muted-foreground mt-1">
                {currentFolder
                  ? `To "${currentFolder.split('/').pop()}"`
                  : 'To root'}
              </p>
            </div>
          </div>
        )}

        <div className="flex h-screen w-full overflow-hidden bg-background">
          {/* Sidebar */}
          <EnterpriseSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            sidebarCollapsed={sidebarCollapsed}
            onToggleCollapse={handleToggleCollapse}
            user={user}
            profile={profile}
            bookmarks={bookmarks}
            onSearchOpen={() => setIsSpotlightOpen(true)}
            onSignOut={signOut}
            currentFolder={currentFolder}
            onNavigateToFolder={handleNavigateTo}
          />

          {/* Main content */}
          <div className="flex-1 min-w-0 flex h-screen flex-col overflow-hidden bg-background">
            <div className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur-md">
              <div className="flex h-11 w-full items-center justify-between px-4 lg:px-5">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setIsStorageManagerOpen(true)}
                    className="inline-flex h-7 items-center gap-2 rounded-md px-2 text-left transition-colors duration-150 hover:bg-accent"
                  >
                    <span className="flex items-center justify-center text-muted-foreground">
                      <HardDrive className="h-3.5 w-3.5" />
                    </span>
                    <div className="flex items-center gap-1.5 leading-tight min-w-0">
                      <span className="text-[13px] font-medium text-foreground">Storage</span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="max-w-[160px] truncate text-[13px] text-muted-foreground">
                        {activeProviderType === 'squidcloud' ? 'SquidCloud' : activeProviderId ? 'Custom Bucket' : 'SquidCloud'}
                      </span>
                    </div>
                    <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex h-7 items-center gap-2 rounded-md px-2 text-left transition-colors duration-150 hover:bg-accent">
                        <span className="flex items-center justify-center text-muted-foreground">
                          <Briefcase className="h-3.5 w-3.5" />
                        </span>
                        <div className="flex items-center gap-1.5 leading-tight min-w-0">
                          <span className="text-[13px] font-medium text-foreground">Workspace</span>
                          <span className="text-muted-foreground/40">·</span>
                        <span className="max-w-[160px] truncate text-[13px] text-muted-foreground">
                          {activeWorkspace?.name || '…'}
                        </span>
                        </div>
                        <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="lg-dropdown w-72 p-1.5">
                      {workspaces.map((workspace) => (
                        <DropdownMenuItem
                          key={workspace.id}
                          className="flex items-center justify-between rounded-lg py-2 cursor-pointer"
                          onClick={() => handleSwitchWorkspace(workspace.id)}
                        >
                          <span className="truncate">{workspace.name}</span>
                          {workspace.id === activeWorkspaceId && <Check className="h-4 w-4 text-primary" />}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator className="bg-border/50" />
                      {activeWorkspaceId && canAdministerWorkspace && (
                        <DropdownMenuItem onClick={() => setWorkspaceManageOpen(true)} className="rounded-lg py-2 cursor-pointer">
                          <Users className="mr-2.5 h-4 w-4" /> Collaborators
                        </DropdownMenuItem>
                      )}
                      {activeWorkspaceId && canAdministerWorkspace && (
                        <DropdownMenuItem onClick={() => setWorkspaceSettingsOpen(true)} className="rounded-lg py-2 cursor-pointer">
                          <Settings2 className="mr-2.5 h-4 w-4" /> Workspace Settings
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator className="bg-border/50" />
                      <DropdownMenuItem onClick={handleCreateWorkspace} className="rounded-lg py-2 cursor-pointer">
                        <Plus className="mr-2.5 h-4 w-4" /> Create workspace
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center gap-1.5">
                  <SignalsBell className="h-7 w-7 rounded-md" iconClassName="h-4 w-4" />
                  <button
                    onClick={() => setViewMode(viewMode === 'compact' ? 'list' : 'compact')}
                    className="sq-press flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                    title={viewMode === 'compact' ? 'Comfortable density' : 'Compact density'}
                  >
                    {viewMode === 'compact' ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => setIsSpotlightOpen(true)}
                    className="sq-press hidden h-8 items-center gap-2 rounded-md border border-border/70 bg-card/60 pl-2.5 pr-1.5 text-muted-foreground hover:border-foreground/30 hover:text-foreground sm:flex"
                    title="Search (⌘K)"
                  >
                    <Search className="h-3.5 w-3.5" />
                    <span className="text-[12.5px]">Search</span>
                    <kbd className="sa-kbd">{/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'}</kbd>
                  </button>
                  <button
                    onClick={() => setIsSpotlightOpen(true)}
                    className="sq-press flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent sm:hidden"
                    title="Search (⌘K)"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            {banners.map(b => (
              <SubscriptionBanner
                key={b.id}
                notification={b}
                onDismiss={dismissNotification}
                onSnooze={snoozeNotification}
              />
            ))}
            <main data-scroll-container="true" className="flex-1 overscroll-y-contain overflow-y-auto px-4 lg:px-5 pb-10 pt-4">
              <div className="mx-auto w-full max-w-[1680px]">

              {/* ── Home overview ── */}
              {activeTab === 'home' && (
                  <Overview
                    files={files}
                    folders={folders}
                    totalSize={totalSize}
                    displayName={profile?.full_name || user?.email?.split('@')[0] || 'there'}
                    planLabel={profile?.is_premium ? (profile?.tier === 'supporter-plus' ? 'Supporter+' : 'Supporter') : 'Free'}
                    onFileClick={handleFileClick}
                    onOpenFolder={handleOpenFolder}
                    onGoToTab={setActiveTab}
                    onSearchOpen={() => setIsSpotlightOpen(true)}
                    onFilterChange={setFilterMode}
                    activeFilter={filterMode}
                  />
              )}

              {/* ── Files tab ── */}
              {activeTab === 'files' && (
                  <FilesView
                    loading={loading}
                    error={error}
                    currentFolder={currentFolder}
                    filteredFolders={filteredFolders}
                    filteredFiles={filteredFiles}
                    files={files}
                    folders={folders}
                    totalSize={totalSize}
                    searchQuery={searchQuery}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    filterMode={filterMode}
                    onFilterChange={setFilterMode}
                    sortBy={sortBy}
                    onSortChange={setSortBy}
                    onGoBack={handleGoBack}
                    onNavigateTo={handleNavigateTo}
                    onOpenFolder={handleOpenFolder}
                    onOpenFolderInCbCode={handleOpenFolderInCbCode}
                    onFileClick={handleFileClick}
                    onOpenFileInCbCode={handleOpenFileInCbCode}
                    onFileDownload={handleFileDownload}
                    onFileDelete={handleFileDelete}
                    onFileShare={handleFileShare}
                    onFileMoveToFolder={handleFileMoveToFolder}
                    onFolderDelete={handleFolderDelete}
                    onFolderMove={onFolderMove}
                    onFolderShare={handleFolderShare}
                    onVaultOpen={() => setShowVaultAuth(true)}
                    onRefresh={fetchFiles}
                    bookmarks={bookmarks}
                    getColor={getColor}
                    isBookmarked={isBookmarked}
                    onToggleBookmark={toggleBookmark}
                    onSetColor={setColor}
                    selectionMode={selectionMode}
                    selectedFiles={selectedFiles}
                    onToggleSelection={() => {
                      setSelectionMode(!selectionMode);
                      setSelectedFiles(new Set());
                    }}
                    onToggleSelect={handleToggleSelect}
                    onSelectAll={selectAll}
                    onFileCreated={fetchFiles}
                    onUploadComplete={fetchFiles}
                    createDisabled={!canUpload}
                    onCreateBlocked={handleCreateBlocked}
                    onCreateFolder={handleCreateFolder}
                    onNotes={handleOpenNotes}
                    onEmbed={handleOpenEmbed}
                    onCloneFromGitHub={() => setCloneDialogOpen(true)}
                  />
              )}

              {activeTab === 'shared' && (
                <div className="sq-tab-enter">
                <SharedView
                  files={files}
                  onFileDownload={handleFileDownload}
                  onFileShare={handleFileShare}
                  onFileDelete={handleFileDelete}
                  onFileClick={handleFileClick}
                  onOpenFileInCbCode={handleOpenFileInCbCode}
                  onRefresh={fetchFiles}
                  onViewInfo={handleViewInfo}
                  onFolderShareClick={(shareId) => window.open(`/s/${shareId}`, '_blank')}
                />
                </div>
              )}

              {activeTab === 'trash'     && <div className="sq-tab-enter"><TrashTab workspaceId={activeWorkspaceId} /></div>}
              {activeTab === 'analytics' && <div className="sq-tab-enter"><AnalyticsDashboard /></div>}
              {activeTab === 'secrets'   && <div className="sq-tab-enter"><SquidVeilSecrets /></div>}
              {activeTab === 'storage'   && <div className="sq-tab-enter"><StorageTab /></div>}
              {activeTab === 'scripts'   && <div className="sq-tab-enter"><Scripts /></div>}
              {activeTab === 'books' && (
                <div className="sq-tab-enter">
                <DeepReadCatalog
                  files={files}
                  onBookOpen={handleBookOpen}
                  onSaved={fetchFiles}
                />
                </div>
              )}

              {activeTab === 'file-requests' && (
                profile?.is_premium ? (
                  <div className="sq-tab-enter space-y-5">
                    <TabHeader
                      title="File Requests"
                      subtitle="Public upload links for anyone to submit files."
                      primaryLabel="New Request"
                      primaryIcon={Plus}
                      onPrimary={() => setFileRequestOpen(true)}
                    />
                    <div className="lg-card overflow-hidden">
                      <ManageFileRequests refreshToken={fileRequestsRefreshToken} />
                    </div>
                    <CreateFileRequestDialog
                      open={fileRequestOpen}
                      onClose={() => setFileRequestOpen(false)}
                      currentFolder={currentFolder}
                      onCreated={() => {
                        setFileRequestOpen(false);
                        setShowFileRequests(true);
                        setFileRequestsRefreshToken(prev => prev + 1);
                      }}
                    />
                  </div>
                ) : (
                  <div className="max-w-lg mx-auto pt-16 text-center">
                    <div className="rounded-lg border border-border/40 bg-card p-8">
                      <div className="w-12 h-12 rounded-md border border-border bg-muted flex items-center justify-center mx-auto mb-4">
                        <Crown className="h-6 w-6 text-foreground" />
                      </div>
                      <h2 className="text-lg font-bold text-foreground mb-2">File Requests are a Supporter feature</h2>
                      <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                        Let anyone upload files to you with a simple link. Upgrade to Supporter or Supporter+ to create unlimited file requests.
                      </p>
                      <Button onClick={() => navigate('/pricing')} className="rounded-xl">
                        <Crown className="h-4 w-4 mr-2" /> See Plans
                      </Button>
                    </div>
                  </div>
                )
              )}

              {activeTab === 'settings' && (
                <div className="max-w-2xl">
                  <h1 className="lg-title mb-4 px-1">Settings</h1>
                  <SettingsCard>
                    <button onClick={() => navigate('/settings/account')} className="flex w-full items-center gap-3 px-4 h-12 hover:bg-accent/50 text-left transition-colors group">
                      <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm flex-1 font-medium text-foreground">Account</span>
                      <span className="text-xs text-muted-foreground">Profile, password &amp; security</span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
                    </button>
                    <SettingsDivider />
                    <button onClick={() => navigate('/developer-api')} className="flex w-full items-center gap-3 px-4 h-12 hover:bg-accent/50 text-left transition-colors group">
                      <Key className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm flex-1 font-medium text-foreground">API Keys</span>
                      <span className="text-xs text-muted-foreground">Webhooks &amp; developer tools</span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
                    </button>
                    <SettingsDivider />
                    <button onClick={signOut} className="flex w-full items-center gap-3 px-4 h-12 hover:bg-red-500/10 text-left transition-colors group rounded-b-2xl">
                      <LogOut className="w-4 h-4 text-red-400/60 flex-shrink-0" />
                      <span className="text-sm flex-1 font-medium text-red-400">Sign out</span>
                      <span className="text-xs text-red-400/70">End current session</span>
                      <ChevronRight className="w-3.5 h-3.5 text-red-400/50 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </SettingsCard>
                </div>
              )}
            </div>
          </main>
        </div>

            {/* ── Modals ── */}
        {previewFile && (
          <EnhancedInstantPreviewModal
            file={previewFile}
            isOpen={!!previewFile}
            onClose={() => setPreviewFile(null)}
            onDownload={() => handleFileDownload(previewFile)}
            onShare={() => handleFileShare(previewFile)}
            onNext={() => {
              if (previewAdjacents.next) setPreviewFile(previewAdjacents.next);
            }}
            onPrevious={() => {
              if (previewAdjacents.previous) setPreviewFile(previewAdjacents.previous);
            }}
            hasNext={!!previewAdjacents.next}
            hasPrevious={!!previewAdjacents.previous}
            currentIndex={previewCurrentIndex >= 0 ? previewCurrentIndex : undefined}
            totalFiles={filteredFiles.length}
            siblingFiles={previewSiblingFiles}
            onNavigateToFile={(target) => {
              const selected = filteredFiles.find(f => f.id === target.id);
              if (selected) setPreviewFile(selected);
            }}
            onOpenEpubReader={(f) => { setPreviewFile(null); setReadingFile(f); }}
          />
        )}

        <FileInfoModal
          file={fileInfoFile}
          open={!!fileInfoFile}
          onClose={() => setFileInfoFile(null)}
        />

        {selectionMode && selectedFiles.size > 0 && (
          <BulkActionsToolbar
            selectedCount={selectedFiles.size}
            totalCount={filteredFiles.length}
            onSelectAll={selectAll}
            onClearSelection={clearSelection}
            onBulkDownload={handleBulkDownload}
            onBulkShare={handleBulkShare}
            onBulkMove={() => {}}
            onBulkDelete={handleBulkDelete}
            onClose={clearSelection}
            isMobile={false}
          />
        )}

        <CommandPalette
          open={isSpotlightOpen}
          onOpenChange={setIsSpotlightOpen}
          files={filteredFiles}
          folders={filteredFolders.map(folder => ({ id: folder.id, name: folder.name, path: folder.path || '' }))}
          onOpenFile={(file) => {
            const selected = filteredFiles.find(f => f.id === file.id);
            if (selected) setPreviewFile(selected);
          }}
          onNavigateToFiles={() => setActiveTab('files')}
          onNavigateToShared={() => setActiveTab('shared')}
          onNavigateToTrash={() => setActiveTab('trash')}
          onNavigateToAnalytics={() => setActiveTab('analytics')}
          onNavigateToSettings={() => navigate('/settings/account')}
          onNavigateToAccount={() => navigate('/settings/account')}
          onNavigateToDeveloperApi={() => navigate('/developer-api')}
          onNavigateToFolder={handleNavigateTo}
          onSetViewMode={setViewMode}
          currentViewMode={viewMode}
          selectedFilesCount={selectedFiles.size}
          onDeleteSelected={selectedFiles.size > 0 ? handleBulkDelete : undefined}
          onShareSelected={selectedFiles.size > 0 ? handleBulkShare : undefined}
          onDownloadSelected={selectedFiles.size > 0 ? handleBulkDownload : undefined}
          onRefresh={fetchFiles}
          onSignOut={signOut}
          currentFolder={currentFolder}
        />

        <StorageProviderManager
          isOpen={isStorageManagerOpen}
          onClose={() => setIsStorageManagerOpen(false)}
          activeProviderType={activeProviderType}
          activeProviderId={activeProviderId}
          onProviderSelect={handleProviderSelect}
        />

        <BackgroundUploadPanel />

        <WorkspaceCollaboratorsModal
          open={workspaceManageOpen}
          onClose={() => setWorkspaceManageOpen(false)}
          workspaceId={activeWorkspaceId}
          workspaceName={activeWorkspace?.name || 'Workspace'}
          currentRole={activeWorkspaceRole}
          currentUserId={user?.id || ''}
        />
        <WorkspaceSettingsModal
          open={workspaceSettingsOpen}
          onClose={() => setWorkspaceSettingsOpen(false)}
          workspaceId={activeWorkspaceId}
          workspaceName={activeWorkspace?.name || 'Workspace'}
          currentRole={activeWorkspaceRole}
          currentUserId={user?.id || ''}
          onWorkspaceUpdated={(newName) => {
            setWorkspaces(prev => prev.map(w =>
              w.id === activeWorkspaceId ? { ...w, name: newName } : w
            ));
          }}
          onWorkspaceDeleted={() => {
            setWorkspaces(prev => prev.filter(w => w.id !== activeWorkspaceId));
            if (typeof window !== 'undefined') {
              localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
            }
            setActiveWorkspaceId(null);
            setActiveWorkspaceRole(null);
          }}
        />
      </div>
      </DragDropUpload>
      <MoveToFolderDialog
        open={!!moveDialogFile}
        onClose={() => setMoveDialogFile(null)}
        fileIds={moveDialogFile?.ids || []}
        folderId={moveDialogFile?.folderId ?? null}
        onMoved={() => { setMoveDialogFile(null); fetchFiles(); }}
      />
      {shareFile && (
        <EnhancedShareDialog
          open
          onClose={() => setShareFile(null)}
          file={shareFile}
          onShareChange={() => { setShareFile(null); fetchFiles(); }}
        />
      )}

      {shareFolder && (
        <EnhancedShareDialog
          open
          onClose={() => setShareFolder(null)}
          file={{ ...shareFolder, type: 'folder' } as any}
          onShareChange={() => { setShareFolder(null); fetchFiles(); }}
        />
      )}

      <input
        ref={uploadInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = e.target.files;
          if (!files || !canUpload) return;
          for (const f of Array.from(files)) {
            await backgroundUploadService.addTask(f, currentFolder || '');
          }
          toast({ title: `${files.length} file(s) queued`, description: 'Uploading in background...' });
          e.target.value = '';
        }}
      />

      {notesPanel && (
        <NotesPanel
          open={!!notesPanel}
          onClose={() => setNotesPanel(null)}
          entityId={notesPanel.entityId}
          entityType={notesPanel.entityType}
          entityName={notesPanel.entityName}
          onNoteCountChange={(count) => {
            setNoteCounts(prev => {
              const next = new Map(prev);
              next.set(notesPanel.entityId, count);
              return next;
            });
          }}
        />
      )}

      {embedModal && (
        <SquidEmbedModal
          open={!!embedModal}
          onClose={() => setEmbedModal(null)}
          entityId={embedModal.entityId}
          entityType={embedModal.entityType}
          entityName={embedModal.entityName}
        />
      )}
      {popups.map(p => (
        <SubscriptionPopup
          key={p.id}
          notification={p}
          onDismiss={dismissNotification}
        />
      ))}
      {readingFile && (
        <DeepReadReader
          file={readingFile}
          source={readingSource}
          isOpen={true}
          onClose={() => setReadingFile(null)}
        />
      )}

      <GitHubRepoCloneDialog
        open={cloneDialogOpen}
        onOpenChange={setCloneDialogOpen}
        workspaceId={activeWorkspaceId}
        onCloneComplete={fetchFiles}
      />
    </AppStartupBiometricCheck>
    </FileViewInfoContext.Provider>
  );
};

// ─────────────────────────────────────────────────────────
// FilesView (desktop)
// ─────────────────────────────────────────────────────────

interface FilesViewProps {
  loading: boolean;
  error: string | null;
  currentFolder: string;
  filteredFolders: FolderItem[];
  filteredFiles: FileItemType[];
  files: FileItemType[];
  folders: FolderItem[];
  totalSize: number;
  searchQuery: string;
  viewMode: 'grid' | 'list' | 'compact';
  setViewMode: (m: 'grid' | 'list' | 'compact') => void;
  filterMode: string;
  onFilterChange: (f: string) => void;
  sortBy: string;
  onSortChange: (s: string) => void;
  onGoBack: () => void;
  onNavigateTo: (p: string) => void;
  onOpenFolder: (f: FolderItem) => void;
  onOpenFolderInCbCode: (f: FolderItem) => void;
  onFileClick: (f: FileItemType) => void;
  onOpenFileInCbCode: (f: FileItemType) => void;
  onFileDownload: (f: FileItemType) => void;
  onFileDelete: (f: FileItemType) => void;
  onFileShare: (f: FileItemType) => void;
  onFileMoveToFolder: (f: FileItemType) => void;
  onFolderDelete: (f: FolderItem) => void;
  onFolderMove: (f: FolderItem) => void;
  onFolderShare: (f: FolderItem) => void;
  onVaultOpen: () => void;
  onRefresh: () => void;
  bookmarks: any[];
  getColor: (id: string) => string | undefined;
  isBookmarked: (id: string) => boolean;
  onToggleBookmark: (b: any) => void;
  onSetColor: (id: string, color: string) => void;
  selectionMode: boolean;
  selectedFiles: Set<string>;
  onToggleSelection: () => void;
  onToggleSelect: (fileId: string) => void;
  onSelectAll: () => void;
  onFileCreated: () => void;
  onUploadComplete: (f: FileItemType) => void;
  createDisabled?: boolean;
  onCreateBlocked?: () => void;
  onCreateFolder?: () => void;
  onNotes?: (f: FileItemType) => void;
  onEmbed?: (f: FileItemType) => void;
  onCloneFromGitHub?: () => void;
}

const FilesView: React.FC<FilesViewProps> = ({
  loading, error, currentFolder, filteredFolders, filteredFiles,
  files, folders, totalSize,
  searchQuery,
  viewMode, setViewMode,
  filterMode, onFilterChange, sortBy, onSortChange,
  onGoBack, onNavigateTo, onOpenFolder,
  onOpenFolderInCbCode, onFileClick, onOpenFileInCbCode,
  onFileDownload, onFileDelete, onFileShare, onFileMoveToFolder,
  onFolderDelete, onFolderMove, onFolderShare, onVaultOpen, onRefresh,
  bookmarks, getColor, isBookmarked, onToggleBookmark, onSetColor,
  selectionMode, selectedFiles, onToggleSelection, onToggleSelect, onSelectAll,
  onFileCreated, onUploadComplete,
  createDisabled, onCreateBlocked, onCreateFolder,
  onNotes, onEmbed,
  onCloneFromGitHub,
}) => {
  const [filesCollapsed, setFilesCollapsed] = useState(false);
  const showFolders = filteredFolders.length > 0 || !currentFolder;
  const showFiles   = filteredFiles.length > 0;
  const totalItems = files.length + folders.length;
  const sharedFiles = files.filter(f => f.shared);

  // Keyboard navigation state
  const [kbdIndex, setKbdIndex] = useState(-1);
  const kbdContainerRef = useRef<HTMLDivElement>(null);
  const lastMouseMove = useRef(0);
  const isKbdActive = kbdIndex >= 0;

  // Combine folders + files into a single navigable list
  const allItems = useMemo(() => {
    const items: Array<{ id: string; type: 'folder' | 'file'; label: string }> = [];
    if (showFolders) {
      for (const f of filteredFolders) items.push({ id: f.id, type: 'folder' as const, label: f.name || 'Folder' });
    }
    if (!filesCollapsed && showFiles) {
      for (const f of filteredFiles) items.push({ id: f.id, type: 'file' as const, label: f.name });
    }
    return items;
  }, [filteredFolders, filteredFiles, showFolders, showFiles, filesCollapsed]);

  // Estimate grid columns
  const gridCols = viewMode === 'list' ? 1 : (viewMode === 'compact' ? 4 : 3);

  // Document-level keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) return;
      // Menus, dialogs, lists and sliders own their arrow / Enter keys.
      if (target.closest?.('[role="menu"], [role="dialog"], [role="alertdialog"], [role="listbox"], [role="tablist"], [role="slider"], [role="combobox"], [role="radiogroup"], select')) return;
      // Enter on a focused button or link must activate it, not open the first file.
      if (e.key === 'Enter') {
        const control = target.closest?.('button, a[href], summary, [role="button"], [role="checkbox"], [role="switch"], [role="menuitem"]');
        if (control && !control.hasAttribute('data-kbd-item')) return;
      }

      if (Date.now() - lastMouseMove.current < 800) {
        if (kbdIndex >= 0) setKbdIndex(-1);
        return;
      }

      const total = allItems.length;
      if (total === 0) return;

      let newIdx = kbdIndex < 0 ? 0 : kbdIndex;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          newIdx = Math.min(total - 1, newIdx + 1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          newIdx = Math.max(0, newIdx - 1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          newIdx = Math.min(total - 1, newIdx + gridCols);
          break;
        case 'ArrowUp':
          e.preventDefault();
          newIdx = Math.max(0, newIdx - gridCols);
          break;
        case 'Enter':
          e.preventDefault();
          if (newIdx >= 0 && newIdx < total) {
            const item = allItems[newIdx];
            if (item.type === 'folder') {
              const folder = filteredFolders.find(f => f.id === item.id);
              if (folder) onOpenFolder(folder);
            } else {
              const file = filteredFiles.find(f => f.id === item.id);
              if (file) onFileClick(file);
            }
          }
          return;
      }

      setKbdIndex(newIdx);

      const container = kbdContainerRef.current;
      if (container) {
        const items = container.querySelectorAll('[data-kbd-item]');
        if (items[newIdx]) {
          (items[newIdx] as HTMLElement).focus();
          items[newIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [allItems, kbdIndex, gridCols, filteredFolders, filteredFiles, onOpenFolder, onFileClick]);

  const handleKbdMouseMove = useCallback(() => {
    lastMouseMove.current = Date.now();
    if (kbdIndex >= 0) setKbdIndex(-1);
  }, [kbdIndex]);

  // Remove default arrow key shortcuts when kbd nav is active
  const { removeShortcut } = useKeyboardShortcutsContext();
  useEffect(() => {
    if (kbdIndex >= 0) {
      // The document-level handler will preventDefault for arrow keys
    }
  }, [kbdIndex]);

  return (
    <div className="sq-tab-enter space-y-5" ref={kbdContainerRef} onMouseMove={handleKbdMouseMove}>

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2.5">
          <div className="flex items-baseline gap-3 min-w-0">
            <h1 className="text-[15px] font-semibold tracking-tight text-foreground truncate">Storage</h1>
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
              {folders.length} folders · {files.length} files{sharedFiles.length > 0 ? ` · ${sharedFiles.length} shared` : ''} · {formatBytes(totalSize)}
            </span>
          </div>
          <PathBar currentFolder={currentFolder} onNavigate={onNavigateTo} />
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <CreateUploadSegmented
            currentFolder={currentFolder}
            onFileCreated={onFileCreated}
            onUploadComplete={onUploadComplete}
            disabled={!!createDisabled}
            onDisabledClick={onCreateBlocked}
            onCloneFromGitHub={onCloneFromGitHub}
          />
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          {currentFolder && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onGoBack}
              className="gap-1.5 h-8 text-muted-foreground hover:text-foreground hover:bg-accent/50 lg-press-subtle"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
          )}
          {searchQuery && (
            <span className="text-sm text-muted-foreground">
              {filteredFiles.length + filteredFolders.length} results for &ldquo;{searchQuery}&rdquo;
            </span>
          )}
          {selectionMode && (
            <span className="flex items-center gap-2 text-[12.5px] text-muted-foreground tabular-nums" aria-live="polite">
              <span className="text-foreground">{selectedFiles.size}</span> selected
              <button
                type="button"
                onClick={() => onSelectAll()}
                className="text-foreground/80 underline underline-offset-4 decoration-border hover:text-foreground hover:decoration-foreground transition-colors"
              >
                Select all
              </button>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSelection}
            className={cn(
              'h-8 gap-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/50 lg-press-subtle',
              selectionMode && 'bg-foreground text-background hover:bg-foreground/90'
            )}
          >
            <CheckSquare className="w-4 h-4" />
            {selectionMode ? 'Cancel' : 'Select'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] font-medium whitespace-nowrap outline-none select-none transition-all duration-150 text-muted-foreground hover:text-foreground hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-[0.97] lg-press-subtle"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="text-xs hidden sm:inline">
                  {({ 'date-desc': 'Newest', 'date-asc': 'Oldest', 'name-asc': 'Name A–Z', 'name-desc': 'Name Z–A', 'size-desc': 'Largest', 'size-asc': 'Smallest' } as Record<string, string>)[sortBy] || 'Sort'}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="lg-dropdown w-40 p-1">
              {[
                ['date-desc', 'Newest'],
                ['date-asc', 'Oldest'],
                ['name-asc', 'Name A–Z'],
                ['name-desc', 'Name Z–A'],
                ['size-desc', 'Largest'],
                ['size-asc', 'Smallest'],
              ].map(([value, label]) => (
                <DropdownMenuItem
                  key={value}
                  onClick={() => onSortChange(value)}
                  className={cn(sortBy === value && 'bg-accent text-foreground font-medium')}
                >
                  {label}
                  {sortBy === value && <Check className="ml-auto h-3.5 w-3.5" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            aria-label="Refresh"
            title="Refresh"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent/50 lg-press-subtle"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <div className="lg-tab-group">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'lg-tab',
                viewMode === 'grid' && 'lg-tab-active'
              )}
              title="Grid view"
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('compact')}
              className={cn(
                'lg-tab',
                viewMode === 'compact' && 'lg-tab-active'
              )}
              title="Compact view"
              aria-label="Compact view"
              aria-pressed={viewMode === 'compact'}
            >
              <Grid3X3 className="w-3 h-3" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'lg-tab',
                viewMode === 'list' && 'lg-tab-active'
              )}
              title="List view"
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Error state ── */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
          <Button variant="outline" size="sm" onClick={onRefresh} className="ml-auto">
            Retry
          </Button>
        </div>
      )}

      {/* ── Folders ── */}
      {!error && showFolders && currentFolder && (
        <BackCard viewMode={viewMode} onClick={onGoBack} />
      )}
      {!error && showFolders && (
        <FolderListView
          folders={filteredFolders}
          loading={loading}
          viewMode={viewMode}
          onOpen={onOpenFolder}
          onDelete={onFolderDelete}
          onShare={onFolderShare}
          onMove={onFolderMove}
          onCreateFolder={onCreateFolder}
        />
      )}

      {/* ── Files ── */}
      {!error && (
        <section className="space-y-2">
          {(showFolders || showFiles) && (
            <button
              onClick={() => setFilesCollapsed(!filesCollapsed)}
              aria-expanded={!filesCollapsed}
              className="flex items-center gap-2 px-1 group"
            >
              <ChevronRight className={cn(
                'w-4 h-4 text-muted-foreground/60 transition-transform duration-280 ease-[cubic-bezier(0.4,0,0.2,1)]',
                !filesCollapsed && 'rotate-90'
              )} />
              <h2 className="lg-section-header group-hover:text-foreground/80 transition-colors">Files</h2>
              <span className="text-xs text-muted-foreground/60">({filteredFiles.length})</span>
            </button>
          )}
          {!filesCollapsed && (
            <LazyFileGrid
              files={filteredFiles}
              viewMode={viewMode}
              loading={loading}
              batchSize={40}
              resetKey={`${currentFolder}|${searchQuery}`}
              emptyState={<EmptyState searchQuery={searchQuery} />}
              renderFile={(file) => (
                <FileItem
                  key={file.id}
                  file={file}
                  viewMode={viewMode}
                  onOpenInCbCode={onOpenFileInCbCode}
                  onDelete={onFileDelete}
                  onDownload={onFileDownload}
                  onShare={onFileShare}
                  onMoveToFolder={onFileMoveToFolder}
                  onClick={onFileClick}
                  onPreview={() => onFileClick(file)}
                  onShareRevoked={onRefresh}
                  onShareChange={onRefresh}
                  selectionMode={selectionMode}
                  isSelected={selectedFiles.has(file.id)}
                  onToggleSelect={onToggleSelect}
                  onNotes={onNotes}
                  onEmbed={onEmbed}
                />
              )}
            />
          )}
        </section>
      )}

      {/* ── Status line ── */}
      {!error && !loading && filteredFiles.length + filteredFolders.length > 0 && (
        <div className="flex items-center justify-between gap-4 border-t border-border/50 pt-3 text-[11.5px] text-muted-foreground tabular-nums">
          <span>
            {filteredFolders.length} folders · {filteredFiles.length} files{searchQuery ? ' match' : ''}
          </span>
          <span className="hidden md:flex items-center gap-4">
            <span className="flex items-center gap-1.5"><kbd className="sa-kbd">←</kbd><kbd className="sa-kbd">↑</kbd><kbd className="sa-kbd">↓</kbd><kbd className="sa-kbd">→</kbd> move</span>
            <span className="flex items-center gap-1.5"><kbd className="sa-kbd">Enter</kbd> open</span>
            <span className="flex items-center gap-1.5"><kbd className="sa-kbd">{/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'}</kbd> search</span>
          </span>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// MobileFilesView
// ─────────────────────────────────────────────────────────

const MobileFilesView: React.FC<any> = ({
  loading, currentFolder, filteredFolders, filteredFiles,
  workspaceName,
  searchQuery,
  viewMode, setViewMode,
  onRefresh,
  onGoBack, onOpenFolder, onOpenFolderInCbCode, onFileClick, onOpenFileInCbCode, onFileDownload,
  onFileDelete, onFileShare, onFileMoveToFolder, onFolderDelete, onFolderShare, onVaultOpen,
  getColor, isBookmarked, onToggleBookmark, onSetColor,
  onViewInfo,
  onCreateFolder,
  selectionMode, selectedFiles,
  onToggleSelect,
  onNotes,
  onEmbed,
}) => {
  const [filesCollapsed, setFilesCollapsed] = useState(false);
  const pathParts = currentFolder.split('/').filter(Boolean);
  const activeTitle = pathParts[pathParts.length - 1] || workspaceName || 'My Files';
  const activePath = currentFolder || 'Root';
  const isMobile = true;
  const { pullDistance, refreshing, onTouchStart, onTouchMove, onTouchEnd } = usePullToRefresh(onRefresh, loading);

  return (
    <div className="space-y-3" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {refreshing && (
        <div className="flex items-center justify-center py-3">
          <svg className="animate-spin h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
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
      <section className="rounded-lg border border-border/50 bg-card/75 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">{activeTitle}</h2>
            <p className="truncate text-xs text-muted-foreground">{activePath}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onRefresh} className="h-8 w-8 rounded-lg p-0">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            onClick={() => {
              if (currentFolder) onGoBack();
            }}
            className={cn(
              'inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium',
              currentFolder
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border/50 bg-background/70 text-muted-foreground'
            )}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {currentFolder ? 'Back' : 'Root'}
          </button>

          <div className="flex rounded-lg border border-border/50 bg-background/70 p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'h-7 rounded-md px-3 text-xs font-medium transition-colors',
                viewMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'h-7 rounded-md px-3 text-xs font-medium transition-colors',
                viewMode === 'grid' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {searchQuery && (
          <p className="mt-2 text-xs text-muted-foreground">
            Showing {filteredFiles.length + filteredFolders.length} results for "{searchQuery}".
          </p>
        )}
      </section>

      {(filteredFolders.length > 0 || !currentFolder) && (
        <MobileFolderList
          folders={filteredFolders}
          loading={loading}
          viewMode={viewMode}
          onOpen={onOpenFolder}
          onDelete={onFolderDelete}
          onShare={onFolderShare}
          onCreateFolder={onCreateFolder}
        />
      )}

      <section className="rounded-lg border border-border/50 bg-card/75 p-2.5">
        <button
          onClick={() => setFilesCollapsed(!filesCollapsed)}
          className="flex items-center gap-2 px-1 pb-2 w-full"
        >
          <ChevronRight className={cn(
            'w-4 h-4 text-muted-foreground/60 transition-transform duration-280 ease-[cubic-bezier(0.4,0,0.2,1)]',
            !filesCollapsed && 'rotate-90'
          )} />
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Files</h3>
        </button>
        {!filesCollapsed && (
          <LazyFileGrid
            files={filteredFiles}
            viewMode={viewMode}
            loading={loading}
            batchSize={40}
            resetKey={`${currentFolder}|${searchQuery}`}
            emptyState={<EmptyState searchQuery={searchQuery} />}
            renderFile={(file) => (
              <RecencyFadeWrapper key={file.id} file={file}>
                <FileItem
                  file={file}
                  viewMode={viewMode}
                  onOpenInCbCode={onOpenFileInCbCode}
                  onDelete={onFileDelete}
                  onDownload={onFileDownload}
                  onShare={onFileShare}
                  onMoveToFolder={onFileMoveToFolder}
                  onViewInfo={onViewInfo ? (f) => onViewInfo(f) : undefined}
                  onClick={onFileClick}
                  onPreview={() => onFileClick(file)}
                  onShareRevoked={onRefresh}
                  onShareChange={onRefresh}
                  selectionMode={selectionMode}
                  isSelected={selectedFiles?.has(file.id)}
                  onToggleSelect={onToggleSelect}
                  onNotes={onNotes}
                  onEmbed={onEmbed}
                />
              </RecencyFadeWrapper>
            )}
          />
        )}
      </section>

    </div>
  );
};

export default Dashboard;

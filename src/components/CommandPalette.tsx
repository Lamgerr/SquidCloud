import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { 
  Search, 
  Command,
  Folder,
  FolderOpen,
  Upload,
  FileText,
  Trash2,
  Share2,
  Download,
  Grid3X3,
  List,
  Calendar,
  FileType,
  HardDrive,
  Star,
  Clock,
  Settings,
  BarChart3,
  Plus,
  Eye,
  ArrowRight,
  X,
  CornerDownLeft,
  History,
  File,
  Image,
  Video,
  Music,
  Archive,
  Code,
  FileSpreadsheet,
  Presentation,
  FileIcon,
  User,
  KeyRound,
  RefreshCw,
  LogOut
} from '@/lib/icon-map';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { BottomSheet, BottomSheetContent } from '@/components/ui/bottom-sheet';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

/* ── Spotlight styles: same floating dark-glass tier as the dock & sidebar.
      One leading surface, hairline rules, mono micro-labels, no white fills. ── */
const SPOTLIGHT_CSS = `
html.sq-app-root .spot-panel {
  --sp-spring: linear(0, 0.03, 0.107, 0.214, 0.337, 0.464, 0.586, 0.699, 0.797, 0.881, 0.948, 0.999, 1.037, 1.062, 1.077, 1.083, 1.083, 1.078, 1.07, 1.06, 1.05, 1.039, 1.029, 1.02, 1.013, 1.007, 1.002, 0.998, 0.996, 0.994, 0.993, 0.993, 0.993, 0.994, 0.995, 0.995, 0.996, 0.997, 1);
  --sp-fill: color-mix(in srgb, var(--sa-bg-2, #141612) 88%, transparent);
  --sp-line: rgba(232,231,225,0.09);
  background: var(--sp-fill); border: 1px solid var(--sp-line); border-radius: 22px;
  -webkit-backdrop-filter: blur(24px) saturate(1.4); backdrop-filter: blur(24px) saturate(1.4);
  box-shadow: inset 0 1px 0 rgba(232,231,225,0.1), 0 30px 70px -24px rgba(0,0,0,0.8);
  color: var(--sa-text); font-family: var(--sa-f, inherit); overflow: hidden;
}
/* clean input bar: one rounded search capsule, nothing inside competes */
html.sq-app-root .spot-head { display: flex; align-items: center; gap: 10px; padding: 16px 18px; border-bottom: 1px solid var(--sp-line); }
html.sq-app-root .spot-searchbar { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; height: 42px; padding: 0 14px;
  border-radius: 999px; border: 1px solid var(--sp-line); background: rgba(13,14,13,0.6);
  -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); }
html.sq-app-root .spot-searchbar > svg { flex: none; color: var(--sa-mute); }
html.sq-app-root .spot-input { flex: 1; min-width: 0; background: none; border: 0; outline: none; color: var(--sa-text);
  font: 400 15px/1.4 var(--sa-f, inherit); }
html.sq-app-root .spot-input::placeholder { color: var(--sa-mute); }
html.sq-app-root .spot-input:focus-visible { outline: none; }
html.sq-app-root .spot-clear { display: grid; place-items: center; width: 26px; height: 26px; flex: none; border: 0; border-radius: 999px;
  background: rgba(232,231,225,0.07); color: var(--sa-mute); cursor: pointer; transition: all 0.2s var(--sp-spring); }
html.sq-app-root .spot-clear:hover { color: var(--sa-text); background: rgba(232,231,225,0.14); }
html.sq-app-root .spot-clear:active { transform: scale(0.88); }
html.sq-app-root .spot-close { display: grid; place-items: center; width: 38px; height: 38px; flex: none; border-radius: 999px;
  border: 1px solid var(--sp-line); background: rgba(13,14,13,0.6); color: var(--sa-mute); cursor: pointer; transition: all 0.2s var(--sp-spring); }
html.sq-app-root .spot-close:hover { color: var(--sa-text); background: rgba(232,231,225,0.1); }
html.sq-app-root .spot-close:active { transform: scale(0.9); }
html.sq-app-root .spot-list { overflow-y: auto; min-height: 0; }
html.sq-app-root .spot-group-label { font: 500 10px/1 var(--sa-mono, ui-monospace, monospace); letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--sa-mute); padding: 14px 18px 8px; }
html.sq-app-root .spot-row { position: relative; display: flex; align-items: center; gap: 12px; margin: 2px 10px; padding: 10px 12px;
  border-radius: 14px; cursor: pointer; color: var(--sa-text-2, var(--sa-text)); list-style: none; transition: color 0.2s var(--sp-spring); }
html.sq-app-root .spot-row[data-selected="true"] { color: var(--sa-text); }
html.sq-app-root .spot-row-thumb { position: absolute; inset: 0; border-radius: 14px; background: rgba(232,231,225,0.09);
  border: 1px solid rgba(232,231,225,0.08); box-shadow: inset 0 1px 0 rgba(232,231,225,0.08); }
html.sq-app-root .spot-ico { position: relative; z-index: 1; display: grid; place-items: center; width: 38px; height: 38px; flex: none;
  border-radius: 12px; border: 1px solid var(--sp-line); background: rgba(232,231,225,0.05); color: var(--sa-text); }
html.sq-app-root .spot-main { position: relative; z-index: 1; flex: 1; min-width: 0; }
html.sq-app-root .spot-label { font-size: 13.5px; font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
html.sq-app-root .spot-desc { font-size: 11.5px; color: var(--sa-mute); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
html.sq-app-root .spot-kbd { position: relative; z-index: 1; font: 400 10.5px/1 var(--sa-mono, ui-monospace, monospace);
  padding: 4px 7px; border-radius: 6px; border: 1px solid var(--sp-line); background: rgba(232,231,225,0.04); color: var(--sa-mute); }
html.sq-app-root .spot-enter { position: relative; z-index: 1; color: var(--sa-mute); }
html.sq-app-root .spot-empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 48px 24px; color: var(--sa-mute); }
html.sq-app-root .spot-empty p { font-size: 13.5px; color: var(--sa-text-2, var(--sa-text)); }
html.sq-app-root .spot-empty span { font-size: 12px; margin-top: 6px; }
html.sq-app-root .spot-foot { display: flex; align-items: center; gap: 16px; padding: 12px 18px; border-top: 1px solid var(--sp-line);
  background: rgba(232,231,225,0.02); font-size: 11px; color: var(--sa-mute); }
html.sq-app-root .spot-foot > span { display: inline-flex; align-items: center; gap: 6px; }
html.sq-app-root .spot-foot kbd { font: 400 10px/1 var(--sa-mono, ui-monospace, monospace); padding: 3px 6px; border-radius: 5px;
  border: 1px solid var(--sp-line); background: rgba(232,231,225,0.05); color: var(--sa-text-2, var(--sa-text)); }
@media (prefers-reduced-motion: reduce) { html.sq-app-root .spot-row, html.sq-app-root .spot-row-thumb, html.sq-app-root .spot-clear, html.sq-app-root .spot-close { transition-duration: 0.01ms !important; } }
`;

type CommandCategory = 'files' | 'navigation' | 'actions' | 'view' | 'create' | 'recent';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  category: CommandCategory;
  shortcut?: string;
  action: () => void;
  keywords?: string[];
}

// File item interface for search
interface SearchableFile {
  id: string;
  name: string;
  type: string;
  size: number;
  path?: string;
  parent_folder?: string;
  is_folder?: boolean;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  
  // Navigation actions
  onNavigateToFiles?: () => void;
  onNavigateToShared?: () => void;
  onNavigateToFolder?: (path: string) => void;
  onNavigateToTrash?: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToAnalytics?: () => void;
  onNavigateToAccount?: () => void;
  onNavigateToDeveloperApi?: () => void;
  onOpenQuickJump?: () => void;
  onRefresh?: () => void;
  onSignOut?: () => void;
  
  // File actions
  onUploadFile?: () => void;
  onCreateFolder?: () => void;
  onCreateTextFile?: () => void;
  onDeleteSelected?: () => void;
  onShareSelected?: () => void;
  onDownloadSelected?: () => void;
  
  // View actions
  onSetViewMode?: (mode: 'grid' | 'list') => void;
  onSetGroupBy?: (groupBy: 'none' | 'date' | 'type' | 'size') => void;
  onTogglePeekSidebar?: () => void;
  
  // Context
  currentViewMode?: 'grid' | 'list';
  currentGroupBy?: 'none' | 'date' | 'type' | 'size';
  selectedFilesCount?: number;
  recentFolders?: Array<{ path: string; name: string }>;
  
  // File search
  files?: SearchableFile[];
  folders?: Array<{ id: string; name: string; path: string }>;
  onOpenFile?: (file: SearchableFile) => void;
}

const categoryLabels: Record<CommandCategory, string> = {
  files: 'Files',
  recent: 'Recent',
  navigation: 'Navigation',
  actions: 'Actions',
  view: 'View',
  create: 'Create',
};

const categoryOrder: CommandCategory[] = ['files', 'recent', 'navigation', 'actions', 'view', 'create'];

const scoreTextMatch = (text: string, query: string): number => {
  const target = text.toLowerCase();
  if (target === query) return 0;
  if (target.startsWith(query)) return 1;
  const includesAt = target.indexOf(query);
  return includesAt >= 0 ? 10 + includesAt : Number.POSITIVE_INFINITY;
};

// Helper function to get file icon based on type
const getFileIcon = (type: string, name: string) => {
  const mimeType = type.toLowerCase();
  const ext = name.split('.').pop()?.toLowerCase() || '';
  
  if (mimeType.startsWith('image/')) return <Image className="w-4 h-4 text-pink-400" />;
  if (mimeType.startsWith('video/')) return <Video className="w-4 h-4 text-purple-400" />;
  if (mimeType.startsWith('audio/')) return <Music className="w-4 h-4 text-green-400" />;
  if (mimeType === 'application/pdf') return <FileText className="w-4 h-4 text-red-400" />;
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <Archive className="w-4 h-4 text-amber-400" />;
  }
  if (mimeType.includes('spreadsheet') || ['xlsx', 'xls', 'csv'].includes(ext)) {
    return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
  }
  if (mimeType.includes('presentation') || ['pptx', 'ppt'].includes(ext)) {
    return <Presentation className="w-4 h-4 text-orange-400" />;
  }
  if (mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('json') || mimeType.includes('html') || mimeType.includes('css') || ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'go', 'rs', 'rb', 'php', 'swift', 'kt'].includes(ext)) {
    return <Code className="w-4 h-4 text-primary" />;
  }
  if (mimeType.startsWith('text/') || ['txt', 'md', 'rtf', 'doc', 'docx'].includes(ext)) {
    return <FileText className="w-4 h-4 text-gray-400" />;
  }
  
  return <File className="w-4 h-4 text-muted-foreground" />;
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onOpenChange,
  onNavigateToFiles,
  onNavigateToShared,
  onNavigateToFolder,
  onNavigateToTrash,
  onNavigateToSettings,
  onNavigateToAnalytics,
  onNavigateToAccount,
  onNavigateToDeveloperApi,
  onOpenQuickJump,
  onRefresh,
  onSignOut,
  onUploadFile,
  onCreateFolder,
  onCreateTextFile,
  onDeleteSelected,
  onShareSelected,
  onDownloadSelected,
  onSetViewMode,
  onSetGroupBy,
  onTogglePeekSidebar,
  currentViewMode = 'grid',
  currentGroupBy = 'none',
  selectedFilesCount = 0,
  recentFolders = [],
  files = [],
  folders = [],
  onOpenFile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const reduce = !!useReducedMotion();
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase();

  // Build command list
  const commands = useMemo((): CommandItem[] => {
    const items: CommandItem[] = [];

    // Recent folders
    recentFolders.slice(0, 3).forEach((folder, idx) => {
      items.push({
        id: `recent-${idx}`,
        label: folder.name || 'Root',
        description: folder.path || 'Go to root folder',
        icon: <History className="w-4 h-4 text-muted-foreground" />,
        category: 'recent',
        action: () => {
          onNavigateToFolder?.(folder.path);
          onOpenChange(false);
        },
        keywords: ['recent', 'history', folder.name.toLowerCase()],
      });
    });

    // Navigation commands
    if (onNavigateToFiles) {
      items.push({
        id: 'nav-files',
        label: 'Go to files',
        description: 'Open your file workspace',
        icon: <FileIcon className="w-4 h-4 text-primary" />,
        category: 'navigation',
        shortcut: '⌘1',
        action: () => {
          onNavigateToFiles();
          onOpenChange(false);
        },
        keywords: ['files', 'workspace', 'home'],
      });
    }

    if (onNavigateToShared) {
      items.push({
        id: 'nav-shared',
        label: 'Go to shared',
        description: 'Open shared files view',
        icon: <Share2 className="w-4 h-4 text-primary" />,
        category: 'navigation',
        shortcut: '⌘2',
        action: () => {
          onNavigateToShared();
          onOpenChange(false);
        },
        keywords: ['shared', 'collaboration', 'links'],
      });
    }

    if (onOpenQuickJump) {
      items.push({
        id: 'nav-jump',
        label: 'Go to folder...',
        description: 'Jump to any folder quickly',
        icon: <FolderOpen className="w-4 h-4 text-primary" />,
        category: 'navigation',
        shortcut: '⌘G',
        action: () => {
          onOpenQuickJump();
          onOpenChange(false);
        },
        keywords: ['go', 'jump', 'folder', 'navigate', 'open'],
      });
    }

    items.push({
      id: 'nav-home',
      label: 'Go to home',
      description: 'Navigate to root folder',
      icon: <Folder className="w-4 h-4 text-primary" />,
      category: 'navigation',
      action: () => {
        onNavigateToFolder?.('');
        onOpenChange(false);
      },
      keywords: ['home', 'root', 'main'],
    });

    if (onNavigateToTrash) {
      items.push({
        id: 'nav-trash',
        label: 'Go to trash',
        description: 'View deleted files',
        icon: <Trash2 className="w-4 h-4 text-red-400" />,
        category: 'navigation',
        action: () => {
          onNavigateToTrash();
          onOpenChange(false);
        },
        keywords: ['trash', 'deleted', 'recycle', 'bin'],
      });
    }

    if (onNavigateToSettings) {
      items.push({
        id: 'nav-settings',
        label: 'Open settings',
        description: 'Account and app settings',
        icon: <Settings className="w-4 h-4 text-gray-400" />,
        category: 'navigation',
        action: () => {
          onNavigateToSettings();
          onOpenChange(false);
        },
        keywords: ['settings', 'preferences', 'account', 'config'],
      });
    }

    if (onNavigateToAccount) {
      items.push({
        id: 'nav-account',
        label: 'Open account',
        description: 'Profile and security settings',
        icon: <User className="w-4 h-4 text-indigo-400" />,
        category: 'navigation',
        action: () => {
          onNavigateToAccount();
          onOpenChange(false);
        },
        keywords: ['account', 'profile', 'security', 'user'],
      });
    }

    if (onNavigateToDeveloperApi) {
      items.push({
        id: 'nav-dev-api',
        label: 'Open developer API',
        description: 'API keys and developer tools',
        icon: <KeyRound className="w-4 h-4 text-emerald-400" />,
        category: 'navigation',
        action: () => {
          onNavigateToDeveloperApi();
          onOpenChange(false);
        },
        keywords: ['api', 'developer', 'keys', 'webhooks'],
      });
    }

    if (onNavigateToAnalytics) {
      items.push({
        id: 'nav-analytics',
        label: 'View analytics',
        description: 'Storage and usage statistics',
        icon: <BarChart3 className="w-4 h-4 text-green-400" />,
        category: 'navigation',
        action: () => {
          onNavigateToAnalytics();
          onOpenChange(false);
        },
        keywords: ['analytics', 'stats', 'usage', 'storage'],
      });
    }

    // File actions
    if (selectedFilesCount > 0) {
      if (onDeleteSelected) {
        items.push({
          id: 'action-delete',
          label: `Delete ${selectedFilesCount} file${selectedFilesCount > 1 ? 's' : ''}`,
          description: 'Move selected files to trash',
          icon: <Trash2 className="w-4 h-4 text-red-400" />,
          category: 'actions',
          shortcut: '⌫',
          action: () => {
            onDeleteSelected();
            onOpenChange(false);
          },
          keywords: ['delete', 'remove', 'trash'],
        });
      }

      if (onShareSelected) {
        items.push({
          id: 'action-share',
          label: `Share ${selectedFilesCount} file${selectedFilesCount > 1 ? 's' : ''}`,
          description: 'Create share links',
          icon: <Share2 className="w-4 h-4 text-primary" />,
          category: 'actions',
          action: () => {
            onShareSelected();
            onOpenChange(false);
          },
          keywords: ['share', 'link', 'send'],
        });
      }

      if (onDownloadSelected) {
        items.push({
          id: 'action-download',
          label: `Download ${selectedFilesCount} file${selectedFilesCount > 1 ? 's' : ''}`,
          description: 'Download selected files',
          icon: <Download className="w-4 h-4 text-green-400" />,
          category: 'actions',
          shortcut: '⌘D',
          action: () => {
            onDownloadSelected();
            onOpenChange(false);
          },
          keywords: ['download', 'save', 'export'],
        });
      }
    }

    if (onRefresh) {
      items.push({
        id: 'action-refresh',
        label: 'Refresh workspace',
        description: 'Reload files and folders',
        icon: <RefreshCw className="w-4 h-4 text-cyan-400" />,
        category: 'actions',
        shortcut: '⌘R',
        action: () => {
          onRefresh();
          onOpenChange(false);
        },
        keywords: ['refresh', 'reload', 'sync', 'update'],
      });
    }

    if (onSignOut) {
      items.push({
        id: 'action-signout',
        label: 'Sign out',
        description: 'Sign out of SquidCloud',
        icon: <LogOut className="w-4 h-4 text-rose-400" />,
        category: 'actions',
        action: () => {
          onSignOut();
          onOpenChange(false);
        },
        keywords: ['logout', 'sign out', 'exit'],
      });
    }

    // View commands
    if (onSetViewMode) {
      items.push({
        id: 'view-grid',
        label: 'Switch to grid view',
        description: currentViewMode === 'grid' ? 'Currently active' : 'Show files in a grid',
        icon: <Grid3X3 className={cn("w-4 h-4", currentViewMode === 'grid' ? 'text-primary' : 'text-muted-foreground')} />,
        category: 'view',
        action: () => {
          onSetViewMode('grid');
          onOpenChange(false);
        },
        keywords: ['grid', 'tiles', 'icons'],
      });

      items.push({
        id: 'view-list',
        label: 'Switch to list view',
        description: currentViewMode === 'list' ? 'Currently active' : 'Show files in a list',
        icon: <List className={cn("w-4 h-4", currentViewMode === 'list' ? 'text-primary' : 'text-muted-foreground')} />,
        category: 'view',
        action: () => {
          onSetViewMode('list');
          onOpenChange(false);
        },
        keywords: ['list', 'rows', 'details'],
      });
    }

    if (onSetGroupBy) {
      items.push({
        id: 'view-group-date',
        label: 'Group by date',
        description: currentGroupBy === 'date' ? 'Currently active' : 'Group files by creation date',
        icon: <Calendar className={cn("w-4 h-4", currentGroupBy === 'date' ? 'text-primary' : 'text-muted-foreground')} />,
        category: 'view',
        action: () => {
          onSetGroupBy('date');
          onOpenChange(false);
        },
        keywords: ['group', 'date', 'time', 'sort'],
      });

      items.push({
        id: 'view-group-type',
        label: 'Group by type',
        description: currentGroupBy === 'type' ? 'Currently active' : 'Group files by file type',
        icon: <FileType className={cn("w-4 h-4", currentGroupBy === 'type' ? 'text-primary' : 'text-muted-foreground')} />,
        category: 'view',
        action: () => {
          onSetGroupBy('type');
          onOpenChange(false);
        },
        keywords: ['group', 'type', 'kind', 'category'],
      });

      items.push({
        id: 'view-group-size',
        label: 'Group by size',
        description: currentGroupBy === 'size' ? 'Currently active' : 'Group files by file size',
        icon: <HardDrive className={cn("w-4 h-4", currentGroupBy === 'size' ? 'text-primary' : 'text-muted-foreground')} />,
        category: 'view',
        action: () => {
          onSetGroupBy('size');
          onOpenChange(false);
        },
        keywords: ['group', 'size', 'large', 'small'],
      });

      items.push({
        id: 'view-group-none',
        label: 'Remove grouping',
        description: currentGroupBy === 'none' ? 'Currently active' : 'Show all files without groups',
        icon: <List className={cn("w-4 h-4", currentGroupBy === 'none' ? 'text-primary' : 'text-muted-foreground')} />,
        category: 'view',
        action: () => {
          onSetGroupBy('none');
          onOpenChange(false);
        },
        keywords: ['ungroup', 'flat', 'all'],
      });
    }

    if (onTogglePeekSidebar) {
      items.push({
        id: 'view-peek',
        label: 'Toggle peek sidebar',
        description: 'Show/hide the file preview sidebar',
        icon: <Eye className="w-4 h-4 text-muted-foreground" />,
        category: 'view',
        shortcut: 'Space',
        action: () => {
          onTogglePeekSidebar();
          onOpenChange(false);
        },
        keywords: ['peek', 'preview', 'sidebar', 'panel'],
      });
    }

    // Create commands
    if (onCreateFolder) {
      items.push({
        id: 'create-folder',
        label: 'New folder',
        description: 'Create a new folder',
        icon: <Plus className="w-4 h-4 text-primary" />,
        category: 'create',
        action: () => {
          onCreateFolder();
          onOpenChange(false);
        },
        keywords: ['new', 'folder', 'create', 'directory'],
      });
    }

    if (onUploadFile) {
      items.push({
        id: 'create-upload',
        label: 'Upload file',
        description: 'Upload files from your device',
        icon: <Upload className="w-4 h-4 text-green-400" />,
        category: 'create',
        shortcut: '⌘U',
        action: () => {
          onUploadFile();
          onOpenChange(false);
        },
        keywords: ['upload', 'add', 'import', 'file'],
      });
    }

    if (onCreateTextFile) {
      items.push({
        id: 'create-text',
        label: 'New text file',
        description: 'Create a new text document',
        icon: <FileText className="w-4 h-4 text-gray-400" />,
        category: 'create',
        action: () => {
          onCreateTextFile();
          onOpenChange(false);
        },
        keywords: ['new', 'text', 'file', 'document', 'note'],
      });
    }

    return items;
  }, [
    selectedFilesCount,
    currentViewMode,
    currentGroupBy,
    recentFolders,
    onOpenChange,
    onNavigateToFiles,
    onNavigateToShared,
    onNavigateToFolder,
    onNavigateToTrash,
    onNavigateToSettings,
    onNavigateToAnalytics,
    onNavigateToAccount,
    onNavigateToDeveloperApi,
    onOpenQuickJump,
    onRefresh,
    onSignOut,
    onUploadFile,
    onCreateFolder,
    onCreateTextFile,
    onDeleteSelected,
    onShareSelected,
    onDownloadSelected,
    onSetViewMode,
    onSetGroupBy,
    onTogglePeekSidebar,
  ]);

  // Helper to format file size
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Search files and folders when query exists
  const fileSearchResults = useMemo((): CommandItem[] => {
    if (!normalizedSearchQuery || normalizedSearchQuery.length < 2) return [];

    const query = normalizedSearchQuery;
    const results: CommandItem[] = [];

    const folderMatches = folders
      .map(folder => ({ folder, score: scoreTextMatch(folder.name, query) }))
      .filter(item => Number.isFinite(item.score))
      .sort((a, b) => (a.score - b.score) || a.folder.name.length - b.folder.name.length)
      .slice(0, 6);

    folderMatches.forEach(({ folder }) => {
        results.push({
          id: `folder-${folder.id}`,
          label: folder.name,
          description: folder.path ? `📁 ${folder.path}` : '📁 Root folder',
          icon: <FolderOpen className="w-4 h-4 text-primary" />,
          category: 'files',
          action: () => {
            onNavigateToFolder?.(folder.path);
            onOpenChange(false);
          },
          keywords: ['folder', folder.name.toLowerCase()],
        });
      });

    const fileMatches = files
      .filter(file => !file.is_folder)
      .map(file => ({ file, score: scoreTextMatch(file.name, query) }))
      .filter(item => Number.isFinite(item.score))
      .sort((a, b) => (a.score - b.score) || a.file.name.length - b.file.name.length)
      .slice(0, 14);

    fileMatches.forEach(({ file }) => {
        const folderPath = file.parent_folder || file.path || '';
        results.push({
          id: `file-${file.id}`,
          label: file.name,
          description: `${formatSize(file.size)}${folderPath ? ` • ${folderPath}` : ''}`,
          icon: getFileIcon(file.type, file.name),
          category: 'files',
          action: () => {
            if (onOpenFile) {
              onOpenFile(file);
            }
            onOpenChange(false);
          },
          keywords: [file.name.toLowerCase(), file.type],
        });
      });

    return results;
  }, [normalizedSearchQuery, files, folders, onNavigateToFolder, onOpenFile, onOpenChange]);

  const commandSearchIndex = useMemo(() => {
    return commands.map(cmd => ({
      cmd,
      blob: `${cmd.label} ${cmd.description || ''} ${(cmd.keywords || []).join(' ')}`.toLowerCase(),
    }));
  }, [commands]);

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    // Always include file search results at the top when searching
    const fileResults = fileSearchResults;

    if (!normalizedSearchQuery) return commands;

    const commandResults = commandSearchIndex
      .filter(item => item.blob.includes(normalizedSearchQuery))
      .map(item => item.cmd);

    // Combine file results with command results
    return [...fileResults, ...commandResults].slice(0, 80);
  }, [commands, normalizedSearchQuery, fileSearchResults, commandSearchIndex]);

  // Group filtered commands by category
  const groupedCommands = useMemo(() => {
    const groups = new Map<CommandCategory, CommandItem[]>();
    
    filteredCommands.forEach(cmd => {
      if (!groups.has(cmd.category)) {
        groups.set(cmd.category, []);
      }
      groups.get(cmd.category)!.push(cmd);
    });
    
    return categoryOrder
      .filter(cat => groups.has(cat))
      .map(cat => ({
        category: cat,
        label: categoryLabels[cat],
        items: groups.get(cat)!,
      }));
  }, [filteredCommands]);

  // Flatten for keyboard navigation
  const flatCommands = filteredCommands;

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setSelectedIndex(0);
      const frame = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, flatCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatCommands[selectedIndex]) {
            flatCommands[selectedIndex].action();
          }
          break;
        case 'Escape':
          onOpenChange(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, flatCommands, selectedIndex, onOpenChange]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    
    const selectedEl = list.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Keep selectedIndex in bounds
  useEffect(() => {
    if (selectedIndex >= flatCommands.length) {
      setSelectedIndex(Math.max(0, flatCommands.length - 1));
    }
  }, [flatCommands.length, selectedIndex]);

  let currentIndex = 0;

  // Shared content for both mobile and desktop
  const commandContent = (
    <>
      <style>{SPOTLIGHT_CSS}</style>

      {/* Search header — one clean rounded input bar + own close pill */}
      <div className="spot-head">
        <div className="spot-searchbar">
          <Search className="w-[17px] h-[17px] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder={isMobile ? "Search files, folders or commands…" : "Search files, folders, or type a command…"}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSelectedIndex(0); }}
            className="spot-input"
            aria-label="Search files and commands"
          />
          {searchQuery && (
            <button type="button" className="spot-clear" aria-label="Clear search"
              onClick={() => { setSearchQuery(''); setSelectedIndex(0); inputRef.current?.focus(); }}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button type="button" className="spot-close" aria-label="Close search"
          onClick={() => onOpenChange(false)}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Results — grouped, one sliding selection thumb */}
      <div ref={listRef} className={cn("spot-list", isMobile ? "flex-1" : "max-h-[380px]")}>
        {groupedCommands.map((group) => (
          <div key={group.category}>
            <div className="spot-group-label">{group.label}</div>
            {group.items.map((cmd) => {
              const itemIndex = currentIndex++;
              const isSelected = !isMobile && itemIndex === selectedIndex;
              return (
                <motion.div
                  key={cmd.id}
                  data-index={itemIndex}
                  role="option"
                  aria-selected={isSelected}
                  onClick={cmd.action}
                  onMouseEnter={() => !isMobile && setSelectedIndex(itemIndex)}
                  whileTap={reduce ? undefined : { scale: 0.985 }}
                  className="spot-row"
                  data-selected={isSelected}
                >
                  {isSelected && (
                    <motion.span
                      layoutId="spotlight-selected"
                      className="spot-row-thumb"
                      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 34, mass: 0.9 }}
                    />
                  )}
                  <span className="spot-ico">
                    {React.cloneElement(cmd.icon as React.ReactElement, { className: "w-[17px] h-[17px]" })}
                  </span>
                  <span className="spot-main">
                    <span className="spot-label">{cmd.label}</span>
                    {cmd.description && <span className="spot-desc" style={{ display: 'block' }}>{cmd.description}</span>}
                  </span>
                  {!isMobile && cmd.shortcut && <kbd className="spot-kbd">{cmd.shortcut}</kbd>}
                  {!isMobile && isSelected && <CornerDownLeft className="spot-enter w-4 h-4 shrink-0" />}
                  {isMobile && <ArrowRight className="spot-enter w-4 h-4 shrink-0" />}
                </motion.div>
              );
            })}
          </div>
        ))}

        {flatCommands.length === 0 && (
          <div className="spot-empty" role="status">
            <Search className="w-8 h-8 mb-3 opacity-40" />
            <p>{searchQuery.length > 0 ? "No files or commands found" : "No commands found"}</p>
            <span>{searchQuery.length > 0 ? "Try a different search term" : "Start typing to search"}</span>
          </div>
        )}
      </div>

      {/* Footer hints — desktop only */}
      {!isMobile && (
        <div className="spot-foot">
          <span><kbd>↑↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Run</span>
          <span><kbd>esc</kbd> Close</span>
        </div>
      )}
    </>
  );

  // Mobile: full-screen sheet from bottom, same surface language
  if (isMobile) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange}>
        <BottomSheetContent className="spot-panel flex h-[85dvh] max-h-[85dvh] min-h-0 flex-col p-0 rounded-t-[22px]">
          {commandContent}
        </BottomSheetContent>
      </BottomSheet>
    );
  }

  // Desktop: centered floating panel with a spring pop-in
  return (
    <AnimatePresence>
      {open && (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="spot-panel max-w-[600px] w-full p-0 gap-0 [&>[data-slot='dialog-close']]:hidden">
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 30, mass: 0.9 }}
            >
              {commandContent}
            </motion.div>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;

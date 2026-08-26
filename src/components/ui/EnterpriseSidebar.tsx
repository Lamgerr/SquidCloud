import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useKeyboardShortcutsContext } from '@/components/KeyboardShortcuts';
import {
  FileStack, Users, Trash2, Activity, Book,
  Settings2, PanelLeftClose, PanelLeft, Star, Folder,
  Keyboard, ChevronsUpDown, LogOut, User, Key,
  Inbox, Zap, Lock,
  type Icon,
} from '@/lib/icon-map';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import SwitchAccountSheet from '@/components/SwitchAccountSheet';
import SquidLogo from '@/components/ui/SquidLogo';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  sidebarCollapsed: boolean;
  onToggleCollapse: () => void;
  user: any;
  profile: any;
  bookmarks: any[];
  onSearchOpen: () => void;
  onSignOut: () => void;
  currentFolder: string;
  onNavigateToFolder: (path: string) => void;
}

const PRIMARY_NAV = [
  { id: 'files', label: 'Files', icon: FileStack, shortcut: '⌘1' },
  { id: 'shared', label: 'Shared', icon: Users, shortcut: '⌘2' },
  { id: 'trash', label: 'Trash', icon: Trash2, shortcut: '⌘3' },
];

const TOOLS_NAV = [
  { id: 'analytics', label: 'Analytics', icon: Activity },
  { id: 'secrets', label: 'Secrets', icon: Lock },
  { id: 'scripts', label: 'SquidActions', icon: Zap },
  { id: 'file-requests', label: 'File Requests', icon: Inbox },
  { id: 'books', label: 'Books', icon: Book },
];

export const EnterpriseSidebar: React.FC<SidebarProps> = ({
  activeTab, onTabChange, sidebarCollapsed, onToggleCollapse,
  user, profile, bookmarks, onSearchOpen: _onSearchOpen, onSignOut,
  currentFolder: _currentFolder, onNavigateToFolder,
}) => {
  const navigate = useNavigate();
  const { setOverlayOpen } = useKeyboardShortcutsContext();
  const collapsed = sidebarCollapsed;
  const [switchOpen, setSwitchOpen] = useState(false);

  const planLabel = profile?.is_premium
    ? (profile?.tier === 'supporter-plus' ? 'Supporter+' : 'Supporter')
    : 'Free';

  const NavItem = ({ item }: { item: { id: string; label: string; icon: Icon; shortcut?: string } }) => {
    const isActive = activeTab === item.id;
    return (
      <button
        onClick={() => onTabChange(item.id)}
        title={collapsed ? item.label : undefined}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'group flex w-full items-center outline-none transition-colors duration-150',
          collapsed ? 'justify-center h-8 w-8 mx-auto rounded-md' : 'h-8 gap-2.5 px-2 rounded-md',
          isActive
            ? 'bg-white/[0.08] text-foreground'
            : 'text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.04]',
        )}
      >
        <item.icon className="w-4 h-4 shrink-0 opacity-90" />
        {!collapsed && (
          <>
            <span className="text-[13px] flex-1 text-left truncate">{item.label}</span>
            {item.shortcut && (
              <span className="text-[10px] tabular-nums text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity">
                {item.shortcut}
              </span>
            )}
          </>
        )}
      </button>
    );
  };

  return (
    <aside className={cn(
      'flex flex-col flex-shrink-0 select-none',
      'bg-[#0c0c0e]/85 backdrop-blur-xl border-r border-white/[0.06]',
      'transition-[width] duration-200 ease-out',
      collapsed ? 'w-[56px]' : 'w-[224px]'
    )}>
      {/* Workspace / app identity */}
      <div className={cn(
        'flex items-center h-12 border-b border-white/[0.05] shrink-0',
        collapsed ? 'justify-center' : 'justify-between pl-3 pr-1.5'
      )}>
        {!collapsed && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 min-w-0 py-1 pr-2 -ml-0.5 rounded-md hover:bg-white/[0.04] transition-colors outline-none">
                <SquidLogo size={20} mono />
                <span className="text-[13px] font-semibold tracking-tight text-foreground truncate">
                  SquidCloud
                </span>
                <ChevronsUpDown className="h-3 w-3 text-neutral-600 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <div className="px-2 py-1.5">
                <p className="text-[13px] font-medium text-foreground truncate">{profile?.full_name || 'User'}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
                <p className="text-[10px] text-neutral-500 mt-1">{planLabel} plan</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 cursor-pointer text-[13px]" onClick={() => navigate('/pricing')}>
                {profile?.is_premium
                  ? (<><Star className="h-3.5 w-3.5" /><span>Manage plan</span></>)
                  : (<><Star className="h-3.5 w-3.5" /><span>Upgrade plan</span></>)}
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 cursor-pointer text-[13px]" onClick={() => navigate('/settings/account')}>
                <Settings2 className="h-3.5 w-3.5" /><span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 cursor-pointer text-[13px]" onClick={() => navigate('/developer-api')}>
                <Key className="h-3.5 w-3.5" /><span>API keys</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 cursor-pointer text-[13px]" onClick={() => setOverlayOpen(true)}>
                <Keyboard className="h-3.5 w-3.5" /><span>Shortcuts</span>
                <kbd className="ml-auto text-[10px] text-muted-foreground">⌘/</kbd>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 cursor-pointer text-[13px]" onClick={() => setSwitchOpen(true)}>
                <User className="h-3.5 w-3.5" /><span>Switch account</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer text-[13px]"
                onClick={onSignOut}
              >
                <LogOut className="h-3.5 w-3.5" /><span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <button
          onClick={onToggleCollapse}
          className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.06] transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeft className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-4 lg-scrollbar-none">
        <div className="space-y-0.5">
          {!collapsed && (
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">Workspace</p>
          )}
          {PRIMARY_NAV.map((item) => <NavItem key={item.id} item={item} />)}
        </div>

        <div className="space-y-0.5">
          {!collapsed && (
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">Tools</p>
          )}
          {TOOLS_NAV.map((item) => <NavItem key={item.id} item={item} />)}
        </div>

        {!collapsed && bookmarks.length > 0 && (
          <div className="space-y-0.5">
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">Favorites</p>
            {bookmarks.slice(0, 5).map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  if (b.type === 'folder' && b.path) { onNavigateToFolder(b.path); onTabChange('files'); }
                }}
                className="group flex h-7 w-full items-center gap-2.5 px-2 rounded-md text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.04] outline-none transition-colors"
              >
                {b.type === 'folder'
                  ? <Folder className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                  : <FileStack className="h-3.5 w-3.5 text-neutral-500 shrink-0" />}
                <span className="text-[12.5px] truncate">{b.name}</span>
                <Star className="ml-auto h-2.5 w-2.5 text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* Footer: settings + account */}
      <div className="shrink-0 p-2 space-y-0.5 border-t border-white/[0.05]">
        <button
          onClick={() => navigate('/settings/account')}
          className={cn(
            'flex w-full items-center transition-colors duration-150 rounded-md',
            collapsed ? 'justify-center h-8 w-8 mx-auto' : 'h-8 gap-2.5 px-2',
            activeTab === 'settings'
              ? 'bg-white/[0.08] text-foreground'
              : 'text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.04]'
          )}
        >
          <Settings2 className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="text-[13px]">Settings</span>}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              'group flex w-full items-center transition-colors duration-150 rounded-md',
              collapsed ? 'justify-center h-9 w-9 mx-auto' : 'h-10 gap-2.5 px-1.5',
              'hover:bg-white/[0.04] outline-none'
            )}>
              <div className="h-7 w-7 rounded-full bg-neutral-700 border border-white/[0.08] flex items-center justify-center text-[11px] font-semibold text-neutral-200 shrink-0">
                {(profile?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
              {!collapsed && (
                <>
                  <div className="min-w-0 text-left">
                    <p className="text-[12.5px] font-medium text-neutral-200 truncate leading-tight">
                      {profile?.full_name || user?.email?.split('@')[0] || 'User'}
                    </p>
                    <p className="text-[10.5px] text-neutral-500 truncate leading-tight">{planLabel}</p>
                  </div>
                  <ChevronsUpDown className="ml-auto h-3 w-3 text-neutral-600 shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={collapsed ? 'center' : 'start'} side="top" sideOffset={10} className="w-52">
            <div className="px-2 py-1.5">
              <p className="text-[13px] font-medium text-foreground truncate">{profile?.full_name || 'User'}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 cursor-pointer text-[13px]" onClick={() => setSwitchOpen(true)}>
              <User className="h-3.5 w-3.5" /><span>Switch account</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer text-[13px]"
              onClick={onSignOut}
            >
              <LogOut className="h-3.5 w-3.5" /><span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SwitchAccountSheet open={switchOpen} onOpenChange={setSwitchOpen} />
    </aside>
  );
};

export default EnterpriseSidebar;

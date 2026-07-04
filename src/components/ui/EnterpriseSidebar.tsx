import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  FileStack, Users, Trash2, Activity,
  Settings2, PanelLeftClose, PanelLeft, Star, Folder,
  Keyboard, ChevronsUpDown, LogOut, User, Key,
  Inbox, Zap, Lock, Crown, Sparkles, ArrowUpRight,
  type Icon,
} from '@/lib/icon-map';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import SwitchAccountSheet from '@/components/SwitchAccountSheet';

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
];

export const EnterpriseSidebar: React.FC<SidebarProps> = ({
  activeTab, onTabChange, sidebarCollapsed, onToggleCollapse,
  user, profile, bookmarks, onSearchOpen: _onSearchOpen, onSignOut,
  currentFolder: _currentFolder, onNavigateToFolder,
}) => {
  const navigate = useNavigate();
  const collapsed = sidebarCollapsed;
  const [switchOpen, setSwitchOpen] = useState(false);

  const NavItem = ({ item }: { item: { id: string; label: string; icon: Icon; shortcut?: string } }) => {
    const isActive = activeTab === item.id;
    return (
      <button
        onClick={() => onTabChange(item.id)}
        title={collapsed ? item.label : undefined}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'group relative flex items-center w-full outline-none transition-all duration-150',
          collapsed ? 'justify-center h-9 w-9 mx-auto rounded-xl' : 'h-9 gap-2.5 px-2.5 rounded-lg',
          isActive
            ? 'bg-primary/10 text-primary font-medium shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)]'
            : 'text-muted-foreground/60 hover:text-foreground/80 hover:bg-accent/50 active:scale-[0.97]'
        )}
      >
        <item.icon className={cn("w-4 h-4 flex-shrink-0", !isActive && "opacity-50 group-hover:opacity-80 transition-opacity duration-150")} />
        {!collapsed && (
          <>
            <span className="text-xs flex-1 text-left">{item.label}</span>
            {item.shortcut && (
              <span className="text-[9px] font-mono text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity">{item.shortcut}</span>
            )}
          </>
        )}
        {isActive && !collapsed && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-full scale-y-0 data-[state=active]:scale-y-100 transition-transform duration-200" aria-hidden="true" style={{ transform: 'translateY(-50%) scaleY(1)' }} />
        )}
      </button>
    );
  };

  const SectionLabel = ({ label }: { label: string }) => {
    if (collapsed) return <div className="h-3" />;
    return <div className="px-2.5 pt-3 pb-1 select-none"><p className="lg-text-label">{label}</p></div>;
  };

  return (
    <aside className={cn(
      'sticky top-0 self-start h-screen lg:h-[100dvh] flex-shrink-0 z-30',
      'bg-card/40 backdrop-blur-2xl border-r border-border/15',
      'flex flex-col',
      collapsed ? 'w-[60px]' : 'w-[200px]'
    )}>
      <div className={cn(
        'flex items-center h-12 border-b border-border/15 flex-shrink-0',
        collapsed ? 'justify-center' : 'justify-between px-3'
      )}>
        {!collapsed && (
          <span className="lg-text-label px-1">NAVIGATION</span>
        )}
        <button
          onClick={onToggleCollapse}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-accent/50 transition-all lg-press-subtle"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeft className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
        </button>
      </div>

      <nav className="relative flex-1 overflow-y-auto overflow-x-hidden px-1.5 lg-scrollbar">
        <div className="space-y-px">
          <SectionLabel label="Workspace" />
          {PRIMARY_NAV.map(item => <NavItem key={item.id} item={item} />)}
        </div>
        <div className="mt-0.5 space-y-px">
          <SectionLabel label="Tools" />
          {TOOLS_NAV.map(item => <NavItem key={item.id} item={item} />)}
        </div>
        {!collapsed && bookmarks.length > 0 && (
          <div className="mt-0.5">
            <SectionLabel label="Favorites" />
            <div className="space-y-px">
              {bookmarks.slice(0, 5).map(b => (
                <button
                  key={b.id}
                  onClick={() => { if (b.type === 'folder' && b.path) { onNavigateToFolder(b.path); onTabChange('files'); } }}
                  className="group flex h-9 w-full items-center gap-2.5 px-2.5 rounded-lg text-muted-foreground/60 hover:bg-accent/50 hover:text-foreground/80 outline-none transition-all duration-150"
                >
                  {b.type === 'folder'
                    ? <Folder className="h-3.5 w-3.5 text-primary/50 flex-shrink-0" />
                    : <FileStack className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
                  }
                  <span className="text-[11.5px] font-medium truncate flex-1 text-left">{b.name}</span>
                  <Star className="h-2.5 w-2.5 text-amber-400/50 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="flex-shrink-0 mt-2 p-1.5 space-y-px">
        <button
          onClick={() => navigate('/settings/account')}
          className={cn(
            'group flex w-full items-center outline-none transition-all duration-150 rounded-lg',
            collapsed ? 'justify-center h-9 w-9 mx-auto' : 'h-9 gap-2.5 px-2.5',
            activeTab === 'settings' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground/60 hover:text-foreground/80 hover:bg-accent/50'
          )}
        >
          <Settings2 className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="text-xs font-medium">Settings</span>}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              'group flex w-full items-center outline-none transition-all duration-150 rounded-lg',
              collapsed ? 'justify-center h-9 w-9 mx-auto' : 'h-9 gap-2.5 px-2.5',
              'text-muted-foreground/60 hover:bg-accent/50 hover:text-foreground/80'
            )}>
              <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center font-semibold text-primary flex-shrink-0 text-[10px]">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11.5px] font-medium text-foreground/90 truncate leading-tight">
                      {profile?.full_name || user?.email?.split('@')[0] || 'User'}
                    </p>
                  </div>
                  <ChevronsUpDown className="h-3 w-3 text-muted-foreground/30 flex-shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align={collapsed ? 'center' : 'end'}
            side="top"
            sideOffset={14}
            className="lg-dropdown w-56"
          >
            <div className="px-2.5 py-2 border-b border-border/40 mb-1 space-y-1">
              <p className="text-sm font-medium text-foreground truncate">{profile?.full_name || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              <div className={cn(
                'flex items-center gap-1.5 pt-1',
                profile?.is_premium ? 'text-amber-500' : 'text-muted-foreground/50',
              )}>
                {profile?.is_premium ? (
                  <Crown className="h-3 w-3" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                <span className="text-[10px] font-semibold">
                  {profile?.is_premium ? 'Supporter' : 'Free Plan'}
                </span>
              </div>
            </div>

            {!profile?.is_premium && (
              <DropdownMenuItem className="gap-2.5 py-2 cursor-pointer text-sm font-medium text-amber-500 focus:text-amber-500 focus:bg-amber-500/10 rounded-md" onClick={() => navigate('/pricing')}>
                <Crown className="h-4 w-4" /><span>Upgrade Plan</span><ArrowUpRight className="h-3 w-3 ml-auto" />
              </DropdownMenuItem>
            )}

            {profile?.is_premium && (
              <DropdownMenuItem className="gap-2.5 py-2 cursor-pointer text-sm text-muted-foreground focus:text-foreground rounded-md" onClick={() => navigate('/pricing')}>
                <Sparkles className="h-4 w-4" /><span>Manage Plan</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuItem className="gap-2.5 py-2 cursor-pointer text-sm text-muted-foreground focus:text-foreground rounded-md" onClick={() => navigate('/settings/account')}>
              <User className="h-4 w-4" /><span>Account</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2.5 py-2 cursor-pointer text-sm text-muted-foreground focus:text-foreground rounded-md" onClick={() => navigate('/developer-api')}>
              <Key className="h-4 w-4" /><span>API Keys</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2.5 py-2 cursor-pointer text-sm text-muted-foreground focus:text-foreground rounded-md">
              <Keyboard className="h-4 w-4" /><span>Shortcuts</span>
              <kbd className="ml-auto text-[9px] bg-muted/50 px-1.5 py-0.5 rounded border border-border/30">⌘/</kbd>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/40 my-1" />
            <DropdownMenuItem className="gap-2.5 py-2 cursor-pointer text-sm text-muted-foreground focus:text-foreground rounded-md" onClick={() => setSwitchOpen(true)}>
              <User className="h-4 w-4" /><span>Switch Account</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/40 my-1" />
            <DropdownMenuItem className="gap-2.5 py-2 text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer text-sm rounded-md" onClick={onSignOut}>
              <LogOut className="h-4 w-4" /><span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SwitchAccountSheet open={switchOpen} onOpenChange={setSwitchOpen} />
    </aside>
  );
};

export default EnterpriseSidebar;

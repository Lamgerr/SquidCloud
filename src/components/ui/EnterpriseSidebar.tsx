import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useKeyboardShortcutsContext } from '@/components/KeyboardShortcuts';
import {
  Home, FileStack, Users, Trash2, Activity, Book,
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

/* ── Sidebar contract: props, tab ids and handlers unchanged ── */
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

const MONO = { fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" };
const LIME = '#c8f04b';

const PRIMARY_NAV = [
  { id: 'home', label: 'Home', icon: Home },
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
          'sq-press group relative flex w-full items-center outline-none',
          collapsed ? 'mx-auto h-9 w-9 justify-center rounded-lg' : 'h-9 gap-2.5 rounded-lg px-2.5',
          isActive ? 'text-[#101300]' : 'text-neutral-400 hover:bg-white/[0.05] hover:text-neutral-100',
        )}
        style={isActive ? { background: LIME, fontWeight: 600 } : undefined}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-left text-[13px]">{item.label}</span>
            {item.shortcut && (
              <span
                className="font-mono text-[10px] tabular-nums opacity-0 transition-opacity group-hover:opacity-100"
                style={{ ...MONO, color: isActive ? 'rgba(16,19,0,0.6)' : '#63635c' }}
              >
                {item.shortcut}
              </span>
            )}
          </>
        )}
      </button>
    );
  };

  const SectionLabel = ({ children }: { children: React.ReactNode }) => {
    if (collapsed) return null;
    return (
      <p className="px-2.5 pb-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[#63635c]" style={MONO}>
        {children}
      </p>
    );
  };

  return (
    <aside className={cn(
      'flex flex-shrink-0 select-none flex-col',
      'border-r border-white/[0.07] bg-[#08080a]/95 backdrop-blur-xl',
      'transition-[width] duration-200 ease-out',
      collapsed ? 'w-[60px]' : 'w-[232px]'
    )}>
      {/* Workspace / app identity */}
      <div className={cn(
        'flex h-12 shrink-0 items-center border-b border-white/[0.06]',
        collapsed ? 'justify-center' : 'justify-between pl-3 pr-1.5'
      )}>
        {!collapsed && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="sq-press -ml-0.5 flex min-w-0 items-center gap-2 rounded-lg py-1 pr-2 outline-none hover:bg-white/[0.05]">
                <SquidLogo size={20} mono />
                <span className="truncate text-[13px] font-semibold tracking-tight text-neutral-100">
                  SquidCloud
                </span>
                <ChevronsUpDown className="h-3 w-3 shrink-0 text-neutral-600" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <div className="px-2 py-1.5">
                <p className="truncate text-[13px] font-medium text-foreground">{profile?.full_name || 'User'}</p>
                <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
                <p className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ ...MONO, color: LIME }}>
                  <span className="sq-live-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: LIME }} />
                  {planLabel} plan
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer gap-2 text-[13px]" onClick={() => navigate('/pricing')}>
                {profile?.is_premium
                  ? (<><Star className="h-3.5 w-3.5" /><span>Manage plan</span></>)
                  : (<><Star className="h-3.5 w-3.5" /><span>Upgrade plan</span></>)}
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer gap-2 text-[13px]" onClick={() => navigate('/settings/account')}>
                <Settings2 className="h-3.5 w-3.5" /><span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer gap-2 text-[13px]" onClick={() => navigate('/developer-api')}>
                <Key className="h-3.5 w-3.5" /><span>API keys</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer gap-2 text-[13px]" onClick={() => setOverlayOpen(true)}>
                <Keyboard className="h-3.5 w-3.5" /><span>Shortcuts</span>
                <kbd className="ml-auto font-mono text-[10px] text-muted-foreground" style={MONO}>⌘/</kbd>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer gap-2 text-[13px]" onClick={() => setSwitchOpen(true)}>
                <User className="h-3.5 w-3.5" /><span>Switch account</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-[13px] text-destructive focus:bg-destructive/10 focus:text-destructive"
                onClick={onSignOut}
              >
                <LogOut className="h-3.5 w-3.5" /><span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <button
          onClick={onToggleCollapse}
          className="sq-press flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 hover:bg-white/[0.06] hover:text-neutral-200"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-2 py-4 lg-scrollbar-none">
        <div className="space-y-1">
          <SectionLabel>Workspace</SectionLabel>
          {PRIMARY_NAV.map((item) => <NavItem key={item.id} item={item} />)}
        </div>

        <div className="space-y-1">
          <SectionLabel>Tools</SectionLabel>
          {TOOLS_NAV.map((item) => <NavItem key={item.id} item={item} />)}
        </div>

        {!collapsed && bookmarks.length > 0 && (
          <div className="space-y-1">
            <SectionLabel>Favorites</SectionLabel>
            {bookmarks.slice(0, 5).map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  if (b.type === 'folder' && b.path) { onNavigateToFolder(b.path); onTabChange('files'); }
                }}
                className="sq-press group flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-neutral-400 outline-none hover:bg-white/[0.05] hover:text-neutral-100"
              >
                {b.type === 'folder'
                  ? <Folder className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                  : <FileStack className="h-3.5 w-3.5 shrink-0 text-neutral-500" />}
                <span className="truncate text-[12.5px]">{b.name}</span>
                <Star className="ml-auto h-2.5 w-2.5 shrink-0 text-neutral-600 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* Footer: settings + account */}
      <div className="shrink-0 space-y-1 border-t border-white/[0.06] p-2">
        <button
          onClick={() => navigate('/settings/account')}
          className={cn(
            'sq-press flex w-full items-center rounded-lg transition-colors duration-150',
            collapsed ? 'mx-auto h-9 w-9 justify-center' : 'h-9 gap-2.5 px-2.5',
            activeTab === 'settings'
              ? 'text-[#101300]'
              : 'text-neutral-400 hover:bg-white/[0.05] hover:text-neutral-100'
          )}
          style={activeTab === 'settings' ? { background: LIME, fontWeight: 600 } : undefined}
        >
          <Settings2 className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="text-[13px]">Settings</span>}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              'sq-press group flex w-full items-center rounded-lg outline-none',
              collapsed ? 'mx-auto h-10 w-10 justify-center' : 'h-11 gap-2.5 px-2',
              'hover:bg-white/[0.05]'
            )}>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold text-neutral-200" style={{ background: '#1c1e14', borderColor: 'rgba(200,240,75,0.25)' }}>
                {(profile?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
              {!collapsed && (
                <>
                  <div className="min-w-0 text-left">
                    <p className="truncate text-[12.5px] font-medium leading-tight text-neutral-200">
                      {profile?.full_name || user?.email?.split('@')[0] || 'User'}
                    </p>
                    <p className="truncate font-mono text-[10px] uppercase leading-tight tracking-[0.12em]" style={{ ...MONO, color: LIME }}>{planLabel}</p>
                  </div>
                  <ChevronsUpDown className="ml-auto h-3 w-3 shrink-0 text-neutral-600" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={collapsed ? 'center' : 'start'} side="top" sideOffset={10} className="w-52">
            <div className="px-2 py-1.5">
              <p className="truncate text-[13px] font-medium text-foreground">{profile?.full_name || 'User'}</p>
              <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer gap-2 text-[13px]" onClick={() => setSwitchOpen(true)}>
              <User className="h-3.5 w-3.5" /><span>Switch account</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-[13px] text-destructive focus:bg-destructive/10 focus:text-destructive"
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

import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useKeyboardShortcutsContext } from '@/components/KeyboardShortcuts';
import { useAuth } from '@/contexts/AuthContext';
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
import { TopAppBar } from './navigation';
import { NavigationDrawer, DrawerSection, NavItemM3 } from './navigation';

const PRIMARY_NAV = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'files', label: 'Files', icon: FileStack },
  { id: 'shared', label: 'Shared', icon: Users },
  { id: 'trash', label: 'Trash', icon: Trash2 },
];

const TOOLS_NAV = [
  { id: 'analytics', label: 'Analytics', icon: Activity },
  { id: 'secrets', label: 'Secrets', icon: Lock },
  { id: 'scripts', label: 'SquidActions', icon: Zap },
  { id: 'file-requests', label: 'File Requests', icon: Inbox },
  { id: 'books', label: 'Books', icon: Book },
];

const IS_APPLE = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
const MOD = IS_APPLE ? '⌘' : 'Ctrl+';

export interface AppShellProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  user: any;
  profile: any;
  bookmarks: any[];
  onSearchOpen: () => void;
  onSignOut: () => void;
  currentFolder: string;
  onNavigateToFolder: (path: string) => void;
  topBarChips?: React.ReactNode;
  topBarActions?: React.ReactNode;
  topBar?: React.ReactNode;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeTab, onTabChange, collapsed, onToggleCollapse,
  user, profile, bookmarks, onSearchOpen: _onSearchOpen, onSignOut,
  currentFolder: _currentFolder, onNavigateToFolder,
  topBarChips, topBarActions, topBar, children,
}) => {
  const navigate = useNavigate();
  const { setOverlayOpen } = useKeyboardShortcutsContext();
  const [switchOpen, setSwitchOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  const planLabel = profile?.is_premium
    ? (profile?.tier === 'supporter-plus' ? 'Supporter+' : 'Supporter')
    : 'Free';
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';

  const onNavKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const items = Array.from(navRef.current?.querySelectorAll<HTMLElement>('[data-sb-item]') ?? []);
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    let next = i;
    if (e.key === 'ArrowDown') next = i < 0 ? 0 : Math.min(items.length - 1, i + 1);
    else if (e.key === 'ArrowUp') next = i < 0 ? items.length - 1 : Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else next = items.length - 1;
    e.preventDefault();
    e.stopPropagation();
    items[next]?.focus();
  };

  return (
    <div className="flex h-screen w-full overflow-hidden m3-app">
      <NavigationDrawer
        collapsed={collapsed}
        rail={collapsed}
        header={
          <div className="m3-drawer__brand">
            {!collapsed && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Account and workspace menu"
                    className="flex min-w-0 items-center gap-2 rounded-full py-1 pr-2 outline-none transition-colors hover:bg-[hsl(var(--m3-on-surface-hsl)/0.08)]"
                  >
                    <SquidLogo size={20} mono />
                    <span className="truncate text-[13px] font-medium tracking-tight m3-on-surface">SquidCloud</span>
                    <ChevronsUpDown className="h-3 w-3 shrink-0 m3-on-surface-variant" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 m3-menu">
                  <div className="px-2 py-1.5">
                    <p className="truncate text-[13px] font-medium m3-on-surface">{profile?.full_name || 'User'}</p>
                    <p className="truncate text-[12px] m3-on-surface-variant">{user?.email}</p>
                    <p className="mt-1.5 inline-flex rounded border border-[hsl(var(--m3-outline-variant-hsl))] px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.12em] m3-on-surface-variant">
                      {planLabel} plan
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer gap-2 text-[13px]" onClick={() => navigate('/pricing')}>
                    <Star className="h-3.5 w-3.5" /><span>{profile?.is_premium ? 'Manage plan' : 'Upgrade plan'}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer gap-2 text-[13px]" onClick={() => navigate('/settings/account')}>
                    <Settings2 className="h-3.5 w-3.5" /><span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer gap-2 text-[13px]" onClick={() => navigate('/developer-api')}>
                    <Key className="h-3.5 w-3.5" /><span>API keys</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer gap-2 text-[13px]" onClick={() => setOverlayOpen(true)}>
                    <Keyboard className="h-3.5 w-3.5" /><span>Shortcuts</span>
                    <kbd className="ml-auto font-mono text-[10px] m3-on-surface-variant">{MOD}/</kbd>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer gap-2 text-[13px]" onClick={() => setSwitchOpen(true)}>
                    <User className="h-3.5 w-3.5" /><span>Switch account</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer gap-2 text-[13px] text-[hsl(var(--m3-error-hsl))] focus:bg-[hsl(var(--m3-error-hsl)/0.1)]"
                    onClick={onSignOut}
                  >
                    <LogOut className="h-3.5 w-3.5" /><span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="flex h-7 w-7 items-center justify-center rounded-full m3-on-surface-variant outline-none transition-colors hover:bg-[hsl(var(--m3-on-surface-hsl)/0.08)]"
            >
              {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>
        }
        footer={
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => navigate('/settings/account')}
              title={collapsed ? 'Settings' : undefined}
              aria-label={collapsed ? 'Settings' : undefined}
              aria-current={activeTab === 'settings' ? 'page' : undefined}
              className="m3-nav-item"
              data-sb-item=""
            >
              <span className="m3-nav-item__icon" aria-hidden="true"><Settings2 /></span>
              <span className="m3-nav-item__label">Settings</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Account menu, ${displayName}`}
                  className="m3-nav-item"
                >
                  <span className="m3-nav-item__icon" aria-hidden="true">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--m3-secondary-container-hsl))] text-[11px] font-medium m3-on-secondary-container">
                      {(profile?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
                    </span>
                  </span>
                  {!collapsed && (
                    <span className="m3-nav-item__label">
                      <span className="block truncate text-[12.5px] font-medium m3-on-surface">{displayName}</span>
                      <span className="block truncate font-mono text-[10px] uppercase tracking-[0.12em] m3-on-surface-variant">{planLabel}</span>
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={collapsed ? 'center' : 'start'} side="top" sideOffset={10} className="w-56 m3-menu">
                <div className="px-2 py-1.5">
                  <p className="truncate text-[13px] font-medium m3-on-surface">{profile?.full_name || 'User'}</p>
                  <p className="truncate text-[12px] m3-on-surface-variant">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer gap-2 text-[13px]" onClick={() => setSwitchOpen(true)}>
                  <User className="h-3.5 w-3.5" /><span>Switch account</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-[13px] text-[hsl(var(--m3-error-hsl))]"
                  onClick={onSignOut}
                >
                  <LogOut className="h-3.5 w-3.5" /><span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      >
        <nav ref={navRef} aria-label="Primary" onKeyDown={onNavKeyDown} className="space-y-4">
          <DrawerSection label="Workspace" collapsed={collapsed}>
            {PRIMARY_NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                data-sb-item=""
                onClick={() => onTabChange(item.id)}
                title={collapsed ? item.label : undefined}
                aria-label={collapsed ? item.label : undefined}
                aria-current={activeTab === item.id ? 'page' : undefined}
                className="m3-nav-item"
              >
                <span className="m3-nav-item__icon" aria-hidden="true"><item.icon /></span>
                <span className="m3-nav-item__label">{item.label}</span>
                {item.id === 'files' && null}
              </button>
            ))}
          </DrawerSection>

          <DrawerSection label="Tools" collapsed={collapsed}>
            {TOOLS_NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                data-sb-item=""
                onClick={() => onTabChange(item.id)}
                title={collapsed ? item.label : undefined}
                aria-label={collapsed ? item.label : undefined}
                aria-current={activeTab === item.id ? 'page' : undefined}
                className="m3-nav-item"
              >
                <span className="m3-nav-item__icon" aria-hidden="true"><item.icon /></span>
                <span className="m3-nav-item__label">{item.label}</span>
              </button>
            ))}
          </DrawerSection>

          {!collapsed && bookmarks.length > 0 && (
            <DrawerSection label="Favorites" collapsed={collapsed}>
              {bookmarks.slice(0, 5).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  data-sb-item=""
                  title={b.path || b.name}
                  onClick={() => {
                    if (b.type === 'folder' && b.path) { onNavigateToFolder(b.path); onTabChange('files'); }
                  }}
                  className="m3-nav-item"
                >
                  <span className="m3-nav-item__icon" aria-hidden="true">
                    {b.type === 'folder' ? <Folder /> : <FileStack />}
                  </span>
                  <span className="m3-nav-item__label">{b.name}</span>
                </button>
              ))}
            </DrawerSection>
          )}
        </nav>

        <SwitchAccountSheet open={switchOpen} onOpenChange={setSwitchOpen} />
      </NavigationDrawer>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex h-screen flex-col overflow-hidden">
        {topBar ? topBar : (
          <TopAppBar
            chips={topBarChips}
            actions={topBarActions}
          />
        )}
        <main data-scroll-container="true" className="flex-1 overscroll-y-contain overflow-y-auto px-4 lg:px-5 pb-10 pt-4">
          <div className="mx-auto w-full max-w-[1680px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppShell;

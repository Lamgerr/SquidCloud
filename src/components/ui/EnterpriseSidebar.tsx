import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'framer-motion';
import { useKeyboardShortcutsContext } from '@/components/KeyboardShortcuts';
import {
  Home, FileStack, Users, Trash2, Activity, Book,
  Settings2, PanelLeftClose, PanelLeft, Star, Folder,
  Keyboard, ChevronsUpDown, LogOut, User,
  Inbox, Zap, Lock,
  type Icon,
} from '@/lib/icon-map';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import SwitchAccountSheet from '@/components/SwitchAccountSheet';

/* ── Sidebar contract: props, tab ids and handlers unchanged.
      Visual language: the same segmented control used for the view options,
      rotated vertical — one floating dark capsule, a layoutId thumb that
      slides to the active item, spring press/hover, icon-first. ── */

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

type NavDef = { id: string; label: string; icon: Icon; shortcut?: string };

const PRIMARY_NAV: NavDef[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'files', label: 'Files', icon: FileStack, shortcut: '1' },
  { id: 'shared', label: 'Shared', icon: Users, shortcut: '2' },
  { id: 'trash', label: 'Trash', icon: Trash2, shortcut: '3' },
];

const TOOLS_NAV: NavDef[] = [
  { id: 'analytics', label: 'Analytics', icon: Activity },
  { id: 'secrets', label: 'Secrets', icon: Lock },
  { id: 'scripts', label: 'SquidActions', icon: Zap },
  { id: 'file-requests', label: 'File Requests', icon: Inbox },
  { id: 'books', label: 'Books', icon: Book },
];

const IS_APPLE =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
const MOD = IS_APPLE ? '⌘' : 'Ctrl+';

/* Exactly the GlassSegment / floating-dock motion vocabulary */
const THUMB = { type: 'spring' as const, stiffness: 380, damping: 21, mass: 0.8 };
const ICON_TAP = { type: 'spring' as const, stiffness: 600, damping: 16 };

/* One item in the vertical segment. The thumb is a single layoutId shared by
   every item, so it slides vertically between the active selection. */
function SegItem({
  item, active, collapsed, onSelect, reduce, index,
}: {
  item: NavDef; active: boolean; collapsed: boolean; onSelect: (id: string) => void;
  reduce: boolean; index: number;
}) {
  return (
    <motion.button
      type="button"
      data-sb-item=""
      onClick={() => onSelect(item.id)}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
      initial={reduce ? false : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={reduce ? { duration: 0 } : { ...THUMB, delay: 0.02 * index }}
      className={cn(
        'sb-seg-b',
        collapsed ? 'sb-seg-icon' : 'sb-seg-wide',
        active ? 'sb-on' : 'sb-idle',
      )}
    >
      {active && (
        <motion.span
          layoutId="sb-seg-thumb"
          className="sb-seg-thumb"
          transition={reduce ? { duration: 0 } : THUMB}
        />
      )}
      <motion.span className="sb-seg-i-wrap" whileTap={reduce ? undefined : { scale: 0.78 }} transition={ICON_TAP}>
        <item.icon className="sb-seg-i" strokeWidth={1.7} />
      </motion.span>
      {!collapsed && <span className="sb-seg-label">{item.label}</span>}
      {!collapsed && item.shortcut && (
        <kbd className="sb-seg-kbd">{MOD}{item.shortcut}</kbd>
      )}
    </motion.button>
  );
}

function SegDivider() {
  return <div aria-hidden="true" className="mx-auto my-1 h-px w-5 bg-foreground/10" />;
}

export const EnterpriseSidebar: React.FC<SidebarProps> = ({
  activeTab, onTabChange, sidebarCollapsed, onToggleCollapse,
  user, profile, bookmarks, onSearchOpen: _onSearchOpen, onSignOut,
  currentFolder: _currentFolder, onNavigateToFolder,
}) => {
  const navigate = useNavigate();
  const { setOverlayOpen } = useKeyboardShortcutsContext();
  const reduce = !!useReducedMotion();
  const collapsed = sidebarCollapsed;
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
    <motion.aside
      aria-label="Workspace sidebar"
      initial={reduce ? false : { x: -16, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={reduce ? { duration: 0 } : { ...THUMB, delay: 0.05 }}
      className="sb-rail flex flex-shrink-0 select-none flex-col items-center py-3"
      style={{ width: collapsed ? 56 : 152 }}
    >
      <style>{SB_CSS}</style>

      {/* Collapse toggle — a small segment face at the top */}
      <motion.button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="sb-seg-b sb-toggle"
      >
        <motion.span className="sb-seg-i-wrap" whileTap={reduce ? undefined : { scale: 0.78 }} transition={ICON_TAP}>
          {collapsed ? <PanelLeft className="sb-seg-i" size={17} /> : <PanelLeftClose className="sb-seg-i" size={17} />}
        </motion.span>
      </motion.button>

      {/* One vertical segment = navigation */}
      <nav
        ref={navRef}
        aria-label="Primary"
        onKeyDown={onNavKeyDown}
        className="sb-seg mt-2.5 flex flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-1 py-1 lg-scrollbar-none"
      >
        {PRIMARY_NAV.map((item, i) => (
          <SegItem key={item.id} item={item} active={activeTab === item.id} collapsed={collapsed}
            onSelect={onTabChange} reduce={reduce} index={i} />
        ))}
        <SegDivider />
        {TOOLS_NAV.map((item, i) => (
          <SegItem key={item.id} item={item} active={activeTab === item.id} collapsed={collapsed}
            onSelect={onTabChange} reduce={reduce} index={i + PRIMARY_NAV.length} />
        ))}

        {!collapsed && bookmarks.length > 0 && (
          <>
            <SegDivider />
            {bookmarks.slice(0, 5).map((b, i) => (
              <motion.button
                key={b.id}
                type="button"
                data-sb-item=""
                title={b.path || b.name}
                initial={reduce ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={reduce ? { duration: 0 } : { ...THUMB, delay: 0.01 * i }}
                onClick={() => {
                  if (b.type === 'folder' && b.path) { onNavigateToFolder(b.path); onTabChange('files'); }
                }}
                className="sb-seg-b sb-seg-wide sb-idle"
              >
                <motion.span className="sb-seg-i-wrap" whileTap={reduce ? undefined : { scale: 0.78 }} transition={ICON_TAP}>
                  {b.type === 'folder'
                    ? <Folder className="sb-seg-i" strokeWidth={1.7} />
                    : <FileStack className="sb-seg-i" strokeWidth={1.7} />}
                </motion.span>
                <span className="sb-seg-label">{b.name}</span>
              </motion.button>
            ))}
          </>
        )}
      </nav>

      {/* Footer segment: settings + account */}
      <div className="sb-seg mt-auto flex flex-col gap-0.5 px-1 py-1">
        <motion.button
          type="button"
          onClick={() => navigate('/settings/account')}
          title={collapsed ? 'Settings' : undefined}
          aria-label={collapsed ? 'Settings' : undefined}
          aria-current={activeTab === 'settings' ? 'page' : undefined}
          className={cn('sb-seg-b', collapsed ? 'sb-seg-icon' : 'sb-seg-wide', activeTab === 'settings' ? 'sb-on' : 'sb-idle')}
        >
          {activeTab === 'settings' && (
            <motion.span layoutId="sb-seg-thumb" className="sb-seg-thumb" transition={reduce ? { duration: 0 } : THUMB} />
          )}
          <motion.span className="sb-seg-i-wrap" whileTap={reduce ? undefined : { scale: 0.78 }} transition={ICON_TAP}>
            <Settings2 className="sb-seg-i" strokeWidth={1.7} />
          </motion.span>
          {!collapsed && <span className="sb-seg-label">Settings</span>}
        </motion.button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <motion.button
              type="button"
              aria-label={`Account menu, ${displayName}`}
              title={collapsed ? displayName : undefined}
              className={cn('sb-seg-b sb-account', collapsed ? 'sb-seg-icon' : 'sb-seg-wide', 'sb-idle')}
            >
              <motion.span className="sb-seg-i-wrap" whileTap={reduce ? undefined : { scale: 0.78 }} transition={ICON_TAP}>
              <span className="sb-avatar" aria-hidden="true">
                {(profile?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
              </span>
              </motion.span>
              {!collapsed && (
                <>
                  <span className="sb-seg-label sb-name">{displayName}</span>
                  <ChevronsUpDown className="sb-seg-kbd" size={13} />
                </>
              )}
            </motion.button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={collapsed ? 'center' : 'start'} side="right" sideOffset={12} className="w-56">
            <div className="px-2 py-1.5">
              <p className="truncate text-[13px] font-medium text-foreground">{profile?.full_name || 'User'}</p>
              <p className="truncate text-[12px] text-muted-foreground">{user?.email}</p>
              <p className="mt-1 inline-flex rounded border border-border px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{planLabel} plan</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer gap-2 text-[13px]" onClick={() => navigate('/pricing')}>
              <Star className="h-3.5 w-3.5" /><span>{profile?.is_premium ? 'Manage plan' : 'Upgrade plan'}</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer gap-2 text-[13px]" onClick={() => setOverlayOpen(true)}>
              <Keyboard className="h-3.5 w-3.5" /><span>Shortcuts</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer gap-2 text-[13px]" onClick={() => setSwitchOpen(true)}>
              <User className="h-3.5 w-3.5" /><span>Switch account</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer gap-2 text-[13px] text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={onSignOut}>
              <LogOut className="h-3.5 w-3.5" /><span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SwitchAccountSheet open={switchOpen} onOpenChange={setSwitchOpen} />
    </motion.aside>
  );
};

export default EnterpriseSidebar;

/* ── Styles: exactly the GlassSegment language, vertical.
      No background behind the column, no outline on the thumb. ── */
const SB_CSS = `
.sb-rail { background: transparent; }
.sb-seg { display: flex; flex-direction: column; }
/* the nav/footer columns are plain stacks — the pills themselves are the only surfaces */
.sb-seg-b { position: relative; display: flex; align-items: center; border: 0; border-radius: 999px;
  background: transparent; cursor: pointer; color: var(--sa-mute); outline: none; -webkit-tap-highlight-color: transparent;
  transition: color 0.18s; scale: none !important; }
.sb-seg-b:focus-visible { outline: 1px solid var(--sa-text); outline-offset: 2px; }
.sb-seg-icon { width: 42px; height: 38px; justify-content: center; }
.sb-seg-wide { width: 100%; height: 38px; gap: 8px; padding: 0 10px; }
.sb-seg-kbd { display: none; }
.sb-idle:hover, .sb-idle:focus-visible { color: var(--sa-text); }
.sb-on { color: var(--sa-text); }
/* the active thumb is the same dark raised surface as the view control — no border */
.sb-seg-thumb { position: absolute; inset: 0; border-radius: 999px;
  background: color-mix(in srgb, var(--sa-bg-4, #23251f) 92%, #e8e7e1);
  box-shadow: inset 0 1px 0 rgba(232,231,225,0.07), 0 4px 12px -2px rgba(0,0,0,0.5); }
.sb-seg-i-wrap { position: relative; z-index: 1; display: grid; place-items: center; }
.sb-seg-i, .sb-seg-b svg { position: relative; z-index: 1; width: 19px; height: 19px; flex: none; }
.sb-seg-label { position: relative; z-index: 1; flex: 1; min-width: 0; text-align: left;
  font-size: 13px; font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sb-seg-kbd { position: relative; z-index: 1; font: 400 10px/1 var(--sa-mono, ui-monospace, monospace); opacity: 0.55; }
/* collapse face: a plain icon, no capsule/outline behind it */
.sb-toggle { width: 38px; height: 38px; justify-content: center; border-radius: 999px;
  background: transparent; color: var(--sa-mute); }
.sb-toggle:hover { color: var(--sa-text); background: rgba(232,231,225,0.05); }
.sb-account { margin-top: 2px; }
.sb-avatar { position: relative; z-index: 1; display: grid; place-items: center; width: 25px; height: 25px;
  flex: none; border-radius: 999px; background: rgba(232,231,225,0.07);
  font-size: 11px; color: var(--sa-text); }
.sb-name { font-size: 12.5px; }
@media (prefers-reduced-motion: reduce) { .sb-seg-b, .sb-seg-thumb { transition-duration: 0.01ms !important; } }
`;

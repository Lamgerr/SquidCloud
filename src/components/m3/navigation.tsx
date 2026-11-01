import React, { useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ── Drawer ──────────────────────────────────────────────────────────
export interface DrawerProps {
  collapsed?: boolean;
  rail?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
}
export const NavigationDrawer: React.FC<DrawerProps> = ({ collapsed, rail, header, footer, className, children }) => (
  <aside
    className={cn(
      'm3-drawer',
      collapsed && 'm3-drawer--rail',
      className
    )}
    data-collapsed={collapsed ? 'true' : 'false'}
  >
    {header && <div className="m3-drawer__header">{header}</div>}
    <div className="m3-drawer__scroll">{children}</div>
    {footer && <div className="m3-drawer__footer">{footer}</div>}
  </aside>
);

export interface DrawerSectionProps {
  label?: string;
  collapsed?: boolean;
  children?: ReactNode;
  className?: string;
}
export const DrawerSection: React.FC<DrawerSectionProps> = ({ label, collapsed, children, className }) => (
  <div className={cn('space-y-0.5', className)}>
    {label && !collapsed && <div className="m3-drawer__section">{label}</div>}
    {label && collapsed && <div aria-hidden="true" className="mx-2 my-0.5 h-px bg-[hsl(var(--m3-outline-variant-hsl))]" />}
    {children}
  </div>
);

export interface NavItemProps {
  icon?: ReactNode;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
  badge?: number | string;
  shortcut?: string;
  className?: string;
}
export const NavItemM3: React.FC<NavItemProps> = ({ icon, label, active, collapsed, onClick, badge, shortcut, className }) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
    title={collapsed ? label : undefined}
    className={cn('m3-nav-item', className)}
  >
    {icon && <span className="m3-nav-item__icon" aria-hidden="true">{icon}</span>}
    <span className="m3-nav-item__label">{label}</span>
    {badge !== undefined && badge !== null && <span className="m3-nav-item__badge">{badge}</span>}
  </button>
);

// ── Navigation bar (mobile) ─────────────────────────────────────────
export interface NavBarItem {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: number | string;
}
export interface NavigationBarProps {
  items: NavBarItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}
export const NavigationBar: React.FC<NavigationBarProps> = ({ items, value, onChange, className }) => (
  <nav aria-label="Primary" className={cn('m3-nav-bar', className)}>
    {items.map((item) => {
      const selected = item.id === value;
      return (
        <button
          key={item.id}
          type="button"
          aria-selected={selected}
          className="m3-nav-tab"
          onClick={() => onChange(item.id)}
        >
          <span className="m3-nav-tab__indicator" aria-hidden="true">
            {item.icon}
          </span>
          <span className="m3-nav-tab__label">{item.label}</span>
        </button>
      );
    })}
  </nav>
);

// ── Top app bar ─────────────────────────────────────────────────────
export interface TopAppBarProps {
  title?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  chips?: ReactNode;
  transparent?: boolean;
  small?: boolean;
  className?: string;
}
export const TopAppBar: React.FC<TopAppBarProps> = ({ title, leading, actions, chips, transparent, small, className }) => (
  <header className={cn('m3-appbar', small && 'm3-appbar--small', transparent && 'm3-appbar--transparent', className)}>
    {leading}
    {title !== undefined && <div className="m3-appbar__title truncate">{title}</div>}
    {chips && <div className="flex items-center gap-2 ml-2 min-w-0">{chips}</div>}
    <div className="flex-1" />
    {actions && <div className="flex items-center gap-1">{actions}</div>}
  </header>
);

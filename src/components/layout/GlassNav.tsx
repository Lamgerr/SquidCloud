/**
 * GlassNav — one floating glass navigation bar for every in-scope page.
 * Motion vocabulary matches EnterpriseSidebar / Auth switcher:
 * layoutId thumb spring 380/21/0.8, tap spring 600/16, no uniform stagger.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type GlassNavItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  to?: string;
  onClick?: () => void;
  active?: boolean;
};

const THUMB = { type: 'spring' as const, stiffness: 380, damping: 21, mass: 0.8 };
const TAP = { type: 'spring' as const, stiffness: 600, damping: 16 };

export function GlassNav({
  items,
  layoutId = 'glass-nav-thumb',
  className,
  ariaLabel = 'Section navigation',
}: {
  items: GlassNavItem[];
  layoutId?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const reduce = !!useReducedMotion();
  return (
    <nav className={cn('gnav', className)} role="tablist" aria-label={ariaLabel}>
      <style>{CSS}</style>
      {items.map((item) => {
        const active = !!item.active;
        const inner = (
          <>
            {active && (
              <motion.span
                layoutId={layoutId}
                className="gnav-thumb"
                transition={reduce ? { duration: 0.01 } : THUMB}
              />
            )}
            <motion.span
              className="gnav-inner"
              whileTap={reduce ? undefined : { scale: 0.92 }}
              transition={reduce ? { duration: 0.01 } : TAP}
            >
              <span className="gnav-icon">{item.icon}</span>
              <span className="gnav-label">{item.label}</span>
            </motion.span>
          </>
        );
        const cls = cn('gnav-item', active && 'gnav-active');
        const props = {
          type: 'button' as const,
          role: 'tab' as const,
          'aria-selected': active,
          className: cls,
          onClick: item.onClick,
          children: inner,
        };
        if (item.to) {
          return <Link key={item.key} to={item.to} {...props} />;
        }
        return <button key={item.key} {...props} />;
      })}
    </nav>
  );
}

const CSS = `
.gnav{display:flex;align-items:center;gap:2px;padding:4px;border-radius:999px;
  background:linear-gradient(180deg,var(--sa-bg-4,#1b201d),var(--sa-bg-2,#0e1110));
  border:1px solid var(--sa-line,#1f2221);
  box-shadow:inset 0 1px 0 rgba(232,231,225,.06),0 12px 32px -18px rgba(0,0,0,.8);
  max-width:100%;overflow-x:auto;scrollbar-width:none}
.gnav::-webkit-scrollbar{display:none}
.gnav-item{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:8px;
  min-height:34px;padding:0 14px;border:0;border-radius:999px;background:transparent;
  color:var(--sa-mute,#8d8f89);font:400 13px/1 var(--sa-f,-apple-system,sans-serif);
  white-space:nowrap;cursor:pointer;transition:color .18s;text-decoration:none;-webkit-tap-highlight-color:transparent}
.gnav-item:hover,.gnav-active{color:var(--sa-text,#e8e7e1)}
.gnav-thumb{position:absolute;inset:0;border-radius:999px;
  background:linear-gradient(180deg,var(--sa-bg-4,#1b201d),var(--sa-bg-3,#141816));
  box-shadow:inset 0 1px 0 rgba(232,231,225,.08),0 0 0 1px rgba(232,231,225,.1),0 6px 18px -6px rgba(0,0,0,.55)}
.gnav-inner{position:relative;z-index:1;display:inline-flex;align-items:center;gap:8px}
.gnav-icon{display:grid;place-items:center;width:16px;height:16px}
.gnav-icon svg{width:16px;height:16px;stroke-width:1.7}
@media(max-width:720px){.gnav-label{display:none}.gnav-item{padding:0 12px}}
@media(prefers-reduced-motion:reduce){.gnav-thumb,.gnav-inner{animation:none!important;transition:none!important}}
`;

/**
 * PageFrame — symmetric, centred shell for every content page.
 * One lead heading, one floating glass nav, one calm content column.
 */
import React from 'react';
import { GlassNav, type GlassNavItem } from './GlassNav';
import { cn } from '@/lib/utils';

export function PageFrame({
  title,
  subtitle,
  items,
  layoutId,
  children,
  className,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  items?: GlassNavItem[];
  layoutId?: string;
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div className={cn('pf-root', className)}>
      <style>{CSS}</style>
      <div className={cn('pf-inner', wide && 'pf-wide')}>
        <header className="pf-head">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </header>
        {items && items.length > 0 && (
          <div className="pf-nav"><GlassNav items={items} layoutId={layoutId} /></div>
        )}
        <main className="pf-content">{children}</main>
      </div>
    </div>
  );
}

const CSS = `
.pf-root{min-height:100vh;background:transparent;color:var(--sa-text,#e8e7e1)}
.pf-inner{width:100%;max-width:880px;margin:0 auto;padding:40px 24px 72px}
.pf-wide{max-width:1180px}
.pf-head{text-align:center;margin-bottom:24px}
.pf-head h1{margin:0;font-size:clamp(28px,4vw,40px);font-weight:300;letter-spacing:-.04em;line-height:1.05}
.pf-head p{margin:10px auto 0;max-width:520px;font-size:13px;line-height:1.6;color:var(--sa-mute,#8d8f89)}
.pf-nav{display:flex;justify-content:center;margin-bottom:28px}
.pf-content{display:block}
@media(max-width:720px){.pf-inner{padding:28px 16px 56px}}
`;

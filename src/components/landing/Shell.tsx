import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function Shell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative mx-auto w-full max-w-[1120px] px-5 sm:px-8 ${className ?? ''}`}>{children}</div>
  );
}

/** Marks the point where a content block taps into the circuit rail. */
export function Station({ kicker }: { kicker: string }) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="absolute left-0 right-0 top-[3px] hidden h-px md:block"
        style={{ background: 'var(--sl-line)' }}
      />
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-0 hidden h-[7px] w-[7px] -translate-x-1/2 md:block"
        style={{ background: 'var(--sl-line)', border: '1px solid var(--sl-line-strong)' }}
      />
      <span
        aria-hidden="true"
        className="absolute left-[21px] top-0 h-[7px] w-[7px] md:hidden"
        style={{ background: 'var(--sl-line)', border: '1px solid var(--sl-line-strong)' }}
      />
      <p className="pl-9 font-mono text-[10px] uppercase tracking-[0.28em] md:pl-0" style={{ color: 'var(--sl-dim)' }}>
        {kicker}
      </p>
    </div>
  );
}

export function GlowLink({ to, children }: { to: string; children: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  return (
    <Link
      ref={ref}
      to={to}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      }}
      className="sl-glow group inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-px"
      style={{ background: 'var(--sl-paper)', color: 'var(--sl-void)' }}
    >
      <span>{children}</span>
      <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  );
}

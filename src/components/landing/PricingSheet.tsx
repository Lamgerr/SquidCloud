import { Link } from 'react-router-dom';
import { Reveal } from '@/components/motion';

/* Price sheet — an engineering table, not marketing tiles. */

const COLS = [
  { name: 'Free', price: '$0', note: 'everything on this page' },
  { name: 'Supporter', price: '$4/mo', note: 'priority through the queue' },
  { name: 'Supporter+', price: '$10/mo', note: 'first in line, always' },
];

const ROWS = [
  { label: 'storage', values: ['unlimited', 'unlimited', 'unlimited'] },
  { label: 'api tokens / day', values: ['1,000', '10,000', 'unlimited'] },
  { label: 'processing queue', values: ['standard', 'priority', 'top priority'] },
  { label: 'early access', values: ['—', 'before public', 'before supporters'] },
];

function StartCell({ col }: { col: number }) {
  const featured = col === 2;
  return (
    <Link
      to={col === 0 ? '/auth?tab=signup' : '/pricing'}
      className="inline-flex items-center justify-center rounded-full px-5 py-2 font-mono text-[10px] uppercase tracking-[0.18em] transition-opacity duration-200 hover:opacity-75"
      style={
        featured
          ? { background: 'var(--sl-paper)', color: 'var(--sl-void)' }
          : { border: '1px solid var(--sl-line-strong)', color: 'var(--sl-paper)' }
      }
    >
      {col === 0 ? 'Start free' : col === 1 ? 'Go supporter' : 'Go supporter+'}
    </Link>
  );
}

export default function PricingSheet() {
  return (
    <Reveal y={12} className="mt-12">
      {/* desktop sheet */}
      <div
        className="relative hidden md:block"
        style={{ border: '1px solid var(--sl-line)', background: 'var(--sl-carbon)' }}
      >
        <span aria-hidden="true" className="sl-tick sl-tick--tr" />
        <span aria-hidden="true" className="sl-tick sl-tick--br" />
        <div className="grid grid-cols-[minmax(0,1.25fr)_repeat(3,minmax(0,1fr))]">
          <div style={{ borderBottom: '1px solid var(--sl-line)' }} />
          {COLS.map((c, i) => (
            <div
              key={c.name}
              className="px-6 py-7"
              style={{
                borderBottom: '1px solid var(--sl-line)',
                borderLeft: '1px solid var(--sl-line)',
                background: i === 2 ? 'rgba(255,255,255,0.03)' : 'transparent',
              }}
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.28em]" style={{ color: i === 2 ? 'var(--sl-paper)' : 'var(--sl-dim)' }}>
                {c.name}
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight" style={{ color: i === 2 ? 'var(--sl-paper)' : 'var(--sl-fog)' }}>
                {c.price}
              </p>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--sl-dim)' }}>
                {c.note}
              </p>
            </div>
          ))}

          {ROWS.map((row) => (
            <div key={row.label} className="contents">
              <div className="px-6 py-4" style={{ borderTop: '1px solid var(--sl-line)' }}>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--sl-dim)' }}>
                  {row.label}
                </p>
              </div>
              {row.values.map((v, i) => (
                <div
                  key={i}
                  className="px-6 py-4"
                  style={{
                    borderTop: '1px solid var(--sl-line)',
                    borderLeft: '1px solid var(--sl-line)',
                    background: i === 2 ? 'rgba(255,255,255,0.03)' : 'transparent',
                  }}
                >
                  <p className="font-mono text-[12px]" style={{ color: i === 2 ? 'var(--sl-paper)' : 'var(--sl-fog)' }}>
                    {v}
                  </p>
                </div>
              ))}
            </div>
          ))}

          <div />
          {COLS.map((_, i) => (
            <div
              key={i}
              className="px-6 py-6"
              style={{
                borderLeft: '1px solid var(--sl-line)',
                background: i === 2 ? 'rgba(255,255,255,0.03)' : 'transparent',
              }}
            >
              <StartCell col={i} />
            </div>
          ))}
        </div>
      </div>

      {/* mobile stack */}
      <div className="flex flex-col gap-4 md:hidden">
        {COLS.map((c, ci) => (
          <div key={c.name} style={{ border: '1px solid var(--sl-line)', background: 'var(--sl-carbon)' }}>
            <div className="flex items-baseline justify-between px-5 pt-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em]" style={{ color: 'var(--sl-dim)' }}>
                {c.name}
              </p>
              <p className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--sl-paper)' }}>
                {c.price}
              </p>
            </div>
            <p className="mt-1 px-5 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--sl-dim)' }}>
              {c.note}
            </p>
            <div className="mt-4">
              {ROWS.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between px-5 py-3"
                  style={{ borderTop: '1px solid var(--sl-line)' }}
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: 'var(--sl-dim)' }}>
                    {row.label}
                  </span>
                  <span className="font-mono text-[12px]" style={{ color: 'var(--sl-fog)' }}>
                    {row.values[ci]}
                  </span>
                </div>
              ))}
            </div>
            <div className="px-5 py-5" style={{ borderTop: '1px solid var(--sl-line)' }}>
              <StartCell col={ci} />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--sl-dim)' }}>
        no card for free · cancel anytime · crypto billing via maxelpay
      </p>
    </Reveal>
  );
}

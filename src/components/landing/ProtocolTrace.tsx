import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

interface TraceStep {
  n: string;
  label: string;
  spec: string;
  body: string;
  /** how far across the lane the message travels, 0..1 */
  stop: number;
  glyph: 'key' | 'cipher';
}

/* The real BYOK upload path, as implemented in
   src/services/byok-encryption.ts + src/lib/encryption-v3.ts. */
const STEPS: TraceStep[] = [
  {
    n: '01',
    label: 'KEY DERIVE',
    spec: 'PBKDF2-SHA-256 · 600,000 rounds',
    body: 'Your password and a random salt are stretched into the master key — in your browser, on your hardware.',
    stop: 0.34,
    glyph: 'key',
  },
  {
    n: '02',
    label: 'HKDF HIERARCHY',
    spec: 'per-file keys → per-chunk keys',
    body: 'The master key never touches data directly. The v3 hierarchy derives an independent key for every file and every chunk.',
    stop: 0.55,
    glyph: 'key',
  },
  {
    n: '03',
    label: 'AES-256-GCM',
    spec: 'authenticated encryption · client-side',
    body: 'Each chunk is sealed with its own key and domain-separated AAD before any byte leaves the device.',
    stop: 0.74,
    glyph: 'key',
  },
  {
    n: '04',
    label: 'TRANSFER',
    spec: 'opaque blobs only',
    body: 'What crosses to SquidCloud is ciphertext. Filename, file type and contents are unreadable in transit and after.',
    stop: 1,
    glyph: 'cipher',
  },
  {
    n: '05',
    label: 'AT REST',
    spec: 'ciphertext · metadata stored separately',
    body: 'Blobs land in object storage; metadata lives elsewhere. No key ever crosses the rail — there is nothing to hand over.',
    stop: 1,
    glyph: 'cipher',
  },
];

function StepTrack({ step, reached, latest }: { step: TraceStep; reached: boolean; latest: boolean }) {
  return (
    <div className="relative h-12 w-full border-x md:h-16" style={{ borderColor: 'var(--sl-line)' }}>
      {/* rails */}
      {/* baseline guide */}
      <div className="absolute inset-x-4 top-1/2 border-t border-dashed opacity-40" style={{ borderColor: 'var(--sl-line)' }} />
      {/* travelling segment */}
      <div
        className="absolute inset-x-4 top-1/2 h-[2px] -translate-y-1/2 origin-left"
        style={{
          background: 'var(--sl-paper)',
          opacity: reached ? (latest ? 1 : 0.45) : 0,
          transform: `scaleX(${reached ? step.stop : 0})`,
          transition:
            'transform 650ms var(--sl-ease), opacity 650ms var(--sl-ease)',
        }}
      />
      {/* endpoint glyph */}
      <span
        aria-hidden="true"
        className="absolute top-1/2 font-mono text-xs"
        style={{
          left: `calc(1rem + ${step.stop} * (100% - 2rem))`,
          transform: 'translate(-50%, -50%)',
          color: step.glyph === 'key' ? 'var(--sl-paper)' : 'var(--sl-dim)',
          opacity: reached ? 1 : 0,
          transition: 'opacity 320ms var(--sl-ease) 380ms',
        }}
      >
        {step.glyph === 'key' ? '\u25CF' : '\u2593'}
        {reached && <span key={String(reached)} className="sl-ping" />}
      </span>
      {/* rail terminals */}
      <span aria-hidden="true" className="absolute left-0 top-1/2 h-3 w-px -translate-y-1/2" style={{ background: 'var(--sl-line-strong)' }} />
      <span aria-hidden="true" className="absolute right-0 top-1/2 h-3 w-px -translate-y-1/2" style={{ background: 'var(--sl-line-strong)' }} />
    </div>
  );
}

export default function ProtocolTrace() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(reduced ? STEPS.length - 1 : -1);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (reduced) {
      setActive(STEPS.length - 1);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const i = Number((e.target as HTMLElement).dataset.index);
            setActive((prev) => Math.max(prev, i));
          }
        });
      },
      { rootMargin: '-42% 0px -42% 0px', threshold: 0 }
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [reduced]);

  return (
    <div className="relative" role="group" aria-label="Zero-knowledge upload trace">
      <span className="sl-tick sl-tick--tl" />
      <span className="sl-tick sl-tick--tr" />
      <span className="sl-tick sl-tick--bl" />
      <span className="sl-tick sl-tick--br" />

      {/* lane headers */}
      <div
        className="grid grid-cols-1 items-center gap-2 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.25em] sm:px-6 md:grid-cols-[15rem_minmax(0,3fr)_minmax(0,2fr)]"
        style={{ borderBottom: '1px solid var(--sl-line)', color: 'var(--sl-dim)' }}
      >
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-1.5 w-1.5" style={{ background: 'var(--sl-paper)' }} />
          Your device
        </span>
        <span className="hidden text-center md:block">the only thing that crosses is ciphertext</span>
        <span className="hidden items-center justify-end gap-2 md:flex">
          SquidCloud
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5 transition-colors duration-700"
            style={{
              border: '1px solid var(--sl-dim)',
              background: reduced || active >= 3 ? 'var(--sl-fog)' : 'transparent',
            }}
          />
        </span>
      </div>

      {/* steps */}
      <ol className="list-none">
        {STEPS.map((step, i) => {
          const reached = reduced || i <= active;
          const latest = !reduced && i === active;
          return (
            <li key={step.n}>
              <button
                type="button"
                data-index={i}
                ref={(el) => { refs.current[i] = el; }}
                onFocus={() => setActive((prev) => Math.max(prev, i))}
                onClick={() => setActive((prev) => Math.max(prev, i))}
                aria-current={reached ? 'step' : undefined}
                className="block w-full cursor-default text-left outline-none focus-visible:outline-none"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--sl-line)' }}
              >
                <div className="grid grid-cols-1 gap-3 px-4 py-6 sm:px-6 md:grid-cols-[15rem_minmax(0,3fr)_minmax(0,2fr)] md:items-center md:gap-6 md:py-7">
                  {/* meta */}
                  <div>
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-[10px]" style={{ color: 'var(--sl-dim)' }}>{step.n}</span>
                      <span
                        className="font-mono text-xs tracking-[0.18em]"
                        style={{ color: reached ? 'var(--sl-paper)' : 'var(--sl-dim)', transition: 'color 400ms var(--sl-ease)' }}
                      >
                        {step.label}
                      </span>
                    </div>
                    <p className="mt-1.5 pl-8 font-mono text-[10px]" style={{ color: 'var(--sl-dim)' }}>
                      {step.spec}
                    </p>
                  </div>

                  {/* track */}
                  <StepTrack step={step} reached={reached} latest={latest} />

                  {/* explanation */}
                  <p
                    className="max-w-sm text-sm leading-relaxed pl-8 md:pl-0"
                    style={{ color: reached ? 'var(--sl-fog)' : 'var(--sl-dim)', transition: 'color 400ms var(--sl-ease)' }}
                  >
                    {step.body}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      {/* legend */}
      <div
        className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em] sm:px-6"
        style={{ borderTop: '1px solid var(--sl-line)', color: 'var(--sl-dim)' }}
      >
        <span><span style={{ color: 'var(--sl-paper)' }}>●</span> key material lives here</span>
        <span>▓ ciphertext</span>
        <span className="ml-auto flex items-center gap-2">
          <span className="sl-live-dot" aria-hidden="true" />
          server-side keys: none
        </span>
      </div>
    </div>
  );
}

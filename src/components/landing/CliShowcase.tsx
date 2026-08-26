import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

interface Line {
  kind: 'cmd' | 'out';
  text: string;
}

/* Real squidcloudctl session — numbered files, transfers, local API server. */
const SCRIPT: Line[] = [
  { kind: 'cmd', text: 'squidcloudctl whoami' },
  { kind: 'out', text: 'dev@local · session valid · key stored locally' },
  { kind: 'cmd', text: 'squidcloudctl files up ./q3-report.pdf' },
  { kind: 'out', text: 'upload  ████░░░░ 2.4 MB · 12 MB/s' },
  { kind: 'out', text: '▓▓▓▓▓▓▓▓ 8/8 chunks · opaque' },
  { kind: 'out', text: '✓ id_9f3ac2e1 · res54 / aes-256-gcm · client-sealed' },
  { kind: 'cmd', text: 'squidcloudctl share create 3 --burn --max-downloads 1 --expires 24h' },
  { kind: 'out', text: '✓ burn-after-read link ready' },
  { kind: 'cmd', text: 'squidcloudctl host api --profile hardened' },
  { kind: 'out', text: 'api ▸ http://localhost:8065 · profile hardened · redis :8066 · keys on' },
];

const TYPE_MS = 22;
const OUT_MS = 130;
const PAUSE_MS = 620;

export default function CliShowcase() {
  const reduced = useReducedMotion();
  const [emitted, setEmitted] = useState<Line[]>(() => (reduced ? SCRIPT : []));
  const [typing, setTyping] = useState('');
  const hostRef = useRef<HTMLDivElement | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (reduced) {
      setEmitted(SCRIPT);
      setTyping('');
      return;
    }
    const host = hostRef.current;
    if (!host || startedRef.current) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        startedRef.current = true;

        let li = 0; // line index
        let ci = 0; // char index within current command
        let timer: ReturnType<typeof setTimeout>;

        const stepLine = () => {
          if (li >= SCRIPT.length) {
            setTyping('');
            return;
          }
          const line = SCRIPT[li];
          if (line.kind === 'cmd') {
            ci += 1;
            setTyping(line.text.slice(0, ci));
            if (ci < line.text.length) {
              timer = setTimeout(stepLine, TYPE_MS);
            } else {
              const done = line;
              timer = setTimeout(() => {
                setEmitted((prev) => [...prev, done]);
                setTyping('');
                ci = 0;
                li += 1;
                timer = setTimeout(stepLine, PAUSE_MS);
              }, 240);
            }
          } else {
            const out = line;
            timer = setTimeout(() => {
              setEmitted((prev) => [...prev, out]);
              li += 1;
              timer = setTimeout(stepLine, OUT_MS);
            }, OUT_MS);
          }
        };
        timer = setTimeout(stepLine, 400);
      },
      { threshold: 0.35 }
    );
    io.observe(host);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <div ref={hostRef} className="relative">
      <span className="sl-tick sl-tick--tl" />
      <span className="sl-tick sl-tick--tr" />
      <span className="sl-tick sl-tick--bl" />
      <span className="sl-tick sl-tick--br" />

      <div className="overflow-x-auto p-5 sm:p-7" style={{ background: 'var(--sl-carbon)' }}>
        <pre className="font-mono text-[12px] leading-[1.9] sm:text-[13px]" aria-label="Example squidcloudctl CLI session">
          {emitted.map((line, i) =>
            line.kind === 'cmd' ? (
              <span key={i} className="block whitespace-pre">
                <span style={{ color: 'var(--sl-dim)' }}>$ </span>
                <span style={{ color: 'var(--sl-paper)' }}>{line.text}</span>
              </span>
            ) : (
              <span key={i} className="block whitespace-pre" style={{ color: 'var(--sl-dim)' }}>
                {line.text}
              </span>
            )
          )}
          {typing !== '' && (
            <span className="block whitespace-pre">
              <span style={{ color: 'var(--sl-dim)' }}>$ </span>
              <span style={{ color: 'var(--sl-paper)' }}>{typing}</span>
            </span>
          )}
          <span className="sl-caret" aria-hidden="true" />
        </pre>
      </div>
      <div
        className="flex items-center justify-between px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em]"
        style={{ borderTop: '1px solid var(--sl-line)', color: 'var(--sl-dim)' }}
      >
        <span>squidcloudctl · session</span>
        <a href="/cli" className="transition-opacity hover:opacity-70" style={{ color: 'var(--sl-fog)' }}>
          full CLI reference →
        </a>
      </div>
    </div>
  );
}

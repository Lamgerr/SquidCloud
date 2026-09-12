import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Check, Copy, ArrowRight, ArrowUpRight, ShieldCheck, Lock,
  Terminal, HardDrive, Share2,
} from '@/lib/icon-map';
import { useAuth } from '@/contexts/AuthContext';
import SquidLogo from '@/components/ui/SquidLogo';
import Footer from '@/components/custom/Footer';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

/* ════════════════════════════════════════════════════════════════
   SQUIDCLOUD — production landing, dark
   Near-black canvas, hairline rules, one lime accent, grotesque
   display type. Every claim on this page is verifiable in-repo.
   ════════════════════════════════════════════════════════════════ */

const C = {
  canvas: '#060607',
  panel: '#0b0c0f',
  card: '#0e0f13',
  hair: 'rgba(255,255,255,0.08)',
  paper: '#f2f2ed',
  dim: '#a3a39a',
  faint: '#63635c',
  accent: '#c8f04b',
  accentInk: '#101300',
};

const DISPLAY = { fontFamily: "'Space Grotesk', system-ui, sans-serif" };
const SERIF_IT = { fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: 'italic' as const };
const MONO = { fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" };

function usePressFonts() {
  useEffect(() => {
    const ID = 'sq-landing-fonts';
    if (document.getElementById(ID)) return;
    const l = document.createElement('link');
    l.id = ID;
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap';
    document.head.appendChild(l);
  }, []);
}

/* Scroll reveal — single motion primitive for the whole page. */
function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ index, label }: { index: string; label: string }) {
  return (
    <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.24em]" style={{ ...MONO, color: C.faint }}>
      <span style={{ color: C.accent }}>{index}</span>
      <span className="inline-block h-px w-8" style={{ background: C.hair }} />
      <span>{label}</span>
    </p>
  );
}

/* ── real product telemetry — mirrors the crypto actually shipped ── */
const TELEMETRY = [
  ['AES-256-GCM', 'file & block cipher'],
  ['HKDF-SHA-256', 'per-file key tree'],
  ['PBKDF2 ×600K', 'on-device stretching'],
  ['ED25519', 'signed documents'],
  ['WEBAUTHN', 'passkey login'],
];

/* ── real squidcloudctl session (see CliShowcase for the live variant) ── */
type TLine = { kind: 'cmd' | 'out' | 'ok'; text: string };
const SESSION: TLine[] = [
  { kind: 'cmd', text: 'squidcloudctl whoami' },
  { kind: 'out', text: 'dev@local · session valid · key stored locally' },
  { kind: 'cmd', text: 'squidcloudctl files up ./q3-report.pdf' },
  { kind: 'out', text: '▓▓▓▓▓▓▓▓ 8/8 blocks · sealed · scattered' },
  { kind: 'ok', text: '✓ id_9f3ac2e1 · res54 / aes-256-gcm · client-sealed' },
  { kind: 'cmd', text: 'squidcloudctl share create 3 --burn --expires 24h' },
  { kind: 'ok', text: '✓ burn-after-read link ready' },
];

function TerminalCard() {
  const reduced = useReducedMotion();
  const [lines, setLines] = useState<TLine[]>(() => (reduced ? SESSION : []));
  const [typing, setTyping] = useState('');
  const hostRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (reduced) return;
    const host = hostRef.current;
    if (!host || started.current) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      started.current = true;
      let li = 0;
      let ci = 0;
      let timer: ReturnType<typeof setTimeout>;
      const step = () => {
        if (li >= SESSION.length) { setTyping(''); return; }
        const line = SESSION[li];
        if (line.kind === 'cmd') {
          ci += 1;
          setTyping(line.text.slice(0, ci));
          if (ci < line.text.length) timer = setTimeout(step, 26);
          else timer = setTimeout(() => {
            setLines((p) => [...p, line]);
            setTyping('');
            ci = 0; li += 1;
            timer = setTimeout(step, 500);
          }, 260);
        } else {
          timer = setTimeout(() => {
            setLines((p) => [...p, line]);
            li += 1;
            timer = setTimeout(step, 170);
          }, 170);
        }
      };
      timer = setTimeout(step, 350);
      return () => clearTimeout(timer);
    }, { threshold: 0.3 });
    io.observe(host);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <div ref={hostRef} className="overflow-hidden rounded-xl border" style={{ background: C.panel, borderColor: C.hair }}>
      <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: C.hair }}>
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#3a3a34' }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#3a3a34' }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: C.accent }} />
        <span className="ml-3 font-mono text-[11px]" style={{ ...MONO, color: C.faint }}>~/squidcloud — squidcloudctl</span>
      </div>
      <pre className="min-h-[248px] overflow-x-auto p-5 font-mono text-[12.5px] leading-[2] sm:text-[13px]" style={MONO} aria-label="Example squidcloudctl session">
        {lines.map((l, i) => l.kind === 'cmd' ? (
          <span key={i} className="block whitespace-pre"><span style={{ color: C.faint }}>$ </span><span style={{ color: C.paper }}>{l.text}</span></span>
        ) : (
          <span key={i} className="block whitespace-pre" style={{ color: l.kind === 'ok' ? C.accent : C.dim }}>{l.text}</span>
        ))}
        {typing !== '' && (
          <span className="block whitespace-pre"><span style={{ color: C.faint }}>$ </span><span style={{ color: C.paper }}>{typing}</span><span className="sq-caret">▌</span></span>
        )}
        {typing === '' && <span className="sq-caret" style={{ color: C.dim }}>▌</span>}
      </pre>
    </div>
  );
}

/* Illustrative block map — schematic, labelled as such. */
function BlockMap() {
  const cells = [1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1];
  return (
    <div className="rounded-xl border p-5" style={{ background: C.panel, borderColor: C.hair }}>
      <div className="flex items-center justify-between font-mono text-[11px]" style={{ ...MONO, color: C.faint }}>
        <span>q3-report.pdf → 8 blocks</span>
        <span style={{ color: C.accent }}>● sealed</span>
      </div>
      <div className="mt-4 grid grid-cols-8 gap-1.5" aria-hidden>
        {cells.map((on, i) => (
          <div key={i} className="aspect-square rounded-[3px]" style={{ background: on ? 'rgba(200,240,75,0.85)' : 'rgba(255,255,255,0.09)' }} />
        ))}
      </div>
      <div className="mt-4 space-y-1.5 font-mono text-[11px]" style={{ ...MONO, color: C.dim }}>
        <p>blk_00…07 · aes-256-gcm · random names</p>
        <p>no node holds more than 2 of 8</p>
      </div>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em]" style={{ ...MONO, color: C.faint }}>schematic — layout varies per file</p>
    </div>
  );
}

function KeyFacts() {
  const rows: [string, string][] = [
    ['cipher', 'AES-256-GCM, sealed on-device'],
    ['stretching', 'PBKDF2 × 600,000 rounds'],
    ['key tree', 'HKDF-SHA-256 per file'],
    ['gates', 'TOTP on mounts & key ops'],
    ['transfers', 'signed, short-lived URLs'],
  ];
  return (
    <div className="rounded-xl border" style={{ background: C.panel, borderColor: C.hair }}>
      {rows.map(([k, v], i) => (
        <div key={k} className="flex items-baseline justify-between gap-4 px-5 py-3.5" style={i > 0 ? { borderTop: `1px solid ${C.hair}` } : undefined}>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ ...MONO, color: C.faint }}>{k}</span>
          <span className="text-right font-mono text-[12px]" style={{ ...MONO, color: C.paper }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function RestCard() {
  return (
    <div className="overflow-hidden rounded-xl border" style={{ background: C.panel, borderColor: C.hair }}>
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: C.hair }}>
        <span className="font-mono text-[11px]" style={{ ...MONO, color: C.faint }}>upload.ts — REST</span>
        <span className="font-mono text-[11px]" style={{ ...MONO, color: C.accent }}>scoped key</span>
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-[1.9]" style={MONO}>
        <code>
          <span style={{ color: '#7ee0a3' }}>fetch</span><span style={{ color: C.paper }}>(</span><span style={{ color: '#9ecbff' }}>'/api/files'</span><span style={{ color: C.paper }}>, {'{'}</span>{'\n'}
          {'  '}method<span style={{ color: C.dim }}>: </span><span style={{ color: '#9ecbff' }}>'PUT'</span><span style={{ color: C.paper }}>,</span>{'\n'}
          {'  '}headers<span style={{ color: C.dim }}>: {'{'} </span><span style={{ color: '#9ecbff' }}>'X-Sealed'</span><span style={{ color: C.dim }}>: </span><span style={{ color: '#9ecbff' }}>'aes-256-gcm'</span><span style={{ color: C.dim }}> {'}'}</span><span style={{ color: C.paper }}>,</span>{'\n'}
          {'  '}body<span style={{ color: C.dim }}>: </span><span style={{ color: C.paper }}>ciphertextBlocks</span>{'\n'}
          <span style={{ color: C.paper }}>{'}'});</span>
        </code>
      </pre>
    </div>
  );
}

function CheckRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[14.5px] leading-relaxed" style={{ color: C.dim }}>
<Check className="mt-1 h-4 w-4 shrink-0" color={C.accent} />
      <span>{children}</span>
    </li>
  );
}

export default function Index() {
  const { user } = useAuth();
  const { copy, state } = useCopyToClipboard();
  usePressFonts();
  const dashHref = user ? '/dashboard' : '/auth';
  const copied = state === 'done';
  const INSTALL = 'npm i -g squidcloudctl';

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => { document.documentElement.style.scrollBehavior = ''; };
  }, []);

  return (
    <div className="min-h-screen font-sans antialiased" style={{ background: C.canvas, color: C.paper }}>
      <style>{`
        .sq-caret { animation: sq-blink 1.1s steps(1) infinite; }
        @keyframes sq-blink { 50% { opacity: 0; } }
        .sq-pulse { animation: sq-pulse 2.2s ease-in-out infinite; }
        @keyframes sq-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
      `}</style>

      {/* ══ NAV ══ */}
      <header className="fixed inset-x-0 top-0 z-50 border-b backdrop-blur-md" style={{ borderColor: C.hair, background: 'rgba(6,6,7,0.84)' }}>
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <SquidLogo size={22} mono />
            <span className="text-[12px] font-semibold uppercase tracking-[0.28em]" style={DISPLAY}>SquidCloud</span>
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            {[['Storage', '#storage'], ['Security', '#security'], ['Developers', '#developers'], ['CLI', '#cli'], ['Pricing', '#pricing']].map(([l, h]) => (
              <a key={l} href={h} className="font-mono text-[11px] uppercase tracking-[0.2em] transition-colors hover:text-white" style={{ ...MONO, color: C.dim }}>
                {l}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {!user && (
              <Link to="/auth" className="hidden px-3 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors hover:text-white sm:inline-flex" style={{ ...MONO, color: C.dim }}>
                Sign in
              </Link>
            )}
            <Link
              to={dashHref}
              className="inline-flex h-9 items-center rounded-full px-4 text-[13px] font-semibold transition-opacity hover:opacity-85"
              style={{ background: C.accent, color: C.accentInk }}
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ══ HERO ══ */}
      <section className="relative overflow-hidden px-5 pb-16 pt-32 sm:pt-36">
        <div className="mx-auto max-w-[1440px]">
          <Reveal>
            <p className="inline-flex items-center gap-2.5 rounded-full border px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em]" style={{ ...MONO, borderColor: C.hair, color: C.dim }}>
              <span className="sq-pulse inline-block h-1.5 w-1.5 rounded-full" style={{ background: C.accent }} />
              Zero-knowledge storage — no server keys
            </p>
          </Reveal>

          <Reveal delay={0.08}>
            <h1 className="mt-8 max-w-4xl font-bold leading-[0.98] tracking-[-0.03em]" style={{ ...DISPLAY, fontSize: 'clamp(2.9rem, 7.5vw, 6.4rem)' }}>
              Storage that{' '}
              <span style={{ ...SERIF_IT, fontWeight: 400 }}>can&rsquo;t</span>{' '}
              read&nbsp;you.
            </h1>
          </Reveal>

          <Reveal delay={0.16}>
            <p className="mt-7 max-w-xl text-[16.5px] leading-relaxed" style={{ color: C.dim }}>
              Files are sealed on your device with AES-256-GCM, split into blocks,
              and scattered across repositories that never see plaintext.
              Unlimited space. No scanning. No compromises.
            </p>
          </Reveal>

          <Reveal delay={0.24}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                to={dashHref}
                className="group inline-flex h-12 items-center gap-2 rounded-full px-7 text-[14px] font-semibold transition-opacity hover:opacity-85"
                style={{ background: C.accent, color: C.accentInk }}
              >
                Start free — unlimited storage
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#cli"
                className="inline-flex h-12 items-center gap-2.5 rounded-full border px-6 font-mono text-[13px] transition-colors hover:border-white/30"
                style={{ ...MONO, borderColor: C.hair, color: C.paper }}
              >
                <Terminal className="h-4 w-4" color={C.accent} />
                {INSTALL}
              </a>
            </div>
          </Reveal>

          {/* telemetry strip */}
          <Reveal delay={0.3}>
            <div className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-xl border sm:grid-cols-3 lg:grid-cols-6" style={{ borderColor: C.hair, background: C.hair }}>
              {TELEMETRY.map(([k, v]) => (
                <div key={k} className="px-5 py-4" style={{ background: C.canvas }}>
                  <p className="font-mono text-[12px] tracking-[0.08em]" style={{ ...MONO, color: C.paper }}>{k}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ ...MONO, color: C.faint }}>{v}</p>
                </div>
              ))}
              <div className="flex flex-col justify-center px-5 py-4" style={{ background: C.canvas }}>
                <p className="flex items-center gap-2 font-mono text-[12px] tracking-[0.08em]" style={{ ...MONO, color: C.paper }}>
                  <span className="sq-pulse inline-block h-1.5 w-1.5 rounded-full" style={{ background: C.accent }} />
                  SERVER KEYS: NONE
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ ...MONO, color: C.faint }}>verifiable in the open</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ TERMINAL ══ */}
      <section className="px-5 py-14">
        <div className="mx-auto grid max-w-[1440px] items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <Reveal>
            <Eyebrow index="01" label="The workflow" />
            <h2 className="mt-5 font-semibold leading-[1.04] tracking-[-0.02em]" style={{ ...DISPLAY, fontSize: 'clamp(1.7rem, 3.2vw, 2.5rem)' }}>
              One command.<br />Entire cloud.
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed" style={{ color: C.dim }}>
              Uploads seal and scatter from your terminal. Shares burn after
              reading. The API runs locally when you want it to.
              Nothing here phones home with your files.
            </p>
            <Link to="/cli" className="mt-6 inline-flex items-center gap-1.5 text-[13.5px] font-medium transition-opacity hover:opacity-75" style={{ color: C.paper }}>
              Full CLI reference <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Reveal>
          <Reveal delay={0.1}>
            <TerminalCard />
          </Reveal>
        </div>
      </section>

      {/* ══ 02 STORAGE ══ */}
      <section id="storage" className="scroll-mt-20 border-t px-5 py-24" style={{ borderColor: C.hair }}>
        <div className="mx-auto grid max-w-[1440px] items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <Eyebrow index="02" label="Storage" />
            <h2 className="mt-5 font-semibold leading-[1.04] tracking-[-0.02em]" style={{ ...DISPLAY, fontSize: 'clamp(1.7rem, 3.2vw, 2.5rem)' }}>
              Split. Sealed.<br />Scattered.
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed" style={{ color: C.dim }}>
              Every upload is cut into encrypted blocks, renamed into opaque
              blobs, and spread across the pool. No single repository holds a
              complete file — or anything readable.
            </p>
            <ul className="mt-7 space-y-3.5">
              <CheckRow><span><strong className="font-semibold" style={{ color: C.paper }}>Unlimited space</strong> on every plan, free included.</span></CheckRow>
              <CheckRow><span>Parallel, resumable transfers — small docs to multi-gigabyte archives.</span></CheckRow>
              <CheckRow><span>Private HLS screening room with resume positions that follow you.</span></CheckRow>
            </ul>
          </Reveal>
          <Reveal delay={0.1}>
            <BlockMap />
          </Reveal>
        </div>
      </section>

      {/* ══ 03 SECURITY ══ */}
      <section id="security" className="scroll-mt-20 border-t px-5 py-24" style={{ borderColor: C.hair, background: C.panel }}>
        <div className="mx-auto grid max-w-[1440px] items-center gap-10 lg:grid-cols-2">
          <Reveal className="order-2 lg:order-1">
            <KeyFacts />
          </Reveal>
          <Reveal className="order-1 lg:order-2">
            <Eyebrow index="03" label="Security" />
            <h2 className="mt-5 font-semibold leading-[1.04] tracking-[-0.02em]" style={{ ...DISPLAY, fontSize: 'clamp(1.7rem, 3.2vw, 2.5rem)' }}>
              Encrypted before<br />it leaves.
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed" style={{ color: C.dim }}>
              Keys are stretched on your device, split down an HKDF hierarchy,
              and every block is sealed with AES-256-GCM before upload.
              SquidCloud stores ciphertext. That is all it can store.
            </p>
            <ul className="mt-7 space-y-3.5">
              <CheckRow><span><strong className="font-semibold" style={{ color: C.paper }}>Zero-knowledge</strong> — we cannot open your files, by construction.</span></CheckRow>
              <CheckRow><span><strong className="font-semibold" style={{ color: C.paper }}>No scanning, no ads</strong> — your data is never read or sold.</span></CheckRow>
              <CheckRow><span>Links with expiry, download caps, and burn-after-read.</span></CheckRow>
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ══ 04 DEVELOPERS ══ */}
      <section id="developers" className="scroll-mt-20 border-t px-5 py-24" style={{ borderColor: C.hair }}>
        <div className="mx-auto grid max-w-[1440px] items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <Eyebrow index="04" label="Developers" />
            <h2 className="mt-5 font-semibold leading-[1.04] tracking-[-0.02em]" style={{ ...DISPLAY, fontSize: 'clamp(1.7rem, 3.2vw, 2.5rem)' }}>
              Script your storage.
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed" style={{ color: C.dim }}>
              Everything in the dashboard is an endpoint. Drive-mount the cloud,
              pipe uploads through scripts, mint scoped keys per integration.
            </p>
            <ul className="mt-7 space-y-3.5">
              <CheckRow><span><strong className="font-semibold" style={{ color: C.paper }}>REST API</strong> with scoped keys and credit ledgers.</span></CheckRow>
              <CheckRow><span><strong className="font-semibold" style={{ color: C.paper }}>SquidLab SDK</strong> for custom extensions.</span></CheckRow>
              <CheckRow><span><strong className="font-semibold" style={{ color: C.paper }}>Native drive mount</strong> via the CLI.</span></CheckRow>
            </ul>
          </Reveal>
          <Reveal delay={0.1}>
            <RestCard />
          </Reveal>
        </div>

        {/* capability strip */}
        <div className="mx-auto mt-16 grid max-w-[1440px] gap-px overflow-hidden rounded-xl border sm:grid-cols-3" style={{ borderColor: C.hair, background: C.hair }}>
          {[
            { icon: HardDrive, t: 'SquidFS drive', d: 'Your cloud as a local volume. Files decrypt on read, seal on write.' },
            { icon: Share2, t: 'Request links', d: 'Collect files from anyone — uploads land encrypted, straight into your vault.' },
            { icon: Lock, t: 'SquidVeil secrets', d: 'Tokens and credentials under your master key. Opens for you alone.' },
          ].map((f) => (
            <div key={f.t} className="p-6" style={{ background: C.canvas }}>
              <f.icon className="h-5 w-5" color={C.accent} />
              <p className="mt-4 text-[15px] font-semibold" style={{ ...DISPLAY, color: C.paper }}>{f.t}</p>
              <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: C.dim }}>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ CLI BAND ══ */}
      <section id="cli" className="scroll-mt-20 border-t px-5 py-24" style={{ borderColor: C.hair, background: C.panel }}>
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.24em]" style={{ ...MONO, color: C.faint }}>
              <Terminal className="h-4 w-4" color={C.accent} /> CLI
            </p>
            <h2 className="mt-5 font-semibold tracking-[-0.02em]" style={{ ...DISPLAY, fontSize: 'clamp(1.9rem, 4vw, 3rem)' }}>
              Installs in seconds.
            </h2>
            <div className="mx-auto mt-9 flex max-w-md items-center gap-2">
              <code className="flex flex-1 items-center overflow-hidden rounded-lg border px-4 py-3.5 font-mono text-[13.5px]" style={{ ...MONO, borderColor: C.hair, background: C.canvas, color: C.paper }}>
                <span className="select-none" style={{ color: C.faint }}>$&nbsp;</span>{INSTALL}
              </code>
              <button
                onClick={() => copy(INSTALL)}
                aria-label="Copy install command"
                className="inline-flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-lg border transition-colors hover:border-white/30"
                style={{ borderColor: C.hair, color: copied ? C.accent : C.dim }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-5 font-mono text-[12px]" style={{ ...MONO, color: C.faint }}>
              {copied ? 'copied — paste it in your terminal' : 'mounts as a drive · TOTP-gated · checksummed downloads'}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ══ PRICING ══ */}
      <section id="pricing" className="scroll-mt-20 border-t px-5 py-28" style={{ borderColor: C.hair }}>
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="font-semibold leading-none tracking-[-0.03em]" style={{ ...DISPLAY, fontSize: 'clamp(3.4rem, 9vw, 6.5rem)' }}>
              Free<span style={{ color: C.accent }}>.</span>
            </p>
            <p className="mx-auto mt-6 max-w-md text-[15.5px] leading-relaxed" style={{ color: C.dim }}>
              Unlimited storage on every plan — including this one.
              Supporter tiers exist purely to fund the infrastructure.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                to={dashHref}
                className="inline-flex h-12 items-center gap-2 rounded-full px-7 text-[14px] font-semibold transition-opacity hover:opacity-85"
                style={{ background: C.accent, color: C.accentInk }}
              >
                Claim free storage <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex h-12 items-center rounded-full border px-7 text-[14px] transition-colors hover:border-white/30"
                style={{ borderColor: C.hair, color: C.paper }}
              >
                Compare plans
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ FINAL CTA ══ */}
      <section className="border-t px-5 py-28" style={{ borderColor: C.hair }}>
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <ShieldCheck className="mx-auto h-7 w-7" color={C.accent} />
            <h2 className="mt-6 font-semibold leading-[1.05] tracking-[-0.02em]" style={{ ...DISPLAY, fontSize: 'clamp(1.9rem, 4.4vw, 3.1rem)' }}>
              Your files. Your keys. <span style={{ ...SERIF_IT, fontWeight: 400 }}>Finally.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed" style={{ color: C.dim }}>
              Create an account, set a master password, and upload your first
              sealed file in under a minute.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                to={dashHref}
                className="inline-flex h-12 items-center gap-2 rounded-full px-7 text-[14px] font-semibold transition-opacity hover:opacity-85"
                style={{ background: C.accent, color: C.accentInk }}
              >
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#storage"
                className="inline-flex h-12 items-center rounded-full border px-7 text-[14px] transition-colors hover:border-white/30"
                style={{ borderColor: C.hair, color: C.paper }}
              >
                How it works
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ FOOTER (shared) ══ */}
      <Footer />
    </div>
  );
}

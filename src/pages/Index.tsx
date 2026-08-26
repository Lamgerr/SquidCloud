import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  motion, useScroll, useTransform, useMotionValue, useSpring, useInView, animate,
} from 'framer-motion';
import {
  Check, Copy, ArrowRight, ArrowUpRight, ShieldCheck, Play,
  Users, KeyRound, Zap, Lock,
} from '@/lib/icon-map';
import { useAuth } from '@/contexts/AuthContext';
import AsciiWordmark from '@/components/landing/AsciiWordmark';
import SquidLogo from '@/components/ui/SquidLogo';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════
   NIGHT THUNDER — GitHub-dark monochrome editorial landing
   Palette: #0d1117 · #161b22 · #30363d · #e6edf3 · #7d8590
════════════════════════════════════════════════════════════════ */

const GITHUB = {
  canvas: '#0d1117',
  panel: '#161b22',
  border: '#30363d',
  text: '#e6edf3',
  muted: '#7d8590',
  hair: 'rgba(240,246,252,0.08)',
};

function usePressFonts() {
  useEffect(() => {
    const ID = 'sq-night-fonts';
    if (document.getElementById(ID)) return;
    const l = document.createElement('link');
    l.id = ID;
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..600&display=swap';
    document.head.appendChild(l);
  }, []);
}
const SERIF = { fontFamily: "'Instrument Serif', Georgia, serif" };
const NEWS = { fontFamily: "'Newsreader', Georgia, serif" };

/* ── content ── */

const LEDGER = [
  { n: '01', t: 'Storage', d: 'Unlimited space on every plan — free included. Chunks are sealed on-device with AES-256-GCM, then scattered across the bucket pool under random names.' },
  { n: '02', t: 'Streaming', d: 'Uploads graduate into a private screening room: adaptive HLS, resume positions that follow you, quality ladders served straight from object storage.' },
  { n: '03', t: 'Sharing', d: 'Public links with expiry dates, download caps, view-only restraint — or flip it around and collect files from anyone with a request link.' },
  { n: '04', t: 'Secrets', d: 'SquidVeil wraps tokens and credentials under a PBKDF2-hardened master key derived on your device. The vault opens for you alone.' },
  { n: '05', t: 'Automations', d: 'SquidActions watches your uploads and acts — scan, tag, move, notify. Built visually in a node editor, stored as GitHub-style YAML.' },
  { n: '06', t: 'Developer API', d: 'Everything above, programmatically: REST endpoints, scoped keys, daily credit ledgers, and a CLI that mounts your cloud as a native drive.' },
];

const SECURITY = [
  ['Client-side envelopes', 'Every chunk is sealed with AES-256-GCM before it touches the network.'],
  ['Wrapped key custody', 'Per-file keys live server-side — stored wrapped, unwrapped only for you.'],
  ['TOTP on privileged actions', 'Mounts, key minting, and destructive ops demand a live authenticator code.'],
  ['Signed access leases', 'Downloads ride short-lived URLs bound to your device fingerprint.'],
];

const TICKER = ['Unlimited storage', 'Zero-knowledge', 'HLS streaming', 'Signed leases', 'TOTP enforced', 'Node automations', 'Open REST API', 'Native drive mount'];

/* ── ambient pieces ── */

/** Faint topographic contour rings, slowly drifting. */
function ContourField({ reduced }: { reduced: boolean }) {
  const rings = [140, 220, 310, 410, 520, 640, 770];
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      width="1600" height="1600" viewBox="0 0 1600 1600"
      style={{ opacity: 0.5, animation: reduced ? undefined : 'nt-drift 70s ease-in-out infinite alternate' }}
    >
      {rings.map((r, i) => (
        <ellipse
          key={r}
          cx="800" cy="800" rx={r} ry={r * 0.82}
          fill="none"
          stroke="rgba(240,246,252,0.045)"
          strokeWidth="1"
          transform={`rotate(${i * 7 - 20} 800 800)`}
        />
      ))}
      <style>{`@keyframes nt-drift { from { transform: translate(-14px,-8px) rotate(0deg);} to { transform: translate(14px,10px) rotate(2.5deg);} }`}</style>
    </svg>
  );
}

/** Depth-of-field glow orb — mouse + scroll parallax via nested transforms. */
function Orb({
  mx, my, scrollY, depth, className, size, reduced,
}: {
  mx: any; my: any; scrollY: any;
  depth: number; className: string; size: number; reduced: boolean;
}) {
  const tx = useTransform(mx, (v: number) => v * depth);
  const ty = useTransform(my, (v: number) => v * depth * 0.6);
  const sy = useTransform(scrollY, [0, 1], [0, -140 * depth]);
  return (
    <motion.div aria-hidden className={cn('pointer-events-none absolute', className)} style={{ y: sy }}>
      <motion.div
        className="rounded-full"
        style={{
          x: reduced ? 0 : tx,
          y: reduced ? 0 : ty,
          width: size, height: size,
          background: 'radial-gradient(circle, rgba(230,237,243,0.10) 0%, rgba(230,237,243,0.035) 45%, transparent 70%)',
          filter: `blur(${depth > 40 ? 18 : depth > 0 ? 10 : 4}px)`,
          animation: reduced ? undefined : `nt-pulse ${5 + depth / 22}s ease-in-out infinite alternate`,
        }}
      />
    </motion.div>
  );
}

/** Floating monochrome squid logo at varying depth-of-field. */
function FloatLogo({
  mx, my, scrollY, depth, className, size, reduced,
}: {
  mx: any; my: any; scrollY: any;
  depth: number; className: string; size: number; reduced: boolean;
}) {
  const tx = useTransform(mx, (v: number) => v * depth);
  const ty = useTransform(my, (v: number) => v * depth * 0.6);
  const sy = useTransform(scrollY, [0, 1], [0, -110 * depth]);
  const far = Math.abs(depth) > 30;
  return (
    <motion.div aria-hidden className={cn('pointer-events-none absolute', className)} style={{ y: sy }}>
      <motion.div
        style={{
          x: reduced ? 0 : tx,
          y: reduced ? 0 : ty,
          opacity: far ? 0.22 : 0.45,
          filter: far ? 'blur(3px)' : 'blur(1px)',
          animation: reduced ? undefined : `nt-bob ${6 + Math.abs(depth) / 14}s ease-in-out infinite alternate`,
        }}
      >
        <SquidLogo size={size} mono />
      </motion.div>
    </motion.div>
  );
}

/** Self-drawing flourish line. */
function Flourish({ reduced }: { reduced: boolean }) {
  const ref = useRef<SVGPathElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [len, setLen] = useState(0);
  useEffect(() => {
    if (ref.current) setLen(ref.current.getTotalLength() || 1);
  }, []);
  useEffect(() => {
    if (inView && ref.current && !reduced) {
      ref.current.style.strokeDasharray = `${len}`;
      ref.current.style.strokeDashoffset = `${len}`;
      requestAnimationFrame(() => {
        if (ref.current) ref.current.style.transition = 'stroke-dashoffset 2.4s cubic-bezier(0.16,1,0.3,1)';
        if (ref.current) ref.current.style.strokeDashoffset = '0';
      });
    }
  }, [inView, len, reduced]);
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-x-0 top-[46%] -z-0 h-[220px] w-full" viewBox="0 0 1200 220" fill="none" preserveAspectRatio="none">
      <path
        ref={ref}
        d="M-20 150 C 180 40, 340 210, 560 120 S 900 20, 1040 110 S 1180 170, 1230 90"
        stroke="rgba(230,237,243,0.16)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Word-by-word blur-in. */
function BlurWords({ text, className, style, delay = 0 }: { text: string; className?: string; style?: React.CSSProperties; delay?: number }) {
  const words = text.split(' ');
  return (
    <span className={cn('inline', className)} style={style}>
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          className="inline-block will-change-[filter,transform,opacity]"
          initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ delay: delay + i * 0.055, duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
        >
          {w}
          {i < words.length - 1 ? '\u00A0' : ''}
        </motion.span>
      ))}
    </span>
  );
}

function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration: 1.9, ease: [0.16, 1, 0.3, 1], onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [inView, to]);
  return <span ref={ref} className="tabular-nums">{v}{suffix}</span>;
}

function TypeCommand({ cmd }: { cmd: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const iv = setInterval(() => setN((p) => {
      if (p >= cmd.length) { clearInterval(iv); return p; }
      return p + 1;
    }), 42);
    return () => clearInterval(iv);
  }, [inView, cmd]);
  return (
    <span ref={ref}>
      <span className="select-none text-[#6e7681]">$&nbsp;</span>
      {cmd.slice(0, n)}
      {n < cmd.length && <span className="animate-pulse">▌</span>}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────── */

export default function Index() {
  const { user } = useAuth();
  const reduced = useReducedMotion();
  const { copy, state } = useCopyToClipboard();
  usePressFonts();

  const dashHref = user ? '/dashboard' : '/auth';

  /* mouse parallax springs */
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const sx = useSpring(rawX, { stiffness: 30, damping: 20, mass: 0.8 });
  const sy = useSpring(rawY, { stiffness: 30, damping: 20, mass: 0.8 });

  /* hero scroll parallax */
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress: heroProg } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });

  const onHeroMove = (e: React.MouseEvent) => {
    if (reduced) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    rawX.set(((e.clientX - r.left) / r.width - 0.5) * 2);
    rawY.set(((e.clientY - r.top) / r.height - 0.5) * 2);
  };

  /* magnetic circular CTA */
  const ctaX = useSpring(useMotionValue(0), { stiffness: 180, damping: 14 });
  const ctaY = useSpring(useMotionValue(0), { stiffness: 180, damping: 14 });
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const onCtaMove = (e: React.MouseEvent) => {
    if (reduced) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    ctaX.set((e.clientX - (r.left + r.width / 2)) * 0.18);
    ctaY.set((e.clientY - (r.top + r.height / 2)) * 0.18);
  };
  const onCtaLeave = () => { ctaX.set(0); ctaY.set(0); };

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => { document.documentElement.style.scrollBehavior = ''; };
  }, []);

  return (
    <div className="min-h-screen font-sans antialiased" style={{ background: GITHUB.canvas, color: GITHUB.text }}>
      <style>{`
        @keyframes nt-pulse { from { opacity: 0.55; } to { opacity: 1; } }
        @keyframes nt-bob { from { transform: translateY(-6px);} to { transform: translateY(6px);} }
        @keyframes nt-sheen {
          0% { transform: translateX(-160%) skewX(-18deg); }
          42% { transform: translateX(-160%) skewX(-18deg); }
          52% { transform: translateX(160%) skewX(-18deg); }
          58% { transform: translateX(-160%) skewX(-18deg); }
          68% { transform: translateX(160%) skewX(-18deg); }
          100% { transform: translateX(160%) skewX(-18deg); }
        }
        .nt-sheen { animation: nt-sheen 7s cubic-bezier(0.4,0,0.2,1) infinite; }
      `}</style>

      {/* ══ NAV ══ */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#30363d]/70 backdrop-blur-md" style={{ background: 'rgba(13,17,23,0.82)' }}>
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <SquidLogo size={24} mono />
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#e6edf3]">SquidCloud</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            {[['Storage', '#storage'], ['Security', '#security'], ['Actions', '#actions'], ['CLI', '#cli'], ['Pricing', '#pricing']].map(([l, h]) => (
              <a key={l} href={h} className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#7d8590] transition-colors hover:text-[#e6edf3]">
                {l}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {!user && (
              <Link to="/auth" className="hidden px-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#7d8590] transition-colors hover:text-[#e6edf3] sm:inline-flex">
                Sign in
              </Link>
            )}
            <Link
              to={dashHref}
              className="inline-flex h-8 items-center rounded-md border border-[#30363d] px-3.5 text-[12px] font-medium text-[#e6edf3] transition-colors hover:border-[#7d8590]"
            >
              Open dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* ══ HERO ══ */}
      <section ref={heroRef} onMouseMove={onHeroMove} className="relative overflow-hidden px-5 pb-20 pt-32">
        <ContourField reduced={!!reduced} />

        {/* depth-of-field orbs */}
        <Orb mx={sx} my={sy} scrollY={heroProg} depth={64} size={340} className="left-[4%] top-[16%]" reduced={!!reduced} />
        <Orb mx={sx} my={sy} scrollY={heroProg} depth={-38} size={220} className="right-[8%] top-[10%]" reduced={!!reduced} />
        <Orb mx={sx} my={sy} scrollY={heroProg} depth={18} size={150} className="right-[28%] top-[52%]" reduced={!!reduced} />

        {/* floating monochrome squid logos */}
        <FloatLogo mx={sx} my={sy} scrollY={heroProg} depth={52} size={40} className="left-[10%] top-[54%]" reduced={!!reduced} />
        <FloatLogo mx={sx} my={sy} scrollY={heroProg} depth={-30} size={30} className="right-[16%] top-[38%]" reduced={!!reduced} />
        <FloatLogo mx={sx} my={sy} scrollY={heroProg} depth={14} size={22} className="left-[30%] top-[12%]" reduced={!!reduced} />

        <div className="relative z-10 mx-auto max-w-5xl pt-6">
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.9 }}
            className="mb-10 text-[11px] font-medium uppercase tracking-[0.32em] text-[#7d8590]"
          >
            Zero-knowledge storage · Est. 2025
          </motion.p>

          {/* staggered serif headline — cosmetology indent */}
          <h1 className="select-none" style={SERIF}>
            {[
              { t: 'ENCRYPTED', indent: '0rem' },
              { t: 'SECURED', indent: 'clamp(1.5rem, 7vw, 6rem)' },
              { t: 'ZERO KNOWLEDGE', indent: 'clamp(3rem, 14vw, 12rem)' },
            ].map((line, i) => (
              <span key={line.t} className="block overflow-hidden" style={{ paddingLeft: line.indent }}>
                <motion.span
                  className="block will-change-transform"
                  style={{ fontSize: 'clamp(2.6rem, 7.2vw, 6.2rem)', lineHeight: 1.04, letterSpacing: '0.01em' }}
                  initial={{ y: '112%', opacity: 0, filter: 'blur(6px)' }}
                  animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                  transition={{ delay: 0.2 + i * 0.16, duration: 1.15, ease: [0.16, 1, 0.3, 1] }}
                >
                  {line.t}
                </motion.span>
              </span>
            ))}
          </h1>

          <Flourish reduced={!!reduced} />

          <div className="mt-12 grid gap-10 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:items-end">
            <motion.p
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-lg text-[17px] italic leading-relaxed text-[#7d8590]"
              style={NEWS}
            >
              SquidCloud seals every file on your device before upload — unlimited
              storage, streaming, sharing and automation, running on ciphertext
              even we can't open.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-wrap items-center gap-3 md:justify-end"
            >
              <Link
                to="/pricing"
                className="inline-flex h-10 items-center rounded-md border border-[#30363d] px-5 text-[13px] font-medium text-[#e6edf3] transition-colors hover:border-[#7d8590]"
              >
                See pricing
              </Link>
              <a href="#storage" className="inline-flex h-10 items-center px-2 text-[13px] text-[#7d8590] transition-colors hover:text-[#e6edf3]">
                Read the manifesto ↓
              </a>
            </motion.div>
          </div>
        </div>

        {/* ASCII plate + overlapping circular CTA */}
        <div className="relative z-10 mx-auto mt-20 max-w-5xl px-1">
          <div className="relative overflow-hidden rounded-lg border border-[#30363d]" style={{ background: GITHUB.panel }}>
            <div className="flex items-center justify-between border-b border-[#30363d]/70 px-4 py-2.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#7d8590]">the mark · six rows of block type</span>
              <span className="font-mono text-[10px] text-[#6e7681]">fig. 01</span>
            </div>
            <div className="relative overflow-x-auto px-6 py-12">
              <AsciiWordmark className="mx-auto h-auto w-full max-w-[820px]" />
              {/* night-thunder sheen */}
              {!reduced && (
                <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div
                    className="nt-sheen absolute inset-y-0 w-1/2"
                    style={{ background: 'linear-gradient(105deg, transparent 0%, rgba(230,237,243,0.10) 45%, rgba(230,237,243,0.22) 50%, rgba(230,237,243,0.10) 55%, transparent 100%)' }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* circular CTA — overlapping the plate */}
          <motion.div
            className="absolute -top-12 right-6 z-20 sm:right-12"
            style={{ x: reduced ? 0 : ctaX, y: reduced ? 0 : ctaY }}
          >
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 1.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link
                ref={ctaRef as any}
                to={dashHref}
                onMouseMove={onCtaMove}
                onMouseLeave={onCtaLeave}
                className="group flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-full bg-white text-black shadow-[0_0_60px_-12px_rgba(230,237,243,0.35)] transition-transform"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Open</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">dashboard</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ══ TICKER ══ */}
      <div className="overflow-hidden border-y border-[#30363d] py-3">
        <div className="flex w-max items-center gap-8 pr-8" style={{ animation: reduced ? undefined : 'nt-marquee 38s linear infinite' }}>
          {[...Array(2)].map((_, dup) => (
            <div key={dup} className="flex shrink-0 items-center gap-8">
              {TICKER.map((t) => (
                <React.Fragment key={t}>
                  <span className="whitespace-nowrap text-[10.5px] font-medium uppercase tracking-[0.26em] text-[#7d8590]">{t}</span>
                  <span className="h-1 w-1 rounded-full bg-[#30363d]" />
                </React.Fragment>
              ))}
            </div>
          ))}
        </div>
        <style>{`@keyframes nt-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
      </div>

      {/* ══ MANIFESTO ══ */}
      <section className="px-5 py-32">
        <div className="mx-auto max-w-4xl text-center">
          <BlurWords
            text="Every cloud promised convenience — and quietly kept a copy of your life."
            className="text-balance text-[clamp(1.7rem,3.8vw,2.9rem)] font-semibold leading-[1.16] tracking-tight"
            delay={0.1}
          />
          <p className="mx-auto mt-8 max-w-xl text-[15.5px] leading-relaxed text-[#7d8590]">
            <BlurWords
              text="SquidCloud was built the other way around: privacy is the arithmetic, not the policy."
              delay={0.5}
            />
          </p>
        </div>
      </section>

      {/* ══ CAPABILITIES LEDGER ══ */}
      <section id="storage" className="scroll-mt-14 px-5 pb-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 flex items-baseline justify-between">
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#7d8590]">Capabilities</p>
            <span className="font-mono text-[10px] text-[#6e7681]">06 departments</span>
          </div>
          <div>
            {LEDGER.map((row, i) => (
              <motion.div
                key={row.n}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.04, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="group relative border-t border-[#30363d]/70 py-7 last:border-b"
              >
                <div className="flex items-start gap-6">
                  <span className="pt-1 font-mono text-[11px] text-[#6e7681]">{row.n}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[19px] font-semibold tracking-tight text-[#e6edf3] transition-transform duration-300 group-hover:translate-x-2" style={SERIF}>
                      {row.t}
                    </h3>
                    <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[#7d8590]">{row.d}</p>
                  </div>
                  <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-[#6e7681] opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ SECURITY ══ */}
      <section id="security" className="scroll-mt-14 border-y border-[#30363d] px-5 py-24" style={{ background: GITHUB.panel }}>
        <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <ShieldCheck className="h-6 w-6 text-[#7d8590]" />
            <h2 className="mt-6 text-[clamp(1.8rem,3.4vw,2.7rem)] font-semibold leading-[1.08] tracking-tight" style={SERIF}>
              Paranoid, so you don't have to be.
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[#7d8590]">
              Four independent layers stand between your files and everyone else —
              each enforced by code, not policy.
            </p>
          </div>
          <ol>
            {SECURITY.map(([t, b], i) => (
              <li key={t} className="border-b border-[#30363d]/70 py-6 first:pt-0 last:border-b-0">
                <div className="flex items-baseline gap-5">
                  <span className="font-mono text-[11px] text-[#6e7681]">0{i + 1}</span>
                  <div>
                    <h3 className="text-[15.5px] font-medium text-[#e6edf3]">{t}</h3>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#7d8590]">{b}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mx-auto mt-14 grid max-w-6xl gap-px overflow-hidden rounded-lg border border-[#30363d] sm:grid-cols-3" style={{ background: GITHUB.border }}>
          {[
            { v: 256, s: '-bit', l: 'AES-GCM keys, minted on-device' },
            { v: 600, s: 'k ×', l: 'PBKDF2 stretching before vault unwrap' },
            { v: 100, s: '%', l: 'of bytes encrypted pre-upload' },
          ].map((st) => (
            <div key={st.l} className="p-7 text-center" style={{ background: GITHUB.panel }}>
              <p className="text-[clamp(2rem,3.4vw,3rem)] font-semibold leading-none" style={SERIF}>
                <Counter to={st.v} suffix={st.s} />
              </p>
              <p className="mt-3 text-[11.5px] leading-snug text-[#7d8590]">{st.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ ACTIONS ══ */}
      <section id="actions" className="scroll-mt-14 px-5 py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <Zap className="h-5 w-5 text-[#7d8590]" />
            <h2 className="mt-6 text-[clamp(1.8rem,3.4vw,2.7rem)] font-semibold leading-[1.08] tracking-tight" style={SERIF}>
              Upload triggers workflows.
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[#7d8590]">
              Drop a new file and SquidActions wakes up — scan it, tag it, move it, email
              you a receipt. Built visually in the node editor, stored as GitHub-style YAML.
            </p>
            <Link
              to={user ? '/scripts' : '/auth'}
              className="mt-7 inline-flex items-center gap-2 text-[13.5px] text-[#e6edf3] underline decoration-[#30363d] underline-offset-4 transition-colors hover:decoration-[#7d8590]"
            >
              Explore SquidActions
            </Link>
          </div>
          <div className="relative rounded-lg border border-[#30363d] p-6" style={{ background: GITHUB.panel }}>
            <svg aria-hidden className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
              <line x1="30%" y1="0" x2="30%" y2="100%" stroke="rgba(240,246,252,0.06)" strokeWidth="1" />
              <line x1="70%" y1="0" x2="70%" y2="100%" stroke="rgba(240,246,252,0.06)" strokeWidth="1" />
            </svg>
            {[
              { t: 'file.uploaded', d: 'trigger · *.jpg' },
              { t: 'scan', d: 'found 5 matches' },
              { t: 'email-send', d: 'delivered ✓' },
            ].map((n, i) => (
              <motion.div
                key={n.t}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  'relative z-10 mx-auto w-[230px] rounded-[10px] border border-[#30363d] p-3.5',
                  i > 0 && '-mt-3',
                  i % 2 === 0 ? 'ml-[8%]' : 'ml-[38%]',
                )}
                style={{ background: GITHUB.canvas }}
              >
                <p className="font-mono text-[10.5px] text-[#7d8590]">{n.t}</p>
                <p className="mt-0.5 text-[11px] text-[#6e7681]">{n.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CLI ══ */}
      <section id="cli" className="scroll-mt-14 border-t border-[#30363d] px-5 py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#7d8590]">CLI</p>
          <h2 className="mt-4 text-[clamp(1.8rem,3.4vw,2.7rem)] font-semibold tracking-tight" style={SERIF}>
            One command. Entire cloud.
          </h2>
          <div className="mx-auto mt-10 flex max-w-md items-center gap-2">
            <code className="flex h-12 flex-1 items-center overflow-hidden rounded-md border border-[#30363d] px-4 font-mono text-[13px] text-[#e6edf3]" style={{ background: GITHUB.panel }}>
              <TypeCommand cmd="npm i -g squidcloudctl" />
            </code>
            <button
              onClick={() => copy('npm i -g squidcloudctl')}
              aria-label="Copy install command"
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-[#30363d] text-[#7d8590] transition-colors hover:bg-[#161b22] hover:text-[#e6edf3]"
            >
              {state === 'copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-5 text-[12.5px] text-[#6e7681]">
            Mounts as a drive · runs pipelines · TOTP-gated · checksummed downloads
          </p>
        </div>
      </section>

      {/* ══ PRICING ══ */}
      <section id="pricing" className="scroll-mt-14 border-t border-[#30363d] px-5 py-32">
        <div className="mx-auto max-w-3xl text-center">
          <motion.p
            initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="leading-none tracking-tight text-[#e6edf3]"
            style={{ ...SERIF, fontSize: 'clamp(3.6rem, 9vw, 7rem)' }}
          >
            Free<span className="text-[#7d8590]">.</span>
          </motion.p>
          <p className="mx-auto mt-6 max-w-md text-[15.5px] leading-relaxed text-[#7d8590]">
            Unlimited storage on every plan — including this one. Supporter tiers exist
            purely to fund the infrastructure.
          </p>
          <div className="mt-9 flex justify-center">
            <Link
              to="/pricing"
              className="group inline-flex items-center gap-2 text-[13.5px] text-[#e6edf3] underline decoration-[#30363d] underline-offset-4 transition-colors hover:decoration-[#7d8590]"
            >
              Compare plans
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ══ FINAL CTA ══ */}
      <section className="relative overflow-hidden border-t border-[#30363d] px-5 py-36">
        <div
          aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[300px]"
          style={{ background: 'radial-gradient(ellipse 55% 60% at 50% 0%, rgba(230,237,243,0.05), transparent 65%)' }}
        />
        <div className="relative mx-auto max-w-2xl text-center">
          <BlurWords
            text="Your files. Your keys. Finally."
            className="text-balance text-[clamp(1.9rem,4.2vw,3rem)] font-semibold leading-[1.1] tracking-tight"
          />
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={dashHref}
              className="group inline-flex h-11 items-center gap-2 rounded-md bg-white px-6 text-[13.5px] font-medium text-black transition-all hover:gap-3"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex h-11 items-center rounded-md border border-[#30363d] px-6 text-[13.5px] text-[#e6edf3] transition-colors hover:border-[#7d8590]"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>

      {/* ══ COLOPHON ══ */}
      <footer className="border-t border-[#30363d] px-5 py-12">
        <div className="mx-auto grid max-w-6xl gap-8 text-[12.5px] md:grid-cols-3">
          <div>
            <p className="text-[14px] font-semibold text-[#e6edf3]" style={SERIF}>SQUIDCLOUD</p>
            <p className="mt-2 max-w-xs leading-relaxed text-[#7d8590]">
              Published continuously from the edge of the network since 2025.
              Set in Instrument Serif &amp; Newsreader on GitHub dark.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#6e7681]">Bureaus</p>
            <ul className="mt-3 space-y-1.5">
              {[['Dashboard', '/dashboard'], ['Pricing', '/pricing'], ['Sign in', '/auth']].map(([l, h]) => (
                <li key={l}><Link to={h} className="text-[#7d8590] transition-colors hover:text-[#e6edf3]">{l}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#6e7681]">Correspondence</p>
            <ul className="mt-3 space-y-1.5">
              <li><a href="https://github.com/NaveenSingh9999/squidfs/releases/latest" target="_blank" rel="noreferrer" className="text-[#7d8590] transition-colors hover:text-[#e6edf3]">squidfs — release archive</a></li>
              <li><a href="https://github.com/NaveenSingh9999" target="_blank" rel="noreferrer" className="text-[#7d8590] transition-colors hover:text-[#e6edf3]">the press</a></li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-6xl border-t border-[#30363d] pt-5">
          <p className="text-center text-[10px] font-medium uppercase tracking-[0.3em] text-[#6e7681]">
            © 2026 SquidCloud · all secrets reserved
          </p>
        </div>
      </footer>
    </div>
  );
}

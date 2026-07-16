import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Lock, ArrowRight, Cloud, Copy, Check, Terminal } from '@/lib/icon-map';
import { useAuth } from '@/contexts/AuthContext';
import SquidLogo from '@/components/ui/SquidLogo';

/* Hallmark · genre: atmospheric (space custom) · macrostructure: Marquee Hero
 * theme: Deep Space · liquid glass (real multi-layer) · parallax starfield
 * perf: 105 stars, GPU-only transforms, will-change only on active animators
 */

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const BOUNCE = { type: 'spring' as const, stiffness: 300, damping: 15 };
const BOUNCE_SOFT = { type: 'spring' as const, stiffness: 200, damping: 18 };

const rnd = (n: number) => {
  const x = Math.sin(n * 99.13) * 43758.5453;
  return x - Math.floor(x);
};

/* ─── Star data (105 total, down from 165) ─── */
const FAR = Array.from({ length: 60 }, (_, i) => ({
  x: rnd(i * 7) * 100, y: rnd(i * 13) * 100,
  s: 1 + rnd(i * 19), o: 0.15 + rnd(i * 23) * 0.35,
  d: rnd(i * 29) * 6,
}));
const MID = Array.from({ length: 30 }, (_, i) => ({
  x: rnd(i * 31 + 100) * 100, y: rnd(i * 37 + 100) * 100,
  s: 1.5 + rnd(i * 41 + 100) * 1.5, o: 0.25 + rnd(i * 43 + 100) * 0.45,
  d: rnd(i * 47 + 100) * 5,
}));
const NEAR = Array.from({ length: 15 }, (_, i) => ({
  x: rnd(i * 51 + 200) * 100, y: rnd(i * 53 + 200) * 100,
  s: 2 + rnd(i * 59 + 200) * 2.5, o: 0.4 + rnd(i * 61 + 200) * 0.6,
  d: rnd(i * 67 + 200) * 4,
}));
const SHOOTERS = Array.from({ length: 4 }, (_, i) => ({
  x: 85 + rnd(i * 71) * 30, y: 2 + rnd(i * 73) * 35,
  delay: i * 2.5 + rnd(i * 79) * 3,
  dur: 0.5 + rnd(i * 83) * 0.4,
  len: 120 + rnd(i * 89) * 60,
}));

const features = [
  {
    icon: Lock,
    title: 'Dual-Layer Encryption',
    desc: 'Every file encrypted twice — XChaCha20 plus AES-256-GCM. Kernel zero-access architecture keeps raw keys off our infrastructure entirely.',
    tags: ['XChaCha20', 'AES-256-GCM', 'KZA', 'BYOK'],
  },
  {
    icon: Cloud,
    title: 'Collaborative Workspaces',
    desc: 'Role-based encrypted workspaces with activity feeds and file-level permissions. Your team, your rules, your data.',
    tags: ['RES54', 'Zero-Knowledge', 'Role-Based'],
  },
  {
    icon: Terminal,
    title: 'Developer Surface',
    desc: 'API Keys v2.1 with granular permissions, webhook events, and usage analytics. Manage everything from the CLI or embed in your own app.',
    tags: ['API Keys', 'Webhooks', 'CLI', 'SDK'],
  },
];

/* ═══ Sub-components ═══ */

function Starfield({ scrollY }: { scrollY: ReturnType<typeof useScroll>['scrollY'] }) {
  const farY = useTransform(scrollY, [0, 1200], [0, -50]);
  const midY = useTransform(scrollY, [0, 1200], [0, -110]);
  const nearY = useTransform(scrollY, [0, 1200], [0, -190]);

  const StarLayer = ({ data, style }: { data: typeof FAR; style?: React.CSSProperties }) => (
    <div className="absolute inset-0" style={style}>
      {data.map((s, i) => (
        <span
          key={i}
          className="star absolute rounded-full bg-white"
          style={{
            left: `${s.x}%`, top: `${s.y}%`,
            width: s.s, height: s.s, opacity: s.o,
            animationDuration: `${2.5 + s.d}s`,
            animationDelay: `${s.d}s`,
          }}
        />
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#030014]">
      {/* Nebula blooms */}
      <div className="absolute top-[15%] left-[18%] w-[450px] h-[450px] rounded-full bg-purple-600/[0.06] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[18%] right-[12%] w-[380px] h-[380px] rounded-full bg-blue-500/[0.05] blur-[120px] pointer-events-none" />

      {/* 3-layer parallax stars — will-change only on the motion container */}
      <motion.div className="absolute inset-0 will-change-transform" style={{ y: farY }}>
        <StarLayer data={FAR} />
      </motion.div>
      <motion.div className="absolute inset-0 will-change-transform" style={{ y: midY }}>
        <StarLayer data={MID} />
      </motion.div>
      <motion.div className="absolute inset-0 will-change-transform" style={{ y: nearY }}>
        {NEAR.map((s, i) => (
          <span
            key={i}
            className="star absolute rounded-full bg-white"
            style={{
              left: `${s.x}%`, top: `${s.y}%`,
              width: s.s, height: s.s, opacity: s.o,
              animationDuration: `${2 + s.d}s`,
              animationDelay: `${s.d}s`,
              boxShadow: `0 0 ${s.s * 4}px rgba(180,220,255,0.5)`,
            }}
          />
        ))}
      </motion.div>

      {/* Shooting stars — CSS transform only, GPU composited */}
      {SHOOTERS.map((s, i) => (
        <div
          key={i}
          className="shooting-star absolute pointer-events-none will-change-transform"
          style={{
            left: `${s.x}%`, top: `${s.y}%`,
            width: s.len, height: 1.5,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.9), rgba(180,220,255,0.3), transparent)',
            borderRadius: 999,
            animationDuration: `${s.dur}s`,
            animationDelay: `${s.delay}s`,
            animationIterationCount: 'infinite',
            transform: 'rotate(-25deg)',
          }}
        />
      ))}
    </div>
  );
}

/* ═══ Main ═══ */

const Index = () => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 700], [0, -110]);
  const heroO = useTransform(scrollY, [0, 500], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 500], [1, 0.97]);

  return (
    <div className="relative min-h-screen text-white overflow-x-clip">
      <style>{`
        /* ── Twinkle ── */
        @keyframes twinkle { 0%,100% { opacity: var(--o, 0.4); } 50% { opacity: 1; } }
        .star { animation: twinkle ease-in-out infinite; }

        /* ── Shooting star ── */
        @keyframes shoot {
          0% { transform: translateX(0) translateY(0) rotate(-25deg); opacity: 1; }
          60% { opacity: 1; }
          100% { transform: translateX(-130vw) translateY(45vh) rotate(-25deg); opacity: 0; }
        }
        .shooting-star { animation: shoot linear forwards; }

        /* ── Float ── */
        @keyframes float { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-14px) scale(1.02); } }
        @keyframes float-slow { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .float { animation: float 7s ease-in-out infinite; will-change: transform; }
        .float-slow { animation: float-slow 9s ease-in-out infinite; will-change: transform; }

        /* ── Glow pulse ── */
        @keyframes glow-pulse { 0%,100% { opacity: 0.3; } 50% { opacity: 0.7; } }
        .glow-pulse { animation: glow-pulse 5s ease-in-out infinite; }

        /* ── Saturn ring ── */
        @keyframes ring-spin { 0% { transform: rotateX(75deg) rotateZ(0deg); } 100% { transform: rotateX(75deg) rotateZ(360deg); } }
        .ring-spin { animation: ring-spin 25s linear infinite; transform-style: preserve-3d; }

        /* ══════════════════════════════════════════
           REAL LIQUID GLASS
           Multi-layer backdrop + specular + border
           ══════════════════════════════════════════ */
        .lg {
          position: relative;
          backdrop-filter: blur(40px) saturate(1.8) brightness(1.1);
          -webkit-backdrop-filter: blur(40px) saturate(1.8) brightness(1.1);
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow:
            0 8px 32px rgba(0,0,0,0.3),
            inset 0 1px 0 rgba(255,255,255,0.1),
            inset 0 -1px 0 rgba(255,255,255,0.03);
        }
        /* Specular highlight — top-left gradient sheen */
        .lg::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(
            135deg,
            rgba(255,255,255,0.12) 0%,
            rgba(255,255,255,0.04) 25%,
            transparent 50%
          );
          pointer-events: none;
          z-index: 1;
          transition: opacity 200ms ease-out;
        }
        .lg:hover::before {
          background: linear-gradient(
            135deg,
            rgba(255,255,255,0.18) 0%,
            rgba(255,255,255,0.06) 30%,
            transparent 55%
          );
        }
        /* Gradient edge — bottom-right rim light */
        .lg::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(
            135deg,
            rgba(255,255,255,0.15) 0%,
            transparent 40%,
            transparent 70%,
            rgba(255,255,255,0.08) 100%
          );
          -webkit-mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          z-index: 1;
        }

        /* Strong variant — CTA card */
        .lg-strong {
          backdrop-filter: blur(56px) saturate(2) brightness(1.15);
          -webkit-backdrop-filter: blur(56px) saturate(2) brightness(1.15);
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow:
            0 16px 64px rgba(0,0,0,0.4),
            0 0 80px hsl(var(--brand) / 0.08),
            inset 0 1px 0 rgba(255,255,255,0.15),
            inset 0 -1px 0 rgba(255,255,255,0.05);
        }
        .lg-strong::before {
          background: linear-gradient(
            135deg,
            rgba(255,255,255,0.16) 0%,
            rgba(255,255,255,0.05) 30%,
            transparent 55%
          );
        }
        .lg-strong::after {
          background: linear-gradient(
            135deg,
            rgba(255,255,255,0.2) 0%,
            transparent 35%,
            transparent 65%,
            rgba(255,255,255,0.1) 100%
          );
        }

        /* Subtle variant — install command, badges */
        .lg-subtle {
          backdrop-filter: blur(24px) saturate(1.5) brightness(1.05);
          -webkit-backdrop-filter: blur(24px) saturate(1.5) brightness(1.05);
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.06);
          box-shadow:
            0 4px 16px rgba(0,0,0,0.2),
            inset 0 1px 0 rgba(255,255,255,0.06);
        }

        /* ── Reduced motion ── */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 150ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 150ms !important;
          }
          .shooting-star { opacity: 0 !important; }
        }
      `}</style>

      <Starfield scrollY={scrollY} />

      {/* ═══ Nav — N5 floating liquid glass pill ═══ */}
      <header className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-[min(920px,calc(100%-2rem))]">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...BOUNCE, delay: 0.2 }}
          className="lg flex items-center justify-between rounded-full px-5 py-2.5"
        >
          <Link to="/" className="flex items-center gap-2.5 group relative z-10" aria-label="SquidCloud Home">
            <SquidLogo size={22} className="group-hover:drop-shadow-[0_0_8px_rgba(56,189,248,0.5)] transition-all duration-300" />
            <span className="font-semibold text-[15px] tracking-tight text-white">SquidCloud</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 relative z-10">
            {[
              { label: 'Capabilities', id: 'features' },
              { label: 'Architecture', id: 'architecture' },
            ].map((l) => (
              <a key={l.id} href={`#${l.id}`} className="text-[13px] font-medium text-white/50 hover:text-white transition-colors duration-200">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2 relative z-10">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex rounded-full text-white/60 hover:text-white hover:bg-white/[0.08] h-9 px-3.5 text-[13px]">
              <Link to="/auth">Sign In</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full h-9 px-4 text-[13px] font-medium bg-[hsl(var(--brand))] hover:bg-[hsl(var(--brand)/0.85)] shadow-[0_0_20px_hsl(var(--brand)/0.3)]">
              <Link to="/auth">Get Started</Link>
            </Button>
          </div>
        </motion.div>
      </header>

      <main>
        {/* ═══ Hero ═══ */}
        <section className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
          {/* Planets */}
          <div className="float absolute top-[12%] right-[-4%] w-80 h-80 rounded-full bg-gradient-to-br from-blue-400/20 to-purple-500/10 blur-[60px] pointer-events-none opacity-60" />
          <div className="float-slow absolute bottom-[18%] left-[4%] w-48 h-48 rounded-full bg-gradient-to-br from-cyan-400/15 to-blue-500/10 blur-[40px] pointer-events-none opacity-50" style={{ animationDelay: '2s' }} />
          <div className="float-slow absolute top-[25%] left-[14%] w-20 h-20 rounded-full bg-gradient-to-br from-white/30 to-blue-200/10 blur-[20px] pointer-events-none opacity-40" style={{ animationDelay: '4s' }} />

          {/* Saturn ring */}
          <div className="absolute top-[18%] right-[8%] pointer-events-none opacity-25">
            <div className="w-44 h-44 relative">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400/30 to-purple-500/20" />
              <div className="ring-spin absolute -inset-5 rounded-full border border-white/10" style={{ transform: 'rotateX(75deg)' }} />
            </div>
          </div>

          <motion.div
            className="relative z-10 max-w-4xl text-center"
            style={{ y: heroY, opacity: heroO, scale: heroScale }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ ...BOUNCE, delay: 0.1 }}
              className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full lg-subtle mb-8"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--brand))]/60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--brand))]" />
              </span>
              <span className="text-[11px] font-medium text-white/70 relative z-10">v12 · Octolus</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...BOUNCE, delay: 0.2 }}
              className="text-[clamp(2.8rem,7vw,5.5rem)] font-bold tracking-[-0.04em] leading-[1.02]"
            >
              <span className="text-white">YOUR FILES,</span>
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-[hsl(var(--brand))]">
                ENCRYPTED IN ORBIT.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...BOUNCE_SOFT, delay: 0.35 }}
              className="text-lg text-white/55 mt-7 max-w-xl mx-auto leading-relaxed"
            >
              Zero-knowledge architecture, dual-layer encryption, and your keys only.
              Cloud storage built for the final frontier.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...BOUNCE, delay: 0.45 }}
              className="flex flex-col sm:flex-row gap-4 mt-10 justify-center"
            >
              <Button
                asChild size="lg"
                className="h-12 px-9 text-sm font-semibold rounded-full bg-[hsl(var(--brand))] hover:bg-[hsl(var(--brand)/0.85)] shadow-[0_0_40px_hsl(var(--brand)/0.35)] hover:shadow-[0_0_60px_hsl(var(--brand)/0.5)] transition-shadow duration-300"
              >
                <Link to={user ? '/dashboard' : '/auth'} className="flex items-center gap-2.5 relative z-10">
                  {user ? 'Open Dashboard' : 'Start Free'}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button
                asChild size="lg" variant="outline"
                className="h-12 px-9 text-sm font-medium rounded-full border-white/15 text-white/70 hover:text-white hover:bg-white/[0.06] hover:border-white/25 transition-all duration-200"
              >
                <a href="#features" className="relative z-10">See Capabilities</a>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.65 }}
              className="mt-12 flex justify-center"
            >
              <div className="lg-subtle flex items-center gap-2 px-4 py-2.5 rounded-xl">
                <code className="text-[13px] text-white/65 select-all relative z-10">
                  <span className="text-[hsl(var(--brand))] font-semibold select-none">$</span>{' '}
                  <span className="font-mono">npm install -g squidcloudctl</span>
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('npm install -g squidcloudctl');
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="ml-1 text-white/35 hover:text-white transition-colors duration-150 relative z-10"
                  aria-label="Copy install command"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* ═══ Features — liquid glass cards ═══ */}
        <section id="features" className="relative px-4 py-28 scroll-mt-16">
          <div className="container mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={BOUNCE}
              className="text-center mb-16"
            >
              <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--brand)/0.8)] mb-3">
                Capabilities
              </span>
              <h2 className="text-3xl md:text-[2.75rem] font-bold tracking-[-0.035em] leading-[1.1]">
                THREE PILLARS
                <br />
                <span className="text-white/40">OF TRUST.</span>
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 50, scale: 0.92 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ ...BOUNCE, delay: i * 0.1 }}
                  whileHover={{ y: -10, scale: 1.02, transition: { duration: 0.25, ...BOUNCE } }}
                  className="lg group relative rounded-2xl p-7 overflow-hidden cursor-default"
                >
                  {/* Hover glow bloom */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-[hsl(var(--brand))]/[0.06] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  <div className="absolute -top-20 -right-20 w-40 h-40 bg-[hsl(var(--brand))]/[0.08] rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none" />

                  <div className="relative z-10">
                    <div className="w-10 h-10 rounded-xl bg-[hsl(var(--brand))]/10 flex items-center justify-center mb-5 group-hover:bg-[hsl(var(--brand)]/20 transition-colors duration-300">
                      <f.icon className="w-5 h-5 text-[hsl(var(--brand))]" />
                    </div>
                    <h3 className="text-white font-semibold text-[15px] leading-snug">{f.title}</h3>
                    <p className="text-white/45 text-[13px] leading-relaxed mt-2.5">{f.desc}</p>
                    <div className="flex flex-wrap gap-1.5 mt-5">
                      {f.tags.map((t) => (
                        <span key={t} className="px-2 py-0.5 rounded-md bg-white/[0.05] text-white/45 text-[10.5px] font-medium border border-white/[0.07]">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ Architecture ═══ */}
        <section id="architecture" className="relative px-4 py-28 scroll-mt-16">
          <div className="container mx-auto max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={BOUNCE}
              className="text-center mb-16"
            >
              <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--brand)/0.8)] mb-3">
                Architecture
              </span>
              <h2 className="text-3xl md:text-[2.75rem] font-bold tracking-[-0.035em] leading-[1.1]">
                BUILT FROM
                <br />
                <span className="text-white/40">THE GROUND UP.</span>
              </h2>
              <p className="text-white/45 text-[15px] mt-5 max-w-xl mx-auto leading-relaxed">
                Encrypted before it leaves your device, verified at every layer,
                and never readable by us. That is the whole point.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { step: '01', title: 'Encrypt on device', desc: 'Your files are encrypted with XChaCha20 before they ever leave your machine. We never see the plaintext.' },
                { step: '02', title: 'Verify at every layer', desc: 'Kernel zero-access architecture ensures raw keys never touch our infrastructure. Bring Your Own Key for full control.' },
                { step: '03', title: 'Store with confidence', desc: 'Dual-layer AES-256-GCM encryption at rest. Your data is yours — encrypted, private, and under your control.' },
              ].map((s, i) => (
                <motion.div
                  key={s.step}
                  initial={{ opacity: 0, y: 40, scale: 0.95 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ ...BOUNCE, delay: 0.1 + i * 0.1 }}
                  className="lg rounded-2xl p-6 text-center sm:text-left"
                >
                  <span className="text-[11px] font-mono text-[hsl(var(--brand)/0.7)] tracking-wider relative z-10">{s.step}</span>
                  <h3 className="text-white font-semibold text-[15px] mt-1.5 relative z-10">{s.title}</h3>
                  <p className="text-white/40 text-[13px] leading-relaxed mt-1.5 relative z-10">{s.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CTA — strong liquid glass ═══ */}
        <section className="relative px-4 py-32">
          <div className="container mx-auto max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.94 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={BOUNCE}
              className="lg-strong relative rounded-3xl p-12 sm:p-16 text-center overflow-hidden"
            >
              {/* Internal glow */}
              <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--brand))]/[0.06] via-transparent to-transparent pointer-events-none" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-60 h-32 bg-[hsl(var(--brand))]/[0.1] rounded-full blur-[80px] pointer-events-none glow-pulse" />

              <div className="relative z-10">
                <h2 className="text-2xl md:text-4xl font-bold tracking-[-0.03em]">
                  Ready to launch?
                </h2>
                <p className="text-white/50 text-[15px] mt-4 max-w-sm mx-auto">
                  KZA security, BYOK, dual encryption, and collaborative workspaces — all in one platform.
                </p>
                <Button
                  asChild size="lg"
                  className="h-12 px-9 text-sm font-semibold rounded-full bg-[hsl(var(--brand))] hover:bg-[hsl(var(--brand)/0.85)] shadow-[0_0_40px_hsl(var(--brand)/0.35)] hover:shadow-[0_0_60px_hsl(var(--brand)/0.5)] transition-shadow duration-300 mt-8"
                >
                  <Link to={user ? '/dashboard' : '/auth'} className="flex items-center gap-2.5 relative z-10">
                    {user ? 'Open Dashboard' : 'Get Started Free'}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
                {!user && (
                  <p className="mt-4 text-xs text-white/35 relative z-10">Free forever for personal use. No credit card required.</p>
                )}
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* ═══ Footer ═══ */}
      <footer className="relative border-t border-white/[0.06]">
        <div className="container mx-auto px-4 py-14 max-w-6xl">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 mb-12">
            <div className="space-y-3 max-w-sm">
              <div className="flex items-center gap-2.5">
                <SquidLogo size={24} />
                <span className="font-semibold text-sm text-white">SquidCloud</span>
              </div>
              <p className="text-[13px] text-white/45 leading-relaxed">
                Secure, private cloud storage built for people who care about their data.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-10">
              {[
                { title: 'Product', links: [{ label: 'Get Started', to: '/auth' }, { label: 'Developer API', to: '/developer-api' }, { label: 'CLI', to: '/cli' }, { label: 'cbCode IDE', to: '/cbcode' }, { label: 'Patch Notes', to: '/patch-notes' }] },
                { title: 'Resources', links: [{ label: 'Documentation', to: '/docs' }, { label: 'Extensions', to: '/extensions' }, { label: 'Status', to: '#' }] },
                { title: 'Legal', links: [{ label: 'Privacy Policy', to: '/privacy' }, { label: 'Terms of Service', to: '/terms' }] },
              ].map((section) => (
                <div key={section.title} className="space-y-3">
                  <h4 className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">{section.title}</h4>
                  <div className="space-y-2">
                    {section.links.map((link) => (
                      <Link key={link.label} to={link.to} className="block text-[13px] text-white/45 hover:text-white transition-colors duration-150">
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[11px] text-white/25">{'©'} {new Date().getFullYear()} SquidCloud. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <span className="text-[11px] text-white/25">KZA powered</span>
              <a href="https://www.producthunt.com/products/squidcloud?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-squidcloud" target="_blank" rel="noopener noreferrer" aria-label="SquidCloud on Product Hunt">
                <img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1116367&theme=dark&t=1775410084692" alt="SquidCloud - Featured on Product Hunt" width="200" height="43" className="opacity-60 hover:opacity-100 transition-opacity" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;

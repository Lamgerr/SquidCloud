import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import SquidLogo from '@/components/ui/SquidLogo';
import {
  Check,
  Cloud,
  FolderLock,
  ShieldAlert,
  Zap,
  Terminal,
  KeyRound,
  Boxes,
  ArrowRight,
  Infinity as InfinityIcon,
  Lock,
  Network,
  Code2,
} from 'lucide-react';
import Footer from '@/components/custom/Footer';

export default function Index() {
  const { user } = useAuth();

  const floatAnimation = {
    animate: {
      y: [0, -15, 0],
      transition: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
    },
  };

  const floatAnimationReverse = {
    animate: {
      y: [0, 15, 0],
      transition: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
    },
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#09090b] font-sans text-zinc-100 selection:bg-white/20 selection:text-white">
      {/* ── Ambient monochrome glow ── */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute left-1/2 top-[-10%] h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-white/[0.04] blur-[120px]" />
      </div>

      {/* ═══ MINIMALIST NAVIGATION ═══ */}
      <nav className="relative z-50 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 md:px-12">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-white">
          <SquidLogo size={28} />
          SquidCloud
        </Link>

        <div className="hidden items-center gap-10 text-sm font-medium text-zinc-400 md:flex">
          <a href="#features" className="transition-colors hover:text-white">Features</a>
          <Link to="/extensions" className="transition-colors hover:text-white">Solutions</Link>
          <Link to="/pricing" className="transition-colors hover:text-white">Pricing</Link>
          <Link to="/help/docs" className="transition-colors hover:text-white">Docs</Link>
        </div>

        <div className="flex items-center gap-6">
          {user ? (
            <Link
              to="/dashboard"
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-all hover:bg-zinc-200"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/auth" className="hidden text-sm font-medium text-zinc-400 transition-colors hover:text-white sm:block">
                Sign in
              </Link>
              <Link
                to="/auth?tab=signup"
                className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-all hover:bg-zinc-200"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ═══ FLOATING WIDGET HERO SECTION ═══ */}
      <main className="relative">
        <section className="relative flex min-h-[85vh] flex-col items-center justify-center px-6 pb-32 pt-10">
          {/* Dotted Background */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#ffffff14_1px,transparent_1px)] [background-size:24px_24px] opacity-50" />

          {/* ── FLOATING UI ELEMENTS (behind hero, far edges, hidden on small screens) ── */}
          <div className="pointer-events-none absolute inset-0 z-0 mx-auto hidden max-w-7xl overflow-visible lg:block">
            {/* Top Left: Encrypted file card */}
            <motion.div
              {...floatAnimation}
              className="absolute left-[1%] top-[14%] w-52 -rotate-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm"
            >
              <div className="pl-1 text-xs font-bold uppercase tracking-wider text-zinc-500">Vault</div>
              <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/[0.04] p-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white text-black">
                  <FolderLock size={12} strokeWidth={3} />
                </div>
                <div className="h-2 w-24 rounded-full bg-white/20"></div>
              </div>
              <div className="mt-2 flex items-center gap-3 rounded-2xl bg-white/[0.04] p-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white text-black">
                  <KeyRound size={12} strokeWidth={3} />
                </div>
                <div className="h-2 w-16 rounded-full bg-white/20"></div>
              </div>
            </motion.div>

            {/* Bottom Left: Edge / sync node */}
            <motion.div
              {...floatAnimationReverse}
              className="absolute bottom-[18%] left-[4%] rotate-6 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm"
            >
              <Boxes size={40} className="text-white" strokeWidth={1.5} />
            </motion.div>

            {/* Top Right: CLI card (real command) */}
            <motion.div
              {...floatAnimationReverse}
              className="absolute right-[2%] top-[16%] w-56 rotate-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm"
            >
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">CLI</div>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-black/40 p-3 font-mono text-xs text-zinc-300">
                <Terminal size={14} className="shrink-0 text-zinc-500" />
                <span className="truncate">squidcloudctl secrets init</span>
              </div>
            </motion.div>

            {/* Bottom Right: API / SDK card */}
            <motion.div
              {...floatAnimation}
              className="absolute bottom-[20%] right-[3%] flex -rotate-3 items-center gap-4 rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black">
                <Zap size={20} />
              </div>
              <div>
                <div className="text-sm font-bold text-white">REST + SDKs</div>
                <div className="text-xs text-zinc-500">TypeScript · Python</div>
              </div>
            </motion.div>
          </div>

          {/* ── CENTER HERO CONTENT ── */}
          <div className="relative z-20 mx-auto mt-12 max-w-4xl text-center">
            {/* backdrop to guarantee legibility over floating widgets */}
            <div className="pointer-events-none absolute inset-x-[-10%] top-[-20%] -z-10 h-[140%] bg-[radial-gradient(ellipse_at_center,#09090b_30%,transparent_75%)]" />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            >
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-medium text-zinc-300 backdrop-blur-sm">
                <ShieldAlert size={16} className="text-white" />
                Guaranteed Zero-Knowledge Architecture
              </div>
              <h1 className="text-5xl font-bold leading-[1.1] tracking-tight text-white md:text-7xl lg:text-[5.5rem]">
                Store, secure, and scale <br className="hidden md:block" />
                <span className="font-medium text-zinc-500">all in one place</span>
              </h1>

              <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-zinc-400 md:text-xl">
                SquidCloud is a privacy-first storage platform built on the Res54 distributed
                architecture — with unlimited storage, a first-class developer API, and
                zero-knowledge encryption that even we can't break.
              </p>

              <div className="mt-10">
                <Link
                  to="/auth?tab=signup"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-base font-semibold text-black transition-all hover:-translate-y-0.5 hover:bg-zinc-200"
                >
                  Sign up free
                  <ArrowRight size={18} />
                </Link>
              </div>

              {/* CLI install prompt */}
              <div className="mt-8 flex flex-col items-center gap-2">
                <a
                  href="/cli"
                  className="group inline-flex items-center gap-3 rounded-full border border-white/10 bg-black/40 px-4 py-2.5 font-mono text-sm text-zinc-300 transition-colors hover:border-white/20"
                >
                  <span className="text-zinc-500">$</span>
                  <span className="text-zinc-100">npm install -g squidcloudctl</span>
                  <span className="hidden text-zinc-500 sm:inline">— install the CLI for the best experience</span>
                  <ArrowRight size={14} className="text-zinc-500 transition-transform group-hover:translate-x-0.5" />
                </a>
                <p className="text-xs text-zinc-500">
                  Manage storage, secrets &amp; automation straight from your terminal.
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ═══ SHOWCASE STRIP — real product pillars ═══ */}
        <section className="relative z-20 border-y border-white/10 bg-[#0c0c0e] py-16">
          <div className="mx-auto max-w-7xl px-6 md:px-12">
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: InfinityIcon,
                  title: 'Unlimited Storage',
                  body: 'Uncapped by design. Store petabytes with no tier ceilings and no overage fees.',
                },
                {
                  icon: Code2,
                  title: 'Developer API',
                  body: 'First-class REST API and SDKs for TypeScript, Python and more. Automate anything.',
                },
                {
                  icon: Lock,
                  title: "World's Best Encryption",
                  body: 'Client-side, zero-knowledge encryption powered by the KZA Res54 key architecture.',
                },
                {
                  icon: Network,
                  title: 'Res54 Architecture',
                  body: 'A globally distributed, resilient storage fabric with no single point of failure.',
                },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex flex-col gap-4 bg-[#0c0c0e] p-8 transition-colors duration-300 hover:border-white/20 hover:bg-white/[0.04]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06] text-white">
                    <Icon size={24} />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{title}</h3>
                  <p className="text-sm leading-relaxed text-zinc-400">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ GUARANTEED ZERO-KNOWLEDGE ASSURANCE ═══ */}
        <section className="relative z-20 py-24 md:py-28">
          <div className="mx-auto max-w-4xl px-6 text-center md:px-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/[0.06] text-white mx-auto">
              <Lock size={30} />
            </div>
            <h2 className="mt-8 text-3xl font-bold tracking-tight text-white md:text-5xl">
              Your data. Your keys. Guaranteed.
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
              SquidCloud is built on a zero-knowledge architecture. Every file is encrypted
              client-side with the KZA Res54 key system before it leaves your device, so we
              literally cannot read, sell, or hand over your data — not even under subpoena.
            </p>

            <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { label: 'Client-side encryption', sub: 'Before it leaves your device' },
                { label: 'Zero server-side keys', sub: 'We never hold your plaintext' },
                { label: 'Independently auditable', sub: 'Open, verifiable architecture' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left"
                >
                  <div className="flex items-center gap-2 text-white">
                    <Check size={18} className="text-white" />
                    <span className="font-semibold">{item.label}</span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-500">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ VISUAL FEATURE GRID (BENTO STYLE) ═══ */}
        <section id="features" className="relative z-20 rounded-t-[3rem] border-t border-white/10 bg-[#0c0c0e] py-24 md:rounded-t-[5rem] md:px-12 md:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-16 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                Everything you need to scale
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Feature 1: Large Card */}
              <div className="group relative flex flex-col justify-between overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.03] p-10">
                <div className="relative z-10 max-w-md">
                  <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06] text-white">
                    <ShieldAlert size={28} />
                  </div>
                  <h3 className="mb-3 text-2xl font-bold text-white">Zero-Knowledge Architecture</h3>
                  <p className="leading-relaxed text-zinc-400">
                    Files are encrypted in your browser with the KZA Res54 key architecture
                    before they ever leave your device. Only you hold the keys — we never see your data.
                  </p>
                </div>
                <div className="absolute -bottom-[20%] -right-[10%] h-64 w-64 rounded-full bg-white/[0.04] blur-3xl transition-transform duration-700 group-hover:scale-110" />
              </div>

              {/* Feature 2: Small Card */}
              <div className="rounded-[2.5rem] border border-white/10 bg-white/[0.03] p-10">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06] text-white">
                  <Cloud size={28} />
                </div>
                  <h3 className="mb-3 text-2xl font-bold text-white">Unlimited Storage</h3>
                  <p className="leading-relaxed text-zinc-400">
                    Built on Res54, SquidCloud scales from a single file to petabytes
                    with no tier limits and no surprise bills.
                  </p>
              </div>

              {/* Feature 3: Small Card */}
              <div className="rounded-[2.5rem] border border-white/10 bg-white/[0.03] p-10">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06] text-white">
                  <KeyRound size={28} />
                </div>
                <h3 className="mb-3 text-2xl font-bold text-white">Secret Management</h3>
                <p className="leading-relaxed text-zinc-400">
                  Store and audit secrets with the squidcloudctl CLI and granular access control.
                </p>
              </div>

              {/* Feature 4: Large Card */}
              <div className="group relative flex flex-col justify-between overflow-hidden rounded-[2.5rem] border border-white/10 bg-zinc-100 p-10">
                <div className="relative z-10 max-w-md">
                  <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-black/5 text-black">
                    <Zap size={28} />
                  </div>
                  <h3 className="mb-3 text-2xl font-bold text-black">Lightning Fast APIs</h3>
                  <p className="mb-8 leading-relaxed text-zinc-600">
                    Integrate with native SDKs and a robust developer API built for automation.
                  </p>
                  <Link
                    to="/help/docs"
                    className="inline-flex items-center gap-2 font-semibold text-black transition-all group-hover:gap-3"
                  >
                    Read Documentation <ArrowRight size={18} />
                  </Link>
                </div>
                <div className="absolute right-0 top-0 h-full w-full bg-[radial-gradient(circle_at_top_right,_rgba(0,0,0,0.06),transparent_60%)]" />
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}

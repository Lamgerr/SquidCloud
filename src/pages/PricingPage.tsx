import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Check,
  ShieldCheck,
  ChevronDown,
  Crown,
  Sparkles,
} from 'lucide-react';
import SquidLogo from '@/components/ui/SquidLogo';
import Footer from '@/components/custom/Footer';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

/* ════════════════════════════════════════════════════════════════
   PRICING — same system as the landing: near-black canvas,
   hairline rules, one lime accent, grotesque display type.
   All plans, prices, limits and copy preserved verbatim.
   ════════════════════════════════════════════════════════════════ */

const C = {
  canvas: '#060607',
  panel: '#0b0c0f',
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

/* ═══ Data (Preserved from Original) ═══ */
type Billing = 'weekly' | 'monthly' | 'annual';

const PLAN_PRICES = {
  supporter: { weekly: { display: '$0.75' }, monthly: 4, annual: 32 },
  'supporter-plus': { weekly: { display: '$1.89' }, monthly: 10, annual: 80 },
};

const BILLING_OPTIONS: { value: Billing; label: string; badge?: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Annual', badge: '4 mos free' },
];

const FAQS = [
  { q: 'What happens when a free site archives?', a: 'Free plan published sites are automatically archived after 50 days of inactivity. Archiving means the site is taken offline but all files are preserved. You can 1-click unarchive it anytime from your dashboard — it comes back exactly as it was.' },
  { q: 'What does priority queue mean in practice?', a: 'The processing queue affects uploads, downloads, publishing, and pipelines. Standard queue (Free) processes requests in order behind all paying users. Priority (Supporter) skips ahead of Free. Top priority (Supporter+) processes before all other tiers. In practice this means faster uploads and publishing during peak usage.' },
  { q: 'What counts as an API token?', a: 'Every API request consumes one token, regardless of the endpoint or method. Tokens reset daily and are shared across your account — not per API key. Free: 1,000/day. Supporter: 10,000/day. Supporter+: Unlimited.' },
  { q: 'How does the daily upload limit work?', a: 'Each completed file upload counts toward your daily quota — Free: 20 files/day, Supporter: 50 files/day, Supporter+: 100 files/day. The counter resets at midnight UTC alongside your API tokens. File size limits still apply separately (1 GB Free, 12 GB Supporter, unlimited Supporter+).' },
  { q: 'Can I switch plans?', a: 'Yes, anytime. Upgrade or downgrade between Free, Supporter, and Supporter+. When upgrading you get immediate access to the new limits. When downgrading, changes apply at the end of your current billing period. No lock-in, no penalties.' },
  { q: 'How does billing work with weekly/monthly/annual?', a: 'You pick the cadence that works for you. Weekly bills every 7 days at the weekly rate (~18% less than monthly). Monthly bills every 30 days. Annual bills once per year and gives you the best value — 4 months effectively free compared to monthly. All payments are processed through MaxelPay with cryptocurrency.' },
];

const COMPARISON_ROWS = [
  { feature: 'Storage', free: 'Unlimited', supp: 'Unlimited', suppPlus: 'Unlimited' },
  { feature: 'Concurrent uploads', free: '2', supp: '10', suppPlus: 'Unlimited' },
  { feature: 'Concurrent downloads', free: '2', supp: '10', suppPlus: 'Unlimited' },
  { feature: 'Max upload file size', free: '1 GB', supp: '12 GB', suppPlus: 'Unlimited' },
  { feature: 'Daily file uploads', free: '20', supp: '50', suppPlus: '100' },
  { feature: 'API tokens per day', free: '1,000', supp: '10,000', suppPlus: 'Unlimited' },
  { feature: 'Published sites', free: 'Auto-archive 50 days', supp: 'Always active', suppPlus: 'Always active' },
  { feature: 'Processing queue', free: 'Standard', supp: 'Priority', suppPlus: 'Top priority' },
  { feature: 'Custom domains / subdomain', free: 'SquidCloud only', supp: 'Included', suppPlus: 'Included' },
  { feature: 'Early feature access', free: '—', supp: 'Before public', suppPlus: 'Before Supporter' },
];

/* Progressive feature lists — every value matches COMPARISON_ROWS. */
const FREE_FEATURES = [
  ['Unlimited', 'storage, forever'],
  ['2', 'concurrent uploads'],
  ['2', 'concurrent downloads'],
  ['1 GB', 'max file size'],
  ['20', 'file uploads / day'],
  ['1,000', 'API tokens / day'],
] as const;

const SUPP_FEATURES = [
  ['10', 'concurrent uploads'],
  ['10', 'concurrent downloads'],
  ['12 GB', 'max file size'],
  ['50', 'file uploads / day'],
  ['10,000', 'API tokens / day'],
  ['Priority', 'processing queue'],
  ['Included', 'custom domains'],
  ['Before public', 'early access'],
] as const;

const PLUS_FEATURES = [
  ['Unlimited', 'concurrency, file size & tokens'],
  ['100', 'file uploads / day'],
  ['Top priority', 'processing queue'],
  ['Always active', 'published sites'],
  ['Before Supporter', 'early access'],
] as const;

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

function FeatureList({ items, dark = false }: { items: readonly (readonly [string, string])[]; dark?: boolean }) {
  return (
    <ul className="space-y-3.5">
      {items.map(([val, label], i) => (
        <li key={i} className="flex items-start gap-3 text-[13.5px]">
          <Check size={16} className="mt-0.5 shrink-0" style={{ color: dark ? C.accentInk : C.accent }} />
          <span style={{ color: dark ? 'rgba(16,19,0,0.72)' : C.dim }}>
            <strong className="font-semibold" style={{ color: dark ? C.accentInk : C.paper }}>{val}</strong> {label}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function PricingPage() {
  const { user, profile } = useAuth();
  const userTier = (profile?.tier as string) ?? 'free';
  const navigate = useNavigate();

  const [billing, setBilling] = useState<Billing>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  usePressFonts();

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => { document.documentElement.style.scrollBehavior = ''; };
  }, []);

  const handleSelect = (planId: string) => {
    if (planId === 'free') {
      navigate('/auth');
      return;
    }
    navigate(`/checkout?plan=${planId}&billing=${billing}`);
  };

  const suppPrice = billing === 'weekly' ? PLAN_PRICES.supporter.weekly.display : billing === 'monthly' ? '$4' : '$32';
  const plusPrice = billing === 'weekly' ? PLAN_PRICES['supporter-plus'].weekly.display : billing === 'monthly' ? '$10' : '$80';
  const perSuffix = billing === 'annual' ? 'year' : billing === 'weekly' ? 'week' : 'month';

  const PlanButton = ({
    planId,
    label,
    featured = false,
  }: {
    planId: string;
    label: string;
    featured?: boolean;
  }) => {
    const isCurrent = userTier === planId;
    return (
      <button
        onClick={() => !isCurrent && handleSelect(planId)}
        disabled={isCurrent}
        className={`inline-flex h-12 w-full items-center justify-center rounded-full text-[13.5px] font-semibold transition-all ${
          isCurrent ? 'cursor-default opacity-50' : featured ? 'hover:opacity-85' : 'hover:border-white/30'
        }`}
        style={featured
          ? { background: C.accent, color: C.accentInk }
          : { border: `1px solid ${C.hair}`, color: C.paper, background: 'transparent' }}
      >
        {isCurrent ? 'Current plan' : label}
      </button>
    );
  };

  return (
    <div className="min-h-screen font-sans antialiased" style={{ background: C.canvas, color: C.paper }}>
      <style>{`
        .sq-pulse { animation: sq-pulse 2.2s ease-in-out infinite; }
        @keyframes sq-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
      `}</style>

      {/* ═══ NAV (matches landing) ═══ */}
      <header className="fixed inset-x-0 top-0 z-50 border-b backdrop-blur-md" style={{ borderColor: C.hair, background: 'rgba(6,6,7,0.84)' }}>
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <SquidLogo size={22} mono />
            <span className="text-[12px] font-semibold uppercase tracking-[0.28em]" style={DISPLAY}>SquidCloud</span>
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            {[['Plans', '#plans'], ['Compare', '#compare'], ['FAQ', '#faq']].map(([l, h]) => (
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
              to={user ? '/dashboard' : '/auth?tab=signup'}
              className="inline-flex h-9 items-center rounded-full px-4 text-[13px] font-semibold transition-opacity hover:opacity-85"
              style={{ background: C.accent, color: C.accentInk }}
            >
              {user ? 'Dashboard' : 'Get started'}
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ═══ HERO ═══ */}
        <section className="px-5 pb-14 pt-32 sm:pt-36">
          <div className="mx-auto max-w-3xl text-center">
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
              <p className="inline-flex items-center gap-2.5 rounded-full border px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em]" style={{ ...MONO, borderColor: C.hair, color: C.dim }}>
                <span className="sq-pulse inline-block h-1.5 w-1.5 rounded-full" style={{ background: C.accent }} />
                Pricing
              </p>
              <h1 className="mt-8 font-bold leading-[1.0] tracking-[-0.03em]" style={{ ...DISPLAY, fontSize: 'clamp(2.6rem, 6.5vw, 5rem)' }}>
                Unlimited storage.<br />
                <span style={{ ...SERIF_IT, fontWeight: 400 }}>Your speed,</span> your call.
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-[16px] leading-relaxed" style={{ color: C.dim }}>
                Every plan gets unlimited storage. Upgrading buys speed,
                concurrency, and priority access to the global edge.
              </p>
            </motion.div>

            {/* Billing toggle */}
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.12 }} className="mt-10 flex justify-center">
              <div className="inline-flex items-center gap-1 rounded-full border p-1.5" style={{ borderColor: C.hair, background: C.panel }}>
                {BILLING_OPTIONS.map((b) => (
                  <button
                    key={b.value}
                    onClick={() => setBilling(b.value)}
                    className="relative rounded-full px-5 py-2 font-mono text-[12px] uppercase tracking-[0.12em] transition-all"
                    style={billing === b.value
                      ? { ...MONO, background: C.accent, color: C.accentInk, fontWeight: 700 }
                      : { ...MONO, color: C.dim }}
                  >
                    {b.label}
                    {b.badge && (
                      <span
                        className="absolute -right-2 -top-2.5 rounded-full px-1.5 py-0.5 font-mono text-[9px] font-bold normal-case tracking-normal"
                        style={{ background: billing === b.value ? C.accentInk : C.accent, color: billing === b.value ? C.accent : C.accentInk }}
                      >
                        {b.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
            <p className="mt-4 font-mono text-[11px]" style={{ ...MONO, color: C.faint }}>
              crypto via MaxelPay · no card required · cancel anytime
            </p>
          </div>
        </section>

        {/* ═══ PLAN CARDS ═══ */}
        <section id="plans" className="scroll-mt-20 px-5 pb-24">
          <div className="mx-auto grid max-w-[1440px] gap-5 lg:grid-cols-3">
            {/* FREE */}
            <Reveal className="h-full">
              <div className="flex h-full flex-col rounded-2xl border p-8" style={{ borderColor: C.hair, background: C.panel }}>
                <p className="font-mono text-[11px] uppercase tracking-[0.22em]" style={{ ...MONO, color: C.dim }}>Free</p>
                <p className="mt-1.5 text-[13px]" style={{ color: C.faint }}>Unlimited storage, always</p>
                <p className="mt-6 font-semibold tracking-tight" style={{ ...DISPLAY, fontSize: 'clamp(2.4rem, 3.5vw, 3rem)' }}>
                  $0
                </p>
                <p className="mt-1 font-mono text-[11px]" style={{ ...MONO, color: C.faint }}>free forever</p>
                <div className="mb-8 mt-7">
                  <PlanButton planId="free" label="Get started" />
                </div>
                <div className="border-t pt-7" style={{ borderColor: C.hair }}>
                  <FeatureList items={FREE_FEATURES} />
                </div>
              </div>
            </Reveal>

            {/* SUPPORTER */}
            <Reveal delay={0.08} className="h-full">
              <div className="flex h-full flex-col rounded-2xl border p-8" style={{ borderColor: C.hair, background: C.panel }}>
                <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em]" style={{ ...MONO, color: C.dim }}>
                  <Crown size={13} style={{ color: C.accent }} /> Supporter
                </p>
                <p className="mt-1.5 text-[13px]" style={{ color: C.faint }}>For serious creators</p>
                <p className="mt-6 font-semibold tracking-tight" style={{ ...DISPLAY, fontSize: 'clamp(2.4rem, 3.5vw, 3rem)' }}>
                  {suppPrice}
                  <span className="ml-1.5 align-middle font-mono text-[12px] font-normal" style={{ ...MONO, color: C.faint }}>/{perSuffix}</span>
                </p>
                <p className="mt-1 font-mono text-[11px]" style={{ ...MONO, color: C.faint }}>
                  {billing === 'annual' ? '$32 billed once a year' : billing === 'weekly' ? 'billed every 7 days' : '$4 billed monthly'}
                </p>
                <div className="mb-8 mt-7">
                  <PlanButton planId="supporter" label="Go Supporter" />
                </div>
                <div className="border-t pt-7" style={{ borderColor: C.hair }}>
                  <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em]" style={{ ...MONO, color: C.faint }}>Everything in Free, plus:</p>
                  <FeatureList items={SUPP_FEATURES} />
                </div>
              </div>
            </Reveal>

            {/* SUPPORTER+ — featured */}
            <Reveal delay={0.16} className="h-full">
              <div className="relative flex h-full flex-col rounded-2xl p-8" style={{ background: C.accent, color: C.accentInk }}>
                <span className="absolute -top-3 left-8 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ background: C.accentInk, color: C.accent }}>
                  <Sparkles size={11} /> Best value
                </span>
                <p className="font-mono text-[11px] uppercase tracking-[0.22em]" style={{ ...MONO, color: 'rgba(16,19,0,0.65)' }}>Supporter+</p>
                <p className="mt-1.5 text-[13px]" style={{ color: 'rgba(16,19,0,0.65)' }}>For power users &amp; teams</p>
                <p className="mt-6 font-semibold tracking-tight" style={{ ...DISPLAY, fontSize: 'clamp(2.4rem, 3.5vw, 3rem)' }}>
                  {plusPrice}
                  <span className="ml-1.5 align-middle font-mono text-[12px] font-normal" style={{ ...MONO, color: 'rgba(16,19,0,0.6)' }}>/{perSuffix}</span>
                </p>
                <p className="mt-1 font-mono text-[11px]" style={{ ...MONO, color: 'rgba(16,19,0,0.6)' }}>
                  {billing === 'annual' ? '$80 billed once a year' : billing === 'weekly' ? 'billed every 7 days' : '$10 billed monthly'}
                </p>
                <div className="mb-8 mt-7">
                  <PlanButton planId="supporter-plus" label="Go Unlimited" featured />
                </div>
                <div className="border-t pt-7" style={{ borderColor: 'rgba(16,19,0,0.16)' }}>
                  <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em]" style={{ ...MONO, color: 'rgba(16,19,0,0.6)' }}>Everything in Supporter, plus:</p>
                  <FeatureList items={PLUS_FEATURES} dark />
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ═══ COMPARISON ═══ */}
        <section id="compare" className="scroll-mt-20 border-t px-5 py-24" style={{ borderColor: C.hair }}>
          <div className="mx-auto max-w-5xl">
            <Reveal>
              <p className="text-center font-mono text-[11px] uppercase tracking-[0.24em]" style={{ ...MONO, color: C.faint }}>
                <span style={{ color: C.accent }}>02</span>
                <span className="mx-3 inline-block h-px w-8 align-middle" style={{ background: C.hair }} />
                Compare
              </p>
              <h2 className="mt-5 text-center font-semibold tracking-[-0.02em]" style={{ ...DISPLAY, fontSize: 'clamp(1.7rem, 3.2vw, 2.5rem)' }}>
                Every limit, on one table.
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="mt-10 overflow-hidden rounded-2xl border" style={{ borderColor: C.hair, background: C.panel }}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-[13.5px]">
                    <thead>
                      <tr className="border-b font-mono text-[11px] uppercase tracking-[0.16em]" style={{ ...MONO, borderColor: C.hair, color: C.faint }}>
                        <th className="px-7 py-4 font-medium">Feature</th>
                        <th className="px-5 py-4 text-center font-medium">Free</th>
                        <th className="px-5 py-4 text-center font-medium">Supporter</th>
                        <th className="px-5 py-4 text-center font-medium" style={{ color: C.accent }}>Supporter+</th>
                      </tr>
                    </thead>
                    <tbody>
                      {COMPARISON_ROWS.map((row, i) => (
                        <tr key={i} className="transition-colors hover:bg-white/[0.02]" style={i > 0 ? { borderTop: `1px solid ${C.hair}` } : undefined}>
                          <td className="whitespace-nowrap px-7 py-3.5 font-medium" style={{ color: C.paper }}>{row.feature}</td>
                          <td className="px-5 py-3.5 text-center" style={{ color: C.dim }}>{row.free}</td>
                          <td className="px-5 py-3.5 text-center font-medium" style={{ color: C.paper }}>{row.supp}</td>
                          <td className="px-5 py-3.5 text-center font-semibold" style={{ color: C.accent }}>{row.suppPlus}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ═══ FAQ ═══ */}
        <section id="faq" className="scroll-mt-20 border-t px-5 py-24" style={{ borderColor: C.hair, background: C.panel }}>
          <div className="mx-auto max-w-3xl">
            <Reveal>
              <p className="text-center font-mono text-[11px] uppercase tracking-[0.24em]" style={{ ...MONO, color: C.faint }}>
                <span style={{ color: C.accent }}>03</span>
                <span className="mx-3 inline-block h-px w-8 align-middle" style={{ background: C.hair }} />
                FAQ
              </p>
              <h2 className="mt-5 text-center font-semibold tracking-[-0.02em]" style={{ ...DISPLAY, fontSize: 'clamp(1.7rem, 3.2vw, 2.5rem)' }}>
                Asked, answered.
              </h2>
            </Reveal>
            <div className="mt-10 space-y-3">
              {FAQS.map((faq, i) => (
                <Reveal key={i} delay={Math.min(i * 0.04, 0.16)}>
                  <div className="overflow-hidden rounded-xl border transition-colors" style={{ borderColor: openFaq === i ? 'rgba(255,255,255,0.2)' : C.hair, background: C.canvas }}>
                    <button
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-[14.5px] font-medium"
                      style={{ color: C.paper }}
                    >
                      {faq.q}
                      <ChevronDown size={18} className={`shrink-0 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`} style={{ color: openFaq === i ? C.accent : C.faint }} />
                    </button>
                    <AnimatePresence>
                      {openFaq === i && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22 }}
                        >
                          <p className="px-6 pb-6 text-[13.5px] leading-relaxed" style={{ color: C.dim }}>
                            {faq.a}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CRYPTO PAYMENTS ═══ */}
        <section className="border-t px-5 py-24" style={{ borderColor: C.hair }}>
          <div className="mx-auto max-w-4xl text-center">
            <Reveal>
              <div className="rounded-2xl border p-10 md:p-14" style={{ borderColor: C.hair, background: C.panel }}>
                <ShieldCheck className="mx-auto h-8 w-8" color={C.accent} />
                <h2 className="mt-6 font-semibold tracking-[-0.02em]" style={{ ...DISPLAY, fontSize: 'clamp(1.6rem, 3vw, 2.3rem)' }}>
                  Secure crypto payments.
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-[14.5px] leading-relaxed" style={{ color: C.dim }}>
                  All payments are processed securely through <strong className="font-semibold" style={{ color: C.paper }}>MaxelPay</strong> — a
                  no-KYC cryptocurrency payment gateway. Pay with USDT, USDC, ETH, BTC, and more.
                  Settled instantly on-chain. No credit card required.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 font-mono text-[11px]" style={{ ...MONO, color: C.faint }}>
                  {['USDT', 'USDC', 'ETH', 'BTC'].map((c) => (
                    <span key={c} className="rounded-full border px-3 py-1" style={{ borderColor: C.hair }}>{c}</span>
                  ))}
                </div>
                <Link
                  to="/auth?tab=signup"
                  className="mt-8 inline-flex h-12 items-center rounded-full px-8 text-[14px] font-semibold transition-opacity hover:opacity-85"
                  style={{ background: C.accent, color: C.accentInk }}
                >
                  Create free account
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

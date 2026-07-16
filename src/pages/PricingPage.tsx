import { useState } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Check, X, Zap, Crown, Sparkles, CheckCircle, ShieldCheck,
  Globe, Lock, Users, TrendingUp,
} from '@/lib/icon-map';

/* Hallmark · genre: atmospheric (space custom) · macrostructure: Stat-Led pricing
 * theme: Deep Space · liquid glass (real multi-layer) · parallax starfield
 * nebula centerpiece behind hero · bouncy spring entrances
 */

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const BOUNCE = { type: 'spring' as const, stiffness: 300, damping: 15 };
const BOUNCE_SOFT = { type: 'spring' as const, stiffness: 200, damping: 18 };

const rnd = (n: number) => {
  const x = Math.sin(n * 99.13) * 43758.5453;
  return x - Math.floor(x);
};

/* ─── Star data (87 total) ─── */
const FAR = Array.from({ length: 50 }, (_, i) => ({
  x: rnd(i * 7) * 100, y: rnd(i * 13) * 100,
  s: 1 + rnd(i * 19), o: 0.15 + rnd(i * 23) * 0.35,
  d: rnd(i * 29) * 6,
}));
const MID = Array.from({ length: 25 }, (_, i) => ({
  x: rnd(i * 31 + 100) * 100, y: rnd(i * 37 + 100) * 100,
  s: 1.5 + rnd(i * 41 + 100) * 1.5, o: 0.25 + rnd(i * 43 + 100) * 0.45,
  d: rnd(i * 47 + 100) * 5,
}));
const NEAR = Array.from({ length: 12 }, (_, i) => ({
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

/* ═══ Pricing data (preserved exactly) ═══ */

type Billing = 'weekly' | 'monthly' | 'annual';

interface PlanPrice {
  weekly: { raw: number; display: string };
  monthly: number;
  annual: number;
}

const PLAN_PRICES: Record<string, PlanPrice> = {
  supporter: {
    weekly: { raw: 0.75, display: '$0.75' },
    monthly: 4,
    annual: 32,
  },
  'supporter-plus': {
    weekly: { raw: 1.89, display: '$1.89' },
    monthly: 10,
    annual: 80,
  },
};

const BILLING_OPTIONS: { value: Billing; label: string; badge?: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Annual', badge: '4 months free' },
];

const FAQS = [
  {
    q: 'What happens when a free site archives?',
    a: 'Free plan published sites are automatically archived after 50 days of inactivity. Archiving means the site is taken offline but all files are preserved. You can 1-click unarchive it anytime from your dashboard — it comes back exactly as it was.',
  },
  {
    q: 'What does priority queue mean in practice?',
    a: 'The processing queue affects uploads, downloads, publishing, and pipelines. Standard queue (Free) processes requests in order behind all paying users. Priority (Supporter) skips ahead of Free. Top priority (Supporter+) processes before all other tiers. In practice this means faster uploads and publishing during peak usage.',
  },
  {
    q: 'What counts as an API token?',
    a: 'Every API request consumes one token, regardless of the endpoint or method. Tokens reset daily and are shared across your account — not per API key. Free: 1,000/day. Supporter: 10,000/day. Supporter+: Unlimited.',
  },
  {
    q: 'Can I switch plans?',
    a: 'Yes, anytime. Upgrade or downgrade between Free, Supporter, and Supporter+. When upgrading you get immediate access to the new limits. When downgrading, changes apply at the end of your current billing period. No lock-in, no penalties.',
  },
  {
    q: 'How does billing work with weekly/monthly/annual?',
    a: 'You pick the cadence that works for you. Weekly bills every 7 days at the weekly rate (~18% less than monthly). Monthly bills every 30 days. Annual bills once per year and gives you the best value — 4 months effectively free compared to monthly. All payments are processed through MaxelPay with cryptocurrency.',
  },
];

function getPrice(planId: string, billing: Billing): { main: string; sub: string; original?: string } {
  if (planId === 'free') return { main: 'Free', sub: '' };
  const p = PLAN_PRICES[planId];
  if (!p) return { main: '—', sub: '' };

  if (billing === 'weekly') {
    return { main: p.weekly.display, sub: '/week' };
  }
  if (billing === 'monthly') {
    return { main: `$${p.monthly}`, sub: '/month' };
  }
  const monthlyTotal = p.monthly * 12;
  return {
    main: `$${p.annual}`,
    sub: `/year`,
    original: monthlyTotal > p.annual ? `$${monthlyTotal}/yr` : undefined,
  };
}

interface PlanCardProps {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  billing: Billing;
  userTier: string;
  variant: 'free' | 'supporter' | 'supporter-plus';
  features: { label: string; free: string; paid: string }[];
  allFeatures: { free: string; supp: string; suppPlus: string };
}

const PLAN_CONFIGS: Record<string, Omit<PlanCardProps, 'billing' | 'userTier' | 'allFeatures'>> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Unlimited storage, always',
    description: '',
    icon: Zap,
    color: 'text-white/50',
    variant: 'free',
    features: [
      { label: 'Concurrent uploads', free: '2', paid: '10' },
      { label: 'Concurrent downloads', free: '2', paid: '10' },
      { label: 'Max upload file size', free: '1 GB', paid: '25 GB' },
      { label: 'API tokens per day', free: '1,000', paid: '10,000' },
    ],
  },
  supporter: {
    id: 'supporter',
    name: 'Supporter',
    tagline: 'For serious creators',
    description: 'Most developers start here',
    icon: Crown,
    color: 'text-amber-400',
    variant: 'supporter',
    features: [
      { label: 'Concurrent uploads', free: '2', paid: '10' },
      { label: 'Concurrent downloads', free: '2', paid: '10' },
      { label: 'Max upload file size', free: '1 GB', paid: '25 GB' },
      { label: 'API tokens per day', free: '1,000', paid: '10,000' },
    ],
  },
  'supporter-plus': {
    id: 'supporter-plus',
    name: 'Supporter+',
    tagline: 'For power users & teams',
    description: 'For those who want zero limits',
    icon: Sparkles,
    color: 'text-purple-400',
    variant: 'supporter-plus',
    features: [
      { label: 'Concurrent uploads', free: '2', paid: 'Unlimited' },
      { label: 'Concurrent downloads', free: '2', paid: 'Unlimited' },
      { label: 'Max upload file size', free: '1 GB', paid: 'Unlimited' },
      { label: 'API tokens per day', free: '1,000', paid: 'Unlimited' },
    ],
  },
};

const COMPARISON_ROWS = [
  { feature: 'Storage', free: 'Unlimited', supp: 'Unlimited', suppPlus: 'Unlimited', noDiff: true },
  { feature: 'Concurrent uploads', free: '2', supp: '10', suppPlus: 'Unlimited' },
  { feature: 'Concurrent downloads', free: '2', supp: '10', suppPlus: 'Unlimited' },
  { feature: 'Max upload file size', free: '1 GB', supp: '25 GB', suppPlus: 'Unlimited' },
  { feature: 'API tokens per day', free: '1,000', supp: '10,000', suppPlus: 'Unlimited' },
  { feature: 'Published sites', free: 'Auto-archive 50 days', supp: 'Always active', suppPlus: 'Always active' },
  { feature: 'Processing queue', free: 'Standard', supp: 'Priority', suppPlus: 'Top priority' },
  { feature: 'Custom domains / subdomain', free: 'SquidCloud only', supp: '✓', suppPlus: '✓' },
  { feature: 'Early feature access', free: '—', supp: 'Before public', suppPlus: 'Before Supporter' },
  { feature: 'Supporter badge', free: '—', supp: '✓', suppPlus: '✓' },
];

/* ═══ Sub-components ═══ */

function Starfield({ scrollY }: { scrollY: ReturnType<typeof useScroll>['scrollY'] }) {
  const farY = useTransform(scrollY, [0, 1200], [0, -40]);
  const midY = useTransform(scrollY, [0, 1200], [0, -90]);
  const nearY = useTransform(scrollY, [0, 1200], [0, -160]);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#030014]">
      {/* Nebula blooms (background) */}
      <div className="absolute top-[10%] left-[15%] w-[400px] h-[400px] rounded-full bg-purple-600/[0.06] blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[15%] right-[10%] w-[350px] h-[350px] rounded-full bg-blue-500/[0.05] blur-[110px] pointer-events-none" />

      {/* 3-layer parallax stars */}
      <motion.div className="absolute inset-0 will-change-transform" style={{ y: farY }}>
        {FAR.map((s, i) => (
          <span key={`f-${i}`} className="star absolute rounded-full bg-white"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, opacity: s.o, animationDuration: `${2.5 + s.d}s`, animationDelay: `${s.d}s` }} />
        ))}
      </motion.div>
      <motion.div className="absolute inset-0 will-change-transform" style={{ y: midY }}>
        {MID.map((s, i) => (
          <span key={`m-${i}`} className="star absolute rounded-full bg-white"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, opacity: s.o, animationDuration: `${2.5 + s.d}s`, animationDelay: `${s.d}s` }} />
        ))}
      </motion.div>
      <motion.div className="absolute inset-0 will-change-transform" style={{ y: nearY }}>
        {NEAR.map((s, i) => (
          <span key={`n-${i}`} className="star absolute rounded-full bg-white"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, opacity: s.o, animationDuration: `${2 + s.d}s`, animationDelay: `${s.d}s`, boxShadow: `0 0 ${s.s * 4}px rgba(180,220,255,0.5)` }} />
        ))}
      </motion.div>

      {/* Shooting stars */}
      {SHOOTERS.map((s, i) => (
        <div key={`sh-${i}`} className="shooting-star absolute pointer-events-none will-change-transform"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.len, height: 1.5,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.9), rgba(180,220,255,0.3), transparent)',
            borderRadius: 999, animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s`,
            animationIterationCount: 'infinite', transform: 'rotate(-25deg)' }} />
      ))}
    </div>
  );
}

function NebulaCenterpiece() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
      {/* Main nebula cloud */}
      <div className="nebula-pulse absolute w-[700px] h-[500px] opacity-40">
        {/* Core — deep purple */}
        <div className="absolute top-[20%] left-[25%] w-[350px] h-[300px] rounded-full bg-purple-600/30 blur-[100px]" />
        {/* Left wing — electric blue */}
        <div className="absolute top-[30%] left-[5%] w-[280px] h-[250px] rounded-full bg-blue-500/25 blur-[90px]" />
        {/* Right wing — cyan */}
        <div className="absolute top-[25%] right-[10%] w-[260px] h-[240px] rounded-full bg-cyan-400/20 blur-[85px]" />
        {/* Upper bloom — pink */}
        <div className="absolute top-[5%] left-[35%] w-[200px] h-[180px] rounded-full bg-pink-500/15 blur-[80px]" />
        {/* Lower haze — deep blue */}
        <div className="absolute bottom-[10%] left-[20%] w-[320px] h-[200px] rounded-full bg-indigo-500/20 blur-[110px]" />
        {/* Core bright spot */}
        <div className="absolute top-[35%] left-[40%] w-[120px] h-[100px] rounded-full bg-white/8 blur-[60px]" />
      </div>
    </div>
  );
}

/* ═══ PlanCard ═══ */

function PlanCard({ config, billing, userTier, onSelect }: {
  config: typeof PLAN_CONFIGS[string];
  billing: Billing;
  userTier: string;
  onSelect: (planId: string, billing: Billing) => void;
}) {
  const isCurrentPlan = userTier === config.id || (config.id === 'free' && !userTier);
  const price = getPrice(config.id, billing);
  const isAnnual = billing === 'annual';
  const prices = PLAN_PRICES[config.id];
  const annualMonthlyEq = prices ? prices.annual / 12 : 0;
  const index = Object.keys(PLAN_CONFIGS).indexOf(config.id);
  const isPlus = config.variant === 'supporter-plus';
  const isSup = config.variant === 'supporter';

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...BOUNCE, delay: index * 0.12 }}
      whileHover={{ y: -8, scale: 1.02, transition: { duration: 0.25, ...BOUNCE } }}
      className={cn(
        'group relative flex flex-col rounded-2xl cursor-default',
        isPlus ? 'lg-strong scale-[1.02] z-10' : 'lg',
        isCurrentPlan && 'ring-2 ring-[hsl(var(--brand))]/40',
      )}
    >
      {/* Best Value badge */}
      {isPlus && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1 text-xs font-semibold shadow-lg shadow-purple-500/25 border-0 relative z-10">
            <Sparkles className="h-3 w-3 mr-1" /> Best Value
          </Badge>
        </div>
      )}

      {/* Hover glow bloom */}
      <div className={cn(
        'absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none',
        isPlus
          ? 'bg-gradient-to-b from-purple-500/[0.08] to-transparent'
          : isSup
            ? 'bg-gradient-to-b from-[hsl(var(--brand))]/[0.06] to-transparent'
            : 'bg-gradient-to-b from-white/[0.03] to-transparent',
      )} />

      <div className="relative p-6 pb-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className={cn(
            'h-10 w-10 rounded-xl flex items-center justify-center border',
            isPlus && 'bg-purple-500/15 border-purple-500/20',
            isSup && 'bg-[hsl(var(--brand))]/15 border-[hsl(var(--brand))]/20',
            !isPlus && !isSup && 'bg-white/5 border-white/10',
          )}>
            <config.icon className={cn('h-5 w-5', config.color)} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">{config.name}</h3>
            <p className="text-[11px] text-white/45">{config.tagline}</p>
          </div>
        </div>

        {/* Price */}
        <div className="mb-1">
          <div className="flex items-baseline gap-1.5">
            <span className={cn(
              'text-3xl font-bold tracking-tight',
              isPlus ? 'text-purple-300' : 'text-white',
            )}>
              {price.main}
            </span>
            <span className="text-sm text-white/45">{price.sub}</span>
            {isAnnual && price.original && (
              <span className="text-xs text-white/30 line-through ml-1">{price.original}</span>
            )}
          </div>
          {isAnnual && config.id !== 'free' && (
            <p className="text-[11px] text-emerald-400 font-medium mt-0.5">
              <TrendingUp className="h-2.5 w-2.5 inline mr-0.5" />
              Just ${annualMonthlyEq.toFixed(2)}/mo — 4 months free
            </p>
          )}
        </div>

        {/* Billing toggle */}
        {config.id !== 'free' && (
          <div className="flex gap-1 mt-4 lg-subtle rounded-xl p-0.5">
            {BILLING_OPTIONS.map((b) => {
              const isSel = billing === b.value;
              return (
                <button
                  key={b.value}
                  onClick={() => onSelect(config.id, b.value)}
                  className={cn(
                    'flex-1 text-[10px] font-semibold py-1.5 rounded-lg transition-all duration-200 relative z-10',
                    isSel
                      ? 'bg-white/10 text-white shadow-sm border border-white/10'
                      : 'text-white/40 hover:text-white/70',
                  )}
                >
                  {b.label}
                  {b.badge && isAnnual && (
                    <span className="block text-[8px] font-bold text-emerald-400">{b.badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* CTA */}
        <Button
          variant={isCurrentPlan ? 'outline' : 'default'}
          className={cn(
            'w-full mt-4 rounded-xl h-10 text-sm font-semibold transition-all relative z-10',
            isCurrentPlan && 'opacity-50 cursor-default border-white/10 text-white/40',
            !isCurrentPlan && isPlus && 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-500/90 hover:to-pink-500/90 shadow-lg shadow-purple-500/25 text-white border-0',
            !isCurrentPlan && isSup && 'bg-gradient-to-r from-[hsl(var(--brand))] to-purple-500 hover:from-[hsl(var(--brand)/0.9)] hover:to-purple-500/90 shadow-md shadow-[hsl(var(--brand)/0.2)] text-white border-0',
            !isCurrentPlan && !isPlus && !isSup && 'border-white/15 text-white/70 hover:text-white hover:bg-white/[0.06] hover:border-white/25',
          )}
          disabled={isCurrentPlan}
          onClick={() => !isCurrentPlan && onSelect(config.id, billing)}
        >
          {isCurrentPlan ? 'Current Plan' : config.id === 'free' ? 'Get Started' : config.id === 'supporter' ? 'Go Supporter' : 'Go Unlimited'}
        </Button>

        {config.description && (
          <p className="text-[11px] text-white/35 text-center mt-2 relative z-10">{config.description}</p>
        )}
      </div>

      {/* Feature highlights */}
      <div className="relative p-6 pt-5 flex-1 flex flex-col z-10">
        <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-3">
          {config.variant === 'free' ? 'What you get' : 'Everything in Free, plus'}
        </p>
        <ul className="space-y-2.5 flex-1">
          {config.features.map((f, i) => (
            <motion.li
              key={f.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.05, duration: 0.3, ease: EASE_OUT }}
              className="flex items-start gap-2.5"
            >
              <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span className="text-xs leading-snug text-white/65">
                <span className="font-semibold text-white">{config.variant === 'free' ? f.free : f.paid}</span>
                {' '}{f.label}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

/* ═══ ComparisonTable ═══ */

function ComparisonTable({ isMobile }: { isMobile: boolean }) {
  const table = (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-white/[0.06]">
          <th className="text-left px-4 py-3 text-xs font-semibold text-white/40">Feature</th>
          <th className="px-4 py-3 text-xs font-semibold text-center text-white/30">Free</th>
          <th className="px-4 py-3 text-xs font-semibold text-center text-[hsl(var(--brand))]">Supporter</th>
          <th className="px-4 py-3 text-xs font-semibold text-center text-purple-400">Supporter+</th>
        </tr>
      </thead>
      <tbody>
        {COMPARISON_ROWS.map((row, i) => (
          <tr key={row.feature} className="border-b border-white/[0.04]">
            <td className="px-4 py-2.5 text-xs font-medium text-white/70 whitespace-nowrap">{row.feature}</td>
            <td className={cn(
              'px-4 py-2.5 text-xs text-center',
              row.noDiff ? 'text-white/60 font-medium' : 'text-white/30',
            )}>
              {row.free}
            </td>
            <td className="px-4 py-2.5 text-xs text-center font-medium text-[hsl(var(--brand))]">{row.supp}</td>
            <td className="px-4 py-2.5 text-xs text-center font-medium text-purple-400">{row.suppPlus}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  if (isMobile) {
    return (
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="min-w-[500px] lg rounded-2xl overflow-hidden">
          {table}
        </div>
      </div>
    );
  }

  return (
    <div className="lg rounded-2xl overflow-hidden">
      {table}
    </div>
  );
}

/* ═══ FAQSection ═══ */

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="max-w-2xl mx-auto space-y-2">
      {FAQS.map((faq, i) => (
        <div key={i} className="lg rounded-xl overflow-hidden">
          <button
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-white/80 hover:text-white transition-colors relative z-10"
          >
            {faq.q}
            <motion.span
              animate={{ rotate: openIndex === i ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-white/40 shrink-0 ml-2"
            >
              ▼
            </motion.span>
          </button>
          <AnimatePresence>
            {openIndex === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
                className="overflow-hidden"
              >
                <p className="px-4 pb-3 text-xs text-white/45 leading-relaxed relative z-10">{faq.a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

/* ═══ Main ═══ */

export default function PricingPage() {
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [billing, setBilling] = useState<Billing>('monthly');
  const userTier = profile?.is_premium ? (profile?.tier || 'supporter') : 'free';

  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, -80]);
  const heroO = useTransform(scrollY, [0, 400], [1, 0]);

  const handleSelect = (planId: string, bill: Billing) => {
    setBilling(bill);
    if (planId !== 'free') {
      navigate(`/checkout?plan=${planId}&billing=${bill}`);
    } else {
      navigate(user ? '/dashboard' : '/auth');
    }
  };

  const planEntries = Object.entries(PLAN_CONFIGS) as [string, typeof PLAN_CONFIGS[string]][];

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

        /* ── Nebula breathing ── */
        @keyframes nebula-pulse {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(1.03); }
        }
        .nebula-pulse { animation: nebula-pulse 12s ease-in-out infinite; will-change: transform, opacity; }

        /* ═══ REAL LIQUID GLASS ═══ */
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
        .lg::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 25%, transparent 50%);
          pointer-events: none;
          z-index: -1;
          transition: opacity 200ms ease-out;
        }
        .lg:hover::before {
          background: linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 30%, transparent 55%);
        }
        .lg::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 40%, transparent 70%, rgba(255,255,255,0.08) 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          z-index: -1;
        }

        /* Strong variant */
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
          background: linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 30%, transparent 55%);
        }
        .lg-strong::after {
          background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 35%, transparent 65%, rgba(255,255,255,0.1) 100%);
        }

        /* Subtle variant */
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

      {/* ═══ Hero with nebula centerpiece ═══ */}
      <section className="relative overflow-hidden px-4 pt-20 pb-8 text-center">
        <NebulaCenterpiece />

        <motion.div
          className="relative max-w-2xl mx-auto"
          style={{ y: heroY, opacity: heroO }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ ...BOUNCE, delay: 0.1 }}
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full lg-subtle mb-6"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--brand))]/60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--brand))]" />
            </span>
            <span className="text-[11px] font-medium text-white/70 relative z-10">Pricing</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...BOUNCE, delay: 0.2 }}
            className="text-3xl md:text-5xl font-bold tracking-[-0.04em] leading-[1.08] mb-4"
          >
            Unlimited storage.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-[hsl(var(--brand))]">
              Your speed, your call.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...BOUNCE_SOFT, delay: 0.35 }}
            className="text-sm md:text-base text-white/50 max-w-lg mx-auto leading-relaxed"
          >
            Every plan gets unlimited storage. Upgrading gives you speed, concurrency, and priority.
          </motion.p>
        </motion.div>

        {/* Billing toggle */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...BOUNCE, delay: 0.4 }}
          className="mt-8 mb-6 relative z-10"
        >
          <div className="inline-flex gap-1 lg-subtle rounded-xl p-0.5">
            {BILLING_OPTIONS.map((b) => {
              const isSel = billing === b.value;
              return (
                <button
                  key={b.value}
                  onClick={() => setBilling(b.value)}
                  className={cn(
                    'relative px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 z-10',
                    isSel
                      ? 'bg-white/10 text-white shadow-sm border border-white/10'
                      : 'text-white/40 hover:text-white/70',
                  )}
                >
                  {b.label}
                  {b.badge && billing === 'annual' && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400"
                    >
                      {b.badge}
                    </motion.span>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* ═══ Plan cards ═══ */}
      <section className={cn(
        'relative px-4 pb-12',
        isMobile
          ? 'max-w-sm mx-auto space-y-6'
          : 'max-w-5xl mx-auto grid grid-cols-3 gap-5 items-start',
      )}>
        <AnimatePresence mode="wait">
          {planEntries.map(([_, config]) => (
            <PlanCard
              key={config.id}
              config={config}
              billing={billing}
              userTier={user ? userTier : ''}
              onSelect={handleSelect}
            />
          ))}
        </AnimatePresence>
      </section>

      {/* Trust note */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="text-center text-xs text-white/30 pb-12 -mt-4 relative z-10"
      >
        No hidden fees. Cancel anytime. Powered by MaxelPay.
      </motion.p>

      {/* ═══ Feature comparison table ═══ */}
      <section className="relative px-4 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={BOUNCE}
          className="max-w-4xl mx-auto"
        >
          <div className="text-center mb-8">
            <h2 className="text-lg font-bold text-white">Full feature comparison</h2>
            <p className="text-xs text-white/40 mt-1">Everything at a glance</p>
          </div>

          <ComparisonTable isMobile={isMobile} />

          <p className="text-[10px] text-white/25 text-center mt-4 max-w-lg mx-auto">
            Storage is and always will be unlimited for all tiers. We charge for speed, persistence, and API capacity — not your data.
          </p>
        </motion.div>
      </section>

      {/* ═══ FAQ ═══ */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={BOUNCE}
        className="border-t border-white/[0.06] px-4 py-14"
      >
        <div className="max-w-4xl mx-auto">
          <h2 className="text-lg font-bold text-white text-center mb-8">Frequently asked questions</h2>
          <FAQSection />
        </div>
      </motion.section>

      {/* ═══ MaxelPay trust ═══ */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={BOUNCE}
        className="border-t border-white/[0.06] px-4 py-14 text-center"
      >
        <div className="max-w-lg mx-auto">
          <div className="lg h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4 relative z-10">
            <ShieldCheck className="h-7 w-7 text-emerald-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2 relative z-10">Secure crypto payments</h2>
          <p className="text-xs text-white/45 leading-relaxed relative z-10">
            All payments are processed securely through <strong className="text-white/80">MaxelPay</strong> — a no-KYC cryptocurrency payment gateway.
            Pay with USDT, USDC, ETH, BTC, and more. Your funds are settled instantly on-chain.
            No credit card required. No personal information shared.
          </p>
          <p className="text-[10px] text-white/25 mt-4 relative z-10">
            Powered by MaxelPay &bull; Multi-chain &bull; No KYC &bull; Instant settlement
          </p>
        </div>
      </motion.section>

      {/* ═══ Bottom CTA ═══ */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={BOUNCE}
        className="border-t border-white/[0.06] px-4 py-14 text-center"
      >
        <div className="max-w-md mx-auto">
          <div className="lg-strong rounded-3xl p-10 text-center relative overflow-hidden">
            {/* Internal glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--brand))]/[0.06] via-transparent to-transparent pointer-events-none" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-[hsl(var(--brand))]/[0.1] rounded-full blur-[60px] pointer-events-none glow-pulse" />

            <h2 className="text-xl font-bold text-white mb-2 relative z-10">Still on the fence?</h2>
            <p className="text-sm text-white/45 mb-6 leading-relaxed relative z-10">
              Every tier gets unlimited storage. Upgrade only when you outgrow the free lane — your files never will.
            </p>
            <Button asChild variant="outline" className="rounded-xl h-10 border-white/15 text-white/70 hover:text-white hover:bg-white/[0.06] relative z-10">
              <a href={user ? '/dashboard' : '/auth'}>
                {user ? 'Back to Dashboard' : 'Create Free Account'}
              </a>
            </Button>
          </div>
        </div>
      </motion.section>
    </div>
  );
}

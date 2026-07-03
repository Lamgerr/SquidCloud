import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const monthlyEq = p.annual / 12;
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
    color: 'text-muted-foreground',
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'relative flex flex-col rounded-2xl border transition-all duration-300',
        config.variant === 'supporter-plus' && [
          'border-purple-500/40 shadow-[0_0_50px_-12px_hsl(270,80%,50%/0.25)]',
          'bg-gradient-to-b from-purple-500/5 to-card scale-[1.02] z-10',
        ],
        config.variant === 'supporter' && [
          'border-primary/30 shadow-[0_0_30px_-12px_hsl(var(--primary)/0.15)] bg-card',
        ],
        config.variant === 'free' && [
          'border-border/20 bg-card/50 hover:border-border/40',
        ],
        isCurrentPlan && 'ring-2 ring-primary/40',
      )}
    >
      {/* Best Value badge */}
      {config.variant === 'supporter-plus' && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1 text-xs font-semibold shadow-lg shadow-purple-500/25 border-0">
            <Sparkles className="h-3 w-3 mr-1" /> Best Value
          </Badge>
        </div>
      )}

      <div className="relative p-6 pb-0">
        <div className="flex items-center gap-3 mb-4">
          <div className={cn(
            'h-10 w-10 rounded-xl flex items-center justify-center border',
            config.variant === 'supporter-plus' && 'bg-purple-500/15 border-purple-500/20',
            config.variant === 'supporter' && 'bg-primary/15 border-primary/20',
            config.variant === 'free' && 'bg-muted/20 border-border/20',
          )}>
            <config.icon className={cn('h-5 w-5', config.color)} />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">{config.name}</h3>
            <p className="text-[11px] text-muted-foreground">{config.tagline}</p>
          </div>
        </div>

        {/* Price */}
        <div className="mb-1">
          <div className="flex items-baseline gap-1.5">
            <span className={cn(
              'text-3xl font-bold tracking-tight',
              config.variant === 'supporter-plus' ? 'text-purple-300' : 'text-foreground',
            )}>
              {price.main}
            </span>
            <span className="text-sm text-muted-foreground">{price.sub}</span>
            {isAnnual && price.original && (
              <span className="text-xs text-muted-foreground/50 line-through ml-1">{price.original}</span>
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
          <div className="flex gap-1 mt-4 bg-muted/20 rounded-xl p-0.5 border border-border/10">
            {BILLING_OPTIONS.map((b) => {
              const isSel = billing === b.value;
              return (
                <button
                  key={b.value}
                  onClick={() => onSelect(config.id, b.value)}
                  className={cn(
                    'flex-1 text-[10px] font-semibold py-1.5 rounded-lg transition-all duration-200',
                    isSel
                      ? 'bg-background text-foreground shadow-sm border border-border/20'
                      : 'text-muted-foreground/60 hover:text-foreground/80',
                  )}
                >
                  {b.label}
                  {b.badge && isAnnual && (
                    <span className="block text-[8px] font-bold text-emerald-500">{b.badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* CTA */}
        <Button
          variant={isCurrentPlan ? 'outline' : config.variant === 'supporter-plus' ? 'default' : config.variant === 'supporter' ? 'default' : 'outline'}
          className={cn(
            'w-full mt-4 rounded-xl h-10 text-sm font-semibold transition-all',
            isCurrentPlan && 'opacity-60 cursor-default',
            !isCurrentPlan && config.variant === 'supporter-plus' && [
              'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-500/90 hover:to-pink-500/90',
              'shadow-lg shadow-purple-500/25 text-white border-0',
            ],
            !isCurrentPlan && config.variant === 'supporter' && [
              'bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90',
              'shadow-md shadow-primary/20',
            ],
          )}
          disabled={isCurrentPlan}
          onClick={() => !isCurrentPlan && onSelect(config.id, billing)}
        >
          {isCurrentPlan ? 'Current Plan' : config.id === 'free' ? 'Get Started' : config.id === 'supporter' ? 'Go Supporter' : 'Go Unlimited'}
        </Button>

        {/* Description line */}
        {config.description && (
          <p className="text-[11px] text-muted-foreground/60 text-center mt-2">{config.description}</p>
        )}
      </div>

      {/* Feature highlights */}
      <div className="relative p-6 pt-5 flex-1 flex flex-col">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {config.variant === 'free' ? 'What you get' : 'Everything in Free, plus'}
        </p>
        <ul className="space-y-2.5 flex-1">
          {config.features.map((f, i) => (
            <motion.li
              key={f.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + i * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-start gap-2.5"
            >
              <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <span className="text-xs leading-snug text-foreground/80">
                <span className="font-semibold text-foreground">{config.variant === 'free' ? f.free : f.paid}</span>
                {' '}{f.label}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

function ComparisonTable({ isMobile }: { isMobile: boolean }) {
  const table = (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border/20 bg-muted/10">
          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Feature</th>
          <th className="px-4 py-3 text-xs font-semibold text-center text-muted-foreground/60">Free</th>
          <th className="px-4 py-3 text-xs font-semibold text-center text-primary">Supporter</th>
          <th className="px-4 py-3 text-xs font-semibold text-center text-purple-400">Supporter+</th>
        </tr>
      </thead>
      <tbody>
        {COMPARISON_ROWS.map((row, i) => (
          <tr key={row.feature} className={cn(
            'border-b border-border/10',
            i % 2 === 0 ? 'bg-background' : 'bg-muted/5',
          )}>
            <td className="px-4 py-2.5 text-xs font-medium text-foreground whitespace-nowrap">{row.feature}</td>
            <td className={cn(
              'px-4 py-2.5 text-xs text-center',
              row.noDiff ? 'text-foreground/80 font-medium' : 'text-muted-foreground/50',
            )}>
              {row.free}
            </td>
            <td className="px-4 py-2.5 text-xs text-center font-medium text-primary">{row.supp}</td>
            <td className="px-4 py-2.5 text-xs text-center font-medium text-purple-400">{row.suppPlus}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  if (isMobile) {
    return (
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="min-w-[500px] rounded-2xl border border-border/20 overflow-hidden">
          {table}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/20 overflow-hidden">
      {table}
    </div>
  );
}

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="max-w-2xl mx-auto space-y-2">
      {FAQS.map((faq, i) => (
        <div key={i} className="rounded-xl border border-border/20 bg-card/50 overflow-hidden">
          <button
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-accent/30 transition-colors"
          >
            {faq.q}
            <motion.span
              animate={{ rotate: openIndex === i ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-muted-foreground shrink-0 ml-2"
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
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <p className="px-4 pb-3 text-xs text-muted-foreground leading-relaxed">{faq.a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

export default function PricingPage() {
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [billing, setBilling] = useState<Billing>('monthly');
  const userTier = profile?.is_premium ? (profile?.tier || 'supporter') : 'free';

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
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-[400px] h-[400px] rounded-full bg-purple-500/5 blur-[100px]" />
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-16 pb-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative max-w-2xl mx-auto"
        >
          <h1 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight mb-4 leading-tight">
            Unlimited storage.{' '}
            <span className="bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Your speed, your call.
            </span>
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Every plan gets unlimited storage. Upgrading gives you speed, concurrency, and priority.
          </p>
        </motion.div>

        {/* Billing toggle */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 mb-6"
        >
          <div className="inline-flex gap-1 bg-muted/20 rounded-xl p-0.5 border border-border/10 shadow-sm">
            {BILLING_OPTIONS.map((b) => {
              const isSel = billing === b.value;
              return (
                <button
                  key={b.value}
                  onClick={() => setBilling(b.value)}
                  className={cn(
                    'relative px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200',
                    isSel
                      ? 'bg-background text-foreground shadow-sm border border-border/20'
                      : 'text-muted-foreground/60 hover:text-foreground/80',
                  )}
                >
                  {b.label}
                  {b.badge && billing === 'annual' && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500"
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

      {/* Plan cards */}
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
        transition={{ delay: 0.5, duration: 0.4 }}
        className="text-center text-xs text-muted-foreground/60 pb-12 -mt-4"
      >
        No hidden fees. Cancel anytime. Powered by MaxelPay.
      </motion.p>

      {/* Feature comparison table */}
      <section className="relative px-4 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl mx-auto"
        >
          <div className="text-center mb-8">
            <h2 className="text-lg font-bold text-foreground">Full feature comparison</h2>
            <p className="text-xs text-muted-foreground mt-1">Everything at a glance</p>
          </div>

          <ComparisonTable isMobile={isMobile} />

          <p className="text-[10px] text-muted-foreground/50 text-center mt-4 max-w-lg mx-auto">
            Storage is and always will be unlimited for all tiers. We charge for speed, persistence, and API capacity — not your data.
          </p>
        </motion.div>
      </section>

      {/* FAQ */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="border-t border-border/10 px-4 py-14"
      >
        <div className="max-w-4xl mx-auto">
          <h2 className="text-lg font-bold text-foreground text-center mb-8">Frequently asked questions</h2>
          <FAQSection />
        </div>
      </motion.section>

      {/* MaxelPay trust */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="border-t border-border/10 px-4 py-14 text-center bg-gradient-to-b from-transparent to-primary/[0.02]"
      >
        <div className="max-w-lg mx-auto">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="h-7 w-7 text-emerald-500" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">Secure crypto payments</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            All payments are processed securely through <strong className="text-foreground">MaxelPay</strong> — a no-KYC cryptocurrency payment gateway.
            Pay with USDT, USDC, ETH, BTC, and more. Your funds are settled instantly on-chain.
            No credit card required. No personal information shared.
          </p>
          <p className="text-[10px] text-muted-foreground/50 mt-4">
            Powered by MaxelPay &bull; Multi-chain &bull; No KYC &bull; Instant settlement
          </p>
        </div>
      </motion.section>

      {/* Bottom CTA */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="border-t border-border/10 px-4 py-14 text-center"
      >
        <div className="max-w-md mx-auto">
          <h2 className="text-xl font-bold text-foreground mb-2">Still on the fence?</h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Every tier gets unlimited storage. Upgrade only when you outgrow the free lane — your files never will.
          </p>
          <Button asChild variant="outline" className="rounded-xl h-10">
            <a href={user ? '/dashboard' : '/auth'}>
              {user ? 'Back to Dashboard' : 'Create Free Account'}
            </a>
          </Button>
        </div>
      </motion.section>
    </div>
  );
}

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Check,
  ShieldCheck,
  Zap,
  ChevronDown,
  Crown,
  Sparkles,
  Server
} from 'lucide-react';
import SquidLogo from '@/components/ui/SquidLogo';
import Footer from '@/components/custom/Footer';

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
  { q: 'Can I switch plans?', a: 'Yes, anytime. Upgrade or downgrade between Free, Supporter, and Supporter+. When upgrading you get immediate access to the new limits. When downgrading, changes apply at the end of your current billing period. No lock-in, no penalties.' },
  { q: 'How does billing work with weekly/monthly/annual?', a: 'You pick the cadence that works for you. Weekly bills every 7 days at the weekly rate (~18% less than monthly). Monthly bills every 30 days. Annual bills once per year and gives you the best value — 4 months effectively free compared to monthly. All payments are processed through MaxelPay with cryptocurrency.' },
];

const COMPARISON_ROWS = [
  { feature: 'Storage', free: 'Unlimited', supp: 'Unlimited', suppPlus: 'Unlimited' },
  { feature: 'Concurrent uploads', free: '2', supp: '10', suppPlus: 'Unlimited' },
  { feature: 'Concurrent downloads', free: '2', supp: '10', suppPlus: 'Unlimited' },
  { feature: 'Max upload file size', free: '1 GB', supp: '25 GB', suppPlus: 'Unlimited' },
  { feature: 'API tokens per day', free: '1,000', supp: '10,000', suppPlus: 'Unlimited' },
  { feature: 'Published sites', free: 'Auto-archive 50 days', supp: 'Always active', suppPlus: 'Always active' },
  { feature: 'Processing queue', free: 'Standard', supp: 'Priority', suppPlus: 'Top priority' },
  { feature: 'Custom domains / subdomain', free: 'SquidCloud only', supp: 'Included', suppPlus: 'Included' },
  { feature: 'Early feature access', free: '—', supp: 'Before public', suppPlus: 'Before Supporter' },
];

export default function PricingPage() {
  const { user, profile } = useAuth();
  const userTier = (profile?.tier as string) ?? 'free';
  const navigate = useNavigate();

  const [billing, setBilling] = useState<Billing>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Animations matching the floating index page feel
  const floatAnimation = {
    animate: { y: [0, -10, 0], transition: { duration: 5, repeat: Infinity, ease: "easeInOut" } }
  };
  const floatAnimationReverse = {
    animate: { y: [0, 10, 0], transition: { duration: 6, repeat: Infinity, ease: "easeInOut" } }
  };

  const handleSelect = (planId: string) => {
    if (planId === 'free') {
      navigate('/auth');
      return;
    }
    navigate(`/checkout?plan=${planId}&billing=${billing}`);
  };

  const PlanButton = ({
    planId,
    label,
    className,
  }: {
    planId: string;
    label: string;
    className: string;
  }) => {
    const isCurrent = userTier === planId;
    return (
      <button
        onClick={() => !isCurrent && handleSelect(planId)}
        disabled={isCurrent}
        className={`${className} ${isCurrent ? 'cursor-default opacity-60' : ''}`}
      >
        {isCurrent ? 'Current Plan' : label}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-zinc-300 font-sans selection:bg-zinc-800 selection:text-white overflow-hidden relative">
      
      {/* ═══ MINIMALIST NAVIGATION (Monochrome) ═══ */}
      <nav className="relative z-50 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 md:px-12">
        <Link to="/" className="flex items-center gap-3 text-xl font-bold tracking-tight text-white">
          <SquidLogo size={28} />
          SquidCloud
        </Link>

        <div className="hidden items-center gap-10 text-sm font-medium text-zinc-500 md:flex">
          <a href="#features" className="transition-colors hover:text-white">Features</a>
          <a href="#compare" className="transition-colors hover:text-white">Compare</a>
          <a href="#faq" className="transition-colors hover:text-white">FAQ</a>
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

      <main>
        {/* ═══ HERO & FLOATING WIDGETS ═══ */}
        <section className="relative pt-20 pb-32 px-6">
          
          {/* Subtle Monochromatic Grid Background */}
          <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:24px_24px] opacity-30 pointer-events-none" />

          {/* Floating UI Elements (Monochrome) */}
          <div className="absolute inset-0 pointer-events-none z-10 max-w-7xl mx-auto hidden md:block">
            {/* Top Left Widget */}
            <motion.div {...floatAnimation} className="absolute top-[10%] left-[10%] bg-[#121212] p-4 rounded-3xl border border-zinc-800 shadow-2xl flex flex-col gap-3 w-48 rotate-[-4deg]">
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider pl-1">API Status</div>
              <div className="flex items-center gap-3 bg-[#1A1A1A] p-2 rounded-2xl">
                <div className="bg-white h-6 w-6 rounded-lg flex items-center justify-center text-black"><Check size={12} strokeWidth={3} /></div>
                <div className="text-xs font-medium text-white">Unlimited</div>
              </div>
            </motion.div>

            {/* Top Right Widget */}
            <motion.div {...floatAnimationReverse} className="absolute top-[15%] right-[12%] bg-[#121212] p-5 rounded-3xl border border-zinc-800 shadow-2xl flex flex-col gap-4 rotate-[3deg]">
              <div className="h-10 w-10 rounded-2xl bg-zinc-800 flex items-center justify-center text-white mb-2"><Server size={20} /></div>
              <div className="text-sm font-bold text-white">Priority Queue</div>
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full w-full bg-white rounded-full"></div>
              </div>
            </motion.div>
          </div>

          <div className="relative z-20 text-center max-w-4xl mx-auto mt-12">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }}>
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-[1.1]">
                Unlimited storage. <br className="hidden md:block" />
                <span className="text-zinc-500 font-medium">Your speed, your call.</span>
              </h1>
              <p className="mt-6 text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                Every plan gets unlimited storage. Upgrading gives you speed, concurrency, and priority access to the global edge.
              </p>
            </motion.div>

            {/* Monochromatic Billing Toggle */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="mt-12 flex justify-center">
              <div className="inline-flex gap-2 p-1.5 rounded-2xl bg-[#121212] border border-zinc-800 shadow-xl">
                {BILLING_OPTIONS.map((b) => (
                  <button
                    key={b.value}
                    onClick={() => setBilling(b.value)}
                    className={`relative px-6 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                      billing === b.value 
                        ? 'bg-white text-black shadow-sm' 
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`}
                  >
                    {b.label}
                    {b.badge && billing === 'annual' && (
                      <span className="absolute -top-3 -right-3 text-[9px] font-bold px-2 py-1 rounded-full bg-black text-white border border-zinc-700 shadow-sm">
                        {b.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ═══ PRICING CARDS (Bento Style) ═══ */}
        <section className="relative z-20 px-6 max-w-7xl mx-auto pb-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* FREE PLAN */}
            <div className="bg-[#121212] rounded-[2.5rem] p-10 border border-zinc-800/60 flex flex-col">
              <div className="h-12 w-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-6">
                <Zap size={24} />
              </div>
              <h3 className="text-2xl font-bold text-white">Free</h3>
              <p className="text-sm text-zinc-500 mb-6">Unlimited storage, always</p>
              <div className="mb-8">
                <span className="text-4xl font-bold text-white">Free</span>
              </div>
              <PlanButton
                planId="free"
                label="Get Started"
                className="w-full py-3.5 rounded-full bg-zinc-900 border border-zinc-800 text-sm font-semibold text-white hover:bg-zinc-800 transition-all mb-8"
              />
              <ul className="space-y-4 flex-1">
                {[
                  { label: 'Concurrent uploads', val: '2' },
                  { label: 'Concurrent downloads', val: '2' },
                  { label: 'Max upload file size', val: '1 GB' },
                  { label: 'API tokens per day', val: '1,000' },
                ].map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-zinc-400">
                    <Check size={18} className="text-zinc-600 shrink-0" />
                    <span><strong className="text-white font-semibold">{f.val}</strong> {f.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* SUPPORTER PLAN */}
            <div className="bg-[#121212] rounded-[2.5rem] p-10 border border-zinc-800 flex flex-col relative">
              <div className="h-12 w-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white mb-6">
                <Crown size={24} />
              </div>
              <h3 className="text-2xl font-bold text-white">Supporter</h3>
              <p className="text-sm text-zinc-500 mb-6">For serious creators</p>
              <div className="mb-8 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">
                  {billing === 'weekly' ? PLAN_PRICES.supporter.weekly.display : billing === 'monthly' ? '$4' : '$32'}
                </span>
                <span className="text-zinc-500 text-sm">/{billing === 'annual' ? 'year' : billing === 'weekly' ? 'week' : 'month'}</span>
              </div>
              <PlanButton
                planId="supporter"
                label="Go Supporter"
                className="w-full py-3.5 rounded-full bg-zinc-800 border border-zinc-700 text-sm font-semibold text-white hover:bg-zinc-700 transition-all mb-8"
              />
              <ul className="space-y-4 flex-1">
                {[
                  { label: 'Concurrent uploads', val: '10' },
                  { label: 'Concurrent downloads', val: '10' },
                  { label: 'Max upload file size', val: '25 GB' },
                  { label: 'API tokens per day', val: '10,000' },
                ].map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-zinc-400">
                    <Check size={18} className="text-zinc-500 shrink-0" />
                    <span><strong className="text-white font-semibold">{f.val}</strong> {f.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* SUPPORTER+ PLAN (Highlighted in Monochrome) */}
            <div className="bg-white rounded-[2.5rem] p-10 shadow-[0_20px_50px_-20px_rgba(255,255,255,0.1)] flex flex-col relative scale-[1.02] z-10 text-black">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-black text-white px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg shadow-black/20">
                  <Sparkles size={12} /> Best Value
                </span>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-black mb-6">
                <Sparkles size={24} />
              </div>
              <h3 className="text-2xl font-bold text-black">Supporter+</h3>
              <p className="text-sm text-zinc-500 mb-6">For power users & teams</p>
              <div className="mb-8 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-black">
                  {billing === 'weekly' ? PLAN_PRICES['supporter-plus'].weekly.display : billing === 'monthly' ? '$10' : '$80'}
                </span>
                <span className="text-zinc-500 text-sm">/{billing === 'annual' ? 'year' : billing === 'weekly' ? 'week' : 'month'}</span>
              </div>
              <PlanButton
                planId="supporter-plus"
                label="Go Unlimited"
                className="w-full py-3.5 rounded-full bg-black text-sm font-semibold text-white hover:bg-zinc-800 transition-all mb-8 shadow-xl shadow-black/10 hover:-translate-y-0.5"
              />
              <ul className="space-y-4 flex-1">
                {[
                  { label: 'Concurrent uploads', val: 'Unlimited' },
                  { label: 'Concurrent downloads', val: 'Unlimited' },
                  { label: 'Max upload file size', val: 'Unlimited' },
                  { label: 'API tokens per day', val: 'Unlimited' },
                ].map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-zinc-600">
                    <Check size={18} className="text-black shrink-0" />
                    <span><strong className="text-black font-semibold">{f.val}</strong> {f.label}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </section>

        {/* ═══ COMPARISON TABLE (Bento Style Container) ═══ */}
        <section id="compare" className="px-6 max-w-5xl mx-auto pb-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white tracking-tight">Full feature comparison</h2>
            <p className="text-zinc-500 mt-2">Everything at a glance</p>
          </div>
          
          <div className="bg-[#121212] rounded-[2.5rem] border border-zinc-800/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-900/50 text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="px-8 py-5 font-semibold">Feature</th>
                    <th className="px-6 py-5 font-semibold text-center">Free</th>
                    <th className="px-6 py-5 font-semibold text-center text-zinc-200">Supporter</th>
                    <th className="px-6 py-5 font-semibold text-center text-white">Supporter+</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {COMPARISON_ROWS.map((row, i) => (
                    <tr key={i} className="hover:bg-zinc-900/20 transition-colors">
                      <td className="px-8 py-4 text-zinc-300 font-medium whitespace-nowrap">{row.feature}</td>
                      <td className="px-6 py-4 text-center text-zinc-500">{row.free}</td>
                      <td className="px-6 py-4 text-center text-zinc-300 font-medium">{row.supp}</td>
                      <td className="px-6 py-4 text-center text-white font-bold">{row.suppPlus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ═══ FAQS (Bento Style Accordions) ═══ */}
        <section id="faq" className="px-6 max-w-3xl mx-auto pb-32">
          <h2 className="text-3xl font-bold text-white text-center mb-12 tracking-tight">Frequently asked questions</h2>
          <div className="space-y-4">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-[#121212] rounded-3xl border border-zinc-800/60 overflow-hidden transition-colors hover:border-zinc-700">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-8 py-6 text-left text-base font-semibold text-zinc-200"
                >
                  {faq.q}
                  <ChevronDown size={20} className={`text-zinc-500 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <p className="px-8 pb-6 text-zinc-400 leading-relaxed text-sm">
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ TRUST & FOOTER CTA (Monochrome) ═══ */}
        <section className="px-6 max-w-4xl mx-auto pb-32 text-center">
          <div className="bg-[#121212] rounded-[3rem] p-12 md:p-16 border border-zinc-800 flex flex-col items-center relative overflow-hidden">
             {/* Monochromatic glow behind the shield */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-white/5 rounded-full blur-[80px] pointer-events-none" />
            
            <div className="h-16 w-16 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white mb-8 relative z-10">
              <ShieldCheck size={32} />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4 relative z-10">Secure crypto payments</h2>
            <p className="text-zinc-400 leading-relaxed max-w-xl mx-auto mb-8 relative z-10">
              All payments are processed securely through <strong className="text-white">MaxelPay</strong> — a no-KYC cryptocurrency payment gateway. 
              Pay with USDT, USDC, ETH, BTC, and more. Your funds are settled instantly on-chain. No credit card required.
            </p>
            <Link to="/auth?tab=signup" className="px-8 py-4 rounded-full bg-white text-black font-semibold hover:bg-zinc-200 transition-all shadow-lg hover:scale-105 active:scale-95 relative z-10">
              Create Free Account
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

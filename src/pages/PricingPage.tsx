import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BillingToggle,
  Closing,
  Field,
  Nav,
  PlanCards,
  Shell,
  ease,
} from '@/components/custom/squid-ui';
import type { Billing, NavLinkItem } from '@/components/custom/squid-ui';

/* ═══════════════════════════════════════════════════════════════
   PRICING — same system as the homepage (squid-ui.tsx).
   Plans, prices, limits, FAQ and payment copy are unchanged.
   ═══════════════════════════════════════════════════════════════ */

const NAV: NavLinkItem[] = [
  { label: 'Plans', href: '#plans' },
  { label: 'Compare', href: '#compare' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Docs', to: '/docs' },
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

const PAGE_CSS = `
.plans-sec { max-width: 1480px; margin: 0 auto; padding: 0 var(--gutter) 160px; }
.sec.tight { padding-top: 80px; }
.sec.rule { border-top: 1px solid var(--line); max-width: none; padding: 0; }
.rule-in { max-width: 1480px; margin: 0 auto; padding: 0 var(--gutter); }
.hero-note { font: 400 11px/1.4 var(--f-mono); letter-spacing: 0.06em; color: var(--mute); }

/* ── Comparison ── */
.cmp-wrap { overflow-x: auto; border: 1px solid var(--line-2); border-radius: 6px; background: var(--ink-2); }
.cmp { width: 100%; min-width: 680px; border-collapse: separate; border-spacing: 0; text-align: left; }
.cmp th, .cmp td { padding: 20px 26px; border-bottom: 1px solid var(--line); font: 400 0.95rem/1.3 var(--f-display); }
.cmp thead th { font: 400 11px/1 var(--f-mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--mute); }
.cmp tbody tr:last-child td { border-bottom: 0; }
.cmp th:first-child, .cmp td:first-child { position: sticky; left: 0; z-index: 1; background: var(--ink-2); color: var(--bone); font-weight: 500; white-space: nowrap; }
.cmp th:not(:first-child), .cmp td:not(:first-child) { text-align: center; }
.cmp td { color: var(--mute); transition: background 0.25s; }
.cmp td.mid { color: var(--bone); }
.cmp .feat { background: rgba(232, 231, 225, 0.05); color: var(--bone); }
.cmp thead th.feat { color: var(--bone); }
.cmp tbody tr:hover td { background: rgba(232, 231, 225, 0.03); }
.cmp tbody tr:hover td.feat { background: rgba(232, 231, 225, 0.07); }

/* ── FAQ ── */
.faq-grid { display: grid; grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: 100px; align-items: start; }
.faq-head { position: sticky; top: 110px; display: flex; flex-direction: column; gap: 22px; }
.faq { border-top: 1px solid var(--line); }
.faq:last-child { border-bottom: 1px solid var(--line); }
.faq button { all: unset; box-sizing: border-box; display: flex; justify-content: space-between; align-items: center; gap: 24px; width: 100%; padding: 24px 0; cursor: pointer; color: var(--mute); font: 400 1.3rem/1.3 var(--f-display); letter-spacing: -0.015em; transition: color 0.3s; }
.faq button:hover, .faq.open button { color: var(--bone); }
.faq button:focus-visible { outline: 1px solid var(--bone); outline-offset: 2px; }
.plus { position: relative; flex: none; width: 14px; height: 14px; }
.plus::before, .plus::after { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: currentColor; transition: transform 0.5s var(--ease); }
.plus::after { transform: rotate(90deg); }
.faq.open .plus::after { transform: rotate(0deg); }
.faq-a { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.55s var(--ease); }
.faq.open .faq-a { grid-template-rows: 1fr; }
.faq-a > div { overflow: hidden; min-height: 0; }
.faq-a p { margin: 0; max-width: 38em; padding: 0 40px 26px 0; color: var(--mute); font: 400 0.98rem/1.7 var(--f-display); text-wrap: pretty; }

/* ── Payments ── */
.pay { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); border: 1px solid var(--line-2); border-radius: 6px; overflow: hidden; }
.pay > div { padding: 56px; min-width: 0; }
.pay > div + div { display: flex; flex-direction: column; justify-content: space-between; gap: 36px; border-left: 1px solid var(--line-2); background: var(--ink-2); }
.pay h2 { margin: 0 0 22px; font: 300 2.8rem/1.06 var(--f-display); letter-spacing: -0.035em; text-wrap: balance; }
.pay p { margin: 0; max-width: 32em; color: var(--mute); font: 400 1rem/1.7 var(--f-display); }
.pay p b { font-weight: 500; color: var(--bone); }
.pay-k { font: 400 11px/1 var(--f-mono); letter-spacing: 0.18em; text-transform: uppercase; color: var(--mute); }
.coins { display: flex; flex-wrap: wrap; gap: 8px; }
.coin { padding: 12px 16px; border: 1px solid var(--line-2); border-radius: 3px; font: 400 12px/1 var(--f-mono); letter-spacing: 0.1em; }
.pay-n { font: 400 12px/1.5 var(--f-mono); letter-spacing: 0.04em; color: var(--dim); }

@media (max-width: 900px) {
  .faq-grid, .pay { grid-template-columns: minmax(0, 1fr); }
  .faq-head { position: static; }
  .pay > div + div { border-left: 0; border-top: 1px solid var(--line-2); }
  .cmp th, .cmp td { padding: 16px 18px; }
}
/* Small screens get one fixed smaller step — still no fluid scaling. */
@media (max-width: 720px) {
  .faq-grid { gap: 24px; }
  .faq button { font-size: 1.05rem; }
  .pay > div { padding: 28px; }
  .pay h2 { font-size: 1.8rem; }
  .plans-sec { padding-bottom: 80px; }
}
`;

function Hero({ billing, onBilling }: { billing: Billing; onBilling: (b: Billing) => void }) {
  const reduce = !!useReducedMotion();
  const line = (i: number) =>
    ({
      initial: reduce ? false : { y: '110%' },
      animate: { y: 0 },
      transition: { duration: 1.1, ease, delay: 0.15 + i * 0.12 },
    } as const);
  const fade = (d: number) =>
    ({
      initial: reduce ? false : { opacity: 0, y: 12 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.9, ease, delay: d },
    } as const);

  return (
    <section className="hero compact">
      <motion.div
        className="hero-field"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, ease: 'easeOut' }}
      >
        <Field reduce={reduce} />
      </motion.div>
      <div className="hero-shade" />
      <div className="hero-core">
        <motion.span className="eyebrow" {...fade(0.05)}>Pricing</motion.span>
        <h1 className="hero-h">
          <span className="ln"><motion.span {...line(0)}>Unlimited storage.</motion.span></span>
          <span className="ln"><motion.span {...line(1)}>Your speed, your call.</motion.span></span>
        </h1>
        <motion.p className="hero-sub" {...fade(0.55)}>
          Every plan gets unlimited storage. Upgrading buys speed, concurrency, and priority access to the global edge.
        </motion.p>
        <motion.div {...fade(0.7)} style={{ marginTop: 6 }}>
          <BillingToggle billing={billing} onChange={onBilling} />
        </motion.div>
        <motion.p className="hero-note" {...fade(0.8)}>
          crypto via MaxelPay · no card required · cancel anytime
        </motion.p>
      </div>
    </section>
  );
}

function Compare() {
  return (
    <section className="sec" id="compare">
      <div className="sec-h">
        <h2 className="h2">Every limit, on one table.</h2>
        <p className="lede">Storage is never the limit. Speed, concurrency and priority are.</p>
      </div>
      <div className="cmp-wrap">
        <table className="cmp">
          <thead>
            <tr>
              <th scope="col">Feature</th>
              <th scope="col">Free</th>
              <th scope="col">Supporter</th>
              <th scope="col" className="feat">Supporter+</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row) => (
              <tr key={row.feature}>
                <td>{row.feature}</td>
                <td>{row.free}</td>
                <td className="mid">{row.supp}</td>
                <td className="feat">{row.suppPlus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="sec rule" id="faq">
      <div className="rule-in" style={{ paddingTop: '180px', paddingBottom: '180px' }}>
        <div className="faq-grid">
          <div className="faq-head">
            <h2 className="h2">Asked, answered.</h2>
            <p className="lede">The limits and billing details people ask about most.</p>
          </div>
          <div>
            {FAQS.map((f, i) => (
              <div className={`faq${open === i ? ' open' : ''}`} key={f.q}>
                <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                  <span>{f.q}</span>
                  <span className="plus" aria-hidden="true" />
                </button>
                <div className="faq-a">
                  <div>
                    <p>{f.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Payments() {
  return (
    <section className="sec tight">
      <div className="pay">
        <div>
          <h2>Secure crypto payments.</h2>
          <p>
            All payments are processed securely through <b>MaxelPay</b> — a no-KYC cryptocurrency payment gateway. Pay with USDT, USDC, ETH, BTC, and more. Settled instantly on-chain. No credit card required.
          </p>
        </div>
        <div>
          <span className="pay-k">Accepted</span>
          <div className="coins">
            {['USDT', 'USDC', 'ETH', 'BTC'].map((c) => (
              <span className="coin" key={c}>{c}</span>
            ))}
          </div>
          <span className="pay-n">and more · settled on-chain</span>
        </div>
      </div>
    </section>
  );
}

export default function PricingPage() {
  const [billing, setBilling] = useState<Billing>('monthly');
  return (
    <Shell css={PAGE_CSS}>
      <Nav links={NAV} />
      <main>
        <Hero billing={billing} onBilling={setBilling} />
        <section className="plans-sec" id="plans">
          <PlanCards billing={billing} />
        </section>
        <Compare />
        <Faq />
        <Payments />
        <Closing
          title="Start free. Upgrade for speed."
          body="Every plan has unlimited storage. Switch plans anytime, with no lock-in and no penalties."
        />
      </main>
    </Shell>
  );
}

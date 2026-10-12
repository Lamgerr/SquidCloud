import React, { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import {
  Arrow,
  BillingToggle,
  Closing,
  Field,
  Nav,
  PlanCards,
  Shell,
  Wordmark,
  ease,
} from '@/components/custom/squid-ui';
import type { Billing, NavLinkItem } from '@/components/custom/squid-ui';

/* ═══════════════════════════════════════════════════════════════
   SQUIDCLOUD HOMEPAGE
   Hero  ·  statement  ·  trust boundary  ·  stacked capabilities
   ·  pricing  ·  closing. Shared pieces live in squid-ui.tsx.
   ═══════════════════════════════════════════════════════════════ */

const NAV: NavLinkItem[] = [
  { label: 'Features', href: '#features' },
  { label: 'Security', href: '#security' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Docs', to: '/help/docs' },
];

const PAGE_CSS = `
/* ── Statement ── */
.statement { max-width: 1480px; margin: 0 auto; padding: 240px var(--gutter); }
.statement p { margin: 0; max-width: 21em; font: 300 3.8rem/1.14 var(--f-display); letter-spacing: -0.03em; }

/* ── Trust boundary ── */
.bound { display: grid; grid-template-columns: minmax(0, 1fr) minmax(150px, 0.5fr) minmax(0, 1fr); border: 1px solid var(--line-2); border-radius: 6px; overflow: hidden; background: var(--ink-2); }
.side { display: flex; flex-direction: column; gap: 28px; min-width: 0; padding: 44px; }
.side.far { background: var(--ink); }
.side-k { font: 400 11px/1 var(--f-mono); letter-spacing: 0.18em; text-transform: uppercase; color: var(--mute); }
.side ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.side li { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 18px 0; border-top: 1px solid var(--line); font: 300 1.9rem/1.1 var(--f-display); letter-spacing: -0.03em; }
.side li span { min-width: 0; text-align: right; overflow-wrap: anywhere; font: 400 12px/1.3 var(--f-mono); letter-spacing: 0.06em; color: var(--mute); }
.side li span.nz { color: var(--dim); }
.xing { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 24px 12px; border-left: 1px dashed var(--line-2); border-right: 1px dashed var(--line-2); }
.xline { position: relative; width: 100%; height: 1px; background: var(--line-2); }
.xline i { position: absolute; inset: 0; background: var(--bone); transform-origin: left; }
.xline.v { display: none; }
.xchip { padding: 8px 10px; border: 1px solid var(--line-2); border-radius: 3px; background: var(--ink-2); font: 400 11px/1 var(--f-mono); letter-spacing: 0.12em; white-space: nowrap; }
.xcap { max-width: 12em; text-align: center; color: var(--mute); font: 400 12.5px/1.45 var(--f-display); }
.facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; margin-top: 72px; border: 1px solid var(--line); background: var(--line); }
.fact { display: flex; flex-direction: column; gap: 60px; min-width: 0; padding: 34px; background: var(--ink); }
.fact .k { font: 400 11px/1 var(--f-mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--mute); }
.fact .v { font: 300 2.1rem/1.1 var(--f-display); letter-spacing: -0.03em; }

/* ── Capabilities (stacking panels) ── */
.stack { display: flex; flex-direction: column; }
.panel { position: sticky; top: calc(84px + var(--k, 0) * 20px); display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); min-height: min(74vh, 620px); margin-bottom: 110px; border: 1px solid var(--line-2); border-radius: 6px; background: var(--ink-2); overflow: hidden; box-shadow: 0 -30px 60px -20px rgba(0, 0, 0, 0.6); }
.panel:last-child { margin-bottom: 0; }
.panel-l { display: flex; flex-direction: column; justify-content: space-between; gap: 32px; min-width: 0; padding: 64px; }
.panel-k { font: 400 11px/1 var(--f-mono); letter-spacing: 0.18em; text-transform: uppercase; color: var(--mute); }
.panel h3 { margin: 0; max-width: 11em; font: 300 3.5rem/1.04 var(--f-display); letter-spacing: -0.04em; text-wrap: balance; }
.panel p { margin: 18px 0 0; max-width: 30em; color: var(--mute); font: 400 1rem/1.7 var(--f-display); text-wrap: pretty; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; margin: 0; padding: 0; }
.chips li { padding: 9px 12px; border: 1px solid var(--line-2); border-radius: 3px; font: 400 11px/1 var(--f-mono); letter-spacing: 0.1em; text-transform: uppercase; }
.panel-r { position: relative; display: grid; place-items: center; overflow: hidden; border-left: 1px solid var(--line); background: radial-gradient(80% 70% at 50% 45%, rgba(232, 231, 225, 0.06), transparent 70%), var(--ink); }
.panel-r::before { content: ''; position: absolute; inset: 0; background-image: radial-gradient(rgba(232, 231, 225, 0.14) 1px, transparent 1px); background-size: 22px 22px; -webkit-mask-image: radial-gradient(70% 70% at 50% 50%, #000, transparent); mask-image: radial-gradient(70% 70% at 50% 50%, #000, transparent); }
.art { position: relative; width: min(100%, 520px); padding: 40px; }
.art svg { display: block; width: 100%; height: auto; overflow: visible; }
.a-s { fill: none; stroke: var(--line-2); stroke-width: 1; vector-effect: non-scaling-stroke; }
.a-on { fill: rgba(232, 231, 225, 0.06); stroke: var(--bone); }
.a-f { fill: var(--dim); stroke: none; }
.a-b { fill: var(--bone); stroke: none; }
.a-k { fill: none; stroke: var(--bone); stroke-width: 10; stroke-linecap: square; stroke-linejoin: miter; vector-effect: non-scaling-stroke; }
.a-t { font: 400 11px var(--f-mono); fill: var(--bone); letter-spacing: 0.06em; }
.a-t.d { fill: var(--dim); }
.ring { fill: none; stroke: var(--line-2); stroke-width: 1; vector-effect: non-scaling-stroke; transform-box: view-box; transform-origin: 240px 180px; animation: spin linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.cur { animation: cursor 1.1s steps(1) infinite; }
@keyframes cursor { 50% { opacity: 0; } }

/* ── Pricing block ── */
.pr-side { display: flex; flex-direction: column; align-items: flex-start; gap: 24px; }
.pr-foot { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 20px; margin-top: 48px; }
.pr-foot span { font: 400 11px/1.4 var(--f-mono); letter-spacing: 0.06em; color: var(--dim); }
/* ── Also-inside strip: dense, concrete, no artwork ── */
.more { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; border: 1px solid var(--line); background: var(--line); }
.more > div { background: var(--ink); padding: 18px 20px; min-width: 0; }
.more b { display: block; font-size: 14px; font-weight: 500; letter-spacing: -0.01em; }
.more span { display: block; margin-top: 4px; font-size: 13px; line-height: 1.55; color: var(--mute); }
@media (max-width: 720px) { .more { grid-template-columns: minmax(0, 1fr); } }

@media (max-width: 900px) {
  .bound { grid-template-columns: minmax(0, 1fr); }
  .xing { border-left: 0; border-right: 0; border-top: 1px dashed var(--line-2); border-bottom: 1px dashed var(--line-2); }
  .xline.h { display: none; }
  .xline.v { display: block; width: 1px; height: 56px; }
  .xline.v i { transform-origin: top; }
  .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .panel { position: relative; top: auto; grid-template-columns: minmax(0, 1fr); min-height: 0; }
  .panel-r { order: -1; border-left: 0; border-bottom: 1px solid var(--line); min-height: 220px; }
}
@media (max-width: 520px) {
  .facts { grid-template-columns: minmax(0, 1fr); }
}
/* Small screens get one fixed smaller step — still no fluid scaling. */
@media (max-width: 720px) {
  .statement { padding: 110px var(--gutter); }
  .statement p { font-size: 1.8rem; }
  .panel-l { padding: 26px; }
  .panel h3 { font-size: 2rem; }
  .fact { gap: 32px; padding: 22px; }
  .fact .v { font-size: 1.4rem; }
  .art { padding: 16px; }
  .pr-foot { margin-top: 28px; }
  .more > div { padding: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .ring, .cur { animation: none; }
}
`;

/* ── Hero ───────────────────────────────────────────────────── */

function Hero() {
  const { user } = useAuth();
  const reduce = !!useReducedMotion();
  const line = (i: number) =>
    ({
      initial: reduce ? false : { y: '110%' },
      animate: { y: 0 },
      transition: { duration: 1.1, ease, delay: 0.25 + i * 0.12 },
    } as const);
  const fade = (d: number) =>
    ({
      initial: reduce ? false : { opacity: 0, y: 12 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.9, ease, delay: d },
    } as const);

  return (
    <section className="hero">
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
        <motion.span className="eyebrow" {...fade(0.1)}>Private cloud storage</motion.span>
        <h1 className="hero-h">
          <span className="ln"><motion.span {...line(0)}>All your files.</motion.span></span>
          <span className="ln"><motion.span {...line(1)}>No one else can read them.</motion.span></span>
        </h1>
        <motion.p className="hero-sub" {...fade(0.7)}>
          SquidCloud stores your documents, photos, and projects encrypted — only your devices can open them. Use them as a drive, from the terminal, through share links, or publish them as websites.
        </motion.p>
        <motion.div className="hero-ctas" {...fade(0.85)}>
          <Link to={user ? '/dashboard' : '/auth?tab=signup'} className="btn btn-fill">
            <span>{user ? 'Open dashboard' : 'Create free account'}</span>
            <i><Arrow /></i>
          </Link>
          <Link to="/help/docs" className="btn btn-ghost">Read the docs</Link>
        </motion.div>
      </div>

      <Wordmark reduce={reduce} />
    </section>
  );
}

/* ── Statement: words light up with scroll ──────────────────── */

function Word({ w, i, n, p }: { w: string; i: number; n: number; p: MotionValue<number> }) {
  const o = useTransform(p, [i / n, (i + 1) / n], [0.14, 1]);
  return (
    <>
      <motion.span style={{ opacity: o }}>{w}</motion.span>{' '}
    </>
  );
}

const STATEMENT =
  'Everything you store is encrypted on your device before it leaves. We carry the ciphertext. We never hold the key, so there is nothing for us to read, sell or leak.';

function Statement() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.55'] });
  const words = STATEMENT.split(' ');
  return (
    <div className="statement" ref={ref}>
      <p>
        {words.map((w, i) => (
          <Word key={i} w={w} i={i} n={words.length} p={scrollYProgress} />
        ))}
      </p>
    </div>
  );
}

/* ── Trust boundary ─────────────────────────────────────────── */

const FACTS: Array<[string, string]> = [
  ['Cipher', 'AES-256-GCM'],
  ['Keys on our servers', 'Zero'],
  ['Storage', 'Unlimited on every plan'],
  ['Sign-in', 'WebAuthn passkeys'],
];

function Boundary() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.8', 'end 0.5'] });
  const draw = useTransform(scrollYProgress, [0, 1], [0, 1]);
  return (
    <section className="sec" id="security">
      <div className="sec-h">
        <h2 className="h2">See what we see: nothing.</h2>
        <p className="lede">
          Plaintext and keys stay on your device. SquidCloud only ever receives ciphertext, so a breach on our side returns noise.
        </p>
      </div>

      <div className="bound" ref={ref}>
        <div className="side">
          <span className="side-k">Your device</span>
          <ul>
            <li>Files <span>readable</span></li>
            <li>Master key <span>held here</span></li>
            <li>Passkey <span>held here</span></li>
          </ul>
        </div>
        <div className="xing" aria-hidden="true">
          <div className="xline h"><motion.i style={{ scaleX: draw }} /></div>
          <div className="xline v"><motion.i style={{ scaleY: draw }} /></div>
          <span className="xchip">AES-256-GCM</span>
          <span className="xcap">Encrypted before it leaves</span>
        </div>
        <div className="side far">
          <span className="side-k">SquidCloud</span>
          <ul>
            <li>Files <span className="nz">a3f9 07c1 e5d2 9b46</span></li>
            <li>Keys <span>none</span></li>
            <li>Readable by us <span>nothing</span></li>
          </ul>
        </div>
      </div>

      <div className="facts">
        {FACTS.map(([k, v]) => (
          <div className="fact" key={k}>
            <span className="k">{k}</span>
            <span className="v">{v}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Capability artwork (abstract on purpose) ───────────────── */

function DriveArt() {
  return (
    <svg viewBox="0 0 480 360" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(70 ${74 + i * 72})`}>
          <rect className={i === 1 ? 'a-s a-on' : 'a-s'} width="340" height="52" rx="6" />
          {i !== 1 && <rect className="a-f" x="18" y="22" width="64" height="8" rx="4" />}
          {i === 1 && <text className="a-t" x="18" y="30">/Volumes/SquidCloud</text>}
          <circle className={i === 1 ? 'a-b' : 'a-f'} cx="314" cy="26" r="5" />
        </g>
      ))}
    </svg>
  );
}

function CliArt() {
  return (
    <svg viewBox="0 0 480 360" aria-hidden="true">
      <rect className="a-s" x="60" y="60" width="360" height="240" rx="6" />
      <line className="a-s" x1="60" y1="92" x2="420" y2="92" />
      {[0, 1, 2].map((i) => (
        <circle key={i} className="a-f" cx={80 + i * 16} cy="76" r="3" />
      ))}
      <polyline className="a-k" points="112,148 162,188 112,228" />
      <rect className="a-b cur" x="196" y="220" width="64" height="10" />
      <text className="a-t d" x="112" y="274">squid push ./data</text>
    </svg>
  );
}

function KeyArt() {
  return (
    <svg viewBox="0 0 480 360" aria-hidden="true">
      {[28, 46, 64, 82, 100, 118, 136].map((r, i) => (
        <circle
          key={r}
          className="ring"
          cx="240"
          cy="180"
          r={r}
          style={{
            animationDuration: `${34 + i * 9}s`,
            animationDirection: i % 2 ? 'reverse' : 'normal',
            strokeDasharray: `${r * 0.9} ${r * 0.35} ${r * 0.25} ${r * 0.3}`,
          }}
        />
      ))}
      <circle className="a-b" cx="240" cy="180" r="5" />
    </svg>
  );
}

function SiteArt() {
  return (
    <svg viewBox="0 0 480 360" aria-hidden="true">
      <rect className="a-s" x="70" y="60" width="340" height="240" rx="6" />
      <line className="a-s" x1="70" y1="94" x2="410" y2="94" />
      {[0, 1, 2].map((i) => (
        <circle key={i} className="a-f" cx={90 + i * 16} cy="77" r="3" />
      ))}
      <rect className="a-s" x="160" y="68" width="190" height="18" rx="9" />
      <text className="a-t d" x="176" y="81">squidcloud.vercel.app</text>
      <rect className="a-b" x="100" y="124" width="150" height="14" rx="3" />
      <rect className="a-f" x="100" y="150" width="230" height="6" rx="3" />
      <rect className="a-f" x="100" y="164" width="190" height="6" rx="3" />
      <rect className="a-s a-on" x="100" y="196" width="140" height="84" rx="4" />
      <rect className="a-s" x="256" y="196" width="134" height="84" rx="4" />
    </svg>
  );
}

/* ── Capabilities ───────────────────────────────────────────── */

const FEATURES: Array<{ k: string; title: string; body: string; chips: string[]; Art: React.FC }> = [
  {
    k: 'Drive',
    title: 'Your files as a drive.',
    body: 'SquidCloud appears as a physical drive on macOS, Windows, or Linux. Open any file — it decrypts in memory while you use it and seals shut the moment you save.',
    chips: ['macOS', 'Windows', 'Linux'],
    Art: DriveArt,
  },
  {
    k: 'Terminal',
    title: 'Your files from the terminal.',
    body: 'Upload, download, and manage everything with commands or the API. Scoped keys give every script access to exactly what it needs — nothing more.',
    chips: ['Push and pull', 'Scoped API keys', 'Pipelines'],
    Art: CliArt,
  },
  {
    k: 'Passkeys',
    title: 'Sign in without passwords.',
    body: 'Use your fingerprint or face instead of a password. There is nothing to phish, guess, or leak.',
    chips: ['WebAuthn', 'Touch ID', 'Face ID'],
    Art: KeyArt,
  },
  {
    k: 'Hosting',
    title: 'Your files as a website.',
    body: 'Put any folder online on a SquidCloud subdomain, or bring your own domain. Free sites sleep after 50 idle days and wake up again with one click.',
    chips: ['Subdomains', 'Custom domains', '1-click unarchive'],
    Art: SiteArt,
  },
];

function Features() {
  return (
    <section className="sec" id="features">
      <div className="sec-h">
        <h2 className="h2">Four ways to use your files.</h2>
        <p className="lede">
          Storage is just the start. Your encrypted files mount as a drive, answer terminal commands, open with your fingerprint, and publish as websites.
        </p>
      </div>
      <div className="stack">
        {FEATURES.map((f, i) => (
          <article className="panel" key={f.k} style={{ ['--k' as string]: i } as CSSProperties}>
            <div className="panel-l">
              <div>
                <span className="panel-k">{f.k}</span>
                <h3 style={{ marginTop: 28 }}>{f.title}</h3>
                <p>{f.body}</p>
              </div>
              <ul className="chips">
                {f.chips.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div className="panel-r">
              <div className="art"><f.Art /></div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ── Also inside: the tools people miss until someone points them out ── */

const MORE: Array<[string, string]> = [
  ['Share links', 'Send any file with a link. Add a password, an expiry date, or burn-after-reading, and see when it gets opened.'],
  ['Workspaces', 'Shared folders for people you work with, with viewer, editor, and admin roles.'],
  ['File requests', 'A public upload link that collects files from anyone straight into your storage.'],
  ['Secrets vault', 'Store API keys and passwords encrypted, and hand them out as single-use links.'],
  ['Developer API', 'Thirty-plus endpoints with scoped keys, plus webhooks that ping your apps on every event.'],
  ['Automations', 'Run file pipelines on upload, on a schedule, or with one click.'],
  ['Code editor', 'Edit code in the browser with your files beside it, autosaved as you type.'],
  ['Reader and player', 'Annotate PDFs, read EPUB books, and stream video without downloading first.'],
  ['Apps everywhere', 'Web, Android, and desktop apps, a full terminal CLI, and the drive mount.'],
  ['Safety nets', 'Every file keeps old versions, and trash restores anything for 30 days.'],
];

function MoreInside() {
  return (
    <section className="sec" id="more">
      <div className="sec-h">
        <h2 className="h2">Also inside your account.</h2>
        <p className="lede">
          The tools people miss until someone points them out. All included, all encrypted the same way.
        </p>
      </div>
      <div className="more">
        {MORE.map(([t, d]) => (
          <div key={t}>
            <b>{t}</b>
            <span>{d}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Pricing ────────────────────────────────────────────────── */

function PricingBlock() {
  const [billing, setBilling] = useState<Billing>('monthly');
  return (
    <section className="sec" id="pricing" style={{ paddingTop: '80px' }}>
      <div className="sec-h">
        <h2 className="h2">Free forever. Pay for speed.</h2>
        <div className="pr-side">
          <p className="lede">
            Every plan gets unlimited storage. Upgrading buys speed, concurrency, and priority access to the global edge.
          </p>
          <BillingToggle billing={billing} onChange={setBilling} />
        </div>
      </div>
      <PlanCards billing={billing} />
      <div className="pr-foot">
        <span>crypto via MaxelPay · no card required · cancel anytime</span>
        <Link to="/pricing" className="lnk">Compare every limit <Arrow /></Link>
      </div>
    </section>
  );
}

/* ── Page ───────────────────────────────────────────────────── */

export default function Index() {
  return (
    <Shell css={PAGE_CSS}>
      <Nav links={NAV} />
      <main>
        <Hero />
        <Statement />
        <Boundary />
        <Features />
        <MoreInside />
        <PricingBlock />
        <Closing
          title="Start with one file."
          body="SquidCloud is free to use, with unlimited storage. Privacy isn't a plan here — it's the default."
        />
      </main>
    </Shell>
  );
}

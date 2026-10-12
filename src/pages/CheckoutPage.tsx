import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { Crown, Sparkles, CheckCircle, XCircle, ExternalLink, ShieldCheck, Tag, Zap, FlaskConical } from '@/lib/icon-map';
import { createPaymentSession } from '@/lib/maxelpay';
import {
  AppShell, TopBar, Wrap, Panel, Pill, Note, Spinner, Ico, btn, useDocTitle,
} from '@/components/custom/squid-app';

/* ═══════════════════════════════════════════════════════════════
   CHECKOUT
   Plan on the left, a sticky order summary on the right: you can
   see what you are buying while you pay. No animation, no
   gradients; the total is the loudest thing on the page.
   Payment / discount / activation logic is unchanged.
   Place at: src/pages/CheckoutPage.tsx
   ═══════════════════════════════════════════════════════════════ */

const CO_CSS = `
.co { display: grid; grid-template-columns: minmax(0, 1fr) 400px; gap: 40px; align-items: start; }
.co-side { position: sticky; top: 72px; }
@media (max-width: 920px) { .co { grid-template-columns: 1fr; gap: 24px; } .co-side { position: static; order: -1; } }
.co-plan { display: flex; align-items: center; gap: 16px; }
.co-mark { display: grid; place-items: center; width: 44px; height: 44px; border: 1px solid var(--sa-line-2); border-radius: 5px; color: var(--sa-text); flex: none; }
.co-price { display: flex; align-items: baseline; gap: 6px; margin-top: 22px; }
.co-price b { font: 300 60px/1 var(--sa-f); letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }
@media (max-width: 720px) { .co-price b { font-size: 44px; } }
.co-price span { font: 400 13px/1 var(--sa-mono); letter-spacing: 0.04em; color: var(--sa-mute); }
.co-list { list-style: none; margin: 0; padding: 0; }
.co-list li { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; font-size: 13.5px; line-height: 1.5; color: var(--sa-text-2); }
.co-list li + li { border-top: 1px solid var(--sa-line); }
.co-list svg { flex: none; margin-top: 3px; color: var(--sa-text); }
.co-sum { display: grid; gap: 10px; padding: 16px; font-size: 13px; }
.co-sum > div { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
.co-sum dt, .co-sum .k { color: var(--sa-mute); }
.co-sum .v { color: var(--sa-text); font-variant-numeric: tabular-nums; }
.co-sum .total { padding-top: 12px; margin-top: 2px; border-top: 1px solid var(--sa-line); }
.co-sum .total .k { color: var(--sa-text); font-weight: 500; }
.co-sum .total .v { font: 400 20px/1 var(--sa-f); letter-spacing: -0.02em; }
.co-sum .total .v.good, .co-sum .v.good { color: var(--sa-ok); }
.co-code { padding: 16px; border-top: 1px solid var(--sa-line); }
.co-applied { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; border: 1px solid color-mix(in srgb, var(--sa-ok) 40%, var(--sa-line)); border-radius: 4px; background: color-mix(in srgb, var(--sa-ok) 7%, transparent); }
.co-applied code { font: 500 12.5px/1 var(--sa-mono); color: var(--sa-ok); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.co-pay { padding: 16px; border-top: 1px solid var(--sa-line); }
.co-fine { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 12px; font-size: 12px; color: var(--sa-mute); text-align: center; }
.co-state { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 44px 24px; }
.co-state h2 { margin: 16px 0 0; font: 400 20px/1.2 var(--sa-f); letter-spacing: -0.02em; }
.co-state p { margin: 8px 0 0; max-width: 40ch; font-size: 13.5px; line-height: 1.55; color: var(--sa-text-2); }
.co-state .sa-btn { margin-top: 22px; }
.co-ok { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; border: 1px solid color-mix(in srgb, var(--sa-ok) 50%, var(--sa-line)); color: var(--sa-ok); }
.co-bad { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; border: 1px solid color-mix(in srgb, var(--sa-err) 50%, var(--sa-line)); color: var(--sa-err); }
.co-test { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--sa-line); font-size: 12.5px; color: var(--sa-text-2); }
.co-test span { flex: 1; }
`;

function DocTitle({ t }: { t: string }) {
  useDocTitle(t);
  return null;
}

const PLAN_META: Record<string, { name: string; icon: typeof Crown; color: string }> = {
  supporter: { name: 'Supporter', icon: Crown, color: 'text-amber-400' },
  'supporter-plus': { name: 'Supporter+', icon: Sparkles, color: 'text-primary' },
};

const PLAN_AMOUNTS: Record<string, Record<string, number>> = {
  supporter: { weekly: 0.75, monthly: 4, annual: 32 },
  'supporter-plus': { weekly: 1.89, monthly: 10, annual: 80 },
};

const BILLING_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  annual: 'Annual',
};

const BILLING_SUFFIX: Record<string, string> = {
  weekly: '/week',
  monthly: '/month',
  annual: '/year',
};

const FEATURES: Record<string, { icon: typeof Crown; text: string }[]> = {
  supporter: [
    { icon: Crown, text: 'Priority queue — skip the line' },
    { icon: Crown, text: 'File Requests — collect files from anyone' },
    { icon: Crown, text: 'Always Active sites — never archived' },
    { icon: Crown, text: 'Custom domains for published sites' },
    { icon: Crown, text: '10x more concurrent ops & API tokens' },
  ],
  'supporter-plus': [
    { icon: Sparkles, text: 'Highest priority queue' },
    { icon: Sparkles, text: 'File Requests — unlimited' },
    { icon: Sparkles, text: 'Always Active sites' },
    { icon: Sparkles, text: 'Unlimited everything — no caps at all' },
    { icon: Sparkles, text: 'Priority support' },
  ],
};

type Status = 'idle' | 'creating' | 'redirecting' | 'error' | 'success';

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [testMode, setTestMode] = useState(false);
  const [discountCode, setDiscountCode] = useState('');
  const [discountResult, setDiscountResult] = useState<any>(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountError, setDiscountError] = useState('');
  const [applyingDiscount, setApplyingDiscount] = useState(false);

  const planId = searchParams.get('plan') || '';
  const billing = (searchParams.get('billing') || 'monthly') as string;
  const sessionId = searchParams.get('sessionId');
  const isTestMode = searchParams.get('test') === 'true';
  const activatingRef = useRef(false);

  const meta = PLAN_META[planId];
  const amount = PLAN_AMOUNTS[planId]?.[billing] ?? 0;
  const isAdmin = profile?.is_admin === true;
  const discountPrice = discountResult?.valid ? discountResult.price : null;
  const adminFree = isAdmin && planId === 'supporter-plus' && billing === 'weekly';
  const finalAmount = adminFree ? 0 : (discountPrice != null ? discountPrice : amount);

  useEffect(() => {
    if (isTestMode) setTestMode(true);
    if (!user) {
      navigate('/auth?redirect=' + encodeURIComponent('/checkout?plan=' + planId + '&billing=' + billing));
      return;
    }
    if (!meta) {
      navigate('/pricing');
    }
  }, [user, meta, planId, billing, navigate, isTestMode]);

  useEffect(() => {
    if (sessionId && status === 'idle') {
      setStatus('success');
      if (!activatingRef.current && planId && user?.id) {
        activatingRef.current = true;
        supabase.functions.invoke('subscription-manager/activate', {
          body: {
            user_id: user.id,
            plan_type: planId,
            billing_period: billing,
          },
        }).then(({ error }) => {
          if (error) console.error('Activation fallback failed:', error);
          refreshProfile();
        });
      }
    }
  }, [sessionId, status, planId, billing, user?.id]);

  async function applyDiscountCode() {
    if (!discountCode.trim()) return;
    setDiscountLoading(true);
    setDiscountError('');
    setDiscountResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('validate-discount', {
        body: { code: discountCode.trim(), plan_type: planId, billing_period: billing },
      });

      if (fnError) throw new Error(fnError.message);

      if (!data.valid) {
        setDiscountError(data.error || 'Invalid discount code');
        return;
      }

      setDiscountResult(data);
    } catch (err: any) {
      setDiscountError(err.message || 'Failed to validate code');
    } finally {
      setDiscountLoading(false);
    }
  }

  async function redeemFreeCode() {
    if (!user || !discountResult) return;
    setApplyingDiscount(true);
    setError('');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('redeem-code', {
        body: { code: discountResult.code },
      });

      if (fnError) throw new Error(fnError.message);
      if (!data.success) throw new Error(data.error || 'Failed to activate plan');

      setStatus('success');
      refreshProfile();
    } catch (err: any) {
      setError(err.message || 'Failed to activate plan');
      setStatus('error');
    } finally {
      setApplyingDiscount(false);
    }
  }

  async function handlePay() {
    if (!user || !meta || !amount) return;
    if (discountResult?.valid && discountResult.price === 0) {
      await redeemFreeCode();
      return;
    }
    setStatus('creating');
    setError('');

    try {
      if (finalAmount === 0) {
        setStatus('success');
        supabase.functions.invoke('subscription-manager/activate', {
          body: {
            user_id: user.id,
            plan_type: planId,
            billing_period: billing,
          },
        }).catch((err) => console.error('Admin free activation failed:', err));
        refreshProfile();
        return;
      }

      const session = await createPaymentSession({
        orderId: `${planId}_${billing}_${user.id}_${Date.now()}`,
        amount: finalAmount,
        currency: 'USD',
        description: `${meta.name} — ${BILLING_LABELS[billing]} Plan`,
        successUrl: `${window.location.origin}/checkout?plan=${planId}&billing=${billing}&sessionId={sessionId}`,
        cancelUrl: `${window.location.origin}/checkout?plan=${planId}&billing=${billing}`,
        callbackUrl: `https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/maxelpay-webhook`,
      }, testMode);

      const checkoutUrl = session.data?.paymentUrl || session.paymentUrl || session.hostedCheckoutUrl || session.checkoutUrl || session.url;
      if (!checkoutUrl) {
        throw new Error(`No checkout URL in response: ${JSON.stringify(session)}`);
      }

      setStatus('redirecting');
      window.location.href = checkoutUrl;
    } catch (err: any) {
      setError(err.message || 'Failed to create payment session');
      setStatus('error');
    }
  }

  if (!meta || !user) return null;

  const Icon = meta.icon;
  const features = FEATURES[planId] || [];

  const summaryRows: Array<[string, string]> = [
    ['Plan', meta.name],
    ['Billing', BILLING_LABELS[billing]],
    ...((discountResult && discountResult.price > 0
      ? [
          ['Original', `$${discountResult.original_amount}`],
          ['Discount', `-${discountResult.discount_percent}%`],
        ]
      : []) as Array<[string, string]>),
  ];
  const totalLabel = finalAmount === 0 ? 'Price' : 'Total';
  const totalValue = finalAmount === 0 ? 'Free' : `$${finalAmount} ${BILLING_SUFFIX[billing]}`;

  const footNote = (
    <p className="sa-hint" style={{ textAlign: 'center', marginTop: 20 }}>
      Your subscription will start immediately after payment. Cancel anytime.
    </p>
  );

  if (status === 'success') {
    return (
      <AppShell>
        <style>{CO_CSS}</style>
        <DocTitle t="Payment successful" />
        <TopBar home="/dashboard" crumbs={[{ label: 'Checkout' }, { label: 'Done' }]} />
        <Wrap width="narrow">
          <Panel>
            <div className="co-state" role="status" aria-live="polite">
              <div className="co-ok"><CheckCircle className="h-5 w-5" /></div>
              <h2>Payment successful!</h2>
              <p>Your {meta.name} plan is now active. Welcome to the club.</p>
              <button type="button" className={btn('primary', 'lg')} onClick={() => navigate('/dashboard')} autoFocus>
                Go to dashboard
              </button>
            </div>
          </Panel>
        </Wrap>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <style>{CO_CSS}</style>
      <DocTitle t="Checkout" />
      <TopBar home="/dashboard" crumbs={[{ label: 'Pricing', to: '/pricing' }, { label: 'Checkout' }]}>
        <button type="button" className={btn('ghost', 'sm')} onClick={() => navigate('/pricing')}>
          <Ico.ArrowLeft size={13} /> Back to pricing
        </button>
      </TopBar>

      <Wrap>
        <div className="co">
          {/* ───────── Plan ───────── */}
          <div>
            <div className="co-plan">
              <div className="co-mark"><Icon className="h-5 w-5" /></div>
              <div>
                <div className="sa-eyebrow" style={{ margin: 0 }}>Checkout</div>
                <h1 className="sa-title" style={{ marginTop: 8 }}>{meta.name}</h1>
              </div>
            </div>

            <div className="co-price">
              <b>{finalAmount === 0 ? 'Free' : `$${finalAmount}`}</b>
              {finalAmount > 0 && <span>{BILLING_SUFFIX[billing]}</span>}
            </div>
            <p className="sa-desc">{BILLING_LABELS[billing]} billing</p>

            <div style={{ marginTop: 28 }}>
              <Panel title="What's included" flush>
                <ul className="co-list">
                  {features.map((f, i) => (
                    <li key={i}>
                      <Ico.Check size={14} />
                      <span>{f.text}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
            <div className="sa-hint" style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck className="h-3.5 w-3.5" /> Secured by MaxelPay — no KYC, crypto only
            </div>
          </div>

          {/* ───────── Order summary ───────── */}
          <aside className="co-side" aria-label="Order summary">
            <Panel title="Order summary" actions={<Pill>{BILLING_LABELS[billing]}</Pill>} flush>
              {status === 'idle' && (
                <>
                  {isAdmin && (
                    <div className="co-test">
                      <FlaskConical className="h-3.5 w-3.5" />
                      <span id="co-test-l">Test mode</span>
                      <Switch checked={testMode} onCheckedChange={setTestMode} aria-labelledby="co-test-l" />
                    </div>
                  )}

                  {adminFree && (
                    <div style={{ padding: '16px 16px 0' }}>
                      <Note tone="ok" icon={false}>
                        <Zap className="h-3.5 w-3.5" style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
                        Admin: Supporter+ Weekly is FREE
                      </Note>
                    </div>
                  )}

                  <div className="co-sum">
                    {summaryRows.map(([k, v]) => (
                      <div key={k}>
                        <span className="k">{k}</span>
                        <span className="v">{v}</span>
                      </div>
                    ))}
                    <div className="total">
                      <span className="k">{totalLabel}</span>
                      <span className={`v${discountResult ? ' good' : ''}`}>{totalValue}</span>
                    </div>
                  </div>

                  <div className="co-code">
                    <label className="sa-label" htmlFor="co-code" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Tag className="h-3 w-3" /> Discount code
                    </label>

                    {!discountResult ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          id="co-code"
                          className="sa-input"
                          placeholder="Enter code"
                          value={discountCode}
                          onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                          onKeyDown={(e) => e.key === 'Enter' && applyDiscountCode()}
                          autoComplete="off"
                          spellCheck={false}
                          style={{ fontFamily: 'var(--sa-mono)', letterSpacing: '0.04em' }}
                        />
                        <button
                          type="button"
                          className={btn()}
                          onClick={applyDiscountCode}
                          disabled={discountLoading || !discountCode.trim()}
                        >
                          {discountLoading ? <Spinner size={12} /> : 'Apply'}
                        </button>
                      </div>
                    ) : (
                      <div className="co-applied">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <CheckCircle className="h-3.5 w-3.5" style={{ color: 'var(--sa-ok)', flex: 'none' }} />
                          <code>{discountResult.code}</code>
                          {discountResult.discount_percent > 0 && <Pill tone="ok">-{discountResult.discount_percent}%</Pill>}
                        </div>
                        <button
                          type="button"
                          className={btn('ghost', 'icon-sm')}
                          onClick={() => { setDiscountResult(null); setDiscountCode(''); setDiscountError(''); }}
                          aria-label="Remove discount code"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {discountError && (
                      <div className="sa-err" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <XCircle className="h-3 w-3" /> {discountError}
                      </div>
                    )}

                    {discountResult && discountResult.original_amount > 0 && discountResult.price > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12.5 }} className="sa-num">
                        <span className="sa-mute" style={{ textDecoration: 'line-through' }}>
                          ${discountResult.original_amount}{BILLING_SUFFIX[discountResult.billing_period as string] || ''}
                        </span>
                        <span style={{ color: 'var(--sa-ok)' }}>
                          ${discountResult.price}{BILLING_SUFFIX[discountResult.billing_period as string] || ''}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="co-pay">
                    <button
                      type="button"
                      className={btn('primary', 'lg') + ' block'}
                      onClick={handlePay}
                      disabled={applyingDiscount}
                    >
                      {applyingDiscount ? (
                        <><Spinner /> Activating...</>
                      ) : finalAmount === 0 ? (
                        <><Zap className="h-4 w-4" /> Activate Free</>
                      ) : (
                        `Pay $${finalAmount}${BILLING_SUFFIX[billing]} with Crypto`
                      )}
                    </button>
                  </div>
                </>
              )}

              {status === 'creating' && (
                <div className="co-state" role="status" aria-live="polite">
                  <Spinner size={22} />
                  <p>Creating payment session...</p>
                </div>
              )}

              {status === 'redirecting' && (
                <div className="co-state" role="status" aria-live="polite">
                  <Spinner size={22} />
                  <p>Redirecting to MaxelPay checkout...</p>
                  <ExternalLink className="h-4 w-4" style={{ marginTop: 12, color: 'var(--sa-mute)' }} />
                </div>
              )}

              {status === 'error' && (
                <div className="co-state" role="alert">
                  <div className="co-bad"><XCircle className="h-5 w-5" /></div>
                  <h2>Something went wrong</h2>
                  <p style={{ wordBreak: 'break-word' }}>{error}</p>
                  <button type="button" className={btn('default', 'lg')} onClick={() => setStatus('idle')} autoFocus>
                    Try again
                  </button>
                </div>
              )}
            </Panel>
            {footNote}
          </aside>
        </div>
      </Wrap>
    </AppShell>
  );
}

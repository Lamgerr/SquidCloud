import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Crown, Sparkles, ArrowLeft, Loader2, CheckCircle, XCircle, ExternalLink, ShieldCheck, Tag, Zap, FlaskConical } from '@/lib/icon-map';
import { createPaymentSession } from '@/lib/maxelpay';

const PLAN_META: Record<string, { name: string; icon: typeof Crown; color: string; gradient: string }> = {
  supporter: { name: 'Supporter', icon: Crown, color: 'text-amber-400', gradient: 'from-amber-500/20 to-amber-500/5' },
  'supporter-plus': { name: 'Supporter+', icon: Sparkles, color: 'text-purple-400', gradient: 'from-purple-500/20 to-purple-500/5' },
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-[400px] h-[400px] rounded-full bg-purple-500/5 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg relative z-10"
      >
        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => navigate('/pricing')}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-5 transition-colors group"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" /> Back to pricing
        </motion.button>

        <div className="rounded-2xl border border-border/20 bg-card/80 backdrop-blur-xl p-5 md:p-7 shadow-lg">
          {/* Animated gradient orb inside card */}
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-gradient-to-br from-primary/[0.03] to-transparent blur-3xl pointer-events-none" />

          {/* Plan header */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-3 mb-6 relative"
          >
            <div className={cn(
              'h-12 w-12 rounded-xl bg-gradient-to-br border flex items-center justify-center',
              meta.gradient,
              planId === 'supporter' ? 'border-amber-500/20' : 'border-purple-500/20',
            )}>
              <Icon className={cn('h-6 w-6', meta.color)} />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-foreground">{meta.name}</h1>
              <p className="text-xs text-muted-foreground">{BILLING_LABELS[billing]} billing</p>
            </div>
            <Badge
              variant="secondary"
              className={cn(
                'text-xs px-3 py-1',
                finalAmount === 0 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : '',
              )}
            >
              {finalAmount === 0 ? 'Free' : `$${finalAmount}`}
              {finalAmount > 0 && (
                <span className="text-muted-foreground ml-0.5 font-normal">{BILLING_SUFFIX[billing]}</span>
              )}
            </Badge>
          </motion.div>

          {/* Test mode toggle */}
          {isAdmin && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-4 flex items-center gap-2 rounded-xl border border-border/10 bg-muted/20 px-3 py-2"
            >
              <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground flex-1">Test Mode</span>
              <Switch checked={testMode} onCheckedChange={setTestMode} />
            </motion.div>
          )}

          {/* Admin free indicator */}
          {adminFree && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 mb-5 flex items-center gap-2.5"
            >
              <Zap className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              <p className="text-xs text-emerald-500 font-medium">Admin: Supporter+ Weekly is FREE</p>
            </motion.div>
          )}

          {/* Status states */}
          <AnimatePresence mode="wait">
            {status === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', damping: 18, stiffness: 200 }}
                className="text-center py-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
                >
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-8 w-8 text-emerald-500" />
                  </div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                >
                  <h2 className="text-lg font-bold text-foreground mb-1">Payment successful!</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Your {meta.name} plan is now active. Welcome to the club.
                  </p>
                  <Button onClick={() => navigate('/dashboard')} className="rounded-xl h-10 shadow-md">
                    Go to Dashboard
                  </Button>
                </motion.div>
              </motion.div>
            )}

            {status === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', damping: 18, stiffness: 200 }}
                className="text-center py-8"
              >
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-destructive/20 to-destructive/5 border border-destructive/20 flex items-center justify-center mx-auto mb-4">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
                <h2 className="text-lg font-bold text-foreground mb-1">Something went wrong</h2>
                <p className="text-sm text-muted-foreground mb-5">{error}</p>
                <Button variant="outline" onClick={() => setStatus('idle')} className="rounded-xl h-10">
                  Try Again
                </Button>
              </motion.div>
            )}

            {status === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Summary */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                  className="rounded-xl bg-muted/20 border border-border/10 p-4 space-y-2"
                >
                  {[
                    ['Plan', meta.name],
                    ['Billing', BILLING_LABELS[billing]],
                    ...(discountResult && discountResult.price > 0 ? [
                      ['Original', `$${discountResult.original_amount}`],
                      ['Discount', `-${discountResult.discount_percent}%`],
                    ] : []),
                    [finalAmount === 0 ? 'Price' : 'Total', finalAmount === 0 ? 'Free' : `$${finalAmount} ${BILLING_SUFFIX[billing]}`],
                  ].map(([label, value], i) => (
                    <div key={label as string} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{label as string}</span>
                      <span className={cn(
                        'font-medium',
                        i === (discountResult && discountResult.price > 0 ? 3 : 1) && discountResult ? 'text-emerald-500' : 'text-foreground',
                      )}>
                        {value as string}
                      </span>
                    </div>
                  ))}
                </motion.div>

                {/* Features */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.3 }}
                  className="rounded-xl bg-muted/20 border border-border/10 p-4"
                >
                  <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                    What's included
                  </p>
                  <div className="space-y-2">
                    {features.map((f, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + i * 0.05, duration: 0.2 }}
                        className="flex items-center gap-2.5"
                      >
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                        <span className="text-xs text-foreground/80">{f.text}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                {/* Discount code */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.3 }}
                  className="rounded-xl border border-border/10 p-3 space-y-2"
                >
                  <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Tag className="h-3 w-3" /> Discount code
                  </p>
                  {!discountResult ? (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
                        <Input
                          placeholder="Enter code"
                          value={discountCode}
                          onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                          className="h-9 text-xs pl-8"
                          onKeyDown={(e) => e.key === 'Enter' && applyDiscountCode()}
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={applyDiscountCode}
                        disabled={discountLoading || !discountCode.trim()}
                        className="h-9 text-xs px-3"
                      >
                        {discountLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Apply'}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                        <span className="text-xs font-mono text-emerald-500 font-medium truncate">{discountResult.code}</span>
                        {discountResult.discount_percent > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            -{discountResult.discount_percent}%
                          </Badge>
                        )}
                      </div>
                      <button
                        onClick={() => { setDiscountResult(null); setDiscountCode(''); setDiscountError(''); }}
                        className="text-muted-foreground/50 hover:text-muted-foreground transition-colors flex-shrink-0 ml-2"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {discountError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[10px] text-destructive flex items-center gap-1"
                    >
                      <XCircle className="h-3 w-3" /> {discountError}
                    </motion.p>
                  )}
                  {discountResult && discountResult.original_amount > 0 && discountResult.price > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="flex items-center justify-between text-xs pt-1"
                    >
                      <span className="text-muted-foreground line-through">${discountResult.original_amount}{BILLING_SUFFIX[discountResult.billing_period as string] || ''}</span>
                      <span className="text-emerald-500 font-semibold">${discountResult.price}{BILLING_SUFFIX[discountResult.billing_period as string] || ''}</span>
                    </motion.div>
                  )}
                </motion.div>

                {/* Pay button */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.3 }}
                >
                  <Button
                    onClick={handlePay}
                    disabled={applyingDiscount}
                    className={cn(
                      'w-full rounded-xl h-11 text-sm font-semibold transition-all',
                      finalAmount === 0
                        ? ''
                        : 'bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 shadow-md shadow-primary/20',
                    )}
                    size="lg"
                  >
                    {applyingDiscount ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Activating...</>
                    ) : finalAmount === 0 ? (
                      <span className="flex items-center gap-2">
                        <Zap className="h-4 w-4" /> Activate Free
                      </span>
                    ) : (
                      `Pay $${finalAmount}${BILLING_SUFFIX[billing]} with Crypto`
                    )}
                  </Button>

                  <p className="text-[10px] text-muted-foreground/50 text-center flex items-center justify-center gap-1 mt-3">
                    <ShieldCheck className="h-3 w-3" /> Secured by MaxelPay — no KYC, crypto only
                  </p>
                </motion.div>
              </motion.div>
            )}

            {status === 'creating' && (
              <motion.div
                key="creating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-10"
              >
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Creating payment session...</p>
              </motion.div>
            )}

            {status === 'redirecting' && (
              <motion.div
                key="redirecting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-10"
              >
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-2">Redirecting to MaxelPay checkout...</p>
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <ExternalLink className="h-4 w-4 text-muted-foreground/50 mx-auto" />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="text-[10px] text-muted-foreground/30 text-center mt-4"
        >
          Your subscription will start immediately after payment. Cancel anytime.
        </motion.p>
      </motion.div>
    </div>
  );
}

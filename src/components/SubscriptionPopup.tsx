import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Crown, Sparkles, X, AlertTriangle, CheckCircle, Zap,
} from '@/lib/icon-map';
import { useAuth } from '@/contexts/AuthContext';
import type { PendingNotification } from '@/hooks/useSubscriptionNotifications';
import { BottomSheet, BottomSheetContent } from '@/components/ui/bottom-sheet';

interface SubscriptionPopupProps {
  notification: PendingNotification;
  onDismiss: (id: string) => void;
  onAcceptUpsell?: (id: string) => void;
}

const PopupShell: React.FC<{
  children: React.ReactNode;
  panelClassName: string;
  onClose: () => void;
}> = ({ children, panelClassName, onClose }) => {
  const isMobile = window.innerWidth < 768;
  if (isMobile) {
    const sheetClassName = panelClassName
      .replace('overflow-hidden', '')
      .concat(' max-h-[92vh] overflow-y-auto');
    return (
      <BottomSheet open onOpenChange={(open) => { if (!open) onClose(); }}>
        <BottomSheetContent hideClose className={cn(sheetClassName)}>
          {children}
        </BottomSheetContent>
      </BottomSheet>
    );
  }
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={cn('relative w-full', panelClassName)}
        >
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const SubscriptionPopup: React.FC<SubscriptionPopupProps> = ({ notification, onDismiss, onAcceptUpsell }) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const { stage, plan_type, billing_period, upsell_offer_shown } = notification;
  const planName = plan_type === 'supporter-plus' ? 'Supporter+' : 'Supporter';

  const handleRenew = (targetPlan?: string, targetBilling?: string) => {
    const p = targetPlan || plan_type;
    const b = targetBilling || billing_period;
    let path = `/checkout?plan=${p}&billing=${b}`;
    if (billing_period === 'weekly' && stage === 2) path += '&upsell=weekly_bonus';
    if (billing_period === 'monthly' && stage === 3) path += '&upsell=monthly_to_annual';
    if (plan_type === 'supporter' && billing_period === 'annual' && stage === 3) path += '&upsell=supporter_to_plus';
    navigate(path);
    onDismiss(notification.id);
  };

  const handleContinueFree = () => {
    if (!showConfirm) { setShowConfirm(true); return; }
    setDismissed(true);
    setTimeout(() => onDismiss(notification.id), 200);
  };

  if (dismissed) return null;

  // ─── TYPE 2: Weekly Upsell (Stage 2) ───
  if (billing_period === 'weekly' && stage === 2) {
    return (
      <PopupShell panelClassName="relative w-full max-w-md rounded-2xl border border-white/10 lg-strong shadow-2xl overflow-hidden" onClose={() => onDismiss(notification.id)}>
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500" />
            <button
              onClick={() => onDismiss(notification.id)}
              className="absolute top-3 right-3 h-8 w-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>

            <div className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
                  Special offer
                </span>
              </div>

              <h2 className="text-xl font-bold text-foreground mb-1">Switch to monthly today</h2>
              <p className="text-sm text-muted-foreground mb-5">
                Your weekly plan ends tomorrow. Here's a better deal.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                  <p className="text-[10px] font-semibold text-muted-foreground mb-2">STAY WEEKLY</p>
                  <p className="text-lg font-bold text-foreground">$0.75</p>
                  <p className="text-[11px] text-muted-foreground">per week</p>
                  <div className="mt-2 space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">~$3.26/mo equiv</p>
                    <p className="text-[10px] text-muted-foreground">No bonus days</p>
                  </div>
                </div>

                <div className="rounded-xl bg-blue-500/5 border-2 border-blue-500/40 p-3 text-center relative">
                  <span className="absolute -top-2.5 right-2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500 text-white">BEST</span>
                  <p className="text-[10px] font-semibold text-blue-400 mb-2">SWITCH MONTHLY</p>
                  <p className="text-lg font-bold text-foreground">$4.00</p>
                  <p className="text-[11px] text-muted-foreground">per month</p>
                  <div className="mt-2 space-y-0.5">
                    <p className="text-[10px] text-blue-400 font-medium">~$0.92/week equiv</p>
                    <p className="text-[10px] text-purple-400 font-semibold">+ 10 BONUS DAYS</p>
                    <p className="text-[10px] text-blue-400">41 days total</p>
                    <p className="text-[10px] text-emerald-400 font-medium">Save $3.50</p>
                  </div>
                </div>
              </div>

              <div className="mb-5">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>Your current week</span>
                  <span>6/7 days used</span>
                </div>
                <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                  <div className="h-full w-[85%] rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
                </div>
              </div>

              <Button
                className="w-full h-11 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 shadow-md shadow-blue-500/20"
                onClick={() => handleRenew(plan_type, 'monthly')}
              >
                <Zap className="h-4 w-4 mr-2" /> Switch to Monthly — Get 10 Free Days
              </Button>

              <div className="mt-3 text-center">
                <button
                  onClick={() => handleRenew(plan_type, 'weekly')}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  No thanks, just renew weekly for $0.75
                </button>
              </div>

              <p className="mt-4 text-[10px] text-muted-foreground/40 text-center">
                10 bonus days applied on top of your full 30-day month. Offer available until your current plan expires.
              </p>
            </div>
    </PopupShell>
  );

  // ─── TYPE 3: Expiry Imminent (Final Day) ───
  if (stage === 3 || (billing_period === 'monthly' && stage === 4) || (billing_period === 'annual' && stage === 5)) {
    const expiryTime = profile?.subscription_expires_at
      ? new Date(profile.subscription_expires_at).toLocaleTimeString()
      : 'today';

    return (
      <PopupShell panelClassName="relative w-full max-w-sm rounded-2xl border border-white/10 lg-strong shadow-2xl p-6" onClose={() => onDismiss(notification.id)}>
            <button
              onClick={() => onDismiss(notification.id)}
              className="absolute top-3 right-3 h-8 w-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Your plan expires today</h2>
                <p className="text-xs text-muted-foreground">at {expiryTime}</p>
              </div>
            </div>

                <div className="rounded-xl bg-white/5 border border-white/10 p-3 mb-5 space-y-1.5">
              <p className="text-xs text-muted-foreground">What changes when it expires:</p>
              <p className="text-xs text-foreground/80 flex items-center gap-2">
                <span className="text-amber-400">•</span> Sites enter 50-day archive countdown
              </p>
              <p className="text-xs text-foreground/80 flex items-center gap-2">
                <span className="text-amber-400">•</span> Priority queue access ends
              </p>
              <p className="text-xs text-foreground/80 flex items-center gap-2">
                <span className="text-amber-400">•</span> File size limit drops to 1GB
              </p>
              <p className="text-xs text-foreground/80 flex items-center gap-2">
                <span className="text-amber-400">•</span> API tokens drop to 1,000/day
              </p>
            </div>

            <Button
              className="w-full h-11 rounded-xl text-sm font-semibold mb-2"
              onClick={() => handleRenew()}
            >
              <Crown className="h-4 w-4 mr-2" /> Renew now
            </Button>

            {showConfirm ? (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-xs text-destructive mb-2">Your benefits end in {(billing_period === 'weekly' ? 24 : 24)} hours. Are you sure?</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => setShowConfirm(false)}>
                    Keep my plan
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs text-destructive" onClick={handleContinueFree}>
                    Continue on free
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleContinueFree}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-1 transition-colors"
              >
                I'll do it later
              </button>
            )}
    </PopupShell>
  );
  }

  // ─── TYPE 4: Post-Expiry Modal ───
  if (stage >= 4 && stage <= 10) {
    return (
      <PopupShell panelClassName="relative w-full max-w-sm rounded-2xl border border-white/10 lg-strong shadow-2xl p-6" onClose={() => onDismiss(notification.id)}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Your {planName} plan has ended</h2>
                <p className="text-xs text-muted-foreground">You're now on the free plan</p>
              </div>
            </div>

                <div className="rounded-xl bg-white/5 border border-white/10 p-3 mb-5 space-y-2">
              <p className="text-xs text-red-400 flex items-center gap-2">
                <X className="h-3 w-3" /> Priority queue — now standard queue
              </p>
              <p className="text-xs text-red-400 flex items-center gap-2">
                <X className="h-3 w-3" /> Always-active sites — 50-day archive timer started
              </p>
              <p className="text-xs text-red-400 flex items-center gap-2">
                <X className="h-3 w-3" /> 12GB uploads — back to 1GB limit
              </p>
              <p className="text-xs text-red-400 flex items-center gap-2">
                <X className="h-3 w-3" /> 10,000 API tokens — back to 1,000/day
              </p>
              <p className="text-xs text-red-400 flex items-center gap-2">
                <X className="h-3 w-3" /> Supporter badge — removed from profile
              </p>
            </div>

            <Button
              className="w-full h-11 rounded-xl text-sm font-semibold mb-2"
              onClick={() => handleRenew()}
            >
              <Crown className="h-4 w-4 mr-2" /> Reactivate {planName} — from $4/mo
            </Button>

            <button
              onClick={handleContinueFree}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-1 transition-colors"
            >
              Continue on free plan
            </button>
    </PopupShell>
  );
  }

  // ─── TYPE 5: Annual to Supporter+ Upsell (Annual Stage 3) ───
  if (billing_period === 'annual' && stage === 3 && plan_type === 'supporter') {
    return (
      <PopupShell panelClassName="relative w-full max-w-sm rounded-2xl border border-white/10 lg-strong shadow-2xl p-6" onClose={() => onDismiss(notification.id)}>
            <button onClick={() => onDismiss(notification.id)} className="absolute top-3 right-3 h-8 w-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>

            <h2 className="text-lg font-bold text-foreground mb-1">Upgrade at renewal</h2>
            <p className="text-sm text-muted-foreground mb-5">Your annual plan renews in 7 days. Upgrade to Supporter+ before then.</p>

            <div className="grid grid-cols-2 gap-2 mb-5">
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-3">SUPPORTER</p>
                <div className="space-y-1.5 text-[11px]">
                  <p className="text-foreground/80">10 concurrent ops</p>
                  <p className="text-foreground/80">12GB file size</p>
                  <p className="text-foreground/80">10,000 tokens/day</p>
                  <p className="text-foreground/80">Priority queue</p>
                </div>
              </div>
              <div className="rounded-xl bg-purple-500/5 border-2 border-purple-500/30 p-3 relative">
                <span className="absolute -top-2.5 right-2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-500 text-white">UPGRADE</span>
                <p className="text-xs font-semibold text-purple-400 mb-3">SUPPORTER+</p>
                <div className="space-y-1.5 text-[11px]">
                  <p className="text-purple-300 font-medium">Unlimited ops</p>
                  <p className="text-purple-300 font-medium">Unlimited file size</p>
                  <p className="text-purple-300 font-medium">Unlimited tokens</p>
                  <p className="text-purple-300 font-medium">Top priority queue</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-4 text-center">
              <span className="text-amber-400 font-medium">$48/year more</span> for truly unlimited everything
            </p>

            <Button
              className="w-full h-11 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-md shadow-purple-500/20 mb-2"
              onClick={() => handleRenew('supporter-plus', 'annual')}
            >
              <Sparkles className="h-4 w-4 mr-2" /> Upgrade to Supporter+ at renewal
            </Button>

            <button
              onClick={() => handleRenew('supporter', 'annual')}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-1 transition-colors"
            >
              Keep my current Supporter plan
            </button>
    </PopupShell>
  );

  // Fallback for other stages
  return null;
};

export default SubscriptionPopup;

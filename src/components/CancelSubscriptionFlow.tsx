import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Crown, Sparkles, AlertTriangle, Loader2 } from '@/lib/icon-map';

interface CancelSubscriptionFlowProps {
  userId: string;
  planType?: string;
  billingPeriod: string;
  onCancelled: () => void;
}

type CancelStep = 'confirm' | 'pause' | 'reason' | 'done' | null;

const CancelSubscriptionFlow: React.FC<CancelSubscriptionFlowProps> = ({
  userId, planType, billingPeriod, onCancelled,
}) => {
  const { toast } = useToast();
  const [step, setStep] = useState<CancelStep>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const planName = planType === 'supporter-plus' ? 'Supporter+' : 'Supporter';

  const handleCancel = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('cancel_subscription', {
        p_user_id: userId,
        p_reason: reason || null,
        p_cancelled_by: 'user',
      });

      if (error) throw error;

      toast({ title: 'Subscription cancelled', description: 'Your plan has been cancelled. You can reactivate anytime.' });
      setStep('done');
      onCancelled();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to cancel', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="text-center py-2">
        <p className="text-sm text-muted-foreground">Your subscription has been cancelled.</p>
        <Button size="sm" variant="outline" className="mt-2 rounded-xl" onClick={() => setStep(null)}>
          Dismiss
        </Button>
      </div>
    );
  }

  if (step === 'reason') {
    const reasons = [
      'Too expensive',
      'Not using it enough',
      'Missing a feature I need',
      'Found an alternative',
      'Other',
    ];
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">What's the main reason? (optional)</p>
        <div className="space-y-1">
          {reasons.map(r => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-lg text-xs transition-colors',
                reason === r
                  ? 'bg-accent/50 text-foreground border border-border/30'
                  : 'text-muted-foreground hover:bg-accent/30 border border-transparent'
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="destructive" className="flex-1 rounded-xl h-9 text-xs" onClick={handleCancel} disabled={loading}>
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Confirm cancellation
          </Button>
          <Button size="sm" variant="ghost" className="rounded-xl h-9 text-xs" onClick={() => setStep('pause')}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'pause') {
    return (
      <div className="rounded-xl bg-muted/30 border border-border/20 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <p className="text-xs font-medium text-foreground">Pause instead?</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Pausing for 30 days keeps your benefits intact. You won't be charged. After 30 days, your plan will resume automatically.
        </p>
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" className="flex-1 rounded-xl h-9 text-xs">
            Pause for 30 days
          </Button>
          <Button size="sm" variant="ghost" className="rounded-xl h-9 text-xs text-destructive" onClick={() => setStep('reason')}>
            Cancel anyway
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <p className="text-xs font-semibold text-destructive">Cancel {planName}?</p>
        </div>
        <p className="text-xs text-muted-foreground">
          You'll lose: priority queue, always-active sites, 25GB uploads, 10,000 API tokens/day, and your Supporter badge.
        </p>
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" className="flex-1 rounded-xl h-9 text-xs" onClick={() => setStep('pause')}>
            Pause instead
          </Button>
          <Button size="sm" variant="ghost" className="rounded-xl h-9 text-xs text-destructive" onClick={() => setStep('reason')}>
            Yes, cancel
          </Button>
        </div>
        <button onClick={() => setStep(null)} className="w-full text-center text-[10px] text-muted-foreground/50 hover:text-muted-foreground pt-1">
          Never mind
        </button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-xl border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400 text-xs"
      onClick={() => setStep('confirm')}
    >
      Cancel subscription
    </Button>
  );
};

export default CancelSubscriptionFlow;

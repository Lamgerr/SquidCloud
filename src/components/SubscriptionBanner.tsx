import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Crown, Sparkles, X, Bell } from '@/lib/icon-map';
import type { PendingNotification } from '@/hooks/useSubscriptionNotifications';

interface SubscriptionBannerProps {
  notification: PendingNotification;
  onDismiss: (id: string) => void;
  onSnooze: (id: string) => void;
}

const SubscriptionBanner: React.FC<SubscriptionBannerProps> = ({ notification, onDismiss, onSnooze }) => {
  const navigate = useNavigate();
  const { stage, plan_type, billing_period } = notification;
  const planName = plan_type === 'supporter-plus' ? 'Supporter+' : 'Supporter';

  const daysLeft = stage === 1 ? 'a few' : stage === 2 ? 'a couple' : stage === 3 ? '1' : '';

  return (
    <div className={cn(
      'relative flex items-center gap-3 px-4 py-2.5 border-l-4 border-l-primary',
      'bg-primary/[0.04] border-b border-primary/10 text-sm',
    )}>
      <Bell className="h-4 w-4 text-primary flex-shrink-0" />
      <p className="flex-1 text-foreground/80 text-xs md:text-sm">
        Your <strong className="text-foreground">{planName}</strong> {billing_period} plan{' '}
        {stage <= 3 ? `expires in ${daysLeft} day${stage === 3 ? '' : 's'}` : 'has ended'}
      </p>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          size="sm"
          className="h-7 text-xs rounded-lg px-3 bg-primary/15 text-primary hover:bg-primary/25 border-0"
          onClick={() => navigate('/checkout?plan=' + plan_type + '&billing=' + billing_period)}
        >
          <Crown className="h-3 w-3 mr-1" /> Renew now
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 rounded-lg p-0 text-muted-foreground/50 hover:text-muted-foreground"
          onClick={() => onSnooze(notification.id)}
          title="Remind me later"
        >
          <Bell className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 rounded-lg p-0 text-muted-foreground/50 hover:text-muted-foreground"
          onClick={() => onDismiss(notification.id)}
          title="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

export default SubscriptionBanner;

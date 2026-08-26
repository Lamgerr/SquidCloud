import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Crown, Bell, X } from '@/lib/icon-map';
import type { PendingNotification } from '@/hooks/useSubscriptionNotifications';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface SubscriptionPopupProps {
  notification: PendingNotification;
  onDismiss: (id: string) => void;
}

const SubscriptionPopup: React.FC<SubscriptionPopupProps> = ({
  notification,
  onDismiss,
}) => {
  const navigate = useNavigate();
  const { stage, plan_type, billing_period } = notification;
  const planName = plan_type === 'supporter-plus' ? 'Supporter+' : 'Supporter';

  const daysLeft =
    stage === 1
      ? 'a few'
      : stage === 2
      ? 'a couple'
      : stage === 3
      ? '1'
      : '';

  return (
    <Dialog open={true} onOpenChange={() => onDismiss(notification.id)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-500" />
            Subscription Notice
          </DialogTitle>
          <DialogDescription>
            Your <strong>{planName}</strong> {billing_period} plan{' '}
            {stage <= 3
              ? `expires in ${daysLeft} day${stage === 3 ? '' : 's'}`
              : 'has ended'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-end gap-3 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDismiss(notification.id)}
          >
            <X className="h-4 w-4" />
            Dismiss
          </Button>
          <Button
            size="sm"
            className="bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border-0"
            onClick={() => {
              navigate('/checkout?plan=' + plan_type + '&billing=' + billing_period);
              onDismiss(notification.id);
            }}
          >
            <Crown className="h-3.5 w-3.5 mr-1.5" /> Renew now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionPopup;
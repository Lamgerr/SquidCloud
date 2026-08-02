import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface PendingNotification {
  id: string;
  stage: number;
  notification_type: 'popup' | 'banner';
  plan_type: string;
  billing_period: string;
  triggered_at: string;
  upsell_offer_shown: boolean;
  metadata: any;
}

export function useSubscriptionNotifications() {
  const { user, profile } = useAuth();
  const [pending, setPending] = useState<PendingNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) { setPending([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('subscription-manager/pending-notifications', { method: 'GET' });
      if (error) throw error;
      setPending(data || []);
    } catch (e) {
      console.error('Failed to fetch pending notifications:', e);
      setPending([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user && profile) refresh();
  }, [user, profile, refresh]);

  const dismiss = async (notificationId: string) => {
    try {
      await supabase.functions.invoke('subscription-manager/dismiss-popup', {
        body: { notification_id: notificationId },
      });
      setPending(prev => prev.filter(p => p.id !== notificationId));
    } catch (e) {
      console.error('Failed to dismiss notification:', e);
    }
  };

  const snooze = async (notificationId: string) => {
    try {
      await supabase.functions.invoke('subscription-manager/snooze-banner', {
        body: { notification_id: notificationId },
      });
      setPending(prev => prev.filter(p => p.id !== notificationId));
    } catch (e) {
      console.error('Failed to snooze notification:', e);
    }
  };

  const hasPopup = pending.some(n => n.notification_type === 'popup');
  const hasBanner = pending.some(n => n.notification_type === 'banner');

  const popups = pending.filter(n => n.notification_type === 'popup');
  const banners = pending.filter(n => n.notification_type === 'banner');

  return { pending, popups, banners, hasPopup, hasBanner, loading, refresh, dismiss, snooze };
}

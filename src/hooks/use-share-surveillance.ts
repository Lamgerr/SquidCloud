import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DecryptEvent {
  share_id: string;
  success: boolean;
  failure_reason?: string;
  geo_city?: string;
  geo_country?: string;
  created_at: string;
}

export function useShareSurveillance(shareId?: string | null) {
  const { toast } = useToast();
  const subscribedShares = useRef<Set<string>>(new Set());

  const notifyDecryptAttempt = useCallback((event: DecryptEvent) => {
    const status = event.success ? 'successful' : 'failed';
    const location = [event.geo_city, event.geo_country].filter(Boolean).join(', ');
    const locationStr = location ? ` from ${location}` : '';

    toast({
      title: event.success ? 'Decrypt granted' : 'Decrypt blocked',
      description: `${status} attempt for share${locationStr}${event.failure_reason ? ` — ${event.failure_reason}` : ''}`,
      variant: event.success ? 'default' : 'destructive',
      duration: 4000,
    });
  }, [toast]);

  useEffect(() => {
    if (!shareId || subscribedShares.current.has(shareId)) return;
    subscribedShares.current.add(shareId);

    const channel = supabase
      .channel(`share-surveillance-${shareId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'share_decrypt_logs',
          filter: `share_id=eq.${shareId}`,
        },
        (payload) => {
          const event = payload.new as DecryptEvent;
          notifyDecryptAttempt(event);
        }
      )
      .subscribe();

    return () => {
      subscribedShares.current.delete(shareId);
      supabase.removeChannel(channel);
    };
  }, [shareId, notifyDecryptAttempt]);

  return { notifyDecryptAttempt };
}

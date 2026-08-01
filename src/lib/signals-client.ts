// Signals: client-side store for the SquidCloud notification platform.
// - Fetches the latest signals once per user
// - Subscribes to Realtime (RLS-filtered to the signed-in user only)
// - Fires a toast for every new signal while the user is in-app
// - Clearing a signal DELETES its row from the DB (disappears on all devices)

import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type SignalSeverity = 'info' | 'warning' | 'urgent';

export interface Signal {
  id: string;
  service_id: 'cloudbliss' | 'squidveil' | 'signals';
  type: string;
  severity: SignalSeverity;
  title: string;
  body: string | null;
  link: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

const MAX_SIGNALS = 100;
const SEVERITY_ORDER: Record<SignalSeverity, number> = { urgent: 0, warning: 1, info: 2 };

let signals: Signal[] = [];
let userId: string | null = null;
let channel: ReturnType<typeof supabase.channel> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

function sortAndCap(list: Signal[]): Signal[] {
  return [...list]
    .sort((a, b) => {
      const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (sev !== 0) return sev;
      return b.created_at.localeCompare(a.created_at);
    })
    .slice(0, MAX_SIGNALS);
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export const signalsStore = {
  getSignals(): Signal[] {
    return signals;
  },

  getUnreadCount(): number {
    return signals.filter((s) => !s.read_at).length;
  },

  timeAgo,

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async init(uid: string): Promise<void> {
    if (userId === uid && channel) return;
    userId = uid;

    const { data } = await supabase
      .from('signals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(MAX_SIGNALS);

    signals = sortAndCap((data ?? []) as Signal[]);
    notify();

    if (channel) {
      supabase.removeChannel(channel);
    }

    channel = supabase
      .channel('signals-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'signals', filter: `user_id=eq.${uid}` },
        (payload) => {
          const incoming = payload.new as Signal;
          if (signals.some((s) => s.id === incoming.id)) return;
          signals = sortAndCap([incoming, ...signals]);
          notify();
          toast({
            title: incoming.title,
            description: incoming.body ?? undefined,
            variant: incoming.severity === 'urgent' ? 'destructive' : 'default',
            duration: incoming.severity === 'urgent' ? 8000 : 5000,
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'signals', filter: `user_id=eq.${uid}` },
        (payload) => {
          const updated = payload.new as Signal;
          signals = signals.map((s) => (s.id === updated.id ? updated : s));
          notify();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'signals', filter: `user_id=eq.${uid}` },
        (payload) => {
          const id = (payload.old as Signal).id;
          signals = signals.filter((s) => s.id !== id);
          notify();
        }
      )
      .subscribe();
  },

  async markRead(id: string): Promise<void> {
    await supabase.from('signals').update({ read_at: new Date().toISOString() }).eq('id', id);
  },

  async markAllRead(): Promise<void> {
    await supabase.from('signals').update({ read_at: new Date().toISOString() }).is('read_at', null);
  },

  async clear(id: string): Promise<void> {
    await supabase.from('signals').delete().eq('id', id);
  },

  async clearAll(): Promise<void> {
    await supabase.from('signals').delete().not('id', 'is', null);
  },
};

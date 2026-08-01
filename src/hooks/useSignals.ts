import { useEffect, useSyncExternalStore } from 'react';
import { signalsStore } from '@/lib/signals-client';

export function useSignals(uid: string | null | undefined) {
  const signals = useSyncExternalStore(
    signalsStore.subscribe,
    signalsStore.getSignals,
    signalsStore.getSignals
  );

  useEffect(() => {
    if (uid) {
      void signalsStore.init(uid);
    }
  }, [uid]);

  return {
    signals,
    unreadCount: signalsStore.getUnreadCount(),
    timeAgo: signalsStore.timeAgo,
    markRead: signalsStore.markRead,
    markAllRead: signalsStore.markAllRead,
    clear: signalsStore.clear,
    clearAll: signalsStore.clearAll,
  };
}

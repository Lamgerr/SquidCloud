import { useAuth } from '@/contexts/AuthContext';
import { useSignals } from '@/hooks/useSignals';

// Mounted once inside the authenticated app: keeps the Signals Realtime
// subscription alive and surfaces toasts for new signals on every page.
export function SignalsBridge() {
  const { user } = useAuth();
  useSignals(user?.id);
  return null;
}

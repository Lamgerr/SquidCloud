import { useEffect, useState, useCallback, useRef } from 'react';
import { squidguard } from '@/services/squidguard-shield';

export function useSquidGuard() {
  const [devtoolsOpen, setDevtoolsOpen] = useState(squidguard.isDevtoolsOpen);
  const [warnings, setWarnings] = useState<string[]>([]);
  const initializedRef = useRef(false);

  const requireAction = useCallback(async (action: string, resource: string) => {
    return squidguard.requireActionToken(action, resource);
  }, []);

  const dismissOverlay = useCallback(() => {
    setDevtoolsOpen(false);
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    squidguard.start();
    squidguard.scanForTokens();

    const unsubDtc = squidguard.subscribe((open) => {
      setDevtoolsOpen(open);
    });

    const unsubTkn = squidguard.onTokenLeak((found) => {
      setWarnings(prev => [...new Set([...prev, ...found])]);
    });

    return () => {
      unsubDtc();
      unsubTkn();
      squidguard.stop();
    };
  }, []);

  return { devtoolsOpen, warnings, requireAction, dismissOverlay };
}

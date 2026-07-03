import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useBiometricAuthContext } from '@/contexts/BiometricAuthContext';
import { Loader2 } from '@/lib/icon-map';

interface AppStartupBiometricCheckProps {
  children: React.ReactNode;
}

export const AppStartupBiometricCheck: React.FC<AppStartupBiometricCheckProps> = ({ children }) => {
  const { hasBiometric, requireBiometric, isLoading, settings } = useBiometricAuthContext();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const startupCheckCompleted = useRef(false);

  const markAuthorized = useCallback(() => {
    startupCheckCompleted.current = true;
    setIsAuthorized(true);
    setHasChecked(true);
  }, []);

  const checkStartupAuth = useCallback(async () => {
    if (startupCheckCompleted.current || hasChecked) return;
    if (isLoading) return;

    if (!hasBiometric || !settings?.requireOnStartup) {
      markAuthorized();
      return;
    }

    if (settings.lastAuth) {
      const lastAuth = new Date(settings.lastAuth).getTime();
      const now = Date.now();
      const minutesSinceAuth = (now - lastAuth) / 60000;
      if (minutesSinceAuth < settings.timeoutMinutes) {
        markAuthorized();
        return;
      }
    }

    await requireBiometric('app_startup', () => {
      markAuthorized();
    });
  }, [hasBiometric, hasChecked, isLoading, markAuthorized, requireBiometric, settings]);

  useEffect(() => {
    if (!hasChecked) {
      checkStartupAuth();
    }
  }, [checkStartupAuth, hasChecked]);

  if (!hasChecked && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Initializing...</p>
        </div>
      </div>
    );
  }

  if (!hasChecked) return null;

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">Please authenticate to continue</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

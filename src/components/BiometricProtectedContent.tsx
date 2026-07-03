import React, { useEffect, useState } from 'react';
import { useBiometricAuthContext } from '@/contexts/BiometricAuthContext';
import { SecurityOperation } from '@/services/biometricAuthService';
import { Loader2 } from '@/lib/icon-map';

interface BiometricProtectedContentProps {
  children: React.ReactNode;
  operation: SecurityOperation;
  fallback?: React.ReactNode;
}

export const BiometricProtectedContent: React.FC<BiometricProtectedContentProps> = ({
  children,
  operation,
  fallback
}) => {
  const { hasBiometric, requireBiometric, isLoading } = useBiometricAuthContext();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkAuth();
  }, [hasBiometric, operation]);

  const checkAuth = async () => {
    setIsChecking(true);

    if (!hasBiometric) {
      setIsAuthorized(true);
      setIsChecking(false);
      return;
    }

    await requireBiometric(operation, () => {
      setIsAuthorized(true);
    });

    setIsChecking(false);
  };

  if (isLoading || isChecking) {
    return fallback || (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthorized && hasBiometric) {
    return fallback || null;
  }

  return <>{children}</>;
};

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { biometricAuthService, type SecurityOperation, type BiometricSettings } from '@/services/biometricAuthService';
import BiometricAuthDialog from '@/components/BiometricAuthDialog';

interface BiometricAuthContextType {
  settings: BiometricSettings | null;
  isLoading: boolean;
  hasBiometric: boolean;
  requireBiometric: (operation: SecurityOperation, onSuccess: () => void) => Promise<void>;
  verifyOperationNow: (operation: SecurityOperation) => Promise<boolean>;
  refreshSettings: () => Promise<void>;
}

const BiometricAuthContext = createContext<BiometricAuthContextType | undefined>(undefined);

export const BiometricAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<BiometricSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasBiometric, setHasBiometric] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<SecurityOperation | null>(null);
  const [onSuccessCallback, setOnSuccessCallback] = useState<(() => void) | null>(null);
  const pendingResolverRef = useRef<((value: boolean) => void) | null>(null);

  const refreshSettings = useCallback(async () => {
    if (!user) {
      setSettings(null);
      setHasBiometric(false);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const userSettings = await biometricAuthService.getSettings(user.id);
      setHasBiometric(userSettings?.biometricEnabled ?? false);
      setSettings(userSettings);
    } catch (error) {
      console.error('Failed to load biometric settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshSettings();
  }, [user]);

  const requireBiometric = useCallback(async (
    operation: SecurityOperation,
    onSuccess: () => void
  ) => {
    if (!user) {
      onSuccess();
      return;
    }

    if (!hasBiometric) {
      onSuccess();
      return;
    }

    const isRequired = await biometricAuthService.requiresAuth(user.id, operation);

    if (!isRequired) {
      onSuccess();
      return;
    }

    setCurrentOperation(operation);
    setOnSuccessCallback(() => onSuccess);
    setShowDialog(true);
  }, [user, hasBiometric]);

  const verifyOperationNow = useCallback(async (operation: SecurityOperation): Promise<boolean> => {
    if (!user) return false;
    if (!hasBiometric) return true;

    const isRequired = await biometricAuthService.requiresAuth(user.id, operation);
    if (!isRequired) return true;

    return await new Promise<boolean>((resolve) => {
      setCurrentOperation(operation);
      setOnSuccessCallback(null);
      pendingResolverRef.current = resolve;
      setShowDialog(true);
    });
  }, [user, hasBiometric]);

  const handleSuccess = useCallback(async () => {
    const operation = currentOperation;

    if (operation && user) {
      await biometricAuthService.markStartupAuth(user.id);
    }

    setShowDialog(false);

    if (onSuccessCallback) {
      onSuccessCallback();
    }

    if (pendingResolverRef.current) {
      pendingResolverRef.current(true);
    }

    setCurrentOperation(null);
    setOnSuccessCallback(null);
    pendingResolverRef.current = null;
  }, [currentOperation, onSuccessCallback, user]);

  const handleCancel = useCallback(() => {
    setShowDialog(false);
    if (pendingResolverRef.current) {
      pendingResolverRef.current(false);
    }
    setCurrentOperation(null);
    setOnSuccessCallback(null);
    pendingResolverRef.current = null;
  }, []);

  const value: BiometricAuthContextType = {
    settings,
    isLoading,
    hasBiometric,
    requireBiometric,
    verifyOperationNow,
    refreshSettings
  };

  return (
    <BiometricAuthContext.Provider value={value}>
      {children}

      <BiometricAuthDialog
        open={showDialog}
        onClose={handleCancel}
        onSuccess={handleSuccess}
        title="SquidCloud Locked"
        description={currentOperation ? `Verify to ${getOperationDescription(currentOperation)}` : undefined}
      />
    </BiometricAuthContext.Provider>
  );
};

export const useBiometricAuthContext = () => {
  const context = useContext(BiometricAuthContext);
  if (context === undefined) {
    throw new Error('useBiometricAuthContext must be used within a BiometricAuthProvider');
  }
  return context;
};

function getOperationDescription(operation: SecurityOperation): string {
  switch (operation) {
    case 'open_vault':
      return 'access SquidVault';
    case 'create_share':
      return 'create a share link';
    case 'revoke_share':
      return 'revoke sharing access';
    case 'view_security_settings':
      return 'view security settings';
    case 'delete_files':
      return 'delete files';
    case 'export_data':
      return 'export data';
    default:
      return 'continue';
  }
}

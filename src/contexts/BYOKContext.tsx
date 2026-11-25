/**
 * BYOK Context - Provides encryption state and dialogs throughout the app
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBYOK } from '@/hooks/use-byok';
import { KeyUnlockDialog } from '@/components/encryption/KeyUnlockDialog';
import { sessionKeyManager } from '@/services/session-key-manager';
import { cn } from '@/lib/utils';
import {
  registerEphemeralBYOKPromptHandler,
  registerKeySelectionHandler,
  registerMandatoryBYOKSetupHandler,
  requestEphemeralBYOKKey,
  type EphemeralBYOKPromptRequest,
} from '@/services/ephemeral-byok-prompt';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { KeyRound, Eye, EyeOff } from '@/lib/icon-map';
import { BYOKMasterKeySetup } from '@/components/encryption/BYOKMasterKeySetup';
import { UploadKeySelectionDialog } from '@/components/encryption/UploadKeySelectionDialog';
import type { KeySelectionResult } from '@/components/encryption/UploadKeySelectionDialog';
import {
  deriveKeyWithArgon2id,
  base64ToArrayBuffer,
} from '@/services/byok-encryption';

export type KeySelectionHandler = (result: KeySelectionResult) => void;

interface BYOKContextValue {
  isEnabled: boolean;
  isUnlocked: boolean;
  isLoading: boolean;
  requireUnlock: (onSuccess?: () => void, onCancel?: () => void) => void;
  lockKey: () => void;
  showKeySetup: (onComplete?: () => void) => void;
  requestKeySelection: (fileName: string, fileSize: number) => Promise<KeySelectionResult | null>;
}

const BYOKContext = createContext<BYOKContextValue | null>(null);

export function BYOKProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { settings, hasSessionKey, lockAccountKey, isLoading, getUploadKeySelection, setKeySelectionPref } = useBYOK();
  
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [showEphemeralKeyDialog, setShowEphemeralKeyDialog] = useState(false);
  const [ephemeralKeyInput, setEphemeralKeyInput] = useState('');
  const [showEphemeralKey, setShowEphemeralKey] = useState(false);
  const [ephemeralPromptRequest, setEphemeralPromptRequest] = useState<EphemeralBYOKPromptRequest>({});
  const [ephemeralResolver, setEphemeralResolver] = useState<((value: string | null) => void) | null>(null);
  const [unlockCallbacks, setUnlockCallbacks] = useState<{
    onSuccess?: () => void;
    onCancel?: () => void;
  }>({});
  const [showKeySetup, setShowKeySetup] = useState(false);
  const [showUploadKeyDialog, setShowUploadKeyDialog] = useState(false);
  const [keySetupCallback, setKeySetupCallback] = useState<(() => void) | undefined>();
  const [pendingKeySelection, setPendingKeySelection] = useState<{
    fileName: string;
    fileSize: number;
    resolve: (result: KeySelectionResult | null) => void;
  } | null>(null);

  // Require unlock - shows dialog if key is not available
  const requireUnlock = useCallback((onSuccess?: () => void, onCancel?: () => void) => {
    if (hasSessionKey) {
      onSuccess?.();
      return;
    }

    if (!settings?.isEnabled) {
      onCancel?.();
      return;
    }
    
    setUnlockCallbacks({ onSuccess, onCancel });
    setShowUnlockDialog(true);
  }, [hasSessionKey, settings?.isEnabled]);

  const handleUnlockSuccess = useCallback(() => {
    setShowUnlockDialog(false);
    unlockCallbacks.onSuccess?.();
    setUnlockCallbacks({});
  }, [unlockCallbacks]);

  const handleUnlockCancel = useCallback(() => {
    setShowUnlockDialog(false);
    unlockCallbacks.onCancel?.();
    setUnlockCallbacks({});
  }, [unlockCallbacks]);

  const lockKey = useCallback(() => {
    lockAccountKey();
  }, [lockAccountKey]);

  // Clear session on logout
  useEffect(() => {
    if (!user) {
      sessionKeyManager.clearAll();
    }
  }, [user]);

  useEffect(() => {
    const unregister = registerEphemeralBYOKPromptHandler((request) => {
      return new Promise<string | null>((resolve) => {
        if (ephemeralResolver) {
          ephemeralResolver(null);
        }

        setEphemeralPromptRequest(request || {});
        setEphemeralKeyInput('');
        setShowEphemeralKey(false);
        setEphemeralResolver(() => resolve);
        setShowEphemeralKeyDialog(true);
      });
    });

    return unregister;
  }, [ephemeralResolver]);

  useEffect(() => {
    const unregister = registerKeySelectionHandler((request) => {
      const { shouldPrompt, mode } = getUploadKeySelection();

      if (!shouldPrompt) {
        if (mode === 'always_saved') return Promise.resolve({ mode: 'saved', dontAskAgain: true });
        if (mode === 'always_unique') return Promise.resolve({ mode: 'unique', dontAskAgain: true });
        if (mode === 'always_custom') {
          return requestEphemeralBYOKKey({
            fileName: request.fileName,
            title: 'Enter Custom Encryption Key',
            description: 'Provide a key for this file',
          }).then((key) => key ? { mode: 'custom', customKey: key, dontAskAgain: true } : null);
        }
      }

      return new Promise<KeySelectionResult | null>((resolve) => {
        setPendingKeySelection({
          fileName: request.fileName,
          fileSize: request.fileSize,
          resolve,
        });
        setShowUploadKeyDialog(true);
      });
    });

    return unregister;
  }, [getUploadKeySelection]);

  useEffect(() => {
    const unregister = registerMandatoryBYOKSetupHandler(() => {
      return new Promise<boolean>((resolve) => {
        setKeySetupCallback(() => {
          resolve(true);
          setKeySetupCallback(undefined);
        });
        setShowKeySetup(true);
      });
    });

    return unregister;
  }, []);

  const resolveEphemeralPrompt = useCallback((value: string | null) => {
    if (ephemeralResolver) {
      ephemeralResolver(value);
    }
    setEphemeralResolver(null);
    setEphemeralKeyInput('');
    setShowEphemeralKey(false);
    setEphemeralPromptRequest({});
    setShowEphemeralKeyDialog(false);
  }, [ephemeralResolver]);

  const handleEphemeralConfirm = useCallback(() => {
    const normalized = ephemeralKeyInput.trim();
    if (!normalized) return;
    resolveEphemeralPrompt(normalized);
  }, [ephemeralKeyInput, resolveEphemeralPrompt]);

  const handleEphemeralCancel = useCallback(() => {
    resolveEphemeralPrompt(null);
  }, [resolveEphemeralPrompt]);

  const showKeySetupDialog = useCallback((onComplete?: () => void) => {
    setKeySetupCallback(() => onComplete);
    setShowKeySetup(true);
  }, []);

  const handleKeySetupComplete = useCallback(() => {
    setShowKeySetup(false);
    keySetupCallback?.();
    setKeySetupCallback(undefined);
  }, [keySetupCallback]);

  const handleKeySetupSkip = useCallback(() => {
    setShowKeySetup(false);
    setKeySetupCallback(undefined);
  }, []);

  const requestKeySelection = useCallback(async (
    fileName: string,
    fileSize: number
  ): Promise<KeySelectionResult | null> => {
    const { shouldPrompt, mode } = getUploadKeySelection();

    if (!shouldPrompt) {
      if (mode === 'always_saved') return { mode: 'saved', dontAskAgain: true };
      if (mode === 'always_unique') return { mode: 'unique', dontAskAgain: true };
      if (mode === 'always_custom') {
        const key = await requestEphemeralBYOKKey({
          fileName,
          title: 'Enter Custom Encryption Key',
          description: 'Provide a key for this file',
        });
        if (!key) return null;
        return { mode: 'custom', customKey: key, dontAskAgain: true };
      }
    }

    return new Promise((resolve) => {
      setPendingKeySelection({ fileName, fileSize, resolve });
      setShowUploadKeyDialog(true);
    });
  }, [getUploadKeySelection]);

  const handleKeySelectionConfirm = useCallback(async (result: KeySelectionResult) => {
    setShowUploadKeyDialog(false);
    const resolve = pendingKeySelection?.resolve;
    setPendingKeySelection(null);

    if (result.dontAskAgain) {
      await setKeySelectionPref(
        result.mode === 'saved' ? 'always_saved' :
        result.mode === 'unique' ? 'always_unique' : 'always_custom',
        true
      );
    }

    resolve?.(result);
  }, [pendingKeySelection, setKeySelectionPref]);

  const handleKeySelectionCancel = useCallback(() => {
    setShowUploadKeyDialog(false);
    pendingKeySelection?.resolve(null);
    setPendingKeySelection(null);
  }, [pendingKeySelection]);

  const value: BYOKContextValue = {
    isEnabled: settings?.isEnabled ?? false,
    isUnlocked: hasSessionKey,
    isLoading,
    requireUnlock,
    lockKey,
    showKeySetup: showKeySetupDialog,
    requestKeySelection,
  };

  return (
    <BYOKContext.Provider value={value}>
      {children}
      
      <KeyUnlockDialog
        open={showUnlockDialog}
        onOpenChange={setShowUnlockDialog}
        onSuccess={handleUnlockSuccess}
        onCancel={handleUnlockCancel}
      />

      <BYOKMasterKeySetup
        open={showKeySetup}
        onOpenChange={setShowKeySetup}
        onComplete={handleKeySetupComplete}
        onSkip={handleKeySetupSkip}
        isMandatory={true}
      />

      {pendingKeySelection && (
        <UploadKeySelectionDialog
          open={showUploadKeyDialog}
          onOpenChange={(v) => { if (!v) handleKeySelectionCancel(); }}
          fileName={pendingKeySelection.fileName}
          fileSize={pendingKeySelection.fileSize}
          onConfirm={handleKeySelectionConfirm}
          onCancel={handleKeySelectionCancel}
        />
      )}

      <Dialog
        open={showEphemeralKeyDialog}
        onOpenChange={(open) => {
          if (!open) {
            handleEphemeralCancel();
          }
        }}
      >
        <DialogContent className="sm:max-w-md border-border/60 bg-card/95 backdrop-blur-xl z-[9999]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <KeyRound className="h-4 w-4 text-primary" />
              {ephemeralPromptRequest.title || 'Enter BYOK Key'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {ephemeralPromptRequest.description || 'A key is required to decrypt this file. The key is used once and never stored.'}
            </DialogDescription>
          </DialogHeader>

          {ephemeralPromptRequest.fileName && (
            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              File: {ephemeralPromptRequest.fileName}
            </div>
          )}

<div className="space-y-2">
            <Label htmlFor="ephemeral-byok-key">Encryption key</Label>
            <div className="relative">
              <Input
                id="ephemeral-byok-key"
                type={showEphemeralKey ? 'text' : 'password'}
                value={ephemeralKeyInput}
                onChange={(event) => setEphemeralKeyInput(event.target.value)}
                placeholder="Enter your BYOK key"
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleEphemeralConfirm();
                  }
                }}
                className="pr-10"
              />
              <button
                type="button"
                className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2",
                  "flex items-center justify-center",
                  "h-8 w-8 rounded-lg",
                  "text-muted-foreground",
                  "hover:bg-accent/20 transition-colors duration-150"
                )}
                onClick={() => setShowEphemeralKey(prev => !prev)}
              >
                {showEphemeralKey ? <EyeOff className="h-4 w-4 opacity-60" /> : <Eye className="h-4 w-4 opacity-60" />}
              </button>
            </div>
          </div>

<div className="flex items-center justify-end gap-2">
             <Button variant="outline" onClick={handleEphemeralCancel} className="transition-none">
               Cancel
             </Button>
             <Button onClick={handleEphemeralConfirm} disabled={!ephemeralKeyInput.trim()} className="transition-none">
               Use key now
             </Button>
           </div>
        </DialogContent>
      </Dialog>
    </BYOKContext.Provider>
  );
}

export function useBYOKContext() {
  const context = useContext(BYOKContext);
  if (!context) {
    throw new Error('useBYOKContext must be used within a BYOKProvider');
  }
  return context;
}

// Optional hook that doesn't throw
export function useBYOKOptional() {
  return useContext(BYOKContext);
}

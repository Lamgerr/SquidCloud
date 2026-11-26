import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Key, Shield, Eye, EyeOff, Loader2, AlertTriangle, CheckCircle2, Info
} from '@/lib/icon-map';
import { cn } from '@/lib/utils';
import { useBYOK } from '@/hooks/use-byok';

interface BYOKMasterKeySetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  onSkip?: () => void;
  isMandatory?: boolean;
}

export function BYOKMasterKeySetup({
  open, onOpenChange, onComplete, onSkip, isMandatory = true
}: BYOKMasterKeySetupProps) {
  const { setupAccountKey, isLoading } = useBYOK();
  const [step, setStep] = useState<'intro' | 'create' | 'confirm' | 'backup' | 'done'>('intro');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [backupAcknowledged, setBackupAcknowledged] = useState(false);
  const [generatedPassphrase, setGeneratedPassphrase] = useState('');
  const [mode, setMode] = useState<'create' | 'passphrase'>('create');
  const [error, setError] = useState('');

  const reset = () => {
    setStep('intro');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setBackupAcknowledged(false);
    setGeneratedPassphrase('');
    setMode('create');
    setError('');
  };

  const generatePassphrase = () => {
    const words = ['aurora','cipher','delta','echo','forge','glacier','horizon','ivory','jade','kraken','lunar','mystic','nova','onyx','photon','quartz','raven','solar','titan','umbra','vortex','winter','xenon','yarrow','zenith'];
    const parts: string[] = [];
    for (let i = 0; i < 4; i++) {
      parts.push(words[crypto.getRandomValues(new Uint32Array(1))[0] % words.length]);
    }
    const suffix = Array.from(crypto.getRandomValues(new Uint8Array(4)), b => b.toString(16).padStart(2, '0')).join('');
    const passphrase = parts.join('-') + '-' + suffix;
    setGeneratedPassphrase(passphrase);
    setPassword(passphrase);
    setConfirmPassword(passphrase);
  };

  const handleNext = () => {
    if (step === 'intro') {
      if (mode === 'passphrase') {
        generatePassphrase();
      }
      setStep('create');
    } else if (step === 'create') {
      if (password.length < 8) {
        setError('Key must be at least 8 characters');
        return;
      }
      if (mode === 'create') {
        setStep('confirm');
      } else {
        setStep('backup');
      }
      setError('');
    } else if (step === 'confirm') {
      if (password !== confirmPassword) {
        setError('Keys do not match');
        return;
      }
      setError('');
      if (mode === 'create') {
        setStep('backup');
      } else {
        void handleSetup();
      }
    }
  };

  const handleSetup = async () => {
    const success = await setupAccountKey(password);
    if (success) {
      setStep('done');
      setTimeout(() => {
        reset();
        onComplete();
        onOpenChange(false);
      }, 1500);
    } else {
      setError('Failed to set up key. Please try again.');
    }
  };

  const isStepValid = () => {
    if (step === 'create') return password.length >= 8;
    if (step === 'confirm') return password === confirmPassword && password.length >= 8;
    if (step === 'backup') return backupAcknowledged;
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !isMandatory) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md border-border/60 bg-card/95 backdrop-blur-xl z-[9999]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Shield className="h-5 w-5 text-primary" />
            {step === 'intro' && 'Encryption Key Setup'}
            {step === 'create' && (mode === 'create' ? 'Create Your Key' : 'Your Generated Key')}
            {step === 'confirm' && 'Confirm Your Key'}
            {step === 'backup' && 'Back Up Your Key'}
            {step === 'done' && 'Setup Complete'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isMandatory && step === 'intro' && 'You must set up an encryption key before uploading files.'}
            {step === 'create' && mode === 'create' && 'Enter a strong passphrase (min 8 characters).'}
            {step === 'create' && mode !== 'create' && 'Save this key — it will not be shown again.'}
            {step === 'confirm' && 'Re-enter your key to confirm.'}
            {step === 'backup' && 'Your key is stored only on this device. Back it up now.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {step === 'intro' && (
            <>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    Your encryption key is used to protect all your files. SquidCloud never stores your key — only a verification hash.
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className={cn('flex-1 h-11', mode === 'create' && 'border-primary/40 bg-primary/10')}
                  onClick={() => setMode('create')}
                >
                  <Key className="h-4 w-4 mr-2" />
                  Create My Key
                </Button>
                <Button
                  variant="outline"
                  className={cn('flex-1 h-11', mode === 'passphrase' && 'border-primary/40 bg-primary/10')}
                  onClick={() => setMode('passphrase')}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Generate Secure Key
                </Button>
              </div>

              {!isMandatory && onSkip && (
                <Button variant="ghost" className="w-full text-muted-foreground" onClick={onSkip}>
                  Skip for now
                </Button>
              )}
            </>
          )}

          {step === 'create' && mode === 'create' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-foreground/70">Encryption Key</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter a strong passphrase (min 8 characters)"
                    className="pr-10"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                  />
                  <button
                    type="button"
                    className={cn(
                      "absolute right-2 top-1/2 -translate-y-1/2",
                      "flex items-center justify-center h-8 w-8 rounded-lg",
                      "text-muted-foreground hover:bg-accent/20"
                    )}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'create' && mode === 'passphrase' && generatedPassphrase && (
            <div className="space-y-3">
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-100">
                    This key will be shown only once. Copy it now.
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-black/20 p-4">
                <code className="block text-sm font-mono text-foreground break-all select-all">
                  {generatedPassphrase}
                </code>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => { navigator.clipboard.writeText(generatedPassphrase); }}>
                  Copy to Clipboard
                </Button>
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-foreground/70">Confirm Key</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your key"
                    className="pr-10"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                  />
                </div>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-400">Keys do not match</p>
              )}
            </div>
          )}

          {step === 'backup' && (
            <div className="space-y-3">
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    If you lose this key, <strong className="text-amber-100">your encrypted files will be permanently unrecoverable</strong>. SquidCloud cannot reset or recover your key.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-black/20">
                <Checkbox
                  id="backup-ack"
                  checked={backupAcknowledged}
                  onCheckedChange={(c) => setBackupAcknowledged(c === true)}
                  className="mt-1"
                />
                <label htmlFor="backup-ack" className="text-xs text-muted-foreground cursor-pointer">
                  I have backed up my key in a secure location and understand that lost keys cannot be recovered.
                </label>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-6">
              <CheckCircle2 className="h-12 w-12 text-emerald-400 mb-3" />
              <p className="text-sm font-medium text-foreground">Encryption key set up successfully</p>
              <p className="text-xs text-muted-foreground mt-1">You can now upload files securely</p>
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2">
          {step !== 'intro' && step !== 'done' && (
            <Button variant="outline" onClick={() => {
              if (step === 'create') setStep('intro');
              else if (step === 'confirm') setStep('create');
              else if (step === 'backup') setStep(mode === 'create' ? 'confirm' : 'create');
            }}>
              Back
            </Button>
          )}
          {step !== 'done' && (
            <Button onClick={handleNext} disabled={!isStepValid() || isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {step === 'intro' ? 'Get Started' :
               step === 'create' ? 'Continue' :
               step === 'confirm' ? 'Continue' :
               step === 'backup' ? 'Finish Setup' : 'Continue'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

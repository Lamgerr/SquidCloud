import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ShieldCheck, AlertCircle } from '@/lib/icon-map';
import { mfaService } from '@/services/mfa-service';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface MfaChallengeScreenProps {
  onVerified: () => void;
  onCancel: () => void;
}

const MfaChallengeScreen: React.FC<MfaChallengeScreenProps> = ({ onVerified, onCancel }) => {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [factors, setFactors] = useState<{ id: string; friendly_name: string }[]>([]);
  const [selectedFactor, setSelectedFactor] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFactors();
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, [selectedFactor]);

  const loadFactors = async () => {
    const data = await mfaService.listFactors();
    const verified = data.filter(f => f.status === 'verified');
    setFactors(verified);
    if (verified.length > 0) {
      setSelectedFactor(verified[0].id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 6 || !selectedFactor) return;

    setLoading(true);
    setError('');

    const success = await mfaService.challengeAndVerify(selectedFactor, code);

    if (success) {
      onVerified();
    } else {
      setError('Invalid verification code. Please try again.');
      setCode('');
      inputRef.current?.focus();
    }

    setLoading(false);
  };

  const handleCodeChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 6);
    setCode(cleaned);
    setError('');
    if (cleaned.length === 6) {
      handleSubmit(new Event('submit') as any);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Two-Factor Authentication</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="000000"
              className={cn(
                'h-14 text-center text-2xl font-mono tracking-[0.5em] rounded-xl bg-muted/20 border-border/40',
                error && 'border-red-500/50 focus-visible:ring-red-500/20'
              )}
              disabled={loading}
              autoComplete="one-time-code"
              autoCorrect={false}
              spellCheck={false}
            />
            {error && (
              <div className="flex items-center gap-2 text-red-500 text-xs">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {error}
              </div>
            )}
          </div>

          {factors.length > 1 && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Authenticator</label>
              <select
                value={selectedFactor}
                onChange={(e) => setSelectedFactor(e.target.value)}
                className="w-full h-10 rounded-xl bg-muted/20 border border-border/40 px-3 text-sm text-foreground"
              >
                {factors.map(f => (
                  <option key={f.id} value={f.id}>{f.friendly_name || 'Authenticator App'}</option>
                ))}
              </select>
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-11 rounded-xl"
            disabled={loading || code.length !== 6 || !selectedFactor}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Verifying...
              </>
            ) : (
              'Verify'
            )}
          </Button>
        </form>

        <button
          onClick={onCancel}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign out instead
        </button>
      </div>
    </div>
  );
};

export default MfaChallengeScreen;

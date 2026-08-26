import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Smartphone, Loader2, X, Check } from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

const CODE_LENGTH = 8;

const CliDevice = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const reduce = useReducedMotion();

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const deviceCode = digits.join('');

  useEffect(() => {
    if (connected) return;
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    if (action !== 'device' && !user) {
      navigate(`/auth?redirect=/cli/device?action=device`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, user, navigate]);

  useEffect(() => {
    if (connected) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [connected]);

  const handleChange = useCallback((raw: string) => {
    const cleaned = raw.replace(/[^A-Z2-9]/gi, '').toUpperCase().slice(0, CODE_LENGTH);
    const next = Array(CODE_LENGTH).fill('');
    for (let i = 0; i < cleaned.length; i++) next[i] = cleaned[i];
    setDigits(next);
    if (cleaned.length === CODE_LENGTH) {
      setError(null);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !e.currentTarget.value && digits.some(d => d)) {
      const lastFilled = digits.map((d, i) => d ? i : -1).filter(i => i >= 0).pop();
      if (lastFilled !== undefined) {
        const next = [...digits];
        next[lastFilled] = '';
        setDigits(next);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/[^A-Z2-9]/gi, '').toUpperCase().slice(0, CODE_LENGTH);
    if (!text) return;
    const next = Array(CODE_LENGTH).fill('');
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setDigits(next);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (deviceCode.length !== CODE_LENGTH || loading) return;

    setLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionToken = sessionData.session?.access_token || '';

      const res = await fetch('https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cli-oauth/device/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ device_code: deviceCode }),
      });

      const data = await res.json();

      if (data.success) {
        setConnected(true);
        toast({ title: 'Device connected', description: 'Your device has been successfully connected.' });
      } else {
        setError(data.error || 'Failed to connect device');
        setDigits(Array(CODE_LENGTH).fill(''));
        inputRef.current?.focus();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect device');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (deviceCode.length === CODE_LENGTH && !loading && !error) {
      const timer = setTimeout(handleSubmit, 200);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceCode]);

  if (connected) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex flex-1 items-center justify-center p-6">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-sm mx-auto text-center"
          >
            <div className="grid h-14 w-14 mx-auto place-items-center rounded-full bg-primary/10 mb-5">
              <Check className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold tracking-tight mb-1.5">Device connected</h2>
            <p className="text-sm text-muted-foreground">Your device has been linked. You can close this tab.</p>
          </motion.div>
        </div>
      </div>
    );
  }

  const displayCode = digits.join('');

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex flex-1 items-center justify-center p-6 md:p-8">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm mx-auto"
        >
          <div className="mb-6">
            <button
              onClick={() => navigate('/', { replace: true })}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors press-effect"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to SquidCloud
            </button>
          </div>

          <div className="space-y-1 mb-8">
            <h1 className="text-2xl font-bold tracking-tight">
              Connect a device
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter the 8-character code shown on your device
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="relative">
              <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                inputMode="text"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={16}
                value={displayCode}
                onChange={(e) => handleChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="XXXXXXXX"
                className={[
                  'w-full h-12 rounded-xl border bg-muted/30 pl-10 pr-4 text-center text-lg font-mono font-semibold tracking-[0.3em] text-foreground placeholder:text-muted-foreground/40 outline-none transition-all duration-200',
                  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                  error ? 'border-destructive/50 focus-visible:border-destructive/50 focus-visible:ring-destructive/20' : 'border-border/50',
                ].join(' ')}
              />
            </div>

            <Button
              type="submit"
              disabled={deviceCode.length !== CODE_LENGTH || loading}
              className="w-full h-11 rounded-xl"
              loading={loading}
            >
              {loading ? 'Connecting\u2026' : 'Connect Device'}
            </Button>
          </form>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="mt-4 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-3"
              >
                <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <span className="text-sm text-destructive leading-snug">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="mt-8 text-center text-[11px] text-muted-foreground">
            Codes expire after a few minutes
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default CliDevice;

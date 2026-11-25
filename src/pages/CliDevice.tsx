import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Smartphone, Loader2, X, Check } from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { PageFrame } from '@/components/layout/PageFrame';

const CLI_CSS = `
.cl-body{max-width:420px;margin:0 auto;text-align:center}
.cl-mark{width:56px;height:56px;margin:0 auto;display:grid;place-items:center;border:1px solid var(--sa-line,#1f2221);border-radius:16px;color:var(--sa-text,#e8e7e1)}
.cl-mark svg{width:24px;height:24px;stroke-width:1.6}
.cl-back{display:flex;justify-content:center;margin-bottom:24px}
.cl-link{display:inline-flex;align-items:center;gap:6px;border:0;background:transparent;padding:4px 2px;color:var(--sa-mute,#8d8f89);font:400 12px/1 var(--sa-f,-apple-system,sans-serif);cursor:pointer}
.cl-link:hover{color:var(--sa-text,#e8e7e1)}
.cl-form{display:block}
.cl-input{width:100%;height:52px;padding:0 14px;background:var(--sa-bg,#090b0a);border:1px solid var(--sa-line,#1f2221);border-radius:10px;color:var(--sa-text,#e8e7e1);font:500 18px/1 var(--sa-mono,ui-monospace,monospace);letter-spacing:.28em;text-align:center;outline:none}
.cl-input::placeholder{color:var(--sa-dim,#62655f)}
.cl-input:focus{border-color:var(--sa-rim,#2f3230)}
.cl-cta{width:100%;height:44px}
.cl-error{margin-top:16px;display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border:1px solid var(--sa-line,#1f2221);border-radius:10px;background:var(--sa-bg-2,#0e1110);text-align:left}
.cl-error svg{width:16px;height:16px;flex:none;color:var(--sa-mute,#8d8f89)}
.cl-error span{font-size:13px;line-height:1.5;color:var(--sa-text,#e8e7e1)}
.cl-foot{margin-top:32px;text-align:center;font-size:11px;color:var(--sa-dim,#62655f)}
`;

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
      <PageFrame title="Device connected" subtitle="Your device has been linked. You can close this tab.">
        <style>{CLI_CSS}</style>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="cl-body"
        >
          <div className="cl-mark"><Check className="h-6 w-6" /></div>
        </motion.div>
      </PageFrame>
    );
  }

  const displayCode = digits.join('');

  return (
    <PageFrame title="Connect a device" subtitle="Enter the 8-character code shown on your device">
      <style>{CLI_CSS}</style>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="cl-body"
      >
        <div className="cl-back">
          <button
            onClick={() => navigate('/', { replace: true })}
            className="cl-link press-effect"
          >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to SquidCloud
            </button>
        </div>

        <form onSubmit={handleSubmit} className="cl-form">
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
                className="cl-input"
              />
            </div>

            <Button
              type="submit"
              disabled={deviceCode.length !== CODE_LENGTH || loading}
              className="cl-cta"
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
                className="cl-error"
              >
                <X className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="text-sm text-destructive leading-snug">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

        <p className="cl-foot">
          Codes expire after a few minutes
        </p>
      </motion.div>
    </PageFrame>
  );
};

export default CliDevice;

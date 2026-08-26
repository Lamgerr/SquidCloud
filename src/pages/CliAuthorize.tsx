import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Shield, Loader2, X } from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import MfaChallengeScreen from '@/components/MfaChallengeScreen';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

const SCOPES = [
  'Read and write your files',
  'Create and revoke share links',
  'Manage webhooks and integrations',
  'Issue and rotate API keys',
];

const CliAuthorize = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const reduce = useReducedMotion();

  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // AAL2 gate: CLI device approval is a highly sensitive action, so it
  // requires a fresh TOTP verification before the authorize call fires.
  const [needsMfa, setNeedsMfa] = useState(false);
  const [mfaVerified, setMfaVerified] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (data?.currentLevel === 'aal2') {
          setMfaVerified(true);
        } else {
          const { data: factors } = await supabase.auth.mfa.listFactors();
          const hasTotp = (factors?.totp ?? []).some((f: any) => f.status === 'verified');
          if (hasTotp) {
            setNeedsMfa(true); // enrolled but not fresh → challenge
          }
          // Not enrolled: allow approval here, but the CLI login itself will
          // be refused server-side until TOTP is enrolled.
        }
      } catch {
        setMfaVerified(true); // fail-open only for the check itself
      }
    })();
  }, [user]);

  const state = crypto.randomUUID().replace(/-/g, '');

  const handleAuthorize = async () => {
    if (!user) {
      setError('Please log in first');
      return;
    }
    if (loading) return;
    if (needsMfa && !mfaVerified) {
      setNeedsMfa(true);
      setError('Confirm your authenticator code to authorize a CLI device.');
      return;
    }

    setLoading(true);
    setError(null);

    const urlParams = new URLSearchParams(window.location.search);
    const cliRedirectUri = urlParams.get('redirect_uri') || '';
    const cliState = urlParams.get('state') || '';

    const { data: sessionData } = await supabase.auth.getSession();
    const sessionToken = sessionData.session?.access_token || '';

    if (!sessionToken) {
      setError('Your web session expired. Refresh this page, sign in again, then re-run `squidcloudctl login`.');
      setLoading(false);
      return;
    }
    console.info('[cli-authorize] posting authorize request…');
    try {
      const res = await fetch('https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/cli-oauth/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          redirect_uri: cliRedirectUri,
          state: cliState || state,
          client_id: 'squidcloud-cli',
          machine_id: crypto.randomUUID().replace(/-/g, ''),
          device_name: navigator.userAgent,
          platform: navigator.platform,
        }),
      });

      const rawText = await res.text();
      let data: { code?: string; error?: string; redirect_url?: string } = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        data = { error: rawText.slice(0, 200) || `HTTP ${res.status}` };
      }
      console.info('[cli-authorize] response', res.status, data);

      if (!res.ok) {
        setError(`${data.error || 'Authorization failed'} (HTTP ${res.status})`);
        setLoading(false);
        return;
      }

      if (data.code) {
        setAuthorized(true);
        if (data.redirect_url) {
          // Attach the caller's short-lived Supabase JWT so the CLI can talk
          // to JWT-only services (sites-api, PostgREST). Localhost redirect.
          let target: string = data.redirect_url;
          try {
            const { data: sess } = await supabase.auth.getSession();
            const jwt = sess?.session?.access_token;
            if (jwt) target += (target.includes('?') ? '&' : '?') + 'sb_token=' + encodeURIComponent(jwt);
          } catch { /* token is optional */ }
          window.location.href = target;
        } else {
          setError('No redirect URL returned');
          setLoading(false);
        }
      } else {
        setError(data.error || 'Authorization failed');
        setLoading(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authorization failed');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authorized) return;

    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');

    if (action === 'authorize' && user) {
      handleAuthorize();
    } else if (!user) {
      const nextParam = `/cli/authorize?${new URLSearchParams({
        redirect_uri: urlParams.get('redirect_uri') || window.location.origin + window.location.pathname,
        state: urlParams.get('state') || state,
      })}`;
      navigate(`/auth?redirect=${nextParam}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, user, navigate]);

  if (authorized) {
  if (needsMfa && !mfaVerified) {
    return (
      <MfaChallengeScreen
        onVerified={() => {
          setMfaVerified(true);
          setNeedsMfa(false);
          toast({ title: 'Two-factor verified', description: 'You can now authorize the CLI device.' });
        }}
        onCancel={() => navigate('/dashboard')}
      />
    );
  }

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
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <motion.circle
                  cx="12" cy="12" r="10"
                  initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                />
                <motion.path
                  d="M8 12.5l2.5 2.5L16 9.5"
                  initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.4, ease: 'easeOut', delay: 0.3 }}
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold tracking-tight mb-1.5">Authorized</h2>
            <p className="text-sm text-muted-foreground">You can close this tab.</p>
          </motion.div>
        </div>
      </div>
    );
  }

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
              Authorize squidcloudctl?
            </h1>
            <p className="text-sm text-muted-foreground">
              A CLI tool is requesting access to your SquidCloud account
            </p>
          </div>

          <div className="stagger-children mb-8 space-y-2">
            {SCOPES.map((scope) => (
              <div
                key={scope}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 px-3.5 py-2.5"
              >
                <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground">{scope}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2.5">
            <Button
              onClick={handleAuthorize}
              disabled={loading}
              className="w-full h-11 rounded-xl"
              loading={loading}
            >
              {loading ? 'Authorizing\u2026' : 'Authorize Access'}
            </Button>

            <button
              onClick={() => window.close()}
              className="w-full rounded-xl px-6 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors press-effect"
            >
              Cancel
            </button>
          </div>

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
            You can revoke access anytime in Account Settings
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default CliAuthorize;

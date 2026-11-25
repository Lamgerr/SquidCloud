import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Shield, Loader2, X } from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import MfaChallengeScreen from '@/components/MfaChallengeScreen';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { PageFrame } from '@/components/layout/PageFrame';

const CA_CSS = `
.ca-body{max-width:460px;margin:0 auto;text-align:center}
.ca-mark{width:56px;height:56px;margin:0 auto;display:grid;place-items:center;border:1px solid var(--sa-line,#1f2221);border-radius:16px;color:var(--sa-text,#e8e7e1)}
.ca-mark svg{width:28px;height:28px;stroke-width:1.6}
.ca-back{display:flex;justify-content:center;margin-bottom:24px}
.ca-link{display:inline-flex;align-items:center;gap:6px;border:0;background:transparent;padding:4px 2px;color:var(--sa-mute,#8d8f89);font:400 12px/1 var(--sa-f,-apple-system,sans-serif);cursor:pointer}
.ca-link:hover{color:var(--sa-text,#e8e7e1)}
.ca-scopes{display:grid;gap:8px;margin:0 0 24px}
.ca-scope{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--sa-line,#1f2221);border-radius:10px;background:var(--sa-bg-2,#0e1110);text-align:left}
.ca-scope svg{width:16px;height:16px;flex:none;color:var(--sa-mute,#8d8f89)}
.ca-scope span{font-size:13px;color:var(--sa-text,#e8e7e1)}
.ca-actions{display:grid;gap:8px}
.ca-cta{width:100%;height:44px}
.ca-cancel{width:100%;padding:10px 16px;border:0;background:transparent;color:var(--sa-mute,#8d8f89);font:400 13px/1 var(--sa-f,-apple-system,sans-serif);cursor:pointer}
.ca-cancel:hover{color:var(--sa-text,#e8e7e1)}
.ca-error{margin-top:16px;display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border:1px solid var(--sa-line,#1f2221);border-radius:10px;background:var(--sa-bg-2,#0e1110);text-align:left}
.ca-error svg{width:16px;height:16px;flex:none;color:var(--sa-mute,#8d8f89)}
.ca-error span{font-size:13px;line-height:1.5;color:var(--sa-text,#e8e7e1)}
.ca-foot{margin-top:32px;text-align:center;font-size:11px;color:var(--sa-dim,#62655f)}
`;

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
    <PageFrame title="Authorized" subtitle="You can close this tab.">
      <style>{CA_CSS}</style>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="ca-body"
      >
        <div className="ca-mark">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      </motion.div>
    </PageFrame>
    );
  }

  return (
    <PageFrame title="Authorize squidcloudctl?" subtitle="A CLI tool is requesting access to your SquidCloud account">
      <style>{CA_CSS}</style>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="ca-body"
      >
        <div className="ca-back">
          <button
            onClick={() => navigate('/', { replace: true })}
            className="ca-link press-effect"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to SquidCloud
          </button>
        </div>

        <div className="ca-scopes">
            {SCOPES.map((scope) => (
              <div
                key={scope}
                className="ca-scope"
              >
                <Shield className="h-4 w-4 shrink-0" />
                <span>{scope}</span>
              </div>
            ))}
          </div>

        <div className="ca-actions">
            <Button
              onClick={handleAuthorize}
              disabled={loading}
              className="ca-cta"
              loading={loading}
            >
              {loading ? 'Authorizing\u2026' : 'Authorize Access'}
            </Button>

            <button
              onClick={() => window.close()}
              className="ca-cancel press-effect"
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
                className="ca-error"
              >
                <X className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

        <p className="ca-foot">
          You can revoke access anytime in Account Settings
        </p>
      </motion.div>
    </PageFrame>
  );
};

export default CliAuthorize;

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  AppShell, TopBar, Spinner, Note, Ico, btn, useDocTitle,
} from '@/components/custom/squid-app';

/* ═══════════════════════════════════════════════════════════════
   OAUTH CONSENT — SquidCloud as identity provider (OAuth 2.1).
   Third-party apps start the flow at /oauth/authorize; Supabase
   Auth redirects the user here with ?authorization_id, we ask
   "Authorize?" and mint the redirect URL with the code.
   Path is configured under Auth > OAuth Server.
   ═══════════════════════════════════════════════════════════════ */

type AuthDetails = {
  authorization_id?: string;
  redirect_url?: string;
  client?: { name?: string };
  redirect_uri?: string;
  scope?: string;
};

type Decision = 'approved' | 'denied';

const SCOPES_HINT: Record<string, string> = {
  openid: 'prove who you are',
  profile: 'read your display name',
  email: 'read your email address',
};

const OV_CSS = `
.ov { min-height: calc(100vh / var(--sa-zoom, 1) - 48px); display: flex; align-items: center; justify-content: center; padding: 32px var(--sa-gut) 48px; }
.ov-card { width: 100%; max-width: 400px; display: grid; gap: 18px; padding: 24px 28px; border: 1px solid var(--sa-line); border-radius: 10px; background: var(--sa-bg-2); text-align: left; }
.ov-eyebrow { font: 400 11px/1 var(--sa-mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--sa-mute); display: inline-flex; align-items: center; gap: 8px; }
.ov-client { font: 400 30px/1.1 var(--sa-f); letter-spacing: -0.03em; color: var(--sa-text); }
.ov-copy { font-size: 14px; line-height: 1.55; color: var(--sa-text-2); }
.ov-scope { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--sa-line); border-radius: 5px; background: var(--sa-bg); font-size: 13px; color: var(--sa-text); }
.ov-scope-k { font: 400 12px/1 var(--sa-mono); color: var(--sa-text); }
.ov-scope-d { color: var(--sa-mute); font-size: 12px; }
.ov-uri { font: 400 12px/1.4 var(--sa-mono); color: var(--sa-mute); word-break: break-all; }
.ov-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 4px; }
`;

export default function OAuthConsentPage() {
  useDocTitle('SquidCloud — Authorize');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authorizationId = searchParams.get('authorization_id') ?? '';

  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<AuthDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);

  useEffect(() => {
    document.documentElement.style.setProperty('--sa-zoom', '1');
    document.body.classList.add('sq-app-root');
    return () => {
      document.body.classList.remove('sq-app-root');
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!authorizationId) {
        setError('Missing authorization_id');
        setLoading(false);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        // Preserve the flow across sign-in — the Auth page stores `next`.
        navigate(`/auth?next=${encodeURIComponent(`/oauth/consent?authorization_id=${authorizationId}`)}`, {
          replace: true,
        });
        return;
      }

      const { data, error: err } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (!alive) return;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      if (data) {
        const d = data as AuthDetails;
        // Already consented earlier: the API hands back the redirect directly.
        if (d.redirect_url && !d.authorization_id) {
          window.location.href = d.redirect_url;
          return;
        }
        setDetails(d);
      } else {
        setError('No authorization request found');
      }
      setLoading(false);
    }

    void load();
    return () => {
      alive = false;
    };
  }, [authorizationId, navigate]);

  async function decide(d: Decision) {
    if (!authorizationId || decision) return;
    setDecision(d);
    const { data, error: errD } =
      await supabase.auth.oauth[d === 'approved' ? 'approveAuthorization' : 'denyAuthorization'](authorizationId);
    if (errD) {
      setError(errD.message);
      setDecision(null);
      return;
    }
    if (data?.redirect_url) {
      window.location.href = data.redirect_url;
    }
  }

  return (
    <AppShell>
      <style>{OV_CSS}</style>
      <TopBar home="/" crumbs={[{ label: 'oauth' }, { label: 'consent' }]} />
      <div className="ov">
        <div className="ov-card">
          {loading && (
            <div className="ov-copy" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Spinner /> Loading authorization…
            </div>
          )}

          {!loading && error && (
            <Note tone="err" title="Authorization error">
              {error}
            </Note>
          )}

          {!loading && !error && details?.client?.name && (
            <>
              <span className="ov-eyebrow">
                <Ico.Lock size={13} /> oauth consent
              </span>
              <div>
                <h1 className="ov-client">{details.client.name}</h1>
                <p className="ov-copy" style={{ margin: '10px 0 0' }}>
                  This application is requesting authorization to access your SquidCloud
                  account.
                </p>
              </div>

              {details.scope?.trim() && (
                <div style={{ display: 'grid', gap: 8 }}>
                  {details.scope.split(' ').filter(Boolean).map((item) => (
                    <div key={item} className="ov-scope">
                      <Ico.Check size={14} />
                      <span className="ov-scope-k">{item}</span>
                      {SCOPES_HINT[item] && <span className="ov-scope-d">{SCOPES_HINT[item]}</span>}
                    </div>
                  ))}
                </div>
              )}

              {details.redirect_uri && <div className="ov-uri">redirect → {details.redirect_uri}</div>}

              <div className="ov-actions">
                <button
                  className={btn('ghost', 'md')}
                  onClick={() => void decide('denied')}
                  disabled={!!decision}
                >
                  Deny
                </button>
                <button
                  className={btn('primary', 'md')}
                  onClick={() => void decide('approved')}
                  disabled={!!decision}
                >
                  {decision === 'approved' ? <Spinner /> : 'Authorize'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

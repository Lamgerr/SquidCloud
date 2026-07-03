import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const CALLBACK_FN = 'migration-oauth-callback';

const ImportOAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'success' | 'error' | 'processing'>('processing');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');
    const platform = searchParams.get('platform');
    const jobId = searchParams.get('jobId');

    if (errorParam) {
      setStatus('error');
      setMessage(errorParam);
      sendMessage('oauth_error', { error: errorParam });
      return;
    }

    if (platform && jobId) {
      setStatus('success');
      setMessage(`Connected to ${platform}`);
      sendMessage('oauth_success', { platform, jobId });
      autoClose();
      return;
    }

    if (code && state) {
      exchangeCode(code, state);
    } else {
      setStatus('error');
      setMessage('Invalid callback parameters');
    }
  }, [searchParams]);

  async function exchangeCode(code: string, state: string) {
    try {
      const { data, error } = await supabase.functions.invoke(CALLBACK_FN, {
        body: { code, state }
      });

      if (error || data?.error) {
        const errMsg = error?.message || data?.error || 'Unknown error';
        setStatus('error');
        setMessage(errMsg);
        sendMessage('oauth_error', { error: errMsg });
        return;
      }

      setStatus('success');
      setMessage(`Connected to ${data.platform}`);
      sendMessage('oauth_success', { platform: data.platform, jobId: data.jobId });
      autoClose();
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Failed to complete authorization');
      sendMessage('oauth_error', { error: err.message || 'Failed to complete authorization' });
    }
  }

  function sendMessage(type: string, payload: Record<string, any>) {
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type, ...payload }, '*');
      }
    } catch {}
  }

  function autoClose() {
    setTimeout(() => {
      try { window.close(); } catch {}
    }, 500);
  }

  if (status === 'processing') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', margin: 0, fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif', background: '#0a0a0f', color: '#e4e4e7' }}>
        <p>Completing authorization…</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', margin: 0, fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif', background: '#0a0a0f', color: '#e4e4e7' }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: '2rem' }}>
        {status === 'success' ? (
          <>
            <svg viewBox="0 0 40 40" width="48" height="48" style={{ marginBottom: '1rem' }}>
              <circle cx="20" cy="20" r="18" fill="#10b981" opacity="0.2" />
              <path d="M12 20l5 5 11-11" stroke="#10b981" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem' }}>Authorization Successful!</h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.875rem', margin: 0 }}>{message}</p>
            <p style={{ color: '#71717a', fontSize: '0.75rem', marginTop: '1rem' }}>This window will close automatically. Return to SquidCloud.</p>
          </>
        ) : (
          <>
            <svg viewBox="0 0 40 40" width="48" height="48" style={{ marginBottom: '1rem' }}>
              <circle cx="20" cy="20" r="18" fill="#ef4444" opacity="0.2" />
              <path d="M14 14l12 12M26 14l-12 12" stroke="#ef4444" strokeWidth="3" fill="none" strokeLinecap="round" />
            </svg>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem' }}>Authorization Failed</h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.875rem', margin: 0 }}>{message}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default ImportOAuthCallback;

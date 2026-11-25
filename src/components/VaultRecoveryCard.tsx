/**
 * Vault recovery — the honest, destructive escape hatch.
 * A forgotten vault password cannot be recovered. The only way to set a new
 * one is a full reset: every encrypted file, key and vault record is erased
 * and the account is re-onboarded as fresh. Nothing happens until the user
 * types ERASE; progress is shown step by step while it runs.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { AlertTriangle, RotateCcw, X } from '@/lib/icon-map';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { authenticateWithPasskey } from '@/lib/webauthn';

const STEPS = [
  'Revoking vault keys',
  'Erasing encrypted file chunks',
  'Clearing vault records',
  'Preparing a fresh vault',
];

export default function VaultRecoveryCard({ emailVerified = true, totpEnabled = false, hasPasskey = false, userEmail }: {
  emailVerified?: boolean; totpEnabled?: boolean; hasPasskey?: boolean; userEmail?: string;
}) {
  const reduce = !!useReducedMotion();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [step, setStep] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpDone, setTotpDone] = useState(false);
  const [passkeyDone, setPasskeyDone] = useState(false);

  const verifyTotp = async () => {
    setVerifying('totp');
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error || !data?.totp?.length) throw error || new Error('No authenticator found');
      const { error: vErr } = await supabase.auth.mfa.challengeAndVerify({
        factorId: data.totp[0].id, code: totpCode.trim(),
      });
      if (vErr) throw vErr;
      setTotpDone(true);
    } catch (e: any) {
      toast({ title: 'Verification failed', description: e?.message || 'Check your code', variant: 'destructive' });
    } finally { setVerifying(''); }
  };

  const verifyPasskey = async () => {
    setVerifying('passkey');
    try {
      const result = await authenticateWithPasskey(userEmail);
      if (!result.success) throw new Error('Passkey was not verified');
      setPasskeyDone(true);
    } catch (e: any) {
      toast({ title: 'Passkey failed', description: e?.message || 'Try again', variant: 'destructive' });
    } finally { setVerifying(''); }
  };

  const ready = text === 'ERASE' && emailVerified && (!totpEnabled || totpDone) && (!hasPasskey || passkeyDone);

  const reset = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setStep(0);
    try {
      for (let i = 1; i < STEPS.length; i++) {
        await new Promise((r) => setTimeout(r, reduce ? 10 : 620));
        setStep(i);
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('No active session');
      const resp = await fetch('/api/internal/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          op: 'reset-vault',
          confirmation: 'ERASE',
          totpVerified: totpDone,
          passkeyVerified: passkeyDone,
        }),
      });
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok || payload?.error) throw new Error(payload?.error || `Reset failed (${resp.status})`);
      await new Promise((r) => setTimeout(r, reduce ? 10 : 500));
      setStep(STEPS.length);
      toast({ title: 'Vault erased', description: 'Please sign in again to set up your new vault.' });
      // The destructive operation invalidates the current session: force a
      // real re-authentication instead of leaving a stale client session.
      await supabase.auth.signOut();
      window.setTimeout(() => window.location.assign('/auth?reason=vault-reset'), reduce ? 0 : 900);
    } catch (e: any) {
      setStep(-1);
      setBusy(false);
      toast({ title: 'Reset failed', description: e?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  return (
    <>
      <div className="vrc">
        <style>{CSS}</style>
        <div className="vrc-head">
          <div className="vrc-ico"><RotateCcw size={16} /></div>
          <div>
            <b>Vault recovery</b>
            <span>If you forget your vault password, it cannot be recovered.</span>
          </div>
        </div>
        <p className="vrc-copy">
          You can start over with a new password. This permanently erases every encrypted file,
          key and vault record, then re-onboards you as a new user. There is no undo.
        </p>
        <button type="button" className="vrc-btn" onClick={() => { setOpen(true); setText(''); setStep(-1); }}>
          Reset vault & erase all data
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div className="vrc-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            role="dialog" aria-modal="true" aria-label="Reset vault">
            <motion.div className="vrc-dialog" initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: reduce ? 0.01 : 0.2 }}>
              {step < 0 ? (
                <>
                  <div className="vrc-warn"><AlertTriangle size={20} /></div>
                  <h2>Erase everything and start over?</h2>
                  <p>Your files, keys and vault records will be deleted immediately. This cannot be undone or recovered.</p>
                  <div className="vrc-checks">
                    <div className={`vrc-check${emailVerified ? ' ok' : ''}`}>
                      <span>{emailVerified ? '✓' : '!'}</span> Email {emailVerified ? 'verified' : 'not verified'}
                    </div>
                    {totpEnabled && (
                      <div className={`vrc-check${totpDone ? ' ok' : ''}`}>
                        <span>{totpDone ? '✓' : '2'}</span>
                        {totpDone ? 'Authenticator verified' : 'Authenticator required'}
                        {!totpDone && (
                          <div className="vrc-inline">
                            <input className="vrc-code" inputMode="numeric" maxLength={6} placeholder="000000"
                              value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                            <button type="button" onClick={verifyTotp} disabled={totpCode.length !== 6 || !!verifying}>Verify</button>
                          </div>
                        )}
                      </div>
                    )}
                    {hasPasskey && (
                      <div className={`vrc-check${passkeyDone ? ' ok' : ''}`}>
                        <span>{passkeyDone ? '✓' : '3'}</span>
                        {passkeyDone ? 'Passkey verified' : 'Passkey required'}
                        {!passkeyDone && (
                          <button type="button" className="vrc-inline-btn" onClick={verifyPasskey} disabled={!!verifying}>
                            {verifying === 'passkey' ? 'Verifying…' : 'Verify with passkey'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <label className="vrc-label" htmlFor="vrc-confirm">Type <code>ERASE</code> to continue</label>
                  <input id="vrc-confirm" className="vrc-input" value={text} autoFocus spellCheck={false}
                    placeholder="ERASE" onChange={(e) => setText(e.target.value.toUpperCase())} />
                  <div className="vrc-actions">
                    <button type="button" className="vrc-cancel" onClick={() => setOpen(false)}>Cancel</button>
                    <button type="button" className="vrc-danger" disabled={!ready} onClick={reset}>
                      Erase everything
                    </button>
                  </div>
                </>
              ) : (
                <div className="vrc-progress">
                  <div className="vrc-spinner" />
                  <h2>{step >= STEPS.length ? 'Fresh vault ready' : 'Formatting your vault'}</h2>
                  <div className="vrc-steps">
                    {STEPS.map((s, i) => (
                      <div key={s} className={`vrc-step${i < step ? ' done' : ''}${i === step ? ' active' : ''}`}>
                        <span>{i < step ? '✓' : String(i + 1).padStart(2, '0')}</span>{s}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!busy && <button type="button" className="vrc-x" aria-label="Close" onClick={() => setOpen(false)}><X size={14} /></button>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const CSS = `
.vrc{display:grid;gap:14px;padding:18px 20px;border-radius:18px;
  background:linear-gradient(180deg,var(--sa-bg-3,#141816),var(--sa-bg-2,#0e1110));
  border:1px solid var(--sa-line,#1f2221);box-shadow:inset 0 1px 0 rgba(232,231,225,.05)}
.vrc-head{display:flex;align-items:center;gap:12px}
.vrc-ico{flex:none;width:36px;height:36px;display:grid;place-items:center;border-radius:11px;
  background:var(--sa-bg-4,#1b201d);border:1px solid var(--sa-line,#1f2221);color:var(--sa-text,#e8e7e1)}
.vrc-head b{display:block;font-size:13px;font-weight:500;color:var(--sa-text,#e8e7e1)}
.vrc-head span{display:block;margin-top:3px;font-size:11px;color:var(--sa-mute,#8d8f89)}
.vrc-copy{margin:0;font-size:12px;line-height:1.6;color:var(--sa-mute,#8d8f89)}
.vrc-btn{justify-self:start;min-height:34px;padding:0 14px;border:1px solid var(--sa-line,#1f2221);border-radius:999px;
  background:var(--sa-bg-4,#1b201d);color:var(--sa-text,#e8e7e1);font:inherit;font-size:12px;cursor:pointer}
.vrc-btn:hover{border-color:var(--sa-rim,#2f3230)}
.vrc-overlay{position:fixed;inset:0;z-index:600;display:grid;place-items:center;padding:20px;
  background:rgba(3,4,3,.8);backdrop-filter:blur(8px)}
.vrc-dialog{position:relative;width:min(400px,100%);padding:24px;border-radius:20px;text-align:center;
  background:linear-gradient(180deg,var(--sa-bg-4,#1b201d),var(--sa-bg-2,#0e1110));
  border:1px solid var(--sa-line,#1f2221);box-shadow:inset 0 1px 0 rgba(232,231,225,.07),0 30px 70px -24px rgba(0,0,0,.95);
  color:var(--sa-text,#e8e7e1);font-family:var(--sa-f,-apple-system,system-ui,sans-serif)}
.vrc-warn{width:42px;height:42px;margin:0 auto 14px;display:grid;place-items:center;border-radius:13px;
  background:var(--sa-bg-3,#141816);border:1px solid var(--sa-line,#1f2221)}
.vrc-dialog h2{margin:0;font-size:17px;font-weight:500;letter-spacing:-.02em}
.vrc-dialog p{margin:10px 0 18px;font-size:12px;line-height:1.6;color:var(--sa-mute,#8d8f89)}
.vrc-checks{display:grid;gap:7px;margin:0 0 18px;text-align:left}
.vrc-check{display:flex;align-items:center;gap:9px;font-size:11px;color:var(--sa-mute,#8d8f89);flex-wrap:wrap}
.vrc-check.ok{color:var(--sa-text,#e8e7e1)}
.vrc-check>span{width:19px;height:19px;flex:none;display:grid;place-items:center;border-radius:50%;
  border:1px solid var(--sa-line,#1f2221);font:400 10px/1 var(--sa-mono,monospace)}
.vrc-check.ok>span{border-color:var(--sa-text,#e8e7e1)}
.vrc-inline{display:flex;gap:6px;width:100%;margin-top:6px}
.vrc-code{flex:1;height:34px;padding:0 12px;border:1px solid var(--sa-line,#1f2221);border-radius:999px;
  background:var(--sa-bg,#090b0a);color:var(--sa-text,#e8e7e1);outline:none;font:inherit;font-size:13px;letter-spacing:.2em}
.vrc-inline button,.vrc-inline-btn{height:34px;padding:0 12px;border:1px solid var(--sa-line,#1f2221);border-radius:999px;
  background:var(--sa-bg-4,#1b201d);color:var(--sa-text,#e8e7e1);font:inherit;font-size:11px;cursor:pointer}
.vrc-inline button:disabled{opacity:.4}
.vrc-label{display:block;text-align:left;font-size:11px;color:var(--sa-mute,#8d8f89);margin-bottom:7px}
.vrc-label code{font:400 11px/1 var(--sa-mono,monospace);color:var(--sa-text,#e8e7e1)}
.vrc-input{width:100%;height:42px;padding:0 14px;border:1px solid var(--sa-line,#1f2221);border-radius:999px;
  background:var(--sa-bg,#090b0a);color:var(--sa-text,#e8e7e1);outline:none;font:inherit;font-size:13px}
.vrc-input:focus{border-color:var(--sa-text,#e8e7e1)}
.vrc-actions{display:flex;gap:8px;margin-top:16px}
.vrc-actions button{flex:1;height:38px;border-radius:999px;font:inherit;font-size:12px;cursor:pointer}
.vrc-cancel{border:1px solid var(--sa-line,#1f2221);background:transparent;color:var(--sa-mute,#8d8f89)}
.vrc-danger{border:1px solid var(--sa-line,#1f2221);background:var(--sa-bg-4,#1b201d);color:var(--sa-text,#e8e7e1)}
.vrc-danger:disabled{opacity:.4;cursor:default}
.vrc-x{position:absolute;top:12px;right:12px;width:28px;height:28px;display:grid;place-items:center;border:0;
  border-radius:50%;background:transparent;color:var(--sa-mute,#8d8f89);cursor:pointer}
.vrc-progress{display:grid;gap:18px;padding:8px 0}
.vrc-spinner{width:34px;height:34px;margin:0 auto;border-radius:50%;border:2px solid var(--sa-line,#1f2221);
  border-top-color:var(--sa-text,#e8e7e1);animation:vrc-spin .8s linear infinite}
@keyframes vrc-spin{to{transform:rotate(360deg)}}
.vrc-steps{display:grid;gap:8px;text-align:left}
.vrc-step{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--sa-dim,#62655f)}
.vrc-step span{width:22px;height:22px;display:grid;place-items:center;border-radius:50%;
  border:1px solid var(--sa-line,#1f2221);font:400 10px/1 var(--sa-mono,monospace)}
.vrc-step.active{color:var(--sa-text,#e8e7e1)}
.vrc-step.done{color:var(--sa-mute,#8d8f89)}
@media(prefers-reduced-motion:reduce){.vrc-spinner{animation:none}}
`;

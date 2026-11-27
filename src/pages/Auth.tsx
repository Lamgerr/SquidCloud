import React, { useState, useEffect, useCallback } from 'react';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, Github, Fingerprint, KeyRound } from '@/lib/icon-map';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { securityService } from '@/services/security-service';
import { INKModal } from '@/components/INKModal';
import { useINK } from '@/hooks/useINK';
import { isPasskeyAvailable, authenticateWithPasskey } from '@/lib/webauthn';
import { rewrapMasterKey } from '@/lib/master-key-rewrap';
import { masterFromRecoveryPhrase } from '@/lib/zk/recovery-master';
import { setV4Master } from '@/lib/e2e-v4-session';
import { getOAuthRedirectUrl, getPasswordRecoveryRedirectUrl } from '@/lib/appLinks';
import { getClientIp } from '@/lib/clientIp';
import { emitSignal } from '@/lib/api';
import SquidLogo from '@/components/ui/SquidLogo';
import { useShake } from '@/hooks/use-shake';
import {
  AppShell, Spinner, Ico, useDocTitle,
} from '@/components/custom/squid-app';

const AUTH_CSS = `
.ax-root{
  --ink:#17143A;--ink2:#201C4C;--tx:#ECE7F7;--mute:#8E8AB0;--hair:#3A3566;--coral:#F0527A;--teal:#2FA89A;
  --fh:"Bricolage Grotesque Variable","Bricolage Grotesque",system-ui,sans-serif;
  --fb:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;
  position:relative;min-height:100vh;background:var(--ink);color:var(--tx);font-family:var(--fb);
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
}
.ax-top{position:absolute;top:0;left:0;right:0;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:26px 34px}
.ax-brand{display:inline-flex;align-items:center;gap:9px;color:var(--tx);text-decoration:none;font-family:var(--fh);font-size:17px;font-weight:700;letter-spacing:-.02em}
.ax-brand svg{color:var(--coral)}
.ax-nav{display:flex;align-items:center;gap:2px}
.ax-nav-link{display:inline-flex;align-items:center;min-height:40px;padding:0 12px;border-radius:6px;color:var(--mute);text-decoration:none;font-size:14px;transition:color .2s}
.ax-nav-link:hover{color:var(--tx)}

.ax-main{position:relative;z-index:1;min-height:100vh;display:grid;place-items:center;padding:92px 24px 44px}
.ax-col{width:100%;max-width:380px}
.ax-title{margin:0;text-align:left;font-family:var(--fh);font-size:clamp(32px,6vw,42px);font-weight:700;letter-spacing:-.035em;line-height:1.05}
.ax-sub{margin:12px 0 0;text-align:left;font-size:15px;line-height:1.55;color:var(--mute)}

.ax-passkey{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:54px;margin-top:30px;padding:0 16px;
  border:0;border-radius:999px;background:var(--coral);color:var(--ink);font:inherit;font-size:16px;font-weight:500;cursor:pointer;
  transition:transform .15s,filter .15s}
.ax-passkey:hover{filter:brightness(1.07)}
.ax-passkey:active{transform:scale(.985)}
.ax-passkey:disabled{cursor:default;filter:saturate(.6) brightness(.85)}
.ax-passkey svg{flex:none}
.ax-passkey-busy{animation:ax-breathe 1.6s ease-in-out infinite}
@keyframes ax-breathe{0%,100%{opacity:.4}50%{opacity:1}}

.ax-divider{display:flex;align-items:center;gap:14px;margin:24px 0 0;color:var(--mute);font-size:13px}
.ax-divider::before,.ax-divider::after{content:"";height:1px;flex:1;background:var(--hair)}

.ax-form{display:flex;flex-direction:column;gap:22px;margin-top:26px}
.ax-field{position:relative}
.ax-field-label{display:block;margin-bottom:6px;font-size:13px;font-weight:500;color:var(--tx)}
.ax-field-line{display:flex;align-items:center;gap:10px;min-height:42px}
.ax-field-ico{flex:none;width:16px;display:grid;place-items:center;color:var(--mute)}
.ax-input{flex:1;min-width:0;padding:0;border:0;outline:0;background:transparent;color:var(--tx);font:inherit;font-size:16px}
.ax-input::placeholder{color:var(--mute);opacity:.8}
.ax-field-rule{position:absolute;left:0;right:0;bottom:0;height:1px;background:var(--hair);transition:background .2s,height .2s}
.ax-field:focus-within .ax-field-rule{background:var(--teal);height:2px}
.ax-end{display:flex;align-items:center;flex:none}
.ax-eye{display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:6px;background:transparent;color:var(--mute);cursor:pointer;transition:color .2s}
.ax-eye:hover{color:var(--tx)}
.ax-row-end{display:flex;justify-content:flex-end;margin-top:-6px}
.ax-text-btn{display:inline-flex;align-items:center;gap:5px;min-height:34px;padding:0;border:0;background:none;color:var(--mute);font:inherit;font-size:13px;cursor:pointer;transition:color .2s}
.ax-text-btn:hover{color:var(--tx)}
.ax-back{margin-top:22px}

.ax-strength{display:flex;align-items:center;gap:10px;margin-top:-8px}
.ax-strength-bars{display:flex;gap:3px;flex:1}
.ax-strength-bars i{height:3px;flex:1;border-radius:2px;background:var(--hair);transition:background .2s}
.ax-strength-bars i.on{background:var(--teal)}
.ax-strength-label{min-width:44px;text-align:right;font-size:12px;color:var(--mute)}

.ax-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:50px;padding:0 20px;border:0;border-radius:8px;
  background:var(--tx);color:var(--ink);font:inherit;font-size:16px;font-weight:500;cursor:pointer;transition:transform .15s,filter .15s}
.ax-btn:hover{filter:brightness(.93)}
.ax-btn:active{transform:scale(.985)}
.ax-btn:disabled{cursor:default;opacity:.5}
.ax-btn-quiet{background:transparent;color:var(--tx);border:1px solid var(--hair)}

.ax-switch{margin:22px 0 0;font-size:14px;color:var(--mute)}
.ax-link{padding:0;border:0;background:none;color:var(--tx);font:inherit;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.ax-link:hover{color:var(--teal)}

.ax-oauth{margin-top:30px;padding-top:24px;border-top:1px solid var(--hair)}
.ax-oauth-item{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:46px;border:1px solid var(--hair);border-radius:8px;
  background:transparent;color:var(--tx);font:inherit;font-size:14px;cursor:pointer;transition:background .2s}
.ax-oauth-item:hover{background:var(--ink2)}
.ax-oauth-item svg{width:17px;height:17px;flex:none}
.ax-more{margin-top:12px;font-size:13px;color:var(--mute)}
.ax-more summary{cursor:pointer;list-style:none;padding:6px 0}
.ax-more summary::-webkit-details-marker{display:none}
.ax-more summary:hover{color:var(--tx)}
.ax-more-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}

.ax-status{padding:14px 0;border-top:1px solid var(--hair);border-bottom:1px solid var(--hair);font-size:14px;line-height:1.5;color:var(--mute)}
.ax-legal{display:flex;gap:18px;margin:28px 0 0;font-size:12px;color:var(--mute)}
.ax-legal a{color:inherit;text-decoration:none}
.ax-legal a:hover{color:var(--tx)}

.ax-root :is(button,a,summary):focus-visible{outline:2px solid var(--tx);outline-offset:3px;border-radius:6px}
@media(max-width:520px){.ax-top{padding:20px}.ax-nav-link{display:none}.ax-main{padding:84px 24px 32px}}
@media(prefers-reduced-motion:reduce){.ax-root *{animation:none!important;transition-duration:.01ms!important}}
`;

const GoogleMark = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 1 1 0-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0 0 12.545 2C7.021 2 2.543 6.478 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013Z" />
  </svg>
);

const DiscordMark = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.078.037c-.211.375-.445.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.042-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.011c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.121.099.247.198.373.292a.077.077 0 0 1-.007.128 12.299 12.299 0 0 1-1.873.892.076.076 0 0 0-.041.107c.36.698.772 1.363 1.225 1.993a.076.076 0 0 0 .084.029 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03ZM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z" />
  </svg>
);

type PillButtonProps = {
  type?: 'button' | 'submit';
  quiet?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
};

function PillButton({ type = 'button', quiet, disabled, onClick, children, ariaLabel }: PillButtonProps) {
  return (
    <button type={type} disabled={disabled} onClick={onClick} aria-label={ariaLabel}
      className={`ax-btn${quiet ? ' ax-btn-quiet' : ''}`}>{children}</button>
  );
}

type FieldProps = {
  id: string;
  label: string;
  icon: React.ReactNode;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  end?: React.ReactNode;
};

function Field({ id, label, icon, type = 'text', value, onChange, placeholder, autoComplete, autoFocus, end }: FieldProps) {
  return (
    <div className="ax-field">
      <label className="ax-field-label" htmlFor={id}>{label}</label>
      <div className="ax-field-line">
        <span className="ax-field-ico" aria-hidden="true">{icon}</span>
        <input id={id} name={id} type={type} className="ax-input" placeholder={placeholder || label}
          value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete}
          autoFocus={autoFocus} autoCapitalize="none" spellCheck={false} />
        {end && <span className="ax-end">{end}</span>}
      </div>
      <span className="ax-field-rule" aria-hidden="true" />
    </div>
  );
}

const Auth = () => {
  const reduce = !!useReducedMotion();
  const { trigger: shake, shakeClass } = useShake();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeySuccess, setPasskeySuccess] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, signUp, user } = useAuth();
  const [searchParams] = useSearchParams();
  const { isOpen: isINKOpen, closeINK } = useINK();

  const getRedirectTarget = useCallback(() => {
    const nextParam = searchParams.get('next') || localStorage.getItem('squid_auth_next');
    if (nextParam && nextParam.startsWith('/')) return nextParam;
    return '/dashboard';
  }, [searchParams]);

  useEffect(() => {
    const nextParam = searchParams.get('next');
    if (nextParam) localStorage.setItem('squid_auth_next', nextParam);
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get('tab') === 'signup') {
      setIsLogin(false);
    }
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      const target = getRedirectTarget();
      localStorage.removeItem('squid_auth_next');
      navigate(target);
    }
  }, [getRedirectTarget, navigate, user]);

  useEffect(() => {
    isPasskeyAvailable().then(setPasskeyAvailable);
  }, []);

  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const type = searchParams.get('type');

    if (type === 'recovery' && accessToken && refreshToken) {
      setIsPasswordReset(true);
      setIsLogin(true);
      setShowForgotPassword(false);
    }
  }, [searchParams]);

  const checkPasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (pass.length >= 12) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return Math.min(score, 5);
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast({ title: 'Missing information', description: 'Please fill in both password fields', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: 'Please make sure both passwords are identical', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: 'Password too short', description: 'Password must be at least 8 characters long', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      // ASVS V6.2 / V6.4: a password reset must not destroy access to encrypted
      // data. Rewrap the same master key from the recovery phrase.
      // Rewrap the same master from the recovery phrase so files stay readable.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const resp = await fetch('/api/internal/vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ op: 'vault-master-meta' }),
        });
        const meta = await resp.json().catch(() => ({}));
        if (resp.ok && meta?.encrypted_master_key && meta?.kdf_salt) {
          if (!recoveryPhrase.trim()) throw new Error('Enter your vault recovery phrase to keep access to your encrypted files');
          const master = await masterFromRecoveryPhrase(recoveryPhrase);
          const rewrapped = await rewrapMasterKey(null, '', newPassword, master);
          master.fill(0);
          if (!rewrapped.ok || !rewrapped.next) throw new Error('Could not rewrap your vault key');
          const { error: keyError } = await supabase.from('master_keys').update({
            encrypted_master_key: `${rewrapped.next.wrapped}:${rewrapped.next.iv}`,
            kdf_salt: rewrapped.next.salt,
            kdf_iterations: rewrapped.next.iterations,
            key_version: rewrapped.next.version,
            last_rotated: new Date().toISOString(),
          }).eq('user_id', session.user.id).eq('key_version', Number(meta.key_version) || 1);
          if (keyError) throw new Error(keyError.message);
          if (rewrapped.masterRaw) setV4Master(rewrapped.masterRaw);
        }
      }

      void emitSignal({
        type: 'password_changed',
        severity: 'warning',
        title: 'Password changed',
        body: "Your account password was changed. If this wasn't you, contact support immediately.",
        link: '/settings/account',
      });
      toast({ title: 'Password updated', description: 'Your password has been successfully updated.' });
      navigate('/auth', { replace: true });
      setIsPasswordReset(false);
      setNewPassword('');
      setConfirmPassword('');
      setRecoveryPhrase('');
    } catch (error: any) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: 'Email required', description: 'Please enter your email address', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getPasswordRecoveryRedirectUrl(),
      });
      if (error) throw error;
      setResetEmailSent(true);
      toast({ title: 'Reset email sent', description: 'Check your email for a password reset link' });
    } catch (error: any) {
      toast({ title: 'Reset failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (!isLogin && !name)) {
      toast({ title: 'Missing information', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
        const target = getRedirectTarget();
        localStorage.removeItem('squid_auth_next');
        navigate(target);
        setTimeout(async () => {
          try { await securityService.trackLogin(true, await getCurrentIP()); } catch {}
        }, 100);
      } else {
        await signUp(email, password, name);
        toast({ title: 'Account created', description: 'Welcome to SquidCloud!' });
      }
    } catch (error: any) {
      shake();
      toast({ title: 'Authentication Failed', description: error?.message || 'Please check your credentials and try again.', variant: 'destructive' });
      if (isLogin) {
        setTimeout(async () => {
          try { await securityService.trackLogin(false, await getCurrentIP()); } catch {}
        }, 100);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    try {
      const promise = authenticateWithPasskey(email || undefined);
      setPasskeyLoading(true);
      const result = await promise;
      // ASVS V6.6 / V6.7: legacy verifier-less passkeys finish through an
      // out-of-band email link; never surface a bare failure for that path.
      if (result.emailConfirmation) {
        toast({ title: 'Check your email', description: `Open the sign-in link sent to ${result.email || 'your email'} to finish.` });
      } else if (!result.success) {
        toast({ title: 'Authentication failed', description: 'Please try again or use password', variant: 'destructive' });
      } else {
        setPasskeySuccess(true);
        window.setTimeout(() => setPasskeySuccess(false), 1300);
      }
    } catch (error: any) {
      toast({ title: 'Passkey login failed', description: error.message || 'Please try again', variant: 'destructive' });
    } finally {
      setPasskeyLoading(false);
    }
  };

  const getCurrentIP = async (): Promise<string> => getClientIp();

  const handleOAuthSignIn = async (provider: 'github' | 'google' | 'discord') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: getOAuthRedirectUrl() },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: `${provider} sign in failed`, description: error.message, variant: 'destructive' });
    }
  };

  const handleBackToLogin = () => {
    setShowForgotPassword(false);
    setResetEmailSent(false);
    setEmail('');
  };

  const strength = checkPasswordStrength(password);
  const view: 'login' | 'signup' | 'forgot' | 'reset' = isPasswordReset
    ? 'reset'
    : showForgotPassword
      ? 'forgot'
      : isLogin
        ? 'login'
        : 'signup';

  const titles = {
    login: 'Sign in',
    signup: 'Create account',
    forgot: 'Reset password',
    reset: 'New password',
  } as const;

  useDocTitle(titles[view]);

  const strengthTone = (strength || 0) < 2 ? 1 : (strength || 0) < 4 ? 2 : 3;
  const strengthLabel = (strength || 0) < 2 ? 'Weak' : (strength || 0) < 4 ? 'Good' : 'Strong';

  const eyeToggle = (
    <button
      type="button"
      className="ax-eye"
      onClick={() => setShowPassword(!showPassword)}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
      aria-pressed={showPassword}
      tabIndex={-1}
    >
      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
    </button>
  );

  const viewAnim = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };

  return (
    <AppShell>
      <style>{AUTH_CSS}</style>
      <INKModal isOpen={isINKOpen} onClose={closeINK} />

      <div className="ax-root">
        <header className="ax-top">
          <Link to="/" className="ax-brand" aria-label="SquidCloud home">
            <SquidLogo size={17} mono />
            <span>SquidCloud</span>
          </Link>
          <nav className="ax-nav" aria-label="Secondary">
            <Link to="/pricing" className="ax-nav-link">Pricing</Link>
            <Link to="/help/docs" className="ax-nav-link">Docs</Link>
          </nav>
        </header>

        <main className="ax-main">
          <div className="ax-col">
            <AnimatePresence mode="wait" initial={false}>
              {view === 'reset' && (
                <motion.div key="reset" {...viewAnim} transition={{ duration: reduce ? 0.01 : 0.18 }}>
                  <h1 className="ax-title">New password</h1>
                  <p className="ax-sub">Choose a strong password for your account.</p>
                  <form onSubmit={handlePasswordReset} className="ax-form">
                    <Field id="new-password" label="New password" icon={<Lock className="h-4 w-4" />}
                      type={showPassword ? 'text' : 'password'} placeholder="At least 8 characters"
                      value={newPassword} onChange={setNewPassword} autoComplete="new-password" autoFocus end={eyeToggle} />
                    <Field id="confirm-password" label="Confirm password" icon={<Lock className="h-4 w-4" />}
                      type={showPassword ? 'text' : 'password'} placeholder="Repeat your password"
                      value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
                    <Field id="recovery-phrase" label="Vault recovery phrase" icon={<KeyRound className="h-4 w-4" />}
                      type="password" placeholder="Required to keep access to encrypted files"
                      value={recoveryPhrase} onChange={setRecoveryPhrase} autoComplete="off" />
                    <PillButton type="submit" disabled={isLoading}>
                      {isLoading && <Spinner size={14} />} Update password
                    </PillButton>
                  </form>
                </motion.div>
              )}

              {view === 'forgot' && (
                <motion.div key="forgot" {...viewAnim} transition={{ duration: reduce ? 0.01 : 0.18 }}>
                  <h1 className="ax-title">Reset password</h1>
                  <p className="ax-sub">We’ll email you a link to set a new password.</p>
                  <button type="button" className="ax-text-btn ax-back" onClick={handleBackToLogin}>
                    <Ico.ArrowLeft size={13} /> Back to sign in
                  </button>
                  {!resetEmailSent ? (
                    <form onSubmit={handleForgotPassword} className="ax-form">
                      <Field id="reset-email" label="Email" icon={<Mail className="h-4 w-4" />}
                        type="email" placeholder="Email address" value={email} onChange={setEmail}
                        autoComplete="email" autoFocus />
                      <PillButton type="submit" disabled={isLoading}>
                        {isLoading && <Spinner size={14} />} Send reset link
                      </PillButton>
                    </form>
                  ) : (
                    <div className="ax-form">
                      <div className="ax-status">Reset link sent{email ? <> to <b>{email}</b></> : null}.</div>
                      <PillButton onClick={handleBackToLogin}>Return to sign in</PillButton>
                    </div>
                  )}
                </motion.div>
              )}

              {(view === 'login' || view === 'signup') && (
                <motion.div key="auth" {...viewAnim} transition={{ duration: reduce ? 0.01 : 0.18 }}>
                  <h1 className="ax-title">{isLogin ? 'Unlock your storage' : 'Create your vault'}</h1>
                  <p className="ax-sub">
                    {isLogin ? 'Your files stay encrypted until they reach this device.' : 'Unlimited storage that only you can read.'}
                  </p>

                  {isLogin && passkeyAvailable && (
                    <>
                      <button type="button" className="ax-passkey" onClick={handlePasskeyLogin} disabled={passkeyLoading}>
                        <Fingerprint className={passkeyLoading ? 'ax-passkey-busy' : ''} style={{ width: 17, height: 17 }} />
                        {passkeyLoading ? 'Waiting for your device…' : 'Unlock with passkey'}
                      </button>
                      <div className="ax-divider">or use your password</div>
                    </>
                  )}

                  <form onSubmit={handleSubmit} className="ax-form">
                    <AnimatePresence initial={false}>
                      {!isLogin && (
                        <motion.div key="name-field"
                          initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                          transition={{ duration: reduce ? 0.01 : 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                          style={{ overflow: 'hidden' }}>
                          <Field id="name" label="Full name" icon={<User className="h-4 w-4" />}
                            placeholder="Full name" value={name} onChange={setName} autoComplete="name" autoFocus={!isLogin} />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <Field id="email" label="Email" icon={<Mail className="h-4 w-4" />}
                      type="email" placeholder="Email address" value={email} onChange={setEmail}
                      autoComplete={isLogin ? 'username' : 'email'} autoFocus={isLogin} />

                    <div className={shakeClass}>
                      <Field id="password" label="Password" icon={<Lock className="h-4 w-4" />}
                        type={showPassword ? 'text' : 'password'} placeholder="Password" value={password}
                        onChange={setPassword} autoComplete={isLogin ? 'current-password' : 'new-password'} end={eyeToggle} />
                      {isLogin && (
                        <div className="ax-row-end">
                          <button type="button" className="ax-text-btn" onClick={() => setShowForgotPassword(true)}>Forgot password?</button>
                        </div>
                      )}
                      {!isLogin && password && (
                        <div className="ax-strength" aria-live="polite">
                          <div className="ax-strength-bars">
                            {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= (strength || 0) ? 'on' : ''} />)}
                          </div>
                          <span className="ax-strength-label">{strengthLabel}</span>
                        </div>
                      )}
                    </div>

                    <PillButton type="submit" disabled={isLoading}>
                      {isLoading && <Spinner size={14} />}
                      {isLogin ? 'Unlock' : 'Create account'}
                    </PillButton>
                  </form>

                  <p className="ax-switch">
                    {isLogin ? 'New here? ' : 'Already have an account? '}
                    <button type="button" className="ax-link"
                      onClick={() => { setIsLogin(!isLogin); setPassword(''); setShowPassword(false); }}>
                      {isLogin ? 'Create an account' : 'Sign in'}
                    </button>
                  </p>

                  <div className="ax-oauth">
                    <button type="button" className="ax-oauth-item" onClick={() => handleOAuthSignIn('github')}>
                      <Github className="h-4 w-4" /> Continue with GitHub
                    </button>
                    <details className="ax-more">
                      <summary>Other ways to sign in</summary>
                      <div className="ax-more-row">
                        <button type="button" className="ax-oauth-item" onClick={() => handleOAuthSignIn('google')}><GoogleMark /> Google</button>
                        <button type="button" className="ax-oauth-item" onClick={() => handleOAuthSignIn('discord')}><DiscordMark /> Discord</button>
                      </div>
                    </details>
                  </div>

                  <p className="ax-legal"><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link></p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </AppShell>
  );
};

export default Auth;

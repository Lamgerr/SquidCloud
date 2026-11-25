import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, Github } from '@/lib/icon-map';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { securityService } from '@/services/security-service';
import { INKModal } from '@/components/INKModal';
import { useINK } from '@/hooks/useINK';
import { isPasskeyAvailable, authenticateWithPasskey } from '@/lib/webauthn';
import { getOAuthRedirectUrl, getPasswordRecoveryRedirectUrl } from '@/lib/appLinks';
import { getClientIp } from '@/lib/clientIp';
import { emitSignal } from '@/lib/api';
import SquidLogo from '@/components/ui/SquidLogo';
import {
  AppShell, Spinner, Ico, useDocTitle,
} from '@/components/custom/squid-app';

const AUTH_CSS = `
.ax-root{
  --tx:#f5f5f7;--mute:#86868b;--dim:#6e6e73;--hair:rgba(255,255,255,.13);
  position:relative;min-height:100vh;background:#000;color:var(--tx);
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Helvetica Neue",Arial,sans-serif;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
}
.ax-top{position:absolute;top:0;left:0;right:0;z-index:2;display:flex;align-items:center;justify-content:space-between;
  padding:26px 34px}
.ax-brand{display:inline-flex;align-items:center;gap:8px;color:var(--tx);text-decoration:none;font-size:14px;font-weight:600;letter-spacing:-.02em}
.ax-brand svg{color:var(--tx)}
.ax-nav{display:flex;align-items:center;gap:2px}
.ax-nav-link{display:inline-flex;align-items:center;min-height:40px;padding:0 12px;border-radius:980px;
  color:var(--mute);text-decoration:none;font-size:13px;transition:color .2s,background .2s}
.ax-nav-link:hover{color:var(--tx);background:rgba(255,255,255,.06)}

.ax-main{min-height:100vh;display:grid;place-items:center;padding:92px 20px 44px}
.ax-col{width:100%;max-width:372px}
.ax-mark{display:flex;justify-content:center;margin-bottom:32px;color:var(--tx)}
.ax-title{margin:0;text-align:center;font-size:clamp(32px,5vw,46px);font-weight:600;letter-spacing:-.045em;line-height:1.06;color:var(--tx)}
.ax-sub{margin:12px 0 0;text-align:center;font-size:14px;line-height:1.55;color:var(--mute)}

.ax-modes{display:flex;justify-content:center;gap:22px;margin-top:30px}
.ax-mode{position:relative;display:inline-flex;align-items:center;min-height:38px;padding:0 0 8px;border:0;
  background:none;color:var(--mute);font:inherit;font-size:14px;cursor:pointer;transition:color .2s}
.ax-mode[data-on="true"]{color:var(--tx)}
.ax-mode-underline{position:absolute;left:0;right:0;bottom:0;height:1px;background:var(--tx)}

.ax-passkey{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;min-height:46px;margin-top:24px;
  padding:0 12px;border:0;border-bottom:1px solid var(--hair);background:transparent;color:var(--mute);
  font:inherit;font-size:13px;cursor:pointer;transition:color .2s,border-color .2s}
.ax-passkey:hover{color:var(--tx);border-color:var(--tx)}
.ax-passkey:disabled{cursor:default;color:var(--dim)}
.ax-passkey svg{flex:none}
.ax-passkey-busy{animation:ax-breathe 1.6s ease-in-out infinite}
@keyframes ax-breathe{0%,100%{opacity:.35}50%{opacity:1}}

.ax-divider{display:flex;align-items:center;gap:14px;margin:22px 0 0;color:var(--dim);font-size:11px}
.ax-divider::before,.ax-divider::after{content:"";height:1px;flex:1;background:var(--hair)}

.ax-form{display:flex;flex-direction:column;gap:20px;margin-top:24px}
.ax-field{position:relative}
.ax-field-label{display:block;margin-bottom:7px;font-size:11px;color:var(--mute)}
.ax-field-line{display:flex;align-items:center;gap:9px;min-height:38px}
.ax-field-ico{flex:none;width:16px;display:grid;place-items:center;color:var(--dim)}
.ax-input{flex:1;min-width:0;padding:0;border:0;outline:0;background:transparent;color:var(--tx);
  font:inherit;font-size:16px;letter-spacing:-.01em}
.ax-input::placeholder{color:#48484a}
.ax-field-rule{position:absolute;left:0;right:0;bottom:0;height:1px;background:var(--hair);transition:background .2s}
.ax-field:focus-within .ax-field-rule{background:var(--tx)}
.ax-end{display:flex;align-items:center;flex:none}
.ax-eye{display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:50%;background:transparent;
  color:var(--mute);cursor:pointer;transition:color .2s}
.ax-eye:hover{color:var(--tx)}
.ax-row-end{display:flex;justify-content:flex-end;margin-top:-8px}
.ax-text-btn{display:inline-flex;align-items:center;gap:5px;min-height:34px;padding:0;border:0;background:none;
  color:var(--mute);font:inherit;font-size:12px;cursor:pointer;transition:color .2s}
.ax-text-btn:hover{color:var(--tx)}
.ax-back{margin-top:22px}

.ax-strength{display:flex;align-items:center;gap:10px;margin-top:-9px}
.ax-strength-bars{display:flex;gap:3px;flex:1}
.ax-strength-bars i{height:1px;flex:1;background:var(--hair);transition:background .2s}
.ax-strength-bars i.on{background:var(--tx)}
.ax-strength-label{min-width:38px;text-align:right;font-size:10px;color:var(--dim)}

.ax-btn{display:block;width:100%;min-height:50px;padding:0 20px;border:0;border-radius:980px;
  background:var(--tx);color:#000;font:inherit;font-size:15px;font-weight:500;letter-spacing:-.01em;cursor:pointer;
  transition:transform .18s cubic-bezier(.2,.8,.2,1),opacity .18s}
.ax-btn:hover{opacity:.86}
.ax-btn:active{transform:scale(.985)}
.ax-btn:disabled{cursor:default;opacity:.45}
.ax-btn-quiet{background:transparent;color:var(--tx);border:1px solid var(--hair)}
.ax-btn-quiet:hover{background:rgba(255,255,255,.06);opacity:1}

.ax-oauth{display:flex;justify-content:center;gap:12px;margin-top:26px}
.ax-oauth-item{width:48px;height:48px;display:grid;place-items:center;border:1px solid var(--hair);border-radius:50%;
  background:transparent;color:var(--mute);cursor:pointer;transition:color .2s,border-color .2s,transform .2s}
.ax-oauth-item:hover{color:var(--tx);border-color:var(--tx);transform:translateY(-2px)}
.ax-oauth-item svg{width:17px;height:17px}

.ax-status{padding:14px 0;border-top:1px solid var(--hair);border-bottom:1px solid var(--hair);
  font-size:13px;line-height:1.5;color:var(--mute)}
.ax-legal{margin:26px 0 0;text-align:center;font-size:11px;color:var(--dim)}
.ax-legal a{color:inherit;text-decoration:none}
.ax-legal a:hover{color:var(--tx)}

.ax-root :is(button,a,input):focus-visible{outline:2px solid rgba(255,255,255,.65);outline-offset:3px}
@media(max-width:520px){.ax-top{padding:20px}.ax-nav-link{display:none}.ax-main{padding:84px 20px 32px}}
@media(prefers-reduced-motion:reduce){.ax-root *{animation:none!important;transition-duration:.01ms!important}}
`;

const GoogleMark = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.21 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" opacity=".85" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" opacity=".7" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" opacity=".85" />
  </svg>
);

const DiscordMark = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
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
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
      if (!result.success) {
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
            <div className="ax-mark"><SquidLogo size={26} mono /></div>

            <AnimatePresence mode="wait" initial={false}>
              {view === 'reset' && (
                <motion.div key="reset" {...viewAnim} transition={{ duration: reduce ? 0.01 : 0.18 }}>
                  <h1 className="ax-title">New password.</h1>
                  <p className="ax-sub">Choose a strong password for your account.</p>
                  <form onSubmit={handlePasswordReset} className="ax-form">
                    <Field id="new-password" label="New password" icon={<Lock className="h-4 w-4" />}
                      type={showPassword ? 'text' : 'password'} placeholder="At least 8 characters"
                      value={newPassword} onChange={setNewPassword} autoComplete="new-password" autoFocus end={eyeToggle} />
                    <Field id="confirm-password" label="Confirm password" icon={<Lock className="h-4 w-4" />}
                      type={showPassword ? 'text' : 'password'} placeholder="Repeat your password"
                      value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
                    <PillButton type="submit" disabled={isLoading}>
                      {isLoading && <Spinner size={14} />} Update password
                    </PillButton>
                  </form>
                </motion.div>
              )}

              {view === 'forgot' && (
                <motion.div key="forgot" {...viewAnim} transition={{ duration: reduce ? 0.01 : 0.18 }}>
                  <h1 className="ax-title">Reset password.</h1>
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
                  <h1 className="ax-title">{isLogin ? 'Welcome back.' : 'Create account.'}</h1>
                  <p className="ax-sub">
                    {isLogin ? 'Sign in to your SquidCloud account.' : 'A private home for everything you keep.'}
                  </p>

                  <div className="ax-modes" role="group" aria-label="Authentication mode">
                    {(['login', 'signup'] as const).map((m) => {
                      const active = (m === 'login') === isLogin;
                      return (
                        <button key={m} type="button" className="ax-mode" data-on={active} aria-pressed={active}
                          onClick={() => {
                            if ((m === 'login') === isLogin) return;
                            setIsLogin(m === 'login');
                            setPassword('');
                            setShowPassword(false);
                          }}>
                          {m === 'login' ? 'Sign in' : 'Create account'}
                          {active && <motion.span layoutId="ax-mode-underline" className="ax-mode-underline"
                            transition={reduce ? { duration: 0.01 } : { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }} />}
                        </button>
                      );
                    })}
                  </div>

                  {isLogin && passkeyAvailable && (
                    <>
                      <button type="button" className="ax-passkey" onClick={handlePasskeyLogin} disabled={passkeyLoading}>
                        <svg className={passkeyLoading ? 'ax-passkey-busy' : ''} viewBox="0 0 24 24" width="17" height="17"
                          fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                          <path d="M12 3c-4.4 0-7.5 3.2-7.5 7.6V14" /><path d="M16.5 4.3c3 1 4.5 3.5 4.5 6.3V14" />
                          <path d="M12 7c-2.4 0-4 2-4 4.6v4.2c0 2.4 1.6 4.2 4 4.2s4-1.8 4-4.2v-6c0-2.6-1.6-4.6-4-4.6Z" />
                          <path d="M9.6 11c0-1.6.9-2.6 2.4-2.6s2.4 1 2.4 2.6" />
                        </svg>
                        {passkeyLoading ? 'Waiting for your device…' : 'Sign in with a passkey'}
                      </button>
                      <div className="ax-divider">or</div>
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

                    <div>
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
                      {isLogin ? 'Sign in' : 'Create account'}
                    </PillButton>
                  </form>

                  <div className="ax-oauth" aria-label="Continue with a provider">
                    <button type="button" className="ax-oauth-item" onClick={() => handleOAuthSignIn('github')} aria-label="Continue with GitHub"><Github className="h-4 w-4" /></button>
                    <button type="button" className="ax-oauth-item" onClick={() => handleOAuthSignIn('google')} aria-label="Continue with Google"><GoogleMark /></button>
                    <button type="button" className="ax-oauth-item" onClick={() => handleOAuthSignIn('discord')} aria-label="Continue with Discord"><DiscordMark /></button>
                  </div>

                  <p className="ax-legal"><Link to="/terms">Terms</Link> · <Link to="/privacy">Privacy</Link></p>
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

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, Github, Fingerprint } from '@/lib/icon-map';
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
import {
  AppShell, TopBar, Seg, Spinner, Note, Ico, btn, useDocTitle,
} from '@/components/custom/squid-app';

/* ═══════════════════════════════════════════════════════════════
   AUTH — sign in / sign up / forgot / set new password
   Built for the 50th sign-in as much as the first: email field is
   focused on load, password managers get the right autocomplete
   hints, passkey is one click, nothing animates after first paint.
   All handlers below are unchanged from the previous version.
   Place at: src/pages/Auth.tsx
   ═══════════════════════════════════════════════════════════════ */

const AUTH_CSS = `
.au { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); min-height: calc(100vh / var(--sa-zoom, 1) - 48px); }
.au-side { position: relative; display: flex; flex-direction: column; justify-content: space-between; gap: 48px; padding: 64px var(--sa-gut) 40px; border-right: 1px solid var(--sa-line); background: var(--sa-bg-2); overflow: hidden; }
.au-side > * { position: relative; }
.au-rings { position: absolute !important; right: -140px; bottom: -140px; width: 560px; height: 560px; color: var(--sa-text); opacity: 0.07; pointer-events: none; }
.au-eyebrow { font: 400 11px/1 var(--sa-mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--sa-mute); }
.au-h { margin: 18px 0 0; max-width: 14ch; font: 300 56px/1.04 var(--sa-f); letter-spacing: -0.035em; color: var(--sa-text); }
@media (max-width: 720px) { .au-h { font-size: 36px; } }
.au-p { margin: 18px 0 0; max-width: 40ch; font-size: 15px; line-height: 1.6; color: var(--sa-text-2); }
.au-meta { display: flex; flex-wrap: wrap; gap: 8px 20px; font: 400 11px/1 var(--sa-mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--sa-mute); }
.au-meta span { display: inline-flex; align-items: center; gap: 8px; }
.au-main { display: flex; align-items: center; justify-content: center; padding: 40px var(--sa-gut) 64px; }
.au-card { width: 100%; max-width: 372px; }
.au-card h1 { margin: 0; font: 400 26px/1.15 var(--sa-f); letter-spacing: -0.025em; }
.au-card .sub { margin: 8px 0 0; font-size: 14px; line-height: 1.55; color: var(--sa-text-2); }
.au-card .sa-input { height: 40px; font-size: 14px; }
.au-form { display: grid; gap: 16px; margin-top: 24px; }
.au-or { display: flex; align-items: center; gap: 12px; margin: 18px 0 2px; font: 400 10.5px/1 var(--sa-mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--sa-mute); }
.au-or::before, .au-or::after { content: ''; flex: 1; height: 1px; background: var(--sa-line); }
.au-oauth { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.au-oauth .sa-btn { height: 38px; gap: 7px; font-size: 12.5px; }
.au-str { display: flex; align-items: center; gap: 10px; margin-top: 9px; }
.au-str div { display: flex; gap: 3px; flex: 1; }
.au-str i { height: 3px; flex: 1; border-radius: 2px; background: var(--sa-line-2); transition: background 0.25s; }
.au-str i.on-1 { background: var(--sa-err); } .au-str i.on-2 { background: var(--sa-warn); } .au-str i.on-3 { background: var(--sa-ok); }
.au-str span { min-width: 44px; text-align: right; font: 400 11px/1 var(--sa-mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--sa-mute); }
.au-legal { margin-top: 28px; font-size: 12px; line-height: 1.6; color: var(--sa-mute); }
.au-back { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 22px; padding: 0; border: 0; background: none; font: 400 13px/1 var(--sa-f); color: var(--sa-mute); cursor: pointer; transition: color 0.15s; }
.au-back:hover { color: var(--sa-text); }
@media (max-width: 900px) { .au { grid-template-columns: 1fr; } .au-side { display: none; } .au-main { align-items: flex-start; padding-top: 40px; } }
`;

const GoogleMark = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" opacity=".85" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" opacity=".7" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" opacity=".85" />
  </svg>
);

const DiscordMark = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

type AuthFieldProps = {
  id: string;
  label: string;
  icon: React.ReactNode;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  right?: React.ReactNode;
  end?: React.ReactNode;
};

function AuthField({ id, label, icon, type = 'text', value, onChange, placeholder, autoComplete, autoFocus, right, end }: AuthFieldProps) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <label className="sa-label" htmlFor={id}>{label}</label>
        {right}
      </div>
      <div className="sa-field-wrap">
        {icon}
        <input
          id={id}
          name={id}
          type={type}
          className={`sa-input pl${end ? ' pr' : ''}`}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          autoCapitalize="none"
          spellCheck={false}
        />
        {end && <div className="end">{end}</div>}
      </div>
    </div>
  );
}

const BackArrow = () => <Ico.ArrowLeft size={13} />;

const Auth = () => {
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, signUp, user } = useAuth();
  const [searchParams] = useSearchParams();
  const { isOpen: isINKOpen, openINK, closeINK } = useINK();

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
      toast({ title: "Missing information", description: "Please fill in both password fields", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure both passwords are identical", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Password too short", description: "Password must be at least 8 characters long", variant: "destructive" });
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
        body: 'Your account password was changed. If this wasn\'t you, contact support immediately.',
        link: '/settings/account',
      });
      toast({ title: "Password updated", description: "Your password has been successfully updated." });
      navigate('/auth', { replace: true });
      setIsPasswordReset(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: "Email required", description: "Please enter your email address", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getPasswordRecoveryRedirectUrl(),
      });
      if (error) throw error;
      setResetEmailSent(true);
      toast({ title: "Reset email sent", description: "Check your email for a password reset link" });
    } catch (error: any) {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (!isLogin && !name)) {
      toast({ title: "Missing information", description: "Please fill in all required fields", variant: "destructive" });
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
        toast({ title: "Account created", description: "Welcome to SquidCloud!" });
      }
    } catch (error: any) {
      toast({ title: "Authentication Failed", description: error?.message || "Please check your credentials and try again.", variant: "destructive" });
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
        toast({ title: "Authentication failed", description: "Please try again or use password", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Passkey login failed", description: error.message || "Please try again", variant: "destructive" });
    } finally {
      setPasskeyLoading(false);
    }
  };

  const getCurrentIP = async (): Promise<string> => {
    return getClientIp();
  };

  const handleOAuthSignIn = async (provider: 'github' | 'google' | 'discord') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: getOAuthRedirectUrl() }
      });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: `${provider} sign in failed`, description: error.message, variant: "destructive" });
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

  const COPY = {
    login: { crumb: 'Sign in', eyebrow: 'Sign in', h: 'Pick up where you left off.', p: 'Welcome back to SquidCloud.' },
    signup: { crumb: 'Create account', eyebrow: 'New account', h: 'Start your secure storage journey.', p: 'One account for your files, your keys and the API.' },
    forgot: { crumb: 'Reset password', eyebrow: 'Recovery', h: 'Get back in.', p: 'We will email you a link to choose a new password.' },
    reset: { crumb: 'New password', eyebrow: 'Recovery', h: 'Choose a new password.', p: 'You will be signed in again with it straight after.' },
  }[view];

  useDocTitle(COPY.crumb);

  const strengthTone = (strength || 0) < 2 ? 1 : (strength || 0) < 4 ? 2 : 3;
  const strengthLabel = (strength || 0) < 2 ? 'Weak' : (strength || 0) < 4 ? 'Good' : 'Strong';

  const eyeToggle = (
    <button
      type="button"
      className={btn('ghost', 'icon-sm')}
      onClick={() => setShowPassword(!showPassword)}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
      aria-pressed={showPassword}
      tabIndex={-1}
    >
      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  return (
    <AppShell>
      <style>{AUTH_CSS}</style>
      <INKModal isOpen={isINKOpen} onClose={closeINK} />

      <TopBar home="/" crumbs={[{ label: COPY.crumb }]}>
        <Link to="/pricing" className={btn('ghost', 'sm')}>Pricing</Link>
        <Link to="/help/docs" className={btn('ghost', 'sm')}>Docs</Link>
      </TopBar>

      <div className="au">
        <aside className="au-side">
          <svg className="au-rings" viewBox="0 0 560 560" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
            <circle cx="280" cy="280" r="270" />
            <circle cx="280" cy="280" r="205" />
            <circle cx="280" cy="280" r="140" />
            <circle cx="280" cy="280" r="76" />
            <circle cx="280" cy="280" r="26" fill="currentColor" />
          </svg>
          <div className="sa-grain" aria-hidden="true" />
          <div>
            <div className="au-eyebrow">{COPY.eyebrow}</div>
            <h2 className="au-h">{COPY.h}</h2>
            <p className="au-p">{COPY.p}</p>
          </div>
          <div className="au-meta" aria-hidden="true">
            <span>Passkeys</span>
            <span>GitHub · Google · Discord</span>
            <span>Email recovery</span>
          </div>
        </aside>

        <main className="au-main">
          <div className="au-card sa-in" key={view}>
            {/* ───────── Set new password ───────── */}
            {view === 'reset' && (
              <>
                <h1>Set new password</h1>
                <p className="sub">Enter your new password below</p>
                <form onSubmit={handlePasswordReset} className="au-form">
                  <AuthField
                    id="new-password"
                    label="New password"
                    icon={<Lock className="h-4 w-4" />}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={setNewPassword}
                    autoComplete="new-password"
                    autoFocus
                    end={eyeToggle}
                  />
                  <AuthField
                    id="confirm-password"
                    label="Confirm password"
                    icon={<Lock className="h-4 w-4" />}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Repeat the new password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    autoComplete="new-password"
                  />
                  <button type="submit" className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none" disabled={isLoading}>
                    {isLoading && <Spinner />}
                    Update password
                  </button>
                </form>
              </>
            )}

            {/* ───────── Forgot password ───────── */}
            {view === 'forgot' && (
              <>
                <button type="button" className="au-back" onClick={handleBackToLogin}>
                  <BackArrow /> Back to sign in
                </button>
                <h1>{resetEmailSent ? 'Check your email' : 'Reset your password'}</h1>
                <p className="sub">
                  {resetEmailSent
                    ? 'We sent a password reset link to your email'
                    : "Enter your email and we'll send you a reset link"}
                </p>

                {!resetEmailSent ? (
                  <form onSubmit={handleForgotPassword} className="au-form">
                    <AuthField
                      id="reset-email"
                      label="Email"
                      icon={<Mail className="h-4 w-4" />}
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={setEmail}
                      autoComplete="email"
                      autoFocus
                    />
                    <button type="submit" className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none" disabled={isLoading}>
                      {isLoading && <Spinner />}
                      Send reset link
                    </button>
                  </form>
                ) : (
                  <div className="au-form">
                    <Note tone="ok">
                      The link is on its way{email ? <> to <b>{email}</b></> : null}. It can take a minute; check spam if it does not show up.
                    </Note>
                    <button type="button" className={btn('default', 'lg') + ' block'} onClick={handleBackToLogin}>
                      Back to sign in
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ───────── Sign in / Create account ───────── */}
            {(view === 'login' || view === 'signup') && (
              <>
                <div style={{ marginBottom: 24 }}>
                  <Seg
                    block
                    label="Sign in or create an account"
                    value={isLogin ? 'login' : 'signup'}
                    options={[
                      { value: 'login', label: 'Sign in' },
                      { value: 'signup', label: 'Create account' },
                    ]}
                    onChange={(v) => {
                      if ((v === 'login') === isLogin) return;
                      setIsLogin(v === 'login');
                      setPassword('');
                      setShowPassword(false);
                    }}
                  />
                </div>

                <h1>{isLogin ? 'Sign in' : 'Create account'}</h1>
                <p className="sub">{isLogin ? 'Welcome back to SquidCloud' : 'Start your secure storage journey'}</p>

                {isLogin && passkeyAvailable && (
                  <div style={{ marginTop: 24 }}>
                    <button
                      type="button"
                      onClick={handlePasskeyLogin}
                      disabled={passkeyLoading}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {passkeyLoading ? <Spinner /> : <Fingerprint className="h-4 w-4" />}
                      {passkeyLoading ? 'Authenticating...' : 'Sign in with passkey'}
                    </button>
                    <div className="au-or">or use a password</div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="au-form" style={isLogin && passkeyAvailable ? { marginTop: 14 } : undefined}>
                  {!isLogin && (
                    <AuthField
                      id="name"
                      label="Full name"
                      icon={<User className="h-4 w-4" />}
                      placeholder="John Doe"
                      value={name}
                      onChange={setName}
                      autoComplete="name"
                      autoFocus
                    />
                  )}

                  <AuthField
                    id="email"
                    label="Email"
                    icon={<Mail className="h-4 w-4" />}
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={setEmail}
                    autoComplete={isLogin ? 'username' : 'email'}
                    autoFocus={isLogin}
                  />

                  <div>
                    <AuthField
                      id="password"
                      label="Password"
                      icon={<Lock className="h-4 w-4" />}
                      type={showPassword ? 'text' : 'password'}
                      placeholder={isLogin ? 'Enter your password' : 'Choose a strong password'}
                      value={password}
                      onChange={setPassword}
                      autoComplete={isLogin ? 'current-password' : 'new-password'}
                      end={eyeToggle}
                      right={
                        isLogin ? (
                          <button
                            type="button"
                            className="sa-link"
                            style={{ background: 'none', border: 0, padding: 0, font: '400 12px/1 var(--sa-f)', color: 'var(--sa-mute)', cursor: 'pointer' }}
                            onClick={() => setShowForgotPassword(true)}
                          >
                            Forgot password?
                          </button>
                        ) : undefined
                      }
                    />
                    {!isLogin && password && (
                      <div className="au-str" aria-live="polite">
                        <div>
                          {[1, 2, 3, 4, 5].map((i) => (
                            <i key={i} className={i <= (strength || 0) ? `on-${strengthTone}` : ''} />
                          ))}
                        </div>
                        <span>{strengthLabel}</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className={
                      isLogin && passkeyAvailable
                        ? 'flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-transparent text-sm font-semibold text-foreground transition-all duration-150 hover:bg-muted/60 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none'
                        : 'flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none'
                    }
                    disabled={isLoading}
                  >
                    {isLoading && <Spinner />}
                    {isLogin ? 'Sign in' : 'Create account'}
                  </button>
                </form>

                <div className="au-or" style={{ margin: '24px 0 14px' }}>Continue with</div>
                <div className="au-oauth">
                  <button type="button" className={btn()} onClick={() => handleOAuthSignIn('github')}>
                    <Github className="h-4 w-4" /> GitHub
                  </button>
                  <button type="button" className={btn()} onClick={() => handleOAuthSignIn('google')}>
                    <GoogleMark /> Google
                  </button>
                  <button type="button" className={btn()} onClick={() => handleOAuthSignIn('discord')}>
                    <DiscordMark /> Discord
                  </button>
                </div>

                <p className="au-legal">
                  By continuing, you agree to our{' '}
                  <Link to="/terms" className="sa-link">Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/privacy" className="sa-link">Privacy Policy</Link>.
                </p>
              </>
            )}
          </div>
        </main>
      </div>
    </AppShell>
  );
};

export default Auth;

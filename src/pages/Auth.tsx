import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, Github, Fingerprint, ArrowLeft } from '@/lib/icon-map';
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
import { SegmentedButton, Button } from '@/components/m3/primitives';
import { useDocTitle } from '@/components/custom/squid-app';

/* ═══════════════════════════════════════════════════════════════
   AUTH — Material 3 Expressive
   Rebuilt on the M3 token system. All handlers/data flow unchanged.
   ═══════════════════════════════════════════════════════════════ */

const AUTH_CSS = `
.au-root { min-height: 100vh; background: var(--md-sys-color-surface); color: var(--md-sys-color-on-surface); font-family: var(--m3-font); -webkit-font-smoothing: antialiased; }
.au-grid { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); min-height: 100vh; }
@media (max-width: 900px) { .au-grid { grid-template-columns: 1fr; } .au-side { display: none; } .au-main { align-items: flex-start; padding-top: 32px; } }

.au-side {
  position: relative; display: flex; flex-direction: column; justify-content: space-between; gap: 48px;
  padding: 64px 48px 40px; background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container);
  overflow: hidden; isolation: isolate;
}
.au-side > * { position: relative; z-index: 1; }
.au-rings { position: absolute; right: -140px; bottom: -140px; width: 560px; height: 560px; color: var(--md-sys-color-on-primary-container); opacity: 0.12; pointer-events: none; }
.au-grain { position: absolute; inset: 0; pointer-events: none; opacity: 0.04; background-image: radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0); background-size: 3px 3px; }
.au-eyebrow { font: 500 11px/1 var(--m3-font); letter-spacing: 0.14em; text-transform: uppercase; color: var(--md-sys-color-on-primary-container); opacity: 0.72; }
.au-h { margin: 18px 0 0; max-width: 14ch; font: 400 56px/1.04 var(--m3-font); letter-spacing: -0.035em; }
@media (max-width: 720px) { .au-h { font-size: 36px; } }
.au-p { margin: 18px 0 0; max-width: 40ch; font-size: 15px; line-height: 1.6; opacity: 0.86; }
.au-meta { display: flex; flex-wrap: wrap; gap: 8px 20px; font: 500 11px/1 var(--m3-font); letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.72; }
.au-meta span { display: inline-flex; align-items: center; gap: 8px; }

.au-main { display: flex; align-items: center; justify-content: center; padding: 40px 24px 64px; }
.au-card {
  width: 100%; max-width: 400px;
  background: var(--md-sys-color-surface-container-low); color: var(--md-sys-color-on-surface);
  border-radius: var(--md-sys-shape-corner-extra-large); padding: 32px;
  box-shadow: var(--md-sys-elevation-level2);
  animation: m3-card-enter var(--md-sys-motion-duration-long2) var(--md-sys-motion-easing-emphasized-decelerate) both;
}
.au-card h1 { margin: 0; font: 500 26px/1.15 var(--m3-font); letter-spacing: -0.02em; color: var(--md-sys-color-on-surface); }
.au-card .sub { margin: 8px 0 0; font-size: 14px; line-height: 1.55; color: var(--md-sys-color-on-surface-variant); }

.au-form { display: grid; gap: 16px; margin-top: 24px; }
.au-field-row { display: grid; gap: 6px; }
.au-label-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.au-label { font: 500 12px/1 var(--m3-font); color: var(--md-sys-color-on-surface-variant); letter-spacing: 0.1px; }
.au-field-box {
  display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 0 16px;
  border: 1px solid var(--md-sys-color-outline); border-radius: var(--md-sys-shape-corner-small);
  background: transparent; transition: border-color var(--md-sys-motion-duration-short2) linear, box-shadow var(--md-sys-motion-duration-short2) linear;
}
.au-field-box:focus-within { border-color: var(--md-sys-color-primary); box-shadow: inset 0 0 0 1px var(--md-sys-color-primary); }
.au-field-box input { flex: 1; min-width: 0; height: 56px; border: 0; background: transparent; color: var(--md-sys-color-on-surface); font: 400 16px/24px var(--m3-font); outline: none; }
.au-field-box input::placeholder { color: var(--md-sys-color-on-surface-variant); }

.au-or { display: flex; align-items: center; gap: 12px; margin: 18px 0 2px; font: 500 11px/1 var(--m3-font); letter-spacing: 0.12em; text-transform: uppercase; color: var(--md-sys-color-on-surface-variant); }
.au-or::before, .au-or::after { content: ''; flex: 1; height: 1px; background: var(--md-sys-color-outline-variant); }

.au-oauth { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }

.au-str { display: flex; align-items: center; gap: 10px; margin-top: 9px; }
.au-str div { display: flex; gap: 3px; flex: 1; }
.au-str i { height: 4px; flex: 1; border-radius: var(--md-sys-shape-corner-full); background: var(--md-sys-color-surface-container-highest); transition: background var(--md-sys-motion-duration-short3) linear; }
.au-str i.on-1 { background: var(--md-sys-color-error); }
.au-str i.on-2 { background: var(--md-sys-color-warning); }
.au-str i.on-3 { background: var(--md-sys-color-primary); }
.au-str span { min-width: 44px; text-align: right; font: 500 11px/1 var(--m3-font); letter-spacing: 0.06em; text-transform: uppercase; color: var(--md-sys-color-on-surface-variant); }

.au-legal { margin-top: 24px; font-size: 12px; line-height: 1.6; color: var(--md-sys-color-on-surface-variant); }
.au-back { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 20px; padding: 0; border: 0; background: none; font: 500 13px/1 var(--m3-font); color: var(--md-sys-color-on-surface-variant); cursor: pointer; transition: color var(--md-sys-motion-duration-short2) linear; }
.au-back:hover { color: var(--md-sys-color-on-surface); }
.au-back .m3-icon-btn { width: 28px; height: 28px; }

.au-link { background: none; border: 0; padding: 0; font: 500 12px/1 var(--m3-font); color: var(--md-sys-color-primary); cursor: pointer; }

/* M3 Expressive motion */
@keyframes m3-card-enter {
  from { opacity: 0; transform: scale(0.92) translateY(16px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes m3-fade-slide {
  from { opacity: 0; transform: translateX(12px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes m3-ripple-out {
  to { transform: scale(1); opacity: 0; }
}
.au-view { animation: m3-fade-slide var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized-decelerate) both; }

@media (prefers-reduced-motion: reduce) {
  .au-card, .au-view { animation: none !important; }
}
`;

const GoogleMark = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const DiscordMark = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106a13.107 13.107 0 0 0-1.872-.892.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const GithubMark = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.02c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.18c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
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
  end?: React.ReactNode;
  right?: React.ReactNode;
};

function AuthField({ id, label, icon, type = 'text', value, onChange, placeholder, autoComplete, autoFocus, end, right }: AuthFieldProps) {
  return (
    <div className="au-field-row">
      <div className="au-label-row">
        <label className="au-label" htmlFor={id}>{label}</label>
        {right}
      </div>
      <div className="au-field-box">
        <span className="m3-on-surface-variant" aria-hidden="true" style={{ display: 'inline-flex' }}>{icon}</span>
        <input
          id={id}
          name={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          autoCapitalize="none"
          spellCheck={false}
        />
        {end && <span className="m3-on-surface-variant" aria-hidden="true" style={{ display: 'inline-flex' }}>{end}</span>}
      </div>
    </div>
  );
}

const BackArrow = () => <ArrowLeft className="h-4 w-4" />;

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
          try { await securityService.trackLogin(true, await getClientIp()); } catch {}
        }, 100);
      } else {
        await signUp(email, password, name);
        toast({ title: "Account created", description: "Welcome to SquidCloud!" });
      }
    } catch (error: any) {
      toast({ title: "Authentication Failed", description: error?.message || "Please check your credentials and try again.", variant: "destructive" });
      if (isLogin) {
        setTimeout(async () => {
          try { await securityService.trackLogin(false, await getClientIp()); } catch {}
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

  const COPY = {
    login: { crumb: 'Sign in', eyebrow: 'Sign in', h: 'Pick up where you left off.', p: 'Welcome back to SquidCloud.' },
    signup: { crumb: 'Create account', eyebrow: 'New account', h: 'Start your secure storage journey.', p: 'One account for your files, your keys and the API.' },
    forgot: { crumb: 'Reset password', eyebrow: 'Recovery', h: 'Get back in.', p: 'We will email you a link to choose a new password.' },
    reset: { crumb: 'New password', eyebrow: 'Recovery', h: 'Choose a new password.', p: 'You will be signed in again with it straight after.' },
  }[view];

  useDocTitle(COPY.crumb);

  const strength = checkPasswordStrength(password);
  const strengthTone = (strength || 0) < 2 ? 1 : (strength || 0) < 4 ? 2 : 3;
  const strengthLabel = (strength || 0) < 2 ? 'Weak' : (strength || 0) < 4 ? 'Good' : 'Strong';

  const eyeToggle = (
    <button
      type="button"
      className="m3-icon-btn m3-icon-btn--sm"
      onClick={() => setShowPassword(!showPassword)}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
      aria-pressed={showPassword}
      tabIndex={-1}
    >
      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  return (
    <div className="au-root">
      <style>{AUTH_CSS}</style>
      <INKModal isOpen={isINKOpen} onClose={closeINK} />

      <div className="au-grid">
        <aside className="au-side" aria-hidden="true">
          <svg className="au-rings" viewBox="0 0 560 560" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
            <circle cx="280" cy="280" r="270" />
            <circle cx="280" cy="280" r="205" />
            <circle cx="280" cy="280" r="140" />
            <circle cx="280" cy="280" r="76" />
            <circle cx="280" cy="280" r="26" fill="currentColor" />
          </svg>
          <div className="au-grain" aria-hidden="true" />
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
          <div className="au-card au-view" key={view}>
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
                  <Button type="submit" fullWidth disabled={isLoading} loading={isLoading} loadingLabel="Updating…">
                    Update password
                  </Button>
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
                    <Button type="submit" fullWidth disabled={isLoading} loading={isLoading} loadingLabel="Sending…">
                      Send reset link
                    </Button>
                  </form>
                ) : (
                  <div className="au-form">
                    <div className="m3-card m3-card--filled" style={{ padding: 16 }}>
                      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--md-sys-color-on-surface)' }}>
                        The link is on its way{email ? <> to <b>{email}</b></> : null}. It can take a minute; check spam if it does not show up.
                      </p>
                    </div>
                    <Button variant="tonal" fullWidth onClick={handleBackToLogin}>
                      Back to sign in
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* ───────── Sign in / Create account ───────── */}
            {(view === 'login' || view === 'signup') && (
              <>
                <div style={{ marginBottom: 20 }}>
                  <SegmentedButton
                    options={[
                      { value: 'login', label: 'Sign in' },
                      { value: 'signup', label: 'Create account' },
                    ]}
                    value={isLogin ? 'login' : 'signup'}
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
                  <div style={{ marginTop: 20 }}>
                    <Button
                      variant="filled"
                      fullWidth
                      disabled={passkeyLoading}
                      loading={passkeyLoading}
                      loadingLabel="Authenticating…"
                      icon={!passkeyLoading ? <Fingerprint className="h-5 w-5" /> : undefined}
                      onClick={handlePasskeyLogin}
                    >
                      {passkeyLoading ? 'Authenticating…' : 'Sign in with passkey'}
                    </Button>
                    <div className="au-or">or use a password</div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="au-form" style={isLogin && passkeyAvailable ? { marginTop: 12 } : undefined}>
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
                          <button type="button" className="au-link" onClick={() => setShowForgotPassword(true)}>
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

                  <Button
                    type="submit"
                    fullWidth
                    disabled={isLoading}
                    loading={isLoading}
                    loadingLabel={isLogin ? 'Signing in…' : 'Creating…'}
                    variant={isLogin && passkeyAvailable ? 'outlined' : 'filled'}
                  >
                    {isLogin ? 'Sign in' : 'Create account'}
                  </Button>
                </form>

                <div className="au-or" style={{ margin: '20px 0 12px' }}>Continue with</div>
                <div className="au-oauth">
                  <Button variant="outlined" onClick={() => handleOAuthSignIn('github')} icon={<GithubMark />}>GitHub</Button>
                  <Button variant="outlined" onClick={() => handleOAuthSignIn('google')} icon={<GoogleMark />}>Google</Button>
                  <Button variant="outlined" onClick={() => handleOAuthSignIn('discord')} icon={<DiscordMark />}>Discord</Button>
                </div>

                <p className="au-legal">
                  By continuing, you agree to our{' '}
                  <Link to="/terms" className="au-link">Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/privacy" className="au-link">Privacy Policy</Link>.
                </p>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Auth;

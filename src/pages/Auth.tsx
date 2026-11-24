import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
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
import SquidLogo from '@/components/ui/SquidLogo';
import {
  AppShell, Spinner, Ico, useDocTitle,
} from '@/components/custom/squid-app';
import { SPRING, JELLY } from '@/components/FloatingDock';

const RIM_MASK = `
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;`;

const AUTH_CSS = `
.au-stage {
  --lq-spring: cubic-bezier(0.34, 1.4, 0.64, 1);
  --lq-jelly: cubic-bezier(0.34, 1.56, 0.64, 1);
  --g-ink: #e8e7e1;
  --g-mute: rgba(232, 231, 225, 0.48);
  --g-fill: rgba(13, 14, 13, 0.86);
  --g-fill-hi: rgba(24, 27, 25, 0.92);
  --g-well: rgba(8, 9, 8, 0.72);
  --g-line: rgba(232, 231, 225, 0.09);
  --g-rim: rgba(232, 231, 225, 0.16);
  position: relative;
  min-height: calc(100vh / var(--sa-zoom, 1));
  display: grid;
  place-items: center;
  padding: 88px 20px 48px;
  background:
    radial-gradient(46% 38% at 50% 42%, rgba(232, 231, 225, 0.03), transparent 72%),
    var(--sa-bg, #090b0a);
}
@supports (transition-timing-function: linear(0, 1)) {
  .au-stage { --lq-spring: ${SPRING}; --lq-jelly: ${JELLY}; }
}

/* Floating top dock */
.au-top-dock {
  position: fixed;
  top: max(18px, env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 44px;
  padding: 4px 6px 4px 14px;
  border-radius: 999px;
  background: var(--g-fill);
  border: 1px solid var(--g-line);
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  box-shadow: inset 0 1px 0 var(--g-rim), 0 14px 34px -14px rgba(0, 0, 0, 0.82);
}
.au-brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font: 500 13.5px/1 var(--sa-f);
  letter-spacing: -0.01em;
  color: var(--g-ink);
  text-decoration: none;
  padding-right: 8px;
}
.au-top-sep {
  width: 1px;
  height: 16px;
  background: var(--g-line);
}
.au-top-pill {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 13px;
  border-radius: 999px;
  font: 400 12.5px/1 var(--sa-f);
  color: var(--g-mute);
  text-decoration: none;
  transition: color 0.18s, background 0.18s;
}
.au-top-pill:hover {
  color: var(--g-ink);
  background: rgba(232, 231, 225, 0.06);
}

/* Main dark liquid-glass vessel */
.au-vessel {
  position: relative;
  width: 100%;
  max-width: 368px;
  padding: 20px;
  border-radius: 26px;
  background: var(--g-fill);
  border: 1px solid var(--g-line);
  -webkit-backdrop-filter: blur(24px);
  backdrop-filter: blur(24px);
  box-shadow:
    inset 0 1px 0 var(--g-rim),
    0 28px 64px -22px rgba(0, 0, 0, 0.88);
  color: var(--g-ink);
}
.au-vessel::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  pointer-events: none;
  opacity: 0.45;
  background: conic-gradient(
    from 205deg at 50% 50%,
    var(--g-rim),
    transparent 80deg,
    transparent 160deg,
    var(--g-rim) 220deg,
    transparent 300deg,
    var(--g-rim)
  );
  ${RIM_MASK}
}

/* Segmented mode dock */
.au-seg {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  padding: 3px;
  border-radius: 999px;
  background: var(--g-well);
  border: 1px solid var(--g-line);
  box-shadow: inset 0 1px 0 rgba(232, 231, 225, 0.05);
}
.au-seg-btn {
  position: relative;
  height: 36px;
  border: 0;
  border-radius: 999px;
  background: none;
  color: var(--g-mute);
  font: 500 13px/1 var(--sa-f);
  letter-spacing: -0.005em;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: color 0.18s !important;
}
.au-seg-btn[aria-pressed="true"],
.au-seg-btn:hover {
  color: var(--g-ink);
}
.au-seg-thumb {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: var(--g-fill-hi);
  border: 1px solid rgba(232, 231, 225, 0.12);
  box-shadow:
    inset 0 1px 0 rgba(232, 231, 225, 0.14),
    0 6px 16px -4px rgba(0, 0, 0, 0.65);
}
.au-seg-lbl {
  position: relative;
  z-index: 1;
}

/* Inputs */
.au-form {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}
.au-field {
  position: relative;
  display: flex;
  align-items: center;
}
.au-field-ico {
  position: absolute;
  left: 15px;
  color: var(--g-mute);
  pointer-events: none;
  display: grid;
  place-items: center;
}
.au-input {
  width: 100%;
  height: 44px;
  padding: 0 42px 0 42px;
  border-radius: 999px;
  background: var(--g-well);
  border: 1px solid var(--g-line);
  color: var(--g-ink);
  font: 400 13.5px/1 var(--sa-f);
  box-shadow: inset 0 1px 0 rgba(232, 231, 225, 0.04);
  transition: border-color 0.2s, background 0.2s, box-shadow 0.25s;
}
.au-input::placeholder {
  color: rgba(232, 231, 225, 0.34);
}
.au-input:hover {
  border-color: rgba(232, 231, 225, 0.16);
}
.au-input:focus {
  outline: none;
  background: rgba(12, 14, 13, 0.94);
  border-color: rgba(232, 231, 225, 0.28);
  box-shadow: 0 0 0 3px rgba(232, 231, 225, 0.06);
}
.au-field-end {
  position: absolute;
  right: 7px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.au-icon-pill {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  border: 0;
  background: transparent;
  color: var(--g-mute);
  cursor: pointer;
  transition: color 0.16s, background 0.16s;
}
.au-icon-pill:hover {
  color: var(--g-ink);
  background: rgba(232, 231, 225, 0.08);
}

/* Jelly Pill Buttons — dark glass only, zero white fill */
.au-hit {
  transition: none !important;
  scale: none !important;
  position: relative;
  display: block;
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  border-radius: 999px;
  -webkit-tap-highlight-color: transparent;
}
.au-hit:disabled {
  opacity: 0.42;
  pointer-events: none;
}
.au-hit:focus-visible {
  outline: 2px solid rgba(232, 231, 225, 0.75);
  outline-offset: 3px;
}
.au-pill-face {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  height: 46px;
  padding: 0 20px;
  border-radius: 999px;
  color: var(--g-ink);
  font: 500 13.5px/1 var(--sa-f);
  letter-spacing: -0.01em;
  background:
    radial-gradient(120px circle at var(--mx, 50%) var(--my, 50%), rgba(232, 231, 225, 0.09), transparent 70%),
    var(--g-fill-hi);
  border: 1px solid rgba(232, 231, 225, 0.14);
  box-shadow:
    inset 0 1px 0 rgba(232, 231, 225, 0.2),
    0 12px 28px -12px rgba(0, 0, 0, 0.82);
  will-change: transform;
}
.au-pill-face.quiet {
  height: 40px;
  background:
    radial-gradient(90px circle at var(--mx, 50%) var(--my, 50%), rgba(232, 231, 225, 0.07), transparent 70%),
    var(--g-well);
  border-color: var(--g-line);
  box-shadow: inset 0 1px 0 rgba(232, 231, 225, 0.08);
  font-size: 12.5px;
  color: rgba(232, 231, 225, 0.78);
}
.au-hit:hover .au-pill-face {
  border-color: rgba(232, 231, 225, 0.24);
  color: var(--g-ink);
}

/* OAuth dock row */
.au-oauth {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 10px;
}

/* Divider */
.au-div {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 14px 0 4px;
  font: 400 10px/1 var(--sa-mono);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(232, 231, 225, 0.32);
}
.au-div::before,
.au-div::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--g-line);
}

/* Password strength meter */
.au-str {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 0;
}
.au-str-bars {
  display: flex;
  gap: 4px;
  flex: 1;
}
.au-str-bars i {
  height: 2px;
  flex: 1;
  border-radius: 999px;
  background: rgba(232, 231, 225, 0.1);
  transition: background 0.25s;
}
.au-str-bars i.on-1 { background: #d98080; }
.au-str-bars i.on-2 { background: #d9ac62; }
.au-str-bars i.on-3 { background: #8fc98f; }
.au-str span {
  font: 400 10px/1 var(--sa-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--g-mute);
}

/* Row helpers */
.au-row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 6px 0;
}
.au-text-btn {
  border: 0;
  background: none;
  padding: 4px 8px;
  border-radius: 999px;
  font: 400 12px/1 var(--sa-f);
  color: var(--g-mute);
  cursor: pointer;
  transition: color 0.16s, background 0.16s;
}
.au-text-btn:hover {
  color: var(--g-ink);
  background: rgba(232, 231, 225, 0.06);
}
.au-head-minimal {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 0 4px;
}
.au-head-minimal h1 {
  margin: 0;
  font: 400 18px/1.2 var(--sa-f) !important;
  letter-spacing: -0.02em;
  color: var(--g-ink);
}
.au-legal {
  margin: 14px 0 2px;
  text-align: center;
  font-size: 11px;
  color: rgba(232, 231, 225, 0.34);
}
.au-legal a {
  color: rgba(232, 231, 225, 0.58);
  text-decoration: none;
  transition: color 0.15s;
}
.au-legal a:hover {
  color: var(--g-ink);
}
.au-status-box {
  padding: 14px 16px;
  border-radius: 16px;
  background: var(--g-well);
  border: 1px solid rgba(143, 201, 143, 0.25);
  font-size: 12.5px;
  line-height: 1.5;
  color: rgba(232, 231, 225, 0.78);
}
`;

const GoogleMark = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" opacity=".85" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" opacity=".7" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" opacity=".85" />
  </svg>
);

const DiscordMark = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

function useGlint<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const onPointerMove = useCallback((e: React.PointerEvent<T>) => {
    if (e.pointerType === 'touch') return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  }, []);
  return { ref, onPointerMove };
}

type JellyButtonProps = {
  type?: 'button' | 'submit';
  quiet?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
};

function JellyButton({ type = 'button', quiet, disabled, onClick, children, ariaLabel }: JellyButtonProps) {
  const reduce = !!useReducedMotion();
  const glint = useGlint<HTMLButtonElement>();
  const jelly = reduce ? { duration: 0.01 } : { type: 'spring' as const, stiffness: 520, damping: 15, mass: 0.8 };
  return (
    <button
      ref={glint.ref}
      type={type}
      disabled={disabled}
      onClick={onClick}
      onPointerMove={glint.onPointerMove}
      aria-label={ariaLabel}
      className="au-hit"
    >
      <motion.span
        className={`au-pill-face${quiet ? ' quiet' : ''}`}
        whileHover={reduce ? undefined : { scale: 1.025 }}
        whileTap={reduce ? undefined : { scaleX: 0.94, scaleY: 0.87 }}
        transition={jelly}
      >
        {children}
      </motion.span>
    </button>
  );
}

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
};

function AuthField({ id, label, icon, type = 'text', value, onChange, placeholder, autoComplete, autoFocus, end }: AuthFieldProps) {
  return (
    <div className="au-field">
      <label className="sa-sr" htmlFor={id}>{label}</label>
      <span className="au-field-ico">{icon}</span>
      <input
        id={id}
        name={id}
        type={type}
        className="au-input"
        placeholder={placeholder || label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        autoCapitalize="none"
        spellCheck={false}
      />
      {end && <div className="au-field-end">{end}</div>}
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
      className="au-icon-pill"
      onClick={() => setShowPassword(!showPassword)}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
      aria-pressed={showPassword}
      tabIndex={-1}
    >
      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
    </button>
  );

  const stageSpring = reduce
    ? { duration: 0.01 }
    : { type: 'spring' as const, stiffness: 330, damping: 24, mass: 0.9 };

  return (
    <AppShell>
      <style>{AUTH_CSS}</style>
      <INKModal isOpen={isINKOpen} onClose={closeINK} />

      <header className="au-top-dock">
        <Link to="/" className="au-brand" aria-label="SquidCloud home">
          <SquidLogo size={17} mono />
          <span>SquidCloud</span>
        </Link>
        <span className="au-top-sep" aria-hidden="true" />
        <Link to="/pricing" className="au-top-pill">Pricing</Link>
        <Link to="/help/docs" className="au-top-pill">Docs</Link>
      </header>

      <main className="au-stage">
        <motion.div
          layout
          className="au-vessel"
          initial={reduce ? false : { opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={stageSpring}
        >
          <AnimatePresence mode="wait" initial={false}>
            {view === 'reset' && (
              <motion.div
                key="reset"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
                transition={stageSpring}
              >
                <div className="au-head-minimal">
                  <h1>New password</h1>
                </div>
                <form onSubmit={handlePasswordReset} className="au-form">
                  <AuthField
                    id="new-password"
                    label="New password"
                    icon={<Lock className="h-4 w-4" />}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="New password (8+ chars)"
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
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    autoComplete="new-password"
                  />
                  <JellyButton type="submit" disabled={isLoading}>
                    {isLoading && <Spinner size={14} />}
                    Update password
                  </JellyButton>
                </form>
              </motion.div>
            )}

            {view === 'forgot' && (
              <motion.div
                key="forgot"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
                transition={stageSpring}
              >
                <div className="au-head-minimal">
                  <h1>{resetEmailSent ? 'Check your inbox' : 'Reset password'}</h1>
                  <button type="button" className="au-text-btn" onClick={handleBackToLogin}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Ico.ArrowLeft size={12} /> Back
                    </span>
                  </button>
                </div>

                {!resetEmailSent ? (
                  <form onSubmit={handleForgotPassword} className="au-form">
                    <AuthField
                      id="reset-email"
                      label="Email"
                      icon={<Mail className="h-4 w-4" />}
                      type="email"
                      placeholder="Email address"
                      value={email}
                      onChange={setEmail}
                      autoComplete="email"
                      autoFocus
                    />
                    <JellyButton type="submit" disabled={isLoading}>
                      {isLoading && <Spinner size={14} />}
                      Send reset link
                    </JellyButton>
                  </form>
                ) : (
                  <div className="au-form">
                    <div className="au-status-box">
                      Reset link sent{email ? <> to <b>{email}</b></> : null}.
                    </div>
                    <JellyButton onClick={handleBackToLogin}>
                      Return to sign in
                    </JellyButton>
                  </div>
                )}
              </motion.div>
            )}

            {(view === 'login' || view === 'signup') && (
              <motion.div
                key="auth-main"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
                transition={stageSpring}
              >
                <div className="au-seg" role="group" aria-label="Authentication mode">
                  {(['login', 'signup'] as const).map((m) => {
                    const active = (m === 'login') === isLogin;
                    return (
                      <button
                        key={m}
                        type="button"
                        className="au-seg-btn"
                        aria-pressed={active}
                        onClick={() => {
                          if ((m === 'login') === isLogin) return;
                          setIsLogin(m === 'login');
                          setPassword('');
                          setShowPassword(false);
                        }}
                      >
                        {active && (
                          <motion.span
                            layoutId="au-mode-thumb"
                            className="au-seg-thumb"
                            transition={
                              reduce
                                ? { duration: 0.01 }
                                : { type: 'spring', stiffness: 380, damping: 21, mass: 0.8 }
                            }
                          />
                        )}
                        <span className="au-seg-lbl">
                          {m === 'login' ? 'Sign in' : 'Create account'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {isLogin && passkeyAvailable && (
                  <div style={{ marginTop: 12 }}>
                    <JellyButton onClick={handlePasskeyLogin} disabled={passkeyLoading}>
                      {passkeyLoading ? <Spinner size={14} /> : <Fingerprint className="h-4 w-4" />}
                      {passkeyLoading ? 'Authenticating…' : 'Passkey'}
                    </JellyButton>
                    <div className="au-div">or</div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="au-form">
                  <AnimatePresence initial={false}>
                    {!isLogin && (
                      <motion.div
                        key="name-field"
                        initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                        transition={stageSpring}
                        style={{ overflow: 'hidden' }}
                      >
                        <AuthField
                          id="name"
                          label="Full name"
                          icon={<User className="h-4 w-4" />}
                          placeholder="Full name"
                          value={name}
                          onChange={setName}
                          autoComplete="name"
                          autoFocus={!isLogin}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AuthField
                    id="email"
                    label="Email"
                    icon={<Mail className="h-4 w-4" />}
                    type="email"
                    placeholder="Email address"
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
                      placeholder="Password"
                      value={password}
                      onChange={setPassword}
                      autoComplete={isLogin ? 'current-password' : 'new-password'}
                      end={eyeToggle}
                    />

                    {isLogin && (
                      <div className="au-row-between">
                        <span />
                        <button
                          type="button"
                          className="au-text-btn"
                          onClick={() => setShowForgotPassword(true)}
                        >
                          Forgot?
                        </button>
                      </div>
                    )}

                    {!isLogin && password && (
                      <div className="au-str" aria-live="polite">
                        <div className="au-str-bars">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <i key={i} className={i <= (strength || 0) ? `on-${strengthTone}` : ''} />
                          ))}
                        </div>
                        <span>{strengthLabel}</span>
                      </div>
                    )}
                  </div>

                  <JellyButton
                    type="submit"
                    quiet={isLogin && passkeyAvailable}
                    disabled={isLoading}
                  >
                    {isLoading && <Spinner size={14} />}
                    {isLogin ? 'Continue' : 'Create account'}
                  </JellyButton>
                </form>

                <div className="au-oauth">
                  <JellyButton quiet onClick={() => handleOAuthSignIn('github')} ariaLabel="Continue with GitHub">
                    <Github className="h-3.5 w-3.5" />
                    <span>GitHub</span>
                  </JellyButton>
                  <JellyButton quiet onClick={() => handleOAuthSignIn('google')} ariaLabel="Continue with Google">
                    <GoogleMark />
                    <span>Google</span>
                  </JellyButton>
                  <JellyButton quiet onClick={() => handleOAuthSignIn('discord')} ariaLabel="Continue with Discord">
                    <DiscordMark />
                    <span>Discord</span>
                  </JellyButton>
                </div>

                <p className="au-legal">
                  <Link to="/terms">Terms</Link> · <Link to="/privacy">Privacy</Link>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>
    </AppShell>
  );
};

export default Auth;

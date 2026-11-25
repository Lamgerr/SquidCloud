import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import AuthIdentityStage from '@/components/AuthIdentityStage';
import PasskeyRitual from '@/components/PasskeyRitual';

const AUTH_CSS = `
.ax-root{
  --ax-ink:#e9e8e2;--ax-mute:rgba(233,232,226,.52);--ax-line:rgba(233,232,226,.1);
  --ax-ember:#ff9a68;--ax-ember-deep:#ff7c46;--ax-bg:#090a08;
  position:relative;min-height:100vh;width:100%;overflow:hidden;background:var(--ax-bg);color:var(--ax-ink);
  font-family:var(--sa-f,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
}
.ax-root::before{content:"";position:absolute;inset:0;pointer-events:none;z-index:0;
  background:radial-gradient(58% 52% at 6% 4%,rgba(255,138,92,.075),transparent 70%),
             radial-gradient(52% 50% at 98% 96%,rgba(120,104,255,.045),transparent 70%)}
.ax-root::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:0;opacity:.14;mix-blend-mode:soft-light;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E")}

/* top chrome — floating text, no pill, no border */
.ax-top{position:absolute;top:0;left:0;right:0;z-index:30;display:flex;align-items:center;justify-content:space-between;
  padding:24px clamp(20px,4vw,52px)}
.ax-brand{display:inline-flex;align-items:center;gap:9px;color:var(--ax-ink);text-decoration:none;font-size:14px;font-weight:600;letter-spacing:-.015em}
.ax-brand svg{color:var(--ax-ember)}
.ax-nav{display:flex;align-items:center;gap:4px}
.ax-nav-link{display:inline-flex;align-items:center;min-height:40px;padding:0 14px;border-radius:999px;
  color:var(--ax-mute);text-decoration:none;font-size:12.5px;transition:background .18s,color .18s}
.ax-nav-link:hover{color:var(--ax-ink);background:rgba(233,232,226,.06)}

/* the stage: editorial left, living art right */
.ax-grid{position:relative;z-index:2;display:grid;grid-template-columns:minmax(340px,470px) minmax(0,1fr);
  gap:clamp(28px,5vw,76px);align-items:center;max-width:1400px;min-height:100vh;margin:0 auto;
  padding:92px clamp(24px,5vw,72px) 52px}
.ax-left{position:relative;z-index:3;width:100%}
.ax-right{position:relative;height:min(80vh,780px);min-height:470px}
.ax-right::before{content:"";position:absolute;left:calc(-1 * clamp(14px,2.5vw,38px));top:12%;bottom:12%;width:1px;
  background:linear-gradient(180deg,transparent,rgba(233,232,226,.13),transparent)}

.ax-eyebrow{display:flex;align-items:center;gap:10px;margin:0 0 20px;font-size:10px;font-weight:550;
  letter-spacing:.2em;text-transform:uppercase;color:rgba(255,154,104,.8)}
.ax-eyebrow::before{content:"";width:24px;height:1px;background:linear-gradient(90deg,var(--ax-ember),transparent)}
.ax-title{margin:0;font-size:clamp(42px,5.4vw,78px);font-weight:280;letter-spacing:-.058em;line-height:.97;color:var(--ax-ink)}
.ax-title em{font-style:normal;background:linear-gradient(115deg,#ffd7b4 0%,#ff9a68 48%,#ff7442 100%);
  -webkit-background-clip:text;background-clip:text;color:transparent}
.ax-sub{margin:20px 0 0;max-width:350px;font-size:13.5px;line-height:1.65;color:var(--ax-mute)}

/* mode switch — text with a sliding underline, never a segmented box */
.ax-modes{display:flex;align-items:center;gap:26px;margin-top:30px}
.ax-mode{position:relative;display:inline-flex;align-items:center;min-height:40px;padding:0 0 9px;border:0;
  background:none;color:var(--ax-mute);font:inherit;font-size:13px;cursor:pointer;transition:color .2s}
.ax-mode[data-on="true"]{color:var(--ax-ink)}
.ax-mode-underline{position:absolute;left:0;right:0;bottom:0;height:2px;border-radius:2px;
  background:linear-gradient(90deg,var(--ax-ember),rgba(255,154,104,.18))}

.ax-passkey{margin-top:26px}
.ax-or{display:flex;align-items:center;gap:14px;margin:22px 0;color:rgba(233,232,226,.3);font-size:10.5px;
  letter-spacing:.08em;text-transform:uppercase}
.ax-or::before,.ax-or::after{content:"";height:1px;flex:1;background:var(--ax-line)}

/* form — bare type and a single growing rule */
.ax-form{display:flex;flex-direction:column;gap:22px;margin-top:24px}
.ax-field{position:relative}
.ax-field-label{display:block;margin-bottom:9px;font-size:9.5px;font-weight:550;letter-spacing:.17em;
  text-transform:uppercase;color:var(--ax-mute);transition:color .2s}
.ax-field:focus-within .ax-field-label{color:rgba(255,154,104,.9)}
.ax-field-line{display:flex;align-items:center;gap:11px;min-height:40px}
.ax-field-ico{flex:none;width:17px;display:grid;place-items:center;color:rgba(233,232,226,.34);transition:color .2s}
.ax-field:focus-within .ax-field-ico{color:rgba(255,154,104,.85)}
.ax-input{flex:1;min-width:0;padding:0;border:0;outline:0;background:transparent;color:var(--ax-ink);
  font:inherit;font-size:19px;font-weight:350;letter-spacing:-.015em}
.ax-input::placeholder{color:rgba(233,232,226,.2)}
.ax-field-rule{position:absolute;left:0;right:0;bottom:0;height:1px;background:var(--ax-line);overflow:hidden}
.ax-field-rule::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,var(--ax-ember),rgba(255,154,104,.22));
  transform:scaleX(0);transform-origin:left;transition:transform .5s cubic-bezier(.16,1,.3,1)}
.ax-field:focus-within .ax-field-rule::after{transform:scaleX(1)}
.ax-end{display:flex;align-items:center;flex:none}
.ax-eye{display:grid;place-items:center;width:38px;height:38px;border:0;border-radius:50%;background:transparent;
  color:var(--ax-mute);cursor:pointer;transition:background .2s,color .2s}
.ax-eye:hover{background:rgba(233,232,226,.07);color:var(--ax-ink)}
.ax-row-end{display:flex;justify-content:flex-end;margin-top:-9px}
.ax-text-btn{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0;border:0;background:none;
  color:var(--ax-mute);font:inherit;font-size:12px;cursor:pointer;transition:color .2s}
.ax-text-btn:hover{color:var(--ax-ember)}
.ax-back{margin-top:20px}

.ax-strength{display:flex;align-items:center;gap:12px;margin-top:-11px}
.ax-strength-bars{display:flex;gap:4px;flex:1}
.ax-strength-bars i{height:2px;flex:1;border-radius:2px;background:rgba(233,232,226,.1);transition:background .3s,box-shadow .3s}
.ax-strength-bars i.on-1{background:var(--ax-ember-deep)}
.ax-strength-bars i.on-2{background:#ffb35f}
.ax-strength-bars i.on-3{background:#ffd49a;box-shadow:0 0 10px rgba(255,190,130,.4)}
.ax-strength-label{min-width:42px;text-align:right;font-size:10.5px;color:var(--ax-mute)}

/* one leading element: the ember CTA */
.ax-btn{position:relative;display:block;width:100%;padding:0;border:0;background:none;font:inherit;color:inherit;cursor:pointer}
.ax-btn:disabled{cursor:default;opacity:.78}
.ax-btn-face{position:relative;display:flex;align-items:center;justify-content:center;gap:9px;min-height:56px;
  padding:0 22px;border-radius:18px;overflow:hidden;color:#1b1109;font-size:13.5px;font-weight:650;letter-spacing:-.01em;
  background:linear-gradient(118deg,#ffc08c 0%,#ff9359 42%,#ff7844 100%);
  box-shadow:0 20px 44px -22px rgba(255,122,60,.8),inset 0 1px 0 rgba(255,235,215,.55)}
.ax-btn-face::before{content:"";position:absolute;inset:0;opacity:0;transition:opacity .3s;
  background:radial-gradient(85% 130% at var(--mx,50%) var(--my,0%),rgba(255,238,215,.55),transparent 58%)}
.ax-btn:hover .ax-btn-face::before{opacity:.8}
.ax-btn-quiet .ax-btn-face{min-height:48px;border-radius:15px;background:rgba(233,232,226,.045);
  border:1px solid var(--ax-line);color:var(--ax-ink);font-weight:500;box-shadow:none}
.ax-btn-quiet:hover .ax-btn-face{background:rgba(233,232,226,.09)}
.ax-btn-content{position:relative;z-index:1;display:inline-flex;align-items:center;gap:9px}
.ax-btn:focus-visible,.ax-mode:focus-visible,.ax-nav-link:focus-visible,.ax-text-btn:focus-visible,
.ax-eye:focus-visible,.ax-oauth-item:focus-visible,.pkr-trigger:focus-visible{
  outline:2px solid rgba(255,154,104,.85);outline-offset:3px;border-radius:8px}

.ax-oauth{display:flex;align-items:flex-start;gap:28px;margin-top:26px}
.ax-oauth-item{display:flex;flex-direction:column;align-items:center;gap:9px;min-width:56px;padding:0;border:0;
  background:none;color:var(--ax-mute);font:inherit;font-size:10.5px;cursor:pointer}
.ax-oauth-orb{width:50px;height:50px;display:grid;place-items:center;border-radius:50%;border:1px solid var(--ax-line);
  background:rgba(233,232,226,.035);color:var(--ax-ink);
  transition:transform .4s cubic-bezier(.34,1.4,.64,1),border-color .25s,background .25s,box-shadow .25s}
.ax-oauth-item:hover .ax-oauth-orb{transform:translateY(-5px);border-color:rgba(255,154,104,.42);
  background:rgba(255,154,104,.09);box-shadow:0 14px 30px -16px rgba(255,120,60,.75)}
.ax-oauth-item:hover{color:var(--ax-ink)}

.ax-status{display:flex;align-items:flex-start;padding:17px 0;border-top:1px solid var(--ax-line);
  border-bottom:1px solid var(--ax-line);font-size:13.5px;line-height:1.6;color:rgba(233,232,226,.82)}
.ax-status b{color:var(--ax-ember);font-weight:550}
.ax-legal{margin:32px 0 0;font-size:10.5px;color:rgba(233,232,226,.34)}
.ax-legal a{color:inherit;text-decoration:none;transition:color .2s}
.ax-legal a:hover{color:var(--ax-ink)}

@media(max-width:960px){
  .ax-grid{display:flex;flex-direction:column;align-items:stretch;gap:0;min-height:auto;
    padding:88px 22px 40px;max-width:600px}
  .ax-right{order:-1;height:210px;min-height:210px;margin-bottom:24px}
  .ax-right::before{display:none}
  .ax-title{font-size:clamp(40px,10.5vw,62px)}
  .ax-sub{max-width:100%}
  .ax-nav-link{display:none}
  .ax-eyebrow{margin-bottom:14px}
  .ax-modes{margin-top:24px}
  .ax-form{margin-top:20px}
}
@media(max-width:400px){.ax-oauth{gap:18px}.ax-input{font-size:17px}}
@media(prefers-reduced-motion:reduce){
  .ax-root *{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
}
`;

const GoogleMark = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.21 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" opacity=".85" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" opacity=".7" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" opacity=".85" />
  </svg>
);

const DiscordMark = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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

type LiquidButtonProps = {
  type?: 'button' | 'submit';
  quiet?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
};

function LiquidButton({ type = 'button', quiet, disabled, onClick, children, ariaLabel }: LiquidButtonProps) {
  const reduce = !!useReducedMotion();
  const glint = useGlint<HTMLButtonElement>();
  return (
    <button
      ref={glint.ref}
      type={type}
      disabled={disabled}
      onClick={onClick}
      onPointerMove={glint.onPointerMove}
      aria-label={ariaLabel}
      className={`ax-btn${quiet ? ' ax-btn-quiet' : ''}`}
    >
      <motion.span
        className="ax-btn-face"
        whileHover={reduce ? undefined : { scale: 1.018 }}
        whileTap={reduce ? undefined : { scaleX: 0.965, scaleY: 0.92 }}
        transition={reduce ? { duration: 0.01 } : { type: 'spring', stiffness: 480, damping: 17, mass: 0.75 }}
      >
        <span className="ax-btn-content">{children}</span>
      </motion.span>
    </button>
  );
}

type GhostFieldProps = {
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

function GhostField({ id, label, icon, type = 'text', value, onChange, placeholder, autoComplete, autoFocus, end }: GhostFieldProps) {
  return (
    <div className="ax-field">
      <label className="ax-field-label" htmlFor={id}>{label}</label>
      <div className="ax-field-line">
        <span className="ax-field-ico" aria-hidden="true">{icon}</span>
        <input
          id={id}
          name={id}
          type={type}
          className="ax-input"
          placeholder={placeholder || label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          autoCapitalize="none"
          spellCheck={false}
        />
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

  const stageSpring = reduce
    ? { duration: 0.01 }
    : { type: 'spring' as const, stiffness: 330, damping: 24, mass: 0.9 };

  const viewAnim = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 12, filter: 'blur(5px)' },
        animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
        exit: { opacity: 0, y: -8, filter: 'blur(5px)' },
      };

  return (
    <AppShell>
      <style>{AUTH_CSS}</style>
      <INKModal isOpen={isINKOpen} onClose={closeINK} />

      <div className="ax-root">
        <header className="ax-top">
          <Link to="/" className="ax-brand" aria-label="SquidCloud home">
            <SquidLogo size={18} mono />
            <span>SquidCloud</span>
          </Link>
          <nav className="ax-nav" aria-label="Secondary">
            <Link to="/pricing" className="ax-nav-link">Pricing</Link>
            <Link to="/help/docs" className="ax-nav-link">Docs</Link>
          </nav>
        </header>

        <main className="ax-grid">
          <section className="ax-left">
            <AnimatePresence mode="wait" initial={false}>
              {view === 'reset' && (
                <motion.div key="reset" className="ax-view" {...viewAnim} transition={stageSpring}>
                  <p className="ax-eyebrow">New key</p>
                  <h1 className="ax-title">Choose a <em>new key.</em></h1>
                  <p className="ax-sub">Make it long and memorable. This is the key to everything you keep here.</p>
                  <form onSubmit={handlePasswordReset} className="ax-form">
                    <GhostField
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
                    <GhostField
                      id="confirm-password"
                      label="Confirm password"
                      icon={<Lock className="h-4 w-4" />}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Repeat your new password"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      autoComplete="new-password"
                    />
                    <LiquidButton type="submit" disabled={isLoading}>
                      {isLoading && <Spinner size={14} />}
                      Update password
                    </LiquidButton>
                  </form>
                </motion.div>
              )}

              {view === 'forgot' && (
                <motion.div key="forgot" className="ax-view" {...viewAnim} transition={stageSpring}>
                  <p className="ax-eyebrow">Account recovery</p>
                  <h1 className="ax-title">
                    {resetEmailSent ? <>Check your <em>inbox.</em></> : <>Reset your <em>password.</em></>}
                  </h1>
                  <p className="ax-sub">We will send a one-time link to your email. Your files stay encrypted the whole time.</p>
                  <button type="button" className="ax-text-btn ax-back" onClick={handleBackToLogin}>
                    <Ico.ArrowLeft size={13} /> Back to sign in
                  </button>

                  {!resetEmailSent ? (
                    <form onSubmit={handleForgotPassword} className="ax-form">
                      <GhostField
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
                      <LiquidButton type="submit" disabled={isLoading}>
                        {isLoading && <Spinner size={14} />}
                        Send reset link
                      </LiquidButton>
                    </form>
                  ) : (
                    <div className="ax-form">
                      <div className="ax-status">Reset link sent{email ? <> to <b>{email}</b></> : null}.</div>
                      <LiquidButton onClick={handleBackToLogin}>Return to sign in</LiquidButton>
                    </div>
                  )}
                </motion.div>
              )}

              {(view === 'login' || view === 'signup') && (
                <motion.div key="auth" className="ax-view" {...viewAnim} transition={stageSpring}>
                  <p className="ax-eyebrow">{isLogin ? 'Private by design' : 'Your space starts here'}</p>
                  <h1 className="ax-title">
                    {isLogin ? <>Welcome <em>back.</em></> : <>Make it <em>yours.</em></>}
                  </h1>
                  <p className="ax-sub">
                    {isLogin
                      ? 'Everything you saved, exactly where you left it.'
                      : 'One quiet, encrypted home for every file that matters.'}
                  </p>

                  <div className="ax-modes" role="group" aria-label="Authentication mode">
                    {(['login', 'signup'] as const).map((m) => {
                      const active = (m === 'login') === isLogin;
                      return (
                        <button
                          key={m}
                          type="button"
                          className="ax-mode"
                          data-on={active}
                          aria-pressed={active}
                          onClick={() => {
                            if ((m === 'login') === isLogin) return;
                            setIsLogin(m === 'login');
                            setPassword('');
                            setShowPassword(false);
                          }}
                        >
                          {m === 'login' ? 'Sign in' : 'Create account'}
                          {active && (
                            <motion.span
                              layoutId="ax-mode-underline"
                              className="ax-mode-underline"
                              transition={reduce ? { duration: 0.01 } : { type: 'spring', stiffness: 420, damping: 30, mass: 0.7 }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {isLogin && passkeyAvailable && (
                    <div className="ax-passkey">
                      <PasskeyRitual active={passkeyLoading} success={passkeySuccess} onInvoke={handlePasskeyLogin} />
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="ax-form">
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
                          <GhostField
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

                    <GhostField
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
                      <GhostField
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
                        <div className="ax-row-end">
                          <button type="button" className="ax-text-btn" onClick={() => setShowForgotPassword(true)}>
                            Forgot password?
                          </button>
                        </div>
                      )}
                      {!isLogin && password && (
                        <div className="ax-strength" aria-live="polite">
                          <div className="ax-strength-bars">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <i key={i} className={i <= (strength || 0) ? `on-${strengthTone}` : ''} />
                            ))}
                          </div>
                          <span className="ax-strength-label">{strengthLabel}</span>
                        </div>
                      )}
                    </div>

                    <LiquidButton type="submit" disabled={isLoading}>
                      {isLoading && <Spinner size={14} />}
                      {isLogin ? 'Enter your vault' : 'Create your vault'}
                    </LiquidButton>
                  </form>

                  <div className="ax-or">
                    {isLogin && passkeyAvailable ? 'or with a provider' : 'or continue with'}
                  </div>
                  <div className="ax-oauth" aria-label="Continue with a provider">
                    <button type="button" className="ax-oauth-item" onClick={() => handleOAuthSignIn('github')} aria-label="Continue with GitHub">
                      <span className="ax-oauth-orb"><Github className="h-4 w-4" /></span>
                      <span>GitHub</span>
                    </button>
                    <button type="button" className="ax-oauth-item" onClick={() => handleOAuthSignIn('google')} aria-label="Continue with Google">
                      <span className="ax-oauth-orb"><GoogleMark /></span>
                      <span>Google</span>
                    </button>
                    <button type="button" className="ax-oauth-item" onClick={() => handleOAuthSignIn('discord')} aria-label="Continue with Discord">
                      <span className="ax-oauth-orb"><DiscordMark /></span>
                      <span>Discord</span>
                    </button>
                  </div>

                  <p className="ax-legal">
                    <Link to="/terms">Terms</Link> · <Link to="/privacy">Privacy</Link>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          <aside className="ax-right" aria-hidden="true">
            <AuthIdentityStage mode={view} passkeyActive={passkeyLoading} />
          </aside>
        </main>
      </div>
    </AppShell>
  );
};

export default Auth;

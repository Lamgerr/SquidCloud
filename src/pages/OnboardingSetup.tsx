import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBYOK } from '@/hooks/use-byok';
import { useToast } from '@/hooks/use-toast';
import { registerPasskey, isPasskeyAvailable } from '@/lib/webauthn';
import SquidLogo from '@/components/ui/SquidLogo';
import {
  User, Mail, Key, Shield, Check, ChevronRight, Upload,
  Fingerprint, Lock,
  CheckCircle2, Loader2, Sparkles, Eye, EyeOff,
  AlertCircle, Plus,
} from '@/lib/icon-map';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/* ── Provider Logo Components ────────────────── */

function SquidCloudLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M17 14.5a4 4 0 1 0-3.3-6.8 5 5 0 0 0-8.2 4.3A3 3 0 0 0 7 18h10a3 3 0 0 0 0-3.5" />
      <path d="M11 14l2-2-2-2" />
      <path d="M13 12h-4" />
    </svg>
  );
}

function AwsS3Logo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M12 3l9 5v8l-9 5-9-5V8l9-5z" />
      <path d="M3 8l9 5 9-5" />
      <path d="M12 13v8" />
    </svg>
  );
}

function GcpLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 4l5 8-5 8-5-8 5-8z" strokeWidth="1" fill="rgba(255,255,255,0.15)" />
      <path d="M5 12h14" />
    </svg>
  );
}

function OracleLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="w-6 h-6">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" strokeWidth="1.8" />
    </svg>
  );
}

const STORAGE_PROVIDERS = [
  { id: 'squidcloud',  label: 'SquidCloud',  Logo: SquidCloudLogo,  available: true },
  { id: 'aws-s3',      label: 'AWS S3',      Logo: AwsS3Logo,       available: false },
  { id: 'gcp',         label: 'GCP Storage',   Logo: GcpLogo,        available: false },
  { id: 'oracle',      label: 'Oracle Cloud', Logo: OracleLogo,     available: false },
];

function base64ToBlob(b64: string, mime: string): Blob {
  const binary = atob(b64.split(',')[1] || b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/* ── Page-scoped motion details (logic-free) ── */

const OB_CSS = `
@keyframes obKenburns { from { transform: scale(1.1); } to { transform: scale(1.18); } }
.ob-kenburns { animation: obKenburns 46s ease-in-out infinite alternate; will-change: transform; }
@keyframes obPop { 0% { transform: scale(0.4); opacity: 0; } 60% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
.ob-pop { animation: obPop 0.45s cubic-bezier(0.16, 1, 0.3, 1) both; }
@keyframes obDrawCheck { to { stroke-dashoffset: 0; } }
.ob-draw-check { stroke-dasharray: 24; stroke-dashoffset: 24; animation: obDrawCheck 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards; }
@keyframes obBreathe { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
.ob-breathe { animation: obBreathe 2.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .ob-kenburns, .ob-pop, .ob-breathe { animation: none !important; }
  .ob-draw-check { stroke-dashoffset: 0; animation: none; }
}
`;

const STEP_NAMES = ['Profile', 'Workspace', 'Security'];

const LOADING_LINES = ['Preparing your vault…', 'Checking security…', 'Almost there…'];

function LoadingScreen() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI(v => (v + 1) % LOADING_LINES.length), 1400);
    return () => window.clearInterval(t);
  }, []);
  return (
    <MotionConfig reducedMotion="user">
    <div className="fixed inset-0 bg-[#0a0a0f] flex flex-col items-center justify-center gap-5">
      <style>{OB_CSS}</style>
      <div className="ob-breathe">
        <SquidLogo size={40} />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="text-sm text-white/40"
          aria-live="polite"
        >
          {LOADING_LINES[i]}
        </motion.p>
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}

/* ── Step 1: Profile ─────────────────────────────────── */

function ProfileStep({ form, onChange, onPhotoChange }: {
  form: { username: string; email: string; photo: string | null };
  onChange: (f: typeof form) => void;
  onPhotoChange: (b64: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onPhotoChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm text-white/40">Step 1 of 3 · Profile</p>
        <h2 className="text-xl font-semibold text-white mt-1">Welcome to SquidCloud</h2>
        <p className="text-xs text-white/40 mt-1.5">Three quick steps — about a minute — then your private cloud is ready.</p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <button
          onClick={() => fileRef.current?.click()}
          aria-label="Upload profile photo"
          className="group relative w-20 h-20 rounded-full overflow-hidden border-2 border-white/10 hover:border-primary/50 active:scale-95 transition-all duration-300"
        >
          {form.photo ? (
            <img key={form.photo.slice(-24)} src={form.photo} alt="" className="w-full h-full object-cover ob-pop" />
          ) : (
            <div className="w-full h-full bg-white/5 flex items-center justify-center">
              <User className="w-8 h-8 text-white/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Upload className="w-5 h-5 text-white" />
          </div>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        <p className="text-xs text-white/30 -mt-1">{form.photo ? 'Looking good — tap to change' : 'Upload profile photo'}</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-white/60 text-xs font-medium">Username</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input
              value={form.username}
              onChange={e => onChange({ ...form, username: e.target.value })}
              placeholder="Enter your username"
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/20 outline-none focus:border-primary/40 focus:bg-white/[0.07] transition-all"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-white/60 text-xs font-medium">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input
              value={form.email}
              disabled
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-white/[0.03] border border-white/5 text-white/40 text-sm cursor-not-allowed"
            />
          </div>
          <p className="text-[10px] text-white/20">Email cannot be changed</p>
        </div>
      </div>
    </div>
  );
}

/* ── Step 2: Workspace + Provider ───────────────────── */

function WorkspaceStep({ workspaceName, setWorkspaceName, provider, setProvider }: {
  workspaceName: string; setWorkspaceName: (v: string) => void;
  provider: string; setProvider: (v: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm text-white/40">Step 2 of 3</p>
        <h2 className="text-xl font-semibold text-white mt-1">Your Workspace</h2>
      </div>

      <div className="space-y-1.5">
        <Label className="text-white/60 text-xs font-medium">Workspace Name</Label>
        <div className="relative">
          <input
            value={workspaceName}
            onChange={e => setWorkspaceName(e.target.value)}
            placeholder="e.g. My Workspace"
            className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/20 outline-none focus:border-primary/40 focus:bg-white/[0.07] transition-all"
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-white/60 text-xs font-medium">Storage Provider</Label>
        <div className="grid grid-cols-2 gap-2.5">
          {STORAGE_PROVIDERS.map(sp => {
            const Logo = sp.Logo;
            return (
              <button
                key={sp.id}
                onClick={() => sp.available && setProvider(sp.id)}
                disabled={!sp.available}
                aria-pressed={provider === sp.id}
                className={cn(
                  'relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200 active:scale-[0.96]',
                  provider === sp.id && sp.available
                    ? 'border-primary/50 bg-primary/[0.08] shadow-[0_0_20px_rgba(0,0,0,0.35)]'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.05]',
                  !sp.available && 'opacity-30 cursor-not-allowed'
                )}
              >
                <Logo />
                <span className="text-xs text-white/60">{sp.label}</span>
                {!sp.available && (
                  <span className="text-[9px] text-white/30 absolute -bottom-[2px]">Coming soon</span>
                )}
                {provider === sp.id && sp.available && (
                  <Check className="absolute top-1.5 right-1.5 w-3 h-3 text-primary ob-pop" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Step 3: Security (Passkey + BYOK) ──────────────── */

function SecurityStep({ passkeyAvailable, hasPasskey, isCheckingPasskey, onPasskeySetup, byokEnabled, onOpenBYOK, passkeyLoading, byokLoading }: {
  passkeyAvailable: boolean; hasPasskey: boolean; isCheckingPasskey: boolean;
  onPasskeySetup: () => Promise<void>;
  byokEnabled: boolean; onOpenBYOK: () => void;
  passkeyLoading: boolean; byokLoading: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm text-white/40">Step 3 of 3</p>
        <h2 className="text-xl font-semibold text-white mt-1">Security Setup</h2>
        <p className="text-xs text-white/30 mt-1">Optional - you can configure these later</p>
      </div>

      {/* Passkey */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/[0.1] border border-primary/20 flex items-center justify-center shrink-0">
            <Fingerprint className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-white">Biometric Authentication</h3>
            <p className="text-xs text-white/40 mt-0.5">Use fingerprint or Face ID to sign in</p>
          </div>
          {!isCheckingPasskey && passkeyAvailable && (
            <span className={cn(
              'text-xs font-medium shrink-0 self-center',
              hasPasskey ? 'text-emerald-400' : 'text-white/30'
            )}>
              {hasPasskey ? 'Active' : 'Disabled'}
            </span>
          )}
        </div>

        {!passkeyAvailable && !isCheckingPasskey && (
          <div className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.02]">
            <AlertCircle className="w-3.5 h-3.5 text-white/30 mt-0.5 shrink-0" />
            <p className="text-xs text-white/30">Your device doesn't support biometric authentication.</p>
          </div>
        )}

        {isCheckingPasskey && (
          <div className="flex items-center gap-2 py-1">
            <Loader2 className="w-3.5 h-3.5 text-white/40 animate-spin" />
            <p className="text-xs text-white/40">Checking passkey\u2026</p>
          </div>
        )}

        {!isCheckingPasskey && passkeyAvailable && !hasPasskey && (
          <Button
            size="sm"
            variant="outline"
            className="w-full border-white/10 text-white/70 hover:text-white hover:bg-white/5 text-xs h-8"
            onClick={onPasskeySetup}
            disabled={passkeyLoading}
          >
            {passkeyLoading ? (
              <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
            ) : (
              <Plus className="w-3 h-3 mr-1.5" />
            )}
            Setup Passkey
          </Button>
        )}

        {!isCheckingPasskey && passkeyAvailable && hasPasskey && (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <p className="text-xs text-emerald-400/70">Passkey registered</p>
          </div>
        )}
      </div>

      {/* BYOK */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/[0.1] border border-amber-500/20 flex items-center justify-center shrink-0">
            <Key className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-white">Bring Your Own Key</h3>
            <p className="text-xs text-white/40 mt-0.5">Extra encryption layer for your files</p>
          </div>
          <span className={cn(
            'text-xs font-medium shrink-0 self-center',
            byokEnabled ? 'text-emerald-400' : 'text-white/30'
          )}>
            {byokEnabled ? 'Active' : 'Disabled'}
          </span>
        </div>

        {!byokEnabled && (
          <Button
            size="sm"
            variant="outline"
            className="w-full border-white/10 text-white/70 hover:text-white hover:bg-white/5 text-xs h-8"
            onClick={onOpenBYOK}
            disabled={byokLoading}
          >
            {byokLoading ? (
              <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
            ) : (
              <Plus className="w-3 h-3 mr-1.5" />
            )}
            Setup Encryption Key
          </Button>
        )}

        {byokEnabled && (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <p className="text-xs text-emerald-400/70">Encryption key configured</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Summary ─────────────────────────────────────────── */

function SummarySection({ form, workspaceName, provider }: {
  form: { username: string; email: string; photo: string | null };
  workspaceName: string; provider: string;
}) {
  const providerInfo = STORAGE_PROVIDERS.find(p => p.id === provider);
  const ProviderLogo = providerInfo?.Logo;
  return (
    <div className="space-y-5 text-center">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/10">
          {form.photo ? (
            <img src={form.photo} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-white/5 flex items-center justify-center">
              <User className="w-6 h-6 text-white/30" />
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-white">All Set, {form.username || 'Explorer'}!</h2>
        <p className="text-sm text-white/40 mt-1">Here\u2019s a quick recap of your setup</p>
      </div>

      <div className="space-y-2.5 text-left max-w-xs mx-auto">
        {[
          { label: 'Username', value: form.username },
          { label: 'Email', value: form.email },
          { label: 'Workspace', value: workspaceName },
          { label: 'Provider', value: providerInfo?.label || provider },
        ].map(item => (
          <div key={item.label} className="flex justify-between items-center py-1.5 border-b border-white/5">
            <span className="text-xs text-white/40">{item.label}</span>
            <span className="text-sm text-white/80 font-medium flex items-center gap-1.5">
              {item.label === 'Provider' && ProviderLogo && <ProviderLogo />}
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── BYOK Setup Dialog ───────────────────────────────── */

function BYOKSetupDialog({ open, onOpenChange, onComplete }: {
  open: boolean; onOpenChange: (v: boolean) => void; onComplete: () => void;
}) {
  const { setupAccountKey, isLoading } = useBYOK();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setError('');
  };

  const handleSetup = async () => {
    if (password !== confirmPassword) {
      setError('Keys do not match');
      return;
    }
    if (password.length < 8) {
      setError('Key must be at least 8 characters');
      return;
    }
    setError('');
    try {
      const success = await setupAccountKey(password);
      if (success) {
        reset();
        onComplete();
        onOpenChange(false);
      } else {
        setError('Failed to set up key. Please try again.');
      }
    } catch (err) {
      console.error('BYOK setup error:', err);
      setError('An unexpected error occurred.');
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) { reset(); onOpenChange(v); } }}>
        <AlertDialogContent className="bg-card border-border/60 max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white flex items-center gap-2">
            <Key className="h-5 w-5 text-amber-400" />
            Set Up Encryption Key
          </AlertDialogTitle>
          <AlertDialogDescription className="text-white/60">
            Create a strong encryption key. This key will protect all your files.
            <span className="block mt-2 text-amber-400 font-medium">
              This key cannot be recovered if lost.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-white/70">Encryption Key</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter a strong key (min 8 characters)"
                className="bg-black/20 border-white/10 text-white pr-10"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
          </div>
          {password.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex gap-1 flex-1" aria-hidden="true">
                {[1, 2, 3, 4].map(n => {
                  const s =
                    (password.length >= 8 ? 1 : 0) +
                    (password.length >= 12 ? 1 : 0) +
                    (/[A-Z]/.test(password) && /[a-z]/.test(password) ? 1 : 0) +
                    (/\d/.test(password) && /[^A-Za-z0-9]/.test(password) ? 1 : 0);
                  const tone = s <= 1 ? 'bg-red-400' : s === 2 ? 'bg-amber-400' : 'bg-emerald-400';
                  return <div key={n} className={cn('h-1 flex-1 rounded-full transition-colors duration-200', n <= s ? tone : 'bg-white/10')} />;
                })}
              </div>
              <span className="text-[11px] text-white/40 w-16 text-right">
                {(() => {
                  const s =
                    (password.length >= 8 ? 1 : 0) +
                    (password.length >= 12 ? 1 : 0) +
                    (/[A-Z]/.test(password) && /[a-z]/.test(password) ? 1 : 0) +
                    (/\d/.test(password) && /[^A-Za-z0-9]/.test(password) ? 1 : 0);
                  return s <= 1 ? 'Weak' : s === 2 ? 'Okay' : s === 3 ? 'Strong' : 'Excellent';
                })()}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-white/70">Confirm Key</Label>
          <Input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your key"
            className="bg-black/20 border-white/10 text-white"
          />
          {confirmPassword && password !== confirmPassword && (
            <p className="text-xs text-red-400">Keys do not match</p>
          )}
        </div>

          {password.length > 0 && password.length < 8 && (
            <p className="text-xs text-amber-400">Key must be at least 8 characters</p>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10">
            Cancel
          </AlertDialogCancel>
          <Button
            onClick={handleSetup}
            disabled={isLoading || password.length < 8 || password !== confirmPassword}
            className="bg-amber-600 hover:bg-amber-500 text-white"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Set Up Key
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ── Main Component ──────────────────────────────────── */

type Phase = 'loading' | 'setup';

export default function OnboardingSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [phase, setPhase] = useState<Phase>('loading');
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [dir, setDir] = useState(1);
  const [celebrating, setCelebrating] = useState(false);

  const goStep = useCallback((next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  }, [step]);

  const [profileForm, setProfileForm] = useState({ username: '', email: '', photo: null as string | null });
  const [workspaceName, setWorkspaceName] = useState('');
  const [provider, setProvider] = useState('squidcloud');

  // Passkey state
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [isCheckingPasskey, setIsCheckingPasskey] = useState(true);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  // BYOK state
  const [byokEnabled, setByokEnabled] = useState(false);
  const [byokLoading, setByokLoading] = useState(false);
  const [showBYOKDialog, setShowBYOKDialog] = useState(false);

  // ── Initial check ──
  useEffect(() => {
    if (!user || phase !== 'loading') return;
    setProfileForm(prev => ({
      ...prev,
      email: user.email || '',
      username: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
    }));

    const checkOnboarding = async () => {
      try {
        const { data: p } = await supabase
          .from('profiles')
          .select('onboarding_complete')
          .eq('id', user.id)
          .single();

        if (p?.onboarding_complete) {
          navigate('/dashboard', { replace: true });
          return;
        }
        setPhase('setup');
      } catch {
        setPhase('setup');
      }
    };
    checkOnboarding();
  }, [user, navigate, phase]);

  // ── Check passkey + BYOK status on setup mount ──
  useEffect(() => {
    if (phase !== 'setup') return;

    const checkSecurity = async () => {
      const available = await isPasskeyAvailable();
      setPasskeyAvailable(available);

      if (!user) return;

      setIsCheckingPasskey(true);
      try {
        const { data: pkData } = await supabase
          .from('user_passkeys')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        setHasPasskey(!!pkData);
      } catch {
        setHasPasskey(false);
      } finally {
        setIsCheckingPasskey(false);
      }

      try {
        const { data: encData } = await supabase
          .from('user_encryption_settings')
          .select('settings')
          .eq('user_id', user.id)
          .maybeSingle();
        const s = encData?.settings as any;
        setByokEnabled(!!s?.byok_enabled);
      } catch {
        setByokEnabled(false);
      }
    };

    checkSecurity();
  }, [phase, user]);

  // ── Passkey handler (identical pattern to AccountSettings) ──
  const handleRegisterPasskey = useCallback(async () => {
    if (!user) return;
    setPasskeyLoading(true);
    try {
      toast({ title: "Setting up passkey\u2026", description: "Please authenticate with your biometric." });
      const result = await registerPasskey(user.id, user.email || '');
      if (result) {
        toast({ title: "Passkey registered!", description: "You can now use biometric to sign in." });
        const { data } = await supabase.from('user_passkeys').select('*').eq('user_id', user.id).maybeSingle();
        setHasPasskey(!!data);
      } else {
        toast({ title: "Setup cancelled", description: "Passkey registration was cancelled or failed.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error('Passkey setup error:', error);
      toast({ title: "Passkey setup failed", description: error.message || "Please try again.", variant: "destructive" });
    } finally {
      setPasskeyLoading(false);
    }
  }, [user, toast]);

  // ── BYOK complete ──
  const handleBYOKComplete = useCallback(async () => {
    if (!user) return;
    setByokEnabled(true);
    try {
      const { data: encData } = await supabase
        .from('user_encryption_settings')
        .select('settings')
        .eq('user_id', user.id)
        .maybeSingle();
      const s = encData?.settings as any;
      setByokEnabled(!!s?.byok_enabled);
    } catch (err) {
      console.error('BYOK re-check failed:', err);
    }
  }, [user]);

  // ── Save & transition to welcome ──
  const handleComplete = async () => {
    if (!user) {
      console.error('handleComplete: user is null — cannot save');
      toast({ title: "Session expired", description: "Please sign in again.", variant: "destructive" });
      navigate('/auth', { replace: true });
      return;
    }
    if (saving) {
      console.warn('handleComplete: already saving, ignoring click');
      return;
    }
    setSaving(true);
    try {
      let avatarUrl: string | null = null;

      if (profileForm.photo) {
        try {
          const blob = base64ToBlob(profileForm.photo, 'image/png');
          const avatarPath = `${user.id}`;
          const { error: uploadErr } = await supabase.storage
            .from('avatars')
            .upload(avatarPath, blob, { upsert: true, contentType: 'image/png' });
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(avatarPath);
            avatarUrl = urlData?.publicUrl || null;
          } else {
            console.error('Avatar upload failed:', uploadErr);
          }
        } catch (avatarErr) {
          console.error('Avatar upload threw:', avatarErr);
        }
      }

      const { error: rpcErr } = await supabase.rpc('complete_onboarding', {
        p_username:        profileForm.username || null,
        p_full_name:       profileForm.username || null,
        p_avatar_url:      avatarUrl,
        p_workspace_name:  workspaceName || null,
        p_storage_provider: provider,
        p_onboarding_complete: true,
      });

      if (rpcErr) {
        console.error('Profile upsert error:', rpcErr);
        throw rpcErr;
      }

      setSaving(false);
      setCelebrating(true);
      window.setTimeout(() => navigate('/dashboard', { replace: true }), 1050);
      return;
    } catch (err: any) {
      console.error('Onboarding save failed:', err);
      toast({ title: "Setup failed", description: err?.message || "Could not save your settings. Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const canContinueStep = () => {
    if (step === 1) return profileForm.username.trim().length > 0;
    if (step === 2) return workspaceName.trim().length > 0;
    return true;
  };

  const isSummary = step > 3;

  // ═══════════════════════════════════════════════════════
  // ── LOADING ──
  // ═══════════════════════════════════════════════════════
  if (phase === 'loading') {
    return <LoadingScreen />;
  }

  // ═══════════════════════════════════════════════════════
  // ── SETUP PHASE ──
  // ═══════════════════════════════════════════════════════
  if (phase === 'setup') {
    return (
      <MotionConfig reducedMotion="user">
      <div className="fixed inset-0 overflow-y-auto bg-[#0a0a0f]">
        <style>{OB_CSS}</style>
        <div
          className="fixed inset-0 z-0 ob-kenburns motion-reduce:animate-none"
          style={{
            backgroundImage: 'url(/artwork.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(60px) saturate(0.5)',
            transform: 'scale(1.1)',
          }}
        />
        <div className="fixed inset-0 z-[1]" style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.8) 100%)',
        }} />
        <div className="fixed inset-0 z-[1] bg-black/50" />

        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4 sm:p-8">
          <div
            className="w-full max-w-md rounded-[24px] overflow-hidden"
            style={{
              background: 'rgba(15,15,25,0.6)',
              backdropFilter: 'blur(30px)',
              WebkitBackdropFilter: 'blur(30px)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 40px 80px rgba(0,0,0,0.5)',
            }}
          >
            {/* Step indicator */}
            {!isSummary && (
              <div className="flex flex-col items-center gap-2 pt-6 pb-2">
                <div className="flex items-center justify-center gap-2" aria-hidden="true">
                  {[1, 2, 3].map(s => (
                    <div
                      key={s}
                      className={cn(
                        'h-1 rounded-full transition-all duration-500',
                        s === step ? 'w-8 bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.45)]' :
                        s < step ? 'w-6 bg-white/30' : 'w-6 bg-white/10'
                      )}
                    />
                  ))}
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={step}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="text-[11px] font-medium tracking-wide text-white/40"
                    aria-live="polite"
                  >
                    {STEP_NAMES[step - 1]}
                  </motion.p>
                </AnimatePresence>
              </div>
            )}

            <div className="p-6 sm:p-8">
              <AnimatePresence mode="wait" initial={false} custom={dir}>
                <motion.div
                  key={isSummary ? 'summary' : step}
                  custom={dir}
                  initial={{ opacity: 0, x: 36 * dir }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -28 * dir }}
                  transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                >
              {step === 1 && (
                <ProfileStep
                  form={profileForm}
                  onChange={setProfileForm}
                  onPhotoChange={b64 => setProfileForm(p => ({ ...p, photo: b64 }))}
                />
              )}

              {step === 2 && (
                <WorkspaceStep
                  workspaceName={workspaceName}
                  setWorkspaceName={setWorkspaceName}
                  provider={provider}
                  setProvider={setProvider}
                />
              )}

              {step === 3 && (
                <SecurityStep
                  passkeyAvailable={passkeyAvailable}
                  hasPasskey={hasPasskey}
                  isCheckingPasskey={isCheckingPasskey}
                  onPasskeySetup={handleRegisterPasskey}
                  byokEnabled={byokEnabled}
                  onOpenBYOK={() => setShowBYOKDialog(true)}
                  passkeyLoading={passkeyLoading}
                  byokLoading={byokLoading}
                />
              )}

              {isSummary && (
                <SummarySection
                  form={profileForm}
                  workspaceName={workspaceName}
                  provider={provider}
                />
              )}
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <div className={cn('flex gap-3', isSummary ? 'mt-6' : 'mt-8')}>
                {!isSummary && step > 1 && (
                  <Button
                    variant="outline"
                    onClick={() => goStep(step - 1)}
                    className="flex-1 h-10 border-white/10 text-white/60 hover:text-white hover:bg-white/5 rounded-xl text-sm"
                  >
                    Back
                  </Button>
                )}
                {step <= 3 ? (
                  <Button
                    onClick={() => goStep(step + 1)}
                    disabled={!canContinueStep()}
                    className="flex-1 h-10 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Continue
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleComplete}
                    disabled={saving || celebrating}
                    className="flex-1 h-10 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-80"
                  >
                    {saving ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Finalizing…</>
                    ) : celebrating ? (
                      <span className="inline-flex items-center">
                        <svg viewBox="0 0 24 24" className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="4 12.5 9.5 18 20 6.5" className="ob-draw-check" />
                        </svg>
                        Welcome in
                      </span>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-1.5" /> Dive In</>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <BYOKSetupDialog
          open={showBYOKDialog}
          onOpenChange={setShowBYOKDialog}
          onComplete={handleBYOKComplete}
        />
      </div>
      </MotionConfig>
    );
  }

  // WELCOME / COMPLETION PHASE — removed; handleComplete navigates directly to dashboard
}

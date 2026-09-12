import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { isPasskeyAvailable, registerPasskey, authenticateWithPasskey } from '@/lib/webauthn';
import BiometricSetupDialog from '@/components/BiometricSetupDialog';
import { biometricAuthService } from '@/services/biometricAuthService';
import { BYOKSettingsCard, SDESettingsCard } from '@/components/encryption';
import ApiKeyManagement from '@/components/ApiKeyManagement';
import CliDevicesSection from '@/components/settings/CliDevicesSection';
import { WebhookManager } from '@/components/WebhookManager';
import {
  User, Mail, Key, Shield, Fingerprint, CheckCircle2, AlertCircle,
  Loader2, Plus, ArrowLeft, Lock, Settings, Trash2, HardDrive, Calendar, Code, Zap,
  FolderOpen, FileArchive, RefreshCw, Crown, Sparkles, Briefcase, TrendingUp,
  Repeat, Book, LogOut, Smartphone,
} from '@/lib/icon-map';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader } from '@/components/ui/Loader';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MigrationWizard from '@/components/MigrationWizard';
import CancelSubscriptionFlow from '@/components/CancelSubscriptionFlow';
import { cn } from '@/lib/utils';
import { emitSignal } from '@/lib/api';
import { mfaService, MfaFactor } from '@/services/mfa-service';

const ACCOUNT_PREFS_STORAGE_KEY = 'squid_account_settings_v3';

interface AccountPreferenceSettings {
  lockSessionWhenInactive: boolean;
  requirePinForDownloads: boolean;
  requirePinForShares: boolean;
  strictPreviewIsolation: boolean;
  verifyDownloadIntegrity: boolean;
  blockUnknownFilePreviews: boolean;
  quarantineRiskyFiles: boolean;
  notifySecurityEvents: boolean;
  notifyFileShareEvents: boolean;
  notifyBackgroundSync: boolean;
  lowDataMode: boolean;
  prefetchNextPreview: boolean;
  hardwareDecodeAcceleration: boolean;
  autoRetryBackgroundSync: boolean;
  developerLogs: boolean;
  experimentalPreviewPipeline: boolean;
  showTransferDiagnostics: boolean;
  showAdvancedMetadata: boolean;
  gameSuggestionsEnabled: boolean;
}

interface AccountPreferenceItem {
  key: keyof AccountPreferenceSettings;
  label: string;
  description: string;
}

interface AccountPreferenceCategory {
  id: string;
  title: string;
  subtitle: string;
  items: AccountPreferenceItem[];
}

const DEFAULT_ACCOUNT_PREFERENCES: AccountPreferenceSettings = {
  lockSessionWhenInactive: true,
  requirePinForDownloads: false,
  requirePinForShares: true,
  strictPreviewIsolation: true,
  verifyDownloadIntegrity: true,
  blockUnknownFilePreviews: true,
  quarantineRiskyFiles: true,
  notifySecurityEvents: true,
  notifyFileShareEvents: true,
  notifyBackgroundSync: false,
  lowDataMode: false,
  prefetchNextPreview: true,
  hardwareDecodeAcceleration: true,
  autoRetryBackgroundSync: true,
  developerLogs: false,
  experimentalPreviewPipeline: false,
  showTransferDiagnostics: false,
  showAdvancedMetadata: false,
  gameSuggestionsEnabled: true,
};

const SETTINGS_CATEGORIES = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'devices', label: 'CLI Devices', icon: Smartphone },
  { id: 'developer', label: 'Developer API', icon: Code },
  { id: 'webhooks', label: 'Webhooks', icon: Repeat },
  { id: 'plans', label: 'Plans & Subscription', icon: Crown },
  { id: 'migration', label: 'Migration', icon: FileArchive },
  { id: 'byok', label: 'Encryption', icon: Lock },
  { id: 'preferences', label: 'Advanced', icon: Settings },
] as const;

type SettingsCategory = typeof SETTINGS_CATEGORIES[number]['id'];

const AccountSettings = () => {
  const { user, profile, session, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('profile');
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [loading, setLoading] = useState(false);
  const [storageUsed, setStorageUsed] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [passkeyData, setPasskeyData] = useState<any>(null);
  const [isCheckingPasskey, setIsCheckingPasskey] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const [hasBiometric, setHasBiometric] = useState(false);
  const [accountPreferences, setAccountPreferences] = useState<AccountPreferenceSettings>(DEFAULT_ACCOUNT_PREFERENCES);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [migrationJob, setMigrationJob] = useState<any>(null);
  const [cancelling, setCancelling] = useState(false);
  const [redeemCodeInput, setRedeemCodeInput] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
  const [paymentLogs, setPaymentLogs] = useState<any[]>([]);
  const [paymentLogsLoading, setPaymentLogsLoading] = useState(false);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banDeviceId, setBanDeviceId] = useState('');
  const [banReason, setBanReason] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [notifPrefs, setNotifPrefs] = useState({ email_enabled: true, popup_enabled: true, warning_lead_days: 7, do_not_contact: false });

  // MFA state
  const [mfaFactors, setMfaFactors] = useState<MfaFactor[]>([]);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaSetupMode, setMfaSetupMode] = useState(false);
  const [mfaQrCode, setMfaQrCode] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaEnrollmentId, setMfaEnrollmentId] = useState('');
  const [mfaVerifyCode, setMfaVerifyCode] = useState('');
  const [mfaVerifying, setMfaVerifying] = useState(false);
  const [showUnenrollDialog, setShowUnenrollDialog] = useState(false);
  const [unenrollFactorId, setUnenrollFactorId] = useState('');
  const [aalLevel, setAalLevel] = useState<{ currentLevel: string; nextLevel: string } | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const [animating, setAnimating] = useState(false);
  const mountedRef = useRef(false);
  const devicesFetchedRef = useRef(false);
  const paymentLogsFetchedRef = useRef(false);
  const notifPrefsFetchedRef = useRef(false);

  const mc = (extra = '') => cn('lg-card', isMobile ? 'p-4' : 'p-5', extra);

  const cardHeader = (icon: React.ReactNode, title: string, desc: string) => (
    <div className={cn('flex items-center gap-3 mb-5', isMobile ? 'mb-4' : 'mb-5')}>
      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <h3 className={cn('font-semibold text-foreground', isMobile ? 'text-[15px]' : 'text-sm')}>{title}</h3>
        <p className="text-xs text-muted-foreground truncate">{desc}</p>
      </div>
    </div>
  );

  const switchCategory = (cat: SettingsCategory) => {
    if (cat === activeCategory) return;
    setAnimating(true);
    setTimeout(() => {
      setActiveCategory(cat);
      setAnimating(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 150);
  };

  const preferenceCategories = useMemo<AccountPreferenceCategory[]>(() => [
    {
      id: 'security-hardening',
      title: 'Security Hardening',
      subtitle: 'Strict controls for sensitive actions and file handling.',
      items: [
        { key: 'lockSessionWhenInactive', label: 'Auto-lock account session', description: 'Lock sensitive session access after inactivity.' },
        { key: 'strictPreviewIsolation', label: 'Strict preview isolation', description: 'Run previews in isolated mode to reduce attack surface.' },
        { key: 'verifyDownloadIntegrity', label: 'Verify download integrity', description: 'Validate checksum before completing file decryption.' },
        { key: 'blockUnknownFilePreviews', label: 'Block unknown preview formats', description: 'Prevent preview rendering for unknown MIME signatures.' },
        { key: 'quarantineRiskyFiles', label: 'Quarantine risky files', description: 'Flag suspicious uploads before opening or sharing.' },
      ],
    },
    {
      id: 'operation-guards',
      title: 'Operation Guards',
      subtitle: 'Control PIN and action protection behavior.',
      items: [
        { key: 'requirePinForDownloads', label: 'Require PIN for downloads', description: 'Prompt PIN before decrypt+download operations.' },
        { key: 'requirePinForShares', label: 'Require PIN for shares', description: 'Prompt PIN before creating file share links.' },
        { key: 'notifySecurityEvents', label: 'Security event alerts', description: 'Notify for lockouts, mismatches, and verification failures.' },
        { key: 'notifyFileShareEvents', label: 'Share event alerts', description: 'Notify when files are shared or accessed.' },
        { key: 'notifyBackgroundSync', label: 'Background sync alerts', description: 'Notify on background sync completions or errors.' },
      ],
    },
    {
      id: 'data-saver',
      title: 'Data & Performance',
      subtitle: 'Optimize bandwidth and preview rendering.',
      items: [
        { key: 'lowDataMode', label: 'Low data mode', description: 'Reduce data usage by limiting preview quality.' },
        { key: 'prefetchNextPreview', label: 'Prefetch next preview', description: 'Preload the next file for faster viewing.' },
        { key: 'hardwareDecodeAcceleration', label: 'Hardware decode acceleration', description: 'Use GPU for faster media decoding.' },
      ],
    },
    {
      id: 'sync-diagnostics',
      title: 'Sync & Diagnostics',
      subtitle: 'Background sync and developer tools.',
      items: [
        { key: 'autoRetryBackgroundSync', label: 'Auto-retry background sync', description: 'Automatically retry failed background syncs.' },
        { key: 'developerLogs', label: 'Developer logs', description: 'Enable verbose logging for troubleshooting.' },
        { key: 'experimentalPreviewPipeline', label: 'Experimental preview pipeline', description: 'Opt into the latest preview renderer.' },
        { key: 'showTransferDiagnostics', label: 'Transfer diagnostics', description: 'Display detailed transfer metrics in the UI.' },
        { key: 'showAdvancedMetadata', label: 'Advanced metadata', description: 'Show extended file metadata in the info sidebar.' },
      ],
    },
    {
      id: 'arcade-entertainment',
      title: 'Arcade & Entertainment',
      subtitle: 'Mini-games and fun distractions while files transfer.',
      items: [
        { key: 'gameSuggestionsEnabled', label: 'Game Suggestions During Transfers', description: 'Receive friendly mini-game prompts while large files are uploading or downloading. You can launch games anytime using Cmd/Ctrl + Shift + G.' },
      ],
    },
  ], []);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    checkPasskeyAvailability();
    checkUserPasskey();
    checkBiometricStatus();
    fetchStorageStats();
    loadPreferences();
    fetchLatestMigration();
    loadMfaFactors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMfaFactors = async () => {
    const factors = await mfaService.listFactors();
    setMfaFactors(factors);
    const aal = await mfaService.getAalLevel();
    setAalLevel(aal);
  };

  const handleEnrollMfa = async () => {
    setMfaLoading(true);
    // Remove any unverified factors from previous attempts
    const existingFactors = await mfaService.listFactors();
    for (const f of existingFactors) {
      if (f.status === 'unverified') {
        await mfaService.unenroll(f.id);
      }
    }
    const enrollment = await mfaService.enroll('CloudBliss TOTP');
    if (enrollment) {
      setMfaQrCode(enrollment.totp.qr_code);
      setMfaSecret(enrollment.totp.secret);
      setMfaEnrollmentId(enrollment.id);
      setMfaSetupMode(true);
    } else {
      toast({ title: 'Error', description: 'Failed to start MFA enrollment', variant: 'destructive' });
    }
    setMfaLoading(false);
  };

  const handleVerifyMfa = async () => {
    if (!mfaVerifyCode || mfaVerifyCode.length !== 6 || !mfaEnrollmentId) return;
    setMfaVerifying(true);
    const challengeId = await mfaService.challenge(mfaEnrollmentId);
    if (challengeId) {
      const success = await mfaService.verify(mfaEnrollmentId, challengeId, mfaVerifyCode);
      if (success) {
        toast({ title: 'MFA Enabled', description: 'Two-factor authentication is now active' });
        setMfaSetupMode(false);
        setMfaVerifyCode('');
        setMfaQrCode('');
        setMfaSecret('');
        setMfaEnrollmentId('');
        loadMfaFactors();
      } else {
        toast({ title: 'Invalid Code', description: 'Please check the code and try again', variant: 'destructive' });
      }
    }
    setMfaVerifying(false);
  };

  const handleUnenrollMfa = async () => {
    if (!unenrollFactorId) return;
    setMfaLoading(true);
    const success = await mfaService.unenroll(unenrollFactorId);
    if (success) {
      toast({ title: 'MFA Disabled', description: 'Two-factor authentication has been removed' });
      setShowUnenrollDialog(false);
      setUnenrollFactorId('');
      loadMfaFactors();
    } else {
      toast({ title: 'Error', description: 'Failed to disable MFA', variant: 'destructive' });
    }
    setMfaLoading(false);
  };

  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(mfaSecret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    } catch {
      toast({ title: 'Copy failed', description: 'Please copy the secret manually', variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (!migrationJob?.id || ['completed', 'failed', 'cancelled'].includes(migrationJob.status)) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase.from('migration_jobs').select('*').eq('id', migrationJob.id).single();
        if (data) setMigrationJob(data);
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [migrationJob?.id]);

  const loadPreferences = () => {
    try {
      const saved = localStorage.getItem(ACCOUNT_PREFS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setAccountPreferences(prev => ({ ...prev, ...parsed }));
      }
    } catch { /* ignore */ }
  };

  const savePreferences = (prefs: AccountPreferenceSettings) => {
    localStorage.setItem(ACCOUNT_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  };

  const updatePreference = (key: keyof AccountPreferenceSettings, enabled: boolean) => {
    setAccountPreferences(prev => {
      const next = { ...prev, [key]: enabled };
      savePreferences(next);
      return next;
    });
    if (key === 'gameSuggestionsEnabled') {
      supabase.rpc('update_game_preference', { p_enable: enabled }).catch(console.error);
    }
  };

  const checkPasskeyAvailability = async () => {
    const available = await isPasskeyAvailable();
    setPasskeyAvailable(available);
  };

  const checkUserPasskey = async () => {
    if (!user) return;
    setIsCheckingPasskey(true);
    try {
      const { data } = await supabase.from('user_passkeys').select('*').eq('user_id', user.id).maybeSingle();
      if (data) { setHasPasskey(true); setPasskeyData(data); }
      else { setHasPasskey(false); setPasskeyData(null); }
    } catch { setHasPasskey(false); }
    finally { setIsCheckingPasskey(false); }
  };

  const checkBiometricStatus = async () => {
    if (!user) return;
    try {
      const enabled = await biometricAuthService.hasBiometric(user.id);
      setHasBiometric(enabled);
    } catch { setHasBiometric(false); }
  };

  const fetchStorageStats = async () => {
    try {
      const { data: files } = await supabase.from('files').select('size').eq('user_id', user?.id);
      const totalSize = files?.reduce((acc, f) => acc + (f.size || 0), 0) || 0;
      setStorageUsed(totalSize);
      setTotalFiles(files?.length || 0);
    } catch { /* ignore */ }
  };

  const fetchLatestMigration = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('migration_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setMigrationJob(data);
    } catch { /* ignore */ }
  };

  const handleCancelMigration = async () => {
    if (!migrationJob?.id) return;
    setCancelling(true);
    try {
      const { error } = await supabase
        .from('migration_jobs')
        .update({ status: 'cancelled' })
        .eq('id', migrationJob.id);
      if (error) throw error;
      setMigrationJob((prev: any) => prev ? { ...prev, status: 'cancelled' } : prev);
      toast({ title: "Migration cancelled", description: "The import has been cancelled." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to cancel migration", variant: "destructive" });
    } finally { setCancelling(false); }
  };

  const formatSpeed = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      scheduled: 'text-yellow-500',
      extracting: 'text-blue-500',
      uploading: 'text-purple-500',
      in_progress: 'text-blue-500',
      completed: 'text-green-500',
      failed: 'text-red-500',
    };
    return map[status] || 'text-muted-foreground';
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      scheduled: 'Queued',
      extracting: 'Extracting',
      uploading: 'Uploading',
      in_progress: 'In Progress',
      completed: 'Completed',
      failed: 'Failed',
    };
    return map[status] || status;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: fullName.trim() || null, display_name: displayName.trim() || null,
      }).eq('id', user.id);
      if (error) throw error;
      toast({ title: "Profile updated", description: "Your profile has been updated." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update profile.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure both passwords match.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: user?.email || '', password: currentPassword });
      if (signInError) throw new Error('Current password is incorrect');
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      void emitSignal({
        type: 'password_changed',
        severity: 'warning',
        title: 'Password changed',
        body: 'Your account password was changed. If this wasn\'t you, contact support immediately.',
        link: '/settings/account',
      });
      toast({ title: "Password updated", description: "Your password has been changed." });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setChangingPassword(false);
    } catch (error: any) {
      toast({ title: "Password change failed", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleRegisterPasskey = async () => {
    if (!user) return;
    setLoading(true);
    try {
      toast({ title: "Setting up passkey...", description: "Please authenticate." });
      const passkeyResult = await registerPasskey(user.id, user.email || '');
      if (passkeyResult) {
        toast({ title: "Passkey registered!", description: "You can now use passkey to sign in." });
        await checkUserPasskey();
      } else {
        toast({ title: "Setup cancelled", description: "Passkey registration was cancelled or failed.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error('Passkey registration error:', error);
      toast({ title: "Passkey setup failed", description: error.message || "Please try again.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleUpdatePasskey = async () => {
    if (!user) return;
    setLoading(true);
    try {
      toast({ title: "Updating passkey...", description: "Please authenticate." });
      const passkeyResult = await registerPasskey(user.id, user.email || '');
      if (passkeyResult) {
        await supabase.from('user_passkeys').update({ credential_id: passkeyResult.credentialId }).eq('user_id', user.id);
        toast({ title: "Passkey updated!", description: "Your passkey authentication has been updated." });
        await checkUserPasskey();
      } else {
        toast({ title: "Update cancelled", description: "Passkey update was cancelled.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Passkey update failed", description: error.message || "Please try again.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleTestPasskey = async () => {
    setLoading(true);
    try {
      toast({ title: "Testing passkey...", description: "Please authenticate." });
      const result = await authenticateWithPasskey(user?.email || undefined);
      if (result.success) toast({ title: "Passkey working!", description: "Your passkey is working correctly." });
      else toast({ title: "Test failed", description: "Please try updating your passkey.", variant: "destructive" });
    } catch (error: any) {
      toast({ title: "Test failed", description: error.message || "There was an error.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleDeletePasskey = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await supabase.from('user_passkeys').delete().eq('user_id', user.id);
      toast({ title: "Passkey removed", description: "Passkey authentication has been disabled." });
      setHasPasskey(false); setPasskeyData(null); setShowDeleteDialog(false);
    } catch (error: any) {
      toast({ title: "Deletion failed", description: error.message || "Please try again.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleSetupBiometric = () => setShowBiometricSetup(true);

  const handleBiometricSetupComplete = async () => {
    setShowBiometricSetup(false);
    await checkBiometricStatus();
    toast({ title: "Biometric Security Enabled", description: "Your device biometric is now protecting your files." });
  };

  const handleDisableBiometric = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await biometricAuthService.disableBiometric(user.id);
      await checkBiometricStatus();
      toast({ title: "Security Disabled", description: "Biometric security has been turned off." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const isPremium = profile?.is_premium;
  const userTier = isPremium
    ? profile?.tier === 'supporter-plus' ? 'Supporter+' : 'Supporter'
    : 'Free';

  const handleRedeemCode = async () => {
    if (!user || !session?.access_token || !redeemCodeInput.trim()) return;
    setRedeeming(true);
    try {
      const res = await fetch('https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/redeem-code', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: redeemCodeInput.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Redemption failed', description: data.error || 'Something went wrong.', variant: 'destructive' });
        return;
      }
      toast({ title: 'Code redeemed!', description: `You now have ${data.plan_type} ${data.billing_period} plan.` });
      setRedeemCodeInput('');
    } catch (error: any) {
      toast({ title: 'Redemption failed', description: error.message || 'Something went wrong.', variant: 'destructive' });
    } finally { setRedeeming(false); }
  };

  const fetchPaymentLogs = async () => {
    if (!user) return;
    setPaymentLogsLoading(true);
    setSelectedPayment(null);
    try {
      const { data, error } = await supabase
        .from('payment_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPaymentLogs(data || []);
    } catch (e: any) {
      console.error('Failed to fetch payment logs:', e);
      toast({ title: 'Error', description: 'Failed to load payment history', variant: 'destructive' });
    } finally {
      setPaymentLogsLoading(false);
    }
  };

  useEffect(() => {
    if (isPremium && user && !paymentLogsFetchedRef.current) {
      paymentLogsFetchedRef.current = true;
      fetchPaymentLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremium, user?.id]);

  useEffect(() => {
    if (!user || notifPrefsFetchedRef.current) return;
    notifPrefsFetchedRef.current = true;
    supabase.from('user_notification_prefs').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (data) setNotifPrefs({ email_enabled: data.email_enabled ?? true, popup_enabled: data.popup_enabled ?? true, warning_lead_days: data.warning_lead_days ?? 7, do_not_contact: data.do_not_contact ?? false });
    }).catch(() => {});
  }, [user?.id]);


  const updateNotifPref = async (key: string, value: boolean | number) => {
    setNotifPrefs(prev => ({ ...prev, [key]: value }));
    try {
      await supabase.functions.invoke('subscription-manager/update-prefs', { body: { [key]: value } });
    } catch (e) {
      console.error('Failed to update notification prefs:', e);
    }
  };

  const latestPayment = paymentLogs.find(p => p.status === 'completed');

  const formatPaymentAmount = (p: any) => {
    if (p.amount_usd != null) return `$${Number(p.amount_usd).toFixed(2)} ${p.currency || 'USD'}`;
    return '—';
  };

  const formatPaymentDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
    });
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'expired': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'refunded': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'cancelled': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const DetailField = ({ label, value, capitalize, mono, fullWidth, highlight }: { label: string; value: string; capitalize?: boolean; mono?: boolean; fullWidth?: boolean; highlight?: boolean }) => (
    <div className={cn('p-3 rounded-xl bg-muted/20 border border-border/20', fullWidth && isMobile ? '' : fullWidth ? 'col-span-2' : '')}>
      <p className="text-[10px] text-muted-foreground/70 mb-0.5">{label}</p>
      <p className={cn('text-sm font-semibold', highlight ? 'text-green-400' : 'text-foreground', mono ? 'font-mono text-xs break-all' : '', capitalize ? 'capitalize' : '')}>{value}</p>
    </div>
  );

  function renderPlansSection() {
    return (
      <>
      <div className={mc()}>
        {cardHeader(
          isPremium ? <Crown className="h-5 w-5 text-amber-400" /> : <Zap className="h-5 w-5 text-muted-foreground" />,
          'Plans & Subscription',
          'Manage your plan and billing'
        )}

        <div className="rounded-xl border border-border/30 bg-muted/20 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={cn(
                'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                isPremium ? 'bg-amber-500/15' : 'bg-muted/30',
              )}>
                {isPremium ? <Crown className="h-4 w-4 text-amber-400" /> : <Zap className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-foreground truncate">Current Plan — {userTier}</h4>
                <p className="text-xs text-muted-foreground">
                  {isPremium
                    ? 'Priority queue, unlimited file requests, always-active sites & more'
                    : 'Unlimited storage with standard queue priority'}
                </p>
              </div>
            </div>
            <Badge className={cn('shrink-0', isPremium ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-muted/50 text-muted-foreground border-border/30')}>
              {userTier}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-px bg-border/20 rounded-xl overflow-hidden border border-border/20">
            {[
              { icon: HardDrive, label: 'Storage', value: formatBytes(storageUsed) },
              { icon: Briefcase, label: 'Total Files', value: `${totalFiles} files` },
              { icon: Calendar, label: 'Member Since', value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '-' },
              { icon: TrendingUp, label: 'Account Type', value: userTier },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Icon className="h-3 w-3 text-primary" />
                  <p className="text-[10px] text-muted-foreground/70">{label}</p>
                </div>
                <p className="text-sm font-medium text-foreground">{value}</p>
              </div>
            ))}
          </div>

          {isPremium && (
            <div className="rounded-xl border border-border/20 bg-muted/20 overflow-hidden">
              <div className="px-3 py-2 border-b border-border/20">
                <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Subscription Details</p>
              </div>
              <div className={cn('grid', isMobile ? '' : 'grid-cols-2')}>
                <div className="p-3 border-r border-b border-border/20">
                  <p className="text-[10px] text-muted-foreground/70 mb-0.5">Plan</p>
                  <p className="text-sm font-medium text-foreground">{userTier}</p>
                </div>
                <div className="p-3 border-b border-border/20">
                  <p className="text-[10px] text-muted-foreground/70 mb-0.5">Billing Period</p>
                  <p className="text-sm font-medium text-foreground capitalize">{latestPayment?.billing_period || '-'}</p>
                </div>
                <div className="p-3 border-r border-border/20">
                  <p className="text-[10px] text-muted-foreground/70 mb-0.5">Purchase Date</p>
                  <p className="text-sm font-medium text-foreground">{profile?.subscription_starts_at ? new Date(profile.subscription_starts_at).toLocaleDateString() : latestPayment?.created_at ? new Date(latestPayment.created_at).toLocaleDateString() : '-'}</p>
                </div>
                <div className="p-3 border-border/20">
                  <p className="text-[10px] text-muted-foreground/70 mb-0.5">Expires On</p>
                  <p className="text-sm font-medium text-foreground">{profile?.subscription_expires_at ? new Date(profile.subscription_expires_at).toLocaleDateString() : '-'}</p>
                </div>
                <div className="p-3 border-r border-t border-border/20">
                  <p className="text-[10px] text-muted-foreground/70 mb-0.5">Amount Paid</p>
                  <p className="text-sm font-medium text-foreground">{latestPayment ? formatPaymentAmount(latestPayment) : '-'}</p>
                </div>
                <div className="p-3 border-t border-border/20">
                  <p className="text-[10px] text-muted-foreground/70 mb-0.5">Payment Mode</p>
                  <p className="text-sm font-medium text-foreground capitalize">{latestPayment?.tx_hash ? 'Crypto' : latestPayment?.discount_code ? 'Discount Code' : latestPayment?.metadata?.source === 'redeem_code' ? 'Redeem Code' : '-'}</p>
                </div>
                {latestPayment?.discount_percent ? (
                  <div className="p-3 border-r border-t border-border/20 col-span-2">
                    <p className="text-[10px] text-muted-foreground/70 mb-0.5">Discount</p>
                    <p className="text-sm font-medium text-green-400">{latestPayment.discount_percent}%{latestPayment.discount_code ? ` (${latestPayment.discount_code})` : ''}</p>
                  </div>
                ) : latestPayment?.metadata?.code ? (
                  <div className="p-3 border-r border-t border-border/20 col-span-2">
                    <p className="text-[10px] text-muted-foreground/70 mb-0.5">Redeem Code</p>
                    <p className="text-sm font-medium text-emerald-400">{latestPayment.metadata.code}</p>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <div className={cn('flex gap-2 pt-1', isMobile ? 'flex-col' : 'flex-wrap')}>
            {isPremium ? (
              <>
                <Button onClick={() => navigate('/pricing')} variant="outline" size={isMobile ? 'default' : 'sm'} className="rounded-xl">
                  <Crown className="h-3.5 w-3.5 mr-1.5" />Change Plan
                </Button>
                <Button onClick={() => { fetchPaymentLogs(); setPaymentHistoryOpen(true); }} variant="outline" size={isMobile ? 'default' : 'sm'} className="rounded-xl">
                  <Calendar className="h-3.5 w-3.5 mr-1.5" />History
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => navigate('/pricing')} size={isMobile ? 'default' : 'sm'} className="rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/25 hover:bg-amber-500/25">
                  <Crown className="h-3.5 w-3.5 mr-1.5" />Upgrade Now
                </Button>
                <Button onClick={() => { fetchPaymentLogs(); setPaymentHistoryOpen(true); }} variant="outline" size={isMobile ? 'default' : 'sm'} className="rounded-xl">
                  <Calendar className="h-3.5 w-3.5 mr-1.5" />History
                </Button>
              </>
            )}
          </div>

          <div className="rounded-xl border border-border/30 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Key className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-foreground">Redeem a Code</h4>
                <p className="text-xs text-muted-foreground">Enter a redeem code to unlock premium features</p>
              </div>
            </div>
            <div className={cn('flex gap-2', isMobile ? 'flex-col' : '')}>
              <Input placeholder="Enter redeem code" value={redeemCodeInput} onChange={(e) => setRedeemCodeInput(e.target.value.toUpperCase())} className={cn('rounded-xl bg-muted/20 border-border/40 font-mono text-sm uppercase', isMobile ? 'h-11' : 'flex-1 h-10')} onKeyDown={(e) => e.key === 'Enter' && handleRedeemCode()} />
              <Button onClick={handleRedeemCode} disabled={!redeemCodeInput.trim() || redeeming} size={isMobile ? 'default' : 'sm'} className="rounded-xl" loading={redeeming}>Redeem</Button>
            </div>
          </div>

          {isPremium && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                  <Trash2 className="h-4 w-4 text-red-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-foreground">Cancel Subscription</h4>
                  <p className="text-xs text-muted-foreground">Your plan will remain active until the end of the billing period</p>
                </div>
              </div>
              <CancelSubscriptionFlow
                userId={user?.id || ''}
                planType={profile?.tier}
                billingPeriod={latestPayment?.billing_period || 'monthly'}
                onCancelled={() => { refreshProfile(); fetchPaymentLogs(); }}
              />
            </div>
          )}
        </div>
      </div>

      <Dialog open={paymentHistoryOpen} onOpenChange={(open) => { setPaymentHistoryOpen(open); if (!open) setSelectedPayment(null); }}>
        <DialogContent className={cn('max-h-[85vh] overflow-y-auto p-0', isMobile ? 'max-w-full' : 'max-w-2xl')}>
          <div className={cn(isMobile ? 'px-4 pt-2 pb-6' : 'p-5')}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {selectedPayment ? (
                <>
                  <button onClick={() => setSelectedPayment(null)} className="h-8 w-8 rounded-lg bg-accent/50 hover:bg-accent/80 flex items-center justify-center transition-colors shrink-0">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <span>Payment Details</span>
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4" />
                  <span>Payment History</span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {paymentLogsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : selectedPayment ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/20 border border-border/30">
                <Badge className={getPaymentStatusColor(selectedPayment.status)}>
                  {selectedPayment.status.charAt(0).toUpperCase() + selectedPayment.status.slice(1)}
                </Badge>
                <div>
                  <p className="font-semibold text-foreground">{selectedPayment.plan_type ? (selectedPayment.plan_type === 'supporter-plus' ? 'Supporter+' : 'Supporter') : selectedPayment.plan || 'Subscription'}</p>
                  <p className="text-xs text-muted-foreground">{formatPaymentDate(selectedPayment.created_at)}</p>
                </div>
              </div>

              <div className={cn('grid gap-3', isMobile ? '' : 'grid-cols-2')}>
                <DetailField label="Amount" value={formatPaymentAmount(selectedPayment)} />
                <DetailField label="Status" value={selectedPayment.status} capitalize />
                <DetailField label="Plan" value={selectedPayment.plan_type ? (selectedPayment.plan_type === 'supporter-plus' ? 'Supporter+' : 'Supporter') : selectedPayment.plan || '—'} />
                <DetailField label="Billing Period" value={selectedPayment.billing_period || '—'} capitalize />
                {selectedPayment.discount_percent ? (
                  <DetailField label="Discount" value={`${selectedPayment.discount_percent}%${selectedPayment.discount_code ? ` (${selectedPayment.discount_code})` : ''}`} highlight />
                ) : null}
                {selectedPayment.network ? <DetailField label="Network" value={selectedPayment.network} /> : null}
                {selectedPayment.token ? <DetailField label="Token" value={selectedPayment.token} /> : null}
                {selectedPayment.tx_hash ? <DetailField label="Transaction Hash" value={selectedPayment.tx_hash} mono fullWidth /> : null}
                {selectedPayment.session_id ? <DetailField label="Session ID" value={selectedPayment.session_id} mono fullWidth /> : null}
                {selectedPayment.description ? <DetailField label="Description" value={selectedPayment.description} fullWidth /> : null}
                <DetailField label="Created" value={formatPaymentDate(selectedPayment.created_at)} />
                {selectedPayment.paid_at ? <DetailField label="Paid At" value={formatPaymentDate(selectedPayment.paid_at)} /> : null}
                {selectedPayment.timezone ? <DetailField label="Timezone" value={selectedPayment.timezone} /> : null}
              </div>
            </div>
          ) : paymentLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No payment history yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Your completed payments will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {paymentLogs.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPayment(p)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/20 hover:bg-accent/30 hover:border-border/40 transition-all text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge className={getPaymentStatusColor(p.status) + ' shrink-0'}>
                      {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {p.plan_type ? (p.plan_type === 'supporter-plus' ? 'Supporter+' : 'Supporter') : p.plan || 'Subscription'}
                        {p.billing_period ? ` — ${p.billing_period}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{formatPaymentDate(p.created_at)}</p>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-foreground shrink-0 ml-3">
                    {formatPaymentAmount(p)}
                  </div>
                </button>
              ))}
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>
    </>);
  }

  function renderProfileSection() {
    return (
      <div className={mc()}>
        {cardHeader(<User className="h-5 w-5 text-primary" />, 'Profile', 'Your personal information')}
        <div className="space-y-4">
          <div className={cn('grid gap-4', isMobile ? '' : 'sm:grid-cols-2')}>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Full Name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your name" className="h-11 rounded-xl bg-muted/20 border-border/40" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Display Name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Enter display name" className="h-11 rounded-xl bg-muted/20 border-border/40" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input value={user?.email || ''} disabled className="h-11 rounded-xl bg-muted/30 border-border/40 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground/60">Email cannot be changed.</p>
          </div>
          <Button onClick={handleSaveProfile} loading={loading} size={isMobile ? 'default' : 'sm'} className="rounded-xl w-full sm:w-auto">Save Changes</Button>
        </div>
      </div>
    );
  }

  function renderSecuritySection() {
    const btnSize = isMobile ? 'default' : 'sm';
    return (
      <div className={mc()}>
        {cardHeader(<Shield className="h-5 w-5 text-primary" />, 'Security', 'Protect your account')}

        <div className="space-y-4">
          {/* MFA/TOTP Card */}
          <div className="rounded-xl border border-border/30 bg-muted/20 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Smartphone className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-foreground">Two-Factor Authentication</h4>
                  <p className="text-xs text-muted-foreground truncate">Add an extra layer of security with TOTP authenticator</p>
                </div>
              </div>
              {aalLevel && (
                <Badge className={cn('shrink-0', aalLevel.currentLevel === 'aal2' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-muted/50 text-muted-foreground border-border/30')}>
                  {aalLevel.currentLevel === 'aal2' ? 'Active' : 'Disabled'}
                </Badge>
              )}
            </div>

            {!mfaSetupMode && mfaFactors.length === 0 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Protect your account by requiring a verification code from your authenticator app when signing in.
                </p>
                <Button variant="outline" size={btnSize} onClick={handleEnrollMfa} disabled={mfaLoading} className="rounded-xl">
                  {mfaLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Plus className="h-3 w-3 mr-1.5" />}
                  Enable TOTP
                </Button>
              </div>
            )}

            {mfaSetupMode && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border/40 bg-muted/30 p-4 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                  </p>
                  <div className="flex justify-center">
                    <div
                      className="bg-white p-2 rounded-lg"
                      dangerouslySetInnerHTML={{ __html: mfaQrCode }}
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">Manual entry key:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs font-mono bg-muted/50 p-2 rounded break-all text-foreground">{mfaSecret}</code>
                      <button
                        type="button"
                        onClick={handleCopySecret}
                        className="shrink-0 h-8 w-8 rounded-lg bg-muted/50 hover:bg-muted/80 flex items-center justify-center transition-colors"
                        title="Copy secret"
                      >
                        {secretCopied ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <svg className="h-3.5 w-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Enter 6-digit code from authenticator</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={mfaVerifyCode}
                    onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="h-11 rounded-xl bg-muted/20 border-border/40 font-mono text-center text-lg tracking-widest"
                  />
                </div>

                <div className="flex gap-2">
                  <Button variant="ghost" size={btnSize} onClick={() => { setMfaSetupMode(false); setMfaVerifyCode(''); setMfaQrCode(''); setMfaSecret(''); setMfaEnrollmentId(''); }} className="rounded-xl">Cancel</Button>
                  <Button size={btnSize} onClick={handleVerifyMfa} disabled={mfaVerifying || mfaVerifyCode.length !== 6} className="rounded-xl flex-1">
                    {mfaVerifying ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
                    Verify & Enable
                  </Button>
                </div>
              </div>
            )}

            {!mfaSetupMode && mfaFactors.length > 0 && (
              <div className="space-y-3">
                {mfaFactors.map(factor => (
                  <div key={factor.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/40 bg-muted/30">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Smartphone className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{factor.friendly_name || 'Authenticator App'}</p>
                        <p className="text-xs text-muted-foreground">
                          Added {new Date(factor.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size={btnSize}
                      onClick={() => { setUnenrollFactorId(factor.id); setShowUnenrollDialog(true); }}
                      disabled={mfaLoading}
                      className="rounded-xl shrink-0"
                    >
                      <Trash2 className="h-3 w-3 mr-1.5" />Remove
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size={btnSize} onClick={handleEnrollMfa} disabled={mfaLoading} className="rounded-xl">
                  <Plus className="h-3 w-3 mr-1.5" /> Add Another
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/30 bg-muted/20 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Fingerprint className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-foreground">Passkey Authentication</h4>
                  <p className="text-xs text-muted-foreground truncate">Use fingerprint, Face ID, or security key to sign in</p>
                </div>
              </div>
              {!isCheckingPasskey && passkeyAvailable && (
                <Badge className={cn('shrink-0', hasPasskey ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-muted/50 text-muted-foreground border-border/30')}>
                  {hasPasskey ? 'Active' : 'Disabled'}
                </Badge>
              )}
            </div>
            {!passkeyAvailable && (
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-muted/30">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">Your device doesn't support passkey authentication.</p>
              </div>
            )}
            {isCheckingPasskey && passkeyAvailable && (
              <div className="flex items-center gap-2 p-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Checking passkey...</p>
              </div>
            )}
            {!isCheckingPasskey && passkeyAvailable && hasPasskey && (
              <div className={cn('flex gap-2', isMobile ? 'flex-col' : 'flex-wrap')}>
                <Button variant="outline" size={btnSize} onClick={handleTestPasskey} disabled={loading} className="rounded-xl">
                  {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Fingerprint className="h-3 w-3 mr-1.5" />}
                  Test
                </Button>
                <Button variant="outline" size={btnSize} onClick={handleUpdatePasskey} disabled={loading} className="rounded-xl">Update</Button>
                <Button variant="destructive" size={btnSize} onClick={() => setShowDeleteDialog(true)} disabled={loading} className="rounded-xl">
                  <Trash2 className="h-3 w-3 mr-1.5" />Remove
                </Button>
              </div>
            )}
            {!isCheckingPasskey && passkeyAvailable && !hasPasskey && (
              <Button onClick={handleRegisterPasskey} disabled={loading} size={btnSize} className="rounded-xl w-full sm:w-auto">
                {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Plus className="h-3 w-3 mr-1.5" />}
                Setup Passkey
              </Button>
            )}
          </div>

          <div className="rounded-xl border border-border/30 bg-muted/20 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Fingerprint className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-foreground">Biometric Security</h4>
                  <p className="text-xs text-muted-foreground truncate">Use device biometrics to protect sensitive actions</p>
                </div>
              </div>
              <Badge className={cn('shrink-0', hasBiometric ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-muted/50 text-muted-foreground border-border/30')}>
                {hasBiometric ? 'Active' : 'Disabled'}
              </Badge>
            </div>
            <div className={cn('flex gap-2', isMobile ? 'flex-col' : 'flex-wrap')}>
              {!hasBiometric ? (
                <Button variant="outline" size={btnSize} onClick={handleSetupBiometric} className="rounded-xl">
                  <Plus className="h-3 w-3 mr-1.5" /> Enable Biometric
                </Button>
              ) : (
                <Button variant="destructive" size={btnSize} onClick={handleDisableBiometric} className="rounded-xl">Disable Biometric</Button>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/30 bg-muted/20 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Key className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-foreground">Change Password</h4>
                  <p className="text-xs text-muted-foreground truncate">Update your account password</p>
                </div>
              </div>
              {!changingPassword && (
                <Button variant="outline" size={btnSize} onClick={() => setChangingPassword(true)} className="rounded-xl shrink-0">Change</Button>
              )}
            </div>
            {changingPassword && (
              <div className="space-y-3 pt-2">
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" className="h-11 rounded-xl bg-muted/20 border-border/40" />
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" className="h-11 rounded-xl bg-muted/20 border-border/40" />
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="h-11 rounded-xl bg-muted/20 border-border/40" />
                <div className="flex gap-2 pt-1">
                  <Button variant="ghost" size={btnSize} onClick={() => { setChangingPassword(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }} className="rounded-xl">Cancel</Button>
                  <Button size={btnSize} onClick={handleChangePassword} disabled={!currentPassword || !newPassword || !confirmPassword || loading} className="rounded-xl flex-1 sm:flex-none" loading={loading}>
                    Update Password
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderMigrationSection() {
    const btnSize = isMobile ? 'default' : 'sm';
    return (
      <div className={mc()}>
        {cardHeader(<FileArchive className="h-5 w-5 text-primary" />, 'Migration Progress', 'Track your ZIP imports and cloud migrations')}
        {migrationJob ? (
          <div className="rounded-xl border border-border/30 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium capitalize truncate">{migrationJob.source_platform?.replace('-', ' ')}</span>
              </div>
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full shrink-0', getStatusColor(migrationJob.status), 'bg-current/10')}>
                {getStatusLabel(migrationJob.status)}
              </span>
            </div>
            {migrationJob.total_files > 0 && (
              <>
                <Progress value={migrationJob.total_files > 0 ? (migrationJob.processed_files / migrationJob.total_files) * 100 : 0} className="w-full" />
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div><span className="font-medium">{migrationJob.total_files}</span> <span className="text-muted-foreground">total</span></div>
                  <div><span className="font-medium text-green-600">{migrationJob.processed_files}</span> <span className="text-muted-foreground">done</span></div>
                  <div><span className="font-medium text-red-600">{migrationJob.failed_files}</span> <span className="text-muted-foreground">failed</span></div>
                </div>
              </>
            )}
            {migrationJob.settings?.totalSize && (
              <div className="text-[11px] text-muted-foreground text-center">
                Total: {formatSpeed(migrationJob.settings.totalSize)}
                {migrationJob.settings.processedSize ? ` · Uploaded: ${formatSpeed(migrationJob.settings.processedSize)}` : ''}
              </div>
            )}
            {migrationJob.error_message && (
              <div className="text-xs text-red-500 bg-red-500/10 p-2 rounded-lg">{migrationJob.error_message}</div>
            )}
            {['scheduled', 'extracting', 'uploading', 'in_progress'].includes(migrationJob.status) && (
              <div className="space-y-2">
                <Button variant="outline" size={btnSize} className="w-full rounded-xl" onClick={() => setShowImportDialog(true)}>
                  <RefreshCw className="h-3.5 w-3.5 mr-2" /> View Details
                </Button>
                <Button variant="destructive" size={btnSize} className="w-full rounded-xl" onClick={handleCancelMigration} disabled={cancelling}>
                  {cancelling ? <Loader size="sm" className="mr-2" /> : null}Cancel Import
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <FileArchive className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground mb-1">No active imports</p>
            <p className="text-xs text-muted-foreground/60 mb-4">Import files from other platforms or ZIP archives.</p>
            <Button variant="outline" size={btnSize} className="rounded-xl" onClick={() => setShowImportDialog(true)}>
              <Plus className="h-3.5 w-3.5 mr-2" /> Import Files
            </Button>
          </div>
        )}
      </div>
    );
  }

  function renderDeveloperSection() {
    const btnSize = isMobile ? 'default' : 'sm';
    return (
      <div className={mc()}>
        {cardHeader(<Code className="h-5 w-5 text-primary" />, 'Developer API', 'Manage your API keys and integrations')}
        <ApiKeyManagement />
        <Button
          variant="outline"
          size={btnSize}
          onClick={() => navigate('/developer-api')}
          className="w-full rounded-xl mt-4"
        >
          <Book className="h-4 w-4 mr-2" />
          API Documentation
        </Button>
      </div>
    );
  }

  function renderWebhooksSection() {
    const btnSize = isMobile ? 'default' : 'sm';
    return (
      <div className={mc()}>
        {cardHeader(<Repeat className="h-5 w-5 text-primary" />, 'Webhooks', 'Configure event-driven webhook notifications')}
        <WebhookManager open={false} onClose={() => {}} standalone />
        <Button
          variant="outline"
          size={btnSize}
          onClick={() => navigate('/webhooks')}
          className="w-full rounded-xl mt-4"
        >
          <Book className="h-4 w-4 mr-2" />
          Webhook Documentation
        </Button>
      </div>
    );
  }

  function renderDevicesSection() {
    return <CliDevicesSection />;
  }

  function renderPreferencesSection() {
    return (
      <div className={mc()}>
        {cardHeader(<Settings className="h-5 w-5 text-primary" />, 'Advanced Preferences', 'Fine-tune your SquidCloud experience')}
        <div className="space-y-5">
          {preferenceCategories.map((category) => (
            <div key={category.id}>
              <h4 className="text-xs font-semibold text-foreground mb-1">{category.title}</h4>
              <p className="text-[11px] text-muted-foreground/60 mb-3">{category.subtitle}</p>
              <div className="space-y-2">
                {category.items.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-3 rounded-xl border border-border/20 bg-muted/20 px-4 py-3 transition-colors hover:bg-accent/30 hover:border-border/40">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">{item.description}</p>
                    </div>
                    <Switch checked={accountPreferences[item.key]} onCheckedChange={(checked) => updatePreference(item.key, checked)} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-border/20 space-y-4">
          <h4 className="text-xs font-semibold text-foreground">Subscription Notifications</h4>
          <p className="text-[11px] text-muted-foreground/60 -mt-3">Control how and when we remind you about subscription expiry.</p>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/20 bg-muted/20 px-4 py-3 transition-colors hover:bg-accent/30 hover:border-border/40">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Email notifications</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">Receive expiry reminders via email</p>
            </div>
            <Switch checked={notifPrefs.email_enabled} onCheckedChange={(v) => updateNotifPref('email_enabled', v)} />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/20 bg-muted/20 px-4 py-3 transition-colors hover:bg-accent/30 hover:border-border/40">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">In-app popups</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">Show expiry warnings inside the app</p>
            </div>
            <Switch checked={notifPrefs.popup_enabled} onCheckedChange={(v) => updateNotifPref('popup_enabled', v)} />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/20 bg-muted/20 px-4 py-3 transition-colors hover:bg-accent/30 hover:border-border/40">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Warning lead time</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">How many days before expiry to start warning you</p>
            </div>
            <select
              value={notifPrefs.warning_lead_days}
              onChange={(e) => updateNotifPref('warning_lead_days', parseInt(e.target.value))}
              className="h-8 rounded-lg bg-muted/50 border border-border/30 text-xs px-2 text-foreground"
            >
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
            </select>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/20 bg-muted/20 px-4 py-3 transition-colors hover:bg-accent/30 hover:border-border/40">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Do not contact</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">Stop all win-back emails after cancellation or expiry</p>
            </div>
            <Switch checked={notifPrefs.do_not_contact} onCheckedChange={(v) => updateNotifPref('do_not_contact', v)} />
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-border/20">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-[13px] font-medium text-red-400 transition-all duration-150 hover:bg-red-500/10 hover:border-red-500/30 active:scale-[0.98]"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const sectionRenderers: Record<SettingsCategory, () => React.ReactNode> = {
    profile: renderProfileSection,
    security: renderSecuritySection,
    developer: renderDeveloperSection,
    webhooks: renderWebhooksSection,
    migration: renderMigrationSection,
    plans: renderPlansSection,
    byok: () => (
      <div className="space-y-6">
        <BYOKSettingsCard className="rounded-xl" />
        <SDESettingsCard className="rounded-xl" />
      </div>
    ),
    preferences: renderPreferencesSection,
    devices: renderDevicesSection,
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 backdrop-blur-xl border-b border-border/10 bg-background/80">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="h-9 w-9 rounded-xl bg-accent/50 hover:bg-accent/80 flex items-center justify-center lg-press-subtle transition-colors">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-foreground truncate">Account Settings</h1>
            <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
      </div>

      {isMobile ? (
        <>
          <div className="sticky top-14 z-40 bg-background/80 backdrop-blur-xl border-b border-border/10">
            <div className="flex gap-1.5 px-3 py-2.5 overflow-x-auto scrollbar-none snap-x snap-mandatory">
              {SETTINGS_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => switchCategory(cat.id)}
                    className={cn(
                      'flex items-center gap-2 px-3.5 h-9 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200 snap-start shrink-0',
                      isActive
                        ? 'bg-primary/15 text-primary shadow-sm shadow-primary/5 border border-primary/20'
                        : 'bg-muted/30 text-muted-foreground/70 hover:text-foreground hover:bg-accent/40 border border-transparent',
                    )}
                  >
                    <Icon className={cn('h-3.5 w-3.5', isActive ? 'text-primary' : 'text-muted-foreground/50')} />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div ref={contentRef} className="px-3 pt-4 pb-8 space-y-5 overflow-y-auto">
            <div className={cn(
              'transition-all duration-200 ease-out',
              animating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
            )}>
              {sectionRenderers[activeCategory]()}
            </div>
          </div>
        </>
      ) : (
        <div className="max-w-5xl mx-auto px-4 py-8 flex gap-6">
          <aside className="w-52 flex-shrink-0">
            <nav className="sticky top-20 space-y-1">
              {SETTINGS_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      'flex items-center gap-2.5 w-full px-3.5 h-9 rounded-xl text-sm font-medium transition-all text-left',
                      isActive
                        ? 'bg-primary/10 text-primary border border-primary/15'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/30',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {cat.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="flex-1 min-w-0 space-y-6">
            {sectionRenderers[activeCategory]()}
          </div>
        </div>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Passkey?</AlertDialogTitle>
            <AlertDialogDescription>This will disable passkey authentication. You can set up a new passkey anytime.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePasskey} disabled={loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Removing...</> : 'Remove Passkey'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {user && <BiometricSetupDialog open={showBiometricSetup} onClose={() => setShowBiometricSetup(false)} onComplete={handleBiometricSetupComplete} />}

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Files</DialogTitle>
          </DialogHeader>
          <MigrationWizard
            onComplete={() => { setShowImportDialog(false); fetchLatestMigration(); }}
            onCancel={() => setShowImportDialog(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={showUnenrollDialog} onOpenChange={setShowUnenrollDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Two-Factor Authentication?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the authenticator app from your account. You will no longer need a verification code to sign in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mfaLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnenrollMfa} disabled={mfaLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {mfaLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Disabling...</> : 'Disable MFA'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AccountSettings;

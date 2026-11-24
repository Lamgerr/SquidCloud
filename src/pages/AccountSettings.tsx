import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { isPasskeyAvailable, registerPasskey, authenticateWithPasskey } from '@/lib/webauthn';
import BiometricSetupDialog from '@/components/BiometricSetupDialog';
import { biometricAuthService } from '@/services/biometricAuthService';
import { BYOKSettingsCard, SDESettingsCard } from '@/components/encryption';
import ApiKeyManagement from '@/components/ApiKeyManagement';
import CliDevicesSection from '@/components/settings/CliDevicesSection';
import { WebhookManager } from '@/components/WebhookManager';
import {
  User, Key, Shield, ShieldAlert, Fingerprint,
  Plus, Lock, Settings, Trash2, HardDrive, Calendar, Code, Zap,
  FolderOpen, FileArchive, RefreshCw, Crown, Briefcase, TrendingUp,
  Repeat, Book, LogOut, Smartphone,
} from '@/lib/icon-map';
import { swkFetchNotices, swkAppealCase, SwkNotice } from '@/lib/swk-manifest';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MigrationWizard from '@/components/MigrationWizard';
import CancelSubscriptionFlow from '@/components/CancelSubscriptionFlow';
import { emitSignal } from '@/lib/api';
import { mfaService, MfaFactor } from '@/services/mfa-service';
import {
  AppShell, TopBar, Wrap, PageHead, Panel, Row, Pill, Dot, Meter, Note, Stat, Stats, KV,
  Empty, Skel, SkelRows, Spinner, Ico, Field, UnderlineTabs, btn, useHashState, useDocTitle,
} from '@/components/custom/squid-app';
import type { Tone } from '@/components/custom/squid-app';

/* ═══════════════════════════════════════════════════════════════
   ACCOUNT SETTINGS
   One grammar for the whole page: a Panel is a topic, a Row is one
   setting (what it is on the left, how to change it on the right).
   Left rail groups the nine sections and the open one lives in the
   URL (#section=security), so refresh and back-links land where you
   were. ⌘/Ctrl+S saves the profile form. Every handler is unchanged.
   Place at: src/pages/AccountSettings.tsx
   ═══════════════════════════════════════════════════════════════ */

import { PAGES_POLISH } from "@/components/polish/pages-polish.css";
import VaultUnlockDialog from '@/components/VaultUnlockDialog';
import { isVaultUnlocked, lockVault } from '@/lib/zk-vault-session';

const ST_CSS = `
${ PAGES_POLISH }
.st { display: grid; grid-template-columns: 216px minmax(0, 1fr); gap: 48px; align-items: start; }
.st-nav { position: sticky; top: 72px; }
.st-main { min-width: 0; max-width: 780px; }
.st-main > .sa-panel + .sa-panel, .st-main > .sa-panel + div, .st-main > div + .sa-panel { margin-top: 16px; }
.st-bar { display: none; }
@media (max-width: 860px) {
  .st { grid-template-columns: 1fr; gap: 0; }
  .st-nav { display: none; }
  .st-bar { display: block; position: sticky; top: 48px; z-index: 30; padding: 0 var(--sa-gut); border-bottom: 1px solid var(--sa-line); background: color-mix(in srgb, var(--sa-bg) 92%, transparent); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); }
  .st-bar .sa-tabs { border-bottom: 0; }
}
.st-foot { display: flex; gap: 8px; flex-wrap: wrap; padding: 14px 16px; border-top: 1px solid var(--sa-line); }
.st-p { margin: 0; font-size: 13px; line-height: 1.6; color: var(--sa-text-2); }
.st-form { display: grid; gap: 16px; }
.st-form > *, .st-g2 > * { min-width: 0; }
.st-g2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
@media (max-width: 640px) { .st-g2 { grid-template-columns: minmax(0, 1fr); } }
.st-mfa { display: grid; grid-template-columns: 176px minmax(0, 1fr); gap: 20px; padding: 16px; }
@media (max-width: 640px) { .st-mfa { grid-template-columns: 1fr; } }
.st-qr { width: 176px; height: 176px; padding: 8px; border-radius: 4px; background: #fff; }
.st-qr svg, .st-qr img { display: block; width: 100%; height: 100%; }
.st-select { height: 30px; padding: 0 8px; border: 1px solid var(--sa-line-2); border-radius: 4px; background: var(--sa-bg); color: var(--sa-text); font: 400 12.5px/1 var(--sa-f); }
.st-select:focus-visible { outline: 1px solid var(--sa-text); outline-offset: 1px; }
.st-notice { padding: 14px 16px; }
.st-notice + .st-notice { border-top: 1px solid var(--sa-line); }
.st-notice h4 { margin: 0; font: 500 13.5px/1.35 var(--sa-f); }
.st-notice .when { font: 400 11px/1.4 var(--sa-mono); color: var(--sa-mute); }
.st-notice p { margin: 8px 0 0; font-size: 12.5px; line-height: 1.6; color: var(--sa-text-2); white-space: pre-wrap; }
.st-codes { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.st-df { padding: 12px 14px; border: 1px solid var(--sa-line); border-radius: 4px; background: var(--sa-bg-2); min-width: 0; }
.st-df.full { grid-column: 1 / -1; }
.st-df small { display: block; font: 400 10.5px/1 var(--sa-mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--sa-mute); }
.st-df b { display: block; margin-top: 7px; font: 500 13.5px/1.35 var(--sa-f); color: var(--sa-text); word-break: break-word; }
.st-df b.mono { font: 400 12px/1.5 var(--sa-mono); }
.st-df b.cap { text-transform: capitalize; }
.st-df b.good { color: var(--sa-ok); }
.st-pay { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; transition: background 0.12s; }
.st-pay + .st-pay { border-top: 1px solid var(--sa-line); }
.st-pay:hover { background: var(--sa-bg-3); }
.st-pay .l { display: flex; align-items: center; gap: 12px; min-width: 0; }
.st-pay b { display: block; font: 500 13.5px/1.35 var(--sa-f); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-pay small { display: block; margin-top: 2px; font-size: 12px; color: var(--sa-mute); }
.st-pay .amt { font: 500 13.5px/1 var(--sa-mono); flex: none; }
`;

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

const SECTION_IDS: SettingsCategory[] = SETTINGS_CATEGORIES.map((c) => c.id);

const NAV_GROUPS: Array<{ label: string; ids: SettingsCategory[] }> = [
  { label: 'Account', ids: ['profile', 'security', 'plans'] },
  { label: 'Developer', ids: ['developer', 'webhooks', 'devices'] },
  { label: 'Data', ids: ['migration', 'byok'] },
  { label: 'System', ids: ['preferences'] },
];

const SECTION_DESC: Record<SettingsCategory, string> = {
  profile: 'Your personal information',
  security: 'Protect your account',
  devices: 'Command-line devices linked to your account',
  developer: 'Manage your API keys and integrations',
  webhooks: 'Configure event-driven webhook notifications',
  plans: 'Manage your plan and billing',
  migration: 'Track your ZIP imports and cloud migrations',
  byok: 'Encryption keys and data protection',
  preferences: 'Fine-tune your SquidCloud experience',
};

const AccountSettings = () => {
  const { user, profile, session, signOut, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [activeCategory, setActiveCategory] = useHashState<SettingsCategory>('section', 'profile', SECTION_IDS);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [vaultState, setVaultState] = useState(isVaultUnlocked());
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
  const [swkNotices, setSwkNotices] = useState<SwkNotice[]>([]);
  const [swkLoading, setSwkLoading] = useState(false);
  const [swkAppealingId, setSwkAppealingId] = useState<string | null>(null);

  useEffect(() => {
    if (activeCategory !== 'security') return;
    let cancelled = false;
    setSwkLoading(true);
    swkFetchNotices(true)
      .then((notices) => { if (!cancelled) setSwkNotices(notices); })
      .catch(() => null)
      .finally(() => { if (!cancelled) setSwkLoading(false); });
    return () => { cancelled = true; };
  }, [activeCategory]);

  const handleSwkAppeal = async (notice: SwkNotice) => {
    if (!notice.case_id || swkAppealingId) return;
    setSwkAppealingId(notice.id);
    try {
      const ok = await swkAppealCase(notice.case_id);
      toast({
        title: ok ? 'Appeal submitted' : 'Appeal failed',
        description: ok
          ? 'A human reviewer will look at your case. The file stays blocked until then.'
          : 'Could not submit the appeal. Try again shortly.',
        variant: ok ? 'default' : 'destructive',
      });
      if (ok) {
        const refreshed = await swkFetchNotices(false).catch(() => [] as SwkNotice[]);
        setSwkNotices(refreshed);
      }
    } finally {
      setSwkAppealingId(null);
    }
  };
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

  /* ───────── presentation helpers (UI only) ───────── */
  const migTone = (s: string): Exclude<Tone, 'solid'> =>
    s === 'completed' ? 'ok' : s === 'failed' ? 'err' : s === 'cancelled' ? 'neutral' : s === 'scheduled' ? 'warn' : 'info';
  const payTone = (s: string): Exclude<Tone, 'solid'> =>
    s === 'completed' ? 'ok' : s === 'pending' || s === 'expired' ? 'warn' : s === 'failed' ? 'err' : s === 'refunded' ? 'info' : 'neutral';
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const sv = (v: React.ReactNode) => <span style={{ fontSize: 20 }}>{v}</span>;
  const iconTitle = (icon: React.ReactNode, text: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{icon}{text}</span>
  );

  const DetailField = ({ label, value, capitalize, mono, fullWidth, highlight }: { label: string; value: string; capitalize?: boolean; mono?: boolean; fullWidth?: boolean; highlight?: boolean }) => (
    <div className={`st-df${fullWidth ? ' full' : ''}`}>
      <small>{label}</small>
      <b className={[mono ? 'mono' : '', capitalize ? 'cap' : '', highlight ? 'good' : ''].filter(Boolean).join(' ')}>{value}</b>
    </div>
  );

  function renderPlansSection() {
    const purchaseDate = profile?.subscription_starts_at
      ? new Date(profile.subscription_starts_at).toLocaleDateString()
      : latestPayment?.created_at
        ? new Date(latestPayment.created_at).toLocaleDateString()
        : '-';
    const detailItems: Array<[React.ReactNode, React.ReactNode]> = [
      ['Plan', userTier],
      ['Billing Period', <span style={{ textTransform: 'capitalize' }}>{latestPayment?.billing_period || '-'}</span>],
      ['Purchase Date', purchaseDate],
      ['Expires On', profile?.subscription_expires_at ? new Date(profile.subscription_expires_at).toLocaleDateString() : '-'],
      ['Amount Paid', latestPayment ? formatPaymentAmount(latestPayment) : '-'],
      ['Payment Mode', <span style={{ textTransform: 'capitalize' }}>{latestPayment?.tx_hash ? 'Crypto' : latestPayment?.discount_code ? 'Discount Code' : latestPayment?.metadata?.source === 'redeem_code' ? 'Redeem Code' : '-'}</span>],
    ];
    if (latestPayment?.discount_percent) {
      detailItems.push(['Discount', <span style={{ color: 'var(--sa-ok)' }}>{latestPayment.discount_percent}%{latestPayment.discount_code ? ` (${latestPayment.discount_code})` : ''}</span>]);
    } else if (latestPayment?.metadata?.code) {
      detailItems.push(['Redeem Code', <span className="sa-mono" style={{ color: 'var(--sa-ok)' }}>{latestPayment.metadata.code}</span>]);
    }

    return (
      <>
        <Panel
          title={`Current Plan — ${userTier}`}
          desc={isPremium
            ? 'Priority queue, unlimited file requests, always-active sites & more'
            : 'Unlimited storage with standard queue priority'}
          actions={<Pill tone={isPremium ? 'solid' : 'neutral'}>{userTier}</Pill>}
          flush
        >
          <Stats>
            <Stat label="Storage" value={sv(formatBytes(storageUsed))} />
            <Stat label="Total Files" value={sv(`${totalFiles} files`)} />
            <Stat label="Member Since" value={sv(profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '-')} />
            <Stat label="Account Type" value={sv(userTier)} />
          </Stats>
          <div className="st-foot">
            {isPremium ? (
              <button type="button" className={btn()} onClick={() => navigate('/pricing')}>
                <Crown className="h-3.5 w-3.5" />Change Plan
              </button>
            ) : (
              <button type="button" className={btn('primary')} onClick={() => navigate('/pricing')}>
                <Crown className="h-3.5 w-3.5" />Upgrade Now
              </button>
            )}
            <button type="button" className={btn()} onClick={() => { fetchPaymentLogs(); setPaymentHistoryOpen(true); }}>
              <Calendar className="h-3.5 w-3.5" />History
            </button>
          </div>
        </Panel>

        {isPremium && (
          <Panel title="Subscription Details">
            <KV items={detailItems} />
          </Panel>
        )}

        <Panel title="Redeem a Code" desc="Enter a redeem code to unlock premium features">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="sa-input sa-mono"
              style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
              placeholder="Enter redeem code"
              value={redeemCodeInput}
              onChange={(e) => setRedeemCodeInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleRedeemCode()}
              aria-label="Redeem code"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" className={btn('primary')} onClick={handleRedeemCode} disabled={!redeemCodeInput.trim() || redeeming}>
              {redeeming && <Spinner size={12} />}Redeem
            </button>
          </div>
        </Panel>

        {isPremium && (
          <Panel danger title="Cancel Subscription" desc="Your plan will remain active until the end of the billing period">
            <CancelSubscriptionFlow
              userId={user?.id || ''}
              planType={profile?.tier}
              billingPeriod={latestPayment?.billing_period || 'monthly'}
              onCancelled={() => { refreshProfile(); fetchPaymentLogs(); }}
            />
          </Panel>
        )}

        <Dialog open={paymentHistoryOpen} onOpenChange={(open) => { setPaymentHistoryOpen(open); if (!open) setSelectedPayment(null); }}>
          <DialogContent className={isMobile ? 'max-h-[85vh] overflow-y-auto max-w-full p-0' : 'max-h-[85vh] overflow-y-auto max-w-2xl p-0'}>
            <div style={{ padding: isMobile ? '8px 16px 24px' : 20 }}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  {selectedPayment ? (
                    <>
                      <button type="button" className={btn('ghost', 'icon-sm')} onClick={() => setSelectedPayment(null)} aria-label="Back to payment history">
                        <Ico.ArrowLeft size={14} />
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
                <div style={{ paddingTop: 16 }}><SkelRows rows={4} /></div>
              ) : selectedPayment ? (
                <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, border: '1px solid var(--sa-line)', borderRadius: 5, background: 'var(--sa-bg-2)' }}>
                    <Pill tone={payTone(selectedPayment.status)}>{cap(selectedPayment.status)}</Pill>
                    <div>
                      <div style={{ fontWeight: 500 }}>{selectedPayment.plan_type ? (selectedPayment.plan_type === 'supporter-plus' ? 'Supporter+' : 'Supporter') : selectedPayment.plan || 'Subscription'}</div>
                      <div className="sa-mute" style={{ fontSize: 12 }}>{formatPaymentDate(selectedPayment.created_at)}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 10, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
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
                <Empty icon={<Calendar className="h-4 w-4" />} title="No payment history yet" body="Your completed payments will appear here." />
              ) : (
                <div className="sa-panel" style={{ marginTop: 16, overflow: 'hidden' }}>
                  {paymentLogs.map((p) => (
                    <button key={p.id} type="button" className="st-pay" onClick={() => setSelectedPayment(p)}>
                      <span className="l">
                        <Pill tone={payTone(p.status)}>{cap(p.status)}</Pill>
                        <span style={{ minWidth: 0 }}>
                          <b>
                            {p.plan_type ? (p.plan_type === 'supporter-plus' ? 'Supporter+' : 'Supporter') : p.plan || 'Subscription'}
                            {p.billing_period ? ` — ${p.billing_period}` : ''}
                          </b>
                          <small>{formatPaymentDate(p.created_at)}</small>
                        </span>
                      </span>
                      <span className="amt">{formatPaymentAmount(p)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  function renderProfileSection() {
    const dirty = fullName.trim() !== (profile?.full_name || '') || displayName.trim() !== (profile?.display_name || '');
    return (
      <Panel
        title="Personal information"
        actions={dirty ? <Pill tone="warn">Unsaved</Pill> : undefined}
      >
        <form
          className="st-form"
          onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); handleSaveProfile(); }
          }}
        >
          <div className="st-g2">
            <Field label="Full name" htmlFor="st-full">
              <input id="st-full" className="sa-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your name" autoComplete="name" />
            </Field>
            <Field label="Display name" htmlFor="st-display">
              <input id="st-display" className="sa-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Enter display name" autoComplete="nickname" />
            </Field>
          </div>
          <Field label="Email" htmlFor="st-email" hint="Email cannot be changed.">
            <input id="st-email" className="sa-input" value={user?.email || ''} disabled />
          </Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="submit" className={btn('primary')} disabled={loading}>
              {loading && <Spinner size={12} />}Save changes
            </button>
            <span className="sa-hint hide-sm" style={{ margin: 0 }}>or press ⌘ / Ctrl + S</span>
          </div>
        </form>
      </Panel>
    );
  }

  function renderSecuritySection() {
    const unread = swkNotices.filter((n) => !n.is_read).length;
    return (
      <>
        {/* Two-factor */}
        <Panel
          title={iconTitle(<Smartphone className="h-3.5 w-3.5" />, 'Two-Factor Authentication')}
          desc="Add an extra layer of security with TOTP authenticator"
          actions={aalLevel ? <Pill tone={aalLevel.currentLevel === 'aal2' ? 'ok' : 'neutral'}>{aalLevel.currentLevel === 'aal2' ? 'Active' : 'Disabled'}</Pill> : undefined}
          flush
        >
          {!mfaSetupMode && mfaFactors.length === 0 && (
            <Row label="Authenticator app" desc="Protect your account by requiring a verification code from your authenticator app when signing in.">
              <button type="button" className={btn()} onClick={handleEnrollMfa} disabled={mfaLoading}>
                {mfaLoading ? <Spinner size={12} /> : <Plus className="h-3 w-3" />}Enable TOTP
              </button>
            </Row>
          )}

          {mfaSetupMode && (
            <div className="st-mfa">
              <div>
                <div className="st-qr" dangerouslySetInnerHTML={{ __html: mfaQrCode }} />
              </div>
              <div style={{ display: 'grid', gap: 14, alignContent: 'start', minWidth: 0 }}>
                <p className="st-p">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
                <div>
                  <div className="sa-label">Manual entry key</div>
                  <div className="sa-code inline" style={{ maxWidth: '100%' }}>
                    <code title={mfaSecret} style={{ userSelect: 'all' }}>{mfaSecret}</code>
                    <button type="button" className={btn('ghost', 'icon-sm')} onClick={handleCopySecret} aria-label="Copy secret">
                      {secretCopied ? <Ico.Check size={13} /> : <Ico.Copy size={13} />}
                    </button>
                  </div>
                </div>
                <Field label="Enter 6-digit code from authenticator" htmlFor="st-mfa-code">
                  <input
                    id="st-mfa-code"
                    className="sa-input sa-mono"
                    style={{ height: 44, fontSize: 18, textAlign: 'center', letterSpacing: '0.4em' }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={mfaVerifyCode}
                    onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={(e) => { if (e.key === 'Enter' && mfaVerifyCode.length === 6 && !mfaVerifying) handleVerifyMfa(); }}
                    placeholder="000000"
                    autoFocus
                  />
                </Field>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className={btn('ghost')} onClick={() => { setMfaSetupMode(false); setMfaVerifyCode(''); setMfaQrCode(''); setMfaSecret(''); setMfaEnrollmentId(''); }}>Cancel</button>
                  <button type="button" className={btn('primary')} onClick={handleVerifyMfa} disabled={mfaVerifying || mfaVerifyCode.length !== 6}>
                    {mfaVerifying && <Spinner size={12} />}Verify &amp; Enable
                  </button>
                </div>
              </div>
            </div>
          )}

          {!mfaSetupMode && mfaFactors.length > 0 && (
            <>
              {mfaFactors.map((factor) => (
                <Row
                  key={factor.id}
                  label={<span title={factor.friendly_name || 'Authenticator App'} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>{factor.friendly_name || 'Authenticator App'}</span>}
                  desc={`Added ${new Date(factor.created_at).toLocaleDateString()}`}
                >
                  <button
                    type="button"
                    className={btn('danger', 'sm')}
                    onClick={() => { setUnenrollFactorId(factor.id); setShowUnenrollDialog(true); }}
                    disabled={mfaLoading}
                  >
                    <Trash2 className="h-3 w-3" />Remove
                  </button>
                </Row>
              ))}
              <Row label="Add another authenticator" desc="Register a second device so you are never locked out.">
                <button type="button" className={btn('default', 'sm')} onClick={handleEnrollMfa} disabled={mfaLoading}>
                  <Plus className="h-3 w-3" /> Add Another
                </button>
              </Row>
            </>
          )}
        </Panel>

        {/* Passkey */}
        <Panel
          title={iconTitle(<Fingerprint className="h-3.5 w-3.5" />, 'Passkey Authentication')}
          desc="Use fingerprint, Face ID, or security key to sign in"
          actions={!isCheckingPasskey && passkeyAvailable ? <Pill tone={hasPasskey ? 'ok' : 'neutral'}>{hasPasskey ? 'Active' : 'Disabled'}</Pill> : undefined}
          flush
        >
          {!passkeyAvailable && (
            <div style={{ padding: 16 }}>
              <Note>Your device doesn't support passkey authentication.</Note>
            </div>
          )}
          {isCheckingPasskey && passkeyAvailable && (
            <Row label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 400 }}><Spinner size={12} />Checking passkey...</span>} />
          )}
          {!isCheckingPasskey && passkeyAvailable && hasPasskey && (
            <Row label="Passkey registered" desc="Test it, replace it, or remove it.">
              <button type="button" className={btn('default', 'sm')} onClick={handleTestPasskey} disabled={loading}>
                {loading ? <Spinner size={12} /> : <Fingerprint className="h-3 w-3" />}Test
              </button>
              <button type="button" className={btn('default', 'sm')} onClick={handleUpdatePasskey} disabled={loading}>Update</button>
              <button type="button" className={btn('danger', 'sm')} onClick={() => setShowDeleteDialog(true)} disabled={loading}>
                <Trash2 className="h-3 w-3" />Remove
              </button>
            </Row>
          )}
          {!isCheckingPasskey && passkeyAvailable && !hasPasskey && (
            <Row label="No passkey yet" desc="Sign in with a touch or a look instead of a password.">
              <button type="button" className={btn('primary', 'sm')} onClick={handleRegisterPasskey} disabled={loading}>
                {loading ? <Spinner size={12} /> : <Plus className="h-3 w-3" />}Setup Passkey
              </button>
            </Row>
          )}
        </Panel>

        {/* Biometric */}
        <Panel
          title={iconTitle(<Fingerprint className="h-3.5 w-3.5" />, 'Biometric Security')}
          desc="Use device biometrics to protect sensitive actions"
          actions={<Pill tone={hasBiometric ? 'ok' : 'neutral'}>{hasBiometric ? 'Active' : 'Disabled'}</Pill>}
          flush
        >
          <Row label={hasBiometric ? 'Biometric protection is on' : 'Biometric protection is off'}>
            {!hasBiometric ? (
              <button type="button" className={btn('default', 'sm')} onClick={handleSetupBiometric}>
                <Plus className="h-3 w-3" /> Enable Biometric
              </button>
            ) : (
              <button type="button" className={btn('danger', 'sm')} onClick={handleDisableBiometric}>Disable Biometric</button>
            )}
          </Row>
        </Panel>

        {/* Password */}
        <Panel
          title={iconTitle(<Key className="h-3.5 w-3.5" />, 'Change Password')}
          desc="Update your account password"
          flush={!changingPassword}
          actions={!changingPassword ? <button type="button" className={btn('default', 'sm')} onClick={() => setChangingPassword(true)}>Change</button> : undefined}
        >
          {changingPassword && (
            <form
              className="st-form"
              onSubmit={(e) => { e.preventDefault(); if (currentPassword && newPassword && confirmPassword && !loading) handleChangePassword(); }}
            >
              <input type="password" className="sa-input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" autoComplete="current-password" aria-label="Current password" autoFocus />
              <input type="password" className="sa-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" autoComplete="new-password" aria-label="New password" />
              <input type="password" className="sa-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" autoComplete="new-password" aria-label="Confirm new password" />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className={btn('ghost')} onClick={() => { setChangingPassword(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}>Cancel</button>
                <button type="submit" className={btn('primary')} disabled={!currentPassword || !newPassword || !confirmPassword || loading}>
                  {loading && <Spinner size={12} />}Update Password
                </button>
              </div>
            </form>
          )}
        </Panel>

        {/* S-Hawk */}
        <Panel
          title={iconTitle(<ShieldAlert className="h-3.5 w-3.5" />, 'Upload Appeals (S-Hawk)')}
          desc="Why a file was refused — and appeal for human review"
          actions={unread > 0 ? <Pill tone="err">{unread} new</Pill> : undefined}
          flush
        >
          {swkLoading ? (
            <div style={{ padding: 16, display: 'grid', gap: 8 }}>
              <Skel w="40%" h={11} /><Skel w="70%" h={9} />
              <span className="sa-sr">Loading screening decisions…</span>
            </div>
          ) : swkNotices.length === 0 ? (
            <div style={{ padding: 16 }}>
              <p className="st-p sa-mute">No screening decisions on your account. Every refused upload will appear here with its exact reasons.</p>
            </div>
          ) : (
            swkNotices.map((notice) => (
              <div key={notice.id} className="st-notice">
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                  <h4>{notice.title}</h4>
                  <span className="when">{new Date(notice.created_at).toLocaleString()}</span>
                </div>
                <p>{notice.body}</p>
                {notice.reason_codes.length > 0 && (
                  <div className="st-codes">
                    {notice.reason_codes.map((code) => (
                      <Pill key={code}>{code}</Pill>
                    ))}
                  </div>
                )}
                {notice.case_id && (
                  <div style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className={btn('default', 'sm')}
                      disabled={swkAppealingId === notice.id}
                      onClick={() => handleSwkAppeal(notice)}
                    >
                      {swkAppealingId === notice.id ? <Spinner size={12} /> : null}
                      Appeal for human review
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </Panel>
      </>
    );
  }

  function renderMigrationSection() {
    if (!migrationJob) {
      return (
        <Panel title="Migration Progress" desc="Track your ZIP imports and cloud migrations">
          <Empty
            icon={<FileArchive className="h-4 w-4" />}
            title="No active imports"
            body="Import files from other platforms or ZIP archives."
            action={
              <button type="button" className={btn()} onClick={() => setShowImportDialog(true)}>
                <Plus className="h-3.5 w-3.5" /> Import Files
              </button>
            }
          />
        </Panel>
      );
    }
    const running = ['scheduled', 'extracting', 'uploading', 'in_progress'].includes(migrationJob.status);
    return (
      <Panel
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textTransform: 'capitalize' }}>
            <FolderOpen className="h-3.5 w-3.5" />{migrationJob.source_platform?.replace('-', ' ')}
          </span>
        }
        desc="Track your ZIP imports and cloud migrations"
        actions={<Pill tone={migTone(migrationJob.status)}>{getStatusLabel(migrationJob.status)}</Pill>}
        flush
      >
        {migrationJob.total_files > 0 && (
          <>
            <div style={{ padding: '16px 16px 0' }}>
              <Meter plain value={migrationJob.processed_files} max={migrationJob.total_files} label="Files processed" />
            </div>
            <Stats>
              <Stat label="Total" value={sv(migrationJob.total_files)} />
              <Stat label="Done" value={<span style={{ fontSize: 20, color: 'var(--sa-ok)' }}>{migrationJob.processed_files}</span>} />
              <Stat label="Failed" value={<span style={{ fontSize: 20, color: migrationJob.failed_files ? 'var(--sa-err)' : undefined }}>{migrationJob.failed_files}</span>} />
            </Stats>
          </>
        )}
        {migrationJob.settings?.totalSize && (
          <div className="sa-hint" style={{ margin: 0, padding: '12px 16px' }}>
            Total: {formatSpeed(migrationJob.settings.totalSize)}
            {migrationJob.settings.processedSize ? ` · Uploaded: ${formatSpeed(migrationJob.settings.processedSize)}` : ''}
          </div>
        )}
        {migrationJob.error_message && (
          <div style={{ padding: 16 }}><Note tone="err">{migrationJob.error_message}</Note></div>
        )}
        {running && (
          <div className="st-foot">
            <button type="button" className={btn()} onClick={() => setShowImportDialog(true)}>
              <RefreshCw className="h-3.5 w-3.5" /> View Details
            </button>
            <button type="button" className={btn('danger')} onClick={handleCancelMigration} disabled={cancelling}>
              {cancelling ? <Spinner size={12} /> : null}Cancel Import
            </button>
          </div>
        )}
        {!running && (
          <div className="st-foot">
            <button type="button" className={btn()} onClick={() => setShowImportDialog(true)}>
              <Plus className="h-3.5 w-3.5" /> Import Files
            </button>
          </div>
        )}
      </Panel>
    );
  }

  function renderDeveloperSection() {
    return (
      <>
        <ApiKeyManagement />
        <button type="button" className={btn() + ' block'} onClick={() => navigate('/developer-api')}>
          <Book className="h-4 w-4" />
          API Documentation
        </button>
      </>
    );
  }

  function renderWebhooksSection() {
    return (
      <>
        <WebhookManager open={false} onClose={() => {}} standalone />
        <button type="button" className={btn() + ' block'} onClick={() => navigate('/webhooks')}>
          <Book className="h-4 w-4" />
          Webhook Documentation
        </button>
      </>
    );
  }

  function renderDevicesSection() {
    return <CliDevicesSection />;
  }

  function renderPreferencesSection() {
    return (
      <>
        {preferenceCategories.map((category) => (
          <Panel key={category.id} title={category.title} desc={category.subtitle} flush>
            {category.items.map((item) => (
              <Row key={item.key} label={item.label} desc={item.description}>
                <Switch
                  checked={accountPreferences[item.key]}
                  onCheckedChange={(checked) => updatePreference(item.key, checked)}
                  aria-label={item.label}
                />
              </Row>
            ))}
          </Panel>
        ))}

        <Panel title="Subscription Notifications" desc="Control how and when we remind you about subscription expiry." flush>
          <Row label="Email notifications" desc="Receive expiry reminders via email">
            <Switch checked={notifPrefs.email_enabled} onCheckedChange={(v) => updateNotifPref('email_enabled', v)} aria-label="Email notifications" />
          </Row>
          <Row label="In-app popups" desc="Show expiry warnings inside the app">
            <Switch checked={notifPrefs.popup_enabled} onCheckedChange={(v) => updateNotifPref('popup_enabled', v)} aria-label="In-app popups" />
          </Row>
          <Row label="Warning lead time" desc="How many days before expiry to start warning you">
            <select
              className="st-select"
              value={notifPrefs.warning_lead_days}
              onChange={(e) => updateNotifPref('warning_lead_days', parseInt(e.target.value))}
              aria-label="Warning lead time"
            >
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
            </select>
          </Row>
          <Row label="Do not contact" desc="Stop all win-back emails after cancellation or expiry">
            <Switch checked={notifPrefs.do_not_contact} onCheckedChange={(v) => updateNotifPref('do_not_contact', v)} aria-label="Do not contact" />
          </Row>
        </Panel>

        <Panel danger title="Session" flush>
          <Row label="Sign out" desc="End this session on this device.">
            <button type="button" className={btn('danger', 'sm')} onClick={signOut}>
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </Row>
        </Panel>
      </>
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
      <div style={{ display: 'grid', gap: 16 }}>
        <BYOKSettingsCard className="rounded-xl" />
        <SDESettingsCard className="rounded-xl" />
      </div>
    ),
    preferences: renderPreferencesSection,
    devices: renderDevicesSection,
  };

  const current = SETTINGS_CATEGORIES.find((c) => c.id === activeCategory) ?? SETTINGS_CATEGORIES[0];
  useDocTitle(`${current.label} · Account settings`);

  return (
    <AppShell>
      <style>{ST_CSS}</style>
      <style>{`.vk-dock{display:flex;align-items:center;gap:10px;padding:8px 14px;border-radius:999px;
        border:1px solid rgba(232,231,225,.1);background:linear-gradient(180deg,rgba(30,31,28,.8),rgba(14,15,13,.9));
        margin:0 0 14px auto;width:max-content}
        .vk-dock span{font:400 11px/1 var(--sa-mono);color:var(--sa-mute);letter-spacing:.08em}
        .vk-dock button{padding:6px 14px;border-radius:999px;border:1px solid rgba(232,231,225,.12);
        background:rgba(232,231,225,.08);color:#e8e7e1;cursor:pointer;font-size:11px}
        .vk-dock button:hover{background:rgba(232,231,225,.14)}`}</style>

      <div className="vk-dock">
        <span>VAULT · {vaultState ? 'UNLOCKED' : 'LOCKED'}</span>
        <button onClick={() => vaultState ? (lockVault(), setVaultState(false)) : setVaultOpen(true)}>
          {vaultState ? 'Lock' : 'Unlock'}
        </button>
      </div>
      <VaultUnlockDialog open={vaultOpen} userId={user?.id || ''}
        onClose={() => setVaultOpen(false)}
        onUnlocked={() => setVaultState(true)}
        reason="Your files are encrypted with your vault key. Unlock once to access them." />

      <TopBar
        crumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Account settings' }, { label: current.label }]}
        below={
          <div className="st-bar">
            <UnderlineTabs<SettingsCategory>
              label="Settings sections"
              idPrefix="st-m"
              value={activeCategory}
              onChange={setActiveCategory}
              tabs={SETTINGS_CATEGORIES.map((c) => ({ id: c.id, label: c.label }))}
            />
          </div>
        }
      >
        <span className="hide-sm sa-mono sa-mute" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }} title={user?.email || ''}>{user?.email}</span>
      </TopBar>

      <Wrap>
        <div className="st">
          <nav className="st-nav sa-nav" aria-label="Settings sections">
            {NAV_GROUPS.map((g) => (
              <React.Fragment key={g.label}>
                <div className="sa-nav-h">{g.label}</div>
                {g.ids.map((id) => {
                  const cat = SETTINGS_CATEGORIES.find((c) => c.id === id)!;
                  const Icon = cat.icon;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`sa-nav-i${activeCategory === id ? ' on' : ''}`}
                      aria-current={activeCategory === id ? 'page' : undefined}
                      onClick={() => { setActiveCategory(id); window.scrollTo({ top: 0 }); }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {cat.label}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </nav>

          <div className="st-main sa-in" key={activeCategory}>
            <PageHead eyebrow="Account settings" title={current.label} desc={SECTION_DESC[activeCategory]} />
            <div style={{ display: 'grid', gap: 16 }}>
              {sectionRenderers[activeCategory]()}
            </div>
          </div>
        </div>
      </Wrap>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Passkey?</AlertDialogTitle>
            <AlertDialogDescription>This will disable passkey authentication. You can set up a new passkey anytime.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePasskey} disabled={loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {loading ? <><Spinner size={14} /><span style={{ marginLeft: 8 }}>Removing...</span></> : 'Remove Passkey'}
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
              {mfaLoading ? <><Spinner size={14} /><span style={{ marginLeft: 8 }}>Disabling...</span></> : 'Disable MFA'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};

export default AccountSettings;

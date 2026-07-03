import React, { useState, useEffect } from 'react';
import MobileSheet from '@/components/ui/MobileSheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Share2, Copy, Check, X, UserPlus, Globe, Lock, Users,
  Eye, Download, Mail, Folder, ChevronLeft, Clock,
  TriangleAlert as Flame, MapPin, Smartphone, Droplets, Loader2
} from '@/lib/icon-map';
import { useToast } from '@/hooks/use-toast';
import { useBiometricAuthContext } from '@/contexts/BiometricAuthContext';
import { createFileShare, createFolderShare, revokeFileShare, getFileShareId } from '@/lib/api';
import { buildPublicUrl } from '@/lib/appLinks';
import { encryptData } from '@/lib/encryption';
import { resolveFileKeyForShare } from '@/lib/res54';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface MobileEnhancedShareDialogProps {
  open: boolean;
  onClose: () => void;
  onShareChange?: () => void;
  file: { id: string; name: string; type?: string; };
}

const PRESET_EXPIRY = [
  { label: '1 Hour', value: 1 / 24 },
  { label: '24 Hours', value: 1 },
  { label: '7 Days', value: 7 },
  { label: '30 Days', value: 30 },
  { label: 'Never', value: null },
];

const COUNTRIES = [
  'US', 'GB', 'CA', 'AU', 'DE', 'FR', 'JP', 'BR', 'IN', 'SG',
  'NL', 'SE', 'NO', 'DK', 'FI', 'CH', 'AT', 'BE', 'IE', 'NZ',
];

const haptics = {
  light: () => { if ('vibrate' in navigator) navigator.vibrate(10); },
  selection: () => { if ('vibrate' in navigator) navigator.vibrate(15); },
  success: () => { if ('vibrate' in navigator) { navigator.vibrate(30); setTimeout(() => navigator.vibrate(15), 50); } },
  error: () => { if ('vibrate' in navigator) { navigator.vibrate(50); setTimeout(() => navigator.vibrate(50), 80); } },
};

const MobileEnhancedShareDialog: React.FC<MobileEnhancedShareDialogProps> = ({ open, onClose, onShareChange, file }) => {
  const { toast } = useToast();
  const { verifyOperationNow } = useBiometricAuthContext();
  const isFolder = file.type === 'folder';

  // Wizard step
  const [step, setStep] = useState(1);
  const maxStep = isFolder ? 2 : 3;

  // Share options
  const [shareType, setShareType] = useState<'public' | 'user_specific'>('public');
  const [allowedEmails, setAllowedEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [expiryPreset, setExpiryPreset] = useState<number | null>(null);
  const [customExpiryDate, setCustomExpiryDate] = useState('');
  const [requirePassword, setRequirePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [downloadLimit, setDownloadLimit] = useState(0);
  const [viewOnly, setViewOnly] = useState(false);
  const [requireEmail, setRequireEmail] = useState(false);

  // Advanced
  const [maxViews, setMaxViews] = useState(0);
  const [burnAfterReading, setBurnAfterReading] = useState(false);
  const [allowedCountries, setAllowedCountries] = useState<string[]>([]);
  const [blockedCountries, setBlockedCountries] = useState<string[]>([]);
  const [countrySearch, setCountrySearch] = useState('');
  const [deviceLock, setDeviceLock] = useState(false);
  const [watermarkEmail, setWatermarkEmail] = useState(false);

  // Result
  const [shareLink, setShareLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyResolving, setKeyResolving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isShared, setIsShared] = useState(false);

  useEffect(() => {
    if (!open) return;
    const checkExisting = async () => {
      try {
        const existingShareId = await getFileShareId(file.id);
        if (existingShareId) {
          setIsShared(true);
          setShareLink(buildPublicUrl(`/s/${existingShareId}`));
        }
      } catch {}
    };
    checkExisting();
  }, [open, file]);

  const reset = () => {
    setStep(1);
    setShareType('public'); setAllowedEmails([]); setEmailInput('');
    setExpiryPreset(null); setCustomExpiryDate('');
    setRequirePassword(false); setPassword(''); setDownloadLimit(0);
    setViewOnly(false); setRequireEmail(false);
    setMaxViews(0); setBurnAfterReading(false);
    setAllowedCountries([]); setBlockedCountries([]);
    setCountrySearch(''); setDeviceLock(false); setWatermarkEmail(false);
    setShareLink(''); setCopied(false); setIsShared(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const addEmail = () => {
    const email = emailInput.trim();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      haptics.error(); toast({ title: "Invalid email", variant: "destructive" }); return;
    }
    if (allowedEmails.includes(email)) { haptics.error(); toast({ title: "Already added", variant: "destructive" }); return; }
    setAllowedEmails([...allowedEmails, email]); setEmailInput('');
    haptics.selection();
  };

  const removeEmail = (email: string) => setAllowedEmails(allowedEmails.filter(e => e !== email));

  const getExpiresAt = (): string | null => {
    if (expiryPreset === null) return null;
    if (expiryPreset === -1) return customExpiryDate ? new Date(customExpiryDate).toISOString() : null;
    return new Date(Date.now() + expiryPreset * 24 * 60 * 60 * 1000).toISOString();
  };

  const getDeviceFingerprint = (): string | null => {
    if (!deviceLock) return null;
    const parts = [navigator.userAgent, screen.width, screen.height, screen.colorDepth, navigator.language, new Date().getTimezoneOffset()];
    const raw = parts.join('||');
    let hash = 0;
    for (let i = 0; i < raw.length; i++) { const ch = raw.charCodeAt(i); hash = ((hash << 5) - hash) + ch; hash |= 0; }
    return Math.abs(hash).toString(36);
  };

  const executeCreateShare = async () => {
    if (shareType === 'user_specific' && allowedEmails.length === 0) {
      haptics.error(); toast({ title: "Add at least one email", variant: "destructive" }); return;
    }
    if (requirePassword && !password.trim()) {
      haptics.error(); toast({ title: "Password required", variant: "destructive" }); return;
    }

    setLoading(true); setKeyResolving(true);
    try {
      const expiresAt = getExpiresAt();
      const shareSecretBytes = new Uint8Array(32);
      crypto.getRandomValues(shareSecretBytes);
      const shareSecret = Array.from(shareSecretBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      const hashBuffer = await crypto.subtle.digest('SHA-256', shareSecretBytes);
      const shareSecretHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      let sharedEncryptionKey: string | undefined;
      if (!isFolder) {
        try {
          const { data: fileRow } = await supabase.from('files').select('encryption_key').eq('id', file.id).single();
          if (fileRow?.encryption_key) {
            const rawKey = await resolveFileKeyForShare(file.id, fileRow.encryption_key);
            if (rawKey) sharedEncryptionKey = await encryptData(new TextEncoder().encode(rawKey).buffer, shareSecret.slice(0, 32));
          }
        } catch {}
      }
      setKeyResolving(false);

      const opts = {
        shareType, allowedUsers: shareType === 'user_specific' ? allowedEmails : undefined,
        expiresAt: expiresAt || undefined,
        accessCode: requirePassword ? password : undefined,
        downloadLimit: downloadLimit > 0 ? downloadLimit : undefined,
        viewOnly: viewOnly || undefined, requireEmail: requireEmail || undefined,
        sharedEncryptionKey, shareSecretHash,
        maxViews: maxViews > 0 ? maxViews : undefined,
        maxDownloads: downloadLimit > 0 ? downloadLimit : undefined,
        burnAfterReading: burnAfterReading || undefined,
        allowedCountries: allowedCountries.length > 0 ? allowedCountries : undefined,
        blockedCountries: blockedCountries.length > 0 ? blockedCountries : undefined,
        deviceFingerprint: getDeviceFingerprint() || undefined,
        watermarkEmail: watermarkEmail || undefined,
      };

      let shareId: string, shareUrl: string;
      if (isFolder) {
        const r = await createFolderShare(file.id, opts as any);
        shareId = r.shareId; shareUrl = `${r.shareUrl}#${shareSecret}`;
      } else {
        const r = await createFileShare(file.id, opts as any);
        shareId = r.shareId; shareUrl = `${r.shareUrl}#${shareSecret}`;
      }
      setShareLink(shareUrl); setIsShared(true);
      navigator.clipboard.writeText(shareUrl);
      haptics.success();
      toast({ title: "Share link with secret copied" });
      setStep(maxStep);
      if (onShareChange) onShareChange();
    } catch (error: any) {
      setKeyResolving(false);
      haptics.error();
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleCreateShare = async () => {
    const authorized = await verifyOperationNow('create_share');
    if (!authorized) { toast({ title: "PIN required", variant: "destructive" }); return; }
    await executeCreateShare();
  };

  const handleRevokeShare = async () => {
    const authorized = await verifyOperationNow('revoke_share');
    if (!authorized) { toast({ title: "PIN required", variant: "destructive" }); return; }
    setLoading(true);
    try {
      if (isFolder) {
        await supabase.from('shares').delete().eq('share_id', shareLink.split('/').pop()?.split('#')[0] || '');
      } else {
        await revokeFileShare(file.id);
      }
      setShareLink(''); setIsShared(false);
      haptics.success();
      if (onShareChange) onShareChange();
      toast({ title: "Share revoked" });
    } catch (error: any) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true); haptics.success();
    toast({ title: "Copied" });
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleCountry = (code: string) => {
    if (allowedCountries.includes(code)) { setAllowedCountries(prev => prev.filter(c => c !== code)); return; }
    if (blockedCountries.includes(code)) { setBlockedCountries(prev => prev.filter(c => c !== code)); return; }
    setAllowedCountries(prev => [...prev, code]);
  };

  const toggleBlockCountry = (code: string) => {
    if (blockedCountries.includes(code)) { setBlockedCountries(prev => prev.filter(c => c !== code)); return; }
    if (allowedCountries.includes(code)) { setAllowedCountries(prev => prev.filter(c => c !== code)); }
    setBlockedCountries(prev => [...prev, code]);
  };

  const renderStep = () => {
    if (shareLink && !isShared) {
      // Show create link after share
      setStep(maxStep);
    }

    switch (step) {
      // ── Step 1: Share Type ─────────────────────────────────────────────
      case 1:
        return (
          <div className="px-4 pt-2 pb-6 space-y-4">
            <p className="text-[13px] text-[#768390]">Choose who can access <span className="text-[#E6EDF3] font-medium">{file.name}</span></p>
            <div className="space-y-2">
              {[
                { key: 'public', label: 'Public Link', desc: 'Anyone with the link can access', icon: Globe },
                { key: 'user_specific', label: 'Specific People', desc: 'Only invited emails can access', icon: Users },
              ].map(({ key, label, desc, icon: Icon }) => (
                <button key={key} onClick={() => { setShareType(key as any); haptics.selection(); }}
                  className={cn(
                    'w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left',
                    shareType === key
                      ? 'bg-[#1C2128] border-[#58A6FF]/50'
                      : 'bg-[#161B22] border-[#2D333B] active:bg-[#1C2128]'
                  )}>
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                    shareType === key ? 'bg-[#58A6FF]/20' : 'bg-[#1C2128] border border-[#2D333B]'
                  )}>
                    <Icon className={cn('w-5 h-5', shareType === key ? 'text-[#58A6FF]' : 'text-[#8B949E]')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-medium text-[#E6EDF3]">{label}</div>
                    <div className="text-[12px] text-[#768390] mt-0.5">{desc}</div>
                  </div>
                  <div className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                    shareType === key ? 'border-[#58A6FF] bg-[#58A6FF]' : 'border-[#484F58]'
                  )}>
                    {shareType === key && <Check className="w-3 h-3 text-white" />}
                  </div>
                </button>
              ))}
            </div>

            {shareType === 'user_specific' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input placeholder="email@example.com" value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                    className="flex-1 h-10 rounded-xl bg-[#161B22] border-[#2D333B] text-[#E6EDF3] placeholder:text-[#484F58] text-[14px]" />
                  <Button onClick={addEmail} disabled={!emailInput.trim()}
                    className="h-10 w-10 rounded-xl bg-[#58A6FF] hover:bg-[#58A6FF]/90 p-0">
                    <UserPlus className="w-4 h-4 text-white" />
                  </Button>
                </div>
                {allowedEmails.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {allowedEmails.map(email => (
                      <Badge key={email} className="bg-[#1C2128] border border-[#2D333B] text-[#E6EDF3] gap-1 text-xs py-1">
                        {email}
                        <X className="w-3 h-3 cursor-pointer text-[#8B949E]" onClick={() => removeEmail(email)} />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Button onClick={() => { haptics.selection(); setStep(2); }}
              className="w-full h-12 rounded-2xl bg-[#58A6FF] hover:bg-[#58A6FF]/90 text-white font-semibold text-[15px] mt-2">
              Continue
            </Button>
          </div>
        );

      // ── Step 2: Options ────────────────────────────────────────────────
      case 2:
        return (
          <div className="px-4 pt-2 pb-6 space-y-4 overflow-y-auto max-h-[60vh]">
            {/* Expiry */}
            <div>
              <Label className="text-[13px] font-medium text-[#E6EDF3] flex items-center gap-1.5 mb-2">
                <Clock className="w-3.5 h-3.5 text-[#8B949E]" /> Link Expiry
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_EXPIRY.map(opt => (
                  <button key={String(opt.value)} type="button" onClick={() => { setExpiryPreset(opt.value); haptics.selection(); }}
                    className={cn(
                      'px-3 h-8 rounded-xl text-[12px] font-medium border transition-all',
                      expiryPreset === opt.value
                        ? 'bg-[#58A6FF]/20 text-[#58A6FF] border-[#58A6FF]/40'
                        : 'bg-[#161B22] text-[#8B949E] border-[#2D333B]'
                    )}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {expiryPreset === -1 && (
                <Input type="date" value={customExpiryDate} onChange={e => setCustomExpiryDate(e.target.value)}
                  className="mt-2 h-9 rounded-xl bg-[#161B22] border-[#2D333B] text-[#E6EDF3] text-xs" />
              )}
            </div>

            {/* Password */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#161B22] border border-[#2D333B]">
              <div className="flex items-center gap-3">
                <Lock className="w-4 h-4 text-[#D29922]" />
                <div>
                  <span className="text-[13px] font-medium text-[#E6EDF3]">Password Protection</span>
                  <p className="text-[11px] text-[#768390]">Require a password to open</p>
                </div>
              </div>
              <Switch checked={requirePassword} onCheckedChange={setRequirePassword} />
            </div>
            {requirePassword && (
              <Input type="password" placeholder="Set a password" value={password}
                onChange={e => setPassword(e.target.value)}
                className="h-10 rounded-xl bg-[#161B22] border-[#2D333B] text-[#E6EDF3] placeholder:text-[#484F58]" />
            )}

            {/* Burn after reading */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#161B22] border border-[#2D333B]">
              <div className="flex items-center gap-3">
                <Flame className="w-4 h-4 text-[#D29922]" />
                <div>
                  <span className="text-[13px] font-medium text-[#E6EDF3]">Burn After Reading</span>
                  <p className="text-[11px] text-[#768390]">File self-destructs after first download</p>
                </div>
              </div>
              <Switch checked={burnAfterReading} onCheckedChange={setBurnAfterReading} />
            </div>

            {/* View only + Max views */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#161B22] border border-[#2D333B]">
                <div className="flex items-center justify-between">
                  <Label className="text-[12px] font-medium text-[#E6EDF3]">View Only</Label>
                  <Switch checked={viewOnly} onCheckedChange={setViewOnly} />
                </div>
                <p className="text-[10px] text-[#768390] mt-1.5">Prevent downloads</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#161B22] border border-[#2D333B]">
                <Label className="text-[12px] font-medium text-[#E6EDF3]">Max Views</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Switch checked={maxViews > 0} onCheckedChange={v => setMaxViews(v ? 5 : 0)} />
                  {maxViews > 0 && (
                    <Input type="number" min={1} max={1000} value={maxViews}
                      onChange={e => setMaxViews(Math.max(1, parseInt(e.target.value) || 1))}
                      className="h-7 w-14 rounded-lg bg-[#0D1117] border-[#2D333B] text-[#E6EDF3] text-xs" />
                  )}
                </div>
              </div>
            </div>

            {/* Collect email + Watermark */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#161B22] border border-[#2D333B]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#58A6FF]" />
                    <Label className="text-[12px] font-medium text-[#E6EDF3]">Collect Email</Label>
                  </div>
                  <Switch checked={requireEmail} onCheckedChange={setRequireEmail} />
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#161B22] border border-[#2D333B]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-[#58A6FF]" />
                    <Label className="text-[12px] font-medium text-[#E6EDF3]">Watermark</Label>
                  </div>
                  <Switch checked={watermarkEmail} onCheckedChange={setWatermarkEmail} />
                </div>
              </div>
            </div>

            {/* Download limit */}
            <div className="p-3.5 rounded-2xl bg-[#161B22] border border-[#2D333B]">
              <Label className="text-[12px] font-medium text-[#E6EDF3]">Download Limit</Label>
              <div className="flex items-center gap-2 mt-1.5">
                <Switch checked={downloadLimit > 0} onCheckedChange={v => setDownloadLimit(v ? 3 : 0)} />
                {downloadLimit > 0 && (
                  <Input type="number" min={1} max={1000} value={downloadLimit}
                    onChange={e => setDownloadLimit(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-7 w-14 rounded-lg bg-[#0D1117] border-[#2D333B] text-[#E6EDF3] text-xs" />
                )}
                <span className="text-[11px] text-[#768390]">max downloads</span>
              </div>
            </div>

            {/* Device lock */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#161B22] border border-[#2D333B]">
              <div className="flex items-center gap-3">
                <Smartphone className="w-4 h-4 text-[#BC8CFF]" />
                <div>
                  <span className="text-[13px] font-medium text-[#E6EDF3]">Device Lock</span>
                  <p className="text-[11px] text-[#768390]">Only first device that opens can access</p>
                </div>
              </div>
              <Switch checked={deviceLock} onCheckedChange={setDeviceLock} />
            </div>

            {/* Geo-lock */}
            <div className="p-3.5 rounded-2xl bg-[#161B22] border border-[#2D333B]">
              <Label className="text-[12px] font-medium text-[#E6EDF3] flex items-center gap-1.5 mb-2">
                <MapPin className="w-3.5 h-3.5 text-[#3FB950]" /> Country Access
              </Label>
              <Input placeholder="Search countries..." value={countrySearch}
                onChange={e => setCountrySearch(e.target.value)}
                className="h-8 rounded-xl bg-[#0D1117] border-[#2D333B] text-[#E6EDF3] placeholder:text-[#484F58] text-xs mb-2" />
              <div className="flex gap-1.5 max-h-16 overflow-y-auto flex-wrap">
                {COUNTRIES.filter(c => !countrySearch || c.toLowerCase().includes(countrySearch.toLowerCase())).map(code => {
                  const isAllowed = allowedCountries.includes(code);
                  const isBlocked = blockedCountries.includes(code);
                  return (
                    <button key={code} type="button" onClick={() => toggleCountry(code)}
                      onContextMenu={e => { e.preventDefault(); toggleBlockCountry(code); }}
                      className={cn(
                        'px-2 py-1 rounded-lg text-[10px] font-medium border transition-all',
                        isAllowed ? 'bg-[#3FB950]/20 text-[#3FB950] border-[#3FB950]/30' :
                        isBlocked ? 'bg-[#F85149]/20 text-[#F85149] border-[#F85149]/30' :
                        'bg-transparent text-[#8B949E] border-[#2D333B]'
                      )}>
                      {code}
                    </button>
                  );
                })}
              </div>
              <p className="text-[9px] text-[#484F58] mt-1">Tap to allow, long-press to block</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => { haptics.selection(); setStep(1); }}
                className="flex-1 h-12 rounded-2xl border-[#2D333B] text-[#E6EDF3]">
                Back
              </Button>
              <Button onClick={handleCreateShare} disabled={loading || keyResolving}
                className="flex-1 h-12 rounded-2xl bg-[#58A6FF] hover:bg-[#58A6FF]/90 text-white font-semibold text-[15px]">
                {loading || keyResolving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
                ) : (
                  <><Share2 className="w-4 h-4 mr-2" /> Create Link</>
                )}
              </Button>
            </div>
          </div>
        );

      // ── Step 3: Done ──────────────────────────────────────────────────
      case 3:
        return (
          <div className="px-4 pt-2 pb-6 space-y-4">
            <div className="p-5 rounded-2xl bg-[#3FB950]/10 border border-[#3FB950]/20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#3FB950]/20 flex items-center justify-center mx-auto mb-3">
                <Check className="w-7 h-7 text-[#3FB950]" />
              </div>
              <h3 className="text-[17px] font-semibold text-[#E6EDF3]">Link Created!</h3>
              <p className="text-[12px] text-[#8B949E] mt-1">
                {burnAfterReading ? 'Self-destructs after first download' :
                 isFolder ? 'Anyone can view files in this folder' :
                 'Anyone with this link can view the file'}
              </p>
            </div>

            <div className="flex gap-2">
              <Input value={shareLink} readOnly
                className="flex-1 h-11 rounded-xl bg-[#161B22] border-[#2D333B] text-[#E6EDF3] font-mono text-[12px]" />
              <Button onClick={copyToClipboard} variant="outline"
                className="h-11 w-11 rounded-xl border-[#2D333B] p-0">
                {copied ? <Check className="w-4 h-4 text-[#3FB950]" /> : <Copy className="w-4 h-4 text-[#8B949E]" />}
              </Button>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleRevokeShare} variant="outline" disabled={loading}
                className="flex-1 h-11 rounded-xl border-[#F85149]/40 text-[#F85149] hover:bg-[#F85149]/10">
                Revoke
              </Button>
              <Button onClick={handleClose}
                className="flex-1 h-11 rounded-xl bg-[#58A6FF] hover:bg-[#58A6FF]/90 text-white font-semibold">
                Done
              </Button>
            </div>
          </div>
        );
    }
  };

  const stepTitles = ['Share Type', 'Options', 'Done'];
  const currentStep = shareLink && !isShared ? maxStep : Math.min(step, maxStep);

  return (
    <MobileSheet
      open={open}
      onOpenChange={v => { if (!v) handleClose(); }}
      title={
        <div className="flex items-center gap-2.5 px-1">
          {step > 1 && !shareLink && (
            <button onClick={() => { haptics.selection(); setStep(step - 1); }}
              className="w-8 h-8 rounded-xl bg-[#161B22] border border-[#2D333B] flex items-center justify-center mr-1">
              <ChevronLeft className="w-4 h-4 text-[#8B949E]" />
            </button>
          )}
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center',
            shareLink ? 'bg-[#3FB950]/10' : 'bg-[#58A6FF]/10'
          )}>
            {shareLink ? <Check className="w-4 h-4 text-[#3FB950]" /> : <Share2 className="w-4 h-4 text-[#58A6FF]" />}
          </div>
          <div>
            <span className="text-[16px] font-semibold text-[#E6EDF3]">
              {shareLink ? 'Share Created' : isFolder ? 'Share Folder' : 'Share File'}
            </span>
            <span className="text-[11px] text-[#768390] block -mt-0.5">{stepTitles[currentStep - 1]}</span>
          </div>
        </div>
      }
    >
      <div className="max-h-[80vh] overflow-y-auto scrollbar-thin">
        {/* Step indicator */}
        {!shareLink && step <= 2 && (
          <div className="flex gap-1.5 px-4 pt-1 pb-3">
            {[1, 2].map(s => (
              <div key={s} className={cn(
                'flex-1 h-1 rounded-full transition-colors',
                s <= step ? 'bg-[#58A6FF]' : 'bg-[#2D333B]'
              )} />
            ))}
          </div>
        )}
        {renderStep()}
      </div>
    </MobileSheet>
  );
};

export default MobileEnhancedShareDialog;

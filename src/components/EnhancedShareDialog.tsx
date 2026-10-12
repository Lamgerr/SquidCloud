import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Share2, Copy, Check, X, UserPlus, Globe, Lock, Users, Loader2,
  Eye, Download, Mail, Folder, ChevronDown, ChevronRight, Clock,
  TriangleAlert as Flame, MapPin, Smartphone, Droplets, BarChart3, Shield
} from '@/lib/icon-map';
import { useToast } from '@/hooks/use-toast';
import { useBiometricAuthContext } from '@/contexts/BiometricAuthContext';
import { createFileShare, createFolderShare, revokeFileShare, getFileShareId } from '@/lib/api';
import { buildPublicUrl } from '@/lib/appLinks';
import { encryptData } from '@/lib/encryption';
import { resolveFileKeyForShare } from '@/lib/res54';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileEnhancedShareDialog from './MobileEnhancedShareDialog';

interface EnhancedShareDialogProps {
  open: boolean;
  onClose: () => void;
  onShareChange?: () => void;
  file: { id: string; name: string; type?: string; };
}

const PRESET_EXPIRY = [
  { label: 'Never', value: null },
  { label: '1h', value: 1 / 24 },
  { label: '24h', value: 1 },
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: 'Custom', value: -1 },
];

const COUNTRIES = [
  'US', 'GB', 'CA', 'AU', 'DE', 'FR', 'JP', 'BR', 'IN', 'SG',
  'NL', 'SE', 'NO', 'DK', 'FI', 'CH', 'AT', 'BE', 'IE', 'NZ',
];

export const EnhancedShareDialog: React.FC<EnhancedShareDialogProps> = ({ open, onClose, onShareChange, file }) => {
  const isMobile = useIsMobile();
  if (isMobile) {
    return <MobileEnhancedShareDialog open={open} onClose={onClose} onShareChange={onShareChange} file={file} />;
  }
  return (
    <EnhancedShareDialogDesktop
      open={open}
      onClose={onClose}
      onShareChange={onShareChange}
      file={file}
    />
  );
};

const EnhancedShareDialogDesktop: React.FC<EnhancedShareDialogProps> = ({ open, onClose, onShareChange, file }) => {
  const { toast } = useToast();
  const { verifyOperationNow } = useBiometricAuthContext();

  const [shareType, setShareType] = useState<'public' | 'user_specific'>('public');
  const [allowedEmails, setAllowedEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [expiryPreset, setExpiryPreset] = useState<number | null>(null);
  const [customExpiryDate, setCustomExpiryDate] = useState('');
  const [requirePassword, setRequirePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [downloadLimit, setDownloadLimit] = useState<number>(0);
  const [viewOnly, setViewOnly] = useState(false);
  const [requireEmail, setRequireEmail] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [keyResolving, setKeyResolving] = useState(false);

  // New features state
  const [maxViews, setMaxViews] = useState<number>(0);
  const [burnAfterReading, setBurnAfterReading] = useState(false);
  const [allowedCountries, setAllowedCountries] = useState<string[]>([]);
  const [blockedCountries, setBlockedCountries] = useState<string[]>([]);
  const [countrySearch, setCountrySearch] = useState('');
  const [deviceLock, setDeviceLock] = useState(false);
  const [watermarkEmail, setWatermarkEmail] = useState(false);

  const isFolder = file.type === 'folder';
  const activeTab = 'create';

  useEffect(() => {
    const checkExistingShare = async () => {
      if (!open || !file) return;
      try {
        const existingShareId = await getFileShareId(file.id);
        if (existingShareId) {
          setIsShared(true);
          setShareLink(buildPublicUrl(`/s/${existingShareId}`));
        } else {
          setIsShared(false);
          setShareLink('');
        }
      } catch { setIsShared(false); }
    };
    checkExistingShare();
  }, [open, file]);

  const addEmail = () => {
    const email = emailInput.trim();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Invalid email", description: "Please enter a valid email", variant: "destructive" });
      return;
    }
    if (allowedEmails.includes(email)) {
      toast({ title: "Email already added", variant: "destructive" });
      return;
    }
    setAllowedEmails([...allowedEmails, email]);
    setEmailInput('');
  };

  const removeEmail = (email: string) => setAllowedEmails(allowedEmails.filter(e => e !== email));

  const toggleCountry = (code: string, mode: 'allow' | 'block') => {
    if (mode === 'allow') {
      setAllowedCountries(prev =>
        prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
      );
    } else {
      setBlockedCountries(prev =>
        prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
      );
    }
  };

  const getExpiresAt = (): string | null => {
    if (expiryPreset === null) return null;
    if (expiryPreset === -1) return customExpiryDate ? new Date(customExpiryDate).toISOString() : null;
    const days = expiryPreset;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  };

  const getDeviceFingerprint = (): string | null => {
    if (!deviceLock) return null;
    const parts = [
      navigator.userAgent,
      screen.width, screen.height, screen.colorDepth,
      navigator.language,
      new Date().getTimezoneOffset(),
    ];
    const raw = parts.join('||');
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + ch;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  };

  const executeCreateShare = async () => {
    if (shareType === 'user_specific' && allowedEmails.length === 0) {
      toast({ title: "No users specified", description: "Add at least one email", variant: "destructive" });
      return;
    }
    if (requirePassword && !password.trim()) {
      toast({ title: "Password required", description: "Enter a password", variant: "destructive" });
      return;
    }

    setLoading(true);
    setKeyResolving(true);

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
          const { data: fileRow } = await supabase.from('files')
            .select('encryption_key').eq('id', file.id).single();
          if (fileRow?.encryption_key) {
            const rawKey = await resolveFileKeyForShare(file.id, fileRow.encryption_key);
            if (rawKey) {
              sharedEncryptionKey = await encryptData(
                new TextEncoder().encode(rawKey).buffer,
                shareSecret.slice(0, 32)
              );
            }
          }
        } catch (err) {
          console.warn('Could not wrap encryption key:', err);
        }
      }

      setKeyResolving(false);

      const commonOptions = {
        shareType, allowedUsers: shareType === 'user_specific' ? allowedEmails : undefined,
        expiresAt: expiresAt || undefined,
        accessCode: requirePassword ? password : undefined,
        downloadLimit: downloadLimit > 0 ? downloadLimit : undefined,
        viewOnly: viewOnly || undefined,
        requireEmail: requireEmail || undefined,
        sharedEncryptionKey, shareSecretHash,
        maxViews: maxViews > 0 ? maxViews : undefined,
        maxDownloads: downloadLimit > 0 ? downloadLimit : undefined,
        burnAfterReading: burnAfterReading || undefined,
        allowedCountries: allowedCountries.length > 0 ? allowedCountries : undefined,
        blockedCountries: blockedCountries.length > 0 ? blockedCountries : undefined,
        deviceFingerprint: getDeviceFingerprint() || undefined,
        watermarkEmail: watermarkEmail || undefined,
      };

      let shareId: string;
      let shareUrl: string;

      if (isFolder) {
        const result = await createFolderShare(file.id, commonOptions as any);
        shareId = result.shareId;
        shareUrl = `${result.shareUrl}#${shareSecret}`;
      } else {
        const result = await createFileShare(file.id, commonOptions as any);
        shareId = result.shareId;
        shareUrl = `${result.shareUrl}#${shareSecret}`;
      }

      setShareLink(shareUrl);
      setIsShared(true);
      navigator.clipboard.writeText(shareUrl);
      toast({ title: "Share link with secret copied", description: "The secret key is embedded in the link" });
      if (onShareChange) onShareChange();
    } catch (error: any) {
      setKeyResolving(false);
      toast({ title: "Failed", description: error.message || "An error occurred", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShare = async () => {
    const authorized = await verifyOperationNow('create_share');
    if (!authorized) {
      toast({ title: "PIN required", variant: "destructive" });
      return;
    }
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
      if (onShareChange) onShareChange();
      toast({ title: "Share revoked" });
    } catch (error: any) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast({ title: "Copied" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setShareLink(''); setShareType('public'); setAllowedEmails([]); setEmailInput('');
    setExpiryPreset(null); setCustomExpiryDate(''); setRequirePassword(false); setPassword('');
    setDownloadLimit(0); setViewOnly(false); setRequireEmail(false); setShowAdvanced(false);
    setCopied(false); setMaxViews(0); setBurnAfterReading(false); setAllowedCountries([]);
    setBlockedCountries([]); setCountrySearch(''); setDeviceLock(false); setWatermarkEmail(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden" onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isFolder ? <Folder className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
            {isFolder ? 'Share folder' : 'Share'}
          </DialogTitle>
          <DialogDescription className="truncate">{file.name}</DialogDescription>
        </DialogHeader>

        {!shareLink ? (
          <div className="space-y-3">
            {keyResolving && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 bg-muted/30 rounded-lg">
                <Loader2 className="w-3 h-3 animate-spin" />
                Preparing encryption key...
              </div>
            )}

            {/* Share type toggle */}
            <div className="flex gap-2 p-1 border rounded-lg bg-muted/20">
              {[
                { key: 'public', label: 'Public', icon: Globe },
                { key: 'user_specific', label: 'Specific People', icon: Users },
              ].map(({ key, label, icon: Icon }) => (
                <button key={key} type="button" onClick={() => setShareType(key as any)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${shareType === key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  <Icon className="w-4 h-4" /> {label}
                </button>
              ))}
            </div>

            {shareType === 'user_specific' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Add people</Label>
                <div className="flex gap-2">
                  <Input placeholder="email@example.com" value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                    className="h-8 text-sm flex-1 min-w-0" />
                  <Button onClick={addEmail} size="sm" className="h-8 w-8 p-0" disabled={!emailInput.trim()}>
                    <UserPlus className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {allowedEmails.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {allowedEmails.map(email => (
                      <Badge key={email} variant="secondary" className="gap-1 text-xs py-0">
                        {email}
                        <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => removeEmail(email)} />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Grid: Expiry + Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> Expires</Label>
                <div className="flex flex-wrap gap-1">
                  {PRESET_EXPIRY.map(opt => (
                    <button key={String(opt.value)} type="button"
                      onClick={() => setExpiryPreset(opt.value)}
                      className={`px-2 py-1 rounded-md text-xs font-medium border transition-colors ${expiryPreset === opt.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {expiryPreset === -1 && (
                  <Input type="date" value={customExpiryDate}
                    onChange={e => setCustomExpiryDate(e.target.value)}
                    className="h-8 text-xs mt-1" />
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1"><Lock className="w-3 h-3" /> Password</Label>
                <div className="flex items-center gap-2">
                  <Switch checked={requirePassword} onCheckedChange={setRequirePassword} />
                  <span className="text-xs text-muted-foreground">{requirePassword ? 'On' : 'Off'}</span>
                </div>
                {requirePassword && (
                  <Input type="password" placeholder="Set password" value={password}
                    onChange={e => setPassword(e.target.value)} className="h-8 text-sm mt-1" />
                )}
              </div>
            </div>

            {/* Burn after reading */}
            <div className="flex items-center justify-between p-2.5 border rounded-lg bg-muted/5">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                <div>
                  <span className="text-xs font-medium">Burn after reading</span>
                  <p className="text-[10px] text-muted-foreground">File deleted after first download</p>
                </div>
              </div>
              <Switch checked={burnAfterReading} onCheckedChange={setBurnAfterReading} />
            </div>

            {/* More options */}
            <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              {showAdvanced ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {showAdvanced ? 'Hide options' : 'Advanced options'}
            </button>

            {showAdvanced && (
              <div className="space-y-3 p-3 border rounded-lg bg-muted/10">
                {/* Row 1: Max views + View only */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs font-medium">
                      <Eye className="w-3 h-3" /> Max views
                    </Label>
                    <div className="flex items-center gap-2">
                      <Switch checked={maxViews > 0} onCheckedChange={v => setMaxViews(v ? 5 : 0)} />
                      {maxViews > 0 && (
                        <Input type="number" min={1} max={1000} value={maxViews}
                          onChange={e => setMaxViews(Math.max(1, parseInt(e.target.value) || 1))}
                          className="h-7 w-16 text-xs" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs font-medium">
                      <Eye className="w-3 h-3" /> View only
                    </Label>
                    <div className="flex items-center gap-2">
                      <Switch checked={viewOnly} onCheckedChange={setViewOnly} />
                      <span className="text-xs text-muted-foreground">{viewOnly ? 'No download' : 'Allow download'}</span>
                    </div>
                  </div>
                </div>

                {/* Row 2: Download limit + Collect email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs font-medium">
                      <Download className="w-3 h-3" /> Download limit
                    </Label>
                    <div className="flex items-center gap-2">
                      <Switch checked={downloadLimit > 0} onCheckedChange={v => setDownloadLimit(v ? 3 : 0)} />
                      {downloadLimit > 0 && (
                        <Input type="number" min={1} max={1000} value={downloadLimit}
                          onChange={e => setDownloadLimit(Math.max(1, parseInt(e.target.value) || 1))}
                          className="h-7 w-16 text-xs" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs font-medium">
                      <Mail className="w-3 h-3" /> Collect email
                    </Label>
                    <div className="flex items-center gap-2">
                      <Switch checked={requireEmail} onCheckedChange={setRequireEmail} />
                      <span className="text-xs text-muted-foreground">{requireEmail ? 'Required' : 'Off'}</span>
                    </div>
                  </div>
                </div>

                {/* Watermark delivery */}
                <div className="flex items-center justify-between p-2 rounded-lg border border-border/50">
                  <div className="flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-primary" />
                    <div>
                      <span className="text-xs font-medium">Watermark with email</span>
                      <p className="text-[10px] text-muted-foreground">Stamps recipient email on PDFs & images</p>
                    </div>
                  </div>
                  <Switch checked={watermarkEmail} onCheckedChange={setWatermarkEmail} />
                </div>

                {/* Device lock */}
                <div className="flex items-center justify-between p-2 rounded-lg border border-border/50">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-purple-400" />
                    <div>
                      <span className="text-xs font-medium">Lock to first device</span>
                      <p className="text-[10px] text-muted-foreground">Only the first device that opens can access</p>
                    </div>
                  </div>
                  <Switch checked={deviceLock} onCheckedChange={setDeviceLock} />
                </div>

                {/* Geo-lock */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs font-medium">
                    <MapPin className="w-3 h-3" /> Country access
                  </Label>
                  <div className="flex gap-2">
                    <Input placeholder="Search countries..." value={countrySearch}
                      onChange={e => setCountrySearch(e.target.value)}
                      className="h-7 text-xs flex-1" />
                  </div>
                  <div className="flex gap-2 max-h-20 overflow-y-auto flex-wrap">
                    {COUNTRIES.filter(c => !countrySearch || c.toLowerCase().includes(countrySearch.toLowerCase())).map(code => {
                      const isAllowed = allowedCountries.includes(code);
                      const isBlocked = blockedCountries.includes(code);
                      return (
                        <button key={code} type="button"
                          onClick={() => {
                            if (isAllowed) { setAllowedCountries(prev => prev.filter(c => c !== code)); return; }
                            if (isBlocked) { setBlockedCountries(prev => prev.filter(c => c !== code)); return; }
                            toggleCountry(code, 'allow');
                          }}
                          onContextMenu={e => { e.preventDefault(); toggleCountry(code, isAllowed ? 'block' : 'allow'); }}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${isAllowed ? 'bg-green-500/20 text-green-400 border-green-500/30' : isBlocked ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30'}`}
                          title={isAllowed ? 'Allowed (click to remove, right-click to block)' : isBlocked ? 'Blocked (click to remove)' : 'Click to allow, right-click to block'}>
                          {code}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[9px] text-muted-foreground/60">Click to allow, right-click to block</p>
                </div>
              </div>
            )}

            <Button onClick={handleCreateShare} className="w-full h-9" disabled={loading || keyResolving}>
              {loading || keyResolving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
              ) : (
                <><Share2 className="w-4 h-4 mr-2" /> {isFolder ? 'Share folder' : 'Create share link'}</>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-1">
                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-900 dark:text-green-100">Share link created</span>
              </div>
              <p className="text-xs text-green-700 dark:text-green-300">
                {burnAfterReading ? '⚠️ This link self-destructs after first download.' :
                 isFolder ? 'Anyone with this link can view files in this folder' :
                 'Anyone with this link can view and download this file'}
              </p>
            </div>

            <div className="flex gap-2">
              <Input value={shareLink} readOnly className="font-mono text-xs h-9 flex-1 min-w-0" />
              <Button onClick={copyToClipboard} size="sm" variant="outline" className="h-9 w-9 p-0">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleRevokeShare} variant="destructive" className="flex-1 h-9" disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Revoking...</> : 'Revoke now'}
              </Button>
              <Button onClick={handleClose} variant="outline" className="flex-1 h-9">Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EnhancedShareDialog;

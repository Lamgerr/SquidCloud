import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import {
  Download, Eye, FileText, FileImage, FileVideo, FileAudio,
  File, Folder, Calendar, Lock, AlertCircle, Home, Clock,
  Share2, Copy, Check, Globe, MapPin,
  Smartphone, TriangleAlert as Flame, Shield, Mail, Droplets,
  ChevronLeft, X, Loader2, ShieldAlert
} from '@/lib/icon-map';
import { formatFileSize, cn } from '@/lib/utils';
import { downloadFileWithRes54 } from '@/lib/res54';
import { getFileInfoById, getFolderShareContents, logShareDecryptAttempt, checkShareAccess, logShareView, logShareDownload } from '@/lib/api';
import { decryptData } from '@/lib/encryption';
import { buildPublicUrl } from '@/lib/appLinks';
import EnhancedInstantPreviewModal from '@/components/EnhancedInstantPreviewModal';
import DeepReadReader from '@/components/DeepReadReader';
import { backgroundDownloadService } from '@/services/backgroundDownload';

interface SharedFileData {
  file_id: string; file_name: string; file_type: string;
  file_size: number; file_created_at: string; file_updated_at: string;
  is_encrypted: boolean; storage_path: string; owner_id: string;
  share_created_at?: string; share_expires_at?: string | null;
  share_download_limit?: number; share_download_count?: number;
  share_view_only?: boolean; share_require_email?: boolean;
  shared_encryption_key?: string; is_folder_share?: boolean;
  folder_id?: string; folder_name?: string; is_byok?: boolean;
  file_tags?: any; file_encryption_key?: string;
  isShared: boolean; accessType: 'public' | 'private';
}

interface FolderFileItem {
  file_id: string; file_name: string; file_type: string;
  file_size: number; file_created_at: string; file_updated_at: string;
  is_encrypted: boolean; shared_encryption_key: string;
  storage_path?: string;
}

function getCleanFileName(name: string): string {
  const match = name.match(/^[a-f0-9]+_(.+)/);
  return match ? match[1] : name;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return dateStr; }
}

function getDeviceFingerprint(): string {
  const parts = [navigator.userAgent, screen.width, screen.height, screen.colorDepth, navigator.language, new Date().getTimezoneOffset()];
  const raw = parts.join('||');
  let hash = 0;
  for (let i = 0; i < raw.length; i++) { const ch = raw.charCodeAt(i); hash = ((hash << 5) - hash) + ch; hash |= 0; }
  return Math.abs(hash).toString(36);
}

function canPreview(type: string, name: string) {
  const t = type.toLowerCase(), n = name.toLowerCase();
  if (t.startsWith('image/') || t.startsWith('video/') || t.startsWith('audio/') || t.startsWith('text/') || t.includes('pdf')) return true;
  return ['.txt', '.md', '.json', '.js', '.ts', '.tsx', '.jsx', '.py', '.html', '.css', '.xml', '.yml', '.yaml'].some(e => n.endsWith(e));
}


const SharePage: React.FC = () => {
  const { shareId, id } = useParams<{ shareId?: string; id?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const actualShareId = shareId || id;
  const [fileData, setFileData] = useState<SharedFileData | null>(null);
  const [folderFiles, setFolderFiles] = useState<FolderFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardLoading, setGuardLoading] = useState(true);
  const [loadingFolder, setLoadingFolder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [readingEpubFile, setReadingEpubFile] = useState<any>(null);
  const [shareSecret, setShareSecret] = useState<string | null>(null);
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);

  const [guardChecked, setGuardChecked] = useState(false);
  const [guardBlocked, setGuardBlocked] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [burnNotice, setBurnNotice] = useState(false);
  const [watermarkActive, setWatermarkActive] = useState(false);

  const [byokPromptOpen, setByokPromptOpen] = useState(false);
  const [byokKeyInput, setByokKeyInput] = useState('');
  const [isBYOKFile, setIsBYOKFile] = useState(false);
  const [userCountry, setUserCountry] = useState<string | null>(null);

  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(d => setUserCountry(d.country_code || null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (hash && hash.length === 64) setShareSecret(hash);
    }
  }, []);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); }, []);

  const unwrapKey = useCallback(async (wrappedKey: string, secret: string): Promise<string | null> => {
    try {
      const keyMaterial = secret.slice(0, 32);
      const decrypted = await decryptData(wrappedKey, keyMaterial);
      return new TextDecoder().decode(decrypted);
    } catch { return null; }
  }, []);

  const runGuardCheck = useCallback(async (password?: string) => {
    setGuardLoading(true);
    setGuardBlocked(null);
    setPasswordError('');
    setPasswordInput('');
    try {
      const deviceFp = getDeviceFingerprint();

      const result = await checkShareAccess(actualShareId!, {
        password, country: userCountry || undefined, deviceFingerprint: deviceFp,
      });

      if (!result.allowed) {
        setGuardBlocked(result.reason);
        if (result.reason === 'wrong_password') setPasswordError('Incorrect password');
        if (result.reason === 'expired' || result.reason === 'burned') {
          setError(result.reason === 'expired' ? 'This link has expired.' : 'This file has been burned after reading.');
        }
        setGuardLoading(false);
        return false;
      }

      setBurnNotice(!!result.burn_after_reading);
      setWatermarkActive(!!result.watermark_email);
      logShareView(actualShareId!, userCountry || undefined).catch(() => {});
      setGuardChecked(true);
      setGuardLoading(false);
      return true;
    } catch {
      setGuardLoading(false);
      setGuardBlocked('error');
      return false;
    }
  }, [actualShareId, userCountry]);

  const fetchFileData = useCallback(async () => {
    if (!actualShareId) { setError('Invalid link'); setLoading(false); return; }
    try {
      setLoading(true);
      setError(null);
      const fileInfo = await getFileInfoById(actualShareId);

      if (fileInfo.shared_encryption_key && shareSecret) {
        const key = await unwrapKey(fileInfo.shared_encryption_key, shareSecret);
        if (key) { setResolvedKey(key); await logShareDecryptAttempt(actualShareId, true); }
        else { await logShareDecryptAttempt(actualShareId, false, 'key_unwrap_failed'); }
      }

      if (fileInfo.is_byok) setIsBYOKFile(true);
      setFileData(fileInfo);

      if (fileInfo.is_folder_share) {
        setLoadingFolder(true);
        try { const c = await getFolderShareContents(actualShareId); setFolderFiles(c || []); }
        catch { setFolderFiles([]); }
        finally { setLoadingFolder(false); }
      }

      if (!guardChecked) { await runGuardCheck(); }
    } catch {
      setError('File not found or link expired.');
      setGuardLoading(false);
    } finally {
      setLoading(false);
    }
  }, [actualShareId, shareSecret, unwrapKey, guardChecked, runGuardCheck]);

  useEffect(() => { fetchFileData(); }, [fetchFileData]);

  const handlePasswordSubmit = () => {
    if (!passwordInput.trim()) { setPasswordError('Password required'); return; }
    runGuardCheck(passwordInput.trim());
  };

  const handleEmailSubmit = () => {
    if (!emailInput.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim())) {
      toast({ title: "Valid email required", variant: "destructive" }); return;
    }
    setGuardLoading(true);
    runGuardCheck(passwordInput || undefined);
  };

  const handleDownload = async (targetFileId?: string, targetFileName?: string, targetKey?: string) => {
    const fd = fileData;
    if (!fd) return;
    const fileId = targetFileId || fd.file_id;
    const fileName = targetFileName || fd.file_name;
    const decryptionKey = targetKey || resolvedKey;

    if (fd.share_view_only && !targetFileId) {
      toast({ title: "View only", description: "Downloads disabled.", variant: "destructive" }); return;
    }
    if (isBYOKFile && !byokKeyInput && !resolvedKey) {
      setByokPromptOpen(true); return;
    }

    setDownloading(fileId);
    try {
      const dlResult = await logShareDownload(actualShareId!, {
        password: passwordInput || undefined,
        country: userCountry || undefined,
        deviceFingerprint: getDeviceFingerprint(),
      });

      if (!dlResult?.ok) {
        toast({ title: "Access denied", description: dlResult?.error || "Cannot download", variant: "destructive" });
        setDownloading(null); return;
      }

      const taskId = `download_${fileId}_${Date.now()}`;
      backgroundDownloadService.startTask({ id: taskId, fileName, fileSize: fd.file_size || 0 });
      toast({ title: "Download started" });

      const isSingleFile = fileId === fd.file_id;
      const folderFile = !isSingleFile ? folderFiles.find(f => f.file_id === fileId) : null;

      const blob = await downloadFileWithRes54(fileId, (progress) => {
        backgroundDownloadService.updateProgress(taskId, progress);
      }, {
        decryptionKey: decryptionKey || (folderFile?.shared_encryption_key) || undefined,
        shareId: actualShareId,
        ...(isSingleFile ? {
          fileRecord: { name: fd.file_name, type: fd.file_type, size: fd.file_size, tags: fd.file_tags, encryption_key: fd.file_encryption_key, storage_path: fd.storage_path, created_at: fd.file_created_at, user_id: fd.owner_id },
        } : folderFile ? {
          fileRecord: { name: folderFile.file_name, type: folderFile.file_type, size: folderFile.file_size, storage_path: folderFile.storage_path, created_at: folderFile.file_created_at },
        } : {}),
      });

      const { downloadAndSaveBlob } = await import('../utils/downloadHelper');
      await downloadAndSaveBlob(blob, fileName);
      backgroundDownloadService.completeTask(taskId);
      toast({ title: "Download complete" });

      if (dlResult.burn_after_reading) {
        toast({ title: "File burned", description: "This link has been destroyed after download." });
        setError('This file has been burned after reading.');
      }
    } catch (error: any) {
      backgroundDownloadService.failTask(`download_${fileId}_${Date.now()}`, error.message);
      toast({ title: "Download failed", description: error.message, variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const handleBYOKSubmit = () => {
    if (byokKeyInput.trim()) { setResolvedKey(byokKeyInput.trim()); setByokPromptOpen(false); setIsBYOKFile(false); }
  };

  const fd = fileData;

  // ─── Loading ──────────────────────────────────────────────────────────
  if (loading || guardLoading) {
    return (
      <div className={cn("bg-[#0D1117] flex items-center justify-center", isMobile ? "fixed inset-0 z-50" : "min-h-screen")}
        style={isMobile ? { paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' } : {}}
        key="loading">
        <div className="flex flex-col items-center gap-5">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full bg-[#58A6FF]/10 animate-ping" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-[4px] rounded-full bg-[#58A6FF]/20 animate-pulse" style={{ animationDuration: '1.5s' }} />
            <div className="absolute inset-[8px] rounded-full bg-[#1C2128] border border-[#2D333B] flex items-center justify-center">
              <Lock className="w-6 h-6 text-[#58A6FF]" />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-[14px] text-[#8B949E] animate-pulse" style={{ animationDuration: '1.5s' }}>Opening secure link...</p>
            <p className="text-[11px] text-[#484F58]">Establishing encrypted connection</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Error / Burn ─────────────────────────────────────────────────────
  if (error || !fileData) {
    const isBurn = error?.includes('burned');
    const Icon = isBurn ? Flame : AlertCircle;
    const iconColor = isBurn ? 'text-[#DA3633]' : 'text-[#F85149]';
    const bgColor = isBurn ? 'bg-[#DA3633]/10' : 'bg-[#F85149]/10';
    const title = isBurn ? 'Self-Destructed' : 'File Unavailable';

    return (
      <div className={cn("bg-[#0D1117] flex items-center justify-center", isMobile ? "fixed inset-0 z-50" : "min-h-screen")}
        style={isMobile ? { paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' } : {}}
        key="error">
        <div className="w-full max-w-sm text-center space-y-6 px-6">
          <div className={cn('mx-auto w-20 h-20 rounded-[28px] flex items-center justify-center', bgColor)}>
            <Icon className={cn('w-10 h-10', iconColor)} />
          </div>
          <div className="space-y-2">
            <h2 className={cn("font-semibold text-[#E6EDF3]", isMobile ? 'text-[22px]' : 'text-xl')}>{title}</h2>
            <p className={cn("text-[#8B949E] leading-relaxed", isMobile ? 'text-[14px]' : 'text-sm')}>{error || 'This file is no longer available.'}</p>
            {isBurn && (
              <div className="mt-3 px-4 py-3 rounded-xl bg-[#DA3633]/10 border border-[#DA3633]/30">
                <p className="text-xs text-[#DA3633]">This link has been destroyed after download. Ask the sender to re-share.</p>
              </div>
            )}
          </div>
          <Button variant="outline" onClick={() => navigate('/')}
            className={cn("border-[#2D333B] text-[#E6EDF3] hover:bg-[#1C2128]", isMobile ? 'h-12 rounded-2xl px-8' : '')}>
            <Home className="w-4 h-4 mr-2" /> Go Home
          </Button>
        </div>
      </div>
    );
  }

  // ─── Guard Screens ────────────────────────────────────────────────────
  if (!guardChecked && guardBlocked) {
    const isPassword = guardBlocked === 'wrong_password';
    const isCountry = guardBlocked === 'country_blocked';
    const isDevice = guardBlocked === 'device_mismatch';
    const GuardIcon = isPassword ? Lock : isCountry ? Globe : isDevice ? Smartphone : ShieldAlert;
    const gColor = isPassword ? 'text-[#58A6FF]' : isCountry ? 'text-[#F85149]' : isDevice ? 'text-[#BC8CFF]' : 'text-[#F85149]';
    const gBg = isPassword ? 'bg-[#58A6FF]/10' : isCountry ? 'bg-[#F85149]/10' : isDevice ? 'bg-[#BC8CFF]/10' : 'bg-[#F85149]/10';
    const gTitle = isPassword ? 'Password Required' : isCountry ? 'Region Locked' : isDevice ? 'Device Mismatch' : 'Access Denied';
    const gDesc = isPassword ? 'This file is password protected.' :
      isCountry ? 'The owner restricted access to specific countries.' :
      isDevice ? 'This link is locked to the first device that opened it.' :
      "You don't have access to this file.";

    return (
      <div className={cn("min-h-screen bg-[#0D1117] flex flex-col", isMobile ? "fixed inset-0 z-50" : "items-center justify-center p-6")}
        style={isMobile ? { paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' } : {}}
        key="guard">
        {isMobile && (
          <div className="flex items-center justify-between px-4 h-12 border-b border-[#2D333B]">
            <button onClick={() => navigate('/')} className="w-9 h-9 rounded-xl bg-[#161B22] border border-[#2D333B] flex items-center justify-center text-[#8B949E]">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-[14px] font-medium text-[#768390]">Secure Link</span>
            <div className="w-9" />
          </div>
        )}
        <div className={cn("flex flex-col items-center px-6", isMobile ? "flex-1 justify-center -mt-8" : "w-full max-w-sm text-center space-y-6")}>
          <div className={cn('w-20 h-20 rounded-[28px] flex items-center justify-center mb-5', gBg)}>
            <GuardIcon className={cn('w-10 h-10', gColor)} />
          </div>
          <h1 className={cn("font-bold text-[#E6EDF3] text-center", isMobile ? 'text-[22px]' : 'text-xl')}>{gTitle}</h1>
          <p className={cn("text-[#8B949E] text-center leading-relaxed", isMobile ? 'text-[14px] max-w-xs' : 'text-sm max-w-sm')}>{gDesc}</p>

          {isPassword && (
            <div className={cn("space-y-3", isMobile ? 'w-full max-w-sm mt-6' : 'max-w-xs mx-auto')}>
              <Input type="password" placeholder="Enter password" value={passwordInput}
                onChange={e => { setPasswordInput(e.target.value); setPasswordError(''); }}
                onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
                className={cn(
                  "bg-[#161B22] border-[#2D333B] text-[#E6EDF3] placeholder:text-[#484F58] focus:border-[#58A6FF]/50",
                  isMobile ? 'h-12 text-center text-[16px] rounded-2xl' : 'h-11 text-center text-[15px] rounded-xl'
                )} autoFocus />
              {passwordError && <p className="text-xs text-[#F85149] text-center">{passwordError}</p>}
              <Button onClick={handlePasswordSubmit} disabled={!passwordInput.trim()}
                className={cn("w-full bg-[#58A6FF] hover:bg-[#58A6FF]/90 text-white font-semibold", isMobile ? 'h-12 rounded-2xl text-[15px]' : 'h-11 rounded-xl')}>
                <Lock className="w-4 h-4 mr-2" /> Unlock
              </Button>
            </div>
          )}

          {!isPassword && (
            <Button onClick={() => navigate('/')} variant="outline"
              className={cn("border-[#2D333B] text-[#E6EDF3]", isMobile ? 'mt-6 h-11 px-6 rounded-2xl' : '')}>
              <Home className="w-4 h-4 mr-2" /> Go Home
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!guardChecked) {
    return (
      <div className="min-h-screen bg-[#0D1117] flex items-center justify-center p-6" key="checking">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-5 h-5 text-[#58A6FF] animate-spin" />
          <p className="text-sm text-[#8B949E]">Checking access...</p>
        </div>
      </div>
    );
  }

  // ─── Folder Share ─────────────────────────────────────────────────────
  if (fd!.is_folder_share) {
    const cleanFolder = getCleanFileName(fd!.file_name);
    const inner = (
      <>
        {burnNotice && (
          <div className={cn("flex items-center gap-2.5 bg-[#DA3633]/10 border border-[#DA3633]/30",
            isMobile ? 'mx-4 mt-3 px-4 py-2.5 rounded-2xl' : 'px-4 py-3 rounded-xl')}>
            <Flame className="w-5 h-5 text-[#DA3633] shrink-0" />
            <span className="text-sm text-[#DA3633] font-medium">Self-destructs after first download</span>
          </div>
        )}

        <div className={cn("bg-[#161B22] border border-[#2D333B]", isMobile ? 'mx-4 mt-3 p-4 rounded-2xl' : 'rounded-2xl p-6')}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#1C2128] border border-[#2D333B] flex items-center justify-center shrink-0">
              <Folder className="w-7 h-7 text-[#8B949E]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-[#E6EDF3]">{cleanFolder}</h1>
              <p className="text-sm text-[#768390] mt-1">{folderFiles.length} file{folderFiles.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        {loadingFolder ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 text-[#58A6FF] animate-spin" />
          </div>
        ) : folderFiles.length === 0 ? (
          <div className="text-center py-16">
            <Folder className="w-10 h-10 mx-auto mb-3 text-[#484F58]" />
            <p className="text-sm text-[#768390]">Empty folder</p>
          </div>
        ) : (
          <div className={cn("divide-y divide-[#2D333B]", isMobile ? 'mx-4 space-y-1.5' : 'bg-[#161B22] border border-[#2D333B] rounded-2xl overflow-hidden')}>
            {folderFiles.map((f) => (
              <div key={f.file_id} className={cn("flex items-center gap-3 transition-colors group",
                isMobile ? 'px-4 py-3.5 rounded-2xl bg-[#161B22] border border-[#2D333B]' : 'px-5 py-4 hover:bg-[#1C2128]')}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#E6EDF3] truncate">{getCleanFileName(f.file_name)}</p>
                  <p className="text-xs text-[#768390] mt-0.5">{formatFileSize(f.file_size)}</p>
                </div>
                <button onClick={() => handleDownload(f.file_id, f.file_name, undefined)}
                  disabled={downloading === f.file_id}
                  className={cn("shrink-0 transition-colors",
                    isMobile
                      ? 'h-10 w-10 rounded-xl bg-[#1C2128] border border-[#2D333B] flex items-center justify-center text-[#8B949E] active:bg-[#2D333B]'
                      : 'h-8 px-3 rounded-lg border border-[#2D333B] text-[#8B949E] hover:text-[#E6EDF3] text-sm flex items-center gap-1.5'
                  )}>
                  {downloading === f.file_id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : isMobile ? <Download className="w-4 h-4" /> : <><Download className="w-4 h-4" /> Download</>
                  }
                </button>
              </div>
            ))}
          </div>
        )}
      </>
    );

    if (isMobile) {
      return (
        <div className="fixed inset-0 z-50 bg-[#0D1117] flex flex-col pb-safe overflow-y-auto scrollbar-thin"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          key="mobile-folder">
          <div className="flex items-center px-4 h-12 border-b border-[#2D333B]">
            <button onClick={() => navigate('/')} className="w-9 h-9 rounded-xl bg-[#161B22] border border-[#2D333B] flex items-center justify-center text-[#8B949E]">
              <X className="w-4 h-4" />
            </button>
            <span className="ml-3 text-[15px] font-medium text-[#E6EDF3]">Shared Folder</span>
          </div>
          <div className="flex-1 pb-6">{inner}</div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#0D1117]" key="desktop-folder">
        <div className="max-w-2xl mx-auto px-6 py-10 space-y-4">{inner}</div>
      </div>
    );
  }

  // ─── Single File ──────────────────────────────────────────────────────
  const cleanName = getCleanFileName(fd!.file_name);

  const fileContent = (
    <>
      {/* Notices */}
      {burnNotice && (
        <div className={cn("flex items-center gap-2.5 bg-[#DA3633]/10 border border-[#DA3633]/30",
          isMobile ? 'px-4 py-3 rounded-2xl' : 'px-4 py-3 rounded-xl')}>
          <Flame className="w-5 h-5 text-[#DA3633] shrink-0" />
          <span className="text-sm text-[#DA3633] font-medium">Self-destructs after download</span>
        </div>
      )}
      {watermarkActive && (
        <div className={cn("flex items-center gap-2.5 bg-[#58A6FF]/10 border border-[#58A6FF]/20",
          isMobile ? 'px-4 py-3 rounded-2xl' : 'px-4 py-3 rounded-xl')}>
          <Droplets className="w-5 h-5 text-[#58A6FF] shrink-0" />
          <span className="text-sm text-[#58A6FF] font-medium">Watermarked with your email</span>
        </div>
      )}
      {fd!.share_expires_at && (
        <div className={cn("flex items-center gap-2.5 bg-[#8B949E]/10 border border-[#8B949E]/20",
          isMobile ? 'px-4 py-3 rounded-2xl' : 'px-4 py-3 rounded-xl')}>
          <Calendar className="w-4 h-4 text-[#8B949E] shrink-0" />
          <span className="text-sm text-[#8B949E]">Expires {formatDate(fd!.share_expires_at)}</span>
        </div>
      )}

      {/* File Card */}
      <div className={cn("bg-[#161B22] border border-[#2D333B]", isMobile ? 'p-5 rounded-3xl' : 'p-6 rounded-2xl')}>
        <div className={cn("flex items-start gap-4", isMobile ? '' : 'gap-5')}>
          <div className={cn("rounded-2xl bg-[#1C2128] border border-[#2D333B] flex items-center justify-center shrink-0",
            isMobile ? 'w-16 h-16' : 'w-16 h-16')}>
            <File className="w-8 h-8 text-[#8B949E]" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className={cn("font-semibold text-[#E6EDF3] break-words", isMobile ? 'text-[17px] leading-snug' : 'text-lg')}>{cleanName}</h1>
            <div className={cn("flex items-center gap-2 flex-wrap text-[#768390]", isMobile ? 'mt-1.5' : 'mt-1.5')}>
              <span className={isMobile ? 'text-[12px]' : 'text-sm'}>{formatFileSize(fd!.file_size)}</span>
              {fd!.is_encrypted && (
                <>
                  <span className="text-[#484F58]">·</span>
                  <span className={cn("flex items-center gap-1 text-[#58A6FF]", isMobile ? 'text-[11px]' : 'text-sm')}>
                    <Lock className="w-3.5 h-3.5" /> Encrypted
                  </span>
                </>
              )}
            </div>

            {/* Email collection */}
            {fd!.share_require_email && (
              <div className={cn("bg-[#1C2128] border border-[#2D333B]", isMobile ? 'mt-4 p-4 rounded-2xl' : 'mt-4 p-4 rounded-xl')}>
                <p className={cn("font-medium text-[#E6EDF3] mb-2 flex items-center gap-1.5",
                  isMobile ? 'text-[12px]' : 'text-xs')}>
                  <Mail className="w-3.5 h-3.5 text-[#58A6FF]" /> Email required to download
                </p>
                <div className="flex gap-2">
                  <Input type="email" placeholder="your@email.com" value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleEmailSubmit()}
                    className={cn("flex-1 bg-[#0D1117] border-[#2D333B] text-[#E6EDF3] placeholder:text-[#484F58] focus:border-[#58A6FF]/50",
                      isMobile ? 'h-10 text-[14px] rounded-xl' : 'h-9 text-sm rounded-xl')} />
                  <Button onClick={handleEmailSubmit} disabled={!emailInput.trim()}
                    className={cn("bg-[#58A6FF] hover:bg-[#58A6FF]/90", isMobile ? 'h-10 px-4 rounded-xl' : 'h-9 px-4 rounded-xl')}>
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className={cn("flex gap-3", isMobile ? 'mt-5' : 'mt-5')}>
              {canPreview(fd!.file_type, fd!.file_name) && (
                <Button variant="outline" onClick={() => { if (isBYOKFile && !resolvedKey) { setByokPromptOpen(true); return; } setPreviewOpen(true); }}
                  className={cn("border-[#2D333B] text-[#E6EDF3] hover:bg-[#1C2128]", isMobile ? 'flex-1 h-12 rounded-2xl text-[14px]' : 'flex-1 h-11 rounded-xl')}>
                  <Eye className="w-4 h-4 mr-2" /> Preview
                </Button>
              )}
              <Button onClick={() => handleDownload()} disabled={downloading !== null}
                className={cn(
                  "font-semibold",
                  isMobile ? (canPreview(fd!.file_type, fd!.file_name) ? 'flex-1 h-12 rounded-2xl text-[14px]' : 'w-full h-12 rounded-2xl text-[14px]') : (canPreview(fd!.file_type, fd!.file_name) ? 'flex-1 h-11 rounded-xl' : 'w-full h-11 rounded-xl'),
                  downloading === fd!.file_id
                    ? 'bg-[#58A6FF]/30 text-[#8B949E] cursor-not-allowed'
                    : 'bg-[#58A6FF] hover:bg-[#58A6FF]/90 text-white'
                )}>
                {downloading === fd!.file_id ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Decrypting...</>
                ) : (
                  <><Download className="w-4 h-4 mr-2" /> Download</>
                )}
              </Button>
            </div>
            {fd!.share_view_only && (
              <p className={cn("text-[#8B949E] text-center mt-3", isMobile ? 'text-[11px]' : 'text-xs')}>View only — downloads disabled</p>
            )}
          </div>
        </div>
      </div>

      {/* Properties */}
      <div className={cn("bg-[#161B22] border border-[#2D333B] overflow-hidden divide-y divide-[#2D333B]",
        isMobile ? 'rounded-2xl' : 'rounded-2xl')}>
        {[
          { label: 'Type', value: fd!.file_type },
          { label: 'Size', value: formatFileSize(fd!.file_size) },
          { label: 'Encryption', value: fd!.is_encrypted ? 'AES-256-GCM' : 'None' },
          { label: 'Uploaded', value: formatDate(fd!.file_created_at) || '—' },
          { label: 'Shared', value: fd!.share_created_at ? formatDate(fd!.share_created_at) : '—' },
        ].map((row, i) => (
          <div key={i} className="flex items-center justify-between px-5 py-3.5">
            <span className={cn("text-[#768390]", isMobile ? 'text-[12px]' : 'text-sm')}>{row.label}</span>
            <span className={cn("font-medium text-[#E6EDF3]", isMobile ? 'text-[12px]' : 'text-sm')}>{row.value}</span>
          </div>
        ))}
      </div>
    </>
  );

  // ─── Mobile single file layout ────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0D1117] flex flex-col"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        key="mobile-file">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-[#2D333B]">
          <button onClick={() => navigate('/')} className="w-9 h-9 rounded-xl bg-[#161B22] border border-[#2D333B] flex items-center justify-center text-[#8B949E]">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-[14px] font-medium text-[#768390]">Shared File</span>
          <div className="w-9" />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8 space-y-3 scrollbar-thin">
          {fileContent}
        </div>

        {/* BYOK Bottom Sheet */}
        {byokPromptOpen && (
          <div className="absolute inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => { setByokPromptOpen(false); setByokKeyInput(''); }}>
            <div onClick={e => e.stopPropagation()}
              className="w-full max-w-lg bg-[#161B22] rounded-t-3xl border-t border-[#2D333B] p-6 pb-10 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#58A6FF]/10 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-[#58A6FF]" />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-[#E6EDF3]">Encryption Key Required</h3>
                  <p className="text-[12px] text-[#768390]">Enter the key to unlock this file</p>
                </div>
              </div>
              <Input type="password" placeholder="Encryption key" value={byokKeyInput}
                onChange={e => setByokKeyInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleBYOKSubmit()}
                className="h-11 rounded-xl bg-[#0D1117] border-[#2D333B] text-[#E6EDF3] placeholder:text-[#484F58] focus:border-[#58A6FF]/50" autoFocus />
                <Button onClick={handleBYOKSubmit} disabled={!byokKeyInput.trim()}
                  className="flex-1 h-11 rounded-xl bg-[#58A6FF] hover:bg-[#58A6FF]/90 text-white font-semibold">Unlock</Button>
            </div>
          </div>
        )}

        {/* Preview modal */}
        {previewOpen && fileData && (
          <EnhancedInstantPreviewModal
            file={{
              id: fileData.file_id, name: fileData.file_name, type: fileData.file_type,
              size: fileData.file_size, tags: fileData.file_tags,
              encryption_key: fileData.file_encryption_key, storage_path: fileData.storage_path,
              created_at: fileData.file_created_at, updated_at: fileData.file_updated_at,
              user_id: fileData.owner_id, encrypted: fileData.is_encrypted,
            }}
            isOpen={previewOpen}
            onClose={() => setPreviewOpen(false)}
            onDownload={() => handleDownload()}
            shareId={actualShareId}
            onOpenEpubReader={() => { setPreviewOpen(false); setReadingEpubFile(fileData); }}
          />
        )}
      </div>
    );
  }

  // ─── Desktop single file ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0D1117]" key="desktop-file">
      {byokPromptOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => { setByokPromptOpen(false); setByokKeyInput(''); }}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-sm bg-[#161B22] border border-[#2D333B] rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#58A6FF]/10 flex items-center justify-center">
                <Lock className="w-5 h-5 text-[#58A6FF]" />
              </div>
              <div>
                <h3 className="font-semibold text-[15px] text-[#E6EDF3]">Encryption key required</h3>
                <p className="text-sm text-[#768390]">Enter the key to unlock this file</p>
              </div>
            </div>
            <Input type="password" placeholder="Encryption key" value={byokKeyInput}
              onChange={e => setByokKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleBYOKSubmit()}
              className="h-10 rounded-xl bg-[#0D1117] border-[#2D333B] text-[#E6EDF3] placeholder:text-[#484F58] focus:border-[#58A6FF]/50" autoFocus />
                <Button onClick={handleBYOKSubmit} disabled={!byokKeyInput.trim()}
                  className="flex-1 bg-[#58A6FF] hover:bg-[#58A6FF]/90 text-white font-semibold">Unlock</Button>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-4">
        {fileContent}
      </div>

      {previewOpen && fileData && (
        <EnhancedInstantPreviewModal
          file={{
            id: fileData.file_id, name: fileData.file_name, type: fileData.file_type,
            size: fileData.file_size, tags: fileData.file_tags,
            encryption_key: fileData.file_encryption_key, storage_path: fileData.storage_path,
            created_at: fileData.file_created_at, updated_at: fileData.file_updated_at,
            user_id: fileData.owner_id, encrypted: fileData.is_encrypted,
          }}
          isOpen={previewOpen}
          onClose={() => setPreviewOpen(false)}
          onDownload={() => handleDownload()}
          shareId={actualShareId}
          onOpenEpubReader={() => { setPreviewOpen(false); setReadingEpubFile(fileData); }}
        />
      )}
      {readingEpubFile && (
        <DeepReadReader
          file={{ id: readingEpubFile.file_id, name: readingEpubFile.file_name, type: readingEpubFile.file_type }}
          source="local"
          isOpen={!!readingEpubFile}
          onClose={() => setReadingEpubFile(null)}
        />
      )}
    </div>
  );
};

export default SharePage;

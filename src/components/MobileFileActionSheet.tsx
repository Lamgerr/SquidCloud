import React, { useState, useEffect, useContext } from 'react';
import MobileSheet from '@/components/ui/MobileSheet';
import {
  Download, Share2, Info, Eye, Copy, Move, Edit, Star, Archive, Trash2,
  FileText, Image as ImageIcon, Video, Music, File as FileIcon,
  ExternalLink, Code2, Shield, Undo2, XCircle, Settings, Globe,
} from '@/lib/icon-map';
import { formatFileSize, cn } from '@/lib/utils';
import type { FileItem } from '@/lib/api';
import { getFileShareId, revokeFileShare } from '@/lib/api';
import { buildPublicUrl } from '@/lib/appLinks';
import { FileViewInfoContext } from '@/contexts/FileViewInfoContext';
import { EnhancedShareDialog } from './EnhancedShareDialog';
import ShareManagementDialog from './ShareManagementDialog';
import MobileFileInfoSheet from './MobileFileInfoSheet';
import MobileMoveToFolderSheet from './MobileMoveToFolderSheet';
import { usePublishState } from '@/hooks/usePublish';
import { PublishWebsiteModal } from './publish/PublishWebsiteModal';
import { useNavigate } from 'react-router-dom';

interface MobileFileActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileItem | null;
  onView?: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  onInfo?: () => void;
  onCopy?: () => void;
  onMove?: () => void;
  onRename?: () => void;
  onFavorite?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onOpenInCbCode?: () => void;
  onExtract?: () => void;
  onMoveToVault?: () => void;
  onRemoveFromVault?: () => void;
  onRevokeShare?: () => void;
  onManageShares?: () => void;
  showVaultActions?: boolean;
  isFavorited?: boolean;
  isEncrypted?: boolean;
  isShared?: boolean;
  isArchive?: boolean;
  onShareChange?: (fileId: string) => void;
  onShareRevoked?: (fileId: string) => void;
}

const getFileIcon = (fileType: string) => {
  if (fileType?.startsWith('image/')) return ImageIcon;
  if (fileType?.startsWith('video/')) return Video;
  if (fileType?.startsWith('audio/')) return Music;
  if (fileType?.startsWith('text/')) return FileText;
  return FileIcon;
};

const MobileFileActionSheet: React.FC<MobileFileActionSheetProps> = ({
  isOpen, onClose, file, onView, onDownload, onShare, onInfo, onCopy,
  onMove, onRename, onFavorite, onArchive, onDelete,
  onOpenInCbCode, onExtract, onMoveToVault, onRemoveFromVault,
  onRevokeShare, onManageShares,
  showVaultActions = false,
  isFavorited = false, isEncrypted = false, isShared: propIsShared = false, isArchive = false,
  onShareChange, onShareRevoked,
}) => {
  const [localIsShared, setLocalIsShared] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showEnhancedShareDialog, setShowEnhancedShareDialog] = useState(false);
  const [showInfoSheet, setShowInfoSheet] = useState(false);
  const [showMoveSheet, setShowMoveSheet] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const { publication: pubStatus } = usePublishState(!publishModalOpen && isOpen ? file?.id || null : null);
  const navigate = useNavigate();
  const contextOnViewInfo = useContext(FileViewInfoContext);
  const isShared = propIsShared || localIsShared;

  useEffect(() => {
    if (!isOpen || !file) return;
    const checkShareStatus = async () => {
      try {
        const shareId = await getFileShareId(file.id);
        if (shareId) {
          setLocalIsShared(true);
          setShareUrl(buildPublicUrl(`/s/${shareId}`));
        } else {
          setLocalIsShared(false);
          setShareUrl(null);
        }
      } catch {
        setLocalIsShared(false);
        setShareUrl(null);
      }
    };
    checkShareStatus();
  }, [isOpen, file]);

  if (!file) return null;

  const FileIconComponent = getFileIcon(file.type);
  const isHtmlFile = /\.html?$/i.test(file.name);

  const handleAction = (action: (() => void) | undefined) => {
    if (!action) return;
    setTimeout(() => {
      action();
    }, 50);
  };

  const handleCopyLink = () => {
    const url = buildPublicUrl(`/file/${file.id}`);
    navigator.clipboard.writeText(url).catch(() => {});
    if ('vibrate' in navigator) navigator.vibrate(30);
    onClose();
  };

  const handleOpenInNewTab = () => {
    window.open(`/file/${file.id}`, '_blank');
    if ('vibrate' in navigator) navigator.vibrate(30);
    onClose();
  };

  const handleShareClick = () => {
    onClose();
    if (isShared) {
      setShowShareDialog(true);
    } else {
      setShowEnhancedShareDialog(true);
    }
  };

  const handleRevokeShare = async () => {
    if (loading) return;
    try {
      setLoading(true);
      const success = await revokeFileShare(file.id);
      if (success) {
        setLocalIsShared(false);
        setShareUrl(null);
        onShareRevoked?.(file.id);
      } else {
        throw new Error("Failed to revoke share");
      }
    } catch (error: any) {
      console.error('Failed to revoke share:', error);
    } finally {
      setLoading(false);
    }
  };

  const Row: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; onClick?: () => void; destructive?: boolean }> = ({ icon: Icon, label, onClick, destructive }) => (
    <button
      onClick={() => {
        if ('vibrate' in navigator) navigator.vibrate(30);
        if (onClick === onDelete) {
          handleAction(onClick);
        } else {
          onClose();
          handleAction(onClick);
        }
      }}
      className={cn(
        'flex items-center gap-3 w-full px-3 py-3 rounded-xl text-[15px] font-normal transition-colors duration-80 text-left active:bg-accent',
        destructive ? 'text-destructive' : 'text-foreground hover:bg-accent'
      )}
    >
      <Icon className={cn('w-[18px] h-[18px] shrink-0', destructive ? 'text-destructive' : 'text-muted-foreground')} />
      <span className="flex-1 truncate">{label}</span>
    </button>
  );

  return (
    <>
    <MobileSheet open={isOpen} onOpenChange={onClose}
      title={
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-[10px] bg-muted/60 border border-border flex items-center justify-center shrink-0">
            <FileIconComponent className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-medium text-foreground truncate">{file.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[12px] text-muted-foreground">{formatFileSize(file.size || 0)}</span>
              {isEncrypted && <span className="text-[12px] text-primary">· Encrypted</span>}
            </div>
          </div>
        </div>
      }
    >
      <div className="px-2 pb-2 space-y-0.5">
        {onView && <Row icon={Eye} label="Preview" onClick={onView} />}
        {onDownload && <Row icon={Download} label="Download" onClick={onDownload} />}
        {isHtmlFile && <Row icon={Globe} label={pubStatus?.status === 'live' ? 'Manage Published Site' : 'Publish as Website'} onClick={() => { onClose(); setTimeout(() => setPublishModalOpen(true), 50); }} />}
        <Row icon={Share2} label={isShared ? 'Manage Share' : 'Share'} onClick={handleShareClick} />
        {isShared && (
          <Row icon={XCircle} label="Revoke Share" onClick={handleRevokeShare} />
        )}
        {isShared && (
          <Row icon={Settings} label="Manage All Shares" onClick={() => { onClose(); navigate('/manage/shares'); }} />
        )}
        <Row icon={Copy} label="Copy Link" onClick={handleCopyLink} />
        <Row icon={ExternalLink} label="Open in New Tab" onClick={handleOpenInNewTab} />
        {onOpenInCbCode && <Row icon={Code2} label="Open in cbCode" onClick={onOpenInCbCode} />}
        {isArchive && onExtract && <Row icon={Archive} label="Extract Archive" onClick={onExtract} />}
        {onCopy && <Row icon={Copy} label="Make a copy" onClick={onCopy} />}
        <Row icon={Move} label="Move" onClick={() => { onClose(); setTimeout(() => setShowMoveSheet(true), 50); }} />
        {onRename && <Row icon={Edit} label="Rename" onClick={onRename} />}
        {onFavorite && <Row icon={Star} label={isFavorited ? 'Remove favorite' : 'Add favorite'} onClick={onFavorite} />}
        {onArchive && <Row icon={Archive} label="Archive" onClick={onArchive} />}
        <Row icon={Info} label="Details" onClick={() => { onClose(); setTimeout(() => setShowInfoSheet(true), 50); }} />
        {showVaultActions && onRemoveFromVault && (
          <Row icon={Undo2} label="Remove from Vault" onClick={onRemoveFromVault} />
        )}
        {!showVaultActions && onMoveToVault && (
          <Row icon={Shield} label="Move to Vault" onClick={onMoveToVault} />
        )}
        {onDelete && (
          <>
            <div className="h-px bg-border my-1.5" />
            <Row icon={Trash2} label="Delete" onClick={onDelete} destructive />
          </>
        )}
      </div>
    </MobileSheet>

    <ShareManagementDialog
      open={showShareDialog}
      onOpenChange={setShowShareDialog}
    />

    <EnhancedShareDialog
      open={showEnhancedShareDialog}
      onClose={() => setShowEnhancedShareDialog(false)}
      onShareChange={() => onShareChange?.(file.id)}
      file={file}
    />

    <MobileFileInfoSheet
      open={showInfoSheet}
      onClose={() => setShowInfoSheet(false)}
      file={file}
    />

    <MobileMoveToFolderSheet
      open={showMoveSheet}
      onClose={() => setShowMoveSheet(false)}
      fileIds={[file.id]}
      onMoved={() => {
        setShowMoveSheet(false);
      }}
    />

    <PublishWebsiteModal
      open={publishModalOpen}
      onOpenChange={setPublishModalOpen}
      resourceId={file.id}
      resourceType="file"
      resourceName={file.name}
    />
    </>
  );
};

export default MobileFileActionSheet;

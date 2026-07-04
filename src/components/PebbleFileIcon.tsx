import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { 
  FileText, Terminal, Package, Disc, FileCode, 
  Image as ImageIcon, Video, Music, Archive, Folder as FolderIcon,
  Database, Shield
} from '@/lib/icon-map';

interface PebbleFileIconProps {
  fileName: string;
  isFolder?: boolean;
  mimeType?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const PebbleFileIcon: React.FC<PebbleFileIconProps> = ({
  fileName,
  isFolder = false,
  mimeType = '',
  size = 'md',
  className
}) => {
  const ext = useMemo(() => {
    const parts = fileName.toLowerCase().split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }, [fileName]);

  const dimensions = {
    sm: { card: 'w-10 h-12', fold: 'border-t-[10px] border-r-[10px]', icon: 'w-5 h-5', badge: 'text-[8px] px-1' },
    md: { card: 'w-14 h-16', fold: 'border-t-[14px] border-r-[14px]', icon: 'w-7 h-7', badge: 'text-[9px] px-1.5' },
    lg: { card: 'w-20 h-24', fold: 'border-t-[18px] border-r-[18px]', icon: 'w-10 h-10', badge: 'text-[10px] px-2' },
  }[size];

  // ── 1. PEBBLE BLUE FOLDER (Classic XFCE Tabbed Look) ──
  if (isFolder) {
    return (
      <div className={cn("relative flex flex-col items-center justify-center select-none group", className)}>
        <div className={cn(
          "relative rounded-xl bg-gradient-to-b from-[#4ea0ea] via-[#2f83d7] to-[#1d6ac3] shadow-lg border border-[#6bb8ff]/40 flex items-center justify-center transition-transform group-hover:-translate-y-0.5",
          size === 'sm' ? 'w-11 h-9' : size === 'md' ? 'w-16 h-12' : 'w-24 h-18'
        )}>
          {/* Top Folder Tab */}
          <div className="absolute -top-1.5 left-1.5 w-2/5 h-2.5 bg-gradient-to-t from-[#4ea0ea] to-[#68b3f9] rounded-t-md border-t border-l border-[#8aceff]/50" />
          {/* Inner Folder Line Accent */}
          <div className="w-4/5 h-[1px] bg-white/20 absolute top-2 rounded-full" />
        </div>
      </div>
    );
  }

  // ── 2. XFCE4 PEBBLE DOCUMENT BASE SHEET (Dog-Eared Paper Look) ──
  return (
    <div className={cn(
      "relative flex flex-col items-center justify-center bg-gradient-to-b from-[#f8fafc] to-[#e2e8f0] rounded-lg shadow-md border border-slate-300/80 select-none group transition-all duration-150 group-hover:-translate-y-0.5 group-hover:shadow-lg",
      dimensions.card,
      className
    )}>
      {/* Top-Right Dog-Ear Fold */}
      <div className={cn(
        "absolute top-0 right-0 w-0 h-0 border-t-transparent border-r-slate-400/80 drop-shadow-[1px_1px_1px_rgba(0,0,0,0.15)]",
        dimensions.fold
      )} />
      <div className={cn(
        "absolute top-0 right-0 w-0 h-0 border-t-slate-800/20 border-r-transparent",
        dimensions.fold
      )} />

      {/* ── EMBLEM BADGES (XFCE Type Overlays) ── */}
      <div className="flex flex-col items-center justify-center z-10 w-full px-1">
        
        {/* Python / Wheels / Packages */}
        {['whl', 'deb', 'rpm', 'tar', 'gz', 'zip'].includes(ext) && (
          <>
            <Package className={cn("text-[#b45309] drop-shadow-sm", dimensions.icon)} />
            <span className={cn("mt-1 font-mono font-extrabold bg-[#fef3c7] text-[#92400e] border border-[#fde68a] rounded shadow-2xs", dimensions.badge)}>
              {ext === 'whl' ? 'WHEEL' : ext.toUpperCase()}
            </span>
          </>
        )}

        {/* VM Images / Optical Media */}
        {['iso', 'qcow2', 'img', 'vmdk'].includes(ext) && (
          <>
            <Disc className={cn("text-[#0369a1] animate-spin-slow drop-shadow-sm", dimensions.icon)} />
            <span className={cn("mt-1 font-mono font-extrabold bg-[#e0f2fe] text-[#075985] border border-[#bae6fd] rounded shadow-2xs", dimensions.badge)}>
              {ext.toUpperCase()}
            </span>
          </>
        )}

        {/* Markdown Sheets */}
        {['md', 'markdown'].includes(ext) && (
          <>
            <FileText className={cn("text-[#334155] drop-shadow-sm", dimensions.icon)} />
            <span className={cn("mt-1 font-mono font-black bg-[#dbeafe] text-[#1e40af] border border-[#bfdbfe] rounded shadow-2xs", dimensions.badge)}>
              M↓
            </span>
          </>
        )}

        {/* Shell Scripts / Executables */}
        {['sh', 'bash', 'bin', 'py'].includes(ext) && (
          <>
            <Terminal className={cn("text-[#15803d] drop-shadow-sm", dimensions.icon)} />
            <span className={cn("mt-1 font-mono font-extrabold bg-[#dcfce7] text-[#166534] border border-[#bbf7d0] rounded shadow-2xs", dimensions.badge)}>
              {ext === 'py' ? 'PY' : '>_'}
            </span>
          </>
        )}

        {/* Generic Code / Patches */}
        {['patch', 'diff', 'json', 'js', 'ts', 'tsx'].includes(ext) && (
          <>
            <FileCode className={cn("text-[#6d28d9] drop-shadow-sm", dimensions.icon)} />
            <span className={cn("mt-1 font-mono font-extrabold bg-[#f3e8ff] text-[#6b21a8] border border-[#e9d5ff] rounded shadow-2xs", dimensions.badge)}>
              {ext === 'patch' ? 'PATCH' : ext.toUpperCase()}
            </span>
          </>
        )}

        {/* Default / Media Fallback */}
        {!['whl', 'deb', 'rpm', 'tar', 'gz', 'zip', 'iso', 'qcow2', 'img', 'vmdk', 'md', 'markdown', 'sh', 'bash', 'bin', 'py', 'patch', 'diff', 'json', 'js', 'ts', 'tsx'].includes(ext) && (
          <>
            {mimeType.startsWith('video/') || ['mp4', 'mkv', 'avi'].includes(ext) ? (
              <Video className={cn("text-[#e11d48] drop-shadow-sm", dimensions.icon)} />
            ) : mimeType.startsWith('image/') || ['png', 'jpg', 'svg'].includes(ext) ? (
              <ImageIcon className={cn("text-[#0284c7] drop-shadow-sm", dimensions.icon)} />
            ) : (
              <FileText className={cn("text-[#64748b] drop-shadow-sm", dimensions.icon)} />
            )}

            {ext && (
              <span className={cn("mt-1 font-mono font-bold bg-[#f1f5f9] text-[#475569] border border-[#cbd5e1] rounded truncate max-w-[90%]", dimensions.badge)}>
                {ext.toUpperCase()}
              </span>
            )}
          </>
        )}

      </div>
    </div>
  );
};

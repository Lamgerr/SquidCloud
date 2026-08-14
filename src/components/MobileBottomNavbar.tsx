import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  BarChart3,
  Folder,
  Plus,
  User,
  Users,
  FileStack,
  Upload,
  Download,
  Home,
  X,
  Link,
} from '@/lib/icon-map';
import { cn } from '@/lib/utils';
import { BottomSheet, BottomSheetContent } from '@/components/ui/bottom-sheet';
import CreateItemDialog from '@/components/CreateItemDialog';
import UrlUploadModal from '@/components/UrlUploadModal';
import { useCreateItem } from '@/hooks/use-create-item';
import type { CreateFileType } from '@/hooks/use-create-item';

// Import background services to read progress directly
import { backgroundUploadService, UploadTask } from '@/services/backgroundUpload';
import { backgroundDownloadService, DownloadTask } from '@/services/backgroundDownload';

interface MobileBottomNavbarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onUploadClick?: () => void;
  createDisabled?: boolean;
  onCreateDisabled?: () => void;
  className?: string;
  currentPath?: string;
  onFileCreated?: () => void;
}

const navItems = [
  { id: 'files', label: 'Files', icon: FileStack },
  { id: 'shared', label: 'Shared', icon: Users },
  { id: 'analytics', label: 'Activity', icon: BarChart3 },
  { id: 'account', label: 'Account', icon: User },
];

const MobileBottomNavbar: React.FC<MobileBottomNavbarProps> = ({
  activeTab,
  onTabChange,
  onUploadClick,
  createDisabled = false,
  onCreateDisabled,
  className,
  currentPath = '',
  onFileCreated,
}) => {
  const haptic = (duration: number = 10) => {
    if ('vibrate' in navigator) navigator.vibrate(duration);
  };

  // Instantly scroll the active scroll container(s) to the very top.
  const scrollToTopInstant = () => {
    const containers = document.querySelectorAll<HTMLElement>('[data-scroll-container="true"]');
    containers.forEach(el => el.scrollTo({ top: 0, behavior: 'auto' }));
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  // Detect a fast double-tap on a nav icon: second tap within 300ms
  // jumps the view to the top instead of running the single-tap action.
  const lastTapRef = useRef<{ id: string; t: number }>({ id: '', t: 0 });

  const activate = (id: string, single: () => void) => {
    const now = Date.now();
    if (lastTapRef.current.id === id && now - lastTapRef.current.t < 300) {
      lastTapRef.current = { id: '', t: 0 };
      scrollToTopInstant();
      haptic(15);
      return;
    }
    lastTapRef.current = { id, t: now };
    single();
  };
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [urlUploadOpen, setUrlUploadOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const prevTabRef = useRef(activeTab);

  // --- Morphing & Scroll State ---
  const [isScrolledDown, setIsScrolledDown] = useState(false);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>([]);

  useEffect(() => {
    setMounted(true);
    
    // Highly sensitive scroll detection for instant morphing
    let lastY = window.scrollY;
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY > lastY + 2) { 
        setIsScrolledDown(true); 
      } else if (currentY < lastY - 2 || currentY < 10) { 
        setIsScrolledDown(false); 
      }
      lastY = currentY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Subscribe to background tasks
    const unsubsUpload = backgroundUploadService.subscribe(setUploadTasks);
    const unsubsDownload = backgroundDownloadService.subscribe(setDownloadTasks);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      unsubsUpload();
      unsubsDownload();
    };
  }, []);

  // Calculate active stats for the morphed pill
  const activeUploads = uploadTasks.filter(t => t.status === 'uploading' || t.status === 'pending');
  const isUploading = activeUploads.length > 0;
  const uploadProgress = isUploading ? activeUploads.reduce((acc, t) => acc + t.progress, 0) / activeUploads.length : 0;

  const activeDownloads = downloadTasks.filter(t => t.status === 'downloading');
  const isDownloading = activeDownloads.length > 0;
  const downloadProgress = isDownloading ? activeDownloads.reduce((acc, t) => acc + t.progress, 0) / activeDownloads.length : 0;

  // Determine if we should show the morphed layout
  const isMorphed = isScrolledDown && (isUploading || isDownloading);

  const {
    fileTypes, dialogOpen, setDialogOpen, fileName, setFileName,
    createMode, creating, openFileDialog, openFolderDialog, submit,
  } = useCreateItem({ currentPath, onItemCreated: onFileCreated });

  const quickFileTypes = useMemo<CreateFileType[]>(() => fileTypes.slice(0, 4), [fileTypes]);

  const handleTabClick = (tabId: string) => {
    if (tabId === 'account') {
      haptic(10);
      window.location.href = '/settings/account';
      return;
    }
    if (tabId === 'home') {
      haptic(10);
      window.location.href = '/';
      return;
    }
    prevTabRef.current = activeTab;
    onTabChange(tabId);
    haptic(10);
  };

  const handleUploadClick = () => {
    haptic(12);
    if (createDisabled) { onCreateDisabled?.(); return; }
    if (onUploadClick) { onUploadClick(); return; }
    const btn = document.querySelector('button[data-upload-trigger="dashboard-header-upload"]') as HTMLButtonElement | null;
    if (btn) { btn.click(); return; }
    const input = document.querySelector('input[data-upload-target="dashboard-header-upload"]') as HTMLInputElement | null;
    input?.click();
  };

  const handleSelectOption = (callback: (type?: CreateFileType) => void, type?: CreateFileType) => {
    if (createDisabled) { onCreateDisabled?.(); return; }
    setCreateSheetOpen(false);
    type ? callback(type) : callback();
  };

  const navMid = Math.ceil(navItems.length / 2);

  return (
    <>
      <div 
        className={cn(
          'fixed bottom-6 inset-x-0 z-50 flex justify-center pointer-events-none px-4', 
          className
        )}
      >
        <div
          className={cn(
            'pointer-events-auto flex items-center justify-center p-1.5 overflow-hidden',
            'rounded-full bg-background/85 backdrop-blur-2xl border border-border/40',
            'shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)]',
            'transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]',
            mounted ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-12 opacity-0 scale-95',
            isMorphed ? 'w-full max-w-[340px] gap-2' : 'w-full max-w-md gap-1'
          )}
        >
          {/* ═══ STANDARD NAV (Left Side) OR MORPHED HOME ═══ */}
          <div className={cn("flex items-center transition-all duration-400", isMorphed ? "w-0 opacity-0 hidden" : "opacity-100")}>
            {navItems.slice(0, navMid).map((item) => (
              <button
                key={item.id}
                onClick={() => item.id === 'files' ? activate('files', () => handleTabClick('files')) : handleTabClick(item.id)}
                className={cn(
                  'relative flex items-center justify-center gap-2 rounded-full transition-all duration-300',
                  activeTab === item.id ? 'bg-foreground/10 text-foreground px-4 h-12' : 'w-12 h-12 text-muted-foreground/60 hover:text-foreground/80'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" strokeWidth={activeTab === item.id ? 2.5 : 2} />
                {activeTab === item.id && <span className="text-sm font-semibold tracking-tight">{item.label}</span>}
              </button>
            ))}
          </div>

          {/* Morphed Home Button (Only visible when merged) */}
          <button 
            onClick={() => activate('home', () => { haptic(10); if (window.location.pathname !== '/') window.location.href = '/'; })}
            className={cn(
              "flex items-center justify-center rounded-full shrink-0 transition-all duration-400",
              isMorphed ? "w-11 h-11 bg-muted/40 text-foreground hover:bg-muted/60 opacity-100" : "hidden"
            )}
          >
             <Home className="w-5 h-5 shrink-0" strokeWidth={2} />
          </button>

          {/* ═══ STANDARD CREATE BUTTON ═══ */}
          <div className={cn("px-1 transition-all duration-400", isMorphed ? "w-0 opacity-0 hidden" : "opacity-100")}>
            <button
              onClick={() => { 
                if (createDisabled) { 
                  onCreateDisabled?.(); 
                } else {
                  setCreateSheetOpen(true); 
                  haptic(10); 
                }
              }}
              className={cn(
                'relative flex items-center justify-center h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-all',
                createDisabled && 'opacity-60 cursor-not-allowed active:scale-100'
              )}
            >
              <Plus className="h-6 w-6" strokeWidth={2.5} />
            </button>
          </div>

          {/* ═══ MORPHED PROGRESS PILL ═══ */}
          <div 
            className={cn(
              "flex items-center justify-between rounded-full bg-muted/30 transition-all duration-400 overflow-hidden",
              isMorphed ? "flex-1 h-11 px-3 opacity-100" : "hidden"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="relative flex-shrink-0 w-6 h-6 flex items-center justify-center">
                <svg className="w-6 h-6 -rotate-90 absolute inset-0" viewBox="0 0 36 36">
                  <circle className="text-foreground/10" strokeWidth="4" stroke="currentColor" fill="none" r="14" cx="18" cy="18" />
                  <circle 
                    className={cn("transition-all duration-300", isUploading ? "text-blue-500" : "text-emerald-500")} 
                    strokeWidth="4" strokeDasharray={`${isUploading ? uploadProgress : downloadProgress}, 100`} strokeLinecap="round" stroke="currentColor" fill="none" r="14" cx="18" cy="18" 
                  />
                </svg>
                {isUploading ? <Upload className="w-2.5 h-2.5 text-blue-500" /> : <Download className="w-2.5 h-2.5 text-emerald-500" />}
              </div>
              <span className="text-xs font-semibold text-foreground truncate">
                {isUploading ? `Uploading ${Math.round(uploadProgress)}%` : `Downloading ${Math.round(downloadProgress)}%`}
              </span>
            </div>
            
            <button 
              onClick={(e) => { e.stopPropagation(); isUploading ? backgroundUploadService.clearCompleted() : backgroundDownloadService.clearCompleted(); }} 
              className="w-6 h-6 rounded-full bg-foreground/10 hover:bg-foreground/20 flex items-center justify-center shrink-0 transition-colors"
            >
              <X className="w-3 h-3 text-foreground/70" />
            </button>
          </div>

          {/* ═══ STANDARD NAV (Right Side) ═══ */}
          <div className={cn("flex items-center transition-all duration-400", isMorphed ? "w-0 opacity-0 hidden" : "opacity-100")}>
            {navItems.slice(navMid).map((item) => (
              <button
                key={item.id}
                onClick={() => item.id === 'files' ? activate('files', () => handleTabClick('files')) : handleTabClick(item.id)}
                className={cn(
                  'relative flex items-center justify-center gap-2 rounded-full transition-all duration-300',
                  activeTab === item.id ? 'bg-foreground/10 text-foreground px-4 h-12' : 'w-12 h-12 text-muted-foreground/60 hover:text-foreground/80'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" strokeWidth={activeTab === item.id ? 2.5 : 2} />
                {activeTab === item.id && <span className="text-sm font-semibold tracking-tight">{item.label}</span>}
              </button>
            ))}
          </div>

          {/* Morphed Account Button */}
          <button 
            onClick={() => handleTabClick('account')}
            className={cn(
              "flex items-center justify-center rounded-full shrink-0 transition-all duration-400",
              isMorphed ? "w-11 h-11 bg-muted/40 text-foreground hover:bg-muted/60 opacity-100" : "hidden"
            )}
          >
             <User className="w-5 h-5 shrink-0" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* ═══ SHEET & CREATE DIALOG ═══ */}
      <BottomSheet open={createSheetOpen} onOpenChange={setCreateSheetOpen}>
        <BottomSheetContent
          hideHandle
          className="w-full max-w-full rounded-t-[28px] border-t border-border/20 bg-card/90 backdrop-blur-2xl px-5 pt-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)]"
        >
          <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-muted-foreground/20" />

          <div className="mb-5 text-center">
            <h3 className="text-base font-semibold text-foreground">Create</h3>
            <p className="mt-1 text-xs text-muted-foreground/70">Files, folders, and more</p>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={handleUploadClick}
              className="flex w-full items-center gap-3 rounded-xl border border-border/20 bg-card/60 backdrop-blur-md px-4 py-3.5 text-sm font-medium active:scale-[0.98] transition-all duration-150 hover:bg-accent/30"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Upload className="h-4 w-4" />
              </span>
              Upload Files
            </button>

            <button
              onClick={() => handleSelectOption(openFolderDialog)}
              className="flex w-full items-center gap-3 rounded-xl border border-border/20 bg-card/60 backdrop-blur-md px-4 py-3.5 text-sm font-medium active:scale-[0.98] transition-all duration-150 hover:bg-accent/30"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Folder className="h-4 w-4" />
              </span>
              New Folder
            </button>

            <button
              onClick={() => { setCreateSheetOpen(false); setUrlUploadOpen(true); }}
              className="flex w-full items-center gap-3 rounded-xl border border-border/20 bg-card/60 backdrop-blur-md px-4 py-3.5 text-sm font-medium active:scale-[0.98] transition-all duration-150 hover:bg-accent/30"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Link className="h-4 w-4" />
              </span>
              Upload from URL
            </button>

            <div>
              <h4 className="mb-2.5 mt-4 text-xs font-medium text-muted-foreground/70 px-1">Quick Files</h4>
              <div className="grid grid-cols-2 gap-2.5">
                {quickFileTypes.map((type, i) => (
                  <button
                    key={type.extension}
                    onClick={() => handleSelectOption(openFileDialog, type)}
                    className="flex items-center gap-2.5 rounded-xl border border-border/20 bg-card/40 backdrop-blur-md px-3.5 py-3 text-sm text-muted-foreground hover:text-foreground active:scale-[0.98] transition-all duration-150 hover:bg-accent/20"
                    style={{
                      animation: mounted ? `fadeIn 0.4s ease-out ${i * 60}ms both` : undefined,
                    }}
                  >
                    <type.icon className="h-4 w-4" />
                    <span className="font-medium">{type.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </BottomSheetContent>
      </BottomSheet>

      <CreateItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        createMode={createMode}
        fileName={fileName}
        onFileNameChange={setFileName}
        onSubmit={submit}
        creating={creating}
        currentPath={currentPath}
      />

      <UrlUploadModal
        open={urlUploadOpen}
        onOpenChange={setUrlUploadOpen}
        currentFolder={currentPath}
      />
    </>
  );
};

export default MobileBottomNavbar;

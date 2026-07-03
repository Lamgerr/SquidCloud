import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  BarChart3,
  Files,
  Folder,
  Plus,
  User,
  Users,
  FileStack,
  Upload,
} from '@/lib/icon-map';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import CreateItemDialog from '@/components/CreateItemDialog';
import { useCreateItem } from '@/hooks/use-create-item';
import type { CreateFileType } from '@/hooks/use-create-item';

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

const haptic = (duration: number = 10) => {
  if ('vibrate' in navigator) navigator.vibrate(duration);
};

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
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const prevTabRef = useRef(activeTab);

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    fileTypes,
    dialogOpen,
    setDialogOpen,
    fileName,
    setFileName,
    createMode,
    creating,
    openFileDialog,
    openFolderDialog,
    submit,
  } = useCreateItem({ currentPath, onItemCreated: onFileCreated });

  const quickFileTypes = useMemo<CreateFileType[]>(() => fileTypes.slice(0, 4), [fileTypes]);

  const handleTabClick = (tabId: string) => {
    if (tabId === 'account') {
      haptic(10);
      window.location.href = '/settings/account';
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

  const openCreateMenu = () => {
    if (createDisabled) { onCreateDisabled?.(); return; }
    setCreateSheetOpen(true);
    haptic(10);
  };

  const handleSelectOption = (callback: (type?: CreateFileType) => void, type?: CreateFileType) => {
    if (createDisabled) { onCreateDisabled?.(); return; }
    setCreateSheetOpen(false);
    type ? callback(type) : callback();
  };

  const getTabIndex = (id: string) => navItems.findIndex(i => i.id === id);
  const navMid = Math.ceil(navItems.length / 2);

  return (
    <>
      <div className={cn('fixed inset-x-0 bottom-0 z-50 flex justify-center', className)}>
        <div
          className={cn(
            'mx-3 mb-3 w-full max-w-md',
            'lg-elevated rounded-2xl',
            'shadow-lg shadow-black/5 dark:shadow-black/20',
            'bg-card/85 backdrop-blur-2xl',
            'border border-border/20',
            'transition-all duration-300',
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
          )}
        >
          <div className="flex items-center justify-around h-[60px] px-2">
            {navItems.slice(0, navMid).map((item, i) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className="group relative flex flex-col items-center justify-center flex-1 h-full py-1"
                  aria-label={item.label}
                  style={{
                    transitionDelay: mounted ? `${i * 60}ms` : '0ms',
                  }}
                >
                  <div
                    className={cn(
                      'flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300',
                      isActive
                        ? 'bg-primary/12 text-primary scale-100'
                        : 'text-muted-foreground/50 scale-100 group-hover:text-foreground/70',
                    )}
                  >
                    <Icon
                      className={cn(
                        'transition-all duration-300',
                        isActive ? 'h-5 w-5' : 'h-[18px] w-[18px]',
                      )}
                      strokeWidth={isActive ? 2.5 : 1.5}
                    />
                  </div>
                  <span
                    className={cn(
                      'text-[9px] font-medium tracking-wide transition-all duration-300',
                      isActive
                        ? 'text-primary/90 translate-y-0'
                        : 'text-muted-foreground/40 translate-y-0',
                    )}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}

            <div className="flex items-center justify-center flex-1 relative">
              <button
                onClick={openCreateMenu}
                className={cn(
                  'relative flex items-center justify-center',
                  'h-[46px] w-[46px] rounded-full',
                  'bg-primary text-primary-foreground',
                  'shadow-lg shadow-primary/30 dark:shadow-primary/20',
                  'hover:shadow-primary/40 hover:scale-105',
                  'active:scale-90 transition-all duration-200',
                  createDisabled && 'opacity-60 cursor-not-allowed active:scale-100 hover:scale-100',
                  mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
                )}
                style={{ transitionDelay: '120ms' }}
                aria-disabled={createDisabled}
                aria-label="Create"
              >
                <Plus className="h-5 w-5" strokeWidth={2.5} />
                <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-30 motion-safe:animate-ping" />
              </button>
            </div>

            {navItems.slice(navMid).map((item, i) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className="group relative flex flex-col items-center justify-center flex-1 h-full py-1"
                  aria-label={item.label}
                  style={{
                    transitionDelay: mounted ? `${(i + navMid + 1) * 60}ms` : '0ms',
                  }}
                >
                  <div
                    className={cn(
                      'flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300',
                      isActive
                        ? 'bg-primary/12 text-primary scale-100'
                        : 'text-muted-foreground/50 scale-100 group-hover:text-foreground/70',
                    )}
                  >
                    <Icon
                      className={cn(
                        'transition-all duration-300',
                        isActive ? 'h-5 w-5' : 'h-[18px] w-[18px]',
                      )}
                      strokeWidth={isActive ? 2.5 : 1.5}
                    />
                  </div>
                  <span
                    className={cn(
                      'text-[9px] font-medium tracking-wide transition-all duration-300',
                      isActive
                        ? 'text-primary/90 translate-y-0'
                        : 'text-muted-foreground/40 translate-y-0',
                    )}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Sheet open={createSheetOpen} onOpenChange={setCreateSheetOpen}>
        <SheetContent
          side="bottom"
          className="w-full max-w-full rounded-t-3xl border-t border-border/20 bg-card/90 backdrop-blur-2xl px-5 pt-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)]"
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

            <div>
              <h4 className="mb-2.5 text-xs font-medium text-muted-foreground/70 px-1">Quick Files</h4>
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
        </SheetContent>
      </Sheet>

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
    </>
  );
};

export default MobileBottomNavbar;

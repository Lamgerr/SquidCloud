import React, { useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { BottomSheet, BottomSheetContent } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Folder, FileText } from '@/lib/icon-map';
import { Loader } from '@/components/ui/Loader';

type CreateMode = 'file' | 'folder';

interface CreateItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createMode: CreateMode;
  fileName: string;
  onFileNameChange: (value: string) => void;
  onSubmit: () => Promise<void> | void;
  creating: boolean;
  currentPath?: string;
}

const CreateItemDialog: React.FC<CreateItemDialogProps> = ({
  open,
  onOpenChange,
  createMode,
  fileName,
  onFileNameChange,
  onSubmit,
  creating,
  currentPath,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleClose = (nextOpen: boolean) => {
    if (!creating) onOpenChange(nextOpen);
  };

  const handleSubmit = async () => {
    if (!fileName.trim() || creating) return;
    await onSubmit();
  };

  if (isMobile) {
    return (
      <BottomSheet open={open} onOpenChange={handleClose}>
        <BottomSheetContent hideHandle className="bg-card/95 backdrop-blur-2xl p-0 gap-0 rounded-t-[28px]">
          <div className="px-5 pt-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)]">
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />

            <div className="flex items-center gap-3 mb-8 pt-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-sm flex-shrink-0">
                {createMode === 'folder' ? (
                  <Folder className="h-5 w-5 text-primary-foreground" />
                ) : (
                  <FileText className="h-5 w-5 text-primary-foreground" />
                )}
              </div>
              <div>
                <h3 className="text-[17px] font-semibold text-white">
                  New {createMode === 'folder' ? 'Folder' : 'File'}
                </h3>
                <p className="text-[12px] text-white/40">SquidCloud &middot; Res54</p>
              </div>
            </div>

            <div className="flex gap-2 mb-4 bg-white/[0.04] rounded-2xl p-1 border border-white/10">
              {(['folder', 'file'] as CreateMode[]).map((mode) => {
                const Icon = mode === 'folder' ? Folder : FileText;
                const isActive = createMode === mode;
                return (
                  <button
                    key={mode}
                    disabled={creating}
                    onClick={() => {
                      onFileNameChange(mode === 'folder' ? 'New Folder' : 'untitled.txt');
                    }}
                    className={cn(
                      'flex items-center justify-center gap-2 flex-1 h-10 rounded-xl text-sm font-medium transition-all',
                      isActive
                        ? 'bg-white/[0.08] text-white shadow-sm'
                        : 'text-white/40 hover:text-white/60'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {mode === 'folder' ? 'Folder' : 'File'}
                  </button>
                );
              })}
            </div>

            <div className="relative mb-1">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                {createMode === 'folder' ? (
                  <Folder className="h-4 w-4 text-white/30" />
                ) : (
                  <FileText className="h-4 w-4 text-white/30" />
                )}
              </div>
              <Input
                ref={inputRef}
                id="mobile-create-name"
                value={fileName}
                onChange={(e) => onFileNameChange(e.target.value)}
                placeholder={createMode === 'folder' ? 'Folder name...' : 'File name...'}
                disabled={creating}
                className="h-12 pl-10 pr-4 rounded-2xl bg-white/[0.06] border-white/10 text-white placeholder:text-white/30 text-[15px] focus:ring-2 focus:ring-primary/40 focus:border-primary/30"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !creating) void handleSubmit();
                }}
              />
            </div>

            {currentPath && (
              <div className="flex items-center gap-1.5 mb-5 px-1">
                <div className="h-1 w-1 rounded-full bg-primary/50" />
                <span className="text-[12px] text-white/35 truncate">
                  {currentPath}
                </span>
              </div>
            )}

            <div className="flex gap-2.5">
              <Button
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={creating}
                className="flex-1 h-11 rounded-2xl bg-white/[0.04] border-white/10 text-white/60 hover:text-white hover:bg-white/[0.08] text-sm font-medium"
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleSubmit()}
                disabled={!fileName.trim() || creating}
                className="flex-1 h-11 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20 disabled:opacity-40 text-sm font-medium"
              >
                {creating ? (
                  <div className="flex items-center gap-2">
                    <Loader size="sm" />
                    Creating...
                  </div>
                ) : (
                  `Create ${createMode === 'folder' ? 'Folder' : 'File'}`
                )}
              </Button>
            </div>
          </div>
        </BottomSheetContent>
      </BottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px]">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-sm">
              {createMode === 'folder' ? (
                <Folder className="h-5 w-5 text-primary-foreground" />
              ) : (
                <FileText className="h-5 w-5 text-primary-foreground" />
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                New {createMode === 'folder' ? 'Folder' : 'File'}
              </h3>
              <p className="text-xs text-white/40">SquidCloud &middot; Res54</p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                {createMode === 'folder' ? (
                  <Folder className="h-4 w-4 text-white/30" />
                ) : (
                  <FileText className="h-4 w-4 text-white/30" />
                )}
              </div>
              <Input
                ref={inputRef}
                id="desktop-create-name"
                value={fileName}
                onChange={(e) => onFileNameChange(e.target.value)}
                placeholder={`Enter ${createMode} name...`}
                disabled={creating}
                className="h-11 pl-10 rounded-xl bg-white/[0.06] border-white/10 text-white placeholder:text-white/30 focus:ring-2 focus:ring-primary/40 focus:border-primary/30"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !creating) void handleSubmit();
                }}
              />
            </div>
            {currentPath && (
              <div className="flex items-center gap-1.5 pt-1.5 px-1">
                <div className="h-1 w-1 rounded-full bg-primary/50" />
                <span className="text-xs text-white/35 truncate">{currentPath}</span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2.5 mt-5">
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={creating}
              className="rounded-xl bg-white/[0.04] border-white/10 text-white/60 hover:text-white hover:bg-white/[0.08]"
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSubmit()}
              disabled={!fileName.trim() || creating}
              className="rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20 disabled:opacity-40"
            >
              {creating ? (
                <div className="flex items-center gap-2">
                  <Loader size="sm" />
                  Creating...
                </div>
              ) : (
                `Create ${createMode === 'folder' ? 'Folder' : 'File'}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateItemDialog;

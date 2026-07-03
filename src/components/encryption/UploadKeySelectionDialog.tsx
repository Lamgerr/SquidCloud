import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Key, Shield, RefreshCw, Lock, Loader2, Info, AlertTriangle
} from '@/lib/icon-map';
import { cn } from '@/lib/utils';

export type KeySelectionMode = 'saved' | 'unique' | 'custom';

export interface KeySelectionResult {
  mode: KeySelectionMode;
  customKey?: string;
  dontAskAgain: boolean;
}

interface UploadKeySelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  fileSize: number;
  onConfirm: (result: KeySelectionResult) => void;
  onCancel: () => void;
}

export function UploadKeySelectionDialog({
  open, onOpenChange, fileName, fileSize, onConfirm, onCancel
}: UploadKeySelectionDialogProps) {
  const [selectedMode, setSelectedMode] = useState<KeySelectionMode>('saved');
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [customKey, setCustomKey] = useState('');
  const [showCustomKey, setShowCustomKey] = useState(false);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const options: { mode: KeySelectionMode; icon: React.ReactNode; title: string; desc: string }[] = [
    {
      mode: 'saved',
      icon: <Key className="h-5 w-5 text-primary" />,
      title: 'Use my saved encryption key',
      desc: 'File is encrypted with your account key. You can decrypt it anytime.',
    },
    {
      mode: 'unique',
      icon: <RefreshCw className="h-5 w-5 text-purple-400" />,
      title: 'Generate a unique key',
      desc: 'A one-time key is created for this file only. Save it to decrypt later.',
    },
    {
      mode: 'custom',
      icon: <Lock className="h-5 w-5 text-amber-400" />,
      title: 'Use a custom key',
      desc: 'Provide your own key for this file. Must be at least 8 characters.',
    },
  ];

  const handleConfirm = () => {
    onConfirm({
      mode: selectedMode,
      customKey: selectedMode === 'custom' ? customKey : undefined,
      dontAskAgain,
    });
  };

  const canConfirm = selectedMode !== 'custom' || customKey.length >= 8;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-md border-border/60 bg-card/95 backdrop-blur-xl z-[9999]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Shield className="h-5 w-5 text-primary" />
            Encryption Key for Upload
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Choose how to encrypt <span className="text-foreground font-medium">{fileName}</span> ({formatSize(fileSize)})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {options.map((opt) => (
            <button
              key={opt.mode}
              type="button"
              onClick={() => setSelectedMode(opt.mode)}
              className={cn(
                'w-full text-left rounded-xl border p-4 transition-all',
                selectedMode === opt.mode
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border/40 bg-black/20 hover:border-border/60'
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  'shrink-0 mt-0.5',
                  selectedMode === opt.mode ? 'opacity-100' : 'opacity-60'
                )}>
                  {opt.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{opt.title}</span>
                    <div className={cn(
                      'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                      selectedMode === opt.mode ? 'border-primary' : 'border-muted-foreground/30'
                    )}>
                      {selectedMode === opt.mode && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
                </div>
              </div>

              {opt.mode === 'custom' && selectedMode === 'custom' && (
                <div className="mt-3 pt-3 border-t border-border/20">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Custom Encryption Key</Label>
                  <input
                    type={showCustomKey ? 'text' : 'password'}
                    value={customKey}
                    onChange={(e) => setCustomKey(e.target.value)}
                    placeholder="Enter key (min 8 characters)"
                    className="w-full h-10 px-3 rounded-lg bg-black/30 border border-border/40 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50"
                    autoFocus
                  />
                  {customKey.length > 0 && customKey.length < 8 && (
                    <p className="text-xs text-amber-400 mt-1">Key must be at least 8 characters</p>
                  )}
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground mt-1"
                    onClick={() => setShowCustomKey(!showCustomKey)}
                  >
                    {showCustomKey ? 'Hide' : 'Show'} key
                  </button>
                </div>
              )}
            </button>
          ))}

          {selectedMode === 'unique' && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  You must save the generated key to decrypt this file later. SquidCloud does not store unique keys.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 pt-2">
            <Checkbox
              id="dont-ask-again"
              checked={dontAskAgain}
              onCheckedChange={(c) => setDontAskAgain(c === true)}
            />
            <label htmlFor="dont-ask-again" className="text-xs text-muted-foreground cursor-pointer">
              Don't ask me again. Always {selectedMode === 'saved' ? 'use my saved key' : selectedMode === 'unique' ? 'generate unique keys' : 'let me enter a custom key'}.
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel Upload</Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {selectedMode === 'saved' ? 'Encrypt with Saved Key' :
             selectedMode === 'unique' ? 'Generate & Encrypt' : 'Encrypt with Custom Key'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

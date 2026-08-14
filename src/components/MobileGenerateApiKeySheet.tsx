import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  Key, Plus, Copy, Check, AlertCircle, X, Eye, EyeOff, Trash2,
} from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BottomSheet, BottomSheetContent } from '@/components/ui/bottom-sheet';

interface MobileGenerateApiKeySheetProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function MobileGenerateApiKeySheet({ open, onClose, onCreated }: MobileGenerateApiKeySheetProps) {
  const [keyName, setKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!keyName.trim()) {
      toast({ title: 'Name required', description: 'Enter a name for your API key', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('api-key-management', {
        body: {
          action: 'generate',
          name: keyName.trim(),
          scopes: ['read', 'write', 'delete'],
        },
      });

      if (error) throw error;
      setGeneratedKey(data.apiKey);
      setKeyName('');
      toast({ title: 'API key generated' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to generate API key', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    toast({ title: 'Copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    if (generatedKey) {
      onCreated();
    }
    setKeyName('');
    setGeneratedKey('');
    setShowKey(false);
    setCopied(false);
    onClose();
  };

  // Success state - show the generated key
  if (generatedKey) {
    return (
      <BottomSheet open={open} onOpenChange={(open) => { if (!open) handleClose() }}>
        <BottomSheetContent hideHandle hideClose className="border-none bg-transparent p-0">
          <div className="relative overflow-hidden rounded-t-[28px] bg-background flex flex-col">
            {/* Header */}
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Check className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-semibold text-foreground">Key Generated</h3>
                    <p className="text-[11px] text-muted-foreground">Copy and store it securely</p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="h-px bg-border" />

            <div className="px-5 py-5 space-y-4">
              {/* Key display */}
              <div className="rounded-xl bg-muted border border-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Your API Key</span>
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {showKey ? 'Hide' : 'Show'}
                  </button>
                </div>
                <code className={cn(
                  'block text-sm font-mono break-all leading-relaxed',
                  showKey ? 'text-foreground' : 'text-muted-foreground/40',
                )}>
                  {showKey ? generatedKey : '••••••••••••••••••••••••••••••••'}
                </code>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-[12px] text-amber-400/70 leading-relaxed">
                  This is the only time you'll see this key. Copy it now and store it securely.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-border space-y-2">
              <Button
                onClick={handleCopy}
                className="w-full h-12 rounded-xl bg-foreground text-background font-semibold hover:bg-foreground/90 transition-all duration-200"
              >
                {copied ? (
                  <span className="flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Copied!
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Copy className="w-4 h-4" />
                    Copy API Key
                  </span>
                )}
              </Button>
              <Button
                onClick={handleClose}
                variant="ghost"
                className="w-full h-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                Done
              </Button>
            </div>
          </div>
        </BottomSheetContent>
      </BottomSheet>
    );
  }

  // Create form
  return (
    <BottomSheet open={open} onOpenChange={(open) => { if (!open) handleClose() }}>
      <BottomSheetContent hideHandle hideClose className="border-none bg-transparent p-0">
        <div className="relative overflow-hidden rounded-t-[28px] bg-background flex flex-col">
          {/* Header */}
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Key className="w-5 h-5 text-foreground" />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-foreground">Generate API Key</h3>
                  <p className="text-[11px] text-muted-foreground">Create a new key for API access</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="h-px bg-border" />

          {/* Form */}
          <div className="px-5 py-5 space-y-5">
            <div className="space-y-2">
              <Label className="text-[12px] text-muted-foreground font-medium">Key Name</Label>
              <Input
                value={keyName}
                onChange={e => setKeyName(e.target.value)}
                placeholder="e.g., Production API, Mobile App"
                className="h-11 rounded-xl bg-muted border-border text-foreground text-sm placeholder:text-muted-foreground/40 focus:border-foreground/30 focus:ring-foreground/10"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && keyName.trim()) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
              />
            </div>

            <div>
              <div className="rounded-xl bg-muted border border-border/60 p-3">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Your API key will have <span className="text-foreground font-medium">read, write, and delete</span> permissions. Use it with the <code className="text-foreground bg-foreground/[0.06] px-1 py-0.5 rounded text-[10px]">X-SquidCloud-Key</code> header.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-border">
            <Button
              onClick={handleGenerate}
              disabled={creating || !keyName.trim()}
              className="w-full h-12 rounded-xl bg-foreground text-background font-semibold hover:bg-foreground/90 transition-all duration-200 disabled:opacity-40"
            >
              {creating ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                  Generating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Generate API Key
                </span>
              )}
            </Button>
          </div>
        </div>
        </BottomSheetContent>
      </BottomSheet>
    );
}

export default MobileGenerateApiKeySheet;

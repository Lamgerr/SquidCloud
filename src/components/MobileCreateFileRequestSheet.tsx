import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { createFileRequest } from '@/lib/api';
import {
  Inbox, Plus, Copy, Check, X, Loader2, Link as LinkIcon,
} from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BottomSheet, BottomSheetContent } from '@/components/ui/bottom-sheet';

interface MobileCreateFileRequestSheetProps {
  open: boolean;
  onClose: () => void;
  currentFolder?: string;
  onCreated?: () => void;
}

export function MobileCreateFileRequestSheet({
  open,
  onClose,
  currentFolder = '',
  onCreated,
}: MobileCreateFileRequestSheetProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [maxFiles, setMaxFiles] = useState(0);
  const [maxSizeMB, setMaxSizeMB] = useState(0);
  const [allowedTypes, setAllowedTypes] = useState('');
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ slug: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast({ title: 'Title required', description: 'Please enter a title for this file request.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const expiresAt = expiresIn
        ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const parsedTypes = allowedTypes
        ? allowedTypes.split(',').map(t => t.trim()).filter(Boolean)
        : undefined;

      const res = await createFileRequest({
        title: title.trim(),
        description: description.trim(),
        folderPath: currentFolder,
        maxFiles: maxFiles > 0 ? maxFiles : undefined,
        maxSizePerFile: maxSizeMB > 0 ? maxSizeMB * 1024 * 1024 : undefined,
        allowedTypes: parsedTypes,
        expiresAt,
      });

      const url = `${window.location.origin}/r/${res.slug}`;
      await navigator.clipboard.writeText(url);
      setResult({ slug: res.slug, url });
      toast({ title: 'File request created', description: 'Link copied to clipboard!' });
      if (onCreated) onCreated();
    } catch (err: any) {
      toast({ title: 'Failed to create', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result.url);
      setCopied(true);
      toast({ title: 'Copied', description: 'Link copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setMaxFiles(0);
    setMaxSizeMB(0);
    setAllowedTypes('');
    setExpiresIn(null);
    setResult(null);
    setCopied(false);
    onClose();
  };

  const expirationOptions = [
    { value: null, label: 'Never' },
    { value: 1, label: '1 day' },
    { value: 7, label: '7 days' },
    { value: 30, label: '30 days' },
  ];

  // Success state
  if (result) {
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
                    <h3 className="text-[16px] font-semibold text-foreground">Request Created</h3>
                    <p className="text-[11px] text-muted-foreground">Share this link for file uploads</p>
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
              {/* Link display */}
              <div>
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <LinkIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[10px] text-emerald-400/70 font-medium uppercase tracking-wider">Public Upload Link</span>
                  </div>
                  <code className="block text-sm font-mono text-foreground break-all leading-relaxed">
                    {result.url}
                  </code>
                </div>
              </div>

              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Anyone with this link can upload files to your folder. You'll find them in your account.
              </p>
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
                    Copy Link
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
        <div className="relative overflow-hidden rounded-t-[28px] bg-background max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Inbox className="w-5 h-5 text-foreground" />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-foreground">Create File Request</h3>
                  <p className="text-[11px] text-muted-foreground">Get a public upload link</p>
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
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Title */}
            <div className="space-y-2">
              <Label className="text-[12px] text-muted-foreground font-medium">Title *</Label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Design Assets for Project X"
                className="h-11 rounded-xl bg-muted border-border text-foreground text-sm placeholder:text-muted-foreground/40 focus:border-foreground/30 focus:ring-foreground/10"
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-[12px] text-muted-foreground font-medium">Description</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Tell uploaders what files you need..."
                className="min-h-[72px] text-sm resize-none bg-muted border-border text-foreground placeholder:text-muted-foreground/40 focus:border-foreground/30 focus:ring-foreground/10"
              />
            </div>

            {/* Limits */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[12px] text-muted-foreground font-medium">Max files</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0 = unlimited"
                  value={maxFiles || ''}
                  onChange={e => setMaxFiles(parseInt(e.target.value) || 0)}
                  className="h-11 rounded-xl bg-muted border-border text-foreground text-sm placeholder:text-muted-foreground/40 focus:border-foreground/30 focus:ring-foreground/10"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[12px] text-muted-foreground font-medium">Max size (MB)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0 = unlimited"
                  value={maxSizeMB || ''}
                  onChange={e => setMaxSizeMB(parseInt(e.target.value) || 0)}
                  className="h-11 rounded-xl bg-muted border-border text-foreground text-sm placeholder:text-muted-foreground/40 focus:border-foreground/30 focus:ring-foreground/10"
                />
              </div>
            </div>

            {/* Allowed types */}
            <div className="space-y-2">
              <Label className="text-[12px] text-muted-foreground font-medium">Allowed file types</Label>
              <Input
                value={allowedTypes}
                onChange={e => setAllowedTypes(e.target.value)}
                placeholder="e.g. .jpg,.png,.pdf (leave empty for all)"
                className="h-11 rounded-xl bg-muted border-border text-foreground text-sm font-mono placeholder:text-muted-foreground/40 placeholder:font-sans focus:border-foreground/30 focus:ring-foreground/10"
              />
            </div>

            {/* Expiration */}
            <div className="space-y-2">
              <Label className="text-[12px] text-muted-foreground font-medium">Link expiration</Label>
              <div className="grid grid-cols-4 gap-2">
                {expirationOptions.map(opt => (
                  <button
                    key={opt.label}
                    onClick={() => setExpiresIn(opt.value)}
                    className={cn(
                      'h-10 rounded-xl text-[12px] font-medium border transition-all duration-200',
                      expiresIn === opt.value
                        ? 'bg-foreground/10 text-foreground border-foreground/20'
                        : 'bg-muted text-muted-foreground border-border hover:border-foreground/20',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-border">
            <Button
              onClick={handleCreate}
              disabled={loading || !title.trim()}
              className="w-full h-12 rounded-xl bg-foreground text-background font-semibold hover:bg-foreground/90 transition-all duration-200 disabled:opacity-40"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Inbox className="w-4 h-4" />
                  Create File Request
                </span>
              )}
            </Button>
          </div>
        </div>
        </BottomSheetContent>
      </BottomSheet>
    );
}

export default MobileCreateFileRequestSheet;
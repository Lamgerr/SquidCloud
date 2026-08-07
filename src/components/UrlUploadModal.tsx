import React, { useState, useRef, useEffect } from 'react';
import {
  Globe, Link, Search, Upload, X, Loader, AlertCircle,
  FileVideo, FileAudio, FileText, FileImage, Check,
} from '@/lib/icon-map';
import { cn, formatBytes } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { backgroundUploadService } from '@/services/backgroundUpload';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent,
  DialogTitle, DialogDescription, DialogClose,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent,
  SheetTitle, SheetDescription, SheetClose,
} from '@/components/ui/sheet';

interface UrlUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFolder?: string;
  onUploadComplete?: (file: any) => void;
}

interface DirectFile {
  type: 'direct';
  url: string;
  contentType: string;
  contentLength: number | null;
  filename: string;
  fileType: string;
}

interface PageSource {
  url: string;
  type: string;
  label: string;
  format?: string;
}

interface PageResult {
  type: 'page';
  url: string;
  title: string;
  sources: PageSource[];
}

type ResolveResult = DirectFile | PageResult;

function sourceIcon(type: string) {
  if (type === 'video') return FileVideo;
  if (type === 'audio') return FileAudio;
  return FileText;
}

const UrlUploadModal: React.FC<UrlUploadModalProps> = ({
  open, onOpenChange, currentFolder, onUploadComplete,
}) => {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [url, setUrl] = useState('');
  const [resolving, setResolving] = useState(false);
  const [result, setResult] = useState<ResolveResult | null>(null);
  const [selectedSources, setSelectedSources] = useState<Set<number>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setUrl('');
      setResult(null);
      setSelectedSources(new Set());
      setUploading(false);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const resolveUrl = async () => {
    if (!url.trim()) return;
    let inputUrl = url.trim();
    if (!/^https?:\/\//i.test(inputUrl)) inputUrl = 'https://' + inputUrl;

    setResolving(true);
    setError(null);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await supabase.functions.invoke('url-resolve', {
        body: { url: inputUrl },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });

      if (resp.error) throw new Error(resp.error.message);
      const data = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
      if (data.error) throw new Error(data.error);

      setResult(data);

      // Auto-upload direct files
      if (data.type === 'direct') {
        await uploadFromUrl(data.url, data.filename, currentFolder);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to resolve URL');
    } finally {
      setResolving(false);
    }
  };

  const uploadFromUrl = async (fileUrl: string, filename: string, folder?: string) => {
    setUploading(true);
    try {
      const resp = await fetch(fileUrl);
      if (!resp.ok) throw new Error(`Download failed (${resp.status})`);

      const blob = await resp.blob();
      const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });

      await backgroundUploadService.addTask(file, folder || '', (result) => {
        if (result) {
          toast({ title: 'Upload complete', description: filename });
          onUploadComplete?.(result);
        }
      });

      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to download file');
    } finally {
      setUploading(false);
    }
  };

  const uploadSelectedSources = async () => {
    if (selectedSources.size === 0 || !result || result.type !== 'page') return;
    setUploading(true);

    try {
      const sources = Array.from(selectedSources).map(i => result.sources[i]).filter(Boolean);
      for (const source of sources) {
        const filename = (() => {
          try {
            const p = new URL(source.url).pathname.split('/').filter(Boolean);
            return decodeURIComponent(p[p.length - 1] || 'video.mp4');
          } catch {
            return `video_${Date.now()}.mp4`;
          }
        })();
        await uploadFromUrl(source.url, filename, currentFolder);
      }
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const toggleSource = (idx: number) => {
    setSelectedSources(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !resolving && !uploading) resolveUrl();
  };

  const content = (
    <div className="space-y-4">
      {/* URL Input */}
      <div className="relative">
        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste a URL to upload from..."
          disabled={resolving || uploading}
          className={cn(
            "w-full h-11 pl-10 pr-24 rounded-xl bg-muted/40 border border-border/40",
            "text-sm text-foreground placeholder:text-muted-foreground/50",
            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40",
            "transition-all disabled:opacity-50"
          )}
        />
        <button
          onClick={resolveUrl}
          disabled={!url.trim() || resolving || uploading}
          className={cn(
            "absolute right-1.5 top-1/2 -translate-y-1/2 h-8 px-3 rounded-lg",
            "text-xs font-medium transition-all",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {resolving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : 'Resolve'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/5 border border-destructive/20">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive/80">{error}</p>
        </div>
      )}

      {/* Resolving indicator */}
      {resolving && (
        <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground/60">
          <Loader className="w-4 h-4 animate-spin" />
          <span className="text-xs">Resolving URL…</span>
        </div>
      )}

      {/* Uploading indicator */}
      {uploading && (
        <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground/60">
          <Loader className="w-4 h-4 animate-spin" />
          <span className="text-xs">Uploading to SquidCloud…</span>
        </div>
      )}

      {/* Direct file result */}
      {result && result.type === 'direct' && !uploading && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
              {result.fileType === 'video' ? <FileVideo className="w-5 h-5" /> :
               result.fileType === 'audio' ? <FileAudio className="w-5 h-5" /> :
               result.fileType === 'image' ? <FileImage className="w-5 h-5" /> :
               <FileText className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{result.filename}</p>
              <p className="text-[11px] text-muted-foreground/60">
                {result.contentType} {result.contentLength ? `· ${formatBytes(result.contentLength)}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={() => uploadFromUrl(result.url, result.filename, currentFolder)}
            className={cn(
              "w-full h-10 rounded-xl text-sm font-medium transition-all",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              "active:scale-[0.98] flex items-center justify-center gap-2"
            )}
          >
            <Upload className="w-4 h-4" />
            Upload File
          </button>
        </div>
      )}

      {/* Page with sources */}
      {result && result.type === 'page' && !uploading && (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
            <p className="text-sm font-medium text-foreground truncate">{result.title}</p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">
              {result.sources.length} media source{result.sources.length !== 1 ? 's' : ''} found
            </p>
          </div>

          {result.sources.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground/50">
              <Search className="w-5 h-5" />
              <p className="text-xs">No downloadable video or audio sources found on this page.</p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {result.sources.map((source, idx) => {
                  const Icon = sourceIcon(source.type);
                  const isSelected = selectedSources.has(idx);
                  return (
                    <button
                      key={idx}
                      onClick={() => toggleSource(idx)}
                      className={cn(
                        "w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all",
                        "border",
                        isSelected
                          ? "bg-primary/5 border-primary/30"
                          : "bg-muted/20 border-border/20 hover:bg-muted/40"
                      )}
                    >
                      <div className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-lg shrink-0",
                        isSelected ? "bg-primary/15 text-primary" : "bg-muted/60 text-muted-foreground/60"
                      )}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {source.label}
                          {source.format ? (
                            <span className="ml-1.5 text-muted-foreground/50 font-normal">
                              {typeof source.format === 'string' && source.format.includes('/')
                                ? source.format.split('/')[1]?.toUpperCase()
                                : source.format?.toUpperCase()}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-[10px] text-muted-foreground/50 truncate mt-0.5">
                          {(() => { try { return new URL(source.url).hostname; } catch { return ''; } })()}
                        </p>
                      </div>
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-border/40"
                      )}>
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={uploadSelectedSources}
                disabled={selectedSources.size === 0}
                className={cn(
                  "w-full h-10 rounded-xl text-sm font-medium transition-all",
                  "bg-primary text-primary-foreground hover:bg-primary/90",
                  "active:scale-[0.98] flex items-center justify-center gap-2",
                  "disabled:opacity-40 disabled:cursor-not-allowed"
                )}
              >
                <Upload className="w-4 h-4" />
                Upload {selectedSources.size > 0 ? `${selectedSources.size} source${selectedSources.size !== 1 ? 's' : ''}` : 'Selected'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Hint */}
      {!result && !resolving && !error && (
        <div className="flex items-center gap-2 py-3 text-muted-foreground/40">
          <Link className="w-3.5 h-3.5" />
          <p className="text-[11px]">Paste a direct link (mp4, mp3, pdf…) or a page URL to scan for videos</p>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="w-full max-w-full rounded-t-3xl border-t border-border/20 bg-card/90 backdrop-blur-2xl px-5 pt-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)]"
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/20" />
          <div className="flex items-center justify-between mb-4">
            <div>
              <SheetTitle className="text-base font-semibold text-foreground">Upload from URL</SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground/60 mt-0.5">
                Paste a link to upload a file
              </SheetDescription>
            </div>
            <SheetClose className="p-2 rounded-lg hover:bg-muted/40 transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </SheetClose>
          </div>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-0">
          <div>
            <DialogTitle className="text-base font-semibold text-foreground">Upload from URL</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground/60 mt-0.5">
              Paste a link to upload a file directly
            </DialogDescription>
          </div>
          <DialogClose className="p-2 rounded-lg hover:bg-muted/40 transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </DialogClose>
        </div>
        <div className="px-5 py-4">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UrlUploadModal;

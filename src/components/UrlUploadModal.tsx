import React, { useState, useRef, useEffect } from 'react';
import {
  Globe, Link, Search, Upload, Loader, AlertCircle,
  FileVideo, FileAudio, FileText, FileImage, Check, X,
} from '@/lib/icon-map';
import { cn, formatBytes } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseEnv';
import { backgroundUploadService } from '@/services/backgroundUpload';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent,
  DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

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

type Phase = 'idle' | 'resolving' | 'downloading' | 'uploading';

const PHASE_LABELS: Record<Phase, string> = {
  idle: '',
  resolving: 'Retrieving URL…',
  downloading: 'Downloading file…',
  uploading: 'Uploading to SquidCloud…',
};

function sourceIcon(type: string) {
  if (type === 'video') return FileVideo;
  if (type === 'audio') return FileAudio;
  return FileText;
}

const UrlUploadModal: React.FC<UrlUploadModalProps> = ({
  open, onOpenChange, currentFolder, onUploadComplete,
}) => {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [result, setResult] = useState<ResolveResult | null>(null);
  const [selectedSources, setSelectedSources] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const busy = phase !== 'idle';

  // Reset on open
  useEffect(() => {
    if (open) {
      setUrl('');
      setResult(null);
      setSelectedSources(new Set());
      setPhase('idle');
      setDownloadProgress(null);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const resolveUrl = async () => {
    if (!url.trim() || busy) return;
    let inputUrl = url.trim();
    if (!/^https?:\/\//i.test(inputUrl)) inputUrl = 'https://' + inputUrl;

    setPhase('resolving');
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
      setPhase('idle');

      // Auto-upload direct files
      if (data.type === 'direct') {
        await uploadFromUrl(data.url, data.filename, currentFolder);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to resolve URL');
      setPhase('idle');
    }
  };

  const uploadFromUrl = async (fileUrl: string, filename: string, folder?: string) => {
    setPhase('downloading');
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? SUPABASE_ANON_KEY;
      const proxyUrl = `${SUPABASE_URL}/functions/v1/url-resolve?action=download&url=${encodeURIComponent(fileUrl)}`;
      const resp = await fetch(proxyUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`Download failed (${resp.status})`);

      const contentType = resp.headers.get('content-type') || 'application/octet-stream';
      const contentLength = Number(resp.headers.get('content-length') || 0);

      let blob: Blob;
      const reader = resp.body?.getReader();
      if (reader && contentLength > 0) {
        const parts: BlobPart[] = [];
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            parts.push(value);
            received += value.byteLength;
            setDownloadProgress(Math.min(94, Math.round((received / contentLength) * 100)));
          }
        }
        blob = new Blob(parts, { type: contentType });
      } else {
        blob = await resp.blob();
      }

      setPhase('uploading');
      setDownloadProgress(null);
      const file = new File([blob], filename, { type: contentType });

      await backgroundUploadService.addTask(file, folder || '', (taskResult) => {
        if (taskResult) {
          toast({ title: 'Upload complete', description: filename });
          onUploadComplete?.(taskResult);
        }
      });

      toast({ title: 'Upload started', description: filename });
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to download file');
    } finally {
      setPhase('idle');
      setDownloadProgress(null);
    }
  };

  const uploadSelectedSources = async () => {
    if (selectedSources.size === 0 || !result || result.type !== 'page' || busy) return;

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
    } catch (e: any) {
      setError(e?.message || 'Upload failed');
    }
  };

  const toggleSource = (idx: number) => {
    if (busy) return;
    setSelectedSources(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !busy) resolveUrl();
  };

  const progressBar = busy && (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5">
        <Loader className="w-4 h-4 animate-spin text-primary shrink-0" />
        <span className="text-xs text-foreground/80">{PHASE_LABELS[phase]}</span>
        {downloadProgress !== null && (
          <span className="ml-auto text-[11px] tabular-nums text-muted-foreground/60">
            {downloadProgress}%
          </span>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
        <div
          className={cn(
            "h-full rounded-full bg-primary transition-all duration-300 ease-out",
            downloadProgress === null && "animate-pulse"
          )}
          style={{ width: downloadProgress !== null ? `${downloadProgress}%` : '40%' }}
        />
      </div>
    </div>
  );

  const fileTypeIcon = (fileType: string) => {
    if (fileType === 'video') return <FileVideo className="w-5 h-5" />;
    if (fileType === 'audio') return <FileAudio className="w-5 h-5" />;
    if (fileType === 'image') return <FileImage className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };

  const content = (
    <div className="space-y-4">
      {/* URL Input */}
      <div className="relative">
        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste a URL to upload from..."
          disabled={busy}
          className={cn(
            "w-full h-11 pl-10 pr-24 rounded-xl bg-muted/40 border border-border/40",
            "text-sm text-foreground placeholder:text-muted-foreground/50",
            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40",
            "transition-all disabled:opacity-50"
          )}
        />
        <button
          onClick={resolveUrl}
          disabled={!url.trim() || busy}
          className={cn(
            "absolute right-1.5 top-1/2 -translate-y-1/2 h-8 px-3 rounded-lg flex items-center gap-1.5",
            "text-xs font-medium transition-all",
            "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97]",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {phase === 'resolving' ? (
            <Loader className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <>
              <Link className="w-3.5 h-3.5" />
              Resolve
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/5 border border-destructive/20">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive/80 flex-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="p-1 rounded-md text-destructive/60 hover:text-destructive transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Unified activity indicator */}
      {busy && (
        <div className="p-3.5 rounded-xl bg-muted/30 border border-border/30">
          {progressBar}
        </div>
      )}

      {/* Direct file result */}
      {result && result.type === 'direct' && phase === 'idle' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0">
              {fileTypeIcon(result.fileType)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{result.filename}</p>
              <p className="text-[11px] text-muted-foreground/60 truncate">
                {result.contentType}
                {result.contentLength ? ` · ${formatBytes(result.contentLength)}` : ''}
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
      {result && result.type === 'page' && phase === 'idle' && (
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
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
                {result.sources.map((source, idx) => {
                  const Icon = sourceIcon(source.type);
                  const isSelected = selectedSources.has(idx);
                  return (
                    <button
                      key={idx}
                      onClick={() => toggleSource(idx)}
                      disabled={busy}
                      className={cn(
                        "w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all",
                        "border",
                        isSelected
                          ? "bg-primary/5 border-primary/30"
                          : "bg-muted/20 border-border/20 hover:bg-muted/40",
                        "disabled:opacity-50"
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
      {!result && phase === 'idle' && !error && (
        <div className="flex items-center gap-2 py-3 text-muted-foreground/40">
          <Link className="w-3.5 h-3.5" />
          <p className="text-[11px]">Paste a direct link (mp4, mp3, pdf…) or a page URL to scan for videos</p>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-md p-0 gap-0 overflow-hidden"
        )}
      >
        <div className="px-5 pt-5 pb-1 pr-10 shrink-0">
          <DialogTitle className="text-base font-semibold text-foreground">Upload from URL</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground/60 mt-0.5">
            Paste a link to upload a file directly
          </DialogDescription>
        </div>
        <div className="px-5 py-4 overflow-y-auto">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UrlUploadModal;
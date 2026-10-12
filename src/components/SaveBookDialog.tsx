import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Folder as FolderIcon, Check, Loader2, Download, X } from 'lucide-react';
import { resolveEpubUrl, fetchEpubBytes, type ProviderBook } from '@/lib/book-providers';
import { uploadFileWithRes54 } from '@/lib/res54';

interface FolderRow {
  id: string;
  name: string;
  path: string;
}

const safeFileName = (title: string): string =>
  `${title.replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 120) || 'book'}.epub`;

type Phase = 'pick' | 'working' | 'done' | 'error';

export default function SaveBookDialog({
  book, onClose, onSaved,
}: {
  book: ProviderBook;
  onClose: () => void;
  onSaved?: (fileId: string) => void;
}) {
  const { toast } = useToast();
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('pick');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('folders')
          .select('id, name, path')
          .eq('user_id', user.id)
          .order('path', { ascending: true })
          .limit(200);
        if (alive) setFolders((data || []) as FolderRow[]);
      } catch {
        /* folder list optional — root remains available */
      } finally {
        if (alive) setLoadingFolders(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!book) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && phase === 'pick') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [book, onClose, phase]);

  const handleSave = async () => {
    setError(null);
    setPhase('working');
    setProgress(0);
    try {
      setStatus('Finding a readable edition…');
      const url = await resolveEpubUrl(book);
      setStatus('Downloading book…');
      setProgress(8);
      const { bytes } = await fetchEpubBytes(url);
      const file = new File([bytes.buffer as ArrayBuffer], safeFileName(book.title), { type: 'application/epub+zip' });
      setStatus('Encrypting & uploading…');
      const result = await uploadFileWithRes54(file, (p) => {
        setProgress(8 + Math.round((p / 100) * 88));
        if (p >= 100) setStatus('Finishing…');
      });
      if (folderId) {
        const { error: moveErr } = await supabase
          .from('files')
          .update({ parent_folder: folderId })
          .eq('id', result.id);
        if (moveErr) throw new Error('Uploaded, but could not move into the chosen folder.');
      }
      setProgress(100);
      setPhase('done');
      toast({ title: 'Book saved', description: `"${book.title}" is now in your storage.` });
      onSaved?.(result.id);
    } catch (e: any) {
      setError(e?.message || 'Could not save this book. Try again.');
      setPhase('error');
    }
  };

  const chosen = folders.find(f => f.id === folderId);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Save ${book.title}`}>
      <div className="absolute inset-0 bg-black/80 animate-fade-in" onClick={() => phase === 'pick' && onClose()} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 text-foreground shadow-2xl animate-fade-in-scale">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-90">
          <X className="h-4 w-4" />
        </button>

        <h3 className="pr-8 text-lg font-bold tracking-tight">Save to your storage</h3>
        <p className="mt-1 truncate text-sm text-muted-foreground" title={book.title}>
          {book.title}{book.authors[0] ? ` — ${book.authors[0]}` : ''}
        </p>

        {phase === 'pick' && (
          <div className="mt-5">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Choose a folder</p>
            <div className="max-h-56 space-y-1.5 overflow-y-auto pr-0.5">
              <button
                onClick={() => setFolderId(null)}
                aria-pressed={folderId === null}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all active:scale-[0.99]',
                  folderId === null
                    ? 'border-primary/50 bg-primary/[0.08]'
                    : 'border-border bg-muted/40 hover:border-foreground/25'
                )}
              >
                <FolderIcon className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">My Files</span>
                  <span className="block text-[11px] text-muted-foreground">Top level of your storage</span>
                </span>
                {folderId === null && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}
              </button>
              {loadingFolders && (
                <div className="space-y-1.5" aria-hidden="true">
                  {[0, 1, 2].map(i => <div key={i} className="h-[52px] animate-pulse rounded-xl bg-muted/50" />)}
                </div>
              )}
              {folders.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFolderId(f.id)}
                  aria-pressed={folderId === f.id}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all active:scale-[0.99]',
                    folderId === f.id
                      ? 'border-primary/50 bg-primary/[0.08]'
                      : 'border-border bg-muted/40 hover:border-foreground/25'
                  )}
                >
                  <FolderIcon className={cn('h-4 w-4 shrink-0', folderId === f.id ? 'text-primary' : 'text-muted-foreground')} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium">{f.name}</span>
                    <span className="block truncate font-mono text-[10.5px] text-muted-foreground">{f.path || '/'}</span>
                  </span>
                  {folderId === f.id && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}
                </button>
              ))}
            </div>
            <button
              onClick={handleSave}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.99]"
            >
              <Download className="h-4 w-4" />
              Save{chosen ? ` to ${chosen.name}` : ''}
            </button>
          </div>
        )}

        {phase === 'working' && (
          <div className="mt-6 flex flex-col items-center py-4 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="mt-3 text-sm font-medium">{status}</p>
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Save progress">
              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 font-mono text-[11px] tabular-nums text-muted-foreground">{progress}%</p>
          </div>
        )}

        {phase === 'done' && (
          <div className="mt-6 flex flex-col items-center py-2 text-center animate-fade-in">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
              <Check className="h-6 w-6 text-emerald-500" />
            </div>
            <p className="mt-3 text-sm font-semibold">Saved{chosen ? ` to ${chosen.name}` : ''}</p>
            <p className="mt-1 text-xs text-muted-foreground">Find it any time under Files.</p>
            <button
              onClick={onClose}
              className="mt-4 h-10 w-full rounded-xl border border-border text-sm font-medium transition-all hover:bg-accent active:scale-[0.99]"
            >
              Done
            </button>
          </div>
        )}

        {phase === 'error' && (
          <div className="mt-6 flex flex-col items-center py-2 text-center animate-fade-in">
            <p className="max-w-full text-sm text-muted-foreground">{error || 'Something went wrong.'}</p>
            <div className="mt-4 grid w-full gap-2">
              <button
                onClick={handleSave}
                className="h-10 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.99]"
              >
                Try again
              </button>
              <button
                onClick={() => { setPhase('pick'); setError(null); }}
                className="h-10 w-full rounded-xl border border-border text-sm font-medium transition-all hover:bg-accent active:scale-[0.99]"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

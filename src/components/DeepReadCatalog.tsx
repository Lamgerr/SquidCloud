import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Search, BookOpen, Loader2, Bookmark, X,
  ChevronLeft, ChevronRight, Flame, Sparkles, Rocket,
  Feather, Landmark, Brain, History, Download,
} from 'lucide-react';
import {
  searchGutendex, searchAllProviders, resolveEpubUrl, getJson,
  type ProviderBook, type BookSource,
} from '@/lib/book-providers';
import { buildShelf, type RankHistory, type RankedPick } from '@/lib/book-rank';
import SaveBookDialog from '@/components/SaveBookDialog';

const HISTORY_KEY = 'deepread-history-v1';

function loadHistory(): RankHistory[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function authorSurname(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] || name;
}

const TOPICS = [
  { id: 'fiction', label: 'Fiction', icon: BookOpen },
  { id: 'mystery', label: 'Mystery', icon: Search },
  { id: 'science fiction', label: 'Sci-Fi', icon: Rocket },
  { id: 'philosophy', label: 'Philosophy', icon: Brain },
  { id: 'history', label: 'History', icon: Landmark },
  { id: 'poetry', label: 'Poetry', icon: Feather },
] as const;

const HOME_TOPIC_IDS = ['fiction', 'mystery', 'science fiction'] as const;

const SOURCE_LABEL: Record<BookSource, string> = {
  gutendex: 'Gutenberg',
  openlibrary: 'Open Library',
  archive: 'Archive.org',
};

type SortKey = 'popular' | 'newest';

function initialsOf(title: string): string {
  const words = title.replace(/^(the|a|an)\s+/i, '').split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] || '') + (words[1]?.[0] || '')).toUpperCase() || 'BK';
}

function CoverImg({ book, className }: { book: { title: string; coverUrl: string | null }; className?: string }) {
  const [err, setErr] = useState(false);
  if (!book.coverUrl || err) {
    return (
      <div className={cn('flex h-full w-full flex-col items-center justify-center gap-2 bg-muted p-3 text-center', className)}>
        <BookOpen className="h-6 w-6 text-muted-foreground/50" />
        <span className="font-mono text-lg font-bold tracking-widest text-muted-foreground/70">{initialsOf(book.title)}</span>
      </div>
    );
  }
  return (
    <img
      src={book.coverUrl}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setErr(true)}
      className={cn('h-full w-full object-cover', className)}
    />
  );
}

const ShelfShellShared: { refs: Record<string, HTMLDivElement | null> } = { refs: {} };

function ShelfShell({
  id, title, icon: Icon, children, action,
}: {
  id: string; title: string; icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode; action?: React.ReactNode;
}) {
  const scrollBy = (dir: 1 | -1) => {
    const el = ShelfShellShared.refs[id];
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };
  return (
    <section aria-label={title}>
      <div className="mb-3 flex items-center justify-between px-4 sm:px-8">
        <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-foreground">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </h2>
        <div className="flex items-center gap-1">
          {action}
          <button onClick={() => scrollBy(-1)} aria-label={`Scroll ${title} left`} className="hidden h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-90 sm:flex">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => scrollBy(1)} aria-label={`Scroll ${title} right`} className="hidden h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-90 sm:flex">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={(el) => { ShelfShellShared.refs[id] = el; }}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </section>
  );
}

function RankedCard({ pick, index, onOpen }: { pick: RankedPick; index: number; onOpen: () => void }) {
  const { book } = pick;
  return (
    <div
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      tabIndex={0}
      role="button"
      aria-label={`Read ${book.title}`}
      title={pick.reason}
      className="group flex w-[132px] shrink-0 cursor-pointer snap-start flex-col gap-2.5 outline-none sm:w-[148px]"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg border border-border/70 bg-card transition-all duration-300 group-hover:-translate-y-1 group-hover:border-border group-hover:shadow-[0_16px_32px_-12px_rgba(0,0,0,0.55)] group-focus-visible:ring-2 group-focus-visible:ring-ring/50 animate-fade-up [animation-fill-mode:both]" style={{ animationDelay: `${Math.min(index, 11) * 30}ms` }}>
        <CoverImg book={book} />
        <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100">
          <div className="flex h-11 w-11 scale-90 items-center justify-center rounded-full bg-background/90 text-foreground transition-transform duration-200 group-hover:scale-100">
            <BookOpen className="h-5 w-5" />
          </div>
        </div>
        <span className="absolute left-1.5 top-1.5 rounded-md bg-black/65 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white/85 backdrop-blur-sm">
          {book.source === 'gutendex' ? 'GB' : book.source === 'openlibrary' ? 'OL' : 'IA'}
        </span>
      </div>
      <div className="px-0.5">
        <p className="truncate text-[13px] font-semibold leading-snug text-foreground" title={book.title}>{book.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{book.authors[0] || 'Unknown author'}</p>
        <p className="mt-0.5 truncate text-[11px] text-primary/80" title={pick.reason}>{pick.reason}</p>
      </div>
    </div>
  );
}

function ShelfSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden px-4 sm:px-8" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-[132px] shrink-0 sm:w-[148px]">
          <div className="aspect-[2/3] w-full animate-pulse rounded-lg bg-muted/60" />
          <div className="mt-2.5 h-3 w-3/4 animate-pulse rounded bg-muted/60" />
          <div className="mt-1.5 h-2.5 w-1/2 animate-pulse rounded bg-muted/40" />
        </div>
      ))}
    </div>
  );
}

interface ContinueEntry {
  book_key: string;
  title: string | null;
  author: string | null;
  cover_url: string | null;
  progress: number;
  current_page: number;
  total_pages: number;
}

export default function DeepReadCatalog({ files, onBookOpen, onSaved }: { files: any[], onBookOpen: (file: any, source?: 'local' | 'remote') => void, onSaved?: (fileId: string) => void }) {
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'library' | 'discover'>('library');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [sort, setSort] = useState<SortKey>('popular');
  const [topic, setTopic] = useState<string | null>(null);

  const [trending, setTrending] = useState<ProviderBook[]>([]);
  const [shelves, setShelves] = useState<Record<string, ProviderBook[]>>({});
  const [shelfLoading, setShelfLoading] = useState<Record<string, boolean>>({});
  const [gridBooks, setGridBooks] = useState<ProviderBook[]>([]);
  const [gridPage, setGridPage] = useState(1);
  const [gridHasMore, setGridHasMore] = useState(true);
  const [gridLoading, setGridLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [history, setHistory] = useState<RankHistory[]>(loadHistory);
  const [continueList, setContinueList] = useState<ContinueEntry[]>([]);
  const [selectedBook, setSelectedBook] = useState<ProviderBook | null>(null);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [saveBook, setSaveBook] = useState<ProviderBook | null>(null);

  const observer = useRef<IntersectionObserver | null>(null);
  const userBooks = files.filter(f => f.name?.match(/\.(epub|pdf|mobi)$/i));

  useEffect(() => {
    if (userBooks.length === 0 && activeTab === 'library') setActiveTab('discover');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userBooks.length]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Dialog behavior: Escape closes, background page stays put while open
  useEffect(() => {
    if (!infoDialogOpen && !saveBook) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setInfoDialogOpen(false); setSaveBook(null); }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [infoDialogOpen, saveBook]);

  // ── Home shelves (parallel, cached per mount) ──
  useEffect(() => {
    let alive = true;
    const load = async (key: string, run: () => Promise<ProviderBook[]>) => {
      setShelfLoading(prev => ({ ...prev, [key]: true }));
      try {
        const books = await run();
        if (!alive) return;
        if (key === '__trending__') setTrending(books.slice(0, 12));
        else setShelves(prev => ({ ...prev, [key]: books.slice(0, 10) }));
      } catch {
        /* a failed shelf stays empty — others still render */
      } finally {
        if (alive) setShelfLoading(prev => ({ ...prev, [key]: false }));
      }
    };
    load('__trending__', async () => (await searchGutendex({ sort: 'popular', page: 1 })).books);
    HOME_TOPIC_IDS.forEach(t =>
      load(t, async () => (await searchGutendex({ topic: t, sort: 'popular', page: 1 })).books)
    );
    return () => { alive = false; };
  }, []);

  // ── Continue reading (server progress) ──
  const refreshContinue = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('list_remote_progress', { p_limit: 12 });
      if (error) return;
      setContinueList(((data || []) as any[]).filter(r => (r.progress || 0) < 100));
    } catch { /* progress is a bonus, never a blocker */ }
  }, []);
  useEffect(() => { refreshContinue(); }, [refreshContinue, activeTab ]);

  // ── Grid mode (unified multi-provider search / topic) ──
  const gridMode = debouncedSearch.trim() !== '' || topic !== null;
  useEffect(() => {
    if (!gridMode) return;
    let alive = true;
    setGridPage(1);
    setGridBooks([]);
    setGridHasMore(true);
    setCatalogError(null);
    (async () => {
      setGridLoading(true);
      try {
        const { searchAllProviders } = await import('@/lib/book-providers');
        const { books } = await searchAllProviders({
          query: debouncedSearch.trim() || undefined,
          topic: topic || undefined,
          sort, page: 1, limit: 24,
        });
        if (!alive) return;
        setGridBooks(books);
        setGridHasMore(books.length >= 24);
      } catch {
        if (alive) setCatalogError('Could not reach the book catalogs. Check your connection and try again.');
      } finally {
        if (alive) setGridLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [gridMode, debouncedSearch, topic, sort]);

  const loadMoreGrid = useCallback(async () => {
    if (gridLoading || !gridHasMore) return;
    setGridLoading(true);
    try {
      const { searchAllProviders } = await import('@/lib/book-providers');
      const next = gridPage + 1;
      const { books } = await searchAllProviders({
        query: debouncedSearch.trim() || undefined,
        topic: topic || undefined,
        sort, page: next, limit: 24,
      });
      setGridBooks(prev => [...prev, ...books]);
      setGridPage(next);
      setGridHasMore(books.length >= 24);
    } catch {
      /* keep what we have */
    } finally {
      setGridLoading(false);
    }
  }, [gridLoading, gridHasMore, gridPage, topic, sort, debouncedSearch]);

  const lastGridRef = useCallback((node: HTMLDivElement | null) => {
    if (gridLoading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMoreGrid();
    });
    if (node) observer.current.observe(node);
  }, [gridLoading, loadMoreGrid]);

  const recordOpen = useCallback((book: ProviderBook) => {
    setHistory(prev => {
      const entry = {
        key: book.key,
        title: book.title,
        author: book.authors[0] || '',
        subjects: (book.subjects || []).slice(0, 6),
      };
      const next = [entry, ...prev.filter(h => h.key !== book.key)].slice(0, 20);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  }, []);

  const openRemote = useCallback(async (book: ProviderBook) => {
    try {
      const url = await resolveEpubUrl(book);
      recordOpen(book);
      setInfoDialogOpen(false);
      onBookOpen({
        name: book.title + '.epub',
        url,
        bookKey: book.key,
        bookTitle: book.title,
        bookAuthor: book.authors[0] || '',
        bookCover: book.coverUrl,
        bookSubjects: book.subjects,
      }, 'remote');
    } catch (e: any) {
      toast({ title: 'No readable edition', description: e?.message || 'This title has no downloadable EPUB right now.', variant: 'destructive' });
    }
  }, [onBookOpen, recordOpen, toast]);

  const openLocal = useCallback((file: any) => {
    onBookOpen(file, 'local');
  }, [onBookOpen]);

  const resumeEntry = useCallback(async (entry: ContinueEntry) => {
    try {
      let book: ProviderBook | null = null;
      const [src, ...rest] = (entry.book_key || '').split(':');
      const id = rest.join(':');
      if (src === 'gutendex' && id) {
        const data = await getJson(`https://gutendex.com/books/${encodeURIComponent(id)}`);
        const b = data;
        book = {
          key: entry.book_key, source: 'gutendex', sourceId: id,
          title: entry.title || b.title, authors: (b.authors || []).map((a: any) => a.name),
          subjects: b.subjects || [], coverUrl: entry.cover_url || b.formats?.['image/jpeg'] || null,
          popularity: b.download_count || 0, year: null,
          epubUrl: b.formats?.['application/epub+zip'] || null, iaId: null, olKey: null,
        };
      } else if (src === 'ia' && id) {
        const { resolveEpubUrl: resolve } = await import('@/lib/book-providers');
        const url = await resolve({ key: entry.book_key, source: 'archive', sourceId: id, title: entry.title || id, authors: entry.author ? [entry.author] : [], subjects: [], coverUrl: entry.cover_url, popularity: 0, year: null, epubUrl: null, iaId: id, olKey: null });
        onBookOpen({ name: (entry.title || id) + '.epub', url, bookKey: entry.book_key, bookTitle: entry.title, bookAuthor: entry.author, bookCover: entry.cover_url }, 'remote');
        return;
      } else if (src === 'ol' && id) {
        const data = await getJson(`https://openlibrary.org/search.json?q=${encodeURIComponent(entry.title || '')}&limit=5&fields=key,title,author_name,cover_i,ia,ebook_access`);
        const d = (data.docs || [])[0];
        if (!d) throw new Error('Could not find this edition again.');
        const iaId = Array.isArray(d.ia) ? d.ia[0] : d.ia;
        const { resolveEpubUrl: resolve } = await import('@/lib/book-providers');
        const url = await resolve({ key: entry.book_key, source: 'openlibrary', sourceId: id, title: entry.title || d.title, authors: entry.author ? [entry.author] : (d.author_name || []), subjects: [], coverUrl: entry.cover_url, popularity: 0, year: null, epubUrl: null, iaId, olKey: id });
        onBookOpen({ name: (entry.title || d.title) + '.epub', url, bookKey: entry.book_key, bookTitle: entry.title, bookAuthor: entry.author, bookCover: entry.cover_url }, 'remote');
        return;
      } else {
        throw new Error('Saved with an older version — please open it fresh from Discover.');
      }
      if (book) await openRemote(book);
    } catch (e: any) {
      toast({ title: 'Could not resume', description: e?.message || 'Try opening it fresh from Discover.', variant: 'destructive' });
    }
  }, [onBookOpen, openRemote, toast]);

  // ── Curation: pool → ranked shelves ──
  const pool = useMemo(() => {
    const map = new Map<string, ProviderBook>();
    trending.forEach(b => map.set(b.key, b));
    Object.values(shelves).flat().forEach(b => map.set(b.key, b));
    return [...map.values()];
  }, [trending, shelves]);

  const forYou = useMemo(() => {
    if (pool.length === 0) return [];
    return buildShelf(pool, history, 10);
  }, [pool, history]);

  const because = useMemo(() => {
    const last = history[0];
    if (!last?.author || pool.length === 0) return null;
    const surname = authorSurname(last.author).toLowerCase();
    const mine = pool.filter(b => b.key !== last.key && b.authors.some(a => a.toLowerCase().includes(surname))).slice(0, 8);
    return mine.length > 0 ? { label: `More by ${last.author}`, books: mine } : null;
  }, [pool, history]);

  const clearGridMode = () => {
    setSearch('');
    setDebouncedSearch('');
    setTopic(null);
  };

  const showHome = activeTab === 'discover' && !gridMode;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      {/* ═══ HEADER ═══ */}
      <header className="z-30 shrink-0 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-5">
          {!showMobileSearch && (
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary sm:h-11 sm:w-11">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">DeepRead</h1>
                {!isMobile && <p className="truncate text-[13px] text-muted-foreground">Your private digital library</p>}
              </div>
            </div>
          )}

          {!isMobile && (
            <div className="flex shrink-0 items-center gap-2.5">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text" placeholder="Search every catalog: titles, authors, topics…"
                  className="w-64 rounded-xl border border-border bg-muted/50 py-2.5 pl-10 pr-4 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/50 focus:bg-muted lg:w-80"
                  value={search} onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
          )}

          {isMobile && (
            <div className={cn('flex items-center gap-2', showMobileSearch ? 'w-full' : 'w-auto')}>
              {showMobileSearch ? (
                <div className="flex w-full items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      autoFocus type="text" placeholder="Search every catalog…"
                      className="w-full rounded-xl border border-border bg-muted/50 py-2 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
                      value={search} onChange={e => setSearch(e.target.value)}
                    />
                  </div>
                  <button onClick={() => { setShowMobileSearch(false); setSearch(''); }} className="shrink-0 text-sm font-medium text-muted-foreground active:scale-95">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setShowMobileSearch(true)} aria-label="Search books" className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted/50 text-muted-foreground transition-all hover:text-foreground active:scale-90">
                  <Search className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* ═══ TABS ═══ */}
        <div className="flex items-center gap-6 px-4 sm:px-8">
          {(['library', 'discover'] as const).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={cn('relative py-2 text-sm font-semibold transition-colors sm:text-[15px]', activeTab === t ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80')}
            >
              {t === 'library' ? `My Library${userBooks.length > 0 ? ` (${userBooks.length})` : ''}` : 'Discover'}
              {activeTab === t && <motion.div layoutId="dr-tab" className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-primary" />}
            </button>
          ))}
        </div>
      </header>

      {/* ═══ CONTENT ═══ */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-24">
        {activeTab === 'library' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="p-4 sm:p-8">
            {userBooks.length === 0 ? (
              <div className="mx-auto mt-10 flex w-full max-w-md flex-col items-center rounded-3xl border border-dashed border-border bg-card/50 p-8 text-center sm:mt-16 sm:p-12 animate-fade-in">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Bookmark className="h-8 w-8" /></div>
                <h3 className="text-lg font-bold text-foreground">Your library is empty</h3>
                <p className="mt-1 text-sm text-muted-foreground">Save books from Discover and they live here forever.</p>
                <button onClick={() => setActiveTab('discover')} className="mt-6 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-95">
                  Browse free books
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {userBooks.map((file, i) => (
                  <div
                    key={file.id}
                    onClick={() => openLocal(file)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLocal(file); } }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Read ${file.name}`}
                    className="group flex cursor-pointer flex-col gap-2.5 rounded-xl outline-none animate-fade-up [animation-fill-mode:both] focus-visible:ring-2 focus-visible:ring-ring/50"
                    style={{ animationDelay: `${Math.min(i, 11) * 30}ms` }}
                  >
                    <div className="flex aspect-[2/3] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-border/70 bg-card p-3 text-center transition-all duration-300 group-hover:-translate-y-1 group-hover:border-border group-hover:shadow-[0_16px_32px_-12px_rgba(0,0,0,0.55)]">
                      <BookOpen className="h-8 w-8 text-muted-foreground/60" />
                      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">{String(file.name).split('.').pop()}</span>
                    </div>
                    <div className="px-0.5">
                      <p className="truncate text-[13px] font-semibold text-foreground">{file.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">On this device</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'discover' && showHome && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-8 py-6">
            {/* Continue reading */}
            {continueList.length > 0 && (
              <ShelfShell id="continue" title="Continue reading" icon={Clock}>
                {continueList.map(c => (
                  <div key={c.book_key} className="w-[160px] shrink-0 snap-start sm:w-[180px]">
                    <button
                      onClick={() => resumeEntry(c)}
                      className="group block w-full overflow-hidden rounded-lg border border-border/70 bg-card text-left transition-all duration-300 hover:-translate-y-1 hover:border-border hover:shadow-[0_16px_32px_-12px_rgba(0,0,0,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                        {c.cover_url
                          ? <img src={c.cover_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover object-top" />
                          : <div className="flex h-full w-full items-center justify-center"><BookOpen className="h-6 w-6 text-muted-foreground/50" /></div>}
                        <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-white backdrop-blur-sm">{c.progress}%</span>
                      </div>
                      <div className="p-2.5">
                        <p className="truncate text-[13px] font-semibold text-foreground" title={c.title || undefined}>{c.title || 'Untitled'}</p>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={c.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Progress in ${c.title}`}>
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${c.progress}%` }} />
                        </div>
                      </div>
                    </button>
                  </div>
                ))}
              </ShelfShell>
            )}

            {/* Topic chips */}
            <div className="flex gap-2 overflow-x-auto px-4 pb-1 sm:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Browse by topic">
              {TOPICS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTopic(t.id)}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-[13px] font-medium text-muted-foreground transition-all hover:border-foreground/25 hover:text-foreground active:scale-95"
                >
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Picked for you */}
            {forYou.length > 0 && (
              <ShelfShell id="foryou" title="Picked for you" icon={Sparkles}>
                {forYou.map((p, i) => (
                  <RankedCard key={p.book.key} pick={p} index={i} onOpen={() => { setSelectedBook(p.book); setInfoDialogOpen(true); }} />
                ))}
              </ShelfShell>
            )}

            {/* Because you read */}
            {because && (
              <ShelfShell id="because" title={because.label} icon={History}>
                {because.books.map((b, i) => (
                  <BookCardSimple key={b.key} book={b} index={i} onOpen={() => { setSelectedBook(b); setInfoDialogOpen(true); }} />
                ))}
              </ShelfShell>
            )}

            {/* Trending */}
            <ShelfShell id="trending" title="Trending now" icon={Flame}>
              {shelfLoading['__trending__'] && trending.length === 0
                ? <ShelfSkeleton count={6} />
                : trending.map((b, i) => (
                  <BookCardSimple key={b.key} book={b} index={i} onOpen={() => { setSelectedBook(b); setInfoDialogOpen(true); }} />
                ))}
            </ShelfShell>

            {/* Topic shelves */}
            {HOME_TOPIC_IDS.map(tid => {
              const meta = TOPICS.find(t => t.id === tid)!;
              const items = shelves[tid] || [];
              if (!shelfLoading[tid] && items.length === 0) return null;
              return (
                <ShelfShell key={tid} id={`topic-${tid}`} title={meta.label} icon={meta.icon} action={
                  <button onClick={() => setTopic(tid)} className="mr-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">See all</button>
                }>
                  {shelfLoading[tid] && items.length === 0
                    ? <ShelfSkeleton count={6} />
                    : items.map((b, i) => (
                      <BookCardSimple key={b.key} book={b} index={i} onOpen={() => { setSelectedBook(b); setInfoDialogOpen(true); }} />
                    ))}
                </ShelfShell>
              );
            })}
          </motion.div>
        )}

        {activeTab === 'discover' && !showHome && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="p-4 sm:p-8">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <button onClick={clearGridMode} className="rounded-full border border-border bg-card px-3.5 py-2 text-[13px] font-medium text-muted-foreground transition-all hover:border-foreground/25 hover:text-foreground active:scale-95">
                ← All browsing
              </button>
              {(['popular', 'newest'] as SortKey[]).map(s => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  aria-pressed={sort === s}
                  className={cn('rounded-full px-3.5 py-2 text-[13px] font-medium transition-all active:scale-95', sort === s ? 'bg-primary/15 text-primary' : 'border border-border bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground')}
                >
                  {s === 'popular' ? 'Most popular' : 'Newest'}
                </button>
              ))}
              {topic && <span className="px-1 text-[13px] font-semibold capitalize text-foreground">{topic}</span>}
              {debouncedSearch.trim() && <span className="px-1 text-[13px] text-muted-foreground">“{debouncedSearch.trim()}”</span>}
            </div>

            {catalogError && (
              <div className="mb-5 rounded-xl border border-destructive/25 bg-destructive/[0.06] p-4 text-sm text-muted-foreground" role="alert">
                {catalogError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {gridBooks.map((b, i) => (
                <div key={b.key} ref={i === gridBooks.length - 1 ? lastGridRef : undefined}>
                  <div className="animate-fade-up [animation-fill-mode:both]" style={{ animationDelay: `${Math.min(i % 12, 11) * 25}ms` }}>
                    <BookCardSimple book={b} index={0} onOpen={() => { setSelectedBook(b); setInfoDialogOpen(true); }} />
                  </div>
                </div>
              ))}
            </div>

            {gridLoading && (
              <div className="flex items-center justify-center gap-2.5 py-10 text-sm font-medium text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading more books…
              </div>
            )}
            {!gridLoading && gridBooks.length === 0 && !catalogError && (
              <p className="py-10 text-center text-sm text-muted-foreground">No books found. Try different words.</p>
            )}
          </motion.div>
        )}
      </div>

      {/* ═══ BOOK INFO DIALOG — portal so it escapes all stacking contexts ═══ */}
      {infoDialogOpen && selectedBook && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={selectedBook.title}
        >
          <div className="absolute inset-0 bg-black/80 animate-fade-in" onClick={() => setInfoDialogOpen(false)} />
          <div className={cn(
            'relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto border border-border bg-card text-foreground shadow-2xl animate-fade-in-scale rounded-3xl p-8',
          )}>
            <button onClick={() => setInfoDialogOpen(false)} aria-label="Close details" className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-90">
              <X className="h-4 w-4" />
            </button>
            <div className="flex gap-8">
              <div className="shrink-0">
                <div className="w-48 overflow-hidden rounded-xl border border-border">
                  <CoverImg book={selectedBook} className="aspect-[2/3]" />
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center text-left">
                <h3 className="font-bold leading-tight tracking-tight text-foreground text-3xl">{selectedBook.title}</h3>
                {selectedBook.authors[0] && (
                  <button
                    onClick={() => { const a = selectedBook.authors[0]; setInfoDialogOpen(false); setActiveTab('discover'); setTopic(null); setSearch(a); }}
                    className="mt-1.5 text-[15px] font-medium text-muted-foreground transition-colors hover:text-primary"
                    title={`More by ${selectedBook.authors[0]}`}
                  >
                    {selectedBook.authors[0]} →
                  </button>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-muted px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{SOURCE_LABEL[selectedBook.source]}</span>
                  {selectedBook.year && <span className="text-xs tabular-nums text-muted-foreground">{selectedBook.year}</span>}
                  <span className="text-xs tabular-nums text-muted-foreground">{selectedBook.popularity > 0 ? `${selectedBook.popularity.toLocaleString()} reads` : 'Reader favorite'}</span>
                </div>
                {selectedBook.subjects && selectedBook.subjects.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedBook.subjects.slice(0, 4).map(s => (
                      <button
                        key={s}
                        onClick={() => { setInfoDialogOpen(false); setActiveTab('discover'); setTopic(null); setSearch(s.split(' -- ')[0]); }}
                        className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] text-muted-foreground transition-all hover:border-foreground/25 hover:text-foreground active:scale-95"
                      >
                        {s.length > 28 ? s.slice(0, 28) + '…' : s}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className={cn('flex items-center gap-1.5', selectedBook.epubUrl || selectedBook.iaId ? 'text-foreground' : 'opacity-40')}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', selectedBook.epubUrl || selectedBook.iaId ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
                    EPUB
                  </span>
                  <span className="opacity-40">PDF on request</span>
                </div>
                <div className="mt-6 grid gap-2">
                  <button
                    onClick={() => openRemote(selectedBook)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98]"
                  >
                    <BookOpen className="h-4 w-4" /> Read now
                  </button>
                  <button
                    onClick={() => { setInfoDialogOpen(false); setSaveBook(selectedBook); }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-medium transition-all hover:bg-accent active:scale-[0.98]"
                  >
                    <Download className="h-4 w-4" /> Save to my storage
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ═══ SAVE DIALOG ═══ */}
      {saveBook && (
        <SaveBookDialog
          book={saveBook}
          onClose={() => setSaveBook(null)}
          onSaved={(fileId) => { onSaved?.(fileId); setActiveTab('library'); }}
        />
      )}
    </div>
  );
}

/* Plain (unranked) card for trending / topic / grid rows. */
function BookCardSimple({ book, index, onOpen }: { book: ProviderBook; index: number; onOpen: () => void }) {
  return (
    <div
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      tabIndex={0}
      role="button"
      aria-label={`Read ${book.title}`}
      className="group flex w-[132px] shrink-0 cursor-pointer snap-start flex-col gap-2.5 outline-none sm:w-[148px]"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg border border-border/70 bg-card transition-all duration-300 group-hover:-translate-y-1 group-hover:border-border group-hover:shadow-[0_16px_32px_-12px_rgba(0,0,0,0.55)] group-focus-visible:ring-2 group-focus-visible:ring-ring/50 animate-fade-up [animation-fill-mode:both]" style={{ animationDelay: `${Math.min(index, 11) * 30}ms` }}>
        <CoverImg book={book} />
        <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100">
          <div className="flex h-11 w-11 scale-90 items-center justify-center rounded-full bg-background/90 text-foreground transition-transform duration-200 group-hover:scale-100">
            <BookOpen className="h-5 w-5" />
          </div>
        </div>
        <span className="absolute left-1.5 top-1.5 rounded-md bg-black/65 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white/85 backdrop-blur-sm">
          {book.source === 'gutendex' ? 'GB' : book.source === 'openlibrary' ? 'OL' : 'IA'}
        </span>
      </div>
      <div className="px-0.5">
        <p className="truncate text-[13px] font-semibold leading-snug text-foreground" title={book.title}>{book.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{book.authors[0] || 'Unknown author'}</p>
      </div>
    </div>
  );
}

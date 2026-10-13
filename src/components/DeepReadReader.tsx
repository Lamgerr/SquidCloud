import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  X, Sun, Moon, Type, Loader2, ChevronLeft, ChevronRight,
  Minus, Plus, Search, List, Maximize, Shrink, Clock,
  BookmarkPlus, BookmarkCheck, Focus, AlertCircle, PenTool
} from 'lucide-react';
import { EpubEngine, EpubPageInfo, EpubTocItem } from '@/lib/epub-engine';
import { smartDownload } from '@/lib/api';
import { saveReadingProgress, loadReadingProgress, saveRemoteProgress, loadRemoteProgress } from '@/lib/deepread-service';
import type { FileItem as FileItemType } from '@/lib/api';
import { useIsMobile } from '@/hooks/use-mobile';
import OptimizedPDFViewer from '@/components/OptimizedPDFViewer';
import InkCanvas from '@/components/editor/InkCanvas';

const THEMES = {
  day: { bg: '#F9F7F1', fg: '#2A2825', accent: '#8B7355', label: 'Day', icon: Sun },
  sepia: { bg: '#F4ECD8', fg: '#433422', accent: '#A67B5B', label: 'Sepia', icon: Type },
  dark: { bg: '#0A0A0A', fg: '#D4D4D4', accent: '#8AB4C4', label: 'Dark', icon: Moon },
  gray: { bg: '#E8E8E8', fg: '#1A1A1A', accent: '#4A5B64', label: 'Gray', icon: Focus },
} as const;

type ThemeKey = keyof typeof THEMES;

interface Bookmark {
  cfi: string;
  label: string;
  page: number;
}

const STORAGE_KEYS = {
  theme: 'deepread_theme',
  fontSize: 'deepread_fontSize',
  fontFamily: 'deepread_fontFamily',
  lineHeight: 'deepread_lineHeight',
  bookmarks: (id: string) => `deepread_bookmarks_${id || 'remote'}`,
};

function loadSetting<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; } catch { return fallback; }
}

export default function DeepReadReader({ file, source, isOpen, onClose }: { file: any, source: 'local'|'remote', isOpen: boolean, onClose: () => void }) {
  const isMobile = useIsMobile();
  const [theme, setTheme] = useState<ThemeKey>(() => loadSetting(STORAGE_KEYS.theme, 'dark'));
  const [showUI, setShowUI] = useState(true);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const readerContainerRef = useRef<HTMLDivElement>(null);

  const [isAnnotating, setIsAnnotating] = useState(false);
  const [strokes, setStrokes] = useState<any[]>([]);

  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const [tocItems, setTocItems] = useState<EpubTocItem[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ sectionIndex: number; text: string; snippet: string }[]>([]);
  const [searching, setSearching] = useState(false);

  const [fontSize, setFontSize] = useState(() => loadSetting(STORAGE_KEYS.fontSize, 18));
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans'>(() => loadSetting(STORAGE_KEYS.fontFamily, 'serif'));
  const [lineHeight, setLineHeight] = useState(() => loadSetting(STORAGE_KEYS.lineHeight, 1.6));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decryptedBlob, setDecryptedBlob] = useState<Blob | null>(null);

  const [progressPct, setProgressPct] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [currentCfi, setCurrentCfi] = useState<string | null>(null);

  const [readingMinutes, setReadingMinutes] = useState(0);
  const sessionStart = useRef(Date.now());

  const viewerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<EpubEngine | null>(null);
  const epubReadyRef = useRef(false);
  const restoredRef = useRef(false);

  const isPDF = file?.name?.toLowerCase().endsWith('.pdf');
  const isEPUB = file?.name?.toLowerCase().endsWith('.epub') || source === 'remote';
  const fileId = file?.id || file?.url || 'unknown';
  // Stable server key for catalog books (set by DeepReadCatalog.openRemote).
  const remoteKey: string | null = typeof file?.bookKey === 'string' && file.bookKey ? file.bookKey : null;

  useEffect(() => {
    if (!isOpen) return;
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isOpen]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.theme, JSON.stringify(theme));
    localStorage.setItem(STORAGE_KEYS.fontSize, JSON.stringify(fontSize));
    localStorage.setItem(STORAGE_KEYS.fontFamily, JSON.stringify(fontFamily));
    localStorage.setItem(STORAGE_KEYS.lineHeight, JSON.stringify(lineHeight));
  }, [theme, fontSize, fontFamily, lineHeight]);

  useEffect(() => {
    if (!isOpen || !fileId) return;
    restoredRef.current = false;
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.bookmarks(fileId));
      if (saved) setBookmarks(JSON.parse(saved));
    } catch {}
  }, [isOpen, fileId]);

  // ─── Remote reading progress: restore once the engine knows the book ───
  useEffect(() => {
    if (!isOpen || !remoteKey || !isEPUB || totalPages <= 0 || restoredRef.current) return;
    restoredRef.current = true;
    (async () => {
      try {
        const saved = await loadRemoteProgress(remoteKey);
        if (saved && saved.progress > 1 && saved.progress < 100 && engineRef.current) {
          engineRef.current.goToPercentage(saved.progress);
        }
      } catch { /* start from the beginning */ }
    })();
  }, [isOpen, remoteKey, isEPUB, totalPages]);

  // ─── Remote reading progress: debounced save while reading ───
  useEffect(() => {
    if (!isOpen || !remoteKey || !isEPUB || totalPages <= 0 || !restoredRef.current) return;
    const t = setTimeout(() => {
      saveRemoteProgress(remoteKey, progressPct, currentPage, totalPages, {
        title: file?.bookTitle || file?.name,
        author: file?.bookAuthor,
        coverUrl: file?.bookCover || null,
        subjects: file?.bookSubjects,
      }).catch(() => {});
    }, 2500);
    return () => clearTimeout(t);
  }, [isOpen, remoteKey, isEPUB, totalPages, currentPage, progressPct, file]);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try { await readerContainerRef.current?.requestFullscreen(); } catch {}
    } else {
      if (document.exitFullscreen) await document.exitFullscreen();
    }
  };

  // ─── 1. SECURE PAYLOAD FETCH ───
  useEffect(() => {
    let isMounted = true;
    const fetchPayload = async () => {
      if (!isOpen) return;
      setLoading(true);
      setError(null);

      // Never hang forever: surface slow networks as a visible error
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 25000);

      try {
        if (source === 'local' && file?.id) {
          const blob = await smartDownload(file.id);
          if (isMounted) setDecryptedBlob(blob);
        } else if (source === 'remote' && file?.url) {
          let fetchUrl = file.url;

          if (fetchUrl.includes('gutenberg.org')) {
            const match = fetchUrl.match(/\/ebooks\/(\d+)/);
            // Some ids only have the plain file, others only the -images
            // file — try both through the same-origin proxy (gutenberg
            // sends no CORS headers, so direct browser fetch is blocked).
            const candidates: string[] = [];
            if (match) {
              const id = match[1];
              candidates.push(`https://www.gutenberg.org/cache/epub/${id}/pg${id}-images.epub`);
              candidates.push(`https://www.gutenberg.org/cache/epub/${id}/pg${id}.epub`);
            } else {
              candidates.push(fetchUrl);
            }
            let blob: Blob | null = null;
            let lastStatus = 0;
            for (const cand of candidates) {
              const proxyUrl = `/api/epub-proxy?url=${encodeURIComponent(cand)}`;
              const res = await fetch(proxyUrl, { signal: controller.signal });
              if (!res.ok) { lastStatus = res.status; continue; }
              const b = await res.blob();
              if (b.type.includes('text/html') || b.type.includes('application/json') || b.size < 5000) continue;
              blob = b;
              break;
            }
            if (!blob) throw new Error(`Could not download the book${lastStatus ? ` (HTTP ${lastStatus})` : ''}. Please try a different title.`);
            if (isMounted) setDecryptedBlob(blob);
          } else {
            const PROXIES = [
              (url: string) => url,
              (url: string) => `/api/epub-proxy?url=${encodeURIComponent(url)}`,
              (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
              (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
            ];

            let success = false;
            for (const proxyFn of PROXIES) {
              try {
                const proxyUrl = proxyFn(fetchUrl);
                const res = await fetch(proxyUrl, { signal: controller.signal });
                if (!res.ok) continue;
                const blob = await res.blob();
                if (blob.type.includes('text/html') || blob.type.includes('application/json') || blob.size < 5000) continue;
                if (isMounted) setDecryptedBlob(blob);
                success = true;
                break;
              } catch { continue; }
            }

            if (!success) {
              if (controller.signal.aborted) {
                throw new Error("The download is taking too long. Check your connection and try again.");
              }
              throw new Error("Could not download the book. Please try a different title.");
            }
          }
        } else {
          throw new Error("Could not open this book — the file reference is missing.");
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          if (isMounted) setError("The download is taking too long. Check your connection and try again.");
        } else if (isMounted) {
          setError(err.message || "Failed to load book.");
        }
      } finally {
        window.clearTimeout(timer);
        if (isMounted) setLoading(false);
      }
    };

    fetchPayload();
    return () => { isMounted = false; };
  }, [file, source, isOpen]);

  // ─── 2. CUSTOM EPUB ENGINE ───
  useEffect(() => {
    if (!isEPUB || !decryptedBlob || !viewerRef.current || !isOpen || loading) return;

    let isMounted = true;

    const initEpub = async () => {
      try {
        if (engineRef.current) {
          await engineRef.current.destroy();
          engineRef.current = null;
        }
        if (viewerRef.current) viewerRef.current.innerHTML = '';

        const arrayBuffer = await decryptedBlob.arrayBuffer();

        const engine = new EpubEngine();
        engineRef.current = engine;

        await engine.load(arrayBuffer);
        if (!isMounted || !viewerRef.current) return;

        engine.onPageChange = (info: EpubPageInfo) => {
          if (!isMounted) return;
          setProgressPct(info.percentage);
          setTotalPages(info.totalPages);
          setCurrentPage(info.pageIndex + 1);
          setCurrentCfi(`epub:${info.sectionIndex}:${info.sectionHref}`);
        };

        await engine.render(viewerRef.current, 0);
        if (!isMounted) return;

        epubReadyRef.current = true;

        engine.applyTheme({
          bg: THEMES[theme].bg,
          fg: THEMES[theme].fg,
          accent: THEMES[theme].accent,
        });
        engine.setFont(fontSize);
        engine.setFontFamily(fontFamily);
        engine.setLineHeight(lineHeight);

        const toc = engine.getToc();
        if (toc.length > 0) {
          setTocItems(toc);
        } else {
          const sections = engine.sectionCount;
          const autoToc: EpubTocItem[] = [];
          for (let i = 0; i < sections; i++) {
            autoToc.push({ label: `Section ${i + 1}`, href: `#${i}` });
          }
          setTocItems(autoToc);
        }

      } catch (err: any) {
        console.error("EPUB Engine Error:", err);
        if (isMounted) setError("Failed to parse the EPUB file. It might be corrupted.");
      }
    };

    initEpub();

    return () => {
      isMounted = false;
      epubReadyRef.current = false;
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, [isEPUB, decryptedBlob, isOpen, loading]);

  // ─── 3. DYNAMIC THEMES & FONTS ───
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.applyTheme({
      bg: THEMES[theme].bg,
      fg: THEMES[theme].fg,
      accent: THEMES[theme].accent,
    });
  }, [theme]);

  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setFont(fontSize);
  }, [fontSize]);

  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setFontFamily(fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setLineHeight(lineHeight);
  }, [lineHeight]);

  const next = () => {
    if (!engineRef.current || !epubReadyRef.current) return;
    engineRef.current.nextPage();
  };
  const prev = () => {
    if (!engineRef.current || !epubReadyRef.current) return;
    engineRef.current.prevPage();
  };

  const handleOuterTap = useCallback(() => {
    setShowToc(false);
    setShowSettings(false);
    setShowBookmarks(false);
    setShowSearch(false);
  }, []);

  const goToCfi = useCallback((cfi: string) => {
    if (!engineRef.current || !epubReadyRef.current) return;
    try {
      if (cfi.startsWith('epub:')) {
        const parts = cfi.split(':');
        if (parts.length >= 3) {
          const href = parts.slice(2).join(':');
          engineRef.current.goToHref(href);
        }
      } else {
        engineRef.current.goToHref(cfi);
      }
    } catch {}
    setShowToc(false); setShowSearch(false); setShowBookmarks(false); setShowUI(false);
  }, []);

  // ─── 5. UI ACTIONS ───
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
    if (showUI) resetHideTimer();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPDF) return;
    if (!pointerStart.current) return;
    const dx = Math.abs(e.clientX - pointerStart.current.x);
    const dy = Math.abs(e.clientY - pointerStart.current.y);
    pointerStart.current = null;
    if (dx > 10 || dy > 10) return;

    setShowUI(u => !u);
    setShowSettings(false);
    setShowToc(false);
    setShowBookmarks(false);
    setShowSearch(false);
  };

  const performSearch = useCallback(async () => {
    if (!searchQuery.trim() || !engineRef.current) return;
    setSearching(true); setSearchResults([]);
    try {
      const results = await engineRef.current.search(searchQuery);
      setSearchResults(results.map(r => ({
        sectionIndex: r.sectionIndex,
        text: r.text,
        snippet: r.snippet,
      })));
    } catch {} finally { setSearching(false); }
  }, [searchQuery]);

  const addBookmark = useCallback(() => {
    if (!currentCfi || !fileId) return;
    if (bookmarks.some(b => b.cfi === currentCfi)) return;
    const newBookmark: Bookmark = { cfi: currentCfi, label: `Page ${currentPage}`, page: currentPage };
    const updated = [...bookmarks, newBookmark];
    setBookmarks(updated);
    try { localStorage.setItem(STORAGE_KEYS.bookmarks(fileId), JSON.stringify(updated)); } catch {}
  }, [bookmarks, fileId, currentCfi, currentPage]);

  const removeBookmark = useCallback((cfi: string) => {
    if (!fileId) return;
    const updated = bookmarks.filter(b => b.cfi !== cfi);
    setBookmarks(updated);
    try { localStorage.setItem(STORAGE_KEYS.bookmarks(fileId), JSON.stringify(updated)); } catch {}
  }, [bookmarks, fileId]);

  useEffect(() => {
    if (loading || error || !isOpen) return;
    const interval = setInterval(() => { setReadingMinutes(Math.floor((Date.now() - sessionStart.current) / 60000)); }, 60000);
    return () => clearInterval(interval);
  }, [loading, error, isOpen]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [isOpen]);

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setShowUI(false);
      setShowSettings(false);
      setShowToc(false);
      setShowBookmarks(false);
      setShowSearch(false);
    }, 4000);
  }, []);

  useEffect(() => {
    if (showUI) resetHideTimer();
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, [showUI, resetHideTimer]);

  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (showUI) {
        setShowUI(false);
        setShowSettings(false);
        setShowToc(false);
        setShowBookmarks(false);
        setShowSearch(false);
      }
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, [isOpen, loading]);

  if (!isOpen) return null;
  const bookmarked = currentCfi ? bookmarks.some(b => b.cfi === currentCfi) : false;

  return (
    <div
      ref={readerContainerRef}
      className="fixed inset-0 z-[200] flex flex-col overflow-hidden font-serif transition-colors duration-500"
      style={{ backgroundColor: THEMES[theme].bg, color: THEMES[theme].fg }}
    >
      {/* ═══ HEADER ═══ */}
      <AnimatePresence>
        {showUI && (
          <motion.header
            initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -100, opacity: 0 }} transition={{ duration: 0.2 }}
            className="absolute top-0 inset-x-0 h-16 bg-background/95 border-b border-border flex items-center justify-between px-4 sm:px-6 z-50 shadow-2xl"
          >
            <div className="flex items-center gap-2 sm:gap-4">
              <button onClick={onClose} className="flex items-center gap-1 sm:gap-2 text-muted-foreground hover:text-foreground transition-colors p-1.5 sm:p-0 rounded-lg hover:bg-accent/60 sm:hover:bg-transparent">
                <ChevronLeft className="w-6 h-6 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline text-sm font-sans font-bold uppercase tracking-wider">Library</span>
              </button>
            </div>

            <div className="font-sans font-bold text-sm text-foreground/80 tracking-wide truncate px-4 flex-1 text-center max-w-[50%] sm:max-w-md">
              {file?.title || file?.name}
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              <button onClick={bookmarked && currentCfi ? () => removeBookmark(currentCfi) : addBookmark} className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                {bookmarked ? <BookmarkCheck className="w-5 h-5 text-yellow-500" /> : <BookmarkPlus className="w-5 h-5" />}
              </button>
              <button onClick={() => { setShowToc(!showToc); setShowBookmarks(false); setShowSearch(false); setShowSettings(false); }} className={cn("w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-colors", showToc ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
                <List className="w-5 h-5" />
              </button>
              <button onClick={() => { setShowSearch(!showSearch); setShowToc(false); setShowBookmarks(false); setShowSettings(false); }} className={cn("w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-colors", showSearch ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
                <Search className="w-5 h-5" />
              </button>
              <button onClick={() => { setShowSettings(!showSettings); setShowToc(false); setShowBookmarks(false); setShowSearch(false); }} className={cn("w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-colors", showSettings ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
                <Type className="w-5 h-5" />
              </button>
              <button onClick={toggleFullscreen} className="flex w-9 h-9 sm:w-10 sm:h-10 rounded-xl items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                {isFullscreen ? <Shrink className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
              <button onClick={() => setIsAnnotating(!isAnnotating)} className={cn("hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-sans font-bold transition-all ml-2", isAnnotating ? "bg-emerald-500 text-black " : "bg-muted text-muted-foreground border border-border hover:text-foreground")}>
                <PenTool className="w-4 h-4" /> Annotate
              </button>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* ═══ SETTINGS PANEL ═══ */}
      <AnimatePresence>
        {showSettings && showUI && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="absolute top-16 right-0 sm:right-6 w-full sm:w-80 bg-card sm:border border-border sm:rounded-b-2xl shadow-2xl z-40 overflow-hidden font-sans text-foreground"
          >
            <div className="p-5 space-y-5">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-3">Theme</label>
                <div className="flex gap-2">
                  {(Object.keys(THEMES) as Array<ThemeKey>).map(t => {
                    const ThemeIcon = THEMES[t].icon;
                    return (
                      <button key={t} title={THEMES[t].label} aria-label={`${THEMES[t].label} theme`} aria-pressed={theme === t} onClick={() => setTheme(t)} className={cn("w-10 h-10 rounded-xl border-2 transition-all duration-150 active:scale-95 flex items-center justify-center", theme === t ? "border-foreground scale-110" : "border-transparent opacity-60 hover:opacity-100")} style={{ backgroundColor: THEMES[t].bg, color: THEMES[t].fg }}>
                        <ThemeIcon className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-muted-foreground">Font Size</label>
                <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                  <button onClick={() => setFontSize(prev => Math.max(12, prev - 2))} aria-label="Decrease font size" className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent active:scale-90 rounded-md transition-all duration-150"><Minus className="w-4 h-4" /></button>
                  <span className="w-6 text-center text-sm font-bold tabular-nums">{fontSize}</span>
                  <button onClick={() => setFontSize(prev => Math.min(36, prev + 2))} aria-label="Increase font size" className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent active:scale-90 rounded-md transition-all duration-150"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-muted-foreground">Font</label>
                <div className="flex gap-1 bg-muted rounded-lg p-1">
                  <button onClick={() => setFontFamily('serif')} className={cn("px-4 py-1.5 rounded-md text-xs font-bold transition-all", fontFamily === 'serif' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Serif</button>
                  <button onClick={() => setFontFamily('sans')} className={cn("px-4 py-1.5 rounded-md text-xs font-bold transition-all", fontFamily === 'sans' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Sans</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ SIDE PANEL ═══ */}
      <AnimatePresence>
        {(showToc || showSearch || showBookmarks) && showUI && (
          <motion.div
            initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute top-16 right-0 bottom-0 w-[85vw] sm:w-96 bg-card border-l border-border shadow-2xl z-40 flex flex-col font-sans text-foreground overflow-hidden"
          >
            <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-sm uppercase tracking-wider">{showToc ? 'Contents' : showSearch ? 'Search' : 'Bookmarks'}</h3>
              <button onClick={() => { setShowToc(false); setShowSearch(false); setShowBookmarks(false); }} aria-label="Close panel" className="p-1.5 -m-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {showSearch && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input type="text" placeholder="Search book..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && performSearch()} className="flex-1 min-w-0 bg-muted border border-border rounded-xl px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-foreground/30 transition-colors" />
                    <button onClick={performSearch} disabled={searching} className="bg-primary text-primary-foreground px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-primary/90 active:scale-[0.97] transition-all">{searching ? '...' : 'Go'}</button>
                  </div>
                  <div className="space-y-2">
                    {searchResults.map((r, i) => (
                      <button key={i} onClick={() => goToCfi(`#${r.sectionIndex}`)} className="w-full text-left p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors border border-border/60">
                        <span className="text-xs font-bold text-muted-foreground block mb-1">Section {r.sectionIndex + 1}</span>
                        <p className="text-sm text-foreground/80 leading-relaxed line-clamp-3">&hellip;{r.snippet}&hellip;</p>
                      </button>
                    ))}
                    {searchQuery && !searching && searchResults.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">No results found.</p>}
                  </div>
                </div>
              )}

              {showToc && (
                <div className="space-y-1">
                  {tocItems.length === 0 ? <p className="text-muted-foreground text-sm text-center py-4">No table of contents found.</p> : tocItems.map((item, i) => (
                    <div key={i}>
                      <button onClick={() => goToCfi(item.href)} className="w-full text-left px-4 py-3 rounded-xl hover:bg-accent transition-colors text-sm font-medium text-muted-foreground hover:text-foreground">{item.label}</button>
                      {item.subitems?.map((sub, j) => (
                        <button key={j} onClick={() => goToCfi(sub.href)} className="w-full text-left pl-8 pr-4 py-2 rounded-xl hover:bg-accent transition-colors text-xs text-muted-foreground/80 hover:text-muted-foreground">{sub.label}</button>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {showBookmarks && (
                <div className="space-y-2">
                  {bookmarks.length === 0 ? <p className="text-muted-foreground text-sm text-center py-4">No bookmarks added yet.</p> : bookmarks.map((bm, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <button onClick={() => goToCfi(bm.cfi)} className="flex-1 min-w-0 text-left px-4 py-3 rounded-xl bg-muted hover:bg-accent transition-colors text-sm font-medium text-foreground flex items-center gap-3">
                        <BookmarkCheck className="w-4 h-4 text-yellow-500 shrink-0" /> <span className="truncate">{bm.label}</span>
                      </button>
                      <button onClick={() => removeBookmark(bm.cfi)} aria-label="Remove bookmark" className="p-3 text-destructive hover:bg-destructive/10 rounded-xl transition-colors shrink-0"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ STATE: LOADING ═══ */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="font-sans font-medium text-sm">Loading Book...</span>
        </div>
      )}

      {/* ═══ STATE: ERROR ═══ */}
      {error && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4 px-8 text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mb-2">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="font-sans font-bold text-foreground text-lg">Error Loading Book</h3>
          <p className="font-sans font-medium text-sm max-w-sm text-muted-foreground">{error}</p>
          <button onClick={onClose} className="mt-4 px-6 py-2.5 bg-primary text-primary-foreground font-sans font-bold rounded-xl hover:bg-primary/90 active:scale-[0.99] transition-all">
            Return to Library
          </button>
        </div>
      )}

      {/* ═══ PDF VIEWER ═══ */}
      {isPDF && !loading && !error && (
        <div className="flex-1 relative w-full h-full bg-background" onPointerDown={handleOuterTap}>
          <OptimizedPDFViewer file={decryptedBlob || file.url} />
          <div className="absolute inset-0 z-40" style={{ pointerEvents: isAnnotating ? 'auto' : 'none' }}>
            <InkCanvas active={isAnnotating} tool={isAnnotating ? 'pen' : 'off'} brush="pen" color={theme === 'dark' ? '#fff' : '#000'} size={3} penOnly={true} strokes={strokes} onStrokesChange={setStrokes} />
          </div>
        </div>
      )}

      {/* ═══ EPUB ENGINE LAYER ═══ */}
      {isEPUB && !loading && !error && (
        <div
          className="flex-1 relative flex items-center justify-center overflow-hidden"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        >
          <div className="w-full h-full max-w-4xl mx-auto relative">
            <div className="w-full h-full relative z-30 bg-transparent">
              <div className="absolute inset-0 w-full h-full pb-20 sm:pb-24 pt-8">
                 <div ref={viewerRef} className="w-full h-full" />
              </div>

              <div className="absolute inset-0 z-50" style={{ pointerEvents: isAnnotating ? 'auto' : 'none' }}>
                <InkCanvas active={isAnnotating} tool={isAnnotating ? 'pen' : 'off'} brush="pen" color={theme === 'dark' ? '#fff' : '#000'} size={3} penOnly={true} strokes={strokes} onStrokesChange={setStrokes} />
              </div>
            </div>
          </div>

          {/* ═══ BOTTOM PROGRESS BAR (auto-hide) ═══ */}
          <AnimatePresence>
            {showUI && (
              <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 60, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "absolute bottom-0 inset-x-0 flex flex-col z-[45] pt-16 pb-6 px-4 sm:px-8 pointer-events-none",
                  theme === 'dark' ? "bg-card" : "bg-card",
                  isMobile && "pb-8"
                )}
              >
                <div className="w-full max-w-xl mx-auto pointer-events-auto">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <button onClick={prev} className={cn("flex items-center justify-center sm:gap-1.5 h-9 sm:h-8 w-9 sm:w-auto sm:px-3 rounded-lg text-xs font-sans font-medium transition-all active:scale-95", theme === 'dark' ? "text-zinc-300 hover:bg-white/10" : "text-zinc-700 hover:bg-black/10")}>
                      <ChevronLeft className="w-5 h-5 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Prev</span>
                    </button>

                    <div className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full h-1 bg-black/20 dark:bg-white/10 rounded-full overflow-hidden">
                        <div className={cn("h-full transition-all duration-300", theme === 'dark' ? "bg-white" : "bg-black")} style={{ width: `${progressPct}%` }} />
                      </div>
                    </div>

                    <button onClick={next} className={cn("flex items-center justify-center sm:gap-1.5 h-9 sm:h-8 w-9 sm:w-auto sm:px-3 rounded-lg text-xs font-sans font-medium transition-all active:scale-95", theme === 'dark' ? "text-zinc-300 hover:bg-white/10" : "text-zinc-700 hover:bg-black/10")}>
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="w-5 h-5 sm:w-4 sm:h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-1 px-1">
                    <span className={cn('tabular-nums font-sans font-bold opacity-60', isMobile ? 'text-[10px]' : 'text-xs')}>{currentPage > 0 ? currentPage : ''}</span>
                    <span className={cn('tabular-nums font-sans font-bold', theme === 'dark' ? "text-zinc-400" : "text-zinc-500", isMobile ? 'text-[10px]' : 'text-xs')}>
                      {progressPct}% READ{totalPages > 1 && currentPage < totalPages && (
                        <> · ~{Math.max(1, Math.ceil((totalPages - currentPage) * 1.1))} min left</>
                      )}
                    </span>
                    <span className={cn('tabular-nums font-sans font-bold opacity-60', isMobile ? 'text-[10px]' : 'text-xs')}>{totalPages > 0 ? totalPages : ''}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
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
  const reduce = !!useReducedMotion();
  const bookTitle = file?.bookTitle || file?.title || file?.name || 'Book';

  const jumpToPercentage = (pct: number) => {
    if (engineRef.current && epubReadyRef.current) engineRef.current.goToPercentage(Math.max(0, Math.min(100, pct)));
  };

  const DockBtn: React.FC<{ label: string; onClick: () => void; on?: boolean; disabled?: boolean; children: React.ReactNode }> =
    ({ label, onClick, on, disabled, children }) => (
      <motion.button type="button" className="rd-btn" data-on={on || undefined} aria-label={label} title={label} onClick={onClick} disabled={disabled}
        whileHover={reduce ? undefined : { scale: 1.1 }} whileTap={reduce ? undefined : { scaleX: 0.88, scaleY: 0.8 }}
        transition={reduce ? { duration: 0.01 } : JELLY}>{children}</motion.button>
    );

  const openPanel = (which: 'toc' | 'bookmarks' | 'search') => {
    const val = which === 'toc' ? showToc : which === 'bookmarks' ? showBookmarks : showSearch;
    setShowToc(false); setShowBookmarks(false); setShowSearch(false); setShowSettings(false);
    if (which === 'toc') setShowToc(!val);
    else if (which === 'bookmarks') setShowBookmarks(!val);
    else setShowSearch(!val);
  };

  return (
    <div ref={readerContainerRef} className="rd fixed inset-0 z-[200] overflow-hidden"
      style={{ backgroundColor: THEMES[theme].bg, color: THEMES[theme].fg }}>
      <style>{RD_CSS}</style>

      {/* ── PDF stays the PDF viewer's own design ── */}
      {isPDF && !loading && !error && (
        <div className="absolute inset-0">
          <OptimizedPDFViewer file={decryptedBlob || file.url} />
          <div className="absolute inset-0 z-40" style={{ pointerEvents: isAnnotating ? 'auto' : 'none' }}>
            <InkCanvas active={isAnnotating} tool={isAnnotating ? 'pen' : 'off'} brush="pen" color={theme === 'dark' ? '#e8e7e1' : '#151613'} size={3} penOnly={true} strokes={strokes} onStrokesChange={setStrokes} />
          </div>
        </div>
      )}

      {isEPUB && !loading && !error && (
        <>
          {/* reading surface */}
          <div className="absolute inset-0 flex items-center justify-center" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
            <div className="w-full h-full max-w-4xl mx-auto relative px-6 sm:px-10 pt-20 pb-28">
              <div ref={viewerRef} className="w-full h-full" />
              <div className="absolute inset-0 z-50" style={{ pointerEvents: isAnnotating ? 'auto' : 'none' }}>
                <InkCanvas active={isAnnotating} tool={isAnnotating ? 'pen' : 'off'} brush="pen" color={theme === 'dark' ? '#e8e7e1' : '#151613'} size={3} penOnly={true} strokes={strokes} onStrokesChange={setStrokes} />
              </div>
            </div>
          </div>

          {/* ── top: three grouped docks, same as the PDF viewer ── */}
          <AnimatePresence>
            {showUI && (
              <motion.div className="rd-top" initial={{ y: -90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -90, opacity: 0 }} transition={reduce ? { duration: 0.01 } : SOFT}>
                <div className="rd-anchor rd-a-l">
                  <div className="rd-g rd-dock">
                    <DockBtn label="Contents" on={showToc} onClick={() => openPanel('toc')}><List size={18} strokeWidth={1.7} /></DockBtn>
                    <DockBtn label="Bookmarks" on={showBookmarks} onClick={() => openPanel('bookmarks')}><BookmarkPlus size={18} strokeWidth={1.7} /></DockBtn>
                    <DockBtn label="Search" on={showSearch} onClick={() => openPanel('search')}><Search size={18} strokeWidth={1.7} /></DockBtn>
                  </div>
                </div>

                <div className="rd-a-c">
                  <motion.div className="rd-g rd-dock rd-title" initial={reduce ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} transition={reduce ? { duration: 0.01 } : POP}>
                    <span className="rd-name" title={bookTitle}>{bookTitle}</span>
                    <i className="rd-vsep" />
                    <span className="rd-page">{currentPage || '—'} <i>/</i> {totalPages || '—'}</span>
                  </motion.div>
                </div>

                <div className="rd-anchor rd-a-r">
                  <div className="rd-g rd-dock">
                    <DockBtn label="Smaller text" onClick={() => setFontSize(v => Math.max(12, v - 2))}><Minus size={18} strokeWidth={1.7} /></DockBtn>
                    <span className="rd-fsize" title="Font size">{fontSize}</span>
                    <DockBtn label="Larger text" onClick={() => setFontSize(v => Math.min(36, v + 2))}><Plus size={18} strokeWidth={1.7} /></DockBtn>
                    <i className="rd-vsep" />
                    <DockBtn label="Reading settings" on={showSettings} onClick={() => { setShowSettings(v => !v); setShowToc(false); setShowBookmarks(false); setShowSearch(false); }}><Type size={18} strokeWidth={1.7} /></DockBtn>
                    <DockBtn label={isAnnotating ? 'Stop annotating' : 'Annotate'} on={isAnnotating} onClick={() => setIsAnnotating(v => !v)}><PenTool size={18} strokeWidth={1.7} /></DockBtn>
                    <DockBtn label={isFullscreen ? 'Exit full screen' : 'Full screen'} onClick={toggleFullscreen}>{isFullscreen ? <Shrink size={18} strokeWidth={1.7} /> : <Maximize size={18} strokeWidth={1.7} />}</DockBtn>
                    <DockBtn label={bookmarked ? 'Remove bookmark' : 'Bookmark page'} on={bookmarked} onClick={() => bookmarked && currentCfi ? removeBookmark(currentCfi) : addBookmark()}><BookmarkCheck size={18} strokeWidth={1.7} /></DockBtn>
                  </div>

                  <AnimatePresence>
                    {showSettings && (
                      <motion.div className="rd-g rd-pop rd-pop-r" data-rd-pop role="menu"
                        initial={reduce ? false : { opacity: 0, scale: 0.84, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: -4 }}
                        transition={reduce ? { duration: 0.01 } : POP}>
                        <div className="rd-rowlabel">Theme</div>
                        <div className="rd-themes">
                          {(Object.keys(THEMES) as ThemeKey[]).map(t => (
                            <button key={t} type="button" className="rd-theme" data-on={theme === t} title={THEMES[t].label} aria-label={`${THEMES[t].label} theme`}
                              onClick={() => setTheme(t)} style={{ background: THEMES[t].bg, color: THEMES[t].fg }}>
                              {THEMES[t].label.slice(0, 1)}
                            </button>
                          ))}
                        </div>
                        <div className="rd-sep" />
                        <div className="rd-rowlabel">Typeface</div>
                        <div className="rd-seg">
                          <button type="button" data-on={fontFamily === 'serif'} onClick={() => setFontFamily('serif')}>Serif</button>
                          <button type="button" data-on={fontFamily === 'sans'} onClick={() => setFontFamily('sans')}>Sans</button>
                        </div>
                        <div className="rd-sep" />
                        <div className="rd-rowlabel">Line spacing</div>
                        <div className="rd-seg">
                          <button type="button" aria-label="Tighter line spacing" onClick={() => setLineHeight(v => Math.max(1.2, Math.round((v - 0.1) * 10) / 10))}>Tight</button>
                          <button type="button" aria-label="Wider line spacing" onClick={() => setLineHeight(v => Math.min(2.2, Math.round((v + 0.1) * 10) / 10))}>Wide</button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── bottom navigation dock ── */}
          <AnimatePresence>
            {showUI && (
              <motion.div className="rd-bot" initial={reduce ? false : { y: 34, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 26, opacity: 0 }} transition={reduce ? { duration: 0.01 } : SOFT}>
                <div className="rd-g rd-dock rd-nav">
                  <DockBtn label="Previous page" onClick={prev}><ChevronLeft size={19} strokeWidth={1.7} /></DockBtn>
                  <div className="rd-prog" role="progressbar" aria-valuenow={Math.round(progressPct)} aria-label="Reading progress"
                    onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); jumpToPercentage(((e.clientX - r.left) / r.width) * 100); }}>
                    <span className="rd-fill" style={{ width: `${progressPct}%` }} />
                  </div>
                  <span className="rd-pct">{Math.round(progressPct)}%</span>
                  <DockBtn label="Next page" onClick={next}><ChevronRight size={19} strokeWidth={1.7} /></DockBtn>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── floating sidebar island ── */}
          <AnimatePresence>
            {(showToc || showBookmarks || showSearch) && showUI && (
              <motion.aside className="rd-g rd-side" data-rd-pop
                initial={reduce ? false : { opacity: 0, x: -34, scale: 0.94 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -28, scale: 0.95 }}
                transition={reduce ? { duration: 0.01 } : SOFT} style={{ transformOrigin: '0% 50%' }}>
                <div className="rd-side-head">
                  <span>{showToc ? 'Contents' : showSearch ? 'Search' : 'Bookmarks'}</span>
                  <button type="button" aria-label="Close panel" onClick={() => { setShowToc(false); setShowSearch(false); setShowBookmarks(false); }}><X size={16} strokeWidth={1.7} /></button>
                </div>

                <div className="rd-side-body">
                  {showSearch && (
                    <div className="rd-stack">
                      <div className="rd-searchrow">
                        <input type="text" placeholder="Search book…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && performSearch()} />
                        <button type="button" onClick={performSearch} disabled={searching}>{searching ? '…' : 'Go'}</button>
                      </div>
                      {searchResults.map((r, i) => (
                        <button key={i} type="button" className="rd-result" onClick={() => goToCfi(`#${r.sectionIndex}`)}>
                          <span>Section {r.sectionIndex + 1}</span>
                          <p>…{r.snippet}…</p>
                        </button>
                      ))}
                      {searchQuery && !searching && searchResults.length === 0 && <p className="rd-empty">No results found.</p>}
                    </div>
                  )}
                  {showToc && (
                    <div className="rd-stack">
                      {tocItems.length === 0 ? <p className="rd-empty">No table of contents.</p> : tocItems.map((item, i) => (
                        <div key={i}>
                          <button type="button" className="rd-row" onClick={() => goToCfi(item.href)}>{item.label}</button>
                          {item.subitems?.map((sub, j) => <button key={j} type="button" className="rd-row rd-sub" onClick={() => goToCfi(sub.href)}>{sub.label}</button>)}
                        </div>
                      ))}
                    </div>
                  )}
                  {showBookmarks && (
                    <div className="rd-stack">
                      {bookmarks.length === 0 ? <p className="rd-empty">No bookmarks yet.</p> : bookmarks.map((bm, i) => (
                        <div key={i} className="rd-bmrow">
                          <button type="button" className="rd-row" onClick={() => goToCfi(bm.cfi)}><BookmarkCheck size={14} strokeWidth={1.7} />{bm.label}</button>
                          <button type="button" className="rd-x" aria-label="Remove bookmark" onClick={() => removeBookmark(bm.cfi)}><X size={14} strokeWidth={1.7} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ── loading / error, same glass cards as the PDF viewer ── */}
      {loading && (
        <div className="rd-state">
          <div className="rd-g rd-card"><span className="rd-spinner" /><span>Loading book…</span></div>
        </div>
      )}
      {error && !loading && (
        <div className="rd-state">
          <div className="rd-g rd-card">
            <AlertCircle size={28} strokeWidth={1.7} />
            <h3>Couldn't open this book</h3>
            <p>{error}</p>
            <button type="button" className="rd-cta" onClick={onClose}>Back to library</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* Reader chrome in the exact visual language of OptimizedPDFViewer: dense
   neutral glass, grouped floating docks, hairline rims, lively springs. */
const JELLY = { type: 'spring' as const, stiffness: 520, damping: 15, mass: 0.8 };
const POP = { type: 'spring' as const, stiffness: 380, damping: 17, mass: 0.9 };
const SOFT = { type: 'spring' as const, stiffness: 300, damping: 28, mass: 0.9 };

const RD_CSS = `
.rd { --ink: #e8e7e1; --dim: rgba(232,231,225,.58); --line: rgba(232,231,225,.10); --rim: rgba(232,231,225,.14);
  font-family: var(--sa-f, system-ui, sans-serif); -webkit-font-smoothing: antialiased; -webkit-tap-highlight-color: transparent; }
.rd-g { background: linear-gradient(180deg, rgba(32,33,29,.97), rgba(14,15,12,.985)); border: 1px solid var(--line);
  -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); color: var(--ink);
  box-shadow: inset 0 1px 0 rgba(232,231,225,.06), inset 0 -1px 0 rgba(0,0,0,.4), 0 18px 40px -18px rgba(0,0,0,.9); }
.rd-dock { display: flex; align-items: center; gap: 2px; padding: 4px; border-radius: 999px; }
.rd-btn { display: grid; place-items: center; flex: none; width: 38px; height: 38px; padding: 0; border: 0; border-radius: 999px;
  background: transparent; color: var(--dim); cursor: pointer; transition: background .2s, color .2s; }
.rd-btn:hover { background: rgba(232,231,225,.1); color: var(--ink); }
.rd-btn[data-on="true"] { background: rgba(232,231,225,.16); color: var(--ink); }
.rd-btn:disabled { opacity: .3; pointer-events: none; }
.rd-btn:focus-visible, .rd-cta:focus-visible, .rd-row:focus-visible, .rd-searchrow button:focus-visible { outline: 2px solid rgba(232,231,225,.8); outline-offset: 2px; }
.rd-vsep { flex: none; width: 1px; height: 20px; margin: 0 4px; background: var(--line); }
.rd-top { position: absolute; z-index: 30; left: 16px; right: 16px; top: max(14px, env(safe-area-inset-top));
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: start; gap: 12px; pointer-events: none; }
.rd-anchor { position: relative; pointer-events: auto; } .rd-a-l { justify-self: start; } .rd-a-r { justify-self: end; }
.rd-a-c { display: flex; justify-content: center; pointer-events: none; } .rd-a-c > * { pointer-events: auto; }
.rd-title { height: 46px; padding: 4px 8px; max-width: min(46vw, 420px); }
.rd-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 260px; font-size: 13.5px; font-weight: 600; letter-spacing: -.005em; padding: 0 8px; }
.rd-page { color: var(--dim); font: 500 13px/1 var(--sa-mono, ui-monospace, monospace); font-variant-numeric: tabular-nums; white-space: nowrap; padding-right: 6px; }
.rd-page i { font-style: normal; opacity: .35; margin: 0 2px; }
.rd-fsize { min-width: 26px; text-align: center; font: 500 12.5px/1 var(--sa-mono, ui-monospace, monospace); color: var(--ink); font-variant-numeric: tabular-nums; }
.rd-bot { position: absolute; z-index: 30; left: 50%; bottom: max(20px, env(safe-area-inset-bottom)); translate: -50% 0; }
.rd-nav { gap: 8px; padding: 5px 8px; }
.rd-prog { position: relative; width: 200px; height: 4px; border-radius: 999px; background: rgba(232,231,225,.16); cursor: pointer; overflow: hidden; }
.rd-fill { display: block; height: 100%; background: rgba(232,231,225,.82); border-radius: inherit; transition: width .25s ease; }
.rd-pct { min-width: 42px; text-align: center; font: 500 11px/1 var(--sa-mono, ui-monospace, monospace); color: var(--dim); font-variant-numeric: tabular-nums; }
.rd-pop { position: absolute; z-index: 40; min-width: 224px; padding: 8px; border-radius: 18px; }
.rd-pop-r { right: 0; top: calc(100% + 10px); }
.rd-rowlabel { padding: 4px 8px 6px; font: 600 10px/1 var(--sa-mono, ui-monospace, monospace); letter-spacing: .1em; text-transform: uppercase; color: var(--dim); }
.rd-themes { display: flex; gap: 6px; padding: 0 6px 4px; }
.rd-theme { width: 34px; height: 34px; border: 1px solid rgba(232,231,225,.12); border-radius: 999px; cursor: pointer; font: 600 12px/1 inherit; }
.rd-theme[data-on="true"] { box-shadow: 0 0 0 2px rgba(232,231,225,.55); }
.rd-seg { display: flex; gap: 4px; padding: 0 6px 4px; }
.rd-seg button { flex: 1; height: 30px; border: 1px solid transparent; border-radius: 999px; background: rgba(232,231,225,.05); color: var(--dim); cursor: pointer; font-size: 12px; }
.rd-seg button[data-on="true"] { background: rgba(232,231,225,.16); color: var(--ink); border-color: rgba(232,231,225,.12); }
.rd-sep { height: 1px; margin: 6px 8px; background: var(--line); }
.rd-side { position: absolute; z-index: 25; left: 16px; top: calc(max(14px, env(safe-area-inset-top)) + 60px); bottom: 16px; width: 232px;
  display: flex; flex-direction: column; overflow: hidden; border-radius: 22px; }
.rd-side-head { display: flex; align-items: center; justify-content: space-between; flex: none; padding: 14px 14px 10px;
  font: 600 11px/1 var(--sa-mono, ui-monospace, monospace); letter-spacing: .1em; text-transform: uppercase; color: var(--dim); }
.rd-side-head button { display: grid; place-items: center; width: 26px; height: 26px; border: 0; border-radius: 999px; background: transparent; color: var(--dim); cursor: pointer; }
.rd-side-head button:hover { background: rgba(232,231,225,.1); color: var(--ink); }
.rd-side-body { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 10px 14px; scrollbar-width: thin; scrollbar-color: rgba(232,231,225,.16) transparent; }
.rd-stack { display: grid; gap: 4px; }
.rd-row { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 36px; padding: 8px 10px; border: 0; border-radius: 11px;
  background: none; color: var(--ink); font-size: 13px; text-align: left; cursor: pointer; transition: background .15s; }
.rd-row:hover { background: rgba(232,231,225,.1); }
.rd-sub { padding-left: 22px; font-size: 12px; color: var(--dim); }
.rd-bmrow { display: flex; align-items: center; gap: 4px; }
.rd-bmrow .rd-row { flex: 1; min-width: 0; }
.rd-x { display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 999px; background: transparent; color: var(--dim); cursor: pointer; }
.rd-x:hover { background: rgba(217,128,128,.2); color: #e8a0a0; }
.rd-searchrow { display: flex; gap: 6px; margin-bottom: 8px; }
.rd-searchrow input { flex: 1; min-width: 0; height: 34px; padding: 0 10px; border: 1px solid var(--line); border-radius: 999px;
  background: rgba(232,231,225,.06); color: var(--ink); font-size: 12.5px; outline: none; }
.rd-searchrow button { height: 34px; padding: 0 12px; border: 1px solid var(--line); border-radius: 999px; background: rgba(232,231,225,.1); color: var(--ink); cursor: pointer; font-size: 12px; }
.rd-result { display: block; width: 100%; padding: 10px; border: 0; border-radius: 11px; background: rgba(232,231,225,.05); color: var(--ink); text-align: left; cursor: pointer; }
.rd-result:hover { background: rgba(232,231,225,.11); }
.rd-result span { display: block; font: 500 10px/1 var(--sa-mono, ui-monospace, monospace); color: var(--dim); margin-bottom: 6px; }
.rd-result p { margin: 0; font-size: 12px; line-height: 1.5; color: var(--ink); }
.rd-empty { padding: 20px 8px; text-align: center; color: var(--dim); font-size: 12px; }
.rd-state { position: absolute; inset: 0; display: grid; place-items: center; }
.rd-card { display: grid; justify-items: center; gap: 12px; width: min(400px, 100%); padding: 28px 26px 24px; border-radius: 26px; text-align: center; }
.rd-card h3 { margin: 0; font-size: 17px; font-weight: 600; } .rd-card p { margin: 0; font-size: 13px; line-height: 1.5; color: var(--dim); }
.rd-spinner { width: 26px; height: 26px; border-radius: 50%; border: 2px solid rgba(232,231,225,.16); border-top-color: rgba(232,231,225,.8); animation: rd-spin .9s linear infinite; }
@keyframes rd-spin { to { transform: rotate(360deg); } }
.rd-cta { height: 40px; padding: 0 20px; border: 1px solid var(--line); border-radius: 999px;
  background: linear-gradient(180deg, rgba(36,37,33,.9), rgba(15,16,13,.94)); color: var(--ink); cursor: pointer; font-size: 13px; font-weight: 600; }
.rd-cta:hover { background: linear-gradient(180deg, rgba(48,49,44,.92), rgba(20,21,18,.94)); }
@media (max-width: 720px) {
  .rd-top { grid-template-columns: 1fr; }
  .rd-a-l, .rd-a-r { justify-self: center; }
  .rd-a-c { display: none; }
  .rd-side { left: 12px; right: 12px; top: auto; bottom: 12px; width: auto; height: 58%; }
  .rd-prog { width: 130px; }
  .rd-btn { width: 36px; height: 36px; }
}
@media (prefers-reduced-motion: reduce) { .rd-btn, .rd-fill { transition-duration: .01ms !important; } }
`;

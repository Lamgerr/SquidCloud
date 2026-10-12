import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, LayoutGrid,
  Loader2, FileText, Download, Maximize, Minimize, Search, Moon,
  BookOpen, X, ListTree, Layers, Sun, Eye, EyeOff, Settings, Bookmark,
  BookmarkPlus, Highlighter, Pen, StickyNote, Type, Underline,
  Italic, Sigma, Eraser, Signature, ClipboardCopy, BookmarkX,
  ScrollText, Play, Undo2, Redo2, Hash, Thermometer,
  Columns2, Focus, ScanEye, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';

if (typeof window !== 'undefined' && 'Worker' in window) {
  import('pdfjs-dist/build/pdf.worker.mjs?worker')
    .then((m) => {
      pdfjsLib.GlobalWorkerOptions.workerPort = new m.default();
    })
    .catch(() => {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    });
}

const CACHE_MAX = 60;
const STORAGE_KEY = 'pdf-viewer-prefs';
const HISTORY_KEY = 'pdf-viewer-history';
const SESSION_KEY = 'pdf-viewer-session';

type ZoomMode = 'auto' | 'page-fit' | 'page-width' | 'actual-size' | 'custom';

const ZOOM_MODE_LABELS: Record<ZoomMode, string> = {
  auto: 'Auto Fit',
  'page-fit': 'Page Fit',
  'page-width': 'Page Width',
  'actual-size': 'Actual Size',
  custom: 'Custom',
};

const ZOOM_MODE_ICONS: Record<ZoomMode, React.ReactNode> = {
  auto: <ScanEye className="w-3.5 h-3.5" />,
  'page-fit': <Focus className="w-3.5 h-3.5" />,
  'page-width': <Columns2 className="w-3.5 h-3.5" />,
  'actual-size': <FileText className="w-3.5 h-3.5" />,
  custom: <ZoomIn className="w-3.5 h-3.5" />,
};

interface OptimizedPDFViewerProps {
  file: { id?: string; name: string; size?: number };
  blobUrl?: string | null;
  pdfBlob?: Blob | null;
  onClose?: () => void;
  onDownload?: () => void;
}

type ReadingTheme = 'normal' | 'dark' | 'sepia' | 'forest' | 'midnight' | 'paper';
type SidebarTab = 'thumbnails' | 'outline' | 'annotations' | 'bookmarks' | 'stats';
type PageLayout = 'single' | 'scroll' | 'dual';
type PageTransition = 'none' | 'fade' | 'slide' | 'flip';
type AnnotationTool = 'select' | 'highlight' | 'underline' | 'strikethrough' | 'freehand' | 'sticky' | 'textbox' | 'signature' | 'eraser';
type SearchMode = 'normal' | 'regex' | 'case-sensitive' | 'whole-word';

interface PageCacheItem {
  dataUrl: string;
  width: number;
  height: number;
  scale: number;
  rotation: number;
}

interface OutlineNode {
  title: string;
  dest: any;
  items: OutlineNode[];
}

interface ViewerPrefs {
  theme: ReadingTheme;
  sidebarOpen: boolean;
  layout: PageLayout;
  transition: PageTransition;
  sidebarWidth: number;
  themeWarmth: number;
  themeBrightness: number;
  blueLightFilter: boolean;
  autoNightMode: boolean;
  annotationColor: string;
  annotationOpacity: number;
  fontSmoothing: boolean;
}

interface Annotation {
  id: string;
  type: AnnotationTool;
  page: number;
  color: string;
  opacity: number;
  points?: { x: number; y: number }[];
  text?: string;
  position: { x: number; y: number; width?: number; height?: number };
  content?: any;
  createdAt: number;
}

interface BookmarkItem {
  id: string;
  page: number;
  label: string;
  color: string;
  createdAt: number;
}

interface DocTab {
  id: string;
  name: string;
  blobUrl?: string | null;
  pdfBlob?: Blob | null;
  currentPage: number;
}

function loadPrefs(): ViewerPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...{
      theme: 'normal', sidebarOpen: true, layout: 'single', transition: 'fade',
      sidebarWidth: 240, themeWarmth: 50, themeBrightness: 100,
      blueLightFilter: false, autoNightMode: false, annotationColor: '#FFEB3B',
      annotationOpacity: 0.4, fontSmoothing: true
    }, ...JSON.parse(raw) };
  } catch {}
  return {
    theme: 'normal', sidebarOpen: true, layout: 'single', transition: 'fade',
    sidebarWidth: 240, themeWarmth: 50, themeBrightness: 100,
    blueLightFilter: false, autoNightMode: false, annotationColor: '#FFEB3B',
    annotationOpacity: 0.4, fontSmoothing: true
  };
}

function savePrefs(prefs: ViewerPrefs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch {}
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function estimateReadTime(wordCount: number): string {
  const min = Math.ceil(wordCount / 250);
  if (min < 1) return '<1 min';
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

const HIGHLIGHT_COLORS = ['#FFEB3B', '#FF9800', '#F44336', '#E91E63', '#9C27B0', '#2196F3', '#4CAF50', '#00BCD4', '#795548', '#607D8B'];

const THEME_STYLES: Record<ReadingTheme, { bg: string; canvasFilter: string; accent: string; textClass: string }> = {
  normal: { bg: 'bg-background/95', canvasFilter: 'none', accent: '', textClass: '' },
  dark: { bg: 'bg-[#0a0a0f]', canvasFilter: 'invert(92%) hue-rotate(180deg) brightness(90%)', accent: 'text-blue-400', textClass: 'text-blue-300' },
  sepia: { bg: 'bg-[#f4ebd0]', canvasFilter: 'sepia(32%)', accent: 'text-amber-600', textClass: 'text-amber-800' },
  forest: { bg: 'bg-[#1a2e1a]', canvasFilter: 'sepia(20%) hue-rotate(120deg) brightness(85%)', accent: 'text-green-400', textClass: 'text-green-300' },
  midnight: { bg: 'bg-[#0d1117]', canvasFilter: 'invert(85%) hue-rotate(200deg) brightness(80%) contrast(110%)', accent: 'text-indigo-400', textClass: 'text-indigo-300' },
  paper: { bg: 'bg-[#e8dcc8]', canvasFilter: 'sepia(15%) brightness(105%) contrast(95%)', accent: 'text-amber-800', textClass: 'text-amber-900' },
};

const THEME_LABELS: Record<ReadingTheme, string> = {
  normal: 'Normal', dark: 'Dark', sepia: 'Sepia', forest: 'Forest', midnight: 'Midnight', paper: 'Paper'
};

export default function OptimizedPDFViewer({
  file, blobUrl, pdfBlob, onDownload
}: OptimizedPDFViewerProps) {
  const isMobile = useIsMobile();
  const prefs = useRef(loadPrefs());

  const containerRef = useRef<HTMLDivElement>(null);
  const activeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeTextLayerRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentRenderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const preloadTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoScrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollY = useRef(0);
  const readingStartRef = useRef(Date.now());
  const pagesRenderedRef = useRef<Set<number>>(new Set());
  const annotationCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const annotationCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const drawPointsRef = useRef<{ x: number; y: number }[]>([]);

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(0);
  const [containerReady, setContainerReady] = useState(false);
  const [zoomMode, setZoomMode] = useState<ZoomMode>('auto');
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageRendering, setPageRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readTime, setReadTime] = useState(0);
  const [wordCount, setWordCount] = useState(0);

  const [sidebarOpen, setSidebarOpen] = useState(prefs.current.sidebarOpen && !isMobile);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('thumbnails');
  const [outline, setOutline] = useState<OutlineNode[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [theme, setTheme] = useState<ReadingTheme>(prefs.current.theme);
  const [layout, setLayout] = useState<PageLayout>(prefs.current.layout);
  const [transition, setTransition] = useState<PageTransition>(prefs.current.transition);
  const [fsUiVisible, setFsUiVisible] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(prefs.current.sidebarWidth);
  const [focusMode, setFocusMode] = useState(false);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState(0);
  const [searchMode, setSearchMode] = useState<SearchMode>('normal');
  const [searchResults, setSearchResults] = useState<{ page: number; count: number }[]>([]);
  const [showPrefs, setShowPrefs] = useState(false);

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [activeTool, setActiveTool] = useState<AnnotationTool>('select');
  const [annotationColor, setAnnotationColor] = useState(prefs.current.annotationColor);
  const [annotationOpacity, setAnnotationOpacity] = useState(prefs.current.annotationOpacity);

  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [showBookmarkInput, setShowBookmarkInput] = useState(false);
  const [bookmarkLabel, setBookmarkLabel] = useState('');

  const [showKbShortcuts, setShowKbShortcuts] = useState(false);
  const [autoScroll, setAutoScroll] = useState(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(2);
  const [showStats, setShowStats] = useState(false);
  const [themeWarmth, setThemeWarmth] = useState(prefs.current.themeWarmth);
  const [themeBrightness, setThemeBrightness] = useState(prefs.current.themeBrightness);
  const [blueLightFilter, setBlueLightFilter] = useState(prefs.current.blueLightFilter);
  const [autoNightMode, setAutoNightMode] = useState(prefs.current.autoNightMode);
  const [fontSmoothing, setFontSmoothing] = useState(prefs.current.fontSmoothing);
  const [showAnnotationTools, setShowAnnotationTools] = useState(false);
  const [showPageOverview, setShowPageOverview] = useState(false);
  const [showDictLookup, setShowDictLookup] = useState(false);
  const [dictWord, setDictWord] = useState('');
  const [dictResult, setDictResult] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [clipboardMsg, setClipboardMsg] = useState('');
  const [loupeActive, setLoupeActive] = useState(false);
  const [loupePos, setLoupePos] = useState({ x: 0, y: 0 });
  const [pageTransitionDir, setPageTransitionDir] = useState<'prev' | 'next' | null>(null);

  const SPRING_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

  const pageCacheRef = useRef<Map<string, PageCacheItem>>(new Map());
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [undoStack, setUndoStack] = useState<Annotation[][]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[][]>([]);

  const [docTabs, setDocTabs] = useState<DocTab[]>([{ id: 'main', name: file.name, blobUrl, pdfBlob, currentPage: 1 }]);
  const [activeTabId, setActiveTabId] = useState('main');

  const [touchPinchZoom, setTouchPinchZoom] = useState(1);
  const [touchPan, setTouchPan] = useState({ x: 0, y: 0 });
  const [isPinching, setIsPinching] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [lastTouchDistance, setLastTouchDistance] = useState(0);
  const [lastTouchCenter, setLastTouchCenter] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const lastTap = useRef<number>(0);
  const mobileTapRef = useRef(false);
  const panVelocityRef = useRef({ x: 0, y: 0 });
  const momentumFrameRef = useRef<number>(0);
  const lastPanPositions = useRef<{ x: number; y: number; t: number }[]>([]);

  useEffect(() => { savePrefs({ theme, sidebarOpen, layout, transition, sidebarWidth, themeWarmth, themeBrightness, blueLightFilter, autoNightMode, annotationColor, annotationOpacity, fontSmoothing }); }, [theme, sidebarOpen, layout, transition, sidebarWidth, themeWarmth, themeBrightness, blueLightFilter, autoNightMode, annotationColor, annotationOpacity, fontSmoothing]);

  useEffect(() => {
    if (!pageTransitionDir) return;
    const t = setTimeout(() => setPageTransitionDir(null), 300);
    return () => clearTimeout(t);
  }, [pageTransitionDir]);

  useEffect(() => {
    if (!pdfDoc) return;
    const interval = setInterval(() => {
      setReadTime(Math.floor((Date.now() - readingStartRef.current) / 1000));
    }, 10000);
    return () => clearInterval(interval);
  }, [pdfDoc]);

  useEffect(() => {
    if (!autoNightMode) return;
    const hour = new Date().getHours();
    if (hour >= 19 || hour < 6) {
      if (theme === 'normal') setTheme('dark');
    } else {
      if (theme === 'dark') setTheme('normal');
    }
  }, [autoNightMode]);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setFsUiVisible(true);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  useEffect(() => {
    if (!isFullscreen) { setFsUiVisible(true); return; }
    let timeout: NodeJS.Timeout;
    const show = () => {
      setFsUiVisible(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setFsUiVisible(false), 2500);
    };
    document.addEventListener('mousemove', show);
    document.addEventListener('touchstart', show);
    show();
    return () => {
      document.removeEventListener('mousemove', show);
      document.removeEventListener('touchstart', show);
      clearTimeout(timeout);
    };
  }, [isFullscreen]);

  useEffect(() => {
    return () => cancelAnimationFrame(momentumFrameRef.current);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          if (layout === 'scroll') { scrollByPage(1); } else { changePage(currentPage + 1); }
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          if (layout === 'scroll') { scrollByPage(-1); } else { changePage(currentPage - 1); }
          break;
        case 'f': if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); toggleFullscreen(); } break;
        case 'Home': e.preventDefault(); changePage(1); break;
        case 'End': e.preventDefault(); changePage(totalPages); break;
        case 't': e.preventDefault(); setSidebarOpen(p => !p); break;
        case 's':
          e.preventDefault();
          setLayout(l => l === 'single' ? 'scroll' : l === 'scroll' ? 'dual' : 'single');
          break;
        case 'h': if (activeTool === 'select') setActiveTool('highlight'); else setActiveTool('select'); e.preventDefault(); break;
        case 'z': if ((e.ctrlKey || e.metaKey) && e.shiftKey) { undo(); } else if (e.ctrlKey || e.metaKey) { redo(); } break;
        case '?': setShowKbShortcuts(p => !p); break;
        case 'Escape': setShowSearch(false); setShowPrefs(false); setShowKbShortcuts(false); setShowBookmarkInput(false); setShowAnnotationTools(false); setShowPageOverview(false); setShowStats(false); break;
        case 'b': if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); toggleBookmark(); } break;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault(); setShowSearch(p => !p);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault(); setActiveTool(activeTool === 'highlight' ? 'select' : 'highlight');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, toggleFullscreen, layout, activeTool]);

  const scrollByPage = (dir: number) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const target = currentPage + dir;
    if (target < 1 || target > totalPages) return;
    changePage(target);
    const pageEl = el.querySelector(`[data-page="${target}"]`);
    if (pageEl) pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    let active = true;
    const loadDocument = async () => {
      setLoading(true); setError(null);
      pageCacheRef.current.clear();
      pagesRenderedRef.current.clear();
      readingStartRef.current = Date.now();
      setReadTime(0);
      setWordCount(0);
      try {
        let loadingTask: pdfjsLib.PDFDocumentLoadingTask;
        if (pdfBlob) {
          const arrayBuffer = await pdfBlob.arrayBuffer();
          loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        } else if (blobUrl && blobUrl.startsWith('blob:')) {
          const res = await fetch(blobUrl);
          const arrayBuffer = await res.arrayBuffer();
          loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        } else if (blobUrl) {
          loadingTask = pdfjsLib.getDocument({ url: blobUrl });
        } else {
          throw new Error('No PDF payload available');
        }

        const doc = await loadingTask.promise;
        if (active) {
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          const docOutline = await doc.getOutline().catch(() => null);
          if (docOutline) setOutline(docOutline as OutlineNode[]);
          const page1 = await doc.getPage(1);
          const tc = await page1.getTextContent().catch(() => null);
          if (tc) {
            const wc = tc.items.reduce((s: number, i: any) => s + (i.str || '').split(/\s+/).filter(Boolean).length, 0);
            setWordCount(wc * doc.numPages);
          }
          setLoading(false);
          try {
            const { data } = await supabase.rpc('get_pdf_statistics', { p_document_id: file.id || file.name });
            if (data) setAnnotations([]);
          } catch {}
        }
      } catch (err: any) {
        if (active) { setError(err?.message || 'Failed to load PDF.'); setLoading(false); }
      }
    };
    loadDocument();
    return () => { active = false; };
  }, [blobUrl, pdfBlob, file.id, file.name]);

  useEffect(() => {
    if (!pdfDoc || !loading) {
      renderActivePage();
    }
  }, [pdfDoc, loading, scale, rotation, currentPage]);

  const rasterizePageToCanvas = useCallback(async (
    doc: pdfjsLib.PDFDocumentProxy, pageNum: number, targetScale: number, targetRotation: number
  ): Promise<{ canvas: HTMLCanvasElement; textContent: any; viewport: pdfjsLib.PageViewport }> => {
    const page = await doc.getPage(pageNum);
    const dpr = Math.max(window.devicePixelRatio || 1, 2.0);
    const viewport = page.getViewport({ scale: targetScale, rotation: targetRotation });
    const svp = page.getViewport({ scale: targetScale * dpr, rotation: targetRotation });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas context unavailable');
    canvas.width = svp.width; canvas.height = svp.height;
    canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
    if (currentRenderTaskRef.current) { try { currentRenderTaskRef.current.cancel(); } catch {} }
    const renderTask = page.render({ canvasContext: ctx, viewport: svp });
    currentRenderTaskRef.current = renderTask;
    await renderTask.promise;
    currentRenderTaskRef.current = null;
    const textContent = await page.getTextContent().catch(() => null);
    return { canvas, textContent, viewport };
  }, []);

  const getEffectiveCanvasFilter = useCallback(() => {
    let filter = THEME_STYLES[theme].canvasFilter;
    if (blueLightFilter) {
      const warmth = (themeWarmth - 50) * 0.5;
      const bright = themeBrightness / 100;
      filter += ` brightness(${bright})${warmth > 0 ? ` sepia(${warmth * 0.3}%)` : ''}`;
    }
    return filter;
  }, [theme, blueLightFilter, themeWarmth, themeBrightness]);

  const renderActivePage = useCallback(async () => {
    if (!pdfDoc || !activeCanvasRef.current) return;
    const cacheKey = `${currentPage}_${scale.toFixed(2)}_${rotation}`;
    const cached = pageCacheRef.current.get(cacheKey);

    if (cached) {
      const ctx = activeCanvasRef.current.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          if (!activeCanvasRef.current) return;
          activeCanvasRef.current.width = cached.width;
          activeCanvasRef.current.height = cached.height;
          const dpr = Math.max(window.devicePixelRatio || 1, 2.0);
          activeCanvasRef.current.style.width = `${cached.width / dpr}px`;
          activeCanvasRef.current.style.height = `${cached.height / dpr}px`;
          ctx.drawImage(img, 0, 0);
          redrawAnnotations();
        };
        img.src = cached.dataUrl;
      }
      setPageRendering(false);
    } else {
      setPageRendering(true);
    }

    try {
      const { canvas, textContent, viewport } = await rasterizePageToCanvas(pdfDoc, currentPage, scale, rotation);
      if (activeCanvasRef.current) {
        const ctx = activeCanvasRef.current.getContext('2d');
        activeCanvasRef.current.width = canvas.width;
        activeCanvasRef.current.height = canvas.height;
        activeCanvasRef.current.style.width = canvas.style.width;
        activeCanvasRef.current.style.height = canvas.style.height;
        ctx?.drawImage(canvas, 0, 0);
      }

      if (pageCacheRef.current.size >= CACHE_MAX) {
        const first = pageCacheRef.current.keys().next().value;
        if (first) pageCacheRef.current.delete(first);
      }
      pageCacheRef.current.set(cacheKey, {
        dataUrl: canvas.toDataURL('image/jpeg', 0.88),
        width: canvas.width, height: canvas.height, scale, rotation
      });

      if (activeTextLayerRef.current && textContent) {
        const pdfjsAny = pdfjsLib as any;
        const renderTextLayerFn = pdfjsAny.renderTextLayer;
        activeTextLayerRef.current.innerHTML = '';
        activeTextLayerRef.current.style.width = `${viewport.width}px`;
        activeTextLayerRef.current.style.height = `${viewport.height}px`;
        if (typeof renderTextLayerFn === 'function') {
          renderTextLayerFn({
            textContentSource: textContent, container: activeTextLayerRef.current, viewport
          });
        }
      }
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') console.error(err);
    } finally {
      setPageRendering(false);
    }

    if (preloadTimerRef.current) clearTimeout(preloadTimerRef.current);
    preloadTimerRef.current = setTimeout(async () => {
      if (!pdfDoc) return;
      for (const offset of [1, -1, 2, -2]) {
        const p = currentPage + offset;
        if (p < 1 || p > totalPages) continue;
        const key = `${p}_${scale.toFixed(2)}_${rotation}`;
        if (!pageCacheRef.current.has(key)) {
          try {
            const { canvas } = await rasterizePageToCanvas(pdfDoc, p, scale, rotation);
            if (pageCacheRef.current.size >= CACHE_MAX) {
              const first = pageCacheRef.current.keys().next().value;
              if (first) pageCacheRef.current.delete(first);
            }
            pageCacheRef.current.set(key, {
              dataUrl: canvas.toDataURL('image/jpeg', 0.82),
              width: canvas.width, height: canvas.height, scale, rotation
            });
          } catch {}
        }
      }
    }, 200);
  }, [pdfDoc, currentPage, scale, rotation, rasterizePageToCanvas, totalPages]);

  const redrawAnnotations = () => {
    const canvas = annotationCanvasRef.current;
    if (!canvas || !activeCanvasRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = activeCanvasRef.current.width;
    canvas.height = activeCanvasRef.current.height;
    canvas.style.width = activeCanvasRef.current.style.width;
    canvas.style.height = activeCanvasRef.current.style.height;

    const pageAnnotations = annotations.filter(a => a.page === currentPage);
    for (const ann of pageAnnotations) {
      ctx.strokeStyle = ann.color;
      ctx.fillStyle = ann.color;
      ctx.globalAlpha = ann.opacity;
      ctx.lineWidth = 3;

      if (ann.type === 'highlight' && ann.points) {
        ctx.globalAlpha = ann.opacity * 0.5;
        ctx.fillRect(ann.position.x, ann.position.y, ann.position.width || 100, ann.position.height || 20);
      } else if (ann.type === 'underline' && ann.points) {
        ctx.beginPath();
        ctx.moveTo(ann.position.x, ann.position.y + (ann.position.height || 20));
        ctx.lineTo(ann.position.x + (ann.position.width || 100), ann.position.y + (ann.position.height || 20));
        ctx.stroke();
      } else if (ann.type === 'freehand' && ann.points && ann.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(ann.points[0].x, ann.points[0].y);
        for (let i = 1; i < ann.points.length; i++) {
          ctx.lineTo(ann.points[i].x, ann.points[i].y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  };

  useEffect(() => { redrawAnnotations(); }, [annotations, currentPage, activeCanvasRef.current]);

  const changePage = (num: number) => {
    const target = Math.min(Math.max(1, num), totalPages);
    if (target > currentPage) setPageTransitionDir('next');
    else if (target < currentPage) setPageTransitionDir('prev');
    setCurrentPage(target);
    setPageInput(String(target));
  };

  const fitToContainer = useCallback((mode: ZoomMode) => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const padX = layout === 'dual' ? 160 : 80;
    const padY = 130;
    const w = rect.width - padX;
    const h = rect.height - padY;
    if (w <= 0 || h <= 0) return null;
    const pageW = 800;
    const pageH = 800 / 0.707;
    let s: number;
    switch (mode) {
      case 'page-fit':
        s = Math.min(w / pageW, h / pageH);
        break;
      case 'page-width':
        s = w / pageW;
        break;
      case 'actual-size':
        s = 1;
        break;
      default:
        s = Math.min(w / pageW, h / pageH);
    }
    return Math.min(Math.max(s, 0.25), 3);
  }, [layout]);

  const applyZoomMode = useCallback((mode: ZoomMode) => {
    const s = fitToContainer(mode);
    if (s !== null) setScale(s);
  }, [fitToContainer]);

  const setZoomModeAndApply = useCallback((mode: ZoomMode) => {
    setZoomMode(mode);
    if (mode !== 'custom') applyZoomMode(mode);
  }, [applyZoomMode]);

  const adjustZoom = (delta: number) => {
    setZoomMode('custom');
    setScale(prev => Math.min(Math.max(0.25, prev + delta), 3));
  };

  const zoomTo = (val: number) => {
    setZoomMode('custom');
    setScale(Math.min(Math.max(0.25, val), 3));
  };

  // Measure container and set initial scale before first paint
  useLayoutEffect(() => {
    if (containerReady) return;
    const s = fitToContainer('auto');
    if (s !== null) {
      setScale(s);
      setContainerReady(true);
    }
  }, [fitToContainer, containerReady]);

  // ResizeObserver — recalculate scale when container resizes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (zoomMode === 'auto') {
        const s = fitToContainer('auto');
        if (s !== null) setScale(s);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [zoomMode, fitToContainer]);

  const handleOutlineJump = async (dest: any) => {
    if (!pdfDoc || !dest) return;
    try {
      const explicitDest = typeof dest === 'string' ? await pdfDoc.getDestination(dest) : dest;
      if (explicitDest && explicitDest[0]) {
        const pageIdx = await pdfDoc.getPageIndex(explicitDest[0]);
        changePage(pageIdx + 1);
        if (layout === 'scroll') {
          const el = scrollContainerRef.current;
          if (el) {
            const pageEl = el.querySelector(`[data-page="${pageIdx + 1}"]`);
            if (pageEl) pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }
    } catch {}
  };

  useEffect(() => {
    if (!pdfDoc || !sidebarOpen || isMobile || sidebarTab !== 'thumbnails') return;
    let active = true;
    let rafId: number;
    let idx = 1;
    const maxToRender = Math.min(totalPages, 50);

    const generateNext = () => {
      if (!active || idx > maxToRender) return;
      if (thumbnails[idx]) { idx++; generateNext(); return; }

      pdfDoc.getPage(idx).then(async (page) => {
        if (!active) return;
        const viewport = page.getViewport({ scale: 0.2 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = viewport.width; canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (active) setThumbnails(p => ({ ...p, [idx]: canvas.toDataURL('image/jpeg', 0.6) }));
        }
        idx++;
        rafId = requestAnimationFrame(generateNext);
      }).catch(() => { idx++; rafId = requestAnimationFrame(generateNext); });
    };

    rafId = requestAnimationFrame(generateNext);
    return () => { active = false; cancelAnimationFrame(rafId); };
  }, [pdfDoc, sidebarOpen, totalPages, thumbnails, isMobile, sidebarTab]);

  const handleSearch = async (query: string, mode: SearchMode = searchMode) => {
    setSearchQuery(query);
    if (!query.trim() || !pdfDoc) { setSearchMatches(0); setSearchResults([]); return; }
    try {
      let escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let flags = 'gi';
      if (mode === 'case-sensitive') flags = 'g';
      if (mode === 'regex') escaped = query;
      if (mode === 'whole-word') escaped = `\\b${escaped}\\b`;
      const regex = new RegExp(escaped, flags);

      const page = await pdfDoc.getPage(currentPage);
      const tc = await page.getTextContent();
      const fullText = tc.items.map((item: any) => item.str || '').join(' ');
      const matches = fullText.match(regex);
      setSearchMatches(matches ? matches.length : 0);

      const results: { page: number; count: number }[] = [];
      for (let i = 1; i <= Math.min(totalPages, 10); i++) {
        const p = await pdfDoc.getPage(i);
        const ptc = await p.getTextContent();
        const pt = ptc.items.map((item: any) => item.str || '').join(' ');
        const m = pt.match(regex);
        if (m) results.push({ page: i, count: m.length });
      }
      setSearchResults(results);
    } catch { setSearchMatches(0); setSearchResults([]); }
  };

  const toggleBookmark = () => {
    const existing = bookmarks.findIndex(b => b.page === currentPage);
    if (existing >= 0) {
      setBookmarks(prev => prev.filter((_, i) => i !== existing));
    } else {
      setShowBookmarkInput(true);
      setBookmarkLabel('');
    }
  };

  const addBookmark = () => {
    const newBm: BookmarkItem = {
      id: `bm_${Date.now()}`,
      page: currentPage, label: bookmarkLabel || `Page ${currentPage}`,
      color: annotationColor, createdAt: Date.now()
    };
    setBookmarks(prev => [...prev, newBm]);
    setShowBookmarkInput(false);
    setBookmarkLabel('');
    try {
      supabase.from('pdf_bookmarks').insert({
        document_id: file.id || file.name,
        page_number: currentPage, label: bookmarkLabel || `Page ${currentPage}`,
        color: annotationColor
      }).then(() => {});
    } catch {}
  };

  const removeBookmark = (id: string) => {
    setBookmarks(prev => prev.filter(b => b.id !== id));
    try { supabase.from('pdf_bookmarks').delete().eq('id', id).then(() => {}); } catch {}
  };

  const addAnnotation = (ann: Annotation) => {
    setUndoStack(prev => [...prev.slice(-20), annotations]);
    setRedoStack([]);
    setAnnotations(prev => [...prev, ann]);
  };

  const undo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(prevR => [...prevR, annotations]);
    setAnnotations(prev);
    setUndoStack(prevU => prevU.slice(0, -1));
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(prevU => [...prevU, annotations]);
    setAnnotations(next);
    setRedoStack(prevR => prevR.slice(0, -1));
  };

  const exportAnnotations = () => {
    if (annotations.length === 0) return;
    const md = annotations.map(a => {
      const label = a.type === 'highlight' ? 'Highlight' : a.type === 'sticky' ? 'Note' : a.type === 'underline' ? 'Underline' : a.type;
      return `- **${label}** (Page ${a.page}): ${a.text || a.content?.text || ''}`;
    }).join('\n');
    const blob = new Blob([`# Annotations\n\n${md}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${file.name.replace('.pdf', '')}_annotations.md`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleTextSelect = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { setSelectedText(''); return; }
    const text = sel.toString().trim();
    if (text) setSelectedText(text);
  };

  const copySelectedText = async () => {
    if (!selectedText) return;
    await navigator.clipboard.writeText(selectedText);
    setClipboardMsg('Copied!');
    setTimeout(() => setClipboardMsg(''), 2000);
  };

  const lookupDictionary = async () => {
    if (!selectedText) return;
    setDictWord(selectedText);
    setShowDictLookup(true);
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(selectedText.split(/\s+/)[0])}`);
      const data = await res.json();
      if (data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition) {
        setDictResult(data[0].meanings[0].definitions[0].definition);
      } else {
        setDictResult('Definition not found');
      }
    } catch {
      setDictResult('Could not fetch definition');
    }
  };

  const startAutoScroll = () => {
    setAutoScroll(true);
    if (autoScrollTimerRef.current) clearInterval(autoScrollTimerRef.current);
    autoScrollTimerRef.current = setInterval(() => {
      if (layout === 'scroll' && scrollContainerRef.current) {
        scrollContainerRef.current.scrollBy({ top: autoScrollSpeed, behavior: 'smooth' });
      } else {
        changePage(currentPage + 1);
        if (currentPage >= totalPages) { stopAutoScroll(); }
      }
    }, 3000 / autoScrollSpeed);
  };

  const stopAutoScroll = () => {
    setAutoScroll(false);
    if (autoScrollTimerRef.current) { clearInterval(autoScrollTimerRef.current); autoScrollTimerRef.current = null; }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (!activeCanvasRef.current) return;
    const rect = activeCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (activeTool === 'freehand') {
      isDrawingRef.current = true;
      drawPointsRef.current = [{ x, y }];
    } else if (activeTool === 'highlight' || activeTool === 'underline') {
      isDrawingRef.current = true;
      drawPointsRef.current = [{ x, y }];
    } else if (activeTool === 'sticky') {
      const label = prompt('Note text:') || '';
      if (label) {
        addAnnotation({
          id: `ann_${Date.now()}`, type: 'sticky', page: currentPage,
          color: annotationColor, opacity: annotationOpacity,
          position: { x, y, width: 200, height: 100 },
          content: { text: label }, createdAt: Date.now()
        });
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isDrawingRef.current || !activeCanvasRef.current) return;
    const rect = activeCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (activeTool === 'freehand') {
      drawPointsRef.current.push({ x, y });
      const ctx = annotationCanvasRef.current?.getContext('2d');
      if (ctx && annotationCanvasRef.current) {
        const pts = drawPointsRef.current;
        if (pts.length > 1) {
          ctx.strokeStyle = annotationColor;
          ctx.lineWidth = 3;
          ctx.globalAlpha = annotationOpacity;
          ctx.beginPath();
          ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
          ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }
  };

  const handleCanvasMouseUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (activeTool === 'freehand' && drawPointsRef.current.length > 1) {
      addAnnotation({
        id: `ann_${Date.now()}`, type: 'freehand', page: currentPage,
        color: annotationColor, opacity: annotationOpacity,
        position: { x: 0, y: 0 }, points: [...drawPointsRef.current], createdAt: Date.now()
      });
    } else if ((activeTool === 'highlight' || activeTool === 'underline') && drawPointsRef.current.length > 0) {
      const start = drawPointsRef.current[0];
      addAnnotation({
        id: `ann_${Date.now()}`, type: activeTool as 'highlight' | 'underline', page: currentPage,
        color: annotationColor, opacity: annotationOpacity,
        position: { x: start.x - 20, y: start.y - 8, width: 200, height: 20 },
        points: [...drawPointsRef.current], createdAt: Date.now()
      });
    }
    drawPointsRef.current = [];
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      setSelectedText(sel.toString().trim());
      setShowDictLookup(true);
      lookupDictionary();
    }
  };

  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touches: React.TouchList) => {
    if (touches.length < 2) return { x: 0, y: 0 };
    return { x: (touches[0].clientX + touches[1].clientX) / 2, y: (touches[0].clientY + touches[1].clientY) / 2 };
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touches = e.touches;
    if (touches.length === 2) {
      setIsPinching(true); setIsDragging(false);
      setLastTouchDistance(getTouchDistance(touches));
      setLastTouchCenter(getTouchCenter(touches));
    } else if (touches.length === 1 && scale * touchPinchZoom > 1.05) {
      setIsDragging(true);
      setDragStart({ x: touches[0].clientX - touchPan.x, y: touches[0].clientY - touchPan.y });
    }
  }, [touchPinchZoom, touchPan, scale]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touches = e.touches;
    if (isPinching && touches.length === 2) {
      const newDistance = getTouchDistance(touches);
      const delta = newDistance / (lastTouchDistance || 1);
      const newCenter = getTouchCenter(touches);
      setTouchPinchZoom(prev => Math.min(Math.max(prev * delta, 1), 4.5));
      setTouchPan(prev => ({ x: prev.x + (newCenter.x - lastTouchCenter.x), y: prev.y + (newCenter.y - lastTouchCenter.y) }));
      setLastTouchDistance(newDistance);
      setLastTouchCenter(newCenter);
    } else if (isDragging && touches.length === 1) {
      const px = touches[0].clientX - dragStart.x;
      const py = touches[0].clientY - dragStart.y;
      setTouchPan({ x: px, y: py });
      const now = Date.now();
      const prev = lastPanPositions.current;
      prev.push({ x: px, y: py, t: now });
      if (prev.length > 5) prev.shift();
      if (prev.length >= 2) {
        const last = prev[prev.length - 1];
        const first = prev[0];
        const dt = last.t - first.t;
        if (dt > 10) {
          panVelocityRef.current = { x: (last.x - first.x) / dt * 16, y: (last.y - first.y) / dt * 16 };
        }
      }
    }
  }, [isPinching, isDragging, lastTouchDistance, lastTouchCenter, dragStart]);

  const commitZoom = useCallback((zoom: number) => {
    const newScale = Math.min(Math.max(scale * zoom, 0.5), 4.5);
    setZoomMode('custom');
    setScale(newScale);
    setTouchPinchZoom(1);
    setTouchPan({ x: 0, y: 0 });
  }, [scale]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (isPinching) {
      setIsPinching(false);
      if (touchPinchZoom > 1.05) {
        commitZoom(touchPinchZoom);
      } else {
        setTouchPinchZoom(1);
        setTouchPan({ x: 0, y: 0 });
      }
      return;
    }
    const now = Date.now();
    if (now - lastTap.current < 280 && e.changedTouches.length === 1) {
      const effectiveZoom = scale * touchPinchZoom;
      if (effectiveZoom > 1.2) {
        setZoomMode('auto');
        if (containerRef.current) {
          const s = fitToContainer('auto');
          if (s !== null) { setScale(s); setTouchPinchZoom(1); setTouchPan({ x: 0, y: 0 }); }
        } else {
          setScale(Math.max(0.5, scale / 2.2));
          setTouchPinchZoom(1);
          setTouchPan({ x: 0, y: 0 });
        }
      } else {
        commitZoom(2.2);
      }
    }
    lastTap.current = now;
    if (isDragging) {
      const vel = panVelocityRef.current;
      if (Math.abs(vel.x) > 0.3 || Math.abs(vel.y) > 0.3) {
        let mx = vel.x * 8, my = vel.y * 8;
        let decay = 0.95;
        const animate = () => {
          mx *= decay; my *= decay;
          setTouchPan(prev => ({ x: prev.x + mx, y: prev.y + my }));
          if (Math.abs(mx) > 0.1 || Math.abs(my) > 0.1) {
            momentumFrameRef.current = requestAnimationFrame(animate);
          }
        };
        momentumFrameRef.current = requestAnimationFrame(animate);
      }
    }
    setIsDragging(false);
    lastPanPositions.current = [];
    panVelocityRef.current = { x: 0, y: 0 };
  }, [isPinching, touchPinchZoom, isDragging, commitZoom, scale, fitToContainer]);

  const saveProgress = () => {
    try {
      supabase.from('pdf_reading_progress').upsert({
        document_id: file.id || file.name,
        document_name: file.name,
        user_id: undefined,
        last_page: currentPage,
        total_pages: totalPages,
        zoom: scale, theme, layout,
        reading_time_seconds: readTime,
        last_read_at: new Date().toISOString()
      } as any).then(() => {});
    } catch {}
  };

  useEffect(() => {
    const interval = setInterval(saveProgress, 60000);
    return () => clearInterval(interval);
  }, [currentPage, scale, theme, layout, readTime]);

  const themeStyle = THEME_STYLES[theme];
  const progress = totalPages > 0 ? (currentPage / totalPages) * 100 : 0;
  const canvasFilter = getEffectiveCanvasFilter();
  const transitionClass = transition === 'fade' && pageTransitionDir
    ? `animate-in fade-in duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)]`
    : transition === 'slide' && pageTransitionDir
    ? `animate-in ${pageTransitionDir === 'next' ? 'slide-in-from-right' : 'slide-in-from-left'} duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)]`
    : '';

  // ───────────────── ERROR ─────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background p-6 text-center">
        <div className="p-6 rounded-2xl bg-card border border-border max-w-sm space-y-3 shadow-2xl">
          <div className="flex items-center justify-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-destructive" />
            <p className="text-sm font-semibold text-foreground">Unable to render PDF</p>
          </div>
          <p className="text-xs text-muted-foreground">{error}</p>
          {onDownload && <Button onClick={onDownload} size="sm" className="w-full mt-2 rounded-xl">Download Directly</Button>}
        </div>
      </div>
    );
  }

  // ───────────────── MOBILE ─────────────────
  if (isMobile) {
    return (
      <div ref={containerRef} className="flex flex-col w-full h-full bg-background text-foreground select-none overflow-hidden font-sans" style={{ filter: blueLightFilter ? `brightness(${themeBrightness / 100})` : 'none' }}>
        <div className="absolute top-0 left-0 right-0 h-0.5 z-[60] bg-border/40 pointer-events-none">
          <div style={{ width: `${progress}%`, transition: `width 400ms ${SPRING_EASE}` }} className="h-full bg-primary/80" />
        </div>
        <header style={{ transition: `all 500ms ${SPRING_EASE}` }} className={cn(
          "flex items-center justify-between px-3 h-12 bg-card/95 backdrop-blur-sm border-b border-border/80 shrink-0 z-30",
          isFullscreen && !fsUiVisible ? "-translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
        )}>
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs font-semibold truncate max-w-[140px]">{file.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setShowSearch(!showSearch)} className="h-8 w-8 text-muted-foreground active:scale-90 transition-transform"><Search className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => toggleBookmark()} className="h-8 w-8 text-muted-foreground active:scale-90 transition-transform">
              <Bookmark className={cn("w-4 h-4", bookmarks.some(b => b.page === currentPage) ? "fill-primary text-primary" : "")} />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-8 w-8 text-muted-foreground active:scale-90 transition-transform">
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </Button>
            {onDownload && <Button variant="ghost" size="icon" onClick={onDownload} className="h-8 w-8 text-muted-foreground active:scale-90 transition-transform"><Download className="w-4 h-4" /></Button>}
          </div>
        </header>

        {showSearch && (
          <div className={cn(
            "bg-card/95 backdrop-blur-sm border-b border-border p-2 flex items-center gap-2 z-30 animate-in slide-in-from-top-1 fade-in duration-150",
            isFullscreen && !fsUiVisible ? "hidden" : ""
          )}>
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input placeholder="Search..." value={searchQuery} onChange={e => handleSearch(e.target.value)} className="h-8 text-xs flex-1" />
            <span className="text-[11px] font-mono text-muted-foreground shrink-0 tabular-nums">{searchMatches > 0 ? `${searchMatches}` : ''}</span>
            <Button variant="ghost" size="icon" onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchMatches(0); }} className="h-7 w-7"><X className="w-3.5 h-3.5" /></Button>
          </div>
        )}

        <main
          className={cn("flex-1 overflow-hidden flex items-center justify-center relative transition-colors duration-500", themeStyle.bg)}
          onTouchStart={(e) => {
            mobileTapRef.current = true;
            handleTouchStart(e);
          }}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => {
            if (!mobileTapRef.current && !isPinching && scale * touchPinchZoom <= 1.05) {
              setFsUiVisible(prev => !prev);
            }
            mobileTapRef.current = false;
          }}
          onMouseUp={handleTextSelect}
        >
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="text-xs font-mono text-muted-foreground tabular-nums">Page 1 of {totalPages || '...'}</span>
            </div>
          ) : (
            <div
              className={cn(
                "relative inline-block shadow-2xl rounded-sm will-change-transform",
                transitionClass,
                pageRendering && "opacity-90"
              )}
              style={{
                filter: canvasFilter,
                transform: `translate3d(${touchPan.x}px, ${touchPan.y}px, 0px) scale3d(${touchPinchZoom}, ${touchPinchZoom}, 1)`,
                transition: isPinching || isDragging ? 'none' : `transform 0.4s ${SPRING_EASE}, opacity 0.35s ${SPRING_EASE}`
              }}
            >
              <canvas ref={activeCanvasRef} className="block rounded-sm bg-white" />
              <div ref={activeTextLayerRef} className="absolute inset-0 overflow-hidden select-text text-transparent" />
              <canvas ref={annotationCanvasRef} className="absolute inset-0 pointer-events-none rounded-sm" />
            </div>
          )}

          {/* Zoom level indicator */}
          {touchPinchZoom > 1.05 && (
            <div className="absolute top-4 right-4 z-20 pointer-events-none">
              <div className="bg-black/70 text-white text-xs font-mono px-3 py-1.5 rounded-full backdrop-blur-sm tabular-nums">
                {Math.round(touchPinchZoom * scale * 100)}%
              </div>
            </div>
          )}
        </main>

        {/* Floating bottom toolbar — compact */}
        <div style={{ transition: `all 500ms ${SPRING_EASE}` }} className={cn(
          "absolute bottom-5 inset-x-0 flex justify-center z-30 pointer-events-none",
          isFullscreen && !fsUiVisible ? "translate-y-full opacity-0" : "translate-y-0 opacity-100"
        )}>
          <div className="bg-card/85 backdrop-blur-lg border border-border/70 rounded-full shadow-2xl px-2 py-1 flex items-center gap-0.5 pointer-events-auto">
            <button onClick={() => commitZoom(touchPinchZoom / 1.25)} className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground active:scale-90 transition-transform hover:bg-accent/50"><ZoomOut className="w-3.5 h-3.5" /></button>
            <span className="text-[9px] font-mono font-semibold tabular-nums min-w-[28px] text-center">{Math.round(scale * touchPinchZoom * 100)}%</span>
            <button onClick={() => commitZoom(touchPinchZoom * 1.25)} className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground active:scale-90 transition-transform hover:bg-accent/50"><ZoomIn className="w-3.5 h-3.5" /></button>

            <div className="h-3.5 w-px bg-border/40 mx-0.5" />

            <button disabled={currentPage <= 1} onClick={() => changePage(currentPage - 1)} className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground active:scale-90 transition-transform hover:bg-accent/50 disabled:opacity-25"><ChevronLeft className="w-3.5 h-3.5" /></button>
            <span className="text-[9px] font-mono tabular-nums min-w-[32px] text-center">{currentPage}/{totalPages || '-'}</span>
            <button disabled={currentPage >= totalPages} onClick={() => changePage(currentPage + 1)} className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground active:scale-90 transition-transform hover:bg-accent/50 disabled:opacity-25"><ChevronRight className="w-3.5 h-3.5" /></button>

            <div className="h-3.5 w-px bg-border/40 mx-0.5" />

            <button onClick={() => setTheme(t => t === 'normal' ? 'dark' : 'dark' ? 'sepia' : 'forest' ? 'forest' : 'normal')} className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground active:scale-90 transition-transform hover:bg-accent/50">
              {theme === 'dark' ? <Moon className="w-3 h-3" /> : theme === 'sepia' ? <BookOpen className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
            </button>

            <button onClick={toggleFullscreen} className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground active:scale-90 transition-transform hover:bg-accent/50">
              {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {showBookmarkInput && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-card border border-border shadow-2xl rounded-xl p-4 w-64 animate-in fade-in zoom-in-95 duration-150">
            <p className="text-xs font-semibold mb-2">Bookmark Page {currentPage}</p>
            <Input autoFocus placeholder="Label (optional)" value={bookmarkLabel} onChange={e => setBookmarkLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && addBookmark()} className="h-8 text-xs mb-2" />
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-7 text-xs rounded-lg" onClick={addBookmark}>Save</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs rounded-lg" onClick={() => setShowBookmarkInput(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ───────────────── DESKTOP ─────────────────
  return (
    <div ref={containerRef} className={cn("flex flex-col w-full h-full bg-background text-foreground select-none overflow-hidden font-sans", focusMode && "cursor-none")} style={{ filter: blueLightFilter ? `brightness(${themeBrightness / 100})` : 'none' }}>
      {!focusMode && <div className="absolute top-0 left-0 right-0 h-0.5 z-[60] bg-border/40 pointer-events-none">
        <div style={{ width: `${progress}%`, transition: `width 400ms ${SPRING_EASE}` }} className="h-full bg-primary/80" />
      </div>}

        <header style={{ transition: `all 500ms ${SPRING_EASE}` }} className={cn(
          "flex items-center justify-between px-4 h-14 bg-card/95 backdrop-blur-md border-b border-border/80 shrink-0 gap-3 z-40 shadow-sm",
          isFullscreen && !fsUiVisible ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100",
          focusMode && "hidden"
        )}>
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="h-8 w-8 text-muted-foreground hover:text-foreground transition-transform active:scale-90" title="Toggle Sidebar (T)"><LayoutGrid className="w-4 h-4" /></Button>
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-semibold truncate max-w-[180px]">{file.name}</span>
            <span className="text-[10px] font-mono text-muted-foreground/60 hidden lg:inline-block tabular-nums">{formatTime(readTime)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-muted/80 border border-border/80 rounded-xl p-1 shadow-inner">
          <Button variant="ghost" size="icon" disabled={currentPage <= 1} onClick={() => changePage(currentPage - 1)} className="h-7 w-7 text-muted-foreground hover:text-foreground transition-transform active:scale-90 disabled:opacity-30"><ChevronLeft className="w-3.5 h-3.5" /></Button>
          <Input value={pageInput} onChange={e => setPageInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') changePage(parseInt(pageInput, 10) || 1); }} className="w-12 h-6 px-1 text-center font-mono text-xs bg-background border-border/60 rounded-md tabular-nums" />
          <span className="text-xs font-mono text-muted-foreground tabular-nums px-1">/ {totalPages || '-'}</span>
          <Button variant="ghost" size="icon" disabled={currentPage >= totalPages} onClick={() => changePage(currentPage + 1)} className="h-7 w-7 text-muted-foreground hover:text-foreground transition-transform active:scale-90 disabled:opacity-30"><ChevronRight className="w-3.5 h-3.5" /></Button>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setShowAnnotationTools(!showAnnotationTools)} className={cn("h-8 w-8 transition-transform active:scale-90", showAnnotationTools ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground")} title="Annotation Tools"><Pen className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setShowPrefs(!showPrefs)} className={cn("h-8 w-8 transition-transform active:scale-90", showPrefs ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground")} title="Reading Preferences (Ctrl+P)"><Eye className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setShowSearch(!showSearch)} className={cn("h-8 w-8 transition-transform active:scale-90", showSearch ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground")} title="Search (Ctrl+F)"><Search className="w-4 h-4" /></Button>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" onClick={() => adjustZoom(-0.2)} className="h-8 w-8 text-muted-foreground hover:text-foreground transition-transform active:scale-90"><ZoomOut className="w-3.5 h-3.5" /></Button>
            <div className="relative group/zoom">
              <span className="text-xs font-mono text-muted-foreground w-12 text-center tabular-nums cursor-pointer hover:text-foreground flex items-center justify-center gap-0.5" onClick={() => setZoomModeAndApply('auto')} title={`Zoom mode: ${ZOOM_MODE_LABELS[zoomMode]} (click for auto-fit)`}>
                {Math.round(scale * 100)}%
              </span>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-card border border-border shadow-xl rounded-xl p-1 hidden group-hover/zoom:flex flex-col gap-0.5 z-50 min-w-[130px]">
                {(Object.keys(ZOOM_MODE_LABELS) as ZoomMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setZoomModeAndApply(mode)}
                    className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors", zoomMode === mode ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
                  >
                    {ZOOM_MODE_ICONS[mode]}
                    {ZOOM_MODE_LABELS[mode]}
                    {zoomMode === mode && <Check className="ml-auto w-3 h-3 text-primary" />}
                  </button>
                ))}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => adjustZoom(0.2)} className="h-8 w-8 text-muted-foreground hover:text-foreground transition-transform active:scale-90"><ZoomIn className="w-3.5 h-3.5" /></Button>
          </div>
          <div className="h-5 w-px bg-border/60 mx-0.5" />
          <Button variant="ghost" size="icon" onClick={() => setLayout(l => l === 'single' ? 'scroll' : l === 'scroll' ? 'dual' : 'single')} className={cn("h-8 w-8 transition-transform active:scale-90", layout !== 'single' ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground")} title="Toggle Layout (S)">
            {layout === 'scroll' ? <ScrollText className="w-4 h-4" /> : layout === 'dual' ? <Columns2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-8 w-8 text-muted-foreground hover:text-foreground transition-transform active:scale-90" title="Fullscreen (F)">
            {isFullscreen ? <Minimize className="w-4 h-4 text-primary" /> : <Maximize className="w-4 h-4" />}
          </Button>
          {onDownload && <Button variant="ghost" size="icon" onClick={onDownload} className="h-8 w-8 text-muted-foreground hover:text-foreground transition-transform active:scale-90" title="Download"><Download className="w-4 h-4" /></Button>}
        </div>
      </header>

      {/* Annotation Toolbar */}
      {showAnnotationTools && (
        <div className="absolute top-16 left-4 z-50 bg-card border border-border shadow-2xl rounded-xl p-2 animate-in fade-in slide-in-from-top-2 duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)]">
          <div className="flex items-center gap-1 mb-1.5 pb-1.5 border-b border-border/60">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Annotate</span>
            <div className="flex-1" />
            <Button variant="ghost" size="icon" onClick={() => { setShowAnnotationTools(false); setActiveTool('select'); }} className="h-5 w-5"><X className="w-3 h-3" /></Button>
          </div>
          <div className="grid grid-cols-5 gap-1 mb-2">
            {(['select', 'highlight', 'underline', 'strikethrough', 'freehand', 'sticky', 'textbox', 'signature', 'eraser'] as const).map(tool => (
              <button
                key={tool}
                onClick={() => setActiveTool(tool)}
                className={cn("p-1.5 rounded-lg text-[10px] font-medium flex flex-col items-center gap-0.5 transition-all", activeTool === tool ? "bg-primary/10 text-primary shadow-xs" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
                title={tool}
              >
                {tool === 'select' && <span className="text-xs">&#x1F426;</span>}
                {tool === 'highlight' && <Highlighter className="w-3.5 h-3.5" />}
                {tool === 'underline' && <Underline className="w-3.5 h-3.5" />}
                {tool === 'strikethrough' && <Sigma className="w-3.5 h-3.5" />}
                {tool === 'freehand' && <Pen className="w-3.5 h-3.5" />}
                {tool === 'sticky' && <StickyNote className="w-3.5 h-3.5" />}
                {tool === 'textbox' && <Type className="w-3.5 h-3.5" />}
                {tool === 'signature' && <Signature className="w-3.5 h-3.5" />}
                {tool === 'eraser' && <Eraser className="w-3.5 h-3.5" />}
                <span className="text-[8px]">{tool}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {HIGHLIGHT_COLORS.map(c => (
              <button key={c} onClick={() => setAnnotationColor(c)} className={cn("w-5 h-5 rounded-full border-2 transition-transform active:scale-90", annotationColor === c ? "border-foreground scale-110" : "border-transparent")} style={{ backgroundColor: c }} />
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-border/60">
            <input type="range" min="10" max="90" value={Math.round(annotationOpacity * 100)} onChange={e => setAnnotationOpacity(parseInt(e.target.value) / 100)} className="flex-1 h-1 accent-primary cursor-pointer" />
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums w-8 text-right">{Math.round(annotationOpacity * 100)}%</span>
          </div>
          <div className="flex items-center gap-1 mt-1.5">
            <Button variant="ghost" size="icon" onClick={undo} disabled={undoStack.length === 0} className="h-6 w-6 text-muted-foreground disabled:opacity-30" title="Undo (Ctrl+Z)"><Undo2 className="w-3 h-3" /></Button>
            <Button variant="ghost" size="icon" onClick={redo} disabled={redoStack.length === 0} className="h-6 w-6 text-muted-foreground disabled:opacity-30" title="Redo (Ctrl+Shift+Z)"><Redo2 className="w-3 h-3" /></Button>
            <div className="flex-1" />
            <button onClick={exportAnnotations} className="text-[9px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-accent">Export MD</button>
          </div>
        </div>
      )}

      {/* Search overlay */}
      {showSearch && (
        <div className="absolute top-16 right-32 z-50 bg-card border border-border shadow-2xl rounded-xl p-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground ml-1 shrink-0" />
            <Input autoFocus placeholder="Search..." value={searchQuery} onChange={e => handleSearch(e.target.value, searchMode)} onKeyDown={e => { if (e.key === 'Escape') { setShowSearch(false); setSearchQuery(''); } }} className="h-8 w-48 text-xs" />
            <div className="flex items-center gap-0.5">
              <button onClick={() => setSearchMode(s => s === 'normal' ? 'case-sensitive' : 'normal')} className={cn("p-1 rounded text-[10px] font-mono", searchMode === 'case-sensitive' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-accent')} title="Aa">Aa</button>
              <button onClick={() => setSearchMode(s => s === 'regex' ? 'normal' : 'regex')} className={cn("p-1 rounded text-[10px] font-mono", searchMode === 'regex' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-accent')} title="Regex">.*</button>
              <button onClick={() => setSearchMode(s => s === 'whole-word' ? 'normal' : 'whole-word')} className={cn("p-1 rounded text-[10px] font-mono", searchMode === 'whole-word' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-accent')} title="Whole word">W</button>
            </div>
          </div>
          <div className="flex items-center justify-between mt-1.5 px-1">
            <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
              {searchQuery ? `${searchMatches} match${searchMatches !== 1 ? 'es' : ''}` : ''}
              {searchResults.length > 0 && searchQuery && ` across ${searchResults.length} page${searchResults.length > 1 ? 's' : ''}`}
            </span>
            <Button variant="ghost" size="icon" onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchMatches(0); setSearchResults([]); }} className="h-6 w-6"><X className="w-3 h-3" /></Button>
          </div>
          {searchResults.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5 max-h-20 overflow-y-auto">
              {searchResults.map(r => (
                <button key={r.page} onClick={() => changePage(r.page)} className={cn("px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors", currentPage === r.page ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground hover:bg-accent')}>
                  p{r.page} ({r.count})
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preferences Panel */}
      {showPrefs && (
        <div className="absolute top-16 right-4 z-50 bg-card border border-border shadow-2xl rounded-xl p-4 w-72 max-h-[80vh] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold flex items-center gap-1.5"><Settings className="w-3.5 h-3.5" /> Preferences</span>
            <Button variant="ghost" size="icon" onClick={() => setShowPrefs(false)} className="h-6 w-6"><X className="w-3 h-3" /></Button>
          </div>
          <div className="space-y-3">
            <div>
              <span className="text-[11px] text-muted-foreground mb-1.5 block font-medium">Theme</span>
              <div className="grid grid-cols-3 gap-1">
                {(Object.keys(THEME_STYLES) as ReadingTheme[]).map(t => (
                  <button key={t} onClick={() => setTheme(t)} className={cn("py-1.5 rounded-lg text-[10px] font-medium transition-all", theme === t ? 'bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30' : 'bg-muted text-muted-foreground hover:bg-accent')}>
                    {THEME_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground mb-1 block font-medium">Display</span>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Thermometer className="w-3 h-3 text-muted-foreground" />
                  <input type="range" min="0" max="100" value={themeWarmth} onChange={e => setThemeWarmth(parseInt(e.target.value))} className="flex-1 h-1 accent-primary cursor-pointer" />
                </div>
                <div className="flex items-center gap-2">
                  <Sun className="w-3 h-3 text-muted-foreground" />
                  <input type="range" min="50" max="150" value={themeBrightness} onChange={e => setThemeBrightness(parseInt(e.target.value))} className="flex-1 h-1 accent-primary cursor-pointer" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Blue light filter</span>
                  <button onClick={() => setBlueLightFilter(!blueLightFilter)} className={cn("w-8 h-4 rounded-full transition-colors", blueLightFilter ? 'bg-primary' : 'bg-muted-foreground/30')}>
                    <div className={cn("w-3 h-3 rounded-full bg-white transition-transform m-0.5", blueLightFilter && "translate-x-4")} />
                  </button>
                </div>
              </div>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground mb-1 block font-medium">Layout & Transition</span>
              <div className="flex gap-1 mb-1.5">
                {(['single', 'scroll', 'dual'] as PageLayout[]).map(l => (
                  <button key={l} onClick={() => setLayout(l)} className={cn("flex-1 py-1 rounded-lg text-[10px] font-medium transition-all", layout === l ? 'bg-primary/10 text-primary shadow-xs' : 'bg-muted text-muted-foreground hover:bg-accent')}>
                    {l === 'single' ? 'Single' : l === 'scroll' ? 'Scroll' : 'Dual'}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {(['none', 'fade', 'slide'] as PageTransition[]).map(t => (
                  <button key={t} onClick={() => setTransition(t)} className={cn("flex-1 py-1 rounded-lg text-[10px] font-medium transition-all", transition === t ? 'bg-primary/10 text-primary shadow-xs' : 'bg-muted text-muted-foreground hover:bg-accent')}>
                    {t === 'none' ? 'None' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground mb-1 block font-medium">Reading Tools</span>
              <div className="flex flex-wrap gap-1">
                <button onClick={() => setFocusMode(!focusMode)} className={cn("px-2 py-1 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1", focusMode ? 'bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30' : 'bg-muted text-muted-foreground hover:bg-accent')}><EyeOff className="w-3 h-3" /> Focus</button>
                <button onClick={() => setShowStats(!showStats)} className={cn("px-2 py-1 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1", showStats ? 'bg-primary/10 text-primary shadow-xs' : 'bg-muted text-muted-foreground hover:bg-accent')}><Hash className="w-3 h-3" /> Stats</button>
                <button onClick={() => setShowKbShortcuts(true)} className="px-2 py-1 rounded-lg text-[10px] font-medium bg-muted text-muted-foreground hover:bg-accent transition-all flex items-center gap-1"><Keyboard className="w-3 h-3" /> Keys</button>
                <button onClick={toggleBookmark} className="px-2 py-1 rounded-lg text-[10px] font-medium bg-muted text-muted-foreground hover:bg-accent transition-all flex items-center gap-1"><BookmarkPlus className="w-3 h-3" /> Bookmark</button>
              </div>
            </div>
            <div className="pt-2 border-t border-border/60 flex justify-between text-[10px] text-muted-foreground/60">
              <span>Read: {formatTime(readTime)}</span>
              <span>Words: ~{(wordCount || totalPages * 300).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Dictionary Lookup */}
      {showDictLookup && selectedText && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-card border border-border shadow-2xl rounded-xl p-4 w-80 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Dictionary</span>
            <Button variant="ghost" size="icon" onClick={() => { setShowDictLookup(false); setDictResult(''); }} className="h-6 w-6"><X className="w-3 h-3" /></Button>
          </div>
          <p className="text-sm font-semibold mb-1">{dictWord || selectedText.split(/\s+/)[0]}</p>
          <p className="text-xs text-muted-foreground">{dictResult || 'Loading...'}</p>
          {selectedText.split(/\s+/).length > 1 && (
            <div className="mt-2 flex gap-1">
              <Button size="sm" variant="outline" className="h-7 text-[10px] rounded-lg flex-1" onClick={() => { navigator.clipboard.writeText(selectedText); setClipboardMsg('Copied!'); setTimeout(() => setClipboardMsg(''), 1500); }}><ClipboardCopy className="w-3 h-3 mr-1" /> {clipboardMsg || 'Copy text'}</Button>
            </div>
          )}
        </div>
      )}

      {/* Bookmark Label Input */}
      {showBookmarkInput && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-card border border-border shadow-2xl rounded-xl p-4 w-64 animate-in fade-in zoom-in-95 duration-150">
          <p className="text-xs font-semibold mb-2 flex items-center gap-1.5"><BookmarkPlus className="w-3.5 h-3.5" /> Bookmark Page {currentPage}</p>
          <Input autoFocus placeholder="Label" value={bookmarkLabel} onChange={e => setBookmarkLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && addBookmark()} className="h-8 text-xs mb-2" />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-7 text-xs rounded-lg" onClick={addBookmark}>Save</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs rounded-lg" onClick={() => setShowBookmarkInput(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Auto-scroll Indicator */}
      {autoScroll && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 bg-primary/90 text-primary-foreground text-[10px] px-3 py-1.5 rounded-full shadow-2xl flex items-center gap-2 animate-in fade-in duration-150">
          <Play className="w-3 h-3 fill-current" /> Auto-scrolling
          <input type="range" min="1" max="10" value={autoScrollSpeed} onChange={e => setAutoScrollSpeed(parseInt(e.target.value))} className="w-16 h-1 accent-white cursor-pointer" />
          <Button variant="ghost" size="icon" onClick={stopAutoScroll} className="h-5 w-5 text-primary-foreground/80 hover:text-primary-foreground"><X className="w-3 h-3" /></Button>
        </div>
      )}

      {/* Keyboard Shortcuts */}
      {showKbShortcuts && (
        <div className="absolute inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowKbShortcuts(false)}>
          <div className="bg-card border border-border shadow-2xl rounded-2xl p-5 w-96 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">Keyboard Shortcuts</span>
              <Button variant="ghost" size="icon" onClick={() => setShowKbShortcuts(false)} className="h-6 w-6"><X className="w-3 h-3" /></Button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ['← → / PgUp PgDn', 'Navigate pages'],
                ['Space', 'Next page'],
                ['Home / End', 'First / Last page'],
                ['F', 'Toggle fullscreen'],
                ['T', 'Toggle sidebar'],
                ['S', 'Cycle layout'],
                ['B', 'Toggle bookmark'],
                ['H', 'Toggle highlight tool'],
                ['Ctrl+F / ⌘F', 'Search'],
                ['Ctrl+Z / ⌘Z', 'Undo'],
                ['Ctrl+Shift+Z', 'Redo'],
                ['Ctrl+D / ⌘D', 'Toggle highlight'],
                ['Esc', 'Close panels'],
                ['?', 'Show shortcuts'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono min-w-[60px] text-center">{key}</kbd>
                  <span className="text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Statistics */}
      {showStats && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-card border border-border shadow-2xl rounded-xl p-4 w-72 animate-in fade-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> Document Stats</span>
            <Button variant="ghost" size="icon" onClick={() => setShowStats(false)} className="h-6 w-6"><X className="w-3 h-3" /></Button>
          </div>
          <div className="space-y-2 text-xs">
            {[
              ['File name', file.name],
              ['Total pages', String(totalPages)],
              ['Current page', String(currentPage)],
              ['Progress', `${Math.round(progress)}%`],
              ['Estimated words', (wordCount || totalPages * 300).toLocaleString()],
              ['Est. read time', estimateReadTime(wordCount || totalPages * 300)],
              ['Reading time', formatTime(readTime)],
              ['Zoom', `${Math.round(scale * 100)}%`],
              ['Theme', THEME_LABELS[theme]],
              ['Layout', layout === 'dual' ? 'Dual page' : layout === 'scroll' ? 'Scroll' : 'Single page'],
              ['Bookmarks', String(bookmarks.length)],
              ['Annotations', String(annotations.length)],
              ['Sidebar', sidebarOpen ? 'Open' : 'Closed'],
              ['Fullscreen', isFullscreen ? 'Yes' : 'No'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className={cn("flex flex-1 relative overflow-hidden", focusMode && "cursor-none")}>
        {/* Sidebar */}
        <aside style={{ width: sidebarOpen ? sidebarWidth : 0, transition: `all 350ms ${SPRING_EASE}` }} className={cn(
          "bg-card/95 border-r border-border/80 flex flex-col shrink-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full w-0 border-r-0 overflow-hidden"
        )}>
          <div className="flex items-center border-b border-border/80 p-1 bg-muted/30">
            {(['thumbnails', 'outline', 'bookmarks', 'annotations', 'stats'] as SidebarTab[]).map(tab => (
              <button key={tab} onClick={() => setSidebarTab(tab)} className={cn("flex-1 py-1.5 text-[10px] font-medium rounded-md flex items-center justify-center gap-1 transition-colors", sidebarTab === tab ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}>
                {tab === 'thumbnails' && <Layers className="w-3 h-3" />}
                {tab === 'outline' && <ListTree className="w-3 h-3" />}
                {tab === 'bookmarks' && <Bookmark className="w-3 h-3" />}
                {tab === 'annotations' && <Pen className="w-3 h-3" />}
                {tab === 'stats' && <Hash className="w-3 h-3" />}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-2 overscroll-contain">
            {sidebarTab === 'thumbnails' && (
              <div className="grid grid-cols-1 gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                  <button key={num} onClick={() => { changePage(num); if (layout === 'scroll' && scrollContainerRef.current) { const el = scrollContainerRef.current.querySelector(`[data-page="${num}"]`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }}
                    className={cn("flex flex-col items-center p-1.5 rounded-xl border text-[10px] transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]", currentPage === num ? "bg-primary/10 border-primary/50 font-bold text-primary shadow-sm" : "bg-background/40 border-border/60 text-muted-foreground hover:bg-card hover:border-border")}>
                    <div className="w-full aspect-[1/1.4] bg-muted/60 rounded-lg mb-1 flex items-center justify-center overflow-hidden border border-border/40">
                      {thumbnails[num] ? <img src={thumbnails[num]} alt={`Page ${num}`} className="w-full h-full object-contain transition-opacity duration-200" /> : <span className="font-mono text-[10px] text-muted-foreground">{num}</span>}
                    </div>
                    <span className={cn("text-[9px]", currentPage === num ? "text-primary" : "text-muted-foreground")}>Page {num}</span>
                  </button>
                ))}
              </div>
            )}
            {sidebarTab === 'outline' && (
              <div className="space-y-1 text-[11px]">
                {outline.length === 0 ? <p className="text-center text-muted-foreground/60 py-4 text-[10px]">No outline</p> : outline.map((item, idx) => (
                  <button key={idx} onClick={() => handleOutlineJump(item.dest)} className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-accent/60 truncate font-medium text-muted-foreground hover:text-foreground transition-colors active:scale-[0.98]">{item.title}</button>
                ))}
              </div>
            )}
            {sidebarTab === 'bookmarks' && (
              <div className="space-y-1.5">
                {bookmarks.length === 0 ? <p className="text-center text-muted-foreground/60 py-4 text-[10px]">No bookmarks. Press <kbd className="px-1 bg-muted rounded text-[9px]">B</kbd> to add one.</p> : bookmarks.map(bm => (
                  <div key={bm.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/60 group">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: bm.color }} />
                    <button onClick={() => changePage(bm.page)} className="flex-1 text-left truncate">
                      <span className="text-xs font-medium">{bm.label}</span>
                      <span className="text-[10px] text-muted-foreground ml-1">p.{bm.page}</span>
                    </button>
                    <button onClick={() => removeBookmark(bm.id)} className="opacity-0 group-hover:opacity-100 transition-opacity"><BookmarkX className="w-3 h-3 text-muted-foreground hover:text-destructive" /></button>
                  </div>
                ))}
              </div>
            )}
            {sidebarTab === 'annotations' && (
              <div className="space-y-1.5">
                {annotations.length === 0 ? <p className="text-center text-muted-foreground/60 py-4 text-[10px]">No annotations yet. Use the pen tool to start.</p> : annotations.map(ann => (
                  <div key={ann.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-accent/60 group">
                    <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ backgroundColor: ann.color }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-medium capitalize">{ann.type}</span>
                      <span className="text-[10px] text-muted-foreground ml-1">p.{ann.page}</span>
                      {ann.content?.text && <p className="text-[10px] text-muted-foreground truncate">{ann.content.text}</p>}
                    </div>
                    <button onClick={() => { setAnnotations(prev => prev.filter(a => a.id !== ann.id)); }} className="opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3 text-muted-foreground hover:text-destructive" /></button>
                  </div>
                ))}
                {annotations.length > 0 && (
                  <button onClick={exportAnnotations} className="w-full py-1 text-[10px] text-muted-foreground hover:text-foreground bg-muted/50 rounded-lg hover:bg-accent transition-colors">Export as Markdown</button>
                )}
              </div>
            )}
            {sidebarTab === 'stats' && (
              <div className="space-y-1.5 text-xs">
                {[
                  ['Pages', `${currentPage} / ${totalPages}`],
                  ['Progress', `${Math.round(progress)}%`],
                  ['Words', (wordCount || totalPages * 300).toLocaleString()],
                  ['Read time', formatTime(readTime)],
                  ['Est. total', estimateReadTime(wordCount || totalPages * 300)],
                  ['Zoom', `${Math.round(scale * 100)}%`],
                  ['Bookmarks', String(bookmarks.length)],
                  ['Annotations', String(annotations.length)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1 border-b border-border/30 last:border-0">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-mono font-medium tabular-nums">{v}</span>
                  </div>
                ))}
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                  <div style={{ width: `${progress}%`, transition: `width 400ms ${SPRING_EASE}` }} className="h-full bg-primary rounded-full" />
                </div>
              </div>
            )}
          </div>
          {/* Sidebar resize handle */}
          <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group z-10" onMouseDown={(e) => {
            const startX = e.clientX;
            const startW = sidebarWidth;
            const onMove = (ev: MouseEvent) => { setSidebarWidth(Math.max(160, Math.min(400, startW + ev.clientX - startX))); };
            const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          }}>
            <div className="w-0.5 h-full mx-auto bg-transparent group-hover:bg-primary/50 transition-colors rounded-full" />
          </div>
        </aside>

        {/* Main canvas */}
        <main style={{ transition: `background-color 600ms ${SPRING_EASE}` }} className={cn("flex-1 overflow-auto relative", themeStyle.bg)}>
          {loading ? (
            <div className="flex items-center justify-center min-h-full">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-xs font-mono text-muted-foreground tabular-nums">Loading PDF... {totalPages ? `${totalPages} pages` : ''}</span>
              </div>
            </div>
          ) : layout === 'scroll' ? (
            <div ref={scrollContainerRef} className="w-full h-full overflow-y-auto overscroll-contain p-8 scroll-smooth" style={{ filter: canvasFilter }} />
          ) : (
            <div className="flex flex-col items-center justify-start min-h-full w-full p-4">
              <div
                className={cn(
                  "relative inline-block rounded-sm will-change-transform shadow-2xl",
                  transitionClass,
                  pageRendering && "opacity-80",
                  focusMode && "shadow-none"
                )}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onContextMenu={handleContextMenu}
                onMouseUpCapture={handleTextSelect}
                style={{
                  transform: layout === 'dual' ? 'scale(0.85)' : 'none',
                  transition: `transform 0.4s ${SPRING_EASE}, opacity 0.35s ${SPRING_EASE}`
                }}
              >
                <canvas ref={activeCanvasRef} className="block rounded-sm bg-white" style={{ filter: canvasFilter }} />
                <canvas ref={annotationCanvasRef} className="absolute inset-0 pointer-events-none rounded-sm" />
                <div ref={activeTextLayerRef} className="absolute inset-0 overflow-hidden select-text text-transparent pointer-events-auto" />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Focus mode floating mini-controls */}
      {focusMode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40">
          <div className="bg-card/80 backdrop-blur-md border border-border/60 rounded-full shadow-2xl px-2 py-1 flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => changePage(currentPage - 1)} disabled={currentPage <= 1} className="h-7 w-7 rounded-full text-muted-foreground"><ChevronLeft className="w-3.5 h-3.5" /></Button>
            <span className="text-[10px] font-mono tabular-nums px-1 text-muted-foreground">{currentPage}/{totalPages}</span>
            <Button variant="ghost" size="icon" onClick={() => changePage(currentPage + 1)} disabled={currentPage >= totalPages} className="h-7 w-7 rounded-full text-muted-foreground"><ChevronRight className="w-3.5 h-3.5" /></Button>
            <div className="h-4 w-px bg-border/40 mx-0.5" />
            <button onClick={() => setFocusMode(false)} className="h-7 px-2 rounded-full text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors flex items-center gap-1"><Eye className="w-3 h-3" /> Exit focus</button>
          </div>
        </div>
      )}

      {/* Bottom notification */}
      {clipboardMsg && (
        <div className="absolute bottom-20 right-6 z-50 bg-card border border-border shadow-xl rounded-lg px-3 py-1.5 text-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
          {clipboardMsg}
        </div>
      )}
    </div>
  );
}

// Required for TypeScript - keyboard icon component not in lucide
const Keyboard = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="20" height="14" x="2" y="5" rx="2" ry="2" />
    <line x1="6" x2="6.01" y1="9" y2="9" />
    <line x1="10" x2="10.01" y1="9" y2="9" />
    <line x1="14" x2="14.01" y1="9" y2="9" />
    <line x1="18" x2="18.01" y1="9" y2="9" />
    <line x1="6" x2="6.01" y1="13" y2="13" />
    <line x1="10" x2="10.01" y1="13" y2="13" />
    <line x1="14" x2="14.01" y1="13" y2="13" />
    <line x1="18" x2="18.01" y1="13" y2="13" />
  </svg>
);

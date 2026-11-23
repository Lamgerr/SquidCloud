/**
 * SquidCloud Folio PDF viewer.
 *
 * The page engine follows Folio's architecture (owenpkent/folio, MIT): PDF.js
 * owns parsing/rasterising, pages reserve their layout box up front and are
 * painted only when they scroll near the viewport, and the text layer is built
 * separately so selection and screen readers work. The chrome is rebuilt in
 * SquidCloud's own language — floating grouped option docks, neutral glass,
 * short eased transitions, no decorative gloss or spring wobble.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Download, Minus, Plus, Maximize2, PanelLeft, Type, ChevronLeft,
  ChevronRight, FileText, RotateCw, EyeOff,
} from '@/lib/icon-map';
import { cn } from '@/lib/utils';
import { getPDFJS } from '@/lib/pdfjs-config';
import 'pdfjs-dist/web/pdf_viewer.css';

interface FolioPdfViewerProps {
  file?: any;
  blobUrl?: string;
  pdfBlob?: Blob | null;
  onClose?: () => void;
  onDownload?: () => void;
  className?: string;
}

type Dim = { width: number; height: number };
type Fit = 'width' | 'page' | 'custom';

/* ── page: layout box first, canvas + text only when near the viewport ── */
const PdfPage: React.FC<{
  doc: any; pageNumber: number; scale: number; rotation: number;
  text: boolean; scrollRoot: React.RefObject<HTMLDivElement>;
  onSize: (n: number, d: Dim) => void; onReady: (el: HTMLDivElement | null, n: number) => void;
}> = ({ doc, pageNumber, scale, rotation, text, scrollRoot, onSize, onReady }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [dim, setDim] = useState<Dim | null>(null);
  const [painted, setPainted] = useState(false);

  // Measure once per document; the result is the intrinsic box for every zoom.
  useEffect(() => {
    let alive = true;
    doc.getPage(pageNumber).then((p: any) => {
      if (!alive) return;
      const vp = p.getViewport({ scale: 1, rotation: 0 });
      const d = { width: vp.width, height: vp.height };
      setDim(d); onSize(pageNumber, d);
    }).catch(() => {});
    return () => { alive = false; };
  }, [doc, pageNumber, onSize]);

  useEffect(() => { if (wrapRef.current) onReady(wrapRef.current, pageNumber); }, [onReady, pageNumber]);

  // Paint only when the page is within a generous ring of the scroller.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !dim) return;
    let cancelled = false;
    let task: any = null;
    const io = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting || cancelled) return;
      io.disconnect();
      setPainted(true);
    }, { root: scrollRoot.current, rootMargin: '700px 0px' });
    io.observe(wrap);
    return () => { cancelled = true; io.disconnect(); task?.cancel?.(); };
  }, [dim, scrollRoot]);

  useEffect(() => {
    if (!painted || !dim) return;
    let cancelled = false;
    let renderTask: any = null;
    (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        const vp = page.getViewport({ scale, rotation });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.floor(vp.width * dpr));
        canvas.height = Math.max(1, Math.floor(vp.height * dpr));
        canvas.style.width = `${vp.width}px`;
        canvas.style.height = `${vp.height}px`;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;
        renderTask = page.render({
          canvasContext: ctx, viewport: vp,
          transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
        });
        await renderTask.promise;
        if (cancelled) return;

        const layer = textRef.current;
        if (layer) {
          layer.innerHTML = '';
          if (text) {
            try {
              const pdfjs = getPDFJS() as any;
              const content = await page.getTextContent();
              if (cancelled) return;
              const tl = new pdfjs.TextLayer({ textContentSource: content, container: layer, viewport: vp });
              await tl.render();
            } catch { /* text layer is best-effort */ }
          }
        }
      } catch { /* a cancelled render is normal while scrolling */ }
    })();
    return () => { cancelled = true; renderTask?.cancel?.(); };
  }, [doc, pageNumber, scale, rotation, text, painted, dim]);

  const w = dim ? dim.width * scale : 595 * scale;
  const h = dim ? dim.height * scale : 842 * scale;

  return (
    <div ref={wrapRef} className="fp-page" data-page={pageNumber} style={{ width: `${w}px`, height: `${h}px` }}>
      <canvas ref={canvasRef} className="fp-canvas" />
      <div ref={textRef} className={cn('fp-text', !text && 'fp-text-off')} aria-hidden={!text} />
    </div>
  );
};

/* ── viewer: document, fit/zoom, page tracking, grouped floating docks ── */
const FolioPdfViewer: React.FC<FolioPdfViewerProps> = ({ file, blobUrl, pdfBlob, onClose, onDownload, className }) => {
  const [doc, setDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [dims, setDims] = useState<Record<number, Dim>>({});
  const [scale, setScale] = useState(1);
  const [fit, setFit] = useState<Fit>('width');
  const [page, setPage] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [text, setText] = useState(true);
  const [thumbs, setThumbs] = useState(false);
  const [focus, setFocus] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageEls = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    let alive = true;
    let task: any = null;
    setLoading(true); setError(null); setDoc(null); setNumPages(0); setDims({});
    (async () => {
      try {
        const pdfjs = getPDFJS() as any;
        let data: Uint8Array;
        if (pdfBlob) data = new Uint8Array(await pdfBlob.arrayBuffer());
        else if (blobUrl) {
          const res = await fetch(blobUrl);
          if (!res.ok) throw new Error('Could not read the document');
          data = new Uint8Array(await res.arrayBuffer());
        } else throw new Error('No document source');
        if (!alive) return;
        task = pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false });
        const d = await task.promise;
        if (!alive) { task.destroy?.(); return; }
        setDoc(d); setNumPages(d.numPages); setLoading(false);
      } catch (e: any) {
        if (alive) { setError(e?.message || 'Could not open this PDF'); setLoading(false); }
      }
    })();
    return () => { alive = false; task?.destroy?.(); };
  }, [pdfBlob, blobUrl]);

  const onSize = useCallback((n: number, d: Dim) => {
    setDims((prev) => (prev[n]?.width === d.width && prev[n]?.height === d.height ? prev : { ...prev, [n]: d }));
  }, []);
  const onReady = useCallback((el: HTMLDivElement | null, n: number) => { pageEls.current[n] = el; }, []);

  // Fit uses page 1's measured size and the actual scroller box.
  useEffect(() => {
    const el = scrollRef.current;
    const first = dims[1];
    if (!el || !first || fit === 'custom') return;
    const apply = () => {
      const pad = 64;
      const w = (el.clientWidth - pad) / first.width;
      const h = (el.clientHeight - 120) / first.height;
      setScale(Math.max(0.15, Math.min(6, fit === 'width' ? w : Math.min(w, h))));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dims, fit]);

  // Current page from scroll position.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !numPages) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = el.scrollTop + 140;
        let found = 1;
        for (let n = 1; n <= numPages; n++) {
          const node = pageEls.current[n];
          if (node && node.offsetTop <= y) found = n;
        }
        setPage(found);
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [numPages]);

  const goTo = useCallback((n: number) => {
    const target = Math.max(1, Math.min(numPages || 1, n));
    const node = pageEls.current[target];
    const el = scrollRef.current;
    if (node && el) el.scrollTo({ top: Math.max(0, node.offsetTop - 28), behavior: 'smooth' });
    setPage(target);
  }, [numPages]);

  const zoom = useCallback((dir: number) => {
    setFit('custom');
    setScale((s) => Math.max(0.15, Math.min(6, Math.round((s + dir * 0.15) * 100) / 100)));
  }, []);

  const Btn: React.FC<{ label: string; onClick: () => void; children: React.ReactNode; on?: boolean; disabled?: boolean }> =
    ({ label, onClick, children, on, disabled }) => (
      <button type="button" className="fp-btn" aria-label={label} title={label} onClick={onClick} data-on={on || undefined} disabled={disabled}>{children}</button>
    );

  const pages = useMemo(() => Array.from({ length: numPages }, (_, i) => i + 1), [numPages]);

  return (
    <div className={cn('fp-root', focus && 'fp-focus', className)}>
      <style>{CSS}</style>

      {loading && <div className="fp-center-note"><span className="fp-spinner" /><span>Opening document…</span></div>}
      {error && <div className="fp-center-note fp-error-note"><FileText size={30} /><span>{error}</span></div>}

      {doc && !loading && (
        <>
          <div ref={scrollRef} className="fp-scroll">
            {pages.map((n) => (
              <PdfPage key={`${n}-${rotation}`} doc={doc} pageNumber={n} scale={scale} rotation={rotation}
                text={text} scrollRoot={scrollRef} onSize={onSize} onReady={onReady} />
            ))}
          </div>

          {thumbs && (
            <div className="fp-thumbs" role="list" aria-label="Pages">
              {pages.map((n) => (
                <button key={n} type="button" role="listitem" className="fp-thumb" data-on={page === n || undefined}
                  onClick={() => goTo(n)} aria-label={`Go to page ${n}`}>
                  <Thumb doc={doc} pageNumber={n} />
                  <span>{n}</span>
                </button>
              ))}
            </div>
          )}

          {!focus && (
            <>
              <div className="fp-dock fp-top" role="toolbar" aria-label="Page and zoom">
                <Btn label="Previous page" onClick={() => goTo(page - 1)} disabled={page <= 1}><ChevronLeft size={17} /></Btn>
                <span className="fp-label">{page} <i>/</i> {numPages}</span>
                <Btn label="Next page" onClick={() => goTo(page + 1)} disabled={page >= numPages}><ChevronRight size={17} /></Btn>
                <span className="fp-sep" />
                <Btn label="Zoom out" onClick={() => zoom(-1)}><Minus size={17} /></Btn>
                <span className="fp-label fp-zoom" title="Zoom">{Math.round(scale * 100)}%</span>
                <Btn label="Zoom in" onClick={() => zoom(1)}><Plus size={17} /></Btn>
                <Btn label="Fit width" on={fit === 'width'} onClick={() => setFit('width')}><Maximize2 size={16} /></Btn>
              </div>

              <div className="fp-dock fp-bottom" role="toolbar" aria-label="View options">
                <Btn label="Toggle page thumbnails" on={thumbs} onClick={() => setThumbs((v) => !v)}><PanelLeft size={17} /></Btn>
                <Btn label="Toggle text selection" on={text} onClick={() => setText((v) => !v)}><Type size={17} /></Btn>
                <Btn label="Rotate pages" onClick={() => setRotation((r) => (r + 90) % 360)}><RotateCw size={17} /></Btn>
                <span className="fp-sep" />
                <Btn label="Download PDF" onClick={onDownload || (() => {})}><Download size={17} /></Btn>
                <Btn label="Focus mode" onClick={() => setFocus(true)}><EyeOff size={17} /></Btn>
              </div>
              {focus && <button type="button" className="fp-focus-exit" onClick={() => setFocus(false)}>Show controls</button>}
            </>
          )}
        </>
      )}
    </div>
  );
};

/* tiny page thumbnail — painted once, no text layer */
const Thumb: React.FC<{ doc: any; pageNumber: number }> = ({ doc, pageNumber }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let alive = true; let task: any = null;
    (async () => {
      try {
        const p = await doc.getPage(pageNumber);
        const vp = p.getViewport({ scale: 0.16 });
        const c = ref.current; if (!c || !alive) return;
        c.width = Math.max(1, Math.floor(vp.width)); c.height = Math.max(1, Math.floor(vp.height));
        task = p.render({ canvasContext: c.getContext('2d')!, viewport: vp });
        await task.promise;
      } catch { /* cancelled */ }
    })();
    return () => { alive = false; task?.cancel?.(); };
  }, [doc, pageNumber]);
  return <canvas ref={ref} />;
};

const CSS = `
.fp-root { --ink: #e8e7e1; --line: rgba(232,231,225,.1); --glass: rgba(18,19,16,.9);
  position: relative; width: 100%; height: 100%; overflow: hidden; background: #0c0d09; color: var(--ink);
  font-family: var(--sa-f, system-ui, sans-serif); user-select: none; -webkit-user-select: none; }
.fp-scroll { position: absolute; inset: 0; overflow: auto; padding: 78px 0 112px; scrollbar-width: thin;
  scrollbar-color: rgba(232,231,225,.14) transparent; }
.fp-scroll::-webkit-scrollbar { width: 8px; } .fp-scroll::-webkit-scrollbar-thumb { background: rgba(232,231,225,.14); border-radius: 999px; }
.fp-page { position: relative; margin: 0 auto 22px; background: #fff; box-shadow: 0 18px 50px -22px rgba(0,0,0,.85); overflow: hidden; }
.fp-canvas { display: block; width: 100%; height: 100%; }
.fp-text { position: absolute; inset: 0; overflow: hidden; line-height: 1; text-align: initial; forced-color-adjust: none;
  transform-origin: 0 0; opacity: 1; }
.fp-text ::selection { background: rgba(120,150,255,.32); }
.fp-text-off { display: none; }
.fp-center-note { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px; font-size: 13px; color: rgba(232,231,225,.6); }
.fp-error-note svg { opacity: .5; }
.fp-spinner { width: 26px; height: 26px; border-radius: 50%; border: 2px solid rgba(232,231,225,.16);
  border-top-color: rgba(232,231,225,.7); animation: fp-spin .9s linear infinite; }
@keyframes fp-spin { to { transform: rotate(360deg); } }

.fp-dock { position: absolute; z-index: 10; left: 50%; translate: -50% 0; display: flex; align-items: center; gap: 2px;
  padding: 5px; border-radius: 999px; border: 1px solid var(--line); background: var(--glass);
  -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px);
  box-shadow: inset 0 1px 0 rgba(232,231,225,.08), 0 12px 30px -16px rgba(0,0,0,.8); }
.fp-top { top: 18px; } .fp-bottom { bottom: 18px; }
.fp-btn { display: grid; place-items: center; width: 34px; height: 34px; flex: none; padding: 0; border: 0; border-radius: 999px;
  background: transparent; color: var(--ink); cursor: pointer; transition: background .16s ease, color .16s ease; }
.fp-btn:hover:not(:disabled) { background: rgba(232,231,225,.1); }
.fp-btn[data-on="true"] { background: rgba(232,231,225,.14); }
.fp-btn:disabled { opacity: .3; cursor: default; }
.fp-btn:focus-visible { outline: 2px solid rgba(232,231,225,.8); outline-offset: 2px; }
.fp-sep { width: 1px; height: 20px; margin: 0 4px; background: var(--line); }
.fp-label { min-width: 52px; text-align: center; font: 500 11px/1 var(--sa-mono, ui-monospace, monospace);
  font-variant-numeric: tabular-nums; color: rgba(232,231,225,.8); }
.fp-label i { font-style: normal; opacity: .35; margin: 0 2px; }
.fp-zoom { min-width: 44px; }

.fp-thumbs { position: absolute; z-index: 9; left: 16px; top: 50%; translate: 0 -50%; width: 96px; max-height: 70%;
  overflow-y: auto; padding: 8px; border-radius: 18px; border: 1px solid var(--line); background: var(--glass);
  -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px); scrollbar-width: none;
  box-shadow: 0 14px 34px -18px rgba(0,0,0,.8); }
.fp-thumbs::-webkit-scrollbar { display: none; }
.fp-thumb { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%; margin-bottom: 8px; padding: 4px;
  border: 1px solid transparent; border-radius: 10px; background: transparent; color: rgba(232,231,225,.6); cursor: pointer;
  font: 400 10px/1 var(--sa-mono, monospace); }
.fp-thumb canvas { width: 100%; height: auto; background: #fff; border-radius: 4px; }
.fp-thumb[data-on="true"] { border-color: rgba(232,231,225,.24); background: rgba(232,231,225,.08); color: var(--ink); }
.fp-focus-exit { position: absolute; bottom: 18px; left: 50%; translate: -50% 0; z-index: 10; padding: 8px 14px;
  border: 1px solid var(--line); border-radius: 999px; background: var(--glass); color: var(--ink); cursor: pointer;
  font-size: 11px; opacity: .5; transition: opacity .16s ease; }
.fp-focus-exit:hover { opacity: 1; }
@media (max-width: 640px) {
  .fp-scroll { padding-top: 70px; }
  .fp-dock { gap: 0; padding: 4px; } .fp-btn { width: 32px; height: 32px; }
  .fp-label { min-width: 44px; } .fp-thumbs { width: 78px; left: 10px; }
}
@media (prefers-reduced-motion: reduce) { .fp-btn, .fp-focus-exit { transition-duration: .01ms; } }
`;

export default FolioPdfViewer;

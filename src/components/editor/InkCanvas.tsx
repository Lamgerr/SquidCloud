 /**
 * 🚨 REQUIRED DEPENDENCY: npm install perfect-freehand
 * This powers the precise, pressure-sensitive, tapered strokes used by Excalidraw.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getStroke } from 'perfect-freehand';
import { uid, type InkStroke, type Point, type BrushType } from './sqd';

interface InkCanvasProps {
  strokes: InkStroke[];
  onStrokesChange: (updater: (s: InkStroke[]) => InkStroke[]) => void;
  active: boolean;
  tool: 'pen' | 'eraser' | 'off';
  brush: BrushType;
  color: string;
  size: number;
  penOnly: boolean;
  readOnly?: boolean;
}

interface ViewTransform {
  offsetX: number;
  offsetY: number;
  scale: number;
}

/**
 * Converts the perimeter points from perfect-freehand into a smooth SVG path.
 */
function getSvgPathFromStroke(stroke: number[][]) {
  if (!stroke.length) return '';
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q']
  );
  d.push('Z');
  return d.join(' ');
}

/**
 * Draws a single perfect-freehand stroke onto a Canvas2D context.
 */
function drawStroke(ctx: CanvasRenderingContext2D, stroke: InkStroke, isComplete: boolean) {
  if (stroke.points.length === 0) return;

  const brush = stroke.brush || 'pen';
  
  // Excalidraw-like configuration physics
  let options = {
    size: stroke.size * 2.5,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: true,
    last: isComplete,
  };

    // Adjust physics based on brush type
    if (brush === 'brush') {
      options.size = stroke.size * 4.0;
      options.thinning = 0.5;
      options.smoothing = 0.6;
      options.streamline = 0.6;
      options.simulatePressure = true;
    } else if (brush === 'marker') {
      options.size = stroke.size * 6;
      options.thinning = -0.2;
      ctx.globalAlpha = 0.4;
    } else if (brush === 'pencil') {
      options.size = stroke.size * 1.5;
      options.thinning = 0.1;
      ctx.globalAlpha = 0.85;
    } else {
      ctx.globalAlpha = 1.0; // standard pen
    }

  // Map our {x,y,p} to perfect-freehand's [x,y,pressure]
  const pointsArray = stroke.points.map(p => [p.x, p.y, p.p ?? 0.5]);
  const outline = getStroke(pointsArray, options);
  
  const pathData = getSvgPathFromStroke(outline);
  const path = new Path2D(pathData);

  ctx.fillStyle = stroke.color;
  ctx.fill(path);
  ctx.globalAlpha = 1.0; // reset
}

const InkCanvas: React.FC<InkCanvasProps> = ({ 
  strokes, onStrokesChange, active, tool, brush, color, size, penOnly, readOnly 
}) => {
  // Dual-Canvas Architecture for 120fps zero-latency
  const wrapRef = useRef<HTMLDivElement>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement>(null); // Baked, finished strokes
  const dynamicCanvasRef = useRef<HTMLCanvasElement>(null); // Active stroke being drawn

  const dims = useRef({ w: 0, h: 0, dpr: 1 });
  const drawing = useRef(false);
  const current = useRef<InkStroke | null>(null);
  const currentPointerIdRef = useRef<number | null>(null);

  // State Refs
  const strokesRef = useRef(strokes); strokesRef.current = strokes;
  const toolRef = useRef(tool); toolRef.current = tool;
  const brushRef = useRef(brush); brushRef.current = brush;
  const colorRef = useRef(color); colorRef.current = color;
  const sizeRef = useRef(size); sizeRef.current = size;
  const penOnlyRef = useRef(penOnly); penOnlyRef.current = penOnly;

  // Viewport/Camera
  const [viewTransform, setViewTransform] = useState<ViewTransform>({ offsetX: 0, offsetY: 0, scale: 1 });
  const viewTransformRef = useRef(viewTransform); viewTransformRef.current = viewTransform;
  
  // Gestures
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchDistRef = useRef<number>(0);
  const lastPanRef = useRef<{ x: number; y: number } | null>(null);
  const gestureStartRef = useRef<'pan' | 'pinch' | null>(null);

  // 1. Render all finished strokes
  const renderStatic = useCallback(() => {
    const canvas = staticCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const vt = viewTransformRef.current;
    const dpr = dims.current.dpr;

    ctx.save();
    ctx.translate(vt.offsetX * dpr, vt.offsetY * dpr);
    ctx.scale(vt.scale * dpr, vt.scale * dpr);

    strokesRef.current.forEach(s => drawStroke(ctx, s, true));

    ctx.restore();
  }, []);

  // 2. Render only the active 120Hz stroke
  const renderDynamic = useCallback(() => {
    const canvas = dynamicCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!current.current) return;

    const vt = viewTransformRef.current;
    const dpr = dims.current.dpr;

    ctx.save();
    ctx.translate(vt.offsetX * dpr, vt.offsetY * dpr);
    ctx.scale(vt.scale * dpr, vt.scale * dpr);

    drawStroke(ctx, current.current, false);

    ctx.restore();
  }, []);

  // Window sizing & High DPI setup
  const setupSize = useCallback(() => {
    const wrap = wrapRef.current;
    const sCanvas = staticCanvasRef.current;
    const dCanvas = dynamicCanvasRef.current;
    if (!wrap || !sCanvas || !dCanvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = wrap.clientWidth || 1;
    const h = wrap.clientHeight || 1;
    dims.current = { w, h, dpr };

    const pw = w + 'px';
    const ph = h + 'px';
    const cw = Math.max(1, Math.floor(w * dpr));
    const ch = Math.max(1, Math.floor(h * dpr));

    sCanvas.width = cw; sCanvas.height = ch;
    sCanvas.style.width = pw; sCanvas.style.height = ph;
    
    dCanvas.width = cw; dCanvas.height = ch;
    dCanvas.style.width = pw; dCanvas.style.height = ph;

    renderStatic();
    renderDynamic();
  }, [renderStatic, renderDynamic]);

  useEffect(() => {
    setupSize();
    const ro = new ResizeObserver(() => setupSize());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [setupSize]);

  // Redraw when strokes array or view camera changes
  useEffect(() => {
    if (!drawing.current) renderStatic();
  }, [strokes, renderStatic]);

  useEffect(() => {
    renderStatic();
    renderDynamic();
  }, [viewTransform, renderStatic, renderDynamic]);

  // Coordinate mapping
  const toCanvasPt = useCallback((clientX: number, clientY: number): Point => {
    const wrap = wrapRef.current!;
    const rect = wrap.getBoundingClientRect();
    const vt = viewTransformRef.current;
    return {
      x: (clientX - rect.left - vt.offsetX) / vt.scale,
      y: (clientY - rect.top - vt.offsetY) / vt.scale,
      p: 0.5,
    };
  }, []);

  // Eraser Logic
  const eraseAt = (pt: Point) => {
    const threshold = Math.max(10, (sizeRef.current * 3 + 6) / viewTransformRef.current.scale);
    const next = strokesRef.current.filter((s) => !s.points.some((q) => Math.hypot(q.x - pt.x, q.y - pt.y) <= threshold));
    if (next.length !== strokesRef.current.length) {
      strokesRef.current = next;
      onStrokesChange(() => next);
      renderStatic();
    }
  };

  // --- Interaction Handlers ---
  const onPointerDown = (e: React.PointerEvent) => {
    if (!active || readOnly) return;
    
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    
    // Two-finger Pan/Zoom override
    if (pointersRef.current.size === 2) {
      drawing.current = false;
      current.current = null;
      renderDynamic();
      const pts = Array.from(pointersRef.current.values());
      lastPinchDistRef.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      lastPanRef.current = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      gestureStartRef.current = 'pinch';
      return;
    }
    
    // Palm Rejection & Tool Mapping
    if (penOnlyRef.current && e.pointerType === 'touch') {
      if (toolRef.current === 'off') {
        gestureStartRef.current = 'pan';
        lastPanRef.current = { x: e.clientX, y: e.clientY };
      }
      return;
    }
    if (toolRef.current === 'off') {
      gestureStartRef.current = 'pan';
      lastPanRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    
    // Start Drawing
    const wrap = wrapRef.current;
    if (!wrap) return;
    // Capture on the element that actually owns the pointer handlers
    // (the inner interaction surface), NOT the outer wrapper — otherwise
    // move/up events are redirected to the wrapper and never reach
    // the handlers, leaving only the initial down-point (a "dot").
    e.currentTarget.setPointerCapture(e.pointerId);

    drawing.current = true;
    currentPointerIdRef.current = e.pointerId;
    
    const pt = toCanvasPt(e.clientX, e.clientY);
    pt.p = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
    
    if (toolRef.current === 'eraser') {
      eraseAt(pt);
      return;
    }
    
    current.current = { 
      id: uid('s'), 
      color: colorRef.current, 
      size: sizeRef.current, 
      points: [pt], 
      brush: brushRef.current 
    };
    
    renderDynamic();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    
    // Pan & Zoom gestures
    if (pointersRef.current.size === 2 && gestureStartRef.current === 'pinch') {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const center = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      
      if (lastPinchDistRef.current > 0) {
        const scaleDelta = dist / lastPinchDistRef.current;
        setViewTransform((prev) => {
          const newScale = Math.max(0.25, Math.min(5, prev.scale * scaleDelta));
          const rect = wrapRef.current?.getBoundingClientRect();
          if (!rect) return { ...prev, scale: newScale };
          
          const cx = center.x - rect.left;
          const cy = center.y - rect.top;
          const panDx = center.x - (lastPanRef.current?.x ?? center.x);
          const panDy = center.y - (lastPanRef.current?.y ?? center.y);
          
          return {
            scale: newScale,
            offsetX: cx - (cx - prev.offsetX) * (newScale / prev.scale) + panDx,
            offsetY: cy - (cy - prev.offsetY) * (newScale / prev.scale) + panDy,
          };
        });
      }
      lastPinchDistRef.current = dist;
      lastPanRef.current = center;
      return;
    }
    
    if (pointersRef.current.size === 1 && gestureStartRef.current === 'pan') {
      const dx = e.clientX - (lastPanRef.current?.x ?? e.clientX);
      const dy = e.clientY - (lastPanRef.current?.y ?? e.clientY);
      setViewTransform((prev) => ({ ...prev, offsetX: prev.offsetX + dx, offsetY: prev.offsetY + dy }));
      lastPanRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Active Drawing
    if (!drawing.current || e.pointerId !== currentPointerIdRef.current) return;
    
    // High-performance coalesced events for 120Hz iPad Pro tracking
    const native = e.nativeEvent;
    const events: PointerEvent[] = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [native];
    if (events.length === 0) events.push(native);
    
    if (toolRef.current === 'eraser') {
      events.forEach((ev) => eraseAt(toCanvasPt(ev.clientX, ev.clientY)));
      return;
    }
    
    if (!current.current) return;
    
    let strokeUpdated = false;
    events.forEach((ev) => {
      const pt = toCanvasPt(ev.clientX, ev.clientY);
      pt.p = ev.pressure && ev.pressure > 0 ? ev.pressure : 0.5;
      
      // Optimization: Drop overlapping points to keep polygon rendering ultra-fast
      const lastPt = current.current!.points[current.current!.points.length - 1];
      if (lastPt) {
        const dist = Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y);
        if (dist < 1.0 / viewTransformRef.current.scale) return; 
      }
      
      current.current!.points.push(pt);
      strokeUpdated = true;
    });

    // We only update the dynamic canvas to hit true 120fps rendering
    if (strokeUpdated) {
      renderDynamic();
    }
  };

  const finish = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    
    if (pointersRef.current.size < 2) {
      lastPinchDistRef.current = 0;
      lastPanRef.current = null;
      gestureStartRef.current = null;
    }
    
    if (!drawing.current || e.pointerId !== currentPointerIdRef.current) return;
    
    drawing.current = false;
    currentPointerIdRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    
    if (toolRef.current !== 'eraser' && current.current) {
      const s = current.current;
      current.current = null;
      
      // Commit stroke
      renderDynamic(); // Clear dynamic canvas
      onStrokesChange((prev) => [...prev, s]); 
    }
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      setViewTransform((prev) => {
        const newScale = Math.max(0.25, Math.min(5, prev.scale * delta));
        return {
          scale: newScale,
          offsetX: cx - (cx - prev.offsetX) * (newScale / prev.scale),
          offsetY: cy - (cy - prev.offsetY) * (newScale / prev.scale),
        };
      });
    } else {
      setViewTransform((prev) => ({
        ...prev,
        offsetX: prev.offsetX - e.deltaX,
        offsetY: prev.offsetY - e.deltaY,
      }));
    }
  }, []);

  const resetView = useCallback(() => setViewTransform({ offsetX: 0, offsetY: 0, scale: 1 }), []);

  return (
    <div ref={wrapRef} className="absolute inset-0" style={{ pointerEvents: active ? 'auto' : 'none' }}>
      
      {/* Layer 1: Static baked drawings */}
      <canvas ref={staticCanvasRef} className="absolute inset-0 pointer-events-none" />
      
      {/* Layer 2: Active 120fps fluid drawing layer */}
      <canvas ref={dynamicCanvasRef} className="absolute inset-0 pointer-events-none" />
      
      {/* Interaction Surface */}
      <div
        className="absolute inset-0"
        style={{ touchAction: 'none', cursor: tool === 'eraser' ? 'cell' : tool === 'off' ? 'grab' : 'crosshair', pointerEvents: active ? 'auto' : 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onWheel={handleWheel}
      />
      
      {active && (viewTransform.scale !== 1 || viewTransform.offsetX !== 0 || viewTransform.offsetY !== 0) && (
        <button
          onClick={resetView}
          className="absolute bottom-6 right-6 z-10 px-3 py-1.5 rounded-full bg-zinc-900/90 text-zinc-300 text-xs font-semibold border border-zinc-800 backdrop-blur-md shadow-xl hover:bg-zinc-800 hover:text-white transition-all active:scale-95"
          title="Reset view"
        >
          {Math.round(viewTransform.scale * 100)}% — Reset
        </button>
      )}
    </div>
  );
};

export default InkCanvas;


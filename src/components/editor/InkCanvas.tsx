import React, { useCallback, useEffect, useRef, useState } from 'react';
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

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function catmullRomPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

function getBrushConfig(brush: BrushType, pressure: number, baseSize: number) {
  const p = Math.max(0.1, Math.min(1, pressure));
  switch (brush) {
    case 'pencil':
      return {
        lineWidth: baseSize * (0.15 + 0.35 * p),
        opacity: 0.6 + 0.3 * p,
        compositeOp: 'source-over' as CanvasComposition,
        lineCap: 'round' as CanvasLineCap,
        texture: true,
      };
    case 'brush':
      return {
        lineWidth: baseSize * (0.4 + 0.9 * p),
        opacity: 0.7 + 0.25 * p,
        compositeOp: 'source-over' as CanvasComposition,
        lineCap: 'round' as CanvasLineCap,
        texture: false,
      };
    case 'marker':
      return {
        lineWidth: baseSize * (0.6 + 0.5 * p),
        opacity: 0.35 + 0.15 * p,
        compositeOp: 'source-over' as CanvasComposition,
        lineCap: 'square' as CanvasLineCap,
        texture: false,
      };
    case 'pen':
    default:
      return {
        lineWidth: baseSize * (0.2 + 0.8 * p),
        opacity: 1,
        compositeOp: 'source-over' as CanvasComposition,
        lineCap: 'round' as CanvasLineCap,
        texture: false,
      };
  }
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: InkStroke, dpr: number) {
  const pts = stroke.points;
  if (pts.length === 0) return;
  
  const brush = stroke.brush || 'pen';
  
  if (pts.length === 1) {
    const cfg = getBrushConfig(brush, pts[0].p ?? 0.5, stroke.size);
    const r = Math.max(0.5, cfg.lineWidth * 0.5 * dpr);
    ctx.save();
    ctx.globalAlpha = cfg.opacity;
    ctx.fillStyle = stroke.color;
    ctx.beginPath();
    ctx.arc(pts[0].x * dpr, pts[0].y * dpr, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.lineCap = getBrushConfig(brush, 0.5, stroke.size).lineCap;
  ctx.lineJoin = 'round';

  if (pts.length === 2) {
    const a = pts[0], b = pts[1];
    const p = ((b.p ?? 0.5) + (a.p ?? 0.5)) / 2;
    const cfg = getBrushConfig(brush, p, stroke.size);
    ctx.globalAlpha = cfg.opacity;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = Math.max(0.5, cfg.lineWidth * dpr);
    ctx.beginPath();
    ctx.moveTo(a.x * dpr, a.y * dpr);
    ctx.lineTo(b.x * dpr, b.y * dpr);
    ctx.stroke();
    ctx.restore();
    return;
  }

  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[Math.min(pts.length - 1, i + 1)];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    const pressure = p1.p ?? 0.5;
    const cfg = getBrushConfig(brush, pressure, stroke.size);
    
    ctx.globalAlpha = cfg.opacity;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = Math.max(0.5, cfg.lineWidth * dpr);

    const steps = i < pts.length - 1 ? 6 : 3;
    ctx.beginPath();
    
    const startX = catmullRomPoint(p0, p1, p2, p3, 0);
    ctx.moveTo(startX.x * dpr, startX.y * dpr);
    
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const pt = catmullRomPoint(p0, p1, p2, p3, t);
      ctx.lineTo(pt.x * dpr, pt.y * dpr);
    }
    ctx.stroke();
  }

  if (brush === 'pencil') {
    const last = pts[pts.length - 1];
    const cfg = getBrushConfig(brush, last.p ?? 0.5, stroke.size);
    ctx.globalAlpha = cfg.opacity * 0.3;
    ctx.fillStyle = stroke.color;
    for (let i = 0; i < pts.length; i += 3) {
      const p = pts[i];
      const r = cfg.lineWidth * 0.3 * dpr * (0.5 + Math.random() * 0.5);
      ctx.beginPath();
      ctx.arc(p.x * dpr, p.y * dpr, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

interface ViewTransform {
  offsetX: number;
  offsetY: number;
  scale: number;
}

const InkCanvas: React.FC<InkCanvasProps> = ({ strokes, onStrokesChange, active, tool, brush, color, size, penOnly, readOnly }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offRef = useRef<HTMLCanvasElement | null>(null);
  const dims = useRef({ w: 0, h: 0, dpr: 1 });
  const drawing = useRef(false);
  const current = useRef<InkStroke | null>(null);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const brushRef = useRef(brush);
  brushRef.current = brush;
  const colorRef = useRef(color);
  colorRef.current = color;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const penOnlyRef = useRef(penOnly);
  penOnlyRef.current = penOnly;

  const [viewTransform, setViewTransform] = useState<ViewTransform>({ offsetX: 0, offsetY: 0, scale: 1 });
  const viewTransformRef = useRef(viewTransform);
  viewTransformRef.current = viewTransform;
  
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchDistRef = useRef<number>(0);
  const lastPanRef = useRef<{ x: number; y: number } | null>(null);
  const gestureStartRef = useRef<'pan' | 'pinch' | null>(null);

  const renderVisible = useCallback(() => {
    const canvas = canvasRef.current;
    const off = offRef.current;
    if (!canvas || !off) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const vt = viewTransformRef.current;
    ctx.save();
    ctx.translate(vt.offsetX * dims.current.dpr, vt.offsetY * dims.current.dpr);
    ctx.scale(vt.scale, vt.scale);
    ctx.drawImage(off, 0, 0);
    if (current.current) drawStroke(ctx, current.current, 1);
    ctx.restore();
  }, []);

  const renderAll = useCallback(() => {
    const off = offRef.current;
    if (!off) return;
    const octx = off.getContext('2d');
    if (!octx) return;
    octx.clearRect(0, 0, off.width, off.height);
    const dpr = dims.current.dpr;
    strokesRef.current.forEach((s) => drawStroke(octx, s, dpr));
    renderVisible();
  }, [renderVisible]);

  const setupSize = useCallback(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = wrap.clientWidth || 1;
    const h = wrap.clientHeight || 1;
    dims.current = { w, h, dpr };
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    if (!offRef.current) offRef.current = document.createElement('canvas');
    const off = offRef.current;
    off.width = canvas.width;
    off.height = canvas.height;
    renderAll();
  }, [renderAll]);

  useEffect(() => {
    setupSize();
    const ro = new ResizeObserver(() => setupSize());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [setupSize]);

  useEffect(() => {
    if (!drawing.current) renderAll();
  }, [strokes, renderAll]);

  useEffect(() => {
    renderVisible();
  }, [viewTransform, renderVisible]);

  const toCanvasPt = useCallback((clientX: number, clientY: number): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const vt = viewTransformRef.current;
    return {
      x: (clientX - rect.left - vt.offsetX) / vt.scale,
      y: (clientY - rect.top - vt.offsetY) / vt.scale,
      p: 0.5,
    };
  }, []);

  const eraseAt = (pt: Point) => {
    const threshold = Math.max(10, sizeRef.current * 3 + 6);
    const next = strokesRef.current.filter((s) => !s.points.some((q) => Math.hypot(q.x - pt.x, q.y - pt.y) <= threshold));
    if (next.length !== strokesRef.current.length) {
      strokesRef.current = next;
      onStrokesChange(() => next);
      renderAll();
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!active || readOnly) return;
    
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    
    if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      lastPinchDistRef.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      lastPanRef.current = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      gestureStartRef.current = 'pinch';
      drawing.current = false;
      current.current = null;
      return;
    }
    
    if (pointersRef.current.size === 1 && toolRef.current === 'off' && !penOnlyRef.current) {
      gestureStartRef.current = 'pan';
      lastPanRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (penOnlyRef.current && e.pointerType === 'touch') return;
    if (toolRef.current === 'off') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawing.current = true;
    const pt = toCanvasPt(e.clientX, e.clientY);
    pt.p = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
    if (toolRef.current === 'eraser') {
      eraseAt(pt);
      return;
    }
    current.current = { id: uid('s'), color: colorRef.current, size: sizeRef.current, points: [pt], brush: brushRef.current };
    renderVisible();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    
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
      setViewTransform((prev) => ({
        ...prev,
        offsetX: prev.offsetX + dx,
        offsetY: prev.offsetY + dy,
      }));
      lastPanRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (!drawing.current) return;
    const native = e.nativeEvent;
    const events: PointerEvent[] = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [native];
    if (events.length === 0) events.push(native);
    if (toolRef.current === 'eraser') {
      events.forEach((ev) => eraseAt(toCanvasPt(ev.clientX, ev.clientY)));
      return;
    }
    if (!current.current) return;
    events.forEach((ev) => {
      const pt = toCanvasPt(ev.clientX, ev.clientY);
      pt.p = ev.pressure && ev.pressure > 0 ? ev.pressure : 0.5;
      current.current!.points.push(pt);
    });
    renderVisible();
  };

  const finish = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    
    if (pointersRef.current.size < 2) {
      lastPinchDistRef.current = 0;
      lastPanRef.current = null;
      gestureStartRef.current = null;
    }
    
    if (!drawing.current) return;
    drawing.current = false;
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch {}
    if (toolRef.current !== 'eraser' && current.current) {
      const s = current.current;
      current.current = null;
      const off = offRef.current;
      if (off) {
        const octx = off.getContext('2d');
        if (octx) drawStroke(octx, s, dims.current.dpr);
      }
      onStrokesChange((prev) => [...prev, s]);
    }
    renderVisible();
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

  const resetView = useCallback(() => {
    setViewTransform({ offsetX: 0, offsetY: 0, scale: 1 });
  }, []);

  return (
    <div ref={wrapRef} className="absolute inset-0" style={{ pointerEvents: active ? 'auto' : 'none' }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ touchAction: 'none', cursor: tool === 'eraser' ? 'cell' : tool === 'off' ? 'grab' : 'crosshair', pointerEvents: active ? 'auto' : 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onPointerLeave={finish}
        onWheel={handleWheel}
      />
      {active && (viewTransform.scale !== 1 || viewTransform.offsetX !== 0 || viewTransform.offsetY !== 0) && (
        <button
          onClick={resetView}
          className="absolute bottom-3 right-3 z-10 px-2 py-1 rounded bg-black/60 text-white/80 text-[10px] font-mono backdrop-blur-sm hover:bg-black/80 transition-colors"
          title="Reset view (100%)"
        >
          {Math.round(viewTransform.scale * 100)}% — Reset
        </button>
      )}
    </div>
  );
};

export default InkCanvas;

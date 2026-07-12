import React, { useCallback, useEffect, useRef } from 'react';
import { uid, type InkStroke, type Point } from './sqd';

interface InkCanvasProps {
  strokes: InkStroke[];
  onStrokesChange: (updater: (s: InkStroke[]) => InkStroke[]) => void;
  active: boolean;
  tool: 'pen' | 'eraser' | 'off';
  color: string;
  size: number;
  penOnly: boolean;
  readOnly?: boolean;
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: InkStroke, dpr: number) {
  const pts = stroke.points;
  if (pts.length === 0) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke.color;
  if (pts.length === 1) {
    const r = Math.max(0.5, stroke.size * 0.65 * dpr);
    ctx.beginPath();
    ctx.fillStyle = stroke.color;
    ctx.arc(pts[0].x * dpr, pts[0].y * dpr, r, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const p = ((b.p ?? 0.5) + (a.p ?? 0.5)) / 2;
    ctx.lineWidth = Math.max(0.5, stroke.size * (0.32 + 0.68 * p) * dpr);
    const prev = i === 1 ? a : midpoint(pts[i - 2], a);
    const m = midpoint(a, b);
    ctx.beginPath();
    ctx.moveTo(prev.x * dpr, prev.y * dpr);
    ctx.quadraticCurveTo(a.x * dpr, a.y * dpr, m.x * dpr, m.y * dpr);
    ctx.stroke();
  }
  const last = pts[pts.length - 1];
  ctx.lineWidth = Math.max(0.5, stroke.size * (0.32 + 0.68 * (last.p ?? 0.5)) * dpr);
  ctx.beginPath();
  ctx.moveTo(midpoint(pts[pts.length - 2], last).x * dpr, midpoint(pts[pts.length - 2], last).y * dpr);
  ctx.lineTo(last.x * dpr, last.y * dpr);
  ctx.stroke();
}

const InkCanvas: React.FC<InkCanvasProps> = ({ strokes, onStrokesChange, active, tool, color, size, penOnly, readOnly }) => {
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
  const colorRef = useRef(color);
  colorRef.current = color;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const penOnlyRef = useRef(penOnly);
  penOnlyRef.current = penOnly;

  const renderVisible = useCallback(() => {
    const canvas = canvasRef.current;
    const off = offRef.current;
    if (!canvas || !off) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(off, 0, 0);
    if (current.current) drawStroke(ctx, current.current, dims.current.dpr);
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

  const toPt = (e: PointerEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const p = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, p };
  };

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
    if (!active || readOnly || toolRef.current === 'off') return;
    if (penOnlyRef.current && e.pointerType === 'touch') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawing.current = true;
    const pt = toPt(e.nativeEvent);
    if (toolRef.current === 'eraser') {
      eraseAt(pt);
      return;
    }
    current.current = { id: uid('s'), color: colorRef.current, size: sizeRef.current, points: [pt] };
    renderVisible();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const native = e.nativeEvent;
    const events: PointerEvent[] = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [native];
    if (events.length === 0) events.push(native);
    if (toolRef.current === 'eraser') {
      events.forEach((ev) => eraseAt(toPt(ev)));
      return;
    }
    if (!current.current) return;
    events.forEach((ev) => current.current!.points.push(toPt(ev)));
    renderVisible();
  };

  const finish = (e: React.PointerEvent) => {
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

  return (
    <div ref={wrapRef} className="absolute inset-0" style={{ pointerEvents: active ? 'auto' : 'none' }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ touchAction: 'none', cursor: tool === 'eraser' ? 'cell' : 'crosshair', pointerEvents: active ? 'auto' : 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onPointerLeave={finish}
      />
    </div>
  );
};

export default InkCanvas;

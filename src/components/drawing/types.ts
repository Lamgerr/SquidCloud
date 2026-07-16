// Data model for the hybrid note/drawing engine.
// Strokes are stored as VECTOR data (centerline points + pressure + tool + style)
// so they can be replayed, scaled and re-rendered losslessly on zoom.

export type ToolType = 'pencil' | 'marker' | 'eraser' | 'lasso' | 'pan';
export type EraserMode = 'pixel' | 'object';

export interface InputPoint {
  x: number; // canvas-space coordinates
  y: number;
  pressure: number; // 0..1
  tiltX?: number;
  tiltY?: number;
  t: number; // timestamp (ms)
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Stroke {
  id: string;
  tool: ToolType;
  color: string; // css color
  size: number; // base width in canvas units
  opacity: number; // 0..1
  points: InputPoint[];
  bbox?: BBox;
  // smoothing parameters captured at draw time (so strokes replay identically)
  thinning?: number;
  pressureGamma?: number;
  simulatePressure?: boolean;
  streamline?: number;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  strokes: Stroke[];
}

export interface ViewTransform {
  scale: number; // zoom (1 = 100%)
  offsetX: number; // pan, in screen px
  offsetY: number;
}

export interface PenSettings {
  color: string;
  size: number; // base width in canvas units
  opacity: number;
  thinning: number; // -1..1 how pressure affects width
  pressureGamma: number; // easing exponent for pressure->width (gamma control)
  simulatePressure: boolean; // velocity fallback for mouse/trackpad
  streamline: number; // 0..1 input smoothing (jitter reduction)
}

export const DEFAULT_PEN: PenSettings = {
  color: '#1f2937',
  size: 6,
  opacity: 1,
  thinning: 0.6,
  pressureGamma: 1,
  simulatePressure: true,
  streamline: 0.5,
};

export const DEFAULT_MARKER: PenSettings = {
  color: '#2563eb',
  size: 18,
  opacity: 0.85,
  thinning: 0,
  pressureGamma: 1,
  simulatePressure: false,
  streamline: 0.5,
};

// Persistence format: a single self-contained JSON document.
export interface DrawingDoc {
  version: 1;
  width: number; // canvas-space logical size
  height: number;
  background: string;
  layers: Layer[];
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function strokeBBox(points: InputPoint[], size: number): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const r = size / 2 + 2;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX: minX - r, minY: minY - r, maxX: maxX + r, maxY: maxY + r };
}

export function recomputeBBox(points: InputPoint[], size = 0): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const r = size / 2 + 2;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX: minX - r, minY: minY - r, maxX: maxX + r, maxY: maxY + r };
}

export function bboxOverlap(a: BBox, b: BBox): boolean {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

export function pointInBBox(x: number, y: number, b: BBox, pad = 0): boolean {
  return x >= b.minX - pad && x <= b.maxX + pad && y >= b.minY - pad && y <= b.maxY + pad;
}

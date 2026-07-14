// Stroke smoothing + variable-width outline generation.
//
// Approach: a "perfect-freehand"-style geometric outline. We map the pressure
// (real or velocity-simulated) of each input point to a radius, then build a
// closed polygon by offsetting each point perpendicular to the local direction
// (left side forward, right side backward) with diamond corner interpolation.
// This produces smooth, tapered, pressure-sensitive strokes far superior to
// naively connecting points with lines or quadratic averaging.

import { InputPoint } from './types';

export interface SmoothOptions {
  size: number; // base width in canvas units
  thinning: number; // -1..1
  streamline: number; // 0..1 input smoothing
  pressureGamma: number; // easing exponent
  simulatePressure: boolean; // velocity fallback
  last?: boolean;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(b.x - a.x, b.y - a.y);

interface SP {
  x: number;
  y: number;
  radius: number;
  vector: { x: number; y: number };
}

// Pressure -> radius. `thinning` shifts the baseline; `pressureGamma` is the
// easing (gamma) curve so width response can be made soft or punchy.
function radiusFor(pressure: number, size: number, thinning: number, gamma: number): number {
  const w = Math.pow(clamp(pressure, 0, 1), gamma);
  return (size / 2) * (1 - thinning * (1 - w));
}

export function buildStrokePoints(points: InputPoint[], opts: SmoothOptions): SP[] {
  const { size, thinning, streamline, pressureGamma, simulatePressure } = opts;
  const out: SP[] = [];
  let prev: SP | null = null;
  const smoothAmt = 1 - streamline * 0.5; // higher streamline => retain more of previous

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    let pressure = p.pressure;

    if (simulatePressure && i > 0) {
      // Velocity-based pressure: fast => thin, slow => thick.
      const d = dist(points[i - 1], p);
      const speed = clamp(d / (size * 2.2), 0, 1);
      const sim = 1 - speed;
      pressure = clamp(0.2 + sim * 0.8, 0.05, 1);
    }
    pressure = clamp(pressure, 0, 1);

    let x = p.x;
    let y = p.y;
    if (prev) {
      x = lerp(prev.x, x, smoothAmt);
      y = lerp(prev.y, y, smoothAmt);
    }

    const vector = prev ? { x: x - prev.x, y: y - prev.y } : { x: 0, y: 0 };
    const radius = radiusFor(pressure, size, thinning, pressureGamma);
    const sp: SP = { x, y, radius, vector };
    out.push(sp);
    prev = sp;
  }
  return out;
}

interface Corner {
  leftStart: { x: number; y: number };
  leftEnd: { x: number; y: number };
  rightStart: { x: number; y: number };
  rightEnd: { x: number; y: number };
}

// Per-point diamond corner: offset the midpoint of (a,b) and (b,c) by the
// perpendicular to produce smooth capsule joins with taper.
function getCorner(a: SP, b: SP, c: SP): Corner {
  const aMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const bMid = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
  let u = { x: b.x - aMid.x, y: b.y - aMid.y };
  let v = { x: bMid.x - b.x, y: bMid.y - b.y };
  const lu = Math.hypot(u.x, u.y);
  const lv = Math.hypot(v.x, v.y);
  u = lu ? { x: u.x / lu, y: u.y / lu } : { x: 1, y: 0 };
  v = lv ? { x: v.x / lv, y: v.y / lv } : { x: 1, y: 0 };
  // If the two direction vectors oppose, rotate u 90° to avoid a spike.
  if (u.x * v.x + u.y * v.y <= 0) u = { x: -u.y, y: u.x };

  return {
    leftStart: { x: aMid.x + u.x * a.radius, y: aMid.y + u.y * a.radius },
    leftEnd: { x: bMid.x + v.x * b.radius, y: bMid.y + v.y * b.radius },
    rightStart: { x: aMid.x - u.x * a.radius, y: aMid.y - u.y * a.radius },
    rightEnd: { x: bMid.x - v.x * b.radius, y: bMid.y - v.y * b.radius },
  };
}

/**
 * Returns the filled outline polygon as [x, y] pairs for a list of input points.
 * The caller fills this path. Dense enough to look smooth without extra curves.
 */
export function getStrokeOutline(points: InputPoint[], opts: SmoothOptions): number[][] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    const p = points[0];
    const r = radiusFor(p.pressure || 0.5, opts.size, opts.thinning, opts.pressureGamma);
    return [
      [p.x - r, p.y], [p.x, p.y - r], [p.x + r, p.y], [p.x, p.y + r],
    ];
  }

  const sp = buildStrokePoints(points, opts);
  const n = sp.length;
  const left: number[][] = [];
  const right: number[][] = [];

  for (let i = 0; i < n; i++) {
    const prev = sp[i - 1] ?? sp[i];
    const next = sp[i + 1] ?? sp[i];
    const c = getCorner(prev, sp[i], next);
    left.push([c.leftStart.x, c.leftStart.y], [c.leftEnd.x, c.leftEnd.y]);
    right.push([c.rightStart.x, c.rightStart.y], [c.rightEnd.x, c.rightEnd.y]);
  }

  return [...left, ...right.reverse()];
}

// Distance from a point to a line segment (used for hit-testing).
export function distToSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Precise hit test: is (x,y) within `tol` of the stroke's centerline given its
// per-point radii? Approximated using the stroke's max radius.
export function hitTestStroke(
  points: InputPoint[],
  x: number, y: number,
  opts: SmoothOptions,
  tol = 4,
): boolean {
  if (points.length === 0) return false;
  const sp = buildStrokePoints(points, opts);
  const maxR = Math.max(...sp.map((s) => s.radius)) + tol;
  for (let i = 0; i < sp.length - 1; i++) {
    const a = sp[i];
    const b = sp[i + 1];
    if (distToSegment(x, y, a.x, a.y, b.x, b.y) <= (a.radius + b.radius) / 2 + tol) return true;
  }
  if (sp.length === 1) {
    return Math.hypot(x - sp[0].x, y - sp[0].y) <= sp[0].radius + tol;
  }
  void maxR;
  return false;
}

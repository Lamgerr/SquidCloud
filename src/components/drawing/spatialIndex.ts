// Lightweight spatial index for fast hit-testing / region queries at scale
// (lasso select, object eraser). Strokes are indexed into a uniform grid by
// their bounding box; queries only visit cells that overlap the region.

import { BBox, Layer, Stroke, bboxOverlap, pointInBBox } from './types';

export class StrokeIndex {
  private cell: number;
  private grid = new Map<string, Set<string>>();
  private strokes = new Map<string, { stroke: Stroke; layerId: string; bbox: BBox }>();
  // layer visibility so hidden layers are never hit
  private visibleLayers = new Set<string>();

  constructor(cellSize = 256) {
    this.cell = cellSize;
  }

  private key(cx: number, cy: number) {
    return `${cx}:${cy}`;
  }

  setVisibleLayers(layers: Layer[]) {
    this.visibleLayers = new Set(layers.filter((l) => l.visible).map((l) => l.id));
  }

  clear() {
    this.grid.clear();
    this.strokes.clear();
  }

  insert(stroke: Stroke, layerId: string) {
    if (!stroke.bbox) return;
    this.strokes.set(stroke.id, { stroke, layerId, bbox: stroke.bbox });
    this.indexBBox(stroke.id, stroke.bbox);
  }

  remove(id: string) {
    const rec = this.strokes.get(id);
    if (!rec) return;
    this.strokes.delete(id);
    // Rebuild affected cells lazily is expensive; simplest correct approach:
    for (const [k, set] of this.grid) {
      if (set.has(id)) {
        set.delete(id);
        if (set.size === 0) this.grid.delete(k);
      }
    }
  }

  private indexBBox(id: string, b: BBox) {
    const c = this.cell;
    const x0 = Math.floor(b.minX / c);
    const x1 = Math.floor(b.maxX / c);
    const y0 = Math.floor(b.minY / c);
    const y1 = Math.floor(b.maxY / c);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const k = this.key(x, y);
        let set = this.grid.get(k);
        if (!set) this.grid.set(k, (set = new Set()));
        set.add(id);
      }
    }
  }

  // Candidate stroke ids whose bbox overlaps `region` (caller does exact test).
  queryRegion(region: BBox): Stroke[] {
    const c = this.cell;
    const x0 = Math.floor(region.minX / c);
    const x1 = Math.floor(region.maxX / c);
    const y0 = Math.floor(region.minY / c);
    const y1 = Math.floor(region.maxY / c);
    const seen = new Set<string>();
    const out: Stroke[] = [];
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const set = this.grid.get(this.key(x, y));
        if (!set) continue;
        for (const id of set) {
          if (seen.has(id)) continue;
          seen.add(id);
          const rec = this.strokes.get(id);
          if (rec && this.visibleLayers.has(rec.layerId) && bboxOverlap(region, rec.bbox)) {
            out.push(rec.stroke);
          }
        }
      }
    }
    return out;
  }

  // Stroke ids whose bbox contains the point (caller does exact hit test).
  queryPoint(x: number, y: number, pad = 0): Stroke[] {
    const c = this.cell;
    const cx = Math.floor(x / c);
    const cy = Math.floor(y / c);
    const out: Stroke[] = [];
    const seen = new Set<string>();
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const set = this.grid.get(this.key(cx + dx, cy + dy));
        if (!set) continue;
        for (const id of set) {
          if (seen.has(id)) continue;
          seen.add(id);
          const rec = this.strokes.get(id);
          if (rec && this.visibleLayers.has(rec.layerId) && pointInBBox(x, y, rec.bbox, pad)) {
            out.push(rec.stroke);
          }
        }
      }
    }
    return out;
  }
}

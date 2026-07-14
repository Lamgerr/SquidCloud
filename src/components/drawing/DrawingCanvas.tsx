import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import {
  DrawableDoc as DrawingDoc,
  EraserMode,
  InputPoint,
  Layer,
  PenSettings,
  Stroke,
  ToolType,
  recomputeBBox,
  uid,
} from "./types";
import { getStrokeOutline, hitTestStroke } from "./smoothing";
import { StrokeIndex } from "./spatialIndex";

const HISTORY_LIMIT = 100;
const CELL = 256; // spatial index cell size (canvas units)

export interface DrawableState {
  tool: ToolType;
  pen: PenSettings;
  eraserMode: EraserMode;
  layers: Layer[];
  activeLayerId: string;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
}

export interface DrawableHandle {
  getDoc(): DrawingDoc;
  setDoc(d: DrawingDoc): void;
  undo(): void;
  redo(): void;
  clearActiveLayer(): void;
  clearAll(): void;
  setTool(t: ToolType): void;
  setPen(p: PenSettings): void;
  setEraserMode(m: EraserMode): void;
  deleteSelection(): void;
  selectAll(): void;
  addLayer(name?: string): void;
  removeLayer(id: string): void;
  setActiveLayer(id: string): void;
  toggleLayerVisible(id: string): void;
  setLayerOpacity(id: string, opacity: number): void;
  renameLayer(id: string, name: string): void;
  reorderLayer(id: string, dir: -1 | 1): void;
  zoomBy(factor: number): void;
  resetView(): void;
  fitView(): void;
}

interface DrawableProps {
  width: number; // logical canvas-space size
  height: number;
  background?: string;
  initialDoc?: DrawingDoc;
  onPersist?: (doc: DrawingDoc) => void;
  onState?: (s: DrawableState) => void;
  children?: React.ReactNode; // rendered inside the transformed view (e.g. text overlays)
}

interface View {
  scale: number;
  offsetX: number;
  offsetY: number;
}

type Command = { undo: () => void; redo: () => void };

interface MoveRef {
  startX: number;
  startY: number;
  items: { layerId: string; id: string; orig: InputPoint[] }[];
  moved: InputPoint[][];
}

function strokeOptions(s: Stroke) {
  return {
    size: s.size,
    thinning: s.thinning ?? 0.6,
    streamline: s.streamline ?? 0.5,
    pressureGamma: s.pressureGamma ?? 1,
    simulatePressure: s.simulatePressure ?? true,
    taperStart: 0,
    taperEnd: 0,
  };
}

export const DrawingCanvas = forwardRef<DrawableHandle, DrawableProps>(
  function DrawingCanvas(props, ref) {
    const {
      width,
      height,
      background = "#ffffff",
      initialDoc,
      onPersist,
      onState,
    } = props;

    const containerRef = useRef<HTMLDivElement | null>(null);
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const committedRef = useRef<HTMLCanvasElement | null>(null);
    const activeRef = useRef<HTMLCanvasElement | null>(null);
    const commitCtxRef = useRef<CanvasRenderingContext2D | null>(null);
    const activeCtxRef = useRef<CanvasRenderingContext2D | null>(null);

    // ---- mutable engine state (refs, never triggers render) ----
    const layersRef = useRef<Layer[]>([]);
    const activeLayerRef = useRef<string>("");
    const viewRef = useRef<View>({ scale: 1, offsetX: 0, offsetY: 0 });
    const indexRef = useRef<StrokeIndex>(new StrokeIndex(CELL));

    const toolRef = useRef<ToolType>("pencil");
    const penRef = useRef<PenSettings>({
      color: "#1a1a1a",
      size: 4,
      opacity: 1,
    });
    const eraserModeRef = useRef<EraserMode>("object");

    const drawingRef = useRef(false);
    const currentStrokeRef = useRef<Stroke | null>(null);
    const predictedRef = useRef(0);

    const panRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
      null,
    );
    const lassoRef = useRef<InputPoint[] | null>(null);
    const selectionRef = useRef<string[]>([]);
    const moveRef = useRef<MoveRef | null>(null);
    const pendingPixelSnap = useRef<{
      x: number;
      y: number;
      w: number;
      h: number;
      data: ImageData;
    } | null>(null);

    const historyRef = useRef<Command[]>([]);
    const histIndexRef = useRef(-1);
    const rafRef = useRef<number | null>(null);

    // ---- helpers ----
    const dpr = () => Math.max(1, Math.min(3, window.devicePixelRatio || 1));

    const activeLayer = (): Layer | undefined =>
      layersRef.current.find((l) => l.id === activeLayerRef.current);

    const toCanvas = (clientX: number, clientY: number) => {
      const rect = containerRef.current!.getBoundingClientRect();
      const v = viewRef.current;
      return {
        x: (clientX - rect.left - v.offsetX) / v.scale,
        y: (clientY - rect.top - v.offsetY) / v.scale,
      };
    };

    const paintStroke = (ctx: CanvasRenderingContext2D, s: Stroke) => {
      const outline = getStrokeOutline(s.points, strokeOptions(s));
      if (outline.length < 2) return;
      ctx.save();
      ctx.globalAlpha = s.opacity;
      ctx.fillStyle = s.color;
      if (s.tool === "marker") {
        const bg = (background || "#ffffff").trim().toLowerCase();
        if (bg === "#ffffff" || bg === "#fff" || bg === "white") {
          ctx.globalCompositeOperation = "multiply";
        }
      }
      ctx.beginPath();
      ctx.moveTo(outline[0][0], outline[0][1]);
      for (let i = 1; i < outline.length; i++) {
        ctx.lineTo(outline[i][0], outline[i][1]);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const paintAllCommitted = useCallback(() => {
      const ctx = commitCtxRef.current;
      if (!ctx) return;
      const d = dpr();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, committedRef.current!.width, committedRef.current!.height);
      ctx.setTransform(d, 0, 0, d, 0, 0);
      for (const layer of layersRef.current) {
        if (!layer.visible) continue;
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        for (const s of layer.strokes) paintStroke(ctx, s);
        ctx.restore();
      }
    }, [background]);

    const paintActive = useCallback(() => {
      const ctx = activeCtxRef.current;
      if (!ctx) return;
      const d = dpr();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, activeRef.current!.width, activeRef.current!.height);
      ctx.setTransform(d, 0, 0, d, 0, 0);
      if (lassoRef.current && lassoRef.current.length > 1) {
        ctx.save();
        ctx.strokeStyle = "#2b7cff";
        ctx.lineWidth = 1.5 / viewRef.current.scale;
        ctx.setLineDash([6 / viewRef.current.scale, 4 / viewRef.current.scale]);
        ctx.beginPath();
        ctx.moveTo(lassoRef.current[0].x, lassoRef.current[0].y);
        for (let i = 1; i < lassoRef.current.length; i++) {
          ctx.lineTo(lassoRef.current[i].x, lassoRef.current[i].y);
        }
        ctx.stroke();
        ctx.restore();
      }
      if (currentStrokeRef.current) paintStroke(ctx, currentStrokeRef.current);
    }, []);

    const applyViewToDOM = useCallback(() => {
      const v = viewRef.current;
      const t = `translate(${v.offsetX}px, ${v.offsetY}px) scale(${v.scale})`;
      if (wrapperRef.current) wrapperRef.current.style.transform = t;
    }, []);

    const rebuildIndex = useCallback(() => {
      const idx = new StrokeIndex(CELL);
      for (const layer of layersRef.current) {
        for (const s of layer.strokes) {
          if (!s.bbox) s.bbox = recomputeBBox(s.points);
          idx.insert(s, s.bbox);
        }
      }
      indexRef.current = idx;
    }, []);

    const buildDoc = useCallback(
      (): DrawingDoc => ({
        version: 1,
        width,
        height,
        background,
        layers: layersRef.current.map((l) => ({
          ...l,
          strokes: l.strokes.map((s) => ({ ...s, bbox: recomputeBBox(s.points) })),
        })),
        activeLayerId: activeLayerRef.current,
      }),
      [width, height, background],
    );

    const persist = useCallback(() => {
      onPersist?.(buildDoc());
    }, [onPersist, buildDoc]);

    const notifyState = useCallback(() => {
      onState?.({
        tool: toolRef.current,
        pen: { ...penRef.current },
        eraserMode: eraserModeRef.current,
        layers: layersRef.current.map((l) => ({ ...l, strokes: l.strokes.slice() })),
        activeLayerId: activeLayerRef.current,
        canUndo: histIndexRef.current >= 0,
        canRedo: histIndexRef.current < historyRef.current.length - 1,
        zoom: viewRef.current.scale,
      });
    }, [onState]);

    const pushHistory = useCallback(
      (cmd: Command) => {
        historyRef.current = historyRef.current.slice(0, histIndexRef.current + 1);
        historyRef.current.push(cmd);
        if (historyRef.current.length > HISTORY_LIMIT) {
          historyRef.current.shift();
        } else {
          histIndexRef.current++;
        }
        notifyState();
        persist();
      },
      [notifyState, persist],
    );

    const undo = useCallback(() => {
      if (histIndexRef.current < 0) return;
      historyRef.current[histIndexRef.current].undo();
      histIndexRef.current--;
      rebuildIndex();
      paintAllCommitted();
      notifyState();
      persist();
    }, [notifyState, persist, rebuildIndex, paintAllCommitted]);

    const redo = useCallback(() => {
      if (histIndexRef.current >= historyRef.current.length - 1) return;
      histIndexRef.current++;
      historyRef.current[histIndexRef.current].redo();
      rebuildIndex();
      paintAllCommitted();
      notifyState();
      persist();
    }, [notifyState, persist, rebuildIndex, paintAllCommitted]);

    const withLayer = (layerId: string, fn: (l: Layer) => void) => {
      layersRef.current = layersRef.current.map((l) => {
        if (l.id !== layerId) return l;
        const copy: Layer = { ...l, strokes: l.strokes.slice() };
        fn(copy);
        return copy;
      });
    };

    const setStrokePoints = (
      layerId: string,
      id: string,
      points: InputPoint[],
    ) => {
      withLayer(layerId, (l) => {
        const s = l.strokes.find((x) => x.id === id);
        if (s) {
          s.points = points;
          s.bbox = recomputeBBox(points);
        }
      });
    };

    // ---- stroke commit ----
    const commitStroke = useCallback(() => {
      const s = currentStrokeRef.current;
      currentStrokeRef.current = null;
      predictedRef.current = 0;
      if (!s || s.points.length < 1) {
        paintActive();
        return;
      }
      s.bbox = recomputeBBox(s.points);
      const layerId = activeLayerRef.current;
      withLayer(layerId, (l) => l.strokes.push(s));
      indexRef.current.insert(s, s.bbox);
      const ctx = commitCtxRef.current;
      const layer = activeLayer();
      if (ctx) {
        ctx.save();
        if (layer) ctx.globalAlpha = layer.opacity;
        paintStroke(ctx, s);
        ctx.restore();
      }
      paintActive();
      pushHistory({
        undo: () =>
          withLayer(layerId, (l) => {
            const i = l.strokes.findIndex((x) => x.id === s.id);
            if (i >= 0) l.strokes.splice(i, 1);
          }),
        redo: () => withLayer(layerId, (l) => l.strokes.push(s)),
      });
    }, [paintActive, pushHistory]);

    // ---- pixel-erase bitmap snapshot/restore ----
    const snapshotRegion = (bbox: {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
    }) => {
      const ctx = commitCtxRef.current!;
      const d = dpr();
      const pad = penRef.current.size * 3 + 4;
      const x = Math.max(0, Math.floor((bbox.minX - pad) * d));
      const y = Math.max(0, Math.floor((bbox.minY - pad) * d));
      const w = Math.min(
        committedRef.current!.width - x,
        Math.ceil((bbox.maxX - bbox.minX + pad * 2) * d),
      );
      const h = Math.min(
        committedRef.current!.height - y,
        Math.ceil((bbox.maxY - bbox.minY + pad * 2) * d),
      );
      if (w <= 0 || h <= 0) return null;
      const data = ctx.getImageData(x, y, w, h);
      return { x, y, w, h, data };
    };
    const restoreRegion = (snap: {
      x: number;
      y: number;
      w: number;
      h: number;
      data: ImageData;
    }) => {
      const ctx = commitCtxRef.current!;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.putImageData(snap.data, snap.x, snap.y);
      ctx.restore();
    };

    const finishPixelErase = useCallback(() => {
      const s = currentStrokeRef.current;
      currentStrokeRef.current = null;
      predictedRef.current = 0;
      if (!s || s.points.length < 1) {
        pendingPixelSnap.current = null;
        paintActive();
        return;
      }
      const ctx = commitCtxRef.current;
      const rasterizeErase = (c: CanvasRenderingContext2D, stroke: Stroke) => {
        c.save();
        c.globalCompositeOperation = "destination-out";
        c.globalAlpha = 1;
        c.strokeStyle = "rgba(0,0,0,1)";
        c.lineCap = "round";
        c.lineJoin = "round";
        c.lineWidth = stroke.size;
        c.beginPath();
        c.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++)
          c.lineTo(stroke.points[i].x, stroke.points[i].y);
        c.stroke();
        c.restore();
      };
      if (ctx) rasterizeErase(ctx, s);
      const erased = eraseStrokesUnderPath(s);
      const before = pendingPixelSnap.current;
      pendingPixelSnap.current = null;
      paintActive();
      pushHistory({
        undo: () => {
          if (before) restoreRegion(before);
          for (const r of erased)
            withLayer(r.layerId, (l) => l.strokes.push(r.stroke));
          rebuildIndex();
          paintAllCommitted();
        },
        redo: () => {
          if (before && commitCtxRef.current) rasterizeErase(commitCtxRef.current, s);
          for (const r of erased)
            withLayer(r.layerId, (l) => {
              const i = l.strokes.findIndex((x) => x.id === r.stroke.id);
              if (i >= 0) l.strokes.splice(i, 1);
            });
          rebuildIndex();
          paintAllCommitted();
        },
      });
    }, [paintActive, pushHistory, paintAllCommitted, rebuildIndex]);

    // ---- hit testing / lasso / erase helpers ----
    const hitTestAt = (
      x: number,
      y: number,
    ): { layerId: string; stroke: Stroke } | null => {
      const tol = Math.max(6 / viewRef.current.scale, 6);
      for (let li = layersRef.current.length - 1; li >= 0; li--) {
        const layer = layersRef.current[li];
        if (!layer.visible) continue;
        const candidates = indexRef.current
          .queryPoint(x, y, tol)
          .filter((s) => layer.strokes.some((st) => st.id === s.id));
        for (let i = layer.strokes.length - 1; i >= 0; i--) {
          const s = layer.strokes[i];
          if (candidates.includes(s) && hitTestStroke(s, x, y, tol)) {
            return { layerId: layer.id, stroke: s };
          }
        }
      }
      return null;
    };

    const removeStroke = (layerId: string, strokeId: string) => {
      const layer = layersRef.current.find((l) => l.id === layerId);
      const stroke = layer?.strokes.find((s) => s.id === strokeId);
      if (!stroke) return;
      withLayer(layerId, (l) => {
        const i = l.strokes.findIndex((s) => s.id === strokeId);
        if (i >= 0) l.strokes.splice(i, 1);
      });
      rebuildIndex();
      paintAllCommitted();
      pushHistory({
        undo: () => withLayer(layerId, (l) => l.strokes.push(stroke)),
        redo: () =>
          withLayer(layerId, (l) => {
            const i = l.strokes.findIndex((s) => s.id === stroke.id);
            if (i >= 0) l.strokes.splice(i, 1);
          }),
      });
    };

    const eraseStrokesUnderPath = (
      path: Stroke,
    ): { layerId: string; stroke: Stroke }[] => {
      const removed: { layerId: string; stroke: Stroke }[] = [];
      const { minX, minY, maxX, maxY } = path.bbox!;
      const region = indexRef.current.queryRegion(minX, minY, maxX, maxY);
      const r = path.size / 2;
      for (const layer of layersRef.current) {
        if (!layer.visible) continue;
        for (const s of layer.strokes) {
          if (!region.includes(s)) continue;
          const hit = s.points.some((pt) =>
            path.points.some((p) => {
              const dx = pt.x - p.x;
              const dy = pt.y - p.y;
              return dx * dx + dy * dy <= r * r;
            }),
          );
          if (hit) {
            withLayer(layer.id, (l) => {
              const i = l.strokes.findIndex((x) => x.id === s.id);
              if (i >= 0) l.strokes.splice(i, 1);
            });
            removed.push({
              layerId: layer.id,
              stroke: { ...s, points: s.points.slice() },
            });
          }
        }
      }
      return removed;
    };

    const selectionBBox = (): {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
    } | null => {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      let found = false;
      for (const layer of layersRef.current) {
        for (const s of layer.strokes) {
          if (!selectionRef.current.includes(s.id) || !s.bbox) continue;
          found = true;
          minX = Math.min(minX, s.bbox.minX);
          minY = Math.min(minY, s.bbox.minY);
          maxX = Math.max(maxX, s.bbox.maxX);
          maxY = Math.max(maxY, s.bbox.maxY);
        }
      }
      return found ? { minX, minY, maxX, maxY } : null;
    };

    const computeLassoSelection = (
      poly: InputPoint[],
    ): { ids: string[]; layerId: string } => {
      if (poly.length < 3) return { ids: [], layerId: "" };
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const p of poly) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      const region = indexRef.current.queryRegion(minX, minY, maxX, maxY);
      const ids: string[] = [];
      let layerId = "";
      const inside = (x: number, y: number) => {
        let c = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const xi = poly[i].x,
            yi = poly[i].y,
            xj = poly[j].x,
            yj = poly[j].y;
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
            c = !c;
        }
        return c;
      };
      for (const layer of layersRef.current) {
        if (!layer.visible) continue;
        for (const s of layer.strokes) {
          if (!region.includes(s)) continue;
          const center = s.bbox
            ? [(s.bbox.minX + s.bbox.maxX) / 2, (s.bbox.minY + s.bbox.maxY) / 2]
            : [s.points[0].x, s.points[0].y];
          if (inside(center[0], center[1])) {
            ids.push(s.id);
            layerId = layer.id;
          }
        }
      }
      return { ids, layerId };
    };

    // ---- pointer handlers ----
    const onPointerDown = useCallback(
      (e: React.PointerEvent) => {
        containerRef.current?.setPointerCapture(e.pointerId);
        const p = toCanvas(e.clientX, e.clientY);
        const tool = toolRef.current;

        if (tool === "pan") {
          const v = viewRef.current;
          panRef.current = {
            x: e.clientX,
            y: e.clientY,
            ox: v.offsetX,
            oy: v.offsetY,
          };
          return;
        }

        if (tool === "lasso") {
          selectionRef.current = [];
          lassoRef.current = [{ x: p.x, y: p.y }];
          paintActive();
          return;
        }

        // begin a move of the current selection if the point is inside it
        const sb = selectionBBox();
        if (
          sb &&
          p.x >= sb.minX &&
          p.x <= sb.maxX &&
          p.y >= sb.minY &&
          p.y <= sb.maxY
        ) {
          const items: MoveRef["items"] = [];
          for (const layer of layersRef.current) {
            for (const s of layer.strokes) {
              if (selectionRef.current.includes(s.id)) {
                items.push({
                  layerId: layer.id,
                  id: s.id,
                  orig: s.points.map((q) => ({ ...q })),
                });
              }
            }
          }
          moveRef.current = { startX: p.x, startY: p.y, items, moved: [] };
          return;
        }

        if (tool === "eraser" && eraserModeRef.current === "object") {
          const hit = hitTestAt(p.x, p.y);
          if (hit) removeStroke(hit.layerId, hit.stroke.id);
          drawingRef.current = true; // drag to erase more
          return;
        }

        if (tool === "eraser" && eraserModeRef.current === "pixel") {
          const stroke: Stroke = {
            id: uid(),
            tool: "eraser",
            color: "#000000",
            size: penRef.current.size * 3,
            opacity: 1,
            points: [{ x: p.x, y: p.y, pressure: 0.5 }],
          };
          stroke.bbox = recomputeBBox(stroke.points);
          currentStrokeRef.current = stroke;
          pendingPixelSnap.current = snapshotRegion(stroke.bbox);
          drawingRef.current = true;
          return;
        }

        // pencil / marker
        if (!activeLayer()?.visible) return;
        selectionRef.current = [];
        drawingRef.current = true;
        const pressure = e.pressure > 0 ? e.pressure : 0.5;
        currentStrokeRef.current = {
          id: uid(),
          tool,
          color: penRef.current.color,
          size: penRef.current.size,
          opacity: penRef.current.opacity,
          thinning: tool === "marker" ? 0.0 : 0.6,
          pressureGamma: 1,
          simulatePressure: true,
          streamline: 0.5,
          points: [{ x: p.x, y: p.y, pressure }],
        };
        paintActive();
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    );

    const onPointerMove = useCallback(
      (e: React.PointerEvent) => {
        if (panRef.current) {
          const dx = e.clientX - panRef.current.x;
          const dy = e.clientY - panRef.current.y;
          viewRef.current = {
            ...viewRef.current,
            offsetX: panRef.current.ox + dx,
            offsetY: panRef.current.oy + dy,
          };
          applyViewToDOM();
          return;
        }

        if (toolRef.current === "lasso" && lassoRef.current) {
          const p = toCanvas(e.clientX, e.clientY);
          lassoRef.current.push({ x: p.x, y: p.y });
          paintActive();
          return;
        }

        if (moveRef.current) {
          const p = toCanvas(e.clientX, e.clientY);
          const dx = p.x - moveRef.current.startX;
          const dy = p.y - moveRef.current.startY;
          for (const it of moveRef.current.items) {
            setStrokePoints(
              it.layerId,
              it.id,
              it.orig.map((q) => ({ ...q, x: q.x + dx, y: q.y + dy })),
            );
          }
          rebuildIndex();
          paintAllCommitted();
          return;
        }

        if (!drawingRef.current) return;
        const p = toCanvas(e.clientX, e.clientY);

        if (toolRef.current === "eraser" && eraserModeRef.current === "object") {
          const hit = hitTestAt(p.x, p.y);
          if (hit) removeStroke(hit.layerId, hit.stroke.id);
          return;
        }
        if (toolRef.current === "eraser" && eraserModeRef.current === "pixel") {
          currentStrokeRef.current?.points.push({ x: p.x, y: p.y, pressure: 0.5 });
          return;
        }
        if (
          currentStrokeRef.current &&
          (toolRef.current === "pencil" || toolRef.current === "marker")
        ) {
          const native = e.nativeEvent as PointerEvent;
          const events: PointerEvent[] =
            native.getCoalescedEvents?.() ?? [native];
          const preds: PointerEvent[] = native.getPredictedEvents?.() ?? [];
          if (predictedRef.current > 0) {
            currentStrokeRef.current.points.splice(
              currentStrokeRef.current.points.length - predictedRef.current,
              predictedRef.current,
            );
          }
          for (const ev of events) {
            const cp = toCanvas(ev.clientX, ev.clientY);
            currentStrokeRef.current.points.push({
              x: cp.x,
              y: cp.y,
              pressure: ev.pressure > 0 ? ev.pressure : 0.5,
            });
          }
          predictedRef.current = 0;
          for (const ev of preds) {
            const cp = toCanvas(ev.clientX, ev.clientY);
            currentStrokeRef.current.points.push({
              x: cp.x,
              y: cp.y,
              pressure: 0.5,
            });
            predictedRef.current++;
          }
        }
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    );

    const onPointerUp = useCallback(
      (e: React.PointerEvent) => {
        if (panRef.current) {
          panRef.current = null;
          notifyState();
          persist();
          return;
        }
        if (toolRef.current === "lasso" && lassoRef.current) {
          const sel = computeLassoSelection(lassoRef.current);
          selectionRef.current = sel.ids;
          lassoRef.current = null;
          paintActive();
          notifyState();
          return;
        }
        if (moveRef.current) {
          const m = moveRef.current;
          const moved: { layerId: string; id: string; points: InputPoint[] }[] =
            [];
          for (const it of m.items) {
            const layer = layersRef.current.find((l) => l.id === it.layerId);
            const s = layer?.strokes.find((x) => x.id === it.id);
            if (s) moved.push({ layerId: it.layerId, id: it.id, points: s.points.slice() });
          }
          const original = m.items.map((it) => ({
            layerId: it.layerId,
            id: it.id,
            points: it.orig,
          }));
          moveRef.current = null;
          rebuildIndex();
          paintAllCommitted();
          pushHistory({
            undo: () => {
              for (const o of original)
                setStrokePoints(o.layerId, o.id, o.points.map((q) => ({ ...q })));
              rebuildIndex();
              paintAllCommitted();
            },
            redo: () => {
              for (const mv of moved)
                setStrokePoints(mv.layerId, mv.id, mv.points.map((q) => ({ ...q })));
              rebuildIndex();
              paintAllCommitted();
            },
          });
          notifyState();
          return;
        }
        if (!drawingRef.current) return;
        drawingRef.current = false;
        if (toolRef.current === "eraser" && eraserModeRef.current === "pixel") {
          finishPixelErase();
          return;
        }
        if (toolRef.current === "eraser" && eraserModeRef.current === "object") {
          return;
        }
        commitStroke();
        notifyState();
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [commitStroke, finishPixelErase, notifyState, persist],
    );

    const onWheel = useCallback(
      (e: React.WheelEvent) => {
        e.preventDefault();
        const rect = containerRef.current!.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const v = viewRef.current;
        const factor = Math.exp(-e.deltaY * 0.0015);
        const newScale = Math.min(8, Math.max(0.1, v.scale * factor));
        const cx = (mx - v.offsetX) / v.scale;
        const cy = (my - v.offsetY) / v.scale;
        viewRef.current = {
          scale: newScale,
          offsetX: mx - cx * newScale,
          offsetY: my - cy * newScale,
        };
        applyViewToDOM();
        notifyState();
      },
      [applyViewToDOM, notifyState],
    );

    // ---- imperative API ----
    const loadDoc = useCallback(
      (d: DrawingDoc) => {
        layersRef.current = d.layers.map((l) => ({
          ...l,
          strokes: l.strokes.map((s) => ({ ...s, points: s.points.slice() })),
        }));
        activeLayerRef.current =
          layersRef.current.find((l) => l.id === d.activeLayerId)?.id ??
          (layersRef.current[0]?.id ?? "");
        rebuildIndex();
        paintAllCommitted();
        notifyState();
      },
      [rebuildIndex, paintAllCommitted, notifyState],
    );

    useImperativeHandle(
      ref,
      (): DrawableHandle => ({
        getDoc: () => buildDoc(),
        setDoc: (d) => loadDoc(d),
        undo,
        redo,
        clearActiveLayer: () => {
          const layerId = activeLayerRef.current;
          const layer = activeLayer();
          if (!layer) return;
          const removed = layer.strokes.slice();
          withLayer(layerId, (l) => (l.strokes = []));
          rebuildIndex();
          paintAllCommitted();
          pushHistory({
            undo: () => withLayer(layerId, (l) => (l.strokes = removed.slice())),
            redo: () => withLayer(layerId, (l) => (l.strokes = [])),
          });
        },
        clearAll: () => {
          const removed = layersRef.current.map((l) => ({
            id: l.id,
            strokes: l.strokes.slice(),
          }));
          for (const r of removed) withLayer(r.id, (l) => (l.strokes = []));
          rebuildIndex();
          paintAllCommitted();
          pushHistory({
            undo: () =>
              removed.forEach((r) =>
                withLayer(r.id, (l) => (l.strokes = r.strokes.slice())),
              ),
            redo: () =>
              removed.forEach((r) => withLayer(r.id, (l) => (l.strokes = []))),
          });
        },
        setTool: (t) => {
          toolRef.current = t;
          notifyState();
        },
        setPen: (p) => {
          penRef.current = { ...p };
          notifyState();
        },
        setEraserMode: (m) => {
          eraserModeRef.current = m;
          notifyState();
        },
        deleteSelection: () => {
          const ids = selectionRef.current.slice();
          if (!ids.length) return;
          const snapshots: { layerId: string; stroke: Stroke }[] = [];
          for (const layer of layersRef.current) {
            for (const s of layer.strokes) {
              if (ids.includes(s.id))
                snapshots.push({
                  layerId: layer.id,
                  stroke: { ...s, points: s.points.slice() },
                });
            }
          }
          for (const snap of snapshots) removeStroke(snap.layerId, snap.stroke.id);
          selectionRef.current = [];
          notifyState();
        },
        selectAll: () => {
          selectionRef.current = [];
          for (const layer of layersRef.current)
            for (const s of layer.strokes) selectionRef.current.push(s.id);
          notifyState();
        },
        addLayer: (name) => {
          const id = uid();
          const layer: Layer = {
            id,
            name: name || `Layer ${layersRef.current.length + 1}`,
            visible: true,
            opacity: 1,
            strokes: [],
          };
          layersRef.current = [...layersRef.current, layer];
          activeLayerRef.current = id;
          paintAllCommitted();
          notifyState();
          persist();
        },
        removeLayer: (id) => {
          if (layersRef.current.length <= 1) return;
          layersRef.current = layersRef.current.filter((l) => l.id !== id);
          if (activeLayerRef.current === id)
            activeLayerRef.current = layersRef.current[0].id;
          rebuildIndex();
          paintAllCommitted();
          notifyState();
          persist();
        },
        setActiveLayer: (id) => {
          activeLayerRef.current = id;
          notifyState();
        },
        toggleLayerVisible: (id) => {
          layersRef.current = layersRef.current.map((l) =>
            l.id === id ? { ...l, visible: !l.visible } : l,
          );
          rebuildIndex();
          paintAllCommitted();
          notifyState();
          persist();
        },
        setLayerOpacity: (id, opacity) => {
          layersRef.current = layersRef.current.map((l) =>
            l.id === id ? { ...l, opacity } : l,
          );
          paintAllCommitted();
          notifyState();
          persist();
        },
        renameLayer: (id, name) => {
          layersRef.current = layersRef.current.map((l) =>
            l.id === id ? { ...l, name } : l,
          );
          notifyState();
          persist();
        },
        reorderLayer: (id, dir) => {
          const arr = layersRef.current.slice();
          const i = arr.findIndex((l) => l.id === id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= arr.length) return;
          [arr[i], arr[j]] = [arr[j], arr[i]];
          layersRef.current = arr;
          paintAllCommitted();
          notifyState();
          persist();
        },
        zoomBy: (factor) => {
          const el = containerRef.current;
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const mx = rect.width / 2;
          const my = rect.height / 2;
          const v = viewRef.current;
          const newScale = Math.min(8, Math.max(0.1, v.scale * factor));
          const cx = (mx - v.offsetX) / v.scale;
          const cy = (my - v.offsetY) / v.scale;
          viewRef.current = {
            scale: newScale,
            offsetX: mx - cx * newScale,
            offsetY: my - cy * newScale,
          };
          applyViewToDOM();
          notifyState();
        },
        resetView: () => {
          viewRef.current = { scale: 1, offsetX: 0, offsetY: 0 };
          applyViewToDOM();
          notifyState();
        },
        fitView: () => {
          const el = containerRef.current;
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const pad = 0.92;
          const scale = Math.min(
            8,
            Math.max(
              0.1,
              Math.min(rect.width / width, rect.height / height) * pad,
            ),
          );
          const offsetX = (rect.width - width * scale) / 2;
          const offsetY = (rect.height - height * scale) / 2;
          viewRef.current = { scale, offsetX, offsetY };
          applyViewToDOM();
          notifyState();
        },
      }),
      [buildDoc, loadDoc, undo, redo, pushHistory, paintAllCommitted, rebuildIndex],
    );

    // ---- one-time setup ----
    useEffect(() => {
      const cc = committedRef.current!;
      const ac = activeRef.current!;
      const d = dpr();
      cc.width = Math.floor(width * d);
      cc.height = Math.floor(height * d);
      ac.width = cc.width;
      ac.height = cc.height;
      cc.style.width = width + "px";
      cc.style.height = height + "px";
      ac.style.width = width + "px";
      ac.style.height = height + "px";
      commitCtxRef.current = cc.getContext("2d");
      activeCtxRef.current = ac.getContext("2d");
      commitCtxRef.current!.setTransform(d, 0, 0, d, 0, 0);
      activeCtxRef.current!.setTransform(d, 0, 0, d, 0, 0);

      const initDoc: DrawingDoc =
        initialDoc ??
        {
          version: 1,
          width,
          height,
          background,
          layers: [
            { id: uid(), name: "Layer 1", visible: true, opacity: 1, strokes: [] },
          ],
          activeLayerId: "",
        };
      if (!initDoc.activeLayerId && initDoc.layers.length)
        initDoc.activeLayerId = initDoc.layers[0].id;
      loadDoc(initDoc);
      applyViewToDOM();

      const loop = () => {
        if (drawingRef.current && currentStrokeRef.current) paintActive();
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);

      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <div
        ref={containerRef}
        style={{
          position: "relative",
          width,
          height,
          overflow: "hidden",
          touchAction: "none",
          background,
          userSelect: "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <div
          ref={wrapperRef}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            transformOrigin: "0 0",
          }}
        >
          <canvas
            ref={committedRef}
            style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
          />
          <canvas
            ref={activeRef}
            style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
          />
          {props.children}
        </div>
      </div>
    );
  },
);

export default DrawingCanvas;

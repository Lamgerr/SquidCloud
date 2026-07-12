import React, { useCallback, useRef, useState } from 'react';
import { uid, type SqdObject, type SqdShapeObj, type SqdTextbox } from './sqd';
import { shapePath, type Pt } from './shapes';

export type ObjectTool = 'select' | 'line' | 'arrow' | 'textbox' | 'polygon' | 'image' | string;

interface ObjectLayerProps {
  objects: SqdObject[];
  onObjectsChange: (updater: (o: SqdObject[]) => SqdObject[]) => void;
  active: boolean;
  tool: ObjectTool;
  color: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  readOnly?: boolean;
  snap?: boolean;
}

const ObjectLayer: React.FC<ObjectLayerProps> = ({ objects, onObjectsChange, active, tool, color, selectedId, onSelect, readOnly, snap }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef(color);
  colorRef.current = color;
  const objectsRef = useRef(onObjectsChange);
  objectsRef.current = onObjectsChange;
  const drag = useRef<{ id: string; mode: 'move' | 'resize' | 'rotate'; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number; or: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [polygon, setPolygon] = useState<Pt[]>([]);

  const snapVal = (v: number) => (snap ? Math.round(v / 8) * 8 : v);

  const onWinMove = useCallback((e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    objectsRef.current((prev) =>
      prev.map((o) => {
        if (o.id !== d.id) return o;
        if (d.mode === 'move') return { ...o, x: snapVal(Math.round(d.ox + dx)), y: snapVal(Math.round(d.oy + dy)) };
        if (d.mode === 'rotate') {
          const cx = d.ox + d.ow / 2;
          const cy = d.oy + d.oh / 2;
          const ang = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90;
          return { ...o, rotation: Math.round(ang) };
        }
        return { ...o, w: Math.max(16, snapVal(Math.round(d.ow + dx))), h: Math.max(16, snapVal(Math.round(d.oh + dy))) };
      })
    );
  }, [snap]);

  const onWinUp = useCallback(() => {
    drag.current = null;
    window.removeEventListener('pointermove', onWinMove);
    window.removeEventListener('pointerup', onWinUp);
  }, [onWinMove]);

  const startDrag = (e: React.PointerEvent, obj: SqdObject, mode: 'move' | 'resize' | 'rotate') => {
    if (!active || readOnly || tool !== 'select') return;
    e.stopPropagation();
    onSelect(obj.id);
    drag.current = { id: obj.id, mode, sx: e.clientX, sy: e.clientY, ox: obj.x, oy: obj.y, ow: obj.w, oh: obj.h, or: obj.rotation || 0 };
    window.addEventListener('pointermove', onWinMove);
    window.addEventListener('pointerup', onWinUp);
  };

  const finalizePolygon = () => {
    if (polygon.length < 3) { setPolygon([]); return; }
    const id = uid('o');
    const minX = Math.min(...polygon.map((p) => p.x));
    const minY = Math.min(...polygon.map((p) => p.y));
    const maxX = Math.max(...polygon.map((p) => p.x));
    const maxY = Math.max(...polygon.map((p) => p.y));
    const w = maxX - minX;
    const h = maxY - minY;
    const norm = polygon.map((p) => ({ x: (p.x - minX) / w, y: (p.y - minY) / h }));
    const obj: SqdShapeObj = { id, type: 'shape', shape: 'custom', x: Math.round(minX), y: Math.round(minY), w: Math.round(w), h: Math.round(h), fill: 'rgba(99,102,241,0.12)', stroke: colorRef.current, strokeWidth: 2, points: norm };
    objectsRef.current((prev) => [...prev, obj]);
    setPolygon([]);
    onSelect(id);
  };

  const onLayerPointerDown = (e: React.PointerEvent) => {
    if (!active || readOnly) return;
    if (tool === 'select' || tool === 'off' || tool === 'image') { onSelect(null); return; }
    const rect = wrapRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'polygon') {
      if (polygon.length > 0) {
        const first = polygon[0];
        if (Math.hypot(first.x - x, first.y - y) < 12 && polygon.length > 2) { finalizePolygon(); return; }
      }
      setPolygon((p) => [...p, { x, y }]);
      return;
    }

    const id = uid('o');
    const c = colorRef.current;
    let obj: SqdObject;
    if (tool === 'textbox')
      obj = { id, type: 'textbox', x: Math.round(x - 90), y: Math.round(y - 30), w: 180, h: 60, fill: 'transparent', stroke: 'transparent', text: 'Text', fontSize: 18, color: c, align: 'left' };
    else if (tool === 'line' || tool === 'arrow')
      obj = { id, type: tool, x: Math.round(x - 60), y: Math.round(y), w: 120, h: 0, fill: 'transparent', stroke: c, strokeWidth: 2 };
    else
      obj = { id, type: 'shape', shape: tool, x: Math.round(x - 60), y: Math.round(y - 40), w: 120, h: 80, fill: 'rgba(99,102,241,0.12)', stroke: c, strokeWidth: 2, text: '' };
    objectsRef.current((prev) => [...prev, obj]);
    onSelect(id);
  };

  const commitText = (obj: SqdObject, text: string) => {
    objectsRef.current((prev) => prev.map((o) => (o.id === obj.id ? ({ ...o, text } as SqdObject) : o)));
  };

  const renderObject = (obj: SqdObject) => {
    const selected = obj.id === selectedId;
    const common: React.CSSProperties = {
      position: 'absolute',
      left: obj.x,
      top: obj.y,
      width: obj.w,
      height: obj.h,
      transform: `rotate(${obj.rotation || 0}deg)`,
      transformOrigin: 'center',
      touchAction: 'none',
      cursor: active && tool === 'select' && !readOnly ? 'move' : 'default',
    };
    const onDown = (e: React.PointerEvent) => startDrag(e, obj, 'move');

    if (obj.type === 'image') {
      return (
        <div key={obj.id} style={common} onPointerDown={onDown} className={selected ? 'ring-2 ring-blue-500' : ''}>
          <img src={obj.src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: obj.radius, pointerEvents: 'none' }} />
          {selected && !readOnly && <><ResizeHandle obj={obj} onDown={startDrag} /><RotateHandle obj={obj} onDown={startDrag} /></>}
        </div>
      );
    }

    if (obj.type === 'line' || obj.type === 'arrow') {
      return (
        <div key={obj.id} style={common} onPointerDown={onDown} className={selected ? 'ring-1 ring-blue-400' : ''}>
          <svg width="100%" height="100%" style={{ overflow: 'visible', pointerEvents: 'none' }}>
            <defs>
              <marker id={`ah-${obj.id}`} markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L7,3 L0,6 Z" fill={obj.stroke} />
              </marker>
            </defs>
            <line x1={obj.strokeWidth} y1={obj.strokeWidth} x2={obj.w - obj.strokeWidth} y2={obj.h - obj.strokeWidth} stroke={obj.stroke} strokeWidth={obj.strokeWidth} markerEnd={obj.type === 'arrow' ? `url(#ah-${obj.id})` : undefined} />
          </svg>
          {selected && !readOnly && <><ResizeHandle obj={obj} onDown={startDrag} /><RotateHandle obj={obj} onDown={startDrag} /></>}
        </div>
      );
    }

    if (obj.type === 'textbox') {
      const tb = obj as SqdTextbox;
      return (
        <div key={obj.id} style={{ ...common, background: tb.fill === 'transparent' ? 'transparent' : tb.fill, border: tb.stroke === 'transparent' ? 'none' : `1px solid ${tb.stroke}`, borderRadius: 8, padding: 8, color: tb.color, fontSize: tb.fontSize, textAlign: tb.align, display: 'flex', alignItems: 'center', overflow: 'hidden' }} onPointerDown={onDown} onDoubleClick={() => !readOnly && setEditingId(obj.id)} className={selected ? 'ring-2 ring-blue-500' : ''}>
          {editingId === obj.id ? (
            <div contentEditable suppressContentEditableWarning style={{ outline: 'none', width: '100%' }} onBlur={(e) => { commitText(obj, e.currentTarget.textContent || ''); setEditingId(null); }}>{tb.text}</div>
          ) : (
            <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', width: '100%' }}>{tb.text}</span>
          )}
          {selected && !readOnly && <><ResizeHandle obj={obj} onDown={startDrag} /><RotateHandle obj={obj} onDown={startDrag} /></>}
        </div>
      );
    }

    // rect / ellipse / shape
    const so = obj as SqdShapeObj;
    const shapeId = so.type === 'shape' ? so.shape : so.type;
    const fill = so.fill || (so.type === 'sticky' ? '#ffe98a' : 'rgba(99,102,241,0.12)');
    const stroke = so.type === 'sticky' ? 'rgba(0,0,0,0.08)' : so.stroke || colorRef.current;
    return (
      <div key={obj.id} style={common} onPointerDown={onDown} onDoubleClick={() => !readOnly && setEditingId(obj.id)} className={selected ? 'ring-2 ring-blue-500' : ''}>
        <svg width="100%" height="100%" viewBox={`0 0 ${obj.w} ${obj.h}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>
          <path d={shapePath(shapeId, obj.w, obj.h, so.type === 'shape' ? so.points : undefined)} fill={fill} stroke={stroke} strokeWidth={so.strokeWidth || 2} strokeLinejoin="round" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, textAlign: 'center', color: '#1f2430', fontSize: so.fontSize || 14, pointerEvents: 'none', overflow: 'hidden' }}>
          {editingId === obj.id ? (
            <div contentEditable suppressContentEditableWarning style={{ outline: 'none', width: '100%' }} onBlur={(e) => { commitText(obj, e.currentTarget.textContent || ''); setEditingId(null); }}>{so.text}</div>
          ) : (
            <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{so.text}</span>
          )}
        </div>
        {selected && !readOnly && <><ResizeHandle obj={obj} onDown={startDrag} /><RotateHandle obj={obj} onDown={startDrag} /></>}
      </div>
    );
  };

  return (
    <div ref={wrapRef} className="absolute inset-0" style={{ pointerEvents: active ? 'auto' : 'none', touchAction: 'none' }} onPointerDown={onLayerPointerDown} onDoubleClick={() => tool === 'polygon' && finalizePolygon()}>
      {polygon.length > 0 && (
        <svg className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible' }}>
          <polyline points={polygon.map((p) => `${p.x},${p.y}`).join(' ')} fill="rgba(99,102,241,0.1)" stroke={colorRef.current} strokeWidth={2} />
          {polygon.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={4} fill={i === 0 ? '#22c55e' : colorRef.current} />)}
        </svg>
      )}
      {objects.map(renderObject)}
    </div>
  );
};

function ResizeHandle({ obj, onDown }: { obj: SqdObject; onDown: (e: React.PointerEvent, o: SqdObject, m: 'resize') => void }) {
  return (
    <div onPointerDown={(e) => onDown(e, obj, 'resize')} style={{ position: 'absolute', right: -6, bottom: -6, width: 14, height: 14, borderRadius: 4, background: '#3b82f6', border: '2px solid white', cursor: 'nwse-resize', touchAction: 'none' }} />
  );
}
function RotateHandle({ obj, onDown }: { obj: SqdObject; onDown: (e: React.PointerEvent, o: SqdObject, m: 'rotate') => void }) {
  return (
    <div onPointerDown={(e) => onDown(e, obj, 'rotate')} style={{ position: 'absolute', left: '50%', top: -22, transform: 'translateX(-50%)', width: 14, height: 14, borderRadius: '50%', background: '#22c55e', border: '2px solid white', cursor: 'grab', touchAction: 'none' }} />
  );
}

export default ObjectLayer;

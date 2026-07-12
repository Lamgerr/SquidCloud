export interface Pt { x: number; y: number; }

export const SHAPE_TYPES: Array<{ id: string; label: string }> = [
  { id: 'rect', label: 'Rectangle' },
  { id: 'roundRect', label: 'Rounded' },
  { id: 'ellipse', label: 'Ellipse' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'parallelogram', label: 'Parallelogram' },
  { id: 'trapezoid', label: 'Trapezoid' },
  { id: 'pentagon', label: 'Pentagon' },
  { id: 'hexagon', label: 'Hexagon' },
  { id: 'star', label: 'Star' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'doubleArrow', label: 'Double Arrow' },
  { id: 'cylinder', label: 'Cylinder' },
  { id: 'cloud', label: 'Cloud' },
  { id: 'callout', label: 'Callout' },
  { id: 'heart', label: 'Heart' },
  { id: 'sticky', label: 'Sticky Note' },
];

function polygon(n: number, w: number, h: number, rot = -Math.PI / 2): string {
  const cx = w / 2, cy = h / 2;
  const rx = w / 2, ry = h / 2;
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = rot + (i * 2 * Math.PI) / n;
    const x = cx + rx * Math.cos(a);
    const y = cy + ry * Math.sin(a);
    d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
  }
  return d + 'Z';
}

function starPath(points: number, w: number, h: number): string {
  const cx = w / 2, cy = h / 2;
  const outer = Math.min(w, h) / 2;
  const inner = outer * 0.42;
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
  }
  return d + 'Z';
}

export function shapePath(shape: string, w: number, h: number, points?: Pt[]): string {
  const r = 14;
  switch (shape) {
    case 'rect':
      return `M0,0 H${w} V${h} H0 Z`;
    case 'roundRect':
      return `M${r},0 H${w - r} Q${w},0 ${w},${r} V${h - r} Q${w},${h} ${w - r},${h} H${r} Q0,${h} 0,${h - r} V${r} Q0,0 ${r},0 Z`;
    case 'ellipse': {
      const rx = w / 2, ry = h / 2;
      return `M${rx},0 a${rx},${ry} 0 1,0 0.1,0 Z`;
    }
    case 'triangle':
      return `M${w / 2},0 L${w},${h} L0,${h} Z`;
    case 'diamond':
      return `M${w / 2},0 L${w},${h / 2} L${w / 2},${h} L0,${h / 2} Z`;
    case 'parallelogram':
      return `M${w * 0.22},0 L${w},0 L${w * 0.78},${h} L0,${h} Z`;
    case 'trapezoid':
      return `M${w * 0.18},0 L${w * 0.82},0 L${w},${h} L0,${h} Z`;
    case 'pentagon':
      return polygon(5, w, h);
    case 'hexagon':
      return polygon(6, w, h);
    case 'star':
      return starPath(5, w, h);
    case 'arrow':
      return `M0,${h / 2} L${w * 0.78},${h / 2} M${w * 0.62},${h * 0.2} L${w},${h / 2} L${w * 0.62},${h * 0.8}`;
    case 'doubleArrow':
      return `M${w * 0.22},${h * 0.2} L0,${h / 2} L${w * 0.22},${h * 0.8} M${w * 0.78},${h * 0.2} L${w},${h / 2} L${w * 0.78},${h * 0.8} M0,${h / 2} H${w}`;
    case 'cylinder': {
      const ry = Math.min(14, h * 0.18);
      return `M0,${ry} a${w / 2},${ry} 0 0,0 ${w},0 V${h - ry} a${w / 2},${ry} 0 0,0 ${-w},0 Z M0,${ry} a${w / 2},${ry} 0 0,1 ${w},0`;
    }
    case 'cloud': {
      const u = w / 6;
      return `M${u * 1.4},${h * 0.7} a${u * 0.9},${u * 0.9} 0 0,1 ${u * 0.2},-${u * 0.9} a${u},${u} 0 0,1 ${u * 1.5},-${u * 0.2} a${u * 0.85},${u * 0.85} 0 0,1 ${u * 1.6},${u * 0.5} a${u},${u} 0 0,1 ${-u * 0.4},${u * 1.4} Z`;
    }
    case 'callout':
      return `M0,0 H${w} V${h * 0.7} H${w * 0.55} L${w * 0.4},${h} L${w * 0.42},${h * 0.7} H0 Z`;
    case 'heart': {
      const k = Math.min(w, h) / 2;
      return `M${w / 2},${h * 0.85} C${w / 2 - k * 1.6},${h * 0.35} ${w * 0.05},${h * 0.15} ${w * 0.25},${h * 0.15} C${w * 0.42},${h * 0.15} ${w / 2},${h * 0.42} ${w / 2},${h * 0.5} C${w / 2},${h * 0.42} ${w * 0.58},${h * 0.15} ${w * 0.75},${h * 0.15} C${w * 0.95},${h * 0.15} ${w / 2 + k * 1.6},${h * 0.35} ${w / 2},${h * 0.85} Z`;
    }
    case 'sticky':
      return `M0,0 H${w} V${h} H0 Z`;
    case 'custom':
      if (points && points.length > 1) {
        return points.map((p, i) => (i === 0 ? 'M' : 'L') + (p.x * w).toFixed(1) + ',' + (p.y * h).toFixed(1)).join(' ') + ' Z';
      }
      return `M0,0 H${w} V${h} H0 Z`;
    default:
      return `M0,0 H${w} V${h} H0 Z`;
  }
}

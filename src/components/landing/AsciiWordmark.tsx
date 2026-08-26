import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

/* SQUIDCLOUD drawn as vector geometry instead of text. Terminal fonts on
   guest devices lack box-drawing glyphs, which shredded the grid into
   fallback-font gibberish — rects cannot fall back. */

const GLYPHS: Record<string, string[]> = {
  S: ['███████╗', '██╔════╝', '███████╗', '╚════██║', '███████║', '╚══════╝'],
  Q: [' ██████╗ ', '██╔═══██╗', '██║   ██║', '██║▄▄ ██║', '╚██████╔╝', ' ╚══▀▀═╝ '],
  U: ['██╗   ██╗', '██║   ██║', '██║   ██║', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
  I: ['██╗', '██║', '██║', '██║', '██║', '╚═╝'],
  D: ['██████╗ ', '██╔══██╗', '██║  ██║', '██║  ██║', '██████╔╝', '╚═════╝ '],
  C: [' ██████╗', '██╔════╝', '██║     ', '██║     ', '╚██████╗', ' ╚═════╝'],
  L: ['██╗     ', '██║     ', '██║     ', '██║     ', '███████╗', '╚══════╝'],
  O: [' ██████╗ ', '██╔═══██╗', '██║   ██║', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
};

const WORD = 'SQUIDCLOUD';
const ROWS = [0, 1, 2, 3, 4, 5].map((r) => WORD.split('').map((ch) => GLYPHS[ch][r]).join(''));

const CELL = 10;
const STROKE = 2.4;
const COLS = Math.max(...ROWS.map((r) => r.length));
const W = COLS * CELL;
const H = ROWS.length * CELL;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function cellRects(ch: string, cx: number, cy: number): Rect[] {
  const midY = cy + CELL / 2;
  const midX = cx + CELL / 2;
  switch (ch) {
    case '█':
      return [{ x: cx, y: cy, w: CELL, h: CELL }];
    case '▄':
      return [{ x: cx, y: cy + CELL / 2, w: CELL, h: CELL / 2 }];
    case '▀':
      return [{ x: cx, y: cy, w: CELL, h: CELL / 2 }];
    case '═':
      return [{ x: cx, y: midY - STROKE / 2, w: CELL, h: STROKE }];
    case '║':
      return [{ x: midX - STROKE / 2, y: cy, w: STROKE, h: CELL }];
    case '╔':
      return [
        { x: midX - STROKE / 2, y: cy, w: STROKE, h: CELL / 2 + STROKE / 2 },
        { x: midX - STROKE / 2, y: midY - STROKE / 2, w: CELL / 2 + STROKE / 2, h: STROKE },
      ];
    case '╗':
      return [
        { x: midX - STROKE / 2, y: cy, w: STROKE, h: CELL / 2 + STROKE / 2 },
        { x: cx, y: midY - STROKE / 2, w: CELL / 2 + STROKE / 2, h: STROKE },
      ];
    case '╚':
      return [
        { x: midX - STROKE / 2, y: midY - STROKE / 2, w: STROKE, h: CELL / 2 + STROKE / 2 },
        { x: midX - STROKE / 2, y: midY - STROKE / 2, w: CELL / 2 + STROKE / 2, h: STROKE },
      ];
    case '╝':
      return [
        { x: midX - STROKE / 2, y: midY - STROKE / 2, w: STROKE, h: CELL / 2 + STROKE / 2 },
        { x: cx, y: midY - STROKE / 2, w: CELL / 2 + STROKE / 2, h: STROKE },
      ];
    default:
      return [];
  }
}

const RECTS: Rect[] = [];
ROWS.forEach((row, r) => {
  row.split('').forEach((ch, c) => {
    RECTS.push(...cellRects(ch, c * CELL, r * CELL));
  });
});

export default function AsciiWordmark({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const wipeRef = useRef<SVGRectElement | null>(null);
  const [settled, setSettled] = useState(reduced);

  useEffect(() => {
    if (reduced) {
      wipeRef.current?.setAttribute('width', String(W + 4));
      setSettled(true);
      return;
    }
    let raf = 0;
    let start = 0;
    const DURATION = 950;
    const DELAY = 200;
    const tick = (t: number) => {
      if (!start) start = t;
      const el = Math.max(0, t - start - DELAY);
      const p = Math.min(1, el / DURATION);
      const eased = 1 - Math.pow(1 - p, 3);
      wipeRef.current?.setAttribute('width', String(eased * (W + 4)));
      if (p >= 1) {
        setSettled(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <div
      role="img"
      aria-label="SQUIDCLOUD"
      className={`select-none ${className ?? ''}`}
      style={{ maxWidth: 1080, width: '100%', margin: '0 auto' }}
    >
      <svg
        viewBox={`${-2} ${-2} ${W + 4} ${H + 4}`}
        width="100%"
        style={{ display: 'block', overflow: 'visible' }}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id="slw-metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ececef" />
            <stop offset="48%" stopColor="#a1a1aa" />
            <stop offset="100%" stopColor="#2c2c30" />
          </linearGradient>
          <linearGradient id="slw-sheen-band" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <clipPath id="slw-wipe">
            <rect ref={wipeRef} x={-2} y={-2} width={reduced ? W + 4 : 0} height={H + 4} />
          </clipPath>
          <mask id="slw-mark" maskUnits="userSpaceOnUse" x={-2} y={-2} width={W + 4} height={H + 4}>
            <g fill="#ffffff">
              {RECTS.map((rc, i) => (
                <rect key={i} x={rc.x} y={rc.y} width={rc.w} height={rc.h} />
              ))}
            </g>
          </mask>
        </defs>

        <g clipPath="url(#slw-wipe)">
          <g fill="url(#slw-metal)">
            {RECTS.map((rc, i) => (
              <rect key={i} x={rc.x} y={rc.y} width={rc.w} height={rc.h} />
            ))}
          </g>
        </g>

        <rect
          x={W * 0.12}
          y={-2}
          width={W * 0.42}
          height={H + 4}
          fill="url(#slw-sheen-band)"
          mask="url(#slw-mark)"
          className={settled ? 'sl-sheen-rect sl-sheen-rect--run' : undefined}
          style={{ transform: 'translateX(-160%)' }}
        />
      </svg>
    </div>
  );
}

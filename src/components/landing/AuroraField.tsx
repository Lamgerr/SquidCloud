import React, { useEffect, useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';

/* ═══════════════════════════════════════════════════════════════
   AuroraField. The live wallpaper for the whole page.

   A fixed, pointer-inert canvas behind everything: slow drifting
   radial washes in indigo, violet and teal, plus film grain and a
   vignette. No WebGL, so it degrades instead of failing.

   Cost control, in order of importance:
     - device pixel ratio capped at 1.5
     - painting stops when the field scrolls out of view
     - painting stops when the tab is hidden
     - one rAF loop for the page, never one per blob
     - static frame, no loop at all, under reduced motion
   ═══════════════════════════════════════════════════════════════ */

type Blob = {
  x: number;
  y: number;
  r: number;
  rgb: string;
  a: number;
  sx: number;
  sy: number;
  phase: number;
};

const BLOBS: Blob[] = [
  { x: 0.2, y: 0.24, r: 0.46, rgb: 'var(--sq-aurora-indigo)', a: 0.17, sx: 0.21, sy: 0.17, phase: 0 },
  { x: 0.8, y: 0.18, r: 0.38, rgb: 'var(--sq-aurora-violet)', a: 0.13, sx: 0.17, sy: 0.23, phase: 2.1 },
  { x: 0.66, y: 0.78, r: 0.48, rgb: 'var(--sq-aurora-teal)', a: 0.1, sx: 0.13, sy: 0.19, phase: 4.2 },
  { x: 0.26, y: 0.84, r: 0.34, rgb: '200, 240, 75', a: 0.05, sx: 0.19, sy: 0.15, phase: 1.2 },
];

function resolve(varRef: string, fallback: string): string {
  if (varRef.startsWith('#') || varRef.startsWith('rgb')) return varRef;
  return fallback;
}

export default function AuroraField() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  /* The wallpaper leans away as you read, so the page feels like it
     has depth rather than a flat backdrop. Motion values only: no
     React render per scroll frame. */
  const { scrollY } = useScroll();
  const drift = useTransform(scrollY, [0, 2400], [1, 1.12]);
  const fade = useTransform(scrollY, [0, 2400], [1, 0.55]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const styles = getComputedStyle(canvas);
    const readVar = (name: string, fallback: string) => {
      const v = styles.getPropertyValue(name).trim();
      return v || fallback;
    };

    const blobs: Blob[] = BLOBS.map((b) => ({ ...b, rgb: resolve(b.rgb, readVar(b.rgb, '99,102,241')) }));

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reduceTransparency = window.matchMedia('(prefers-reduced-transparency: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    let w = 1;
    let h = 1;
    let frame = 0;
    let onScreen = true;

    function measure() {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width * dpr));
      h = Math.max(1, Math.round(rect.height * dpr));
      canvas.width = w;
      canvas.height = h;
    }

    measure();
    window.addEventListener('resize', measure, { passive: true });

    const observer = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((e) => e.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(canvas);

    const started = performance.now();

    function paint(now: number) {
      const t = (now - started) / 1000;
      ctx.fillStyle = readVar('--sq-canvas', '#060607');
      ctx.fillRect(0, 0, w, h);

      const span = Math.max(w, h);
      for (const b of blobs) {
        const bx = (b.x + Math.sin(t * b.sx + b.phase) * 0.06) * w;
        const by = (b.y + Math.cos(t * b.sy + b.phase) * 0.05) * h;
        const radius = b.r * span * (reduceTransparency ? 0.55 : 1);
        const alpha = reduceTransparency ? b.a * 0.35 : b.a;

        const wash = ctx.createRadialGradient(bx, by, 0, bx, by, radius);
        wash.addColorStop(0, `rgba(${b.rgb}, ${alpha.toFixed(3)})`);
        wash.addColorStop(1, `rgba(${b.rgb}, 0)`);
        ctx.fillStyle = wash;
        ctx.fillRect(0, 0, w, h);
      }
    }

    if (reduceMotion) {
      paint(started + 1400);
      return () => {
        observer.disconnect();
        window.removeEventListener('resize', measure);
      };
    }

    function loop(now: number) {
      if (onScreen && !document.hidden) paint(now);
      frame = requestAnimationFrame(loop);
    }
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
      style={reduced ? undefined : { scale: drift, opacity: fade }}
    >
      <canvas ref={ref} className="h-full w-full" />
      <div className="sq-grain absolute inset-0" />
      <div className="sq-vignette absolute inset-0" />
    </motion.div>
  );
}

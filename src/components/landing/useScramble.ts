import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

const POOL = '█▓▒░╚╝╔╗║═<>#/\\';

interface ScrambleOptions {
  /** ms before the first character starts resolving */
  delay?: number;
  /** ms between successive character resolutions */
  step?: number;
}

/**
 * Terminal-style decode: characters flicker through box-drawing glyphs,
 * then resolve left-to-right into the target string. Static under
 * prefers-reduced-motion.
 */
export function useScramble(target: string, { delay = 350, step = 26 }: ScrambleOptions = {}) {
  const reduced = useReducedMotion();
  const [out, setOut] = useState(reduced ? target : '');

  useEffect(() => {
    if (reduced) {
      setOut(target);
      return;
    }
    let raf = 0;
    let start = 0;
    let stopped = false;
    const total = delay + target.length * step + 120;

    const tick = (t: number) => {
      if (stopped) return;
      if (!start) start = t;
      const el = t - start;
      if (el >= total) {
        setOut(target);
        return;
      }
      let changed = false;
      const chars = target.split('').map((c, i) => {
        if (c === ' ') return ' ';
        if (el >= delay + i * step) return c;
        if (el < delay - 220) return ' ';
        changed = true;
        return POOL[(Math.random() * POOL.length) | 0];
      });
      if (changed || el < delay + step) setOut(chars.join(''));
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [target, reduced, delay, step]);

  return out;
}

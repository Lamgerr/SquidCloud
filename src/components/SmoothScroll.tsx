import { useEffect } from "react";
import Lenis from "lenis";
import { useReducedMotion } from "framer-motion";

/**
 * Global smooth-scroll using Lenis. Disabled entirely when the user
 * prefers reduced motion. Lenis adds the `lenis` class to <html>, which the
 * recommended CSS (in index.css) styles for correct behavior.
 */
export function SmoothScroll() {
  const rm = useReducedMotion();

  useEffect(() => {
    if (rm) return;

    const lenis = new Lenis({
      duration: 1.05,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.4,
    });

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [rm]);

  return null;
}

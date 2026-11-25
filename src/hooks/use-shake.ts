/**
 * macOS / Apple-style incorrect-password shake.
 * Keyframes verified against the canonical CSS-Tricks/macOS shake snippet:
 * five damped oscillations with a cubic-bezier(.36,.07,.19,.97) curve.
 * Replays on every error and is a no-op under reduced motion.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export function useShake(duration = 460) {
  const [shaking, setShaking] = useState(false);
  const timer = useRef<number | null>(null);

  const trigger = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    setShaking(false);
    // Force a reflow so the class can be re-applied on consecutive errors.
    window.requestAnimationFrame(() => {
      setShaking(true);
      timer.current = window.setTimeout(() => setShaking(false), duration);
    });
  }, [duration]);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  return { shaking, trigger, shakeClass: shaking ? 'shake-on' : '' };
}

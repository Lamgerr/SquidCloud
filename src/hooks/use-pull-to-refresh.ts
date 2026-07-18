import React, { useState, useRef, useCallback } from 'react';

const THRESHOLD = 80;
const MAX_PULL = 120;
const ENGAGE = 8;

// Walk up from the touch target to find the real scroll container.
// Prefer an explicit [data-scroll-container]; otherwise the nearest
// scrollable ancestor; fall back to window.
function getScroller(start: EventTarget | null): HTMLElement | Window {
  let el = start as HTMLElement | null;
  while (el && el !== document.body && el !== document.documentElement) {
    if (el.hasAttribute && el.hasAttribute('data-scroll-container')) return el;
    const style = getComputedStyle(el);
    const scrollable =
      /auto|scroll|overlay/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
    if (scrollable) return el;
    el = el.parentElement;
  }
  return window;
}

function isAtTop(scroller: HTMLElement | Window): boolean {
  if (scroller === window) return (window.scrollY || 0) <= 0;
  return (scroller as HTMLElement).scrollTop <= 0;
}

export function usePullToRefresh(
  onRefresh: () => void,
  disabled: boolean,
  containerRef?: React.RefObject<HTMLElement | null>
) {
  const startY = useRef(0);
  const pulling = useRef(false);
  const armed = useRef(false);
  const scroller = useRef<HTMLElement | Window>(window);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || refreshing) { armed.current = false; return; }
    // Resolve the actual scroll container (explicit ref, else nearest scrollable ancestor).
    const sc = (containerRef && containerRef.current) || getScroller(e.currentTarget);
    scroller.current = sc;
    // Only arm a pull gesture when the view is already pinned to the very top.
    if (!isAtTop(sc)) { armed.current = false; return; }
    startY.current = e.touches[0].clientY;
    armed.current = true;
    pulling.current = false;
  }, [disabled, refreshing, containerRef]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled || refreshing || !armed.current) return;
    // If the user scrolled away from the top mid-gesture, this is a normal
    // scroll, not a pull — disarm so it never fights vertical scrolling.
    if (!isAtTop(scroller.current)) {
      armed.current = false;
      pulling.current = false;
      setPullDistance(0);
      return;
    }
    const dy = e.touches[0].clientY - startY.current;
    // Only pull when dragging DOWN from the top (a deliberate "hard" pull).
    if (dy > ENGAGE) {
      pulling.current = true;
      setPullDistance(Math.min(dy * 0.4, MAX_PULL));
    } else if (dy < 0) {
      pulling.current = false;
      setPullDistance(0);
    }
  }, [disabled, refreshing]);

  const onTouchEnd = useCallback(() => {
    if (!pulling.current) { armed.current = false; return; }
    pulling.current = false;
    armed.current = false;
    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(0);
      onRefresh();
      setTimeout(() => setRefreshing(false), 1500);
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, onRefresh]);

  return { pullDistance, refreshing, onTouchStart, onTouchMove, onTouchEnd };
}

import React, { useState, useRef, useCallback } from 'react';

const THRESHOLD = 80;
const MAX_PULL = 120;

function isScrolled(el?: HTMLElement | null): boolean {
  if (el) return el.scrollTop > 0;
  return window.scrollY > 0;
}

export function usePullToRefresh(
  onRefresh: () => void,
  disabled: boolean,
  containerRef?: React.RefObject<HTMLElement | null>
) {
  const startY = useRef(0);
  const pulling = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || refreshing) return;
    if (isScrolled(containerRef?.current)) return;
    startY.current = e.touches[0].clientY;
    pulling.current = false;
  }, [disabled, refreshing, containerRef]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 10) {
      pulling.current = true;
      const distance = Math.min(dy * 0.4, MAX_PULL);
      setPullDistance(distance);
    }
  }, [disabled, refreshing]);

  const onTouchEnd = useCallback(() => {
    if (!pulling.current) return;
    pulling.current = false;
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

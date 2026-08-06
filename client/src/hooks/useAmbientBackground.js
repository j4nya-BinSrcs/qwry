import { useCallback, useEffect, useRef, useState } from 'react';

export function useAmbientBackground() {
  const [pointerPosition, setPointerPosition] = useState({ x: 0.5, y: 0.5 });
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.current = mediaQuery.matches;
    const handler = (e) => { prefersReducedMotion.current = e.matches; };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (prefersReducedMotion.current) return;
    setPointerPosition({
      x: e.clientX / window.innerWidth,
      y: e.clientY / window.innerHeight,
    });
  }, []);

  const handleSearchFocus = useCallback(() => setIsSearchFocused(true), []);
  const handleSearchBlur = useCallback(() => setIsSearchFocused(false), []);

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [handlePointerMove]);

  return {
    pointerPosition,
    isSearchFocused,
    reducedMotion: prefersReducedMotion.current,
    onSearchFocus: handleSearchFocus,
    onSearchBlur: handleSearchBlur,
  };
}
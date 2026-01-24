import { useState, useEffect, useRef } from 'react';

/**
 * Returns the current page visibility state.
 * Optionally calls callbacks when visibility changes.
 * Useful for refetching data when tab becomes visible.
 */
export function useVisibilityChange(onVisible?: () => void, onHidden?: () => void): boolean {
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    if (typeof document === 'undefined') return true;
    return document.visibilityState === 'visible';
  });

  const onVisibleRef = useRef(onVisible);
  const onHiddenRef = useRef(onHidden);

  useEffect(() => {
    onVisibleRef.current = onVisible;
    onHiddenRef.current = onHidden;
  }, [onVisible, onHidden]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      setIsVisible(visible);

      if (visible) {
        onVisibleRef.current?.();
      } else {
        onHiddenRef.current?.();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return isVisible;
}

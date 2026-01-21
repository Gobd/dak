import { useEffect, useRef, useCallback } from 'react';
import { parseDuration } from '../types';

/**
 * Hook for periodic refresh of data
 * Calls immediately on mount, then sets up interval
 * Returns a manual refresh function and handles cleanup automatically
 */
export function useRefreshInterval(
  callback: () => void | Promise<void>,
  interval?: string,
  { immediate = true }: { immediate?: boolean } = {}
): () => void {
  const callbackRef = useRef(callback);
  const intervalIdRef = useRef<number | null>(null);
  const hasCalledRef = useRef(false);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Call immediately on mount (using ref to avoid triggering lint rule)
  useEffect(() => {
    if (immediate && !hasCalledRef.current) {
      hasCalledRef.current = true;
      // Defer to next tick to avoid synchronous setState in effect
      queueMicrotask(() => callbackRef.current());
    }
  }, [immediate]);

  // Set up interval
  useEffect(() => {
    const ms = parseDuration(interval);
    if (!ms) return;

    intervalIdRef.current = window.setInterval(() => {
      callbackRef.current();
    }, ms);

    return () => {
      if (intervalIdRef.current !== null) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, [interval]);

  // Manual refresh function
  const refresh = useCallback(() => {
    callbackRef.current();
  }, []);

  return refresh;
}

/**
 * Hook for synced clock updates (updates on second/minute boundaries)
 */
export function useSyncedClock(callback: () => void, showSeconds: boolean): void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    let intervalId: number | null = null;

    const sync = () => {
      const now = new Date();
      const ms = showSeconds
        ? 1000 - now.getMilliseconds()
        : (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

      setTimeout(() => {
        callbackRef.current();
        intervalId = window.setInterval(callbackRef.current, showSeconds ? 1000 : 60000);
      }, ms);
    };

    sync();

    // Re-sync every hour to prevent drift
    const resyncId = setInterval(() => {
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
      sync();
    }, 3600000);

    return () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
      clearInterval(resyncId);
    };
  }, [showSeconds]);
}

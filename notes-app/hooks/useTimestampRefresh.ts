import { useEffect, useState } from 'react';

// Single shared timer for all components - refreshes every 5 minutes
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

let globalTick = 0;
let listeners: Set<() => void> = new Set();
let timerId: ReturnType<typeof setInterval> | null = null;

function startTimer() {
  if (timerId) return;
  timerId = setInterval(() => {
    globalTick++;
    listeners.forEach((listener) => listener());
  }, REFRESH_INTERVAL_MS);
}

function stopTimer() {
  if (timerId && listeners.size === 0) {
    clearInterval(timerId);
    timerId = null;
  }
}

/**
 * Hook that triggers a re-render every 5 minutes.
 * Uses a single shared timer regardless of how many components use it.
 */
export function useTimestampRefresh(): number {
  const [tick, setTick] = useState(globalTick);

  useEffect(() => {
    const listener = () => setTick(globalTick);
    listeners.add(listener);
    startTimer();

    return () => {
      listeners.delete(listener);
      stopTimer();
    };
  }, []);

  return tick;
}

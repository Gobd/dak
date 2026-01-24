import { useState, useCallback } from 'react';

/**
 * Syncs state with sessionStorage.
 * Same API as useLocalStorage but for sessionStorage.
 */
export function useSessionStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  // Get initial value from sessionStorage or use provided initial value
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.sessionStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Persist to sessionStorage whenever value changes
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const valueToStore = value instanceof Function ? value(prev) : value;
        if (typeof window !== 'undefined') {
          try {
            window.sessionStorage.setItem(key, JSON.stringify(valueToStore));
          } catch {
            // Ignore write errors (quota exceeded, etc.)
          }
        }
        return valueToStore;
      });
    },
    [key],
  );

  return [storedValue, setValue];
}

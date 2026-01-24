import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Copy text to clipboard.
 * Returns [copy function, copied state]
 * Copied state resets after 2 seconds.
 */
export function useCopyToClipboard(): [(text: string) => Promise<boolean>, boolean] {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const copy = useCallback(async (text: string): Promise<boolean> => {
    if (!navigator?.clipboard) {
      console.warn('Clipboard API not supported');
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Reset copied state after 2 seconds
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);

      return true;
    } catch (error) {
      console.warn('Failed to copy to clipboard:', error);
      setCopied(false);
      return false;
    }
  }, []);

  return [copy, copied];
}

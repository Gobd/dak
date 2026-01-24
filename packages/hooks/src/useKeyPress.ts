import { useEffect, useRef } from 'react';

interface KeyPressOptions {
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
  alt?: boolean;
}

/**
 * Listens for a specific key press.
 * Supports modifier keys (ctrl, shift, meta, alt).
 */
export function useKeyPress(
  targetKey: string,
  handler: () => void,
  options: KeyPressOptions = {},
): void {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if the key matches
      if (event.key !== targetKey) return;

      // Check modifier keys
      if (options.ctrl && !event.ctrlKey) return;
      if (options.shift && !event.shiftKey) return;
      if (options.meta && !event.metaKey) return;
      if (options.alt && !event.altKey) return;

      // If modifiers are not specified, ensure they're not pressed
      if (!options.ctrl && event.ctrlKey) return;
      if (!options.shift && event.shiftKey) return;
      if (!options.meta && event.metaKey) return;
      if (!options.alt && event.altKey) return;

      event.preventDefault();
      handlerRef.current();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [targetKey, options.ctrl, options.shift, options.meta, options.alt]);
}

import { useState, useCallback } from 'react';

export interface UseToggleReturn {
  value: boolean;
  toggle: () => void;
  setTrue: () => void;
  setFalse: () => void;
  set: (value: boolean) => void;
}

/**
 * Convenient toggle hook.
 * Returns an object with value and control functions.
 * Useful for modals, dropdowns, etc.
 *
 * @example
 * const modal = useToggle(false);
 * modal.value // boolean
 * modal.toggle() // flip value
 * modal.setTrue() // set to true
 * modal.setFalse() // set to false
 * modal.set(someCondition) // dynamic set
 */
export function useToggle(initialValue = false): UseToggleReturn {
  const [value, setValue] = useState(initialValue);

  const toggle = useCallback(() => {
    setValue((prev) => !prev);
  }, []);

  const setTrue = useCallback(() => setValue(true), []);
  const setFalse = useCallback(() => setValue(false), []);

  return { value, toggle, setTrue, setFalse, set: setValue };
}

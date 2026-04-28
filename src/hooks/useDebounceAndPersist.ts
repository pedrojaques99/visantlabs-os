import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Shared debounce+persist pattern used by all brand guideline sections.
 * Handles timeout cleanup, isSaving state, and safe unmount cleanup.
 *
 * Usage:
 *   const { isSaving, persist } = useDebounceAndPersist((value) => onUpdate({ colors: value }));
 *   // call persist(newValue) whenever local state changes
 */
export function useDebounceAndPersist<T>(
  onSave: (value: T) => void,
  delay = 800,
): { isSaving: boolean; persist: (value: T) => void } {
  const [isSaving, setIsSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const persist = useCallback((value: T) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setIsSaving(true);
    debounceRef.current = setTimeout(() => {
      onSaveRef.current(value);
      setIsSaving(false);
    }, delay);
  }, [delay]);

  return { isSaving, persist };
}

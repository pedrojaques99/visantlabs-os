import { useEffect, useRef, type RefObject } from 'react';

export interface UseClickOutsideOptions {
  /** Only attach listeners when true (e.g. while a menu is open). Default true. */
  enabled?: boolean;
  /** Also fire the handler on Escape. Default true. */
  escape?: boolean;
}

/**
 * Fire `handler` when a pointer-down lands outside `ref` (or on Escape).
 * SSoT for the click-outside + Escape pattern that was duplicated across
 * dropdowns/menus/popovers. The handler is read from a ref, so passing an
 * inline `() => setOpen(false)` does not re-subscribe the listeners.
 */
export function useClickOutside<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T | null>,
  handler: () => void,
  options: UseClickOutsideOptions = {}
): void {
  const { enabled = true, escape = true } = options;
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const onPointer = (e: MouseEvent) => {
      const el = ref.current;
      if (el && !el.contains(e.target as Node)) handlerRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (escape && e.key === 'Escape') handlerRef.current();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, enabled, escape]);
}

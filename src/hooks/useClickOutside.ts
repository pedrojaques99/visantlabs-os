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
 *
 * Aceita um ARRAY de refs para o caso de menu em portal, onde o painel não é
 * descendente do gatilho no DOM: só dispara quando o clique cai fora de TODOS.
 * Sem isso, cada dropdown com portal reimplementava a checagem por conta.
 */
export function useClickOutside<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T | null> | Array<RefObject<T | null>>,
  handler: () => void,
  options: UseClickOutsideOptions = {}
): void {
  const { enabled = true, escape = true } = options;
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  // Os refs também vão por ref: um array INLINE (`[a, b]`) é novo a cada render
  // e, como dependência do efeito, re-inscreveria os listeners sem parar.
  const refsRef = useRef<Array<RefObject<T | null>>>([]);
  refsRef.current = Array.isArray(ref) ? ref : [ref];

  useEffect(() => {
    if (!enabled) return;
    const onPointer = (e: MouseEvent) => {
      const refs = refsRef.current;
      const target = e.target as Node;
      const els = refs.map((r) => r.current).filter(Boolean) as T[];
      // Nenhum ref montado ainda → não fecha (senão fecharia no primeiro clique).
      if (els.length === 0) return;
      if (els.every((el) => !el.contains(target))) handlerRef.current();
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
  }, [enabled, escape]);
}

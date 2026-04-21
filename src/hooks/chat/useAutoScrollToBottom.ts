import { useEffect, useRef, type DependencyList, type RefObject } from 'react';

/**
 * Auto-scroll a sentinel element into view whenever `deps` change.
 * Returns a ref to attach to the sentinel (`<div ref={ref} />`).
 *
 * Replaces the `messagesEndRef + useEffect + scrollIntoView` boilerplate
 * duplicated across AdminChat, BrandingExpertChat, and NodeBuilderNode.
 */
export function useAutoScrollToBottom<T extends HTMLElement = HTMLDivElement>(
  deps: DependencyList,
  behavior: ScrollBehavior = 'smooth'
): RefObject<T> {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

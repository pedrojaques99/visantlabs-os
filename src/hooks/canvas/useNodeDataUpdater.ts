import { useCallback } from 'react';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';

type UpdateFn<T> = ((nodeId: string, newData: Partial<T>) => void) | undefined;

/**
 * Shared hook for node data updates.
 * Returns a debounced updater (for text inputs) and an immediate updater (for selects/toggles).
 */
export function useNodeDataUpdater<T extends object>(
  onUpdateData: UpdateFn<T>,
  id: string,
  delay = 500
) {
  const debouncedUpdate = useDebouncedCallback((updates: Partial<T>) => {
    onUpdateData?.(id, updates);
  }, delay);

  const immediateUpdate = useCallback((updates: Partial<T>) => {
    onUpdateData?.(id, updates);
  }, [onUpdateData, id]);

  return { debouncedUpdate, immediateUpdate };
}

import { useEffect, useRef, useCallback, useState } from 'react';
import type { TimerRef } from '../types/types';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutoSaveProps<T> {
  data: T;
  onSave: (data: T) => Promise<void>;
  debounceMs?: number;
  enabled?: boolean;
}

/**
 * Generic hook for auto-saving any serializable data shape with debounce.
 * Saves automatically after changes stop for the specified delay.
 *
 * Returns reactive `status` + `lastSavedAt` for UI indicators, plus
 * `saveImmediately` to bypass the debounce (e.g. on blur or unmount).
 */
export const useAutoSave = <T,>({
  data,
  onSave,
  debounceMs = 2000,
  enabled = true,
}: UseAutoSaveProps<T>) => {
  const timeoutRef = useRef<TimerRef | null>(null);
  const lastSavedDataRef = useRef<string>('');
  const isSavingRef = useRef(false);
  const savePromiseRef = useRef<Promise<void> | null>(null);

  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  // Save function with error handling
  const performSave = useCallback(async (dataToSave: T) => {
    if (isSavingRef.current) {
      if (savePromiseRef.current) {
        await savePromiseRef.current;
      }
      return;
    }

    isSavingRef.current = true;
    setStatus('saving');

    try {
      const savePromise = onSave(dataToSave);
      savePromiseRef.current = savePromise;

      await savePromise;

      lastSavedDataRef.current = JSON.stringify(dataToSave);
      setLastSavedAt(Date.now());
      setStatus('saved');
    } catch (error) {
      console.error('Auto-save failed:', error);
      setStatus('error');
    } finally {
      isSavingRef.current = false;
      savePromiseRef.current = null;
    }
  }, [onSave]);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Auto-save effect
  useEffect(() => {
    if (!enabled) return;

    const currentDataString = JSON.stringify(data);
    if (currentDataString === lastSavedDataRef.current) {
      return; // No changes
    }

    // Mark as pending (idle) unless a save is currently in flight
    if (!isSavingRef.current) setStatus('idle');

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      performSave(data);
    }, debounceMs);

    // Cleanup on unmount or data change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, debounceMs, enabled, performSave]);

  // Save immediately (bypass debounce) - useful for manual saves
  const saveImmediately = useCallback(async () => {
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Check if there are unsaved changes
    const currentDataString = JSON.stringify(data);
    if (currentDataString !== lastSavedDataRef.current) {
      await performSave(data);
    }
  }, [data, performSave]);

  return {
    saveImmediately,
    status,
    lastSavedAt,
    isSaving: status === 'saving',
  };
};











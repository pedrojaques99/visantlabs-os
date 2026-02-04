import { useEffect, useRef, useCallback } from 'react';
import type { BrandingData } from '../types/types';

interface UseAutoSaveProps {
  data: BrandingData;
  onSave: (data: BrandingData) => Promise<void>;
  debounceMs?: number;
  enabled?: boolean;
}

/**
 * Hook for auto-saving branding data with debounce
 * Saves automatically after changes stop for the specified delay
 */
export const useAutoSave = ({
  data,
  onSave,
  debounceMs = 2000, // 2 seconds default
  enabled = true,
}: UseAutoSaveProps) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>('');
  const isSavingRef = useRef(false);
  const savePromiseRef = useRef<Promise<void> | null>(null);

  // Deep comparison helper (simple JSON comparison)
  const dataChanged = useCallback((a: BrandingData, b: BrandingData): boolean => {
    return JSON.stringify(a) !== JSON.stringify(b);
  }, []);

  // Save function with error handling
  const performSave = useCallback(async (dataToSave: BrandingData) => {
    if (isSavingRef.current) {
      // If already saving, wait for it to complete
      if (savePromiseRef.current) {
        await savePromiseRef.current;
      }
      return;
    }

    isSavingRef.current = true;

    try {
      const savePromise = onSave(dataToSave);
      savePromiseRef.current = savePromise;

      await savePromise;

      // Update last saved data
      lastSavedDataRef.current = JSON.stringify(dataToSave);
    } catch (error) {
      console.error('Auto-save failed:', error);
      // Don't update lastSavedDataRef if save failed
      // This allows retry on next change
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

    // Compare with last saved data
    const currentDataString = JSON.stringify(data);
    if (currentDataString === lastSavedDataRef.current) {
      return; // No changes
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
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
    isSaving: isSavingRef.current,
  };
};











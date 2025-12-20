import { useEffect, useRef, useCallback, useState } from 'react';
import type { BudgetData } from '../types';
import { budgetApi, type BudgetProject } from '../services/budgetApi';

interface UseBudgetAutoSaveProps {
  data: BudgetData | null;
  projectId: string | null;
  enabled?: boolean;
  debounceMs?: number;
  onSaveSuccess?: (savedId: string) => void;
  onSaveError?: (error: Error) => void;
}

/**
 * Hook for auto-saving budget data with debounce
 * Saves automatically after changes stop for the specified delay
 */
export const useBudgetAutoSave = ({
  data,
  projectId,
  enabled = true,
  debounceMs = 1500, // 1.5 seconds default
  onSaveSuccess,
  onSaveError,
}: UseBudgetAutoSaveProps) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const savePromiseRef = useRef<Promise<BudgetProject> | null>(null);
  const saveStatusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);

  // Deep comparison helper (simple JSON comparison)
  const dataChanged = useCallback((a: BudgetData, b: BudgetData): boolean => {
    return JSON.stringify(a) !== JSON.stringify(b);
  }, []);

  // Save function with error handling
  const performSave = useCallback(async (dataToSave: BudgetData) => {
    if (!projectId) {
      // If no project ID, we can't save yet
      return;
    }

    if (isSavingRef.current) {
      // If already saving, wait for it to complete
      if (savePromiseRef.current) {
        await savePromiseRef.current;
      }
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    setSaveStatus('saving');
    
    try {
      const savePromise = budgetApi.save(dataToSave, projectId);
      savePromiseRef.current = savePromise;
      
      const saved = await savePromise;
      const id = saved._id || (saved as any).id;
      
      // Update last saved data
      lastSavedDataRef.current = JSON.stringify(dataToSave);
      
      setSaveStatus('saved');
      
      // Clear saved status after 2 seconds
      if (saveStatusTimeoutRef.current) {
        clearTimeout(saveStatusTimeoutRef.current);
      }
      saveStatusTimeoutRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
      
      if (onSaveSuccess) {
        onSaveSuccess(id);
      }
    } catch (error: any) {
      console.error('Auto-save failed:', error);
      setSaveStatus('error');
      
      // Clear error status after 3 seconds
      if (saveStatusTimeoutRef.current) {
        clearTimeout(saveStatusTimeoutRef.current);
      }
      saveStatusTimeoutRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
      
      if (onSaveError) {
        onSaveError(error);
      }
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
      savePromiseRef.current = null;
    }
  }, [projectId, onSaveSuccess, onSaveError]);

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (saveStatusTimeoutRef.current) {
        clearTimeout(saveStatusTimeoutRef.current);
      }
    };
  }, []);

  // Auto-save effect
  useEffect(() => {
    if (!enabled || !data || !projectId) return;

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
  }, [data, debounceMs, enabled, projectId, performSave]);

  // Save immediately (bypass debounce) - useful for manual saves
  const saveImmediately = useCallback(async () => {
    if (!data || !projectId) return;

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
  }, [data, projectId, performSave]);

  return {
    saveImmediately,
    isSaving,
    saveStatus,
  };
};


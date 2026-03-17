import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useMockup } from '@/components/mockupmachine/MockupContext';
import { aiApi } from '@/services/aiApi';

interface UseDynamicSuggestionsOptions {
  /** Enable/disable the hook (default: true) */
  enabled?: boolean;
  /** Debounce delay in ms (default: 1000) */
  debounceMs?: number;
  /** Minimum total tags selected before triggering (default: 1) */
  minTags?: number;
  /** Image description for context (from initial analysis) */
  imageDescription?: string;
}

/**
 * Hook that dynamically updates tag suggestions when user selects tags.
 *
 * Features:
 * - Debounces API calls (user must stop selecting for debounceMs)
 * - Only triggers after minTags are selected
 * - Skips if analysis is in progress
 * - Handles stale responses (ignores outdated results)
 * - Silent error handling (keeps existing suggestions on failure)
 *
 * @example
 * const { isRefining, lastChangedCategory } = useDynamicSuggestions({
 *   enabled: hasAnalyzed && !isAnalyzing,
 *   debounceMs: 1000,
 *   minTags: 1,
 *   imageDescription: cachedDescription,
 * });
 */
export const useDynamicSuggestions = (options: UseDynamicSuggestionsOptions = {}) => {
  const {
    enabled = true,
    debounceMs = 1000,
    minTags = 1,
    imageDescription,
  } = options;

  const {
    selectedTags,
    selectedLocationTags,
    selectedAngleTags,
    selectedLightingTags,
    selectedEffectTags,
    selectedMaterialTags,
    isAnalyzing,
    isSurpriseMeMode,
    surpriseMePool,
    // Setters for suggestions
    setSuggestedTags,
    setSuggestedLocationTags,
    setSuggestedAngleTags,
    setSuggestedLightingTags,
    setSuggestedEffectTags,
    setSuggestedMaterialTags,
  } = useMockup();

  // Track which category changed last
  const lastChangedCategoryRef = useRef<string | null>(null);
  const previousTagsRef = useRef<Record<string, string[]>>({});
  const debounceTimerRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const isRefiningRef = useRef(false);

  // Build current tags object based on mode
  const currentTags = useMemo(() => {
    if (isSurpriseMeMode) {
      return {
        categories: surpriseMePool.selectedCategoryTags || [],
        location: surpriseMePool.selectedLocationTags || [],
        angle: surpriseMePool.selectedAngleTags || [],
        lighting: surpriseMePool.selectedLightingTags || [],
        effects: surpriseMePool.selectedEffectTags || [],
        material: surpriseMePool.selectedMaterialTags || [],
      };
    }
    return {
      categories: selectedTags,
      location: selectedLocationTags,
      angle: selectedAngleTags,
      lighting: selectedLightingTags,
      effects: selectedEffectTags,
      material: selectedMaterialTags,
    };
  }, [
    isSurpriseMeMode,
    surpriseMePool,
    selectedTags,
    selectedLocationTags,
    selectedAngleTags,
    selectedLightingTags,
    selectedEffectTags,
    selectedMaterialTags,
  ]);

  // Detect which category changed
  const detectChangedCategory = useCallback((
    current: Record<string, string[]>,
    previous: Record<string, string[]>
  ): string | null => {
    const categories = ['categories', 'location', 'angle', 'lighting', 'effects', 'material'];
    for (const cat of categories) {
      const currentArr = current[cat] || [];
      const prevArr = previous[cat] || [];
      if (currentArr.length !== prevArr.length ||
          currentArr.some((tag, i) => tag !== prevArr[i])) {
        return cat;
      }
    }
    return null;
  }, []);

  // Calculate total selected tags
  const totalSelectedTags = useMemo(() => {
    return Object.values(currentTags).reduce((sum, arr) => sum + arr.length, 0);
  }, [currentTags]);

  // Main effect: detect changes and trigger refinement
  useEffect(() => {
    if (!enabled || isAnalyzing) {
      return;
    }

    const changedCategory = detectChangedCategory(currentTags, previousTagsRef.current);
    previousTagsRef.current = { ...currentTags };

    if (!changedCategory) {
      return; // No change detected
    }

    lastChangedCategoryRef.current = changedCategory;

    // Check minimum tags threshold
    if (totalSelectedTags < minTags) {
      return;
    }

    // Clear existing timer
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new debounced call
    debounceTimerRef.current = window.setTimeout(async () => {
      // Skip if another analysis started
      if (isAnalyzing) {
        return;
      }

      const currentRequestId = ++requestIdRef.current;
      isRefiningRef.current = true;

      try {
        const result = await aiApi.refineSuggestions({
          imageDescription,
          selectedTags: currentTags,
          changedCategory,
        });

        // Check if this response is still relevant
        if (currentRequestId !== requestIdRef.current) {
          return; // Stale response, ignore
        }

        // Update suggestions for categories that weren't changed
        if (changedCategory !== 'categories' && result.categories?.length) {
          setSuggestedTags(prev => {
            // Merge new suggestions with existing, avoiding duplicates
            const combined = [...new Set([...result.categories!, ...prev])];
            return combined.slice(0, 5);
          });
        }
        if (changedCategory !== 'location' && result.locations?.length) {
          setSuggestedLocationTags(prev => {
            const combined = [...new Set([...result.locations!, ...prev])];
            return combined.slice(0, 5);
          });
        }
        if (changedCategory !== 'angle' && result.angles?.length) {
          setSuggestedAngleTags(prev => {
            const combined = [...new Set([...result.angles!, ...prev])];
            return combined.slice(0, 5);
          });
        }
        if (changedCategory !== 'lighting' && result.lighting?.length) {
          setSuggestedLightingTags(prev => {
            const combined = [...new Set([...result.lighting!, ...prev])];
            return combined.slice(0, 5);
          });
        }
        if (changedCategory !== 'effects' && result.effects?.length) {
          setSuggestedEffectTags(prev => {
            const combined = [...new Set([...result.effects!, ...prev])];
            return combined.slice(0, 5);
          });
        }
        if (changedCategory !== 'material' && result.materials?.length) {
          setSuggestedMaterialTags(prev => {
            const combined = [...new Set([...result.materials!, ...prev])];
            return combined.slice(0, 5);
          });
        }
      } catch (error) {
        // Silent fail - keep existing suggestions
        if (import.meta.env.DEV) {
          console.warn('[useDynamicSuggestions] Error refining suggestions:', error);
        }
      } finally {
        if (currentRequestId === requestIdRef.current) {
          isRefiningRef.current = false;
        }
      }
    }, debounceMs);

    // Cleanup on unmount or re-run
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    enabled,
    isAnalyzing,
    currentTags,
    totalSelectedTags,
    minTags,
    debounceMs,
    imageDescription,
    detectChangedCategory,
    setSuggestedTags,
    setSuggestedLocationTags,
    setSuggestedAngleTags,
    setSuggestedLightingTags,
    setSuggestedEffectTags,
    setSuggestedMaterialTags,
  ]);

  return {
    isRefining: isRefiningRef.current,
    lastChangedCategory: lastChangedCategoryRef.current,
  };
};

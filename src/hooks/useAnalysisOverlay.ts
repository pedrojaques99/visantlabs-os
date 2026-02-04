import { useCallback, useRef } from 'react';
import { useMockup } from '@/components/mockupmachine/MockupContext';

/**
 * Hook that centralizes control of the analysis overlay
 * Manages visibility and temporary display timers
 * 
 * @returns Object with:
 *   - showOverlay(): void - Show overlay immediately
 *   - hideOverlay(): void - Hide overlay immediately
 *   - showTemporaryOverlay(durationMs): void - Show overlay for specified duration
 * 
 * @example
 * const { showOverlay, hideOverlay, showTemporaryOverlay } = useAnalysisOverlay();
 * 
 * // Show during analysis
 * showOverlay();
 * await analyzeImage();
 * hideOverlay();
 * 
 * // Or show temporarily
 * showTemporaryOverlay(1000); // Show for 1 second
 */
export const useAnalysisOverlay = () => {
  const { setIsAnalysisOverlayVisible } = useMockup();
  const timeoutRef = useRef<number | null>(null);

  /**
   * Show overlay immediately
   */
  const showOverlay = useCallback(() => {
    // Clear any existing timeout
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsAnalysisOverlayVisible(true);
  }, [setIsAnalysisOverlayVisible]);

  /**
   * Hide overlay immediately
   */
  const hideOverlay = useCallback(() => {
    // Clear any existing timeout
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsAnalysisOverlayVisible(false);
  }, [setIsAnalysisOverlayVisible]);

  /**
   * Show overlay for a specified duration, then hide automatically
   * @param durationMs - Duration in milliseconds to show the overlay
   */
  const showTemporaryOverlay = useCallback((durationMs: number) => {
    // Clear any existing timeout
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Show overlay
    setIsAnalysisOverlayVisible(true);

    // Hide after duration
    timeoutRef.current = window.setTimeout(() => {
      setIsAnalysisOverlayVisible(false);
      timeoutRef.current = null;
    }, durationMs);
  }, [setIsAnalysisOverlayVisible]);

  return {
    showOverlay,
    hideOverlay,
    showTemporaryOverlay,
  };
};

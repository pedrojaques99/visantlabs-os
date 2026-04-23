import { useCallback } from 'react';
import { usePluginStore } from '../store';
import { hydrateBrandGuideline, getGuidelineLabel } from '../lib/brandHydration';

/**
 * Apply a full BrandGuideline to the store: colors → Map, logos → slots,
 * typography → slots, tokens → designTokens, plus linkedGuideline id.
 *
 *   const { apply, clear } = useBrandGuidelineLoader();
 *   apply(guideline);
 */
export function useBrandGuidelineLoader() {
  const showToast = usePluginStore((s) => s.showToast);

  const apply = useCallback(
    (guideline: any, opts?: { silent?: boolean }) => {
      if (!guideline) return;
      const slice = hydrateBrandGuideline(guideline);
      const prev = usePluginStore.getState().brandHydrationTick || 0;
      usePluginStore.setState({
        ...(slice as any),
        brandHydrationTick: prev + 1,
        brandHydrationAtMs: Date.now()
      });
      if (!opts?.silent) {
        showToast(`Loaded: ${getGuidelineLabel(guideline)}`, 'success');
      }
    },
    [showToast]
  );

  const clear = useCallback(() => {
    usePluginStore.setState({
      brandGuideline: null,
      linkedGuideline: null,
      selectedColors: new Map(),
      logos: [
        { name: 'light', src: undefined, loaded: false },
        { name: 'dark', src: undefined, loaded: false },
        { name: 'accent', src: undefined, loaded: false }
      ],
      typography: [
        { name: 'primary', fontFamily: undefined },
        { name: 'secondary', fontFamily: undefined }
      ],
      designTokens: {}
    } as any);
  }, []);

  return { apply, clear };
}

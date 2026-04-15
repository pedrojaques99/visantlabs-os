import { useEffect, useRef } from 'react';
import { usePluginStore } from '../store';
import { useBrandSync } from './useBrandSync';
import { dehydrateBrand } from '../lib/brandDehydration';

const DEBOUNCE_MS = 800;
/** Ignore subscriber fires within N ms after a hydration to avoid echo writes. */
const HYDRATION_WINDOW_MS = 400;

/**
 * Keeps Prisma in sync with local edits. Watches colors/logos/typography/tokens
 * and PUTs a debounced patch when the user edits (never when the loader hydrates).
 *
 * Mount once at the root — e.g. inside <BrandTab />.
 */
export function useBrandAutoSync() {
  const { updateBrandGuideline } = useBrandSync();
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHydrationAt = useRef<number>(usePluginStore.getState().brandHydrationTick || 0);

  useEffect(() => {
    const schedule = (id: string) => {
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      pendingTimer.current = setTimeout(async () => {
        const s = usePluginStore.getState();
        const patch = dehydrateBrand({
          selectedColors: s.selectedColors,
          logos: s.logos,
          typography: s.typography,
          designTokens: s.designTokens
        });
        if (Object.keys(patch).length === 0) return;
        await updateBrandGuideline(id, patch as any);
      }, DEBOUNCE_MS);
    };

    const unsub = usePluginStore.subscribe((state, prev) => {
      const id = state.linkedGuideline;
      if (!id) return;

      // Hydration echo guard: loader bumps brandHydrationTick right before
      // setState(slice). Any subscriber fire within the window is ignored.
      const tick = (state as any).brandHydrationTick ?? 0;
      if (tick !== lastHydrationAt.current) {
        lastHydrationAt.current = tick;
        return;
      }
      const tickAge = Date.now() - ((state as any).brandHydrationAtMs ?? 0);
      if (tickAge < HYDRATION_WINDOW_MS) return;

      const changed =
        state.selectedColors !== prev.selectedColors ||
        state.logos !== prev.logos ||
        state.typography !== prev.typography ||
        state.designTokens !== prev.designTokens;

      if (changed) schedule(id);
    });

    return () => {
      unsub();
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
    };
  }, [updateBrandGuideline]);
}

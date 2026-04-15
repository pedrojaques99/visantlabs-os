import { useCallback, useState } from 'react';
import { usePluginStore } from '../store';
import { useFigmaMessages } from './useFigmaMessages';
import {
  detectColorRoles,
  detectTypographyRoles,
  detectLogoSlots,
  mergeImportIntoBrand,
  type LogoCandidate,
  type MergeOptions
} from '../lib/brandImportHeuristics';

/**
 * Smart import: pulls colors, fonts, and logo components already extracted
 * from the current Figma file → maps to brand slots via naming heuristics.
 *
 * Flow:
 *  1. Reads cached variables from store (populated by CONTEXT_UPDATED).
 *  2. Asks sandbox to export logo component thumbnails.
 *  3. Applies heuristic detection (color roles, typography pairs, logo variants).
 *  4. Merges into existing brand state (non-destructive by default).
 *
 * Returns `run(options)` — `overwrite: true` replaces existing values.
 */
export function useBrandImport() {
  const { send } = useFigmaMessages();
  const [isImporting, setIsImporting] = useState(false);

  const run = useCallback(
    async (options: MergeOptions = {}) => {
      setIsImporting(true);
      const store = usePluginStore.getState();
      const tokens: any = store.designTokens || {};

      // 1. Request logo candidates from sandbox (wait for response)
      const candidates = await new Promise<LogoCandidate[]>((resolve) => {
        const timeout = setTimeout(() => {
          window.removeEventListener('message', handler);
          resolve([]);
        }, 15000);
        function handler(event: MessageEvent) {
          const msg = event.data?.pluginMessage;
          if (msg?.type === 'LOGO_CANDIDATES_LOADED') {
            clearTimeout(timeout);
            window.removeEventListener('message', handler);
            resolve(Array.isArray(msg.candidates) ? msg.candidates : []);
          }
        }
        window.addEventListener('message', handler);
        send({ type: 'IMPORT_LOGO_CANDIDATES', maxWidth: 512 } as any);
      });

      // 2. Run heuristics on cached data
      const colors = detectColorRoles(Array.isArray(tokens.colors) ? tokens.colors : []);
      const typography = detectTypographyRoles(Array.isArray(tokens.fonts) ? tokens.fonts : []);
      const logos = detectLogoSlots(candidates);

      // 3. Merge with existing, preserving user edits unless overwrite
      const merged = mergeImportIntoBrand(
        { colors, typography, logos },
        { selectedColors: store.selectedColors, typography: store.typography, logos: store.logos },
        options
      );

      // 4. Commit. Auto-sync will PUT to Prisma via useBrandAutoSync.
      usePluginStore.setState({
        selectedColors: merged.colors,
        typography: merged.typography,
        logos: merged.logos
      });

      const hits = merged.colors.size + merged.typography.filter((t) => t.fontFamily).length + merged.logos.filter((l) => l.src).length;
      store.showToast(
        hits > 0 ? `Imported ${merged.colors.size} colors, ${merged.logos.filter((l) => l.src).length} logos, ${merged.typography.filter((t) => t.fontFamily).length} fonts` : 'Nothing matched — check naming (e.g. "primary", "logo/dark")',
        hits > 0 ? 'success' : 'warning'
      );

      setIsImporting(false);
      return { hits, merged };
    },
    [send]
  );

  return { run, isImporting };
}

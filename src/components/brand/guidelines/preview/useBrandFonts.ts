import { useEffect } from 'react';

/**
 * Dynamic Google-Fonts loading for the preview. `useBrandFonts` loads the brand's own
 * heading/body families; `useGoogleFonts` loads ANY families a synced template references
 * (Red Hat Mono, Almarai, Geist…) so imported Figma frames render in their real type, not
 * a system fallback. Both accumulate into ONE shared <link> (deduped, incremental).
 */

const FONT_LINK_ID = 'preview-google-fonts';
const loaded = new Set<string>();

// Generic / system families that don't need (and would break) a Google Fonts request.
const SYSTEM = new Set([
  'inter',
  'sans-serif',
  'serif',
  'monospace',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'system-ui',
  'system',
  'arial',
  'helvetica',
  'times new roman',
  'georgia',
  'courier',
  'courier new',
]);

/** Extract the primary family name from a CSS font stack (`'Unbounded', ...` → Unbounded). */
function familyFromStack(stack?: string): string | undefined {
  if (!stack) return undefined;
  const m = stack.match(/^\s*['"]?([^'",]+)['"]?/);
  return m?.[1]?.trim();
}

/** Merge families into the shared Google-Fonts <link> (idempotent, additive). */
export function loadGoogleFonts(families: Array<string | undefined>): void {
  if (typeof document === 'undefined') return;
  let changed = false;
  for (const raw of families) {
    const f = raw?.trim();
    if (!f || SYSTEM.has(f.toLowerCase())) continue;
    if (!loaded.has(f)) {
      loaded.add(f);
      changed = true;
    }
  }
  if (!loaded.size) return;
  if (!changed && document.getElementById(FONT_LINK_ID)) return;

  const href = `https://fonts.googleapis.com/css2?${[...loaded]
    .map((f) => `family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700`)
    .join('&')}&display=swap`;

  let link = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null;
  if (link) {
    if (link.href !== href) link.href = href;
  } else {
    link = document.createElement('link');
    link.id = FONT_LINK_ID;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
}

/** Load arbitrary font families (e.g. the ones a synced template uses). */
export function useGoogleFonts(families: string[]): void {
  const key = families.join('|');
  useEffect(() => {
    loadGoogleFonts(families);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** Load the brand's heading/body web fonts so previews render in-brand, not a fallback. */
export function useBrandFonts(headingFamily?: string, bodyFamily?: string): void {
  const heading = familyFromStack(headingFamily);
  const body = familyFromStack(bodyFamily);
  useEffect(() => {
    loadGoogleFonts([heading, body]);
  }, [heading, body]);
}

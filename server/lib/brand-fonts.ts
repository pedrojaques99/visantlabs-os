/**
 * Brand fonts for headless (Puppeteer) preset rendering.
 *
 * The render container only has the fonts it can reach, so brand fonts must be
 * embedded as @font-face. Resolution order, most robust first:
 *   1. a brand-uploaded WOFF2 on R2  (no external egress — the container already
 *      talks to R2; most reliable in prod)
 *   2. @fontsource via jsDelivr CDN  (covers Google Fonts + Geist, 1500+ families)
 *   3. Google Fonts CSS API          (simple fallback for Google-hosted families)
 *
 * Pure string builders → unit-testable; the renderer injects the result and waits
 * on `document.fonts.ready` before screotting.
 */

export interface BrandFontSpec {
  family: string;
  weights?: number[];
  /** Brand-uploaded WOFF2 (R2) — preferred when present. */
  woff2Url?: string;
}

/** family → @fontsource package slug (handles the few that aren't a plain slug). */
const FONTSOURCE_SLUG: Record<string, string> = {
  geist: 'geist-sans',
  'geist mono': 'geist-mono',
};

/** family → the font-family name @fontsource actually DECLARES (often differs). */
const FONTSOURCE_FAMILY: Record<string, string> = {
  geist: 'Geist Sans',
  'geist mono': 'Geist Mono',
};

export function fontSlug(family: string): string {
  const key = family.trim().toLowerCase();
  if (FONTSOURCE_SLUG[key]) return FONTSOURCE_SLUG[key];
  return key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** The font-family name to USE in CSS. With an uploaded WOFF2 we declare the brand
 * name ourselves; via @fontsource we must use the name that package declares. */
export function usableFamily(family: string, hasWoff2: boolean): string {
  if (hasWoff2) return family;
  return FONTSOURCE_FAMILY[family.trim().toLowerCase()] || family;
}

const DEFAULT_WEIGHTS = [400, 500, 700];

/** A Google Fonts CSS2 `<link href>` for the given families (Google-hosted only). */
export function googleFontsHref(fonts: BrandFontSpec[]): string {
  const fam = fonts
    .filter((f) => !f.woff2Url)
    .map((f) => {
      const w = (f.weights?.length ? f.weights : DEFAULT_WEIGHTS).join(';');
      return `family=${encodeURIComponent(f.family).replace(/%20/g, '+')}:wght@${w}`;
    })
    .join('&');
  return `https://fonts.googleapis.com/css2?${fam}&display=swap`;
}

/**
 * The CSS to embed in the render HTML so the brand fonts load. Uploaded WOFF2 →
 * inline @font-face (R2); everything else → @import from @fontsource (jsDelivr).
 * Returns `{ css, families }` — `families` is the CSS font-family stack to apply.
 */
export function buildFontCss(fonts: BrandFontSpec[]): { css: string; families: string[] } {
  const parts: string[] = [];
  const families: string[] = [];

  for (const f of fonts) {
    families.push(usableFamily(f.family, !!f.woff2Url));
    if (f.woff2Url) {
      for (const w of f.weights?.length ? f.weights : DEFAULT_WEIGHTS) {
        parts.push(
          `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${w};` +
            `font-display:swap;src:url('${f.woff2Url}') format('woff2');}`
        );
      }
    } else {
      const slug = fontSlug(f.family);
      const ws = f.weights?.length ? f.weights : DEFAULT_WEIGHTS;
      for (const w of ws) {
        parts.push(`@import url('https://cdn.jsdelivr.net/npm/@fontsource/${slug}/${w}.css');`);
      }
    }
  }
  // @import must precede other rules — keep imports first.
  parts.sort((a, b) =>
    a.startsWith('@import') === b.startsWith('@import') ? 0 : a.startsWith('@import') ? -1 : 1
  );
  return { css: parts.join('\n'), families: [...new Set(families)] };
}

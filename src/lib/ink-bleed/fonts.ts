/**
 * Google Fonts for the tool. Two jobs that look alike and are not:
 * - `ensureFont` makes a family available to the page, for the live preview.
 * - `embedFontCss` returns a self-contained `@font-face`, because an SVG drawn
 *   through an <img> (PNG and video export) or opened as a file cannot see page fonts.
 */

const CSS_ENDPOINT = 'https://fonts.googleapis.com/css2';

function cssUrls(family: string, weight: number, text?: string): string[] {
  const name = encodeURIComponent(family.trim()).replace(/%20/g, '+');
  const subset = text ? `&text=${encodeURIComponent(text)}` : '';
  // The API answers 400 for a weight the family does not ship, so fall back to its default.
  return [
    `${CSS_ENDPOINT}?family=${name}:wght@${weight}${subset}&display=swap`,
    `${CSS_ENDPOINT}?family=${name}${subset}&display=swap`,
  ];
}

async function fetchFontCss(family: string, weight: number, text?: string): Promise<string | null> {
  for (const url of cssUrls(family, weight, text)) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
    } catch {
      // Offline or blocked: try the next URL, then report failure to the caller.
    }
  }
  return null;
}

const pagesFonts = new Map<string, Promise<boolean>>();

/** Resolves false when Google Fonts has no such family, so the UI can say so. */
export function ensureFont(family: string, weight = 400): Promise<boolean> {
  const key = `${family}:${weight}`;
  const cached = pagesFonts.get(key);
  if (cached) return cached;

  const task = (async () => {
    const css = await fetchFontCss(family, weight);
    if (!css) return false;
    const style = document.createElement('style');
    style.dataset.inkBleedFont = key;
    style.textContent = css;
    document.head.appendChild(style);
    await document.fonts.load(`${weight} 40px "${family}"`).catch(() => undefined);
    return true;
  })();

  pagesFonts.set(key, task);
  // A failed lookup must not stick: the next attempt may be online.
  task.then((ok) => {
    if (!ok) pagesFonts.delete(key);
  });
  return task;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

const embedded = new Map<string, string>();

/** Only the glyphs in `text` are embedded, so the SVG stays small. */
export async function embedFontCss(family: string, weight: number, text: string): Promise<string> {
  const glyphs = [...new Set(text.replace(/\s/g, ''))].sort().join('');
  if (!glyphs) return '';

  const key = `${family}:${weight}:${glyphs}`;
  const cached = embedded.get(key);
  if (cached) return cached;

  const css = await fetchFontCss(family, weight, glyphs);
  const url = css?.match(/url\((https:[^)]+)\)/)?.[1];
  if (!url) throw new Error(`Font not available: ${family}`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font not available: ${family}`);
  const data = await blobToDataUrl(await res.blob());

  const face = `@font-face{font-family:'${family.replace(/'/g, "\\'")}';font-weight:${weight};font-style:normal;src:url(${data}) format('woff2');}`;
  embedded.set(key, face);
  return face;
}

/** Widest line at `fontSize`, with no letter spacing. */
export function measureLines(
  lines: string[],
  family: string,
  weight: number,
  fontSize: number
): number {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return 0;
  ctx.font = `${weight} ${fontSize}px "${family}"`;
  return Math.max(0, ...lines.map((line) => ctx.measureText(line).width));
}

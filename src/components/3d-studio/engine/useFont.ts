import { useState, useEffect } from 'react';
import * as opentype from 'opentype.js';
import { toast } from 'sonner';

const FONTS = [
  // Original 10
  {
    name: 'DM Sans',
    url: 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwARZthTg.ttf',
  },
  {
    name: 'Bebas Neue',
    url: 'https://fonts.gstatic.com/s/bebasneue/v16/JTUSjIg69CK48gW7PXooxW4.ttf',
  },
  {
    name: 'Playfair Display',
    url: 'https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKfsukDQ.ttf',
  },
  {
    name: 'Righteous',
    url: 'https://fonts.gstatic.com/s/righteous/v18/1cXxaUPXBpj2rGoU7C9mjw.ttf',
  },
  {
    name: 'Black Ops One',
    url: 'https://fonts.gstatic.com/s/blackopsone/v21/qWcsB6-ypo7xBdr6Xshe96H3WDw.ttf',
  },
  {
    name: 'Permanent Marker',
    url: 'https://fonts.gstatic.com/s/permanentmarker/v16/Fh4uPib9Iyv2ucM6pGQMWimMp004Hao.ttf',
  },
  {
    name: 'Rubik Mono One',
    url: 'https://fonts.gstatic.com/s/rubikmonoone/v20/UqyJK8kPP3hjw6ANTdfRk9YSN-8w.ttf',
  },
  { name: 'Pacifico', url: 'https://fonts.gstatic.com/s/pacifico/v23/FwZY7-Qmy14u9lezJ96A.ttf' },
  {
    name: 'Oswald',
    url: 'https://fonts.gstatic.com/s/oswald/v57/TK3_WkUHHAIjg75cFRf3bXL8LICs1xZogUE.ttf',
  },
  {
    name: 'Archivo Black',
    url: 'https://fonts.gstatic.com/s/archivoblack/v23/HTxqL289NzCGg4MzN6KJ7eW6OYs.ttf',
  },
  // Expanded — display/headline fonts
  {
    name: 'Montserrat',
    url: 'https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXo.ttf',
  },
  { name: 'Poppins', url: 'https://fonts.gstatic.com/s/poppins/v22/pxiEyp8kv8JHgFVrJJfecg.ttf' },
  {
    name: 'Raleway',
    url: 'https://fonts.gstatic.com/s/raleway/v34/1Ptxg8zYS_SKggPN4iEgvnHyvveLxVvaorCIPrE.ttf',
  },
  {
    name: 'Abril Fatface',
    url: 'https://fonts.gstatic.com/s/abrilfatface/v23/zOL64pLDlL1D99S8HAFadkCFTtpvow.ttf',
  },
  { name: 'Bangers', url: 'https://fonts.gstatic.com/s/bangers/v24/FeVQS0BTqb0h60ACH5lg.ttf' },
  { name: 'Lobster', url: 'https://fonts.gstatic.com/s/lobster/v30/neILzCirqoswsqX9_oWsMw.ttf' },
  { name: 'Anton', url: 'https://fonts.gstatic.com/s/anton/v25/1Ptgg87GJOYhpA3kLkBA.ttf' },
  {
    name: 'Alfa Slab One',
    url: 'https://fonts.gstatic.com/s/alfaslabone/v20/6NUQ8FmMKwSEKjnm5-4v-4Jh6dVr.ttf',
  },
  {
    name: 'Fredoka One',
    url: 'https://fonts.gstatic.com/s/fredokaone/v14/k3kUo8kEI-tA1RRcTZGmTmHBA6aF8Bf_.ttf',
  },
  {
    name: 'Press Start 2P',
    url: 'https://fonts.gstatic.com/s/pressstart2p/v15/e3t4euO8T-267oIAQAu6jDQyK0nSgPJE4580w_o.ttf',
  },
  {
    name: 'Russo One',
    url: 'https://fonts.gstatic.com/s/russoone/v17/Z9XUDmZRWg6M1LvRYsHOz8mJ.ttf',
  },
  { name: 'Bungee', url: 'https://fonts.gstatic.com/s/bungee/v14/N0bU2SZBIuF2PU_ECn50Kd_PmA.ttf' },
  {
    name: 'Protest Riot',
    url: 'https://fonts.gstatic.com/s/protestriot/v7/d6lPkaOxWMKm7QjPHOC47SQ4VXakAw.ttf',
  },
  {
    name: 'Silkscreen',
    url: 'https://fonts.gstatic.com/s/silkscreen/v4/m8JXjfVPf62XiF7kO-i9ULRvamODxdI.ttf',
  },
  { name: 'Monoton', url: 'https://fonts.gstatic.com/s/monoton/v19/5h1aiZUrOngCibe4TkHLRA.ttf' },
  {
    name: 'Orbitron',
    url: 'https://fonts.gstatic.com/s/orbitron/v31/yMJMMIlzdpvBhQQL_SC3X9yhF25-T1nyGy6xpmIyXjU1pg.ttf',
  },
  {
    name: 'Cinzel',
    url: 'https://fonts.gstatic.com/s/cinzel/v23/8vIU7ww63mVu7gtR-kwKxNvkNOjw-tbnTYrvDE5ZdqU.ttf',
  },
  {
    name: 'Syne',
    url: 'https://fonts.gstatic.com/s/syne/v22/8vIS7w4qzmVxsWxjBZRjr0FKM_04uT6kR47NCV5Z.ttf',
  },
  {
    name: 'Space Grotesk',
    url: 'https://fonts.gstatic.com/s/spacegrotesk/v16/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj7oUXskPMBBSSJLm2E.ttf',
  },
  {
    name: 'Unbounded',
    url: 'https://fonts.gstatic.com/s/unbounded/v7/Yq6F-LOTXCb04q32xlpat-6uR42XTqtG65jEsY7UbceRhIAakJt7lQ.ttf',
  },
];

const DEFAULT_FONT = 'DM Sans';
const fontCache = new Map<string, opentype.Font>();

async function loadFontByName(name: string, url: string): Promise<opentype.Font> {
  if (fontCache.has(name)) return fontCache.get(name)!;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    const buffer = await response.arrayBuffer();
    const origWarn = console.warn;
    console.warn = (...args: any[]) => {
      const msg = String(args[0]);
      if (
        msg.includes('substitutionType') ||
        msg.includes('substFormat') ||
        msg.includes('lookupType')
      )
        return;
      origWarn.apply(console, args);
    };
    let font: opentype.Font;
    try {
      font = opentype.parse(buffer, { lowMemory: true });
    } finally {
      console.warn = origWarn;
    }
    fontCache.set(name, font);
    return font;
  } catch (err) {
    clearTimeout(timeoutId);
    if (controller.signal.aborted) {
      throw new Error('timeout');
    }
    throw err;
  }
}

export function useFont(fontName: string): opentype.Font | null {
  const [loadedFont, setLoadedFont] = useState<opentype.Font | null>(() => {
    return fontCache.get(fontName) ?? null;
  });

  useEffect(() => {
    if (!fontName) return;
    const fontDef = FONTS.find((f) => f.name === fontName);
    if (!fontDef) return;
    if (fontCache.has(fontName)) {
      setLoadedFont(fontCache.get(fontName)!);
      return;
    }
    let cancelled = false;
    loadFontByName(fontDef.name, fontDef.url)
      .then((font) => {
        if (!cancelled) setLoadedFont(font);
      })
      .catch((err) => {
        if (cancelled) return;
        const isTimeout = err instanceof Error && err.message === 'timeout';
        toast.error(isTimeout ? 'Font load timed out' : 'Font failed to load');
        if (fontName !== DEFAULT_FONT) {
          const fallback = FONTS.find((f) => f.name === DEFAULT_FONT);
          if (fallback) {
            loadFontByName(fallback.name, fallback.url)
              .then((font) => {
                if (!cancelled) setLoadedFont(font);
              })
              .catch(() => {});
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fontName]);

  return loadedFont;
}

export function textToSvg(text: string, font: opentype.Font): string {
  try {
    return _textToSvg(text, font);
  } catch (err) {
    console.warn('textToSvg failed:', err);
    return '';
  }
}

function _textToSvg(text: string, font: opentype.Font): string {
  const size = 200;
  const available = size - 20;
  let fontSize = 180;
  let fullPath = font.getPath(text, 0, 0, fontSize);
  let bb = fullPath.getBoundingBox();
  let w = bb.x2 - bb.x1;
  let h = bb.y2 - bb.y1;

  while ((w > available || h > available) && fontSize > 8) {
    fontSize -= 4;
    fullPath = font.getPath(text, 0, 0, fontSize);
    bb = fullPath.getBoundingBox();
    w = bb.x2 - bb.x1;
    h = bb.y2 - bb.y1;
  }

  const offsetX = (size - w) / 2 - bb.x1;
  const offsetY = (size - h) / 2 - bb.y1;
  const glyphs = font.stringToGlyphs(text);
  let x = offsetX;
  const paths: string[] = [];
  const unitsPerEm = font.unitsPerEm || 1000;

  for (let i = 0; i < glyphs.length; i++) {
    const glyph = glyphs[i];
    const glyphPath = glyph.getPath(x, offsetY, fontSize);
    const d = glyphPath.toPathData(2);
    if (d) {
      paths.push(`<path d="${d}" fill="black" fill-rule="evenodd"/>`);
    }
    const advance = (glyph.advanceWidth || 0) * (fontSize / unitsPerEm);
    if (i < glyphs.length - 1) {
      const kerning = font.getKerningValue(glyphs[i], glyphs[i + 1]);
      x += advance + kerning * (fontSize / unitsPerEm);
    } else {
      x += advance;
    }
  }

  if (paths.length === 0) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths.join(
    ''
  )}</svg>`;
}

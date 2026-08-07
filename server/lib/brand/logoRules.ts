/**
 * Logo usage rules, derived from the logo file itself.
 *
 * Clear space, minimum reproduction size and the "which backgrounds may this
 * logo sit on" matrix are the three pages every brand manual has and every
 * designer redraws by hand. They are not opinions — they are arithmetic over
 * two inputs the guideline already owns: the logo raster and the palette.
 *
 * Same principle as `references/imageFacts.ts`: an LLM should never be asked
 * for a number it cannot measure. What the model IS good at (naming the
 * brand-specific misuse that boilerplate misses) stays out of here and reads
 * these facts as input.
 *
 * The one genuinely conventional input is which module drives clear space
 * (cap height vs. stem). It is a parameter, not a guess, and the answer is
 * recorded on the output so the manual can state it.
 *
 * sharp is imported dynamically: top-level native imports crash Vercel Lambda
 * on cold-start (see scripts/check-serverless-imports.mjs).
 */

import { colord, extend } from 'colord';
import a11yPlugin from 'colord/plugins/a11y';

extend([a11yPlugin]);

/** Alpha above which a pixel counts as ink. Below this is antialiasing halo. */
const INK_ALPHA = 16;

/**
 * Runs shorter than this are antialiasing and glyph apexes (the point of an
 * "A", the joint of an "R"), not strokes. Counting them would collapse every
 * minimum-size calculation to "1px", which is why a naive min() is useless here.
 */
const MIN_REAL_RUN = 3;

/** Widest edge sharp is asked to decode. Stroke ratios are scale-invariant. */
const MAX_SAMPLE_EDGE = 2000;

/** Legibility floors. Not preferences — the thresholds print and screen impose. */
const FLOOR = {
  /** A stroke thinner than one device pixel disappears or shimmers. */
  screenStrokePx: 1,
  /** Below this cap height a bold grotesque stops being readable on screen. */
  screenCapPx: 8,
  /** 0.25pt in mm — the classic offset floor for reliable ink coverage. */
  printStrokeMm: 0.088,
  /** Below this cap height print detail closes up on uncoated stock. */
  printCapMm: 2,
} as const;

/**
 * WCAG 1.4.11 Non-text Contrast. A logo is a graphical object, not body copy —
 * the bar is 3:1, not 4.5:1. Using the text threshold here would reject
 * perfectly legible pairings and is the most common mistake in automated
 * brand audits.
 */
const CONTRAST = { ok: 3, caution: 2 } as const;

export type ClearSpaceModule = 'capHeight' | 'halfCapHeight' | 'stem';

export interface LogoGeometry {
  /** Full canvas of the source file. */
  canvas: { width: number; height: number };
  /** Tight bounds of the ink inside that canvas. */
  bbox: { x: number; y: number; width: number; height: number };
  /** bbox width / bbox height, 3dp. */
  aspectRatio: number;
  /**
   * Padding already baked into the file, as a fraction of bbox width. A logo
   * exported with its own clear space needs that subtracted before anyone
   * adds more, or the piece gets double margin.
   */
  bakedPadding: { top: number; right: number; bottom: number; left: number };
  /** Ink height. For an all-caps wordmark this IS the cap height. */
  capHeight: number;
  /** Modal horizontal run — the dominant vertical stroke (stem). */
  stemWidth: number;
  /** Modal vertical run — the dominant horizontal stroke (bar). */
  barWidth: number;
  /** 5th percentile of real runs. The stroke that fails first when scaled down. */
  thinnestStroke: number;
  /** Mean colour of the ink, hex. Drives the contrast matrix. */
  inkColor: string;
  /** Fraction of the bbox that is ink. Distinguishes a wordmark from a solid badge. */
  inkDensity: number;
}

export interface ClearSpaceRule {
  module: ClearSpaceModule;
  /** Human sentence for the manual, pt-BR. */
  statement: string;
  /** Clear space in px at the logo's native size. */
  px: number;
  /** As a fraction of the logo's own width — the form a renderer can apply. */
  ratioOfWidth: number;
  ratioOfHeight: number;
  /** Drop-in CSS for a container that reserves the margin at any size. */
  css: string;
}

export interface MinSizeRule {
  screenPx: number;
  printMm: number;
  screenGovernedBy: 'stroke' | 'capHeight';
  printGovernedBy: 'stroke' | 'capHeight';
  /** Safety multiplier applied on top of the physical floor. */
  safety: number;
  statement: string;
}

export interface BackgroundVerdict {
  hex: string;
  name?: string;
  role?: string;
  /** WCAG contrast ratio between the ink and this background, 2dp. */
  contrast: number;
  verdict: 'ok' | 'caution' | 'fail';
}

export interface LogoRules {
  geometry: LogoGeometry;
  clearSpace: ClearSpaceRule;
  minSize: MinSizeRule;
  backgrounds: BackgroundVerdict[];
  /**
   * Brand-agnostic misuse. Identical in every manual on earth, which is exactly
   * why it should be generated and not typed. Brand-SPECIFIC misuse is a
   * separate, model-written list — see docs/BRAND-LOGO-RULES.md.
   */
  misuse: string[];
  derivedAt: string;
}

export interface DeriveOptions {
  module?: ClearSpaceModule;
  /** Multiplier on the physical minimum. 1 = the bare floor. */
  safety?: number;
  palette?: Array<{ hex: string; name?: string; role?: string }>;
}

/* ------------------------------------------------------------------ measure */

/** Modal value of a run-length list. */
function mode(runs: number[]): number {
  const counts = new Map<number, number>();
  for (const r of runs) counts.set(r, (counts.get(r) ?? 0) + 1);
  let best = 0;
  let bestCount = -1;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = value;
    }
  }
  return best;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[idx];
}

/**
 * Measure the ink in a logo raster.
 *
 * Works on alpha when the file has transparency (the normal case for a logo),
 * and falls back to luminance distance from the corner pixel when it does not,
 * so a flattened PNG on white still measures instead of returning garbage.
 */
export async function measureLogo(bytes: Buffer): Promise<LogoGeometry> {
  const { default: sharp } = await import('sharp');

  const pipeline = sharp(bytes, { failOn: 'none' });
  const meta = await pipeline.metadata();
  const srcW = meta.width ?? 0;
  const srcH = meta.height ?? 0;
  if (!srcW || !srcH) throw new Error('logo has no decodable dimensions');

  const scale = Math.min(1, MAX_SAMPLE_EDGE / Math.max(srcW, srcH));
  const { data, info } = await sharp(bytes, { failOn: 'none' })
    .resize(scale < 1 ? { width: Math.round(srcW * scale) } : undefined)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h, channels } = info;

  // `meta.hasAlpha` only says the channel EXISTS. Designers routinely export a
  // flattened logo as RGBA, where every pixel is opaque — trusting the flag
  // there makes the whole canvas read as ink and every measurement collapses.
  // Ask the pixels instead.
  let alphaCarriesShape = false;
  if (channels >= 4) {
    for (let i = 0; i < w * h; i++) {
      if (data[i * channels + 3] <= INK_ALPHA) {
        alphaCarriesShape = true;
        break;
      }
    }
  }

  // No usable alpha: treat the top-left pixel as the background and call
  // anything far from it ink.
  const bg = { r: data[0], g: data[1], b: data[2] };
  const isInk = (i: number): boolean => {
    if (alphaCarriesShape) return data[i * channels + 3] > INK_ALPHA;
    const o = i * channels;
    return (
      Math.abs(data[o] - bg.r) + Math.abs(data[o + 1] - bg.g) + Math.abs(data[o + 2] - bg.b) > 90
    );
  };

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  let inkCount = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!isInk(i)) continue;
      inkCount++;
      const o = i * channels;
      sumR += data[o];
      sumG += data[o + 1];
      sumB += data[o + 2];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) throw new Error('logo raster is empty — no ink found');

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;

  // Run lengths inside the bbox only, so baked padding cannot skew them.
  const hRuns: number[] = [];
  for (let y = minY; y <= maxY; y++) {
    let run = 0;
    for (let x = minX; x <= maxX; x++) {
      if (isInk(y * w + x)) run++;
      else {
        if (run) hRuns.push(run);
        run = 0;
      }
    }
    if (run) hRuns.push(run);
  }
  const vRuns: number[] = [];
  for (let x = minX; x <= maxX; x++) {
    let run = 0;
    for (let y = minY; y <= maxY; y++) {
      if (isInk(y * w + x)) run++;
      else {
        if (run) vRuns.push(run);
        run = 0;
      }
    }
    if (run) vRuns.push(run);
  }

  const real = [...hRuns, ...vRuns].filter((r) => r >= MIN_REAL_RUN).sort((a, b) => a - b);

  // Scale measurements back to the source file's own pixel space so the numbers
  // a designer reads match the asset they have open.
  const back = scale < 1 ? 1 / scale : 1;
  const px = (v: number) => Math.round(v * back);

  return {
    canvas: { width: srcW, height: srcH },
    bbox: { x: px(minX), y: px(minY), width: px(bw), height: px(bh) },
    aspectRatio: Number((bw / bh).toFixed(3)),
    bakedPadding: {
      top: Number((minY / bw).toFixed(3)),
      right: Number(((w - 1 - maxX) / bw).toFixed(3)),
      bottom: Number(((h - 1 - maxY) / bw).toFixed(3)),
      left: Number((minX / bw).toFixed(3)),
    },
    capHeight: px(bh),
    stemWidth: px(mode(hRuns.filter((r) => r >= MIN_REAL_RUN))),
    barWidth: px(mode(vRuns.filter((r) => r >= MIN_REAL_RUN))),
    thinnestStroke: px(percentile(real, 0.05)),
    inkColor: colord({
      r: Math.round(sumR / inkCount),
      g: Math.round(sumG / inkCount),
      b: Math.round(sumB / inkCount),
    }).toHex(),
    inkDensity: Number((inkCount / (bw * bh)).toFixed(3)),
  };
}

/* ------------------------------------------------------------------- derive */

const MODULE_LABEL: Record<ClearSpaceModule, string> = {
  capHeight: 'à altura da caixa-alta do logo',
  halfCapHeight: 'a metade da altura da caixa-alta do logo',
  stem: 'à espessura da haste do logo',
};

function moduleSize(g: LogoGeometry, module: ClearSpaceModule): number {
  if (module === 'stem') return g.stemWidth;
  if (module === 'halfCapHeight') return g.capHeight / 2;
  return g.capHeight;
}

export function deriveClearSpace(g: LogoGeometry, module: ClearSpaceModule): ClearSpaceRule {
  const px = Math.round(moduleSize(g, module));
  const ratioOfWidth = Number((px / g.bbox.width).toFixed(4));
  const baked = Math.max(...Object.values(g.bakedPadding));
  const bakedNote =
    baked > 0.02
      ? ` O arquivo já traz ${(baked * 100).toFixed(0)}% de folga embutida — descontar essa parte antes de aplicar a margem.`
      : '';

  return {
    module,
    px,
    ratioOfWidth,
    ratioOfHeight: Number((px / g.bbox.height).toFixed(4)),
    statement:
      `A área de respiro em todos os lados equivale ${MODULE_LABEL[module]} ` +
      `(${px} px no arquivo original, ou ${(ratioOfWidth * 100).toFixed(1)}% da largura aplicada).` +
      bakedNote,
    css: `padding: calc(var(--logo-width) * ${ratioOfWidth});`,
  };
}

export function deriveMinSize(g: LogoGeometry, safety = 1): MinSizeRule {
  const strokeRatio = g.thinnestStroke / g.bbox.width;
  const capRatio = g.capHeight / g.bbox.width;
  if (!strokeRatio || !capRatio) throw new Error('geometry has no usable stroke or cap ratio');

  const screenByStroke = FLOOR.screenStrokePx / strokeRatio;
  const screenByCap = FLOOR.screenCapPx / capRatio;
  const printByStroke = FLOOR.printStrokeMm / strokeRatio;
  const printByCap = FLOOR.printCapMm / capRatio;

  // Round screen up to a multiple of 4 so the number drops into a spacing scale
  // instead of fighting it.
  const screenPx = Math.ceil((Math.max(screenByStroke, screenByCap) * safety) / 4) * 4;
  const printMm = Math.ceil(Math.max(printByStroke, printByCap) * safety);

  return {
    screenPx,
    printMm,
    screenGovernedBy: screenByStroke >= screenByCap ? 'stroke' : 'capHeight',
    printGovernedBy: printByStroke >= printByCap ? 'stroke' : 'capHeight',
    safety,
    statement:
      `Largura mínima: ${screenPx} px em tela e ${printMm} mm em impressão. ` +
      `Abaixo disso ${
        screenByStroke >= screenByCap
          ? 'o traço mais fino da marca cai abaixo de um pixel'
          : 'a caixa-alta deixa de ser legível'
      }.`,
  };
}

export function deriveBackgrounds(
  g: LogoGeometry,
  palette: Array<{ hex: string; name?: string; role?: string }>
): BackgroundVerdict[] {
  const ink = colord(g.inkColor);
  return palette
    .filter((c) => colord(c.hex).isValid())
    .map((c) => {
      const contrast = Number(ink.contrast(colord(c.hex)).toFixed(2));
      return {
        hex: c.hex,
        name: c.name,
        role: c.role,
        contrast,
        verdict:
          contrast >= CONTRAST.ok ? 'ok' : contrast >= CONTRAST.caution ? 'caution' : 'fail',
      } as BackgroundVerdict;
    })
    .sort((a, b) => b.contrast - a.contrast);
}

/**
 * The misuse list every manual repeats. Generated rather than typed because it
 * is genuinely brand-agnostic — the brand-specific items are a separate pass.
 */
export function boilerplateMisuse(): string[] {
  return [
    'Não distorcer: escalar sempre proporcionalmente, nunca esticar largura ou altura isoladamente.',
    'Não girar nem inclinar o logo.',
    'Não aplicar sombra, brilho, contorno, gradiente ou qualquer efeito.',
    'Não recolorir fora das cores da marca.',
    'Não redesenhar nem recompor com outra fonte.',
    'Não alterar o espaçamento entre os elementos do logo.',
    'Não posicionar sobre imagem ruidosa ou de baixo contraste sem uma camada de proteção.',
    'Não invadir a área de respiro com texto, borda ou outro elemento gráfico.',
    'Não usar o logo dentro de uma frase como se fosse palavra.',
    'Não aplicar abaixo do tamanho mínimo definido.',
  ];
}

export async function deriveLogoRules(bytes: Buffer, opts: DeriveOptions = {}): Promise<LogoRules> {
  const geometry = await measureLogo(bytes);
  return {
    geometry,
    clearSpace: deriveClearSpace(geometry, opts.module ?? 'capHeight'),
    minSize: deriveMinSize(geometry, opts.safety ?? 1),
    backgrounds: deriveBackgrounds(geometry, opts.palette ?? []),
    misuse: boilerplateMisuse(),
    derivedAt: new Date().toISOString(),
  };
}

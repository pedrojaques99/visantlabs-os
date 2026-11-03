/**
 * Ink bleed engine: pure functions from document to SVG markup. The preview, the
 * preset thumbnails and every export go through `buildArtworkSvg`, so what the
 * user sees and what they download cannot drift apart.
 */
import { luminance } from './paper';
import type {
  DragAxis,
  FormatId,
  InkDoc,
  InkLogo,
  InkSettings,
  MotionMode,
  TextAlign,
} from './types';

export const FORMATS: Record<FormatId, { width: number; height: number }> = {
  '4:3': { width: 1200, height: 900 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
};

/** Side margin kept free when a text is left or right aligned, and when fitting it. */
export const TEXT_MARGIN = 0.1;

/**
 * Second, finer displacement over the wave of the edge: the wave alone reads as a
 * melted shape, the fine pass is what reads as ink creeping along paper fibers.
 */
const FIBER_FREQUENCY = 3.4;
const FIBER_AMPLITUDE = 0.42;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface MotionFactors {
  spread: number;
  roughness: number;
  frequency: number;
  seedOffset: number;
}

/**
 * How each mode shapes the ink at time `t` (0-1). Every mode closes its cycle, so
 * playback and exports loop without a jump. At t=1 `bleed-in` shows the slider values
 * untouched, and it keeps one seed so the ink grows instead of reshuffling its edge.
 */
export function motionFactors(mode: MotionMode, t: number): MotionFactors {
  switch (mode) {
    case 'bleed-in': {
      // Full at both ends and dry at the middle, so the loop has no jump.
      const wet = 0.5 + 0.5 * Math.cos(t * Math.PI * 2);
      return {
        spread: 0.05 + 0.95 * Math.pow(wet, 0.85),
        roughness: 0.15 + 0.85 * Math.pow(wet, 0.7),
        frequency: 1.15 - 0.15 * wet,
        seedOffset: 0,
      };
    }
    case 'pulse': {
      const wave = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
      return {
        spread: 0.85 + 0.28 * wave,
        roughness: 0.88 + 0.22 * wave,
        frequency: 0.95 + 0.1 * wave,
        seedOffset: Math.floor(t * 4) % 4,
      };
    }
    case 'capillary-flow':
      return {
        spread: 0.9 + 0.18 * Math.sin(t * Math.PI * 4),
        roughness: 1 + 0.12 * Math.cos(t * Math.PI * 2),
        frequency: 1,
        seedOffset: Math.floor(t * 120) % 120,
      };
    case 'xerox-burn': {
      const jitter = (Math.sin(t * Math.PI * 10) + Math.cos(t * Math.PI * 18)) * 0.08;
      return {
        spread: Math.max(0.2, 0.9 + jitter),
        roughness: Math.max(0.3, 1 + jitter * 1.5),
        frequency: 1,
        seedOffset: Math.floor(t * 60) % 60,
      };
    }
  }
}

export interface FilterParams {
  filterId: string;
  width: number;
  height: number;
  displacementScale: number;
  baseFrequency: string;
  numOctaves: number;
  blurStdDev: number;
  alphaMultiplier: number;
  alphaOffset: number;
  seed: number;
  coreDensity: number;
  erosion: number;
  grit: number;
  gritFrequency: number;
  /** Displacement of the scan streaks. 0 turns the stage off. */
  dragScale: number;
  dragAxis: DragAxis;
  dragFrequency: string;
  /** Extra blur along the streaks. */
  dragBlur: number;
  dragPatchFrequency: number;
  dragPatchOffset: number;
  haloBlur: number;
  haloAlpha: number;
  ghostX: number;
  ghostY: number;
  ghostAlpha: number;
  ghostBlur: number;
  /** Tint the source with the ink color. Text already has it, a logo mask does not. */
  tint: string | null;
}

interface FilterOptions {
  filterId: string;
  width: number;
  height: number;
  scale: number;
  mode: MotionMode;
  progress: number;
  seed: number;
  tint?: string | null;
}

/**
 * Filter values live in device pixels, so they scale with the output: distances
 * multiply and noise frequency divides. Without this a 4x export has a quarter of
 * the bleed the preview shows.
 */
export function computeFilterParams(ink: InkSettings, options: FilterOptions): FilterParams {
  const { filterId, width, height, scale, mode, progress, seed, tint = null } = options;
  const m = motionFactors(mode, clamp(progress, 0, 1));

  const spread = ink.bleedSpread * m.spread;
  const roughness = ink.roughness * m.roughness;
  const frequency = Math.max(0.005, ink.frequency * m.frequency);
  const feather = ink.edgeFeather / 100;

  const freqX = frequency / scale;
  const freqY = (frequency * (1 + ink.capillaryStreaks * 0.006)) / scale;

  // The optical effects grow with the ink, so a bleed-in pulls focus instead of
  // starting already blurred.
  const optics = Math.min(1, m.spread);
  const defocus = clamp(ink.defocus / 100, 0, 1) * optics;
  const halo = clamp(ink.halo / 100, 0, 1) * optics;
  const drag = clamp(ink.drag / 100, 0, 1) * optics;
  const ghost = clamp(ink.ghost / 100, 0, 1);

  // The alpha ramp goes from a hard contour to a soft one quickly, while the blur
  // keeps growing. That is what keeps a dense center inside a wide soft edge.
  const soft = Math.min(1, defocus * 2.5);
  const sharpMultiplier = 18 + (1 - feather) * 20;
  const sharpOffset = 6 + (1 - feather) * 8;
  const across = 0.085 / scale;
  const along = 0.0012 / scale;

  return {
    filterId,
    width,
    height,
    displacementScale: (roughness / 100) * 28 * scale,
    baseFrequency: `${freqX.toFixed(5)} ${freqY.toFixed(5)}`,
    numOctaves: clamp(Math.round(ink.octaves), 1, 4),
    blurStdDev: (Math.max(0.1, (spread / 100) * 6) + Math.pow(defocus, 1.2) * 42) * scale,
    alphaMultiplier: sharpMultiplier + (2.4 - sharpMultiplier) * soft,
    alphaOffset: sharpOffset + (0.62 - sharpOffset) * soft,
    seed: ((seed + m.seedOffset) % 1000) + 1,
    coreDensity: clamp(ink.coreFillDensity / 100, 0, 1) * Math.pow(1 - soft, 2),
    erosion: clamp(ink.inkErosion / 100, 0, 1),
    grit: clamp(ink.tonerGrit / 100, 0, 1),
    // Capped: above about 1 the noise aliases into a uniform dust at thumbnail scale.
    gritFrequency: Math.min(0.9, (0.55 + (ink.tonerGrit / 100) * 0.3) / scale),
    // Curved: the low end has to keep the word readable, the top end can destroy it.
    dragScale: Math.pow(drag, 1.6) * 200 * scale,
    dragAxis: ink.dragAxis,
    dragFrequency:
      ink.dragAxis === 'vertical'
        ? `${across.toFixed(5)} ${along.toFixed(5)}`
        : `${along.toFixed(5)} ${across.toFixed(5)}`,
    dragBlur: drag * 10 * scale,
    // Streaks run in patches of about 150 px, and more drag lets the patches take over.
    dragPatchFrequency: 0.0065 / scale,
    dragPatchOffset: 4.6 - drag * 2.4,
    haloBlur: halo * 36 * scale,
    haloAlpha: Math.min(1, halo * 1.3),
    ghostX: -ghost * 70 * scale,
    ghostY: ghost * 38 * scale,
    ghostAlpha: ghost > 0 ? 0.06 + ghost * 0.22 : 0,
    ghostBlur: 4 * scale,
    tint,
  };
}

/**
 * Noise turned into an alpha mask: where noise falls under `threshold` the ink
 * drops out. `threshold` is the fraction of the noise range that gets cut.
 */
function noiseMask(
  id: string,
  frequency: number,
  octaves: number,
  seed: number,
  threshold: number,
  sharpness: number
): string {
  return `<feTurbulence type="fractalNoise" baseFrequency="${frequency.toFixed(5)}" numOctaves="${octaves}" seed="${seed}" result="${id}Noise"/>
<feColorMatrix in="${id}Noise" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${sharpness.toFixed(2)} ${(-threshold * sharpness).toFixed(3)}" result="${id}Mask"/>`;
}

export function buildFilterMarkup(p: FilterParams): string {
  const source = p.tint ? 'tinted' : 'SourceGraphic';
  const tintStage = p.tint
    ? `<feFlood flood-color="${escapeXml(p.tint)}" result="flood"/>
<feComposite in="flood" in2="SourceGraphic" operator="in" result="tinted"/>`
    : '';

  const coreStage =
    p.coreDensity > 0
      ? `<feComponentTransfer in="displaced" result="core"><feFuncA type="linear" slope="${p.coreDensity.toFixed(3)}"/></feComponentTransfer>
<feMerge result="inked"><feMergeNode in="contour"/><feMergeNode in="core"/></feMerge>`
      : `<feMerge result="inked"><feMergeNode in="contour"/></feMerge>`;

  const freqX = Number(p.baseFrequency.split(' ')[0]);
  let last = 'inked';
  let masks = '';
  if (p.erosion > 0) {
    // Noise alpha sits around 0.5 and rarely leaves 0.25-0.75.
    const threshold = 0.2 + p.erosion * 0.28;
    const freq = freqX * 2.6;
    masks += `${noiseMask('erosion', freq, 3, (p.seed * 11) % 500, threshold, 7)}
<feComposite in="${last}" in2="erosionMask" operator="in" result="eroded"/>`;
    last = 'eroded';
  }
  if (p.grit > 0) {
    const threshold = 0.1 + p.grit * 0.3;
    masks += `${noiseMask('grit', p.gritFrequency, 2, (p.seed * 7) % 500, threshold, 9)}
<feComposite in="${last}" in2="gritMask" operator="in" result="gritted"/>`;
    last = 'gritted';
  }

  // Noise stretched along the axis, moving pixels only along that axis: streaks. The
  // other displacement channel is a constant 0.5, which means no movement.
  const vertical = p.dragAxis === 'vertical';
  const dragStage =
    p.dragScale > 0
      ? `<feTurbulence type="fractalNoise" baseFrequency="${p.dragFrequency}" numOctaves="2" seed="${p.seed + 5}" result="dragRaw"/>
<feColorMatrix in="dragRaw" type="matrix" values="2.4 0 0 0 -0.7 0 0 0 0 0.5 0 0 0 0 0 0 0 0 0 1" result="dragNoise"/>
<feDisplacementMap in="${source}" in2="dragNoise" scale="${p.dragScale.toFixed(2)}" xChannelSelector="${vertical ? 'G' : 'R'}" yChannelSelector="${vertical ? 'R' : 'G'}" result="dragFull"/>
<feTurbulence type="fractalNoise" baseFrequency="${p.dragPatchFrequency.toFixed(5)}" numOctaves="2" seed="${p.seed + 6}" result="dragPatchRaw"/>
<feColorMatrix in="dragPatchRaw" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 8 0 0 0 ${(-p.dragPatchOffset).toFixed(2)}" result="dragPatch"/>
<feComposite in="dragFull" in2="dragPatch" operator="in" result="dragPart"/>
<feMerge result="dragged"><feMergeNode in="${source}"/><feMergeNode in="dragPart"/></feMerge>`
      : '';
  const waveInput = p.dragScale > 0 ? 'dragged' : source;
  const blurX = p.blurStdDev + (vertical ? 0 : p.dragBlur);
  const blurY = p.blurStdDev + (vertical ? p.dragBlur : 0);

  const ghostStage =
    p.ghostAlpha > 0
      ? `<feOffset in="displaced" dx="${p.ghostX.toFixed(2)}" dy="${p.ghostY.toFixed(2)}" result="ghostShift"/>
<feGaussianBlur in="ghostShift" stdDeviation="${p.ghostBlur.toFixed(2)}" result="ghostSoft"/>
<feComponentTransfer in="ghostSoft" result="ghost"><feFuncA type="linear" slope="${p.ghostAlpha.toFixed(3)}"/></feComponentTransfer>`
      : '';
  const haloStage =
    p.haloAlpha > 0
      ? `<feGaussianBlur in="displaced" stdDeviation="${p.haloBlur.toFixed(2)}" result="haloSoft"/>
<feComponentTransfer in="haloSoft" result="halo"><feFuncA type="linear" slope="${p.haloAlpha.toFixed(3)}"/></feComponentTransfer>`
      : '';
  const finalMerge = [p.ghostAlpha > 0 ? 'ghost' : '', p.haloAlpha > 0 ? 'halo' : '', last]
    .filter(Boolean)
    .map((node) => `<feMergeNode in="${node}"/>`)
    .join('');

  return `<filter id="${p.filterId}" filterUnits="userSpaceOnUse" x="0" y="0" width="${p.width}" height="${p.height}" color-interpolation-filters="sRGB">
${tintStage}
${dragStage}
<feTurbulence type="fractalNoise" baseFrequency="${p.baseFrequency}" numOctaves="${p.numOctaves}" seed="${p.seed}" result="capillaryNoise"/>
<feDisplacementMap in="${waveInput}" in2="capillaryNoise" scale="${p.displacementScale.toFixed(2)}" xChannelSelector="R" yChannelSelector="G" result="wavy"/>
<feTurbulence type="fractalNoise" baseFrequency="${(freqX * FIBER_FREQUENCY).toFixed(5)}" numOctaves="2" seed="${p.seed + 3}" result="fiberNoise"/>
<feDisplacementMap in="wavy" in2="fiberNoise" scale="${(p.displacementScale * FIBER_AMPLITUDE).toFixed(2)}" xChannelSelector="G" yChannelSelector="R" result="displaced"/>
<feGaussianBlur in="displaced" stdDeviation="${blurX.toFixed(2)} ${blurY.toFixed(2)}" result="blurred"/>
<feColorMatrix in="blurred" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${p.alphaMultiplier.toFixed(2)} -${p.alphaOffset.toFixed(2)}" result="contour"/>
${coreStage}
${masks}
${ghostStage}
${haloStage}
<feMerge>${finalMerge}</feMerge>
</filter>`;
}

function textAnchor(align: TextAlign): { anchor: string; x: number } {
  if (align === 'left') return { anchor: 'start', x: TEXT_MARGIN };
  if (align === 'right') return { anchor: 'end', x: 1 - TEXT_MARGIN };
  return { anchor: 'middle', x: 0.5 };
}

function renderText(doc: InkDoc, width: number, height: number, scale: number): string {
  const t = doc.typography;
  const lines = t.text.split('\n');
  const fontSize = t.fontSize * scale;
  const lineStep = fontSize * t.lineHeight;
  const startY = (height - lines.length * lineStep) / 2 + fontSize * 0.82;
  const { anchor, x } = textAnchor(t.textAlign);

  return lines
    .map((line, i) => {
      const content = escapeXml(t.uppercase ? line.toUpperCase() : line);
      return `<text x="${(width * x).toFixed(2)}" y="${(startY + i * lineStep).toFixed(2)}" text-anchor="${anchor}" font-family="&apos;${escapeXml(t.fontFamily)}&apos;, sans-serif" font-size="${fontSize.toFixed(2)}" font-weight="${Number(t.fontWeight) || 400}" letter-spacing="${(t.letterSpacing * scale).toFixed(2)}" fill="${escapeXml(doc.ink.inkColor)}" fill-opacity="${doc.ink.inkOpacity / 100}" xml:space="preserve">${content}</text>`;
    })
    .join('');
}

function renderLogo(doc: InkDoc, logo: InkLogo, width: number, height: number): string {
  const aspect = logo.height / logo.width;
  let w = width * (doc.logoScale / 100);
  let h = w * aspect;
  // A tall logo is limited by the height of the artwork, not by its width.
  const maxH = height * 0.9;
  if (h > maxH) {
    h = maxH;
    w = h / aspect;
  }
  return `<image href="${logo.dataUrl}" x="${((width - w) / 2).toFixed(2)}" y="${((height - h) / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" opacity="${doc.ink.inkOpacity / 100}"/>`;
}

export interface ArtworkOptions {
  filterId: string;
  /** Output multiplier over the artwork size. */
  scale?: number;
  progress?: number;
  logo?: InkLogo | null;
  /** `@font-face` rules. Required when the SVG leaves the page: an <img> cannot see page fonts. */
  fontCss?: string;
  /** Paper image, for an SVG file that carries its own background. */
  paperDataUrl?: string;
  /** Pasted paper that goes over the ink, for the same SVG file. */
  veilDataUrl?: string;
}

/** Whether the document will draw a logo, falling back to text when none is loaded. */
export function usesLogo(doc: InkDoc, logo?: InkLogo | null): logo is InkLogo {
  return doc.source === 'logo' && !!logo;
}

/**
 * Ink absorbs into paper, so the paper tone shows through it. Only true for ink
 * darker than its paper: light ink on a dark stock is opaque, as on a photostat.
 */
export function inkBlendMode(doc: InkDoc): 'multiply' | 'normal' {
  if (doc.paper.paperType === 'transparent') return 'normal';
  return luminance(doc.ink.inkColor) < luminance(doc.paper.baseColor) ? 'multiply' : 'normal';
}

export function buildArtworkSvg(doc: InkDoc, options: ArtworkOptions): string {
  const { filterId, scale = 1, progress = 1, logo, fontCss, paperDataUrl, veilDataUrl } = options;
  const base = FORMATS[doc.format];
  const width = Math.round(base.width * scale);
  const height = Math.round(base.height * scale);
  const drawLogo = usesLogo(doc, logo);

  const filter = buildFilterMarkup(
    computeFilterParams(doc.ink, {
      filterId,
      width,
      height,
      scale,
      mode: doc.motion.mode,
      progress,
      seed: doc.seed,
      tint: drawLogo ? doc.ink.inkColor : null,
    })
  );

  const art = drawLogo
    ? renderLogo(doc, logo, width, height)
    : renderText(doc, width, height, scale);
  const style = fontCss ? `<style>${fontCss}</style>` : '';
  const paper = paperDataUrl
    ? `<image href="${paperDataUrl}" x="0" y="0" width="${width}" height="${height}"/>`
    : '';

  const veil = veilDataUrl
    ? `<image href="${veilDataUrl}" x="0" y="0" width="${width}" height="${height}"/>`
    : '';
  // Only a file that carries its paper blends inside the SVG. The preview and the
  // raster export blend the whole layer over a separate paper.
  const blend =
    paperDataUrl && inkBlendMode(doc) === 'multiply' ? ' style="mix-blend-mode:multiply"' : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${style}${filter}</defs>${paper}<g${blend} filter="url(#${filterId})">${art}</g>${veil}</svg>`;
}

/**
 * Largest font size that keeps the text inside the artwork. `measure` returns the
 * widest line at a given size with no letter spacing, and is injected so this stays pure.
 */
export function fitFontSize(
  doc: InkDoc,
  measure: (lines: string[], size: number) => number
): number {
  const t = doc.typography;
  const { width, height } = FORMATS[doc.format];
  const lines = (t.uppercase ? t.text.toUpperCase() : t.text).split('\n');
  const longest = Math.max(1, ...lines.map((l) => l.length));
  const available = width * (1 - TEXT_MARGIN * 2) - t.letterSpacing * longest;
  const perPx = measure(lines, 100) / 100;
  const byWidth = perPx > 0 ? available / perPx : t.fontSize;
  const byHeight = (height * (1 - TEXT_MARGIN * 2)) / (lines.length * t.lineHeight);
  return clamp(Math.floor(Math.min(byWidth, byHeight)), 20, 400);
}

/** Where a mode starts when it begins to play. Ink starts dry and bleeds. */
export function motionStart(mode: MotionMode): number {
  return mode === 'bleed-in' ? 0.5 : 0;
}

/**
 * Frame time for an export. Stops one frame short of the full cycle, so a looping file
 * does not show the first frame twice.
 */
export function frameProgress(mode: MotionMode, frame: number, total: number): number {
  if (total <= 1) return 1;
  return (motionStart(mode) + frame / total) % 1;
}

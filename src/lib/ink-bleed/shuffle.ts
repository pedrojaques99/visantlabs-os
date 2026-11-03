/**
 * Shuffle: rolls effects and parameters inside ranges that still print well, instead
 * of sliders at random. Text, font and format stay, because they are the person's
 * content. With a locked brand, ink and paper colors stay too.
 */
import { luminance } from './paper';
import type { DragAxis, InkDoc, InkSettings, PaperSettings, PaperType } from './types';

export type Random = () => number;

const INK_ON_PAPER: { ink: string; type: PaperType; paper: string; patch?: string }[] = [
  { ink: '#0e0f0d', type: 'cotton-fine-art', paper: '#eef0ea', patch: '#dfe8cf' },
  { ink: '#171719', type: 'newspaper-vintage', paper: '#e5e1d5' },
  { ink: '#0b0b0b', type: 'newspaper-vintage', paper: '#dfdfdc' },
  { ink: '#0c2461', type: 'cotton-fine-art', paper: '#f4f1ea', patch: '#dfe4ef' },
  { ink: '#8a1f1d', type: 'kraft', paper: '#d6c4a5' },
  { ink: '#1e140d', type: 'aged-parchment', paper: '#e8dcbe' },
  { ink: '#163622', type: 'aged-parchment', paper: '#ebdcb9' },
  { ink: '#c7e2f2', type: 'photostat-dark', paper: '#050608' },
  { ink: '#f2f2ee', type: 'photostat-dark', paper: '#121214' },
];

const between = (rand: Random, min: number, max: number) => Math.round(min + rand() * (max - min));

/** Returns `value` with probability `chance`, otherwise 0: most effects stay off in a roll. */
const sometimes = (rand: Random, chance: number, value: () => number) =>
  rand() < chance ? value() : 0;

function rollInk(rand: Random, keepColor: string | null): InkSettings {
  const pair = INK_ON_PAPER[Math.floor(rand() * INK_ON_PAPER.length)];
  // Stacking every optical effect at once only produces mush, so one leads.
  const lead = Math.floor(rand() * 4);
  const dragAxis: DragAxis = rand() > 0.25 ? 'vertical' : 'horizontal';
  return {
    bleedSpread: between(rand, 15, 60),
    roughness: between(rand, 8, 55),
    frequency: between(rand, 15, 60) / 1000,
    octaves: between(rand, 2, 4),
    coreFillDensity: 100,
    inkErosion: sometimes(rand, 0.35, () => between(rand, 4, 30)),
    edgeFeather: between(rand, 10, 45),
    tonerGrit: sometimes(rand, 0.6, () => between(rand, 5, 30)),
    capillaryStreaks: between(rand, 0, 60),
    inkColor: keepColor ?? pair.ink,
    inkOpacity: 100,
    defocus: lead === 0 ? between(rand, 20, 55) : 0,
    halo: lead === 1 ? between(rand, 15, 50) : sometimes(rand, 0.2, () => between(rand, 8, 25)),
    drag: lead === 2 ? between(rand, 15, 45) : 0,
    dragAxis,
    ghost: lead === 3 ? between(rand, 20, 60) : sometimes(rand, 0.2, () => between(rand, 10, 30)),
  };
}

function rollPaper(rand: Random, current: PaperSettings, inkColor: string, locked: boolean) {
  const pair = INK_ON_PAPER.find((p) => p.ink === inkColor);
  const collage = rand() < 0.45;
  const paper: PaperSettings = {
    paperType: current.paperType,
    baseColor: current.baseColor,
    agingSepia: between(rand, 0, 45),
    fiberGrain: between(rand, 20, 60),
    vignette: sometimes(rand, 0.6, () => between(rand, 8, 40)),
    patches: collage ? between(rand, 30, 85) : 0,
    veil: collage ? between(rand, 20, 65) : 0,
    patchColor: collage && !locked ? (pair?.patch ?? '') : '',
    scanLines: sometimes(rand, 0.4, () => between(rand, 8, 50)),
    dust: sometimes(rand, 0.5, () => between(rand, 10, 60)),
  };
  if (locked || !pair) return paper;
  return { ...paper, paperType: pair.type, baseColor: pair.paper };
}

export function shuffleDoc(doc: InkDoc, rand: Random = Math.random): InkDoc {
  const locked = doc.brandLocked;
  const ink = rollInk(rand, locked ? doc.ink.inkColor : null);
  const paper = rollPaper(rand, doc.paper, ink.inkColor, locked);

  // A person working on transparency asked for no paper. A roll does not undo that.
  const keepTransparent = doc.paper.paperType === 'transparent';
  return {
    ...doc,
    presetId: null,
    seed: between(rand, 0, 999),
    ink,
    paper: keepTransparent ? { ...paper, paperType: 'transparent' } : paper,
  };
}

const VARY_INK: (keyof InkSettings)[] = [
  'bleedSpread',
  'roughness',
  'edgeFeather',
  'capillaryStreaks',
  'inkErosion',
  'tonerGrit',
  'defocus',
  'halo',
  'drag',
  'ghost',
];
const VARY_PAPER: (keyof PaperSettings)[] = [
  'agingSepia',
  'fiberGrain',
  'vignette',
  'patches',
  'veil',
  'scanLines',
  'dust',
];
const VARY_AMOUNT = 0.35;

const nudge = (value: number, rand: Random) => value * (1 + (rand() * 2 - 1) * VARY_AMOUNT);

function varyValues<T extends object>(settings: T, keys: (keyof T)[], rand: Random): T {
  const next = { ...settings };
  for (const key of keys) {
    const value = settings[key];
    // An effect the style leaves off stays off: turning it on would make another style.
    if (typeof value !== 'number' || value === 0) continue;
    next[key] = Math.round(Math.min(100, Math.max(0, nudge(value, rand)))) as T[keyof T];
  }
  return next;
}

/**
 * Another print of the same style: the values move around the ones it already has.
 * Colors, font, text and format stay, and it remains the selected style.
 */
export function varyDoc(doc: InkDoc, rand: Random = Math.random): InkDoc {
  return {
    ...doc,
    seed: between(rand, 0, 999),
    ink: {
      ...varyValues(doc.ink, VARY_INK, rand),
      // Same range as its slider.
      frequency: Math.min(
        0.08,
        Math.max(0.008, Math.round(nudge(doc.ink.frequency, rand) * 1000) / 1000)
      ),
    },
    paper: varyValues(doc.paper, VARY_PAPER, rand),
  };
}

/** Exported for tests: rolls must stay readable. */
export function inkPaperContrast(doc: InkDoc): number {
  const [hi, lo] = [luminance(doc.ink.inkColor), luminance(doc.paper.baseColor)].sort(
    (a, b) => b - a
  );
  return (hi + 0.05) / (lo + 0.05);
}

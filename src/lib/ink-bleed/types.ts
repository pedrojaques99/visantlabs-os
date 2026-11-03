export interface InkSettings {
  /** 0-100: how far the ink spreads past the letterform. */
  bleedSpread: number;
  /** 0-100: displacement amplitude of the edge. */
  roughness: number;
  /** 0.005-0.12: scale of the capillary branches. */
  frequency: number;
  /** 1-4: fractal detail layers. */
  octaves: number;
  /** 0-100: how solid the inside of the letter stays. */
  coreFillDensity: number;
  /** 0-100: dropout specks across the ink. */
  inkErosion: number;
  /** 0-100: softness of the bleeding fringe. */
  edgeFeather: number;
  /** 0-100: fine toner grain inside the ink. */
  tonerGrit: number;
  /** 0-100: vertical stretch of the noise, like paper fibers. */
  capillaryStreaks: number;
  inkColor: string;
  /** 10-100 */
  inkOpacity: number;
  /** 0-100: out of focus. Soft edge around a dense center. */
  defocus: number;
  /** 0-100: glow of the ink spilling around the sharp shape. */
  halo: number;
  /** 0-100: streaks, like the page moving during a scan. */
  drag: number;
  dragAxis: DragAxis;
  /** 0-100: faint offset copy, like a double pass in the copier. */
  ghost: number;
}

export type DragAxis = 'vertical' | 'horizontal';

export type PaperType =
  | 'newspaper-vintage'
  | 'aged-parchment'
  | 'kraft'
  | 'cotton-fine-art'
  | 'photostat-dark'
  | 'transparent';

export interface PaperSettings {
  paperType: PaperType;
  baseColor: string;
  /** 0-100 */
  agingSepia: number;
  /** 0-100 */
  fiberGrain: number;
  /** 0-100 */
  vignette: number;
  /** 0-100: rectangles of pasted paper. */
  patches: number;
  /** 0-100: how much the pasted paper covers the ink. */
  veil: number;
  /** Tint of the pasted paper. Empty uses lighter and darker tones of the base. */
  patchColor: string;
  /** 0-100: thin lines left by the scanner. */
  scanLines: number;
  /** 0-100: specks and hairs on the glass. */
  dust: number;
}

export type TextAlign = 'left' | 'center' | 'right';

export interface TypographySettings {
  text: string;
  fontFamily: string;
  /** Artwork px. */
  fontSize: number;
  /** Multiplier of fontSize. */
  lineHeight: number;
  /** Artwork px. */
  letterSpacing: number;
  textAlign: TextAlign;
  uppercase: boolean;
  fontWeight: number;
}

export type MotionMode = 'bleed-in' | 'pulse' | 'capillary-flow' | 'xerox-burn';

export interface MotionSettings {
  mode: MotionMode;
  /** Seconds. */
  duration: number;
  speed: number;
}

export type FormatId = '4:3' | '1:1' | '4:5' | '9:16' | '16:9';

export type InkSource = 'text' | 'logo';

/** Everything that defines the artwork. Undo, persistence and export all read this one object. */
export interface InkDoc {
  source: InkSource;
  format: FormatId;
  seed: number;
  /** 10-100: width of the logo as a percentage of the artwork. */
  logoScale: number;
  typography: TypographySettings;
  ink: InkSettings;
  paper: PaperSettings;
  motion: MotionSettings;
  /** Style currently applied, cleared as soon as ink or paper are edited. */
  presetId: string | null;
  /** While true, trying a style keeps the brand: ink, paper, font and text stay. */
  brandLocked: boolean;
}

/** Logo reduced to a white alpha mask, so any ink color can tint it. */
export interface InkLogo {
  dataUrl: string;
  width: number;
  height: number;
  name: string;
}

export interface InkPreset {
  id: string;
  ink: InkSettings;
  paper: PaperSettings;
  typography: TypographySettings;
}

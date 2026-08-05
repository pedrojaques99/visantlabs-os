// server/types/brandGuideline.ts

import type { LogoRules } from '../lib/brand/logoRules.js';

export type { LogoRules };

export interface BrandGuidelineIdentity {
  name?: string;
  website?: string;
  tagline?: string;
  description?: string;
}

/**
 * LLM-derived visual analysis persisted on a brand asset (logo/media).
 *
 * Fonte única em `lib/brand/visualSignature.ts`. Este arquivo mantinha uma
 * SEGUNDA definição, estruturalmente igual e sem nada garantindo a sincronia —
 * duas verdades pro mesmo dado persistido. Reexportar mata a duplicata: quem
 * acrescentar campo lá (ex.: placement.textBox) não precisa lembrar daqui.
 */
export type {
  BrandAssetAnalysis,
  BrandAssetPlacement,
  BrandAssetKind,
  BrandAssetDimensions,
} from '../lib/brand/visualSignature.js';

import type { BrandAssetAnalysis, BrandAssetKind } from '../lib/brand/visualSignature.js';

// Single scorer for the whole product — the pill, the API and the MCP all read
// the same 18 weighted rules. See calculateCompleteness below.
import {
  computeBrandCompleteness,
  type CompletenessReport,
} from '../../src/lib/brandCompleteness.js';
import type { BrandGuideline as FigmaBrandGuideline } from '../../src/lib/figma-types.js';

export type { CompletenessReport, CompletenessRule } from '../../src/lib/brandCompleteness.js';

export interface BrandGuidelineLogo {
  id: string;
  url: string;
  variant: 'primary' | 'dark' | 'light' | 'icon' | 'accent' | 'custom';
  label?: string;
  source?: 'upload' | 'figma';
  thumbnailUrl?: string;
  format?: string;
  figmaKey?: string;
  figmaFileKey?: string;
  figmaNodeId?: string;
  analysis?: BrandAssetAnalysis;
  /**
   * Clear space, minimum size and background matrix, measured from this logo's
   * own raster. Derived on upload; re-derivable via POST /logos/:logoId/rules.
   */
  rules?: LogoRules;
  hash?: string;
  size?: number;
  phash?: string;
}

export interface BrandGuidelineColor {
  hex: string;
  name: string;
  role?: string; // "background", "text", "accent", "cta"
  cmyk?: { c: number; m: number; y: number; k: number }; // 0-100 each
}

export interface BrandGuidelineTypography {
  family: string;
  style?: string; // "Bold", "Regular", "SemiBold"
  role: string; // "heading", "body", "accent", "mono"
  size?: number;
  lineHeight?: number;
  letterSpacing?: string;
  weights?: number[];
  availableStyles?: string[];
}

export interface BrandGuidelineGradient {
  id: string;
  name: string;
  type: 'linear' | 'radial';
  angle: number;
  stops: { color: string; position: number }[];
  usage: 'hero' | 'decorative' | 'fill' | 'overlay';
  css?: string;
}

export interface BrandGuidelineShadow {
  id: string;
  name: string;
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  opacity: number;
  type: 'outer' | 'inner' | 'glow';
  css?: string;
}

export interface BrandGuidelineMotion {
  easing?: string;
  durations?: { fast: number; medium: number; slow: number };
  philosophy?: 'minimal' | 'moderate' | 'expressive';
  respectsReducedMotion?: boolean;
}

export interface BrandGuidelineBorder {
  id: string;
  name: string;
  width: number;
  style: 'solid' | 'dashed' | 'dotted';
  color: string;
  opacity: number;
  role: 'default' | 'emphasis' | 'scaffold' | 'divider';
  css?: string;
}

export type BrandMediaCategory =
  | 'background' // gradiente / arte de fundo, extensível
  | 'graphic' // composição autoral / peça de campanha
  | 'stock' // fotografia
  | 'product' // mockup / produto aplicado
  | 'texture' // material / padrão repetido
  | 'other';

/**
 * Deriva a `category` do media a partir do `placement.kind` que o analisador de
 * asset já produz. Preferimos essa fonte à `assetClassifications.category` do
 * ingest: o kind é por-asset, vem do modelo olhando a imagem, e é reavaliado
 * quando a análise roda de novo — em vez de um rótulo fixo do momento do upload.
 */
export function mediaCategoryFromKind(
  kind: BrandAssetKind | undefined
): BrandMediaCategory | undefined {
  switch (kind) {
    case 'photo':
      return 'stock';
    case 'pattern':
      return 'background'; // gradiente/arte de fundo
    case 'texture':
      return 'texture';
    case 'graphic':
    case 'illustration':
      return 'graphic';
    default:
      return undefined; // logo/wordmark/symbol vivem em logos[], não em media[]
  }
}

export interface BrandGuidelineMedia {
  id: string;
  url: string;
  type: 'image' | 'pdf';
  label?: string;
  /**
   * Escrita a partir de `analysis.placement.kind` (ver `mediaCategoryFromKind`).
   * Antes era declarada e NUNCA escrita — o ingest classificava o asset, usava a
   * classe só pra separar logo de media, e jogava fora.
   */
  category?: BrandMediaCategory;
  analysis?: BrandAssetAnalysis;
  /** Dedup fingerprints: sha256 (exact) + byte size + dHash (near-dup). */
  hash?: string;
  size?: number;
  phash?: string;
}

export interface BrandGuidelineTokens {
  spacing?: Record<string, number>;
  radius?: Record<string, number>;
  shadows?: Record<
    string,
    { x: number; y: number; blur: number; spread: number; color: string; opacity: number }
  >;
  components?: Record<string, any>;
}

export interface BrandGuidelineGuidelines {
  voice?: string;
  dos?: string[];
  donts?: string[];
  imagery?: string;
  accessibility?: string;
  person?: 'first' | 'second' | 'third';
  emojiPolicy?: 'none' | 'informal' | 'free';
  casingRules?: string[];
}

export interface BrandGuidelineExtraction {
  sources: Array<{
    type: 'url' | 'pdf' | 'image' | 'images' | 'json' | 'manual' | 'branding_machine';
    ref?: string;
    date: string;
  }>;
  completeness: number; // 0-100
}

/**
 * Brand strategy — same story as BrandAssetAnalysis above. This file kept a
 * second, hand-maintained copy of the whole family, and it had already drifted:
 * BrandPersona lost `gender` and `imageAttribution`, which the other copy has
 * and the persisted data carries. Re-exporting leaves one definition, so a new
 * field (e.g. copyExamples) lands in both by construction.
 *
 * Source is figma-types because that's what brandContextBuilder — the thing
 * that turns a guideline into AI context — already imports.
 */
export type {
  BrandArchetype,
  BrandPersona,
  BrandToneOfVoiceValue,
  BrandCopyExample,
  BrandPillar,
  BrandCoreMessage,
  BrandManifesto,
  BrandMarketResearch,
  BrandGraphicSystem,
  BrandStrategy as BrandGuidelineStrategy,
} from '../../src/lib/figma-types.js';

import type { BrandStrategy } from '../../src/lib/figma-types.js';

export interface BrandGuideline {
  id?: string;
  userId?: string;
  identity?: BrandGuidelineIdentity;
  logos?: BrandGuidelineLogo[];
  colors?: BrandGuidelineColor[];
  typography?: BrandGuidelineTypography[];
  tags?: Record<string, string[]>;
  media?: BrandGuidelineMedia[];
  tokens?: BrandGuidelineTokens;
  guidelines?: BrandGuidelineGuidelines;
  strategy?: BrandStrategy;
  extraction?: BrandGuidelineExtraction;
  // Design tokens
  gradients?: BrandGuidelineGradient[];
  shadows?: BrandGuidelineShadow[];
  motion?: BrandGuidelineMotion;
  borders?: BrandGuidelineBorder[];
  colorThemes?: Array<{
    id: string;
    name: string;
    bg: string;
    text: string;
    primary: string;
    accent: string;
  }>;
  // Validation state
  validation?: Record<string, 'pending' | 'approved' | 'needs_work'>;
  updatedAt?: string;
  // Organization
  folder?: string;
  // UI preferences
  activeSections?: string[];
  orderedBlocks?: string[];
  // Knowledge RAG
  knowledgeFiles?: Array<{
    id: string;
    fileName: string;
    source: 'pdf' | 'image' | 'url' | 'text';
    vectorIds: string[];
    addedByUserId: string;
    addedAt: string;
  }>;
  // Public sharing
  publicSlug?: string;
  isPublic?: boolean;
  currentVersion?: number;
}

/**
 * Calculate completeness percentage based on filled sections.
 */
/**
 * Persisted completeness score — delegates to the SAME scorer the UI pill uses.
 *
 * This function used to be 14 independent checkboxes, each worth 7.14 points.
 * That made the number lie in both directions: writing three personas, twelve
 * competitors, a SWOT and a full graphic system moved it exactly one checkbox
 * (57 → 64, because `personas`, `marketResearch`, `graphicSystem`, `positioning`
 * and `copyExamples` were not checkboxes at all), while `gradients`, `shadows`,
 * `motion` and `borders` — four fields that barely touch generation quality —
 * were worth 28.5% of the bar between them.
 *
 * Meanwhile `src/lib/brandCompleteness.ts` already scored the same brand with 18
 * weighted rules AND returned the missing ones. Two scorers, two numbers, one
 * brand: the pill said one thing and the API/MCP said another. Reusing it is
 * what makes the number mean the same thing everywhere it is shown.
 */
export function calculateCompleteness(bg: BrandGuideline): number {
  return assessCompleteness(bg).score;
}

/**
 * Full completeness report: score + the rules that are still missing.
 *
 * A bare number tells the owner they are at 64 and nothing about where to spend
 * the next hour. Callers that render or return completeness should prefer this.
 */
export function assessCompleteness(bg: BrandGuideline): CompletenessReport {
  // The two BrandGuideline shapes (this file's persisted type and figma-types')
  // describe the same Mongo document; the scorer only reads optional fields.
  return computeBrandCompleteness(bg as unknown as FigmaBrandGuideline);
}

/**
 * Extraction metadata with a freshly-computed completeness.
 *
 * SSoT for "the brand changed, restate how complete it is". Every write path
 * must go through this: `POST /:id/logos` and `POST /:id/media` did not, which
 * is why uploading a logo and fourteen media files left the score frozen — the
 * assets were on the record and the number had never been asked again.
 */
export function recomputeExtraction(bg: BrandGuideline): { sources: any[]; completeness: number } {
  const previous = (bg as any).extraction || {};
  return {
    ...previous,
    sources: Array.isArray(previous.sources) ? previous.sources : [],
    completeness: calculateCompleteness(bg),
  };
}

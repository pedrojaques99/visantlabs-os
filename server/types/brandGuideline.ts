// server/types/brandGuideline.ts

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
export function calculateCompleteness(bg: BrandGuideline): number {
  const sections = [
    bg.identity?.name ? 1 : 0,
    (bg.logos?.length ?? 0) > 0 ? 1 : 0,
    (bg.colors?.length ?? 0) > 0 ? 1 : 0,
    (bg.typography?.length ?? 0) > 0 ? 1 : 0,
    bg.tags && Object.keys(bg.tags).length > 0 ? 1 : 0,
    bg.guidelines?.voice ? 1 : 0,
    bg.strategy?.manifesto ? 1 : 0,
    bg.strategy?.coreMessage?.product ? 1 : 0,
    (bg.strategy?.pillars?.length ?? 0) > 0 ? 1 : 0,
    (bg.strategy?.archetypes?.length ?? 0) > 0 ? 1 : 0,
    (bg.gradients?.length ?? 0) > 0 ? 1 : 0,
    (bg.shadows?.length ?? 0) > 0 ? 1 : 0,
    bg.motion?.easing ? 1 : 0,
    (bg.borders?.length ?? 0) > 0 ? 1 : 0,
  ];
  return Math.round((sections.reduce((a, b) => a + b, 0) / sections.length) * 100);
}

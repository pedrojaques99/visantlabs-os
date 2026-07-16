/**
 * Scene matcher — the deterministic brain of the free "surprise-me" feed.
 *
 * Given a brand's analyzed assets (placement metadata from assetAnalysis) and the
 * commercial scene catalog (aspect + base luminance + surface kind), it scores
 * every (scene, face, asset) triple and ranks them. No AI, no credits — pure
 * scoring. The endpoint just walks the ranked list by cursor.
 *
 * Why this exists: the credit-free renderer (@visant/psd-engine renderScene) can
 * composite any asset onto any face, but it's "dumb" — someone has to decide WHICH
 * asset belongs on WHICH surface, and in WHICH logo variant, so it looks on-brand
 * instead of wrong. That decision is this module.
 */

import type { BrandAssetKind } from '../lib/brand/visualSignature.js';

export type SurfaceKind =
  | 'apparel'
  | 'card'
  | 'device'
  | 'packaging'
  | 'signage'
  | 'print'
  | 'frame'
  | 'product'
  | 'unknown';

/** Keyword → surface kind. Cheap classifier from the PSD/face name (Fase 1). */
const SURFACE_KEYWORDS: Array<{ kind: SurfaceKind; words: RegExp }> = [
  {
    kind: 'apparel',
    words:
      /tshirt|t-shirt|\btee\b|shirt|hoodie|apparel|garment|fabric|tote|\bcap\b|\bhat\b|jersey|sweater|camiseta|moletom/i,
  },
  {
    kind: 'device',
    words: /phone|iphone|ipad|tablet|laptop|macbook|screen|monitor|device|desktop|celular|tela/i,
  },
  { kind: 'card', words: /business[\s_-]*card|namecard|\bcard\b|cartao|cartão|\bvisit/i },
  {
    kind: 'packaging',
    words:
      /\bbox\b|package|packaging|\bbag\b|bottle|\bcan\b|pouch|\bjar\b|\btube\b|\blabel\b|embalagem|caixa|sacola|garrafa|\brotulo\b/i,
  },
  {
    kind: 'signage',
    words:
      /billboard|outdoor|\bbanner\b|storefront|signage|\bsign\b|facade|fachada|placa|\bwall\b|parede/i,
  },
  {
    kind: 'print',
    words:
      /poster|flyer|brochure|magazine|\bbook\b|letterhead|stationery|\bprint\b|folder|cartaz|revista|papel|folheto/i,
  },
  { kind: 'frame', words: /\bframe\b|\bcanvas\b|wall[\s_-]*art|artframe|quadro|moldura/i },
  { kind: 'product', words: /\bmug\b|\bcup\b|\bglass\b|\bpen\b|\bmug\b|caneca|copo|produto/i },
];

export function classifySurfaceKind(psdFileName: string, faceName?: string): SurfaceKind {
  // Normalize separators to spaces so \b word boundaries work: "_" is a \w char,
  // so /\bbox\b/ would MISS "coffee_box". Turning "_"/"-"/"." into spaces fixes it.
  const hay = `${psdFileName || ''} ${faceName || ''}`.replace(/[^a-z0-9]+/gi, ' ');
  for (const { kind, words } of SURFACE_KEYWORDS) {
    if (words.test(hay)) return kind;
  }
  return 'unknown';
}

export interface AssetForMatch {
  url: string;
  /** Logo variant, when the asset is a logo (primary|dark|light|icon|accent|custom). */
  variant?: string;
  kind?: BrandAssetKind;
  luminance?: 'light' | 'dark' | 'mixed';
  contrastSafeOn?: ('light' | 'dark')[];
  aspectRatio?: number;
  hasTransparency?: boolean;
}

export interface FaceContext {
  aspectRatio?: number; // innerW / innerH
  surfaceKind: SurfaceKind;
  baseLuminance?: 'light' | 'dark' | 'mixed';
}

const LOGO_KINDS: BrandAssetKind[] = ['logo', 'wordmark', 'symbol'];
const ART_KINDS: BrandAssetKind[] = ['graphic', 'photo', 'illustration', 'pattern', 'texture'];

/** Which surfaces each asset kind belongs on (kindFit). */
const KIND_SURFACE_FIT: Record<'logo' | 'art', Partial<Record<SurfaceKind, number>>> = {
  logo: {
    apparel: 1,
    card: 1,
    packaging: 1,
    product: 1,
    device: 0.8,
    signage: 0.7,
    frame: 0.5,
    print: 0.5,
    unknown: 0.6,
  },
  art: {
    signage: 1,
    print: 1,
    frame: 1,
    device: 0.9,
    packaging: 0.7,
    apparel: 0.7,
    card: 0.5,
    product: 0.5,
    unknown: 0.6,
  },
};

/** 0..1 how well two aspect ratios agree (1 = identical, →0 past a 3× mismatch). */
export function aspectFit(a?: number, f?: number): number {
  if (!a || !f || a <= 0 || f <= 0) return 0.5; // unknown → neutral
  const ratio = Math.abs(Math.log(a / f)) / Math.log(3);
  return Math.max(0, 1 - Math.min(1, ratio));
}

/** 0..1 how legible the asset is on the scene's base background. */
export function contrastFit(asset: AssetForMatch, bg?: FaceContext['baseLuminance']): number {
  // A full-bleed (non-transparent) graphic covers the surface — contrast to the
  // scene base is irrelevant; it always reads.
  if (asset.hasTransparency === false) return 1;
  if (!bg) return 0.6; // unknown scene bg → mild neutral

  const safe = asset.contrastSafeOn;
  if (safe && safe.length) {
    if (bg === 'mixed') return safe.includes('light') && safe.includes('dark') ? 1 : 0.6;
    return safe.includes(bg) ? 1 : 0.15;
  }
  // Infer from the asset's own luminance: light art shows on dark bg & vice-versa.
  if (asset.luminance === 'light') return bg === 'dark' ? 1 : bg === 'mixed' ? 0.7 : 0.2;
  if (asset.luminance === 'dark') return bg === 'light' ? 1 : bg === 'mixed' ? 0.7 : 0.2;
  return 0.6; // mixed / unknown asset luminance
}

export function kindFit(kind: BrandAssetKind | undefined, surface: SurfaceKind): number {
  if (!kind) return 0.6;
  const group = LOGO_KINDS.includes(kind) ? 'logo' : ART_KINDS.includes(kind) ? 'art' : null;
  if (!group) return 0.6;
  return KIND_SURFACE_FIT[group][surface] ?? 0.6;
}

export const MATCH_WEIGHTS = { aspect: 0.35, contrast: 0.35, kind: 0.25, transparency: 0.05 };

/** Composite score [0..1] for placing `asset` on `face`. */
export function scoreAssetForFace(asset: AssetForMatch, face: FaceContext): number {
  const w = MATCH_WEIGHTS;
  const aspect = aspectFit(asset.aspectRatio, face.aspectRatio);
  const contrast = contrastFit(asset, face.baseLuminance);
  const kind = kindFit(asset.kind, face.surfaceKind);
  // A transparent logo on a physical product looks pasted-on-nicely; reward it.
  const transparency =
    asset.hasTransparency && asset.kind && LOGO_KINDS.includes(asset.kind) ? 1 : 0.5;
  return aspect * w.aspect + contrast * w.contrast + kind * w.kind + transparency * w.transparency;
}

export interface SceneForMatch {
  psdFileName: string;
  baseLuminance?: 'light' | 'dark' | 'mixed';
  faces: Array<{ key: string; name: string; innerW: number; innerH: number }>;
}

export interface Suggestion {
  psdFileName: string;
  faceKey: string;
  faceName: string;
  assetUrl: string;
  variant?: string;
  surfaceKind: SurfaceKind;
  score: number;
}

export interface RankOptions {
  /** Skip these "psdFileName:faceKey" pairs (MRU / already shown). */
  exclude?: Set<string>;
  /** Minimum score to include (default 0). */
  minScore?: number;
}

/**
 * Rank the best asset for every (scene, face), then keep the single best face per
 * scene so the feed doesn't show the same PSD twice back-to-back. Returns triples
 * sorted best-first; the endpoint walks them by cursor.
 */
export function rankSuggestions(
  assets: AssetForMatch[],
  scenes: SceneForMatch[],
  opts: RankOptions = {}
): Suggestion[] {
  const exclude = opts.exclude ?? new Set<string>();
  const minScore = opts.minScore ?? 0;
  const bestPerScene = new Map<string, Suggestion>();

  for (const scene of scenes) {
    for (const face of scene.faces) {
      const pairKey = `${scene.psdFileName}:${face.key}`;
      if (exclude.has(pairKey)) continue;
      const surfaceKind = classifySurfaceKind(scene.psdFileName, face.name);
      const faceCtx: FaceContext = {
        aspectRatio: face.innerH > 0 ? face.innerW / face.innerH : undefined,
        surfaceKind,
        baseLuminance: scene.baseLuminance,
      };
      let best: Suggestion | null = null;
      for (const asset of assets) {
        const score = scoreAssetForFace(asset, faceCtx);
        if (score < minScore) continue;
        if (!best || score > best.score) {
          best = {
            psdFileName: scene.psdFileName,
            faceKey: face.key,
            faceName: face.name,
            assetUrl: asset.url,
            variant: asset.variant,
            surfaceKind,
            score: +score.toFixed(4),
          };
        }
      }
      if (!best) continue;
      const prev = bestPerScene.get(scene.psdFileName);
      if (!prev || best.score > prev.score) bestPerScene.set(scene.psdFileName, best);
    }
  }

  return [...bestPerScene.values()].sort((a, b) => b.score - a.score);
}

/**
 * Pure helpers + types for brand asset visual analysis. Kept separate from
 * `assetAnalysis.ts` (which pulls in the Gemini SDK) so widely-imported callers
 * like `brandContextBuilder` can aggregate signatures without the LLM dependency.
 */

export interface BrandAssetDimensions {
  vibe?: string[]; // emotional tone: premium, playful, bold, calm, edgy, corporate…
  aesthetic?: string[]; // visual style: minimalist, brutalist, editorial, retro, organic…
  theme?: string[]; // subject/motif: abstract, geometric, nature, urban, human, typographic…
  mood?: string[]; // color/light mood: warm, cool, vibrant, muted, pastel, monochrome…
  medium?: string[]; // treatment: photography, 3d, illustration, vector, flat, gradient, grain…
}

export interface BrandAssetAnalysis {
  description?: string;
  dimensions?: BrandAssetDimensions;
  analyzedAt?: string;
  model?: string;
}

export interface BrandVisualSignature {
  vibe: string[];
  aesthetic: string[];
  theme: string[];
  mood: string[];
  medium: string[];
}

export const SIGNATURE_KEYS: (keyof BrandAssetDimensions)[] = [
  'vibe',
  'aesthetic',
  'theme',
  'mood',
  'medium',
];

/**
 * Aggregate per-asset dimensions into a brand-level visual signature: the most
 * frequent tags across all analyzed assets (top 5 per dimension). This is the
 * compact, derived datum the API exposes for generation context.
 */
export function aggregateVisualSignature(
  assets: Array<{ analysis?: BrandAssetAnalysis | null }>
): BrandVisualSignature {
  const counts: Record<string, Map<string, number>> = {};
  for (const key of SIGNATURE_KEYS) counts[key] = new Map();

  for (const a of assets) {
    const dims = a?.analysis?.dimensions;
    if (!dims) continue;
    for (const key of SIGNATURE_KEYS) {
      for (const raw of dims[key] || []) {
        const tag = String(raw).trim().toLowerCase();
        if (!tag) continue;
        counts[key].set(tag, (counts[key].get(tag) || 0) + 1);
      }
    }
  }

  const top = (key: string) =>
    [...counts[key].entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);

  return {
    vibe: top('vibe'),
    aesthetic: top('aesthetic'),
    theme: top('theme'),
    mood: top('mood'),
    medium: top('medium'),
  };
}

/** True when a signature has at least one tag (worth exposing). */
export function hasSignature(sig: BrandVisualSignature | undefined | null): boolean {
  return (
    !!sig &&
    SIGNATURE_KEYS.some((k) => Array.isArray((sig as any)[k]) && (sig as any)[k].length > 0)
  );
}

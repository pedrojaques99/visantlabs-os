/**
 * assetVectors — semantic search for a brand's own assets (Phase 2 of the asset
 * ingest). Embeds each analyzed asset (image + visual tags) and stores it in the
 * shared Pinecone index under `feature: 'brand-asset'`, scoped by guideline.
 *
 * Reuses existing infra (getMultimodalEmbedding + vectorService) — same shape as
 * the reference-library ingest. Index lookups filter by `feature` + `guidelineId`,
 * so brand-asset vectors never leak across brands or into the reference RAG.
 */
import { getMultimodalEmbedding } from '../../services/geminiService.js';
import { vectorService } from '../../services/vectorService.js';
import type { BrandAssetAnalysis } from './visualSignature.js';

export const BRAND_ASSET_FEATURE = 'brand-asset';

/** Stable vector id so re-analysis overwrites rather than duplicates. */
export function assetVectorId(guidelineId: string, assetId: string): string {
  return `brand-asset:${guidelineId}:${assetId}`;
}

/** True when Pinecone is configured (search/index are no-ops otherwise). */
export function isVectorSearchConfigured(): boolean {
  return !!(process.env.PINECONE_API_KEY || process.env.PINECONE_KEY);
}

export interface IndexableAsset {
  id: string;
  url: string;
  label?: string;
  analysis?: BrandAssetAnalysis | null;
}

function flatTags(analysis?: BrandAssetAnalysis | null): { text: string; meta: Record<string, string[]> } {
  const dims = analysis?.dimensions || {};
  const meta: Record<string, string[]> = {};
  const all: string[] = [];
  for (const [key, vals] of Object.entries(dims)) {
    if (Array.isArray(vals) && vals.length) {
      meta[`dim_${key}`] = vals;
      all.push(...vals);
    }
  }
  return { text: all.join(' '), meta };
}

/**
 * Embed + upsert one asset into Pinecone. Best-effort: returns false on any
 * failure (missing config, embedding error) without throwing, so it never blocks
 * the analysis pipeline. Pass the already-fetched image to avoid re-downloading.
 */
export async function indexAsset(params: {
  guidelineId: string;
  userId: string;
  kind: 'logo' | 'media';
  asset: IndexableAsset;
  image: { data: string; mimeType: string };
}): Promise<boolean> {
  if (!isVectorSearchConfigured()) return false;
  const { guidelineId, userId, kind, asset, image } = params;
  try {
    const { text, meta } = flatTags(asset.analysis);
    const description = asset.analysis?.description || '';
    const { embedding } = await getMultimodalEmbedding([
      { inlineData: { data: image.data, mimeType: image.mimeType } },
      { text: `${description} ${text}`.trim() || asset.label || 'brand asset' },
    ]);

    await vectorService.upsert(assetVectorId(guidelineId, asset.id), embedding, {
      feature: BRAND_ASSET_FEATURE,
      guidelineId,
      userId,
      assetId: asset.id,
      assetKind: kind,
      imageUrl: asset.url,
      ...(asset.label ? { label: asset.label } : {}),
      ...(description ? { text: description.slice(0, 1000) } : {}),
      ...meta,
    });
    return true;
  } catch (err) {
    console.warn('[assetVectors] index failed for', asset.id, (err as any)?.message || err);
    return false;
  }
}

export interface AssetSearchHit {
  assetId: string;
  assetKind: 'logo' | 'media';
  imageUrl?: string;
  label?: string;
  score: number;
}

function toHits(matches: any[]): AssetSearchHit[] {
  return (matches || [])
    .filter((m) => m?.metadata?.assetId)
    .map((m) => ({
      assetId: String(m.metadata.assetId),
      assetKind: (m.metadata.assetKind === 'logo' ? 'logo' : 'media') as 'logo' | 'media',
      imageUrl: m.metadata.imageUrl,
      label: m.metadata.label,
      score: typeof m.score === 'number' ? m.score : 0,
    }));
}

/** Semantic text search within a brand's indexed assets. */
export async function searchAssets(
  guidelineId: string,
  query: string,
  topK = 12
): Promise<AssetSearchHit[]> {
  if (!isVectorSearchConfigured() || !query.trim()) return [];
  const { embedding } = await getMultimodalEmbedding([{ text: query.trim() }]);
  const matches = await vectorService.query(embedding, topK, {
    feature: BRAND_ASSET_FEATURE,
    guidelineId,
  });
  return toHits(matches);
}

/** "More like this" — nearest neighbours of an existing asset (self excluded). */
export async function similarAssets(
  guidelineId: string,
  assetId: string,
  topK = 8
): Promise<AssetSearchHit[]> {
  if (!isVectorSearchConfigured()) return [];
  const matches = await vectorService.queryById(assetVectorId(guidelineId, assetId), topK + 1, {
    feature: BRAND_ASSET_FEATURE,
    guidelineId,
  });
  return toHits(matches).filter((h) => h.assetId !== assetId).slice(0, topK);
}

/** Remove a single asset's vector (call when one logo/media is deleted). */
export async function removeAssetVector(guidelineId: string, assetId: string): Promise<void> {
  if (!isVectorSearchConfigured()) return;
  try {
    await vectorService.delete(assetVectorId(guidelineId, assetId));
  } catch (err) {
    console.warn('[assetVectors] asset cleanup failed for', assetId, (err as any)?.message || err);
  }
}

/** Remove all vectors for a guideline (call on guideline delete). */
export async function removeGuidelineVectors(guidelineId: string): Promise<void> {
  if (!isVectorSearchConfigured()) return;
  try {
    await vectorService.deleteMany({ feature: BRAND_ASSET_FEATURE, guidelineId });
  } catch (err) {
    console.warn('[assetVectors] cleanup failed for', guidelineId, (err as any)?.message || err);
  }
}

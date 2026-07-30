/**
 * referenceIngestor — pipeline de ingestão de referências visuais para o RAG.
 *
 * Orquestra funções existentes (zero infra nova):
 *  1. describeImage()     → análise visual + auto-tag por AI
 *  2. getMultimodalEmbedding() → embedding multimodal da imagem
 *  3. vectorService.upsert()   → Pinecone namespace "reference-examples"
 *  4. MongoDB community_presets → persistência com category "reference"
 */

import { randomUUID, createHash } from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import { computeThumbHash } from '../thumbHash.js';
import { describeImage, getMultimodalEmbedding } from '../../services/geminiService.js';
import { makeSlug, pickName } from '../references/naming.js';
import { vectorService } from '../../services/vectorService.js';
import { connectToMongoDB, getDb } from '../../db/mongodb.js';
import { normalizeCountry, regionForCountry } from '../../../src/lib/references/taxonomy.js';
import { extractImageFacts, type ImageFacts } from '../references/imageFacts.js';
import { hashToUnit } from '../references/feedRanking.js';

export const REFERENCE_NAMESPACE = 'reference-examples';

/** Strip a data-URL prefix, leaving raw base64. */
const rawOf = (base64: string) => base64.replace(/^data:[^;]+;base64,/, '');

/** Content address of the image bytes — the dedup key. */
export function contentHashOf(imageBase64: string): string {
  return createHash('sha256')
    .update(Buffer.from(rawOf(imageBase64), 'base64'))
    .digest('hex');
}

/**
 * Has this exact image already been ingested by this user?
 *
 * Ingest costs 3 AI calls + 2 uploads, and the UI lets people select a pile of
 * images and click once — a double click, or re-picking an image they already
 * saved, used to buy a full duplicate (new `randomUUID`, new embedding, new
 * bill). Scoped per-user: two users saving the same image each own a copy.
 */
export async function findExistingByHash(
  userId: string,
  contentHash: string
): Promise<IngestReferenceResult | null> {
  await connectToMongoDB();
  const doc = await getDb()
    .collection('community_presets')
    .findOne(
      { category: 'reference', contentHash, userId: String(userId) },
      { projection: { _id: 0 } }
    );
  if (!doc) return null;
  return {
    id: doc.id,
    imageUrl: doc.referenceImageUrl,
    thumbnailUrl: doc.thumbnailUrl,
    description: doc.description || '',
    title: doc.name || '',
    studio: doc.studio,
    dimensions: doc.dimensions || {},
    provenance: doc.provenance || {},
    cost: { r2Bytes: 0, inputTokens: 0, outputTokens: 0, embeddingTokens: 0, apiCalls: 0 },
    deduped: true,
  };
}

export interface ReferenceDimensions {
  niche?: string[];
  aesthetic?: string[];
  vibe?: string[];
  lighting?: string[];
  texture?: string[];
  material?: string[];
  angle?: string[];
  color_mood?: string[];
  mockup_type?: string[];
  // Branding/logo dimensions — populated only for logo/identity/brand-system refs
  brand_artifact?: string[];
  logo_construction?: string[];
  type_style?: string[];
}

/**
 * Geographic provenance + source attribution for a reference.
 * Caller-provided values are authoritative (e.g. award metadata); when absent,
 * the AI may infer `country` as a soft tag (flagged via `countryInferred`).
 */
export interface ReferenceProvenance {
  country?: string;
  region?: string;
  countryInferred?: boolean;
  designer?: string;
  sourceUrl?: string;
  awardSource?: string;
  year?: number;
}

export interface IngestReferenceParams {
  imageBase64: string;
  imageUrl: string;
  name?: string;
  studio?: string;
  userId: string;
  overrideDimensions?: Partial<ReferenceDimensions>;
  tags?: string[];
  prompt?: string;
  /** Authoritative provenance — caller wins over AI inference. */
  country?: string;
  region?: string;
  designer?: string;
  sourceUrl?: string;
  awardSource?: string;
  year?: number;
  /** When true, the reference is browsable in the public library. */
  isPublic?: boolean;
  /** When false, the reference enters a moderation queue (user uploads). */
  isAdminCurated?: boolean;
  /**
   * Brands this reference is associated with. A soft, many-to-many TAG — refs
   * stay user-scoped and the global library stays shared. Ranking still uses
   * `brandTerms` and is orthogonal to this.
   */
  brandGuidelineIds?: string[];
  /** Skip the dedup probe (backfills / deliberate re-ingest). */
  force?: boolean;
}

export interface IngestCostMetrics {
  r2Bytes: number;
  inputTokens: number;
  outputTokens: number;
  embeddingTokens: number;
  apiCalls: number;
}

export interface IngestReferenceResult {
  id: string;
  imageUrl: string;
  thumbnailUrl: string;
  description: string;
  title: string;
  studio?: string;
  dimensions: ReferenceDimensions;
  provenance: ReferenceProvenance;
  cost: IngestCostMetrics;
  /** True when an identical image was already owned — nothing was spent. */
  deduped?: boolean;
  /** Objective facts (pixel size, palette). Absent if extraction failed. */
  facts?: ImageFacts;
}

const DIMENSION_PROMPT = `Analyze this design reference image. It may be a product/mockup photo, a logo, or a full brand identity / guideline layout.

FIRST classify the image into one of:
  (a) product/mockup photo  → fill the photographic dims (lighting, texture, material, angle, mockup_type)
  (b) logo / logotype       → fill logo_construction + type_style + brand_artifact:["logo"]
  (c) brand identity system / guideline / editorial layout → fill brand_artifact + (type_style when type is shown)
ALWAYS fill the shared dims (niche, aesthetic, vibe, color_mood) for any image.
Leave irrelevant dims as EMPTY arrays — do NOT invent lighting/material/angle for a flat logo.

Return JSON with:
{
  "description": "Detailed visual description in English for prompt engineering",
  "title": "Short descriptive title in Portuguese",
  "dimensions": {
    "niche": ["industry/market niche, e.g. luxury, tech, food, fashion, beauty, sports"],
    "aesthetic": ["visual style, e.g. minimalist, brutalist, organic, retro, editorial, swiss"],
    "vibe": ["mood/feeling, e.g. premium, playful, corporate, edgy, warm, serene"],
    "lighting": ["mockup only — lighting technique, e.g. soft studio, golden hour, neon, flat, dramatic, rim"],
    "texture": ["mockup only — surface textures, e.g. marble, concrete, wood, fabric, glossy, matte"],
    "material": ["mockup only — physical materials, e.g. vinyl, metal, glass, paper, cardboard, ceramic"],
    "angle": ["mockup only — camera angle, e.g. top-down, isometric, hero, close-up, eye-level, 45-degree"],
    "color_mood": ["color feeling, e.g. warm, cold, monochrome, vibrant, pastel, earth-tones"],
    "mockup_type": ["mockup only — what is mocked up, e.g. packaging, stationery, apparel, signage, device, bottle"],
    "brand_artifact": ["branding only — what this is, e.g. logo, brand-system, typography-spec, color-palette, iconography, pattern, editorial-layout, stationery, guideline"],
    "logo_construction": ["logo only — mark structure, e.g. wordmark, lettermark, monogram, pictorial-mark, abstract-mark, emblem, combination-mark, mascot"],
    "type_style": ["logo/branding only — typography, e.g. serif, grotesque-sans, geometric-sans, humanist-sans, display, script, mono, custom-lettering"]
  },
  "geoHint": {
    "country": "Best guess of the country/design-culture of origin based on visual cues (script, language on artwork, typographic tradition, e.g. Japan, Switzerland, Russia). Empty string if no confident signal.",
    "confidence": "low | medium | high"
  }
}

Each filled dimension array should have 1-3 values. Be precise and specific. Only fill geoHint.country when there is a real visual signal (visible script, language, culturally distinctive style); otherwise leave it empty.`;

interface GeoHint {
  country?: string;
  confidence?: 'low' | 'medium' | 'high';
}

/**
 * Cheap phase: store the image and everything computable without a model.
 *
 * Runs on every upload — hash + dedup + R2 + thumbnail + thumbHash + pixel
 * facts + the Mongo doc. NO AI, NO Pinecone, NO credits. The doc lands
 * `enriched: false` and, for user uploads, `status: 'pending'` — it isn't
 * publicly visible and hasn't cost a model call. `enrichReference` fills in the
 * AI fields later, gated on approval.
 *
 * Trusted callers (admin / batch / MCP, `isAdminCurated !== false`) land
 * `status: 'approved'` — the full pipeline runs for them via `ingestReference`.
 */
export async function ingestReferenceLight(
  params: IngestReferenceParams
): Promise<IngestReferenceResult> {
  const { imageBase64, imageUrl, name, studio, userId, tags, prompt } = params;
  const id = randomUUID();

  // 0. Dedup probe — content-addressed, per user.
  const contentHash = contentHashOf(imageBase64);
  if (!params.force) {
    const existing = await findExistingByHash(userId, contentHash);
    if (existing) return existing;
  }

  // Provenance is resolvable without a model when the caller supplies it; the
  // AI geoHint fallback belongs to the enrichment phase.
  const resolvedCountry = normalizeCountry(params.country);
  const resolvedRegion = params.region || regionForCountry(resolvedCountry);
  const provenance: ReferenceProvenance = {
    ...(resolvedCountry ? { country: resolvedCountry } : {}),
    ...(resolvedRegion ? { region: resolvedRegion } : {}),
    ...(params.designer ? { designer: params.designer } : {}),
    ...(params.sourceUrl ? { sourceUrl: params.sourceUrl } : {}),
    ...(params.awardSource ? { awardSource: params.awardSource } : {}),
    ...(params.year ? { year: params.year } : {}),
  };

  const rawBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');

  // Thumbnail (non-fatal — falls back to full image).
  let thumbnailUrl = imageUrl;
  try {
    const { uploadReferenceThumb } = await import('../../../src/services/r2Service.js');
    thumbnailUrl = await uploadReferenceThumb(rawBase64, id);
  } catch (err) {
    console.warn('[referenceIngestor] thumbnail generation failed, using full image:', err);
  }

  // Objective pixel facts — arithmetic, not inference.
  const imageBuffer = Buffer.from(rawBase64, 'base64');
  const [thumbHash, facts] = await Promise.all([
    computeThumbHash(imageBuffer),
    extractImageFacts(imageBuffer),
  ]);

  const trusted = params.isAdminCurated !== false;
  await connectToMongoDB();
  const db = getDb();
  const doc = {
    id,
    // No AI title yet. `pickName` rejects filenames/placeholders, so enrichment
    // can later replace this without a real caller title being overwritten.
    name: pickName(name),
    slug: makeSlug(name, id),
    description: '',
    prompt: prompt || '',
    referenceImageUrl: imageUrl,
    thumbnailUrl,
    ...(thumbHash ? { thumbHash } : {}),
    contentHash,
    // Stable [0,1) key for the ranked feed's shuffle window (see engine.ts).
    shuffleKey: hashToUnit(id),
    category: 'reference',
    ...(studio ? { studio } : {}),
    isAdminCurated: trusted,
    // Trusted content is approved on arrival; a user upload waits for a human.
    status: trusted ? 'approved' : 'pending',
    isApproved: trusted,
    isPublic: params.isPublic ?? trusted,
    enriched: false,
    dimensions: {} as ReferenceDimensions,
    provenance,
    ...(facts.width ? { width: facts.width, height: facts.height } : {}),
    ...(facts.aspectRatio ? { aspectRatio: facts.aspectRatio } : {}),
    ...(facts.palette?.length ? { palette: facts.palette } : {}),
    ...(params.brandGuidelineIds?.length ? { brandGuidelineIds: params.brandGuidelineIds } : {}),
    ...(provenance.country ? { country: provenance.country } : {}),
    ...(provenance.region ? { region: provenance.region } : {}),
    ...(provenance.sourceUrl ? { sourceUrl: provenance.sourceUrl } : {}),
    // Only caller-supplied tags for now — dimension-derived tags come with enrichment.
    tags: tags || [],
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection('community_presets').insertOne(doc);

  return {
    id,
    imageUrl,
    thumbnailUrl,
    description: '',
    title: doc.name,
    studio,
    dimensions: {},
    provenance,
    cost: { r2Bytes: 0, inputTokens: 0, outputTokens: 0, embeddingTokens: 0, apiCalls: 0 },
    facts,
  };
}

/**
 * Expensive phase: run the AI analysis on an already-stored reference and patch
 * the doc in place. Fetches the image back from R2 (Cloudflare → zero egress),
 * so it needs only the id — which is what lets approval trigger it minutes or
 * days after upload, from a request that never had the original bytes.
 *
 * Sets `enriched: true` but does NOT touch `status`/`isApproved` — the caller
 * owns visibility, and must only approve AFTER this resolves, so a ref never
 * surfaces without its dimensions and vector.
 */
export async function enrichReference(id: string): Promise<IngestReferenceResult> {
  await connectToMongoDB();
  const db = getDb();
  const doc = await db.collection('community_presets').findOne({ id, category: 'reference' });
  if (!doc) throw new Error(`Reference ${id} not found`);

  const imageUrl = doc.referenceImageUrl as string;
  const resp = await fetch(imageUrl);
  if (!resp.ok) throw new Error(`Failed to fetch reference image (${resp.status})`);
  const rawBase64 = Buffer.from(await resp.arrayBuffer()).toString('base64');
  const imageBase64 = `data:image/png;base64,${rawBase64}`;

  const userId = String(doc.userId);
  const studio = doc.studio as string | undefined;
  const tags = Array.isArray(doc.tags) ? (doc.tags as string[]) : undefined;
  const prompt = (doc.prompt as string) || '';
  let geoHint: GeoHint = {};
  const cost: IngestCostMetrics = {
    r2Bytes: Math.ceil(rawBase64.length * 0.75),
    inputTokens: 0,
    outputTokens: 0,
    embeddingTokens: 0,
    apiCalls: 0,
  };

  // 1. AI analysis — reuses describeImage() but with dimension-aware prompt
  const analysis = await describeImage(imageBase64);
  cost.inputTokens += analysis.inputTokens || 0;
  cost.outputTokens += analysis.outputTokens || 0;
  cost.apiCalls++;

  // 2. Extract dimensions via structured Gemini call
  const apiKey = (
    process.env.VITE_GEMINI_API_KEY ||
    process.env.VITE_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ''
  ).trim();
  const ai = new GoogleGenAI({ apiKey });

  const name = doc.name as string | undefined;
  let dimensions: ReferenceDimensions = {};
  try {
    const dimResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: imageBase64.replace(/^data:[^;]+;base64,/, ''),
                mimeType: 'image/png',
              },
            },
            { text: DIMENSION_PROMPT },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            dimensions: {
              type: Type.OBJECT,
              properties: {
                niche: { type: Type.ARRAY, items: { type: Type.STRING } },
                aesthetic: { type: Type.ARRAY, items: { type: Type.STRING } },
                vibe: { type: Type.ARRAY, items: { type: Type.STRING } },
                lighting: { type: Type.ARRAY, items: { type: Type.STRING } },
                texture: { type: Type.ARRAY, items: { type: Type.STRING } },
                material: { type: Type.ARRAY, items: { type: Type.STRING } },
                angle: { type: Type.ARRAY, items: { type: Type.STRING } },
                color_mood: { type: Type.ARRAY, items: { type: Type.STRING } },
                mockup_type: { type: Type.ARRAY, items: { type: Type.STRING } },
                brand_artifact: { type: Type.ARRAY, items: { type: Type.STRING } },
                logo_construction: { type: Type.ARRAY, items: { type: Type.STRING } },
                type_style: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
            geoHint: {
              type: Type.OBJECT,
              properties: {
                country: { type: Type.STRING },
                confidence: { type: Type.STRING },
              },
            },
          },
        },
      },
    });
    const parsed = JSON.parse((dimResponse.text || '').trim());
    dimensions = parsed.dimensions || {};
    geoHint = parsed.geoHint || {};
    const dimUsage = (dimResponse as any).usageMetadata;
    cost.inputTokens += dimUsage?.promptTokenCount || 0;
    cost.outputTokens += dimUsage?.candidatesTokenCount || 0;
    cost.apiCalls++;
  } catch (err) {
    console.warn('[referenceIngestor] dimension extraction failed, using empty:', err);
  }

  // 2b. Enrich provenance with the AI geoHint, but never overwrite what the
  // uploader gave (or the light phase already resolved) — caller wins.
  const existingProv = (doc.provenance || {}) as ReferenceProvenance;
  const provenance: ReferenceProvenance = { ...existingProv };
  if (!provenance.country && geoHint.country && geoHint.confidence !== 'low') {
    const inferred = normalizeCountry(geoHint.country);
    if (inferred) {
      provenance.country = inferred;
      provenance.countryInferred = true;
      if (!provenance.region) provenance.region = regionForCountry(inferred);
    }
  }

  // 3. Multimodal embedding
  cost.apiCalls++;
  const { embedding } = await getMultimodalEmbedding([
    { inlineData: { data: rawBase64, mimeType: 'image/png' } },
    { text: `${analysis.description} ${Object.values(dimensions).flat().join(' ')}` },
  ]);

  // 4. Pinecone upsert — flat metadata for Pinecone compatibility
  const flatDimensions: Record<string, string[]> = {};
  for (const [key, val] of Object.entries(dimensions)) {
    if (Array.isArray(val) && val.length > 0) {
      flatDimensions[`dim_${key}`] = val;
    }
  }

  await vectorService.upsert(id, embedding, {
    namespace: REFERENCE_NAMESPACE,
    feature: 'reference',
    userId,
    imageUrl,
    text: analysis.description.slice(0, 1000),
    prompt,
    title: analysis.title || name || '',
    ...(studio ? { studio } : {}),
    ...flatDimensions,
    ...(tags?.length ? { tags } : {}),
    ...(provenance.country ? { country: provenance.country } : {}),
    ...(provenance.region ? { region: provenance.region } : {}),
    ...(provenance.designer ? { designer: provenance.designer } : {}),
    ...(provenance.awardSource ? { awardSource: provenance.awardSource } : {}),
    ...(provenance.year ? { year: provenance.year } : {}),
  });

  // 5. Patch the existing doc with the AI-derived fields. `name` keeps a REAL
  // human title, but a placeholder (`'Reference'`, `IMG_2841.jpg`, `Untitled`)
  // loses to the AI title — the old `name || analysis.title` guard treated the
  // truthy ingest fallback as a real name and shadowed the AI title forever.
  const resolvedName = pickName(name, analysis.title);
  const dimTags = Object.values(dimensions).flat();
  await db.collection('community_presets').updateOne(
    { id, category: 'reference' },
    {
      $set: {
        name: resolvedName,
        slug: makeSlug(resolvedName, id),
        description: analysis.description,
        dimensions,
        provenance,
        enriched: true,
        // Only overwrite auto-tags; keep caller tags if they set any.
        ...(tags?.length ? {} : { tags: dimTags }),
        ...(provenance.country ? { country: provenance.country } : {}),
        ...(provenance.region ? { region: provenance.region } : {}),
        updatedAt: new Date(),
      },
    }
  );

  // 6. Track enrichment cost as a usage record
  await db.collection('usage_records').insertOne({
    userId,
    feature: 'reference-ingest',
    model: 'gemini-2.5-flash',
    timestamp: new Date(),
    inputTokens: cost.inputTokens,
    outputTokens: cost.outputTokens,
    r2Bytes: cost.r2Bytes,
    apiCalls: cost.apiCalls,
    imagesGenerated: 0,
    hasInputImage: true,
    cost: (cost.inputTokens * 0.15 + cost.outputTokens * 0.6) / 1_000_000,
    referenceId: id,
  });

  return {
    id,
    imageUrl,
    thumbnailUrl: doc.thumbnailUrl,
    description: analysis.description,
    title: analysis.title || '',
    studio,
    dimensions,
    provenance,
    cost,
  };
}

/**
 * Full pipeline: cheap ingest + immediate enrichment. Backward-compatible entry
 * point for every TRUSTED caller (admin UI, batch script, MCP) — user uploads
 * use `ingestReferenceLight` and defer enrichment to approval.
 */
export async function ingestReference(
  params: IngestReferenceParams
): Promise<IngestReferenceResult> {
  const light = await ingestReferenceLight(params);
  if (light.deduped) return light;
  // overrideDimensions is a trusted-only nicety; if present, apply after enrich.
  const enriched = await enrichReference(light.id);
  if (params.overrideDimensions) {
    await connectToMongoDB();
    const merged = { ...enriched.dimensions, ...params.overrideDimensions };
    await getDb()
      .collection('community_presets')
      .updateOne({ id: light.id }, { $set: { dimensions: merged } });
    enriched.dimensions = merged;
  }
  return enriched;
}

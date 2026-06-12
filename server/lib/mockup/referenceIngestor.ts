/**
 * referenceIngestor — pipeline de ingestão de referências visuais para o RAG.
 *
 * Orquestra funções existentes (zero infra nova):
 *  1. describeImage()     → análise visual + auto-tag por AI
 *  2. getMultimodalEmbedding() → embedding multimodal da imagem
 *  3. vectorService.upsert()   → Pinecone namespace "reference-examples"
 *  4. MongoDB community_presets → persistência com category "reference"
 */

import { randomUUID } from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import { describeImage, getMultimodalEmbedding } from '../../services/geminiService.js';
import { vectorService } from '../../services/vectorService.js';
import { connectToMongoDB, getDb } from '../../db/mongodb.js';
import { normalizeCountry, regionForCountry } from '../../../src/lib/references/taxonomy.js';

export const REFERENCE_NAMESPACE = 'reference-examples';

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
  description: string;
  title: string;
  studio?: string;
  dimensions: ReferenceDimensions;
  provenance: ReferenceProvenance;
  cost: IngestCostMetrics;
}

const DIMENSION_PROMPT = `Analyze this mockup/product photography reference image.

Return JSON with:
{
  "description": "Detailed visual description in English for prompt engineering",
  "title": "Short descriptive title in Portuguese",
  "dimensions": {
    "niche": ["industry/market niche, e.g. luxury, tech, food, fashion, beauty, sports"],
    "aesthetic": ["visual style, e.g. minimalist, brutalist, organic, retro, editorial, swiss"],
    "vibe": ["mood/feeling, e.g. premium, playful, corporate, edgy, warm, serene"],
    "lighting": ["lighting technique, e.g. soft studio, golden hour, neon, flat, dramatic, rim"],
    "texture": ["surface textures visible, e.g. marble, concrete, wood, fabric, glossy, matte"],
    "material": ["physical materials, e.g. vinyl, metal, glass, paper, cardboard, ceramic"],
    "angle": ["camera angle, e.g. top-down, isometric, hero, close-up, eye-level, 45-degree"],
    "color_mood": ["color feeling, e.g. warm, cold, monochrome, vibrant, pastel, earth-tones"],
    "mockup_type": ["what is being mocked up, e.g. packaging, stationery, apparel, signage, device, bottle"]
  },
  "geoHint": {
    "country": "Best guess of the country/design-culture of origin based on visual cues (script, language on artwork, typographic tradition, e.g. Japan, Switzerland, Russia). Empty string if no confident signal.",
    "confidence": "low | medium | high"
  }
}

Each dimension array should have 1-3 values. Be precise and specific. Only fill geoHint.country when there is a real visual signal (visible script, language, culturally distinctive style); otherwise leave it empty.`;

interface GeoHint {
  country?: string;
  confidence?: 'low' | 'medium' | 'high';
}

export async function ingestReference(
  params: IngestReferenceParams
): Promise<IngestReferenceResult> {
  const { imageBase64, imageUrl, name, studio, userId, overrideDimensions, tags, prompt } = params;
  const id = randomUUID();
  let geoHint: GeoHint = {};
  const cost: IngestCostMetrics = {
    r2Bytes: 0,
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

  // Apply manual overrides
  if (overrideDimensions) {
    dimensions = { ...dimensions, ...overrideDimensions };
  }

  // 2b. Resolve provenance — caller-provided wins; AI geoHint is a soft fallback
  let resolvedCountry = normalizeCountry(params.country);
  let countryInferred = false;
  if (!resolvedCountry && geoHint.country && geoHint.confidence !== 'low') {
    resolvedCountry = normalizeCountry(geoHint.country);
    countryInferred = !!resolvedCountry;
  }
  const resolvedRegion = params.region || regionForCountry(resolvedCountry);
  const provenance: ReferenceProvenance = {
    ...(resolvedCountry ? { country: resolvedCountry } : {}),
    ...(resolvedRegion ? { region: resolvedRegion } : {}),
    ...(countryInferred ? { countryInferred: true } : {}),
    ...(params.designer ? { designer: params.designer } : {}),
    ...(params.sourceUrl ? { sourceUrl: params.sourceUrl } : {}),
    ...(params.awardSource ? { awardSource: params.awardSource } : {}),
    ...(params.year ? { year: params.year } : {}),
  };

  // 3. Multimodal embedding of the image + R2 size tracking
  const rawBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
  cost.r2Bytes = Math.ceil(rawBase64.length * 0.75); // base64 → bytes approximation
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
    prompt: prompt || '',
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

  // 5. MongoDB — reuse community_presets with category "reference"
  await connectToMongoDB();
  const db = getDb();
  const doc = {
    id,
    name: name || analysis.title || 'Reference',
    description: analysis.description,
    prompt: prompt || '',
    referenceImageUrl: imageUrl,
    category: 'reference',
    ...(studio ? { studio } : {}),
    isAdminCurated: params.isAdminCurated !== false,
    isApproved: params.isAdminCurated !== false,
    isPublic: params.isPublic ?? params.isAdminCurated !== false,
    dimensions,
    provenance,
    ...(provenance.country ? { country: provenance.country } : {}),
    ...(provenance.region ? { region: provenance.region } : {}),
    ...(provenance.sourceUrl ? { sourceUrl: provenance.sourceUrl } : {}),
    tags: tags || Object.values(dimensions).flat(),
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection('community_presets').insertOne(doc);

  // 6. Track ingest cost as a usage record
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
    description: analysis.description,
    title: analysis.title || '',
    studio,
    dimensions,
    provenance,
    cost,
  };
}

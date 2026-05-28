/**
 * referenceIngestor — pipeline de ingestão de referências visuais para o RAG.
 *
 * Orquestra funções existentes (zero infra nova):
 *  1. describeImage()     → análise visual + auto-tag por AI
 *  2. getMultimodalEmbedding() → embedding multimodal da imagem
 *  3. vectorService.upsert()   → Pinecone namespace "reference-examples"
 *  4. MongoDB community_presets → persistência com category "reference"
 */

import { v4 as uuid } from 'uuid';
import { GoogleGenAI, Type } from '@google/genai';
import { describeImage, getMultimodalEmbedding } from '../../services/geminiService.js';
import { vectorService } from '../../services/vectorService.js';
import { connectToMongoDB, getDb } from '../../db/mongodb.js';

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

export interface IngestReferenceParams {
  imageBase64: string;
  imageUrl: string;
  name?: string;
  userId: string;
  overrideDimensions?: Partial<ReferenceDimensions>;
  tags?: string[];
  prompt?: string;
}

export interface IngestReferenceResult {
  id: string;
  imageUrl: string;
  description: string;
  title: string;
  dimensions: ReferenceDimensions;
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
  }
}

Each dimension array should have 1-3 values. Be precise and specific.`;

export async function ingestReference(params: IngestReferenceParams): Promise<IngestReferenceResult> {
  const { imageBase64, imageUrl, name, userId, overrideDimensions, tags, prompt } = params;
  const id = uuid();

  // 1. AI analysis — reuses describeImage() but with dimension-aware prompt
  const analysis = await describeImage(imageBase64);

  // 2. Extract dimensions via structured Gemini call
  const apiKey = (process.env.VITE_GEMINI_API_KEY || process.env.VITE_API_KEY || process.env.GEMINI_API_KEY || '').trim();
  const ai = new GoogleGenAI({ apiKey });

  let dimensions: ReferenceDimensions = {};
  try {
    const dimResponse = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{
        parts: [
          { inlineData: { data: imageBase64.replace(/^data:[^;]+;base64,/, ''), mimeType: 'image/png' } },
          { text: DIMENSION_PROMPT },
        ],
      }],
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
          },
        },
      },
    });
    const parsed = JSON.parse((dimResponse.text || '').trim());
    dimensions = parsed.dimensions || {};
  } catch (err) {
    console.warn('[referenceIngestor] dimension extraction failed, using empty:', err);
  }

  // Apply manual overrides
  if (overrideDimensions) {
    dimensions = { ...dimensions, ...overrideDimensions };
  }

  // 3. Multimodal embedding of the image
  const rawBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
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
    ...flatDimensions,
    ...(tags?.length ? { tags } : {}),
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
    isAdminCurated: true,
    isApproved: true,
    dimensions,
    tags: tags || Object.values(dimensions).flat(),
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection('community_presets').insertOne(doc);

  return {
    id,
    imageUrl,
    description: analysis.description,
    title: analysis.title || '',
    dimensions,
  };
}

// server/lib/brand-extract.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ParsedChunk } from './brand-parse.js';
import { stripDataUriPrefix } from './dataUri.js';
import { BrandGuideline } from '../types/brandGuideline.js';
import { getGeminiApiKey } from '../utils/geminiApiKey.js';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';
import { sanitizeForPrompt } from '../utils/promptSanitize.js';

const EXTRACTION_PROMPT = `You are a brand identity extraction expert. Analyze the content and extract ALL brand guideline information you can find.

Return ONLY a JSON object with fields you can identify with confidence. Omit unknown fields. Do NOT guess.

Schema:
{
  "identity": { "name": "...", "website": "...", "tagline": "...", "description": "..." },
  "colors": [{ "hex": "#RRGGBB", "name": "...", "role": "primary|secondary|accent|background|text|cta" }],
  "typography": [{ "family": "Font Name", "style": "Bold|Regular", "role": "heading|body|accent|mono" }],
  "tags": { "brand_values": ["value1", "value2"], "tone": ["tone1"], "aesthetic": ["aes1"] },
  "guidelines": { "voice": "overall tone summary", "dos": ["do this", "..."], "donts": ["avoid this", "..."], "imagery": "visual style description" },
  "tokens": { "spacing": { "xs": 4 }, "radius": { "sm": 4 } },
  "strategy": {
    "manifesto": { "provocation": "...", "tension": "...", "promise": "...", "full": "full manifesto text" },
    "coreMessage": { "product": "what the brand sells", "differential": "what sets it apart", "emotionalBond": "the feeling it transmits" },
    "pillars": [{ "value": "Pillar name", "description": "why it matters" }],
    "positioning": ["positioning statement 1", "positioning statement 2"],
    "archetypes": [
      { "name": "Archetype Name", "role": "primary|secondary", "description": "what this archetype means for the brand", "examples": ["Brand A", "Brand B"] }
    ],
    "personas": [
      { "name": "Persona Name", "age": 26, "occupation": "Job title", "traits": ["trait1", "trait2"], "bio": "brief bio", "desires": ["desire1", "desire2"], "painPoints": ["pain1"] }
    ],
    "voiceValues": [
      { "title": "Voice Quality Name", "description": "how it sounds in practice", "example": "Example phrase in this voice" }
    ],
    "copyExamples": [
      { "text": "A real headline exactly as it appears in the source", "type": "headline|tagline|cta|body" }
    ]
  },
  "assetClassifications": [
    { "index": 0, "category": "logo|icon|photo|mockup|pattern|strategy|other", "logoVariant": "primary|dark|light|icon|accent|custom", "label": "descriptive name" }
  ]
}

Asset classification rules (apply to each image passed, by index order):
- "logo": wordmarks, logotypes, brandmarks with the brand name or symbol
- "icon": standalone symbols/marks without text, app icons
- "photo": lifestyle photos, editorial photography, real-world scenes
- "mockup": product mockups, packaging renders, branded item visuals
- "pattern": repeating patterns, textures, backgrounds
- "strategy": strategy boards, presentations, brand guideline pages, competitor analysis, mood boards
- "other": anything that doesn't fit above

Rules:
- Colors MUST be valid hex (#RGB or #RRGGBB)
- Font families must be exact names (e.g., "Inter", not "sans-serif")
- For strategy documents: extract ALL personas, archetypes, tone of voice values, positioning, manifesto, core message, pillars, brand values
- archetypes/personas/voiceValues MUST be objects (not plain strings)
- manifesto: put the verbatim text in "full". Only fill provocation/tension/promise when the source itself lays the manifesto out in that arc — never split a text yourself to invent the structure. If there's only running text, "full" alone is the correct answer.
- coreMessage: many decks state this as one sentence — "<product> with the differential of <differential>, transmitting <emotionalBond>". Split that sentence into its three parts. If the source never states it, omit the field; do NOT derive it from the tagline or description.
- copyExamples: transcribe real copy VERBATIM — headlines, taglines, CTAs the brand actually published in the source. Never write new copy, never improve or translate one, and skip generic UI text ("Saiba mais", "Enviar"). These are fed back as few-shot for generation, so an invented line teaches the model to imitate a fake brand. Omit the field entirely rather than pad it.
- assetClassifications must have one entry per image, in the same order images were provided
- Return ONLY valid JSON, no markdown fences, no explanation`;

/** Copy only the named keys that came back as non-empty strings, trimmed. */
function pickStrings<K extends string>(src: any, keys: readonly K[]): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  for (const k of keys) {
    const v = src?.[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim();
  }
  return out;
}

export interface AssetClassification {
  index: number;
  category: 'logo' | 'icon' | 'photo' | 'mockup' | 'pattern' | 'strategy' | 'other';
  logoVariant?: 'primary' | 'dark' | 'light' | 'icon' | 'accent' | 'custom';
  label?: string;
}

export interface ExtractedBrandData extends Partial<BrandGuideline> {
  assetClassifications?: AssetClassification[];
}

export async function extractBrandData(
  chunks: ParsedChunk[],
  images?: string[],
  userId?: string
): Promise<ExtractedBrandData> {
  const apiKey = await getGeminiApiKey(userId);
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured for brand extraction');

  const combinedText = chunks
    .map((c) => `--- ${c.source} (${c.type}) ---\n${c.text}`)
    .join('\n\n')
    .slice(0, 20000); // limit tokens — strategy docs need more space

  const genAI = new GoogleGenerativeAI(apiKey);
  // GEMINI_MODELS.TEXT is gemini-3-flash which is multimodal
  const model = genAI.getGenerativeModel({ model: GEMINI_MODELS.TEXT });

  const parts: any[] = [
    { text: EXTRACTION_PROMPT + '\n\nContent:\n' + sanitizeForPrompt(combinedText, 20000) },
  ];

  if (images && images.length > 0) {
    for (const imgBase64 of images) {
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: stripDataUriPrefix(imgBase64),
        },
      });
    }
  }

  // NOTE: a *successful* call that legitimately finds no brand info returns `{}`
  // (the LLM emits valid empty/minimal JSON → validateExtracted strips it). Only a
  // genuine failure — network, parse, quota/spend-cap — throws here. We deliberately
  // do NOT swallow exceptions into `{}`: that masqueraded a failed extraction as
  // "found nothing", letting the caller charge a credit and report false success.
  try {
    const result = await model.generateContent(parts);
    const text = result.response.text();
    const jsonStr = extractJson(text);
    return validateExtracted(JSON.parse(jsonStr));
  } catch (error: any) {
    const raw = String(error?.message || error || '');
    console.error('[Brand Extract] LLM extraction failed:', raw);
    // Normalize the most common hard failures to a stable, mappable message.
    if (/quota|RESOURCE_EXHAUSTED|rate.?limit|429/i.test(raw)) {
      throw new Error(
        'extraction_unavailable: AI extraction is temporarily over quota — try again shortly.'
      );
    }
    if (/api[_ ]?key|permission|401|403/i.test(raw)) {
      throw new Error('extraction_unavailable: AI extraction is not configured.');
    }
    throw new Error(
      'extraction_failed: could not read brand data from this source. Try a simpler or smaller source, or add details manually.'
    );
  }
}

function extractJson(text: string): string {
  const codeBlock = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlock) return codeBlock[1].trim();
  const raw = text.match(/\{[\s\S]*\}/);
  if (raw) return raw[0];
  throw new Error('No JSON in LLM response');
}

/** Exported for tests — pure, and the only thing standing between an LLM's JSON and the DB. */
export function validateExtracted(data: any): ExtractedBrandData {
  const result: ExtractedBrandData = {};

  if (data.identity && typeof data.identity === 'object') {
    result.identity = {};
    for (const k of ['name', 'website', 'tagline', 'description'] as const) {
      if (typeof data.identity[k] === 'string') (result.identity as any)[k] = data.identity[k];
    }
  }

  if (Array.isArray(data.colors)) {
    result.colors = data.colors
      .filter((c: any) => c.hex && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(c.hex))
      .map((c: any) => ({
        hex: c.hex.toUpperCase(),
        name: c.name || c.hex,
        role: c.role || undefined,
      }));
  }

  if (Array.isArray(data.typography)) {
    result.typography = data.typography
      .filter((t: any) => typeof t.family === 'string')
      .map((t: any) => ({
        family: t.family,
        style: t.style || undefined,
        role: t.role || 'body',
        size: typeof t.size === 'number' ? t.size : undefined,
        lineHeight: typeof t.lineHeight === 'number' ? t.lineHeight : undefined,
      }));
  }

  if (data.tags && typeof data.tags === 'object') {
    result.tags = {};
    for (const [k, v] of Object.entries(data.tags)) {
      if (Array.isArray(v)) result.tags[k] = v.filter((x: any) => typeof x === 'string');
    }
  }

  if (data.guidelines && typeof data.guidelines === 'object') {
    result.guidelines = {};
    const g = data.guidelines;
    if (typeof g.voice === 'string') result.guidelines.voice = g.voice;
    if (Array.isArray(g.dos))
      result.guidelines.dos = g.dos.filter((d: any) => typeof d === 'string');
    if (Array.isArray(g.donts))
      result.guidelines.donts = g.donts.filter((d: any) => typeof d === 'string');
    if (typeof g.imagery === 'string') result.guidelines.imagery = g.imagery;
  }

  if (data.strategy && typeof data.strategy === 'object') {
    result.strategy = {};
    const s = data.strategy;

    // Accept both shapes: legacy sources give a flat string, the structured arc
    // (provocação/tensão/promessa) only shows up when the deck spells it out.
    if (typeof s.manifesto === 'string' && s.manifesto.trim()) {
      result.strategy.manifesto = s.manifesto.trim();
    } else if (s.manifesto && typeof s.manifesto === 'object') {
      const man = pickStrings(s.manifesto, ['provocation', 'tension', 'promise', 'full']);
      if (Object.keys(man).length) result.strategy.manifesto = man;
    }

    // All three parts or nothing — a half core message reads as a broken sentence.
    if (s.coreMessage && typeof s.coreMessage === 'object') {
      const core = pickStrings(s.coreMessage, ['product', 'differential', 'emotionalBond']);
      if (core.product && core.differential && core.emotionalBond) {
        result.strategy.coreMessage = core as {
          product: string;
          differential: string;
          emotionalBond: string;
        };
      }
    }

    if (Array.isArray(s.pillars)) {
      const pillars = s.pillars
        .map((x: any) => (typeof x === 'string' ? { value: x, description: '' } : x))
        .filter((x: any) => x && typeof x.value === 'string' && x.value.trim())
        .map((x: any) => ({
          value: x.value.trim(),
          description: typeof x.description === 'string' ? x.description.trim() : '',
        }));
      if (pillars.length) result.strategy.pillars = pillars;
    }

    // Position can be string or array from LLM, ensure array of strings
    if (typeof s.positioning === 'string') result.strategy.positioning = [s.positioning];
    else if (Array.isArray(s.positioning))
      result.strategy.positioning = s.positioning.filter((x: any) => typeof x === 'string');

    if (Array.isArray(s.archetypes)) {
      result.strategy.archetypes = s.archetypes
        .filter((x: any) => typeof x === 'string' || (typeof x === 'object' && x.name))
        .map((x: any) => (typeof x === 'string' ? { name: x, description: '' } : x));
    }

    if (Array.isArray(s.personas)) {
      result.strategy.personas = s.personas
        .filter((x: any) => typeof x === 'string' || (typeof x === 'object' && x.name))
        .map((x: any) => (typeof x === 'string' ? { name: x, bio: '' } : x));
    }

    if (Array.isArray(s.voiceValues)) {
      result.strategy.voiceValues = s.voiceValues
        .filter((x: any) => typeof x === 'string' || (typeof x === 'object' && x.title))
        .map((x: any) => (typeof x === 'string' ? { title: x, description: '', example: '' } : x));
    }

    if (Array.isArray(s.copyExamples)) {
      const TYPES = ['headline', 'tagline', 'cta', 'body'];
      const seen = new Set<string>();
      const copies = s.copyExamples
        .map((x: any) => (typeof x === 'string' ? { text: x } : x))
        .filter((x: any) => x && typeof x.text === 'string' && x.text.trim())
        .map((x: any) => ({
          text: x.text.trim(),
          // Drop a type the model invented rather than persist a value the
          // union doesn't allow — the copy itself is what matters.
          ...(TYPES.includes(x.type) ? { type: x.type } : {}),
        }))
        // Same line twice teaches nothing and costs tokens on every prompt.
        .filter((x: any) => !seen.has(x.text.toLowerCase()) && seen.add(x.text.toLowerCase()));
      if (copies.length) result.strategy.copyExamples = copies;
    }
  }

  if (data.tokens && typeof data.tokens === 'object') {
    result.tokens = {};
    if (data.tokens.spacing) result.tokens.spacing = data.tokens.spacing;
    if (data.tokens.radius) result.tokens.radius = data.tokens.radius;
    if (data.tokens.shadows) result.tokens.shadows = data.tokens.shadows;
  }

  if (Array.isArray(data.assetClassifications)) {
    const validCategories = [
      'logo',
      'icon',
      'photo',
      'mockup',
      'pattern',
      'strategy',
      'other',
    ] as const;
    const validVariants = ['primary', 'dark', 'light', 'icon', 'accent', 'custom'] as const;
    result.assetClassifications = data.assetClassifications
      .filter((c: any) => typeof c.index === 'number' && validCategories.includes(c.category))
      .map(
        (c: any) =>
          ({
            index: c.index,
            category: c.category,
            logoVariant: validVariants.includes(c.logoVariant) ? c.logoVariant : 'custom',
            label: typeof c.label === 'string' ? c.label : undefined,
          }) as AssetClassification
      );
  }

  return result;
}

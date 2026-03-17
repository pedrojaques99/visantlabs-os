// server/lib/brand-extract.ts
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ParsedChunk } from './brand-parse.js'
import type { BrandGuideline } from '../types/brandGuideline.js'
import { getGeminiApiKey } from '../utils/geminiApiKey.js'

const EXTRACTION_PROMPT = `You are a brand identity extraction expert. Analyze the content and extract brand guideline information.

Return ONLY a JSON object with fields you can identify with confidence. Omit unknown fields. Do NOT guess.

Schema:
{
  "identity": { "name": "...", "website": "...", "tagline": "...", "description": "..." },
  "colors": [{ "hex": "#RRGGBB", "name": "...", "role": "primary|secondary|accent|background|text|cta" }],
  "typography": [{ "family": "Font Name", "style": "Bold|Regular", "role": "heading|body|accent|mono" }],
  "tags": { "brand_values": [...], "tone": [...], "aesthetic": [...] },
  "guidelines": { "voice": "...", "dos": [...], "donts": [...], "imagery": "..." },
  "tokens": { "spacing": { "xs": 4, ... }, "radius": { "sm": 4, ... } }
}

Rules:
- Colors MUST be valid hex (#RGB or #RRGGBB)
- Font families must be exact names (e.g., "Inter", not "sans-serif")
- Return ONLY valid JSON, no markdown fences, no explanation`

export async function extractBrandData(
  chunks: ParsedChunk[],
  imageBase64?: string,
  userId?: string
): Promise<Partial<BrandGuideline>> {
  const apiKey = await getGeminiApiKey(userId)
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured for brand extraction')

  const combinedText = chunks
    .map(c => `--- ${c.source} (${c.type}) ---\n${c.text}`)
    .join('\n\n')
    .slice(0, 8000) // limit tokens

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const parts: any[] = [{ text: EXTRACTION_PROMPT + '\n\nContent:\n' + combinedText }]
  if (imageBase64) {
    parts.push({ inlineData: { mimeType: 'image/png', data: imageBase64 } })
  }

  try {
    const result = await model.generateContent(parts)
    const text = result.response.text()
    const jsonStr = extractJson(text)
    return validateExtracted(JSON.parse(jsonStr))
  } catch (error: any) {
    console.error('[Brand Extract] LLM extraction failed:', error.message)
    return {}
  }
}

function extractJson(text: string): string {
  const codeBlock = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlock) return codeBlock[1].trim()
  const raw = text.match(/\{[\s\S]*\}/)
  if (raw) return raw[0]
  throw new Error('No JSON in LLM response')
}

function validateExtracted(data: any): Partial<BrandGuideline> {
  const result: Partial<BrandGuideline> = {}

  if (data.identity && typeof data.identity === 'object') {
    result.identity = {}
    for (const k of ['name', 'website', 'tagline', 'description'] as const) {
      if (typeof data.identity[k] === 'string') (result.identity as any)[k] = data.identity[k]
    }
  }

  if (Array.isArray(data.colors)) {
    result.colors = data.colors
      .filter((c: any) => c.hex && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(c.hex))
      .map((c: any) => ({ hex: c.hex.toUpperCase(), name: c.name || c.hex, role: c.role || undefined }))
  }

  if (Array.isArray(data.typography)) {
    result.typography = data.typography
      .filter((t: any) => typeof t.family === 'string')
      .map((t: any) => ({
        family: t.family, style: t.style || undefined, role: t.role || 'body',
        size: typeof t.size === 'number' ? t.size : undefined,
        lineHeight: typeof t.lineHeight === 'number' ? t.lineHeight : undefined,
      }))
  }

  if (data.tags && typeof data.tags === 'object') {
    result.tags = {}
    for (const [k, v] of Object.entries(data.tags)) {
      if (Array.isArray(v)) result.tags[k] = v.filter((x: any) => typeof x === 'string')
    }
  }

  if (data.guidelines && typeof data.guidelines === 'object') {
    result.guidelines = {}
    const g = data.guidelines
    if (typeof g.voice === 'string') result.guidelines.voice = g.voice
    if (Array.isArray(g.dos)) result.guidelines.dos = g.dos.filter((d: any) => typeof d === 'string')
    if (Array.isArray(g.donts)) result.guidelines.donts = g.donts.filter((d: any) => typeof d === 'string')
    if (typeof g.imagery === 'string') result.guidelines.imagery = g.imagery
  }

  if (data.tokens && typeof data.tokens === 'object') {
    result.tokens = {}
    if (data.tokens.spacing) result.tokens.spacing = data.tokens.spacing
    if (data.tokens.radius) result.tokens.radius = data.tokens.radius
    if (data.tokens.shadows) result.tokens.shadows = data.tokens.shadows
  }

  return result
}

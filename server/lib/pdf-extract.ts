// server/lib/pdf-extract.ts
//
// Two-phase brand extraction from PDFs:
//   PHASE A — algorithmic (zero LLM, deterministic, ~10s)
//     • tokenizePdf walks every operator and harvests exact hex colours,
//       embedded images, font sizes, and full text.
//     • Streamed to client immediately as colors/typography/images events.
//   PHASE B — LLM (semantic only, ~15s with small payload)
//     • Compact prompt with the algorithmically-extracted text + first images.
//     • Asks ONLY for the things algorithms can't do: brand strategy,
//       manifesto, personas, voice values, dos/donts, image classification,
//       optional font-family identification when text was outlined.
//
// LLM gets ~6KB of structured text instead of 22MB of base64 PDF.

import { GoogleGenerativeAI } from '@google/generative-ai'
import { getGeminiApiKey } from '../utils/geminiApiKey.js'
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js'
import { tokenizePdf, type PdfTokens } from './pdf-tokenize.js'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const SEMANTIC_PROMPT = `You are a brand strategy expert. Brand tokens (colors, fonts, images) have ALREADY been extracted algorithmically from the PDF. Your job is the SEMANTIC content only.

Inputs you will receive:
- TEXT: full extracted text from the brand manual
- IMAGE_COUNT: how many images were extracted (in size order, largest first)
- IS_OUTLINED: true if text was converted to vector outlines (cannot read font names from PDF)

Return ONLY a JSON object. Omit any field you can't populate from the text/images.

Schema:
{
  "identity": { "name": "...", "tagline": "...", "description": "..." },
  "fontFamilies": ["Helvetica Neue LT", "..."],   // ONLY when IS_OUTLINED=true; identify families mentioned in the typography page text
  "colorNames": [{ "hex": "#RRGGBB", "name": "Light Days" }],   // names found in palette page text, mapped to hex when possible
  "tags": { "brand_values": [], "tone": [], "aesthetic": [] },
  "guidelines": { "voice": "one paragraph", "dos": [], "donts": [], "imagery": "..." },
  "strategy": {
    "manifesto": "verbatim manifesto text",
    "positioning": [],
    "archetypes": [{ "name": "...", "role": "primary|secondary", "description": "...", "examples": [] }],
    "personas": [{ "name": "...", "age": 25, "occupation": "...", "traits": [], "bio": "...", "desires": [], "painPoints": [] }],
    "voiceValues": [{ "title": "...", "description": "...", "example": "..." }]
  },
  "assetClassifications": [
    { "index": 0, "category": "logo|icon|photo|mockup|pattern|strategy|other", "logoVariant": "primary|dark|light|icon|accent|custom|stacked|horizontal|abbreviated", "label": "..." }
  ]
}

Rules:
- For TOM DE VOZ / VOICE VALUES: find sections labelled "Tom de Voz", "Voz da Marca", "Linguagem", "Como Falamos". For EACH listed quality (e.g. "Direto", "Humano", "Rebelde"), emit one voiceValues entry.
- For DOS/DONTS: find "faça/não faça", "correto/incorreto", proibições, regras de uso.
- For ARCHETYPES: extract every named archetype with its full description from the manual.
- For PERSONAS: include age, occupation, traits, desires, pain points, bio.
- For COLORNAMES: if the palette page mentions named colors with their hex values, map name→hex.
- For ASSETCLASSIFICATIONS: classify each provided image by index (in size order) — logo/icon/photo/mockup/etc.
- IS_OUTLINED=false → DO NOT populate fontFamilies (algorithmic extraction already has it).
Return JSON only.`

export async function extractPdfStreaming(
  buffer: Buffer,
  writeEvent: (event: object) => void,
  userId?: string
): Promise<void> {
  // ── PHASE A — Algorithmic tokenization ─────────────────────────────────────

  writeEvent({ type: 'status', message: 'Parsing PDF structure…' })

  let tokens: PdfTokens
  try {
    tokens = await tokenizePdf(buffer)
  } catch (err: any) {
    writeEvent({ type: 'error', message: `PDF parse failed: ${err.message}` })
    return
  }

  // Stream algorithmic results immediately — user sees data within seconds
  if (tokens.colors.length) {
    writeEvent({
      type: 'colors',
      data: tokens.colors.map(c => ({ hex: c.hex, name: c.hex, role: c.role })),
    })
  }

  // Typography: prefer real font dict; fall back to type scale when outlined
  const typography = buildTypography(tokens)
  if (typography.length) writeEvent({ type: 'typography', data: typography })

  if (tokens.images.length) {
    writeEvent({ type: 'images', data: tokens.images.map(i => i.pngBase64) })
  }

  writeEvent({
    type: 'status',
    message: `${tokens.colors.length} colors · ${tokens.images.length} images · running semantic pass…`,
  })

  // ── PHASE B — LLM semantic pass ────────────────────────────────────────────

  try {
    const apiKey = await getGeminiApiKey(userId)
    if (!apiKey) {
      writeEvent({ type: 'done' })
      return
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: GEMINI_MODELS.FLASH_2_5 })

    // Cap text to keep payload small; brand manuals fit in ~10K chars
    const textForLlm = tokens.fullText.slice(0, 12000)
    const palette = tokens.colors.slice(0, 20).map(c => c.hex).join(', ')
    const sampleImages = tokens.images.slice(0, 8) // most-relevant by size

    const parts: any[] = [{
      text:
        SEMANTIC_PROMPT +
        `\n\nIS_OUTLINED: ${tokens.isMostlyOutlined}` +
        `\nIMAGE_COUNT: ${sampleImages.length}` +
        `\nPAGE_COUNT: ${tokens.pageCount}` +
        `\nDETECTED_HEX_PALETTE: ${palette}` +
        `\n\nTEXT:\n${textForLlm}`,
    }]
    // Resize each image to max 1024px before sending — Gemini classifies just
    // as well at 1K and we avoid 30MB+ payloads from 5K source assets.
    for (const img of sampleImages) {
      const small = await downscalePngBase64(img.pngBase64, 1024)
      parts.push({ inlineData: { mimeType: 'image/png', data: small } })
    }

    const result = await model.generateContent(parts)
    const text = result.response.text()
    const jsonStr = extractJson(text)
    const semantic: any = JSON.parse(jsonStr)

    // Map outlined-text font identification back to typography stream
    if (tokens.isMostlyOutlined && Array.isArray(semantic.fontFamilies) && semantic.fontFamilies.length) {
      const remapped = remapTypographyWithFamilies(typography, semantic.fontFamilies)
      writeEvent({ type: 'typography', data: remapped })
    }

    // Apply LLM-discovered colour names back to palette
    if (Array.isArray(semantic.colorNames) && semantic.colorNames.length) {
      const named = applyColorNames(tokens.colors, semantic.colorNames)
      writeEvent({ type: 'colors', data: named })
    }

    const strategy = buildStrategy(semantic)
    if (Object.keys(strategy).length) writeEvent({ type: 'strategy', data: strategy })

    if (Array.isArray(semantic.assetClassifications) && semantic.assetClassifications.length) {
      writeEvent({ type: 'asset_classifications', data: semantic.assetClassifications })
    }
  } catch (err: any) {
    console.warn('[pdf-extract] semantic pass failed (algorithmic data still delivered):', err.message)
  }

  writeEvent({ type: 'done' })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildTypography(tokens: PdfTokens) {
  // Real fonts: emit each family with its top size
  if (!tokens.isMostlyOutlined && tokens.fonts.length) {
    return tokens.fonts.slice(0, 12).map(f => ({
      family: f.family,
      style: 'Regular',
      role: inferRoleFromSize(f.sizes[0]),
      size: f.sizes[0],
    }))
  }
  // Outlined: derive from rendered type scale (LLM will fill family names later)
  return tokens.typeScale.slice(0, 8).map(t => ({
    family: 'Unknown (outlined)',
    style: 'Regular',
    role: inferRoleFromSize(t.size),
    size: Math.round(t.size),
  }))
}

function inferRoleFromSize(size: number): 'heading' | 'body' | 'accent' | 'mono' {
  if (size >= 32) return 'heading'
  if (size >= 18) return 'accent'
  return 'body'
}

function remapTypographyWithFamilies(
  current: ReturnType<typeof buildTypography>,
  families: string[]
): ReturnType<typeof buildTypography> {
  // Distribute families across heading/body/accent slots; keep sizes
  const heading = current.filter(t => t.role === 'heading')
  const body    = current.filter(t => t.role === 'body')
  const accent  = current.filter(t => t.role === 'accent')

  return current.map(t => {
    // Headings get family[0]; body gets family[1] if present, else family[0]
    const family =
      t.role === 'heading' ? families[0] :
      t.role === 'body'    ? (families[1] || families[0]) :
                              (families[families.length - 1] || families[0])
    return { ...t, family }
  })
}

function applyColorNames(
  colors: PdfTokens['colors'],
  named: Array<{ hex: string; name: string }>
) {
  const map = new Map<string, string>()
  for (const n of named) {
    if (typeof n.hex === 'string' && typeof n.name === 'string') {
      map.set(n.hex.toUpperCase(), n.name)
    }
  }
  return colors.map(c => ({
    hex: c.hex,
    name: map.get(c.hex) || c.hex,
    role: c.role,
  }))
}

function buildStrategy(data: any): any {
  const s: any = {}
  if (data.strategy?.manifesto)           s.manifesto    = data.strategy.manifesto
  if (data.identity?.tagline)             s.tagline      = data.identity.tagline
  if (data.identity?.description)         s.description  = data.identity.description
  if (data.strategy?.positioning?.length) s.claims       = data.strategy.positioning
  if (data.strategy?.archetypes?.length)  s.archetypes   = data.strategy.archetypes
  if (data.strategy?.personas?.length)    s.personas     = data.strategy.personas
  if (data.strategy?.voiceValues?.length) s.voiceValues  = data.strategy.voiceValues
  if (data.guidelines?.dos?.length)       s.dos          = data.guidelines.dos
  if (data.guidelines?.donts?.length)     s.donts        = data.guidelines.donts
  if (data.tags?.brand_values?.length)    s.brandValues  = data.tags.brand_values
  return s
}

function extractJson(text: string): string {
  const block = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (block) return block[1].trim()
  const raw = text.match(/\{[\s\S]*\}/)
  if (raw) return raw[0]
  throw new Error('No JSON in Gemini response')
}

async function downscalePngBase64(dataUrl: string, maxDim: number): Promise<string> {
  try {
    const b64 = dataUrl.split(',')[1] ?? dataUrl
    const buf = Buffer.from(b64, 'base64')
    const img = await loadImage(buf)
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
    if (scale === 1) return b64 // already small enough
    const w = Math.round(img.width * scale)
    const h = Math.round(img.height * scale)
    const canvas = createCanvas(w, h)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img as any, 0, 0, w, h)
    return canvas.toBuffer('image/png').toString('base64')
  } catch {
    // Fallback: return original (LLM payload may be large but won't crash)
    return dataUrl.split(',')[1] ?? dataUrl
  }
}

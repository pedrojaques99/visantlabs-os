// server/lib/pdf-extract.ts
// Extracts brand tokens from a PDF by:
//   1. Sending the PDF natively to Gemini (it sees every page visually)
//   2. Rendering pages to PNG with pdfjs-dist + @napi-rs/canvas for the images stream
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getGeminiApiKey } from '../utils/geminiApiKey.js'
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js'

const MAX_RENDER_PAGES = 12

const PDF_EXTRACTION_PROMPT = `You are a brand identity extraction expert analyzing a brand manual PDF.

EXTRACTION RULES — follow each carefully:

1. COLORS: Find every color palette page. Extract EVERY defined color with exact HEX. If the manual shows "#1A1A1A" or a labeled swatch, use that exact value. Never approximate from visual inspection alone when a code is shown.

2. TYPOGRAPHY: Find the tipografia/typography pages. Extract EVERY font family AND every defined weight/style variant (Light, Regular, Medium, SemiBold, Bold, ExtraBold, Black, Italic). One entry per weight variant.

3. TOM DE VOZ / VOICE VALUES: Find sections labeled "Tom de Voz", "Voz da Marca", "Linguagem", "Como Falamos" or similar. For EACH voice quality listed (e.g. "Direto", "Humano", "Rebelde", "Poético"), create a voiceValues entry with its title, full description, and an example phrase if shown.

4. GUIDELINES — dos/donts: Extract every "faça / não faça", "correto / incorreto", proibições de uso, zonas de exclusão, e regras de aplicação visual. Also describe the imagery/fotografia style.

5. STRATEGY: Extract manifesto verbatim, all positioning statements, archetypes with full descriptions, personas with age/occupation/traits/desires/painPoints/bio.

6. LOGOS: For each distinct logo variation (wordmark, ícone, horizontal, empilhado, fundo escuro, fundo claro, colorido, monocromático, abreviado, etc.), add one assetClassifications entry with a descriptive label.

7. GRADIENTS / SHADOWS / BORDERS / TOKENS: Only extract if explicitly shown with specifications. Skip if absent.

Return ONLY a JSON object — no markdown, no explanation.

Schema:
{
  "identity": { "name": "...", "website": "...", "tagline": "...", "description": "..." },
  "colors": [{ "hex": "#RRGGBB", "name": "Name as shown in manual", "role": "primary|secondary|accent|background|text|cta" }],
  "typography": [{ "family": "Exact Family Name", "style": "Light|Regular|Medium|Bold|Black|Italic", "role": "heading|body|accent|mono", "size": 16 }],
  "gradients": [{ "name": "...", "css": "linear-gradient(135deg, #HEX 0%, #HEX 100%)", "stops": [{ "hex": "#RRGGBB", "position": 0 }] }],
  "shadows": [{ "name": "...", "css": "0px 4px 12px rgba(0,0,0,0.15)" }],
  "borders": [{ "name": "...", "width": 1, "color": "#RRGGBB", "style": "solid" }],
  "tokens": { "spacing": { "xs": 4, "sm": 8, "md": 16 }, "radius": { "sm": 4, "md": 8, "lg": 16 } },
  "tags": { "brand_values": [], "tone": [], "aesthetic": [] },
  "guidelines": { "voice": "one paragraph summary of tone", "dos": [], "donts": [], "imagery": "visual style description" },
  "strategy": {
    "manifesto": "verbatim manifesto text",
    "positioning": [],
    "archetypes": [{ "name": "...", "role": "primary|secondary", "description": "full description", "examples": [] }],
    "personas": [{ "name": "...", "age": 25, "occupation": "...", "traits": [], "bio": "...", "desires": [], "painPoints": [] }],
    "voiceValues": [{ "title": "Voice Quality", "description": "what this quality means in practice", "example": "Example phrase in this voice" }]
  },
  "assetClassifications": [
    { "index": 0, "category": "logo|icon|photo|mockup|pattern|strategy|other", "logoVariant": "primary|dark|light|icon|accent|custom|stacked|horizontal|abbreviated", "label": "descriptive name" }
  ]
}`

export async function extractPdfStreaming(
  buffer: Buffer,
  writeEvent: (event: object) => void,
  userId?: string
): Promise<void> {
  const apiKey = await getGeminiApiKey(userId)
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  // ── Phase 1: Gemini visual extraction ──────────────────────────────────────

  writeEvent({ type: 'status', message: 'Sending PDF to Gemini…' })

  const genAI = new GoogleGenerativeAI(apiKey)
  // gemini-2.5-flash has proven native PDF support and strong visual understanding
  const model = genAI.getGenerativeModel({ model: GEMINI_MODELS.FLASH_2_5 })

  let extracted: any = {}
  try {
    const result = await model.generateContent([
      { text: PDF_EXTRACTION_PROMPT },
      { inlineData: { mimeType: 'application/pdf', data: buffer.toString('base64') } },
    ])
    const text = result.response.text()
    const jsonStr = extractJson(text)
    extracted = JSON.parse(jsonStr)
  } catch (err: any) {
    console.error('[pdf-extract] Gemini extraction failed:', err.message)
    writeEvent({ type: 'error', message: err.message || 'Gemini extraction failed' })
    return
  }

  // Stream each category — progressive UI updates
  writeEvent({ type: 'status', message: 'Processing results…' })

  if (extracted.colors?.length)     writeEvent({ type: 'colors',     data: normalizeColors(extracted.colors) })
  if (extracted.typography?.length) writeEvent({ type: 'typography', data: extracted.typography })
  if (extracted.gradients?.length)  writeEvent({ type: 'gradients',  data: extracted.gradients })
  if (extracted.shadows?.length)    writeEvent({ type: 'shadows',    data: extracted.shadows })
  if (extracted.borders?.length)    writeEvent({ type: 'borders',    data: extracted.borders })
  if (extracted.tokens?.radius)     writeEvent({ type: 'radii',      data: Object.values(extracted.tokens.radius) })

  const strategy = buildStrategy(extracted)
  if (Object.keys(strategy).length) writeEvent({ type: 'strategy', data: strategy })

  // ── Phase 2: Render pages to PNG thumbnails ─────────────────────────────────

  writeEvent({ type: 'status', message: 'Rendering pages…' })
  try {
    const pageImages = await renderPdfPages(buffer)
    if (pageImages.length) writeEvent({ type: 'images', data: pageImages })
  } catch (err: any) {
    console.warn('[pdf-extract] Page rendering failed (non-fatal):', err.message)
  }

  writeEvent({ type: 'done' })
}

// ── PDF page renderer ─────────────────────────────────────────────────────────

async function renderPdfPages(buffer: Buffer): Promise<string[]> {
  const [pdfjsLib, { createCanvas }] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('@napi-rs/canvas'),
  ])

  const pdf = await (pdfjsLib as any).getDocument({ data: new Uint8Array(buffer) }).promise
  const numPages = Math.min(pdf.numPages, MAX_RENDER_PAGES)
  const images: string[] = []

  for (let i = 1; i <= numPages; i++) {
    try {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 0.75 }) // balance quality vs size
      const w = Math.round(viewport.width)
      const h = Math.round(viewport.height)
      const canvas = createCanvas(w, h)
      const ctx = canvas.getContext('2d')

      await page.render({
        canvasContext: ctx as any,
        viewport,
        canvasFactory: {
          create: (cw: number, ch: number) => {
            const c = createCanvas(cw, ch)
            return { canvas: c, context: c.getContext('2d') }
          },
          reset: (obj: any, cw: number, ch: number) => {
            obj.canvas.width = cw; obj.canvas.height = ch
          },
          destroy: () => {},
        },
      }).promise

      const png = canvas.toBuffer('image/png')
      images.push(`data:image/png;base64,${png.toString('base64')}`)
    } catch (err: any) {
      console.warn(`[pdf-extract] Page ${i} render failed:`, err.message)
    }
  }

  return images
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeColors(colors: any[]): any[] {
  return colors
    .filter((c: any) => c.hex && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(c.hex))
    .map((c: any) => ({ hex: c.hex.toUpperCase(), name: c.name || c.hex, role: c.role }))
}

function buildStrategy(data: any): any {
  const s: any = {}
  if (data.strategy?.manifesto)         s.manifesto    = data.strategy.manifesto
  if (data.identity?.tagline)           s.tagline      = data.identity.tagline
  if (data.identity?.description)       s.description  = data.identity.description
  if (data.strategy?.positioning?.length) s.claims     = data.strategy.positioning
  if (data.strategy?.archetypes?.length)  s.archetypes = data.strategy.archetypes
  if (data.strategy?.personas?.length)    s.personas   = data.strategy.personas
  if (data.strategy?.voiceValues?.length) s.voiceValues = data.strategy.voiceValues
  if (data.guidelines?.dos?.length)       s.dos        = data.guidelines.dos
  if (data.guidelines?.donts?.length)     s.donts      = data.guidelines.donts
  return s
}

function extractJson(text: string): string {
  const block = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (block) return block[1].trim()
  const raw = text.match(/\{[\s\S]*\}/)
  if (raw) return raw[0]
  throw new Error('No JSON in Gemini response')
}

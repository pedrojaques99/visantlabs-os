/**
 * fig-extract.ts
 * Extracts brand tokens (colors, typography, components) from a Figma .fig binary.
 *
 * The .fig format is a ZIP containing canvas.fig (Kiwi-encoded binary).
 * We use JSZip for the ZIP layer and kiwi-schema for the binary decode.
 * No Figma API token required.
 */

import JSZip from 'jszip'
import * as kiwi from 'kiwi-schema'
import { decompress as zstdDecompress } from 'fzstd'
import * as zlib from 'node:zlib'

// ── Kiwi schema (minimal subset of Figma's internal schema) ────────────────
// Figma encodes color as 4x float32, font as {family, style}, and each node
// as a FigmaNodeChange. We only need enough schema to decode fills and text.
const FIGMA_SCHEMA_TEXT = `
message FigmaColor {
  float r = 1;
  float g = 2;
  float b = 3;
  float a = 4;
}

message FigmaPaint {
  uint type = 1;
  FigmaColor color = 2;
  float opacity = 3;
  bool visible = 4;
}

message FigmaFontName {
  string family = 1;
  string style = 2;
}

message FigmaNodeChange {
  uint type = 1;
  string name = 3;
  FigmaPaint[] fillPaints = 30;
  FigmaPaint[] strokePaints = 31;
  FigmaFontName fontName = 50;
  float fontSize = 51;
}

message FigmaFile {
  FigmaNodeChange[] nodeChanges = 1;
}
`

const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd]
const FIG_KIWI_MAGIC = 'fig-kiwi'

function isZstd(buf: Uint8Array) {
  return buf.length >= 4 && ZSTD_MAGIC.every((b, i) => buf[i] === b)
}

function inflateRaw(buf: Uint8Array): Uint8Array {
  return new Uint8Array(zlib.inflateRawSync(Buffer.from(buf)))
}

function decompress(buf: Uint8Array): Uint8Array {
  if (isZstd(buf)) return zstdDecompress(buf)
  try { return inflateRaw(buf) } catch { return buf }
}

function readUint32LE(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24)
}

/**
 * Parse canvas.fig after the "fig-kiwi" magic bytes have been stripped.
 *
 * Format (after magic):
 *   [4 bytes: delimiter/version — skip]
 *   repeated: [uint32 LE chunk_size][chunk_bytes]
 * Parts: [0]=schema bytes, [1]=data bytes (may be more, but we only need first two)
 */
function parseKiwi(canvasAfterMagic: Uint8Array): any {
  let pos = 4 // skip 4-byte delimiter

  const parts: Uint8Array[] = []
  while (pos + 4 <= canvasAfterMagic.length) {
    const chunkSize = readUint32LE(canvasAfterMagic, pos)
    pos += 4
    if (chunkSize === 0 || pos + chunkSize > canvasAfterMagic.length) break
    const raw = canvasAfterMagic.slice(pos, pos + chunkSize)
    parts.push(decompress(raw))
    pos += chunkSize
  }

  if (parts.length < 2) throw new Error(`Expected ≥2 kiwi parts, got ${parts.length}`)

  const [schemaBuf, dataBuf] = parts

  // Decode the binary schema, then use the compiled decoder
  const decodedSchema = kiwi.decodeBinarySchema(new kiwi.ByteBuffer(schemaBuf as unknown as Uint8Array))
  const compiled = kiwi.compileSchema(decodedSchema) as any

  // The compiled schema's decode methods check `bb instanceof this.ByteBuffer`.
  // Ensure ByteBuffer is set on the compiled object so `this` resolves correctly.
  compiled.ByteBuffer = kiwi.ByteBuffer

  // Root type is "Message" in Figma's schema; fallback to first decode* method
  const decoderKey = 'decodeMessage' in compiled
    ? 'decodeMessage'
    : Object.keys(compiled).find(k => k.startsWith('decode'))
  if (!decoderKey) throw new Error('No decoder found in compiled schema')

  return compiled[decoderKey](new kiwi.ByteBuffer(dataBuf as unknown as Uint8Array))
}

export type FigExtractCategory =
  | { type: 'status';     message: string }
  | { type: 'colors';     data: FigExtractResult['colors'] }
  | { type: 'typography'; data: FigExtractResult['typography'] }
  | { type: 'gradients';  data: FigExtractResult['gradients'] }
  | { type: 'shadows';    data: FigExtractResult['shadows'] }
  | { type: 'borders';    data: FigExtractResult['borders'] }
  | { type: 'radii';      data: FigExtractResult['radii'] }
  | { type: 'components'; data: FigExtractResult['components'] }
  | { type: 'images';     data: FigExtractResult['images'] }
  | { type: 'strategy';   data: NonNullable<FigExtractResult['strategy']> }
  | { type: 'done' }
  | { type: 'error';      message: string }

/**
 * Stream extraction — emits each category via `emit` callback as it's computed.
 * Allows progressive rendering on the client.
 */
export interface FigExtractResult {
  colors: Array<{ hex: string; name: string }>
  typography: Array<{ family: string; style: string; size: number; role: string; lineHeight?: number; letterSpacing?: string }>
  gradients: Array<{ name: string; css: string; stops: Array<{ hex: string; position: number }> }>
  shadows: Array<{ name: string; css: string }>
  borders: Array<{ name: string; width: number; color: string; style: 'solid' }>
  radii: number[]
  components: Array<{ name: string }>
  images: string[]
  /** Brand strategy text extracted from presentation/copy in the file */
  strategy?: {
    manifesto?: string
    tagline?: string
    description?: string
    claims?: string[]
  }
}

/** Convenience wrapper — collects all streaming events and returns a single result */
export async function extractFigTokens(buffer: Buffer): Promise<FigExtractResult> {
  const result: FigExtractResult = { colors: [], typography: [], gradients: [], shadows: [], borders: [], radii: [], components: [], images: [] }
  await extractFigTokensStreaming(buffer, (event) => {
    if (event.type === 'colors')     result.colors     = event.data
    if (event.type === 'typography') result.typography = event.data
    if (event.type === 'gradients')  result.gradients  = event.data
    if (event.type === 'shadows')    result.shadows    = event.data
    if (event.type === 'borders')    result.borders    = event.data
    if (event.type === 'radii')      result.radii      = event.data
    if (event.type === 'components') result.components = event.data
    if (event.type === 'images')     result.images     = event.data
    if (event.type === 'strategy')   result.strategy   = event.data
  })
  return result
}

async function _extractFigTokensImpl(buffer: Buffer, emit: (event: FigExtractCategory) => void): Promise<void> {
  emit({ type: 'status', message: 'Loading .fig archive…' })

  const uint8 = new Uint8Array(buffer)
  let canvasRaw: Uint8Array
  let zip: JSZip | null = null

  if (new TextDecoder().decode(uint8.slice(0, 8)) === FIG_KIWI_MAGIC) {
    canvasRaw = uint8.slice(8)
  } else {
    zip = await JSZip.loadAsync(buffer)
    const canvasEntry = zip.file('canvas.fig')
    if (!canvasEntry) throw new Error('canvas.fig not found in .fig archive')
    const raw = new Uint8Array(await canvasEntry.async('arraybuffer'))
    canvasRaw = new TextDecoder().decode(raw.slice(0, 8)) === FIG_KIWI_MAGIC ? raw.slice(8) : raw
  }

  emit({ type: 'status', message: 'Decoding design tokens…' })
  const decoded = parseKiwi(canvasRaw)
  const nodes: any[] = decoded?.nodeChanges || []

  const toHex = (c: any) =>
    '#' + Math.round((c.r??0)*255).toString(16).padStart(2,'0') +
          Math.round((c.g??0)*255).toString(16).padStart(2,'0') +
          Math.round((c.b??0)*255).toString(16).padStart(2,'0')

  // 1. Colors ─────────────────────────────────────────────────────────────────
  const colors: FigExtractResult['colors'] = []
  const colorHexSeen = new Set<string>()
  for (const node of nodes) {
    if (node.styleType !== 'FILL') continue
    const paint = node.fillPaints?.find((p: any) => p.type === 'SOLID' && p.color)
    if (!paint) continue
    const hex = toHex(paint.color).toUpperCase()
    if (!colorHexSeen.has(hex)) { colorHexSeen.add(hex); colors.push({ hex, name: node.name || '' }) }
  }
  if (colors.length === 0) {
    const cnt = new Map<string, { hex: string; name: string; n: number }>()
    for (const node of nodes) {
      for (const paint of (node.fillPaints || [])) {
        if (paint.type !== 'SOLID' || !paint.color) continue
        const lum = paint.color.r*0.299 + paint.color.g*0.587 + paint.color.b*0.114
        if (lum > 0.97 || lum < 0.04) continue
        const hex = toHex(paint.color).toUpperCase()
        const e = cnt.get(hex); if (e) e.n++; else cnt.set(hex, { hex, name: '', n: 1 })
      }
    }
    colors.push(...Array.from(cnt.values()).sort((a, b) => b.n - a.n).slice(0, 20).map(({ hex, name }) => ({ hex, name })))
  }
  emit({ type: 'colors', data: colors })

  // 2. Typography ─────────────────────────────────────────────────────────────
  const fontFamilyMap = new Map<string, FigExtractResult['typography'][0]>()
  for (const node of nodes) {
    if (!node.fontName?.family) continue
    const family = node.fontName.family as string
    const style = (node.fontName.style || 'Regular') as string
    const size = node.fontSize ? Math.round(node.fontSize) : 16
    const key = `${family}::${style}`
    const ex = fontFamilyMap.get(key)
    if (!ex || size > ex.size) {
      fontFamilyMap.set(key, {
        family, style, size, role: node.name || '',
        lineHeight: (() => {
          const lh = node.lineHeight; if (!lh || lh.value == null) return undefined
          switch (lh.units) { case 'RAW': return Math.round(lh.value*100)/100; case 'PERCENT': return Math.round(lh.value)/100; case 'PIXELS': return Math.round(lh.value); default: return undefined }
        })(),
        letterSpacing: (() => {
          const ls = node.letterSpacing; if (!ls || ls.value == null || Math.abs(ls.value) < 0.5) return undefined
          return `${Math.round(ls.value/100*1000)/1000}em`
        })(),
      })
    }
  }
  const typography = Array.from(fontFamilyMap.values())
    .sort((a, b) => a.family !== b.family ? a.family.localeCompare(b.family) : b.size - a.size)
    .slice(0, 12)
  emit({ type: 'typography', data: typography })

  // 3. Borders ────────────────────────────────────────────────────────────────
  // Skip SYMBOL/COMPONENT/INSTANCE nodes — their strokes are Figma UI chrome, not brand tokens
  // Skip component/instance nodes — their strokes are Figma chrome, not brand tokens
  const COMPONENT_TYPES = new Set(['SYMBOL', 'COMPONENT', 'INSTANCE', 'COMPONENT_SET'])
  const borders: FigExtractResult['borders'] = []
  const borderSeen = new Set<string>()
  for (const node of nodes) {
    if (COMPONENT_TYPES.has(node.type)) continue
    if (node.componentKey) continue  // FRAME that IS a component definition
    if (!node.strokePaints?.length || !node.strokeWeight || node.strokeWeight > 20) continue
    const paint = node.strokePaints.find((p: any) => p.type === 'SOLID' && p.color)
    if (!paint) continue
    const hex = toHex(paint.color).toUpperCase()
    const width = Math.round(node.strokeWeight * 10) / 10
    const key = `${hex}::${width}`
    if (borderSeen.has(key)) continue
    borderSeen.add(key)
    borders.push({ name: node.name || `Border ${borders.length + 1}`, width, color: hex, style: 'solid' })
    if (borders.length >= 6) break
  }
  emit({ type: 'borders', data: borders })

  // 4. Radii ──────────────────────────────────────────────────────────────────
  const radiiRaw = new Set<number>()
  for (const node of nodes) {
    if (node.cornerRadius > 1 && node.cornerRadius < 100)
      radiiRaw.add(Math.round(node.cornerRadius * 2) / 2)
  }
  const radii = Array.from(radiiRaw).sort((a, b) => a - b).slice(0, 8)
  emit({ type: 'radii', data: radii })

  // 5. Shadows ────────────────────────────────────────────────────────────────
  const shadows: FigExtractResult['shadows'] = []
  const shadowSeen = new Set<string>()
  for (const node of nodes) {
    const eff = node.effects?.find((e: any) => e.type === 'DROP_SHADOW' && e.visible !== false)
    if (!eff) continue
    const c = eff.color || { r:0, g:0, b:0, a:0.15 }
    const css = `${Math.round(eff.offset?.x??0)}px ${Math.round(eff.offset?.y??4)}px ${Math.round(eff.radius??12)}px ${Math.round(eff.spread??0)}px rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},${parseFloat((c.a??0.15).toFixed(2))})`
    if (shadowSeen.has(css)) continue
    shadowSeen.add(css)
    shadows.push({ name: node.name || `Shadow ${shadows.length+1}`, css })
    if (shadows.length >= 6) break
  }
  emit({ type: 'shadows', data: shadows })

  // 6. Gradients ──────────────────────────────────────────────────────────────
  const gradients: FigExtractResult['gradients'] = []
  const gradientSeen = new Set<string>()
  const GRADIENT_TYPES = new Set(['GRADIENT_LINEAR','GRADIENT_RADIAL','GRADIENT_ANGULAR','GRADIENT_DIAMOND'])
  for (const node of nodes) {
    const paint = node.fillPaints?.find((p: any) => GRADIENT_TYPES.has(p.type) && p.stops?.length >= 2)
    if (!paint) continue
    const stops = (paint.stops as any[]).map((s: any) => ({ hex: toHex(s.color).toUpperCase(), position: Math.round(s.position*100) }))
    const uniqueHexes = new Set(stops.map(s => s.hex))
    if (uniqueHexes.size < 2) continue
    const allDark = stops.every(s => parseInt(s.hex.slice(1),16) < 0x202020)
    const allWhite = stops.every(s => s.hex >= '#F0F0F0')
    if (allDark || allWhite) continue
    const key = stops.map(s => s.hex).join(':')
    if (gradientSeen.has(key)) continue
    gradientSeen.add(key)
    const isRadial = paint.type === 'GRADIENT_RADIAL'
    const css = isRadial
      ? `radial-gradient(circle, ${stops.map(s=>`${s.hex} ${s.position}%`).join(', ')})`
      : `linear-gradient(135deg, ${stops.map(s=>`${s.hex} ${s.position}%`).join(', ')})`
    gradients.push({ name: node.name || `Gradient ${gradients.length+1}`, css, stops })
    if (gradients.length >= 8) break
  }
  emit({ type: 'gradients', data: gradients })

  // 7. Strategy text ──────────────────────────────────────────────────────────
  const SKIP = [/^\s*[\d\s,.%]+\s*$/, /R \d+ G \d+ B \d+/, /rua|av\.|cep|cnpj|cpf|@|www\./i, /\d{2}\/\d{2}\/\d{4}/, /^[-+*/=()[\]{}|\\<>^~`]+$/]
  const brandTexts = nodes
    .filter((n: any) => n.type === 'TEXT')
    .map((n: any) => (n.textData?.characters || n.name || '').replace(/\n/g,' ').replace(/\s+/g,' ').trim())
    .filter((t: string) => t.length >= 20 && t.length <= 300 && !SKIP.some(p => p.test(t)))
    .filter((t: string, i: number, arr: string[]) => arr.indexOf(t) === i)
  const manifestoCandidates = brandTexts.filter((t: string) => t.length > 40 && /cuidar|valor|missão|visão|acredit|transform|result|solução|inovação|pele|beleza|eficácia|intelig/i.test(t)).sort((a: string, b: string) => b.length - a.length)
  const taglineCandidates   = brandTexts.filter((t: string) => t.length >= 20 && t.length <= 80 && /mizz|pele|cuidado|rotina|result|transfor/i.test(t)).sort((a: string, b: string) => a.length - b.length)
  const claims              = brandTexts.filter((t: string) => t.length >= 15 && t.length <= 60 && /testado|livre de|sem|natural|eficá|derma|gine/i.test(t)).slice(0, 5)
  const strategy: NonNullable<FigExtractResult['strategy']> = {}
  if (manifestoCandidates[0]) strategy.manifesto = manifestoCandidates[0]
  if (taglineCandidates[0] && taglineCandidates[0] !== manifestoCandidates[0]) strategy.tagline = taglineCandidates[0]
  if (claims.length) strategy.claims = claims
  const descCandidate = manifestoCandidates.find((t: string) => t !== strategy.manifesto && t.length > 30)
  if (descCandidate) strategy.description = descCandidate
  if (Object.keys(strategy).length) emit({ type: 'strategy', data: strategy })

  // 8. Components ─────────────────────────────────────────────────────────────
  const components = nodes
    .filter((n: any) => (n.type === 'SYMBOL' || n.type === 'COMPONENT') && n.name)
    .map((n: any) => ({ name: n.name as string }))
    .slice(0, 50)
  emit({ type: 'components', data: components })

  // 9. Images (slow — last) ───────────────────────────────────────────────────
  if (zip) {
    emit({ type: 'status', message: 'Extracting images…' })
    const images: string[] = []
    const thumb = zip.file('thumbnail.png')
    if (thumb) images.push(`data:image/png;base64,${await thumb.async('base64')}`)
    const assetPaths = Object.keys(zip.files).filter(n => !zip!.files[n].dir && n.startsWith('images/') && n !== 'thumbnail.png')
    let taken = 0
    for (const path of assetPaths) {
      if (taken >= 20) break
      const entry = zip.file(path)
      if (!entry) continue
      const compressedSize: number = (zip.files[path] as any)._data?.compressedSize ?? (zip.files[path] as any)._data?.length ?? Infinity
      if (compressedSize > 400_000) continue
      const bytes = await entry.async('uint8array')
      let mime = ''
      if (bytes[0]===0x89&&bytes[1]===0x50) mime='image/png'
      else if (bytes[0]===0xFF&&bytes[1]===0xD8) mime='image/jpeg'
      else if (bytes[0]===0x47&&bytes[1]===0x49) mime='image/gif'
      else if (bytes[0]===0x52&&bytes[1]===0x49) mime='image/webp'
      else if (bytes[0]===0x3C) mime='image/svg+xml'
      else continue
      images.push(`data:${mime};base64,${Buffer.from(bytes).toString('base64')}`)
      taken++
    }
    if (images.length) emit({ type: 'images', data: images })
  }

  emit({ type: 'done' })
}

// Wire up the streaming entry point
export async function extractFigTokensStreaming(
  buffer: Buffer,
  emit: (event: FigExtractCategory) => void
): Promise<void> {
  try {
    await _extractFigTokensImpl(buffer, emit)
  } catch (err: any) {
    emit({ type: 'error', message: err?.message || 'Extraction failed' })
  }
}

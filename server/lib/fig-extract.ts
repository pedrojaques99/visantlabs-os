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

/**
 * Extract brand tokens from a .fig buffer.
 * Returns colors, typography, and component names.
 */
export async function extractFigTokens(buffer: Buffer): Promise<{
  colors: Array<{ hex: string; name: string }>
  typography: Array<{ family: string; style: string; size: number; role: string }>
  components: Array<{ name: string }>
  /** Base64 data-URIs of embedded images (logos + media) from /images/ and thumbnail */
  images: string[]
}> {
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

  // ── Embedded images from ZIP (logos, icons, rasters) ─────────────────────
  const images: string[] = []
  if (zip) {
    // Thumbnail first (always named thumbnail.png)
    const thumb = zip.file('thumbnail.png')
    if (thumb) {
      const b64 = await thumb.async('base64')
      images.push(`data:image/png;base64,${b64}`)
    }

    // images/ folder — blobs have NO extension, type detected from magic bytes
    // Strategy: skip files > 600KB (full-page screenshots/photos); take first 20 smaller ones
    const assetPaths = Object.keys(zip.files).filter(n =>
      !zip!.files[n].dir && n.startsWith('images/') && n !== 'thumbnail.png'
    )

    let taken = 0
    for (const path of assetPaths) {
      if (taken >= 20) break
      const entry = zip.file(path)
      if (!entry) continue

      // JSZip stores compressed size in internal _data object
      const compressedSize: number = (zip.files[path] as any)._data?.compressedSize
        ?? (zip.files[path] as any)._data?.length
        ?? Infinity
      // Skip large files — logos/icons are typically < 300KB; product photos 1MB+
      if (compressedSize > 400_000) continue

      const bytes = await entry.async('uint8array')

      // Detect MIME type from magic bytes
      let mime: string
      if (bytes[0] === 0x89 && bytes[1] === 0x50) mime = 'image/png'           // PNG
      else if (bytes[0] === 0xFF && bytes[1] === 0xD8) mime = 'image/jpeg'     // JPEG
      else if (bytes[0] === 0x47 && bytes[1] === 0x49) mime = 'image/gif'      // GIF
      else if (bytes[0] === 0x52 && bytes[1] === 0x49) mime = 'image/webp'     // WEBP (RIFF)
      else if (bytes[0] === 0x3C) mime = 'image/svg+xml'                        // SVG (<)
      else continue  // unknown format, skip

      const b64 = Buffer.from(bytes).toString('base64')
      images.push(`data:${mime};base64,${b64}`)
      taken++
    }
  }

  const decoded = parseKiwi(canvasRaw)
  const nodes: any[] = decoded?.nodeChanges || []

  // ── Colors: FILL style nodes have named brand colors ─────────────────────
  // Regular rect fills are noisy; named style nodes are the intentional palette.
  const colors: Array<{ hex: string; name: string }> = []
  const colorHexSeen = new Set<string>()

  for (const node of nodes) {
    if (node.styleType !== 'FILL') continue
    const paint = node.fillPaints?.find((p: any) => p.type === 'SOLID' && p.color)
    if (!paint) continue
    const c = paint.color
    const hex = '#' +
      Math.round((c.r ?? 0) * 255).toString(16).padStart(2, '0') +
      Math.round((c.g ?? 0) * 255).toString(16).padStart(2, '0') +
      Math.round((c.b ?? 0) * 255).toString(16).padStart(2, '0')
    const hexUp = hex.toUpperCase()
    if (!colorHexSeen.has(hexUp)) {
      colorHexSeen.add(hexUp)
      colors.push({ hex: hexUp, name: node.name || '' })
    }
  }

  // Fallback: if no FILL styles, collect most-used solid fills from all nodes
  if (colors.length === 0) {
    const colorCount = new Map<string, { hex: string; name: string; n: number }>()
    for (const node of nodes) {
      for (const paint of (node.fillPaints || [])) {
        if (paint.type !== 'SOLID' || !paint.color) continue
        const c = paint.color
        const lum = c.r * 0.299 + c.g * 0.587 + c.b * 0.114
        if (lum > 0.97 || lum < 0.04) continue
        const hex = ('#' + Math.round(c.r*255).toString(16).padStart(2,'0') + Math.round(c.g*255).toString(16).padStart(2,'0') + Math.round(c.b*255).toString(16).padStart(2,'0')).toUpperCase()
        const e = colorCount.get(hex)
        if (e) e.n++; else colorCount.set(hex, { hex, name: '', n: 1 })
      }
    }
    colors.push(...Array.from(colorCount.values()).sort((a, b) => b.n - a.n).slice(0, 20).map(({ hex, name }) => ({ hex, name })))
  }

  // ── Typography: collect unique font families across all text nodes ────────
  const fontFamilySeen = new Set<string>()
  const fontMap = new Map<string, { family: string; style: string; size: number; role: string }>()

  for (const node of nodes) {
    if (!node.fontName?.family) continue
    const family = node.fontName.family as string
    const style = (node.fontName.style || 'Regular') as string
    const size = node.fontSize ? Math.round(node.fontSize) : 16
    const key = `${family}::${style}::${size}`
    if (!fontMap.has(key)) {
      fontMap.set(key, { family, style, size, role: node.name || '' })
      fontFamilySeen.add(family)
    }
  }

  const typography = Array.from(fontMap.values())
    .sort((a, b) => b.size - a.size)
    .slice(0, 12)

  // ── Components: SYMBOL/COMPONENT nodes are the design system atoms ────────
  const components = nodes
    .filter((n: any) => (n.type === 'SYMBOL' || n.type === 'COMPONENT') && n.name)
    .map((n: any) => ({ name: n.name as string }))
    .slice(0, 30)

  return { colors, typography, components, images }
}

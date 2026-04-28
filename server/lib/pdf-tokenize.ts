// server/lib/pdf-tokenize.ts
// Pure algorithmic PDF token extraction — zero LLM.
//
// Walks every PDF operator on every page and harvests:
//   - colors  : exact hex from setFillRGBColor / setStrokeRGBColor / CMYK conversions, frequency-weighted, clustered
//   - fonts   : embedded font families + every size used (when not Type3 outlined text)
//   - images  : every embedded raster XObject decoded to PNG, deduped by image ref
//   - blocks  : text grouped by page with font size + position (heading detection ready)
//
// LLM only enters later for semantic work (manifesto, persona, image classification).
import { createCanvas } from '@napi-rs/canvas'

export interface ExtractedColor {
  hex: string
  count: number
  role?: 'background' | 'text' | 'primary' | 'secondary' | 'accent'
}

export interface ExtractedFont {
  family: string
  sizes: number[]      // distinct sizes seen, descending
  totalUsage: number
  isOutlined: boolean  // true = Type3 (text converted to vector, family name unreliable)
}

export interface ExtractedImage {
  id: string
  pageNum: number
  width: number
  height: number
  pngBase64: string    // data:image/png;base64,...
  area: number         // for size-based filtering
}

export interface TextBlock {
  pageNum: number
  text: string
  fontSize: number
  fontName: string
  x: number
  y: number
}

export interface PdfTokens {
  pageCount: number
  colors: ExtractedColor[]
  fonts: ExtractedFont[]
  /**
   * Type scale derived from actual rendered text-block heights.
   * Useful when the PDF has outlined text (no real font dict).
   * One entry per distinct rendered size, sorted descending.
   */
  typeScale: Array<{ size: number; count: number }>
  images: ExtractedImage[]
  blocks: TextBlock[]
  fullText: string
  /** True when most fonts are Type3 (text was converted to vector outlines on export). */
  isMostlyOutlined: boolean
}

// ── Colour helpers ────────────────────────────────────────────────────────────

const HEX_RE = /^#([0-9A-Fa-f]{6})$/

/** RGB distance (cheap, sufficient for clustering near-identical brand colours). */
function rgbDist(a: string, b: string): number {
  const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16)
  const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16)
  return Math.sqrt((ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2)
}

/** Drop near-white / near-black noise that comes from text rendering. */
function isNoise(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
  // pure white (paper)
  if (r > 250 && g > 250 && b > 250) return false // keep white explicitly — designers reference it
  // unrealistically near-grey single-pixel artefacts: skip if ALL three channels are within 2 of 254/253
  return false
}

/** Cluster within `threshold` RGB distance; return frequency-weighted survivors. */
function clusterColors(raw: Map<string, number>, threshold = 12): ExtractedColor[] {
  const entries = Array.from(raw.entries()).sort((a, b) => b[1] - a[1])
  const clusters: { hex: string; count: number }[] = []

  for (const [hex, count] of entries) {
    if (isNoise(hex)) continue
    const existing = clusters.find(c => rgbDist(c.hex, hex) < threshold)
    if (existing) existing.count += count
    else clusters.push({ hex, count })
  }

  return clusters.map(c => ({ hex: c.hex.toUpperCase(), count: c.count }))
}

/** Tag each colour with a role based on luminance + frequency rank. */
function assignColorRoles(colors: ExtractedColor[]): ExtractedColor[] {
  return colors.map((c, i) => {
    const lum = relativeLuminance(c.hex)
    let role: ExtractedColor['role']
    if (lum > 0.93)       role = 'background'
    else if (lum < 0.08)  role = 'text'
    else if (i === 0)     role = 'primary'
    else if (i === 1)     role = 'secondary'
    else                  role = 'accent'
    return { ...c, role }
  })
}

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const f = (v: number) => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function cmykToHex(c: number, m: number, y: number, k: number): string {
  const r = Math.round(255 * (1 - c) * (1 - k))
  const g = Math.round(255 * (1 - m) * (1 - k))
  const b = Math.round(255 * (1 - y) * (1 - k))
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0').toUpperCase()).join('')
}

function grayToHex(g: number): string {
  const v = Math.round(g * 255)
  const h = v.toString(16).padStart(2, '0').toUpperCase()
  return '#' + h + h + h
}

// ── Image conversion ──────────────────────────────────────────────────────────

/** pdfjs `objs.get(id)` returns { data, width, height, kind }; convert to PNG buffer. */
function imageObjToPng(img: any): Buffer | null {
  if (!img?.data || !img?.width || !img?.height) return null
  const { width, height, data, kind } = img

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  const out = ctx.createImageData(width, height)

  // pdfjs ImageKind: 1 = GRAYSCALE_1BPP, 2 = RGB_24BPP, 3 = RGBA_32BPP
  if (kind === 3 || data.length === width * height * 4) {
    out.data.set(data)
  } else if (kind === 2 || data.length === width * height * 3) {
    for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
      out.data[j]     = data[i]
      out.data[j + 1] = data[i + 1]
      out.data[j + 2] = data[i + 2]
      out.data[j + 3] = 255
    }
  } else if (kind === 1 || data.length === width * height) {
    for (let i = 0, j = 0; i < data.length; i++, j += 4) {
      out.data[j] = out.data[j + 1] = out.data[j + 2] = data[i]
      out.data[j + 3] = 255
    }
  } else {
    // Unknown layout — bail
    return null
  }

  ctx.putImageData(out, 0, 0)
  return canvas.toBuffer('image/png')
}

// ── Main tokenizer ────────────────────────────────────────────────────────────

export async function tokenizePdf(buffer: Buffer, opts?: { maxImages?: number; minImageArea?: number }): Promise<PdfTokens> {
  const maxImages    = opts?.maxImages    ?? 30
  const minImageArea = opts?.minImageArea ?? 32 * 32  // ignore icon-sized noise unless real assets

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs') as any
  const OPS = pdfjs.OPS

  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise

  const colorCounter = new Map<string, number>()
  const fontUsage    = new Map<string, { sizes: Map<number, number>; isOutlined: boolean }>()
  const imageOut     = new Map<string, ExtractedImage>()
  const blocks: TextBlock[] = []
  const textChunks: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)

    // Force font cache load — needed before reading commonObjs
    const tc = await page.getTextContent()

    // Collect text blocks with size/position
    for (const item of tc.items as any[]) {
      const str = (item.str || '').trim()
      if (!str) continue
      blocks.push({
        pageNum: i,
        text: item.str,
        fontSize: item.height || 0,
        fontName: item.fontName || '',
        x: item.transform?.[4] ?? 0,
        y: item.transform?.[5] ?? 0,
      })
      textChunks.push(str)
    }

    const opList = await page.getOperatorList()

    for (let j = 0; j < opList.fnArray.length; j++) {
      const fn = opList.fnArray[j]
      const args = opList.argsArray[j]

      // Colours — pdfjs already returns hex strings for RGB ops in modern versions
      if (fn === OPS.setFillRGBColor || fn === OPS.setStrokeRGBColor) {
        const v = args?.[0]
        const hex = typeof v === 'string' && HEX_RE.test(v)
          ? v.toLowerCase()
          : (typeof args?.[0] === 'number'
              ? '#' + [args[0], args[1], args[2]].map(n => Math.round(n).toString(16).padStart(2, '0')).join('')
              : null)
        if (hex) colorCounter.set(hex, (colorCounter.get(hex) || 0) + 1)
      } else if (fn === OPS.setFillCMYKColor || fn === OPS.setStrokeCMYKColor) {
        if (args?.length >= 4) {
          const hex = cmykToHex(args[0], args[1], args[2], args[3])
          colorCounter.set(hex.toLowerCase(), (colorCounter.get(hex.toLowerCase()) || 0) + 1)
        }
      } else if (fn === OPS.setFillGray || fn === OPS.setStrokeGray) {
        if (typeof args?.[0] === 'number') {
          const hex = grayToHex(args[0])
          colorCounter.set(hex.toLowerCase(), (colorCounter.get(hex.toLowerCase()) || 0) + 1)
        }
      } else if (fn === OPS.setFont) {
        const ref = args[0]
        const size = args[1] || 0
        let name = ref
        let isOutlined = false
        try {
          if (page.commonObjs.has(ref)) {
            const f = page.commonObjs.get(ref)
            // Type3 = text converted to vector outlines (no real font name)
            isOutlined = !!f?.isType3Font
            name = f?.name && f.name !== 'Type3' ? f.name : (f?.fallbackName || ref)
            if (isOutlined) name = `__outlined__${ref}` // bucket all outlined as same
          }
        } catch { /* font not loaded */ }
        const entry = fontUsage.get(name) || { sizes: new Map(), isOutlined }
        entry.sizes.set(size, (entry.sizes.get(size) || 0) + 1)
        entry.isOutlined = isOutlined
        fontUsage.set(name, entry)
      } else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
        const imgId = args[0]
        if (typeof imgId !== 'string' || imageOut.has(imgId)) continue
        try {
          // pdfjs loads images lazily — must use the async callback pattern
          const img = await new Promise<any>((resolve) => {
            const tryGet = (store: any) => {
              try { store.get(imgId, (data: any) => resolve(data)) } catch { resolve(null) }
            }
            if (page.objs.has(imgId))            resolve(page.objs.get(imgId))
            else if (page.commonObjs.has(imgId)) resolve(page.commonObjs.get(imgId))
            else                                  tryGet(page.objs)
          })
          if (!img?.width || !img?.height) continue
          const area = img.width * img.height
          if (area < minImageArea) continue
          const png = imageObjToPng(img)
          if (!png) continue
          imageOut.set(imgId, {
            id: imgId,
            pageNum: i,
            width: img.width,
            height: img.height,
            area,
            pngBase64: `data:image/png;base64,${png.toString('base64')}`,
          })
        } catch { /* couldn't decode this image */ }
      }
    }
  }

  // ── Finalise ───────────────────────────────────────────────────────────────

  const clusteredColors = assignColorRoles(clusterColors(colorCounter))

  const fonts: ExtractedFont[] = Array.from(fontUsage.entries()).map(([family, info]) => {
    const sizesSorted = Array.from(info.sizes.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([s]) => Math.round(s * 100) / 100)
      .filter((s, idx, arr) => arr.indexOf(s) === idx)
    const totalUsage = Array.from(info.sizes.values()).reduce((a, b) => a + b, 0)
    return {
      family: family.startsWith('__outlined__') ? 'Outlined Text' : family,
      sizes: sizesSorted,
      totalUsage,
      isOutlined: info.isOutlined,
    }
  }).sort((a, b) => b.totalUsage - a.totalUsage)

  // Sort images largest first, cap at maxImages
  const images = Array.from(imageOut.values())
    .sort((a, b) => b.area - a.area)
    .slice(0, maxImages)

  // Derive type scale from rendered block heights (works even when fonts are outlined)
  const sizeFreq = new Map<number, number>()
  for (const b of blocks) {
    if (!b.fontSize || b.fontSize < 1) continue
    const rounded = Math.round(b.fontSize * 10) / 10  // 0.1pt resolution
    sizeFreq.set(rounded, (sizeFreq.get(rounded) || 0) + 1)
  }
  const typeScale = Array.from(sizeFreq.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([size, count]) => ({ size, count }))

  const isMostlyOutlined = fonts.length > 0 && fonts.every(f => f.isOutlined)

  return {
    pageCount: pdf.numPages,
    colors: clusteredColors,
    fonts,
    typeScale,
    images,
    blocks,
    fullText: textChunks.join(' '),
    isMostlyOutlined,
  }
}

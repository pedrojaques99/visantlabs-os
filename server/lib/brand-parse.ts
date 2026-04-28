// server/lib/brand-parse.ts
// pdfjs-dist is imported lazily inside parsePdf to avoid crashing the
// Vercel serverless cold-start — the package uses @napi-rs/canvas and
// DOMMatrix at module-evaluation time, which don't exist in Lambda.

export interface ParsedChunk {
  text: string
  source: string
  type: 'url' | 'pdf' | 'image' | 'json'
}

const PRIVATE_IP_RE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:)/i

function assertSafeUrl(raw: string): URL {
  const parsed = new URL(raw)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http/https URLs are allowed')
  }
  const host = parsed.hostname
  if (host === 'localhost' || PRIVATE_IP_RE.test(host)) {
    throw new Error('Requests to internal/private addresses are not allowed')
  }
  return parsed
}

export async function parseUrl(url: string): Promise<ParsedChunk[]> {
  let targetUrl = url.trim()
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = `https://${targetUrl}`
  }

  assertSafeUrl(targetUrl)

  const response = await fetch(targetUrl, {
    headers: { 'User-Agent': 'VisantBot/1.0 (brand-extractor)' },
    signal: AbortSignal.timeout(15000),
    redirect: 'manual',
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${targetUrl}`)

  const html = await response.text()
  const text = stripHtml(html)
  return chunkText(text, 2000).map(chunk => ({ text: chunk, source: targetUrl, type: 'url' as const }))
}

export async function parsePdf(buffer: Buffer, filename?: string): Promise<ParsedChunk[]> {
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    // Convert Buffer to Uint8Array for pdfjs-dist compatibility
    const uint8Array = new Uint8Array(buffer)
    const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise
    let fullText = ''

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
      fullText += pageText + '\n'
    }

    return chunkText(fullText || '', 2000).map(chunk => ({
      text: chunk,
      source: filename || 'uploaded.pdf',
      type: 'pdf' as const,
    }))
  } catch (error: any) {
    console.error('[ParsePDF] Error:', error.message)
    throw new Error(`Failed to parse PDF: ${error.message}`)
  }
}

export function parseImage(filename: string): ParsedChunk[] {
  return [{
    text: `[Image: ${filename} — analyze visually for brand colors, logos, typography, and style]`,
    source: filename,
    type: 'image' as const,
  }]
}

export function parseJson(jsonStr: string, filename?: string): ParsedChunk[] {
  JSON.parse(jsonStr) // validate
  return [{
    text: jsonStr,
    source: filename || 'uploaded.json',
    type: 'json' as const,
  }]
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function chunkText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) { chunks.push(remaining); break }
    let breakAt = maxLen
    const sentenceEnd = remaining.lastIndexOf('. ', maxLen)
    if (sentenceEnd > maxLen * 0.5) breakAt = sentenceEnd + 1
    chunks.push(remaining.slice(0, breakAt).trim())
    remaining = remaining.slice(breakAt).trim()
  }
  return chunks
}

// server/lib/brand-parse.ts

export interface ParsedChunk {
  text: string
  source: string
  type: 'url' | 'pdf' | 'image' | 'json'
}

export async function parseUrl(url: string): Promise<ParsedChunk[]> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'VisantBot/1.0 (brand-extractor)' },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`)

  const html = await response.text()
  const text = stripHtml(html)
  return chunkText(text, 2000).map(chunk => ({ text: chunk, source: url, type: 'url' as const }))
}

export async function parsePdf(buffer: Buffer, filename?: string): Promise<ParsedChunk[]> {
  const pdf = await import('pdf-parse')
  const data = await pdf.default(buffer)
  return chunkText(data.text || '', 2000).map(chunk => ({
    text: chunk,
    source: filename || 'uploaded.pdf',
    type: 'pdf' as const,
  }))
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

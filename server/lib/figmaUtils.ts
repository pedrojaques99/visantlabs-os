// server/lib/figmaUtils.ts
// Utilities for Figma URL parsing and validation

/**
 * Extract file key from Figma URL
 * Supports: figma.com/file/KEY/..., figma.com/design/KEY/...
 */
export function extractFigmaFileKey(url: string): string | null {
  if (!url) return null
  const match = url.match(/figma\.com\/(file|design)\/([a-zA-Z0-9]+)/)
  return match?.[2] || null
}

/**
 * Validate if URL is a valid Figma file URL
 */
export function isValidFigmaUrl(url: string): boolean {
  return extractFigmaFileKey(url) !== null
}

/**
 * Build canonical Figma file URL from key
 */
export function buildFigmaUrl(fileKey: string): string {
  return `https://www.figma.com/file/${fileKey}`
}

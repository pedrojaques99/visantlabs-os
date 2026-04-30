// server/lib/brand-normalize.ts
//
// Single source of truth for transforming raw extracted brand tokens (from
// fig-extract / pdf-extract / image ingest / Gemini brand-extract) into the
// canonical BrandGuideline shape persisted to the DB.
//
// Rule: every token type has ONE normalizer. Both /apply-fig-tokens and
// /ingest funnel through these functions — no field shape is constructed
// anywhere else, no defaults are hardcoded outside of this file.
import crypto from 'crypto'

// ── Raw input shapes (what extractors emit) ───────────────────────────────────

export interface RawColor      { hex: string; name?: string; role?: string }
export interface RawFont       { family: string; style?: string; size?: number; role?: string; lineHeight?: number; letterSpacing?: string }
export interface RawGradient   { name?: string; css?: string; stops?: Array<{ hex: string; position: number }>; type?: string; angle?: number }
export interface RawShadow     { name?: string; css?: string; x?: number; y?: number; blur?: number; spread?: number; color?: string; opacity?: number }
export interface RawBorder     { name?: string; width?: number; color?: string; style?: string; css?: string }
export interface RawAssetClass { index: number; category: string; logoVariant?: string; label?: string }

// ── Type inference helpers ────────────────────────────────────────────────────

const TYPOGRAPHY_ROLES = ['heading', 'body', 'accent', 'mono'] as const
type TypographyRole = typeof TYPOGRAPHY_ROLES[number]

const ASSET_CATEGORIES = ['logo', 'icon', 'photo', 'mockup', 'pattern', 'strategy', 'other'] as const
const LOGO_VARIANTS    = ['primary', 'dark', 'light', 'icon', 'accent', 'custom', 'stacked', 'horizontal', 'abbreviated'] as const

function isHex(s: unknown): s is string {
  return typeof s === 'string' && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(s)
}

function toHex(value: string | undefined, fallback = '#000000'): string {
  return isHex(value) ? value.toUpperCase() : fallback
}

function inferTypographyRole(provided: string | undefined, size: number | undefined): TypographyRole {
  if (provided && (TYPOGRAPHY_ROLES as readonly string[]).includes(provided)) return provided as TypographyRole
  if (typeof size === 'number' && Number.isFinite(size)) {
    if (size >= 32) return 'heading'
    if (size >= 20) return 'accent'
    if (size <= 12) return 'mono'
    return 'body'
  }
  return 'body'
}

// ── CSS parsers (no hardcoded fallbacks — return undefined when un-parseable) ─

const SHADOW_PARTS_RE = /(-?\d+(?:\.\d+)?)\s*px\s+(-?\d+(?:\.\d+)?)\s*px\s+(\d+(?:\.\d+)?)\s*px(?:\s+(-?\d+(?:\.\d+)?)\s*px)?\s+(rgba?\([^)]+\)|#[0-9A-Fa-f]{3,8})/

const RGBA_RE = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/

function parseShadowCss(css: string | undefined) {
  if (!css || css.length > 512) return undefined
  const m = SHADOW_PARTS_RE.exec(css)
  if (!m) return undefined
  const [, xs, ys, blurs, spreads, colorStr] = m
  const out: { x: number; y: number; blur: number; spread: number; color: string; opacity: number } = {
    x: parseFloat(xs),
    y: parseFloat(ys),
    blur: parseFloat(blurs),
    spread: spreads ? parseFloat(spreads) : 0,
    color: '#000000',
    opacity: 1,
  }
  if (colorStr.startsWith('#')) {
    out.color = colorStr.toUpperCase()
  } else {
    const rgba = RGBA_RE.exec(colorStr)
    if (rgba) {
      const [, r, g, b, a] = rgba
      out.color = '#' + [+r, +g, +b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase()
      if (a !== undefined) out.opacity = parseFloat(a)
    }
  }
  return out
}

function parseGradientType(css: string | undefined): 'linear' | 'radial' | 'conic' {
  if (!css) return 'linear'
  if (css.startsWith('radial')) return 'radial'
  if (css.startsWith('conic'))  return 'conic'
  return 'linear'
}

function parseGradientAngle(css: string | undefined): number | undefined {
  if (!css || css.length > 512) return undefined
  const m = css.match(/(-?\d+)\s*deg/)
  return m ? parseInt(m[1], 10) : undefined
}

// ── Public normalizers ────────────────────────────────────────────────────────

export function normalizeColors(input: RawColor[] | undefined): Array<{ hex: string; name: string; role?: string }> {
  if (!Array.isArray(input)) return []
  return input
    .filter(c => isHex(c.hex))
    .map(c => ({
      hex: c.hex.toUpperCase(),
      name: c.name?.trim() || c.hex.toUpperCase(),
      role: c.role,
    }))
}

export function normalizeTypography(input: RawFont[] | undefined) {
  if (!Array.isArray(input)) return []
  return input
    .filter(f => typeof f.family === 'string' && f.family.trim().length > 0)
    .map(f => ({
      family: f.family.trim(),
      style: f.style?.trim() || 'Regular',
      size: typeof f.size === 'number' ? f.size : undefined,
      role: inferTypographyRole(f.role, f.size),
      lineHeight: typeof f.lineHeight === 'number' ? f.lineHeight : undefined,
      letterSpacing: f.letterSpacing,
    }))
}

export function normalizeGradients(input: RawGradient[] | undefined) {
  if (!Array.isArray(input)) return []
  return input.map(g => {
    const css = g.css || ''
    const stops = Array.isArray(g.stops) ? g.stops.filter(s => isHex(s.hex)) : []
    const angle = g.angle ?? parseGradientAngle(css)
    const type  = (g.type as any) || parseGradientType(css)
    const out: any = {
      id:    crypto.randomUUID(),
      name:  g.name?.trim() || 'Gradient',
      type,
      stops,
      css,
    }
    if (typeof angle === 'number') out.angle = angle
    return out
  })
}

export function normalizeShadows(input: RawShadow[] | undefined) {
  if (!Array.isArray(input)) return []
  return input.map(s => {
    const parsed = parseShadowCss(s.css)
    const out: any = {
      id:   crypto.randomUUID(),
      name: s.name?.trim() || 'Shadow',
      type: 'outer',
      css:  s.css || '',
    }
    // Source-provided structured fields take precedence; parsed fills gaps; else omit
    const x       = s.x       ?? parsed?.x
    const y       = s.y       ?? parsed?.y
    const blur    = s.blur    ?? parsed?.blur
    const spread  = s.spread  ?? parsed?.spread
    const color   = s.color   ?? parsed?.color
    const opacity = s.opacity ?? parsed?.opacity
    if (typeof x       === 'number') out.x       = x
    if (typeof y       === 'number') out.y       = y
    if (typeof blur    === 'number') out.blur    = blur
    if (typeof spread  === 'number') out.spread  = spread
    if (typeof color   === 'string') out.color   = toHex(color, color.toUpperCase())
    if (typeof opacity === 'number') out.opacity = opacity
    return out
  })
}

export function normalizeBorders(input: RawBorder[] | undefined) {
  if (!Array.isArray(input)) return []
  return input
    .filter(b => typeof b.width === 'number' && b.width > 0)
    .map(b => {
      const style = (b.style && b.style.trim()) || 'solid'
      const color = toHex(b.color)
      return {
        id:    crypto.randomUUID(),
        name:  b.name?.trim() || 'Border',
        width: b.width!,
        style,
        color,
        css:   b.css?.trim() || `${b.width}px ${style} ${color}`,
      }
    })
}

export function normalizeRadii(input: number[] | undefined): Record<string, number> {
  if (!Array.isArray(input)) return {}
  const radii = input.filter(v => typeof v === 'number' && v >= 0)
  const out: Record<string, number> = {}
  radii.forEach((v, i) => { out[`r${i + 1}`] = v })
  return out
}

export function normalizeAssetClassifications(input: RawAssetClass[] | undefined) {
  if (!Array.isArray(input)) return []
  return input
    .filter(c => typeof c.index === 'number' && (ASSET_CATEGORIES as readonly string[]).includes(c.category))
    .map(c => ({
      index:       c.index,
      category:    c.category as typeof ASSET_CATEGORIES[number],
      logoVariant: (LOGO_VARIANTS as readonly string[]).includes(c.logoVariant ?? '') ? (c.logoVariant as typeof LOGO_VARIANTS[number]) : undefined,
      label:       c.label?.trim() || undefined,
    }))
}

// ── Source tracking ───────────────────────────────────────────────────────────

const VALID_SOURCES = ['pdf', 'fig_file', 'images', 'image', 'url', 'json', 'manual'] as const
type ExtractionSource = typeof VALID_SOURCES[number]

export function normalizeSourceType(input: unknown): ExtractionSource {
  return (VALID_SOURCES as readonly string[]).includes(String(input)) ? (input as ExtractionSource) : 'manual'
}

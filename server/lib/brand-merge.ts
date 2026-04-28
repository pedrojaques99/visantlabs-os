// server/lib/brand-merge.ts
import { BrandGuideline, calculateCompleteness } from '../types/brandGuideline.js'

export function mergeBrandGuidelines(existing: BrandGuideline, incoming: Partial<BrandGuideline>): BrandGuideline {
  const merged = { ...existing }

  // Identity: only fill empty fields
  if (incoming.identity) {
    merged.identity = merged.identity || {}
    for (const k of ['name', 'website', 'tagline', 'description'] as const) {
      if (!(merged.identity as any)[k] && (incoming.identity as any)[k]) {
        (merged.identity as any)[k] = (incoming.identity as any)[k]
      }
    }
  }

  // Colors: dedup by hex
  if (incoming.colors?.length) {
    const seen = new Set((merged.colors || []).map(c => c.hex.toUpperCase()))
    merged.colors = [...(merged.colors || []), ...incoming.colors.filter(c => !seen.has(c.hex.toUpperCase()))]
  }

  // Typography: dedup by family+style
  if (incoming.typography?.length) {
    const seen = new Set((merged.typography || []).map(t => `${t.family}|${t.style || ''}`))
    merged.typography = [...(merged.typography || []), ...incoming.typography.filter(t => !seen.has(`${t.family}|${t.style || ''}`))]
  }

  // Tags: union per category
  if (incoming.tags) {
    merged.tags = merged.tags || {}
    for (const [cat, values] of Object.entries(incoming.tags)) {
      const existing = new Set(merged.tags[cat] || [])
      merged.tags[cat] = [...existing, ...values.filter(v => !existing.has(v))]
    }
  }

  // Logos & media: always append
  if (incoming.logos?.length) merged.logos = [...(merged.logos || []), ...incoming.logos]
  if (incoming.media?.length) merged.media = [...(merged.media || []), ...incoming.media]

  // Tokens: merge objects
  if (incoming.tokens) {
    merged.tokens = merged.tokens || {}
    if (incoming.tokens.spacing) merged.tokens.spacing = { ...merged.tokens.spacing, ...incoming.tokens.spacing }
    if (incoming.tokens.radius) merged.tokens.radius = { ...merged.tokens.radius, ...incoming.tokens.radius }
    if (incoming.tokens.shadows) merged.tokens.shadows = { ...merged.tokens.shadows, ...incoming.tokens.shadows }
    if (incoming.tokens.components) merged.tokens.components = { ...merged.tokens.components, ...incoming.tokens.components }
  }

  // Guidelines: only fill empty
  if (incoming.guidelines) {
    merged.guidelines = merged.guidelines || {}
    if (!merged.guidelines.voice && incoming.guidelines.voice) merged.guidelines.voice = incoming.guidelines.voice
    if (!merged.guidelines.dos?.length && incoming.guidelines.dos?.length) merged.guidelines.dos = incoming.guidelines.dos
    if (!merged.guidelines.donts?.length && incoming.guidelines.donts?.length) merged.guidelines.donts = incoming.guidelines.donts
    if (!merged.guidelines.imagery && incoming.guidelines.imagery) merged.guidelines.imagery = incoming.guidelines.imagery
  }

  // Strategy: only fill empty
  if (incoming.strategy) {
    merged.strategy = merged.strategy || {}
    if (!merged.strategy.manifesto && incoming.strategy.manifesto) merged.strategy.manifesto = incoming.strategy.manifesto
    if (!merged.strategy.positioning && incoming.strategy.positioning) merged.strategy.positioning = incoming.strategy.positioning
    if (!merged.strategy.archetypes?.length && incoming.strategy.archetypes?.length) merged.strategy.archetypes = incoming.strategy.archetypes
    if (!merged.strategy.personas?.length && incoming.strategy.personas?.length) merged.strategy.personas = incoming.strategy.personas
    if (!merged.strategy.voiceValues?.length && incoming.strategy.voiceValues?.length) merged.strategy.voiceValues = incoming.strategy.voiceValues
  }


  // Gradients: dedup by CSS string
  if ((incoming as any).gradients?.length) {
    const seen = new Set((merged as any).gradients?.map((g: any) => g.css) || [])
    ;(merged as any).gradients = [
      ...((merged as any).gradients || []),
      ...(incoming as any).gradients.filter((g: any) => !seen.has(g.css)),
    ]
  }

  // Shadows (array form): dedup by CSS string
  if ((incoming as any).shadows?.length) {
    const seen = new Set((merged as any).shadows?.map((s: any) => s.css) || [])
    ;(merged as any).shadows = [
      ...((merged as any).shadows || []),
      ...(incoming as any).shadows.filter((s: any) => !seen.has(s.css)),
    ]
  }

  // Borders: dedup by css
  if ((incoming as any).borders?.length) {
    const seen = new Set((merged as any).borders?.map((b: any) => b.css || `${b.width}:${b.color}`) || [])
    ;(merged as any).borders = [
      ...((merged as any).borders || []),
      ...(incoming as any).borders.filter((b: any) => !seen.has(b.css || `${b.width}:${b.color}`)),
    ]
  }

  merged.extraction = merged.extraction || { sources: [], completeness: 0 }
  merged.extraction.completeness = calculateCompleteness(merged)

  return merged
}

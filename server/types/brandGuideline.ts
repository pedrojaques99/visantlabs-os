// server/types/brandGuideline.ts

export interface BrandGuidelineIdentity {
  name?: string
  website?: string
  tagline?: string
  description?: string
}

export interface BrandGuidelineLogo {
  id: string
  url: string
  variant: 'primary' | 'dark' | 'light' | 'icon' | 'custom'
  label?: string
}

export interface BrandGuidelineColor {
  hex: string
  name: string
  role?: string // "background", "text", "accent", "cta"
}

export interface BrandGuidelineTypography {
  family: string
  style?: string   // "Bold", "Regular", "SemiBold"
  role: string     // "heading", "body", "accent", "mono"
  size?: number
  lineHeight?: number
}

export interface BrandGuidelineMedia {
  id: string
  url: string
  type: 'image' | 'pdf'
  label?: string
}

export interface BrandGuidelineTokens {
  spacing?: Record<string, number>
  radius?: Record<string, number>
  shadows?: Record<string, { x: number; y: number; blur: number; spread: number; color: string; opacity: number }>
  components?: Record<string, any>
}

export interface BrandGuidelineGuidelines {
  voice?: string
  dos?: string[]
  donts?: string[]
  imagery?: string
  accessibility?: string
}

export interface BrandGuidelineExtraction {
  sources: Array<{ type: 'url' | 'pdf' | 'image' | 'json' | 'manual'; ref?: string; date: string }>
  completeness: number // 0-100
}

export interface BrandGuideline {
  id?: string
  userId?: string
  identity?: BrandGuidelineIdentity
  logos?: BrandGuidelineLogo[]
  colors?: BrandGuidelineColor[]
  typography?: BrandGuidelineTypography[]
  tags?: Record<string, string[]>
  media?: BrandGuidelineMedia[]
  tokens?: BrandGuidelineTokens
  guidelines?: BrandGuidelineGuidelines
  extraction?: BrandGuidelineExtraction
  updatedAt?: string
  // Public sharing
  publicSlug?: string
  isPublic?: boolean
}

/**
 * Calculate completeness percentage based on filled sections.
 */
export function calculateCompleteness(bg: BrandGuideline): number {
  const sections = [
    bg.identity?.name ? 1 : 0,
    (bg.logos?.length ?? 0) > 0 ? 1 : 0,
    (bg.colors?.length ?? 0) > 0 ? 1 : 0,
    (bg.typography?.length ?? 0) > 0 ? 1 : 0,
    bg.tags && Object.keys(bg.tags).length > 0 ? 1 : 0,
    bg.guidelines?.voice ? 1 : 0,
  ]
  return Math.round((sections.reduce((a, b) => a + b, 0) / sections.length) * 100)
}

// server/routes/brand-guidelines.ts
import express from 'express'
import crypto from 'crypto'
import { nanoid } from 'nanoid'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { prisma } from '../db/prisma.js'
import { rateLimit } from 'express-rate-limit'
import { BrandGuideline, BrandGuidelineMedia, BrandGuidelineLogo, calculateCompleteness } from '../types/brandGuideline.js'
import { parseUrl, parsePdf, parseImage, parseJson } from '../lib/brand-parse.js'
import { extractBrandData } from '../lib/brand-extract.js'
import { mergeBrandGuidelines } from '../lib/brand-merge.js'
import { uploadBrandMedia, deleteImage } from '../services/r2Service.js'
import { brandSharedService } from '../services/brandSharedService.js'
import { buildBrandContext, buildBrandContextForImageGen } from '../lib/brandContextBuilder.js'

const router = express.Router()

const apiRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_API || '60', 10),
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// GET /api/brand-guidelines — list all user's brand guidelines
router.get('/', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const guidelines = await prisma.brandGuideline.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
    })

    res.json({
      guidelines: guidelines.map(g => ({
        ...g,
        _id: g.id,
      }))
    })
  } catch (error: any) {
    console.error('Error listing brand guidelines:', error)
    res.status(500).json({ error: 'Failed to list brand guidelines' })
  }
})

// POST /api/brand-guidelines — create new brand guideline
router.post('/', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const data: Partial<BrandGuideline> = req.body
    const completeness = calculateCompleteness(data)

    const guideline = await prisma.brandGuideline.create({
      data: {
        userId: req.userId,
        identity: data.identity as any || undefined,
        logos: data.logos as any || undefined,
        colors: data.colors as any || undefined,
        typography: data.typography as any || undefined,
        tags: data.tags as any || undefined,
        media: data.media as any || undefined,
        tokens: data.tokens as any || undefined,
        guidelines: data.guidelines as any || undefined,
        extraction: { sources: [], completeness } as any,
      },
    })

    res.status(201).json({ guideline: { ...guideline, _id: guideline.id } })
  } catch (error: any) {
    console.error('Error creating brand guideline:', error)
    res.status(500).json({ error: 'Failed to create brand guideline' })
  }
})

// GET /api/brand-guidelines/:id — fetch single guideline
router.get('/:id', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const guideline = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
    })

    if (!guideline) return res.status(404).json({ error: 'Not found' })
    res.json({ guideline: { ...guideline, _id: guideline.id } })
  } catch (error: any) {
    console.error('Error fetching brand guideline:', error)
    res.status(500).json({ error: 'Failed to fetch brand guideline' })
  }
})

// PUT /api/brand-guidelines/:id — partial update
router.put('/:id', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const existing = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
    })

    if (!existing) return res.status(404).json({ error: 'Not found' })

    const update: Partial<BrandGuideline> = req.body
    const merged: any = {}
    const fields = ['identity', 'logos', 'colors', 'typography', 'tags', 'media', 'tokens', 'guidelines', 'extraction', 'activeSections'] as const

    for (const field of fields) {
      if (update[field] !== undefined) {
        merged[field] = update[field]
      }
    }

    // Recalculate completeness
    const fullData = { ...existing, ...merged } as any
    const completeness = calculateCompleteness(fullData)
    const extraction = (merged.extraction || existing.extraction || { sources: [] }) as any
    extraction.completeness = completeness
    merged.extraction = extraction

    const guideline = await prisma.brandGuideline.update({
      where: { id: existing.id },
      data: merged,
    })

    res.json({ guideline: { ...guideline, _id: guideline.id } })
  } catch (error: any) {
    console.error('Error updating brand guideline:', error)
    res.status(500).json({ error: 'Failed to update brand guideline' })
  }
})

// POST /api/brand-guidelines/:id/duplicate — clone a guideline
router.post('/:id/duplicate', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const original = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
    })

    if (!original) return res.status(404).json({ error: 'Not found' })

    // Clone the guideline with a new name
    const originalIdentity = original.identity as any || {}
    const clonedIdentity = {
      ...originalIdentity,
      name: `${originalIdentity.name || 'Untitled'} (Copy)`,
    }

    const cloned = await prisma.brandGuideline.create({
      data: {
        userId: req.userId,
        identity: clonedIdentity as any,
        logos: original.logos as any || undefined,
        colors: original.colors as any || undefined,
        typography: original.typography as any || undefined,
        tags: original.tags as any || undefined,
        media: original.media as any || undefined,
        tokens: original.tokens as any || undefined,
        guidelines: original.guidelines as any || undefined,
        extraction: { sources: [], completeness: 0 } as any,
        // Reset public sharing
        publicSlug: null,
        isPublic: false,
      },
    })

    res.status(201).json({ guideline: { ...cloned, _id: cloned.id } })
  } catch (error: any) {
    console.error('Error duplicating brand guideline:', error)
    res.status(500).json({ error: 'Failed to duplicate brand guideline' })
  }
})

// DELETE /api/brand-guidelines/:id
router.delete('/:id', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const guideline = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
    })

    if (!guideline) return res.status(404).json({ error: 'Not found' })
    await prisma.brandGuideline.delete({ where: { id: guideline.id } })
    res.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting brand guideline:', error)
    res.status(500).json({ error: 'Failed to delete brand guideline' })
  }
})

// POST /api/brand-guidelines/:id/ingest — extract from source and merge
router.post('/:id/ingest', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const existing = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
    })
    if (!existing) return res.status(404).json({ error: 'Brand guideline not found' })

    const { source, url, data, filename } = req.body
    let chunks: any[] = []
    let imageBase64: string | undefined

    switch (source) {
      case 'url':
        if (!url) return res.status(400).json({ error: 'URL required' })
        chunks = await parseUrl(url)
        break
      case 'pdf':
        if (!data) return res.status(400).json({ error: 'PDF data required' })
        chunks = await parsePdf(Buffer.from(data.replace(/^data:application\/pdf;base64,/, ''), 'base64'), filename)
        break
      case 'image':
        if (!data) return res.status(400).json({ error: 'Image data required' })
        chunks = parseImage(filename || 'image.png')
        imageBase64 = data.replace(/^data:image\/\w+;base64,/, '')
        break
      case 'json': {
        if (!data) return res.status(400).json({ error: 'JSON data required' })
        const jsonStr = typeof data === 'string'
          ? (data.startsWith('data:') ? Buffer.from(data.replace(/^data:[^;]+;base64,/, ''), 'base64').toString('utf-8') : data)
          : JSON.stringify(data)
        chunks = parseJson(jsonStr, filename)
        break
      }
      default:
        return res.status(400).json({ error: `Invalid source: ${source}` })
    }

    const extracted = await extractBrandData(chunks, imageBase64, req.userId)
    const merged = mergeBrandGuidelines(existing as any, extracted)

    // Track source
    merged.extraction = merged.extraction || { sources: [], completeness: 0 }
    merged.extraction.sources.push({ type: source, ref: url || filename, date: new Date().toISOString() })
    merged.extraction.completeness = calculateCompleteness(merged)

    const guideline = await prisma.brandGuideline.update({
      where: { id: existing.id },
      data: {
        identity: merged.identity as any,
        logos: merged.logos as any,
        colors: merged.colors as any,
        typography: merged.typography as any,
        tags: merged.tags as any,
        media: merged.media as any,
        tokens: merged.tokens as any,
        guidelines: merged.guidelines as any,
        extraction: merged.extraction as any,
      },
    })

    res.json({
      guideline: { ...guideline, _id: guideline.id },
      extracted, // what AI found — user can review
    })
  } catch (error: any) {
    console.error('[Brand Ingest] Error:', error)
    res.status(500).json({ error: 'Ingestion failed', message: error.message })
  }
})

// POST /api/brand-guidelines/sync/:projectId — sync from Branding Machine project
router.post('/sync/:projectId', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const brandingProject = await prisma.brandingProject.findFirst({
      where: { id: req.params.projectId, userId: req.userId },
    })

    if (!brandingProject) return res.status(404).json({ error: 'Branding project not found' })

    const convertedData = brandSharedService.brandingToGuideline(brandingProject.data as any)

    // Check if user already has a guideline for this brand name or create a new one
    const guidelines = await prisma.brandGuideline.findMany({
      where: { userId: req.userId }
    })

    const brandName = convertedData.identity?.name
    let guideline = guidelines.find(g => (g.identity as any)?.name === brandName)

    if (guideline) {
      // Update existing
      guideline = await prisma.brandGuideline.update({
        where: { id: guideline.id },
        data: {
          identity: { ...((guideline.identity as any) || {}), ...convertedData.identity } as any,
          colors: convertedData.colors as any,
          typography: convertedData.typography as any,
          tags: convertedData.tags as any,
          guidelines: { ...((guideline.guidelines as any) || {}), ...convertedData.guidelines } as any,
        }
      })
    } else {
      // Create new
      guideline = await prisma.brandGuideline.create({
        data: {
          userId: req.userId,
          identity: convertedData.identity as any,
          colors: convertedData.colors as any,
          typography: convertedData.typography as any,
          tags: convertedData.tags as any,
          guidelines: convertedData.guidelines as any,
          extraction: { sources: [{ type: 'branding_machine', ref: brandingProject.id, date: new Date().toISOString() }], completeness: 0 } as any,
        }
      })
    }

    res.json({ guideline: { ...guideline, _id: guideline.id } })
  } catch (error: any) {
    console.error('[Brand Sync] Error:', error)
    res.status(500).json({ error: 'Sync failed', message: error.message })
  }
})

// GET /api/brand-guidelines/:id/export — export as JSON
router.get('/:id/export', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })
    const format = (req.query.format as string) || 'visant'

    const guideline = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
    })

    if (!guideline) return res.status(404).json({ error: 'Not found' })

    if (format === 'design-system') {
      // Export in legacy DesignSystemJSON format for backward compat
      const bg = guideline as any
      const ds: any = {
        $schema: 'visant/design-system/v1',
        name: bg.identity?.name || 'Exported',
        version: '1.0',
      }
      if (bg.colors?.length) {
        ds.colors = {}
        for (const c of bg.colors) ds.colors[c.name] = { hex: c.hex, usage: c.role || '' }
      }
      if (bg.typography?.length) {
        ds.typography = {}
        for (const t of bg.typography) ds.typography[t.role] = { family: t.family, style: t.style, size: t.size, lineHeight: t.lineHeight }
      }
      if (bg.tokens?.spacing) ds.spacing = bg.tokens.spacing
      if (bg.tokens?.radius) ds.radius = bg.tokens.radius
      if (bg.tokens?.shadows) ds.shadows = bg.tokens.shadows
      if (bg.tokens?.components) ds.components = bg.tokens.components
      if (bg.guidelines) ds.guidelines = bg.guidelines
      return res.json(ds)
    }

    // Default: full BrandGuideline (strip internal fields)
    const { id, userId, ...exported } = guideline as any
    res.json(exported)
  } catch (error: any) {
    console.error('Error exporting brand guideline:', error)
    res.status(500).json({ error: 'Failed to export' })
  }
})

// ═══════════════════════════════════════════════════
// MEDIA KIT ENDPOINTS
// ═══════════════════════════════════════════════════

// POST /api/brand-guidelines/:id/media — upload media to guideline's kit
router.post('/:id/media', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const guideline = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
    })
    if (!guideline) return res.status(404).json({ error: 'Brand guideline not found' })

    const { data, url, label, type: mediaType, contentType: ct } = req.body
    const mediaId = crypto.randomUUID()
    let mediaUrl: string
    let resolvedType: 'image' | 'pdf' = 'image'

    if (data) {
      // Base64 upload
      const contentType = ct || (data.startsWith('data:application/pdf') ? 'application/pdf' : 'image/png')
      resolvedType = contentType.includes('pdf') ? 'pdf' : 'image'

      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { subscriptionTier: true, isAdmin: true },
      })

      mediaUrl = await uploadBrandMedia(
        data, req.userId, guideline.id, mediaId, contentType,
        user?.subscriptionTier || undefined, user?.isAdmin || undefined,
      )
    } else if (url) {
      // URL reference (no upload, just store the URL)
      mediaUrl = url
      resolvedType = mediaType === 'pdf' ? 'pdf' : 'image'
    } else {
      return res.status(400).json({ error: 'Either data (base64) or url is required' })
    }

    const newMedia: BrandGuidelineMedia = { id: mediaId, url: mediaUrl, type: resolvedType, label }
    const existingMedia = (guideline.media as unknown as BrandGuidelineMedia[] | null) || []
    const updatedMedia = [...existingMedia, newMedia]

    const updated = await prisma.brandGuideline.update({
      where: { id: guideline.id },
      data: { media: updatedMedia as any },
    })

    res.status(201).json({ media: newMedia, allMedia: updatedMedia, guideline: { ...updated, _id: updated.id } })
  } catch (error: any) {
    console.error('[Brand Media Upload] Error:', error)
    res.status(500).json({ error: 'Failed to upload media', message: error.message })
  }
})

// DELETE /api/brand-guidelines/:id/media/:mediaId — remove media from kit
router.delete('/:id/media/:mediaId', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const guideline = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
    })
    if (!guideline) return res.status(404).json({ error: 'Brand guideline not found' })

    const existingMedia = (guideline.media as unknown as BrandGuidelineMedia[] | null) || []
    const mediaToDelete = existingMedia.find(m => m.id === req.params.mediaId)
    if (!mediaToDelete) return res.status(404).json({ error: 'Media not found' })

    // Try to delete from R2 if it's an R2 URL
    const publicUrl = process.env.R2_PUBLIC_URL
    if (publicUrl && mediaToDelete.url.startsWith(publicUrl)) {
      try { await deleteImage(mediaToDelete.url) } catch (e) { /* ignore R2 delete errors */ }
    }

    const updatedMedia = existingMedia.filter(m => m.id !== req.params.mediaId)
    await prisma.brandGuideline.update({
      where: { id: guideline.id },
      data: { media: updatedMedia as any },
    })

    res.json({ success: true, allMedia: updatedMedia })
  } catch (error: any) {
    console.error('[Brand Media Delete] Error:', error)
    res.status(500).json({ error: 'Failed to delete media', message: error.message })
  }
})

// POST /api/brand-guidelines/:id/logos — upload logo variant
router.post('/:id/logos', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const guideline = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
    })
    if (!guideline) return res.status(404).json({ error: 'Brand guideline not found' })

    const { data, url, variant = 'primary', label } = req.body
    const logoId = crypto.randomUUID()
    let logoUrl: string

    if (data) {
      const contentType = 'image/png'
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { subscriptionTier: true, isAdmin: true },
      })

      logoUrl = await uploadBrandMedia(
        data, req.userId, guideline.id, `logo-${logoId}`, contentType,
        user?.subscriptionTier || undefined, user?.isAdmin || undefined,
      )
    } else if (url) {
      logoUrl = url
    } else {
      return res.status(400).json({ error: 'Either data (base64) or url is required' })
    }

    const validVariants = ['primary', 'dark', 'light', 'icon', 'custom'] as const
    const safeVariant = validVariants.includes(variant) ? variant : 'custom'

    const newLogo: BrandGuidelineLogo = { id: logoId, url: logoUrl, variant: safeVariant, label }
    const existingLogos = (guideline.logos as unknown as BrandGuidelineLogo[] | null) || []
    const updatedLogos = [...existingLogos, newLogo]

    const updated = await prisma.brandGuideline.update({
      where: { id: guideline.id },
      data: { logos: updatedLogos as any },
    })

    res.status(201).json({ logo: newLogo, allLogos: updatedLogos, guideline: { ...updated, _id: updated.id } })
  } catch (error: any) {
    console.error('[Brand Logo Upload] Error:', error)
    res.status(500).json({ error: 'Failed to upload logo', message: error.message })
  }
})

// DELETE /api/brand-guidelines/:id/logos/:logoId — remove logo
router.delete('/:id/logos/:logoId', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const guideline = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
    })
    if (!guideline) return res.status(404).json({ error: 'Brand guideline not found' })

    const existingLogos = (guideline.logos as unknown as BrandGuidelineLogo[] | null) || []
    const logoToDelete = existingLogos.find(l => l.id === req.params.logoId)
    if (!logoToDelete) return res.status(404).json({ error: 'Logo not found' })

    const publicUrl = process.env.R2_PUBLIC_URL
    if (publicUrl && logoToDelete.url.startsWith(publicUrl)) {
      try { await deleteImage(logoToDelete.url) } catch (e) { /* ignore */ }
    }

    const updatedLogos = existingLogos.filter(l => l.id !== req.params.logoId)
    await prisma.brandGuideline.update({
      where: { id: guideline.id },
      data: { logos: updatedLogos as any },
    })

    res.json({ success: true, allLogos: updatedLogos })
  } catch (error: any) {
    console.error('[Brand Logo Delete] Error:', error)
    res.status(500).json({ error: 'Failed to delete logo', message: error.message })
  }
})

// ═══════════════════════════════════════════════════
// AGENT-FIRST / MCP-READY CONTEXT ENDPOINT
// ═══════════════════════════════════════════════════

// GET /api/brand-guidelines/:id/context — structured context for LLMs/agents/MCP
// Returns a machine-readable summary optimized for prompt injection
router.get('/:id/context', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const guideline = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
    })
    if (!guideline) return res.status(404).json({ error: 'Not found' })

    const bg = guideline as any as BrandGuideline
    const format = (req.query.format as string) || 'structured'

    if (format === 'prompt') {
      // Flat text optimized for LLM system prompt injection
      const lines: string[] = []
      const name = bg.identity?.name || 'Brand'
      lines.push(`═══ BRAND: ${name} ═══`)
      if (bg.identity?.tagline) lines.push(`Tagline: "${bg.identity.tagline}"`)
      if (bg.identity?.website) lines.push(`Website: ${bg.identity.website}`)
      if (bg.identity?.description) lines.push(`Description: ${bg.identity.description}`)
      lines.push('')

      if (bg.colors?.length) {
        lines.push('COLORS:')
        for (const c of bg.colors) lines.push(`  ${c.name}: ${c.hex}${c.role ? ` (${c.role})` : ''}`)
        lines.push('')
      }

      if (bg.typography?.length) {
        lines.push('TYPOGRAPHY:')
        for (const t of bg.typography) {
          const parts = [t.family, t.style].filter(Boolean).join(' ')
          lines.push(`  ${t.role}: ${parts}${t.size ? ` ${t.size}px` : ''}`)
        }
        lines.push('')
      }

      if (bg.guidelines?.voice) lines.push(`VOICE: ${bg.guidelines.voice}`)
      if (bg.guidelines?.dos?.length) lines.push(`DO: ${bg.guidelines.dos.join(' | ')}`)
      if (bg.guidelines?.donts?.length) lines.push(`DON'T: ${bg.guidelines.donts.join(' | ')}`)
      if (bg.guidelines?.imagery) lines.push(`IMAGERY: ${bg.guidelines.imagery}`)

      if (bg.logos?.length) {
        lines.push('')
        lines.push('LOGOS:')
        for (const l of bg.logos) lines.push(`  ${l.variant}: ${l.url}${l.label ? ` (${l.label})` : ''}`)
      }

      if (bg.media?.length) {
        lines.push('')
        lines.push('MEDIA KIT (reference assets for generation):')
        for (const m of bg.media) lines.push(`  [${m.type}] ${m.url}${m.label ? ` — ${m.label}` : ''}`)
      }

      if (bg.tokens?.spacing) {
        lines.push('')
        lines.push(`SPACING: ${Object.entries(bg.tokens.spacing).map(([k, v]) => `${k}=${v}`).join(' ')}`)
      }
      if (bg.tokens?.radius) {
        lines.push(`RADIUS: ${Object.entries(bg.tokens.radius).map(([k, v]) => `${k}=${v}`).join(' ')}`)
      }

      res.type('text/plain').send(lines.join('\n'))
    } else {
      // Structured JSON — ideal for MCP tools and programmatic access
      res.json({
        id: guideline.id,
        identity: bg.identity,
        colors: bg.colors || [],
        typography: bg.typography || [],
        logos: bg.logos || [],
        media: bg.media || [],
        guidelines: bg.guidelines || {},
        tokens: bg.tokens || {},
        tags: bg.tags || {},
        extraction: bg.extraction,
      })
    }
  } catch (error: any) {
    console.error('Error fetching brand context:', error)
    res.status(500).json({ error: 'Failed to fetch brand context' })
  }
})

// ═══════════════════════════════════════════════════
// PUBLIC SHARING ENDPOINTS
// ═══════════════════════════════════════════════════

// POST /api/brand-guidelines/:id/share — generate public link
router.post('/:id/share', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const guideline = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
    })
    if (!guideline) return res.status(404).json({ error: 'Brand guideline not found' })

    // Generate slug if not exists
    let publicSlug = guideline.publicSlug
    if (!publicSlug) {
      // Generate a unique, URL-safe slug
      const baseName = ((guideline.identity as any)?.name || 'brand')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 30)
      publicSlug = `${baseName}-${nanoid(8)}`
    }

    const updated = await prisma.brandGuideline.update({
      where: { id: guideline.id },
      data: { publicSlug, isPublic: true },
    })

    const baseUrl = process.env.VITE_SITE_URL || `${req.protocol}://${req.get('host')}`
    const shareUrl = `${baseUrl}/brand/${publicSlug}`

    res.json({
      publicSlug,
      shareUrl,
      isPublic: true,
      guideline: { ...updated, _id: updated.id },
    })
  } catch (error: any) {
    console.error('[Brand Share] Error:', error)
    res.status(500).json({ error: 'Failed to create share link', message: error.message })
  }
})

// DELETE /api/brand-guidelines/:id/share — remove public access
router.delete('/:id/share', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const guideline = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
    })
    if (!guideline) return res.status(404).json({ error: 'Brand guideline not found' })

    const updated = await prisma.brandGuideline.update({
      where: { id: guideline.id },
      data: { isPublic: false },
      // Keep publicSlug so re-sharing uses the same URL
    })

    res.json({
      isPublic: false,
      guideline: { ...updated, _id: updated.id },
    })
  } catch (error: any) {
    console.error('[Brand Unshare] Error:', error)
    res.status(500).json({ error: 'Failed to remove share', message: error.message })
  }
})

// GET /api/brand-guidelines/public/:slug — public read-only access (NO AUTH)
router.get('/public/:slug', apiRateLimiter, async (req, res) => {
  try {
    const guideline = await prisma.brandGuideline.findFirst({
      where: { publicSlug: req.params.slug, isPublic: true },
    })

    if (!guideline) return res.status(404).json({ error: 'Brand guideline not found or not public' })

    // Return guideline data (strip userId for privacy)
    const { userId, ...publicData } = guideline as any
    res.json({
      guideline: { ...publicData, _id: guideline.id },
    })
  } catch (error: any) {
    console.error('[Brand Public] Error:', error)
    res.status(500).json({ error: 'Failed to fetch public guideline' })
  }
})

// ═══════════════════════════════════════════════════
// PHASE 6: CONTEXT API FOR EXTERNAL TOOLS
// ═══════════════════════════════════════════════════

/**
 * GET /api/brand-guidelines/public/:slug/context
 * Returns LLM-ready formatted brand context (NO AUTH)
 *
 * Query params:
 *   - format: 'full' (default) | 'compact' (optimized for image gen)
 *   - output: 'text' (default) | 'json'
 *
 * Use cases:
 *   - External AI agents needing brand context
 *   - MCP servers querying brand information
 *   - Third-party apps integrating with brand guidelines
 */
router.get('/public/:slug/context', apiRateLimiter, async (req, res) => {
  try {
    const { format = 'full', output = 'text' } = req.query as { format?: string; output?: string }

    const guideline = await prisma.brandGuideline.findFirst({
      where: { publicSlug: req.params.slug, isPublic: true },
    })

    if (!guideline) {
      return res.status(404).json({ error: 'Brand guideline not found or not public' })
    }

    // Reconstruct BrandGuideline object from Prisma model
    const guidelineData = {
      id: guideline.id,
      identity: guideline.identity as any,
      logos: guideline.logos as any,
      colors: guideline.colors as any,
      typography: guideline.typography as any,
      tags: guideline.tags as any,
      media: guideline.media as any,
      tokens: guideline.tokens as any,
      guidelines: guideline.guidelines as any,
    }

    // Build context based on format
    const context = format === 'compact'
      ? buildBrandContextForImageGen(guidelineData)
      : buildBrandContext(guidelineData)

    // Return based on output format
    if (output === 'json') {
      res.json({
        slug: req.params.slug,
        brandName: (guidelineData.identity as any)?.name || 'Unknown',
        format,
        context,
        // Also include structured data for programmatic access
        data: {
          colors: guidelineData.colors,
          typography: guidelineData.typography,
          guidelines: guidelineData.guidelines,
          tokens: guidelineData.tokens,
        }
      })
    } else {
      // Return plain text for direct LLM injection
      res.type('text/plain').send(context)
    }
  } catch (error: any) {
    console.error('[Brand Context API] Error:', error)
    res.status(500).json({ error: 'Failed to generate brand context' })
  }
})

/**
 * GET /api/brand-guidelines/:id/context
 * Returns LLM-ready formatted brand context (REQUIRES AUTH)
 *
 * Same query params as public endpoint
 */
router.get('/:id/context', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const { format = 'full', output = 'text' } = req.query as { format?: string; output?: string }

    const guideline = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
    })

    if (!guideline) {
      return res.status(404).json({ error: 'Brand guideline not found' })
    }

    // Reconstruct BrandGuideline object from Prisma model
    const guidelineData = {
      id: guideline.id,
      identity: guideline.identity as any,
      logos: guideline.logos as any,
      colors: guideline.colors as any,
      typography: guideline.typography as any,
      tags: guideline.tags as any,
      media: guideline.media as any,
      tokens: guideline.tokens as any,
      guidelines: guideline.guidelines as any,
    }

    // Build context based on format
    const context = format === 'compact'
      ? buildBrandContextForImageGen(guidelineData)
      : buildBrandContext(guidelineData)

    // Return based on output format
    if (output === 'json') {
      res.json({
        id: guideline.id,
        brandName: (guidelineData.identity as any)?.name || 'Unknown',
        format,
        context,
        data: {
          colors: guidelineData.colors,
          typography: guidelineData.typography,
          guidelines: guidelineData.guidelines,
          tokens: guidelineData.tokens,
        }
      })
    } else {
      res.type('text/plain').send(context)
    }
  } catch (error: any) {
    console.error('[Brand Context API] Error:', error)
    res.status(500).json({ error: 'Failed to generate brand context' })
  }
})

export default router

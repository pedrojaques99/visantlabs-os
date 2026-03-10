// server/routes/brand-guidelines.ts
import express from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { prisma } from '../db/prisma.js'
import { rateLimit } from 'express-rate-limit'
import { BrandGuideline, calculateCompleteness } from '../types/brandGuideline.js'

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
    const fields = ['identity', 'logos', 'colors', 'typography', 'tags', 'media', 'tokens', 'guidelines', 'extraction'] as const

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

export default router

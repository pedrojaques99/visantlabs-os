// server/routes/brand-guidelines.ts
import express from 'express'
import crypto from 'crypto'
import { nanoid } from 'nanoid'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { prisma } from '../db/prisma.js'
import { rateLimit } from 'express-rate-limit'
import { Liveblocks } from '@liveblocks/node'
import { BrandGuideline, BrandGuidelineMedia, BrandGuidelineLogo, calculateCompleteness } from '../types/brandGuideline.js'
import { parseUrl, parsePdf, parseImage, parseJson } from '../lib/brand-parse.js'
import { extractBrandData, type AssetClassification } from '../lib/brand-extract.js'
import { mergeBrandGuidelines } from '../lib/brand-merge.js'
import { uploadBrandMedia, deleteImage } from '../services/r2Service.js'
import { brandSharedService } from '../services/brandSharedService.js'
import { buildBrandContext, buildBrandContextForImageGen } from '../lib/brandContextBuilder.js'
import { vectorService } from '../services/vectorService.js'
import { checkBrandCompliance, type ComplianceCheckInput } from '../services/complianceService.js'
import { getGeminiApiKey } from '../utils/geminiApiKey.js'
import { calculateChangedFields, createSnapshot, generateChangeNote, generateDiff, formatVersionListItem } from '../lib/versionUtils.js'
import { extractFigmaFileKey, isValidFigmaUrl } from '../lib/figmaUtils.js'
import { BrandGuidelineSchema, BrandGuidelinePatchSchema } from '../../src/lib/brandGuidelineSchema.js'

import multer from 'multer'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 600 * 1024 * 1024 } })

const apiRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_API || '60', 10),
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Stricter limiter for unauthenticated public endpoints (no JWT = higher abuse surface)
const publicRateLimiter = rateLimit({
  windowMs: 60_000,
  max: parseInt(process.env.RATE_LIMIT_MAX_PUBLIC || '30', 10),
  message: { error: 'Too many requests to public endpoint. Please try again later.' },
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

    const parsed = BrandGuidelineSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid brand guideline payload', issues: parsed.error.issues })
    }
    const data: Partial<BrandGuideline> = parsed.data as any
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

// PUT /api/brand-guidelines/:id — partial update with version tracking
router.put('/:id', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const existing = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
    })

    if (!existing) return res.status(404).json({ error: 'Not found' })

    const parsed = BrandGuidelinePatchSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid brand guideline patch', issues: parsed.error.issues })
    }
    const update: Partial<BrandGuideline> = parsed.data as any
    const { changeNote } = req.body // Optional user-provided change note
    const merged: Partial<BrandGuideline> = {}
    const fields = ['identity', 'logos', 'colors', 'typography', 'tags', 'media', 'tokens', 'guidelines', 'extraction', 'activeSections', 'folder', 'strategy', 'orderedBlocks', 'gradients', 'shadows', 'motion', 'borders', 'validation', 'isPublic', 'publicSlug'] as const

    for (const field of fields) {
      if (update[field] !== undefined) {
        (merged as any)[field] = update[field]
      }
    }


    // Calculate changed fields for version tracking
    const changedFields = calculateChangedFields(existing as any, merged as any)

    // Only save version if something actually changed
    if (changedFields.length > 0) {
      const currentVersion = (existing as any).currentVersion || 1
      const snapshot = createSnapshot(existing as any)

      // Save current state as a version before updating
      await prisma.brandGuidelineVersion.create({
        data: {
          guidelineId: existing.id,
          snapshot: snapshot as any,
          versionNumber: currentVersion,
          changeNote: changeNote || generateChangeNote(changedFields),
          changedFields,
          createdBy: req.userId,
        },
      })

      // Increment version number
      merged.currentVersion = currentVersion + 1
    }

    // Recalculate completeness
    const fullData = { ...existing, ...merged } as any
    const completeness = calculateCompleteness(fullData)
    const extraction = (merged.extraction || existing.extraction || { sources: [] }) as any
    extraction.completeness = completeness
    merged.extraction = extraction

    const { id: _id, userId: _userId, ...cleanUpdateData } = merged
    const guideline = await prisma.brandGuideline.update({
      where: { id: existing.id },
      data: cleanUpdateData as any,
    })


    res.json({ guideline: { ...guideline, _id: guideline.id } })
  } catch (error: any) {
    console.error('Error updating brand guideline:', error?.message || error)
    res.status(500).json({ error: 'Failed to update brand guideline', message: error?.message })
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

    const { source, url, data, filename, images: imagesPayload, dryRun } = req.body
    let chunks: any[] = []
    let imagesToExtract: string[] | undefined = imagesPayload

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
        if (!imagesToExtract) imagesToExtract = [data]
        break
      case 'images':
        if (!imagesPayload || !Array.isArray(imagesPayload)) return res.status(400).json({ error: 'Images array required' })
        chunks = parseImage(filename || 'images.zip')
        // imagesToExtract already set from imagesPayload
        break
      case 'json': {
        if (!data) return res.status(400).json({ error: 'JSON data required' })
        const jsonStr = typeof data === 'string'
          ? (data.startsWith('data:') ? Buffer.from(data.replace(/^data:[^;]+;base64,/, ''), 'base64').toString('utf-8') : data)
          : JSON.stringify(data)
        chunks = parseJson(jsonStr, filename)
        break
      }
      case 'fig_file': {
        if (!data) return res.status(400).json({ error: 'Fig file data required' })
        // .fig is a ZIP — extract images without any Figma token
        const JSZip = (await import('jszip')).default
        const zip = await JSZip.loadAsync(
          Buffer.from(data.replace(/^data:[^;]+;base64,/, ''), 'base64')
        )
        const figImages: string[] = []

        // 1. Thumbnail (best single preview of the whole file)
        const thumb = zip.file('thumbnail.png')
        if (thumb) {
          const b64 = await thumb.async('base64')
          figImages.push(`data:image/png;base64,${b64}`)
        }

        // 2. Embedded assets in /images/ (logos, icons, rasters)
        const assetEntries = Object.keys(zip.files).filter(n =>
          !zip.files[n].dir &&
          (n.startsWith('images/') || /\.(png|jpg|jpeg|svg)$/i.test(n))
        )
        for (const entry of assetEntries.slice(0, 12)) {
          const file = zip.file(entry)
          if (!file) continue
          const b64 = await file.async('base64')
          const ext = /\.jpe?g$/i.test(entry) ? 'jpeg' : 'png'
          figImages.push(`data:image/${ext};base64,${b64}`)
        }

        if (figImages.length === 0) {
          return res.status(422).json({ error: 'No images found inside .fig file — try exporting frames as PNG from Figma first' })
        }
        chunks = parseImage(filename || 'design.fig')
        imagesToExtract = figImages
        break
      }
      default:
        return res.status(400).json({ error: `Invalid source: ${source}` })
    }

    const extracted = await extractBrandData(chunks, imagesToExtract, req.userId)
    const merged = mergeBrandGuidelines(existing as any, extracted)

    // DRY RUN — return preview without saving anything
    if (dryRun) {
      return res.json({ dryRun: true, extracted, preview: merged })
    }

    // Classify and store uploaded images into logos/media
    if (imagesToExtract && imagesToExtract.length > 0 && extracted.assetClassifications?.length) {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { subscriptionTier: true, isAdmin: true },
      })
      const existingLogos: BrandGuidelineLogo[] = (merged.logos as BrandGuidelineLogo[]) || []
      const existingMedia: BrandGuidelineMedia[] = (merged.media as BrandGuidelineMedia[]) || []

      await Promise.allSettled(
        extracted.assetClassifications.map(async (cls) => {
          const imgData = imagesToExtract![cls.index]
          if (!imgData) return
          const assetId = crypto.randomUUID()
          const ct = imgData.match(/^data:([^;]+);/)?.[1] || 'image/png'
          const storedUrl = await uploadBrandMedia(
            imgData, req.userId!, existing.id, assetId, ct,
            user?.subscriptionTier || undefined, user?.isAdmin || undefined,
          )

          if (cls.category === 'logo' || cls.category === 'icon') {
            existingLogos.push({
              id: assetId,
              url: storedUrl,
              variant: cls.category === 'icon' ? 'icon' : (cls.logoVariant || 'custom'),
              label: cls.label,
              source: 'upload',
            } as BrandGuidelineLogo)
          } else {
            existingMedia.push({
              id: assetId,
              url: storedUrl,
              type: 'image',
              label: cls.label,
            } as BrandGuidelineMedia)
          }
        })
      )

      merged.logos = existingLogos
      merged.media = existingMedia
    }

    // Track source
    if (!merged.extraction) {
      merged.extraction = { sources: [], completeness: 0 }
    }
    const extraction = merged.extraction
    if (!Array.isArray(extraction.sources)) {
      extraction.sources = []
    }
    
    extraction.sources.push({ 
      type: (source as any), 
      ref: url || filename, 
      date: new Date().toISOString() 
    })
    extraction.completeness = calculateCompleteness(merged)


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
        strategy: (merged as any).strategy as any,
        gradients: (merged as any).gradients as any,
        shadows: (merged as any).shadows as any,
        motion: (merged as any).motion as any,
        borders: (merged as any).borders as any,
        extraction: merged.extraction as any,
      },
    })

    res.json({
      guideline: { ...guideline, _id: guideline.id },
      extracted, // what AI found — user can review
    })
  } catch (error: any) {
    console.error('[Brand Ingest] CRITICAL ERROR:', {
      message: error.message,
      stack: error.stack,
      guidelineId: req.params.id,
      userId: req.userId,
      source: req.body?.source
    })
    res.status(500).json({ 
      error: 'Ingestion failed', 
      message: error.message || 'Internal server error during brand ingestion',
      code: error.code || 'UNKNOWN_ERROR'
    })
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

    const {
      data, url, variant = 'primary', label,
      source, thumbnailData, thumbnailUrl: incomingThumbUrl, format,
      figmaKey, figmaNodeId, figmaFileKey,
    } = req.body
    const logoId = crypto.randomUUID()
    let logoUrl: string | undefined
    let thumbnailUrl: string | undefined = incomingThumbUrl

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { subscriptionTier: true, isAdmin: true },
    })

    // Primary media (uploaded file or explicit URL)
    if (data) {
      const ct = data.startsWith('data:image/svg') ? 'image/svg+xml'
        : data.startsWith('data:application/pdf') ? 'application/pdf'
        : data.startsWith('data:image/jpeg') ? 'image/jpeg'
        : 'image/png'
      logoUrl = await uploadBrandMedia(
        data, req.userId, guideline.id, `logo-${logoId}`, ct,
        user?.subscriptionTier || undefined, user?.isAdmin || undefined,
      )
    } else if (url) {
      logoUrl = url
    }

    // Thumbnail (always rasterized PNG) — required for Figma-linked logos and PDFs
    if (thumbnailData && !thumbnailUrl) {
      thumbnailUrl = await uploadBrandMedia(
        thumbnailData, req.userId, guideline.id, `logo-${logoId}-thumb`, 'image/png',
        user?.subscriptionTier || undefined, user?.isAdmin || undefined,
      )
    }

    if (!logoUrl && !thumbnailUrl && !figmaKey && !figmaNodeId) {
      return res.status(400).json({ error: 'Provide data, url, thumbnailData, or a figma reference' })
    }

    const validVariants = ['primary', 'dark', 'light', 'icon', 'accent', 'custom'] as const
    const safeVariant = validVariants.includes(variant) ? variant : 'custom'
    const safeSource = source === 'figma' ? 'figma' : 'upload'

    const newLogo: BrandGuidelineLogo = {
      id: logoId,
      url: logoUrl ?? thumbnailUrl ?? '',
      variant: safeVariant,
      label,
      ...(thumbnailUrl ? { thumbnailUrl } : {}),
      ...(format ? { format } : {}),
      source: safeSource,
      ...(figmaKey ? { figmaKey } : {}),
      ...(figmaNodeId ? { figmaNodeId } : {}),
      ...(figmaFileKey ? { figmaFileKey } : {}),
    } as BrandGuidelineLogo
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
router.get('/public/:slug', publicRateLimiter, async (req, res) => {
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
router.get('/public/:slug/context', publicRateLimiter, async (req, res) => {
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

// POST /api/brand-guidelines/:id/compliance-check — analyze content compliance
router.post('/:id/compliance-check', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const guideline = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId }
    })

    if (!guideline) {
      return res.status(404).json({ error: 'Brand guideline not found' })
    }

    const { colors, text, image, checkContrast, checkColors, checkTone } = req.body as ComplianceCheckInput

    // Validate input - at least one content type required
    if (!colors?.length && !text && !image) {
      return res.status(400).json({
        error: 'At least one content type required: colors, text, or image'
      })
    }

    // Get user's API key for AI analysis
    let userApiKey: string | undefined
    try {
      userApiKey = await getGeminiApiKey(req.userId)
    } catch {
      // Will use system key
    }

    // Run compliance check
    const result = await checkBrandCompliance(
      { colors, text, image, checkContrast, checkColors, checkTone },
      guideline as any,
      userApiKey
    )

    res.json(result)
  } catch (error: any) {
    console.error('Error checking brand compliance:', error)
    res.status(500).json({ error: 'Failed to check brand compliance' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Version History Endpoints
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/brand-guidelines/:id/versions — list version history
router.get('/:id/versions', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const guideline = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true, currentVersion: true },
    })

    if (!guideline) return res.status(404).json({ error: 'Not found' })

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
    const offset = parseInt(req.query.offset as string) || 0

    const versions = await prisma.brandGuidelineVersion.findMany({
      where: { guidelineId: guideline.id },
      orderBy: { versionNumber: 'desc' },
      take: limit,
      skip: offset,
      select: {
        versionNumber: true,
        changeNote: true,
        changedFields: true,
        createdAt: true,
        createdBy: true,
      },
    })

    const total = await prisma.brandGuidelineVersion.count({
      where: { guidelineId: guideline.id },
    })

    const currentVersion = (guideline as any).currentVersion || 1

    res.json({
      versions: versions.map((v) =>
        formatVersionListItem(v, v.versionNumber === currentVersion - 1)
      ),
      total,
      currentVersion,
    })
  } catch (error: any) {
    console.error('Error listing versions:', error)
    res.status(500).json({ error: 'Failed to list versions' })
  }
})

// GET /api/brand-guidelines/:id/versions/:versionNumber — get specific version
router.get('/:id/versions/:versionNumber', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const guideline = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true },
    })

    if (!guideline) return res.status(404).json({ error: 'Guideline not found' })

    const versionNumber = parseInt(req.params.versionNumber)
    if (isNaN(versionNumber)) {
      return res.status(400).json({ error: 'Invalid version number' })
    }

    const version = await prisma.brandGuidelineVersion.findFirst({
      where: { guidelineId: guideline.id, versionNumber },
    })

    if (!version) return res.status(404).json({ error: 'Version not found' })

    res.json({
      version: {
        versionNumber: version.versionNumber,
        snapshot: version.snapshot,
        changeNote: version.changeNote,
        changedFields: version.changedFields,
        createdAt: version.createdAt.toISOString(),
        createdBy: version.createdBy,
      },
    })
  } catch (error: any) {
    console.error('Error getting version:', error)
    res.status(500).json({ error: 'Failed to get version' })
  }
})

// GET /api/brand-guidelines/:id/versions/:v1/compare/:v2 — compare two versions
router.get('/:id/versions/:v1/compare/:v2', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const guideline = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true },
    })

    if (!guideline) return res.status(404).json({ error: 'Guideline not found' })

    const v1 = parseInt(req.params.v1)
    const v2 = parseInt(req.params.v2)

    if (isNaN(v1) || isNaN(v2)) {
      return res.status(400).json({ error: 'Invalid version numbers' })
    }

    const [version1, version2] = await Promise.all([
      prisma.brandGuidelineVersion.findFirst({
        where: { guidelineId: guideline.id, versionNumber: v1 },
      }),
      prisma.brandGuidelineVersion.findFirst({
        where: { guidelineId: guideline.id, versionNumber: v2 },
      }),
    ])

    if (!version1 || !version2) {
      return res.status(404).json({ error: 'One or both versions not found' })
    }

    const diff = generateDiff(
      version1.snapshot as Record<string, unknown>,
      version2.snapshot as Record<string, unknown>
    )

    res.json({
      from: { versionNumber: v1, createdAt: version1.createdAt.toISOString() },
      to: { versionNumber: v2, createdAt: version2.createdAt.toISOString() },
      diff,
    })
  } catch (error: any) {
    console.error('Error comparing versions:', error)
    res.status(500).json({ error: 'Failed to compare versions' })
  }
})

// POST /api/brand-guidelines/:id/versions/:versionNumber/restore — restore from version
router.post('/:id/versions/:versionNumber/restore', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const existing = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
    })

    if (!existing) return res.status(404).json({ error: 'Guideline not found' })

    const versionNumber = parseInt(req.params.versionNumber)
    if (isNaN(versionNumber)) {
      return res.status(400).json({ error: 'Invalid version number' })
    }

    const version = await prisma.brandGuidelineVersion.findFirst({
      where: { guidelineId: existing.id, versionNumber },
    })

    if (!version) return res.status(404).json({ error: 'Version not found' })

    const snapshot = version.snapshot as Record<string, unknown>
    const currentVersion = (existing as any).currentVersion || 1

    // Save current state as new version before restoring
    const currentSnapshot = createSnapshot(existing as any)
    await prisma.brandGuidelineVersion.create({
      data: {
        guidelineId: existing.id,
        snapshot: currentSnapshot as any,
        versionNumber: currentVersion,
        changeNote: `Before restore to v${versionNumber}`,
        changedFields: ['restore'],
        createdBy: req.userId,
      },
    })

    // Restore from version snapshot
    const restoreData: any = {
      currentVersion: currentVersion + 1,
    }

    // Copy snapshot fields
    const restoreFields = ['identity', 'logos', 'colors', 'typography', 'tags', 'media', 'tokens', 'guidelines', 'strategy', 'gradients', 'shadows', 'motion', 'borders', 'validation', 'folder', 'activeSections', 'orderedBlocks']
    for (const field of restoreFields) {
      if (snapshot[field] !== undefined) {
        restoreData[field] = snapshot[field]
      }
    }

    const guideline = await prisma.brandGuideline.update({
      where: { id: existing.id },
      data: restoreData,
    })

    res.json({
      guideline: { ...guideline, _id: guideline.id },
      restoredFrom: versionNumber,
      newVersion: currentVersion + 1,
      message: `Restored to version ${versionNumber}. Created as version ${currentVersion + 1}.`,
    })
  } catch (error: any) {
    console.error('Error restoring version:', error)
    res.status(500).json({ error: 'Failed to restore version' })
  }
})

// FIGMA INTEGRATION ENDPOINTS
// ═══════════════════════════════════════════════════

// PUT /api/brand-guidelines/:id/figma-link — link a Figma file
router.put('/:id/figma-link', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const { figmaFileUrl } = req.body
    if (!figmaFileUrl) return res.status(400).json({ error: 'figmaFileUrl required' })

    if (!isValidFigmaUrl(figmaFileUrl)) {
      return res.status(400).json({ error: 'Invalid Figma URL. Expected format: figma.com/file/KEY/...' })
    }

    const guideline = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
    })
    if (!guideline) return res.status(404).json({ error: 'Brand guideline not found' })

    const figmaFileKey = extractFigmaFileKey(figmaFileUrl)

    const updated = await prisma.brandGuideline.update({
      where: { id: guideline.id },
      data: { figmaFileUrl, figmaFileKey },
    })

    res.json({
      figmaFileUrl: updated.figmaFileUrl,
      figmaFileKey: updated.figmaFileKey,
      guideline: { ...updated, _id: updated.id },
    })
  } catch (error: any) {
    console.error('[Figma Link] Error:', error)
    res.status(500).json({ error: 'Failed to link Figma file', message: error.message })
  }
})

// DELETE /api/brand-guidelines/:id/figma-link — unlink Figma file
router.delete('/:id/figma-link', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const guideline = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
    })
    if (!guideline) return res.status(404).json({ error: 'Brand guideline not found' })

    const updated = await prisma.brandGuideline.update({
      where: { id: guideline.id },
      data: { figmaFileUrl: null, figmaFileKey: null, figmaSyncedAt: null },
    })

    res.json({
      success: true,
      guideline: { ...updated, _id: updated.id },
    })
  } catch (error: any) {
    console.error('[Figma Unlink] Error:', error)
    res.status(500).json({ error: 'Failed to unlink Figma file', message: error.message })
  }
})

// POST /api/brand-guidelines/:id/figma-sync — receive extracted data from plugin
router.post('/:id/figma-sync', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const guideline = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
    })
    if (!guideline) return res.status(404).json({ error: 'Brand guideline not found' })

    const { fileKey, variables, styles, components } = req.body

    // Verify file key matches
    if (guideline.figmaFileKey && fileKey !== guideline.figmaFileKey) {
      return res.status(400).json({
        error: 'File key mismatch. This file is not linked to this guideline.',
        expectedKey: guideline.figmaFileKey,
        receivedKey: fileKey,
      })
    }

    // Merge extracted data into guideline
    const existingColors = (guideline.colors as any[]) || []
    const existingTypography = (guideline.typography as any[]) || []
    const existingTokens = (guideline.tokens as any) || {}

    // Process Variables → colors, tokens
    const newColors: any[] = []
    const newSpacing: Record<string, number> = {}
    const newRadius: Record<string, number> = {}

    if (variables?.colors) {
      for (const v of variables.colors) {
        newColors.push({
          hex: v.value,
          name: v.name,
          role: 'variable',
          figmaId: v.id,
        })
      }
    }

    if (variables?.numbers) {
      for (const v of variables.numbers) {
        const nameLower = v.name.toLowerCase()
        if (nameLower.includes('spacing') || nameLower.includes('gap') || nameLower.includes('padding') || nameLower.includes('margin')) {
          newSpacing[v.name] = v.value
        } else if (nameLower.includes('radius') || nameLower.includes('corner') || nameLower.includes('round')) {
          newRadius[v.name] = v.value
        }
      }
    }

    // Process Styles → colors, typography
    if (styles?.colors) {
      for (const s of styles.colors) {
        newColors.push({
          hex: s.value,
          name: s.name,
          role: 'style',
          figmaId: s.id,
        })
      }
    }

    const newTypography: any[] = []
    if (styles?.text) {
      for (const s of styles.text) {
        newTypography.push({
          family: s.family,
          style: s.style,
          role: s.name,
          size: s.size,
          figmaId: s.id,
        })
      }
    }

    // Process shadows from effect styles
    const newShadows: Record<string, any> = {}
    if (styles?.effects) {
      for (const s of styles.effects) {
        if (s.shadows) {
          newShadows[s.name] = s.shadows
        }
      }
    }

    // Process components
    const newComponents: Record<string, any> = {}
    if (components) {
      for (const c of components) {
        newComponents[c.name] = {
          key: c.key,
          id: c.id,
          metadata: c.metadata,
        }
      }
    }

    // Merge: Figma data takes precedence, but keep manual entries
    const mergedColors = [
      ...existingColors.filter((c: any) => !c.figmaId), // Keep manual colors
      ...newColors,
    ]

    const mergedTypography = [
      ...existingTypography.filter((t: any) => !t.figmaId), // Keep manual typography
      ...newTypography,
    ]

    const mergedTokens = {
      ...existingTokens,
      spacing: { ...(existingTokens.spacing || {}), ...newSpacing },
      radius: { ...(existingTokens.radius || {}), ...newRadius },
      shadows: { ...(existingTokens.shadows || {}), ...newShadows },
      components: { ...(existingTokens.components || {}), ...newComponents },
    }

    const updated = await prisma.brandGuideline.update({
      where: { id: guideline.id },
      data: {
        colors: mergedColors as any,
        typography: mergedTypography as any,
        tokens: mergedTokens as any,
        figmaSyncedAt: new Date(),
        // Update fileKey if not set (first sync can auto-link)
        figmaFileKey: guideline.figmaFileKey || fileKey,
      },
    })

    res.json({
      guideline: { ...updated, _id: updated.id },
      syncedAt: updated.figmaSyncedAt,
      stats: {
        colors: newColors.length,
        typography: newTypography.length,
        spacing: Object.keys(newSpacing).length,
        radius: Object.keys(newRadius).length,
        shadows: Object.keys(newShadows).length,
        components: Object.keys(newComponents).length,
      },
    })
  } catch (error: any) {
    console.error('[Figma Sync] Error:', error)
    res.status(500).json({ error: 'Failed to sync from Figma', message: error.message })
  }
})

// ═══ FIGMA REST API ENDPOINTS (without plugin) ═══

import { getFigmaToken } from '../utils/figmaToken.js'
import { extractDesignTokens, getFileData, parseFigmaUrl } from '../services/figmaRestApi.js'

// GET /api/brand-guidelines/:id/figma-preview — preview what can be extracted from linked file
router.get('/:id/figma-preview', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const guideline = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
    })
    if (!guideline) return res.status(404).json({ error: 'Brand guideline not found' })
    if (!guideline.figmaFileKey) return res.status(400).json({ error: 'No Figma file linked' })

    const token = await getFigmaToken(req.userId)
    if (!token) {
      return res.status(400).json({
        error: 'Figma token not configured',
        message: 'Configure seu Figma Personal Access Token nas configurações para usar esta funcionalidade.',
        needsToken: true,
      })
    }

    const tokens = await extractDesignTokens(guideline.figmaFileKey, token)

    res.json({
      colors: tokens.colors,
      typography: tokens.typography,
      components: tokens.components,
      message: `Found ${tokens.colors.length} colors, ${tokens.typography.length} text styles, ${tokens.components.length} components`,
    })
  } catch (error: any) {
    console.error('[Figma Preview] Error:', error)
    res.status(500).json({ error: 'Failed to fetch Figma data', message: error.message })
  }
})

// POST /api/brand-guidelines/:id/figma-import — import selected data from Figma REST API
router.post('/:id/figma-import', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const guideline = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
    })
    if (!guideline) return res.status(404).json({ error: 'Brand guideline not found' })
    if (!guideline.figmaFileKey) return res.status(400).json({ error: 'No Figma file linked' })

    const token = await getFigmaToken(req.userId)
    if (!token) {
      return res.status(400).json({ error: 'Figma token not configured', needsToken: true })
    }

    const { importColors, importTypography, selectedLogos } = req.body

    const tokens = await extractDesignTokens(guideline.figmaFileKey, token)

    // Prepare update data
    const updateData: any = { figmaSyncedAt: new Date() }

    // Import colors if requested
    if (importColors) {
      const existingColors = (guideline.colors as any[] || []).filter((c: any) => !c.figmaId)
      const figmaColors = tokens.colors.map(c => ({ ...c, figmaId: c.hex }))
      updateData.colors = [...existingColors, ...figmaColors]
    }

    // Import typography if requested
    if (importTypography) {
      const existingTypo = (guideline.typography as any[] || []).filter((t: any) => !t.figmaId)
      const figmaTypo = tokens.typography.map(t => ({ ...t, figmaId: `${t.family}-${t.role}` }))
      updateData.typography = [...existingTypo, ...figmaTypo]
    }

    // Import selected components as logos
    if (selectedLogos && selectedLogos.length > 0) {
      const existingLogos = (guideline.logos as any[] || [])
      const newLogos = tokens.components
        .filter(c => selectedLogos.includes(c.key))
        .map(c => ({
          id: c.key,
          url: c.thumbnailUrl || '',
          variant: 'figma',
          label: c.name,
          figmaKey: c.key,
        }))
      updateData.logos = [...existingLogos, ...newLogos]
    }

    const updated = await prisma.brandGuideline.update({
      where: { id: guideline.id },
      data: updateData,
    })

    res.json({
      success: true,
      imported: {
        colors: importColors ? tokens.colors.length : 0,
        typography: importTypography ? tokens.typography.length : 0,
        logos: selectedLogos?.length || 0,
      },
      guideline: { ...updated, _id: updated.id },
    })
  } catch (error: any) {
    console.error('[Figma Import] Error:', error)
    res.status(500).json({ error: 'Failed to import from Figma', message: error.message })
  }
})

// POST /api/brand-guidelines/figma-preview-url — preview any Figma URL (for discovery before linking)
router.post('/figma-preview-url', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const { figmaUrl } = req.body
    if (!figmaUrl) return res.status(400).json({ error: 'figmaUrl required' })

    const parsed = parseFigmaUrl(figmaUrl)
    if (!parsed) return res.status(400).json({ error: 'Invalid Figma URL' })

    const token = await getFigmaToken(req.userId)
    if (!token) {
      return res.status(400).json({ error: 'Figma token not configured', needsToken: true })
    }

    const [fileData, tokens] = await Promise.all([
      getFileData(parsed.fileKey, token),
      extractDesignTokens(parsed.fileKey, token),
    ])

    res.json({
      fileKey: parsed.fileKey,
      fileName: fileData.name,
      lastModified: fileData.lastModified,
      colors: tokens.colors,
      typography: tokens.typography,
      components: tokens.components,
    })
  } catch (error: any) {
    console.error('[Figma Preview URL] Error:', error)
    res.status(500).json({ error: 'Failed to fetch Figma data', message: error.message })
  }
})

// ═══ KNOWLEDGE FILES (RAG universe for this brand) ═══
// Files are ingested by admin chat when a brandGuidelineId is linked.
// Stored as JSON array on the guideline; vectors live in Pinecone keyed by vectorIds.

interface KnowledgeFile {
  id: string;
  fileName: string;
  source: 'pdf' | 'image' | 'url' | 'text';
  vectorIds: string[];
  addedByUserId: string;
  addedAt: string;
}

router.get('/:id/knowledge', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const guideline = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true, knowledgeFiles: true },
    })
    if (!guideline) return res.status(404).json({ error: 'Not found' })

    const files = (guideline.knowledgeFiles as unknown as KnowledgeFile[] | null) || []
    res.json({ files })
  } catch (error: any) {
    console.error('Error listing knowledge files:', error)
    res.status(500).json({ error: 'Failed to list knowledge files' })
  }
})

router.delete('/:id/knowledge/:fileId', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const guideline = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true, knowledgeFiles: true },
    })
    if (!guideline) return res.status(404).json({ error: 'Not found' })

    const files = (guideline.knowledgeFiles as unknown as KnowledgeFile[] | null) || []
    const target = files.find(f => f.id === req.params.fileId)
    if (!target) return res.status(404).json({ error: 'Knowledge file not found' })

    // Best-effort delete from Pinecone (don't fail the whole op if one vector deletion errors)
    await Promise.allSettled(
      (target.vectorIds || []).map(vid => vectorService.delete(vid))
    )

    const remaining = files.filter(f => f.id !== req.params.fileId)
    await prisma.brandGuideline.update({
      where: { id: guideline.id },
      data: { knowledgeFiles: remaining as any },
    })

    res.json({ success: true, remaining: remaining.length })
  } catch (error: any) {
    console.error('Error deleting knowledge file:', error)
    res.status(500).json({ error: 'Failed to delete knowledge file' })
  }
})

// ═══════════════════════════════════════════════════
// COLLABORATIVE EDITING — LIVEBLOCKS AUTH
// ═══════════════════════════════════════════════════

/**
 * POST /api/brand-guidelines/:id/liveblocks-auth
 *
 * Issues a Liveblocks session token for collaborative editing of a brand guideline.
 * Only the owner and users in canEdit[] receive FULL_ACCESS.
 * Users in canView[] receive READ_ACCESS (used for real-time cursor presence during review).
 *
 * Room ID convention: `brand-${guidelineId}` — distinct from canvas rooms (`canvas-*`).
 */
router.post('/:id/liveblocks-auth', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const guideline = await prisma.brandGuideline.findUnique({
      where: { id },
      select: { userId: true, canEdit: true, canView: true },
    }) as { userId: string; canEdit?: unknown; canView?: unknown } | null

    if (!guideline) return res.status(404).json({ error: 'Brand guideline not found' })

    const isOwner = guideline.userId === req.userId
    const canEdit = isOwner || (Array.isArray(guideline.canEdit) && (guideline.canEdit as string[]).includes(req.userId!))
    const canView = isOwner || canEdit || (Array.isArray(guideline.canView) && (guideline.canView as string[]).includes(req.userId!))

    if (!canView) return res.status(403).json({ error: 'Access denied' })

    const LIVEBLOCKS_SECRET_KEY = process.env.LIVEBLOCKS_SECRET_KEY
    if (!LIVEBLOCKS_SECRET_KEY) {
      return res.status(500).json({ error: 'Liveblocks is not configured' })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { email: true, name: true, picture: true },
    })

    const liveblocks = new Liveblocks({ secret: LIVEBLOCKS_SECRET_KEY })
    const session = liveblocks.prepareSession(req.userId, {
      userInfo: {
        name: user?.name || user?.email || 'Anonymous',
        email: user?.email ?? undefined,
        picture: user?.picture ?? undefined,
      },
    })

    const roomId = `brand-${id}`
    session.allow(roomId, canEdit ? session.FULL_ACCESS : session.READ_ACCESS)

    const { body, status } = await session.authorize()
    res.status(status).end(body)
  } catch (error: any) {
    console.error('[BrandGuideline Liveblocks Auth] Error:', error)
    res.status(500).json({ error: 'Failed to authenticate with Liveblocks' })
  }
})

// GET /api/brand-guidelines/:id/collaborators — list current collaborators
router.get('/:id/collaborators', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const guideline = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { canEdit: true, canView: true },
    }) as { canEdit: unknown; canView: unknown } | null

    if (!guideline) return res.status(404).json({ error: 'Brand guideline not found' })

    const editorIds = Array.isArray(guideline.canEdit) ? (guideline.canEdit as string[]) : []
    const viewerIds = Array.isArray(guideline.canView) ? (guideline.canView as string[]) : []
    const allIds = [...new Set([...editorIds, ...viewerIds])]

    const users = allIds.length
      ? await prisma.user.findMany({
          where: { id: { in: allIds } },
          select: { id: true, email: true, name: true, picture: true },
        })
      : []

    const collaborators = users.map(u => ({
      ...u,
      role: editorIds.includes(u.id) ? 'editor' : 'viewer',
    }))

    res.json({ collaborators })
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch collaborators', message: error.message })
  }
})

// POST /api/brand-guidelines/:id/collaborators — add collaborator by email
router.post('/:id/collaborators', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const { email, role } = req.body as { email?: string; role?: string }
    if (!email) return res.status(400).json({ error: 'email is required' })
    if (role !== 'editor' && role !== 'viewer') return res.status(400).json({ error: 'role must be editor or viewer' })

    const guideline = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true, canEdit: true, canView: true },
    }) as { id: string; canEdit: unknown; canView: unknown } | null

    if (!guideline) return res.status(404).json({ error: 'Brand guideline not found' })

    const invitee = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, email: true, name: true, picture: true },
    })
    if (!invitee) return res.status(404).json({ error: 'No user found with that email' })
    if (invitee.id === req.userId) return res.status(400).json({ error: 'Cannot invite yourself' })

    let canEdit = Array.isArray(guideline.canEdit) ? [...(guideline.canEdit as string[])] : []
    let canView = Array.isArray(guideline.canView) ? [...(guideline.canView as string[])] : []

    // Remove from both arrays first (role change support)
    canEdit = canEdit.filter(id => id !== invitee.id)
    canView = canView.filter(id => id !== invitee.id)

    if (role === 'editor') {
      canEdit.push(invitee.id)
    } else {
      canView.push(invitee.id)
    }

    await prisma.brandGuideline.update({
      where: { id: guideline.id },
      data: { canEdit, canView },
    })

    res.json({ collaborator: { ...invitee, role } })
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to add collaborator', message: error.message })
  }
})

// DELETE /api/brand-guidelines/:id/collaborators/:userId — remove collaborator
router.delete('/:id/collaborators/:userId', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    const guideline = await prisma.brandGuideline.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true, canEdit: true, canView: true },
    }) as { id: string; canEdit: unknown; canView: unknown } | null

    if (!guideline) return res.status(404).json({ error: 'Brand guideline not found' })

    const canEdit = Array.isArray(guideline.canEdit)
      ? (guideline.canEdit as string[]).filter(id => id !== req.params.userId)
      : []
    const canView = Array.isArray(guideline.canView)
      ? (guideline.canView as string[]).filter(id => id !== req.params.userId)
      : []

    await prisma.brandGuideline.update({
      where: { id: guideline.id },
      data: { canEdit, canView },
    })

    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to remove collaborator', message: error.message })
  }
})

// POST /api/brand-guidelines/:id/apply-fig-tokens — apply pre-extracted .fig tokens + upload images
// Called after user approves the dry-run preview from extract-fig.
router.post('/:id/apply-fig-tokens', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' })

    console.log('[apply-fig-tokens] userId:', req.userId, 'id:', req.params.id, 'keys:', Object.keys(req.body || {}))

    const existing = await prisma.brandGuideline.findFirst({ where: { id: req.params.id, userId: req.userId } })
    if (!existing) return res.status(404).json({ error: 'Brand guideline not found' })

    const { colors, typography, gradients, shadows, borders, tokens, images, replace } = req.body

    console.log('[apply-fig-tokens] data sizes:', {
      colors: colors?.length, typography: typography?.length,
      gradients: gradients?.length, shadows: shadows?.length,
      borders: borders?.length, images: images?.length, replace,
    })

    let merged: any
    if (replace) {
      // Replace mode: overwrite fields directly, keep unrelated fields intact
      merged = {
        ...existing,
        ...(colors?.length && { colors }),
        ...(typography?.length && { typography }),
        ...(gradients?.length && { gradients }),
        ...(shadows?.length && { shadows }),
        ...(borders?.length && { borders }),
        ...(tokens && { tokens }),
      }
    } else {
      // Merge mode: use source-of-truth merge (dedup, append-only)
      const incoming: Partial<BrandGuideline> = {}
      if (colors?.length) incoming.colors = colors
      if (typography?.length) incoming.typography = typography
      if (gradients?.length) (incoming as any).gradients = gradients
      if (shadows?.length) (incoming as any).shadows = shadows
      if (borders?.length) (incoming as any).borders = borders
      if (tokens) incoming.tokens = tokens
      merged = mergeBrandGuidelines(existing as any, incoming)
    }

    // Upload and classify extracted images via existing AI pipeline
    if (images?.length) {
      const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { subscriptionTier: true, isAdmin: true } })
      const existingLogos = ((merged as any).logos || [])
      const existingMedia = ((merged as any).media || [])

      const { extractBrandData } = await import('../lib/brand-extract.js')
      const extracted = await extractBrandData([], images, req.userId)

      if (extracted.assetClassifications?.length) {
        await Promise.allSettled(
          extracted.assetClassifications.map(async (cls: any) => {
            const imgData = images[cls.index]
            if (!imgData) return
            const assetId = crypto.randomUUID()
            const ct = imgData.match(/^data:([^;]+);/)?.[1] || 'image/png'
            const storedUrl = await uploadBrandMedia(imgData, req.userId!, existing.id, assetId, ct, user?.subscriptionTier || undefined, user?.isAdmin || undefined)
            if (cls.category === 'logo' || cls.category === 'icon') {
              existingLogos.push({ id: assetId, url: storedUrl, variant: cls.category === 'icon' ? 'icon' : (cls.logoVariant || 'custom'), label: cls.label, source: 'upload' })
            } else {
              existingMedia.push({ id: assetId, url: storedUrl, type: 'image', label: cls.label })
            }
          })
        )
        ;(merged as any).logos = existingLogos
        ;(merged as any).media = existingMedia
      }
    }

    // Track source
    const extraction = (merged.extraction as any) || { sources: [], completeness: 0 }
    if (!Array.isArray(extraction.sources)) extraction.sources = []
    extraction.sources.push({ type: 'fig_file', date: new Date().toISOString() })

    const guideline = await prisma.brandGuideline.update({
      where: { id: existing.id },
      data: {
        identity: merged.identity as any,
        logos: (merged as any).logos as any,
        colors: merged.colors as any,
        typography: merged.typography as any,
        tags: merged.tags as any,
        media: (merged as any).media as any,
        tokens: merged.tokens as any,
        guidelines: merged.guidelines as any,
        strategy: (merged as any).strategy as any,
        gradients: (merged as any).gradients as any,
        shadows: (merged as any).shadows as any,
        motion: (merged as any).motion as any,
        borders: (merged as any).borders as any,
        extraction: extraction as any,
      },
    })

    res.json({ guideline: { ...guideline, _id: guideline.id } })
  } catch (err: any) {
    console.error('[apply-fig-tokens]', err)
    res.status(500).json({ error: err.message || 'Failed to apply .fig tokens' })
  }
})

// POST /api/brand-guidelines/:id/extract-fig — multipart upload, streams NDJSON events
// Each line is a JSON event: {type, data} — client reads progressively
router.post('/:id/extract-fig', apiRateLimiter, authenticate, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.brandGuideline.findFirst({ where: { id: req.params.id, userId: req.userId } })
    if (!existing) return res.status(404).json({ error: 'Brand guideline not found' })
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    // Stream NDJSON — each line is a JSON event {type, data}
    // Must handle errors AFTER flushHeaders by writing error event (not res.status)
    res.setHeader('Content-Type', 'application/x-ndjson')
    res.setHeader('Transfer-Encoding', 'chunked')
    res.setHeader('Cache-Control', 'no-cache')
    res.flushHeaders()

    const writeEvent = (event: object) => {
      try { if (!res.writableEnded) res.write(JSON.stringify(event) + '\n') } catch { /* ignore */ }
    }

    try {
      const { extractFigTokensStreaming } = await import('../lib/fig-extract.js')
      await extractFigTokensStreaming(req.file.buffer, writeEvent)
    } catch (err: any) {
      console.error('[extract-fig]', err)
      writeEvent({ type: 'error', message: err?.message || 'Extraction failed' })
    } finally {
      if (!res.writableEnded) res.end()
    }
  } catch (err: any) {
    // Only reached if error occurs BEFORE flushHeaders (e.g. DB lookup failed)
    console.error('[extract-fig pre-stream]', err)
    if (!res.headersSent) res.status(500).json({ error: err.message || 'Failed to parse .fig file' })
  }
})

export default router

import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { extractPdfStreaming } from '../lib/pdf-extract.js'

const router = Router()

const rateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * POST /api/pdf-extract
 *
 * Orphan endpoint — no brand guideline required.
 * Runs the full 2-phase extraction pipeline (algorithmic + LLM semantic)
 * and returns an aggregated JSON result.
 *
 * Body: { pdfBase64: string, filename?: string }
 * Query: ?includeImages=true  — include base64 PNG images in response
 *
 * Returns: { colors, typography, strategy, assetClassifications, pageCount, isMostlyOutlined, images? }
 */
router.post('/', rateLimiter, authenticate, async (req: AuthRequest, res) => {
  const { pdfBase64, filename } = req.body as { pdfBase64?: string; filename?: string }

  if (!pdfBase64) {
    return res.status(400).json({ error: 'pdfBase64 is required' })
  }

  const includeImages = req.query.includeImages === 'true'

  let buffer: Buffer
  try {
    const raw = pdfBase64.replace(/^data:application\/pdf;base64,/, '')
    buffer = Buffer.from(raw, 'base64')
  } catch {
    return res.status(400).json({ error: 'Invalid base64 PDF data' })
  }

  // Collect all streaming events into a single aggregated result
  const result: Record<string, any> = {}
  const events: any[] = []

  const writeEvent = (event: any) => {
    events.push(event)
    switch (event.type) {
      case 'colors':
        result.colors = event.data
        break
      case 'typography':
        result.typography = event.data
        break
      case 'text':
        result.markdownText = event.data
        break
      case 'images':
        if (includeImages) result.images = event.data
        result.imageCount = (event.data as any[]).length
        break
      case 'strategy':
        result.strategy = event.data
        break
      case 'asset_classifications':
        result.assetClassifications = event.data
        break
      case 'error':
        result._error = event.message
        break
    }
  }

  try {
    await extractPdfStreaming(buffer, writeEvent, req.userId)
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'PDF extraction failed' })
  }

  res.json({
    filename: filename ?? 'unknown.pdf',
    ...result,
  })
})

export default router

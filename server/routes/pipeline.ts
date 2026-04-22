import { Router } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { assetPipeline } from '../lib/assetPipeline.js';
import type { AssetSource } from '../lib/assetPipeline.js';

const VALID_SOURCES = new Set<AssetSource>(['canvas', 'mockupmachine', 'extractor', 'creative']);

const router = Router();

router.use(authenticate);

// Send an asset to the pipeline
router.post('/send', async (req: AuthRequest, res) => {
  const { source, imageUrl, imageBase64, mimeType, label } = req.body;
  if (!source || !VALID_SOURCES.has(source)) {
    return res.status(400).json({ error: 'valid source required (canvas|mockupmachine|extractor|creative)' });
  }
  if (!imageUrl && !imageBase64) {
    return res.status(400).json({ error: 'imageUrl or imageBase64 required' });
  }
  const asset = await assetPipeline.enqueue(req.userId!, { source, imageUrl, imageBase64, mimeType, label });
  res.json({ asset });
});

// List all pending assets for the authenticated user
router.get('/pending', async (req: AuthRequest, res) => {
  const assets = await assetPipeline.list(req.userId!);
  res.json({ assets });
});

// Remove a specific asset from the queue
router.delete('/:id', async (req: AuthRequest, res) => {
  await assetPipeline.remove(req.userId!, req.params.id);
  res.json({ ok: true });
});

// Clear all assets
router.delete('/', async (req: AuthRequest, res) => {
  await assetPipeline.clear(req.userId!);
  res.json({ ok: true });
});

export default router;

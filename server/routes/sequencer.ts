import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { stripDataUriPrefix } from '../lib/dataUri.js';
import { uploadSequenceVideo, isR2Configured } from '../services/r2Service.js';
import {
  buildSlideshow,
  probeFFmpeg,
  validateSlideFormat,
  validateSlideOrder,
  validatePerPhotoSec,
  validateSlideDimensions,
  validatePhotos,
  validateLoops,
  type SlideImage,
  type SlideFormat,
  type SlideOrder,
} from '../services/slideshowService.js';

const router = express.Router();

const sequencerLimiter = rateLimit({
  windowMs: 60_000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 10,
  message: { error: 'Too many sequencer requests. Please try again later.' },
});

const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/bmp': '.bmp',
  'image/tiff': '.tiff',
  'image/avif': '.avif',
};

/** `data:image/png;base64,…` → `.png`. Bare base64 (no prefix) falls back to `.png`. */
function extFromDataUri(input: string): string {
  const mime = input.match(/^data:([^;]+);base64,/i)?.[1]?.toLowerCase();
  return (mime && MIME_EXT[mime]) || '.png';
}

/**
 * Photos → slideshow video. One file per photo goes up; ffmpeg owns the timing.
 *
 * Auth-gated but credit-free by design: this is deterministic ffmpeg concat, not an
 * AI generation, so it carries `authenticate` + a rate limit like `/render` rather
 * than the `checkSubscription` + credits funnel that `/video` uses.
 */
router.post('/', sequencerLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    const photos = req.body.photos;
    if (!Array.isArray(photos) || photos.some((p) => typeof p !== 'string')) {
      return res.status(400).json({ error: 'photos must be an array of base64 strings' });
    }

    const perPhotoSec = Number(req.body.perPhotoSec ?? 0.5);
    const order = String(req.body.order ?? 'sequence');
    const format = String(req.body.format ?? 'mp4');
    const loops = Number(req.body.loops ?? 1);
    const width = req.body.width === undefined ? undefined : Number(req.body.width);
    const height = req.body.height === undefined ? undefined : Number(req.body.height);

    if (!validateSlideFormat(format)) {
      return res.status(400).json({ error: 'Format must be mp4, webm, or gif' });
    }
    if (!validateSlideOrder(order)) {
      return res.status(400).json({ error: 'Order must be sequence or random' });
    }
    const secErr = validatePerPhotoSec(perPhotoSec);
    if (secErr) return res.status(400).json({ error: secErr });

    const loopsErr = validateLoops(loops);
    if (loopsErr) return res.status(400).json({ error: loopsErr });

    const dimErr = validateSlideDimensions(width, height);
    if (dimErr) return res.status(400).json({ error: dimErr });

    const images: SlideImage[] = photos.map((photo: string, i: number) => ({
      filename: `i${i}${extFromDataUri(photo)}`,
      bytes: Buffer.from(stripDataUriPrefix(photo), 'base64'),
    }));

    if (images.some((img) => img.bytes.length === 0)) {
      return res.status(400).json({ error: 'One or more photos are empty or not valid base64' });
    }

    const photosErr = validatePhotos(images, perPhotoSec, loops);
    if (photosErr) return res.status(400).json({ error: photosErr });

    // Checked after validation so a bad request still gets its 400 on a server
    // without storage, and before ffmpeg so we never burn a render we can't deliver.
    if (!isR2Configured()) {
      return res.status(503).json({ error: 'Storage is not configured on this server' });
    }

    const result = await buildSlideshow(images, {
      perPhotoSec,
      order: order as SlideOrder,
      format: format as SlideFormat,
      width,
      height,
      loops,
    });

    const videoUrl = await uploadSequenceVideo(
      result.bytes,
      req.userId!,
      result.ext,
      undefined,
      req.isAdmin
    );

    res.json({
      videoUrl,
      durationSec: result.durationSec,
      frameCount: result.frameCount,
      format: result.ext,
      sizeBytes: result.bytes.length,
    });
  } catch (err: any) {
    console.error('[sequencer]', err);
    const msg = err?.message || '';
    // Storage-limit rejections and ffmpeg's own complaints are the caller's problem, not a 500.
    if (msg.includes('Storage limit') || msg.includes('limit exceeded')) {
      return res.status(413).json({ error: msg });
    }
    res.status(500).json({ error: 'Failed to build the sequence' });
  }
});

router.get('/health', async (_req, res) => {
  const ok = await probeFFmpeg();
  res.json({ ffmpeg: ok, storage: isR2Configured() });
});

export default router;

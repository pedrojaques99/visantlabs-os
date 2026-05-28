import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { rateLimit } from 'express-rate-limit';
import {
  createRenderJob,
  saveFrames,
  encodeToMp4,
  encodeToGif,
  encodeToWebm,
  cleanupJob,
  probeFFmpeg,
  validateDimensions,
  validateFormat,
  validateFps,
  parseFrameBuffer,
} from '../services/renderService.js';

const router = express.Router();

const renderLimiter = rateLimit({
  windowMs: 60_000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 10,
  message: { error: 'Too many render requests. Please try again later.' },
});

interface ActiveJob {
  workDir: string;
  frameCount: number;
  width: number;
  height: number;
  userId: string;
  createdAt: number;
}

const activeJobs = new Map<string, ActiveJob>();

setInterval(() => {
  const now = Date.now();
  for (const [jobId, job] of activeJobs) {
    if (now - job.createdAt > 10 * 60_000) {
      cleanupJob(job.workDir);
      activeJobs.delete(jobId);
    }
  }
}, 10 * 60_000);

router.post('/start', renderLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    const width = Number(req.body.width);
    const height = Number(req.body.height);

    const dimErr = validateDimensions(width, height);
    if (dimErr) return res.status(400).json({ error: dimErr });

    const job = await createRenderJob();
    activeJobs.set(job.jobId, {
      workDir: job.workDir,
      frameCount: 0,
      width,
      height,
      userId: req.userId!,
      createdAt: Date.now(),
    });

    res.json({ jobId: job.jobId });
  } catch (err: any) {
    console.error('[render/start]', err);
    res.status(500).json({ error: 'Failed to create render job' });
  }
});

router.put(
  '/:jobId/frames',
  authenticate,
  renderLimiter,
  express.raw({ type: 'application/octet-stream', limit: '100mb' }),
  async (req: AuthRequest, res) => {
    try {
      const { jobId } = req.params;
      const job = activeJobs.get(jobId);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      if (job.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });

      const startIndex = parseInt(req.headers['x-frame-start'] as string || '0', 10);
      if (!Number.isFinite(startIndex) || startIndex < 0) {
        return res.status(400).json({ error: 'Invalid X-Frame-Start' });
      }

      const frames = parseFrameBuffer(req.body as Buffer);
      if (frames.length === 0) return res.status(400).json({ error: 'No valid frames in body' });

      await saveFrames(job.workDir, frames, startIndex);
      job.frameCount = Math.max(job.frameCount, startIndex + frames.length);

      res.json({ received: frames.length, totalFrames: job.frameCount });
    } catch (err: any) {
      console.error('[render/frames]', err);
      const msg = err.message?.includes('limit') || err.message?.includes('Max')
        ? err.message
        : 'Failed to save frames';
      res.status(400).json({ error: msg });
    }
  },
);

router.post('/:jobId/finish', authenticate, renderLimiter, async (req: AuthRequest, res) => {
  const { jobId } = req.params;
  const job = activeJobs.get(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });

  try {
    const format = String(req.body.format || 'mp4');
    const fps = Number(req.body.fps || 30);

    if (!validateFormat(format)) return res.status(400).json({ error: 'Format must be mp4, gif, or webm' });
    const fpsErr = validateFps(fps);
    if (fpsErr) return res.status(400).json({ error: fpsErr });
    if (job.frameCount === 0) return res.status(400).json({ error: 'No frames uploaded' });

    let buffer: Buffer;
    let contentType: string;

    switch (format) {
      case 'gif':
        buffer = await encodeToGif(job.workDir, fps, job.width, job.height);
        contentType = 'image/gif';
        break;
      case 'webm':
        buffer = await encodeToWebm(job.workDir, fps, job.width, job.height);
        contentType = 'video/webm';
        break;
      default:
        buffer = await encodeToMp4(job.workDir, fps, job.width, job.height);
        contentType = 'video/mp4';
        break;
    }

    res.set('Content-Type', contentType);
    res.set('Content-Disposition', `attachment; filename="render_${jobId}.${format}"`);
    res.send(buffer);
  } catch (err: any) {
    console.error('[render/finish]', err);
    res.status(500).json({ error: `Encoding failed: ${err.message}` });
  } finally {
    cleanupJob(job.workDir);
    activeJobs.delete(jobId);
  }
});

router.get('/health', async (_req, res) => {
  const ok = await probeFFmpeg();
  res.json({ ffmpeg: ok });
});

export default router;

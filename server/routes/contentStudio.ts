import express from 'express';
import { nanoid } from 'nanoid';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import { redisClient } from '../lib/redis.js';
import { buildBrandContextJSON, BRAND_SECTION_PRESETS } from '../lib/brandContextBuilder.js';
import { planFromBrand, type CreativeFormat } from '../lib/creative-plan-engine.js';
import { uploadCanvasImage } from '../services/r2Service.js';
import { sanitizeForPrompt } from '../utils/promptSanitize.js';
import { chargeCredits } from '../lib/credits.js';
import { getCreditsRequired } from '../utils/usageTracking.js';
import { generateMockup as generateGeminiImage } from '../services/geminiService.js';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';
import { withResilience } from '../lib/ai-resilience.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();

const JOB_TTL_SECONDS = 60 * 60 * 2;
const MAX_CONCURRENCY = 4;

// ─── Types ───────────────────────────────────────────────────────────────────

interface ContentAsset {
  formatId: string;
  platform: string;
  label: string;
  ratio: string;
  width: number;
  height: number;
  imageUrl?: string;
  caption?: string;
  hashtags?: string[];
  status: 'pending' | 'generating' | 'done' | 'error';
  error?: string;
}

interface ContentJob {
  jobId: string;
  status: 'planning' | 'generating-copy' | 'generating-images' | 'done' | 'error';
  brief: string;
  createdAt: number;
  totalCount: number;
  completedCount: number;
  assets: ContentAsset[];
  error?: string;
}

// ─── Redis helpers ───────────────────────────────────────────────────────────

async function saveJob(job: ContentJob): Promise<void> {
  await redisClient.setex(`content-studio:${job.jobId}`, JOB_TTL_SECONDS, JSON.stringify(job));
}

async function loadJob(jobId: string): Promise<ContentJob | null> {
  const raw = await redisClient.get(`content-studio:${jobId}`);
  return raw ? (JSON.parse(raw) as ContentJob) : null;
}

// ─── Copy generation via Gemini ──────────────────────────────────────────────

let _copyModel: ReturnType<InstanceType<typeof GoogleGenerativeAI>['getGenerativeModel']> | null =
  null;
function getCopyModel() {
  if (_copyModel) return _copyModel;
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  _copyModel = new GoogleGenerativeAI(key).getGenerativeModel({
    model: GEMINI_MODELS.TEXT,
    generationConfig: { responseMimeType: 'application/json' },
  });
  return _copyModel;
}

interface CopyResult {
  formatId: string;
  caption: string;
  hashtags: string[];
}

async function generateCopy(params: {
  brief: string;
  formats: Array<{ id: string; platform: string; label: string; copyMaxChars: number }>;
  brandContext: string;
  tone?: string;
}): Promise<CopyResult[]> {
  const { brief, formats, brandContext, tone } = params;

  const formatList = formats
    .map((f) => `- ${f.id} (${f.platform}, ${f.label}): max ${f.copyMaxChars} chars`)
    .join('\n');

  const systemPrompt = `You are a senior social media copywriter. Generate platform-optimized captions for each format.

Rules:
- Each caption MUST respect the character limit for its platform
- Adapt tone and length per platform (Twitter=punchy/short, LinkedIn=professional/detailed, Instagram=engaging+emoji, TikTok=casual/trendy)
- Include relevant hashtags (3-5 for Instagram, 2-3 for LinkedIn, 1-2 for Twitter, 3-5 for TikTok)
- Stay on-brand: ${brandContext || 'professional and modern'}
${tone ? `- Tone: ${tone}` : ''}

Return JSON: { "copies": [{ "formatId": "...", "caption": "...", "hashtags": ["..."] }] }
No markdown fences.`;

  const userMsg = `Brief: ${sanitizeForPrompt(brief, 2000)}\n\nGenerate copy for:\n${formatList}`;

  const result = await withResilience('gemini', () =>
    getCopyModel().generateContent([{ text: systemPrompt }, { text: userMsg }])
  );

  const raw = result.response.text();
  try {
    const parsed = JSON.parse(raw) as { copies?: CopyResult[] };
    return parsed.copies ?? [];
  } catch {
    console.error('[content-studio] Failed to parse copy response:', raw);
    return [];
  }
}

// ─── Image generation per format ─────────────────────────────────────────────

async function generateFormatImage(params: {
  brief: string;
  format: { ratio: string; width: number; height: number; platform: string };
  brandGuideline: any | null;
  userId: string;
  model: string;
}): Promise<string> {
  const { brief, format, brandGuideline, userId, model } = params;

  const creativeRatio = mapRatio(format.ratio);

  if (brandGuideline) {
    const { plan, pickedMedia } = await planFromBrand({
      prompt: brief,
      format: creativeRatio,
      brandGuideline,
    });

    if (pickedMedia?.url) {
      return pickedMedia.url;
    }

    const bgPrompt = plan.background?.prompt ?? brief;
    const base64 = await generateGeminiImage(
      bgPrompt,
      undefined,
      model as any,
      undefined,
      creativeRatio,
      undefined,
      undefined,
      undefined
    );

    return uploadCanvasImage(base64, userId, `content-${nanoid(8)}`);
  }

  const base64 = await generateGeminiImage(
    `${brief}. Professional ${format.platform} ${format.ratio} format.`,
    undefined,
    model as any,
    undefined,
    creativeRatio,
    undefined,
    undefined,
    undefined
  );

  return uploadCanvasImage(base64, userId, `content-${nanoid(8)}`);
}

function mapRatio(ratio: string): CreativeFormat {
  switch (ratio) {
    case '1:1':
      return '1:1';
    case '9:16':
      return '9:16';
    case '16:9':
      return '16:9';
    case '4:5':
      return '4:5';
    case '1.91:1':
      return '16:9';
    case '2:3':
      return '9:16';
    default:
      return '1:1';
  }
}

// ─── Async content generation worker ─────────────────────────────────────────

async function runContentGeneration(params: {
  job: ContentJob;
  brandGuidelineId?: string;
  formats: Array<{
    id: string;
    platform: string;
    label: string;
    ratio: string;
    width: number;
    height: number;
    copyMaxChars: number;
  }>;
  brief: string;
  model: string;
  userId: string;
  tone?: string;
}): Promise<void> {
  const { job, brandGuidelineId, formats, brief, model, userId, tone } = params;

  try {
    let brandGuideline: any = null;
    let brandContextStr = '';

    if (brandGuidelineId) {
      brandGuideline = await prisma.brandGuideline.findFirst({
        where: { id: brandGuidelineId, userId },
      });
      if (brandGuideline) {
        const ctx = buildBrandContextJSON(brandGuideline as any, BRAND_SECTION_PRESETS.imageGen);
        brandContextStr = `Brand: ${ctx.brand.name}. ${ctx.voice?.tone || ''}`;
      }
    }

    // Step 1: Generate copy for all formats
    job.status = 'generating-copy';
    await saveJob(job);

    const copies = await generateCopy({
      brief,
      formats,
      brandContext: brandContextStr,
      tone,
    });

    const copyMap = new Map(copies.map((c) => [c.formatId, c]));
    for (const asset of job.assets) {
      const copy = copyMap.get(asset.formatId);
      if (copy) {
        asset.caption = copy.caption;
        asset.hashtags = copy.hashtags;
      }
    }
    await saveJob(job);

    // Step 2: Generate images with bounded concurrency
    job.status = 'generating-images';
    await saveJob(job);

    const queue = formats.map((_, i) => i);

    const worker = async () => {
      while (queue.length > 0) {
        const i = queue.shift();
        if (i === undefined) break;

        job.assets[i] = { ...job.assets[i], status: 'generating' };
        await saveJob(job);

        try {
          const imageUrl = await generateFormatImage({
            brief,
            format: formats[i],
            brandGuideline,
            userId,
            model,
          });
          job.assets[i] = { ...job.assets[i], status: 'done', imageUrl };
        } catch (err: any) {
          job.assets[i] = { ...job.assets[i], status: 'error', error: err.message };
        }

        job.completedCount++;
        await saveJob(job);
      }
    };

    await Promise.allSettled(
      Array.from({ length: Math.min(MAX_CONCURRENCY, formats.length) }, worker)
    );

    job.status = 'done';
    await saveJob(job);
  } catch (err: any) {
    job.status = 'error';
    job.error = err.message;
    await saveJob(job);
  }
}

// ─── POST /api/content-studio ────────────────────────────────────────────────

router.post('/', authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  const {
    brandGuidelineId,
    brief,
    formats,
    model = GEMINI_MODELS.IMAGE_NB2,
    tone,
  } = req.body as {
    brandGuidelineId?: string;
    brief?: string;
    formats?: Array<{
      id: string;
      platform: string;
      label: string;
      ratio: string;
      width: number;
      height: number;
      copyMaxChars: number;
    }>;
    model?: string;
    tone?: string;
  };

  if (!brief?.trim()) {
    return res.status(400).json({ error: 'brief is required' });
  }
  if (!formats?.length) {
    return res.status(400).json({ error: 'At least one format is required' });
  }
  if (formats.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 formats per generation' });
  }

  const perImageCredits = getCreditsRequired(model, '1K');
  const totalCredits = 1 + perImageCredits * formats.length;
  await chargeCredits(req.userId!, totalCredits);

  const job: ContentJob = {
    jobId: nanoid(),
    status: 'planning',
    brief,
    createdAt: Date.now(),
    totalCount: formats.length,
    completedCount: 0,
    assets: formats.map((f) => ({
      formatId: f.id,
      platform: f.platform,
      label: f.label,
      ratio: f.ratio,
      width: f.width,
      height: f.height,
      status: 'pending' as const,
    })),
  };

  await saveJob(job);
  res.status(202).json({
    jobId: job.jobId,
    totalCount: formats.length,
    creditsCharged: totalCredits,
  });

  runContentGeneration({
    job,
    brandGuidelineId,
    formats,
    brief,
    model,
    userId: req.userId,
    tone,
  }).catch((err) => {
    console.error('[content-studio] Unhandled error:', err);
  });
});

// ─── GET /api/content-studio/:jobId ──────────────────────────────────────────

router.get('/:jobId', authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  const job = await loadJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found or expired (TTL: 2h)' });

  res.json(job);
});

export default router;

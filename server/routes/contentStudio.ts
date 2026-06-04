import express from 'express';
import { nanoid } from 'nanoid';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import { redisClient } from '../lib/redis.js';
import { buildBrandContextJSON, BRAND_SECTION_PRESETS } from '../lib/brandContextBuilder.js';
import { planFromBrand, type CreativeFormat } from '../lib/creative-plan-engine.js';
import { uploadCanvasImage } from '../services/r2Service.js';
import { sanitizeForPrompt } from '../utils/promptSanitize.js';
import { chargeCredits, refundCredits } from '../lib/credits.js';
import { getCreditsRequired } from '../utils/usageTracking.js';
import { generateMockup as generateGeminiImage } from '../services/geminiService.js';
import { generateIdeogramImage } from '../services/ideogramService.js';
import { generateReveImage } from '../services/reveService.js';
import { generateSeedreamImage } from '../services/seedreamService.js';
import { generateOpenAIImage } from '../services/openaiImageService.js';
import { generateImagenImage } from '../services/imagenService.js';
import { isIdeogramModel } from '../../src/constants/ideogramModels.js';
import { isReveModel } from '../../src/constants/reveModels.js';
import { isSeedreamModel } from '../../src/constants/seedreamModels.js';
import { isOpenAIImageModel } from '../../src/constants/openaiModels.js';
import { isImagenModel } from '../../src/constants/imagenModels.js';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';
import { withResilience } from '../lib/ai-resilience.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { rateLimit } from 'express-rate-limit';

const router = express.Router();

const JOB_TTL_SECONDS = 60 * 60 * 2;
const MAX_CONCURRENCY = 4;

const contentStudioLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many content generation requests. Please wait a moment.' },
  keyGenerator: (req: any) => req.userId || req.ip,
});

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
  creditsCharged: number;
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

// ─── Multi-provider image generation ─────────────────────────────────────────

async function generateFormatImage(params: {
  brief: string;
  format: { ratio: string; width: number; height: number; platform: string };
  brandGuideline: any | null;
  userId: string;
  model: string;
}): Promise<string> {
  const { brief, format, brandGuideline, userId, model } = params;
  const creativeRatio = mapRatio(format.ratio);

  let prompt = `${brief}. Professional ${format.platform} ${format.ratio} format.`;

  if (brandGuideline) {
    const { plan, pickedMedia } = await planFromBrand({
      prompt: brief,
      format: creativeRatio,
      brandGuideline,
    });
    if (pickedMedia?.url) return pickedMedia.url;
    prompt = plan.background?.prompt ?? brief;
  }

  const base64 = await generateImageWithProvider(prompt, model, creativeRatio);
  return uploadCanvasImage(base64, userId, `content-${nanoid(8)}`);
}

async function generateImageWithProvider(
  prompt: string,
  model: string,
  aspectRatio: CreativeFormat
): Promise<string> {
  if (isIdeogramModel(model)) {
    const result = await generateIdeogramImage({ prompt, model: model as any, aspectRatio: aspectRatio as any });
    return result.base64;
  }
  if (isReveModel(model)) {
    const result = await generateReveImage({ prompt, aspectRatio: aspectRatio as any });
    return result.base64;
  }
  if (isSeedreamModel(model)) {
    const result = await generateSeedreamImage({ prompt, model: model as any, aspectRatio: aspectRatio as any });
    return result.base64;
  }
  if (isOpenAIImageModel(model)) {
    const result = await generateOpenAIImage({ prompt, model, aspectRatio: aspectRatio as any });
    return result.base64;
  }
  if (isImagenModel(model)) {
    const result = await generateImagenImage({ prompt, model: model as any, aspectRatio });
    return result.base64;
  }
  return generateGeminiImage(
    prompt,
    undefined,
    model as any,
    undefined,
    aspectRatio,
    undefined,
    undefined,
    undefined
  );
}

function mapRatio(ratio: string): CreativeFormat {
  switch (ratio) {
    case '1:1': return '1:1';
    case '9:16': return '9:16';
    case '16:9': return '16:9';
    case '4:5': return '4:5';
    case '1.91:1': return '16:9';
    case '2:3': return '9:16';
    default: return '1:1';
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
        const ctx = buildBrandContextJSON(brandGuideline as any, BRAND_SECTION_PRESETS.copy);
        const parts = [
          `Brand: ${ctx.brand.name}`,
          ctx.voice?.tone ? `Tone: ${ctx.voice.tone}` : null,
          ctx.voice?.dos?.length ? `Do: ${ctx.voice.dos.join(', ')}` : null,
          ctx.voice?.donts?.length ? `Don't: ${ctx.voice.donts.join(', ')}` : null,
          ctx.colors?.length
            ? `Colors: ${ctx.colors.map((c: any) => `${c.name || ''} ${c.hex}`).join(', ')}`
            : null,
          ctx.strategy?.positioning?.length
            ? `Positioning: ${ctx.strategy.positioning.join(', ')}`
            : null,
        ];
        brandContextStr = parts.filter(Boolean).join('. ');
      }
    }

    // Step 1: Generate copy
    job.status = 'generating-copy';
    await saveJob(job);

    const copies = await generateCopy({ brief, formats, brandContext: brandContextStr, tone });
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
    let successCount = 0;

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
          successCount++;
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

    // Refund credits for failed images
    const failedCount = formats.length - successCount;
    if (failedCount > 0) {
      const perImageCredits = getCreditsRequired(model, '1K');
      const refundAmount = perImageCredits * failedCount;
      try {
        await refundCredits(userId, refundAmount);
        console.log(`[content-studio] Refunded ${refundAmount} credits for ${failedCount} failed images`);
      } catch (refundErr: any) {
        console.error('[content-studio] Failed to refund credits:', refundErr.message);
      }
    }
  } catch (err: any) {
    job.status = 'error';
    job.error = err.message;
    await saveJob(job);

    // Full refund on catastrophic failure
    try {
      await refundCredits(userId, job.creditsCharged);
      console.log(`[content-studio] Full refund of ${job.creditsCharged} credits after job failure`);
    } catch (refundErr: any) {
      console.error('[content-studio] Failed to refund credits on error:', refundErr.message);
    }
  }
}

// ─── POST /api/content-studio ────────────────────────────────────────────────

router.post('/', contentStudioLimiter, authenticate, async (req: AuthRequest, res) => {
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

  try {
    await chargeCredits(req.userId!, totalCredits);
  } catch (err: any) {
    return res.status(402).json({
      error: 'Insufficient credits',
      required: totalCredits,
      message: err.message,
    });
  }

  const job: ContentJob = {
    jobId: nanoid(),
    status: 'planning',
    brief,
    createdAt: Date.now(),
    totalCount: formats.length,
    completedCount: 0,
    creditsCharged: totalCredits,
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

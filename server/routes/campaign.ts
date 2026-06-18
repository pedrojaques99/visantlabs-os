import express from 'express';
import { nanoid } from 'nanoid';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import { redisClient } from '../lib/redis.js';
import { flattenAlphaIfNeeded } from '../lib/imageFlatten.js';
import { buildBrandContextJSON, BRAND_SECTION_PRESETS } from '../lib/brandContextBuilder.js';
import { generateOpenAIImage } from '../services/openaiImageService.js';
import { generateMockup as generateGeminiImage } from '../services/geminiService.js';
import { enrichWithCuratedReferences } from '../lib/mockup/referenceEnricher.js';
import { uploadCanvasImage } from '../services/r2Service.js';
import { validateExternalUrl, safeFetch } from '../utils/securityValidation.js';
import { sanitizeForPrompt } from '../utils/promptSanitize.js';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';
import { OPENAI_IMAGE_MODELS } from '../../src/constants/openaiModels.js';
import OpenAI from 'openai';
import { chargeCredits, refundCreditsWithRetry } from '../lib/credits.js';
import { getCreditsRequired } from '../utils/usageTracking.js';

const router = express.Router();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CampaignResult {
  index: number;
  adAngle: string;
  format: string;
  prompt: string;
  imageUrl?: string;
  status: 'pending' | 'generating' | 'done' | 'error';
  error?: string;
}

export interface CampaignJob {
  jobId: string;
  status: 'planning' | 'generating' | 'done' | 'error';
  createdAt: number;
  totalCount: number;
  completedCount: number;
  results: CampaignResult[];
  error?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const JOB_TTL_SECONDS = 60 * 60 * 2; // 2 hours
const MAX_CONCURRENCY = 4;
const MAX_COUNT = 20;

const AD_ANGLES = [
  { angle: 'benefit-led', description: 'Primary benefit and transformation outcome' },
  { angle: 'social-proof', description: 'Community trust, testimonials, and validation signals' },
  { angle: 'urgency', description: 'Scarcity, limited time, or fear of missing out' },
  { angle: 'lifestyle', description: 'Aspirational scene with product integrated naturally' },
  { angle: 'pain-agitate', description: 'Problem agitation followed by the solution reveal' },
  { angle: 'transformation', description: 'Before/after identity shift journey' },
  {
    angle: 'curiosity',
    description: 'Pattern interrupt with surprising or counter-intuitive hook',
  },
  { angle: 'authority', description: 'Science-backed, expert-endorsed credibility' },
  { angle: 'comparison', description: 'Differentiation vs alternatives with clear superiority' },
  { angle: 'story', description: 'Narrative micro-story arc with emotional resolution' },
] as const;

const FORMAT_DIMENSIONS: Record<string, string> = {
  square: '1:1 square — Instagram/Facebook feed',
  story: '9:16 vertical — Instagram/TikTok stories and reels',
  banner: '16:9 landscape — YouTube/display advertising',
  portrait: '4:5 portrait — Instagram feed optimized for engagement',
};

// ─── Redis helpers ────────────────────────────────────────────────────────────

async function saveJob(job: CampaignJob): Promise<void> {
  await redisClient.setex(`campaign:${job.jobId}`, JOB_TTL_SECONDS, JSON.stringify(job));
}

async function loadJob(jobId: string): Promise<CampaignJob | null> {
  const raw = await redisClient.get(`campaign:${jobId}`);
  return raw ? (JSON.parse(raw) as CampaignJob) : null;
}

// ─── Durable persistence (survives Redis 2h TTL) ──────────────────────────────
// Best-effort: campaign progress is mirrored to the Campaign Prisma model so the
// work produced for a brand is not lost when the Redis job expires.

async function persistCampaign(
  campaignId: string | undefined,
  patch: {
    status?: string;
    completedCount?: number;
    results?: CampaignResult[];
    error?: string;
  }
): Promise<void> {
  if (!campaignId) return;
  try {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: patch as any,
    });
  } catch (err) {
    console.error('[campaign] Failed to persist campaign update:', err);
  }
}

// ─── Prompt planning via GPT-4o ───────────────────────────────────────────────

async function planPrompts(params: {
  brief: string;
  brandContext: ReturnType<typeof buildBrandContextJSON> | null;
  count: number;
  formats: string[];
}): Promise<Array<{ adAngle: string; format: string; prompt: string }>> {
  const { brief, brandContext, count, formats } = params;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const brandSummary = brandContext
    ? [
        `Brand: ${brandContext.brand.name}`,
        brandContext.colors.length
          ? `Colors: ${brandContext.colors.map((c) => `${c.name} ${c.hex}`).join(', ')}`
          : null,
        brandContext.typography.length
          ? `Typography: ${brandContext.typography.map((t) => `${t.role}: ${t.family}`).join(', ')}`
          : null,
        brandContext.voice?.tone ? `Voice/Tone: ${brandContext.voice.tone}` : null,
        brandContext.voice?.dos?.length ? `Dos: ${brandContext.voice.dos.join(', ')}` : null,
        brandContext.voice?.donts?.length ? `Donts: ${brandContext.voice.donts.join(', ')}` : null,
        brandContext.strategy?.positioning?.length
          ? `Positioning: ${brandContext.strategy.positioning.join(', ')}`
          : null,
      ]
        .filter(Boolean)
        .join('\n')
    : 'No brand context — use neutral professional creative direction.';

  const anglesPool = AD_ANGLES.slice(0, Math.min(count, AD_ANGLES.length));
  const planned = Array.from({ length: count }, (_, i) => ({
    adAngle: anglesPool[i % anglesPool.length].angle,
    format: formats[i % formats.length],
  }));

  const angleGuide = anglesPool.map((a) => `- ${a.angle}: ${a.description}`).join('\n');

  const formatGuide = Object.entries(FORMAT_DIMENSIONS)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  const systemPrompt = `You are a senior creative director generating image-generation prompts for a paid ad campaign.

Each prompt must:
1. Integrate the product photo naturally into the scene
2. Apply the brand visual identity faithfully (colors, typography feel, overall aesthetic)
3. Execute the assigned creative angle precisely
4. Fit the assigned format's composition conventions
5. Use vivid, specific visual language: lighting, mood, color palette, composition, depth of field

Brand context:
${brandSummary}

Creative angles:
${angleGuide}

Ad formats:
${formatGuide}

Respond with a JSON object: { "results": [{"adAngle":"...","format":"...","prompt":"..."}] }
Each prompt must be 80-150 words. No explanations — only the JSON.`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Campaign brief: ${sanitizeForPrompt(
          brief,
          2000
        )}\n\nGenerate ${count} prompts for these pairs:\n${JSON.stringify(planned, null, 2)}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.85,
  });

  const content = response.choices[0]?.message?.content ?? '{"results":[]}';
  const parsed = JSON.parse(content) as {
    results?: Array<{ adAngle: string; format: string; prompt: string }>;
  };
  return (parsed.results ?? []).slice(0, count);
}

// ─── Single image generation (OpenAI or Gemini) ───────────────────────────────

async function generateOneImage(params: {
  prompt: string;
  productImageUrl: string;
  model: string;
  userId: string;
  apiKey?: string;
}): Promise<string> {
  const { prompt, productImageUrl, model, userId, apiKey } = params;

  // Validate URL against SSRF blocklist (localhost, metadata endpoints, private IPs)
  const urlCheck = validateExternalUrl(productImageUrl);
  if (!urlCheck.valid) throw new Error(`Unsafe product image URL: ${urlCheck.error}`);

  const imgResp = await safeFetch(urlCheck.url!);
  if (!imgResp.ok) throw new Error(`Failed to fetch product image: ${imgResp.status}`);
  const imgBuf = Buffer.from(await imgResp.arrayBuffer());
  const rawMime = (imgResp.headers.get('content-type') || 'image/png').split(';')[0];
  // Strip RGBA before handing the product image to gpt-image/gemini — providers
  // reject or degrade transparency.
  const flat = await flattenAlphaIfNeeded(imgBuf, rawMime);
  const imgBase64 = flat.buffer.toString('base64');
  const imgMime = flat.mimeType;

  // Enrich prompt with curated references
  const { prompt: enrichedPrompt } = await enrichWithCuratedReferences(prompt);

  let resultBase64: string;

  const isOpenAI = model.startsWith('gpt-image') || model.startsWith('dall-e');

  if (isOpenAI) {
    const result = await generateOpenAIImage({
      prompt: enrichedPrompt,
      baseImage: { base64: imgBase64, mimeType: imgMime },
      model,
      resolution: '1K',
      apiKey,
    });
    resultBase64 = result.base64;
  } else {
    // Gemini — use the codebase's geminiService which handles model variants correctly
    const geminiModel = model === 'gemini' ? GEMINI_MODELS.IMAGE_FLASH : model;
    resultBase64 = await generateGeminiImage(
      enrichedPrompt,
      { base64: imgBase64, mimeType: imgMime },
      geminiModel as any,
      undefined,
      undefined,
      undefined,
      undefined,
      apiKey
    );
  }

  return uploadCanvasImage(resultBase64, userId, `campaign-${nanoid(8)}`);
}

// ─── Async campaign worker (fire-and-forget from route handler) ───────────────

async function runCampaign(params: {
  job: CampaignJob;
  campaignId?: string;
  brandGuidelineId?: string;
  productImageUrl: string;
  brief: string;
  formats: string[];
  model: string;
  userId: string;
  creditsCharged: number;
  perImageCredits: number;
}): Promise<void> {
  const {
    job,
    campaignId,
    brandGuidelineId,
    productImageUrl,
    brief,
    formats,
    model,
    userId,
    creditsCharged,
    perImageCredits,
  } = params;

  try {
    // Step 1: Resolve brand context
    let brandContext: ReturnType<typeof buildBrandContextJSON> | null = null;
    if (brandGuidelineId) {
      const bg = await prisma.brandGuideline.findFirst({
        where: { id: brandGuidelineId, userId },
      });
      if (bg) brandContext = buildBrandContextJSON(bg as any, BRAND_SECTION_PRESETS.imageGen);
    }

    // Step 2: Plan prompts via GPT-4o
    const planned = await planPrompts({
      brief,
      brandContext,
      count: job.totalCount,
      formats,
    });

    job.status = 'generating';
    job.results = planned.map((p, i) => ({
      index: i,
      adAngle: p.adAngle,
      format: p.format,
      prompt: p.prompt,
      status: 'pending' as const,
    }));
    await saveJob(job);
    await persistCampaign(campaignId, { status: 'generating', results: job.results });

    // Step 3: Generate all images with bounded concurrency
    const queue = planned.map((_, i) => i);

    const worker = async () => {
      while (queue.length > 0) {
        const i = queue.shift();
        if (i === undefined) break;

        job.results[i] = { ...job.results[i], status: 'generating' };
        await saveJob(job);

        try {
          const imageUrl = await generateOneImage({
            prompt: planned[i].prompt,
            productImageUrl,
            model,
            userId,
          });
          job.results[i] = { ...job.results[i], status: 'done', imageUrl };
        } catch (err: any) {
          job.results[i] = { ...job.results[i], status: 'error', error: err.message };
        }

        job.completedCount++;
        await saveJob(job);
      }
    };

    await Promise.allSettled(
      Array.from({ length: Math.min(MAX_CONCURRENCY, planned.length) }, worker)
    );

    job.status = 'done';
    await saveJob(job);
    await persistCampaign(campaignId, {
      status: 'done',
      completedCount: job.completedCount,
      results: job.results,
    });

    // Refund credits for images that failed — user only pays for delivered results
    const failedCount = job.results.filter((r) => r.status === 'error').length;
    if (creditsCharged > 0 && failedCount > 0 && perImageCredits > 0) {
      const refundAmount = Math.min(failedCount * perImageCredits, creditsCharged);
      await refundCreditsWithRetry(userId, refundAmount).catch(() => {});
      console.log(
        `[campaign] Refunded ${refundAmount} credit(s) for ${failedCount} failed image(s)`,
        {
          jobId: job.jobId,
          userId,
        }
      );
    }
  } catch (err: any) {
    job.status = 'error';
    job.error = err.message;
    await saveJob(job);
    await persistCampaign(campaignId, {
      status: 'error',
      error: err.message,
      completedCount: job.completedCount,
      results: job.results,
    });

    // Planning (or setup) failed before any image was delivered — refund everything
    // minus images already completed.
    const doneCount = job.results.filter((r) => r.status === 'done').length;
    const refundAmount = Math.max(0, creditsCharged - doneCount * perImageCredits);
    if (refundAmount > 0) {
      await refundCreditsWithRetry(userId, refundAmount).catch(() => {});
      console.log(`[campaign] Refunded ${refundAmount} credit(s) after campaign failure`, {
        jobId: job.jobId,
        userId,
      });
    }
  }
}

// ─── POST /api/canvas/generate-campaign ──────────────────────────────────────

router.post('/', authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  const {
    brandGuidelineId,
    productImageUrl,
    brief = 'Create compelling marketing ads for this product',
    count = 10,
    formats = ['square', 'story'],
    model = OPENAI_IMAGE_MODELS.GPT_IMAGE_1,
  } = req.body as {
    brandGuidelineId?: string;
    productImageUrl?: string;
    brief?: string;
    count?: number;
    formats?: string[];
    model?: string;
  };

  if (!productImageUrl) {
    return res.status(400).json({ error: 'productImageUrl is required' });
  }

  const urlCheck = validateExternalUrl(productImageUrl);
  if (!urlCheck.valid) {
    return res.status(400).json({ error: 'Invalid product image URL', details: urlCheck.error });
  }

  const validFormats = ['square', 'story', 'banner', 'portrait'];
  const safeFormats = (Array.isArray(formats) ? formats : [formats]).filter((f) =>
    validFormats.includes(f)
  );
  if (safeFormats.length === 0) safeFormats.push('square', 'story');

  const safeCount = Math.min(Math.max(1, Number(count) || 10), MAX_COUNT);

  // Charge credits upfront: 1 credit for GPT-4o planning + per-image credits
  const perImageCredits = getCreditsRequired(model, '1K');
  const totalCredits = 1 + perImageCredits * safeCount;
  const chargeResult = await chargeCredits(req.userId!, totalCredits);

  const job: CampaignJob = {
    jobId: nanoid(),
    status: 'planning',
    createdAt: Date.now(),
    totalCount: safeCount,
    completedCount: 0,
    results: [],
  };

  await saveJob(job);

  // Persist a durable, brand-scoped campaign record. Survives the Redis 2h TTL so
  // the user's campaign (and its creatives) remain queryable from the brand cockpit.
  let campaignId: string | undefined;
  try {
    const campaign = await prisma.campaign.create({
      data: {
        userId: req.userId,
        name: brief?.trim().slice(0, 80) || 'Untitled Campaign',
        brandGuidelineId: brandGuidelineId || null,
        brief: brief || '',
        productImageUrl,
        formats: safeFormats,
        model,
        jobId: job.jobId,
        status: 'planning',
        totalCount: safeCount,
        completedCount: 0,
        results: [],
      },
      select: { id: true },
    });
    campaignId = campaign.id;
  } catch (err) {
    console.error('[campaign] Failed to persist campaign record:', err);
  }

  res.status(202).json({
    jobId: job.jobId,
    campaignId,
    totalCount: safeCount,
    creditsCharged: chargeResult.creditsDeducted,
  });

  // Run async — do not await (fire-and-forget with full error capture inside runCampaign)
  runCampaign({
    job,
    campaignId,
    brandGuidelineId,
    productImageUrl,
    brief,
    formats: safeFormats,
    model,
    userId: req.userId,
    creditsCharged: chargeResult.creditsDeducted,
    perImageCredits,
  }).catch((err) => {
    console.error('[campaign] Unhandled error in runCampaign:', err);
  });
});

// ─── GET /api/canvas/generate-campaign/:jobId ─────────────────────────────────

router.get('/:jobId', authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  const job = await loadJob(req.params.jobId);
  if (job) return res.json(job);

  // Redis miss (expired after 2h, or Redis down) — fall back to the persisted record.
  const campaign = await prisma.campaign.findFirst({
    where: { jobId: req.params.jobId, userId: req.userId },
  });
  if (!campaign) return res.status(404).json({ error: 'Job not found' });

  return res.json({
    jobId: campaign.jobId,
    campaignId: campaign.id,
    status: campaign.status,
    createdAt: campaign.createdAt.getTime(),
    totalCount: campaign.totalCount,
    completedCount: campaign.completedCount,
    results: (campaign.results as unknown as CampaignResult[]) ?? [],
    error: campaign.error ?? undefined,
  });
});

export default router;

import express from 'express';
import { randomUUID } from 'crypto';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import { rateLimit } from 'express-rate-limit';
import { generateMockup } from '../../src/services/geminiService.js';
import { generateSeedreamImage } from '../services/seedreamService.js';
import { generateOpenAIImage } from '../services/openaiImageService.js';
import { generateImagenImage } from '../services/imagenService.js';
import { generateIdeogramImage } from '../services/ideogramService.js';
import { generateReveImage } from '../services/reveService.js';
import { isSeedreamModel, SEEDREAM_MODELS } from '../../src/constants/seedreamModels.js';
import { isOpenAIImageModel, OPENAI_IMAGE_MODELS } from '../../src/constants/openaiModels.js';
import { isImagenModel, IMAGEN_MODELS } from '../../src/constants/imagenModels.js';
import { isIdeogramModel, IDEOGRAM_MODELS } from '../../src/constants/ideogramModels.js';
import { isReveModel, REVE_MODELS } from '../../src/constants/reveModels.js';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';
import { IMAGE_MODEL_REGISTRY } from '../../src/constants/imageModelRegistry.js';
import { chargeCredits, refundCredits, type DeductionSource } from '../lib/credits.js';
import { getCreditsRequired } from '../utils/usageTracking.js';
import { buildBrandContextForImageGen } from '../lib/brandContextBuilder.js';
import { uploadImage, isR2Configured, StorageLimitExceededError } from '../services/r2Service.js';
import type { Resolution, AspectRatio } from '../../src/types/types.js';

const router = express.Router();

const benchmarkLimiter = rateLimit({
  windowMs: 60_000,
  max: 3,
  message: { error: 'Too many benchmark requests. Try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const MAX_MODELS_PER_BENCHMARK = 6;

// ─── Competitive Tiers ──────────────────────────────────────────────────────
// Benchmark-only data layered on top of IMAGE_MODEL_REGISTRY (single source)

type BenchmarkTier = 'flagship' | 'balanced' | 'fast' | 'legacy';

interface BenchmarkExtra {
  tier: BenchmarkTier;
  released: string;
  strengths: string[];
}

const BENCHMARK_EXTRAS: Record<string, BenchmarkExtra> = {
  [OPENAI_IMAGE_MODELS.GPT_IMAGE_2]: {
    tier: 'flagship',
    released: '2025-04',
    strengths: ['text', 'editing', 'photorealism'],
  },
  [GEMINI_MODELS.IMAGE_PRO]: {
    tier: 'flagship',
    released: '2025-06',
    strengths: ['reasoning', 'text', 'multi-ref'],
  },
  [IMAGEN_MODELS.IMAGEN_4_ULTRA]: {
    tier: 'flagship',
    released: '2025-05',
    strengths: ['photorealism', 'quality'],
  },
  [SEEDREAM_MODELS.SD_5_LITE]: {
    tier: 'flagship',
    released: '2025-06',
    strengths: ['resolution', 'photorealism', 'batch'],
  },
  [IDEOGRAM_MODELS.V4]: {
    tier: 'flagship',
    released: '2025-05',
    strengths: ['text-rendering', 'typography', 'structured'],
  },
  [REVE_MODELS.REVE_1]: {
    tier: 'flagship',
    released: '2025-04',
    strengths: ['prompt-adherence', 'text', 'typoguard'],
  },
  [GEMINI_MODELS.IMAGE_NB2]: {
    tier: 'balanced',
    released: '2025-05',
    strengths: ['speed', 'multi-ref', 'cost'],
  },
  [IMAGEN_MODELS.IMAGEN_4]: {
    tier: 'balanced',
    released: '2025-05',
    strengths: ['quality-cost', 'text'],
  },
  [SEEDREAM_MODELS.SD_4_5]: {
    tier: 'balanced',
    released: '2025-03',
    strengths: ['resolution', 'multi-ref'],
  },
  [OPENAI_IMAGE_MODELS.GPT_IMAGE_1]: {
    tier: 'balanced',
    released: '2025-01',
    strengths: ['editing', 'versatile'],
  },
  [IDEOGRAM_MODELS.V3]: {
    tier: 'balanced',
    released: '2025-02',
    strengths: ['styles', 'presets', 'character-ref'],
  },
  [IMAGEN_MODELS.IMAGEN_4_FAST]: {
    tier: 'fast',
    released: '2025-05',
    strengths: ['speed', 'cost'],
  },
  [SEEDREAM_MODELS.SD_4_0]: { tier: 'legacy', released: '2024-12', strengths: ['resolution'] },
  [SEEDREAM_MODELS.SD_3_T2I]: { tier: 'legacy', released: '2024-09', strengths: ['seed-control'] },
  [SEEDREAM_MODELS.SE_3_I2I]: { tier: 'legacy', released: '2024-09', strengths: ['editing'] },
};

interface BenchmarkModelMeta {
  id: string;
  provider: string;
  label: string;
  description: string;
  tier: BenchmarkTier;
  released: string;
  strengths: string[];
  supportsLogoRef: boolean;
}

// Derive from IMAGE_MODEL_REGISTRY — only models with benchmark extras are included
const MODEL_META: BenchmarkModelMeta[] = IMAGE_MODEL_REGISTRY.filter(
  (m) => m.id in BENCHMARK_EXTRAS
).map((m) => ({
  id: m.id,
  provider: m.provider,
  label: m.label,
  description: m.description,
  supportsLogoRef: m.supportsLogoRef,
  ...BENCHMARK_EXTRAS[m.id],
}));

const MODEL_META_MAP = new Map(MODEL_META.map((m) => [m.id, m]));

function getProviderForModel(model: string): string {
  return (
    MODEL_META_MAP.get(model)?.provider ||
    IMAGE_MODEL_REGISTRY.find((m) => m.id === model)?.provider ||
    'gemini'
  );
}

function hasProviderKey(provider: string): boolean {
  const has = (key: string) => {
    const v = process.env[key];
    return !!v && v !== 'undefined' && v.trim().length > 0;
  };
  switch (provider) {
    case 'gemini':
    case 'imagen':
      return has('GEMINI_API_KEY') || has('VITE_GEMINI_API_KEY');
    case 'openai':
      return has('OPENAI_KEY') || has('OPENAI_API_KEY');
    case 'seedream':
      return has('BYTEPLUS_API_KEY');
    case 'ideogram':
      return has('IDEOGRAM_API_KEY');
    case 'reve':
      return has('REVE_API_KEY');
    default:
      return false;
  }
}

async function generateForModel(
  model: string,
  prompt: string,
  resolution?: Resolution,
  aspectRatio?: AspectRatio
): Promise<{ base64: string; seed?: number }> {
  if (isImagenModel(model)) {
    const result = await generateImagenImage({
      prompt,
      model: model as any,
      aspectRatio: aspectRatio || '1:1',
    });
    return { base64: result.base64 };
  }
  if (isSeedreamModel(model)) {
    const result = await generateSeedreamImage({
      prompt,
      model: model as any,
      resolution,
      aspectRatio,
    });
    return { base64: result.base64, seed: result.seed };
  }
  if (isOpenAIImageModel(model)) {
    const result = await generateOpenAIImage({ prompt, model, resolution, aspectRatio });
    return { base64: result.base64 };
  }
  if (isIdeogramModel(model)) {
    const result = await generateIdeogramImage({
      prompt,
      model: model as any,
      resolution,
      aspectRatio,
    });
    return { base64: result.base64, seed: result.seed };
  }
  if (isReveModel(model)) {
    const result = await generateReveImage({ prompt, model: model as any, aspectRatio });
    return { base64: result.base64, seed: result.seed };
  }
  const geminiModel = (model as any) || GEMINI_MODELS.IMAGE_NB2;
  const base64 = await generateMockup(prompt, undefined, geminiModel, resolution, aspectRatio);
  return { base64 };
}

// ─── SSE helper ──────────────────────────────────────────────────────────────

function sendSSE(res: express.Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ─── GET /benchmark/models — All models with availability + tiers ────────────

router.get('/models', (_req, res) => {
  const models = MODEL_META.map((m) => ({
    ...m,
    available: hasProviderKey(m.provider),
    creditsCost1K: getCreditsRequired(m.id, '1K' as Resolution),
  }));

  const tiers: Record<BenchmarkTier, string> = {
    flagship: 'Flagship — best quality per provider',
    balanced: 'Balanced — quality/cost sweet spot',
    fast: 'Fast — speed optimized',
    legacy: 'Legacy — previous generation',
  };

  res.json({ models, tiers, maxPerBenchmark: MAX_MODELS_PER_BENCHMARK });
});

// ─── GET /benchmark/status/:id — Poll generation status ──────────────────────

router.get('/status/:id', async (req, res) => {
  const { id } = req.params;
  if (!/^[a-fA-F0-9]{24}$/.test(id))
    return res.status(400).json({ error: 'Invalid benchmark ID.' });

  const benchmark = await prisma.benchmark.findUnique({
    where: { id },
    select: { status: true, results: true, completedAt: true },
  });
  if (!benchmark) return res.status(404).json({ error: 'Benchmark not found.' });

  const completedCount = (benchmark.results as any[]).filter(
    (r: any) => r.imageUrl || r.error
  ).length;
  res.json({ status: benchmark.status, completedCount, completedAt: benchmark.completedAt });
});

// ─── GET /benchmark — Public gallery ─────────────────────────────────────────

router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string) || 12));
  const skip = (page - 1) * limit;

  const [benchmarks, total] = await Promise.all([
    prisma.benchmark.findMany({
      where: { isPublic: true, status: 'completed' },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        prompt: true,
        models: true,
        results: true,
        winnerModel: true,
        voted: true,
        viewCount: true,
        resolution: true,
        aspectRatio: true,
        createdAt: true,
        userId: true,
      },
    }),
    prisma.benchmark.count({ where: { isPublic: true, status: 'completed' } }),
  ]);

  const userIds = [...new Set(benchmarks.map((b) => b.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, picture: true, username: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const items = benchmarks.map((b) => {
    const user = userMap.get(b.userId);
    return {
      id: b.id,
      prompt: b.prompt.slice(0, 120),
      models: b.models,
      winnerModel: b.winnerModel,
      voted: b.voted,
      viewCount: b.viewCount,
      thumbnails: (b.results as any[])
        .filter((r: any) => r.imageUrl)
        .slice(0, 4)
        .map((r: any) => ({ model: r.model, imageUrl: r.imageUrl })),
      createdAt: b.createdAt,
      user: user ? { name: user.name, picture: user.picture, username: user.username } : null,
    };
  });

  res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
});

// ─── POST /benchmark/run — SSE streaming benchmark ──────────────────────────

router.post('/run', benchmarkLimiter, authenticate, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { prompt, models, resolution, aspectRatio, brandGuidelineId, isPublic = true } = req.body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
    return res.status(400).json({ error: 'Prompt is required (min 3 chars).' });
  }
  if (!Array.isArray(models) || models.length < 2) {
    return res.status(400).json({ error: 'At least 2 models required.' });
  }
  if (models.length > MAX_MODELS_PER_BENCHMARK) {
    return res
      .status(400)
      .json({ error: `Maximum ${MAX_MODELS_PER_BENCHMARK} models per benchmark.` });
  }

  const validModels = models.filter(
    (m: string) => MODEL_META_MAP.has(m) && hasProviderKey(getProviderForModel(m))
  );
  if (validModels.length < 2) {
    return res.status(400).json({ error: 'At least 2 available models required.' });
  }

  let totalCredits = 0;
  for (const model of validModels) {
    totalCredits += getCreditsRequired(model, (resolution || '1K') as Resolution);
  }

  let chargeResult;
  try {
    chargeResult = await chargeCredits(userId, totalCredits, { requestId: randomUUID() });
  } catch (err: any) {
    return res.status(402).json({ error: err.message || 'Insufficient credits.' });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true, isAdmin: true },
  });
  const subscriptionTier = user?.subscriptionTier || 'free';
  const isAdmin = user?.isAdmin || false;

  let enrichedPrompt = prompt.trim();
  if (brandGuidelineId) {
    try {
      const bg = await prisma.brandGuideline.findFirst({ where: { id: brandGuidelineId } });
      if (bg) enrichedPrompt = `${buildBrandContextForImageGen(bg as any)}\n\n${enrichedPrompt}`;
    } catch {
      /* continue */
    }
  }

  const benchmark = await prisma.benchmark.create({
    data: {
      userId,
      prompt: prompt.trim(),
      brandGuidelineId: brandGuidelineId || null,
      models: validModels,
      resolution: resolution || '1K',
      aspectRatio: aspectRatio || '1:1',
      status: 'running',
      totalCreditsCharged: chargeResult.charged ? chargeResult.creditsDeducted : 0,
      isPublic: isPublic !== false,
      results: [],
    },
  });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  sendSSE(res, 'start', {
    benchmarkId: benchmark.id,
    models: validModels,
    totalCreditsCharged: chargeResult.charged ? chargeResult.creditsDeducted : 0,
    totalModels: validModels.length,
  });

  const allResults: any[] = [];
  let completedCount = 0;

  await Promise.allSettled(
    validModels.map(async (model: string) => {
      const meta = MODEL_META_MAP.get(model);
      const start = Date.now();

      sendSSE(res, 'generating', {
        model,
        label: meta?.label || model,
        provider: getProviderForModel(model),
      });

      try {
        const { base64 } = await generateForModel(
          model,
          enrichedPrompt,
          resolution as Resolution,
          aspectRatio as AspectRatio
        );

        let imageUrl: string | undefined;
        let uploadError: string | null = null;
        if (isR2Configured() && base64) {
          try {
            imageUrl = await uploadImage(
              base64,
              userId,
              `bench-${benchmark.id}-${model}`,
              subscriptionTier,
              isAdmin
            );
          } catch (uploadErr: any) {
            if (uploadErr instanceof StorageLimitExceededError) {
              uploadError = 'Storage limit exceeded — upgrade your plan or free up space';
            } else {
              uploadError = 'Upload failed — image was generated but could not be saved';
            }
            console.warn(`[Benchmark] Upload error for ${model}:`, uploadErr.message);
          }
        } else if (!isR2Configured()) {
          uploadError = 'Storage not configured';
        }

        const credits = getCreditsRequired(model, (resolution || '1K') as Resolution);
        const result = {
          model,
          provider: getProviderForModel(model),
          imageUrl: imageUrl || undefined,
          durationMs: Date.now() - start,
          error: uploadError,
          creditsCost: credits,
          generationSucceeded: true,
          votes: 0,
        };

        completedCount++;
        allResults.push(result);
        sendSSE(res, 'result', {
          ...result,
          completedCount,
          totalModels: validModels.length,
          label: meta?.label || model,
        });
      } catch (err: any) {
        const credits = getCreditsRequired(model, (resolution || '1K') as Resolution);
        const result = {
          model,
          provider: getProviderForModel(model),
          imageUrl: null,
          durationMs: Date.now() - start,
          error: err.message?.slice(0, 200) || 'Generation failed',
          creditsCost: credits,
          generationSucceeded: false,
          votes: 0,
        };

        completedCount++;
        allResults.push(result);
        sendSSE(res, 'error', {
          model,
          provider: getProviderForModel(model),
          error: result.error,
          durationMs: result.durationMs,
          creditsCost: result.creditsCost,
          completedCount,
          totalModels: validModels.length,
          label: meta?.label || model,
        });
      }
    })
  );

  const failedCredits = allResults
    .filter((r) => !r.generationSucceeded)
    .reduce((sum, r) => sum + r.creditsCost, 0);
  if (failedCredits > 0 && chargeResult.charged) {
    try {
      await refundCredits(userId, failedCredits, chargeResult.deductionSource as DeductionSource);
    } catch {
      /* log but don't block */
    }
  }

  await prisma.benchmark.update({
    where: { id: benchmark.id },
    data: {
      status: 'completed',
      completedAt: new Date(),
      results: allResults as any,
      creditsRefunded: failedCredits,
    },
  });

  sendSSE(res, 'complete', {
    benchmarkId: benchmark.id,
    totalModels: validModels.length,
    successCount: allResults.filter((r) => r.generationSucceeded).length,
    failedCount: allResults.filter((r) => !r.generationSucceeded).length,
    creditsRefunded: failedCredits,
  });

  res.end();
});

// ─── GET /benchmark/:id — View benchmark results ────────────────────────────

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!/^[a-fA-F0-9]{24}$/.test(id))
    return res.status(400).json({ error: 'Invalid benchmark ID.' });

  const benchmark = await prisma.benchmark.findUnique({ where: { id } });
  if (!benchmark) return res.status(404).json({ error: 'Benchmark not found.' });

  if (!benchmark.isPublic) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(403).json({ error: 'This benchmark is private.' });
  }

  prisma.benchmark.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  const user = await prisma.user.findUnique({
    where: { id: benchmark.userId },
    select: { name: true, picture: true, username: true },
  });

  res.json({
    id: benchmark.id,
    prompt: benchmark.prompt,
    models: benchmark.models,
    status: benchmark.status,
    results: benchmark.results,
    resolution: benchmark.resolution,
    aspectRatio: benchmark.aspectRatio,
    winnerModel: benchmark.winnerModel,
    voted: benchmark.voted,
    viewCount: benchmark.viewCount,
    totalCreditsCharged: benchmark.totalCreditsCharged,
    creditsRefunded: benchmark.creditsRefunded,
    createdAt: benchmark.createdAt,
    completedAt: benchmark.completedAt,
    user: user ? { name: user.name, picture: user.picture, username: user.username } : null,
  });
});

// ─── POST /benchmark/:id/vote ────────────────────────────────────────────────

router.post('/:id/vote', authenticate, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;
  const { winnerModel } = req.body;

  if (!/^[a-fA-F0-9]{24}$/.test(id))
    return res.status(400).json({ error: 'Invalid benchmark ID.' });

  const benchmark = await prisma.benchmark.findUnique({ where: { id } });
  if (!benchmark) return res.status(404).json({ error: 'Benchmark not found.' });
  if (benchmark.userId !== userId)
    return res.status(403).json({ error: 'Only the benchmark creator can vote.' });
  if (benchmark.voted) return res.status(409).json({ error: 'Already voted on this benchmark.' });
  if (benchmark.status !== 'completed')
    return res.status(400).json({ error: 'Benchmark must be completed before voting.' });
  if (!winnerModel || !benchmark.models.includes(winnerModel))
    return res.status(400).json({ error: 'Winner must be one of the benchmark models.' });

  const updatedResults = (benchmark.results as any[]).map((r: any) => ({
    ...r,
    votes: r.model === winnerModel ? (r.votes || 0) + 1 : r.votes || 0,
  }));

  const refundAmount = Math.floor(benchmark.totalCreditsCharged / 2);
  if (refundAmount > 0) {
    try {
      await refundCredits(userId, refundAmount);
    } catch {
      /* continue */
    }
  }

  await prisma.benchmark.update({
    where: { id },
    data: {
      voted: true,
      winnerModel,
      results: updatedResults,
      creditsRefunded: benchmark.creditsRefunded + refundAmount,
    },
  });

  res.json({
    success: true,
    winnerModel,
    creditsRefunded: refundAmount,
    message:
      refundAmount > 0
        ? `Vote recorded! ${refundAmount} credits refunded (50% back).`
        : 'Vote recorded!',
  });
});

export default router;

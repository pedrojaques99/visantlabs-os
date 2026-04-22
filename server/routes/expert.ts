import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { knowledgeService } from '../services/knowledgeService.js';
import { getGeminiApiKey } from '../utils/geminiApiKey.js';
import { rateLimit } from 'express-rate-limit';
import { redisClient } from '../lib/redis.js';
import { CACHE_TTL, CacheKey, hashQuery } from '../lib/cache-utils.js';
import { prisma } from '../db/prisma.js';
import { buildBrandContext } from '../lib/brandContextBuilder.js';

const expertRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // Max 10 per minute
  message: { error: 'O Especialista precisa de um tempo para pensar. Por favor, aguarde um minuto antes de continuar.' },
});

const router = express.Router();

/**
 * POST /api/expert/ingest
 * Ingest text, image, or document into knowledge base
 */
router.post('/ingest', expertRateLimiter, authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (!req.isAdmin) {
      return res.status(403).json({ error: 'Apenas administradores podem inserir material na base de conhecimento.' });
    }

    const { parts, metadata, projectId } = req.body;

    if (!parts || !Array.isArray(parts)) {
      return res.status(400).json({ error: 'Parts array is required' });
    }

    const result = await knowledgeService.ingestContent({
      userId: req.userId!,
      projectId,
      parts,
      metadata
    });

    // Invalidate expert RAG cache for this project
    if (projectId) {
      await redisClient.del(`expert:*:${projectId}:*`).catch(() => null);
      console.log(`[Cache] INVALIDATE expert:*:${projectId}:*`);
    }

    res.json(result);
  } catch (error) {
    console.error('Expert ingestion error:', error);
    next(error);
  }
});

/**
 * POST /api/expert/chat
 * Chat with the branding expert using RAG
 */
router.post('/chat', expertRateLimiter, authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { query, history, projectId, model, brandGuidelineId } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Cache check
    let cached = null;
    let queryHash = '';
    let cacheKey = '';

    try {
      queryHash = hashQuery(query, JSON.stringify(history || []));
      cacheKey = CacheKey.expertRag(req.userId!, projectId || 'default', queryHash);
      cached = await redisClient.get(cacheKey);
    } catch (cacheError) {
      console.warn('[Redis] Cache lookup failed, continuing with RAG:', cacheError);
    }

    if (cached) {
      console.log(`[Cache] HIT expert:${queryHash.slice(0, 8)}`);
      return res.json({ ...JSON.parse(cached), fromCache: true });
    }

    let userApiKey: string | undefined;
    try {
      userApiKey = await getGeminiApiKey(req.userId!);
    } catch (e) {
      // Logic for system key fallback is handled in geminiService
    }

    let brandContext = '';
    if (brandGuidelineId) {
      try {
        const guideline = await prisma.brandGuideline.findUnique({
          where: { id: brandGuidelineId }
        });

        if (guideline && guideline.userId === req.userId!) {
          brandContext = buildBrandContext(guideline as any);
          console.log(`[Expert] Using brand guidelines: ${(guideline.identity as { name?: string } | null)?.name || 'Unnamed'}`);
        }
      } catch (e) {
        console.warn('[Expert] Error loading brand guidelines:', e);
      }
    }

    const result = await knowledgeService.expertChat({
      query,
      userId: req.userId!,
      projectId,
      history,
      userApiKey,
      model,
      brandContext
    });

    // Cache set
    if (queryHash && cacheKey) {
      try {
        await redisClient.setex(
          cacheKey,
          CACHE_TTL.EXPERT_RAG,
          JSON.stringify(result)
        );
        console.log(`[Cache] SET expert:${queryHash.slice(0, 8)} (24h)`);
      } catch (cacheError) {
        console.warn('[Redis] Cache store failed:', cacheError);
      }
    }

    res.json(result);
  } catch (error: any) {
    console.error('Expert chat error:', error);
    // Handle specific configuration errors with better status codes
    if (error.message && error.message.includes('CONFIGURAÇÃO_AUSENTE')) {
      return res.status(503).json({ 
        error: 'Serviço temporariamente indisponível', 
        message: 'A base de conhecimento (RAG) não está configurada corretamente. Verifique as chaves de API do Pinecone.' 
      });
    }
    next(error);
  }
});

export default router;

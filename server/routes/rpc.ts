/**
 * /api/rpc — entrada única para ops http do protocolo compartilhado.
 * Ver shared/protocol.ts e .agent/plans/plugin-webapp-unification.md (Fase 3).
 *
 * Handlers server-side: ai.chat, ai.generate, telemetry.log.
 * Ops que não começam com essas prefixes retornam UNKNOWN_OP.
 */
import express from 'express';
import type { Envelope, OpName, Result, TelemetryEntry } from '../../shared/protocol.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';
import { resolveBrandGuideline } from '../lib/brandResolver.js';
import { buildBrandContextJSONString } from '../lib/brandContextBuilder.js';
import { improvePrompt } from '../services/geminiService.js';

const router = express.Router();

type Handler = (payload: any, req: express.Request) => Promise<unknown>;

const handlers: Partial<Record<OpName, Handler>> = {
  /**
   * ai.chat — injeta BrandGuideline ativa (meta.brandId) no prompt antes de chamar o LLM.
   * Diferencial Visant (CLAUDE.md): guidelines são INPUT, não apenas output.
   */
  'ai.chat': async (p: { prompt: string; messages?: unknown[]; stream?: boolean }, req) => {
    const env = req.body as Envelope;
    const userId = (req as AuthRequest).userId;
    const brandId = env.meta?.brandId;

    let brandPreamble = '';
    if (userId && brandId) {
      const { guideline } = await resolveBrandGuideline('', userId, brandId);
      if (guideline) {
        brandPreamble = `# Brand Context\n${buildBrandContextJSONString(guideline)}\n\n# User Request\n`;
      }
    }

    const full = `${brandPreamble}${p.prompt}`;
    const result = await improvePrompt(full);
    return { text: result.improvedPrompt };
  },

  'telemetry.log': async (p: { entries: TelemetryEntry[] }) => {
    // Log estruturado; um sink persistente pode ser plugado depois.
    for (const e of p.entries ?? []) {
      logger.info({ op: e.op, ms: e.ms, ok: e.ok, code: e.errorCode }, '[rpc:telemetry]');
    }
    return { ok: true };
  },
};

router.post('/', authenticate, async (req, res) => {
  const env = req.body as Envelope;
  const t0 = Date.now();
  const fail = (code: string, message: string, status = 400): Result => {
    res.status(status);
    return { id: env?.id ?? 'n/a', ok: false, error: { code, message }, ms: Date.now() - t0 };
  };

  if (!env || env.v !== 1 || typeof env.id !== 'string' || typeof env.op !== 'string') {
    return res.json(fail('BAD_ENVELOPE', 'Envelope malformed', 400));
  }

  const handler = handlers[env.op];
  if (!handler) return res.json(fail('UNKNOWN_OP', `No server handler for "${env.op}"`, 404));

  try {
    const data = await handler(env.payload, req);
    const r: Result = { id: env.id, ok: true, data, ms: Date.now() - t0 };
    return res.json(r);
  } catch (e: any) {
    const r: Result = {
      id: env.id, ok: false,
      error: { code: e?.code ?? 'HANDLER_ERROR', message: e?.message ?? String(e) },
      ms: Date.now() - t0,
    };
    return res.status(500).json(r);
  }
});

export default router;

import { Router } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import {
  NODE_BUILDER_SYSTEM_PROMPT,
  SHADER_SELECTOR_SYSTEM_PROMPT,
} from '../lib/node-builder-prompts.js';
import { prisma } from '../db/prisma.js';
import type { NodeBuilderLLMResponse, CustomNodeDefinition } from '../../src/types/customNode.js';
import { sanitizeForPrompt } from '../utils/promptSanitize.js';
import { chargeCredits, refundCredits } from '../lib/credits.js';
import { completeText, parseJsonLoose } from '../lib/ai-providers/cheapText.js';

const router = Router();

/**
 * Estorna sem deixar o erro original se perder. Estas rotas cobram ANTES de
 * gerar (portão de saldo) e antes NÃO estornavam: qualquer falha do provider
 * queimava 1 crédito do usuário em silêncio.
 */
async function refundQuietly(userId: string, label: string): Promise<void> {
  try {
    await refundCredits(userId, 1);
  } catch (err: any) {
    console.error(`[${label}] REFUND FAILED — user charged without result:`, userId, err?.message);
  }
}

// POST /api/node-builder/generate
router.post('/generate', authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  const { messages, canvasContext } = req.body as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    canvasContext?: string;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages required' });
  }

  let charged = false;
  try {
    // canvasContext vem do body — sanitizar antes de concatenar no system
    // prompt (strip de role-tags e markers de injeção). Mesmo padrão que a rota
    // /shader-params já usa.
    const systemInstruction =
      NODE_BUILDER_SYSTEM_PROMPT +
      (canvasContext
        ? `\n\nCurrent canvas context: ${sanitizeForPrompt(canvasContext, 4000)}`
        : '');

    // A cascata fala system+user (OpenAI-compat), não turnos multi-role do
    // Gemini. Transcrever o histórico preserva o contexto da conversa — as
    // mensagens também são sanitizadas (conteúdo do usuário).
    const transcript = messages
      .map(
        (m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${sanitizeForPrompt(m.content, 4000)}`
      )
      .join('\n\n');

    await chargeCredits(req.userId!, 1);
    charged = true;

    const result = await completeText({
      system: systemInstruction,
      user: transcript,
      userId: req.userId!,
      // SEM `json: true` de propósito: este endpoint responde OU uma definição
      // em JSON OU uma pergunta em texto livre. Forçar `json_object` faria o
      // modelo embrulhar a pergunta em JSON e matar o caminho conversacional.
      maxTokens: 4000,
    });

    // `parseJsonLoose` já lida com cercas ```json e prosa em volta.
    const text = result.text.trim();
    const parsed = parseJsonLoose<any>(text);

    let response: NodeBuilderLLMResponse;
    if (parsed?.type === 'definition' && parsed.definition) {
      const def: CustomNodeDefinition = {
        ...parsed.definition,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      response = { type: 'definition', definition: def };
    } else {
      // Não é JSON de definição → é pergunta. Comportamento esperado aqui.
      response = { type: 'question', text };
    }

    res.json({ ...response, generationId: crypto.randomUUID() }); // generationId for RAG feedback loop
  } catch (err: any) {
    console.error('[node-builder/generate]', err);
    if (charged) await refundQuietly(req.userId!, 'node-builder/generate');
    const unavailable = String(err?.message || '').startsWith('cheaptext_unavailable');
    res.status(unavailable ? 503 : 500).json({
      error: unavailable
        ? 'Nenhum provedor de IA disponível. Seu crédito foi estornado.'
        : 'Failed to process',
    });
  }
});

// POST /api/node-builder/shader-params
router.post('/shader-params', authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  const { description } = req.body as { description: string };
  if (!description) return res.status(400).json({ error: 'description required' });

  let charged = false;
  try {
    await chargeCredits(req.userId!, 1);
    charged = true;

    const result = await completeText({
      system: SHADER_SELECTOR_SYSTEM_PROMPT,
      user: `Select shader for: "${sanitizeForPrompt(description, 500)}"`,
      userId: req.userId!,
      json: true,
      maxTokens: 1000,
    });

    const parsed = parseJsonLoose<Record<string, unknown>>(result.text);
    // Antes o JSON.parse cru estourava para o 500 sem estornar. Agora, resposta
    // inválida é erro tratado — e o crédito volta.
    if (!parsed) throw new Error('shader params: resposta não-JSON do provider');
    res.json(parsed);
  } catch (err: any) {
    console.error('[node-builder/shader-params]', err);
    if (charged) await refundQuietly(req.userId!, 'node-builder/shader-params');
    const unavailable = String(err?.message || '').startsWith('cheaptext_unavailable');
    res.status(unavailable ? 503 : 500).json({
      error: unavailable
        ? 'Nenhum provedor de IA disponível. Seu crédito foi estornado.'
        : 'Failed to select shader params',
    });
  }
});

// POST /api/node-builder/save  (optional persistence)
router.post('/save', authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  const { definition, isPublic = false } = req.body as {
    definition: CustomNodeDefinition;
    isPublic?: boolean;
  };

  if (!definition?.id) return res.status(400).json({ error: 'definition.id required' });

  try {
    await (prisma as any).customNodeDefinition.upsert({
      where: { id: definition.id },
      create: {
        id: definition.id,
        userId: req.userId,
        name: definition.name,
        description: definition.description,
        iconName: definition.iconName,
        behaviorConfig: definition.behaviorConfig as object,
        inputs: definition.inputs as object,
        isPublic,
      },
      update: { isPublic },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[node-builder/save]', err);
    res.status(500).json({ error: 'Failed to save' });
  }
});

export default router;

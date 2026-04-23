import express, { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { validateAdmin } from '../middleware/adminAuth.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { chatWithLLM } from '../services/llmRouter.js';
import { knowledgeService } from '../services/knowledgeService.js';
import { buildBrandContextCached } from '../lib/brandContextBuilder.js';
import { parseUrl } from '../lib/brand-parse.js';
import { getDb, connectToMongoDB } from '../db/mongodb.js';
import { prisma } from '../db/prisma.js';
import { getGeminiApiKey } from '../utils/geminiApiKey.js';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';
import { getChatTools, executeChatTool } from '../services/chat/toolRegistry.js';
import { redisClient } from '../lib/redis.js';
import { CacheKey, CACHE_TTL } from '../lib/cache-utils.js';
import WebSocket, { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../utils/jwtSecret.js';
import { env } from '../config/env.js';
import { formatGeminiHistory } from '../lib/chat/history.js';
import { resolveRagScope } from '../lib/chat/ragScope.js';
import { withRetry } from '../lib/chat/executor.js';
import { pluginBridgeEvents } from '../lib/pluginBridge.js';
import type { ChatMessage as SharedChatMessage, ToolCallRecord as SharedToolCallRecord } from '../../shared/types/chat.js';

const router = express.Router();

// When the Figma plugin connects and drains its queue, notify the originating
// AdminChat session so the user sees real-time feedback without polling.
pluginBridgeEvents.on('drain:complete', ({ fileId, batches, appliedCount }: {
  fileId: string;
  batches: Array<{ chatSessionId?: string; meta?: any }>;
  appliedCount: number;
}) => {
  const sessionIds = [...new Set(batches.map(b => b.chatSessionId).filter(Boolean))] as string[];
  for (const sid of sessionIds) {
    broadcastToSession(sid, {
      type: 'FIGMA_OPS_APPLIED',
      payload: {
        fileId,
        appliedCount,
        figmaUrl: `https://www.figma.com/file/${fileId}`,
        message: `${appliedCount} operações aplicadas no Figma.`,
      },
    });
  }
});

pluginBridgeEvents.on('drain:failed', ({ fileId, batches, error }: {
  fileId: string;
  batches?: Array<{ chatSessionId?: string }>;
  error: string;
}) => {
  const sessionIds = [...new Set((batches || []).map(b => b.chatSessionId).filter(Boolean))] as string[];
  for (const sid of sessionIds) {
    broadcastToSession(sid, {
      type: 'FIGMA_OPS_FAILED',
      payload: { fileId, error },
    });
  }
});

// ── Types ──────────────────────────────────────────────────────────────────

interface SessionMemory {
  brands: string[];
  clients: string[];
  decisions: string[];
  references: string[];
}

interface SessionAttachment {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'url' | 'text';
  ingestedAt: string;
}

interface PendingBrandKnowledgeApproval {
  id: string;
  sessionId: string;
  brandGuidelineId: string;
  title: string;
  content: string;
  reason?: string;
  requestedByUserId: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  resolvedByUserId?: string;
  resolvedAt?: string;
}

type ToolCallRecord = SharedToolCallRecord;
type ChatMessage = SharedChatMessage;

interface AdminChatSession {
  _id: string;
  userId: string;              // legacy — kept for back-compat
  ownerId?: string;            // owner (new — falls back to userId if absent)
  isShared?: boolean;
  sharedWithUserIds?: string[]; // team members com acesso
  title: string;
  brandGuidelineId?: string;
  memory: SessionMemory;
  attachments: SessionAttachment[];
  messages: ChatMessage[];
  pendingApprovals?: PendingBrandKnowledgeApproval[];
  createdAt: Date;
  updatedAt: Date;
}

function sessionOwnerId(s: AdminChatSession): string {
  return s.ownerId || s.userId;
}

function canAccessSession(s: AdminChatSession, userId: string): boolean {
  if (sessionOwnerId(s) === userId) return true;
  if (s.isShared && s.sharedWithUserIds?.includes(userId)) return true;
  return false;
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function stripAction(reply: string | undefined | null): string {
  if (!reply) return '';
  return reply.replace(/\[ACTION:\s*\w+\s+\{[\s\S]*?\}\]/g, '').trim();
}

function buildSystemPrompt(
  memory: SessionMemory,
  brandContext: string,
  ragContext: string
): string {
  const memoryStr = [
    memory.brands.length ? `Marcas: ${memory.brands.join(', ')}` : '',
    memory.clients.length ? `Clientes: ${memory.clients.join(', ')}` : '',
    memory.decisions.length ? `Decisões: ${memory.decisions.join('; ')}` : '',
    memory.references.length ? `Referências: ${memory.references.join(', ')}` : '',
  ].filter(Boolean).join('\n') || 'Nenhuma memória acumulada ainda.';

  return `Você é o assistente estratégico de uma agência de branding e design.
Especialidades: posicionamento, naming, tom de voz, paletas visuais, referências criativas, mockups, estratégia de marca.
Seja direto, estratégico e minimalista. Responda no idioma do usuário. Jamais use emojis.

MEMÓRIA DA SESSÃO:
${memoryStr}

${brandContext ? `CONTEXTO DE MARCA:\n${brandContext}\n` : ''}
${ragContext ? `DOCUMENTOS INGERIDOS (use como base):\n${ragContext}\n` : ''}

FERRAMENTAS DISPONÍVEIS:
- Use "propose_creative_plan" ANTES de gerar mockups sempre que o pedido for aberto ou ambíguo (sem produto/formato/quantidade definidos, ou primeira intenção criativa da sessão). Proponha N variações (título + prompt rascunho + aspect ratio) e faça perguntas de clareza como "Usar a logo da marca?", "Formato preferido (quadrado, story, banner)?", "Referência de estilo?". Aguarde a resposta do usuário antes de gerar.
  Exceções — gere direto sem propor plano: (a) usuário explicitamente aprovou um plano, (b) usuário usou "gera", "faz aí", "pode fazer" de forma direta com produto/formato claros, (c) pedido é regenerar/atualizar mockup existente.

- Use "generate_or_update_mockup" quando o pedido for específico ou após aprovação de plano.
  Inclua na chamada: prompt descritivo, brandGuidelineId (se disponível), modelo (${GEMINI_MODELS.IMAGE_FLASH}, ${GEMINI_MODELS.IMAGE_NB2}, ou ${GEMINI_MODELS.IMAGE_PRO}), resolução (1K/2K/4K — só se usar NB2 ou PRO), aspect ratio.
  IMPORTANTE: quando o usuário pedir N mockups, N variações ou N opções (ex: "3 mockups", "mais 2 variações"), emita N chamadas da ferramenta em PARALELO na MESMA resposta — uma por variação, cada uma com seu próprio prompt distinto. Não descreva opções em texto e gere só uma; gere todas de uma vez.
  LOGO DA MARCA: a logo é injetada automaticamente como imagem de referência quando a sessão está vinculada a uma marca. NÃO descreva a aparência do logo no prompt (ex: "o logo é uma letra Q verde..."). Apenas diga "apply the brand logo" ou similar — o sistema cuida do resto.
  TEXTO: use sempre "textMode: layers" por padrão (texto via layers editáveis, imagem sem tipografia renderizada). Use "textMode: image" apenas se o usuário pedir explicitamente textos/slogans na imagem gerada. Use "textMode: both" apenas se o usuário explicitamente quiser os dois. Nunca use "both" como padrão.
- Use "save_to_brand_knowledge" em DOIS casos (só quando há marca vinculada — a escrita exige aprovação manual do usuário, você apenas propõe):
  1) Quando o usuário explicitamente quiser guardar algo (insight, decisão, referência).
  2) PROATIVAMENTE quando, dentro de um pedido operacional (ex: "quero um squeeze, ecobag e caneca, minimalista, logo original, conceito 'sedimentum' — terra, solo, de forma sofisticada"), o usuário embute sinais de identidade de marca que ainda não estão registrados: conceito/manifesto, keywords estéticas (minimalista, sofisticado, brutalista, orgânico...), moodboard sensorial (terra, solo, papel cru, concreto...), regras de uso (manter logo original, evitar cores X), arquétipo, tom, posicionamento. Nesse caso, emita a chamada EM PARALELO com "generate_or_update_mockup" na MESMA resposta — gere o mockup E proponha salvar os parâmetros ao mesmo tempo, sem pedir permissão no texto (a aprovação já é capturada pela UI).
  Formato do content proposto: markdown estruturado com seções curtas. Use cabeçalhos quando fizer sentido, ex:
    \`\`\`
    **Conceito:** sedimentum — terra, solo, sedimentação, tempo geológico.
    **Keywords estéticas:** minimalista, sofisticado, orgânico.
    **Moodboard sensorial:** paletas terrosas, texturas de solo, materialidade natural.
    **Regras de uso:** manter o logo original sem redesenho.
    \`\`\`
  Title: curto e descritivo (ex: "Direção estética: sedimentum"). Reason: 1 frase justificando ("extraído do briefing de mockups"). NÃO duplique informação já presente no CONTEXTO DE MARCA acima.

- Use "update_session_memory" sempre que detectar na conversa: nome de marca nova, cliente novo, decisão estratégica tomada, ou referência visual/cultural relevante. Chame em paralelo com outras ferramentas — nunca bloqueie o fluxo por isso.
- Use "generate_in_figma" quando o usuário pedir explicitamente para criar no Figma, exportar para o Figma, ou adicionar um frame no Figma. Requer marca vinculada com arquivo Figma. Se o plugin estiver fechado, as operações são enfileiradas e aplicadas automaticamente ao abrir — informe o usuário disso com naturalidade.

- Use "brand_guideline_create" quando o usuário quiser criar uma nova marca, iniciar um brand guideline, ou registrar uma nova identidade de marca. Requer apenas o nome. Retorne o ID criado — pode ser vinculado à sessão.

- Use "brand_guideline_update" para atualizar qualquer seção do brand guideline ativo da sessão (ou ID explícito). Envie apenas os campos que mudaram — os demais são preservados. Sub-campos de strategy (archetypes, personas, voiceValues, positioning, manifesto) são independentes. Quando usar: usuário define cores (hex obrigatório), tipografia, manifesto, posicionamento, arquétipos, personas, valores de voz, tokens, dos/donts, imagery, tom de voz. Chame em paralelo com generate_or_update_mockup quando o usuário definir marca E pedir geração simultaneamente.

Quando apropriado, use as ferramentas para entregar resultados práticos além da análise textual.`;

}

async function getSession(sessionId: string, userId: string): Promise<AdminChatSession | null> {
  const cacheKey = CacheKey.adminChatSession(sessionId);

  // 1. Redis first (graceful degradation)
  const cached = await redisClient.get(cacheKey).catch(() => null);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as AdminChatSession;
      if (canAccessSession(parsed, userId)) return parsed;
    } catch { }
  }

  // 2. Mongo fallback — busca por id E verifica acesso (owner OR shared)
  await connectToMongoDB();
  const db = getDb();
  const doc = (await db.collection<AdminChatSession>('admin_chat_sessions').findOne({
    _id: sessionId as any,
    $or: [
      { ownerId: userId },
      { userId: userId },
      { $and: [{ isShared: true }, { sharedWithUserIds: userId }] },
    ],
  })) as AdminChatSession | null;

  if (!doc) return null;

  // 3. Warm cache fire-and-forget
  redisClient
    .setex(cacheKey, CACHE_TTL.ADMIN_CHAT_SESSION, JSON.stringify(doc))
    .catch(() => { });

  return doc;
}

async function saveSession(session: AdminChatSession): Promise<void> {
  await connectToMongoDB();
  const db = getDb();
  const normalized: AdminChatSession = {
    ...session,
    ownerId: sessionOwnerId(session),
    updatedAt: new Date(),
  };
  await db.collection('admin_chat_sessions').replaceOne(
    { _id: session._id as any },
    normalized,
    { upsert: true }
  );
  // Invalidate cache
  await redisClient.del(CacheKey.adminChatSession(session._id)).catch(() => { });
}

// ── Tool execution ─────────────────────────────────────────────────────────

/**
 * Execute all tool calls in parallel, collect results, apply session mutations.
 * Returns the final reply text + accumulated side-effects.
 */
async function executeToolCalls(
  rawReply: string,
  toolCalls: Array<{ name: string; args: any }>,
  session: AdminChatSession,
  userId: string,
  authHeader: string,
): Promise<{
  reply: string;
  creativeProjects: any[];
  toolsUsed: string[];
  toolCallRecords: ToolCallRecord[];
}> {
  if (!toolCalls.length) {
    return { reply: stripAction(rawReply), creativeProjects: [], toolsUsed: [], toolCallRecords: [] };
  }

  console.log(`[AdminChat] Executing ${toolCalls.length} tool(s) in parallel`);

  // Pre-allocate records so we can broadcast start events before awaiting
  const records: ToolCallRecord[] = toolCalls.map(call => ({
    id: uuidv4(),
    name: call.name,
    status: 'running' as const,
    args: call.args,
    startedAt: new Date().toISOString(),
    retries: 0,
  }));

  // Broadcast all starts immediately
  for (const record of records) {
    broadcastToSession(session._id, {
      type: 'TOOL_CALL_START',
      payload: { toolCallId: record.id, name: record.name, args: record.args, startedAt: record.startedAt },
    });
  }

  // Execute all in parallel
  const results = await Promise.allSettled(
    toolCalls.map((call, i) =>
      withRetry(
        () => executeChatTool(call.name, call.args, { userId, sessionId: session._id, authHeader, brandGuidelineId: session.brandGuidelineId }),
        call.name,
      ).then(r => ({ index: i, result: r }))
    )
  );

  const creativeProjects: any[] = [];
  const toolsUsed: string[] = [];

  for (const settled of results) {
    if (settled.status === 'rejected') {
      const i = (settled.reason as any)?._index ?? results.indexOf(settled);
      const record = records[i] ?? records[results.indexOf(settled)];
      if (record) {
        record.status = 'error';
        record.endedAt = new Date().toISOString();
        record.errorMessage = settled.reason?.message || 'Tool execution failed';
        broadcastToSession(session._id, {
          type: 'TOOL_CALL_END',
          payload: { toolCallId: record.id, status: 'error', endedAt: record.endedAt, errorMessage: record.errorMessage },
        });
      }
      continue;
    }

    const { index, result: toolResult } = settled.value;
    const record = records[index];
    const call = toolCalls[index];

    if (call.name === 'propose_creative_plan' && toolResult.success) {
      broadcastToSession(session._id, {
        type: 'CREATIVE_PLAN_PROPOSED',
        payload: { id: record.id, ...toolResult.plan },
      });
      record.summary = 'Plano criativo proposto';
    }

    if (call.name === 'generate_or_update_mockup' && toolResult.success) {
      creativeProjects.push({
        creativeProjectId: toolResult.creativeProjectId,
        imageUrl: toolResult.imageUrl,
        editUrl: toolResult.editUrl,
        prompt: toolResult.prompt,
        creditsDeducted: toolResult.creditsDeducted,
        creditsRemaining: toolResult.creditsRemaining,
      });
      record.summary = 'Mockup gerado';
    }

    if (call.name === 'generate_in_figma') {
      if (toolResult.queued) {
        record.summary = `Enfileirado para o Figma (${toolResult.queueSize} pendente(s))`;
        broadcastToSession(session._id, { type: 'FIGMA_OPS_QUEUED', payload: { figmaUrl: toolResult.figmaUrl, queueSize: toolResult.queueSize, message: 'Será aplicado quando o plugin Visant abrir no Figma.' } });
      } else if (toolResult.success) {
        record.summary = `Criativo criado no Figma (${toolResult.appliedCount} ops)`;
        broadcastToSession(session._id, { type: 'FIGMA_OPS_APPLIED', payload: { figmaUrl: toolResult.figmaUrl, appliedCount: toolResult.appliedCount, message: `${toolResult.appliedCount} operações aplicadas no Figma.` } });
      } else {
        record.summary = `Figma: ${toolResult.error || 'falha'}`;
      }
    }

    if (call.name === 'update_session_memory' && toolResult.memoryPatch) {
      const patch = toolResult.memoryPatch;
      const push = (arr: string[], items: string[]) => {
        for (const item of items) {
          if (!arr.includes(item)) arr.push(item);
        }
      };
      push(session.memory.brands, patch.brands ?? []);
      push(session.memory.clients, patch.clients ?? []);
      push(session.memory.decisions, patch.decisions ?? []);
      push(session.memory.references, patch.references ?? []);
      record.summary = 'Memória atualizada';
    }

    if (call.name === 'save_to_brand_knowledge' && toolResult.pendingApproval) {
      if (!session.brandGuidelineId) {
        record.summary = 'Sem marca vinculada — não salvo';
      } else {
        const pending: PendingBrandKnowledgeApproval = {
          id: uuidv4(),
          sessionId: session._id,
          brandGuidelineId: session.brandGuidelineId,
          title: toolResult.pendingApproval.title,
          content: toolResult.pendingApproval.content,
          reason: toolResult.pendingApproval.reason,
          requestedByUserId: userId,
          requestedAt: new Date().toISOString(),
          status: 'pending',
        };
        session.pendingApprovals = [...(session.pendingApprovals || []), pending];
        record.summary = 'Aguardando aprovação';
        broadcastToSession(session._id, { type: 'APPROVAL_REQUIRED', payload: pending });
      }
    }

    toolsUsed.push(call.name);
    record.status = 'done';
    record.endedAt = new Date().toISOString();
    broadcastToSession(session._id, {
      type: 'TOOL_CALL_END',
      payload: { toolCallId: record.id, status: 'done', endedAt: record.endedAt, summary: record.summary },
    });
  }

  return {
    reply: stripAction(rawReply),
    creativeProjects,
    toolsUsed,
    toolCallRecords: records,
  };
}

// ── Routes ─────────────────────────────────────────────────────────────────

// POST /api/admin-chat/sessions — criar sessão
router.post('/sessions', validateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { brandGuidelineId, isShared, sharedWithUserIds } = req.body;
    const session: AdminChatSession = {
      _id: uuidv4(),
      userId: req.userId!,
      ownerId: req.userId!,
      isShared: !!isShared,
      sharedWithUserIds: Array.isArray(sharedWithUserIds) ? sharedWithUserIds : [],
      title: 'Nova sessão',
      brandGuidelineId,
      memory: { brands: [], clients: [], decisions: [], references: [] },
      attachments: [],
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await saveSession(session);
    res.status(201).json({ session });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin-chat/sessions — listar sessões (owned + shared com o user)
router.get('/sessions', validateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    const sessions = await db
      .collection('admin_chat_sessions')
      .find({
        $or: [
          { ownerId: req.userId },
          { userId: req.userId }, // legacy
          { $and: [{ isShared: true }, { sharedWithUserIds: req.userId }] },
        ],
      })
      .sort({ updatedAt: -1 })
      .project({ messages: 0 }) // sem histórico na listagem
      .toArray();
    res.json({ sessions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin-chat/sessions/:id/share — atualiza share state (owner only)
router.post('/sessions/:id/share', validateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const session = await getSession(req.params.id, req.userId!);
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });
    if (sessionOwnerId(session) !== req.userId!) {
      return res.status(403).json({ error: 'Apenas o dono pode alterar o compartilhamento' });
    }
    const { isShared, sharedWithUserIds } = req.body;
    session.isShared = !!isShared;
    if (Array.isArray(sharedWithUserIds)) {
      session.sharedWithUserIds = sharedWithUserIds.filter((x: any) => typeof x === 'string');
    }
    await saveSession(session);
    res.json({ session });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin-chat/sessions/:id — buscar sessão completa
router.get('/sessions/:id', validateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const session = await getSession(req.params.id, req.userId!);
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });
    res.json({ session });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin-chat/sessions/:id — deletar sessão (owner only)
router.delete('/sessions/:id', validateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const session = await getSession(req.params.id, req.userId!);
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });
    if (sessionOwnerId(session) !== req.userId!) {
      return res.status(403).json({ error: 'Apenas o dono pode deletar a sessão' });
    }
    await connectToMongoDB();
    const db = getDb();
    await db.collection('admin_chat_sessions').deleteOne({ _id: req.params.id as any });
    await redisClient.del(CacheKey.adminChatSession(req.params.id)).catch(() => { });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin-chat/sessions/:id/brand — travar marca contexto da sessão
// Contrato: cada sessão = uma marca. Permite setar quando vazia, bloqueia
// troca depois de travada (idempotente para o mesmo valor). Isso elimina a
// divergência dropdown ↔ DB que fazia o logo/RAG vazarem entre sessões.
router.patch('/sessions/:id/brand', validateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const session = await getSession(req.params.id, req.userId!);
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });
    if (sessionOwnerId(session) !== req.userId!) {
      return res.status(403).json({ error: 'Apenas o dono pode alterar a marca da sessão' });
    }
    const nextBrandId: string | undefined = req.body?.brandGuidelineId || undefined;
    const current = session.brandGuidelineId || undefined;
    if (current && nextBrandId && current !== nextBrandId) {
      return res.status(409).json({ error: 'Marca desta sessão já está travada. Crie uma nova sessão para outra marca.' });
    }
    if (current === nextBrandId) {
      return res.json({ session });
    }
    const next: AdminChatSession = { ...session, brandGuidelineId: nextBrandId };
    await saveSession(next);
    res.json({ session: next });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin-chat/sessions/:id/upload — ingerir documento na sessão
router.post('/sessions/:id/upload', validateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const session = await getSession(req.params.id, req.userId!);
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });

    const { source, url, data, filename } = req.body;

    // Reusa parsers existentes de brand-parse.ts
    let parts: any[];
    switch (source) {
      case 'pdf': {
        if (!data) return res.status(400).json({ error: 'PDF data required' });
        // Passa PDF como inlineData para o knowledgeService (Pinecone multimodal)
        parts = [{ inlineData: { mimeType: 'application/pdf', data: data.replace(/^data:application\/pdf;base64,/, '') } }];
        break;
      }
      case 'image': {
        if (!data) return res.status(400).json({ error: 'Image data required' });
        const mimeType = data.match(/^data:([^;]+)/)?.[1] || 'image/png';
        parts = [{ inlineData: { mimeType, data: data.replace(/^data:[^;]+;base64,/, '') } }];
        break;
      }
      case 'url': {
        if (!url) return res.status(400).json({ error: 'URL required' });
        const chunks = await parseUrl(url);
        parts = [{ text: chunks.map(c => c.text).join('\n\n') }];
        break;
      }
      case 'text': {
        if (!data) return res.status(400).json({ error: 'Text data required' });
        parts = [{ text: typeof data === 'string' ? data : JSON.stringify(data) }];
        break;
      }
      default:
        return res.status(400).json({ error: `Source inválido: ${source}` });
    }

    // Resolve RAG scope — brand universe (shared across sessions of same brand) vs session silo.
    const { ragUserId, ragProjectId, guideline: brandForKnowledge } = await resolveRagScope(
      session,
      req.userId!
    );

    const displayName = filename || url || source;
    const ingestResult: any = await knowledgeService.ingestContent({
      userId: ragUserId,
      projectId: ragProjectId,
      parts,
      metadata: {
        fileName: displayName,
        source: source as any,
        brandGuidelineId: session.brandGuidelineId,
        ingestedByUserId: req.userId!,
      },
    });

    // Collect vector IDs (single or chunked PDF) for future deletion
    const vectorIds: string[] = ingestResult?.ids ?? (ingestResult?.id ? [ingestResult.id] : []);

    // If brand-scoped: record the file in the brand's knowledgeFiles so BrandGuidelinesPage can list/delete.
    if (brandForKnowledge) {
      const existing: any[] = Array.isArray(brandForKnowledge.knowledgeFiles) ? brandForKnowledge.knowledgeFiles : [];
      const entry = {
        id: uuidv4(),
        fileName: displayName,
        source,
        vectorIds,
        addedByUserId: req.userId!,
        addedAt: new Date().toISOString(),
      };
      await prisma.brandGuideline.update({
        where: { id: brandForKnowledge.id },
        data: { knowledgeFiles: [...existing, entry] as any },
      });
    }

    const attachment: SessionAttachment = {
      id: uuidv4(),
      name: displayName,
      type: source as any,
      ingestedAt: new Date().toISOString(),
    };

    session.attachments.push(attachment);

    if (session.title === 'Nova sessão' && attachment.name) {
      session.title = `Sessão: ${attachment.name.slice(0, 40)}`;
    }

    await saveSession(session);
    res.json({ attachment, sessionId: session._id });
  } catch (err: any) {
    console.error('[AdminChat] Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin-chat/sessions/:id/message — enviar mensagem
router.post('/sessions/:id/message', validateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const session = await getSession(req.params.id, req.userId!);
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });

    const { message, planMode, textMode } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    const userApiKey = await getGeminiApiKey(req.userId!).catch(() => undefined);
    const userPrefs = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { llmProvider: true, ollamaUrl: true, ollamaModel: true } as any,
    }).catch(() => null) as any;

    // 1. Brand context + resolve RAG scope (brand universe when linked, else session silo)
    let brandContext = '';
    const { ragUserId, ragProjectId, guideline } = await resolveRagScope(session, req.userId!);
    if (guideline) {
      brandContext = await buildBrandContextCached(guideline as any);
    }

    // 2. RAG: query the resolved universe (brand-scoped when available)
    let ragContext = '';
    if (session.attachments.length > 0 || session.brandGuidelineId) {
      try {
        ragContext = await knowledgeService.getContext(message, ragUserId, ragProjectId);
      } catch {
        // sem Pinecone ou sem hits — continua sem RAG
      }
    }

    // 3. System prompt de agência composto
    const systemInstruction = buildSystemPrompt(session.memory, brandContext, ragContext)
      + (planMode ? '\n\nMODO PLANO ATIVO: O usuário ativou o modo plano explicitamente. Use "propose_creative_plan" OBRIGATORIAMENTE para qualquer pedido criativo nesta mensagem — não gere imagens diretamente.' : '');

    // 4. Histórico no formato Gemini (últimas 20 msgs)
    const geminiHistory = formatGeminiHistory(session.messages);

    // 5. Chat via llmRouter
    const { text: rawReply, toolCalls } = await chatWithLLM(
      message,
      '',
      geminiHistory,
      {
        provider: (userPrefs?.llmProvider as any) || env.DEFAULT_LLM_PROVIDER || 'gemini',
        ollamaUrl: userPrefs?.ollamaUrl,
        ollamaModel: userPrefs?.ollamaModel,
        apiKey: userApiKey,
        model: GEMINI_MODELS.TEXT,
        systemInstruction,
        tools: getChatTools(true),
      }
    );

    // 6. Execute tool calls in parallel
    // Propagate request-level textMode into every generate_or_update_mockup call
    const resolvedToolCalls = (toolCalls || []).map(tc =>
      tc.name === 'generate_or_update_mockup' && textMode
        ? { ...tc, args: { ...tc.args, textMode } }
        : tc
    );
    const { reply: rawExecutedReply, creativeProjects, toolsUsed, toolCallRecords } =
      await executeToolCalls(rawReply, resolvedToolCalls, session, req.userId!, req.headers.authorization || '');
    // Fallback reply when agent only proposed a plan (no text output)
    const reply = rawExecutedReply.trim() || (toolsUsed.includes('propose_creative_plan') ? 'Plano criativo pronto — revise as variações propostas.' : rawExecutedReply);

    // 7. Smart title on first message (fire-and-forget, non-blocking)
    if (session.messages.length === 0) {
      chatWithLLM(
        `Resuma em no máximo 5 palavras, sem pontuação: "${message.slice(0, 300)}"`,
        '',
        [],
        { provider: 'gemini', apiKey: userApiKey, model: GEMINI_MODELS.TEXT }
      )
        .then(r => {
          const title = r.text.trim().replace(/['"]/g, '').slice(0, 60);
          session.title = title || message.slice(0, 60);
          saveSession(session).catch(() => {});
          broadcastToSession(session._id, { type: 'SESSION_TITLE_UPDATED', payload: { title: session.title } });
        })
        .catch(() => { session.title = message.slice(0, 60); });
    }

    // 8. Gerar ID único pra feedback
    const generationId = uuidv4();
    const now = new Date().toISOString();

    // 9. Broadcast ANTES de salvar (UX imediata)
    broadcastToSession(session._id, {
      type: 'MESSAGE',
      payload: { role: 'user', content: message, timestamp: now, by: req.userId },
    });
    broadcastToSession(session._id, {
      type: 'MESSAGE',
      payload: {
        role: 'assistant',
        content: reply,
        timestamp: now,
        creativeProjects: creativeProjects.length > 0 ? creativeProjects : undefined,
        toolCalls: toolCallRecords.length > 0 ? toolCallRecords : undefined,
        generationId,
      },
    });

    // 10. Persistir mensagens (em paralelo com a resposta HTTP)
    session.messages.push({ role: 'user', content: message, timestamp: now });
    session.messages.push({
      role: 'assistant',
      content: reply,
      timestamp: now,
      creativeProjects: creativeProjects.length > 0 ? creativeProjects : undefined,
      toolCalls: toolCallRecords.length > 0 ? toolCallRecords : undefined,
      generationId,
    });

    res.json({
      reply,
      sessionId: session._id,
      generationId,
      toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
      toolCalls: toolCallRecords.length > 0 ? toolCallRecords : undefined,
      creativeProjects: creativeProjects.length > 0 ? creativeProjects : undefined,
    });

    // Save after responding so the client isn't blocked by DB latency
    await saveSession(session);
  } catch (err: any) {
    console.error('[AdminChat] Message error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin-chat/sessions/:id/message/stream — SSE streaming
router.post('/sessions/:id/message/stream', validateAdmin, async (req: AuthRequest, res: Response) => {
  const session = await getSession(req.params.id, req.userId!).catch(() => null);
  if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });

  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    send('thinking', { message: 'Processando...' });

    const userApiKey = await getGeminiApiKey(req.userId!).catch(() => undefined);
    const userPrefs = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { llmProvider: true, ollamaUrl: true, ollamaModel: true } as any,
    }).catch(() => null) as any;

    const { ragUserId, ragProjectId, guideline } = await resolveRagScope(session, req.userId!);
    let brandContext = '';
    if (guideline) brandContext = await buildBrandContextCached(guideline as any);

    let ragContext = '';
    if (session.attachments.length > 0 || session.brandGuidelineId) {
      ragContext = await knowledgeService.getContext(message, ragUserId, ragProjectId).catch(() => '');
    }

    const systemInstruction = buildSystemPrompt(session.memory, brandContext, ragContext);
    const geminiHistory = formatGeminiHistory(session.messages);

    send('thinking', { message: 'Gerando resposta...' });

    const { text: rawReply, toolCalls } = await chatWithLLM(message, '', geminiHistory, {
      provider: (userPrefs?.llmProvider as any) || env.DEFAULT_LLM_PROVIDER || 'gemini',
      ollamaUrl: userPrefs?.ollamaUrl,
      ollamaModel: userPrefs?.ollamaModel,
      apiKey: userApiKey,
      model: GEMINI_MODELS.TEXT,
      systemInstruction,
      tools: getChatTools(true),
    });

    // Notify client of each tool as it starts
    if (toolCalls?.length) {
      for (const call of toolCalls) {
        send('tool_start', { name: call.name });
      }
    }

    const { reply, creativeProjects, toolsUsed, toolCallRecords } =
      await executeToolCalls(rawReply, toolCalls || [], session, req.userId!, req.headers.authorization || '');

    if (session.messages.length === 0) {
      chatWithLLM(
        `Resuma em no máximo 5 palavras, sem pontuação: "${message.slice(0, 300)}"`,
        '',
        [],
        { provider: 'gemini', apiKey: userApiKey, model: GEMINI_MODELS.TEXT }
      )
        .then(r => {
          session.title = r.text.trim().replace(/['"]/g, '').slice(0, 60) || message.slice(0, 60);
          saveSession(session).catch(() => {});
          broadcastToSession(session._id, { type: 'SESSION_TITLE_UPDATED', payload: { title: session.title } });
        })
        .catch(() => { session.title = message.slice(0, 60); });
    }

    const generationId = uuidv4();
    const now = new Date().toISOString();

    broadcastToSession(session._id, { type: 'MESSAGE', payload: { role: 'user', content: message, timestamp: now, by: req.userId } });
    broadcastToSession(session._id, { type: 'MESSAGE', payload: { role: 'assistant', content: reply, timestamp: now, creativeProjects: creativeProjects.length > 0 ? creativeProjects : undefined, toolCalls: toolCallRecords.length > 0 ? toolCallRecords : undefined, generationId } });

    send('done', {
      reply,
      sessionId: session._id,
      generationId,
      toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
      toolCalls: toolCallRecords.length > 0 ? toolCallRecords : undefined,
      creativeProjects: creativeProjects.length > 0 ? creativeProjects : undefined,
    });

    res.end();

    session.messages.push({ role: 'user', content: message, timestamp: now });
    session.messages.push({ role: 'assistant', content: reply, timestamp: now, creativeProjects: creativeProjects.length > 0 ? creativeProjects : undefined, toolCalls: toolCallRecords.length > 0 ? toolCallRecords : undefined, generationId });
    await saveSession(session);
  } catch (err: any) {
    console.error('[AdminChat] Stream error:', err);
    send('error', { message: err.message });
    res.end();
  }
});

// POST /api/admin-chat/sessions/:id/pendings/:pendingId/approve — approve brand knowledge write
router.post('/sessions/:id/pendings/:pendingId/approve', validateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const session = await getSession(req.params.id, req.userId!);
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });

    const pending = (session.pendingApprovals || []).find(p => p.id === req.params.pendingId);
    if (!pending) return res.status(404).json({ error: 'Pending approval não encontrado' });
    if (pending.status !== 'pending') return res.status(400).json({ error: 'Já resolvido' });

    const brand = await prisma.brandGuideline.findFirst({
      where: { id: pending.brandGuidelineId },
      select: { id: true, userId: true, knowledgeFiles: true },
    }) as any;
    if (!brand) return res.status(404).json({ error: 'Brand guideline não encontrada' });

    // Ingest into brand RAG universe (owner-keyed)
    const ingestResult: any = await knowledgeService.ingestContent({
      userId: brand.userId,
      projectId: brand.id,
      parts: [{ text: `# ${pending.title}\n\n${pending.content}` }],
      metadata: {
        fileName: pending.title,
        source: 'text',
        brandGuidelineId: brand.id,
        ingestedByUserId: req.userId!,
      },
    });
    const vectorIds: string[] = ingestResult?.ids ?? (ingestResult?.id ? [ingestResult.id] : []);

    // Record in brand knowledgeFiles
    const existing: any[] = Array.isArray(brand.knowledgeFiles) ? brand.knowledgeFiles : [];
    const entry = {
      id: uuidv4(),
      fileName: pending.title,
      source: 'text' as const,
      vectorIds,
      addedByUserId: req.userId!,
      addedAt: new Date().toISOString(),
    };
    await prisma.brandGuideline.update({
      where: { id: brand.id },
      data: { knowledgeFiles: [...existing, entry] as any },
    });

    pending.status = 'approved';
    pending.resolvedByUserId = req.userId!;
    pending.resolvedAt = new Date().toISOString();
    session.pendingApprovals = (session.pendingApprovals || []).map(p => p.id === pending.id ? pending : p);

    await saveSession(session);

    broadcastToSession(session._id, {
      type: 'APPROVAL_RESOLVED',
      payload: { pendingId: pending.id, status: 'approved', resolvedByUserId: req.userId!, resolvedAt: pending.resolvedAt, knowledgeFileId: entry.id },
    });

    res.json({ success: true, pending, knowledgeFile: entry });
  } catch (err: any) {
    console.error('[AdminChat] Approve error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin-chat/sessions/:id/pendings/:pendingId/reject — reject brand knowledge write
router.post('/sessions/:id/pendings/:pendingId/reject', validateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const session = await getSession(req.params.id, req.userId!);
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });

    const pending = (session.pendingApprovals || []).find(p => p.id === req.params.pendingId);
    if (!pending) return res.status(404).json({ error: 'Pending approval não encontrado' });
    if (pending.status !== 'pending') return res.status(400).json({ error: 'Já resolvido' });

    pending.status = 'rejected';
    pending.resolvedByUserId = req.userId!;
    pending.resolvedAt = new Date().toISOString();
    session.pendingApprovals = (session.pendingApprovals || []).map(p => p.id === pending.id ? pending : p);

    await saveSession(session);

    broadcastToSession(session._id, {
      type: 'APPROVAL_RESOLVED',
      payload: { pendingId: pending.id, status: 'rejected', resolvedByUserId: req.userId!, resolvedAt: pending.resolvedAt },
    });

    res.json({ success: true, pending });
  } catch (err: any) {
    console.error('[AdminChat] Reject error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── WebSocket (team real-time) ─────────────────────────────────────────────
//
// Pattern copiado de plugin.ts → initPluginWebSocket (usa `ws` lib).
// Auth: ws://host/api/admin-chat/ws?token=JWT&sessionId=ID

let wss: WebSocketServer | null = null;
const sessionRooms = new Map<string, Set<WebSocket>>();

function joinRoom(sessionId: string, ws: WebSocket) {
  if (!sessionRooms.has(sessionId)) sessionRooms.set(sessionId, new Set());
  sessionRooms.get(sessionId)!.add(ws);
}

function leaveRoom(sessionId: string, ws: WebSocket) {
  const room = sessionRooms.get(sessionId);
  if (!room) return;
  room.delete(ws);
  if (room.size === 0) sessionRooms.delete(sessionId);
}

/**
 * Broadcast an event to every connected client of a session.
 * Fire-and-forget: no await, no throw.
 */
export function broadcastToSession(sessionId: string, event: any) {
  const room = sessionRooms.get(sessionId);
  if (!room) return;
  const payload = JSON.stringify(event);
  for (const ws of room) {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(payload); } catch { }
    }
  }
}

/** Call once from server/index.ts after httpServer is created. */
export function initAdminChatWebSocket(server: any) {
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req: any, socket: any, head: any) => {
    if (req.url?.startsWith('/api/admin-chat/ws')) {
      wss!.handleUpgrade(req, socket, head, (ws: any) => {
        handleChatConnection(ws, req);
      });
    }
  });

  console.log('[AdminChatWS] WebSocket server initialized');
}

async function handleChatConnection(ws: WebSocket, req: any) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  const sessionId = url.searchParams.get('sessionId');

  if (!token || !sessionId) {
    ws.close(4001, 'Missing token or sessionId');
    return;
  }

  // Verify JWT (reuso do middleware auth pattern)
  let userId: string | null = null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    userId = decoded.userId;
  } catch {
    ws.close(4001, 'Invalid token');
    return;
  }

  // Verify session access (owner OR shared)
  const session = await getSession(sessionId, userId!).catch(() => null);
  if (!session) {
    ws.close(4003, 'Session access denied');
    return;
  }

  joinRoom(sessionId, ws);
  console.log(`[AdminChatWS] Connected: sessionId=${sessionId}, userId=${userId}`);

  ws.send(JSON.stringify({ type: 'READY', sessionId }));

  ws.on('close', () => {
    leaveRoom(sessionId, ws);
    console.log(`[AdminChatWS] Disconnected: sessionId=${sessionId}, userId=${userId}`);
  });

  ws.on('error', (err: any) => {
    console.error(`[AdminChatWS] Error (sessionId=${sessionId}):`, err.message);
    leaveRoom(sessionId, ws);
  });
}

export default router;

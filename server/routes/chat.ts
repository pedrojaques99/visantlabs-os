import express, { Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { rateLimit } from 'express-rate-limit';
import { chatWithLLM } from '../services/llmRouter.js';
import { env } from '../config/env.js';
import { sanitizeForPrompt } from '../utils/promptSanitize.js';
import { knowledgeService } from '../services/knowledgeService.js';
import { buildBrandContextCached } from '../lib/brandContextBuilder.js';
import { getDb, connectToMongoDB } from '../db/mongodb.js';
import { prisma } from '../db/prisma.js';
import { getGeminiApiKey } from '../utils/geminiApiKey.js';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';
import { chargeCredits } from '../lib/credits.js';
import { getChatMessageCreditsRequired } from '../../src/utils/creditCalculator.js';
import { getChatTools, executeChatTool } from '../services/chat/toolRegistry.js';
import { formatGeminiHistory } from '../lib/chat/history.js';
import { resolveRagScope } from '../lib/chat/ragScope.js';
import type { ChatMessage as SharedChatMessage } from '../../shared/types/chat.js';

const router = express.Router();

// Rate limiter: 20 messages per hour
const chatRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Max 20 messages per hour
  message: { error: 'Limite de mensagens atingido. Tente novamente em uma hora.' },
});

// Rate limiter for the Canvas Chat Node: more generous than the session chat
// above, since the canvas is an interactive multi-node surface.
const canvasChatRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 60,
  message: { error: 'Limite de mensagens do canvas atingido. Tente novamente em uma hora.' },
});

// ── Types ──────────────────────────────────────────────────────────────────

type ChatMessage = SharedChatMessage;

interface ChatSession {
  _id: string;
  userId: string;
  title: string;
  brandGuidelineId?: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildSystemPrompt(ragContext: string, brandContext: string): string {
  return `Você é um assistente especialista em branding da Visant Labs, seguindo a Metodologia Visant.
Seja direto, estratégico e conciso. Responda no idioma do usuário. Jamais use emojis.

REPERTÓRIO METODOLÓGICO (use para auditar e gerar com profundidade):
- Mensagem Central = Produto + Diferencial + Elo Emocional (frase técnica interna, não é slogan).
- 3 Pilares = valores que, se violados, a marca deixa de ser ela mesma.
- Pesquisa de Mercado: mapear o que concorrentes fazem bem, mal, e o que ninguém faz.
- Persona: foco em dores e desejos ocultos, não demografia.
- Arquétipos: mix primário + secundário. "Se essa marca fosse uma pessoa numa mesa de bar?"
- Manifesto: Provocação → Tensão → Promessa. Frase final vira candidata a slogan.
- Cascata: cada etapa alimenta a próxima. Pular etapas enfraquece a marca.

${brandContext ? `CONTEXTO DE MARCA:\n${sanitizeForPrompt(brandContext, 10000)}\n` : ''}
${ragContext ? `DOCUMENTOS INGERIDOS:\n${sanitizeForPrompt(ragContext, 10000)}\n` : ''}
FERRAMENTAS DISPONÍVEIS:
- suggest_mockup_ideas: Analisa brand guideline + cruza com biblioteca curada de referências world-class → sugere mockups certeiros para a marca. Use SEMPRE que o usuário pedir ideias de mockup ou material visual.
- search_reference_library: Busca referências visuais curadas por dimensões (nicho, estética, vibe, iluminação, textura, etc). Use para embasar sugestões com exemplos reais.
- generate_mockup: Gera mockup com contexto de marca (logo, cores, tipografia auto-injetados). Brand context e referências curadas são injetados automaticamente.
- get_brand_context: Consulta brand guideline completo ou seções específicas.`;
}

async function getSession(sessionId: string, userId: string): Promise<ChatSession | null> {
  await connectToMongoDB();
  const db = getDb();
  return db.collection<ChatSession>('chat_sessions').findOne({
    _id: sessionId as any,
    userId,
  }) as Promise<ChatSession | null>;
}

async function saveSession(session: ChatSession): Promise<void> {
  await connectToMongoDB();
  const db = getDb();
  await db
    .collection('chat_sessions')
    .replaceOne(
      { _id: session._id as any },
      { ...session, updatedAt: new Date() },
      { upsert: true }
    );
}

// ── Routes ─────────────────────────────────────────────────────────────────

// POST /api/chat/sessions — criar sessão
router.post('/sessions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { title, brandGuidelineId } = req.body;

    // Validar que o brand guideline pertence ao usuário
    if (brandGuidelineId) {
      const guideline = await prisma.brandGuideline.findFirst({
        where: { id: brandGuidelineId, userId: req.userId! },
      });
      if (!guideline) {
        return res
          .status(403)
          .json({ error: 'Brand guideline não encontrado ou não pertence a você' });
      }
    }

    const session: ChatSession = {
      _id: uuidv4(),
      userId: req.userId!,
      title: title || 'Nova sessão',
      brandGuidelineId,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await saveSession(session);
    res.status(201).json({ session });
  } catch (err: any) {
    console.error('[Chat] Session creation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/sessions — listar sessões do usuário
router.get('/sessions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    const sessions = await db
      .collection('chat_sessions')
      .find({ userId: req.userId })
      .sort({ updatedAt: -1 })
      .project({ messages: 0 })
      .toArray();
    res.json({ sessions });
  } catch (err: any) {
    console.error('[Chat] List sessions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/sessions/:id — buscar sessão completa
router.get('/sessions/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const session = await getSession(req.params.id, req.userId!);
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });
    res.json({ session });
  } catch (err: any) {
    console.error('[Chat] Get session error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/chat/sessions/:id — renomear sessão
router.patch('/sessions/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { title } = req.body;
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'title is required and must be a string' });
    }

    const session = await getSession(req.params.id, req.userId!);
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });

    session.title = title.slice(0, 200); // Max 200 chars
    await saveSession(session);

    res.json({ success: true, session });
  } catch (err: any) {
    console.error('[Chat] Rename session error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/chat/sessions/:id — deletar sessão
router.delete('/sessions/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    const result = await db.collection('chat_sessions').deleteOne({
      _id: req.params.id as any,
      userId: req.userId,
    });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Sessão não encontrada ou não pertence a você' });
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Chat] Delete session error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat/sessions/:id/upload — ingerir documento
router.post('/sessions/:id/upload', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const session = await getSession(req.params.id, req.userId!);
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });

    const { parts, metadata } = req.body;
    if (!parts || !Array.isArray(parts)) {
      return res.status(400).json({ error: 'Parts array is required' });
    }

    await knowledgeService.ingestContent({
      userId: req.userId!,
      projectId: session._id,
      parts,
      metadata: metadata || {},
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('[Chat] Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat/sessions/:id/message — enviar mensagem com tool use loop
router.post(
  '/sessions/:id/message',
  authenticate,
  chatRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const session = await getSession(req.params.id, req.userId!);
      if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });

      const { message } = req.body;
      if (!message) return res.status(400).json({ error: 'message required' });

      const userApiKey = await getGeminiApiKey(req.userId!).catch(() => undefined);

      // 1. RAG: busca contexto relevante
      let ragContext = '';
      try {
        ragContext = await knowledgeService.getContext(message, req.userId!, session._id);
      } catch {
        // sem Pinecone ou sem hits — continua sem RAG
      }

      // 2. Brand context se vinculado (user-facing: enforce ownership)
      let brandContext = '';
      const { guideline } = await resolveRagScope(session, req.userId!, {
        enforceOwnerId: req.userId!,
      });
      if (guideline) {
        brandContext = await buildBrandContextCached(guideline as any);
      }

      // 3. System prompt
      let systemInstruction = buildSystemPrompt(ragContext, brandContext);

      // 4. Histórico no formato Gemini
      const geminiHistory = formatGeminiHistory(session.messages);

      // 5. Charge credits (1 credit every 4 user messages)
      const userMsgCount = session.messages.filter((m: any) => m.role === 'user').length + 1;
      const creditsNeeded = getChatMessageCreditsRequired(userMsgCount);
      if (creditsNeeded > 0) {
        await chargeCredits(req.userId!, creditsNeeded);
      }

      // 6. First call: Chat with tools
      let { text: reply, toolCalls } = await chatWithLLM(message, '', geminiHistory, {
        apiKey: userApiKey,
        model: GEMINI_MODELS.TEXT,
        systemInstruction,
        tools: getChatTools(true),
        provider: env.DEFAULT_LLM_PROVIDER || 'gemini',
      });

      // 6. Tool use loop: if LLM called tools, execute and re-prompt
      const toolsUsed: string[] = [];
      if (toolCalls && toolCalls.length > 0) {
        console.log(`[Chat] Tool calls detected:`, toolCalls.map((t) => t.name).join(', '));

        const toolResults: string[] = [];
        for (const toolCall of toolCalls) {
          try {
            const raw = await executeChatTool(toolCall.name, toolCall.args, {
              userId: req.userId!,
              sessionId: session._id,
            });
            const result = typeof raw === 'string' ? raw : JSON.stringify(raw);
            toolResults.push(`[${toolCall.name}]\n${result}`);
            toolsUsed.push(toolCall.name);
          } catch (e: any) {
            console.error(`[Chat] Tool execution error for ${toolCall.name}:`, e);
            toolResults.push(`[${toolCall.name}]\nError: ${e.message}`);
          }
        }

        // Inject tool results into system prompt and make second call
        const toolContext = toolResults.join('\n\n');
        const systemWithTools = `${systemInstruction}\n\nTOOL RESULTS:\n${toolContext}`;

        const { text: finalReply } = await chatWithLLM(message, '', geminiHistory, {
          apiKey: userApiKey,
          model: GEMINI_MODELS.TEXT,
          systemInstruction: systemWithTools,
          provider: env.DEFAULT_LLM_PROVIDER || 'gemini',
        });

        reply = finalReply;
      }

      // 7. Gerar título da sessão na primeira mensagem
      if (session.messages.length === 0) {
        session.title = message.slice(0, 60);
      }

      // 8. Persistir mensagens
      const now = new Date().toISOString();
      const generationId = uuidv4();
      session.messages.push({ role: 'user', content: message, timestamp: now });
      session.messages.push({ role: 'assistant', content: reply, timestamp: now, generationId });

      await saveSession(session);

      res.json({
        reply,
        sessionId: session._id,
        toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
        generationId,
      });
    } catch (err: any) {
      console.error('[Chat] Message error:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/chat/canvas-generate — stateless proxy for the Canvas Chat Node.
//
// The browser builds the Gemini `contents` array (including image processing,
// strategy/text context and the system prompt) and POSTs it here. The server
// holds the API key and makes the actual Gemini call, so the browser never
// connects to generativelanguage.googleapis.com — which the page CSP blocks.
router.post(
  '/canvas-generate',
  authenticate,
  canvasChatRateLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const { contents } = req.body as { contents?: unknown };

      if (!Array.isArray(contents) || contents.length === 0) {
        return res.status(400).json({ error: 'contents must be a non-empty array' });
      }

      const apiKey = await getGeminiApiKey(req.userId!).catch(() => undefined);
      if (!apiKey) {
        return res.status(503).json({ error: 'AI provider not configured' });
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: GEMINI_MODELS.TEXT,
        contents: contents as any,
        // No responseModalities = text only (mirrors previous client behaviour).
      });

      const text = response.text?.trim() ?? '';
      if (!text) {
        return res.status(502).json({ error: 'No text response generated' });
      }

      res.json({ text });
    } catch (err: any) {
      console.error('[Chat] Canvas generate error:', err);
      res.status(500).json({ error: err.message || 'Failed to generate response' });
    }
  }
);

export default router;

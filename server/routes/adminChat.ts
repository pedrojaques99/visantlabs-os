import express, { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { validateAdmin } from '../middleware/adminAuth.js';
import { AuthRequest } from '../middleware/auth.js';
import { chatWithAIContext } from '../services/geminiService.js';
import { knowledgeService } from '../services/knowledgeService.js';
import { buildBrandContextCached, buildBrandContextJSON } from '../lib/brandContextBuilder.js';
import { parsePdf, parseUrl, parseImage } from '../lib/brand-parse.js';
import { getDb, connectToMongoDB } from '../db/mongodb.js';
import { prisma } from '../db/prisma.js';
import { getGeminiApiKey } from '../utils/geminiApiKey.js';
import { generateMockupIdeas, generateMarketResearch } from '../services/brandingService.js';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';

const router = express.Router();

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

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  action?: string;
  actionResult?: any;
}

interface AdminChatSession {
  _id: string;
  userId: string;
  title: string;
  brandGuidelineId?: string;
  memory: SessionMemory;
  attachments: SessionAttachment[];
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function detectAction(reply: string): { type: string; params: any } | null {
  const match = reply.match(/\[ACTION:\s*(\w+)\s+(\{[\s\S]*?\})\]/);
  if (!match) return null;
  try {
    return { type: match[1], params: JSON.parse(match[2]) };
  } catch {
    return null;
  }
}

function stripAction(reply: string): string {
  return reply.replace(/\[ACTION:\s*\w+\s+\{[\s\S]*?\}\]/g, '').trim();
}

async function executeAction(
  action: { type: string; params: any },
  session: AdminChatSession,
  userId: string,
  userApiKey?: string
): Promise<any> {
  switch (action.type) {
    case 'generate_image': {
      const { result } = await generateMockupIdeas(
        action.params.prompt || '',
        { prompt: action.params.prompt } as any,
        []
      );
      return { type: 'mockup_ideas', ideas: result };
    }
    case 'branding_step': {
      const step = action.params.step || 1;
      const { result } = await generateMarketResearch(action.params.prompt || '', []);
      return { type: 'branding_step', step, result };
    }
    case 'export_brand_context': {
      if (!session.brandGuidelineId) return null;
      const guideline = await prisma.brandGuideline.findFirst({
        where: { id: session.brandGuidelineId, userId },
      });
      if (!guideline) return null;
      return { type: 'brand_context', context: buildBrandContextJSON(guideline as any) };
    }
    default:
      return null;
  }
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
Quando o usuário pedir geração de imagem, ideias de mockup ou step de branding, inclua EXATAMENTE ao final da resposta:
[ACTION: generate_image {"prompt": "descreva aqui"}]
[ACTION: branding_step {"step": 1, "prompt": "descreva aqui"}]
[ACTION: export_brand_context {}]
Inclua apenas um ACTION por resposta e apenas quando for claramente solicitado.`;
}

function toGeminiHistory(messages: ChatMessage[]) {
  return messages.slice(-20).map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));
}

async function getSession(sessionId: string, userId: string): Promise<AdminChatSession | null> {
  await connectToMongoDB();
  const db = getDb();
  return db.collection<AdminChatSession>('admin_chat_sessions').findOne({
    _id: sessionId as any,
    userId,
  }) as Promise<AdminChatSession | null>;
}

async function saveSession(session: AdminChatSession): Promise<void> {
  await connectToMongoDB();
  const db = getDb();
  await db.collection('admin_chat_sessions').replaceOne(
    { _id: session._id as any },
    { ...session, updatedAt: new Date() },
    { upsert: true }
  );
}

// ── Routes ─────────────────────────────────────────────────────────────────

// POST /api/admin-chat/sessions — criar sessão
router.post('/sessions', validateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { brandGuidelineId } = req.body;
    const session: AdminChatSession = {
      _id: uuidv4(),
      userId: req.userId!,
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

// GET /api/admin-chat/sessions — listar sessões
router.get('/sessions', validateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    const sessions = await db
      .collection('admin_chat_sessions')
      .find({ userId: req.userId })
      .sort({ updatedAt: -1 })
      .project({ messages: 0 }) // sem histórico na listagem
      .toArray();
    res.json({ sessions });
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

// DELETE /api/admin-chat/sessions/:id — deletar sessão
router.delete('/sessions/:id', validateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    await db.collection('admin_chat_sessions').deleteOne({
      _id: req.params.id as any,
      userId: req.userId,
    });
    res.json({ success: true });
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

    // Reutiliza knowledgeService.ingestContent — indexa no Pinecone isolado por sessionId
    await knowledgeService.ingestContent({
      userId: req.userId!,
      projectId: session._id, // isola por sessão
      parts,
      metadata: {
        fileName: filename || url || source,
        source: source as any,
      },
    });

    const attachment: SessionAttachment = {
      id: uuidv4(),
      name: filename || url || source,
      type: source as any,
      ingestedAt: new Date().toISOString(),
    };

    session.attachments.push(attachment);

    // Gera título automático se primeira mensagem
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

    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    const userApiKey = await getGeminiApiKey(req.userId!).catch(() => undefined);

    // 1. RAG: busca contexto relevante nos documentos ingeridos na sessão
    let ragContext = '';
    if (session.attachments.length > 0) {
      try {
        ragContext = await knowledgeService.getContext(message, req.userId!, session._id);
      } catch {
        // sem Pinecone ou sem hits — continua sem RAG
      }
    }

    // 2. Brand context se vinculado
    let brandContext = '';
    if (session.brandGuidelineId) {
      const guideline = await prisma.brandGuideline.findFirst({
        where: { id: session.brandGuidelineId, userId: req.userId! },
      });
      if (guideline) {
        brandContext = await buildBrandContextCached(guideline as any);
      }
    }

    // 3. System prompt de agência composto
    const systemInstruction = buildSystemPrompt(session.memory, brandContext, ragContext);

    // 4. Histórico no formato Gemini (últimas 20 msgs)
    const geminiHistory = toGeminiHistory(session.messages);

    // 5. Chat via geminiService
    const { text: rawReply } = await chatWithAIContext(
      message,
      '', // context vai no systemInstruction
      geminiHistory,
      { apiKey: userApiKey, model: GEMINI_MODELS.TEXT, systemInstruction }
    );

    // 6. Detectar e executar action
    const action = detectAction(rawReply);
    const reply = stripAction(rawReply);
    let actionResult: any = undefined;
    if (action) {
      try {
        actionResult = await executeAction(action, session, req.userId!, userApiKey);
      } catch (e: any) {
        console.error('[AdminChat] Action error:', e.message);
      }
    }

    // 7. Gerar título da sessão na primeira mensagem
    if (session.messages.length === 0) {
      session.title = message.slice(0, 60);
    }

    // 8. Persistir mensagens
    const now = new Date().toISOString();
    session.messages.push({ role: 'user', content: message, timestamp: now });
    session.messages.push({
      role: 'assistant',
      content: reply,
      timestamp: now,
      action: action?.type,
      actionResult,
    });

    await saveSession(session);

    res.json({ reply, action: action?.type, actionResult, sessionId: session._id });
  } catch (err: any) {
    console.error('[AdminChat] Message error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

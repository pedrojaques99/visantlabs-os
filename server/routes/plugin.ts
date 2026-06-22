import express, { Request, Response, NextFunction } from 'express';
import { OPENAI_IMAGE_MODELS } from '../../src/constants/openaiModels.js';
import { chooseProvider } from '../lib/ai-providers/router.js';
import { getDb, connectToMongoDB } from '../db/mongodb.js';
import { prisma } from '../db/prisma.js';
import { pluginBridge } from '../lib/pluginBridge.js';
import { pluginQueue } from '../lib/pluginQueue.js';
import { operationValidator } from '../lib/operationValidator.js';
import path from 'path';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { getUserIdFromToken } from '../utils/auth.js';
import { isSafeId, ensureString } from '../utils/validation.js';
import { sanitizeForPrompt, sanitizePromptArray } from '../utils/promptSanitize.js';
import { rateLimit } from 'express-rate-limit';
import { redisClient } from '../lib/redis.js';
import { FRONTEND_BASE_URL } from '../lib/mcp-constants.js';
import { CACHE_TTL, CacheKey, hashObject } from '../lib/cache-utils.js';
import {
  buildSystemPrompt,
  buildRetryFeedback,
  refineIntentWithLLM,
  type PluginRequest,
  type DesignSystemJSON,
  type AssembledPrompt,
} from '../lib/figmaAgentPrompt.js';
import { quickTextCall } from '../services/geminiService.js';
import { extractExportFields } from '../lib/prompt/classifier.js';
import { chargeCredits, FREE_GENERATIONS_LIMIT } from '../lib/credits.js';

// ── Session error feedback (in-memory, auto-expires) ──
const sessionErrors = new Map<string, { errors: string[]; ts: number }>();
const SESSION_ERROR_TTL = 5 * 60 * 1000; // 5 min

function getSessionErrors(sessionId?: string): string[] {
  if (!sessionId) return [];
  const entry = sessionErrors.get(sessionId);
  if (!entry || Date.now() - entry.ts > SESSION_ERROR_TTL) {
    sessionErrors.delete(sessionId);
    return [];
  }
  return entry.errors;
}

function pushSessionErrors(sessionId: string | undefined, errors: string[]) {
  if (!sessionId || !errors.length) return;
  const existing = getSessionErrors(sessionId);
  sessionErrors.set(sessionId, {
    errors: [...existing, ...errors].slice(-10),
    ts: Date.now(),
  });
}

// Rate limiter for agent commands (strict - 20 req/min)
const agentCommandLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many agent commands. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for image analysis (expensive AI calls - 10 req/min)
const imageAnalysisLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many image analysis requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Input validation constants
const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

/**
 * Validate image input for security
 */
function validateImageInput(image: any): { valid: boolean; error?: string } {
  if (!image?.base64) {
    return { valid: false, error: 'Image base64 required' };
  }

  // Check base64 size (rough estimate: base64 is ~33% larger than binary)
  const estimatedSize = (image.base64.length * 3) / 4;
  if (estimatedSize > MAX_IMAGE_SIZE_BYTES) {
    return { valid: false, error: `Image too large. Max ${MAX_IMAGE_SIZE_MB}MB` };
  }

  // Validate mime type
  const mimeType = image.mimeType || 'image/png';
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: `Invalid image type. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
    };
  }

  // Basic base64 format validation
  if (!/^[A-Za-z0-9+/=]+$/.test(image.base64.replace(/\s/g, ''))) {
    return { valid: false, error: 'Invalid base64 encoding' };
  }

  return { valid: true };
}
import { ObjectId } from 'mongodb';
import WebSocket, { WebSocketServer } from 'ws';
import type { BrandGuideline } from '../types/brandGuideline.js';
import { buildBrandContext, buildEnforcedPrompt } from '../lib/brandContextBuilder.js';
import { buildTokenRegistry } from '../lib/tokenRegistry.js';
import { validateOperations, formatCorrections } from '../lib/tokenValidator.js';
import { resolveBrandGuideline, buildGuidelineChoiceContext } from '../lib/brandResolver.js';
import { scanTemplates, buildTemplateContext } from '../lib/templateScanner.js';
import { scanAgentComponents, buildComponentsContext } from '../lib/componentScanner.js';
import { resolveContext, buildAgentContextPrompt } from '../lib/contextResolver.js';
import { chatWithLLM } from '../services/llmRouter.js';
import { getChatTools, executeChatTool } from '../services/chat/toolRegistry.js';

const router = express.Router();

// ============ WebSocket Server (will be initialized in server/index.ts) ============

let wss: WebSocketServer | null = null;

/**
 * Initialize WebSocket server (call once from server/index.ts)
 */
export function initPluginWebSocket(server: any) {
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req: any, socket: any, head: any) => {
    if (req.url?.startsWith('/api/plugin/ws')) {
      wss!.handleUpgrade(req, socket, head, (ws: any) => {
        handlePluginConnection(ws, req);
      });
    }
  });

  console.log('[PluginWS] WebSocket server initialized');
}

/**
 * Handle plugin WebSocket connection
 */
function handlePluginConnection(ws: WebSocket, req: any) {
  // Extract auth from query: ws://host/api/plugin/ws?token=XXX&fileId=YYY
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  const fileId = url.searchParams.get('fileId');

  // Validate auth
  const userId = validatePluginToken(token);
  if (!userId || !fileId) {
    ws.close(4001, 'Unauthorized');
    console.warn('[PluginWS] Connection rejected: invalid token or fileId');
    return;
  }

  // Register session
  const session = pluginBridge.register(fileId, ws, userId);
  console.log(`[PluginWS] Connected: fileId=${fileId}, userId=${userId}`);

  // Handle messages from plugin
  ws.on('message', (data: any) => {
    try {
      const message = JSON.parse(data.toString());
      handlePluginMessage(fileId, message);
    } catch (err) {
      console.error('[PluginWS] Invalid JSON from plugin:', err);
      ws.send(
        JSON.stringify({
          type: 'ERROR',
          error: 'Invalid JSON',
        })
      );
    }
  });

  // Handle disconnect
  ws.on('close', () => {
    pluginBridge.unregister(fileId);
    console.log(`[PluginWS] Disconnected: fileId=${fileId}`);
  });

  // Handle errors
  ws.on('error', (err: any) => {
    console.error(`[PluginWS] Error (fileId=${fileId}):`, err.message);
    pluginBridge.unregister(fileId);
  });

  // Send init message
  ws.send(
    JSON.stringify({
      type: 'PLUGIN_READY',
      fileId,
    })
  );
}

/**
 * Handle messages from plugin (ACKs, selection changes, etc.)
 */
function handlePluginMessage(fileId: string, message: any) {
  const { type } = message;

  switch (type) {
    case 'OPERATION_ACK':
    case 'OPERATION_ERROR':
      // Forward to pluginBridge for ACK tracking
      pluginBridge.onMessage(fileId, message);
      break;

    case 'SELECTION_CHANGED':
      // User selection changed
      pluginBridge.onMessage(fileId, message);
      break;

    default:
      console.warn(`[PluginWS] Unknown message type: ${type}`);
  }
}

/**
 * Validate plugin token — reuses centralized JWT verification from utils/auth.ts
 */
function validatePluginToken(token: string | null): string | null {
  return getUserIdFromToken(token);
}

/**
 * Optional auth middleware — populates userId if valid token, but doesn't block.
 * Allows BYOK users without accounts to still use the plugin.
 */
function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.body?.authToken;
  const userId = getUserIdFromToken(token);
  if (userId) {
    req.userId = userId;
    // Note: email is not extracted by getUserIdFromToken for minimal token validation
  }
  next();
}

/**
 * Check if user can generate (reuses same logic as /payments/usage)
 */
async function checkCredits(
  userId: string
): Promise<{ canGenerate: boolean; reason?: string; isByok?: boolean }> {
  try {
    await connectToMongoDB();
    const db = getDb();
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) return { canGenerate: false, reason: 'Usuário não encontrado' };

    const hasActiveSubscription = user.subscriptionStatus === 'active';
    const freeGenerationsUsed = user.freeGenerationsUsed || 0;
    const monthlyCredits = user.monthlyCredits || 20;
    const creditsUsed = user.creditsUsed || 0;
    const creditsRemaining = Math.max(0, monthlyCredits - creditsUsed);
    const totalCreditsEarned = user.totalCreditsEarned ?? 0;
    const totalCredits = totalCreditsEarned + creditsRemaining;

    const canGenerate = hasActiveSubscription
      ? totalCredits > 0
      : freeGenerationsUsed < FREE_GENERATIONS_LIMIT && totalCredits > 0;

    if (!canGenerate) {
      return {
        canGenerate: false,
        reason: hasActiveSubscription
          ? 'Créditos esgotados. Aguarde a renovação ou compre mais.'
          : `Limite gratuito atingido (${FREE_GENERATIONS_LIMIT} gerações). Assine para continuar.`,
      };
    }
    return { canGenerate: true };
  } catch (_e) {
    // If credit check fails, allow (fail-open for BYOK users)
    return { canGenerate: true };
  }
}

async function deductCredit(userId: string): Promise<void> {
  try {
    await chargeCredits(userId, 1);
  } catch (_e) {
    console.error('[Plugin] Failed to deduct credit:', _e);
  }
}

// Types and prompt builder imported from ../lib/figmaAgentPrompt.js

// ============ NEW: Agent Command Endpoint ============

/**
 * POST /api/plugin/agent-command
 * Called by MCP server or external agents to push operations to plugin
 * SECURITY: Requires authentication + rate limiting (CRIT-001 fix)
 */
router.post(
  '/agent-command',
  agentCommandLimiter,
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { fileId, operations } = req.body;
      const userId = req.userId;

      // Log for audit trail
      console.log(
        `[Plugin Agent] User ${userId} sending ${
          operations?.length || 0
        } operations to file ${fileId}`
      );

      // Validate input
      if (!fileId) {
        return res.status(400).json({ error: 'Missing fileId' });
      }

      if (!Array.isArray(operations) || operations.length === 0) {
        return res.status(400).json({ error: 'Missing or empty operations array' });
      }

      // Validate operations
      const validation = operationValidator.validateBatch(operations);

      if (validation.invalid.length > 0) {
        return res.status(400).json({
          error: 'Operation validation failed',
          invalid: validation.invalid.map((inv) => ({
            type: inv.op.type,
            errors: inv.errors,
          })),
        });
      }

      // Deliver. If a live WS session exists (local dev), push directly.
      // Otherwise enqueue to Redis — the plugin drains it via GET /pending
      // (HTTP ops channel). See docs/PLUGIN_OPS_CHANNEL.md.
      if (pluginBridge.isConnected(fileId)) {
        const result = await pluginBridge.push(fileId, validation.valid);
        if (result.success) {
          return res.json({ success: true, appliedCount: result.appliedCount, delivery: 'ws' });
        }
        // fall through to enqueue if the live push failed
      }

      const batch = {
        id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        operations: validation.valid,
        enqueuedAt: new Date().toISOString(),
        userId: userId || 'system',
      };
      await pluginQueue.enqueue(fileId, batch);
      const pending = await pluginQueue.size(fileId);
      res.json({ success: true, queued: true, batchId: batch.id, pending, delivery: 'queue' });
    } catch (err) {
      console.error('[Plugin Agent] Error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/plugin/pending?fileId=...
 * HTTP ops channel: the plugin long-polls this to drain queued operation batches.
 * Peeks the Redis queue every ~1s for up to ~25s; returns as soon as batches exist.
 * Does NOT clear — the plugin removes applied batches via POST /ack (at-least-once).
 */
const PENDING_WAIT_MS = parseInt(process.env.PLUGIN_PENDING_WAIT_MS || '25000');
const PENDING_STEP_MS = 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

router.get('/pending', authenticate, async (req: AuthRequest, res: Response) => {
  const fileId = req.query.fileId as string;
  if (!fileId) return res.status(400).json({ error: 'fileId is required' });

  const deadline = Date.now() + PENDING_WAIT_MS;
  try {
    do {
      const batches = await pluginQueue.peek(fileId);
      if (batches.length > 0) return res.json({ batches });
      if (res.writableEnded || req.destroyed) return; // client hung up
      await sleep(PENDING_STEP_MS);
    } while (Date.now() < deadline);
    return res.json({ batches: [] });
  } catch (err) {
    console.error('[Plugin pending] Error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'pending failed' });
  }
});

/**
 * POST /api/plugin/ack  { fileId, appliedIds: string[] }
 * Remove batches the plugin applied. Un-acked batches stay queued and are
 * re-delivered on the next /pending poll (automatic retry).
 */
router.post('/ack', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { fileId, appliedIds } = req.body as { fileId?: string; appliedIds?: string[] };
    if (!fileId) return res.status(400).json({ error: 'fileId is required' });
    const removed = await pluginQueue.removeByIds(fileId, appliedIds || []);
    return res.json({ ok: true, removed, pending: await pluginQueue.size(fileId) });
  } catch (err) {
    console.error('[Plugin ack] Error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'ack failed' });
  }
});

// ============ Debug Endpoint (Secured) ============

/**
 * GET /api/plugin/debug/sessions
 * Returns active plugin sessions
 * HIGH-001 fix: Requires explicit flag + authentication
 */
router.get('/debug/sessions', authenticate, async (req: AuthRequest, res: Response) => {
  // Require explicit opt-in via environment variable
  const debugEnabled = process.env.ENABLE_DEBUG_ENDPOINTS === 'true';

  if (!debugEnabled) {
    return res.status(403).json({ error: 'Debug endpoints disabled' });
  }

  // Verify user is admin
  try {
    const db = await connectToMongoDB();
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.userId) });

    if (!user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const sessions = pluginBridge.getSessions();
    // Sanitize session data - remove sensitive info
    const sanitizedSessions = sessions.map((s: any) => ({
      fileId: s.fileId,
      connectedAt: s.connectedAt,
      // Don't expose userId or other PII
    }));

    res.json({ sessions: sanitizedSessions, count: sessions.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify access' });
  }
});

/**
 * GET /api/plugin/session/:id/messages
 * Restore chat history for a plugin session (used on plugin reopen)
 */
router.get(
  '/session/:id/messages',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false }),
  optionalAuth,
  async (req: AuthRequest, res: Response) => {
    const sessionId = req.params.id;
    if (!sessionId || !isSafeId(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    try {
      const db = getDb();
      const session = await db.collection<any>('plugin_sessions').findOne({ _id: sessionId });
      if (!session) return res.json({ messages: [], sessionContext: null });

      const msgs = session.messages || [];
      const totalChars = msgs.reduce((sum: number, m: any) => sum + (m.content?.length || 0), 0);
      res.json({
        messages: msgs.slice(-50).map((m: any) => ({
          id: m.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp ? new Date(m.timestamp).getTime() : Date.now(),
          operations: m.operations,
          toolCalls: m.toolCalls,
        })),
        sessionContext: {
          messageCount: msgs.length,
          tokenEstimate: Math.ceil(totalChars / 4),
          contextLimit: 80_000,
        },
      });
    } catch (err) {
      console.error('[Plugin] Session restore error:', err);
      res.status(500).json({ error: 'Failed to restore session' });
    }
  }
);

// ============ Documentation Route ============

/**
 * GET /api/plugin/docs
 * Redirect to new documentation system at /api/docs/plugin
 */
router.get('/docs', (req: Request, res: Response) => {
  res.redirect(307, '/api/docs/plugin');
});

/**
 * DEPRECATED: Old documentation route
 * Removed in favor of /api/docs/plugin
 */
// ============ Existing HTTP Polling Endpoint ============

/**
 * Get agent context for a Figma file
 * GET /api/plugin/context
 */
router.get('/context', optionalAuth, async (req: AuthRequest, res: Response) => {
  const fileId = req.query.fileId as string;
  const brandGuidelineId = req.query.brandGuidelineId as string | undefined;
  const userId = req.userId || '';

  if (!fileId) {
    return res.status(400).json({ error: 'fileId is required' });
  }

  try {
    const context = await resolveContext(fileId, userId, brandGuidelineId);
    const agentPrompt = buildAgentContextPrompt(context);

    res.json({
      strategy: context.strategy,
      componentsCount: context.components.length,
      templatesCount: context.templates.length,
      hasBrand: !!context.brand,
      agentPrompt, // The context string to inject into system prompt
    });
  } catch (error) {
    console.error('[Plugin] Context resolution failed:', error);
    res.status(500).json({ error: 'Failed to resolve context' });
  }
});

/**
 * Scaffold agent component library with brand colors
 * POST /api/plugin/scaffold-library
 */
router.post('/scaffold-library', optionalAuth, async (req: AuthRequest, res: Response) => {
  const { fileId, brandGuidelineId } = req.body;
  const userId = req.userId || '';

  if (!fileId) {
    return res.status(400).json({ error: 'fileId is required' });
  }

  try {
    // Get brand guideline
    let brand = {
      name: 'Default',
      primary: { r: 0.05, g: 0.6, b: 1 }, // #0D99FF
      background: { r: 1, g: 1, b: 1 },
      text: { r: 0.1, g: 0.1, b: 0.1 },
      fontFamily: 'Inter',
    };

    if (brandGuidelineId) {
      const guideline = await prisma.brandGuideline.findUnique({
        where: { id: brandGuidelineId },
      });

      if (guideline) {
        const identity = guideline.identity as any;
        const colors = guideline.colors as any[];
        const typography = guideline.typography as any[];

        brand.name = identity?.name || 'Brand';

        // Find primary color
        const primaryColor = colors?.find(
          (c) => c.role === 'primary' || c.name?.toLowerCase().includes('primary')
        );
        if (primaryColor?.hex) {
          const hex = primaryColor.hex.replace('#', '');
          brand.primary = {
            r: parseInt(hex.slice(0, 2), 16) / 255,
            g: parseInt(hex.slice(2, 4), 16) / 255,
            b: parseInt(hex.slice(4, 6), 16) / 255,
          };
        }

        // Find background color
        const bgColor = colors?.find(
          (c) => c.role === 'background' || c.name?.toLowerCase().includes('background')
        );
        if (bgColor?.hex) {
          const hex = bgColor.hex.replace('#', '');
          brand.background = {
            r: parseInt(hex.slice(0, 2), 16) / 255,
            g: parseInt(hex.slice(2, 4), 16) / 255,
            b: parseInt(hex.slice(4, 6), 16) / 255,
          };
        }

        // Find text color
        const textColor = colors?.find(
          (c) => c.role === 'text' || c.name?.toLowerCase().includes('text')
        );
        if (textColor?.hex) {
          const hex = textColor.hex.replace('#', '');
          brand.text = {
            r: parseInt(hex.slice(0, 2), 16) / 255,
            g: parseInt(hex.slice(2, 4), 16) / 255,
            b: parseInt(hex.slice(4, 6), 16) / 255,
          };
        }

        // Find primary font
        const primaryFont = typography?.find((t) => t.role === 'heading' || t.role === 'primary');
        if (primaryFont?.family) {
          brand.fontFamily = primaryFont.family;
        }
      }
    }

    // Send scaffold command to plugin
    const result = await pluginBridge.request(fileId, {
      type: 'SCAFFOLD_AGENT_LIBRARY',
      brand,
    });

    res.json({
      success: true,
      message: `Component library created with ${brand.name} brand`,
      result,
    });
  } catch (error) {
    console.error('[Plugin] Scaffold failed:', error);
    res.status(500).json({ error: 'Failed to scaffold library' });
  }
});

// ============ SSE Streaming Endpoint with Tool Pre-Pass ============

const streamLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: { error: 'Too many streaming requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/plugin/stream
 * SSE endpoint: tool pre-pass → generate operations → stream events
 * Events: thinking, tool_start, tool_end, operations, message, done, error
 */
router.post('/stream', streamLimiter, optionalAuth, async (req: AuthRequest, res: Response) => {
  const streamStartMs = Date.now();
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const {
      command,
      sessionId,
      fileId,
      selectedElements = [],
      selectedLogo,
      brandLogos,
      selectedBrandFont,
      brandFonts,
      selectedBrandColors,
      availableComponents = [],
      availableColorVariables = [],
      availableFontVariables = [],
      availableLayers = [],
      apiKey: userApiKey,
      anthropicApiKey: userAnthropicKey,
      attachments = [],
      mentions = [],
      designSystem,
      brandGuideline: brandGuidelineFromUI,
      brandGuidelineId,
      thinkMode = false,
      useBrand = true,
      generateImage = false,
      scanPage = false,
    } = req.body as PluginRequest;

    if (!command) {
      send('error', { message: 'Command is required' });
      return res.end();
    }

    send('thinking', { message: 'Processando...' });

    // Credit check
    const isByok = !!(userApiKey || userAnthropicKey);
    if (req.userId && !isByok) {
      const credits = await checkCredits(req.userId);
      if (!credits.canGenerate) {
        send('error', { message: credits.reason, code: 'NO_CREDITS' });
        return res.end();
      }
    }

    // ═══ Load session history ═══
    let streamChatHistory = '';
    if (sessionId && fileId && typeof sessionId === 'string' && isSafeId(sessionId)) {
      try {
        const db = getDb();
        const session = await db.collection<any>('plugin_sessions').findOneAndUpdate(
          { _id: sessionId },
          {
            $set: { updatedAt: new Date(), fileId },
            $setOnInsert: { createdAt: new Date(), messages: [], context: {} },
          },
          { upsert: true, returnDocument: 'after' }
        );
        if (session?.messages?.length > 0) {
          const msgs = session.messages as Array<{ role: string; content: string }>;
          const HISTORY_TOKEN_BUDGET = 12_000;
          const tail = msgs.slice(-4);
          const older = msgs.slice(0, -4);
          const tailTokens = tail.reduce((s, m) => s + Math.ceil((m.content?.length || 0) / 4), 0);
          let budget = HISTORY_TOKEN_BUDGET - tailTokens;
          const included: typeof msgs = [];
          for (let i = older.length - 1; i >= 0 && budget > 0; i--) {
            const t = Math.ceil((older[i].content?.length || 0) / 4);
            if (t > budget) break;
            included.unshift(older[i]);
            budget -= t;
          }
          streamChatHistory = [...included, ...tail]
            .map((m) => `[${(m.role || 'user').toUpperCase()}]: ${m.content}`)
            .join('\n');
        }
      } catch (e) {
        console.error('[Plugin:Stream] Session load error:', e);
      }
    }

    // ═══ Phase 1: Tool Pre-Pass ═══
    // Ask LLM if it needs any tools before generating Figma operations
    let enrichedContext = '';
    const toolCallRecords: Array<{
      id: string;
      name: string;
      status: 'running' | 'done' | 'error';
      args?: any;
      startedAt: string;
      endedAt?: string;
      summary?: string;
    }> = [];

    try {
      // Extract text content from selected elements for brand extraction
      const extractTextFromNode = (node: any): string[] => {
        const texts: string[] = [];
        if (node.characters) texts.push(`[${node.name || node.type}]: ${node.characters}`);
        if (node.children)
          for (const child of node.children) texts.push(...extractTextFromNode(child));
        return texts;
      };
      const selectionTextContent = selectedElements.flatMap(extractTextFromNode).filter(Boolean);

      const selectionContext =
        selectionTextContent.length > 0
          ? `\n\nSELECTED ELEMENTS TEXT CONTENT (${
              selectionTextContent.length
            } text nodes):\n${sanitizeForPrompt(
              selectionTextContent.slice(0, 200).join('\n'),
              5000
            )}`
          : '';

      const prePassPrompt = `You are a Figma design assistant deciding which tools to use before generating design operations.

Available tools:
- generate_mockup: Generate AI images/mockups. Use when user asks to create mockups, generate images, or needs visual assets. Choose model wisely:
  - gpt-image-2: best quality + brand fidelity (default)
  - gemini-3.1-flash-image-preview: fast/creative explorations
  - seedream-5-0-lite / seedream-4.5: photorealistic lifestyle/product shots
  Choose aspectRatio based on context: 1:1 (Instagram/square), 9:16 (story/Reels), 16:9 (landscape/billboard/cover), 4:5 (portrait feed).
  Set designType when relevant: social-media, business-card, packaging, billboard, apparel, signage.
- describe_image: Analyze an image by URL or base64. Use when user shares an image to recreate or reference.
- get_brand_context: Fetch brand guideline details. IMPORTANT: always pass "sections" to fetch only what you need — "minimal" for text/rename tasks, "visual" for color/typography/layout, "copy" for voice/strategy, "imageGen" for image generation. Only omit sections (= full) for complex multi-aspect tasks.
- web_search: Search the web for references, inspiration, or information.
- brand_guideline_update: Update sections of a brand guideline with structured data. Use when the user wants to "feed", "populate", "update", "send", or "alimentar" content from Figma frames to a brand guideline. Read the SELECTED ELEMENTS TEXT CONTENT below, parse it into structured brand data (strategy, personas, archetypes, manifesto, voice, colors, typography, etc.), and call this tool with the parsed data. Pass brand_guideline_id if available. This is a DATA EXTRACTION + API UPDATE tool, NOT a visual Figma operation.
- brand_guideline_create: Create a new brand guideline. Use when user wants to start a new brand from scratch.
- brand_guideline_list: List all user's brand guidelines (name + ID). Use when no brandGuidelineId is set and you need to find the right brand by name, or when the user mentions a brand name you need to resolve to an ID.
- save_to_brand_knowledge: Save strategic insights, decisions, or references to the brand's long-term memory (RAG). Use when the user wants to save notes or context about the brand.
- update_session_memory: Persist detected brands, client names, project references, and decisions in session memory so they're available in follow-up messages.

Rules:
- If the user wants a mockup/image — whether through the IMAGE mode button OR by mentioning it in their message (e.g. "crie imagens", "gera foto", "generate image", "mockup with photo", "use imagem de fundo") — ALWAYS use generate_mockup. The imageUrl in the result will be used with SET_IMAGE_FILL in the design phase.
- If brandGuidelineId is available, pass it to generate_mockup — it auto-injects logo + colors + typography.
- If the user wants to feed/populate/update brand guidelines with content from the selection, use brand_guideline_update. Parse the selected text content into the appropriate structured fields (strategy.manifesto, strategy.archetypes, strategy.personas, strategy.voiceValues, guidelines.voice, etc.).
- If the user mentions a brand by name but no brandGuidelineId is active, call brand_guideline_list first to resolve the name to an ID, then proceed with the resolved ID.
- If the request doesn't need any tools, respond with just "READY".
- You can call multiple tools if needed.
- When the user asks to create MULTIPLE variations (e.g. "4 anúncios", "3 versions"), call generate_mockup ONCE PER VARIATION with different prompts tailored to each one.
${
  brandGuidelineId
    ? `\nActive brandGuidelineId: "${brandGuidelineId}" — pass this as brand_guideline_id to brand_guideline_update, and as brandGuidelineId to generate_mockup and get_brand_context.`
    : '\nNo brandGuidelineId is active. If the user references a brand, call brand_guideline_list to find it.'
}
${
  generateImage
    ? `\nIMPORTANT: The user has IMAGE mode enabled. You MUST call generate_mockup for this request. Infer prompt, aspectRatio, designType, and model from the user message. Do NOT respond with just "READY".`
    : ''
}${selectionContext}`;

      const prePassResult = await chatWithLLM(command, '', [], {
        provider: 'gemini',
        apiKey: userApiKey || undefined,
        systemInstruction: prePassPrompt,
        tools: getChatTools(false),
      });

      if (prePassResult.toolCalls?.length) {
        for (const call of prePassResult.toolCalls) {
          const tcId = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const startedAt = new Date().toISOString();

          send('tool_start', { id: tcId, name: call.name, args: call.args });
          toolCallRecords.push({
            id: tcId,
            name: call.name,
            status: 'running',
            args: call.args,
            startedAt,
          });

          try {
            const result = await executeChatTool(call.name, call.args, {
              userId: req.userId || '',
              sessionId: sessionId || '',
              authHeader: req.headers.authorization || '',
              brandGuidelineId,
            });

            const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
            enrichedContext += `\n\n[Tool: ${call.name}] Result:\n${resultStr.slice(0, 3000)}`;

            const endedAt = new Date().toISOString();
            send('tool_end', {
              id: tcId,
              name: call.name,
              duration_ms: Date.now() - new Date(startedAt).getTime(),
            });
            const idx = toolCallRecords.findIndex((t) => t.id === tcId);
            if (idx >= 0) {
              toolCallRecords[idx].status = 'done';
              toolCallRecords[idx].endedAt = endedAt;
              toolCallRecords[idx].summary = resultStr.slice(0, 200);
            }
          } catch (toolErr) {
            send('tool_end', { id: tcId, name: call.name, error: (toolErr as Error).message });
            const idx = toolCallRecords.findIndex((t) => t.id === tcId);
            if (idx >= 0) toolCallRecords[idx].status = 'error';
          }
        }
      }
    } catch (prePassErr) {
      console.error('[Plugin:Stream] Pre-pass error (non-fatal):', (prePassErr as Error).message);
    }

    // Force generate_mockup if IMAGE mode is on but pre-pass didn't call it
    if (generateImage && !toolCallRecords.some((t) => t.name === 'generate_mockup')) {
      try {
        const tcId = `tc-${Date.now()}-force`;
        const startedAt = new Date().toISOString();
        const forceArgs: any = { prompt: command, model: OPENAI_IMAGE_MODELS.GPT_IMAGE_2 };
        if (brandGuidelineId) forceArgs.brandGuidelineId = brandGuidelineId;

        send('tool_start', { id: tcId, name: 'generate_mockup', args: forceArgs });
        toolCallRecords.push({
          id: tcId,
          name: 'generate_mockup',
          status: 'running',
          args: forceArgs,
          startedAt,
        });

        const result = await executeChatTool('generate_mockup', forceArgs, {
          userId: req.userId || '',
          sessionId: sessionId || '',
          authHeader: req.headers.authorization || '',
          brandGuidelineId,
        });

        const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
        enrichedContext += `\n\n[Tool: generate_mockup] Result:\n${resultStr.slice(0, 3000)}`;
        send('tool_end', {
          id: tcId,
          name: 'generate_mockup',
          duration_ms: Date.now() - new Date(startedAt).getTime(),
        });
        const idx = toolCallRecords.findIndex((t) => t.id === tcId);
        if (idx >= 0) {
          toolCallRecords[idx].status = 'done';
          toolCallRecords[idx].endedAt = new Date().toISOString();
          toolCallRecords[idx].summary = resultStr.slice(0, 200);
        }
      } catch (forceErr) {
        console.error(
          '[Plugin:Stream] Forced generate_mockup failed:',
          (forceErr as Error).message
        );
      }
    }

    // Extract imageUrls from ALL pre-pass mockup results
    const mockupRecords = toolCallRecords.filter(
      (t) => t.name === 'generate_mockup' && t.status === 'done'
    );
    const mockupImages: Array<{ url: string; aspect: string; label?: string }> = [];
    for (const rec of mockupRecords) {
      if (rec.summary) {
        const imgMatch = rec.summary.match(/"imageUrl"\s*:\s*"([^"]+)"/);
        if (imgMatch) {
          mockupImages.push({
            url: imgMatch[1],
            aspect: rec.args?.aspectRatio || '1:1',
            label: rec.args?.prompt?.slice(0, 40),
          });
        }
      }
    }
    if (!mockupImages.length && enrichedContext) {
      const ctxMatch = enrichedContext.match(/"imageUrl"\s*:\s*"([^"]+)"/);
      if (ctxMatch) mockupImages.push({ url: ctxMatch[1], aspect: '1:1' });
    }

    // If mockups were generated, create frames for ALL of them
    if (mockupImages.length > 0) {
      const aspectMap: Record<string, { w: number; h: number }> = {
        '1:1': { w: 1024, h: 1024 },
        '16:9': { w: 1280, h: 720 },
        '9:16': { w: 720, h: 1280 },
        '4:5': { w: 800, h: 1000 },
      };

      const allOps: any[] = [];
      let xOffset = 0;

      for (let i = 0; i < mockupImages.length; i++) {
        const img = mockupImages[i];
        const dims = aspectMap[img.aspect] || aspectMap['1:1'];
        const ref = `mockup_frame_${i}`;
        const label = img.label || command.slice(0, 40);

        allOps.push(
          {
            type: 'CREATE_FRAME',
            ref,
            props: {
              name: `Mockup ${i + 1} — ${label}`,
              width: dims.w,
              height: dims.h,
              x: xOffset,
              y: 0,
              fills: [{ type: 'SOLID', color: '#000000', opacity: 0 }],
            },
          },
          {
            type: 'SET_IMAGE_FILL',
            ref,
            imageUrl: img.url,
            scaleMode: 'FILL',
          }
        );
        xOffset += dims.w + 40;
      }

      const count = mockupImages.length;
      allOps.push({
        type: 'MESSAGE',
        content:
          count > 1
            ? `${count} mockups gerados e aplicados no canvas.`
            : `Mockup gerado e aplicado no canvas.`,
      });

      send('operations', allOps);

      // Use first image as the chat preview
      const generatedImageUrl = mockupImages[0].url;

      const genToolCall = {
        id: `tc-${Date.now()}`,
        name: 'apply_mockup_to_canvas',
        status: 'done' as const,
        args: { count, imageUrl: generatedImageUrl.slice(0, 80) + '...' },
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        summary: `Applied ${count} mockup image${count > 1 ? 's' : ''} to canvas`,
      };
      toolCallRecords.push(genToolCall);

      let sessionContext:
        | { messageCount: number; tokenEstimate: number; contextLimit: number }
        | undefined;
      if (sessionId && fileId && typeof sessionId === 'string' && isSafeId(sessionId)) {
        try {
          const db = getDb();
          const newMessages = [
            { role: 'user', content: command, timestamp: new Date() },
            {
              role: 'assistant',
              content: `Generated ${count} mockup${count > 1 ? 's' : ''}`,
              operations: allOps,
              toolCalls: toolCallRecords,
              timestamp: new Date(),
            },
          ];
          await db.collection('plugin_sessions').updateOne({ _id: sessionId } as any, {
            $push: { messages: { $each: newMessages } } as any,
          });
          const updated = await db
            .collection<any>('plugin_sessions')
            .findOne({ _id: sessionId } as any);
          const msgs = updated?.messages || [];
          const totalChars = msgs.reduce(
            (sum: number, m: any) => sum + (m.content?.length || 0),
            0
          );
          sessionContext = {
            messageCount: msgs.length,
            tokenEstimate: Math.ceil(totalChars / 4),
            contextLimit: 80000,
          };
        } catch {}
      }

      send('done', {
        operations: allOps,
        message:
          count > 1
            ? `${count} mockups gerados e aplicados no canvas.`
            : 'Mockup gerado e aplicado no canvas.',
        provider: 'pre-pass',
        durationMs: Date.now() - streamStartMs,
        toolCalls: toolCallRecords,
        sessionContext,
        generatedImageUrl,
      });

      res.end();

      if (req.userId && !isByok) {
        deductCredit(req.userId).catch((e) => console.error('[Plugin] Credit deduction error:', e));
      }
      return;
    }

    // ═══ Phase 2: Generate Figma Operations (reuse existing logic) ═══
    send('thinking', { message: 'Generating design...' });

    // Brand resolution (same as POST /)
    let brandGuideline: BrandGuideline | null = brandGuidelineFromUI || null;
    let brandChoiceContext = '';

    if (useBrand) {
      if (brandGuidelineId && !brandGuideline) {
        try {
          const savedGuideline = await prisma.brandGuideline.findUnique({
            where: { id: brandGuidelineId },
          });
          if (savedGuideline) {
            brandGuideline = {
              id: savedGuideline.id,
              identity: savedGuideline.identity as any,
              logos: savedGuideline.logos as any,
              colors: savedGuideline.colors as any,
              typography: savedGuideline.typography as any,
              tags: savedGuideline.tags as any,
              media: savedGuideline.media as any,
              tokens: savedGuideline.tokens as any,
              guidelines: savedGuideline.guidelines as any,
            };
          }
        } catch {}
      }

      if (!brandGuideline && fileId && req.userId) {
        try {
          const brandResult = await resolveBrandGuideline(fileId, req.userId, brandGuidelineId);
          if (brandResult.guideline) brandGuideline = brandResult.guideline;
          else if (brandResult.needsUserChoice)
            brandChoiceContext = buildGuidelineChoiceContext(brandResult.availableGuidelines);
        } catch {}
      }
    }

    const effectiveBrandFonts =
      brandFonts ||
      (brandGuideline?.typography
        ? {
            primary: (brandGuideline.typography as any[]).find(
              (t) => t.role === 'primary' || t.role === 'heading'
            ),
            secondary: (brandGuideline.typography as any[]).find(
              (t) => t.role === 'secondary' || t.role === 'body'
            ),
          }
        : undefined);

    const effectiveBrandColors =
      selectedBrandColors ||
      (brandGuideline?.colors
        ? (brandGuideline.colors as any[]).map((c) => ({
            name: c.name,
            value: c.hex,
            role: c.role,
          }))
        : undefined);

    // Template + component scanning
    let templateContext = '';
    let agentComponentsContext = '';
    if (fileId && pluginBridge.getSession(fileId)) {
      try {
        const templates = await scanTemplates(fileId);
        templateContext = buildTemplateContext(templates);
      } catch {}
      try {
        const agentComponents = await scanAgentComponents(fileId);
        if (agentComponents.length > 0)
          agentComponentsContext = buildComponentsContext(agentComponents);
      } catch {}
    }

    const tokenRegistry = buildTokenRegistry(brandGuideline || null, designSystem || null);
    const enforcedTokenPrompt =
      tokenRegistry.colors.size > 0 || tokenRegistry.typography.size > 0
        ? '\n' + buildEnforcedPrompt(tokenRegistry) + '\n'
        : '';

    // Collect session errors for feedback loop
    const previousErrors = getSessionErrors(sessionId);

    // Resolve brand knowledge RAG context (fire-and-forget on error)
    let brandKnowledgeContext: string | undefined;
    if (brandGuideline?.knowledgeFiles?.length && brandGuideline.id && req.userId) {
      try {
        const { knowledgeService } = await import('../services/knowledgeService.js');
        brandKnowledgeContext =
          (await knowledgeService.getContext(command, req.userId, brandGuideline.id)) || undefined;
      } catch (e) {
        console.warn('[plugin] Knowledge RAG failed, skipping:', (e as Error).message);
      }
    }

    // Build prompt (all contexts flow through assembler)
    const assembled = buildSystemPrompt(
      {
        command,
        selectedElements,
        scanPage: !!scanPage,
        selectedLogo,
        brandLogos,
        selectedBrandFont,
        brandFonts: effectiveBrandFonts,
        selectedBrandColors: effectiveBrandColors,
        availableComponents,
        availableColorVariables,
        availableFontVariables,
        availableLayers,
        attachments,
        mentions,
        designSystem: designSystem || null,
        brandGuideline: brandGuideline || undefined,
        thinkMode,
      },
      {
        chatHistory: streamChatHistory,
        previousErrors: previousErrors.length > 0 ? previousErrors : undefined,
        templateContext,
        agentComponentsContext,
        enforcedTokens: enforcedTokenPrompt || undefined,
        brandChoiceContext: brandChoiceContext || undefined,
        brandKnowledgeContext,
      }
    );

    // LLM pre-pass: refine intent when keyword confidence < 0.65
    if (assembled.intent.confidence < 0.65 && selectedElements.length > 0) {
      try {
        const selectionNames = selectedElements
          .slice(0, 5)
          .map((n: any) => n.name || n.type || 'unknown');
        const enrichedIntent = await refineIntentWithLLM(
          assembled.intent,
          command,
          selectionNames,
          (sys, usr) => quickTextCall(sys, usr)
        );
        if (enrichedIntent.llmRefined) {
          console.log(
            `[Plugin] LLM pre-pass refined intent: ${assembled.intent.intent} → ${
              enrichedIntent.intent
            } (confidence ${assembled.intent.confidence.toFixed(
              2
            )} → ${enrichedIntent.confidence.toFixed(2)})`
          );
          // If intent changed to clone and we have a source frame, inject clone-first hint
          if (enrichedIntent.intent === 'clone' && enrichedIntent.sourceFrame) {
            assembled.intent = enrichedIntent;
          }
        }
      } catch (e) {
        console.warn('[Plugin] LLM pre-pass failed, using keyword intent:', e);
      }
    }

    let systemPrompt = assembled.system;

    // Inject enriched context from tool pre-pass
    if (enrichedContext) {
      const hasImageUrl = enrichedContext.includes('"imageUrl"');
      systemPrompt += `\n\n═══ CONTEXTO ADICIONAL (pesquisa) ═══${enrichedContext}`;
      if (hasImageUrl) {
        systemPrompt += `\n\nIMPORTANT: An image was generated. Use SET_IMAGE_FILL with the imageUrl from the tool result above to apply it to a frame. Create a frame first with the appropriate dimensions, then fill it with the image.`;
      }
    }

    const userPrompt = `═══ PEDIDO DO USUÁRIO ═══\n\n"${command}"`;
    const contextSize =
      (selectedElements?.length || 0) +
      (availableComponents?.length || 0) +
      (availableLayers?.length || 0);
    const provider = chooseProvider(command, contextSize);

    const generationStart = Date.now();
    let operations: any[] = [];
    let usage: any;

    if (assembled.intent.isExport) {
      // ── Deterministic export fast-path (no LLM) ──
      // The user clearly wants a data file. The plugin sandbox extracts ALL
      // frames itself, so the model isn't needed and is unreliable here (it
      // would dump 100+ rows into a MESSAGE or return 0 ops). Emit the op directly.
      const fields = extractExportFields(command);
      const wantsPage =
        selectedElements.length === 0 ||
        /\b(todos|todas|tudo|toda a|a p[áa]gina|p[áa]gina inteir|page|inteir)\b/i.test(command);
      operations = [
        {
          type: 'EXPORT_FRAMES_DATA',
          format: assembled.intent.exportFormat,
          scope: wantsPage ? 'page' : 'selection',
          ...(fields.length ? { fields } : {}),
        },
        {
          type: 'MESSAGE',
          content: `Gerando arquivo ${assembled.intent.exportFormat.toUpperCase()}${
            fields.length ? ` com os campos: ${fields.join(', ')}` : ''
          } e baixando…`,
        },
      ];
      console.log(
        `[Plugin] Export fast-path → ${assembled.intent.exportFormat}, scope=${
          wantsPage ? 'page' : 'selection'
        }, fields=[${fields.join(', ')}]`
      );
    } else {
      try {
        const result = await provider.generateOperations(systemPrompt, userPrompt, {
          temperature: 0.2,
          maxTokens: 8192,
          apiKey: userAnthropicKey || undefined,
          attachments: attachments || [],
          onStatus: fileId
            ? (message: string) => {
                pluginBridge.notify(fileId, { type: 'AGENT_STATUS', message });
              }
            : undefined,
        });
        operations = result.operations;
        usage = result.usage;
      } catch (aiError) {
        console.error(`[Plugin:Stream] ${provider.name} error:`, aiError);
      }
    }

    const durationMs = Date.now() - generationStart;

    // Validate operations
    // Ops that legitimately carry no node/props payload (data-only / control ops)
    const PAYLOADLESS_OPS = new Set(['EXPORT_FRAMES_DATA', 'REQUEST_SCAN', 'UNDO_LAST_BATCH']);
    operations = operations.filter(
      (op) =>
        op &&
        op.type &&
        (PAYLOADLESS_OPS.has(op.type) ||
          op.nodeId ||
          op.props ||
          op.componentKey ||
          op.nodeIds ||
          op.fills ||
          op.strokes ||
          op.effects ||
          op.layoutMode ||
          op.variableId ||
          op.styleId ||
          op.content ||
          op.name ||
          op.width != null ||
          op.opacity != null ||
          op.cornerRadius != null ||
          op.x != null)
    );

    if (tokenRegistry.colors.size > 0 || tokenRegistry.spacing.size > 0) {
      const tokenValidation = validateOperations(operations, tokenRegistry);
      if (!tokenValidation.isValid && tokenValidation.corrections.length > 0) {
        tokenValidation.operations.push({
          type: 'MESSAGE',
          content: `⚡ Ajustes automáticos:\n${formatCorrections(tokenValidation.corrections)}`,
        });
        operations = tokenValidation.operations;
      }
    }

    const validation = operationValidator.validateBatch(operations);
    const validOps = validation.valid;

    // Capture validation errors for session feedback loop
    if (validation.invalid.length > 0) {
      const errorMsgs = validation.invalid.map((op: any) => {
        const result = operationValidator.validate(op);
        return `${op.type}: ${result.errors?.join(', ') || 'invalid'}`;
      });
      pushSessionErrors(sessionId, errorMsgs);
      console.log(`[Plugin] ${errorMsgs.length} operation errors captured for session feedback`);
    }

    // Stream operations
    send('operations', validOps);

    // Build final tool call record for the generation itself
    const genToolCall = {
      id: `tc-${Date.now()}`,
      name: 'generate_figma_operations',
      status: 'done' as const,
      args: { command: command.slice(0, 120) },
      startedAt: new Date(generationStart).toISOString(),
      endedAt: new Date().toISOString(),
      summary: `${validOps.length} operation${validOps.length !== 1 ? 's' : ''} via ${
        provider.name
      }`,
    };
    toolCallRecords.push(genToolCall);

    // Save to session and compute context info
    let sessionContext:
      | { messageCount: number; tokenEstimate: number; contextLimit: number }
      | undefined;
    if (sessionId && fileId && typeof sessionId === 'string' && isSafeId(sessionId)) {
      try {
        const db = getDb();
        const newMessages = [
          { role: 'user', content: command, timestamp: new Date() },
          {
            role: 'assistant',
            content: `Generated ${validOps.length} operations`,
            operations: validOps,
            toolCalls: toolCallRecords,
            timestamp: new Date(),
          },
        ];
        await db.collection('plugin_sessions').updateOne({ _id: sessionId } as any, {
          $push: { messages: { $each: newMessages } } as any,
        });
        const updated = await db
          .collection<any>('plugin_sessions')
          .findOne({ _id: sessionId } as any);
        const msgs = updated?.messages || [];
        const totalChars = msgs.reduce((sum: number, m: any) => sum + (m.content?.length || 0), 0);
        sessionContext = {
          messageCount: msgs.length,
          tokenEstimate: Math.ceil(totalChars / 4),
          contextLimit: 80000,
        };
      } catch {}
    }

    send('done', {
      operations: validOps,
      message: `Generated ${validOps.length} operation(s)`,
      provider: provider.name,
      usage,
      durationMs,
      toolCalls: toolCallRecords,
      sessionContext,
    });

    res.end();

    // Non-blocking credit deduction
    if (req.userId && !isByok && validOps.length > 0) {
      deductCredit(req.userId).catch((e) => console.error('[Plugin] Credit deduction error:', e));
    }
  } catch (error: any) {
    console.error('[Plugin:Stream] Error:', error);
    send('error', { message: error.message || 'Failed to process command' });
    res.end();
  }
});

// POST /plugin - Generate design operations from natural language (FASE 3: Multi-model + Chat Memory)
router.post('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      command,
      sessionId,
      fileId,
      selectedElements = [],
      selectedLogo,
      brandLogos,
      selectedBrandFont,
      brandFonts,
      selectedBrandColors,
      availableComponents = [],
      availableColorVariables = [],
      availableFontVariables = [],
      availableLayers = [],
      apiKey: userApiKey,
      anthropicApiKey: userAnthropicKey,
      attachments = [],
      mentions = [],
      designSystem,
      brandGuideline: brandGuidelineFromUI,
      brandGuidelineId,
      thinkMode = false,
      useBrand = true,
      generateImage = false,
    } = req.body as PluginRequest;

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    // Credit check — skip for BYOK users (they use their own keys)
    const isByok = !!(userApiKey || userAnthropicKey);
    if (req.userId && !isByok) {
      const credits = await checkCredits(req.userId);
      if (!credits.canGenerate) {
        return res.status(403).json({ error: credits.reason, code: 'NO_CREDITS' });
      }
    }

    // ═══ BRANDED SOCIAL POSTS: Auto-resolve brand guideline ═══
    let brandGuideline: BrandGuideline | null = brandGuidelineFromUI || null;
    let brandChoiceContext = '';

    if (useBrand) {
      // Try explicit brandGuidelineId first
      if (brandGuidelineId && !brandGuideline) {
        try {
          const savedGuideline = await prisma.brandGuideline.findUnique({
            where: { id: brandGuidelineId },
          });
          if (savedGuideline) {
            brandGuideline = {
              id: savedGuideline.id,
              identity: savedGuideline.identity as any,
              logos: savedGuideline.logos as any,
              colors: savedGuideline.colors as any,
              typography: savedGuideline.typography as any,
              tags: savedGuideline.tags as any,
              media: savedGuideline.media as any,
              tokens: savedGuideline.tokens as any,
              guidelines: savedGuideline.guidelines as any,
            };
            console.log('[Plugin] Loaded brand guideline from DB:', brandGuidelineId);
          }
        } catch (bgError) {
          console.error('[Plugin] Error fetching brand guideline:', bgError);
        }
      }

      // If still no brand, try auto-resolve from project linkage
      if (!brandGuideline && fileId && req.userId) {
        try {
          const brandResult = await resolveBrandGuideline(fileId, req.userId, brandGuidelineId);
          if (brandResult.guideline) {
            brandGuideline = brandResult.guideline;
            console.log('[Plugin] Auto-resolved brand guideline from project linkage');
          } else if (brandResult.needsUserChoice) {
            brandChoiceContext = buildGuidelineChoiceContext(brandResult.availableGuidelines);
            console.log('[Plugin] No linked brand, LLM will ask user to choose');
          }
        } catch (resolveError) {
          console.error('[Plugin] Error auto-resolving brand:', resolveError);
        }
      }
    } else {
      console.log('[Plugin] Branding disabled by user. Using local context ONLY.');
    }

    // Cache check for plugin context
    const contextHash = hashObject({ command, fileId, brandGuidelineId, designSystem });
    const pluginCacheKey = CacheKey.pluginContext(
      fileId || 'public',
      brandGuidelineId || 'none',
      contextHash
    );
    const cachedContext = await redisClient.get(pluginCacheKey).catch(() => null);

    // ═══ BRANDED SOCIAL POSTS: Resolve effective brand context ═══
    const effectiveBrandFonts =
      brandFonts ||
      (brandGuideline?.typography
        ? {
            primary: (brandGuideline.typography as any[]).find(
              (t) => t.role === 'primary' || t.role === 'heading'
            ),
            secondary: (brandGuideline.typography as any[]).find(
              (t) => t.role === 'secondary' || t.role === 'body'
            ),
          }
        : undefined);

    const effectiveBrandColors =
      selectedBrandColors ||
      (brandGuideline?.colors
        ? (brandGuideline.colors as any[]).map((c) => ({
            name: c.name,
            value: c.hex,
            role: c.role,
          }))
        : undefined);

    // ═══ BRANDED SOCIAL POSTS: Scan templates ═══
    let templateContext = '';
    if (fileId && pluginBridge.getSession(fileId)) {
      try {
        const templates = await scanTemplates(fileId);
        templateContext = buildTemplateContext(templates);
        if (templates.length > 0) {
          console.log(`[Plugin] Found ${templates.length} templates in file`);
          console.log(
            `[Plugin] Template IDs:`,
            templates.map((t) => ({ id: t.id, name: t.name }))
          );
          console.log(`[Plugin] Template context preview:`, templateContext.slice(0, 500));
        }
      } catch (templateError) {
        console.error('[Plugin] Error scanning templates:', templateError);
      }
    }

    // ═══ AGENT COMPONENTS: Scan for [Component] nodes with @agent: metadata ═══
    let agentComponentsContext = '';
    if (fileId && pluginBridge.getSession(fileId)) {
      try {
        const agentComponents = await scanAgentComponents(fileId);
        if (agentComponents.length > 0) {
          agentComponentsContext = buildComponentsContext(agentComponents);
          console.log(`[Plugin] Found ${agentComponents.length} agent components in file`);
        }
      } catch (componentError) {
        console.error('[Plugin] Error scanning agent components:', componentError);
      }
    }

    // FASE 3: Load or create session for chat memory
    let chatHistory = '';
    if (sessionId && fileId && typeof sessionId === 'string' && isSafeId(sessionId)) {
      try {
        const db = getDb();
        const collection = db.collection<any>('plugin_sessions');

        const session = await collection.findOneAndUpdate(
          { _id: sessionId },
          {
            $set: { updatedAt: new Date(), fileId },
            $setOnInsert: { createdAt: new Date(), messages: [], context: {} },
          },
          { upsert: true, returnDocument: 'after' }
        );

        // Build chat history with adaptive token budget
        if (session && session.messages && session.messages.length > 0) {
          const msgs = session.messages as Array<{ role: string; content: string }>;
          const HISTORY_TOKEN_BUDGET = 12_000;
          const tail = msgs.slice(-4);
          const older = msgs.slice(0, -4);
          const tailTokens = tail.reduce((s, m) => s + Math.ceil((m.content?.length || 0) / 4), 0);
          let budget = HISTORY_TOKEN_BUDGET - tailTokens;
          const included: typeof msgs = [];
          for (let i = older.length - 1; i >= 0 && budget > 0; i--) {
            const t = Math.ceil((older[i].content?.length || 0) / 4);
            if (t > budget) break;
            included.unshift(older[i]);
            budget -= t;
          }
          chatHistory = [...included, ...tail]
            .map((m) => `[${(m.role || 'user').toUpperCase()}]: ${m.content}`)
            .join('\n');
        }
      } catch (sessionError) {
        console.error('[Plugin] Session error:', sessionError);
        // Continue without session
      }
    }

    // Calculate context size for provider selection
    const contextSize =
      (selectedElements?.length || 0) +
      (availableComponents?.length || 0) +
      (availableLayers?.length || 0);

    // FASE 3: Intelligently choose provider based on complexity
    const provider = chooseProvider(command, contextSize);

    // Build token registry from available sources (MongoDB priority, Figma fallback)
    const tokenRegistry = buildTokenRegistry(brandGuideline || null, designSystem || null);

    // Get enforced prompt with pre-calculated RGB values
    const enforcedTokenPrompt =
      tokenRegistry.colors.size > 0 || tokenRegistry.typography.size > 0
        ? '\n' + buildEnforcedPrompt(tokenRegistry) + '\n'
        : '';

    const prevErrors = getSessionErrors(sessionId);

    let brandKnowledgeCtx2: string | undefined;
    if (brandGuideline?.knowledgeFiles?.length && brandGuideline.id && req.userId) {
      try {
        const { knowledgeService } = await import('../services/knowledgeService.js');
        brandKnowledgeCtx2 =
          (await knowledgeService.getContext(command, req.userId, brandGuideline.id)) || undefined;
      } catch {}
    }

    const assembled = buildSystemPrompt(
      {
        command,
        selectedElements,
        scanPage: !!(req.body as any).scanPage,
        selectedLogo,
        brandLogos,
        selectedBrandFont,
        brandFonts: effectiveBrandFonts,
        selectedBrandColors: effectiveBrandColors,
        availableComponents,
        availableColorVariables,
        availableFontVariables,
        availableLayers,
        attachments,
        mentions,
        designSystem: designSystem || null,
        brandGuideline: brandGuideline || undefined,
        thinkMode,
      },
      {
        chatHistory,
        previousErrors: prevErrors.length > 0 ? prevErrors : undefined,
        templateContext,
        agentComponentsContext,
        enforcedTokens: enforcedTokenPrompt || undefined,
        brandChoiceContext: brandChoiceContext || undefined,
        brandKnowledgeContext: brandKnowledgeCtx2,
      }
    );
    let systemPrompt = assembled.system;
    const promptMeta = assembled;
    console.log(
      `[Plugin] Prompt: ${assembled.tokenEstimate} tokens, intent: ${
        assembled.intent.intent
      }, format: ${assembled.intent.format}, modules: [${assembled.modules.join(', ')}]`
    );

    const userPrompt = `═══ PEDIDO DO USUÁRIO ═══\n\n"${command}"`;

    // Generate operations using selected provider (with retry for V2)
    let operations: any[] = [];
    let usage: { inputTokens: number; outputTokens: number; totalTokens: number } | undefined;
    const generationStart = Date.now();
    const toolCallStartedAt = new Date().toISOString();
    const maxRetries = 1;

    // Deterministic export fast-path (no LLM) — see stream handler for rationale.
    const isExportFastPath = assembled.intent.isExport;
    if (isExportFastPath) {
      const fields = extractExportFields(command);
      const wantsPage =
        selectedElements.length === 0 ||
        /\b(todos|todas|tudo|toda a|a p[áa]gina|p[áa]gina inteir|page|inteir)\b/i.test(command);
      operations = [
        {
          type: 'EXPORT_FRAMES_DATA',
          format: assembled.intent.exportFormat,
          scope: wantsPage ? 'page' : 'selection',
          ...(fields.length ? { fields } : {}),
        },
        {
          type: 'MESSAGE',
          content: `Gerando arquivo ${assembled.intent.exportFormat.toUpperCase()}${
            fields.length ? ` com os campos: ${fields.join(', ')}` : ''
          } e baixando…`,
        },
      ];
      console.log(
        `[Plugin] Export fast-path → ${assembled.intent.exportFormat}, scope=${
          wantsPage ? 'page' : 'selection'
        }, fields=[${fields.join(', ')}]`
      );
    }

    for (let attempt = 0; attempt <= maxRetries && !isExportFastPath; attempt++) {
      const isRetry = attempt > 0;
      const currentPrompt = isRetry
        ? systemPrompt +
          '\n\n' +
          buildRetryFeedback(
            operations
              .filter((op: any) => !operationValidator.validate(op).valid)
              .map((op: any) => `${op.type}: ${operationValidator.validate(op).errors.join(', ')}`)
          )
        : systemPrompt;

      try {
        const result = await provider.generateOperations(currentPrompt, userPrompt, {
          temperature: isRetry ? 0.1 : 0.2, // Lower temperature on retry
          maxTokens: 8192,
          // Pass BYOK Anthropic key if the user provided one
          apiKey: userAnthropicKey || undefined,
          // Pass attachments (images, PDFs, CSVs) for multimodal processing
          attachments: attachments || [],
          // Agent status callback — broadcasts search progress to plugin UI via WebSocket
          onStatus: fileId
            ? (message: string) => {
                pluginBridge.notify(fileId, { type: 'AGENT_STATUS', message });
              }
            : undefined,
        });
        operations = result.operations;
        usage = result.usage;

        console.log(
          `[Plugin] LLM generated ${operations.length} operations${isRetry ? ' (retry)' : ''}:`,
          operations.map((o: any) => o.type)
        );

        // Debug: Show parent refs to diagnose hierarchy issues
        const hierarchy = operations.map((o: any, i: number) => {
          const parent = o.parentRef || o.parentNodeId || '(root)';
          return `[${i + 1}] ${o.type} "${o.props?.name || o.name || ''}" → parent: ${parent}`;
        });
        console.log(`[Plugin] Hierarchy:\n${hierarchy.join('\n')}`);

        if (operations.length > 0) {
          console.log(`[Plugin] First operation:`, JSON.stringify(operations[0]).slice(0, 300));
        }

        // Check if retry is needed (>50% invalid operations)
        if (!isRetry && operations.length > 0) {
          const preValidation = operationValidator.validateBatch(operations);
          const invalidRatio = preValidation.invalid.length / operations.length;
          if (invalidRatio > 0.5) {
            console.log(
              `[Plugin] V2 retry triggered: ${Math.round(invalidRatio * 100)}% invalid operations`
            );
            continue; // Retry
          }
        }

        break; // Success, exit retry loop
      } catch (aiError) {
        console.error(`[Plugin] ${provider.name} error${isRetry ? ' (retry)' : ''}:`, aiError);
        if (!isRetry) {
          operations = [];
        }
      }
    }
    const durationMs = Date.now() - generationStart;

    // Validate operations have required fields
    // Ops that legitimately carry no node/props payload (data-only / control ops)
    const PAYLOADLESS_OPS = new Set(['EXPORT_FRAMES_DATA', 'REQUEST_SCAN', 'UNDO_LAST_BATCH']);
    operations = operations.filter(
      (op) =>
        op &&
        op.type &&
        (PAYLOADLESS_OPS.has(op.type) ||
          op.nodeId ||
          op.props ||
          op.componentKey ||
          op.nodeIds ||
          op.fills ||
          op.strokes ||
          op.effects ||
          op.layoutMode ||
          op.variableId ||
          op.styleId ||
          op.content ||
          op.name ||
          op.width != null ||
          op.opacity != null ||
          op.cornerRadius != null ||
          op.x != null)
    );

    // Token validation: correct values to nearest tokens
    if (tokenRegistry.colors.size > 0 || tokenRegistry.spacing.size > 0) {
      const tokenValidation = validateOperations(operations, tokenRegistry);
      if (!tokenValidation.isValid && tokenValidation.corrections.length > 0) {
        console.log(`[Plugin] Token corrections applied: ${tokenValidation.corrections.length}`);
        tokenValidation.corrections.forEach((c) => {
          console.log(`  ${c.field}: ${c.original} -> ${c.corrected} (${c.tokenUsed})`);
        });
        // Add notification message
        tokenValidation.operations.push({
          type: 'MESSAGE',
          content: `⚡ Ajustes automáticos:\n${formatCorrections(tokenValidation.corrections)}`,
        });
        operations = tokenValidation.operations;
      }
    }

    console.log(
      `[Plugin API] [${provider.name}] Generated ${
        operations.length
      } op(s) for: "${command.substring(0, 60)}"`
    );
    // Log each operation so we can see what the LLM actually returned
    operations.forEach((op, i) => {
      if (op.type === 'MESSAGE') {
        console.log(`  [${i + 1}] MESSAGE: "${String(op.content ?? '').substring(0, 120)}"`);
      } else {
        const label = op.props?.name || op.name || op.nodeId || '';
        console.log(`  [${i + 1}] ${op.type}${label ? ` "${label}"` : ''}`);
      }
    });

    // Save to session if available (FASE 3)
    let sessionContextRest:
      | { messageCount: number; tokenEstimate: number; contextLimit: number }
      | undefined;
    if (sessionId && fileId && typeof sessionId === 'string' && isSafeId(sessionId)) {
      try {
        const db = getDb();
        const collection = db.collection<any>('plugin_sessions');
        const newMessages = [
          { role: 'user', content: command, timestamp: new Date() },
          {
            role: 'assistant',
            content: `Generated ${operations.length} operations`,
            operations,
            timestamp: new Date(),
          },
        ];
        await collection.updateOne(
          { _id: sessionId },
          { $push: { messages: { $each: newMessages } } as any }
        );
        const updated = await collection.findOne({ _id: sessionId });
        const msgs = updated?.messages || [];
        const totalChars = msgs.reduce((sum: number, m: any) => sum + (m.content?.length || 0), 0);
        sessionContextRest = {
          messageCount: msgs.length,
          tokenEstimate: Math.ceil(totalChars / 4),
          contextLimit: 80000,
        };
      } catch (sessionError) {
        console.error('[Plugin] Failed to save to session:', sessionError);
      }
    }

    // Validate operations before sending to plugin
    const validation = operationValidator.validateBatch(operations);
    if (validation.invalid.length > 0) {
      console.warn(`[Plugin] ${validation.invalid.length} invalid operation(s) filtered:`);
      validation.invalid.forEach(({ op, errors }) => {
        console.warn(`  ✗ ${op.type}: ${errors.join(', ')}`);
      });
      // Capture for session feedback loop
      pushSessionErrors(
        sessionId,
        validation.invalid.map(({ op, errors }) => `${op.type}: ${errors.join(', ')}`)
      );
    }

    const validOps = validation.valid;
    const warnings = validation.invalid.map(({ op, errors }) => `${op.type}: ${errors.join(', ')}`);

    // Return validated operations to apply
    const toolCallRecord = {
      id: `tc-${Date.now()}`,
      name: 'generate_figma_operations',
      status: 'done' as const,
      args: { command: command.slice(0, 120) },
      startedAt: toolCallStartedAt,
      endedAt: new Date().toISOString(),
      summary: `${validOps.length} operation${validOps.length !== 1 ? 's' : ''} via ${
        provider.name
      }${warnings.length > 0 ? ` (${warnings.length} filtered)` : ''}`,
    };

    const responseData = {
      success: true,
      operations: validOps,
      message: `Generated ${validOps.length} operation(s)${
        warnings.length > 0 ? ` (${warnings.length} filtered)` : ''
      }`,
      provider: provider.name,
      warnings: warnings.length > 0 ? warnings : undefined,
      usage: usage || undefined,
      durationMs,
      toolCallRecord,
      sessionContext: sessionContextRest,
    };

    // Cache plugin context for 1 hour
    await redisClient
      .setex(pluginCacheKey, CACHE_TTL.PLUGIN_CTX, JSON.stringify(responseData))
      .catch(() => null);
    console.log(`[Cache] SET plugin:${fileId?.slice(0, 8)}:${brandGuidelineId?.slice(0, 8)} (1h)`);

    res.json(responseData);

    // Deduct credit after successful response (non-blocking, only for authenticated non-BYOK users)
    const isByokUser = !!(userApiKey || userAnthropicKey);
    if (req.userId && !isByokUser && validOps.length > 0) {
      deductCredit(req.userId).catch((e) => console.error('[Plugin] Credit deduction error:', e));
    }
  } catch (error: any) {
    console.error('[Plugin API] Route error:', error);
    res.status(500).json({
      error: 'Failed to process command',
      message: error.message,
    });
  }
});

// ============ Plugin Auth Status (same credit fields as /payments/usage) ============

router.get('/auth/status', optionalAuth, async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    return res.json({
      authenticated: false,
      canGenerate: true, // Allow unauthenticated BYOK users
    });
  }

  try {
    await connectToMongoDB();
    const db = getDb();
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.userId) });
    if (!user) {
      return res.json({ authenticated: false, canGenerate: true });
    }

    const hasActiveSubscription = user.subscriptionStatus === 'active';
    const freeGenerationsUsed = user.freeGenerationsUsed || 0;
    const monthlyCredits = user.monthlyCredits || 20;
    const creditsUsed = user.creditsUsed || 0;
    const creditsRemaining = Math.max(0, monthlyCredits - creditsUsed);
    const totalCreditsEarned = user.totalCreditsEarned ?? 0;
    const totalCredits = totalCreditsEarned + creditsRemaining;

    res.json({
      authenticated: true,
      email: user.email,
      subscriptionTier: user.subscriptionTier || 'free',
      hasActiveSubscription,
      freeGenerationsUsed,
      freeGenerationsRemaining: Math.max(0, FREE_GENERATIONS_LIMIT - freeGenerationsUsed),
      monthlyCredits,
      creditsUsed,
      creditsRemaining,
      totalCredits,
      canGenerate: hasActiveSubscription
        ? totalCredits > 0
        : freeGenerationsUsed < FREE_GENERATIONS_LIMIT && totalCredits > 0,
    });
  } catch (error: any) {
    console.error('[Plugin] Auth status error:', error.message);
    res.json({ authenticated: false, canGenerate: true });
  }
});

// ============ Image Proxy (CORS bypass for figma.createImageAsync) ============

const ALLOWED_IMAGE_DOMAINS = [
  'images.unsplash.com',
  'picsum.photos',
  'fastly.picsum.photos',
  'res.cloudinary.com',
  'upload.wikimedia.org',
  'via.placeholder.com',
];

// HIGH-003 fix: Rate limiter for proxy endpoint (anti-abuse)
const proxyRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  message: { error: 'Too many proxy requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/proxy-image', proxyRateLimiter, async (req: Request, res: Response) => {
  try {
    const imageUrl = req.query.url as string;
    if (!imageUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    // Validate URL
    let parsed: URL;
    try {
      parsed = new URL(imageUrl);
    } catch (_e) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // Domain allowlist for security
    if (!ALLOWED_IMAGE_DOMAINS.some((d) => parsed.hostname.endsWith(d))) {
      return res.status(403).json({
        error: 'Domain not allowed',
        allowed: ALLOWED_IMAGE_DOMAINS,
      });
    }

    // Fetch image
    const response = await fetch(imageUrl, {
      headers: { 'User-Agent': 'VisantCopilot/1.0' },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Upstream returned ${response.status}`,
      });
    }

    // Set content type and pipe response
    const contentType = response.headers.get('content-type') || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    // MED-004 fix: Use configured frontend URL instead of wildcard
    const allowedOrigin = FRONTEND_BASE_URL || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);

    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (error: any) {
    // MED-002 fix: Don't expose internal error details
    console.error('[ProxyImage] Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

// ============ Image to Prompt Generator ============
import {
  buildImageToPromptSystem,
  IMAGE_ANALYSIS_USER_PROMPT,
  detectComponentType,
} from '../lib/prompt/modules/image-to-prompt.js';
import {
  UI_DESCRIBE_SYSTEM,
  UI_DESCRIBE_USER,
  UI_DESCRIBE_COMPACT,
} from '../lib/prompt/modules/ui-to-image-prompt.js';
import {
  SMART_ANALYZER_SYSTEM,
  SMART_ANALYZER_USER,
  parseAnalyzerResponse,
  IMAGE_CATEGORIES,
  type ImageCategory,
  getFigmaOperationsSystem,
  FIGMA_OPERATIONS_USER,
  parseFigmaOperationsResponse,
  WHITE_LABEL_INSTRUCTION,
} from '../lib/prompt/modules/smart-image-analyzer.js';
import { generateText } from '../lib/ai-providers/gemini.js';
import {
  saveFeedback,
  buildLearningContext,
  getFeedbackStats,
} from '../services/promptFeedbackService.js';
import {
  saveToLibrary,
  findSimilar,
  buildLibraryContext,
  incrementUsage,
  updateRating,
  getUserPrompts,
} from '../services/promptLibraryService.js';

/**
 * POST /api/plugin/image-to-prompt
 * Analyzes an image and generates a Figma plugin prompt
 * Admin only
 */
router.post(
  '/image-to-prompt',
  imageAnalysisLimiter,
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { image, hint, saveToLib, name } = req.body;

      // Validate image input
      const validation = validateImageInput(image);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      // Detect component type from hint
      const componentType = hint ? detectComponentType(hint) : undefined;
      const typeKey = componentType || 'general';

      // Get learned context from MongoDB feedback
      const learningContext = await buildLearningContext(typeKey);

      // Get similar prompts from library for better context
      const libraryContext = await buildLibraryContext(componentType);

      // Combine contexts
      const contexts = [learningContext, libraryContext].filter(Boolean) as string[];

      // Build system prompt with component-specific rules + learnings + library examples
      const systemPrompt = buildImageToPromptSystem(componentType, contexts);

      // Use Gemini Flash for fast vision analysis
      const result = await generateText(systemPrompt, IMAGE_ANALYSIS_USER_PROMPT, [
        { mimeType: image.mimeType || 'image/png', data: image.base64 },
      ]);

      // Generate a feedback ID for tracking
      const feedbackId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const generatedPrompt = result.text;
      let promptId: string | undefined;

      // Save to library if requested
      if (saveToLib && name) {
        const { publish } = req.body;
        promptId = await saveToLibrary({
          name,
          prompt: generatedPrompt,
          category: 'figma-prompts',
          componentType: typeKey,
          tags: ['figma-plugin', typeKey],
          userId: req.userId,
          isPublic: !!publish, // Admin can publish immediately
        });
      }

      res.json({
        success: true,
        prompt: generatedPrompt,
        feedbackId,
        promptId,
        componentType: typeKey,
        usage: result.usage || null,
      });
    } catch (error: any) {
      console.error('[ImageToPrompt] Error:', error.message);
      res.status(500).json({ error: 'Failed to analyze image', details: error.message });
    }
  }
);

/**
 * POST /api/plugin/image-to-prompt/feedback
 * Submit feedback to improve prompt generation (persisted to MongoDB)
 * Admin only
 */
router.post(
  '/image-to-prompt/feedback',
  authenticate,
  requireAdmin,
  agentCommandLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const { feedbackId, success, componentType, improvement, generatedPrompt } = req.body;

      if (!feedbackId) {
        return res.status(400).json({ error: 'feedbackId required' });
      }

      // Persist to MongoDB
      await saveFeedback({
        feedbackId,
        componentType: componentType || 'general',
        success: !!success,
        improvement: improvement || undefined,
        generatedPrompt: generatedPrompt || undefined,
      });

      res.json({ success: true, message: 'Feedback saved' });
    } catch (error: any) {
      console.error('[ImageToPrompt] Feedback error:', error.message);
      res.status(500).json({ error: 'Failed to record feedback' });
    }
  }
);

/**
 * GET /api/plugin/image-to-prompt/stats
 * Get feedback statistics
 * Admin only
 */
router.get(
  '/image-to-prompt/stats',
  authenticate,
  requireAdmin,
  agentCommandLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const stats = await getFeedbackStats();
      res.json({ success: true, stats });
    } catch (error: any) {
      console.error('[ImageToPrompt] Stats error:', error.message);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  }
);

/**
 * POST /api/plugin/ui-to-image-prompt
 * Analyzes UI screenshot → generates prompt for image generation models
 * Admin only
 */
router.post(
  '/ui-to-image-prompt',
  imageAnalysisLimiter,
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { image, compact, saveToLib, name } = req.body;

      // Validate image input
      const validation = validateImageInput(image);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      // Use compact version for minimal tokens
      const systemPrompt = compact ? UI_DESCRIBE_COMPACT : UI_DESCRIBE_SYSTEM;
      const userPrompt = compact ? 'Gere o prompt.' : UI_DESCRIBE_USER;

      const result = await generateText(systemPrompt, userPrompt, [
        { mimeType: image.mimeType || 'image/png', data: image.base64 },
      ]);

      const generatedPrompt = result.text.trim();
      let promptId: string | undefined;

      // Save to library if requested
      if (saveToLib && name) {
        const { publish } = req.body;
        promptId = await saveToLibrary({
          name,
          prompt: generatedPrompt,
          category: 'ui-prompts',
          tags: ['image-gen', 'ui-screenshot'],
          userId: req.userId,
          isPublic: !!publish, // Admin can publish immediately
        });
      }

      res.json({
        success: true,
        prompt: generatedPrompt,
        promptId,
        usage: result.usage || null,
      });
    } catch (error: any) {
      console.error('[UItoImagePrompt] Error:', error.message);
      res.status(500).json({ error: 'Failed to analyze UI', details: error.message });
    }
  }
);

/**
 * GET /api/plugin/prompt-library
 * Get user's saved prompts from library
 * Admin only
 */
router.get(
  '/prompt-library',
  authenticate,
  requireAdmin,
  agentCommandLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const { category } = req.query;
      const prompts = await getUserPrompts(req.userId!, category as string);
      res.json({ success: true, prompts });
    } catch (error: any) {
      console.error('[PromptLibrary] Error:', error.message);
      res.status(500).json({ error: 'Failed to get prompts' });
    }
  }
);

/**
 * GET /api/plugin/prompt-library/similar
 * Find similar prompts for inspiration
 * Admin only
 */
router.get(
  '/prompt-library/similar',
  authenticate,
  requireAdmin,
  agentCommandLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const { componentType, tags } = req.query;
      const tagArray = typeof tags === 'string' ? tags.split(',') : undefined;
      const prompts = await findSimilar(componentType as string, tagArray, 10);
      res.json({ success: true, prompts });
    } catch (error: any) {
      console.error('[PromptLibrary] Error:', error.message);
      res.status(500).json({ error: 'Failed to find similar prompts' });
    }
  }
);

/**
 * POST /api/plugin/prompt-library/:id/use
 * Mark prompt as used (increments usage count)
 * Admin only
 */
router.post(
  '/prompt-library/:id/use',
  authenticate,
  requireAdmin,
  agentCommandLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const promptId = req.params.id;
      if (!isSafeId(promptId, 50)) {
        return res.status(400).json({ error: 'Invalid prompt ID' });
      }
      await incrementUsage(promptId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[PromptLibrary] Error:', error.message);
      res.status(500).json({ error: 'Failed to update usage' });
    }
  }
);

/**
 * POST /api/plugin/prompt-library/:id/rate
 * Rate a prompt (success/failure affects ranking)
 * Admin only
 */
router.post(
  '/prompt-library/:id/rate',
  authenticate,
  requireAdmin,
  agentCommandLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const promptId = req.params.id;
      if (!isSafeId(promptId, 50)) {
        return res.status(400).json({ error: 'Invalid prompt ID' });
      }
      const { success } = req.body;
      await updateRating(promptId, !!success);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[PromptLibrary] Error:', error.message);
      res.status(500).json({ error: 'Failed to update rating' });
    }
  }
);

// ============ Smart Image Analyzer (Unified Endpoint) ============

/**
 * POST /api/plugin/smart-analyze
 * Unified endpoint: auto-detects image type and generates appropriate prompt
 * - mode: 'figma-plugin' → generates FigmaOperation[] JSON
 * - mode: 'image-gen' (default) → generates image generation prompt
 * Admin only
 */
router.post(
  '/smart-analyze',
  imageAnalysisLimiter,
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        image,
        mode = 'image-gen',
        whiteLabel = false,
        params,
        refinements,
        currentPrompt,
        availableComponents,
        brandGuideline,
      } = req.body;
      const saveToLib = req.body.saveToLib === true || req.body.saveToLib === 'true';
      const publish = req.body.publish === true || req.body.publish === 'true';

      // Validate image input
      const validation = validateImageInput(image);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      const imageData = [{ mimeType: image.mimeType || 'image/png', data: image.base64 }];

      // White label instruction to append when enabled
      const whiteLabelSuffix = whiteLabel ? WHITE_LABEL_INSTRUCTION : '';

      // Build parameter-based instructions
      let paramInstructions = '';
      if (params) {
        if (mode === 'figma-plugin') {
          if (params.useAutoLayout === false)
            paramInstructions += '\n- NÃO use auto-layout neste componente.';
          if (params.useSemanticNaming)
            paramInstructions +=
              '\n- Use nomes de camadas extremamente descritivos e semânticos em inglês.';
          if (params.useTokens)
            paramInstructions +=
              '\n- Priorize o uso de variáveis e tokens de cores/tipografia disponíveis no workspace.';
          if (params.selectedFont)
            paramInstructions += `\n- Utilize a fonte "${params.selectedFont}" para todos os elementos de texto.`;
        } else {
          if (params.intensity === 'literal')
            paramInstructions +=
              '\n- Seja extremamente literal: descreva apenas o que está visível, sem interpretações artísticas.';
          else if (params.intensity === 'creative')
            paramInstructions +=
              '\n- Seja criativo: adicione elementos que melhorem a estética, iluminação dramática e detalhes que complementem o mood.';

          if (params.visualStyle && params.visualStyle !== 'auto')
            paramInstructions += `\n- Estilo visual desejado: ${params.visualStyle}.`;
          if (params.aspectRatio)
            paramInstructions += `\n- Proporção alvo (Aspect Ratio): ${params.aspectRatio}.`;
          if (params.selectedFont)
            paramInstructions += `\n- Sugira o uso da fonte "${params.selectedFont}" se houver texto na imagem.`;
        }
      }

      // Refinement Logic: If refinements are provided, we ask the AI to REWRITE the prompt
      let systemBase =
        mode === 'figma-plugin'
          ? getFigmaOperationsSystem({
              availableComponents,
              brandContext: brandGuideline?.guidelines?.voice,
            })
          : SMART_ANALYZER_SYSTEM;
      let userBase = mode === 'figma-plugin' ? FIGMA_OPERATIONS_USER : SMART_ANALYZER_USER;

      if (refinements && Array.isArray(refinements) && refinements.length > 0) {
        const safeCurrentPrompt = sanitizeForPrompt(currentPrompt, 3000);
        const safeRefinements = sanitizePromptArray(refinements, 500).join(', ');
        systemBase += `\n\nREFINAMENTO DE PROMPT:
      - O usuário deseja alterar o prompt gerado anteriormente.
      - Prompt Original: "${safeCurrentPrompt}"
      - Novas instruções/mudanças desejadas: ${safeRefinements}
      - Sua tarefa é REESCREVER o prompt (ou operações) incorporando essas mudanças de forma fluida e profissional.
      - Mantenha a consistência com a imagem original, mas priorize as novas instruções.`;

        userBase = `Com base na imagem e no prompt original "${safeCurrentPrompt}", gere uma nova versão do prompt incorporando: ${safeRefinements}.`;
      }

      // MODE: Figma Plugin Operations
      if (mode === 'figma-plugin') {
        const result = await generateText(
          systemBase +
            whiteLabelSuffix +
            (paramInstructions ? `\n\nREGRAS ADICIONAIS DE CUSTOMIZAÇÃO:${paramInstructions}` : ''),
          userBase,
          imageData
        );

        const parsed = parseFigmaOperationsResponse(result.text);

        if (!parsed) {
          return res.status(500).json({
            error: 'Failed to parse Figma operations',
            raw: result.text,
          });
        }

        const feedbackId = `figma-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        let promptId: string | undefined;
        if (saveToLib) {
          promptId = await saveToLibrary({
            name: parsed.name,
            prompt: JSON.stringify(parsed.operations, null, 2),
            category: 'figma-prompts',
            componentType: parsed.category,
            tags: ['figma-plugin', 'operations', parsed.category],
            userId: req.userId,
            isPublic: !!publish,
          });
        }

        return res.json({
          success: true,
          mode: 'figma-plugin',
          name: parsed.name,
          category: parsed.category,
          operations: parsed.operations,
          tokens: parsed.tokens,
          feedbackId,
          promptId,
          usage: result.usage || null,
        });
      }

      // MODE: Image Generation Prompt (default)
      const analysisResult = await generateText(
        systemBase +
          whiteLabelSuffix +
          (paramInstructions ? `\n\nREGRAS ADICIONAIS DE CUSTOMIZAÇÃO:${paramInstructions}` : ''),
        userBase,
        imageData
      );

      const parsed = parseAnalyzerResponse(analysisResult.text);

      if (!parsed) {
        return res.status(500).json({
          error: 'Failed to parse image analysis',
          raw: analysisResult.text,
        });
      }

      const { category, confidence, tags, prompt, name } = parsed;

      // Determine library category based on detected type
      const isUIType = category === 'ui-screenshot' || category === 'figma-design';
      const libraryCategory = isUIType ? 'figma-prompts' : category;

      const feedbackId = `smart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      let promptId: string | undefined;
      if (saveToLib) {
        promptId = await saveToLibrary({
          name,
          prompt,
          category: libraryCategory,
          componentType: category,
          tags: [...tags, category],
          userId: req.userId,
          isPublic: !!publish,
        });
      }

      res.json({
        success: true,
        mode: 'image-gen',
        category,
        confidence,
        tags,
        name,
        prompt,
        promptType: isUIType ? 'figma-plugin' : 'image-generation',
        feedbackId,
        promptId,
        libraryCategory,
        usage: analysisResult.usage || null,
      });
    } catch (error: any) {
      console.error('[SmartAnalyze] Error:', error.message);
      res.status(500).json({ error: 'Failed to analyze image', details: error.message });
    }
  }
);

/**
 * GET /api/plugin/smart-analyze/categories
 * Returns all detectable image categories
 */
router.get('/smart-analyze/categories', (req: Request, res: Response) => {
  const categories = Object.entries(IMAGE_CATEGORIES).map(([key, value]) => ({
    id: key,
    keywords: value.keywords,
    color: value.color,
  }));
  res.json({ categories });
});

/**
 * POST /api/plugin/smart-analyze/publish
 * Publish a prompt to the community library
 * Admin only
 */
router.post(
  '/smart-analyze/publish',
  authenticate,
  requireAdmin,
  agentCommandLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, prompt, category, tags } = req.body;

      // Validate inputs
      const validName = ensureString(name, 200);
      const validPrompt = ensureString(prompt, 100000);
      const validCategory = ensureString(category, 50);

      if (!validName || !validPrompt || !validCategory) {
        return res.status(400).json({ error: 'Name, prompt, and category are required' });
      }

      // Validate tags
      const validTags = Array.isArray(tags)
        ? tags
            .slice(0, 20)
            .map((t) => ensureString(t, 50))
            .filter((t): t is string => t !== null)
        : [];

      const promptId = await saveToLibrary({
        name: validName,
        prompt: validPrompt,
        category: validCategory,
        tags: validTags,
        userId: req.userId,
        isPublic: true,
      });

      res.json({
        success: true,
        promptId,
        message: 'Published to community!',
      });
    } catch (error: any) {
      console.error('[SmartAnalyze:Publish] Error:', error.message);
      res.status(500).json({ error: 'Failed to publish', details: error.message });
    }
  }
);

export default router;

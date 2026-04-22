import express, { Request, Response, NextFunction } from 'express';
import { chooseProvider } from '../lib/ai-providers/router.js';
import { getDb, connectToMongoDB } from '../db/mongodb.js';
import { prisma } from '../db/prisma.js';
import { pluginBridge } from '../lib/pluginBridge.js';
import { operationValidator } from '../lib/operationValidator.js';
import path from 'path';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { getUserIdFromToken } from '../utils/auth.js';
import { isSafeId, ensureString } from '../utils/validation.js';
import { rateLimit } from 'express-rate-limit';
import { redisClient } from '../lib/redis.js';
import { CACHE_TTL, CacheKey, hashObject } from '../lib/cache-utils.js';
import {
  buildSystemPrompt,
  buildSystemPromptV2,
  buildSmartPrompt,
  getPromptMode,
  buildDesignSystemContext,
  buildRetryFeedback,
  type PluginRequest,
  type DesignSystemJSON,
  type AssembledPrompt,
} from '../lib/figmaAgentPrompt.js';

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
    return { valid: false, error: `Invalid image type. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}` };
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
import { buildFormatPresetsContext } from '../lib/formatPresets.js';
import { scanAgentComponents, buildComponentsContext } from '../lib/componentScanner.js';
import { resolveContext, buildAgentContextPrompt } from '../lib/contextResolver.js';

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
        }),
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
    }),
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

const FREE_GENERATIONS_LIMIT = 4;

/**
 * Check if user can generate (reuses same logic as /payments/usage)
 */
async function checkCredits(userId: string): Promise<{ canGenerate: boolean; reason?: string; isByok?: boolean }> {
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
      : (freeGenerationsUsed < FREE_GENERATIONS_LIMIT && totalCredits > 0);

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

/**
 * Deduct one credit after successful operation (reuses same fields as payments)
 */
async function deductCredit(userId: string): Promise<void> {
  try {
    await connectToMongoDB();
    const db = getDb();
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) return;

    const hasActiveSubscription = user.subscriptionStatus === 'active';
    if (hasActiveSubscription) {
      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $inc: { creditsUsed: 1 } }
      );
    } else {
      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $inc: { freeGenerationsUsed: 1 } }
      );
    }
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
router.post('/agent-command', agentCommandLimiter, authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { fileId, operations } = req.body;
    const userId = req.userId;

    // Log for audit trail
    console.log(`[Plugin Agent] User ${userId} sending ${operations?.length || 0} operations to file ${fileId}`);

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

    // Push to plugin
    const result = await pluginBridge.push(fileId, validation.valid);

    if (!result.success) {
      return res.status(500).json({
        error: 'Plugin did not acknowledge operations',
        errors: result.errors,
      });
    }

    res.json({
      success: true,
      appliedCount: result.appliedCount,
    });
  } catch (err) {
    console.error('[Plugin Agent] Error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Unknown error',
    });
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
        const primaryColor = colors?.find(c => c.role === 'primary' || c.name?.toLowerCase().includes('primary'));
        if (primaryColor?.hex) {
          const hex = primaryColor.hex.replace('#', '');
          brand.primary = {
            r: parseInt(hex.slice(0, 2), 16) / 255,
            g: parseInt(hex.slice(2, 4), 16) / 255,
            b: parseInt(hex.slice(4, 6), 16) / 255,
          };
        }

        // Find background color
        const bgColor = colors?.find(c => c.role === 'background' || c.name?.toLowerCase().includes('background'));
        if (bgColor?.hex) {
          const hex = bgColor.hex.replace('#', '');
          brand.background = {
            r: parseInt(hex.slice(0, 2), 16) / 255,
            g: parseInt(hex.slice(2, 4), 16) / 255,
            b: parseInt(hex.slice(4, 6), 16) / 255,
          };
        }

        // Find text color
        const textColor = colors?.find(c => c.role === 'text' || c.name?.toLowerCase().includes('text'));
        if (textColor?.hex) {
          const hex = textColor.hex.replace('#', '');
          brand.text = {
            r: parseInt(hex.slice(0, 2), 16) / 255,
            g: parseInt(hex.slice(2, 4), 16) / 255,
            b: parseInt(hex.slice(4, 6), 16) / 255,
          };
        }

        // Find primary font
        const primaryFont = typography?.find(t => t.role === 'heading' || t.role === 'primary');
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
    const pluginCacheKey = CacheKey.pluginContext(fileId || 'public', brandGuidelineId || 'none', contextHash);
    const cachedContext = await redisClient.get(pluginCacheKey).catch(() => null);

    // ═══ BRANDED SOCIAL POSTS: Resolve effective brand context ═══
    const effectiveBrandFonts = brandFonts || (brandGuideline?.typography ? {
      primary: (brandGuideline.typography as any[]).find(t => t.role === 'primary' || t.role === 'heading'),
      secondary: (brandGuideline.typography as any[]).find(t => t.role === 'secondary' || t.role === 'body'),
    } : undefined);

    const effectiveBrandColors = selectedBrandColors || (brandGuideline?.colors ? 
      (brandGuideline.colors as any[]).map(c => ({ name: c.name, value: c.hex, role: c.role })) : 
      undefined);

    // ═══ BRANDED SOCIAL POSTS: Scan templates ═══
    let templateContext = '';
    if (fileId && pluginBridge.getSession(fileId)) {
      try {
        const templates = await scanTemplates(fileId);
        templateContext = buildTemplateContext(templates);
        if (templates.length > 0) {
          console.log(`[Plugin] Found ${templates.length} templates in file`);
          console.log(`[Plugin] Template IDs:`, templates.map(t => ({ id: t.id, name: t.name })));
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

    // ═══ BRANDED SOCIAL POSTS: Format presets ═══
    const formatPresetsContext = buildFormatPresetsContext();

    // FASE 3: Load or create session for chat memory
    let chatHistory = '';
    if (sessionId && fileId) {
      try {
        const db = getDb();
        const collection = db.collection<any>('plugin_sessions');

        const session = await collection.findOneAndUpdate(
          { _id: sessionId },
          {
            $set: { updatedAt: new Date(), fileId },
            $setOnInsert: { createdAt: new Date(), messages: [], context: {} }
          },
          { upsert: true, returnDocument: 'after' }
        );

        // Build chat history from last 10 messages (FASE 3)
        if (session && session.messages && session.messages.length > 0) {
          chatHistory = session.messages
            .slice(-10)
            .map((m: any) => `[${m.role.toUpperCase()}]: ${m.content}`)
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
    const tokenRegistry = buildTokenRegistry(
      brandGuideline || null,
      designSystem || null
    );

    // Get enforced prompt with pre-calculated RGB values
    const enforcedTokenPrompt = (tokenRegistry.colors.size > 0 || tokenRegistry.typography.size > 0)
      ? '\n' + buildEnforcedPrompt(tokenRegistry) + '\n'
      : '';

    // Build context-aware prompt (V1 or V2 based on feature flag)
    const promptMode = getPromptMode();
    let systemPrompt: string;
    let promptMeta: AssembledPrompt | undefined;

    if (promptMode === 'v2') {
      // AI-First: Dynamic intent-based prompt assembly (~70% fewer tokens)
      const assembled = buildSystemPromptV2(
        {
          command,
          selectedElements,
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
        chatHistory,
      );
      systemPrompt = assembled.system;
      promptMeta = assembled;
      console.log(`[Plugin] AI-First prompt: ${assembled.tokenEstimate} tokens, intent: ${assembled.intent.intent}, format: ${assembled.intent.format}, modules: [${assembled.modules.join(', ')}]`);

      // V2: Inject additional context at the end (simpler, no marker needed)
      const additionalContext = [
        brandChoiceContext,
        templateContext,
        agentComponentsContext,
        // Note: formatPresetsContext is built-in to V2
      ].filter(Boolean).join('\n\n');

      if (additionalContext) {
        systemPrompt += '\n\n' + additionalContext;
      }

      // Inject enforced token prompt
      if (enforcedTokenPrompt) {
        systemPrompt = enforcedTokenPrompt + '\n' + systemPrompt;
      }
    } else {
      // V1: Legacy monolithic prompt (backward compatible)
      systemPrompt = buildSystemPrompt(
        {
          command,
          selectedElements,
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
        },
        chatHistory,
        thinkMode
      );

      // ═══ BRANDED SOCIAL POSTS: Inject additional context ═══
      const additionalContext = [
        brandChoiceContext,
        templateContext,
        agentComponentsContext,
        formatPresetsContext,
      ].filter(Boolean).join('\n\n');

      if (additionalContext) {
        // Insert before "═══ OPERAÇÕES DISPONÍVEIS ═══"
        const insertPoint = systemPrompt.indexOf('═══ OPERAÇÕES DISPONÍVEIS ═══');
        if (insertPoint > 0) {
          systemPrompt = systemPrompt.slice(0, insertPoint) + additionalContext + '\n\n' + systemPrompt.slice(insertPoint);
        } else {
          systemPrompt += '\n\n' + additionalContext;
        }
      }

      // Inject enforced token prompt (replaces soft brand context with strict tokens)
      if (enforcedTokenPrompt) {
        systemPrompt = systemPrompt.replace(
          '═══ CONTEXTO DO ARQUIVO ═══',
          enforcedTokenPrompt + '\n═══ CONTEXTO DO ARQUIVO ═══'
        );
      }
    }

    const userPrompt = `═══ PEDIDO DO USUÁRIO ═══\n\n"${command}"`;

    // Generate operations using selected provider (with retry for V2)
    let operations: any[] = [];
    let usage: { inputTokens: number; outputTokens: number; totalTokens: number } | undefined;
    const generationStart = Date.now();
    const toolCallStartedAt = new Date().toISOString();
    const maxRetries = promptMode === 'v2' ? 1 : 0; // V2 gets 1 retry with feedback

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const isRetry = attempt > 0;
      const currentPrompt = isRetry
        ? systemPrompt + '\n\n' + buildRetryFeedback(
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

        console.log(`[Plugin] LLM generated ${operations.length} operations${isRetry ? ' (retry)' : ''}:`, operations.map((o: any) => o.type));

        // Debug: Show parent refs to diagnose hierarchy issues
        const hierarchy = operations.map((o: any, i: number) => {
          const parent = o.parentRef || o.parentNodeId || '(root)';
          return `[${i + 1}] ${o.type} "${o.props?.name || o.name || ''}" → parent: ${parent}`;
        });
        console.log(`[Plugin] Hierarchy:\n${hierarchy.join('\n')}`);

        if (operations.length > 0) {
          console.log(`[Plugin] First operation:`, JSON.stringify(operations[0]).slice(0, 300));
        }

        // V2: Check if retry is needed (>50% invalid operations)
        if (promptMode === 'v2' && !isRetry && operations.length > 0) {
          const preValidation = operationValidator.validateBatch(operations);
          const invalidRatio = preValidation.invalid.length / operations.length;
          if (invalidRatio > 0.5) {
            console.log(`[Plugin] V2 retry triggered: ${Math.round(invalidRatio * 100)}% invalid operations`);
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
    operations = operations.filter(
      (op) =>
        op &&
        op.type &&
        (op.nodeId ||
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
        tokenValidation.corrections.forEach(c => {
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
      `[Plugin API] [${provider.name}] Generated ${operations.length} op(s) for: "${command.substring(0, 60)}"`
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
    if (sessionId && fileId) {
      try {
        const db = getDb();
        const collection = db.collection<any>('plugin_sessions');
        await collection.updateOne(
          { _id: sessionId },
          {
            $push: {
              messages: {
                $each: [
                  { role: 'user', content: command, timestamp: new Date() },
                  { role: 'assistant', content: `Generated ${operations.length} operations`, operations, timestamp: new Date() }
                ]
              }
            } as any
          }
        );
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
    }

    const validOps = validation.valid;
    const warnings = validation.invalid.map(({ op, errors }) =>
      `${op.type}: ${errors.join(', ')}`
    );

    // Return validated operations to apply
    const toolCallRecord = {
      id: `tc-${Date.now()}`,
      name: 'generate_figma_operations',
      status: 'done' as const,
      args: { command: command.slice(0, 120) },
      startedAt: toolCallStartedAt,
      endedAt: new Date().toISOString(),
      summary: `${validOps.length} operation${validOps.length !== 1 ? 's' : ''} via ${provider.name}${warnings.length > 0 ? ` (${warnings.length} filtered)` : ''}`,
    };

    const responseData = {
      success: true,
      operations: validOps,
      message: `Generated ${validOps.length} operation(s)${warnings.length > 0 ? ` (${warnings.length} filtered)` : ''}`,
      provider: provider.name,
      warnings: warnings.length > 0 ? warnings : undefined,
      usage: usage || undefined,
      durationMs,
      toolCallRecord,
    };

    // Cache plugin context for 1 hour
    await redisClient.setex(
      pluginCacheKey,
      CACHE_TTL.PLUGIN_CTX,
      JSON.stringify(responseData)
    ).catch(() => null);
    console.log(`[Cache] SET plugin:${fileId?.slice(0, 8)}:${brandGuidelineId?.slice(0, 8)} (1h)`);

    res.json(responseData);

    // Deduct credit after successful response (non-blocking, only for authenticated non-BYOK users)
    const isByokUser = !!(userApiKey || userAnthropicKey);
    if (req.userId && !isByokUser && validOps.length > 0) {
      deductCredit(req.userId).catch(e => console.error('[Plugin] Credit deduction error:', e));
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
        : (freeGenerationsUsed < FREE_GENERATIONS_LIMIT && totalCredits > 0),
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
    if (!ALLOWED_IMAGE_DOMAINS.some(d => parsed.hostname.endsWith(d))) {
      return res.status(403).json({
        error: 'Domain not allowed',
        allowed: ALLOWED_IMAGE_DOMAINS
      });
    }

    // Fetch image
    const response = await fetch(imageUrl, {
      headers: { 'User-Agent': 'VisantCopilot/1.0' }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Upstream returned ${response.status}`
      });
    }

    // Set content type and pipe response
    const contentType = response.headers.get('content-type') || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    // MED-004 fix: Use configured frontend URL instead of wildcard
    const allowedOrigin = process.env.FRONTEND_URL?.split(',')[0] || '*';
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
router.post('/image-to-prompt', imageAnalysisLimiter, authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
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
    const result = await generateText(
      systemPrompt,
      IMAGE_ANALYSIS_USER_PROMPT,
      [{ mimeType: image.mimeType || 'image/png', data: image.base64 }]
    );

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
      usage: result.usage || null
    });

  } catch (error: any) {
    console.error('[ImageToPrompt] Error:', error.message);
    res.status(500).json({ error: 'Failed to analyze image', details: error.message });
  }
});

/**
 * POST /api/plugin/image-to-prompt/feedback
 * Submit feedback to improve prompt generation (persisted to MongoDB)
 * Admin only
 */
router.post('/image-to-prompt/feedback', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
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
});

/**
 * GET /api/plugin/image-to-prompt/stats
 * Get feedback statistics
 * Admin only
 */
router.get('/image-to-prompt/stats', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const stats = await getFeedbackStats();
    res.json({ success: true, stats });
  } catch (error: any) {
    console.error('[ImageToPrompt] Stats error:', error.message);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * POST /api/plugin/ui-to-image-prompt
 * Analyzes UI screenshot → generates prompt for image generation models
 * Admin only
 */
router.post('/ui-to-image-prompt', imageAnalysisLimiter, authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
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

    const result = await generateText(
      systemPrompt,
      userPrompt,
      [{ mimeType: image.mimeType || 'image/png', data: image.base64 }]
    );

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
      usage: result.usage || null
    });

  } catch (error: any) {
    console.error('[UItoImagePrompt] Error:', error.message);
    res.status(500).json({ error: 'Failed to analyze UI', details: error.message });
  }
});

/**
 * GET /api/plugin/prompt-library
 * Get user's saved prompts from library
 * Admin only
 */
router.get('/prompt-library', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { category } = req.query;
    const prompts = await getUserPrompts(req.userId!, category as string);
    res.json({ success: true, prompts });
  } catch (error: any) {
    console.error('[PromptLibrary] Error:', error.message);
    res.status(500).json({ error: 'Failed to get prompts' });
  }
});

/**
 * GET /api/plugin/prompt-library/similar
 * Find similar prompts for inspiration
 * Admin only
 */
router.get('/prompt-library/similar', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { componentType, tags } = req.query;
    const tagArray = typeof tags === 'string' ? tags.split(',') : undefined;
    const prompts = await findSimilar(componentType as string, tagArray, 10);
    res.json({ success: true, prompts });
  } catch (error: any) {
    console.error('[PromptLibrary] Error:', error.message);
    res.status(500).json({ error: 'Failed to find similar prompts' });
  }
});

/**
 * POST /api/plugin/prompt-library/:id/use
 * Mark prompt as used (increments usage count)
 * Admin only
 */
router.post('/prompt-library/:id/use', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
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
});

/**
 * POST /api/plugin/prompt-library/:id/rate
 * Rate a prompt (success/failure affects ranking)
 * Admin only
 */
router.post('/prompt-library/:id/rate', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
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
});

// ============ Smart Image Analyzer (Unified Endpoint) ============

/**
 * POST /api/plugin/smart-analyze
 * Unified endpoint: auto-detects image type and generates appropriate prompt
 * - mode: 'figma-plugin' → generates FigmaOperation[] JSON
 * - mode: 'image-gen' (default) → generates image generation prompt
 * Admin only
 */
router.post('/smart-analyze', imageAnalysisLimiter, authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { image, mode = 'image-gen', whiteLabel = false, params, refinements, currentPrompt, availableComponents, brandGuideline } = req.body;
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
        if (params.useAutoLayout === false) paramInstructions += '\n- NÃO use auto-layout neste componente.';
        if (params.useSemanticNaming) paramInstructions += '\n- Use nomes de camadas extremamente descritivos e semânticos em inglês.';
        if (params.useTokens) paramInstructions += '\n- Priorize o uso de variáveis e tokens de cores/tipografia disponíveis no workspace.';
        if (params.selectedFont) paramInstructions += `\n- Utilize a fonte "${params.selectedFont}" para todos os elementos de texto.`;
      } else {
        if (params.intensity === 'literal') paramInstructions += '\n- Seja extremamente literal: descreva apenas o que está visível, sem interpretações artísticas.';
        else if (params.intensity === 'creative') paramInstructions += '\n- Seja criativo: adicione elementos que melhorem a estética, iluminação dramática e detalhes que complementem o mood.';

        if (params.visualStyle && params.visualStyle !== 'auto') paramInstructions += `\n- Estilo visual desejado: ${params.visualStyle}.`;
        if (params.aspectRatio) paramInstructions += `\n- Proporção alvo (Aspect Ratio): ${params.aspectRatio}.`;
        if (params.selectedFont) paramInstructions += `\n- Sugira o uso da fonte "${params.selectedFont}" se houver texto na imagem.`;
      }
    }

    // Refinement Logic: If refinements are provided, we ask the AI to REWRITE the prompt
    let systemBase = mode === 'figma-plugin' 
      ? getFigmaOperationsSystem({ 
          availableComponents, 
          brandContext: brandGuideline?.guidelines?.voice 
        }) 
      : SMART_ANALYZER_SYSTEM;
    let userBase = mode === 'figma-plugin' ? FIGMA_OPERATIONS_USER : SMART_ANALYZER_USER;

    if (refinements && Array.isArray(refinements) && refinements.length > 0) {
      systemBase += `\n\nREFINAMENTO DE PROMPT:
      - O usuário deseja alterar o prompt gerado anteriormente.
      - Prompt Original: "${currentPrompt}"
      - Novas instruções/mudanças desejadas: ${refinements.join(', ')}
      - Sua tarefa é REESCREVER o prompt (ou operações) incorporando essas mudanças de forma fluida e profissional.
      - Mantenha a consistência com a imagem original, mas priorize as novas instruções.`;
      
      userBase = `Com base na imagem e no prompt original "${currentPrompt}", gere uma nova versão do prompt incorporando: ${refinements.join(', ')}.`;
    }

    // MODE: Figma Plugin Operations
    if (mode === 'figma-plugin') {
      const result = await generateText(
        systemBase + whiteLabelSuffix + (paramInstructions ? `\n\nREGRAS ADICIONAIS DE CUSTOMIZAÇÃO:${paramInstructions}` : ''),
        userBase,
        imageData
      );

      const parsed = parseFigmaOperationsResponse(result.text);

      if (!parsed) {
        return res.status(500).json({
          error: 'Failed to parse Figma operations',
          raw: result.text
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
      systemBase + whiteLabelSuffix + (paramInstructions ? `\n\nREGRAS ADICIONAIS DE CUSTOMIZAÇÃO:${paramInstructions}` : ''),
      userBase,
      imageData
    );

    const parsed = parseAnalyzerResponse(analysisResult.text);

    if (!parsed) {
      return res.status(500).json({
        error: 'Failed to parse image analysis',
        raw: analysisResult.text
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
});

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
router.post('/smart-analyze/publish', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
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
      ? tags.slice(0, 20).map(t => ensureString(t, 50)).filter((t): t is string => t !== null)
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
});

export default router;

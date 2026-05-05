/**
 * Platform MCP Server
 * Exposes Visant Labs platform tools for agents (Claude, Cursor, etc.)
 * Transport: HTTP/SSE (mounted in Express)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { ObjectId } from 'mongodb';
import { improvePrompt, describeImage } from '../services/geminiService.js';
import { getGeminiApiKey } from '../utils/geminiApiKey.js';
import { getCurrentUserId, runWithContext } from '../lib/request-context.js';
import { buildBrandContext } from '../lib/brandContextBuilder.js';

// ─── Structured error codes ───────────────────────────────────────────────────
function mcpError(code: string, message: string, extra?: Record<string, any>) {
  return jsonResponse({ error: { code, message, ...extra } });
}
const ERR = {
  auth: () => mcpError('UNAUTHORIZED', 'Authentication required. Connect with API key: Authorization: Bearer visant_sk_xxx'),
  notFound: (what: string) => mcpError('NOT_FOUND', `${what} not found`),
  credits: () => mcpError('INSUFFICIENT_CREDITS', 'Not enough credits to perform this operation'),
  validation: (msg: string) => mcpError('VALIDATION_ERROR', msg),
  internal: (msg: string) => mcpError('INTERNAL_ERROR', msg),
};

// ─── Hex color validation ─────────────────────────────────────────────────────
const hexColorRegex = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;
function validateColors(colors?: Array<{ hex: string; name: string; role?: string }>) {
  if (!colors) return null;
  for (const c of colors) {
    if (!hexColorRegex.test(c.hex)) return `Invalid hex color "${c.hex}" for "${c.name}". Expected format: #RRGGBB`;
  }
  return null;
}

// ─── Strategy deep merge ──────────────────────────────────────────────────────
function mergeStrategy(existing: any, patch: any): any {
  if (!patch) return existing;
  const base = existing || {};
  return {
    ...base,
    ...(patch.manifesto !== undefined ? { manifesto: patch.manifesto } : {}),
    ...(patch.positioning !== undefined ? { positioning: patch.positioning } : {}),
    ...(patch.archetypes !== undefined ? { archetypes: patch.archetypes } : {}),
    ...(patch.personas !== undefined ? { personas: patch.personas } : {}),
    ...(patch.voiceValues !== undefined ? { voiceValues: patch.voiceValues } : {}),
  };
}

// ═══════════════════════════════════════════
// Session auth context (AsyncLocalStorage-based)
// ═══════════════════════════════════════════

/**
 * @deprecated Use runWithContext() instead for request-scoped auth.
 * Kept for backward compatibility during migration.
 */
let _legacyUserId: string | null = null;
let _mcpScopes: string[] = ['read', 'write', 'generate'];

/**
 * Set MCP user ID for the current request scope.
 * Prefers AsyncLocalStorage, falls back to legacy global for compatibility.
 */
export function setMcpUserId(userId: string | null) {
  _legacyUserId = userId;
}

/** Set OAuth scopes for the current MCP request. */
export function setMcpScopes(scopes: string[]) {
  _mcpScopes = scopes;
}

/** Check if the current request has the required scope. */
function requireScope(scope: 'read' | 'write' | 'generate'): string | null {
  if (_mcpScopes.includes(scope)) return null;
  return `Insufficient scope: requires "${scope}" but token has [${_mcpScopes.join(', ')}]`;
}

/**
 * Get current user ID from AsyncLocalStorage or legacy fallback.
 */
function getMcpUserId(): string | null {
  // Prefer AsyncLocalStorage (request-scoped, safe for concurrent requests)
  const contextUserId = getCurrentUserId();
  if (contextUserId) return contextUserId;

  // Fallback to legacy global (for backward compatibility)
  return _legacyUserId;
}

async function getQuotaMeta(userId: string) {
  await connectToMongoDB();
  const db = getDb();
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
  if (!user) return null;

  const FREE_GENERATIONS_LIMIT = 10;
  const FREE_MONTHLY_CREDITS = 20;

  // Auto-renew credits if reset date has passed
  let creditsUsed = user.creditsUsed || 0;
  const creditsResetDate = user.creditsResetDate ? new Date(user.creditsResetDate) : null;
  if (creditsResetDate && new Date() >= creditsResetDate) {
    const nextReset = user.subscriptionEndDate
      ? new Date(user.subscriptionEndDate)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { creditsUsed: 0, creditsResetDate: nextReset } }
    );
    creditsUsed = 0;
  }

  const plan = user.subscriptionStatus || 'free';
  const monthlyCredits = user.monthlyCredits ?? FREE_MONTHLY_CREDITS;
  const totalCreditsEarned = user.totalCreditsEarned ?? 0;
  const monthlyRemaining = Math.max(0, monthlyCredits - creditsUsed);
  const credits_remaining = totalCreditsEarned + monthlyRemaining;
  const freeGenerationsUsed = user.freeGenerationsUsed || 0;
  const hasActiveSubscription = plan === 'active';
  const can_generate = hasActiveSubscription
    ? credits_remaining > 0
    : totalCreditsEarned > 0 || (freeGenerationsUsed < FREE_GENERATIONS_LIMIT && credits_remaining > 0);

  return {
    credits_remaining,
    credits_used: creditsUsed,
    earned_credits: totalCreditsEarned,
    monthly_credits: monthlyCredits,
    plan,
    can_generate,
    reset_date: creditsResetDate?.toISOString() ?? null,
  };
}


function jsonResponse(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

/** Base URL for internal API calls (reuses existing route logic for credits, validation, etc.) */
const INTERNAL_API_BASE = process.env.INTERNAL_API_URL || `http://localhost:${process.env.PORT || 3001}`;

// ─── Dynamic tool registry ────────────────────────────────────────────────────
// Populated by createPlatformMcpServer() on first call; stable after that.
let _registeredToolNames: string[] = [];

/** Returns the live list of tool names registered in the platform MCP server. */
export function getMcpToolNames(): string[] { return _registeredToolNames; }
/** Returns the live count of tools registered in the platform MCP server. */
export function getMcpToolCount(): number { return _registeredToolNames.length; }

/**
 * Creates and returns a Platform MCP server with all tools registered.
 */
export function createPlatformMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: 'visant-platform',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Wrap server.tool to auto-collect names + enforce OAuth scopes
  const collectedNames: string[] = [];
  const originalTool = server.tool.bind(server);

  const WRITE_TOOLS = /^(update-|delete-|create-|remove-|validate-|api-key-|auth-)/;
  const GENERATE_TOOLS = /^(generate-|improve-|suggest-|extract-|batch-|campaign-|describe-)/;

  function scopeForTool(name: string): 'read' | 'write' | 'generate' {
    if (WRITE_TOOLS.test(name)) return 'write';
    if (GENERATE_TOOLS.test(name)) return 'generate';
    return 'read';
  }

  (server as any).tool = (name: string, ...rest: any[]) => {
    collectedNames.push(name);
    // Intercept the handler (last arg) to add scope checking
    const handlerIdx = rest.length - 1;
    const originalHandler = rest[handlerIdx];
    if (typeof originalHandler === 'function') {
      rest[handlerIdx] = async (...args: any[]) => {
        const scopeErr = requireScope(scopeForTool(name));
        if (scopeErr) return mcpError('FORBIDDEN', scopeErr);
        return originalHandler(...args);
      };
    }
    return (originalTool as any)(name, ...rest);
  };

  // ═══════════════════════════════════════════
  // Auth — Register & Login (public, no API key required)
  // ═══════════════════════════════════════════

  server.tool(
    'auth-register',
    'Create a new Visant Labs account. Returns a JWT token and user info. After registering, use api-key-create (passing the JWT) to generate a visant_sk_xxx API key for MCP/API access.',
    {
      email: z.string().email().describe('User email address.'),
      password: z.string().min(8).describe('Password (min 8 characters).'),
      name: z.string().optional().describe('Display name.'),
    },
    async ({ email, password, name }) => {
      try {
        const resp = await fetch(`${INTERNAL_API_BASE}/api/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name: name || email.split('@')[0] }),
        });
        const result = await resp.json() as any;
        if (!resp.ok) return ERR.validation(result?.error || result?.message || `Registration failed (${resp.status})`);
        return jsonResponse({
          message: 'Account created. Use api-key-create with the returned token to generate your visant_sk_xxx API key.',
          token: result.token,
          user: { id: result.user?.id, email: result.user?.email, name: result.user?.name },
        });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'auth-login',
    'Sign in to an existing Visant Labs account. Returns a JWT token. Use api-key-create (passing this token) to generate a visant_sk_xxx API key for persistent MCP/API access.',
    {
      email: z.string().email().describe('Account email.'),
      password: z.string().describe('Account password.'),
    },
    async ({ email, password }) => {
      try {
        const resp = await fetch(`${INTERNAL_API_BASE}/api/auth/signin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const result = await resp.json() as any;
        if (!resp.ok) return ERR.validation(result?.error || result?.message || `Login failed (${resp.status})`);
        return jsonResponse({
          message: 'Signed in. Use api-key-create with this token to generate a persistent visant_sk_xxx API key.',
          token: result.token,
          user: { id: result.user?.id, email: result.user?.email, name: result.user?.name },
        });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'api-key-create',
    'Create a new Visant API key (visant_sk_xxx). Requires either an active API key (Bearer token) OR a JWT from auth-login/auth-register. The raw key is shown only once — save it immediately.',
    {
      name: z.string().max(100).describe('A label for this key, e.g. "Claude.ai MCP" or "Production".'),
      scopes: z.array(z.enum(['read', 'write', 'generate'])).default(['read', 'write', 'generate']).describe('Permission scopes.'),
      jwt: z.string().optional().describe('JWT token from auth-login or auth-register (if you have no API key yet).'),
    },
    async ({ name, scopes, jwt }) => {
      const currentUserId = getMcpUserId();
      // Allow either MCP API key auth OR a JWT passed directly
      const authHeader = currentUserId
        ? `x-mcp-user-id: ${currentUserId}` // will be handled below
        : jwt ? null : null;

      if (!currentUserId && !jwt) {
        return ERR.validation('Authentication required. Pass a JWT from auth-login, or connect with an existing API key.');
      }
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (currentUserId) {
          headers['x-mcp-user-id'] = currentUserId;
        } else if (jwt) {
          headers['Authorization'] = `Bearer ${jwt}`;
        }
        const resp = await fetch(`${INTERNAL_API_BASE}/api/api-keys/create`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name, scopes }),
        });
        const result = await resp.json() as any;
        if (!resp.ok) return ERR.internal(result?.error || `Key creation failed (${resp.status})`);
        return jsonResponse({
          message: 'API key created. Save the key — it will not be shown again.',
          key: result.key,
          keyPrefix: result.keyPrefix,
          name: result.name,
          scopes: result.scopes,
          usage: 'Authorization: Bearer ' + result.key,
          mcpUrl: 'https://visantlabs.com/api/mcp',
        });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'api-key-list',
    'List all API keys for the authenticated user. Shows prefix, name, scopes, last used, and expiry — but not the raw key value.',
    {},
    async () => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const resp = await fetch(`${INTERNAL_API_BASE}/api/api-keys`, {
          headers: { 'x-mcp-user-id': currentUserId },
        });
        const result = await resp.json() as any;
        if (!resp.ok) return ERR.internal(result?.error || `Failed to list keys (${resp.status})`);
        return jsonResponse({ keys: result.keys });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Moodboard — Detect, Upscale, Suggest
  // ═══════════════════════════════════════════

  server.tool(
    'moodboard-detect-grid',
    'Detect individual image bounding boxes in a moodboard or grid image. Returns cell coordinates so each section can be cropped and extracted individually.',
    {
      imageBase64: z.string().describe('Base64-encoded moodboard image to analyze.'),
    },
    async ({ imageBase64 }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const resp = await fetch(`${INTERNAL_API_BASE}/api/moodboard/detect-grid`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ imageBase64 }),
        });
        const result = await resp.json() as any;
        if (!resp.ok) return ERR.internal(result?.error || `Detection failed (${resp.status})`);
        return jsonResponse({ boxes: result.boxes, count: result.boxes?.length ?? 0 });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'moodboard-upscale',
    'Upscale an image to 1K, 2K, or 4K resolution using Gemini image enhancement. Use after extracting a cell from a moodboard to get a high-resolution standalone version.',
    {
      imageBase64: z.string().describe('Base64-encoded image to upscale.'),
      size: z.enum(['1K', '2K', '4K']).default('4K').describe('Target resolution.'),
    },
    async ({ imageBase64, size }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const resp = await fetch(`${INTERNAL_API_BASE}/api/moodboard/upscale`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ imageBase64, size }),
        });
        const result = await resp.json() as any;
        if (!resp.ok) return ERR.internal(result?.error || `Upscale failed (${resp.status})`);
        return jsonResponse({ upscaledBase64: result.upscaledBase64, size });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'moodboard-suggest',
    'Analyze images from a moodboard and suggest Remotion animation presets and Veo video generation prompts for each cell. Useful for turning static moodboard cells into motion content.',
    {
      images: z.array(z.object({
        id: z.string().describe('Cell identifier (e.g. "cell-1").'),
        base64: z.string().describe('Base64-encoded image data for this cell.'),
      })).min(1).max(9).describe('Array of moodboard cells to analyze.'),
    },
    async ({ images }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const resp = await fetch(`${INTERNAL_API_BASE}/api/moodboard/suggest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ images }),
        });
        const result = await resp.json() as any;
        if (!resp.ok) return ERR.internal(result?.error || `Suggest failed (${resp.status})`);
        return jsonResponse({ suggestions: result.suggestions });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Account
  // ═══════════════════════════════════════════

  server.tool(
    'account-usage',
    'Get credit usage, remaining balance, plan limits, and billing cycle info for the authenticated account.',
    {},
    async () => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const quota = await getQuotaMeta(currentUserId);
        if (!quota) return jsonResponse({ error: 'User not found' });
        return jsonResponse({ ...quota, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'account-profile',
    'Get the authenticated user profile including name, email, avatar, and subscription plan.',
    {},
    async () => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        await connectToMongoDB();
        const db = getDb();
        const user = await db.collection('users').findOne(
          { _id: new ObjectId(currentUserId) },
          { projection: { _id: 1, name: 1, email: 1, picture: 1, subscriptionStatus: 1, username: 1, bio: 1, createdAt: 1 } }
        );
        if (!user) return jsonResponse({ error: 'User not found' });
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ id: currentUserId, ...user, _id: undefined, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Mockups
  // ═══════════════════════════════════════════

  server.tool(
    'mockup-list',
    'List mockups created by the authenticated user. Supports pagination.',
    {
      limit: z.number().int().min(1).max(100).default(20).describe('Max items to return (1-100).'),
      skip: z.number().int().min(0).default(0).describe('Number of items to skip for pagination.'),
    },
    async ({ limit, skip }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const mockups = await prisma.mockup.findMany({
          where: { userId: currentUserId },
          take: limit,
          skip,
          orderBy: { createdAt: 'desc' },
          select: { id: true, prompt: true, imageUrl: true, designType: true, tags: true, aspectRatio: true, createdAt: true },
        });
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ mockups, total: mockups.length, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'mockup-get',
    'Get a single mockup by its ID, including image URL, prompt, and metadata.',
    {
      id: z.string().describe('The mockup ID.'),
    },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const mockup = await prisma.mockup.findFirst({
          where: { id, userId: currentUserId },
        });
        if (!mockup) return jsonResponse({ error: 'Mockup not found' });
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ ...mockup, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'mockup-presets',
    'Browse available mockup presets filtered by design type (e.g. business-card, social-media, packaging).',
    {
      type: z
        .enum([
          'business-card',
          'social-media',
          'packaging',
          'apparel',
          'stationery',
          'device',
          'signage',
          'print',
          'other',
        ])
        .describe('The preset category to browse.'),
    },
    async ({ type }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const db = await connectToMongoDB();
        const presets = await db.collection('mockup_presets').find({ type }).toArray();
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ presets, total: presets.length, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // AI Image Generation (simple, no brand/layout overhead)
  // ═══════════════════════════════════════════
  server.tool(
    'ai-generate-image',
    'Generate an AI image from a text prompt. Simple and direct — no brand injection, no layout plans, no project saving. Just prompt → image. Ideal for concept exploration, moodboards, visual references, and creative brainstorming. Costs credits based on model and resolution.',
    {
      prompt: z.string().min(1).describe('Image description. Be specific about style, composition, colors, lighting, and mood.'),
      model: z.enum(['gpt-image-2', 'gpt-image-1', 'gemini-3.1-flash-image-preview', 'seedream-3-0']).default('gpt-image-2').describe('Image model. gpt-image-2=best quality, gemini=fast/creative, seedream=photorealistic.'),
      aspectRatio: z.enum(['1:1', '9:16', '16:9', '4:5']).default('1:1').describe('Output aspect ratio.'),
      resolution: z.enum(['1K', '2K', '4K']).default('1K').describe('Output resolution. Higher = more credits.'),
      referenceImages: z.array(z.string()).optional().describe('Reference image URLs to guide style/composition.'),
      seed: z.number().int().optional().describe('Random seed for reproducible generation (model-dependent).'),
    },
    async ({ prompt, model, aspectRatio, resolution, referenceImages, seed }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/mockups/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({
            promptText: prompt,
            model,
            aspectRatio,
            resolution,
            designType: 'blank',
            referenceImages,
            seed,
            feature: 'agent',
          }),
        });
        const result = await response.json() as any;
        if (!response.ok) return ERR.internal(result.error || `Image generation failed (${response.status})`);
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({
          imageUrl: result.imageUrl || null,
          model,
          aspectRatio,
          resolution,
          seed: result.seed ?? seed ?? null,
          creditsUsed: result.creditsUsed ?? null,
          _meta: quota,
        });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'mockup-generate',
    'Generate a mockup image using AI. Brand context (colors, typography, logos, voice) is auto-injected when brandGuidelineId is provided — never describe the logo in the prompt. Costs credits based on model and resolution.',
    {
      prompt: z.string().min(1).describe('Scene description. Do NOT describe the logo or font — they are injected automatically from brandGuidelineId.'),
      brandGuidelineId: z.string().optional().describe('Brand guideline ID. Injects logo (as reference image), colors, typography, voice, and strategy into the generation automatically.'),
      model: z.enum(['gpt-image-2', 'gpt-image-1', 'gemini-3.1-flash-image-preview', 'seedream-3-0']).default('gpt-image-2').describe('Image model. gpt-image-2=best quality+brand fidelity, gemini=fast/creative, seedream=photorealistic lifestyle.'),
      provider: z.enum(['openai', 'gemini', 'seedream']).optional().describe('Provider override. Inferred from model by default. Use to force a specific provider when model name is ambiguous.'),
      aspectRatio: z.enum(['1:1', '9:16', '16:9', '4:5']).default('1:1').describe('Output aspect ratio. 1:1=square/Instagram, 9:16=story/Reels, 16:9=landscape/cover, 4:5=portrait feed.'),
      resolution: z.enum(['1K', '2K', '4K']).default('1K').describe('Output resolution. 1K=standard, 2K=high quality, 4K=print/large format. Higher = more credits.'),
      designType: z.string().optional().describe('Design type hint: business-card, social-media, packaging, apparel, signage, etc.'),
      baseImageUrl: z.string().optional().describe('Base image URL for image-to-image generation (optional).'),
      referenceImages: z.array(z.string()).optional().describe('Additional reference image URLs to guide style/composition. Brand logos are injected automatically via brandGuidelineId — use this for extra style references only.'),
      seed: z.number().int().optional().describe('Random seed for deterministic/reproducible generation. Same seed + same prompt = same image (model-dependent).'),
    },
    async ({ prompt, brandGuidelineId, model, provider, aspectRatio, resolution, designType, baseImageUrl, referenceImages, seed }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/mockups/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({
            promptText: prompt,
            brandGuidelineId,
            model,
            provider,
            aspectRatio,
            resolution,
            designType: designType || 'blank',
            baseImageUrl,
            referenceImages,
            seed,
            feature: 'agent',
          }),
        });
        const result = await response.json() as any;
        if (!response.ok) return ERR.internal(result.error || `Generation failed (${response.status})`);
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({
          imageUrl: result.imageUrl || null,
          mockupId: result.id || result.mockup?.id || null,
          hasImage: !!result.imageBase64 || !!result.imageUrl,
          model,
          provider: result.provider || provider,
          aspectRatio,
          resolution,
          seed: result.seed ?? seed ?? null,
          creditsUsed: result.creditsUsed ?? null,
          _meta: quota,
        });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Branding
  // ═══════════════════════════════════════════

  server.tool(
    'branding-list',
    'List branding projects owned by the authenticated user.',
    {},
    async () => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const projects = await prisma.brandingProject.findMany({
          where: { userId: currentUserId },
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, prompt: true, createdAt: true },
        });
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ projects, total: projects.length, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'branding-get',
    'Get a branding project by ID, including logo, colors, typography, and brand assets.',
    {
      id: z.string().describe('The branding project ID.'),
    },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const project = await prisma.brandingProject.findFirst({
          where: { id, userId: currentUserId },
        });
        if (!project) return jsonResponse({ error: 'Branding project not found' });
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ ...project, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'branding-generate',
    'Generate brand identity elements from a text prompt. Use step="full" for complete generation or target a specific step for iterative refinement. Costs credits.',
    {
      prompt: z.string().min(1).describe('Brand brief (e.g. "modern tech startup called Acme, targets developers, dark aesthetic").'),
      step: z.enum([
        'full', 'market-research', 'swot', 'persona', 'archetype', 'concept-ideas', 'color-palettes', 'moodboard',
        'visant-full', 'visant-central-message', 'visant-market-research', 'visant-persona', 'visant-archetypes-tone',
        'visant-manifesto', 'visant-swot', 'visant-color-palette', 'visant-typography', 'visant-graphic-system', 'visant-logo-concept',
      ]).default('full').describe('Generation step. "full" runs the legacy pipeline. "visant-full" runs the complete Metodologia Visant pipeline (10 steps). Use "visant-*" steps for the new methodology.'),
      previousData: z.record(z.string(), z.unknown()).optional().describe('Output from a previous step to use as context for the next step. Pass the result of the previous branding-generate call here.'),
      brandGuidelineId: z.string().optional().describe('Existing brand guideline ID to use as context/reference.'),
    },
    async ({ prompt, step, previousData, brandGuidelineId }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();

      const visantStepMap: Record<string, number> = {
        'visant-central-message': 101, 'visant-market-research': 102, 'visant-persona': 103,
        'visant-archetypes-tone': 104, 'visant-manifesto': 105, 'visant-swot': 106,
        'visant-color-palette': 107, 'visant-typography': 108, 'visant-graphic-system': 109, 'visant-logo-concept': 110,
      };

      const isVisantFull = step === 'visant-full';
      const visantSteps = isVisantFull ? [101, 102, 103, 104, 105, 106, 107, 108, 109, 110] : [];

      try {
        if (isVisantFull) {
          let accumulatedData: any = previousData || {};
          const results: any[] = [];
          for (const stepNum of visantSteps) {
            const response = await fetch(`${INTERNAL_API_BASE}/api/branding/generate-step`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
              body: JSON.stringify({ prompt, step: stepNum, previousData: accumulatedData, feature: 'agent' }),
            });
            const result = await response.json() as any;
            if (!response.ok) return ERR.internal(result.error || `Visant step ${stepNum} failed`);
            // Accumulate data for cascading context
            if (result.data) {
              if (stepNum === 101) { accumulatedData.centralMessage = result.data.centralMessage; accumulatedData.pillars = result.data.pillars; accumulatedData.version = 'v2'; }
              else if (stepNum === 102) accumulatedData.marketResearchV2 = result.data;
              else if (stepNum === 103) accumulatedData.personaV2 = result.data;
              else if (stepNum === 104) { accumulatedData.archetypesV2 = result.data.archetypes; accumulatedData.toneOfVoice = result.data.toneOfVoice; }
              else if (stepNum === 105) accumulatedData.manifesto = result.data;
              else if (stepNum === 106) accumulatedData.swot = result.data;
              else if (stepNum === 107) accumulatedData.colorPaletteV2 = result.data;
              else if (stepNum === 108) accumulatedData.typography = result.data;
              else if (stepNum === 109) accumulatedData.graphicSystem = result.data;
              else if (stepNum === 110) accumulatedData.logoConcept = result.data;
            }
            results.push({ step: stepNum, data: result.data });
          }
          const quota = await getQuotaMeta(currentUserId);
          return jsonResponse({ brandingData: accumulatedData, steps: results, _meta: quota });
        }

        const resolvedStep = visantStepMap[step] || step;
        const response = await fetch(`${INTERNAL_API_BASE}/api/branding/generate-step`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ prompt, step: resolvedStep, previousData, brandGuidelineId, feature: 'agent' }),
        });
        const result = await response.json() as any;
        if (!response.ok) return ERR.internal(result.error || `Branding generation failed (${response.status})`);
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ ...result, step, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Canvas
  // ═══════════════════════════════════════════

  server.tool(
    'canvas-list',
    'List canvas (whiteboard) projects owned by the authenticated user.',
    {},
    async () => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const projects = await prisma.canvasProject.findMany({
          where: { userId: currentUserId },
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, createdAt: true, shareId: true },
        });
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ projects, total: projects.length, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'canvas-get',
    'Get a canvas project by ID, including elements, collaborators, and metadata.',
    {
      id: z.string().describe('The canvas project ID.'),
    },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const project = await prisma.canvasProject.findFirst({
          where: { id, userId: currentUserId },
        });
        if (!project) return jsonResponse({ error: 'Canvas project not found' });
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ ...project, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'canvas-create',
    'Create a new empty canvas (whiteboard) project.',
    {
      name: z.string().min(1).describe('Name for the new canvas.'),
    },
    async ({ name }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const project = await prisma.canvasProject.create({
          data: { userId: currentUserId, name, nodes: [], edges: [] },
        });
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ ...project, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Budget
  // ═══════════════════════════════════════════

  server.tool(
    'budget-list',
    'List budget documents created by the authenticated user.',
    {},
    async () => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const budgets = await prisma.budgetProject.findMany({
          where: { userId: currentUserId },
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, clientName: true, template: true, createdAt: true },
        });
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ budgets, total: budgets.length, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'budget-get',
    'Get a budget document by ID, including line items, totals, and client info.',
    {
      id: z.string().describe('The budget document ID.'),
    },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const budget = await prisma.budgetProject.findFirst({
          where: { id, userId: currentUserId },
        });
        if (!budget) return jsonResponse({ error: 'Budget not found' });
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ ...budget, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'budget-create',
    'Create a new budget document with client and project details. Returns the created budget.',
    {
      clientName: z.string().min(1).describe('Client or company name.'),
      projectDescription: z.string().min(1).describe('Brief description of the project scope.'),
      brandName: z.string().optional().describe('Brand name if different from client name.'),
    },
    async ({ clientName, projectDescription, brandName }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const budget = await prisma.budgetProject.create({
          data: {
            userId: currentUserId,
            template: 'default',
            name: `${clientName} - Budget`,
            clientName,
            projectDescription,
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            deliverables: [],
            links: {},
            faq: [],
            brandColors: [],
            brandName: brandName || clientName,
            data: { clientName, projectDescription, brandName: brandName || clientName },
          },
        });
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ ...budget, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // AI Utilities
  // ═══════════════════════════════════════════

  server.tool(
    'ai-improve-prompt',
    'Enhance and refine a text prompt using AI to produce better generation results. Free, no credit cost.',
    {
      prompt: z.string().min(1).describe('The original prompt to improve.'),
    },
    async ({ prompt }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        let userApiKey: string | undefined;
        try { userApiKey = await getGeminiApiKey(currentUserId); } catch { /* use system key */ }
        const result = await improvePrompt(prompt, userApiKey);
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ improvedPrompt: result.improvedPrompt, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'ai-describe-image',
    'Analyze an image and return a detailed text description. Provide either a URL or base64-encoded data. Free, no credit cost.',
    {
      imageUrl: z.string().url().optional().describe('Public URL of the image to analyze.'),
      base64: z.string().optional().describe('Base64-encoded image data (include data URI prefix or raw base64).'),
    },
    async ({ imageUrl, base64 }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        if (!imageUrl && !base64) {
          return jsonResponse({ error: 'Provide either imageUrl or base64.' });
        }

        let userApiKey: string | undefined;
        try { userApiKey = await getGeminiApiKey(currentUserId); } catch { /* use system key */ }

        // Build image input
        const imageInput = base64
          ? { base64, mimeType: 'image/png' }
          : imageUrl!;

        const result = await describeImage(imageInput as any, userApiKey);
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ description: result.description, title: result.title, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Image Extraction
  // ═══════════════════════════════════════════

  server.tool(
    'document-extract',
    'Extract high-resolution images from any public URL (Behance, Pinterest, Dribbble, portfolios, blogs). Returns a list of image URLs with metadata. Supports lazy-loaded images, srcset, and background images.',
    {
      url: z.string().url().describe('The public URL to extract images from (e.g. Behance gallery, portfolio page).'),
      limit: z.number().min(1).max(200).default(80).describe('Maximum number of images to return (default 80).'),
    },
    async ({ url, limit }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      const scopeErr = requireScope('read');
      if (scopeErr) return mcpError('FORBIDDEN', scopeErr);
      try {
        const resp = await fetch(`${INTERNAL_API_BASE}/api/images/extract-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-mcp-user-id': currentUserId,
          },
          body: JSON.stringify({ url, limit }),
        });
        const result = await resp.json() as any;
        if (!resp.ok) return ERR.internal(result?.error || 'Extraction failed');
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ ...result, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Brand Guidelines
  // ═══════════════════════════════════════════

  server.tool(
    'brand-guidelines-list',
    'List all brand guidelines (identity vaults) owned by the authenticated user.',
    {},
    async () => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const guidelines = await prisma.brandGuideline.findMany({
          where: { userId: currentUserId },
          orderBy: { updatedAt: 'desc' },
          select: { id: true, identity: true, isPublic: true, publicSlug: true, updatedAt: true },
        });
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ guidelines, total: guidelines.length, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'brand-guidelines-get',
    'Get a detailed brand guideline by ID, including colors, typography, logos, and strategy context.',
    {
      id: z.string().describe('The brand guideline ID.'),
      format: z.enum(['structured', 'prompt']).default('structured').describe('Output format: "structured" (JSON) or "prompt" (LLM-ready text).'),
    },
    async ({ id, format }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const guideline = await prisma.brandGuideline.findFirst({
          where: { id, userId: currentUserId },
        });
        if (!guideline) return jsonResponse({ error: 'Brand guideline not found' });
        
        const quota = await getQuotaMeta(currentUserId);

        if (format === 'prompt') {
          const context = buildBrandContext(guideline as any);
          return jsonResponse({ context, id: guideline.id, _meta: quota });
        }

        return jsonResponse({ ...guideline, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'brand-guidelines-public',
    'Get a public brand guideline by its slug. No authentication required.',
    {
      slug: z.string().describe('The public slug of the brand guideline.'),
    },
    async ({ slug }) => {
      try {
        const guideline = await prisma.brandGuideline.findFirst({
          where: { publicSlug: slug, isPublic: true },
        });
        if (!guideline) return jsonResponse({ error: 'Public brand guideline not found or not public' });
        
        // Return without userId for privacy
        const { userId, ...publicData } = guideline as any;
        return jsonResponse({ guideline: publicData });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Brand Guidelines — Write Operations
  // ═══════════════════════════════════════════

  server.tool(
    'brand-guidelines-create',
    'Create a new brand guideline. Provide at minimum an identity.name. All other sections (colors, typography, guidelines, strategy, tokens) are optional and can be added now or via brand-guidelines-update later.',
    {
      identity: z.object({
        name: z.string().describe('Brand name (required).'),
        tagline: z.string().optional(),
        website: z.string().optional(),
        description: z.string().optional(),
      }).describe('Brand identity.'),
      colors: z.array(z.object({
        hex: z.string().describe('Hex color e.g. #FF5733'),
        name: z.string(),
        role: z.string().optional().describe('e.g. primary, secondary, background, text, accent'),
      })).optional(),
      typography: z.array(z.object({
        family: z.string(),
        role: z.string().describe('e.g. heading, body, accent, mono'),
        style: z.string().optional().describe('e.g. Bold, Regular, SemiBold'),
        size: z.number().optional(),
      })).optional(),
      guidelines: z.object({
        voice: z.string().optional().describe('Brand tone of voice description.'),
        dos: z.array(z.string()).optional(),
        donts: z.array(z.string()).optional(),
        imagery: z.string().optional(),
        accessibility: z.string().optional(),
      }).optional(),
      strategy: z.object({
        manifesto: z.string().optional(),
        positioning: z.array(z.string()).optional(),
        archetypes: z.array(z.object({
          name: z.string(),
          role: z.enum(['primary', 'secondary']).optional(),
          description: z.string(),
          examples: z.array(z.string()).optional(),
        })).optional(),
        personas: z.array(z.object({
          name: z.string(),
          age: z.number().optional(),
          occupation: z.string().optional(),
          traits: z.array(z.string()).optional(),
          bio: z.string().optional(),
          desires: z.array(z.string()).optional(),
          painPoints: z.array(z.string()).optional(),
        })).optional(),
        voiceValues: z.array(z.object({
          title: z.string(),
          description: z.string(),
          example: z.string(),
        })).optional(),
      }).optional(),
      tokens: z.object({
        spacing: z.record(z.string(), z.number()).optional(),
        radius: z.record(z.string(), z.number()).optional(),
      }).optional(),
    },
    async (input) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      if (!input.identity?.name?.trim()) return ERR.validation('identity.name is required');
      const colorErr = validateColors(input.colors);
      if (colorErr) return ERR.validation(colorErr);
      try {
        const quota = await getQuotaMeta(currentUserId);
        const guideline = await prisma.brandGuideline.create({
          data: {
            userId: currentUserId,
            identity: input.identity as any,
            colors: input.colors as any ?? undefined,
            typography: input.typography as any ?? undefined,
            guidelines: input.guidelines as any ?? undefined,
            strategy: input.strategy as any ?? undefined,
            tokens: input.tokens as any ?? undefined,
            extraction: { sources: [{ type: 'manual', date: new Date().toISOString() }], completeness: 0 } as any,
          },
        });
        return jsonResponse({ guideline: { id: guideline.id, identity: guideline.identity }, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'brand-guidelines-update',
    'Patch one or more sections of an existing brand guideline. Only the fields you provide are updated — others remain unchanged. Use this to iteratively build or refine a guideline section by section.',
    {
      id: z.string().describe('The brand guideline ID to update.'),
      identity: z.object({
        name: z.string().optional(),
        tagline: z.string().optional(),
        website: z.string().optional(),
        description: z.string().optional(),
      }).optional(),
      colors: z.array(z.object({
        hex: z.string(),
        name: z.string(),
        role: z.string().optional().describe('e.g. primary, secondary, background, text, accent, cta'),
      })).optional().describe('Replaces the full colors array.'),
      typography: z.array(z.object({
        family: z.string(),
        role: z.string(),
        style: z.string().optional(),
        size: z.number().optional(),
        lineHeight: z.number().optional(),
      })).optional().describe('Replaces the full typography array.'),
      guidelines: z.object({
        voice: z.string().optional(),
        dos: z.array(z.string()).optional(),
        donts: z.array(z.string()).optional(),
        imagery: z.string().optional(),
        accessibility: z.string().optional(),
      }).optional(),
      strategy: z.object({
        manifesto: z.string().optional(),
        positioning: z.array(z.string()).optional(),
        archetypes: z.array(z.object({
          name: z.string(),
          role: z.enum(['primary', 'secondary']).optional(),
          description: z.string(),
          examples: z.array(z.string()).optional(),
        })).optional(),
        personas: z.array(z.object({
          name: z.string(),
          age: z.number().optional(),
          occupation: z.string().optional(),
          traits: z.array(z.string()).optional(),
          bio: z.string().optional(),
          desires: z.array(z.string()).optional(),
          painPoints: z.array(z.string()).optional(),
        })).optional(),
        voiceValues: z.array(z.object({
          title: z.string(),
          description: z.string(),
          example: z.string(),
        })).optional(),
      }).optional(),
      tokens: z.object({
        spacing: z.record(z.string(), z.number()).optional(),
        radius: z.record(z.string(), z.number()).optional(),
      }).optional(),
      tags: z.record(z.string(), z.array(z.string())).optional().describe('Industry/keyword tags by category, e.g. { "style": ["premium", "minimal"] }'),
    },
    async ({ id, ...patch }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      const colorErr = validateColors(patch.colors);
      if (colorErr) return ERR.validation(colorErr);
      try {
        const existing = await prisma.brandGuideline.findFirst({
          where: { id, userId: currentUserId },
        });
        if (!existing) return ERR.notFound('Brand guideline');

        const quota = await getQuotaMeta(currentUserId);
        const updateData: Record<string, any> = {};

        if (patch.identity !== undefined) {
          updateData.identity = { ...((existing.identity as any) || {}), ...patch.identity };
        }
        if (patch.colors !== undefined) updateData.colors = patch.colors;
        if (patch.typography !== undefined) updateData.typography = patch.typography;
        if (patch.guidelines !== undefined) {
          updateData.guidelines = { ...((existing.guidelines as any) || {}), ...patch.guidelines };
        }
        if (patch.strategy !== undefined) {
          // Deep merge: each sub-field replaced independently, others preserved
          updateData.strategy = mergeStrategy(existing.strategy, patch.strategy);
        }
        if (patch.tokens !== undefined) {
          const existingTokens = (existing.tokens as any) || {};
          updateData.tokens = {
            ...existingTokens,
            ...(patch.tokens.spacing !== undefined ? { spacing: patch.tokens.spacing } : {}),
            ...(patch.tokens.radius !== undefined ? { radius: patch.tokens.radius } : {}),
          };
        }
        if (patch.tags !== undefined) updateData.tags = patch.tags;

        if (!Object.keys(updateData).length) return ERR.validation('No fields provided to update');

        const updated = await prisma.brandGuideline.update({
          where: { id: existing.id },
          data: updateData,
        });

        return jsonResponse({
          id: updated.id,
          updated: Object.keys(updateData),
          guideline: { id: updated.id, identity: updated.identity },
          _meta: quota,
        });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'brand-guidelines-delete',
    'Permanently delete a brand guideline. This cannot be undone. Confirm with the user before calling.',
    {
      id: z.string().describe('The brand guideline ID to delete.'),
      confirm: z.literal(true).describe('Must be true. Prevents accidental deletion.'),
    },
    async ({ id, confirm }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      if (!confirm) return ERR.validation('confirm must be true to prevent accidental deletion');
      try {
        const existing = await prisma.brandGuideline.findFirst({
          where: { id, userId: currentUserId },
        });
        if (!existing) return ERR.notFound('Brand guideline');

        const name = (existing.identity as any)?.name || id;
        await prisma.brandGuideline.delete({ where: { id: existing.id } });

        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ success: true, deleted: name, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'brand-guidelines-ingest',
    'Extract brand data (colors, typography, voice, strategy) from a URL or raw text and merge it into an existing brand guideline. Useful for bootstrapping a guideline from a website, landing page, or brand document. Returns what was extracted so the user can review before saving.',
    {
      id: z.string().describe('Brand guideline ID to merge extracted data into.'),
      source: z.enum(['url', 'text']).describe('"url" to scrape a webpage; "text" to extract from raw text/markdown.'),
      url: z.string().optional().describe('URL to scrape (required when source=url).'),
      text: z.string().optional().describe('Raw text or markdown to extract from (required when source=text).'),
    },
    async ({ id, source, url, text }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      if (source === 'url' && !url) return ERR.validation('url is required when source=url');
      if (source === 'text' && !text) return ERR.validation('text is required when source=text');
      try {
        const existing = await prisma.brandGuideline.findFirst({ where: { id, userId: currentUserId } });
        if (!existing) return ERR.notFound('Brand guideline');

        const quota = await getQuotaMeta(currentUserId);
        const body: Record<string, any> = { source };
        if (source === 'url') body.url = url;
        if (source === 'text') body.data = text;

        const resp = await fetch(`${INTERNAL_API_BASE}/api/brand-guidelines/${id}/ingest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-mcp-user-id': currentUserId,
          },
          body: JSON.stringify(body),
        });

        if (!resp.ok) {
          const errBody = await resp.json().catch(() => ({}));
          return ERR.internal((errBody as any).message || `Ingest failed with status ${resp.status}`);
        }

        const result = await resp.json() as any;
        const extracted = result.extracted || {};
        return jsonResponse({
          message: 'Extracted and merged successfully.',
          extracted: {
            colors: extracted.colors?.length ?? 0,
            typography: extracted.typography?.length ?? 0,
            guidelines: !!extracted.guidelines,
            strategy: !!extracted.strategy,
          },
          id,
          _meta: quota,
        });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'brand-guidelines-share',
    'Generate a public read-only link for a brand guideline. Once shared, anyone with the link can view colors, typography, logos, and brand strategy — without authentication. Returns the public URL.',
    {
      id: z.string().describe('Brand guideline ID to share.'),
      disable: z.boolean().optional().describe('Pass true to revoke public access instead of enabling it.'),
    },
    async ({ id, disable }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const existing = await prisma.brandGuideline.findFirst({ where: { id, userId: currentUserId } });
        if (!existing) return ERR.notFound('Brand guideline');

        const quota = await getQuotaMeta(currentUserId);

        if (disable) {
          await prisma.brandGuideline.update({ where: { id: existing.id }, data: { isPublic: false } });
          return jsonResponse({ success: true, isPublic: false, message: 'Public access revoked.', _meta: quota });
        }

        const { nanoid } = await import('nanoid');
        let publicSlug = existing.publicSlug;
        if (!publicSlug) {
          const baseName = ((existing.identity as any)?.name || 'brand')
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
          publicSlug = `${baseName}-${nanoid(8)}`;
        }

        await prisma.brandGuideline.update({ where: { id: existing.id }, data: { publicSlug, isPublic: true } });

        const baseUrl = process.env.VITE_SITE_URL || 'https://visantlabs.com';
        const shareUrl = `${baseUrl}/brand/${publicSlug}`;

        return jsonResponse({ success: true, isPublic: true, shareUrl, publicSlug, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'brand-guidelines-versions',
    'List the version history of a brand guideline — shows what changed and when. Useful for auditing edits or restoring a previous state. Returns versions in reverse chronological order.',
    {
      id: z.string().describe('Brand guideline ID.'),
      limit: z.number().int().min(1).max(50).default(10).describe('Max versions to return.'),
    },
    async ({ id, limit }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const existing = await prisma.brandGuideline.findFirst({
          where: { id, userId: currentUserId },
          select: { id: true, currentVersion: true },
        });
        if (!existing) return ERR.notFound('Brand guideline');

        const quota = await getQuotaMeta(currentUserId);
        const versions = await prisma.brandGuidelineVersion.findMany({
          where: { guidelineId: existing.id },
          orderBy: { versionNumber: 'desc' },
          take: limit,
          select: { versionNumber: true, changeNote: true, changedFields: true, createdAt: true },
        });

        const total = await prisma.brandGuidelineVersion.count({ where: { guidelineId: existing.id } });

        return jsonResponse({
          currentVersion: (existing as any).currentVersion || 1,
          total,
          versions: versions.map(v => ({
            version: v.versionNumber,
            note: v.changeNote,
            changed: v.changedFields,
            at: v.createdAt,
          })),
          _meta: quota,
        });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Brand Guidelines — Assets & Actions
  // ═══════════════════════════════════════════

  server.tool(
    'brand-guidelines-upload-logo',
    'Upload a logo to a brand guideline. Accepts base64-encoded image data or a public URL. Returns the uploaded logo with its URL and ID.',
    {
      id: z.string().describe('Brand guideline ID.'),
      data: z.string().optional().describe('Base64-encoded image data (PNG, SVG, WEBP).'),
      url: z.string().optional().describe('Public URL of the logo image (alternative to base64 data).'),
      variant: z.enum(['primary', 'dark', 'light', 'icon', 'accent', 'custom']).default('primary').describe('Logo variant.'),
      label: z.string().optional().describe('Human-readable label, e.g. "Horizontal", "Dark mode".'),
    },
    async ({ id, data, url, variant, label }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      if (!data && !url) return ERR.validation('Either data (base64) or url is required.');
      try {
        const existing = await prisma.brandGuideline.findFirst({ where: { id, userId: currentUserId } });
        if (!existing) return ERR.notFound('Brand guideline');
        const quota = await getQuotaMeta(currentUserId);
        const resp = await fetch(`${INTERNAL_API_BASE}/api/brand-guidelines/${id}/logos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ data, url, variant, label }),
        });
        const result = await resp.json() as any;
        if (!resp.ok) return ERR.internal(result?.error || `Upload failed (${resp.status})`);
        return jsonResponse({ logo: result.logo, allLogos: result.allLogos, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'brand-guidelines-delete-logo',
    'Delete a logo from a brand guideline by its logo ID.',
    {
      id: z.string().describe('Brand guideline ID.'),
      logoId: z.string().describe('Logo ID to delete (from the logos array).'),
    },
    async ({ id, logoId }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const existing = await prisma.brandGuideline.findFirst({ where: { id, userId: currentUserId } });
        if (!existing) return ERR.notFound('Brand guideline');
        const quota = await getQuotaMeta(currentUserId);
        const resp = await fetch(`${INTERNAL_API_BASE}/api/brand-guidelines/${id}/logos/${logoId}`, {
          method: 'DELETE',
          headers: { 'x-mcp-user-id': currentUserId },
        });
        if (!resp.ok) {
          const errBody = await resp.json().catch(() => ({})) as any;
          return ERR.internal(errBody?.error || `Delete failed (${resp.status})`);
        }
        return jsonResponse({ success: true, deleted: logoId, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'brand-guidelines-upload-media',
    'Upload a media asset (image or PDF) to a brand guideline media kit. Accepts base64-encoded data or a public URL.',
    {
      id: z.string().describe('Brand guideline ID.'),
      data: z.string().optional().describe('Base64-encoded image or PDF data.'),
      url: z.string().optional().describe('Public URL of the media asset (alternative to base64 data).'),
      type: z.enum(['image', 'pdf']).default('image').describe('Asset type.'),
      label: z.string().optional().describe('Label for this media asset, e.g. "Brand Presentation", "Campaign Photo".'),
    },
    async ({ id, data, url, type, label }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      if (!data && !url) return ERR.validation('Either data (base64) or url is required.');
      try {
        const existing = await prisma.brandGuideline.findFirst({ where: { id, userId: currentUserId } });
        if (!existing) return ERR.notFound('Brand guideline');
        const quota = await getQuotaMeta(currentUserId);
        const resp = await fetch(`${INTERNAL_API_BASE}/api/brand-guidelines/${id}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ data, url, type, label }),
        });
        const result = await resp.json() as any;
        if (!resp.ok) return ERR.internal(result?.error || `Upload failed (${resp.status})`);
        return jsonResponse({ media: result.media, allMedia: result.allMedia, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'brand-guidelines-delete-media',
    'Delete a media asset from a brand guideline by its media ID.',
    {
      id: z.string().describe('Brand guideline ID.'),
      mediaId: z.string().describe('Media asset ID to delete.'),
    },
    async ({ id, mediaId }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const existing = await prisma.brandGuideline.findFirst({ where: { id, userId: currentUserId } });
        if (!existing) return ERR.notFound('Brand guideline');
        const quota = await getQuotaMeta(currentUserId);
        const resp = await fetch(`${INTERNAL_API_BASE}/api/brand-guidelines/${id}/media/${mediaId}`, {
          method: 'DELETE',
          headers: { 'x-mcp-user-id': currentUserId },
        });
        if (!resp.ok) {
          const errBody = await resp.json().catch(() => ({})) as any;
          return ERR.internal(errBody?.error || `Delete failed (${resp.status})`);
        }
        return jsonResponse({ success: true, deleted: mediaId, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'brand-guidelines-duplicate',
    'Duplicate a brand guideline, creating an independent copy with "(copy)" appended to the name. Useful for creating variants or testing changes without affecting the original.',
    {
      id: z.string().describe('Brand guideline ID to duplicate.'),
    },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const existing = await prisma.brandGuideline.findFirst({ where: { id, userId: currentUserId } });
        if (!existing) return ERR.notFound('Brand guideline');
        const quota = await getQuotaMeta(currentUserId);
        const resp = await fetch(`${INTERNAL_API_BASE}/api/brand-guidelines/${id}/duplicate`, {
          method: 'POST',
          headers: { 'x-mcp-user-id': currentUserId },
        });
        const result = await resp.json() as any;
        if (!resp.ok) return ERR.internal(result?.error || `Duplicate failed (${resp.status})`);
        return jsonResponse({ guideline: result.guideline, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'brand-guidelines-restore-version',
    'Restore a brand guideline to a previous version. The current state is preserved as a version before restoring.',
    {
      id: z.string().describe('Brand guideline ID.'),
      version: z.number().int().min(1).describe('Version number to restore (from brand-guidelines-versions).'),
    },
    async ({ id, version }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const existing = await prisma.brandGuideline.findFirst({ where: { id, userId: currentUserId } });
        if (!existing) return ERR.notFound('Brand guideline');
        const quota = await getQuotaMeta(currentUserId);
        const resp = await fetch(`${INTERNAL_API_BASE}/api/brand-guidelines/${id}/versions/${version}/restore`, {
          method: 'POST',
          headers: { 'x-mcp-user-id': currentUserId },
        });
        const result = await resp.json() as any;
        if (!resp.ok) return ERR.internal(result?.error || `Restore failed (${resp.status})`);
        return jsonResponse({ success: true, restoredTo: version, id, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'brand-guidelines-compliance-check',
    'Run an AI compliance check on a brand guideline — validates color contrast, typography consistency, voice coherence, and completeness. Returns a scored report with actionable suggestions.',
    {
      id: z.string().describe('Brand guideline ID to check.'),
    },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const existing = await prisma.brandGuideline.findFirst({ where: { id, userId: currentUserId } });
        if (!existing) return ERR.notFound('Brand guideline');
        const quota = await getQuotaMeta(currentUserId);
        const resp = await fetch(`${INTERNAL_API_BASE}/api/brand-guidelines/${id}/compliance-check`, {
          method: 'POST',
          headers: { 'x-mcp-user-id': currentUserId },
        });
        const result = await resp.json() as any;
        if (!resp.ok) return ERR.internal(result?.error || `Compliance check failed (${resp.status})`);
        return jsonResponse({ ...result, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Community (public, no auth needed)
  // ═══════════════════════════════════════════

  server.tool(
    'community-presets',
    'Browse community-shared mockup presets. Useful for discovering templates and inspiration. No auth required.',
    {
      limit: z.number().int().min(1).max(50).default(20).describe('Max presets to return (1-50).'),
      skip: z.number().int().min(0).default(0).describe('Number of items to skip for pagination.'),
    },
    async ({ limit, skip }) => {
      try {
        const db = getDb();
        const presets = await db
          .collection('community_presets')
          .find({ public: true })
          .skip(skip)
          .limit(limit)
          .toArray();
        const total = await db.collection('community_presets').countDocuments({ public: true });
        return jsonResponse({ presets, total, page: { limit, skip, hasMore: skip + limit < total } });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'community-profiles',
    'Browse public community creator profiles. No auth required.',
    {
      limit: z.number().int().min(1).max(50).default(20).describe('Max profiles to return (1-50).'),
      skip: z.number().int().min(0).default(0).describe('Number of items to skip for pagination.'),
    },
    async ({ limit, skip }) => {
      try {
        const users = await prisma.user.findMany({
          where: { username: { not: null } },
          take: limit,
          skip,
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, username: true, picture: true, bio: true, createdAt: true },
        });
        return jsonResponse({ profiles: users, total: users.length, page: { limit, skip } });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Creative Projects
  // ═══════════════════════════════════════════

  server.tool(
    'creative-projects-list',
    'List creative studio projects owned by the authenticated user.',
    {
      limit: z.number().int().min(1).max(100).default(20).describe('Max items to return.'),
      skip: z.number().int().min(0).default(0).describe('Items to skip for pagination.'),
    },
    async ({ limit, skip }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(
          `${INTERNAL_API_BASE}/api/creative-projects?limit=${limit}&skip=${skip}`,
          { headers: { 'x-mcp-user-id': currentUserId } }
        );
        const result = await response.json();
        if (!response.ok) return jsonResponse({ error: result.error || 'Failed to list creative projects' });
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ ...result, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'creative-projects-get',
    'Get a creative project by ID, including all layers, background, and generated assets.',
    {
      id: z.string().describe('The creative project ID.'),
    },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(
          `${INTERNAL_API_BASE}/api/creative-projects/${id}`,
          { headers: { 'x-mcp-user-id': currentUserId } }
        );
        const result = await response.json();
        if (!response.ok) return jsonResponse({ error: result.error || 'Creative project not found' });
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ ...result, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Creative Generation
  // ═══════════════════════════════════════════

  server.tool(
    'creative-generate',
    'Generate a structured marketing creative layout (background, text layers, logo, shapes) from a prompt. Optionally inject brand guideline context. Returns a layered creative plan ready for the Creative Studio. Costs credits.',
    {
      prompt: z.string().min(1).describe('Creative brief (e.g. "Summer sale banner for a surf brand, bold and energetic").'),
      brandGuidelineId: z.string().optional().describe('Brand guideline ID to inject colors, fonts, and voice into the creative.'),
      format: z.enum(['1:1', '16:9', '9:16', '4:5']).default('1:1').describe('Output aspect ratio.'),
    },
    async ({ prompt, brandGuidelineId, format }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/creative/plan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-mcp-user-id': currentUserId,
          },
          body: JSON.stringify({ prompt, brandGuidelineId, format, feature: 'agent' }),
        });
        const result = await response.json();
        if (!response.ok) return jsonResponse({ error: result.error || 'Creative generation failed', status: response.status });
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ ...result, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Creative Render (server-side PNG generation)
  // ═══════════════════════════════════════════

  server.tool(
    'creative-render',
    'Render a creative plan (from creative-generate) into a PNG image server-side. Pass the plan JSON and the pre-generated background image URL. Returns imageUrl (R2) or imageBase64. Use this to close the generate→image loop without a browser: generate plan, render, inspect image with vision, adjust, re-render.',
    {
      plan: z.object({
        background: z.object({ prompt: z.string().optional(), url: z.string().optional() }).optional(),
        overlay: z.object({
          type: z.enum(['gradient', 'solid']),
          direction: z.enum(['bottom', 'top', 'left', 'right']).optional(),
          opacity: z.number(),
          color: z.string().optional(),
        }).nullable().optional(),
        layers: z.array(z.record(z.string(), z.any())).describe('Layer array from creative-generate.'),
      }).describe('Creative plan from creative-generate.'),
      backgroundImageUrl: z.string().optional().describe('Pre-generated background image URL (from mockup-generate or any image URL).'),
      format: z.enum(['1:1', '16:9', '9:16', '4:5']).default('1:1').describe('Output format.'),
      accentColor: z.string().optional().describe('Hex color for <accent> words in text layers. Defaults to white.'),
    },
    async ({ plan, backgroundImageUrl, format, accentColor }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/creative/render`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-mcp-user-id': currentUserId,
          },
          body: JSON.stringify({ plan, backgroundImageUrl, format, accentColor }),
        });
        const result = await response.json();
        if (!response.ok) return jsonResponse({ error: result.error || 'Render failed', status: response.status });
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ ...result, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Creative Full Pipeline
  // ═══════════════════════════════════════════

  server.tool(
    'creative-full',
    'Full creative pipeline in one call. Generates layout plan → background image → renders to PNG → saves project. Returns imageUrl, projectId, plan, and per-step credits. Use this instead of chaining creative-generate + mockup-generate + creative-render manually.',
    {
      prompt: z.string().min(1).describe('Creative brief describing the desired visual.'),
      brandGuidelineId: z.string().optional().describe('Brand guideline ID to inject brand context.'),
      format: z.enum(['1:1', '16:9', '9:16', '4:5']).default('1:1').describe('Output aspect ratio.'),
      model: z.enum(['gpt-image-2', 'gpt-image-1', 'gemini-3.1-flash-image-preview', 'seedream-3-0']).default('gpt-image-2').describe('Model for background image generation.'),
      resolution: z.enum(['1K', '2K', '4K']).default('1K').describe('Resolution for background image generation.'),
      autoSave: z.boolean().default(true).describe('Persist result as a creative project.'),
    },
    async ({ prompt, brandGuidelineId, format, model, resolution, autoSave }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();

      const credits: Record<string, number | null> = { plan: null, background: null, render: null };

      try {
        // Step 1: Generate creative plan
        const planRes = await fetch(`${INTERNAL_API_BASE}/api/creative/plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ prompt, brandGuidelineId, format, feature: 'agent' }),
        });
        const planData = await planRes.json() as any;
        if (!planRes.ok) return ERR.internal(planData.error || `Creative plan failed (${planRes.status})`);
        const plan = planData.plan ?? planData;
        credits.plan = planData.creditsUsed ?? null;

        // Step 2: Generate background image
        const bgPrompt = plan?.background?.prompt || prompt;
        const mockupRes = await fetch(`${INTERNAL_API_BASE}/api/mockups/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ promptText: bgPrompt, brandGuidelineId, model, resolution, aspectRatio: format, designType: 'background', feature: 'agent' }),
        });
        const mockupData = await mockupRes.json() as any;
        const backgroundImageUrl: string | undefined = mockupData.imageUrl ?? mockupData.mockup?.imageUrl;
        credits.background = mockupData.creditsUsed ?? null;

        // Step 3: Render creative to PNG
        const renderRes = await fetch(`${INTERNAL_API_BASE}/api/creative/render`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ plan, backgroundImageUrl, format }),
        });
        const renderData = await renderRes.json() as any;
        if (!renderRes.ok) {
          // Partial success — return what we have so the agent can retry render
          return jsonResponse({ error: renderData.error || `Render failed (${renderRes.status})`, step: 'render', plan, backgroundImageUrl, creditsUsed: credits });
        }
        const imageUrl: string = renderData.imageUrl ?? renderData.imageBase64;
        credits.render = renderData.creditsUsed ?? null;

        // Step 4: Optionally save project
        let projectId: string | undefined;
        if (autoSave) {
          const saveRes = await fetch(`${INTERNAL_API_BASE}/api/creative-projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
            body: JSON.stringify({
              prompt, format,
              brandId: brandGuidelineId || null,
              backgroundUrl: backgroundImageUrl || null,
              layers: plan.layers ?? [],
              overlay: plan.overlay ?? null,
              thumbnailUrl: imageUrl?.startsWith('http') ? imageUrl : null,
              name: `Creative — ${prompt.slice(0, 50)}`,
            }),
          });
          const saveData = await saveRes.json() as any;
          projectId = saveData.project?.id;
        }

        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ imageUrl, backgroundImageUrl, plan, projectId, creditsUsed: credits, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Creative Projects CRUD
  // ═══════════════════════════════════════════

  server.tool(
    'creative-projects-create',
    'Save a creative project to the database. Requires prompt, format, and layers (from creative-generate). Optionally attach a brand guideline and background/thumbnail URLs.',
    {
      prompt: z.string().min(1).describe('Creative brief used to generate this project.'),
      format: z.string().describe('Aspect ratio (e.g. "1:1", "16:9").'),
      layers: z.array(z.record(z.string(), z.any())).describe('Layer array from creative-generate.'),
      name: z.string().optional().describe('Project display name. Defaults to "Untitled Creative".'),
      brandId: z.string().nullable().optional().describe('Brand guideline ID to associate.'),
      backgroundUrl: z.string().nullable().optional().describe('Background image URL.'),
      overlay: z.record(z.string(), z.any()).nullable().optional().describe('Overlay config from creative plan.'),
      thumbnailUrl: z.string().nullable().optional().describe('Thumbnail image URL.'),
    },
    async ({ prompt, format, layers, name, brandId, backgroundUrl, overlay, thumbnailUrl }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/creative-projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ prompt, format, layers, name, brandId, backgroundUrl, overlay, thumbnailUrl }),
        });
        const result = await response.json();
        if (!response.ok) return jsonResponse({ error: result.error || 'Failed to create creative project' });
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ ...result, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'creative-projects-update',
    'Update an existing creative project (partial update). All fields are optional — only provided fields are updated.',
    {
      id: z.string().describe('Creative project ID to update.'),
      name: z.string().optional().describe('New project name.'),
      prompt: z.string().optional().describe('Updated creative prompt.'),
      format: z.string().optional().describe('Updated aspect ratio.'),
      layers: z.array(z.record(z.string(), z.any())).optional().describe('Updated layers array.'),
      brandId: z.string().nullable().optional().describe('Brand guideline ID to associate.'),
      backgroundUrl: z.string().nullable().optional().describe('Updated background image URL.'),
      overlay: z.record(z.string(), z.any()).nullable().optional().describe('Updated overlay config.'),
      thumbnailUrl: z.string().nullable().optional().describe('Updated thumbnail URL.'),
    },
    async ({ id, name, prompt, format, layers, brandId, backgroundUrl, overlay, thumbnailUrl }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/creative-projects/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ name, prompt, format, layers, brandId, backgroundUrl, overlay, thumbnailUrl }),
        });
        const result = await response.json();
        if (!response.ok) return jsonResponse({ error: result.error || 'Failed to update creative project' });
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ ...result, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'creative-projects-delete',
    'Permanently delete a creative project by ID.',
    {
      id: z.string().describe('Creative project ID to delete.'),
    },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/creative-projects/${id}`, {
          method: 'DELETE',
          headers: { 'x-mcp-user-id': currentUserId },
        });
        const result = await response.json();
        if (!response.ok) return jsonResponse({ error: result.error || 'Failed to delete creative project' });
        return jsonResponse({ ok: result.ok ?? true });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Mockup CRUD
  // ═══════════════════════════════════════════

  server.tool(
    'mockup-update',
    'Update a mockup\'s metadata (prompt, tags, isLiked, designType, aspectRatio). Does not regenerate the image.',
    {
      id: z.string().describe('Mockup MongoDB ObjectId.'),
      prompt: z.string().optional().describe('Updated prompt text.'),
      designType: z.string().optional().describe('Design type (e.g. "social", "banner").'),
      aspectRatio: z.string().optional().describe('Aspect ratio (e.g. "16:9").'),
      tags: z.array(z.string()).optional().describe('Tag list.'),
      brandingTags: z.array(z.string()).optional().describe('Branding tag list.'),
      isLiked: z.boolean().optional().describe('Mark/unmark as liked.'),
    },
    async ({ id, prompt, designType, aspectRatio, tags, brandingTags, isLiked }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/mockups/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ prompt, designType, aspectRatio, tags, brandingTags, isLiked }),
        });
        const result = await response.json();
        if (!response.ok) return jsonResponse({ error: result.error || 'Failed to update mockup' });
        return jsonResponse({ ok: true, message: result.message });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'mockup-delete',
    'Permanently delete a mockup by ID.',
    {
      id: z.string().describe('Mockup MongoDB ObjectId to delete.'),
    },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/mockups/${id}`, {
          method: 'DELETE',
          headers: { 'x-mcp-user-id': currentUserId },
        });
        const result = await response.json();
        if (!response.ok) return jsonResponse({ error: result.error || 'Failed to delete mockup' });
        return jsonResponse({ ok: true, ...result });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Branding Projects CRUD
  // ═══════════════════════════════════════════

  server.tool(
    'branding-save',
    'Create or update a branding project. If projectId is provided and the project exists, it updates it; otherwise creates a new one. Returns the saved project.',
    {
      prompt: z.string().min(1).describe('Brand brief or description used to generate the project.'),
      data: z.record(z.string(), z.any()).describe('Branding project data (colors, typography, logos, etc.).'),
      projectId: z.string().optional().describe('Existing project ID to update. Omit to create a new project.'),
      name: z.string().optional().describe('Project display name.'),
    },
    async ({ prompt, data, projectId, name }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/branding/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ prompt, data, projectId, name }),
        });
        const result = await response.json();
        if (!response.ok) return jsonResponse({ error: result.error || 'Failed to save branding project' });
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ ...result, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'branding-delete',
    'Permanently delete a branding project by ID.',
    {
      id: z.string().describe('Branding project ID to delete.'),
    },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/branding/${id}`, {
          method: 'DELETE',
          headers: { 'x-mcp-user-id': currentUserId },
        });
        const result = await response.json();
        if (!response.ok) return jsonResponse({ error: result.error || 'Failed to delete branding project' });
        return jsonResponse({ ok: result.success ?? true });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Canvas CRUD
  // ═══════════════════════════════════════════

  server.tool(
    'canvas-update',
    'Update a canvas project by ID. Provide any combination of name, nodes, edges, drawings, or linkedGuidelineId. Only provided fields are updated.',
    {
      id: z.string().describe('Canvas project ID to update.'),
      name: z.string().optional().describe('New project name.'),
      nodes: z.array(z.record(z.string(), z.any())).optional().describe('Updated node array.'),
      edges: z.array(z.record(z.string(), z.any())).optional().describe('Updated edge array.'),
      drawings: z.array(z.record(z.string(), z.any())).optional().describe('Updated drawings array.'),
      linkedGuidelineId: z.string().nullable().optional().describe('Brand guideline ID to link.'),
    },
    async ({ id, name, nodes, edges, drawings, linkedGuidelineId }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/canvas/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ name, nodes, edges, drawings, linkedGuidelineId }),
        });
        const result = await response.json();
        if (!response.ok) return jsonResponse({ error: result.error || 'Failed to update canvas project' });
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ ...result, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'canvas-delete',
    'Permanently delete a canvas project by ID.',
    {
      id: z.string().describe('Canvas project ID to delete.'),
    },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/canvas/${id}`, {
          method: 'DELETE',
          headers: { 'x-mcp-user-id': currentUserId },
        });
        const result = await response.json();
        if (!response.ok) return jsonResponse({ error: result.error || 'Failed to delete canvas project' });
        return jsonResponse({ ok: result.success ?? true });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'canvas-share',
    'Share a canvas project with other users. Generates a shareId and sets collaborative mode. Accepts user emails or user IDs for canEdit/canView lists.',
    {
      id: z.string().describe('Canvas project ID to share.'),
      canEdit: z.array(z.string()).default([]).describe('List of user emails or IDs who can edit.'),
      canView: z.array(z.string()).default([]).describe('List of user emails or IDs who can view.'),
    },
    async ({ id, canEdit, canView }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/canvas/${id}/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ canEdit, canView }),
        });
        const result = await response.json();
        if (!response.ok) return jsonResponse({ error: result.error || 'Failed to share canvas project' });
        return jsonResponse(result);
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Budget CRUD
  // ═══════════════════════════════════════════

  server.tool(
    'budget-update',
    'Update an existing budget project by ID. Accepts any subset of budget fields — only provided fields are modified.',
    {
      id: z.string().describe('Budget project ID to update.'),
      name: z.string().optional().describe('Project name.'),
      clientName: z.string().optional().describe('Client name.'),
      projectDescription: z.string().optional().describe('Project description.'),
      startDate: z.string().optional().describe('Start date (ISO string).'),
      endDate: z.string().optional().describe('End date (ISO string).'),
      deliverables: z.array(z.any()).optional().describe('Deliverables list.'),
      observations: z.string().optional().describe('Additional observations.'),
      data: z.record(z.string(), z.any()).optional().describe('Full budget data object (replaces existing data field).'),
    },
    async ({ id, name, clientName, projectDescription, startDate, endDate, deliverables, observations, data }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/budget/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ name, clientName, projectDescription, startDate, endDate, deliverables, observations, data }),
        });
        const result = await response.json();
        if (!response.ok) return jsonResponse({ error: result.error || 'Failed to update budget' });
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ ...result, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'budget-delete',
    'Permanently delete a budget project by ID.',
    {
      id: z.string().describe('Budget project ID to delete.'),
    },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/budget/${id}`, {
          method: 'DELETE',
          headers: { 'x-mcp-user-id': currentUserId },
        });
        const result = await response.json();
        if (!response.ok) return jsonResponse({ error: result.error || 'Failed to delete budget' });
        return jsonResponse({ ok: result.success ?? true });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'budget-duplicate',
    'Duplicate an existing budget project. Returns the new project.',
    {
      id: z.string().describe('Budget project ID to duplicate.'),
    },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/budget/${id}/duplicate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({}),
        });
        const result = await response.json();
        if (!response.ok) return jsonResponse({ error: result.error || 'Failed to duplicate budget' });
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ ...result, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Brand Guidelines — Media Kit (URL/base64 only)
  // ═══════════════════════════════════════════

  // NOTE: brand-guidelines-logo-upload is intentionally NOT implemented via MCP.
  // The POST /:id/logos route accepts either base64 `data` or `url`, which is
  // feasible for MCP, but logos are large binary blobs that exceed practical
  // token limits in agent contexts. Agents should use brand-guidelines-update
  // to attach a pre-uploaded logo URL instead. If needed in the future, add a
  // dedicated logo-url tool that only accepts the `url` param (no base64).

  // ═══════════════════════════════════════════
  // Canvas Pipeline (Variables + Data nodes)
  // ═══════════════════════════════════════════

  server.tool(
    'canvas-resolve-variables',
    'Given a prompt string and a variables map (key→value pairs), resolve all {{placeholder}} tokens and return the final prompt. Useful for previewing what a VariablesNode or DataNode will produce before generation.',
    {
      prompt: z.string().describe('The prompt text containing {{variable}} placeholders.'),
      variables: z.record(z.string(), z.string()).describe('Map of variable name to value, e.g. {"brand":"Nike","color":"red"}.'),
    },
    async ({ prompt, variables }) => {
      const resolved = prompt.replace(/\{\{(\w+)\}\}/g, (match: string, key: string) =>
        Object.prototype.hasOwnProperty.call(variables, key) ? (variables as Record<string, string>)[key] : match
      );
      const placeholders = Array.from(prompt.matchAll(/\{\{(\w+)\}\}/g)).map((m: RegExpMatchArray) => m[1] as string);
      const unresolved = placeholders.filter((p: string) => !Object.prototype.hasOwnProperty.call(variables, p));
      return jsonResponse({ resolved, unresolved, variables_used: Object.keys(variables).length });
    }
  );

  server.tool(
    'canvas-parse-csv',
    'Parse a CSV string and return the rows as an array of objects. Use this to preview what a DataNode will produce from a CSV file before uploading it to the canvas.',
    {
      csv: z.string().describe('Raw CSV text with a header row.'),
      preview_rows: z.number().int().min(1).max(50).default(5).describe('Number of rows to return in the preview (1-50).'),
    },
    async ({ csv, preview_rows }) => {
      try {
        // Inline minimal CSV parse (no external deps in MCP context)
        const lines = csv.trim().split('\n').filter(Boolean);
        if (lines.length < 2) return jsonResponse({ error: 'CSV must have a header row and at least one data row.' });
        const headers = lines[0].split(',').map((h: string) => h.trim());
        const rows = lines.slice(1, preview_rows + 1).map((line: string) => {
          const vals = line.split(',').map((v: string) => v.trim());
          return Object.fromEntries(headers.map((h: string, i: number) => [h, vals[i] ?? '']));
        });
        return jsonResponse({
          columns: headers,
          total_rows: lines.length - 1,
          preview: rows,
          note: rows.length < lines.length - 1 ? `Showing ${rows.length} of ${lines.length - 1} rows` : undefined,
        });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'canvas-list-projects',
    'List canvas projects for the authenticated user with node type summary.',
    {
      limit: z.number().int().min(1).max(50).default(10).describe('Max projects to return.'),
    },
    async ({ limit }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        await connectToMongoDB();
        const projects = await prisma.canvasProject.findMany({
          where: { userId: currentUserId },
          take: limit,
          orderBy: { updatedAt: 'desc' },
          select: { id: true, name: true, createdAt: true, updatedAt: true, nodes: true },
        });
        const summary = projects.map((p: any) => {
          const nodes = (p.nodes as any[]) ?? [];
          const typeCounts = nodes.reduce((acc: Record<string, number>, n: any) => {
            acc[n.type] = (acc[n.type] ?? 0) + 1;
            return acc;
          }, {});
          return { id: p.id, name: p.name, node_count: nodes.length, node_types: typeCounts, updated_at: p.updatedAt };
        });
        return jsonResponse({ projects: summary, total: summary.length });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'document-extract',
    'Extract content from a PDF using a 2-phase pipeline: algorithmic (exact colors, fonts, embedded images) ' +
    'then Gemini semantic analysis (strategy, personas, voice, dos/donts, asset classification). ' +
    'Returns markdownText (structured, page-separated — ideal for RAG chunking) plus brand tokens. ' +
    'Accepts either pdf_base64 (base64-encoded PDF content, preferred for remote MCP usage) or pdf_path (server-side path). ' +
    'IMPORTANT: before calling, ask the user whether they want the result saved to disk as a .md file or returned inline.',
    {
      pdf_base64: z.string().optional().describe(
        'Base64-encoded PDF content. Preferred when calling from a remote agent — read the file locally and encode it. ' +
        'Mutually exclusive with pdf_path.'
      ),
      pdf_filename: z.string().optional().describe(
        'Original filename (e.g. "brand.pdf"). Required when using pdf_base64 with output="disk" so the .md file can be named correctly.'
      ),
      pdf_path: z.string().optional().describe('Absolute server-side path to a PDF. Only use when the file is on the same machine as the MCP server.'),
      output: z.enum(['disk', 'inline']).describe(
        '"disk" — saves a .md file alongside the PDF (pdf_path) or in the current directory (pdf_base64) and returns { saved_to, characters, preview }. ' +
        '"inline" — returns the full markdownText in the response (no file written).'
      ),
      include_brand_tokens: z.boolean().default(true).describe(
        'Include colors, typography, strategy, and asset classifications. Default: true.'
      ),
    },
    async ({ pdf_base64, pdf_filename, pdf_path, output, include_brand_tokens }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();

      if (!pdf_base64 && !pdf_path) return ERR.validation('Provide either pdf_base64 or pdf_path.');

      let buffer: Buffer;
      if (pdf_base64) {
        try {
          buffer = Buffer.from(pdf_base64, 'base64');
        } catch (err: any) {
          return ERR.validation(`Invalid base64 content: ${err.message}`);
        }
      } else {
        try {
          const { readFileSync } = await import('fs');
          buffer = readFileSync(pdf_path!);
        } catch (err: any) {
          return ERR.validation(`Cannot read PDF at ${pdf_path}: ${err.message}`);
        }
      }

      const { extractPdfStreaming } = await import('../lib/pdf-extract.js');
      const result: Record<string, any> = {};
      const writeEvent = (event: any) => {
        switch (event.type) {
          case 'text':                result.markdownText = event.data; break;
          case 'colors':              result.colors = event.data; break;
          case 'typography':          result.typography = event.data; break;
          case 'images':              result.imageCount = (event.data as any[]).length; break;
          case 'strategy':            result.strategy = event.data; break;
          case 'asset_classifications': result.assetClassifications = event.data; break;
          case 'error':               result._error = event.message; break;
        }
      };

      try {
        await extractPdfStreaming(buffer, writeEvent, currentUserId);
      } catch (err: any) {
        return ERR.internal(err.message);
      }

      const md: string = result.markdownText ?? '';
      const tokens = include_brand_tokens ? {
        colors: result.colors,
        typography: result.typography,
        strategy: result.strategy,
        assetClassifications: result.assetClassifications,
        imageCount: result.imageCount,
      } : {};

      if (output === 'disk') {
        const { writeFileSync } = await import('fs');
        const { basename, dirname, join } = await import('path');
        let outPath: string;
        if (pdf_path) {
          const stem = basename(pdf_path).replace(/\.pdf$/i, '');
          outPath = join(dirname(pdf_path), `${stem}.md`);
        } else {
          const stem = (pdf_filename ?? 'document').replace(/\.pdf$/i, '');
          outPath = join(process.cwd(), `${stem}.md`);
        }
        writeFileSync(outPath, md, 'utf-8');
        return jsonResponse({ saved_to: outPath, characters: md.length, preview: md.slice(0, 600), ...tokens });
      }

      return jsonResponse({ markdownText: md, ...tokens });
    }
  );

  // Restore original tool method and persist collected names
  (server as any).tool = originalTool;
  _registeredToolNames = collectedNames;

  return server;
}

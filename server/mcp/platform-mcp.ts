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

/**
 * Set MCP user ID for the current request scope.
 * Prefers AsyncLocalStorage, falls back to legacy global for compatibility.
 */
export function setMcpUserId(userId: string | null) {
  _legacyUserId = userId;
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

  // Wrap server.tool to auto-collect names into _registeredToolNames
  const collectedNames: string[] = [];
  const originalTool = server.tool.bind(server);
  (server as any).tool = (name: string, ...rest: any[]) => {
    collectedNames.push(name);
    return (originalTool as any)(name, ...rest);
  };

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
        return jsonResponse({ error: err.message });
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
        return jsonResponse({ error: err.message });
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
        return jsonResponse({ error: err.message });
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
        return jsonResponse({ error: err.message });
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
        return jsonResponse({ error: err.message });
      }
    }
  );

  server.tool(
    'mockup-generate',
    'Generate a new mockup image using AI. Costs credits based on model/resolution. Returns the generated image URL.',
    {
      prompt: z.string().min(1).describe('Description of the mockup to generate.'),
      designType: z.string().optional().describe('Design type hint (e.g. "business-card", "social-media").'),
      aspectRatio: z.string().optional().describe('Aspect ratio (e.g. "16:9", "1:1", "4:3").'),
      brandGuidelineId: z.string().optional().describe('Brand guideline ID to inject brand context into generation.'),
    },
    async ({ prompt, designType, aspectRatio, brandGuidelineId }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/mockups/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-mcp-user-id': currentUserId,
          },
          body: JSON.stringify({
            promptText: prompt,
            designType: designType || 'blank',
            aspectRatio: aspectRatio || '1:1',
            feature: 'agent',
            brandGuidelineId,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          return jsonResponse({ error: result.error || 'Generation failed', status: response.status });
        }

        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({
          summary: 'Mockup generated successfully.',
          imageUrl: result.imageUrl || null,
          hasImage: !!result.imageBase64 || !!result.imageUrl,
          _meta: quota,
        });
      } catch (err: any) {
        return jsonResponse({ error: err.message });
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
        return jsonResponse({ error: err.message });
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
        return jsonResponse({ error: err.message });
      }
    }
  );

  server.tool(
    'branding-generate',
    'Generate a complete brand identity (logo, colors, typography) from a text prompt. Optionally inject an existing brand guideline as context. Costs credits.',
    {
      prompt: z.string().min(1).describe('Description of the brand to generate (e.g. "modern tech startup called Acme").'),
      brandGuidelineId: z.string().optional().describe('Brand guideline ID to use as context/reference for generation.'),
    },
    async ({ prompt, brandGuidelineId }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/branding/generate-step`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-mcp-user-id': currentUserId,
          },
          body: JSON.stringify({
            prompt,
            step: 'full',
            feature: 'agent',
            brandGuidelineId,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          return jsonResponse({ error: result.error || 'Branding generation failed', status: response.status });
        }

        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ ...result, _meta: quota });
      } catch (err: any) {
        return jsonResponse({ error: err.message });
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
        return jsonResponse({ error: err.message });
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
        return jsonResponse({ error: err.message });
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
        return jsonResponse({ error: err.message });
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
        return jsonResponse({ error: err.message });
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
        return jsonResponse({ error: err.message });
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
        return jsonResponse({ error: err.message });
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
        return jsonResponse({ error: err.message });
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
        return jsonResponse({ error: err.message });
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
        return jsonResponse({ error: err.message });
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
        return jsonResponse({ error: err.message });
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
        return jsonResponse({ error: err.message });
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
        return jsonResponse({ error: err.message });
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
        return jsonResponse({ error: err.message });
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
        return jsonResponse({ error: err.message });
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
        return jsonResponse({ error: err.message });
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
        return jsonResponse({ error: err.message });
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
        return jsonResponse({ error: err.message });
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
        return jsonResponse({ error: err.message });
      }
    }
  );

  // Restore original tool method and persist collected names
  (server as any).tool = originalTool;
  _registeredToolNames = collectedNames;

  return server;
}

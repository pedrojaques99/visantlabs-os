/**
 * Platform MCP Server
 * Exposes Visant Labs platform tools for agents (Claude, Cursor, etc.)
 * Transport: HTTP/SSE (mounted in Express)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { connectToMongoDB } from '../db/mongodb.js';
import { improvePrompt, describeImage } from '../services/geminiService.js';
import { getGeminiApiKey } from '../utils/geminiApiKey.js';

// ═══════════════════════════════════════════
// Session auth context
// ═══════════════════════════════════════════

let currentUserId: string | null = null;

export function setMcpUserId(userId: string | null) {
  currentUserId = userId;
}

async function getQuotaMeta(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true, monthlyCredits: true, creditsUsed: true, freeGenerationsUsed: true },
  });
  if (!user) return null;
  const isFree = user.subscriptionTier === 'free';
  return {
    credits_remaining: isFree
      ? Math.max(0, 4 - user.freeGenerationsUsed)
      : Math.max(0, user.monthlyCredits - user.creditsUsed),
    credits_used: isFree ? user.freeGenerationsUsed : user.creditsUsed,
    plan: user.subscriptionTier,
  };
}

function authError() {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          error: 'Authentication required. Connect with API key: Authorization: Bearer visant_sk_xxx',
        }),
      },
    ],
    isError: true as const,
  };
}

function jsonResponse(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

/** Base URL for internal API calls (reuses existing route logic for credits, validation, etc.) */
const INTERNAL_API_BASE = process.env.INTERNAL_API_URL || `http://localhost:${process.env.PORT || 3001}`;

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

  // ═══════════════════════════════════════════
  // Account
  // ═══════════════════════════════════════════

  server.tool(
    'account-usage',
    'Get credit usage, remaining balance, plan limits, and billing cycle info for the authenticated account.',
    {},
    async () => {
      if (!currentUserId) return authError();
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
      if (!currentUserId) return authError();
      try {
        const user = await prisma.user.findUnique({
          where: { id: currentUserId },
          select: {
            id: true,
            name: true,
            email: true,
            picture: true,
            subscriptionTier: true,
            monthlyCredits: true,
            creditsUsed: true,
            freeGenerationsUsed: true,
            createdAt: true,
          },
        });
        if (!user) return jsonResponse({ error: 'User not found' });
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ ...user, _meta: quota });
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
      if (!currentUserId) return authError();
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
      if (!currentUserId) return authError();
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
      if (!currentUserId) return authError();
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
      if (!currentUserId) return authError();
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
      if (!currentUserId) return authError();
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
      if (!currentUserId) return authError();
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
    'Generate a complete brand identity (logo, colors, typography) from a text prompt. Costs credits. Returns brand identity data.',
    {
      prompt: z.string().min(1).describe('Description of the brand to generate (e.g. "modern tech startup called Acme").'),
    },
    async ({ prompt }) => {
      if (!currentUserId) return authError();
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
      if (!currentUserId) return authError();
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
      if (!currentUserId) return authError();
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
      if (!currentUserId) return authError();
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
      if (!currentUserId) return authError();
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
      if (!currentUserId) return authError();
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
      if (!currentUserId) return authError();
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
      if (!currentUserId) return authError();
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
      if (!currentUserId) return authError();
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
      if (!currentUserId) return authError();
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
      if (!currentUserId) return authError();
      try {
        const guideline = await prisma.brandGuideline.findFirst({
          where: { id, userId: currentUserId },
        });
        if (!guideline) return jsonResponse({ error: 'Brand guideline not found' });
        
        const quota = await getQuotaMeta(currentUserId);

        if (format === 'prompt') {
          // Use a simple prompt builder for the text response
          const bg = guideline as any;
          const lines: string[] = [];
          lines.push(`═══ BRAND: ${bg.identity?.name || 'Brand'} ═══`);
          if (bg.identity?.tagline) lines.push(`Tagline: ${bg.identity.tagline}`);
          if (bg.colors?.length) {
            lines.push('\nCOLORS:');
            bg.colors.forEach((c: any) => lines.push(`- ${c.name}: ${c.hex} (${c.role || 'primary'})`));
          }
          if (bg.typography?.length) {
            lines.push('\nTYPOGRAPHY:');
            bg.typography.forEach((t: any) => lines.push(`- ${t.role}: ${t.family} ${t.style || ''}`));
          }
          if (bg.guidelines?.voice) lines.push(`\nVOICE: ${bg.guidelines.voice}`);
          return jsonResponse({ context: lines.join('\n'), id: guideline.id, _meta: quota });
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
  // Community (public, no auth needed)
  // ═══════════════════════════════════════════

  server.tool(
    'community-presets',
    'Browse community-shared mockup presets. Useful for discovering templates and inspiration.',
    {
      limit: z.number().int().min(1).max(50).default(20).describe('Max presets to return (1-50).'),
    },
    async ({ limit }) => {
      try {
        const db = await connectToMongoDB();
        const presets = await db
          .collection('community_presets')
          .find({ public: true })
          .limit(limit)
          .toArray();
        return jsonResponse({ presets, total: presets.length });
      } catch (err: any) {
        return jsonResponse({ error: err.message });
      }
    }
  );

  server.tool(
    'community-profiles',
    'Browse public community creator profiles.',
    {
      limit: z.number().int().min(1).max(50).default(20).describe('Max profiles to return (1-50).'),
    },
    async ({ limit }) => {
      try {
        const users = await prisma.user.findMany({
          where: { username: { not: null } },
          take: limit,
          select: { id: true, name: true, username: true, picture: true, bio: true, createdAt: true },
        });
        return jsonResponse({ profiles: users, total: users.length });
      } catch (err: any) {
        return jsonResponse({ error: err.message });
      }
    }
  );

  return server;
}

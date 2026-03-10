/**
 * Platform MCP Server
 * Exposes Visant Labs platform tools for agents (Claude, Cursor, etc.)
 * Transport: HTTP/SSE (mounted in Express)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/**
 * Helper: build a placeholder response for scaffolded tools.
 * Task 6 will replace these with real implementations.
 */
function placeholder(tool: string, params: Record<string, unknown>) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            message: 'Requires authentication via API key.',
            tool,
            params,
          },
          null,
          2
        ),
      },
    ],
  };
}

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
    async () => placeholder('account-usage', {})
  );

  server.tool(
    'account-profile',
    'Get the authenticated user profile including name, email, avatar, and subscription plan.',
    {},
    async () => placeholder('account-profile', {})
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
    async ({ limit, skip }) => placeholder('mockup-list', { limit, skip })
  );

  server.tool(
    'mockup-get',
    'Get a single mockup by its ID, including image URL, prompt, and metadata.',
    {
      id: z.string().describe('The mockup ID.'),
    },
    async ({ id }) => placeholder('mockup-get', { id })
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
    async ({ type }) => placeholder('mockup-presets', { type })
  );

  server.tool(
    'mockup-generate',
    'Generate a new mockup image using AI. Costs 1 credit. Returns the generated image URL.',
    {
      prompt: z.string().min(1).describe('Description of the mockup to generate.'),
      designType: z.string().optional().describe('Design type hint (e.g. "business-card", "social-media").'),
      aspectRatio: z.string().optional().describe('Aspect ratio (e.g. "16:9", "1:1", "4:3").'),
    },
    async ({ prompt, designType, aspectRatio }) =>
      placeholder('mockup-generate', { prompt, designType, aspectRatio })
  );

  // ═══════════════════════════════════════════
  // Branding
  // ═══════════════════════════════════════════

  server.tool(
    'branding-list',
    'List branding projects owned by the authenticated user.',
    {},
    async () => placeholder('branding-list', {})
  );

  server.tool(
    'branding-get',
    'Get a branding project by ID, including logo, colors, typography, and brand assets.',
    {
      id: z.string().describe('The branding project ID.'),
    },
    async ({ id }) => placeholder('branding-get', { id })
  );

  server.tool(
    'branding-generate',
    'Generate a complete brand identity (logo, colors, typography) from a text prompt. Costs credits based on complexity.',
    {
      prompt: z.string().min(1).describe('Description of the brand to generate (e.g. "modern tech startup called Acme").'),
    },
    async ({ prompt }) => placeholder('branding-generate', { prompt })
  );

  // ═══════════════════════════════════════════
  // Canvas
  // ═══════════════════════════════════════════

  server.tool(
    'canvas-list',
    'List canvas (whiteboard) projects owned by the authenticated user.',
    {},
    async () => placeholder('canvas-list', {})
  );

  server.tool(
    'canvas-get',
    'Get a canvas project by ID, including elements, collaborators, and metadata.',
    {
      id: z.string().describe('The canvas project ID.'),
    },
    async ({ id }) => placeholder('canvas-get', { id })
  );

  server.tool(
    'canvas-create',
    'Create a new empty canvas (whiteboard) project.',
    {
      name: z.string().min(1).describe('Name for the new canvas.'),
    },
    async ({ name }) => placeholder('canvas-create', { name })
  );

  // ═══════════════════════════════════════════
  // Budget
  // ═══════════════════════════════════════════

  server.tool(
    'budget-list',
    'List budget documents created by the authenticated user.',
    {},
    async () => placeholder('budget-list', {})
  );

  server.tool(
    'budget-get',
    'Get a budget document by ID, including line items, totals, and client info.',
    {
      id: z.string().describe('The budget document ID.'),
    },
    async ({ id }) => placeholder('budget-get', { id })
  );

  server.tool(
    'budget-create',
    'Create a new budget document from a template with client and project details.',
    {
      template: z.string().optional().describe('Template ID to base the budget on (optional).'),
      clientName: z.string().min(1).describe('Client or company name.'),
      projectDescription: z.string().min(1).describe('Brief description of the project scope.'),
      brandName: z.string().optional().describe('Brand name if different from client name.'),
    },
    async ({ template, clientName, projectDescription, brandName }) =>
      placeholder('budget-create', { template, clientName, projectDescription, brandName })
  );

  // ═══════════════════════════════════════════
  // AI Utilities
  // ═══════════════════════════════════════════

  server.tool(
    'ai-improve-prompt',
    'Enhance and refine a text prompt using AI to produce better generation results. Costs 1 credit.',
    {
      prompt: z.string().min(1).describe('The original prompt to improve.'),
      context: z.string().optional().describe('Additional context to guide the improvement (e.g. "for a mockup", "for branding").'),
    },
    async ({ prompt, context }) => placeholder('ai-improve-prompt', { prompt, context })
  );

  server.tool(
    'ai-describe-image',
    'Analyze an image and return a detailed text description. Provide either a URL or base64-encoded data. Costs 1 credit.',
    {
      imageUrl: z.string().url().optional().describe('Public URL of the image to analyze.'),
      base64: z.string().optional().describe('Base64-encoded image data (include data URI prefix or raw base64).'),
    },
    async ({ imageUrl, base64 }) => placeholder('ai-describe-image', { imageUrl, base64 })
  );

  // ═══════════════════════════════════════════
  // Community
  // ═══════════════════════════════════════════

  server.tool(
    'community-presets',
    'Browse community-shared mockup presets. Useful for discovering templates and inspiration.',
    {
      limit: z.number().int().min(1).max(50).default(20).describe('Max presets to return (1-50).'),
    },
    async ({ limit }) => placeholder('community-presets', { limit })
  );

  server.tool(
    'community-profiles',
    'Browse public community creator profiles.',
    {
      limit: z.number().int().min(1).max(50).default(20).describe('Max profiles to return (1-50).'),
    },
    async ({ limit }) => placeholder('community-profiles', { limit })
  );

  return server;
}

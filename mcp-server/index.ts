#!/usr/bin/env node
/**
 * Visant Labs — MCP Server
 *
 * Exposes Visant's Creative Studio + Brand Intelligence as MCP tools for
 * agents (Claude Desktop, Cursor, etc.) to consume.
 *
 * DESIGN PRINCIPLE: zero logic duplication.
 * Every tool is a thin HTTP wrapper around the existing Express routes in
 * `server/routes/creative.ts` and `server/routes/brand-guidelines.ts`.
 * The running Visant server is the single source of truth.
 *
 * Run: npm run mcp
 * Config: VISANT_API_URL (default http://localhost:3000/api)
 *         VISANT_API_TOKEN (optional Bearer token)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const API_BASE = process.env.VISANT_API_URL || 'http://localhost:3000/api';
const API_TOKEN = process.env.VISANT_API_TOKEN;

async function visantFetch(path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) || {}),
  };
  if (API_TOKEN) headers.Authorization = `Bearer ${API_TOKEN}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Visant API ${res.status} ${path}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toolResult(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

// ---------- Tool definitions ----------

const TOOLS = [
  {
    name: 'create_creative_plan',
    description:
      'Generate a structured creative layout (background prompt, overlay, layers) for a marketing asset. ' +
      'If brandId is provided, the plan is automatically biased by that brand\'s learned edit history.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Creative brief / user intent' },
        format: {
          type: 'string',
          enum: ['1:1', '9:16', '16:9', '4:5'],
          description: 'Aspect ratio of the creative',
        },
        brandId: {
          type: 'string',
          description: 'Optional brand guideline id for brand-aware generation',
        },
        brandContext: {
          type: 'object',
          description: 'Inline brand context if brandId is not available',
          properties: {
            name: { type: 'string' },
            colors: { type: 'array', items: { type: 'string' } },
            fonts: { type: 'array', items: { type: 'string' } },
            voice: { type: 'string' },
            keywords: { type: 'array', items: { type: 'string' } },
            hasLogos: { type: 'boolean' },
          },
        },
      },
      required: ['prompt', 'format'],
    },
  },
  {
    name: 'get_brand_insights',
    description:
      'Get learned brand preferences aggregated from user edit history. Returns font-size bias, ' +
      'color overrides, logo position bias, commonly removed roles, and human-readable patches. ' +
      'Use this to understand how a brand\'s actual usage diverges from AI defaults.',
    inputSchema: {
      type: 'object',
      properties: {
        brandId: { type: 'string', description: 'Brand guideline id' },
      },
      required: ['brandId'],
    },
  },
  {
    name: 'list_creative_events',
    description:
      'Query the raw creative edit event stream (observability). Newest first. ' +
      'Filter by brandId or creativeId.',
    inputSchema: {
      type: 'object',
      properties: {
        brandId: { type: 'string' },
        creativeId: { type: 'string' },
        limit: { type: 'number', default: 100, maximum: 500 },
      },
    },
  },
  {
    name: 'get_creative_metrics',
    description:
      'Get aggregate creative metrics (creatives count, avg edits per creative, first-try acceptance rate). ' +
      'Optionally scoped to a brand.',
    inputSchema: {
      type: 'object',
      properties: {
        brandId: { type: 'string', description: 'Optional brand filter' },
      },
    },
  },
  {
    name: 'list_brand_guidelines',
    description: 'List all available brand guidelines with ids and names.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_brand_guideline',
    description:
      'Fetch the full brand guideline for a given id. Includes identity, colors, typography, logos, voice, ' +
      'gradients, shadows, motion tokens, borders, strategy, editorial guidelines, and validation state. ' +
      'Use this to get LLM-ready brand context before generating any brand-aware content.',
    inputSchema: {
      type: 'object',
      properties: {
        brandId: { type: 'string' },
      },
      required: ['brandId'],
    },
  },
  {
    name: 'update_brand_guideline',
    description:
      'Patch a brand guideline with new data. Accepts any subset of fields: identity, colors, typography, ' +
      'gradients, shadows, motion, borders, strategy, guidelines, tokens, validation. ' +
      'All fields are optional — only provided fields are updated.',
    inputSchema: {
      type: 'object',
      properties: {
        brandId: { type: 'string', description: 'Brand guideline id to update' },
        data: {
          type: 'object',
          description: 'Partial brand guideline data to merge',
          properties: {
            identity: { type: 'object' },
            colors: { type: 'array' },
            typography: { type: 'array' },
            gradients: { type: 'array' },
            shadows: { type: 'array' },
            motion: { type: 'object' },
            borders: { type: 'array' },
            strategy: { type: 'object' },
            guidelines: { type: 'object' },
            tokens: { type: 'object' },
            validation: { type: 'object' },
            tags: { type: 'object' },
          },
        },
      },
      required: ['brandId', 'data'],
    },
  },
  {
    name: 'validate_brand_section',
    description:
      'Mark a brand guideline section as approved or needs_work. ' +
      'Section names: colors, typography, logos, identity, strategy, editorial, gradients, shadows, motion, borders, tokens.',
    inputSchema: {
      type: 'object',
      properties: {
        brandId: { type: 'string' },
        section: { type: 'string', description: 'Section name to validate' },
        state: {
          type: 'string',
          enum: ['approved', 'needs_work', 'pending'],
          description: 'Validation state to set',
        },
      },
      required: ['brandId', 'section', 'state'],
    },
  },
  {
    name: 'get_brand_design_system',
    description:
      'Get a structured LLM-ready design system context for a brand. Returns colors with semantic roles, ' +
      'typography with intent, spacing/radius tokens, shadows, gradients, motion tokens, and borders — ' +
      'formatted as a concise JSON optimized for AI code generation and design decisions.',
    inputSchema: {
      type: 'object',
      properties: {
        brandId: { type: 'string' },
      },
      required: ['brandId'],
    },
  },
];

// ---------- Tool handlers ----------

type ToolArgs = Record<string, unknown>;

async function handleTool(name: string, args: ToolArgs) {
  switch (name) {
    case 'create_creative_plan': {
      const body = {
        prompt: args.prompt,
        format: args.format,
        brandId: args.brandId,
        brandContext: args.brandContext,
      };
      const data = await visantFetch('/creative/plan', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return toolResult(data);
    }
    case 'get_brand_insights': {
      const data = await visantFetch(`/creative/brand/${args.brandId}/insights`);
      return toolResult(data);
    }
    case 'list_creative_events': {
      const params = new URLSearchParams();
      if (args.brandId) params.set('brandId', String(args.brandId));
      if (args.creativeId) params.set('creativeId', String(args.creativeId));
      if (args.limit) params.set('limit', String(args.limit));
      const data = await visantFetch(`/creative/events?${params.toString()}`);
      return toolResult(data);
    }
    case 'get_creative_metrics': {
      const qs = args.brandId ? `?brandId=${args.brandId}` : '';
      const data = await visantFetch(`/creative/events/metrics${qs}`);
      return toolResult(data);
    }
    case 'list_brand_guidelines': {
      const data = await visantFetch('/brand-guidelines');
      return toolResult(data);
    }
    case 'get_brand_guideline': {
      const data = await visantFetch(`/brand-guidelines/${args.brandId}`);
      return toolResult(data);
    }
    case 'update_brand_guideline': {
      const data = await visantFetch(`/brand-guidelines/${args.brandId}`, {
        method: 'PUT',
        body: JSON.stringify(args.data),
      });
      return toolResult(data);
    }
    case 'validate_brand_section': {
      const current = await visantFetch(`/brand-guidelines/${args.brandId}`);
      const guideline = current.guideline || current;
      const validation = { ...(guideline.validation || {}), [args.section as string]: args.state };
      const data = await visantFetch(`/brand-guidelines/${args.brandId}`, {
        method: 'PUT',
        body: JSON.stringify({ validation }),
      });
      return toolResult(data);
    }
    case 'get_brand_design_system': {
      const raw = await visantFetch(`/brand-guidelines/${args.brandId}`);
      const g = raw.guideline || raw;
      const ds = {
        brand: g.identity?.name,
        colors: (g.colors || []).map((c: any) => ({ hex: c.hex, name: c.name, role: c.role })),
        typography: (g.typography || []).map((t: any) => ({
          family: t.family, role: t.role, size: t.size,
          lineHeight: t.lineHeight, letterSpacing: t.letterSpacing, weights: t.weights,
        })),
        tokens: {
          radius: g.tokens?.radius,
          spacing: g.tokens?.spacing,
        },
        gradients: (g.gradients || []).map((gr: any) => ({ name: gr.name, css: gr.css, usage: gr.usage })),
        shadows: (g.shadows || []).map((s: any) => ({ name: s.name, css: s.css, type: s.type })),
        motion: g.motion,
        borders: (g.borders || []).map((b: any) => ({ name: b.name, css: b.css, role: b.role })),
        voice: g.guidelines?.voice,
        philosophy: g.guidelines?.person,
        strategy: g.strategy?.manifesto ? { manifesto: g.strategy.manifesto } : undefined,
        completeness: g.extraction?.completeness,
        validation: g.validation,
      };
      return toolResult(ds);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ---------- Server bootstrap ----------

async function main() {
  const server = new Server(
    { name: 'visant-labs', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    try {
      return await handleTool(name, (args ?? {}) as ToolArgs);
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error: ${err?.message ?? 'unknown'}` }],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // eslint-disable-next-line no-console
  console.error(`[visant-mcp] connected — API_BASE=${API_BASE}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[visant-mcp] fatal:', err);
  process.exit(1);
});

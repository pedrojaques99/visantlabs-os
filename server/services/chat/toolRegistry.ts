/**
 * Unified chat tool registry.
 *
 * Single source of truth for every tool exposed to LLMs via chat surfaces.
 * Routes request the tool list gated by role, and dispatch execution through
 * one entry point — so we stop maintaining CHAT_TOOLS and ADMIN_CHAT_TOOLS in
 * parallel. The underlying executors stay where they are; this file just
 * declares scope + wires them together.
 */
import { CHAT_TOOLS, executeToolCall } from '../chatToolExecutor.js';
import { ADMIN_CHAT_TOOLS, executeAdminChatTool } from '../adminChatTools.js';
import { prisma } from '../../db/prisma.js';

export type ChatToolScope = 'public' | 'admin';

export interface ChatToolContext {
  userId: string;
  sessionId: string;
  /** Forwarded to admin tools that loopback into internal HTTP APIs. */
  authHeader?: string;
  /** Session-level brand guideline — used as default when LLM omits it. */
  brandGuidelineId?: string;
}

interface RegistryEntry {
  scope: ChatToolScope;
  /** Single Gemini FunctionDeclaration. */
  declaration: any;
  execute: (args: any, ctx: ChatToolContext) => Promise<any>;
}

// Flatten the two legacy shapes:
//   CHAT_TOOLS       = { functionDeclarations: [...] }
//   ADMIN_CHAT_TOOLS = [{ functionDeclarations: [...] }]
const publicDecls: any[] = (CHAT_TOOLS as any).functionDeclarations ?? [];
const adminDecls: any[] = Array.isArray(ADMIN_CHAT_TOOLS)
  ? ADMIN_CHAT_TOOLS.flatMap((t: any) => t.functionDeclarations ?? [])
  : ((ADMIN_CHAT_TOOLS as any).functionDeclarations ?? []);

const REGISTRY: Record<string, RegistryEntry> = {};

for (const d of publicDecls) {
  REGISTRY[d.name] = {
    scope: 'public',
    declaration: d,
    execute: async (args) => executeToolCall(d.name, args),
  };
}

for (const d of adminDecls) {
  REGISTRY[d.name] = {
    scope: 'admin',
    declaration: d,
    execute: async (args, ctx) =>
      executeAdminChatTool(d.name, args, ctx.userId, ctx.sessionId, ctx.authHeader ?? '', ctx.brandGuidelineId),
  };
}

// ── Plugin-scoped tools (public, available to plugin pre-pass) ──

REGISTRY['get_brand_context'] = {
  scope: 'public',
  declaration: {
    name: 'get_brand_context',
    description: 'Fetch brand guideline context (identity, colors, typography, voice) to enrich design generation.',
    parameters: {
      type: 'object',
      properties: {
        brandGuidelineId: {
          type: 'string',
          description: 'Brand guideline ID. Omit to use the session default.',
        },
      },
    },
  },
  execute: async (args: { brandGuidelineId?: string }, ctx) => {
    const id = args.brandGuidelineId || ctx.brandGuidelineId;
    if (!id) return 'No brand guideline selected.';

    const bg = await prisma.brandGuideline.findUnique({ where: { id } });
    if (!bg) return `Brand guideline ${id} not found.`;

    const identity = bg.identity as any;
    const colors = bg.colors as any[];
    const typography = bg.typography as any[];
    const guidelines = bg.guidelines as any;

    const parts: string[] = [];
    if (identity?.name) parts.push(`Brand: ${identity.name}`);
    if (identity?.tagline) parts.push(`Tagline: ${identity.tagline}`);
    if (identity?.description) parts.push(`Description: ${identity.description}`);

    if (colors?.length) {
      parts.push('Colors: ' + colors.map(c => `${c.name || c.role}: ${c.hex}`).join(', '));
    }
    if (typography?.length) {
      parts.push('Typography: ' + typography.map(t => `${t.role}: ${t.family} ${t.weight || ''}`).join(', '));
    }
    if (guidelines?.voice) parts.push(`Voice: ${guidelines.voice}`);
    if (guidelines?.dos?.length) parts.push(`Do: ${guidelines.dos.join('; ')}`);
    if (guidelines?.donts?.length) parts.push(`Don't: ${guidelines.donts.join('; ')}`);

    return parts.join('\n');
  },
};

/**
 * Tool declarations available to a role, in the Gemini SDK shape.
 * Admins get the union of public + admin tools.
 */
export function getChatTools(isAdmin: boolean): Array<{ functionDeclarations: any[] }> {
  const decls = Object.values(REGISTRY)
    .filter(e => isAdmin || e.scope === 'public')
    .map(e => e.declaration);
  return [{ functionDeclarations: decls }];
}

/**
 * Execute any registered tool by name. Returns whatever the underlying
 * executor returns — string for `web_search`, object for admin tools.
 */
export async function executeChatTool(
  name: string,
  args: any,
  ctx: ChatToolContext
): Promise<any> {
  const entry = REGISTRY[name];
  if (!entry) throw new Error(`Unknown chat tool: ${name}`);
  return entry.execute(args, ctx);
}

/** Introspection helper — useful for logging and /debug endpoints. */
export function listChatTools(): Array<{ name: string; scope: ChatToolScope }> {
  return Object.entries(REGISTRY).map(([name, e]) => ({ name, scope: e.scope }));
}

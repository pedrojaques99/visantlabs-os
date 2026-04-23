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

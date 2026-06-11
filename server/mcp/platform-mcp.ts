/**
 * Platform MCP Server
 * Exposes Visant Labs platform tools for agents (Claude, Cursor, etc.)
 * Transport: HTTP/SSE (mounted in Express)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { stripDataUriPrefix } from '../lib/dataUri.js';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { getUserStorageLimit } from '../services/r2Service.js';
import { ObjectId } from 'mongodb';
import { improvePrompt, describeImage } from '../services/geminiService.js';
import { getGeminiApiKey } from '../utils/geminiApiKey.js';
import { getCurrentUserId, runWithContext } from '../lib/request-context.js';
import { trackMcpToolCall } from './mcp-tracking.js';
import {
  buildBrandContext,
  BRAND_SECTION_PRESETS,
  type BrandContextSection,
} from '../lib/brandContextBuilder.js';
import { GEMINI_MODELS, AVAILABLE_IMAGE_MODELS } from '../../src/constants/geminiModels.js';
import {
  IMAGE_MODEL_IDS,
  IMAGE_PROVIDERS,
  DEFAULT_IMAGE_MODEL_ID,
} from '../../src/constants/imageModelRegistry.js';

// ─── Structured error codes ───────────────────────────────────────────────────
function mcpError(code: string, message: string, extra?: Record<string, any>) {
  return jsonResponse({ error: { code, message, ...extra } });
}
const ERR = {
  auth: () =>
    mcpError(
      'UNAUTHORIZED',
      'Authentication required. Connect with API key: Authorization: Bearer visant_sk_xxx'
    ),
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
    if (!hexColorRegex.test(c.hex))
      return `Invalid hex color "${c.hex}" for "${c.name}". Expected format: #RRGGBB`;
  }
  return null;
}

// ─── Strategy deep merge ──────────────────────────────────────────────────────
function mergeStrategy(existing: any, patch: any): any {
  if (!patch) return existing;
  const base = existing || {};
  const merged = { ...base };
  const keys = [
    'manifesto',
    'positioning',
    'archetypes',
    'personas',
    'voiceValues',
    'coreMessage',
    'pillars',
    'marketResearch',
    'graphicSystem',
  ];
  for (const key of keys) {
    if (patch[key] !== undefined) merged[key] = patch[key];
  }
  return merged;
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
  try {
    return await computeQuotaMeta(userId);
  } catch (err) {
    // _meta is advisory: a Mongo/Prisma hiccup must never turn an already-
    // successful tool result into INTERNAL_ERROR. Degrade to no quota meta.
    console.warn(
      '[getQuotaMeta] failed to compute quota meta, returning null:',
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

async function computeQuotaMeta(userId: string) {
  await connectToMongoDB();
  const db = getDb();
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
  if (!user) return null;

  // Auto-renew credits if reset date has passed
  let creditsUsed = user.creditsUsed || 0;
  const creditsResetDate = user.creditsResetDate ? new Date(user.creditsResetDate) : null;
  if (creditsResetDate && new Date() >= creditsResetDate) {
    const nextReset = user.subscriptionEndDate
      ? new Date(user.subscriptionEndDate)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db
      .collection('users')
      .updateOne({ _id: user._id }, { $set: { creditsUsed: 0, creditsResetDate: nextReset } });
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
    : totalCreditsEarned > 0 ||
      (freeGenerationsUsed < FREE_GENERATIONS_LIMIT && credits_remaining > 0);

  // Storage info from Prisma (SQL)
  const storageUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      storageUsedBytes: true,
      storageLimitBytes: true,
      subscriptionTier: true,
      isAdmin: true,
    },
  });

  const storageTier = storageUser?.subscriptionTier || 'free';
  const storageLimit = getUserStorageLimit(
    storageTier,
    storageUser?.isAdmin || false,
    storageUser?.storageLimitBytes
  );
  const storageUsed = storageUser?.storageUsedBytes || 0;
  const storageRemaining = Math.max(0, storageLimit - storageUsed);
  const storagePct =
    storageLimit > 0 ? parseFloat(((storageUsed / storageLimit) * 100).toFixed(2)) : 0;

  const fmtBytes = (b: number) => {
    if (b === 0) return '0 B';
    const k = 1024;
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(b) / Math.log(k)), units.length - 1);
    return `${parseFloat((b / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
  };

  return {
    credits_remaining,
    credits_used: creditsUsed,
    earned_credits: totalCreditsEarned,
    monthly_credits: monthlyCredits,
    plan,
    can_generate,
    reset_date: creditsResetDate?.toISOString() ?? null,
    storage: {
      used: storageUsed,
      limit: storageLimit,
      remaining: storageRemaining,
      percentage: storagePct,
      formatted: {
        used: fmtBytes(storageUsed),
        limit: fmtBytes(storageLimit),
        remaining: fmtBytes(storageRemaining),
      },
    },
  };
}

import {
  MCP_RESULT_MAX_CHARS,
  MCP_ENDPOINT,
  MCP_SPEC_VERSION,
  API_BASE_URL,
  FRONTEND_BASE_URL,
  MCP_HINTS,
} from '../lib/mcp-constants.js';
import { FREE_GENERATIONS_LIMIT, FREE_MONTHLY_CREDITS } from '../lib/credits.js';

function jsonResponse(data: unknown) {
  const text = JSON.stringify(data, null, 2);
  if (text.length <= MCP_RESULT_MAX_CHARS) {
    return { content: [{ type: 'text' as const, text }] };
  }
  const meta = JSON.stringify({
    _truncated: true,
    _originalChars: text.length,
    _message: `Result exceeded ${Math.round(
      MCP_RESULT_MAX_CHARS / 1000
    )}k chars. Use pagination (limit/skip) or filter parameters to reduce the response.`,
  });
  const budget = MCP_RESULT_MAX_CHARS - meta.length - 20;
  return {
    content: [{ type: 'text' as const, text: meta + '\n\n' + text.slice(0, budget) }],
  };
}

// ─── Community likes helper ──────────────────────────────────────────────────
async function getCommunityLikesMap(
  db: any,
  presetIds: string[],
  userId?: string
): Promise<Map<string, { likesCount: number; isLikedByUser: boolean }>> {
  const likes = await db
    .collection('community_preset_likes')
    .find({ presetId: { $in: presetIds } })
    .toArray();
  const map = new Map<string, { likesCount: number; isLikedByUser: boolean }>();
  presetIds.forEach((id) => map.set(id, { likesCount: 0, isLikedByUser: false }));
  const userOid = userId ? new ObjectId(userId) : null;
  likes.forEach((like: any) => {
    const entry = map.get(like.presetId) || { likesCount: 0, isLikedByUser: false };
    entry.likesCount++;
    if (userOid && like.userId.equals(userOid)) entry.isLikedByUser = true;
    map.set(like.presetId, entry);
  });
  return map;
}

/** Base URL for internal API calls (reuses existing route logic for credits, validation, etc.) */
const INTERNAL_API_BASE =
  process.env.INTERNAL_API_URL || `http://localhost:${process.env.PORT || 3001}`;

/** Extract the `data:` payload from a specific SSE event in raw text. */
function extractSseEventData(sseText: string, eventName: string): string | null {
  const lines = sseText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === `event: ${eventName}` && i + 1 < lines.length) {
      const dataLine = lines[i + 1];
      if (dataLine.startsWith('data: ')) return dataLine.slice(6);
    }
  }
  return null;
}

// ─── Dynamic tool registry ────────────────────────────────────────────────────
// Populated by createPlatformMcpServer() on first call; stable after that.
let _registeredToolNames: string[] = [];

/** Returns the live list of tool names registered in the platform MCP server. */
export function getMcpToolNames(): string[] {
  return _registeredToolNames;
}
/** Returns the live count of tools registered in the platform MCP server. */
export function getMcpToolCount(): number {
  return _registeredToolNames.length;
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
        prompts: {},
        resources: {},
      },
      instructions: `Visant Labs MCP — AI design platform for mockups, branding, creative studio, and image generation.

## Authentication

You are connected via OAuth 2.1 or API key. If you need to authenticate a new agent or check your own access:

- **OAuth discovery:** \`GET ${API_BASE_URL}/.well-known/oauth-authorization-server\`
- **Scopes:** \`read\` (list/get), \`write\` (create/update), \`generate\` (AI generation — costs credits)
- **Token lifetime:** access token = 1 hour (JWT), refresh token = 30 days (rotated on use)
- **Manage connected apps:** use \`oauth-authorized-apps\` tool to list, \`oauth-revoke-app\` to revoke

### For custom agents connecting via OAuth:
${MCP_HINTS.oauthSteps(API_BASE_URL)
  .map((s) => `- ${s}`)
  .join('\n')}

**No local server? Use Device Flow (recommended):**
${MCP_HINTS.deviceFlowSteps(API_BASE_URL)
  .map((s) => `- ${s}`)
  .join('\n')}

**Fallback (OOB):** Use \`redirect_uri=urn:ietf:wg:oauth:2.0:oob\` — the auth code is displayed on screen for the user to copy back to you.

## JSON-RPC Protocol (for custom agents using raw HTTP)

All communication is JSON-RPC 2.0 via a single endpoint: \`POST ${MCP_ENDPOINT}\`

**Required headers:**
${MCP_HINTS.requiredHeaders.map((h) => `- \`${h}\``).join('\n')}

**Steps:**
${MCP_HINTS.jsonRpcSteps(MCP_ENDPOINT, MCP_SPEC_VERSION)
  .map((s) => `- ${s}`)
  .join('\n')}

**IMPORTANT:**
- ${MCP_HINTS.warnings.argumentsRequired}
- ${MCP_HINTS.warnings.notRestApi}
- ${MCP_HINTS.warnings.persistToken}

## Tool Workflows (follow these sequences)

### Mockup from existing design (logo, sticker, poster, card)
1. upload-image — convert the design file (base64) into a public URL
2. mockup-generate — pass the URL in referenceImages, describe ONLY the scene in the prompt
   - prompt = physical context: surface material, lighting, camera angle, wear/texture, background color
   - referenceImages = the actual design artwork (the URL from step 1)
   - NEVER describe the design's text, layout, fonts, or graphics in the prompt — the AI will hallucinate them. The reference image IS the design.
   - Example prompt: "vinyl sticker on brushed steel surface, flat neutral gray background, slight edge peeling, soft even studio lighting, top-down flat lay"
   - Example BAD prompt: "a sticker that says CLUBE with a speedometer showing 312 km/h" ← this will hallucinate

### Mockup with brand identity (no design file)
1. mockup-generate with brandGuidelineId — logos, colors, typography auto-injected
   - prompt = scene description + what kind of design (e.g. "business card on marble desk, warm lighting")
   - Do NOT describe the logo — it's injected from the brand guideline

### Quick image generation (no existing design, no brand)
1. ai-generate-image — full creative control via prompt, no brand injection
   - For mockups of existing designs, use mockup-generate instead

### Batch mockups (multiple designs)
For each design file: upload-image → collect URL → mockup-generate with referenceImages
Run upload-image calls in parallel, then mockup-generate calls in parallel.

## Prompt Templates (MCP Prompts)
Prompt templates are discoverable via the MCP prompts API (prompts/list):
- **mockup-scene** — proven scene descriptions for mockup-generate, from community presets + user feedback (thumbs-up only)
- **prompt-library** — full searchable library across community, feedback, and auto-promoted patterns
When unsure what prompt to write, query these first — they contain battle-tested prompts with real results.

### Playground mini-app workflow
**Quickstart (1 call):** playground-quickstart — prompt → generate + save + share URL. Done.
**Step-by-step:**
1. playground-generate — prompt → JSON spec
2. playground-describe — spec → visual tree (see the layout without a browser)
3. playground-iterate — refine with follow-up prompts (repeat 2→3 until happy)
4. playground-save — persist to library
5. playground-share — get public share URL
6. playground-publish — publish to community gallery
**Browse:** playground-feed (gallery), playground-get (by slug), playground-fork (copy).

### Brand design system workflow
1. brand-guidelines-create (or brand-guidelines-ingest from URL/text)
2. brand-guidelines-health-check — see what's missing
3. brand-guidelines-figma-link + brand-guidelines-figma-sync — import tokens from Figma
4. brand-guidelines-compile — export CSS/Tailwind/JSON tokens for code
5. brand-guidelines-compliance-check — AI audit for consistency

### Client onboarding (send brand to a client's AI tool)
1. brand-guidelines-invite — create invite link for a brand guideline
2. Send the connectUrl to the client — they accept, pick their LLM, and connect in one click
   - Cursor and VS Code get deep-link buttons (zero config)
   - Claude and ChatGPT get copy-paste URL instructions

### Edit an existing mockup
1. ai-change-object — replace/modify objects in a mockup image
2. ai-apply-theme — apply visual themes (christmas, cyberpunk, etc.)

### Batch ad campaign
1. campaign-generate — fire async batch (returns jobId)
2. campaign-status — poll until status="done", collect image URLs

### 3D Studio (scene orchestration)
1. studio3d-list-presets — discover available materials, animations, environments
2. studio3d-create-scene — configure and save a 3D scene, get a deep-link URL
3. studio3d-list-scenes / studio3d-get-scene — manage saved scenes
4. update-studio3d-scene / delete-studio3d-scene — edit or remove scenes
The deep-link URL opens the 3D Studio with the scene pre-loaded. Users can then add their SVG/logo, export to PNG/MP4/GLB.

### Smart analysis (auto-detect + auto-prompt)
1. smart-analyze — pass any image, get category detection + ready-to-use mockup prompt
2. mockup-generate — use the returned prompt directly

## Key Rules
- upload-image is FREE (no credits) — always use it to convert base64 to URLs before generation
- smart-analyze, ai-extract-colors, ai-suggest-prompt-variations, ai-improve-prompt are FREE
- studio3d-* tools are FREE (no credits) — scene config, save, list, get
- mockup-generate, ai-generate-image, ai-change-object, ai-apply-theme COST credits
- Check payments-subscription-status or settings-byok-status before suggesting paid operations
- When passing string values, send content directly without escape sequences
- All generation tools return imageUrl in the response — use it directly, no need to download`,
    }
  );

  // Wrap server.tool to auto-collect names + enforce OAuth scopes
  const collectedNames: string[] = [];
  const originalTool = server.tool.bind(server);

  const GENERATE_TOOLS_SET = new Set([
    'mockup-generate',
    'creative-generate',
    'creative-full',
    'branding-generate',
    'ai-generate-image',
    'ai-generate-naming',
    'ai-improve-prompt',
    'ai-suggest-prompt-variations',
    'ai-change-object',
    'ai-apply-theme',
    'moodboard-upscale',
    'moodboard-suggest',
    'video-generate',
    'campaign-generate',
    'playground-generate',
  ]);

  const WRITE_PATTERN =
    /-(create|update|delete|remove|save|duplicate|invite|share|upload|restore|fork|publish|link|sync|ingest|render|iterate|like|quickstart|revoke)($|-)/;
  const WRITE_PREFIXES = /^(auth-|pdf-|images-to-)/;
  const READ_OVERRIDES = new Set([
    'api-key-list',
    'brand-guidelines-compile',
    'brand-guidelines-export',
    'brand-guidelines-compare-versions',
  ]);

  function scopeForTool(name: string): 'read' | 'write' | 'generate' {
    if (GENERATE_TOOLS_SET.has(name)) return 'generate';
    if (READ_OVERRIDES.has(name)) return 'read';
    if (WRITE_PATTERN.test(name) || WRITE_PREFIXES.test(name)) return 'write';
    return 'read';
  }

  (server as any).tool = (name: string, ...rest: any[]) => {
    collectedNames.push(name);
    // Intercept the handler (last arg) to add scope checking
    const handlerIdx = rest.length - 1;
    const originalHandler = rest[handlerIdx];
    if (typeof originalHandler === 'function') {
      rest[handlerIdx] = async (...args: any[]) => {
        const scope = scopeForTool(name);
        const scopeErr = requireScope(scope);
        if (scopeErr) return mcpError('FORBIDDEN', scopeErr);
        const start = Date.now();
        try {
          const result = await originalHandler(...args);
          trackMcpToolCall(name, getCurrentUserId(), scope, Date.now() - start, true);
          return result;
        } catch (err) {
          trackMcpToolCall(name, getCurrentUserId(), scope, Date.now() - start, false);
          throw err;
        }
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
    { title: 'Register Account', destructiveHint: false },
    async ({ email, password, name }) => {
      try {
        const resp = await fetch(`${INTERNAL_API_BASE}/api/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name: name || email.split('@')[0] }),
        });
        const result = (await resp.json()) as any;
        if (!resp.ok)
          return ERR.validation(
            result?.error || result?.message || `Registration failed (${resp.status})`
          );
        return jsonResponse({
          message:
            'Account created. Use api-key-create with the returned token to generate your visant_sk_xxx API key.',
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
    { title: 'Sign In', destructiveHint: false },
    async ({ email, password }) => {
      try {
        const resp = await fetch(`${INTERNAL_API_BASE}/api/auth/signin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const result = (await resp.json()) as any;
        if (!resp.ok)
          return ERR.validation(
            result?.error || result?.message || `Login failed (${resp.status})`
          );
        return jsonResponse({
          message:
            'Signed in. Use api-key-create with this token to generate a persistent visant_sk_xxx API key.',
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
      name: z
        .string()
        .max(100)
        .describe('A label for this key, e.g. "Claude.ai MCP" or "Production".'),
      scopes: z
        .array(z.enum(['read', 'write', 'generate']))
        .default(['read', 'write', 'generate'])
        .describe('Permission scopes.'),
      jwt: z
        .string()
        .optional()
        .describe('JWT token from auth-login or auth-register (if you have no API key yet).'),
    },
    { title: 'Create API Key', destructiveHint: false },
    async ({ name, scopes, jwt }) => {
      const currentUserId = getMcpUserId();
      // Allow either MCP API key auth OR a JWT passed directly
      const authHeader = currentUserId
        ? `x-mcp-user-id: ${currentUserId}` // will be handled below
        : jwt
        ? null
        : null;

      if (!currentUserId && !jwt) {
        return ERR.validation(
          'Authentication required. Pass a JWT from auth-login, or connect with an existing API key.'
        );
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
        const result = (await resp.json()) as any;
        if (!resp.ok) return ERR.internal(result?.error || `Key creation failed (${resp.status})`);
        return jsonResponse({
          message: 'API key created. Save the key — it will not be shown again.',
          key: result.key,
          keyPrefix: result.keyPrefix,
          name: result.name,
          scopes: result.scopes,
          usage: 'Authorization: Bearer ' + result.key,
          mcpUrl: MCP_ENDPOINT,
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
    { title: 'List API Keys', readOnlyHint: true },
    async () => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const resp = await fetch(`${INTERNAL_API_BASE}/api/api-keys`, {
          headers: { 'x-mcp-user-id': currentUserId },
        });
        const result = (await resp.json()) as any;
        if (!resp.ok) return ERR.internal(result?.error || `Failed to list keys (${resp.status})`);
        return jsonResponse({ keys: result.keys });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // OAuth — Connected Apps Management
  // ═══════════════════════════════════════════

  server.tool(
    'oauth-authorized-apps',
    "List all AI agents and applications authorized to access the user's account via OAuth. Shows client name, scopes granted, and when access was granted.",
    {},
    { title: 'List Connected OAuth Apps', readOnlyHint: true },
    async () => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const resp = await fetch(`${INTERNAL_API_BASE}/oauth/authorized-apps`, {
          headers: { 'x-mcp-user-id': currentUserId },
        });
        const result = (await resp.json()) as any;
        if (!resp.ok) return ERR.internal(result?.error || `Failed to list apps (${resp.status})`);
        return jsonResponse(result);
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'oauth-revoke-app',
    'Revoke OAuth access for a connected app. The app will no longer be able to act on behalf of the user. Requires confirm: true.',
    {
      appId: z
        .string()
        .describe('The ID of the authorized app grant to revoke (from oauth-authorized-apps).'),
      confirm: z.boolean().describe('Must be true to confirm revocation.'),
    },
    { title: 'Revoke Connected App', destructiveHint: true },
    async ({ appId, confirm }) => {
      if (!confirm) return ERR.validation('Set confirm: true to revoke access.');
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const resp = await fetch(`${INTERNAL_API_BASE}/oauth/authorized-apps/${appId}`, {
          method: 'DELETE',
          headers: { 'x-mcp-user-id': currentUserId },
        });
        const result = (await resp.json()) as any;
        if (!resp.ok) return ERR.internal(result?.error || `Failed to revoke (${resp.status})`);
        return jsonResponse(result);
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Prompts — OAuth setup guide
  // ═══════════════════════════════════════════

  server.prompt(
    'oauth-setup',
    'Step-by-step guide for connecting an AI agent to Visant Labs via OAuth 2.1 + PKCE',
    async () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `# OAuth 2.1 Setup Guide for AI Agents

## Step 1 — Register a Dynamic Client
\`\`\`
POST https://api.visantlabs.com/oauth/register
Content-Type: application/json

{
  "client_name": "My Agent",
  "redirect_uris": ["http://localhost:3000/callback"],
  "grant_types": ["authorization_code"],
  "token_endpoint_auth_method": "none"
}
\`\`\`
Save the \`client_id\` from the response.

## Step 2 — Generate PKCE Challenge
Generate a random \`code_verifier\` (43–128 chars, base64url).
Compute \`code_challenge = BASE64URL(SHA256(code_verifier))\`.

## Step 3 — Authorize
Open in browser:
\`\`\`
https://api.visantlabs.com/oauth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3000/callback&code_challenge=YOUR_CHALLENGE&code_challenge_method=S256&state=RANDOM_STATE&response_type=code&scope=read+write+generate
\`\`\`
User signs in and approves → redirected to callback with \`?code=AUTH_CODE&state=STATE\`.

## Step 4 — Exchange Code for Token
\`\`\`
POST https://api.visantlabs.com/oauth/token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "code": "AUTH_CODE",
  "code_verifier": "YOUR_VERIFIER",
  "client_id": "YOUR_CLIENT_ID",
  "redirect_uri": "http://localhost:3000/callback"
}
\`\`\`
Returns \`access_token\` (JWT, 1h) and \`refresh_token\` (90d).

## Step 5 — Use the Token
\`\`\`
Authorization: Bearer <access_token>
\`\`\`

## Step 6 — Refresh When Expired
\`\`\`
POST https://api.visantlabs.com/oauth/token
Content-Type: application/json

{
  "grant_type": "refresh_token",
  "refresh_token": "YOUR_REFRESH_TOKEN",
  "client_id": "YOUR_CLIENT_ID"
}
\`\`\`

## Available Scopes
- \`read\` — List and get resources
- \`write\` — Create and modify resources
- \`generate\` — AI generation (costs credits)

## Discovery
\`GET https://api.visantlabs.com/.well-known/oauth-authorization-server\``,
          },
        },
      ],
    })
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
    { title: 'Detect Moodboard Grid', readOnlyHint: true },
    async ({ imageBase64 }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const resp = await fetch(`${INTERNAL_API_BASE}/api/moodboard/detect-grid`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ imageBase64 }),
        });
        const result = (await resp.json()) as any;
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
    { title: 'Upscale Image', destructiveHint: false },
    async ({ imageBase64, size }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const resp = await fetch(`${INTERNAL_API_BASE}/api/moodboard/upscale`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ imageBase64, size }),
        });
        const result = (await resp.json()) as any;
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
      images: z
        .array(
          z.object({
            id: z.string().describe('Cell identifier (e.g. "cell-1").'),
            base64: z.string().describe('Base64-encoded image data for this cell.'),
          })
        )
        .min(1)
        .max(9)
        .describe('Array of moodboard cells to analyze.'),
    },
    { title: 'Suggest Moodboard Images', destructiveHint: false },
    async ({ images }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const resp = await fetch(`${INTERNAL_API_BASE}/api/moodboard/suggest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ images }),
        });
        const result = (await resp.json()) as any;
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
    'Get credit usage, remaining balance, plan limits, storage quota (used/limit/remaining), and billing cycle info for the authenticated account.',
    {},
    { title: 'Get Account Usage', readOnlyHint: true },
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
    { title: 'Get Account Profile', readOnlyHint: true },
    async () => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        await connectToMongoDB();
        const db = getDb();
        const user = await db.collection('users').findOne(
          { _id: new ObjectId(currentUserId) },
          {
            projection: {
              _id: 1,
              name: 1,
              email: 1,
              picture: 1,
              subscriptionStatus: 1,
              username: 1,
              bio: 1,
              createdAt: 1,
            },
          }
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
    { title: 'List Mockups', readOnlyHint: true },
    async ({ limit, skip }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const mockups = await prisma.mockup.findMany({
          where: { userId: currentUserId },
          take: limit,
          skip,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            prompt: true,
            imageUrl: true,
            designType: true,
            tags: true,
            aspectRatio: true,
            createdAt: true,
          },
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
    { title: 'Get Mockup', readOnlyHint: true },
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
    'Browse proven scene descriptions (presets) by category. Returns prompt templates you can use directly as the prompt parameter in mockup-generate. These are NOT image references — they are scene descriptions.',
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
    { title: 'Browse Mockup Presets', readOnlyHint: true },
    async ({ type }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const db = await connectToMongoDB();
        const presets = await db.collection('mockup_presets').find({ type }).limit(50).toArray();
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
    'Generate an image from a text prompt. No brand injection, no project saving — just prompt → image. For placing existing designs in scenes, use mockup-generate instead. Costs credits.',
    {
      prompt: z
        .string()
        .min(1)
        .describe('Full image description — style, composition, colors, lighting, mood.'),
      model: z
        .enum(IMAGE_MODEL_IDS)
        .default(DEFAULT_IMAGE_MODEL_ID)
        .describe(
          'gpt-image-2=best, gemini=fast, seedream=photorealistic (requires your own BytePlus API key via Settings → BYOK).'
        ),
      aspectRatio: z
        .enum(['1:1', '9:16', '16:9', '4:5'])
        .default('1:1')
        .describe('Output aspect ratio.'),
      resolution: z.enum(['1K', '2K', '4K']).default('1K').describe('Higher = more credits.'),
      referenceImages: z
        .array(z.string())
        .optional()
        .describe('Reference URLs or base64 to guide style. Use upload-image for local files.'),
      seed: z.number().int().optional().describe('Random seed for reproducible results.'),
    },
    { title: 'Generate AI Image', destructiveHint: false },
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
        const result = (await response.json()) as any;
        if (!response.ok) {
          const detail = [result.error, result.message, result.hint].filter(Boolean).join(' — ');
          return ERR.internal(detail || `Image generation failed (${response.status})`);
        }
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
    `Generate a mockup image placing a design into a realistic scene.

Two workflows:
A) With referenceImages: upload-image first to get a URL, then pass it in referenceImages array. Prompt describes the SCENE only (surface, lighting, angle), never the design content.
B) With brandGuidelineId: pass the brand guideline ID and the logo/colors/typography are auto-injected. No upload needed.

Example call: { "prompt": "laptop on marble desk, soft studio lighting, top-down", "referenceImages": ["https://...logo.png"] }
Example call: { "prompt": "business card on white surface, natural light", "brandGuidelineId": "abc123" }`,
    {
      prompt: z
        .string()
        .min(1)
        .describe(
          'Scene/environment ONLY — surface material, lighting, camera angle, wear/texture, background color. NEVER describe the design content (text, logo, layout) here — the AI will hallucinate it. Pass the actual design via referenceImages or brandGuidelineId instead.'
        ),
      brandGuidelineId: z
        .string()
        .optional()
        .describe(
          'Brand guideline ID. Auto-injects logo, colors, typography into generation. Alternative to referenceImages — use one or the other.'
        ),
      model: z
        .enum(IMAGE_MODEL_IDS)
        .default(DEFAULT_IMAGE_MODEL_ID)
        .describe(
          'gpt-image-2=best quality (recommended), gemini=fast/creative, seedream=photorealistic (requires your own BytePlus API key via Settings → BYOK).'
        ),
      provider: z
        .enum(IMAGE_PROVIDERS)
        .optional()
        .describe('Provider override. Inferred from model by default.'),
      aspectRatio: z
        .enum(['1:1', '9:16', '16:9', '4:5'])
        .default('1:1')
        .describe('1:1=square, 9:16=story, 16:9=landscape, 4:5=portrait.'),
      resolution: z.enum(['1K', '2K', '4K']).default('1K').describe('Higher = more credits.'),
      designType: z
        .string()
        .optional()
        .describe('Hint: business-card, social-media, packaging, apparel, signage, sticker, etc.'),
      baseImageUrl: z
        .string()
        .optional()
        .describe(
          'Base image for img2img transformation (rare). For placing a design in a scene, use referenceImages instead.'
        ),
      referenceImages: z
        .array(z.string())
        .optional()
        .describe(
          'URLs of the design/artwork to place in the scene (e.g. logo, poster, card). Get URLs via upload-image tool first. Also accepts base64 data URIs. This is NOT a preset ID — it must be an image URL.'
        ),
      seed: z.number().int().optional().describe('Random seed for reproducible results.'),
    },
    { title: 'Generate Mockup', destructiveHint: false },
    async ({
      prompt,
      brandGuidelineId,
      model,
      provider,
      aspectRatio,
      resolution,
      designType,
      baseImageUrl,
      referenceImages,
      seed,
    }) => {
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
        const result = (await response.json()) as any;
        if (!response.ok) {
          const detail = [result.error, result.message, result.hint].filter(Boolean).join(' — ');
          return ERR.internal(detail || `Generation failed (${response.status})`);
        }
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

  // ─── Video Generation ───
  server.tool(
    'video-generate',
    'Generate a video using AI (Google Veo or Kling). Supports text-to-video, image-to-video, frames-to-video, extend-video, and references modes. Costs credits based on model.',
    {
      prompt: z.string().min(1).describe('Video scene description.'),
      model: z
        .enum([
          'veo-3.1-generate-preview',
          'veo-3.1-fast-generate-preview',
          'kling-v3-omni',
          'kling-v3',
          'kling-v2.6',
          'kling-v2.5-turbo',
          'kling-v2.1',
          'kling-v1.6',
          'kling-v1.5',
          'kling-v1',
        ])
        .default('veo-3.1-generate-preview')
        .describe(
          'Video model. veo-3.1=high quality, veo-3.1-fast=faster, kling-v3-omni=latest Kling.'
        ),
      mode: z
        .enum(['text_to_video', 'image_to_video', 'frames_to_video', 'extend_video', 'references'])
        .default('text_to_video')
        .describe('Generation mode.'),
      aspectRatio: z
        .enum(['16:9', '9:16', '1:1', '4:3', '3:4'])
        .default('16:9')
        .describe('Output aspect ratio.'),
      duration: z.enum(['5s', '10s']).default('5s').describe('Video duration.'),
      negativePrompt: z.string().optional().describe('What to avoid (Kling models only).'),
      isLooping: z.boolean().optional().describe('Loop the video (Veo models only).'),
      seed: z.number().int().optional().describe('Random seed for reproducible generation.'),
      startFrame: z
        .string()
        .optional()
        .describe('Start frame image URL (for frames_to_video or image_to_video mode).'),
      endFrame: z.string().optional().describe('End frame image URL (for frames_to_video mode).'),
      referenceImages: z
        .array(z.string())
        .max(4)
        .optional()
        .describe('Reference image URLs (up to 4, for references mode).'),
      inputVideo: z.string().optional().describe('Input video URL (for extend_video mode).'),
      klingMode: z
        .enum(['std', 'pro', '4k'])
        .optional()
        .describe('Kling quality mode (Kling models only).'),
      sound: z.enum(['on', 'off']).optional().describe('Generate audio (Kling v2.6+ and Veo 3.1).'),
      cfgScale: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe('CFG scale 0-1 (Kling v1.x only). 0=free, 1=strict prompt adherence.'),
    },
    { title: 'Generate Video', destructiveHint: false },
    async ({
      prompt,
      model,
      mode,
      aspectRatio,
      duration,
      negativePrompt,
      isLooping,
      seed,
      startFrame,
      endFrame,
      referenceImages,
      inputVideo,
      klingMode,
      sound,
      cfgScale,
    }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/video/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({
            prompt,
            model,
            mode,
            aspectRatio,
            duration,
            negativePrompt,
            isLooping,
            seed,
            startFrame,
            endFrame,
            referenceImages,
            inputVideo,
            klingMode,
            sound,
            cfgScale,
          }),
        });
        const result = (await response.json()) as any;
        if (!response.ok) {
          const detail = [result.error, result.message, result.hint].filter(Boolean).join(' — ');
          return ERR.internal(detail || `Video generation failed (${response.status})`);
        }
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({
          videoUrl: result.videoUrl || null,
          seed: result.seed ?? seed ?? null,
          modelUsed: result.modelUsed || model,
          creditsDeducted: result.creditsDeducted ?? null,
          creditsRemaining: result.creditsRemaining ?? null,
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
    { title: 'List Brand Identities', readOnlyHint: true },
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
    { title: 'Get Brand Identity', readOnlyHint: true },
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
      prompt: z
        .string()
        .min(1)
        .describe(
          'Brand brief (e.g. "modern tech startup called Acme, targets developers, dark aesthetic").'
        ),
      step: z
        .enum([
          'full',
          'market-research',
          'swot',
          'persona',
          'archetype',
          'concept-ideas',
          'color-palettes',
          'moodboard',
          'visant-full',
          'visant-central-message',
          'visant-market-research',
          'visant-persona',
          'visant-archetypes-tone',
          'visant-manifesto',
          'visant-swot',
          'visant-color-palette',
          'visant-typography',
          'visant-graphic-system',
          'visant-logo-concept',
        ])
        .default('full')
        .describe(
          'Generation step. RECOMMENDED: use "visant-full" for the complete Metodologia Visant pipeline (10 steps, higher quality). Legacy: "full" runs the older single-pass pipeline. For iterative refinement, use individual "visant-*" steps in order and pass previousData between calls.'
        ),
      previousData: z
        .record(z.string(), z.unknown())
        .optional()
        .describe(
          'Output from a previous step to use as context for the next step. Pass the result of the previous branding-generate call here.'
        ),
      brandGuidelineId: z
        .string()
        .optional()
        .describe('Existing brand guideline ID to use as context/reference.'),
    },
    { title: 'Generate Brand Identity', destructiveHint: false },
    async ({ prompt, step, previousData, brandGuidelineId }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();

      const visantStepMap: Record<string, number> = {
        'visant-central-message': 101,
        'visant-market-research': 102,
        'visant-persona': 103,
        'visant-archetypes-tone': 104,
        'visant-manifesto': 105,
        'visant-swot': 106,
        'visant-color-palette': 107,
        'visant-typography': 108,
        'visant-graphic-system': 109,
        'visant-logo-concept': 110,
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
              body: JSON.stringify({
                prompt,
                step: stepNum,
                previousData: accumulatedData,
                feature: 'agent',
              }),
            });
            const result = (await response.json()) as any;
            if (!response.ok) {
              const detail = [result.error, result.message, result.hint]
                .filter(Boolean)
                .join(' — ');
              return ERR.internal(detail || `Visant step ${stepNum} failed`);
            }
            // Accumulate data for cascading context
            if (result.data) {
              if (stepNum === 101) {
                accumulatedData.centralMessage = result.data.centralMessage;
                accumulatedData.pillars = result.data.pillars;
                accumulatedData.version = 'v2';
              } else if (stepNum === 102) accumulatedData.marketResearchV2 = result.data;
              else if (stepNum === 103) accumulatedData.personaV2 = result.data;
              else if (stepNum === 104) {
                accumulatedData.archetypesV2 = result.data.archetypes;
                accumulatedData.toneOfVoice = result.data.toneOfVoice;
              } else if (stepNum === 105) accumulatedData.manifesto = result.data;
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
          body: JSON.stringify({
            prompt,
            step: resolvedStep,
            previousData,
            brandGuidelineId,
            feature: 'agent',
          }),
        });
        const result = (await response.json()) as any;
        if (!response.ok) {
          const detail = [result.error, result.message, result.hint].filter(Boolean).join(' — ');
          return ERR.internal(detail || `Branding generation failed (${response.status})`);
        }
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
    { title: 'List Canvases', readOnlyHint: true },
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
    { title: 'Get Canvas', readOnlyHint: true },
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
    { title: 'Create Canvas', destructiveHint: false },
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
    { title: 'List Budgets', readOnlyHint: true },
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
    { title: 'Get Budget', readOnlyHint: true },
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
    { title: 'Create Budget', destructiveHint: false },
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
    { title: 'Improve Prompt', destructiveHint: false },
    async ({ prompt }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        let userApiKey: string | undefined;
        try {
          userApiKey = await getGeminiApiKey(currentUserId);
        } catch {
          /* use system key */
        }
        const result = await improvePrompt(prompt, userApiKey);
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ improvedPrompt: result.improvedPrompt, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Image Upload (generic, decoupled from brand guidelines)
  // ═══════════════════════════════════════════

  server.tool(
    'upload-image',
    'Upload a base64 image and get a permanent public URL. Required before mockup-generate/ai-generate-image when you have a local file. Free, no credits, max 20MB.',
    {
      data: z
        .string()
        .min(1)
        .describe('Base64-encoded image data. With or without data URI prefix — both work.'),
      contentType: z
        .enum(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
        .default('image/png')
        .describe('MIME type. Default: image/png.'),
      label: z.string().optional().describe('Optional label for organization (e.g. "sticker-v1").'),
    },
    { title: 'Upload Image', destructiveHint: false },
    async ({ data, contentType, label }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      const scopeErr = requireScope('write');
      if (scopeErr) return mcpError('FORBIDDEN', scopeErr);
      try {
        const resp = await fetch(`${INTERNAL_API_BASE}/api/images/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ data, contentType, label }),
        });
        const result = (await resp.json()) as any;
        if (!resp.ok) return ERR.internal(result?.error || `Upload failed (${resp.status})`);
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ url: result.url, id: result.id, size: result.size, _meta: quota });
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
      base64: z
        .string()
        .optional()
        .describe('Base64-encoded image data (include data URI prefix or raw base64).'),
    },
    { title: 'Describe Image', readOnlyHint: true },
    async ({ imageUrl, base64 }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        if (!imageUrl && !base64) {
          return jsonResponse({ error: 'Provide either imageUrl or base64.' });
        }

        let userApiKey: string | undefined;
        try {
          userApiKey = await getGeminiApiKey(currentUserId);
        } catch {
          /* use system key */
        }

        // Build image input
        const imageInput = base64 ? { base64, mimeType: 'image/png' } : imageUrl!;

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
    'image-extract-url',
    'Extract high-resolution images from any public URL (Behance, Pinterest, Dribbble, portfolios, blogs). Returns a list of image URLs with metadata. Supports lazy-loaded images, srcset, and background images.',
    {
      url: z
        .string()
        .url()
        .describe('The public URL to extract images from (e.g. Behance gallery, portfolio page).'),
      limit: z
        .number()
        .min(1)
        .max(200)
        .default(80)
        .describe('Maximum number of images to return (default 80).'),
    },
    { title: 'Extract Image from URL', readOnlyHint: true },
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
        const result = (await resp.json()) as any;
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
    { title: 'List Brand Guidelines', readOnlyHint: true },
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
    'Get a brand guideline by ID. Use "sections" to fetch only what you need (e.g. ["colors","typography"] for visual tasks). Presets: "visual" (colors/typo/tokens), "copy" (voice/strategy), "minimal" (identity/colors/typo), "imageGen", "full". Omit sections for full context.',
    {
      id: z.string().describe('The brand guideline ID.'),
      format: z
        .enum(['structured', 'prompt'])
        .default('structured')
        .describe('Output format: "structured" (JSON) or "prompt" (LLM-ready text).'),
      sections: z
        .union([
          z.array(
            z.enum([
              'identity',
              'colors',
              'typography',
              'voice',
              'strategy',
              'tokens',
              'logos',
              'media',
              'tags',
              'themes',
              'knowledge',
            ])
          ),
          z.enum(['visual', 'copy', 'full', 'imageGen', 'minimal']),
        ])
        .optional()
        .describe(
          'Which brand sections to include. Pass an array of specific sections or a preset name. Omit for full context.'
        ),
    },
    { title: 'Get Brand Guideline', readOnlyHint: true },
    async ({ id, format, sections: sectionsInput }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const guideline = await prisma.brandGuideline.findFirst({
          where: { id, userId: currentUserId },
        });
        if (!guideline) return jsonResponse({ error: 'Brand guideline not found' });

        const quota = await getQuotaMeta(currentUserId);

        const resolvedSections: BrandContextSection[] | undefined =
          typeof sectionsInput === 'string' ? BRAND_SECTION_PRESETS[sectionsInput] : sectionsInput;

        if (format === 'prompt') {
          const context = buildBrandContext(guideline as any, { sections: resolvedSections });
          return jsonResponse({
            context,
            id: guideline.id,
            sections: resolvedSections || 'full',
            _meta: quota,
          });
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
    { title: 'Get Public Brand Guideline', readOnlyHint: true },
    async ({ slug }) => {
      try {
        const guideline = await prisma.brandGuideline.findFirst({
          where: { publicSlug: slug, isPublic: true },
        });
        if (!guideline)
          return jsonResponse({ error: 'Public brand guideline not found or not public' });

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
      identity: z
        .object({
          name: z.string().describe('Brand name (required).'),
          tagline: z.string().optional(),
          website: z.string().optional(),
          description: z.string().optional(),
        })
        .describe('Brand identity.'),
      colors: z
        .array(
          z.object({
            hex: z.string().describe('Hex color e.g. #FF5733'),
            name: z.string(),
            role: z
              .string()
              .optional()
              .describe('e.g. primary, secondary, background, text, accent'),
          })
        )
        .optional(),
      typography: z
        .array(
          z.object({
            family: z.string(),
            role: z.string().describe('e.g. heading, body, accent, mono'),
            style: z.string().optional().describe('e.g. Bold, Regular, SemiBold'),
            size: z.number().optional(),
          })
        )
        .optional(),
      guidelines: z
        .object({
          voice: z.string().optional().describe('Brand tone of voice description.'),
          dos: z.array(z.string()).optional(),
          donts: z.array(z.string()).optional(),
          imagery: z.string().optional(),
          accessibility: z.string().optional(),
          person: z.enum(['first', 'second', 'third']).optional(),
          emojiPolicy: z.enum(['none', 'informal', 'free']).optional(),
          casingRules: z.array(z.string()).optional(),
        })
        .optional(),
      strategy: z
        .object({
          manifesto: z.string().optional(),
          positioning: z.array(z.string()).optional(),
          archetypes: z
            .array(
              z.object({
                name: z.string(),
                role: z.enum(['primary', 'secondary']).optional(),
                description: z.string(),
                examples: z.array(z.string()).optional(),
              })
            )
            .optional(),
          personas: z
            .array(
              z.object({
                name: z.string(),
                age: z.number().optional(),
                occupation: z.string().optional(),
                traits: z.array(z.string()).optional(),
                bio: z.string().optional(),
                desires: z.array(z.string()).optional(),
                painPoints: z.array(z.string()).optional(),
              })
            )
            .optional(),
          voiceValues: z
            .array(
              z.object({
                title: z.string(),
                description: z.string(),
                example: z.string(),
              })
            )
            .optional(),
          coreMessage: z
            .object({
              product: z.string(),
              differential: z.string(),
              emotionalBond: z.string(),
            })
            .optional(),
          pillars: z.array(z.object({ value: z.string(), description: z.string() })).optional(),
          marketResearch: z
            .object({
              competitors: z.array(z.string()).optional(),
              gaps: z.array(z.string()).optional(),
              opportunities: z.array(z.string()).optional(),
              notes: z.string().optional(),
            })
            .optional(),
          graphicSystem: z
            .object({
              patterns: z.array(z.string()).optional(),
              grafisms: z.array(z.string()).optional(),
              imageRules: z.array(z.string()).optional(),
              editorialGrid: z.string().optional(),
            })
            .optional(),
        })
        .optional(),
      tokens: z
        .object({
          spacing: z.record(z.string(), z.number()).optional(),
          radius: z.record(z.string(), z.number()).optional(),
          shadows: z
            .record(
              z.string(),
              z.object({
                x: z.number(),
                y: z.number(),
                blur: z.number(),
                spread: z.number(),
                color: z.string(),
                opacity: z.number(),
              })
            )
            .optional(),
          components: z.record(z.string(), z.any()).optional(),
        })
        .optional(),
    },
    { title: 'Create Brand Guideline', destructiveHint: false },
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
            colors: (input.colors as any) ?? undefined,
            typography: (input.typography as any) ?? undefined,
            guidelines: (input.guidelines as any) ?? undefined,
            strategy: (input.strategy as any) ?? undefined,
            tokens: (input.tokens as any) ?? undefined,
            extraction: {
              sources: [{ type: 'manual', date: new Date().toISOString() }],
              completeness: 0,
            } as any,
          },
        });
        return jsonResponse({
          guideline: { id: guideline.id, identity: guideline.identity },
          _meta: quota,
        });
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
      identity: z
        .object({
          name: z.string().optional(),
          tagline: z.string().optional(),
          website: z.string().optional(),
          description: z.string().optional(),
        })
        .optional(),
      colors: z
        .array(
          z.object({
            hex: z.string(),
            name: z.string(),
            role: z
              .string()
              .optional()
              .describe('e.g. primary, secondary, background, text, accent, cta'),
          })
        )
        .optional()
        .describe('Replaces the full colors array.'),
      typography: z
        .array(
          z.object({
            family: z.string(),
            role: z.string(),
            style: z.string().optional(),
            size: z.number().optional(),
            lineHeight: z.number().optional(),
          })
        )
        .optional()
        .describe('Replaces the full typography array.'),
      guidelines: z
        .object({
          voice: z.string().optional(),
          dos: z.array(z.string()).optional(),
          donts: z.array(z.string()).optional(),
          imagery: z.string().optional(),
          accessibility: z.string().optional(),
          person: z
            .enum(['first', 'second', 'third'])
            .optional()
            .describe('Point of view for brand copy.'),
          emojiPolicy: z
            .enum(['none', 'informal', 'free'])
            .optional()
            .describe('When emojis are acceptable.'),
          casingRules: z
            .array(z.string())
            .optional()
            .describe('Capitalization rules, e.g. "Always capitalize product name"'),
        })
        .optional(),
      strategy: z
        .object({
          manifesto: z.string().optional(),
          positioning: z.array(z.string()).optional(),
          archetypes: z
            .array(
              z.object({
                name: z.string(),
                role: z.enum(['primary', 'secondary']).optional(),
                description: z.string(),
                examples: z.array(z.string()).optional(),
              })
            )
            .optional(),
          personas: z
            .array(
              z.object({
                name: z.string(),
                age: z.number().optional(),
                occupation: z.string().optional(),
                traits: z.array(z.string()).optional(),
                bio: z.string().optional(),
                desires: z.array(z.string()).optional(),
                painPoints: z.array(z.string()).optional(),
              })
            )
            .optional(),
          voiceValues: z
            .array(
              z.object({
                title: z.string(),
                description: z.string(),
                example: z.string(),
              })
            )
            .optional(),
          coreMessage: z
            .object({
              product: z.string(),
              differential: z.string(),
              emotionalBond: z.string(),
            })
            .optional()
            .describe(
              'Core brand message: what the product is, how it differs, emotional connection.'
            ),
          pillars: z
            .array(
              z.object({
                value: z.string(),
                description: z.string(),
              })
            )
            .optional()
            .describe('Brand pillars / core values.'),
          marketResearch: z
            .object({
              competitors: z.array(z.string()).optional(),
              gaps: z.array(z.string()).optional(),
              opportunities: z.array(z.string()).optional(),
              notes: z.string().optional(),
            })
            .optional()
            .describe('Competitive landscape and market opportunities.'),
          graphicSystem: z
            .object({
              patterns: z.array(z.string()).optional(),
              grafisms: z.array(z.string()).optional(),
              imageRules: z.array(z.string()).optional(),
              editorialGrid: z.string().optional(),
            })
            .optional()
            .describe(
              'Graphic system rules: patterns, grafisms, image guidelines, editorial grid.'
            ),
        })
        .optional(),
      tokens: z
        .object({
          spacing: z.record(z.string(), z.number()).optional(),
          radius: z.record(z.string(), z.number()).optional(),
          shadows: z
            .record(
              z.string(),
              z.object({
                x: z.number(),
                y: z.number(),
                blur: z.number(),
                spread: z.number(),
                color: z.string(),
                opacity: z.number(),
              })
            )
            .optional()
            .describe('Named shadow tokens, e.g. { "sm": { x:0, y:1, blur:2, ... } }'),
          components: z
            .record(z.string(), z.any())
            .optional()
            .describe('Component-level design tokens as key-value pairs.'),
        })
        .optional(),
      tags: z
        .record(z.string(), z.array(z.string()))
        .optional()
        .describe('Industry/keyword tags by category, e.g. { "style": ["premium", "minimal"] }'),
      gradients: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            type: z.enum(['linear', 'radial']),
            angle: z.number(),
            stops: z.array(z.object({ color: z.string(), position: z.number() })),
            usage: z.enum(['hero', 'decorative', 'fill', 'overlay']),
            css: z.string().optional(),
          })
        )
        .optional()
        .describe('Replaces the full gradients array.'),
      shadows: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            x: z.number(),
            y: z.number(),
            blur: z.number(),
            spread: z.number(),
            color: z.string(),
            opacity: z.number(),
            type: z.enum(['outer', 'inner', 'glow']),
            css: z.string().optional(),
          })
        )
        .optional()
        .describe('Replaces the full shadows array.'),
      motion: z
        .object({
          easing: z.string().optional(),
          durations: z
            .object({
              fast: z.number(),
              medium: z.number(),
              slow: z.number(),
            })
            .optional(),
          philosophy: z.enum(['minimal', 'moderate', 'expressive']).optional(),
          respectsReducedMotion: z.boolean().optional(),
        })
        .optional()
        .describe('Motion/animation design tokens. Shallow-merged with existing.'),
      borders: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            width: z.number(),
            style: z.enum(['solid', 'dashed', 'dotted']),
            color: z.string(),
            opacity: z.number(),
            role: z.enum(['default', 'emphasis', 'scaffold', 'divider']),
            css: z.string().optional(),
          })
        )
        .optional()
        .describe('Replaces the full borders array.'),
      colorThemes: z
        .array(
          z.object({
            id: z.string().optional(),
            name: z.string(),
            colors: z.array(
              z.object({
                hex: z.string(),
                name: z.string(),
                role: z.string().optional(),
              })
            ),
          })
        )
        .optional()
        .describe('Replaces the full color themes array.'),
      activeSections: z
        .array(z.string())
        .optional()
        .describe('Which guideline sections are visible/active in the UI.'),
      orderedBlocks: z
        .array(z.string())
        .optional()
        .describe('Custom ordering of guideline blocks in the UI.'),
      validation: z
        .record(z.string(), z.enum(['pending', 'approved', 'needs_work']))
        .optional()
        .describe(
          'Per-section validation state, e.g. { "colors": "approved", "typography": "needs_work" }'
        ),
      folder: z.string().optional().describe('Folder name for organizing guidelines.'),
    },
    { title: 'Update Brand Guideline', destructiveHint: false },
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

        // Shallow-merge fields (preserve existing sub-keys not in patch)
        for (const key of ['identity', 'guidelines', 'motion'] as const) {
          if (patch[key] !== undefined) {
            updateData[key] = { ...((existing as any)[key] || {}), ...patch[key] };
          }
        }

        // Deep merge: each sub-field replaced independently, others preserved
        if (patch.strategy !== undefined) {
          updateData.strategy = mergeStrategy(existing.strategy, patch.strategy);
        }

        // Nested merge for tokens (each token category independent)
        if (patch.tokens !== undefined) {
          const existingTokens = (existing.tokens as any) || {};
          const tokenPatch: Record<string, any> = {};
          for (const [k, v] of Object.entries(patch.tokens)) {
            if (v !== undefined) tokenPatch[k] = v;
          }
          updateData.tokens = { ...existingTokens, ...tokenPatch };
        }

        // Full-replacement fields (array or scalar, no merge needed)
        const replaceFields = [
          'colors',
          'typography',
          'tags',
          'gradients',
          'shadows',
          'borders',
          'colorThemes',
          'activeSections',
          'orderedBlocks',
          'validation',
          'folder',
        ] as const;
        for (const key of replaceFields) {
          if ((patch as any)[key] !== undefined) updateData[key] = (patch as any)[key];
        }

        if (!Object.keys(updateData).length) return ERR.validation('No fields provided to update');

        // Recalculate completeness
        const { calculateCompleteness } = await import('../types/brandGuideline.js');
        const fullData = { ...existing, ...updateData } as any;
        const completeness = calculateCompleteness(fullData);
        const extraction = (updateData.extraction || existing.extraction || { sources: [] }) as any;
        extraction.completeness = completeness;
        updateData.extraction = extraction;

        const updated = await prisma.brandGuideline.update({
          where: { id: existing.id },
          data: updateData,
        });

        // Invalidate cached brand context
        try {
          const { redisClient } = await import('../lib/redis.js');
          const { CacheInvalidation } = await import('../lib/cache-utils.js');
          const keysToInvalidate = CacheInvalidation.onBrandEdit(updated.id);
          for (const pattern of keysToInvalidate) {
            const matches = await redisClient.keys(pattern);
            if (matches.length > 0) await redisClient.del(...matches);
          }
        } catch {
          /* Redis down — graceful degradation */
        }

        // Dispatch webhook
        try {
          const { dispatchWebhookEvent } = await import('../utils/webhookDispatch.js');
          dispatchWebhookEvent(currentUserId, 'brand.updated', { id: updated.id });
        } catch {
          /* webhook dispatch is best-effort */
        }

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
    { title: 'Delete Brand Guideline', destructiveHint: true },
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
      source: z
        .enum(['url', 'text'])
        .describe('"url" to scrape a webpage; "text" to extract from raw text/markdown.'),
      url: z.string().optional().describe('URL to scrape (required when source=url).'),
      text: z
        .string()
        .optional()
        .describe('Raw text or markdown to extract from (required when source=text).'),
    },
    { title: 'Ingest Brand from URL', destructiveHint: false },
    async ({ id, source, url, text }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      if (source === 'url' && !url) return ERR.validation('url is required when source=url');
      if (source === 'text' && !text) return ERR.validation('text is required when source=text');
      try {
        const existing = await prisma.brandGuideline.findFirst({
          where: { id, userId: currentUserId },
        });
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
          return ERR.internal(
            (errBody as any).message || `Ingest failed with status ${resp.status}`
          );
        }

        const result = (await resp.json()) as any;
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
      disable: z
        .boolean()
        .optional()
        .describe('Pass true to revoke public access instead of enabling it.'),
    },
    { title: 'Share Brand Guideline', destructiveHint: false },
    async ({ id, disable }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const existing = await prisma.brandGuideline.findFirst({
          where: { id, userId: currentUserId },
        });
        if (!existing) return ERR.notFound('Brand guideline');

        const quota = await getQuotaMeta(currentUserId);

        if (disable) {
          await prisma.brandGuideline.update({
            where: { id: existing.id },
            data: { isPublic: false },
          });
          return jsonResponse({
            success: true,
            isPublic: false,
            message: 'Public access revoked.',
            _meta: quota,
          });
        }

        const { nanoid } = await import('nanoid');
        let publicSlug = existing.publicSlug;
        if (!publicSlug) {
          const baseName = ((existing.identity as any)?.name || 'brand')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .slice(0, 30);
          publicSlug = `${baseName}-${nanoid(8)}`;
        }

        await prisma.brandGuideline.update({
          where: { id: existing.id },
          data: { publicSlug, isPublic: true },
        });

        const baseUrl = process.env.VITE_SITE_URL || 'https://visantlabs.com';
        const shareUrl = `${baseUrl}/brand/${publicSlug}`;

        return jsonResponse({ success: true, isPublic: true, shareUrl, publicSlug, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'brand-guidelines-invite',
    'Create an invite link for a brand guideline. The recipient gets a connect page where they can accept the invite, associate the brand to their account, and get one-click deep links to connect their AI tool (Cursor, VS Code, Claude, ChatGPT). Perfect for onboarding clients.',
    {
      id: z.string().describe('Brand guideline ID.'),
      role: z
        .enum(['viewer', 'editor'])
        .default('viewer')
        .describe('Access level: viewer (read-only) or editor (can modify).'),
      label: z
        .string()
        .optional()
        .describe(
          'Display label for the invite (e.g. "YSA — Brand Kit"). Auto-generated if omitted.'
        ),
      expiresInDays: z
        .number()
        .int()
        .min(1)
        .max(365)
        .optional()
        .describe('Days until the invite expires. No expiration if omitted.'),
    },
    { title: 'Invite Collaborator', destructiveHint: false },
    async ({ id, role, label, expiresInDays }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const existing = await prisma.brandGuideline.findFirst({
          where: { id, userId: currentUserId },
        });
        if (!existing) return ERR.notFound('Brand guideline');

        const { nanoid } = await import('nanoid');
        const token = nanoid(16);
        const brandName = (existing.identity as any)?.name || 'Brand Kit';
        const expiresAt = expiresInDays
          ? new Date(Date.now() + expiresInDays * 86_400_000)
          : undefined;

        await prisma.brandInvite.create({
          data: {
            token,
            brandGuidelineId: existing.id,
            createdByUserId: currentUserId,
            role,
            label: label || `${brandName} — Connect`,
            expiresAt,
          },
        });

        const baseUrl = FRONTEND_BASE_URL;
        const connectUrl = `${baseUrl}/connect/${token}`;

        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({
          connectUrl,
          token,
          role,
          expiresAt: expiresAt?.toISOString() || null,
          instructions:
            'Send this URL to your client. They will create an account (or log in), accept the invite, and get one-click connection buttons for Cursor, VS Code, Claude, and ChatGPT.',
          _meta: quota,
        });
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
    { title: 'List Guideline Versions', readOnlyHint: true },
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

        const total = await prisma.brandGuidelineVersion.count({
          where: { guidelineId: existing.id },
        });

        return jsonResponse({
          currentVersion: (existing as any).currentVersion || 1,
          total,
          versions: versions.map((v) => ({
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
      url: z
        .string()
        .optional()
        .describe('Public URL of the logo image (alternative to base64 data).'),
      variant: z
        .enum(['primary', 'dark', 'light', 'icon', 'accent', 'custom'])
        .default('primary')
        .describe('Logo variant.'),
      label: z
        .string()
        .optional()
        .describe('Human-readable label, e.g. "Horizontal", "Dark mode".'),
    },
    { title: 'Upload Brand Logo', destructiveHint: false },
    async ({ id, data, url, variant, label }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      if (!data && !url) return ERR.validation('Either data (base64) or url is required.');
      try {
        const existing = await prisma.brandGuideline.findFirst({
          where: { id, userId: currentUserId },
        });
        if (!existing) return ERR.notFound('Brand guideline');
        const quota = await getQuotaMeta(currentUserId);
        const resp = await fetch(`${INTERNAL_API_BASE}/api/brand-guidelines/${id}/logos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ data, url, variant, label }),
        });
        const result = (await resp.json()) as any;
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
    { title: 'Delete Brand Logo', destructiveHint: true },
    async ({ id, logoId }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const existing = await prisma.brandGuideline.findFirst({
          where: { id, userId: currentUserId },
        });
        if (!existing) return ERR.notFound('Brand guideline');
        const quota = await getQuotaMeta(currentUserId);
        const resp = await fetch(
          `${INTERNAL_API_BASE}/api/brand-guidelines/${id}/logos/${logoId}`,
          {
            method: 'DELETE',
            headers: { 'x-mcp-user-id': currentUserId },
          }
        );
        if (!resp.ok) {
          const errBody = (await resp.json().catch(() => ({}))) as any;
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
      url: z
        .string()
        .optional()
        .describe('Public URL of the media asset (alternative to base64 data).'),
      type: z.enum(['image', 'pdf']).default('image').describe('Asset type.'),
      label: z
        .string()
        .optional()
        .describe('Label for this media asset, e.g. "Brand Presentation", "Campaign Photo".'),
    },
    { title: 'Upload Brand Media', destructiveHint: false },
    async ({ id, data, url, type, label }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      if (!data && !url) return ERR.validation('Either data (base64) or url is required.');
      try {
        const existing = await prisma.brandGuideline.findFirst({
          where: { id, userId: currentUserId },
        });
        if (!existing) return ERR.notFound('Brand guideline');
        const quota = await getQuotaMeta(currentUserId);
        const resp = await fetch(`${INTERNAL_API_BASE}/api/brand-guidelines/${id}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ data, url, type, label }),
        });
        const result = (await resp.json()) as any;
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
    { title: 'Delete Brand Media', destructiveHint: true },
    async ({ id, mediaId }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const existing = await prisma.brandGuideline.findFirst({
          where: { id, userId: currentUserId },
        });
        if (!existing) return ERR.notFound('Brand guideline');
        const quota = await getQuotaMeta(currentUserId);
        const resp = await fetch(
          `${INTERNAL_API_BASE}/api/brand-guidelines/${id}/media/${mediaId}`,
          {
            method: 'DELETE',
            headers: { 'x-mcp-user-id': currentUserId },
          }
        );
        if (!resp.ok) {
          const errBody = (await resp.json().catch(() => ({}))) as any;
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
    { title: 'Duplicate Brand Guideline', destructiveHint: false },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const existing = await prisma.brandGuideline.findFirst({
          where: { id, userId: currentUserId },
        });
        if (!existing) return ERR.notFound('Brand guideline');
        const quota = await getQuotaMeta(currentUserId);
        const resp = await fetch(`${INTERNAL_API_BASE}/api/brand-guidelines/${id}/duplicate`, {
          method: 'POST',
          headers: { 'x-mcp-user-id': currentUserId },
        });
        const result = (await resp.json()) as any;
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
      version: z
        .number()
        .int()
        .min(1)
        .describe('Version number to restore (from brand-guidelines-versions).'),
    },
    { title: 'Restore Guideline Version', destructiveHint: false },
    async ({ id, version }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const existing = await prisma.brandGuideline.findFirst({
          where: { id, userId: currentUserId },
        });
        if (!existing) return ERR.notFound('Brand guideline');
        const quota = await getQuotaMeta(currentUserId);
        const resp = await fetch(
          `${INTERNAL_API_BASE}/api/brand-guidelines/${id}/versions/${version}/restore`,
          {
            method: 'POST',
            headers: { 'x-mcp-user-id': currentUserId },
          }
        );
        const result = (await resp.json()) as any;
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
    { title: 'Brand Compliance Check', readOnlyHint: true },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const existing = await prisma.brandGuideline.findFirst({
          where: { id, userId: currentUserId },
        });
        if (!existing) return ERR.notFound('Brand guideline');
        const quota = await getQuotaMeta(currentUserId);
        const resp = await fetch(
          `${INTERNAL_API_BASE}/api/brand-guidelines/${id}/compliance-check`,
          {
            method: 'POST',
            headers: { 'x-mcp-user-id': currentUserId },
          }
        );
        const result = (await resp.json()) as any;
        if (!resp.ok)
          return ERR.internal(result?.error || `Compliance check failed (${resp.status})`);
        return jsonResponse({ ...result, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Community
  // ═══════════════════════════════════════════

  const validCategories = [
    '3d',
    'presets',
    'aesthetics',
    'themes',
    'mockup',
    'angle',
    'texture',
    'ambience',
    'luminance',
  ] as const;
  const validPresetTypes = ['mockup', 'angle', 'texture', 'ambience', 'luminance'] as const;

  server.tool(
    'community-presets',
    'Browse approved community presets. Filter by category or search by keyword. No auth required.',
    {
      limit: z.number().int().min(1).max(50).default(20).describe('Max presets to return (1-50).'),
      skip: z.number().int().min(0).default(0).describe('Number of items to skip for pagination.'),
      category: z.enum(validCategories).optional().describe('Filter by category.'),
      search: z.string().max(200).optional().describe('Search presets by name or tags.'),
    },
    { title: 'Browse Community Presets', readOnlyHint: true },
    async ({ limit, skip, category, search }) => {
      try {
        await connectToMongoDB();
        const db = getDb();
        const filter: any = { isApproved: true };
        if (category) filter.category = category;
        if (search) {
          const regex = { $regex: search, $options: 'i' };
          filter.$or = [{ name: regex }, { description: regex }, { tags: regex }];
        }
        const [presets, total] = await Promise.all([
          db
            .collection('community_presets')
            .find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray(),
          db.collection('community_presets').countDocuments(filter),
        ]);
        const presetIds = presets.map((p: any) => p.id);
        const likesData =
          presetIds.length > 0 ? await getCommunityLikesMap(db, presetIds) : new Map();
        const enriched = presets.map((p: any) => {
          const likes = likesData.get(p.id);
          return { ...p, _id: undefined, likesCount: likes?.likesCount ?? 0 };
        });
        return jsonResponse({
          presets: enriched,
          total,
          page: { limit, skip, hasMore: skip + limit < total },
        });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'community-preset-get',
    'Get a single community preset by ID. No auth required.',
    {
      id: z.string().min(1).describe('Preset ID.'),
    },
    { title: 'Get Community Preset', readOnlyHint: true },
    async ({ id }) => {
      try {
        await connectToMongoDB();
        const db = getDb();
        const preset = await db.collection('community_presets').findOne({ id });
        if (!preset) return ERR.notFound('Preset');
        const likesData = await getCommunityLikesMap(db, [id]);
        const likes = likesData.get(id);
        return jsonResponse({ ...preset, _id: undefined, likesCount: likes?.likesCount ?? 0 });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'community-preset-create',
    'Create a new community preset. Requires auth. The preset will be publicly visible once approved.',
    {
      name: z.string().min(1).max(500).describe('Preset name.'),
      description: z.string().min(1).max(5000).describe('What this preset does.'),
      prompt: z.string().min(1).max(50000).describe('The generation prompt.'),
      category: z.enum(validCategories).describe('Preset category.'),
      presetType: z
        .enum(validPresetTypes)
        .optional()
        .describe('Required when category is "presets".'),
      aspectRatio: z
        .string()
        .max(20)
        .default('1:1')
        .describe('Aspect ratio (e.g. 1:1, 16:9, 9:16, 4:5).'),
      model: z.string().max(100).optional().describe('AI model used (e.g. gemini-2.0-flash).'),
      tags: z.array(z.string().max(50)).max(20).optional().describe('Tags for discoverability.'),
      referenceImageUrl: z.string().url().max(2000).optional().describe('Reference image URL.'),
      difficulty: z
        .enum(['beginner', 'intermediate', 'advanced'])
        .optional()
        .describe('Difficulty level.'),
      context: z
        .enum(['canvas', 'mockup', 'branding', 'general'])
        .optional()
        .describe('Usage context.'),
      useCase: z.string().max(1000).optional().describe('Example use case description.'),
      examples: z
        .array(z.string().max(2000))
        .max(5)
        .optional()
        .describe('Example outputs or variations.'),
    },
    { title: 'Create Community Preset', destructiveHint: false },
    async ({
      name,
      description,
      prompt,
      category,
      presetType,
      aspectRatio,
      model,
      tags,
      referenceImageUrl,
      difficulty,
      context,
      useCase,
      examples,
    }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        if (category === 'presets' && !presetType) {
          return ERR.validation('presetType is required when category is "presets".');
        }
        await connectToMongoDB();
        const db = getDb();
        const { nanoid } = await import('nanoid');
        const id = `preset-${nanoid(12)}`;
        const now = new Date().toISOString();
        const preset: any = {
          id,
          userId: new ObjectId(currentUserId),
          category,
          name,
          description,
          prompt,
          aspectRatio,
          isApproved: true,
          createdAt: now,
          updatedAt: now,
        };
        if (presetType) preset.presetType = presetType;
        if (model) preset.model = model;
        if (tags && tags.length > 0) preset.tags = tags.map((t) => t.trim()).filter(Boolean);
        if (referenceImageUrl) preset.referenceImageUrl = referenceImageUrl;
        if (difficulty) preset.difficulty = difficulty;
        if (context) preset.context = context;
        if (useCase) preset.useCase = useCase;
        if (examples && examples.length > 0)
          preset.examples = examples.map((e) => e.trim()).filter(Boolean);

        await db.collection('community_presets').insertOne(preset);
        return jsonResponse({ created: true, preset: { ...preset, _id: undefined } });
      } catch (err: any) {
        if (err.code === 11000) return ERR.validation('A preset with this ID already exists.');
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'community-preset-update',
    'Update your own community preset. Only provided fields are changed. Requires auth.',
    {
      id: z.string().min(1).describe('Preset ID to update.'),
      name: z.string().min(1).max(500).optional().describe('New name.'),
      description: z.string().min(1).max(5000).optional().describe('New description.'),
      prompt: z.string().min(1).max(50000).optional().describe('New prompt.'),
      category: z.enum(validCategories).optional().describe('New category.'),
      presetType: z.enum(validPresetTypes).optional().describe('New preset type.'),
      aspectRatio: z.string().max(20).optional().describe('New aspect ratio.'),
      model: z.string().max(100).optional().describe('New model.'),
      tags: z.array(z.string().max(50)).max(20).optional().describe('New tags.'),
      referenceImageUrl: z.string().url().max(2000).optional().describe('New reference image URL.'),
      difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
      context: z.enum(['canvas', 'mockup', 'branding', 'general']).optional(),
      useCase: z.string().max(1000).optional(),
      examples: z.array(z.string().max(2000)).max(5).optional(),
    },
    { title: 'Update Community Preset', destructiveHint: false },
    async ({ id, ...fields }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        await connectToMongoDB();
        const db = getDb();
        const preset = await db.collection('community_presets').findOne({ id });
        if (!preset) return ERR.notFound('Preset');
        if (preset.userId.toString() !== currentUserId) {
          return mcpError('FORBIDDEN', 'You can only edit your own presets.');
        }
        const update: any = { updatedAt: new Date().toISOString() };
        if (fields.name !== undefined) update.name = fields.name;
        if (fields.description !== undefined) update.description = fields.description;
        if (fields.prompt !== undefined) update.prompt = fields.prompt;
        if (fields.category !== undefined) update.category = fields.category;
        if (fields.presetType !== undefined) update.presetType = fields.presetType;
        if (fields.aspectRatio !== undefined) update.aspectRatio = fields.aspectRatio;
        if (fields.model !== undefined) update.model = fields.model;
        if (fields.tags !== undefined)
          update.tags = fields.tags.map((t) => t.trim()).filter(Boolean);
        if (fields.referenceImageUrl !== undefined)
          update.referenceImageUrl = fields.referenceImageUrl;
        if (fields.difficulty !== undefined) update.difficulty = fields.difficulty;
        if (fields.context !== undefined) update.context = fields.context;
        if (fields.useCase !== undefined) update.useCase = fields.useCase;
        if (fields.examples !== undefined)
          update.examples = fields.examples.map((e) => e.trim()).filter(Boolean);

        await db.collection('community_presets').updateOne({ id }, { $set: update });
        const updated = await db.collection('community_presets').findOne({ id });
        return jsonResponse({ updated: true, preset: { ...updated, _id: undefined } });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'community-preset-delete',
    'Delete your own community preset permanently. Requires auth.',
    {
      id: z.string().min(1).describe('Preset ID to delete.'),
    },
    { title: 'Delete Community Preset', destructiveHint: true },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        await connectToMongoDB();
        const db = getDb();
        const preset = await db.collection('community_presets').findOne({ id });
        if (!preset) return ERR.notFound('Preset');
        if (preset.userId.toString() !== currentUserId) {
          return mcpError('FORBIDDEN', 'You can only delete your own presets.');
        }
        await Promise.all([
          db.collection('community_presets').deleteOne({ id }),
          db.collection('community_preset_likes').deleteMany({ presetId: id }),
        ]);
        return jsonResponse({ deleted: true, id });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'community-preset-like',
    'Toggle like/unlike on a community preset. Returns updated like count. Requires auth.',
    {
      id: z.string().min(1).describe('Preset ID to like/unlike.'),
    },
    { title: 'Like Community Preset', destructiveHint: false },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        await connectToMongoDB();
        const db = getDb();
        const preset = await db.collection('community_presets').findOne({ id });
        if (!preset) return ERR.notFound('Preset');
        const userId = new ObjectId(currentUserId);
        const existing = await db
          .collection('community_preset_likes')
          .findOne({ presetId: id, userId });
        if (existing) {
          await db.collection('community_preset_likes').deleteOne({ presetId: id, userId });
        } else {
          await db
            .collection('community_preset_likes')
            .insertOne({ presetId: id, userId, createdAt: new Date().toISOString() });
        }
        const likesCount = await db
          .collection('community_preset_likes')
          .countDocuments({ presetId: id });
        return jsonResponse({ liked: !existing, likesCount });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'community-my-presets',
    'List your own community presets (approved and pending). Requires auth.',
    {
      limit: z.number().int().min(1).max(50).default(20).describe('Max presets to return.'),
      skip: z.number().int().min(0).default(0).describe('Items to skip for pagination.'),
    },
    { title: 'My Community Presets', readOnlyHint: true },
    async ({ limit, skip }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        await connectToMongoDB();
        const db = getDb();
        const filter = { userId: new ObjectId(currentUserId) };
        const [presets, total] = await Promise.all([
          db
            .collection('community_presets')
            .find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray(),
          db.collection('community_presets').countDocuments(filter),
        ]);
        const presetIds = presets.map((p: any) => p.id);
        const likesData =
          presetIds.length > 0
            ? await getCommunityLikesMap(db, presetIds, currentUserId)
            : new Map();
        const enriched = presets.map((p: any) => {
          const likes = likesData.get(p.id);
          return {
            ...p,
            _id: undefined,
            likesCount: likes?.likesCount ?? 0,
            isLikedByUser: likes?.isLikedByUser ?? false,
          };
        });
        return jsonResponse({
          presets: enriched,
          total,
          page: { limit, skip, hasMore: skip + limit < total },
        });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Reference Library — Curated mockup references
  // ═══════════════════════════════════════════

  server.tool(
    'reference-search',
    'Search curated mockup reference library by dimensions (niche, aesthetic, vibe, lighting, texture, material, angle, color_mood, mockup_type) or free text. Returns world-class mockup references with AI-extracted dimensions.',
    {
      search: z.string().optional().describe('Free text search across name and description.'),
      niche: z.string().optional().describe('Filter by niche (e.g. "luxury", "tech", "food").'),
      aesthetic: z
        .string()
        .optional()
        .describe('Filter by aesthetic (e.g. "minimalist", "brutalist").'),
      vibe: z.string().optional().describe('Filter by vibe (e.g. "premium", "playful").'),
      lighting: z
        .string()
        .optional()
        .describe('Filter by lighting (e.g. "soft studio", "golden hour").'),
      texture: z.string().optional().describe('Filter by texture (e.g. "marble", "concrete").'),
      mockup_type: z
        .string()
        .optional()
        .describe('Filter by mockup type (e.g. "packaging", "stationery").'),
      limit: z.number().int().min(1).max(50).default(20).describe('Max results.'),
    },
    { title: 'Search References', readOnlyHint: true },
    async ({ search, niche, aesthetic, vibe, lighting, texture, mockup_type, limit }) => {
      try {
        await connectToMongoDB();
        const db = getDb();
        const filter: any = { category: 'reference', isAdminCurated: true };
        if (search)
          filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
          ];
        if (niche) filter['dimensions.niche'] = { $in: [niche] };
        if (aesthetic) filter['dimensions.aesthetic'] = { $in: [aesthetic] };
        if (vibe) filter['dimensions.vibe'] = { $in: [vibe] };
        if (lighting) filter['dimensions.lighting'] = { $in: [lighting] };
        if (texture) filter['dimensions.texture'] = { $in: [texture] };
        if (mockup_type) filter['dimensions.mockup_type'] = { $in: [mockup_type] };

        const refs = await db
          .collection('community_presets')
          .find(filter)
          .sort({ createdAt: -1 })
          .limit(limit)
          .project({
            _id: 0,
            id: 1,
            name: 1,
            studio: 1,
            description: 1,
            referenceImageUrl: 1,
            dimensions: 1,
            tags: 1,
            prompt: 1,
          })
          .toArray();
        return jsonResponse({ references: refs, total: refs.length });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'reference-ingest',
    'Ingest a curated mockup reference image into the library. AI auto-extracts dimensions (niche, aesthetic, vibe, lighting, texture, material, angle). Admin only.',
    {
      imageUrl: z.string().url().describe('Public URL of the reference image.'),
      name: z.string().optional().describe('Name for the reference.'),
      studio: z
        .string()
        .optional()
        .describe('Studio or creator name (e.g. "Hazard Mockups", "Visant Labs").'),
      tags: z.array(z.string()).optional().describe('Manual tags to add.'),
      prompt: z.string().optional().describe('The prompt that generated this mockup (if known).'),
    },
    { title: 'Ingest Reference Material', destructiveHint: false },
    async ({ imageUrl, name, studio, tags, prompt }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const { ingestReference } = await import('../lib/mockup/referenceIngestor.js');

        // Fetch image and convert to base64
        const imgResp = await fetch(imageUrl);
        if (!imgResp.ok) return ERR.validation(`Failed to fetch image: ${imgResp.status}`);
        const buffer = Buffer.from(await imgResp.arrayBuffer());
        const imageBase64 = buffer.toString('base64');

        const result = await ingestReference({
          imageBase64,
          imageUrl,
          name,
          studio,
          userId: currentUserId,
          tags,
          prompt,
        });
        return jsonResponse(result);
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
    { title: 'Browse Community Profiles', readOnlyHint: true },
    async ({ limit, skip }) => {
      try {
        const users = await prisma.user.findMany({
          where: { username: { not: null } },
          take: limit,
          skip,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            username: true,
            picture: true,
            bio: true,
            createdAt: true,
          },
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
    { title: 'List Creative Projects', readOnlyHint: true },
    async ({ limit, skip }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(
          `${INTERNAL_API_BASE}/api/creative-projects?limit=${limit}&skip=${skip}`,
          { headers: { 'x-mcp-user-id': currentUserId } }
        );
        const result = await response.json();
        if (!response.ok)
          return jsonResponse({ error: result.error || 'Failed to list creative projects' });
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
    { title: 'Get Creative Project', readOnlyHint: true },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/creative-projects/${id}`, {
          headers: { 'x-mcp-user-id': currentUserId },
        });
        const result = await response.json();
        if (!response.ok)
          return jsonResponse({ error: result.error || 'Creative project not found' });
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
      prompt: z
        .string()
        .min(1)
        .describe(
          'Creative brief (e.g. "Summer sale banner for a surf brand, bold and energetic").'
        ),
      brandGuidelineId: z
        .string()
        .optional()
        .describe('Brand guideline ID to inject colors, fonts, and voice into the creative.'),
      format: z
        .enum(['1:1', '16:9', '9:16', '4:5'])
        .default('1:1')
        .describe('Output aspect ratio.'),
    },
    { title: 'Generate Creative', destructiveHint: false },
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
        if (!response.ok) {
          const detail = [result.error, result.message, result.hint].filter(Boolean).join(' — ');
          return ERR.internal(detail || `Creative generation failed (${response.status})`);
        }
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
    'Render a creative plan (from creative-generate) into a PNG image server-side. Pass the plan JSON and the pre-generated background image URL. Returns imageUrl (public R2 URL). Use this to close the generate→image loop without a browser: generate plan, render, inspect image with vision, adjust, re-render.',
    {
      plan: z
        .object({
          background: z
            .object({ prompt: z.string().optional(), url: z.string().optional() })
            .optional(),
          overlay: z
            .object({
              type: z.enum(['gradient', 'solid']),
              direction: z.enum(['bottom', 'top', 'left', 'right']).optional(),
              opacity: z.number(),
              color: z.string().optional(),
            })
            .nullable()
            .optional(),
          layers: z
            .array(z.record(z.string(), z.any()))
            .describe('Layer array from creative-generate.'),
        })
        .describe('Creative plan from creative-generate.'),
      backgroundImageUrl: z
        .string()
        .optional()
        .describe('Pre-generated background image URL (from mockup-generate or any image URL).'),
      format: z.enum(['1:1', '16:9', '9:16', '4:5']).default('1:1').describe('Output format.'),
      accentColor: z
        .string()
        .optional()
        .describe('Hex color for <accent> words in text layers. Defaults to white.'),
    },
    { title: 'Render Creative to Image', destructiveHint: false },
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
        const result = (await response.json()) as any;
        if (!response.ok) {
          const detail = [result.error, result.message, result.hint].filter(Boolean).join(' — ');
          return ERR.internal(detail || `Render failed (${response.status})`);
        }

        // If render returned only base64, upload to R2 for a public URL
        if (!result.imageUrl && result.imageBase64) {
          try {
            const uploadRes = await fetch(`${INTERNAL_API_BASE}/api/images/upload`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
              body: JSON.stringify({
                data: result.imageBase64,
                contentType: 'image/png',
                label: 'creative-render',
              }),
            });
            const uploadData = (await uploadRes.json()) as any;
            if (uploadRes.ok && uploadData.url) {
              result.imageUrl = uploadData.url;
            }
          } catch (uploadErr: any) {
            console.error('[creative-render] fallback upload failed:', uploadErr?.message);
          }
        }

        const quota = await getQuotaMeta(currentUserId);
        // Omit base64 from MCP response to avoid truncation
        const { imageBase64: _omit, ...cleanResult } = result;
        return jsonResponse({ ...cleanResult, _meta: quota });
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
      brandGuidelineId: z
        .string()
        .optional()
        .describe('Brand guideline ID to inject brand context.'),
      format: z
        .enum(['1:1', '16:9', '9:16', '4:5'])
        .default('1:1')
        .describe('Output aspect ratio.'),
      model: z
        .enum(IMAGE_MODEL_IDS)
        .default(DEFAULT_IMAGE_MODEL_ID)
        .describe('Model for background image generation.'),
      resolution: z
        .enum(['1K', '2K', '4K'])
        .default('1K')
        .describe('Resolution for background image generation.'),
      autoSave: z.boolean().default(true).describe('Persist result as a creative project.'),
    },
    { title: 'Generate Full Creative Set', destructiveHint: false },
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
        const planData = (await planRes.json()) as any;
        if (!planRes.ok)
          return ERR.internal(planData.error || `Creative plan failed (${planRes.status})`);
        const plan = planData.plan ?? planData;
        credits.plan = planData.creditsUsed ?? null;

        // Step 2: Generate background image
        const bgPrompt = plan?.background?.prompt || prompt;
        const mockupRes = await fetch(`${INTERNAL_API_BASE}/api/mockups/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({
            promptText: bgPrompt,
            brandGuidelineId,
            model,
            resolution,
            aspectRatio: format,
            designType: 'background',
            feature: 'agent',
          }),
        });
        const mockupData = (await mockupRes.json()) as any;
        const backgroundImageUrl: string | undefined =
          mockupData.imageUrl ?? mockupData.mockup?.imageUrl;
        credits.background = mockupData.creditsUsed ?? null;

        // Step 3: Render creative to PNG
        const renderRes = await fetch(`${INTERNAL_API_BASE}/api/creative/render`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ plan, backgroundImageUrl, format }),
        });
        const renderData = (await renderRes.json()) as any;
        if (!renderRes.ok) {
          // Partial success — return what we have so the agent can retry render
          return jsonResponse({
            error: renderData.error || `Render failed (${renderRes.status})`,
            step: 'render',
            plan,
            backgroundImageUrl,
            creditsUsed: credits,
          });
        }
        let imageUrl: string = renderData.imageUrl;
        credits.render = renderData.creditsUsed ?? null;

        // If render returned only base64 (R2 upload failed there), upload it now
        if (!imageUrl && renderData.imageBase64) {
          try {
            const uploadRes = await fetch(`${INTERNAL_API_BASE}/api/images/upload`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
              body: JSON.stringify({
                data: renderData.imageBase64,
                contentType: 'image/png',
                label: 'creative-render',
              }),
            });
            const uploadData = (await uploadRes.json()) as any;
            if (uploadRes.ok && uploadData.url) {
              imageUrl = uploadData.url;
            } else {
              console.error('[creative-full] fallback upload response:', uploadData);
            }
          } catch (uploadErr: any) {
            console.error('[creative-full] fallback upload failed:', uploadErr?.message);
          }
        }

        if (!imageUrl) {
          const uploadReason = renderData.uploadError || 'unknown';
          return jsonResponse({
            error: `Render succeeded but image upload failed: ${uploadReason}`,
            step: 'upload',
            plan,
            backgroundImageUrl,
            creditsUsed: credits,
          });
        }

        // Step 4: Optionally save project
        let projectId: string | undefined;
        if (autoSave) {
          const saveRes = await fetch(`${INTERNAL_API_BASE}/api/creative-projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
            body: JSON.stringify({
              prompt,
              format,
              brandId: brandGuidelineId || null,
              backgroundUrl: backgroundImageUrl || null,
              layers: plan.layers ?? [],
              overlay: plan.overlay ?? null,
              thumbnailUrl: imageUrl?.startsWith('http') ? imageUrl : null,
              name: `Creative — ${prompt.slice(0, 50)}`,
            }),
          });
          const saveData = (await saveRes.json()) as any;
          projectId = saveData.project?.id;
        }

        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({
          imageUrl,
          backgroundImageUrl,
          plan,
          projectId,
          creditsUsed: credits,
          _meta: quota,
        });
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
      layers: z
        .array(z.record(z.string(), z.any()))
        .describe('Layer array from creative-generate.'),
      name: z
        .string()
        .optional()
        .describe('Project display name. Defaults to "Untitled Creative".'),
      brandId: z.string().nullable().optional().describe('Brand guideline ID to associate.'),
      backgroundUrl: z.string().nullable().optional().describe('Background image URL.'),
      overlay: z
        .record(z.string(), z.any())
        .nullable()
        .optional()
        .describe('Overlay config from creative plan.'),
      thumbnailUrl: z.string().nullable().optional().describe('Thumbnail image URL.'),
    },
    { title: 'Create Creative Project', destructiveHint: false },
    async ({ prompt, format, layers, name, brandId, backgroundUrl, overlay, thumbnailUrl }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/creative-projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({
            prompt,
            format,
            layers,
            name,
            brandId,
            backgroundUrl,
            overlay,
            thumbnailUrl,
          }),
        });
        const result = await response.json();
        if (!response.ok)
          return jsonResponse({ error: result.error || 'Failed to create creative project' });
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
      overlay: z
        .record(z.string(), z.any())
        .nullable()
        .optional()
        .describe('Updated overlay config.'),
      thumbnailUrl: z.string().nullable().optional().describe('Updated thumbnail URL.'),
    },
    { title: 'Update Creative Project', destructiveHint: false },
    async ({ id, name, prompt, format, layers, brandId, backgroundUrl, overlay, thumbnailUrl }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/creative-projects/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({
            name,
            prompt,
            format,
            layers,
            brandId,
            backgroundUrl,
            overlay,
            thumbnailUrl,
          }),
        });
        const result = await response.json();
        if (!response.ok)
          return jsonResponse({ error: result.error || 'Failed to update creative project' });
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ ...result, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'creative-projects-delete',
    'Permanently delete a creative project by ID. Cannot be undone — confirm with the user first.',
    {
      id: z.string().describe('Creative project ID to delete.'),
    },
    { title: 'Delete Creative Project', destructiveHint: true },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/creative-projects/${id}`, {
          method: 'DELETE',
          headers: { 'x-mcp-user-id': currentUserId },
        });
        const result = await response.json();
        if (!response.ok)
          return jsonResponse({ error: result.error || 'Failed to delete creative project' });
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
    "Update a mockup's metadata (prompt, tags, isLiked, designType, aspectRatio). Does not regenerate the image.",
    {
      id: z.string().describe('Mockup MongoDB ObjectId.'),
      prompt: z.string().optional().describe('Updated prompt text.'),
      designType: z.string().optional().describe('Design type (e.g. "social", "banner").'),
      aspectRatio: z.string().optional().describe('Aspect ratio (e.g. "16:9").'),
      tags: z.array(z.string()).optional().describe('Tag list.'),
      brandingTags: z.array(z.string()).optional().describe('Branding tag list.'),
      isLiked: z.boolean().optional().describe('Mark/unmark as liked.'),
    },
    { title: 'Update Mockup', destructiveHint: false },
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
    'Permanently delete a mockup by ID. Cannot be undone — confirm with the user first.',
    {
      id: z.string().describe('Mockup MongoDB ObjectId to delete.'),
    },
    { title: 'Delete Mockup', destructiveHint: true },
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
      prompt: z
        .string()
        .min(1)
        .describe('Brand brief or description used to generate the project.'),
      data: z
        .record(z.string(), z.any())
        .describe('Branding project data (colors, typography, logos, etc.).'),
      projectId: z
        .string()
        .optional()
        .describe('Existing project ID to update. Omit to create a new project.'),
      name: z.string().optional().describe('Project display name.'),
    },
    { title: 'Save Brand Identity', destructiveHint: false },
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
        if (!response.ok)
          return jsonResponse({ error: result.error || 'Failed to save branding project' });
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ ...result, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'branding-delete',
    'Permanently delete a branding project by ID. Cannot be undone — confirm with the user first.',
    {
      id: z.string().describe('Branding project ID to delete.'),
    },
    { title: 'Delete Brand Identity', destructiveHint: true },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/branding/${id}`, {
          method: 'DELETE',
          headers: { 'x-mcp-user-id': currentUserId },
        });
        const result = await response.json();
        if (!response.ok)
          return jsonResponse({ error: result.error || 'Failed to delete branding project' });
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
      drawings: z
        .array(z.record(z.string(), z.any()))
        .optional()
        .describe('Updated drawings array.'),
      linkedGuidelineId: z.string().nullable().optional().describe('Brand guideline ID to link.'),
    },
    { title: 'Update Canvas', destructiveHint: false },
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
        if (!response.ok)
          return jsonResponse({ error: result.error || 'Failed to update canvas project' });
        const quota = await getQuotaMeta(currentUserId);
        return jsonResponse({ ...result, _meta: quota });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'canvas-delete',
    'Permanently delete a canvas project by ID. Cannot be undone — confirm with the user first.',
    {
      id: z.string().describe('Canvas project ID to delete.'),
    },
    { title: 'Delete Canvas', destructiveHint: true },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/canvas/${id}`, {
          method: 'DELETE',
          headers: { 'x-mcp-user-id': currentUserId },
        });
        const result = await response.json();
        if (!response.ok)
          return jsonResponse({ error: result.error || 'Failed to delete canvas project' });
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
    { title: 'Share Canvas', destructiveHint: false },
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
        if (!response.ok)
          return jsonResponse({ error: result.error || 'Failed to share canvas project' });
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
      data: z
        .record(z.string(), z.any())
        .optional()
        .describe('Full budget data object (replaces existing data field).'),
    },
    { title: 'Update Budget', destructiveHint: false },
    async ({
      id,
      name,
      clientName,
      projectDescription,
      startDate,
      endDate,
      deliverables,
      observations,
      data,
    }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const response = await fetch(`${INTERNAL_API_BASE}/api/budget/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({
            name,
            clientName,
            projectDescription,
            startDate,
            endDate,
            deliverables,
            observations,
            data,
          }),
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
    'Permanently delete a budget project by ID. Cannot be undone — confirm with the user first.',
    {
      id: z.string().describe('Budget project ID to delete.'),
    },
    { title: 'Delete Budget', destructiveHint: true },
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
    { title: 'Duplicate Budget', destructiveHint: false },
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
        if (!response.ok)
          return jsonResponse({ error: result.error || 'Failed to duplicate budget' });
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
      variables: z
        .record(z.string(), z.string())
        .describe('Map of variable name to value, e.g. {"brand":"Nike","color":"red"}.'),
    },
    { title: 'Resolve Canvas Variables', readOnlyHint: true },
    async ({ prompt, variables }) => {
      const resolved = prompt.replace(/\{\{(\w+)\}\}/g, (match: string, key: string) =>
        Object.prototype.hasOwnProperty.call(variables, key)
          ? (variables as Record<string, string>)[key]
          : match
      );
      const placeholders = Array.from(prompt.matchAll(/\{\{(\w+)\}\}/g)).map(
        (m: RegExpMatchArray) => m[1] as string
      );
      const unresolved = placeholders.filter(
        (p: string) => !Object.prototype.hasOwnProperty.call(variables, p)
      );
      return jsonResponse({ resolved, unresolved, variables_used: Object.keys(variables).length });
    }
  );

  server.tool(
    'canvas-parse-csv',
    'Parse a CSV string and return the rows as an array of objects. Use this to preview what a DataNode will produce from a CSV file before uploading it to the canvas.',
    {
      csv: z.string().describe('Raw CSV text with a header row.'),
      preview_rows: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(5)
        .describe('Number of rows to return in the preview (1-50).'),
    },
    { title: 'Parse CSV for Canvas', readOnlyHint: true },
    async ({ csv, preview_rows }) => {
      try {
        // Inline minimal CSV parse (no external deps in MCP context)
        const lines = csv.trim().split('\n').filter(Boolean);
        if (lines.length < 2)
          return jsonResponse({ error: 'CSV must have a header row and at least one data row.' });
        const headers = lines[0].split(',').map((h: string) => h.trim());
        const rows = lines.slice(1, preview_rows + 1).map((line: string) => {
          const vals = line.split(',').map((v: string) => v.trim());
          return Object.fromEntries(headers.map((h: string, i: number) => [h, vals[i] ?? '']));
        });
        return jsonResponse({
          columns: headers,
          total_rows: lines.length - 1,
          preview: rows,
          note:
            rows.length < lines.length - 1
              ? `Showing ${rows.length} of ${lines.length - 1} rows`
              : undefined,
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
    { title: 'List Canvas Projects', readOnlyHint: true },
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
          return {
            id: p.id,
            name: p.name,
            node_count: nodes.length,
            node_types: typeCounts,
            updated_at: p.updatedAt,
          };
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
      pdf_base64: z
        .string()
        .optional()
        .describe(
          'Base64-encoded PDF content. Preferred when calling from a remote agent — read the file locally and encode it. ' +
            'Mutually exclusive with pdf_path.'
        ),
      pdf_filename: z
        .string()
        .optional()
        .describe(
          'Original filename (e.g. "brand.pdf"). Required when using pdf_base64 with output="disk" so the .md file can be named correctly.'
        ),
      pdf_path: z
        .string()
        .optional()
        .describe(
          'Absolute server-side path to a PDF. Only use when the file is on the same machine as the MCP server.'
        ),
      output: z
        .enum(['disk', 'inline'])
        .describe(
          '"disk" — saves a .md file alongside the PDF (pdf_path) or in the current directory (pdf_base64) and returns { saved_to, characters, preview }. ' +
            '"inline" — returns the full markdownText in the response (no file written).'
        ),
      include_brand_tokens: z
        .boolean()
        .default(true)
        .describe(
          'Include colors, typography, strategy, and asset classifications. Default: true.'
        ),
    },
    { title: 'Extract Document Content', readOnlyHint: true },
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
          case 'text':
            result.markdownText = event.data;
            break;
          case 'colors':
            result.colors = event.data;
            break;
          case 'typography':
            result.typography = event.data;
            break;
          case 'images':
            result.imageCount = (event.data as any[]).length;
            break;
          case 'strategy':
            result.strategy = event.data;
            break;
          case 'asset_classifications':
            result.assetClassifications = event.data;
            break;
          case 'error':
            result._error = event.message;
            break;
        }
      };

      try {
        await extractPdfStreaming(buffer, writeEvent, currentUserId);
      } catch (err: any) {
        return ERR.internal(err.message);
      }

      const md: string = result.markdownText ?? '';
      const tokens = include_brand_tokens
        ? {
            colors: result.colors,
            typography: result.typography,
            strategy: result.strategy,
            assetClassifications: result.assetClassifications,
            imageCount: result.imageCount,
          }
        : {};

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
        return jsonResponse({
          saved_to: outPath,
          characters: md.length,
          preview: md.slice(0, 600),
          ...tokens,
        });
      }

      return jsonResponse({ markdownText: md, ...tokens });
    }
  );

  // ─── PDF Tools (Ghostscript) ────────────────────────────────────────────────

  server.tool(
    'pdf-compress',
    'Compress a PDF using Ghostscript. Reduces file size by recompressing images. ' +
      'Presets: screen (72dpi, smallest), ebook (150dpi, balanced), printer (300dpi), prepress (300dpi, color-preserving). ' +
      'Returns compressed PDF as base64 with size comparison.',
    {
      pdf_base64: z.string().describe('Base64-encoded PDF content'),
      preset: z
        .enum(['screen', 'ebook', 'printer', 'prepress'])
        .default('ebook')
        .describe('Compression preset'),
    },
    { title: 'Compress PDF', readOnlyHint: true },
    async ({ pdf_base64, preset }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const { compressPdf } = await import('../services/ghostscriptService.js');
        const inputBuf = Buffer.from(pdf_base64, 'base64');
        const result = await compressPdf(inputBuf, preset);
        return jsonResponse({
          pdf: result.toString('base64'),
          originalSize: inputBuf.length,
          compressedSize: result.length,
          savings: Math.round((1 - result.length / inputBuf.length) * 100),
        });
      } catch (err: any) {
        return ERR.internal(err);
      }
    }
  );

  server.tool(
    'pdf-to-images',
    'Rasterize PDF pages to images (PNG or JPEG) using Ghostscript. ' +
      'Returns an array of base64-encoded images, one per page. Useful for thumbnails, previews, or further processing.',
    {
      pdf_base64: z.string().describe('Base64-encoded PDF content'),
      dpi: z.number().min(72).max(600).default(150).describe('Resolution in DPI'),
      format: z.enum(['png', 'jpeg']).default('png').describe('Output image format'),
      pages: z.string().optional().describe('Page range, e.g. "1-3" or "1". Omit for all pages.'),
    },
    { title: 'Convert PDF to Images', readOnlyHint: true },
    async ({ pdf_base64, dpi, format, pages }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const { rasterizePages } = await import('../services/ghostscriptService.js');
        const images = await rasterizePages(pdf_base64, { dpi, format, pages });
        return jsonResponse({
          images: images.map((buf, i) => ({
            page: i + 1,
            data: `data:image/${format};base64,${buf.toString('base64')}`,
            size: buf.length,
          })),
          pageCount: images.length,
        });
      } catch (err: any) {
        return ERR.internal(err);
      }
    }
  );

  server.tool(
    'images-to-pdf',
    'Create a multi-page PDF from images. Each image becomes one page sized to fit the image dimensions. ' +
      'Accepts PNG and JPEG base64-encoded images.',
    {
      images: z.array(z.string()).min(1).describe('Array of base64-encoded images (PNG or JPEG)'),
    },
    { title: 'Convert Images to PDF', readOnlyHint: true },
    async ({ images }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const { imagesToPdf } = await import('../services/ghostscriptService.js');
        const buffers = images.map((img) => {
          const cleaned = stripDataUriPrefix(img);
          return Buffer.from(cleaned, 'base64');
        });
        const result = await imagesToPdf(buffers);
        return jsonResponse({
          pdf: result.toString('base64'),
          size: result.length,
          pageCount: images.length,
        });
      } catch (err: any) {
        return ERR.internal(err);
      }
    }
  );

  // ═══════════════════════════════════════════
  // NEW TOOLS — AI, Brand, Payments, Settings
  // ═══════════════════════════════════════════

  // ─── AI: Suggest prompt variations ──────────────────────────────────────────
  server.tool(
    'ai-suggest-prompt-variations',
    'Generate multiple creative variations of a prompt. Free (cached). Use to give users options before spending credits on generation.',
    {
      prompt: z.string().min(1).describe('Original prompt to create variations of.'),
    },
    { title: 'Suggest Prompt Variations', readOnlyHint: true },
    async ({ prompt }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const res = await fetch(`${INTERNAL_API_BASE}/api/ai/suggest-prompt-variations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ prompt }),
        });
        if (!res.ok) return ERR.internal(await res.text());
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ─── AI: Extract colors from image ─────────────────────────────────────────
  server.tool(
    'ai-extract-colors',
    'Extract a color palette from any image. Returns hex values, names, roles, and frequency. Free (no credits).',
    {
      imageUrl: z.string().optional().describe('Public image URL.'),
      base64: z.string().optional().describe('Base64-encoded image data.'),
      mimeType: z.string().optional().describe('MIME type if using base64 (e.g. image/png).'),
    },
    { title: 'Extract Colors from Image', readOnlyHint: true },
    async ({ imageUrl, base64, mimeType }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      if (!imageUrl && !base64) return ERR.validation('Provide imageUrl or base64.');
      try {
        const image: any = imageUrl ? { url: imageUrl } : { base64, mimeType };
        const res = await fetch(`${INTERNAL_API_BASE}/api/ai/extract-colors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ image }),
        });
        if (!res.ok) return ERR.internal(await res.text());
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ─── AI: Generate naming ideas ─────────────────────────────────────────────
  server.tool(
    'ai-generate-naming',
    'Generate brand/product name ideas from a brief. Optionally uses brand guideline for tone consistency. Costs credits.',
    {
      brief: z
        .string()
        .min(1)
        .describe(
          'Description of what needs naming (e.g. "eco-friendly water bottle brand targeting millennials").'
        ),
      count: z.number().int().min(1).max(20).default(10).describe('Number of name suggestions.'),
      style: z
        .string()
        .optional()
        .describe('Naming style: minimal, playful, corporate, abstract, etc.'),
      brandGuidelineId: z
        .string()
        .optional()
        .describe('Brand guideline ID for tone/voice consistency.'),
    },
    { title: 'Generate Brand Names', destructiveHint: false },
    async ({ brief, count, style, brandGuidelineId }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const res = await fetch(`${INTERNAL_API_BASE}/api/ai/generate-naming`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ brief, count, style, brandGuidelineId }),
        });
        if (!res.ok) return ERR.internal(await res.text());
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ─── AI: Change object in mockup ───────────────────────────────────────────
  server.tool(
    'ai-change-object',
    'Replace or modify an object in an existing mockup image. Costs credits. Pass the image and describe what to change.',
    {
      imageUrl: z.string().optional().describe('Public URL of the image to modify.'),
      base64: z.string().optional().describe('Base64 of the image to modify.'),
      mimeType: z.string().optional().describe('MIME type if using base64.'),
      newObject: z
        .string()
        .describe(
          'Description of what to replace/change (e.g. "replace the coffee cup with a wine glass").'
        ),
      model: z.string().optional().describe('AI model override.'),
      resolution: z.string().optional().describe('Output resolution: hd, 1k, 2k, 4k.'),
    },
    { title: 'Edit Image Object', destructiveHint: false },
    async ({ imageUrl, base64, mimeType, newObject, model, resolution }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      if (!imageUrl && !base64) return ERR.validation('Provide imageUrl or base64.');
      try {
        const baseImage: any = imageUrl ? { url: imageUrl } : { base64, mimeType };
        const res = await fetch(`${INTERNAL_API_BASE}/api/ai/change-object`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ baseImage, newObject, model, resolution }),
        });
        if (!res.ok) return ERR.internal(await res.text());
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ─── AI: Apply theme to mockup ─────────────────────────────────────────────
  server.tool(
    'ai-apply-theme',
    'Apply visual themes to an existing mockup (e.g. "christmas", "cyberpunk", "minimalist"). Costs credits.',
    {
      imageUrl: z.string().optional().describe('Public URL of the image.'),
      base64: z.string().optional().describe('Base64 of the image.'),
      mimeType: z.string().optional().describe('MIME type if using base64.'),
      themes: z
        .array(z.string())
        .min(1)
        .describe('Theme keywords to apply (e.g. ["christmas", "warm lighting"]).'),
      model: z.string().optional().describe('AI model override.'),
      resolution: z.string().optional().describe('Output resolution: hd, 1k, 2k, 4k.'),
    },
    { title: 'Apply Visual Theme', destructiveHint: false },
    async ({ imageUrl, base64, mimeType, themes, model, resolution }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      if (!imageUrl && !base64) return ERR.validation('Provide imageUrl or base64.');
      try {
        const baseImage: any = imageUrl ? { url: imageUrl } : { base64, mimeType };
        const res = await fetch(`${INTERNAL_API_BASE}/api/ai/apply-theme`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ baseImage, themes, model, resolution }),
        });
        if (!res.ok) return ERR.internal(await res.text());
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ─── Brand: Export guideline ───────────────────────────────────────────────
  server.tool(
    'brand-guidelines-export',
    'Export a brand guideline as a complete JSON document for backup, migration, or sharing.',
    {
      id: z.string().describe('Brand guideline ID.'),
    },
    { title: 'Export Brand Guideline', readOnlyHint: true },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const guideline = await prisma.brandGuideline.findFirst({
          where: { id, userId: currentUserId },
        });
        if (!guideline) return ERR.notFound('Brand guideline');
        return jsonResponse(guideline);
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ─── Brand: Compile design tokens ──────────────────────────────────────────
  server.tool(
    'brand-guidelines-compile',
    'Compile a brand guideline into design tokens (CSS custom properties, Tailwind config values, JSON tokens). Use for design-to-code workflows.',
    {
      id: z.string().describe('Brand guideline ID.'),
    },
    { title: 'Compile Brand Context', readOnlyHint: true },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const res = await fetch(
          `${INTERNAL_API_BASE}/api/brand-guidelines/${id}/compile?format=all`,
          { headers: { 'x-mcp-user-id': currentUserId } }
        );
        if (!res.ok) return ERR.internal(await res.text());
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ─── Brand: Health check ───────────────────────────────────────────────────
  server.tool(
    'brand-guidelines-health-check',
    'Audit a brand guideline for completeness. Returns which sections are filled, which are missing, and suggestions for improvement.',
    {
      id: z.string().describe('Brand guideline ID.'),
    },
    { title: 'Brand Health Check', readOnlyHint: true },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const res = await fetch(`${INTERNAL_API_BASE}/api/brand-guidelines/${id}/health-check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
        });
        if (!res.ok) return ERR.internal(await res.text());
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ─── Brand: Compare versions ───────────────────────────────────────────────
  server.tool(
    'brand-guidelines-compare-versions',
    'Compare two versions of a brand guideline to see what changed (colors added, typography modified, strategy updated, etc.).',
    {
      id: z.string().describe('Brand guideline ID.'),
      v1: z.number().int().describe('First version number.'),
      v2: z.number().int().describe('Second version number.'),
    },
    { title: 'Compare Guideline Versions', readOnlyHint: true },
    async ({ id, v1, v2 }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const res = await fetch(
          `${INTERNAL_API_BASE}/api/brand-guidelines/${id}/versions/${v1}/compare/${v2}`,
          {
            headers: { 'x-mcp-user-id': currentUserId },
          }
        );
        if (!res.ok) return ERR.internal(await res.text());
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ─── Brand: Figma sync ─────────────────────────────────────────────────────
  server.tool(
    'brand-guidelines-figma-sync',
    'Sync brand guideline with a Figma file. Imports colors, typography, and design tokens from Figma variables and styles. Requires Figma token configured in user settings.',
    {
      id: z.string().describe('Brand guideline ID.'),
      fileId: z.string().describe('Figma file ID (from URL: figma.com/design/:fileId/...).'),
      includeVariables: z
        .boolean()
        .default(true)
        .describe('Import Figma variables as design tokens.'),
      includeComponents: z
        .boolean()
        .default(false)
        .describe('Import component names and structure.'),
    },
    { title: 'Sync from Figma', destructiveHint: false },
    async ({ id, fileId, includeVariables, includeComponents }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const res = await fetch(`${INTERNAL_API_BASE}/api/brand-guidelines/${id}/figma-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ fileId, includeVariables, includeComponents }),
        });
        if (!res.ok) return ERR.internal(await res.text());
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ─── Brand: Figma link ─────────────────────────────────────────────────────
  server.tool(
    'brand-guidelines-figma-link',
    'Link or unlink a Figma file to a brand guideline. Once linked, figma-sync can pull design tokens automatically.',
    {
      id: z.string().describe('Brand guideline ID.'),
      fileId: z.string().optional().describe('Figma file ID to link. Omit to unlink.'),
      fileName: z.string().optional().describe('Figma file name for display.'),
    },
    { title: 'Link Figma File', destructiveHint: false },
    async ({ id, fileId, fileName }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        if (fileId) {
          const res = await fetch(`${INTERNAL_API_BASE}/api/brand-guidelines/${id}/figma-link`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
            body: JSON.stringify({ fileId, fileName }),
          });
          if (!res.ok) return ERR.internal(await res.text());
          return jsonResponse(await res.json());
        } else {
          const res = await fetch(`${INTERNAL_API_BASE}/api/brand-guidelines/${id}/figma-link`, {
            method: 'DELETE',
            headers: { 'x-mcp-user-id': currentUserId },
          });
          if (!res.ok) return ERR.internal(await res.text());
          return jsonResponse({ success: true, message: 'Figma file unlinked.' });
        }
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ─── Brand: Knowledge base ─────────────────────────────────────────────────
  server.tool(
    'brand-guidelines-knowledge-list',
    'List all knowledge documents (PDFs, brand docs) attached to a brand guideline.',
    {
      id: z.string().describe('Brand guideline ID.'),
    },
    { title: 'List Brand Knowledge', readOnlyHint: true },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const res = await fetch(`${INTERNAL_API_BASE}/api/brand-guidelines/${id}/knowledge`, {
          headers: { 'x-mcp-user-id': currentUserId },
        });
        if (!res.ok) return ERR.internal(await res.text());
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ─── Payments: Subscription status ─────────────────────────────────────────
  server.tool(
    'payments-subscription-status',
    'Get the current user subscription tier, credit balance, usage, and whether they can generate. Use this to check before suggesting paid operations.',
    {},
    { title: 'Get Subscription Status', readOnlyHint: true },
    async () => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const res = await fetch(`${INTERNAL_API_BASE}/api/payments/subscription-status`, {
          headers: { 'x-mcp-user-id': currentUserId },
        });
        if (!res.ok) return ERR.internal(await res.text());
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ─── Payments: Usage details ───────────────────────────────────────────────
  server.tool(
    'payments-usage',
    'Get detailed credit usage: free generations used, subscription credits remaining, reset date. More granular than account-usage.',
    {},
    { title: 'Get Payment Usage', readOnlyHint: true },
    async () => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const res = await fetch(`${INTERNAL_API_BASE}/api/payments/usage`, {
          headers: { 'x-mcp-user-id': currentUserId },
        });
        if (!res.ok) return ERR.internal(await res.text());
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ─── Payments: Available plans ─────────────────────────────────────────────
  server.tool(
    'payments-plans',
    'List available subscription plans with pricing. No auth required.',
    {
      currency: z.enum(['USD', 'BRL']).default('USD').describe('Currency for prices.'),
    },
    { title: 'List Plans', readOnlyHint: true },
    async ({ currency }) => {
      try {
        const res = await fetch(`${INTERNAL_API_BASE}/api/payments/plans?currency=${currency}`);
        if (!res.ok) return ERR.internal(await res.text());
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ─── Settings: BYOK status ─────────────────────────────────────────────────
  server.tool(
    'settings-byok-status',
    'Check which API keys the user has configured (Gemini, OpenAI, Seedream) and storage tier. Use to know which models are available.',
    {},
    { title: 'Check BYOK Status', readOnlyHint: true },
    async () => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const res = await fetch(`${INTERNAL_API_BASE}/api/users/settings/byok-status`, {
          headers: { 'x-mcp-user-id': currentUserId },
        });
        if (!res.ok) return ERR.internal(await res.text());
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ─── Campaign: Batch generation ────────────────────────────────────────────
  server.tool(
    'campaign-generate',
    'Start a batch ad campaign generation. Returns a jobId for polling. Creates multiple mockup variations across formats (square, story, banner, portrait). Costs credits per image.',
    {
      productImageUrl: z.string().describe('Public URL of the product/design image.'),
      brandGuidelineId: z
        .string()
        .optional()
        .describe('Brand guideline ID for brand-consistent ad copy and styling.'),
      brief: z
        .string()
        .optional()
        .describe(
          'Campaign brief: target audience, goal, tone (e.g. "launch campaign for Gen Z, playful tone").'
        ),
      count: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(10)
        .describe('Number of ad variations to generate.'),
      formats: z
        .array(z.enum(['square', 'story', 'banner', 'portrait']))
        .default(['square'])
        .describe('Output formats to generate.'),
      model: z.string().optional().describe('AI model override (e.g. gpt-image-1).'),
    },
    { title: 'Generate Campaign', destructiveHint: false },
    async ({ productImageUrl, brandGuidelineId, brief, count, formats, model }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const res = await fetch(`${INTERNAL_API_BASE}/api/canvas/generate-campaign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ productImageUrl, brandGuidelineId, brief, count, formats, model }),
        });
        if (!res.ok) return ERR.internal(await res.text());
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ─── Campaign: Poll status ─────────────────────────────────────────────────
  server.tool(
    'campaign-status',
    'Poll a batch campaign job for progress. Returns status (planning/generating/done/error) and completed results with image URLs.',
    {
      jobId: z.string().describe('Job ID returned by campaign-generate.'),
    },
    { title: 'Check Campaign Status', readOnlyHint: true },
    async ({ jobId }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const res = await fetch(`${INTERNAL_API_BASE}/api/canvas/generate-campaign/${jobId}`, {
          headers: { 'x-mcp-user-id': currentUserId },
        });
        if (!res.ok) return ERR.internal(await res.text());
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ─── Smart Analyze ─────────────────────────────────────────────────────────
  server.tool(
    'smart-analyze',
    'AI-powered image analysis. Detects design type (logo, UI, photo, illustration), suggests mockup category and prompt, and returns a ready-to-use prompt for mockup-generate. Free (no credits).',
    {
      base64: z.string().describe('Base64-encoded image to analyze.'),
      mimeType: z.string().default('image/png').describe('Image MIME type.'),
      brandGuideline: z
        .string()
        .optional()
        .describe('Brand guideline ID for brand-aware analysis.'),
    },
    { title: 'Analyze Image', readOnlyHint: true },
    async ({ base64, mimeType, brandGuideline }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const res = await fetch(`${INTERNAL_API_BASE}/api/plugin/smart-analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({
            image: { base64, mimeType },
            mode: 'image-gen',
            brandGuideline,
          }),
        });
        if (!res.ok) return ERR.internal(await res.text());
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // 3D Studio — Scene orchestration via LLM
  // ═══════════════════════════════════════════

  server.tool(
    'studio3d-list-presets',
    'List all built-in 3D Studio scene presets (Product Shot, Hero Banner, Neon, etc.) with their full configurations. Free.',
    {},
    { title: 'List 3D Presets', readOnlyHint: true },
    async () => {
      // Import presets inline to avoid circular deps — these are static constants
      const presets: Record<string, any> = {
        'Product Shot': {
          material: 'plastic',
          color: '#ffffff',
          depth: 3,
          roughness: 0.3,
          metalness: 0.1,
          animate: 'spin',
          background: '#0a0a0a',
          lightIntensity: 1.2,
          ambientIntensity: 0.5,
          environment: 'studio',
        },
        'Hero Banner': {
          material: 'chrome',
          color: '#00e5ff',
          depth: 4,
          roughness: 0.1,
          metalness: 0.9,
          animate: 'float',
          background: '#050510',
          lightIntensity: 1.5,
          ambientIntensity: 0.3,
          environment: 'city',
        },
        'Social Media': {
          material: 'gold',
          color: '#ffd700',
          depth: 2.5,
          roughness: 0.2,
          metalness: 0.8,
          animate: 'spinFloat',
          background: '#0d0d0d',
          lightIntensity: 1.3,
          ambientIntensity: 0.4,
          environment: 'sunset',
        },
        'Dark Studio': {
          material: 'glass',
          color: '#8b5cf6',
          depth: 3,
          roughness: 0.05,
          metalness: 0.1,
          animate: 'wobble',
          background: '#000000',
          lightIntensity: 0.8,
          ambientIntensity: 0.2,
          environment: 'night',
        },
        Neon: {
          material: 'emissive',
          color: '#ff00ff',
          depth: 2,
          roughness: 0.1,
          metalness: 0.3,
          animate: 'pulse',
          background: '#050005',
          lightIntensity: 0.6,
          ambientIntensity: 0.15,
          environment: 'night',
        },
        'Clay Render': {
          material: 'clay',
          color: '#e8ddd3',
          depth: 3.5,
          roughness: 0.9,
          metalness: 0,
          animate: 'spin',
          background: '#f5f0eb',
          lightIntensity: 1.4,
          ambientIntensity: 0.6,
          environment: 'studio',
        },
      };

      const materials = [
        'default',
        'plastic',
        'clay',
        'emissive',
        'chrome',
        'brushedSteel',
        'gold',
        'roseGold',
        'copper',
        'marble',
        'wood',
        'leather',
        'carbonFiber',
        'carPaint',
        'glass',
        'frostedGlass',
        'diamond',
        'pearl',
        'obsidian',
        'holographic',
      ];
      const animations = [
        'none',
        'spin',
        'float',
        'pulse',
        'wobble',
        'swing',
        'spinFloat',
        'physicsFall',
      ];
      const environments = [
        'studio',
        'city',
        'sunset',
        'dawn',
        'night',
        'forest',
        'apartment',
        'warehouse',
        'park',
        'lobby',
      ];

      return jsonResponse({ presets, materials, animations, environments });
    }
  );

  server.tool(
    'studio3d-create-scene',
    'Create and save a 3D Studio scene configuration. Returns a deep-link URL that opens the scene directly in the app. The config controls material, color, lighting, animation, camera, and more. Costs 0 credits.',
    {
      name: z.string().min(1).max(200).describe('Scene name.'),
      description: z.string().max(1000).optional().describe('Scene description.'),
      config: z
        .object({
          material: z
            .enum([
              'default',
              'plastic',
              'metal',
              'glass',
              'rubber',
              'chrome',
              'gold',
              'clay',
              'emissive',
              'holographic',
              'brushedSteel',
              'aluminum',
              'copper',
              'roseGold',
              'platinum',
              'ceramic',
              'marble',
              'concrete',
              'wood',
              'velvet',
              'leather',
              'frostedGlass',
              'diamond',
              'pearl',
              'carbonFiber',
              'carPaint',
              'ice',
              'obsidian',
              'wax',
              'mattePaint',
            ])
            .optional()
            .describe('Material preset.'),
          color: z
            .string()
            .regex(/^#[0-9A-Fa-f]{3,8}$/)
            .optional()
            .describe('Object color (hex).'),
          depth: z.number().min(0.1).max(20).optional().describe('Extrusion depth.'),
          roughness: z.number().min(0).max(1).optional().describe('Surface roughness.'),
          metalness: z.number().min(0).max(1).optional().describe('Metalness.'),
          opacity: z.number().min(0).max(1).optional().describe('Opacity.'),
          animate: z
            .enum(['none', 'spin', 'float', 'pulse', 'wobble', 'spinFloat', 'swing', 'physicsFall'])
            .optional()
            .describe('Animation type.'),
          animateSpeed: z.number().min(0.01).max(5).optional().describe('Animation speed.'),
          animateEasing: z
            .enum(['linear', 'easeIn', 'easeOut', 'easeInOut'])
            .optional()
            .describe('Animation easing.'),
          background: z
            .string()
            .regex(/^#[0-9A-Fa-f]{3,8}$/)
            .optional()
            .describe('Background color (hex).'),
          bgType: z.enum(['solid', 'linear', 'radial']).optional().describe('Background type.'),
          environment: z
            .enum([
              'studio',
              'city',
              'sunset',
              'dawn',
              'night',
              'forest',
              'apartment',
              'warehouse',
              'park',
              'lobby',
            ])
            .optional()
            .describe('HDRI environment.'),
          lightIntensity: z.number().min(0).max(10).optional().describe('Key light intensity.'),
          ambientIntensity: z
            .number()
            .min(0)
            .max(5)
            .optional()
            .describe('Ambient light intensity.'),
          shadow: z.boolean().optional().describe('Enable shadows.'),
          showGrid: z.boolean().optional().describe('Show floor grid.'),
          shapeType: z
            .enum(['standard', 'coin', 'badge', 'stamp', 'shield', 'hexagon'])
            .optional()
            .describe('Geometry shape.'),
          showChain: z.boolean().optional().describe('Enable chain + bail on any shape.'),
          smoothness: z.number().min(0).max(1).optional().describe('Curve smoothness.'),
          bevelEnabled: z.boolean().optional().describe('Enable edge bevel.'),
          bevelThickness: z.number().min(0).max(5).optional().describe('Bevel thickness.'),
          bevelSize: z.number().min(0).max(5).optional().describe('Bevel size.'),
          wireframe: z.boolean().optional().describe('Wireframe mode.'),
          physicsCount: z
            .number()
            .int()
            .min(1)
            .max(200)
            .optional()
            .describe('Physics sim instance count.'),
          physicsGravity: z.number().min(0).max(50).optional().describe('Gravity strength.'),
          physicsBounciness: z.number().min(0).max(1).optional().describe('Bounce factor.'),
        })
        .describe('Scene configuration object — all fields optional, unset fields use defaults.'),
      svgData: z.string().optional().describe('SVG markup to extrude into 3D.'),
      inputMode: z.enum(['svg', 'text']).optional().describe('Input mode.'),
      text: z.string().optional().describe('Text to render in 3D (when inputMode="text").'),
      font: z.string().optional().describe('Font family for text mode.'),
      tags: z.array(z.string()).max(20).optional().describe('Scene tags.'),
      isPublic: z.boolean().optional().describe('Make scene publicly accessible.'),
    },
    { title: 'Create 3D Scene', destructiveHint: false },
    async ({ name, description, config, svgData, inputMode, text, font, tags, isPublic }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const res = await fetch(`${INTERNAL_API_BASE}/api/studio3d`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({
            name,
            description,
            config,
            svgData,
            inputMode,
            text,
            font,
            tags,
            isPublic,
          }),
        });

        if (!res.ok) return ERR.internal(await res.text());
        const data = await res.json();
        const sceneId = data.scene?._id || data.scene?.id;

        const frontendBase =
          FRONTEND_BASE_URL;
        const deepLink = `${frontendBase}/3d-studio?sceneId=${sceneId}`;

        return jsonResponse({
          ...data,
          deepLink,
          message: `Scene "${name}" saved. Open in app: ${deepLink}`,
        });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'studio3d-list-scenes',
    'List saved 3D Studio scenes for the current user. Free.',
    {
      limit: z.number().int().min(1).max(200).optional().describe('Max results (default 60).'),
    },
    { title: 'List 3D Scenes', readOnlyHint: true },
    async ({ limit }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const res = await fetch(`${INTERNAL_API_BASE}/api/studio3d?limit=${limit || 60}`, {
          headers: { 'x-mcp-user-id': currentUserId },
        });
        if (!res.ok) return ERR.internal(await res.text());
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'studio3d-get-scene',
    'Get a saved 3D Studio scene by ID. Returns full config that can be applied. Free.',
    {
      sceneId: z.string().describe('Scene ID to retrieve.'),
    },
    { title: 'Get 3D Scene', readOnlyHint: true },
    async ({ sceneId }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const res = await fetch(`${INTERNAL_API_BASE}/api/studio3d/${sceneId}`, {
          headers: { 'x-mcp-user-id': currentUserId },
        });
        if (!res.ok) return ERR.internal(await res.text());
        const data = await res.json();

        const frontendBase =
          FRONTEND_BASE_URL;
        const deepLink = `${frontendBase}/3d-studio?sceneId=${sceneId}`;

        return jsonResponse({ ...data, deepLink });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'update-studio3d-scene',
    'Update an existing 3D Studio scene. Partial updates supported — only pass fields to change.',
    {
      sceneId: z.string().describe('Scene ID to update.'),
      name: z.string().max(200).optional().describe('New scene name.'),
      description: z.string().max(1000).optional().describe('New description.'),
      config: z
        .record(z.string(), z.unknown())
        .optional()
        .describe('Partial config to merge (same schema as studio3d-create-scene).'),
      tags: z.array(z.string()).max(20).optional().describe('New tags.'),
      isPublic: z.boolean().optional().describe('Update public visibility.'),
    },
    { title: 'Update 3D Scene', destructiveHint: false },
    async ({ sceneId, ...updates }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const res = await fetch(`${INTERNAL_API_BASE}/api/studio3d/${sceneId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify(updates),
        });
        if (!res.ok) return ERR.internal(await res.text());
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'delete-studio3d-scene',
    'Delete a saved 3D Studio scene.',
    {
      sceneId: z.string().describe('Scene ID to delete.'),
    },
    { title: 'Delete 3D Scene', destructiveHint: true },
    async ({ sceneId }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const res = await fetch(`${INTERNAL_API_BASE}/api/studio3d/${sceneId}`, {
          method: 'DELETE',
          headers: { 'x-mcp-user-id': currentUserId },
        });
        if (!res.ok) return ERR.internal(await res.text());
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Playground — MiniApps
  // ═══════════════════════════════════════════

  server.tool(
    'playground-generate',
    'Generate a mini-app from a natural-language prompt. Returns a JSON spec that renders inside the Playground. Costs 1 credit.',
    {
      prompt: z
        .string()
        .min(3)
        .describe(
          'What the mini-app should do (e.g. "brand color palette extractor with drag-drop upload").'
        ),
      brandGuidelineId: z
        .string()
        .optional()
        .describe('Optional brand guideline ID to inject colors/fonts/logos into the generation.'),
    },
    { title: 'Generate Mini-App', destructiveHint: false },
    async ({ prompt, brandGuidelineId }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const body: Record<string, string> = { prompt };
        if (brandGuidelineId) {
          const ctxRes = await fetch(
            `${INTERNAL_API_BASE}/api/playground/brand-context/${brandGuidelineId}`,
            {
              headers: { 'x-mcp-user-id': currentUserId },
            }
          );
          if (ctxRes.ok) {
            const { context } = await ctxRes.json();
            body.brandContext = context;
          }
        }
        const res = await fetch(`${INTERNAL_API_BASE}/api/playground/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-mcp-user-id': currentUserId,
            Accept: 'text/event-stream',
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) return ERR.internal(await res.text());

        const text = await res.text();
        const specData = extractSseEventData(text, 'spec');
        if (!specData) return ERR.internal('Generation failed — no spec event received');
        const parsed = JSON.parse(specData);
        return jsonResponse({ spec: parsed.spec, meta: parsed.meta });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'playground-iterate',
    'Refine an existing mini-app spec with a follow-up instruction. Returns updated spec. Costs 1 credit.',
    {
      prompt: z
        .string()
        .min(3)
        .describe('What to change (e.g. "add a pie chart showing color distribution").'),
      currentSpec: z
        .record(z.string(), z.unknown())
        .describe('The current spec JSON to iterate on.'),
    },
    { title: 'Iterate Mini-App', destructiveHint: false },
    async ({ prompt, currentSpec }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const res = await fetch(`${INTERNAL_API_BASE}/api/playground/iterate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-mcp-user-id': currentUserId,
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({ prompt, currentSpec }),
        });
        if (!res.ok) return ERR.internal(await res.text());

        const text = await res.text();
        const specData = extractSseEventData(text, 'spec');
        if (!specData) return ERR.internal('Iteration failed — no spec event received');
        const parsed = JSON.parse(specData);
        return jsonResponse({ spec: parsed.spec, meta: parsed.meta });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'playground-save',
    "Save a mini-app spec to the user's library. Returns the saved mini-app with slug.",
    {
      title: z.string().min(1).describe('Mini-app title.'),
      description: z.string().optional().describe('Short description.'),
      tags: z.array(z.string()).optional().describe('Tags for discovery.'),
      category: z
        .enum(['utility', 'brand', 'design', 'marketing', 'data', 'fun'])
        .optional()
        .describe('Category (default: utility).'),
      spec: z.record(z.string(), z.unknown()).describe('The mini-app spec JSON (root + elements).'),
      actionsUsed: z.array(z.string()).optional().describe('List of action names used.'),
    },
    { title: 'Save Mini-App', destructiveHint: false },
    async ({ title, description, tags, category, spec, actionsUsed }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const res = await fetch(`${INTERNAL_API_BASE}/api/playground`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ title, description, tags, category, spec, actionsUsed }),
        });
        if (!res.ok) return ERR.internal(await res.text());
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'playground-list',
    "List the authenticated user's saved mini-apps.",
    {},
    { title: 'List Mini-Apps', readOnlyHint: true },
    async () => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const res = await fetch(`${INTERNAL_API_BASE}/api/playground/my`, {
          headers: { 'x-mcp-user-id': currentUserId },
        });
        if (!res.ok) return ERR.internal(await res.text());
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'playground-get',
    'Get a mini-app by its slug (public).',
    {
      slug: z.string().describe('The mini-app slug (from URL or list).'),
    },
    { title: 'Get Mini-App', readOnlyHint: true },
    async ({ slug }) => {
      try {
        const res = await fetch(`${INTERNAL_API_BASE}/api/playground/${slug}`);
        if (!res.ok) return ERR.notFound('MiniApp');
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'playground-publish',
    'Publish a mini-app to the community gallery.',
    {
      id: z.string().describe('Mini-app ID to publish.'),
    },
    { title: 'Publish Mini-App', destructiveHint: false },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const res = await fetch(`${INTERNAL_API_BASE}/api/playground/${id}/publish`, {
          method: 'POST',
          headers: { 'x-mcp-user-id': currentUserId },
        });
        if (!res.ok) return ERR.internal(await res.text());
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'playground-feed',
    'Browse the community mini-app gallery with filters.',
    {
      category: z.string().optional().describe('Filter by category.'),
      search: z.string().optional().describe('Search by title.'),
      sort: z
        .enum(['newest', 'likes', 'popular'])
        .optional()
        .describe('Sort order (default: newest).'),
      take: z.number().max(50).optional().describe('Results per page (default: 20, max: 50).'),
      skip: z.number().optional().describe('Pagination offset.'),
    },
    { title: 'Browse Mini-App Feed', readOnlyHint: true },
    async ({ category, search, sort, take, skip }) => {
      try {
        const params = new URLSearchParams();
        if (category) params.set('category', category);
        if (search) params.set('search', search);
        if (sort) params.set('sort', sort);
        if (take) params.set('take', String(take));
        if (skip) params.set('skip', String(skip));
        const res = await fetch(`${INTERNAL_API_BASE}/api/playground/feed?${params}`);
        if (!res.ok) return ERR.internal(await res.text());
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'playground-fork',
    'Fork a community mini-app into your library.',
    {
      id: z.string().describe('Mini-app ID to fork.'),
    },
    { title: 'Fork Mini-App', destructiveHint: false },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const res = await fetch(`${INTERNAL_API_BASE}/api/playground/${id}/fork`, {
          method: 'POST',
          headers: { 'x-mcp-user-id': currentUserId },
        });
        if (!res.ok) return ERR.internal(await res.text());
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'playground-share',
    'Generate a public share URL for a mini-app you own.',
    {
      id: z.string().describe('Mini-app ID to share.'),
    },
    { title: 'Share Mini-App', destructiveHint: false },
    async ({ id }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const res = await fetch(`${INTERNAL_API_BASE}/api/playground/${id}/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
        });
        if (!res.ok) return ERR.internal(await res.text());
        const data = await res.json();
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
        return jsonResponse({ ...data, fullUrl: `${baseUrl}${data.shareUrl}` });
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'playground-quickstart',
    'One-shot: generate a mini-app from prompt → save → share. Returns spec + URLs. Costs 1 credit.',
    {
      prompt: z.string().min(3).describe('What the mini-app should do.'),
      title: z.string().optional().describe('App title (auto-derived from prompt if omitted).'),
      description: z.string().optional().describe('Short description.'),
      tags: z.array(z.string()).optional().describe('Tags for discovery.'),
      category: z.enum(['utility', 'brand', 'design', 'marketing', 'data', 'fun']).optional(),
      brandGuidelineId: z
        .string()
        .optional()
        .describe('Brand guideline ID for brand-aware generation.'),
    },
    { title: 'Quickstart Mini-App', destructiveHint: false },
    async ({ prompt, title, description, tags, category, brandGuidelineId }) => {
      const currentUserId = getMcpUserId();
      if (!currentUserId) return ERR.auth();
      try {
        const res = await fetch(`${INTERNAL_API_BASE}/api/playground/quickstart`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': currentUserId },
          body: JSON.stringify({ prompt, title, description, tags, category, brandGuidelineId }),
        });
        if (!res.ok) return ERR.internal(await res.text());
        return jsonResponse(await res.json());
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  server.tool(
    'playground-describe',
    'Describe a mini-app spec as structured text so the agent can "see" the layout without a browser. Returns a visual tree + component summary.',
    {
      spec: z.record(z.string(), z.unknown()).describe('The mini-app spec JSON (root + elements).'),
    },
    { title: 'Describe Mini-App', readOnlyHint: true },
    async ({ spec }) => {
      try {
        const elements = (spec.elements || {}) as Record<string, any>;
        const root = spec.root as string;

        const componentCounts: Record<string, number> = {};
        const actionsList: string[] = [];
        let totalElements = 0;

        function describeTree(id: string, depth: number): string {
          const el = elements[id];
          if (!el) return '';
          totalElements++;

          const type = el.type || 'Unknown';
          componentCounts[type] = (componentCounts[type] || 0) + 1;

          const props = el.props || {};
          const indent = '  '.repeat(depth);
          const children: string[] = el.children || [];

          // Build a readable line for this element
          const details: string[] = [];
          if (props.title) details.push(`title="${props.title}"`);
          if (props.text) details.push(`"${props.text}"`);
          if (props.label) details.push(`label="${props.label}"`);
          if (props.variant) details.push(`variant=${props.variant}`);
          if (props.direction) details.push(props.direction);
          if (props.cols) details.push(`${props.cols}col`);
          if (props.gap) details.push(`gap=${props.gap}`);
          if (props.value && typeof props.value === 'string')
            details.push(`value="${props.value}"`);
          if (props.placeholder) details.push(`placeholder="${props.placeholder}"`);
          if (props.active) details.push('ACTIVE');
          if (props.level) details.push(`h${props.level}`);
          if (props.checked) details.push('checked');
          if (props.data) details.push(`${(props.data as any[]).length} data points`);

          const detailStr = details.length ? ` (${details.join(', ')})` : '';
          let line = `${indent}├─ ${type}${detailStr}`;

          if (children.length > 0) {
            const childLines = children.map((c) => describeTree(c, depth + 1)).filter(Boolean);
            return line + '\n' + childLines.join('\n');
          }
          return line;
        }

        const tree = describeTree(root, 0);

        const summary = [
          `## MiniApp Layout Description`,
          ``,
          `**Elements:** ${totalElements}`,
          `**Components used:** ${Object.entries(componentCounts)
            .map(([k, v]) => `${k}(${v})`)
            .join(', ')}`,
          ``,
          `### Visual Tree`,
          '```',
          tree,
          '```',
          ``,
          `### Layout Analysis`,
        ];

        // Detect layout pattern
        const hasToolPanel = !!componentCounts['ToolPanel'];
        const hasGlassPanel = !!componentCounts['GlassPanel'];
        const hasCharts = !!(
          componentCounts['BarChart'] ||
          componentCounts['LineChart'] ||
          componentCounts['PieChart']
        );
        const hasMetrics = !!componentCounts['Metric'];
        const hasImageUploader = !!componentCounts['ImageUploader'];

        if (hasToolPanel) summary.push('- **Pattern:** Tool-panel sidebar + content area');
        if (hasGlassPanel) summary.push('- **Style:** Glassmorphism panels');
        if (hasCharts)
          summary.push(
            '- **Data viz:** Charts present (' +
              ['BarChart', 'LineChart', 'PieChart'].filter((c) => componentCounts[c]).join(', ') +
              ')'
          );
        if (hasMetrics) summary.push(`- **KPIs:** ${componentCounts['Metric']} metric cards`);
        if (hasImageUploader) summary.push('- **Upload:** Image uploader present');

        const chipCount = componentCounts['ToolPanelChip'] || 0;
        if (chipCount > 0) summary.push(`- **Toggles:** ${chipCount} chip selectors`);

        const sliderCount =
          (componentCounts['NodeSlider'] || 0) + (componentCounts['ScrubInput'] || 0);
        if (sliderCount > 0) summary.push(`- **Sliders:** ${sliderCount} numeric controls`);

        const colorCount = componentCounts['InlineColorPicker'] || 0;
        if (colorCount > 0) summary.push(`- **Colors:** ${colorCount} color pickers`);

        return { content: [{ type: 'text' as const, text: summary.join('\n') }] };
      } catch (err: any) {
        return ERR.internal(err.message);
      }
    }
  );

  // ═══════════════════════════════════════════
  // Mockup Store bridge — local PSD renderer (registered only when configured)
  // ═══════════════════════════════════════════

  const MOCKUP_STORE_URL = process.env.MOCKUP_STORE_URL || '';
  if (MOCKUP_STORE_URL) {
    const mockupStoreFetch = async (path: string, init: RequestInit = {}) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((init.headers as Record<string, string>) || {}),
      };
      const key = process.env.MOCKUP_STORE_AGENT_KEY || '';
      if (key) headers.Authorization = `Bearer ${key}`;
      const resp = await fetch(`${MOCKUP_STORE_URL}/api/agent/v1${path}`, { ...init, headers });
      const result = (await resp.json().catch(() => ({}))) as any;
      if (!resp.ok) throw new Error(result?.error || `Mockup Store ${resp.status}`);
      return result;
    };

    server.tool(
      'mockup-store-suggest',
      'Suggest the best REAL PSD mockup templates from the Mockup Store library for a brand, ranked by brand-fit (niche/style/vibe/material match against the brand guideline). Returns refIds usable with mockup-store-render.',
      {
        brandId: z.string().describe('Brand guideline ID.'),
        limit: z.number().max(60).default(12).describe('Max suggestions.'),
        hasPsd: z.boolean().default(true).describe('Only refs with a renderable PSD on disk.'),
      },
      { title: 'Suggest PSD Mockups', readOnlyHint: true },
      async ({ brandId, limit, hasPsd }) => {
        try {
          const params = new URLSearchParams({ brandId, limit: String(limit) });
          if (hasPsd === false) params.set('has_psd', 'false');
          return jsonResponse(await mockupStoreFetch(`/suggest?${params.toString()}`));
        } catch (err: any) {
          return ERR.internal(err.message);
        }
      }
    );

    server.tool(
      'mockup-store-render',
      'Render a real PSD mockup headlessly: applies the brand logo (or a custom artUrl) into the PSD smart object with perspective warp. Free — local render, no credits. Use refId from mockup-store-suggest; pass wait=true (default) to block until done, then fetch the image via mockup-store-get-job.',
      {
        brandId: z.string().optional().describe('Brand whose logo will be applied.'),
        refId: z.string().optional().describe('Library reference ID from mockup-store-suggest.'),
        psdPath: z.string().optional().describe('Direct PSD path (alternative to refId).'),
        artUrl: z.string().optional().describe('Custom artwork URL instead of the brand logo.'),
        logoVariant: z
          .enum(['primary', 'dark', 'light', 'icon', 'accent', 'custom'])
          .optional()
          .describe('Logo variant. Default: primary.'),
        smartObject: z.string().optional().describe('Smart object name (auto-detected if omitted).'),
        mode: z
          .enum(['contain', 'cover', 'stretch'])
          .optional()
          .describe('Art framing. Default: contain for logos, cover for artUrl.'),
        preview: z.boolean().default(false).describe('Fast low-res preview.'),
        wait: z.boolean().default(true).describe('Block until the render finishes.'),
      },
      { title: 'Render PSD Mockup', destructiveHint: false },
      async (input) => {
        try {
          return jsonResponse(
            await mockupStoreFetch('/render', { method: 'POST', body: JSON.stringify(input) })
          );
        } catch (err: any) {
          return ERR.internal(err.message);
        }
      }
    );

    server.tool(
      'mockup-store-get-job',
      'Get the status/result of a Mockup Store render job. format="base64" returns the finished image as a data URL.',
      {
        jobId: z.string().describe('Job ID returned by mockup-store-render.'),
        format: z.enum(['status', 'base64']).default('status'),
      },
      { title: 'Get Render Job', readOnlyHint: true },
      async ({ jobId, format }) => {
        try {
          const qs = format === 'base64' ? '?format=base64' : '';
          return jsonResponse(await mockupStoreFetch(`/jobs/${encodeURIComponent(jobId)}${qs}`));
        } catch (err: any) {
          return ERR.internal(err.message);
        }
      }
    );
  }

  // Restore original tool method and persist collected names
  (server as any).tool = originalTool;
  _registeredToolNames = collectedNames;

  // ═══════════════════════════════════════════
  // MCP Prompts — reusable templates from community + feedback databases
  // ═══════════════════════════════════════════

  server.registerPrompt(
    'mockup-scene',
    {
      title: 'Mockup Scene Prompt',
      description:
        'Get a proven, high-quality scene description for mockup-generate. Pulls from community presets and user-validated examples (thumbs-up feedback). Returns a ready-to-use prompt — just pass your design as referenceImages.',
      argsSchema: {
        category: z
          .enum([
            'sticker',
            'business-card',
            'packaging',
            'apparel',
            'signage',
            'social-media',
            'device',
            'print',
            'any',
          ])
          .default('any')
          .describe('Design category to find scene prompts for.'),
        style: z
          .string()
          .optional()
          .describe(
            'Optional style keywords to match (e.g. "minimal", "realistic", "vintage", "industrial").'
          ),
      },
    },
    async ({ category, style }) => {
      try {
        await connectToMongoDB();
        const db = getDb();

        // 1. Community presets (admin-approved, high engagement)
        const communityFilter: any = { isApproved: true };
        if (category !== 'any') {
          communityFilter.$or = [
            { category: { $regex: category, $options: 'i' } },
            { presetType: { $regex: category, $options: 'i' } },
            { tags: { $regex: category, $options: 'i' } },
          ];
        }
        if (style) {
          const styleFilter = { $regex: style, $options: 'i' };
          communityFilter.prompt = styleFilter;
        }

        const communityPresets = await db
          .collection('community_presets')
          .find(communityFilter)
          .sort({ likesCount: -1, createdAt: -1 })
          .limit(5)
          .toArray();

        // 2. Prisma MockupExamples (user-validated via thumbs-up)
        const prismaFilter: any = { rating: 1 };
        if (category !== 'any')
          prismaFilter.designType = { contains: category, mode: 'insensitive' };
        if (style) prismaFilter.prompt = { contains: style, mode: 'insensitive' };

        const mockupExamples = await prisma.mockupExample.findMany({
          where: prismaFilter,
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { prompt: true, designType: true, tags: true, aspectRatio: true, imageUrl: true },
        });

        // 3. Official MockupPatterns (auto-promoted from feedback loop)
        const patternFilter: any = { isOfficial: true };
        if (category !== 'any')
          patternFilter.designType = { contains: category, mode: 'insensitive' };

        const patterns = await prisma.mockupPattern.findMany({
          where: patternFilter,
          orderBy: { rating: 'desc' },
          take: 3,
          select: { prompt: true, designType: true, tags: true, rating: true },
        });

        // Build response
        const sections: string[] = [];

        if (patterns.length > 0) {
          sections.push('## Top Proven Patterns (auto-promoted from 5+ positive feedback)\n');
          for (const p of patterns) {
            sections.push(
              `**[${p.designType}]** (${p.rating} thumbs-up)\n\`\`\`\n${
                p.prompt
              }\n\`\`\`\nTags: ${p.tags.join(', ')}\n`
            );
          }
        }

        if (communityPresets.length > 0) {
          sections.push('## Community Presets (curated & approved)\n');
          for (const c of communityPresets) {
            sections.push(
              `**${c.name}** — ${c.description || ''}\n\`\`\`\n${c.prompt}\n\`\`\`\nCategory: ${
                c.category
              } | Tags: ${(c.tags || []).join(', ')} | Use case: ${c.useCase || 'general'}\n`
            );
          }
        }

        if (mockupExamples.length > 0) {
          sections.push('## User-Validated Examples (thumbs-up feedback)\n');
          for (const e of mockupExamples) {
            sections.push(
              `**[${e.designType}]** ${e.aspectRatio}\n\`\`\`\n${
                e.prompt
              }\n\`\`\`\nTags: ${e.tags.join(', ')}${e.imageUrl ? `\nResult: ${e.imageUrl}` : ''}\n`
            );
          }
        }

        if (sections.length === 0) {
          sections.push(
            `No matching prompts found for category="${category}"${
              style ? ` style="${style}"` : ''
            }. Try category="any" or different style keywords.`
          );
        }

        const intro = `# Mockup Scene Prompts\nCategory: ${category}${
          style ? ` | Style: ${style}` : ''
        }\n\nThese are proven prompts. Pick one and use it as the \`prompt\` parameter in mockup-generate. Pass your design as \`referenceImages\`.\n\n`;

        return {
          messages: [
            {
              role: 'user' as const,
              content: { type: 'text' as const, text: intro + sections.join('\n') },
            },
          ],
        };
      } catch (err: any) {
        return {
          messages: [
            {
              role: 'user' as const,
              content: { type: 'text' as const, text: `Error fetching prompts: ${err.message}` },
            },
          ],
        };
      }
    }
  );

  server.registerPrompt(
    'prompt-library',
    {
      title: 'Prompt Library',
      description:
        'Browse the full prompt library — community presets, user-validated examples, and official patterns. Filter by category, tags, or search keywords. Use these as starting points for any generation tool.',
      argsSchema: {
        search: z
          .string()
          .optional()
          .describe('Keyword search across prompt text, name, and tags.'),
        category: z
          .string()
          .optional()
          .describe(
            'Filter by category: mockup, 3d, presets, aesthetics, themes, angle, texture, ambience, luminance.'
          ),
        source: z
          .enum(['community', 'feedback', 'patterns', 'all'])
          .default('all')
          .describe('Which database to query.'),
        limit: z.number().int().min(1).max(20).default(10).describe('Max results to return.'),
      },
    },
    async ({ search, category, source, limit }) => {
      try {
        const results: string[] = [];

        // Community presets
        if (source === 'all' || source === 'community') {
          await connectToMongoDB();
          const db = getDb();
          const filter: any = { isApproved: true };
          if (category) filter.category = { $regex: category, $options: 'i' };
          if (search) {
            filter.$or = [
              { prompt: { $regex: search, $options: 'i' } },
              { name: { $regex: search, $options: 'i' } },
              { tags: { $regex: search, $options: 'i' } },
            ];
          }
          const presets = await db
            .collection('community_presets')
            .find(filter)
            .sort({ likesCount: -1, createdAt: -1 })
            .limit(limit)
            .toArray();

          if (presets.length > 0) {
            results.push('## Community Presets\n');
            for (const p of presets) {
              results.push(
                `### ${p.name}\n${p.description || ''}\n\`\`\`\n${(p.prompt || '').substring(
                  0,
                  2000
                )}\n\`\`\`\nCategory: ${p.category} | Tags: ${(p.tags || []).join(', ')}${
                  p.examples?.length ? `\nExamples: ${p.examples.slice(0, 3).join(' | ')}` : ''
                }\n`
              );
            }
          }
        }

        // Feedback examples
        if (source === 'all' || source === 'feedback') {
          const where: any = { rating: 1 };
          if (category) where.designType = { contains: category, mode: 'insensitive' };
          if (search) where.prompt = { contains: search, mode: 'insensitive' };
          const examples = await prisma.mockupExample.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              prompt: true,
              designType: true,
              tags: true,
              aspectRatio: true,
              imageUrl: true,
            },
          });

          if (examples.length > 0) {
            results.push('## User-Validated Examples\n');
            for (const e of examples) {
              results.push(
                `**[${e.designType}]** ${e.aspectRatio}\n\`\`\`\n${e.prompt.substring(
                  0,
                  2000
                )}\n\`\`\`\nTags: ${e.tags.join(', ')}${
                  e.imageUrl ? `\nResult: ${e.imageUrl}` : ''
                }\n`
              );
            }
          }
        }

        // Official patterns
        if (source === 'all' || source === 'patterns') {
          const where: any = { isOfficial: true };
          if (category) where.designType = { contains: category, mode: 'insensitive' };
          if (search) where.prompt = { contains: search, mode: 'insensitive' };
          const patterns = await prisma.mockupPattern.findMany({
            where,
            orderBy: { rating: 'desc' },
            take: limit,
            select: { prompt: true, designType: true, tags: true, rating: true },
          });

          if (patterns.length > 0) {
            results.push('## Official Patterns (auto-promoted)\n');
            for (const p of patterns) {
              results.push(
                `**[${p.designType}]** (${p.rating} thumbs-up)\n\`\`\`\n${p.prompt.substring(
                  0,
                  2000
                )}\n\`\`\`\nTags: ${p.tags.join(', ')}\n`
              );
            }
          }
        }

        const header = `# Prompt Library\n${search ? `Search: "${search}" | ` : ''}${
          category ? `Category: ${category} | ` : ''
        }Source: ${source} | Limit: ${limit}\n\n`;

        return {
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text:
                  results.length > 0
                    ? header + results.join('\n')
                    : header +
                      'No matching prompts found. Try broader search terms or category="mockup".',
              },
            },
          ],
        };
      } catch (err: any) {
        return {
          messages: [
            {
              role: 'user' as const,
              content: { type: 'text' as const, text: `Error: ${err.message}` },
            },
          ],
        };
      }
    }
  );

  return server;
}

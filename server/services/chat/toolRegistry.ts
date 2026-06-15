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
import {
  IMAGE_MODEL_IDS,
  DEFAULT_IMAGE_MODEL_ID,
} from '../../../src/constants/imageModelRegistry.js';
import { prisma } from '../../db/prisma.js';
import { describeImage } from '../geminiService.js';
import {
  buildBrandContext,
  BRAND_SECTION_PRESETS,
  type BrandContextSection,
} from '../../lib/brandContextBuilder.js';
const INTERNAL_API_BASE =
  process.env.INTERNAL_API_URL || `http://localhost:${process.env.PORT || 3001}`;

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
      executeAdminChatTool(
        d.name,
        args,
        ctx.userId,
        ctx.sessionId,
        ctx.authHeader ?? '',
        ctx.brandGuidelineId
      ),
  };
}

// ── Plugin-scoped tools (public, available to plugin pre-pass) ──

REGISTRY['get_brand_context'] = {
  scope: 'public',
  declaration: {
    name: 'get_brand_context',
    description:
      'Fetch brand guideline context. Use "sections" to fetch only what you need — e.g. ["colors","typography"] for visual tweaks, "minimal" for simple tasks. Presets: "visual", "copy", "minimal", "imageGen", "full". Omit sections for full context.',
    parameters: {
      type: 'object',
      properties: {
        brandGuidelineId: {
          type: 'string',
          description: 'Brand guideline ID. Omit to use the session default.',
        },
        sections: {
          oneOf: [
            {
              type: 'array',
              items: {
                type: 'string',
                enum: [
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
                ],
              },
            },
            { type: 'string', enum: ['visual', 'copy', 'full', 'imageGen', 'minimal'] },
          ],
          description:
            'Which brand sections to include. Array of specific sections or a preset name. Defaults to full.',
        },
      },
    },
  },
  execute: async (
    args: { brandGuidelineId?: string; sections?: BrandContextSection[] | string },
    ctx
  ) => {
    const id = args.brandGuidelineId || ctx.brandGuidelineId;
    if (!id) return 'No brand guideline selected.';

    const bg = await prisma.brandGuideline.findUnique({ where: { id } });
    if (!bg) return `Brand guideline ${id} not found.`;

    const resolvedSections: BrandContextSection[] | undefined =
      typeof args.sections === 'string'
        ? BRAND_SECTION_PRESETS[args.sections as keyof typeof BRAND_SECTION_PRESETS]
        : args.sections;

    return buildBrandContext(bg as any, { sections: resolvedSections });
  },
};

REGISTRY['generate_mockup'] = {
  scope: 'public',
  declaration: {
    name: 'generate_mockup',
    description:
      'Generate a mockup image using AI. Brand context (logo, colors, typography, voice) is auto-injected when brandGuidelineId is provided — never describe the logo in the prompt. Returns imageUrl to use with SET_IMAGE_FILL.',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description:
            'Scene description. Do NOT describe the logo or font — they are injected automatically from brandGuidelineId.',
        },
        brandGuidelineId: {
          type: 'string',
          description:
            'Brand guideline ID. Omit to use session default. Injects logo as reference image + colors + typography + voice.',
        },
        model: {
          type: 'string',
          enum: IMAGE_MODEL_IDS as string[],
          description:
            'Image model. gpt-image-2=best quality+brand fidelity, gemini=fast/creative, seedream=photorealistic lifestyle.',
        },
        aspectRatio: {
          type: 'string',
          enum: ['1:1', '9:16', '16:9', '4:5'],
          description:
            '1:1=square/Instagram, 9:16=story/Reels, 16:9=landscape/cover, 4:5=portrait feed.',
        },
        resolution: {
          type: 'string',
          enum: ['1K', '2K', '4K'],
          description:
            '1K=standard, 2K=high quality, 4K=print/large format. Higher = more credits.',
        },
        designType: {
          type: 'string',
          description:
            'Design type hint: business-card, social-media, packaging, apparel, signage, billboard, etc.',
        },
        baseImageUrl: {
          type: 'string',
          description: 'Base image URL for image-to-image generation.',
        },
        referenceImages: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Extra reference image URLs to guide style. Brand logos are injected automatically.',
        },
        seed: { type: 'number', description: 'Random seed for reproducible generation.' },
      },
      required: ['prompt'],
    },
  },
  execute: async (
    args: {
      prompt: string;
      brandGuidelineId?: string;
      model?: string;
      aspectRatio?: string;
      resolution?: string;
      designType?: string;
      baseImageUrl?: string;
      referenceImages?: string[];
      seed?: number;
    },
    ctx
  ) => {
    const response = await fetch(`${INTERNAL_API_BASE}/api/mockups/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-mcp-user-id': ctx.userId },
      body: JSON.stringify({
        promptText: args.prompt,
        brandGuidelineId: args.brandGuidelineId || ctx.brandGuidelineId,
        model: args.model || DEFAULT_IMAGE_MODEL_ID,
        aspectRatio: args.aspectRatio || '1:1',
        resolution: args.resolution || '1K',
        designType: args.designType || 'blank',
        baseImageUrl: args.baseImageUrl,
        referenceImages: args.referenceImages,
        seed: args.seed,
        feature: 'plugin',
      }),
    });
    const result = (await response.json()) as any;
    if (!response.ok) return `Mockup generation failed: ${result.error || response.status}`;
    return JSON.stringify({
      imageUrl: result.imageUrl || null,
      mockupId: result.id || result.mockup?.id || null,
      model: args.model || DEFAULT_IMAGE_MODEL_ID,
      provider: result.provider || null,
      aspectRatio: args.aspectRatio || '1:1',
      resolution: args.resolution || '1K',
      seed: result.seed ?? args.seed ?? null,
      creditsUsed: result.creditsUsed ?? null,
    });
  },
};

REGISTRY['describe_image'] = {
  scope: 'public',
  declaration: {
    name: 'describe_image',
    description:
      'Analyze an image and return a detailed description. Accepts a URL or base64 data.',
    parameters: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string', description: 'URL of the image to describe.' },
        base64: {
          type: 'string',
          description: 'Base64-encoded image data (without data: prefix).',
        },
      },
    },
  },
  execute: async (args: { imageUrl?: string; base64?: string }) => {
    const input = args.imageUrl || args.base64;
    if (!input) return 'Either imageUrl or base64 is required.';
    const result = await describeImage(input);
    return JSON.stringify({ title: result.title, description: result.description });
  },
};

REGISTRY['brand_guideline_list'] = {
  scope: 'public',
  declaration: {
    name: 'brand_guideline_list',
    description:
      'List all brand guidelines owned by the user. Use when no brandGuidelineId is set and you need to find the right brand, ' +
      'or when the user mentions a brand name and you need to resolve it to an ID.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  execute: async (_args: any, ctx) => {
    const guidelines = await prisma.brandGuideline.findMany({
      where: { userId: ctx.userId },
      select: { id: true, identity: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
    if (!guidelines.length)
      return 'No brand guidelines found. Create one with brand_guideline_create.';
    return JSON.stringify(
      guidelines.map((g) => ({
        id: g.id,
        name: (g.identity as any)?.name || 'Untitled',
        updatedAt: g.updatedAt.toISOString().slice(0, 10),
      }))
    );
  },
};

REGISTRY['search_reference_library'] = {
  scope: 'public',
  declaration: {
    name: 'search_reference_library',
    description:
      'Search the curated mockup reference library — world-class mockup examples categorized by 9 dimensions. ' +
      'Use BEFORE suggesting or generating mockups to find proven visual techniques that match the brand/niche. ' +
      'Returns reference images with dimension tags (niche, aesthetic, vibe, lighting, texture, material, angle, color_mood, mockup_type).',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Free text search — describe the kind of mockup you are looking for.',
        },
        niche: {
          type: 'string',
          description: 'Industry niche: luxury, tech, food, fashion, beauty, sports, etc.',
        },
        aesthetic: {
          type: 'string',
          description: 'Visual style: minimalist, brutalist, organic, retro, editorial, etc.',
        },
        vibe: {
          type: 'string',
          description: 'Mood: premium, playful, corporate, edgy, warm, etc.',
        },
        lighting: {
          type: 'string',
          description: 'Lighting: soft studio, golden hour, neon, dramatic, etc.',
        },
        mockup_type: {
          type: 'string',
          description: 'Type: packaging, stationery, apparel, signage, device, bottle, etc.',
        },
        limit: { type: 'number', description: 'Max results (default 5).' },
      },
    },
  },
  execute: async (args: any) => {
    const { connectToMongoDB, getDb } = await import('../../db/mongodb.js');
    await connectToMongoDB();
    const db = getDb();
    const filter: any = { category: 'reference', isAdminCurated: true };
    if (args.query)
      filter.$or = [
        { name: { $regex: args.query, $options: 'i' } },
        { description: { $regex: args.query, $options: 'i' } },
      ];
    for (const key of ['niche', 'aesthetic', 'vibe', 'lighting', 'mockup_type']) {
      if (args[key]) filter[`dimensions.${key}`] = { $in: [args[key]] };
    }
    const refs = await db
      .collection('community_presets')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(args.limit || 5)
      .project({
        _id: 0,
        id: 1,
        name: 1,
        description: 1,
        referenceImageUrl: 1,
        dimensions: 1,
        prompt: 1,
      })
      .toArray();
    if (!refs.length)
      return 'No curated references found matching those criteria. Try broader filters.';
    return JSON.stringify(refs);
  },
};

REGISTRY['suggest_mockup_ideas'] = {
  scope: 'public',
  declaration: {
    name: 'suggest_mockup_ideas',
    description:
      'Analyze a brand guideline and cross-reference with the curated mockup library to suggest impactful, on-brand mockup concepts. ' +
      'Returns personalized mockup suggestions with reference images, recommended dimensions, and prompt starters. ' +
      'Call this when a user wants mockup ideas for their brand or when starting a new mockup project.',
    parameters: {
      type: 'object',
      properties: {
        brandGuidelineId: {
          type: 'string',
          description: 'Brand guideline ID. Omit to use session default.',
        },
        count: { type: 'number', description: 'Number of suggestions (default 3, max 6).' },
        focus: {
          type: 'string',
          description:
            'Optional focus: "packaging", "stationery", "social", "signage", "apparel", "device", etc.',
        },
      },
    },
  },
  execute: async (args: { brandGuidelineId?: string; count?: number; focus?: string }, ctx) => {
    const bgId = args.brandGuidelineId || ctx.brandGuidelineId;
    if (!bgId)
      return 'No brand guideline selected. Provide brandGuidelineId or select one for the session.';

    const bg = await prisma.brandGuideline.findUnique({ where: { id: bgId } });
    if (!bg) return `Brand guideline ${bgId} not found.`;

    const identity = bg.identity as any;
    const brandName = identity?.name || 'Brand';
    const niche = identity?.industry || identity?.niche || '';
    const archetype = identity?.archetype || '';
    const colors = ((bg.colors as any[]) || [])
      .slice(0, 4)
      .map((c: any) => c.hex)
      .join(', ');

    // Search references matching brand profile
    const { connectToMongoDB, getDb } = await import('../../db/mongodb.js');
    await connectToMongoDB();
    const db = getDb();

    const refFilter: any = { category: 'reference', isAdminCurated: true };
    if (niche) refFilter['dimensions.niche'] = { $in: [niche.toLowerCase()] };
    if (args.focus) refFilter['dimensions.mockup_type'] = { $in: [args.focus.toLowerCase()] };

    let refs = await db
      .collection('community_presets')
      .find(refFilter)
      .sort({ createdAt: -1 })
      .limit(Math.min(args.count || 3, 6) * 2)
      .project({
        _id: 0,
        id: 1,
        name: 1,
        description: 1,
        referenceImageUrl: 1,
        dimensions: 1,
        prompt: 1,
      })
      .toArray();

    // Fallback: if niche filter too narrow, broaden
    if (refs.length === 0) {
      delete refFilter['dimensions.niche'];
      refs = await db
        .collection('community_presets')
        .find(refFilter)
        .sort({ createdAt: -1 })
        .limit(Math.min(args.count || 3, 6) * 2)
        .project({
          _id: 0,
          id: 1,
          name: 1,
          description: 1,
          referenceImageUrl: 1,
          dimensions: 1,
          prompt: 1,
        })
        .toArray();
    }

    const count = Math.min(args.count || 3, 6, refs.length || 3);

    return JSON.stringify({
      brand: { name: brandName, niche, archetype, colors },
      references: refs.slice(0, count),
      instructions:
        `Use these curated references as visual inspiration. For "${brandName}" (${
          niche || 'general'
        }, ${archetype || 'brand'}), ` +
        `match the lighting, composition, and texture from the references while honoring the brand palette (${
          colors || 'as defined'
        }). ` +
        `Generate mockups with generate_mockup tool using insights from these references.`,
    });
  },
};

// ── ImageLab tools ──

REGISTRY['imagelab_apply_effect'] = {
  scope: 'public',
  declaration: {
    name: 'imagelab_apply_effect',
    description:
      'Apply an ImageLab effect to an image. Modes: halftone (CMYK dot patterns), texture (overlay blending), riso (risograph print). ' +
      'Use imagelab_list_presets to discover presets. Returns processed image URL.',
    parameters: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string', description: 'Source image URL or base64 data URI.' },
        mode: {
          type: 'string',
          enum: ['halftone', 'texture', 'riso'],
          description: 'Effect mode.',
        },
        preset: {
          type: 'string',
          description: 'Named preset (e.g. "Newsprint", "Vintage Poster"). Omit for defaults.',
        },
        settings: {
          type: 'object',
          description: 'Custom settings that override preset values. Mode-specific params.',
        },
        format: {
          type: 'string',
          enum: ['png', 'svg', 'jpeg'],
          description: 'Output format. SVG only for halftone. Default png.',
        },
      },
      required: ['imageUrl', 'mode'],
    },
  },
  execute: async (args: any, ctx) => {
    const { imageLabApplyEffect } = await import('../imageLab/index.js');
    const result = await imageLabApplyEffect(args, ctx.userId);
    return JSON.stringify(result);
  },
};

REGISTRY['imagelab_apply_shader'] = {
  scope: 'public',
  declaration: {
    name: 'imagelab_apply_shader',
    description:
      'Apply a post-processing shader to an image. 14 effects: halftone, vhs, ascii, dither, duotone, ' +
      'filmGrain, pixelate, posterize, chromaticAberration, crtScanlines, edgeDetect, glitch, matrixDither, upscale.',
    parameters: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string', description: 'Source image URL or base64.' },
        shaderType: {
          type: 'string',
          enum: [
            'halftone',
            'vhs',
            'ascii',
            'matrixDither',
            'upscale',
            'dither',
            'duotone',
            'filmGrain',
            'pixelate',
            'posterize',
            'chromaticAberration',
            'crtScanlines',
            'edgeDetect',
            'glitch',
          ],
          description: 'Shader effect type.',
        },
        settings: { type: 'object', description: 'Shader-specific parameters. Omit for defaults.' },
        format: {
          type: 'string',
          enum: ['png', 'jpeg'],
          description: 'Output format. Default png.',
        },
      },
      required: ['imageUrl', 'shaderType'],
    },
  },
  execute: async (args: any, ctx) => {
    const { imageLabApplyShader } = await import('../imageLab/index.js');
    const result = await imageLabApplyShader(args, ctx.userId);
    return JSON.stringify(result);
  },
};

REGISTRY['imagelab_list_presets'] = {
  scope: 'public',
  declaration: {
    name: 'imagelab_list_presets',
    description:
      'List available ImageLab presets for a mode. Returns preset names with their parameter values.',
    parameters: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['halftone', 'texture', 'riso', 'shader'],
          description: 'Effect mode to list presets for.',
        },
      },
      required: ['mode'],
    },
  },
  execute: async (args: any) => {
    const { imageLabListPresets } = await import('../imageLab/index.js');
    return JSON.stringify(imageLabListPresets(args.mode));
  },
};

REGISTRY['imagelab_chain'] = {
  scope: 'public',
  declaration: {
    name: 'imagelab_chain',
    description:
      'Apply an effect + optional shader in one call. Avoids intermediate uploads. ' +
      'Example: apply riso effect then add VHS shader in a single request.',
    parameters: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string', description: 'Source image URL.' },
        effect: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['halftone', 'texture', 'riso'] },
            preset: { type: 'string' },
            settings: { type: 'object' },
          },
          description: 'Effect to apply first.',
        },
        shader: {
          type: 'object',
          properties: {
            shaderType: { type: 'string' },
            settings: { type: 'object' },
          },
          description: 'Post-fx shader to apply after effect.',
        },
        effectOpacity: {
          type: 'number',
          description: 'Effect blend with original (0-1). Default 1.',
        },
        format: { type: 'string', enum: ['png', 'jpeg'], description: 'Output format.' },
      },
      required: ['imageUrl'],
    },
  },
  execute: async (args: any, ctx) => {
    const { imageLabChain } = await import('../imageLab/index.js');
    const result = await imageLabChain(args, ctx.userId);
    return JSON.stringify(result);
  },
};

// ── Promote admin tools to plugin scope ──
// These already exist in adminChatTools with full schemas and Prisma-direct
// execution. Promote to 'public' so the plugin pre-pass can use them.
for (const name of [
  'brand_guideline_update',
  'brand_guideline_create',
  'save_to_brand_knowledge',
  'update_session_memory',
]) {
  if (REGISTRY[name]) {
    REGISTRY[name].scope = 'public';
  }
}

/**
 * Tool declarations available to a role, in the Gemini SDK shape.
 * Admins get the union of public + admin tools.
 */
export function getChatTools(isAdmin: boolean): Array<{ functionDeclarations: any[] }> {
  const decls = Object.values(REGISTRY)
    .filter((e) => isAdmin || e.scope === 'public')
    .map((e) => e.declaration);
  return [{ functionDeclarations: decls }];
}

/**
 * Execute any registered tool by name. Returns whatever the underlying
 * executor returns — string for `web_search`, object for admin tools.
 */
export async function executeChatTool(name: string, args: any, ctx: ChatToolContext): Promise<any> {
  const entry = REGISTRY[name];
  if (!entry) throw new Error(`Unknown chat tool: ${name}`);
  return entry.execute(args, ctx);
}

/** Introspection helper — useful for logging and /debug endpoints. */
export function listChatTools(): Array<{ name: string; scope: ChatToolScope }> {
  return Object.entries(REGISTRY).map(([name, e]) => ({ name, scope: e.scope }));
}

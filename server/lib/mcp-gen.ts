/**
 * MCP Tools Specification Generator
 * Extracts and structures MCP tools for documentation
 *
 * @module mcp-gen
 * @description Generates MCP (Model Context Protocol) specifications for AI agent integration.
 *              Tools are dynamically synced from FIGMA_TOOLS registry.
 */

import { SpecGenerationError, ValidationError } from './docs-errors.js';
import { FIGMA_TOOLS, FigmaTool } from './tools/registry.js';

type ToolCost = 'free' | 'credits';
type ToolCategory = 'account' | 'mockups' | 'ai' | 'branding' | 'brand-guidelines' | 'canvas' | 'budget' | 'community';

interface PlatformToolDef {
  name: string;
  description: string;
  required: string[];
  properties: Record<string, any>;
  cost: ToolCost;
  category: ToolCategory;
  auth: boolean;
}

// Single source of truth for all platform MCP tools.
// This array is served via GET /api/docs/platform/mcp.json — do NOT duplicate elsewhere.
const PLATFORM_TOOLS: PlatformToolDef[] = [
  // ---- Account ----
  { name: 'account-usage', description: 'Get credit usage, remaining balance, plan limits, and billing cycle info for the authenticated account.', required: [], properties: {}, cost: 'free', category: 'account', auth: true },
  { name: 'account-profile', description: 'Get the authenticated user profile including name, email, avatar, and subscription plan.', required: [], properties: {}, cost: 'free', category: 'account', auth: true },

  // ---- Mockups ----
  { name: 'mockup-list', description: 'List mockups created by the authenticated user. Supports pagination.', required: [], properties: { limit: { type: 'integer', default: 20 }, skip: { type: 'integer', default: 0 } }, cost: 'free', category: 'mockups', auth: true },
  { name: 'mockup-get', description: 'Get a single mockup by its ID, including image URL, prompt, and metadata.', required: ['id'], properties: { id: { type: 'string' } }, cost: 'free', category: 'mockups', auth: true },
  { name: 'mockup-presets', description: 'Browse available mockup presets filtered by design type.', required: ['type'], properties: { type: { type: 'string', enum: ['business-card','social-media','packaging','apparel','stationery','device','signage','print','other'] } }, cost: 'free', category: 'mockups', auth: true },
  { name: 'mockup-generate', description: 'Generate a mockup image using AI (text-to-image or image-to-image). Choose provider (openai/gemini/seedream), model, aspectRatio, resolution. Costs credits.', required: ['promptText'], properties: { promptText: { type: 'string' }, provider: { type: 'string', enum: ['openai', 'gemini', 'seedream'], default: 'openai' }, model: { type: 'string', default: 'gpt-image-2' }, aspectRatio: { type: 'string', enum: ['1:1', '9:16', '16:9', '4:5'] }, resolution: { type: 'string', enum: ['1K', '2K', '4K'] }, brandGuidelineId: { type: 'string' }, baseImageUrl: { type: 'string' } }, cost: 'credits', category: 'mockups', auth: true },
  { name: 'mockup-batch-generate', description: 'Generate up to 20 mockup images in parallel from an array of prompts. All share the same model, provider, and output settings. Returns ordered results array.', required: ['prompts'], properties: { prompts: { type: 'array', items: { type: 'string' } }, provider: { type: 'string', enum: ['gemini', 'openai', 'seedream'], default: 'openai' }, model: { type: 'string', default: 'gpt-image-2' }, aspectRatio: { type: 'string', enum: ['1:1', '9:16', '16:9', '4:5'] }, resolution: { type: 'string', enum: ['1K', '2K', '4K'] }, brandGuidelineId: { type: 'string' }, baseImageUrl: { type: 'string' } }, cost: 'credits', category: 'mockups', auth: true },
  { name: 'mockup-list-public', description: 'List all public blank mockup templates available in the platform.', required: [], properties: {}, cost: 'free', category: 'mockups', auth: false },

  // ---- AI Prompt & Image Analysis ----
  { name: 'ai-improve-prompt', description: 'Enhance and refine a text prompt using AI to produce better generation results.', required: ['prompt'], properties: { prompt: { type: 'string' } }, cost: 'free', category: 'ai', auth: true },
  { name: 'ai-generate-smart-prompt', description: 'Generate an optimized image prompt from structured inputs (design type, style tags, colors, aspect ratio). Optionally biased by base image or brand guideline.', required: ['designType'], properties: { designType: { type: 'string' }, additionalPrompt: { type: 'string' }, aspectRatio: { type: 'string', enum: ['1:1', '9:16', '16:9', '4:5'] }, brandingTags: { type: 'array', items: { type: 'string' } }, brandGuidelineId: { type: 'string' }, negativePrompt: { type: 'string' }, baseImageUrl: { type: 'string' } }, cost: 'free', category: 'ai', auth: true },
  { name: 'ai-suggest-prompt-variations', description: 'Generate multiple creative variations of an existing image generation prompt.', required: ['prompt'], properties: { prompt: { type: 'string' } }, cost: 'free', category: 'ai', auth: true },
  { name: 'ai-extract-prompt-from-image', description: 'Reverse-engineer a descriptive generation prompt from an image URL. Useful for replicating a visual style.', required: ['imageUrl'], properties: { imageUrl: { type: 'string', format: 'uri' }, mimeType: { type: 'string' } }, cost: 'free', category: 'ai', auth: true },
  { name: 'ai-extract-colors', description: 'Extract a dominant color palette from an image. Returns hex codes, color names, semantic roles (primary/secondary/accent/background/neutral), and frequency.', required: ['imageUrl'], properties: { imageUrl: { type: 'string', format: 'uri' }, mimeType: { type: 'string' } }, cost: 'free', category: 'ai', auth: true },
  { name: 'ai-generate-naming', description: 'Generate creative brand or product name suggestions with rationale from a brief. Optionally biased by brand guideline.', required: ['brief'], properties: { brief: { type: 'string' }, count: { type: 'integer', default: 10 }, style: { type: 'string' }, brandGuidelineId: { type: 'string' } }, cost: 'free', category: 'ai', auth: true },
  { name: 'ai-describe-image', description: 'Analyze an image and return a detailed text description.', required: [], properties: { imageUrl: { type: 'string', format: 'uri' }, base64: { type: 'string' } }, cost: 'free', category: 'ai', auth: true },

  // ---- Brand Identity Generation ----
  { name: 'brand-generate-market-research', description: 'Generate a market benchmarking paragraph for a brand or product brief.', required: ['prompt'], properties: { prompt: { type: 'string' } }, cost: 'credits', category: 'branding', auth: true },
  { name: 'brand-generate-swot', description: 'Generate a SWOT analysis (strengths, weaknesses, opportunities, threats) from a brand brief.', required: ['prompt'], properties: { prompt: { type: 'string' }, previousData: { type: 'object' } }, cost: 'credits', category: 'branding', auth: true },
  { name: 'brand-generate-persona', description: 'Generate a detailed audience persona (demographics, psychographics, pain points, motivations) from a brand brief.', required: ['prompt'], properties: { prompt: { type: 'string' }, marketResearch: { type: 'string' } }, cost: 'credits', category: 'branding', auth: true },
  { name: 'brand-generate-archetype', description: 'Generate brand archetype analysis (Hero, Sage, Lover, Caregiver, Jester, etc.) with positioning rationale from a brand brief.', required: ['prompt'], properties: { prompt: { type: 'string' }, marketResearch: { type: 'string' } }, cost: 'credits', category: 'branding', auth: true },
  { name: 'brand-generate-concept-ideas', description: 'Generate creative mockup and usage scenario ideas for a product or brand.', required: ['prompt'], properties: { prompt: { type: 'string' }, previousData: { type: 'object' } }, cost: 'credits', category: 'branding', auth: true },
  { name: 'brand-generate-color-palettes', description: 'Generate AI-recommended brand color palettes with hex codes from a brief and optional SWOT/references context.', required: ['prompt'], properties: { prompt: { type: 'string' }, previousData: { type: 'object' } }, cost: 'credits', category: 'branding', auth: true },
  { name: 'brand-generate-moodboard', description: 'Generate a moodboard direction (aesthetic, vibe, visual mood, references) for a brand brief.', required: ['prompt'], properties: { prompt: { type: 'string' }, previousData: { type: 'object' } }, cost: 'credits', category: 'branding', auth: true },
  { name: 'branding-list', description: 'List branding projects owned by the authenticated user.', required: [], properties: {}, cost: 'free', category: 'branding', auth: true },
  { name: 'branding-get', description: 'Get a branding project by ID, including logo, colors, typography, and brand assets.', required: ['id'], properties: { id: { type: 'string' } }, cost: 'free', category: 'branding', auth: true },
  { name: 'branding-generate', description: 'Generate a complete brand identity (logo, colors, typography) from a text prompt. Costs credits.', required: ['prompt'], properties: { prompt: { type: 'string' } }, cost: 'credits', category: 'branding', auth: true },

  // ---- Brand Guidelines ----
  { name: 'brand-guidelines-list', description: 'List all brand guidelines (identity vaults) owned by the authenticated user.', required: [], properties: {}, cost: 'free', category: 'brand-guidelines', auth: true },
  { name: 'brand-guidelines-get', description: 'Get a detailed brand guideline by ID, including colors, typography, logos, and strategy. format=structured|prompt (LLM-ready text).', required: ['id'], properties: { id: { type: 'string' }, format: { type: 'string', enum: ['structured', 'prompt'], default: 'structured' } }, cost: 'free', category: 'brand-guidelines', auth: true },
  { name: 'brand-guidelines-public', description: 'Get a public brand guideline by its slug. No authentication required.', required: ['slug'], properties: { slug: { type: 'string' } }, cost: 'free', category: 'brand-guidelines', auth: false },

  // ---- Canvas ----
  { name: 'canvas-list', description: 'List canvas (whiteboard) projects owned by the authenticated user.', required: [], properties: {}, cost: 'free', category: 'canvas', auth: true },
  { name: 'canvas-get', description: 'Get a canvas project by ID, including elements, collaborators, and metadata.', required: ['id'], properties: { id: { type: 'string' } }, cost: 'free', category: 'canvas', auth: true },
  { name: 'canvas-create', description: 'Create a new empty canvas project.', required: ['name'], properties: { name: { type: 'string' } }, cost: 'free', category: 'canvas', auth: true },
  { name: 'canvas-update', description: 'Update an existing canvas project with new nodes, edges, or metadata.', required: ['id', 'data'], properties: { id: { type: 'string' }, data: { type: 'object' } }, cost: 'free', category: 'canvas', auth: true },
  { name: 'canvas-delete', description: 'Delete a canvas project by ID.', required: ['id'], properties: { id: { type: 'string' } }, cost: 'free', category: 'canvas', auth: true },

  // ---- Budget ----
  { name: 'budget-list', description: 'List budget documents created by the authenticated user.', required: [], properties: {}, cost: 'free', category: 'budget', auth: true },
  { name: 'budget-get', description: 'Get a budget document by ID, including line items, totals, and client info.', required: ['id'], properties: { id: { type: 'string' } }, cost: 'free', category: 'budget', auth: true },
  { name: 'budget-create', description: 'Create a new budget document with client and project details.', required: ['clientName', 'projectDescription'], properties: { clientName: { type: 'string' }, projectDescription: { type: 'string' }, brandName: { type: 'string' } }, cost: 'free', category: 'budget', auth: true },

  // ---- Community (no auth) ----
  { name: 'community-presets', description: 'Browse community-shared mockup presets. No auth required.', required: [], properties: { limit: { type: 'integer', default: 20 } }, cost: 'free', category: 'community', auth: false },
  { name: 'community-profiles', description: 'Browse public community creator profiles. No auth required.', required: [], properties: { limit: { type: 'integer', default: 20 } }, cost: 'free', category: 'community', auth: false },
];

interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
  examples?: Array<{
    name: string;
    description?: string;
    input: Record<string, any>;
    expectedOutput?: string;
  }>;
}

interface MCPSpec {
  name: string;
  version: string;
  description: string;
  tools: MCPTool[];
}

/**
 * Generate MCP specification from tool definitions
 *
 * Generates a complete Model Context Protocol (MCP) specification
 * documenting all available tools from FIGMA_TOOLS registry.
 *
 * @returns Complete MCP specification object
 * @throws {SpecGenerationError} If spec generation fails
 *
 * @example
 * const mcpSpec = generateMCPSpec();
 * console.log(mcpSpec.tools.length); // 9
 */
export function generateMCPSpec(): MCPSpec {
  try {
    const tools: MCPTool[] = FIGMA_TOOLS.map((t) => ({
      name: t.name.toLowerCase(),
      description: t.description,
      inputSchema: {
        type: t.schema.type,
        properties: t.schema.properties,
        required: t.schema.required,
      },
      examples: [{ name: `Example for ${t.name}`, input: t.example }],
    }));

    return {
      name: 'figma-mcp',
      version: '1.0.0',
      description: 'MCP tools for interacting with Figma via Claude, Cursor, and other agents.',
      tools,
    };
  } catch (error) {
    throw new SpecGenerationError(
      `Failed to generate MCP spec: ${error instanceof Error ? error.message : String(error)}`,
      { originalError: error }
    );
  }
}

/**
 * Generate Platform MCP specification (22 tools for Claude.ai Connectors)
 */
export function generatePlatformMCPSpec(): MCPSpec {
  try {
    const tools: MCPTool[] = PLATFORM_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: {
        type: 'object',
        properties: t.properties,
        required: t.required,
      },
      // Extended fields for UI rendering — not part of MCP spec but included in our doc endpoint
      'x-cost': t.cost,
      'x-category': t.category,
      'x-auth': t.auth,
    }));

    return {
      name: 'visant-platform',
      version: '1.0.0',
      description: 'Visant Labs platform MCP server. Connect via POST /api/mcp with Bearer visant_sk_xxx.',
      tools,
    };
  } catch (error) {
    throw new SpecGenerationError(
      `Failed to generate platform MCP spec: ${error instanceof Error ? error.message : String(error)}`,
      { originalError: error }
    );
  }
}

/**
 * Count available MCP tools
 *
 * @param spec - MCP specification object
 * @returns Number of available tools
 * @throws {ValidationError} If spec is invalid
 *
 * @example
 * const spec = generateMCPSpec();
 * const count = countMCPTools(spec); // 9
 */
export function countMCPTools(spec: MCPSpec): number {
  if (!spec || typeof spec !== 'object') {
    throw new ValidationError('spec must be a valid MCP specification object', { spec });
  }

  if (!Array.isArray(spec.tools)) {
    throw new ValidationError('spec.tools must be an array', { tools: spec.tools });
  }

  return spec.tools.length;
}

/**
 * Get MCP tool by name
 *
 * @param spec - MCP specification object
 * @param toolName - Name of the tool to retrieve
 * @returns Tool definition or undefined if not found
 * @throws {ValidationError} If parameters are invalid
 *
 * @example
 * const spec = generateMCPSpec();
 * const tool = getMCPTool(spec, 'create_frame');
 * console.log(tool.description); // "Create a new frame in Figma"
 */
export function getMCPTool(spec: MCPSpec, toolName: string): MCPTool | undefined {
  if (!spec || typeof spec !== 'object') {
    throw new ValidationError('spec must be a valid MCP specification object', { spec });
  }

  if (!toolName || typeof toolName !== 'string') {
    throw new ValidationError('toolName must be a non-empty string', { toolName });
  }

  if (!Array.isArray(spec.tools)) {
    throw new ValidationError('spec.tools must be an array', { tools: spec.tools });
  }

  return spec.tools.find((t) => t.name === toolName);
}

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

// Platform MCP tools (matches platform-mcp.ts registrations)
const PLATFORM_TOOLS = [
  { name: 'account-usage', description: 'Get credit usage, remaining balance, plan limits, and billing cycle info for the authenticated account.', required: [], properties: {} },
  { name: 'account-profile', description: 'Get the authenticated user profile including name, email, avatar, and subscription plan.', required: [], properties: {} },
  { name: 'mockup-list', description: 'List mockups created by the authenticated user. Supports pagination.', required: [], properties: { limit: { type: 'integer', default: 20 }, skip: { type: 'integer', default: 0 } } },
  { name: 'mockup-get', description: 'Get a single mockup by its ID, including image URL, prompt, and metadata.', required: ['id'], properties: { id: { type: 'string' } } },
  { name: 'mockup-presets', description: 'Browse available mockup presets filtered by design type.', required: ['type'], properties: { type: { type: 'string', enum: ['business-card','social-media','packaging','apparel','stationery','device','signage','print','other'] } } },
  { name: 'mockup-generate', description: 'Generate a new mockup image using AI. Costs credits. Returns the generated image URL.', required: ['prompt'], properties: { prompt: { type: 'string' }, designType: { type: 'string' }, aspectRatio: { type: 'string' }, brandGuidelineId: { type: 'string' } } },
  { name: 'branding-list', description: 'List branding projects owned by the authenticated user.', required: [], properties: {} },
  { name: 'branding-get', description: 'Get a branding project by ID, including logo, colors, typography, and brand assets.', required: ['id'], properties: { id: { type: 'string' } } },
  { name: 'branding-generate', description: 'Generate a complete brand identity (logo, colors, typography) from a text prompt. Costs credits.', required: ['prompt'], properties: { prompt: { type: 'string' } } },
  { name: 'canvas-list', description: 'List canvas (whiteboard) projects owned by the authenticated user.', required: [], properties: {} },
  { name: 'canvas-get', description: 'Get a canvas project by ID, including elements, collaborators, and metadata.', required: ['id'], properties: { id: { type: 'string' } } },
  { name: 'canvas-create', description: 'Create a new empty canvas (whiteboard) project.', required: ['name'], properties: { name: { type: 'string' } } },
  { name: 'budget-list', description: 'List budget documents created by the authenticated user.', required: [], properties: {} },
  { name: 'budget-get', description: 'Get a budget document by ID, including line items, totals, and client info.', required: ['id'], properties: { id: { type: 'string' } } },
  { name: 'budget-create', description: 'Create a new budget document with client and project details.', required: ['clientName', 'projectDescription'], properties: { clientName: { type: 'string' }, projectDescription: { type: 'string' }, brandName: { type: 'string' } } },
  { name: 'ai-improve-prompt', description: 'Enhance and refine a text prompt using AI to produce better generation results. Free.', required: ['prompt'], properties: { prompt: { type: 'string' } } },
  { name: 'ai-describe-image', description: 'Analyze an image and return a detailed text description. Free.', required: [], properties: { imageUrl: { type: 'string', format: 'uri' }, base64: { type: 'string' } } },
  { name: 'brand-guidelines-list', description: 'List all brand guidelines (identity vaults) owned by the authenticated user.', required: [], properties: {} },
  { name: 'brand-guidelines-get', description: 'Get a detailed brand guideline by ID, including colors, typography, logos, and strategy context.', required: ['id'], properties: { id: { type: 'string' }, format: { type: 'string', enum: ['structured', 'prompt'], default: 'structured' } } },
  { name: 'brand-guidelines-public', description: 'Get a public brand guideline by its slug. No authentication required.', required: ['slug'], properties: { slug: { type: 'string' } } },
  { name: 'community-presets', description: 'Browse community-shared mockup presets. No auth required.', required: [], properties: { limit: { type: 'integer', default: 20 } } },
  { name: 'community-profiles', description: 'Browse public community creator profiles. No auth required.', required: [], properties: { limit: { type: 'integer', default: 20 } } },
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

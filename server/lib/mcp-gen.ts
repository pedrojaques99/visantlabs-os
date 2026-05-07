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
type ToolCategory = 'account' | 'mockups' | 'ai' | 'branding' | 'brand-guidelines' | 'canvas' | 'budget' | 'community' | 'auth' | 'moodboard';

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
// Synced from server/mcp/platform-mcp.ts (runtime is authoritative for descriptions).
const PLATFORM_TOOLS: PlatformToolDef[] = [
  // ---- Auth (public) ----
  { name: 'auth-register', description: 'Create a new Visant Labs account. Returns a JWT token and user info. After registering, use api-key-create (passing the JWT) to generate a visant_sk_xxx API key for MCP/API access.', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8 }, name: { type: 'string' } }, cost: 'free', category: 'auth', auth: false },
  { name: 'auth-login', description: 'Sign in to an existing Visant Labs account. Returns a JWT token. Use api-key-create (passing this token) to generate a visant_sk_xxx API key for persistent MCP/API access.', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } }, cost: 'free', category: 'auth', auth: false },
  { name: 'api-key-create', description: 'Create a new Visant API key (visant_sk_xxx). Requires either an active API key (Bearer token) OR a JWT from auth-login/auth-register. The raw key is shown only once — save it immediately.', required: ['name'], properties: { name: { type: 'string', maxLength: 100 }, scopes: { type: 'array', items: { type: 'string', enum: ['read', 'write', 'generate'] } }, jwt: { type: 'string' } }, cost: 'free', category: 'auth', auth: false },
  { name: 'api-key-list', description: 'List all API keys for the authenticated user. Shows prefix, name, scopes, last used, and expiry — but not the raw key value.', required: [], properties: {}, cost: 'free', category: 'auth', auth: true },

  // ---- Moodboard ----
  { name: 'moodboard-detect-grid', description: 'Detect individual image bounding boxes in a moodboard or grid image. Returns cell coordinates so each section can be cropped and extracted individually.', required: ['imageBase64'], properties: { imageBase64: { type: 'string' } }, cost: 'free', category: 'moodboard', auth: true },
  { name: 'moodboard-upscale', description: 'Upscale an image to 1K, 2K, or 4K resolution using Gemini image enhancement. Use after extracting a cell from a moodboard to get a high-resolution standalone version.', required: ['imageBase64'], properties: { imageBase64: { type: 'string' }, size: { type: 'string', enum: ['1K', '2K', '4K'], default: '4K' } }, cost: 'credits', category: 'moodboard', auth: true },
  { name: 'moodboard-suggest', description: 'Analyze images from a moodboard and suggest Remotion animation presets and Veo video generation prompts for each cell. Useful for turning static moodboard cells into motion content.', required: ['images'], properties: { images: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, base64: { type: 'string' } } } } }, cost: 'credits', category: 'moodboard', auth: true },

  // ---- Account ----
  { name: 'account-usage', description: 'Get credit usage, remaining balance, plan limits, and billing cycle info for the authenticated account.', required: [], properties: {}, cost: 'free', category: 'account', auth: true },
  { name: 'account-profile', description: 'Get the authenticated user profile including name, email, avatar, and subscription plan.', required: [], properties: {}, cost: 'free', category: 'account', auth: true },

  // ---- Mockups ----
  { name: 'mockup-list', description: 'List mockups created by the authenticated user. Supports pagination.', required: [], properties: { limit: { type: 'integer', default: 20 }, skip: { type: 'integer', default: 0 } }, cost: 'free', category: 'mockups', auth: true },
  { name: 'mockup-get', description: 'Get a single mockup by its ID, including image URL, prompt, and metadata.', required: ['id'], properties: { id: { type: 'string' } }, cost: 'free', category: 'mockups', auth: true },
  { name: 'mockup-presets', description: 'Browse available mockup presets filtered by design type (e.g. business-card, social-media, packaging).', required: ['type'], properties: { type: { type: 'string', enum: ['business-card','social-media','packaging','apparel','stationery','device','signage','print','other'] } }, cost: 'free', category: 'mockups', auth: true },
  { name: 'mockup-generate', description: 'Generate a mockup image using AI. Brand context (colors, typography, logos, voice) is auto-injected when brandGuidelineId is provided — never describe the logo in the prompt. Costs credits based on model and resolution.', required: ['prompt'], properties: { prompt: { type: 'string' }, brandGuidelineId: { type: 'string' }, model: { type: 'string', enum: ['gpt-image-2', 'gpt-image-1', 'gemini-3.1-flash-image-preview', 'seedream-3-0'], default: 'gpt-image-2' }, provider: { type: 'string', enum: ['openai', 'gemini', 'seedream'] }, aspectRatio: { type: 'string', enum: ['1:1', '9:16', '16:9', '4:5'] }, resolution: { type: 'string', enum: ['1K', '2K', '4K'] } }, cost: 'credits', category: 'mockups', auth: true },
  { name: 'mockup-update', description: "Update a mockup's metadata (prompt, tags, isLiked, designType, aspectRatio). Does not regenerate the image.", required: ['id'], properties: { id: { type: 'string' }, prompt: { type: 'string' }, designType: { type: 'string' }, aspectRatio: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } }, brandingTags: { type: 'array', items: { type: 'string' } }, isLiked: { type: 'boolean' } }, cost: 'free', category: 'mockups', auth: true },
  { name: 'mockup-delete', description: 'Permanently delete a mockup by ID.', required: ['id'], properties: { id: { type: 'string' } }, cost: 'free', category: 'mockups', auth: true },

  // ---- AI ----
  { name: 'ai-generate-image', description: 'Generate an AI image from a text prompt. Simple and direct — no brand injection, no layout plans, no project saving. Just prompt → image. Ideal for concept exploration, moodboards, visual references, and creative brainstorming. Costs credits based on model and resolution.', required: ['prompt'], properties: { prompt: { type: 'string' }, model: { type: 'string', enum: ['gpt-image-2', 'gpt-image-1', 'gemini-3.1-flash-image-preview', 'seedream-3-0'], default: 'gpt-image-2' }, aspectRatio: { type: 'string', enum: ['1:1', '9:16', '16:9', '4:5'], default: '1:1' }, resolution: { type: 'string', enum: ['1K', '2K', '4K'], default: '1K' }, referenceImages: { type: 'array', items: { type: 'string' } }, seed: { type: 'integer' } }, cost: 'credits', category: 'ai', auth: true },
  { name: 'ai-improve-prompt', description: 'Enhance and refine a text prompt using AI to produce better generation results. Free, no credit cost.', required: ['prompt'], properties: { prompt: { type: 'string' } }, cost: 'free', category: 'ai', auth: true },
  { name: 'ai-describe-image', description: 'Analyze an image and return a detailed text description. Provide either a URL or base64-encoded data. Free, no credit cost.', required: [], properties: { imageUrl: { type: 'string', format: 'uri' }, base64: { type: 'string' } }, cost: 'free', category: 'ai', auth: true },
  { name: 'image-extract-url', description: 'Extract high-resolution images from any public URL (Behance, Pinterest, Dribbble, portfolios, blogs). Returns a list of image URLs with metadata. Supports lazy-loaded images, srcset, and background images.', required: ['url'], properties: { url: { type: 'string', format: 'uri' }, limit: { type: 'integer', default: 80 } }, cost: 'free', category: 'ai', auth: true },

  // ---- Branding ----
  { name: 'branding-list', description: 'List branding projects owned by the authenticated user.', required: [], properties: {}, cost: 'free', category: 'branding', auth: true },
  { name: 'branding-get', description: 'Get a branding project by ID, including logo, colors, typography, and brand assets.', required: ['id'], properties: { id: { type: 'string' } }, cost: 'free', category: 'branding', auth: true },
  { name: 'branding-generate', description: 'Generate brand identity elements from a text prompt. Use step="full" for complete generation or target a specific step for iterative refinement. Costs credits.', required: ['prompt'], properties: { prompt: { type: 'string' }, step: { type: 'string' } }, cost: 'credits', category: 'branding', auth: true },
  { name: 'branding-save', description: 'Create or update a branding project. If projectId is provided and the project exists, it updates it; otherwise creates a new one. Returns the saved project.', required: ['prompt', 'data'], properties: { prompt: { type: 'string' }, data: { type: 'object' }, projectId: { type: 'string' }, name: { type: 'string' } }, cost: 'free', category: 'branding', auth: true },
  { name: 'branding-delete', description: 'Permanently delete a branding project by ID.', required: ['id'], properties: { id: { type: 'string' } }, cost: 'free', category: 'branding', auth: true },

  // ---- Brand Guidelines ----
  { name: 'brand-guidelines-list', description: 'List all brand guidelines (identity vaults) owned by the authenticated user.', required: [], properties: {}, cost: 'free', category: 'brand-guidelines', auth: true },
  { name: 'brand-guidelines-get', description: 'Get a detailed brand guideline by ID, including colors, typography, logos, and strategy context.', required: ['id'], properties: { id: { type: 'string' }, format: { type: 'string', enum: ['structured', 'prompt'], default: 'structured' } }, cost: 'free', category: 'brand-guidelines', auth: true },
  { name: 'brand-guidelines-create', description: 'Create a new brand guideline. Provide at minimum an identity.name. All other sections (colors, typography, guidelines, strategy, tokens) are optional and can be added now or via brand-guidelines-update later.', required: ['identity'], properties: { identity: { type: 'object' }, colors: { type: 'array' }, typography: { type: 'array' }, guidelines: { type: 'object' }, strategy: { type: 'object' } }, cost: 'free', category: 'brand-guidelines', auth: true },
  { name: 'brand-guidelines-update', description: 'Patch one or more sections of an existing brand guideline. Only the fields you provide are updated — others remain unchanged. Use this to iteratively build or refine a guideline section by section.', required: ['id'], properties: { id: { type: 'string' } }, cost: 'free', category: 'brand-guidelines', auth: true },
  { name: 'brand-guidelines-delete', description: 'Permanently delete a brand guideline. This cannot be undone. Confirm with the user before calling.', required: ['id'], properties: { id: { type: 'string' }, confirm: { type: 'boolean' } }, cost: 'free', category: 'brand-guidelines', auth: true },
  { name: 'brand-guidelines-upload-logo', description: 'Upload a logo to a brand guideline. Accepts base64-encoded image data or a public URL. Returns the uploaded logo with its URL and ID.', required: ['id'], properties: { id: { type: 'string' }, data: { type: 'string' }, url: { type: 'string' }, variant: { type: 'string', enum: ['primary', 'dark', 'light', 'icon', 'accent', 'custom'], default: 'primary' }, label: { type: 'string' } }, cost: 'free', category: 'brand-guidelines', auth: true },
  { name: 'brand-guidelines-delete-logo', description: 'Delete a logo from a brand guideline by its logo ID.', required: ['id', 'logoId'], properties: { id: { type: 'string' }, logoId: { type: 'string' } }, cost: 'free', category: 'brand-guidelines', auth: true },
  { name: 'brand-guidelines-upload-media', description: 'Upload a media asset (image or PDF) to a brand guideline media kit. Accepts base64-encoded data or a public URL.', required: ['id'], properties: { id: { type: 'string' }, data: { type: 'string' }, url: { type: 'string' }, type: { type: 'string', enum: ['image', 'pdf'], default: 'image' }, label: { type: 'string' } }, cost: 'free', category: 'brand-guidelines', auth: true },
  { name: 'brand-guidelines-delete-media', description: 'Delete a media asset from a brand guideline by its media ID.', required: ['id', 'mediaId'], properties: { id: { type: 'string' }, mediaId: { type: 'string' } }, cost: 'free', category: 'brand-guidelines', auth: true },
  { name: 'brand-guidelines-duplicate', description: 'Duplicate a brand guideline, creating an independent copy with "(copy)" appended to the name. Useful for creating variants or testing changes without affecting the original.', required: ['id'], properties: { id: { type: 'string' } }, cost: 'free', category: 'brand-guidelines', auth: true },
  { name: 'brand-guidelines-restore-version', description: 'Restore a brand guideline to a previous version. The current state is preserved as a version before restoring.', required: ['id', 'version'], properties: { id: { type: 'string' }, version: { type: 'integer' } }, cost: 'free', category: 'brand-guidelines', auth: true },
  { name: 'brand-guidelines-compliance-check', description: 'Run an AI compliance check on a brand guideline — validates color contrast, typography consistency, voice coherence, and completeness. Returns a scored report with actionable suggestions.', required: ['id'], properties: { id: { type: 'string' } }, cost: 'free', category: 'brand-guidelines', auth: true },
  { name: 'brand-guidelines-ingest', description: 'Extract brand data (colors, typography, voice, strategy) from a URL or raw text and merge it into an existing brand guideline. Useful for bootstrapping a guideline from a website, landing page, or brand document. Returns what was extracted so the user can review before saving.', required: ['id', 'source'], properties: { id: { type: 'string' }, source: { type: 'string', enum: ['url', 'text'] }, url: { type: 'string' }, text: { type: 'string' } }, cost: 'credits', category: 'brand-guidelines', auth: true },
  { name: 'brand-guidelines-share', description: 'Generate a public read-only link for a brand guideline. Once shared, anyone with the link can view colors, typography, logos, and brand strategy — without authentication. Returns the public URL.', required: ['id'], properties: { id: { type: 'string' }, disable: { type: 'boolean' } }, cost: 'free', category: 'brand-guidelines', auth: true },
  { name: 'brand-guidelines-versions', description: 'List the version history of a brand guideline — shows what changed and when. Useful for auditing edits or restoring a previous state. Returns versions in reverse chronological order.', required: ['id'], properties: { id: { type: 'string' }, limit: { type: 'integer', default: 10 } }, cost: 'free', category: 'brand-guidelines', auth: true },
  { name: 'brand-guidelines-public', description: 'Get a public brand guideline by its slug. No authentication required.', required: ['slug'], properties: { slug: { type: 'string' } }, cost: 'free', category: 'brand-guidelines', auth: false },

  // ---- Canvas ----
  { name: 'canvas-list', description: 'List canvas (whiteboard) projects owned by the authenticated user.', required: [], properties: {}, cost: 'free', category: 'canvas', auth: true },
  { name: 'canvas-get', description: 'Get a canvas project by ID, including elements, collaborators, and metadata.', required: ['id'], properties: { id: { type: 'string' } }, cost: 'free', category: 'canvas', auth: true },
  { name: 'canvas-create', description: 'Create a new empty canvas (whiteboard) project.', required: ['name'], properties: { name: { type: 'string' } }, cost: 'free', category: 'canvas', auth: true },
  { name: 'canvas-update', description: 'Update a canvas project by ID. Provide any combination of name, nodes, edges, drawings, or linkedGuidelineId. Only provided fields are updated.', required: ['id'], properties: { id: { type: 'string' }, name: { type: 'string' }, nodes: { type: 'array' }, edges: { type: 'array' }, drawings: { type: 'array' }, linkedGuidelineId: { type: 'string' } }, cost: 'free', category: 'canvas', auth: true },
  { name: 'canvas-delete', description: 'Permanently delete a canvas project by ID.', required: ['id'], properties: { id: { type: 'string' } }, cost: 'free', category: 'canvas', auth: true },
  { name: 'canvas-share', description: 'Share a canvas project with other users. Generates a shareId and sets collaborative mode. Accepts user emails or user IDs for canEdit/canView lists.', required: ['id'], properties: { id: { type: 'string' }, canEdit: { type: 'array', items: { type: 'string' } }, canView: { type: 'array', items: { type: 'string' } } }, cost: 'free', category: 'canvas', auth: true },
  { name: 'canvas-resolve-variables', description: 'Given a prompt string and a variables map (key→value pairs), resolve all {{placeholder}} tokens and return the final prompt. Useful for previewing what a VariablesNode or DataNode will produce before generation.', required: ['prompt', 'variables'], properties: { prompt: { type: 'string' }, variables: { type: 'object' } }, cost: 'free', category: 'canvas', auth: false },
  { name: 'canvas-parse-csv', description: 'Parse a CSV string and return the rows as an array of objects. Use this to preview what a DataNode will produce from a CSV file before uploading it to the canvas.', required: ['csv'], properties: { csv: { type: 'string' }, preview_rows: { type: 'integer', default: 5 } }, cost: 'free', category: 'canvas', auth: false },
  { name: 'canvas-list-projects', description: 'List canvas projects for the authenticated user with node type summary.', required: [], properties: { limit: { type: 'integer', default: 10 } }, cost: 'free', category: 'canvas', auth: true },

  // ---- Budget ----
  { name: 'budget-list', description: 'List budget documents created by the authenticated user.', required: [], properties: {}, cost: 'free', category: 'budget', auth: true },
  { name: 'budget-get', description: 'Get a budget document by ID, including line items, totals, and client info.', required: ['id'], properties: { id: { type: 'string' } }, cost: 'free', category: 'budget', auth: true },
  { name: 'budget-create', description: 'Create a new budget document with client and project details. Returns the created budget.', required: ['clientName', 'projectDescription'], properties: { clientName: { type: 'string' }, projectDescription: { type: 'string' }, brandName: { type: 'string' } }, cost: 'free', category: 'budget', auth: true },
  { name: 'budget-update', description: 'Update an existing budget project by ID. Accepts any subset of budget fields — only provided fields are modified.', required: ['id'], properties: { id: { type: 'string' }, name: { type: 'string' }, clientName: { type: 'string' }, projectDescription: { type: 'string' }, data: { type: 'object' } }, cost: 'free', category: 'budget', auth: true },
  { name: 'budget-delete', description: 'Permanently delete a budget project by ID.', required: ['id'], properties: { id: { type: 'string' } }, cost: 'free', category: 'budget', auth: true },
  { name: 'budget-duplicate', description: 'Duplicate an existing budget project. Returns the new project.', required: ['id'], properties: { id: { type: 'string' } }, cost: 'free', category: 'budget', auth: true },

  // ---- Creative ----
  { name: 'creative-projects-list', description: 'List creative studio projects owned by the authenticated user.', required: [], properties: { limit: { type: 'integer', default: 20 }, skip: { type: 'integer', default: 0 } }, cost: 'free', category: 'canvas', auth: true },
  { name: 'creative-projects-get', description: 'Get a creative project by ID, including all layers, background, and generated assets.', required: ['id'], properties: { id: { type: 'string' } }, cost: 'free', category: 'canvas', auth: true },
  { name: 'creative-generate', description: 'Generate a structured marketing creative layout (background, text layers, logo, shapes) from a prompt. Optionally inject brand guideline context. Returns a layered creative plan ready for the Creative Studio. Costs credits.', required: ['prompt'], properties: { prompt: { type: 'string' }, brandGuidelineId: { type: 'string' }, format: { type: 'string', enum: ['1:1', '16:9', '9:16', '4:5'], default: '1:1' } }, cost: 'credits', category: 'canvas', auth: true },
  { name: 'creative-render', description: 'Render a creative plan (from creative-generate) into a PNG image server-side. Pass the plan JSON and the pre-generated background image URL. Returns imageUrl (R2) or imageBase64. Use this to close the generate→image loop without a browser: generate plan, render, inspect image with vision, adjust, re-render.', required: ['plan'], properties: { plan: { type: 'object' }, backgroundImageUrl: { type: 'string' }, format: { type: 'string', enum: ['1:1', '16:9', '9:16', '4:5'], default: '1:1' }, accentColor: { type: 'string' } }, cost: 'free', category: 'canvas', auth: true },
  { name: 'creative-full', description: 'Full creative pipeline in one call. Generates layout plan → background image → renders to PNG → saves project. Returns imageUrl, projectId, plan, and per-step credits. Use this instead of chaining creative-generate + mockup-generate + creative-render manually.', required: ['prompt'], properties: { prompt: { type: 'string' }, brandGuidelineId: { type: 'string' }, format: { type: 'string', enum: ['1:1', '16:9', '9:16', '4:5'], default: '1:1' }, model: { type: 'string', default: 'gpt-image-2' }, resolution: { type: 'string', enum: ['1K', '2K', '4K'], default: '1K' }, autoSave: { type: 'boolean', default: true } }, cost: 'credits', category: 'canvas', auth: true },
  { name: 'creative-projects-create', description: 'Save a creative project to the database. Requires prompt, format, and layers (from creative-generate). Optionally attach a brand guideline and background/thumbnail URLs.', required: ['prompt', 'format', 'layers'], properties: { prompt: { type: 'string' }, format: { type: 'string' }, layers: { type: 'array' }, name: { type: 'string' }, brandId: { type: 'string' }, backgroundUrl: { type: 'string' }, overlay: { type: 'object' }, thumbnailUrl: { type: 'string' } }, cost: 'free', category: 'canvas', auth: true },
  { name: 'creative-projects-update', description: 'Update an existing creative project (partial update). All fields are optional — only provided fields are updated.', required: ['id'], properties: { id: { type: 'string' }, name: { type: 'string' }, prompt: { type: 'string' }, format: { type: 'string' }, layers: { type: 'array' }, brandId: { type: 'string' }, backgroundUrl: { type: 'string' }, overlay: { type: 'object' }, thumbnailUrl: { type: 'string' } }, cost: 'free', category: 'canvas', auth: true },
  { name: 'creative-projects-delete', description: 'Permanently delete a creative project by ID.', required: ['id'], properties: { id: { type: 'string' } }, cost: 'free', category: 'canvas', auth: true },

  // ---- Document ----
  { name: 'document-extract', description: 'Extract content from a PDF using a 2-phase pipeline: algorithmic (exact colors, fonts, embedded images) then Gemini semantic analysis. Returns markdownText plus brand tokens.', required: ['output'], properties: { pdf_base64: { type: 'string' }, pdf_filename: { type: 'string' }, pdf_path: { type: 'string' }, output: { type: 'string', enum: ['disk', 'inline'] }, include_brand_tokens: { type: 'boolean', default: true } }, cost: 'credits', category: 'ai', auth: true },

  // ---- Community (no auth) ----
  { name: 'community-presets', description: 'Browse community-shared mockup presets. Useful for discovering templates and inspiration. No auth required.', required: [], properties: { limit: { type: 'integer', default: 20 } }, cost: 'free', category: 'community', auth: false },
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
 * Generate Platform MCP specification (66 tools for Claude.ai Connectors)
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

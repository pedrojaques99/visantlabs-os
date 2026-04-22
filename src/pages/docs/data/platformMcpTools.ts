/**
 * Platform MCP Tools Reference
 * Source of truth: server/mcp/platform-mcp.ts (28 tools)
 *
 * Used by: DocsPage agents tab, markdown generators, llms.txt
 */

export interface PlatformMcpTool {
  name: string;
  description: string;
  cost: 'Free' | '1 credit' | 'Credits';
  auth: boolean;
  params?: string;
  category: 'account' | 'mockups' | 'branding' | 'canvas' | 'creative' | 'ai' | 'community' | 'budget';
}

export const PLATFORM_MCP_TOOLS: PlatformMcpTool[] = [
  // Account
  { name: 'account-usage', description: 'Credits, plan, reset date, can_generate flag', cost: 'Free', auth: true, category: 'account' },
  { name: 'account-profile', description: 'Name, email, avatar, subscription status', cost: 'Free', auth: true, category: 'account' },

  // Mockups
  { name: 'mockup-list', description: 'List generated mockups (paginated)', cost: 'Free', auth: true, params: 'limit, skip', category: 'mockups' },
  { name: 'mockup-get', description: 'Get mockup by ID', cost: 'Free', auth: true, params: 'id', category: 'mockups' },
  { name: 'mockup-presets', description: 'Browse preset categories', cost: 'Free', auth: true, params: 'type', category: 'mockups' },
  { name: 'mockup-generate', description: 'Generate mockup from prompt + optional brand context', cost: '1 credit', auth: true, params: 'prompt*, designType, aspectRatio, brandGuidelineId', category: 'mockups' },

  // Brand Guidelines
  { name: 'brand-guidelines-list', description: 'List brand guidelines', cost: 'Free', auth: true, category: 'branding' },
  { name: 'brand-guidelines-get', description: 'Get guideline (structured or LLM-ready prompt format)', cost: 'Free', auth: true, params: 'id, format', category: 'branding' },
  { name: 'brand-guidelines-public', description: 'Get public guideline by slug — no auth required', cost: 'Free', auth: false, params: 'slug', category: 'branding' },

  // Branding Projects
  { name: 'branding-list', description: 'List branding projects', cost: 'Free', auth: true, category: 'branding' },
  { name: 'branding-get', description: 'Get branding project with logo/colors/typography', cost: 'Free', auth: true, params: 'id', category: 'branding' },
  { name: 'branding-generate', description: 'Generate full brand identity from prompt', cost: 'Credits', auth: true, params: 'prompt*, brandGuidelineId', category: 'branding' },

  // Creative Studio
  { name: 'creative-projects-list', description: 'List Creative Studio projects', cost: 'Free', auth: true, params: 'limit, skip', category: 'creative' },
  { name: 'creative-projects-get', description: 'Get creative project with all layers', cost: 'Free', auth: true, params: 'id', category: 'creative' },
  { name: 'creative-generate', description: 'Generate layered creative layout with brand context', cost: '1 credit', auth: true, params: 'prompt*, brandGuidelineId, format', category: 'creative' },

  // Canvas
  { name: 'canvas-list', description: 'List canvas projects', cost: 'Free', auth: true, category: 'canvas' },
  { name: 'canvas-get', description: 'Get canvas with nodes/edges', cost: 'Free', auth: true, params: 'id', category: 'canvas' },
  { name: 'canvas-create', description: 'Create new canvas project', cost: 'Free', auth: true, params: 'name', category: 'canvas' },
  { name: 'canvas-resolve-variables', description: 'Resolve {{placeholder}} tokens in prompt', cost: 'Free', auth: true, params: 'prompt, variables', category: 'canvas' },
  { name: 'canvas-parse-csv', description: 'Parse CSV for data-driven generation', cost: 'Free', auth: true, params: 'csv', category: 'canvas' },
  { name: 'canvas-list-projects', description: 'Extended canvas list with metadata', cost: 'Free', auth: true, category: 'canvas' },

  // AI Tools
  { name: 'ai-improve-prompt', description: 'Enhance a text prompt with Gemini — no credit cost', cost: 'Free', auth: true, params: 'prompt*', category: 'ai' },
  { name: 'ai-describe-image', description: 'Analyze and describe an image — no credit cost', cost: 'Free', auth: true, params: 'imageUrl or base64', category: 'ai' },

  // Budget
  { name: 'budget-list', description: 'List budget proposals', cost: 'Free', auth: true, category: 'budget' },
  { name: 'budget-get', description: 'Get budget with line items and totals', cost: 'Free', auth: true, params: 'id', category: 'budget' },
  { name: 'budget-create', description: 'Create budget proposal from client info', cost: 'Free', auth: true, params: 'clientName*, projectDescription*, brandName', category: 'budget' },

  // Community
  { name: 'community-presets', description: 'Browse shared presets — no auth required', cost: 'Free', auth: false, params: 'limit, skip', category: 'community' },
  { name: 'community-profiles', description: 'Browse community creator profiles — no auth required', cost: 'Free', auth: false, params: 'limit, skip', category: 'community' },
] as const;

// Helper to generate markdown table
export function generateMcpToolsMarkdown(tools: PlatformMcpTool[] = PLATFORM_MCP_TOOLS): string {
  const lines = ['| Tool | Description | Cost |', '|------|-------------|------|'];
  tools.forEach(t => {
    lines.push(`| \`${t.name}\` | ${t.description} | ${t.cost} |`);
  });
  return lines.join('\n');
}

// Filter tools by category
export function getToolsByCategory(category: PlatformMcpTool['category']): PlatformMcpTool[] {
  return PLATFORM_MCP_TOOLS.filter(t => t.category === category);
}

// Get free vs paid tools
export function getFreeTools(): PlatformMcpTool[] {
  return PLATFORM_MCP_TOOLS.filter(t => t.cost === 'Free');
}

export function getPaidTools(): PlatformMcpTool[] {
  return PLATFORM_MCP_TOOLS.filter(t => t.cost !== 'Free');
}

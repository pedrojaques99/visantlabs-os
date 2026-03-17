/**
 * Platform MCP Tools Reference
 * Source of truth: server/mcp/platform-mcp.ts (22 tools)
 *
 * Used by: DocsPage agents tab, markdown generators, llms.txt
 */

export interface PlatformMcpTool {
  name: string;
  description: string;
  cost: 'Free' | '1 credit' | 'Credits';
  category: 'account' | 'mockups' | 'branding' | 'canvas' | 'ai' | 'community' | 'budget';
}

export const PLATFORM_MCP_TOOLS: PlatformMcpTool[] = [
  // Account
  { name: 'account-usage', description: 'Get credit usage, limits, plan info', cost: 'Free', category: 'account' },
  { name: 'account-profile', description: 'Get user profile and subscription', cost: 'Free', category: 'account' },

  // Mockups
  { name: 'mockup-list', description: 'List your generated mockups', cost: 'Free', category: 'mockups' },
  { name: 'mockup-get', description: 'Get a specific mockup by ID', cost: 'Free', category: 'mockups' },
  { name: 'mockup-presets', description: 'Browse preset categories', cost: 'Free', category: 'mockups' },
  { name: 'mockup-generate', description: 'Generate a mockup from prompt', cost: '1 credit', category: 'mockups' },

  // Brand Guidelines
  { name: 'brand-guidelines-list', description: 'List brand guidelines', cost: 'Free', category: 'branding' },
  { name: 'brand-guidelines-get', description: 'Get guideline with colors/fonts/strategy', cost: 'Free', category: 'branding' },
  { name: 'brand-guidelines-public', description: 'Get public guideline by slug (no auth)', cost: 'Free', category: 'branding' },

  // Branding Projects
  { name: 'branding-list', description: 'List branding projects', cost: 'Free', category: 'branding' },
  { name: 'branding-get', description: 'Get branding project details', cost: 'Free', category: 'branding' },
  { name: 'branding-generate', description: 'Generate brand identity', cost: 'Credits', category: 'branding' },

  // Canvas
  { name: 'canvas-list', description: 'List canvas projects', cost: 'Free', category: 'canvas' },
  { name: 'canvas-get', description: 'Get canvas with nodes/edges', cost: 'Free', category: 'canvas' },
  { name: 'canvas-create', description: 'Create new canvas project', cost: 'Free', category: 'canvas' },

  // AI Tools
  { name: 'ai-improve-prompt', description: 'Enhance a text prompt', cost: '1 credit', category: 'ai' },
  { name: 'ai-describe-image', description: 'Analyze an image', cost: '1 credit', category: 'ai' },

  // Budget
  { name: 'budget-list', description: 'List budget proposals', cost: 'Free', category: 'budget' },
  { name: 'budget-get', description: 'Get budget details', cost: 'Free', category: 'budget' },
  { name: 'budget-create', description: 'Create budget proposal', cost: 'Free', category: 'budget' },

  // Community
  { name: 'community-presets', description: 'Browse shared presets', cost: 'Free', category: 'community' },
  { name: 'community-profiles', description: 'Browse community profiles', cost: 'Free', category: 'community' },
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

/**
 * DocsPage Navigation Configuration
 * Defines sidebar navigation structure and tab routing
 */

import { Home, Server, Terminal, Puzzle, Layers, Workflow, Diamond, Bot, Coins } from 'lucide-react';
import type { NavigationItem } from '@/components/ui/NavigationSidebar';

export const DOCS_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: Home,
  },
  {
    id: 'pricing',
    label: 'Pricing & Credits',
    icon: Coins,
    sections: [
      { id: 'pr-breakdown', label: 'Cost Breakdown' },
      { id: 'pr-google', label: 'Google API Pricing' },
      { id: 'pr-credits', label: 'Credit System' },
      { id: 'pr-packages', label: 'Credit Packages' },
      { id: 'pr-storage', label: 'Storage Plans' },
      { id: 'pr-byok', label: 'BYOK Mode' },
      { id: 'pr-transparency', label: 'Build in Public' },
    ],
  },
  {
    id: 'api',
    label: 'REST API',
    icon: Server,
    sections: [
      { id: 'api-auth', label: 'Authentication' },
      { id: 'api-mockups', label: 'Mockups' },
      { id: 'api-plugin', label: 'Plugin' },
    ],
  },
  {
    id: 'mcp',
    label: 'MCP Tools',
    icon: Terminal,
    sections: [
      { id: 'mcp-overview', label: 'Overview' },
      { id: 'mcp-setup', label: 'Setup & Connection' },
      { id: 'mcp-auth', label: 'Authentication' },
      { id: 'mcp-figma-tools', label: 'Figma MCP Tools' },
      // Dynamic sections added from mcpSpec.tools
    ],
  },
  {
    id: 'plugin',
    label: 'Figma Plugin',
    icon: Puzzle,
  },
  {
    id: 'figma-nodes',
    label: 'Figma Node JSON',
    icon: Layers,
    sections: [
      { id: 'fn-overview', label: 'Overview' },
      { id: 'fn-nodespec', label: 'NodeSpec Reference' },
      { id: 'fn-fills', label: 'Fill & Effect Types' },
      { id: 'fn-rules', label: 'Critical Rules' },
      { id: 'fn-renderer', label: 'Renderer (render.ts)' },
      { id: 'fn-social', label: 'Social Media Example' },
      { id: 'fn-patterns', label: 'Common Patterns' },
    ],
  },
  {
    id: 'agents',
    label: 'For Agents',
    icon: Bot,
    sections: [
      { id: 'ag-overview', label: 'Overview' },
      { id: 'ag-auth', label: 'Authentication' },
      { id: 'ag-mcp', label: 'MCP Connection' },
      { id: 'ag-tools', label: 'Available Tools' },
      { id: 'ag-brand-guidelines', label: 'Brand Guidelines API' },
      { id: 'ag-credits', label: 'Credits & Limits' },
      { id: 'ag-example', label: 'Example Flow' },
    ],
  },
  {
    id: 'brand-guidelines',
    label: 'Brand Guidelines',
    icon: Diamond,
    sections: [
      { id: 'bg-overview', label: 'Overview' },
      { id: 'bg-rest', label: 'REST Endpoints' },
      { id: 'bg-schema', label: 'Schema' },
      { id: 'bg-sharing', label: 'Public Sharing' },
      { id: 'bg-context', label: 'LLM Context' },
    ],
  },
  {
    id: 'canvas-api',
    label: 'Canvas API',
    icon: Workflow,
    sections: [
      { id: 'ca-overview', label: 'Overview' },
      { id: 'ca-auth', label: 'Authentication' },
      { id: 'ca-projects', label: 'Projects CRUD' },
      { id: 'ca-nodes', label: 'Node Types' },
      { id: 'ca-edges', label: 'Edges & Connections' },
      { id: 'ca-media', label: 'Media Upload' },
      { id: 'ca-share', label: 'Sharing & Collab' },
      { id: 'ca-agents', label: 'Agent Integration' },
      { id: 'ca-json', label: 'JSON Export Format' },
    ],
  },
];

// Helper to build nav with dynamic MCP tools sections
export function buildNavigationWithMcpTools(mcpToolNames: string[]): NavigationItem[] {
  return DOCS_NAVIGATION_ITEMS.map(item => {
    if (item.id === 'mcp' && mcpToolNames.length > 0) {
      return {
        ...item,
        sections: [
          ...(item.sections || []),
          ...mcpToolNames.map(name => ({
            id: `tool-${name}`,
            label: name,
          })),
        ],
      };
    }
    return item;
  });
}

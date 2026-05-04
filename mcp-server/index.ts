#!/usr/bin/env node
/**
 * Visant Labs — MCP stdio Server
 *
 * Thin wrapper around shared tool definitions (mcp-server/shared.ts).
 * For HTTP transport see api/index.ts POST /mcp.
 *
 * Run: npm run mcp
 * Config: VISANT_API_URL (default http://localhost:3001/api)
 *         VISANT_API_TOKEN (optional Bearer token)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TOOLS, handleTool, API_BASE } from './shared.js';


type ToolArgs = Record<string, unknown>;

async function main() {
  const server = new Server(
    { name: 'visant-labs', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    try {
      return await handleTool(name, (args ?? {}) as ToolArgs);
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error: ${err?.message ?? 'unknown'}` }],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // eslint-disable-next-line no-console
  console.error(`[visant-mcp] connected — API_BASE=${API_BASE}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[visant-mcp] fatal:', err);
  process.exit(1);
});

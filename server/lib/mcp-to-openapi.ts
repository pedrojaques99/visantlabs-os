/**
 * MCP-to-OpenAPI Converter
 *
 * Converts the TOOLS array from mcp-server/shared.ts into OpenAPI 3.1 paths.
 * Single source of truth: adding a tool to TOOLS auto-reflects in the spec.
 */

import { TOOLS } from '../../mcp-server/shared.js';
import { generateOpenAPISpec } from './openapi-gen.js';

function getToolTag(toolName: string): string {
  if (toolName.includes('brand') || toolName.includes('guideline')) return 'Brand';
  if (
    toolName.startsWith('generate_') ||
    toolName.startsWith('improve_') ||
    toolName.startsWith('suggest_') ||
    toolName.startsWith('extract_')
  ) return 'AI Generation';
  if (toolName.includes('mockup')) return 'Mockups';
  if (toolName.includes('canvas')) return 'Canvas';
  if (toolName.includes('campaign') || toolName.includes('ad_')) return 'Campaigns';
  if (toolName.includes('creative')) return 'Creative';
  return 'Tools';
}

function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : text.slice(0, 120).trim();
}

const MCP_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    content: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['text'] },
          text: { type: 'string' },
        },
        required: ['type', 'text'],
      },
    },
  },
  required: ['content'],
};

/**
 * Generate an OpenAPI 3.1 spec from the MCP TOOLS array merged with legacy REST routes.
 *
 * @param version - API version string (from package.json)
 * @param serverUrl - Base URL of the server
 * @returns OpenAPI 3.1 specification object
 */
export function generateMCPOpenAPISpec(
  version: string = '1.0.0',
  serverUrl: string = 'http://localhost:3001'
): Record<string, unknown> {
  // Build MCP tool paths
  const mcpPaths: Record<string, unknown> = {};

  for (const tool of TOOLS) {
    const path = `/api/mcp/tools/${tool.name}`;
    mcpPaths[path] = {
      post: {
        operationId: tool.name,
        summary: firstSentence(tool.description),
        description: tool.description,
        tags: [getToolTag(tool.name)],
        security: [{ apiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: tool.inputSchema,
            },
          },
        },
        responses: {
          '200': {
            description: 'Tool executed successfully',
            content: {
              'application/json': {
                schema: MCP_RESULT_SCHEMA,
              },
            },
          },
          '401': {
            description: 'Unauthorized — missing or invalid API key',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { error: { type: 'string' } } },
              },
            },
          },
          '402': {
            description: 'Insufficient credits',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { error: { type: 'string' } } },
              },
            },
          },
        },
      },
    };
  }

  // Merge with legacy REST spec
  const legacySpec = generateOpenAPISpec(version, serverUrl) as Record<string, any>;
  const legacyPaths = legacySpec.paths ?? {};

  const mergedPaths = { ...legacyPaths, ...mcpPaths };

  // MCP tool tags
  const mcpTags = [
    { name: 'Brand', description: 'Brand guidelines management and intelligence' },
    { name: 'AI Generation', description: 'AI-powered prompt generation, image analysis, and extraction' },
    { name: 'Mockups', description: 'Mockup generation and management via MCP' },
    { name: 'Canvas', description: 'Canvas project management via MCP' },
    { name: 'Campaigns', description: 'Ad campaign generation via MCP' },
    { name: 'Creative', description: 'Creative plan generation and analytics' },
    { name: 'Tools', description: 'General MCP tools' },
  ];

  const legacyTags: unknown[] = Array.isArray(legacySpec.tags) ? legacySpec.tags : [];
  const allTags = [...legacyTags, ...mcpTags];

  return {
    openapi: '3.1.0',
    info: {
      title: 'Visant Labs Brand Infrastructure API',
      description:
        'Public API exposing 93+ MCP tools for AI-powered brand generation, mockups, creative studio, and compliance. ' +
        'Authenticate via API key (`visant_sk_*`) or JWT. MCP tools are available under `/api/mcp/tools/*`. ' +
        'Legacy REST endpoints are also included for compatibility.',
      version,
    },
    servers: [
      { url: 'https://api.visantlabs.com', description: 'Production' },
      { url: 'http://localhost:3001', description: 'Local development' },
      ...(serverUrl !== 'https://api.visantlabs.com' && serverUrl !== 'http://localhost:3001'
        ? [{ url: serverUrl, description: 'Current server' }]
        : []),
    ],
    paths: mergedPaths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /auth/login',
        },
        apiKeyAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'API key for agent/developer access. Format: visant_sk_xxxxxxxxxxxx. Get yours from Settings → API Keys.',
        },
      },
    },
    tags: allTags,
  };
}

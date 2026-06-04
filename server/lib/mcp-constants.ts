export const MCP_SPEC_VERSION = '2025-11-25';
export const MCP_BETA_HEADER = 'mcp-client-2025-11-20';

export const API_BASE_URL = process.env.API_BASE_URL || 'https://api.visantlabs.com';
export const FRONTEND_BASE_URL =
  process.env.FRONTEND_URL?.split(',')[0]?.trim() || 'https://visantlabs.com';
export const MCP_ENDPOINT = `${API_BASE_URL}/api/mcp`;

export const MCP_SCOPES = ['read', 'write', 'generate'] as const;
export type McpScope = (typeof MCP_SCOPES)[number];

export const MCP_RESULT_MAX_CHARS = 140_000;

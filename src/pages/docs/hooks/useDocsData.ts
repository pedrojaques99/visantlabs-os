/**
 * useDocsData Hook
 * Fetches and memoizes documentation specs from server
 */

import { useState, useEffect, useMemo } from 'react';

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  paths: Record<string, Record<string, any>>;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  examples?: Array<{
    name: string;
    description?: string;
    input: any;
    expectedOutput?: string;
  }>;
}

export interface MCPSpec {
  tools: MCPTool[];
}

export interface ApiEndpoint {
  path: string;
  method: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: any[];
}

export function useDocsData() {
  const [openApiSpec, setOpenApiSpec] = useState<OpenAPISpec | null>(null);
  const [mcpSpec, setMcpSpec] = useState<MCPSpec | null>(null);
  const [platformToolCount, setPlatformToolCount] = useState<number>(0);
  const [platformToolNames, setPlatformToolNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const [apiRes, mcpRes, metaRes] = await Promise.all([
          fetch('/api/docs/api/spec'),
          fetch('/api/docs/plugin/mcp.json'),
          fetch('/api/mcp/meta'),
        ]);

        if (apiRes.ok) setOpenApiSpec(await apiRes.json());
        if (mcpRes.ok) setMcpSpec(await mcpRes.json());
        if (metaRes.ok) {
          const meta = await metaRes.json();
          setPlatformToolCount(meta.toolCount ?? 0);
          setPlatformToolNames(meta.tools ?? []);
        }
      } catch (err) {
        console.error('Failed to fetch documentation specs:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchDocs();
  }, []);

  // Parse OpenAPI paths into endpoints array
  const apiEndpoints = useMemo((): ApiEndpoint[] => {
    if (!openApiSpec) return [];

    const endpoints: ApiEndpoint[] = [];
    const paths = openApiSpec.paths || {};

    Object.entries(paths).forEach(([path, methods]) => {
      Object.entries(methods as Record<string, any>).forEach(([method, details]) => {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
          endpoints.push({
            path,
            method: method.toUpperCase(),
            ...details,
          });
        }
      });
    });

    return endpoints;
  }, [openApiSpec]);

  // Filter endpoints by tag
  const authEndpoints = useMemo(
    () => apiEndpoints.filter(e => e.tags?.includes('auth')),
    [apiEndpoints]
  );

  const mockupEndpoints = useMemo(
    () => apiEndpoints.filter(e => e.tags?.includes('mockups')),
    [apiEndpoints]
  );

  const pluginEndpoints = useMemo(
    () => apiEndpoints.filter(e => e.tags?.includes('plugin')),
    [apiEndpoints]
  );

  // MCP tool names for navigation
  const mcpToolNames = useMemo(
    () => mcpSpec?.tools.map(t => t.name) || [],
    [mcpSpec]
  );

  return {
    openApiSpec,
    mcpSpec,
    loading,
    error,
    apiEndpoints,
    authEndpoints,
    mockupEndpoints,
    pluginEndpoints,
    mcpToolNames,
    /** Live count of platform MCP tools from /api/mcp/meta */
    platformToolCount,
    /** Live names of platform MCP tools from /api/mcp/meta */
    platformToolNames,
  };
}

/**
 * useDocsData Hook
 * Fetches and memoizes documentation specs from server.
 * Types re-exported from SSoT: src/lib/docs-markdown.ts
 */

import { useState, useEffect, useMemo } from 'react';
import { API_BASE } from '@/config/api';
import type { OpenAPISpec, MCPSpec, MCPTool, PricingData, ApiEndpoint } from '@/lib/docs-markdown';

export type { OpenAPISpec, MCPSpec, MCPTool, PricingData, ApiEndpoint };

export function useDocsData() {
  const [openApiSpec, setOpenApiSpec] = useState<OpenAPISpec | null>(null);
  const [mcpSpec, setMcpSpec] = useState<MCPSpec | null>(null);
  const [platformMcpSpec, setPlatformMcpSpec] = useState<MCPSpec | null>(null);
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [platformToolCount, setPlatformToolCount] = useState<number>(0);
  const [platformToolNames, setPlatformToolNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const [apiRes, mcpRes, platformRes, pricingRes] = await Promise.all([
          fetch(`${API_BASE}/docs/api/spec`),
          fetch(`${API_BASE}/docs/plugin/mcp.json`),
          fetch(`${API_BASE}/docs/platform/mcp.json`),
          fetch(`${API_BASE}/docs/pricing`),
        ]);

        if (apiRes.ok) setOpenApiSpec(await apiRes.json());
        if (mcpRes.ok) setMcpSpec(await mcpRes.json());
        if (platformRes.ok) {
          const platform = await platformRes.json();
          setPlatformMcpSpec(platform);
          setPlatformToolCount(platform.tools?.length ?? 0);
          setPlatformToolNames(platform.tools?.map((t: MCPTool) => t.name) ?? []);
        }
        if (pricingRes.ok) setPricingData(await pricingRes.json());
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
    () => apiEndpoints.filter((e) => e.tags?.includes('auth')),
    [apiEndpoints]
  );

  const mockupEndpoints = useMemo(
    () => apiEndpoints.filter((e) => e.tags?.includes('mockups')),
    [apiEndpoints]
  );

  const pluginEndpoints = useMemo(
    () => apiEndpoints.filter((e) => e.tags?.includes('plugin')),
    [apiEndpoints]
  );

  // MCP tool names for navigation
  const mcpToolNames = useMemo(() => mcpSpec?.tools.map((t) => t.name) || [], [mcpSpec]);

  return {
    openApiSpec,
    mcpSpec,
    /** Full platform MCP spec from /api/docs/platform/mcp.json — single source of truth for tool list */
    platformMcpSpec,
    /** Pricing data from /api/docs/pricing — single source of truth for credit costs and packages */
    pricingData,
    loading,
    error,
    apiEndpoints,
    authEndpoints,
    mockupEndpoints,
    pluginEndpoints,
    mcpToolNames,
    platformToolCount,
    platformToolNames,
  };
}

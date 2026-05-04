/**
 * useDocsData Hook
 * Fetches and memoizes documentation specs from server
 */

import { useState, useEffect, useMemo } from 'react';
import { API_BASE } from '@/config/api';

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
  // Extended fields served by /api/docs/platform/mcp.json
  'x-cost'?: 'free' | 'credits';
  'x-category'?: string;
  'x-auth'?: boolean;
}

export interface PricingData {
  creditCosts: Array<{
    model: string;
    modelId: string;
    resolution: string;
    googlePriceUSD: number;
    creditsRequired: number;
    category: 'image' | 'video' | 'chat' | 'branding';
  }>;
  creditPackages: Array<{
    credits: number;
    priceBRL: number;
    priceUSD: number;
    pricePerCreditUSD: number;
    imagesHD: number;
    images4K: number;
    videosFast: number;
    videosStandard: number;
  }>;
  storagePlans: Array<{
    id: string;
    name: string;
    storageMB: number;
    priceBRL: number;
    priceUSD: number;
    billingCycle: string;
    features: string[];
    isByok?: boolean;
  }>;
  googlePricing: Record<string, any>;
  infraCosts: Record<string, number>;
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

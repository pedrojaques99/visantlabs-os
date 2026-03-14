import { useState, useEffect } from 'react';

export interface ComponentUsage {
  name: string;
  path: string;
  imports: number;
  category: string;
  usage: {
    percentage: number;
    level: 'critical' | 'frequent' | 'moderate' | 'rare' | 'unused';
  };
}

export interface ComponentMetrics {
  success: boolean;
  generatedAt: string;
  summary: {
    timestamp: string;
    total: number;
    imports: number;
    averageImports: number;
  };
  distribution: {
    veryFrequent: number;
    frequent: number;
    moderate: number;
    rarely: number;
    orphaned: number;
  };
  components: ComponentUsage[];
  topComponents: ComponentUsage[];
  orphaned: ComponentUsage[];
}

/**
 * Hook to fetch component usage metrics from the API
 * Returns metrics in real-time for display in design system
 */
export function useComponentMetrics() {
  const [metrics, setMetrics] = useState<ComponentMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/docs/api/components-usage', {
          headers: { 'Accept': 'application/json' },
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch metrics: ${res.statusText}`);
        }

        const data = await res.json();
        setMetrics(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
        setMetrics(null);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  return { metrics, loading, error };
}

/**
 * Get usage level badge info
 */
export function getUsageLevelInfo(level: string) {
  const config = {
    critical: { color: 'bg-red-500/20 text-red-400', label: '🔥 Critical' },
    frequent: { color: 'bg-orange-500/20 text-orange-400', label: '✨ Frequent' },
    moderate: { color: 'bg-blue-500/20 text-blue-400', label: '🟡 Moderate' },
    rare: { color: 'bg-yellow-500/20 text-yellow-400', label: '⚠️ Rarely Used' },
    unused: { color: 'bg-gray-500/20 text-gray-400', label: '❌ Unused' },
  };

  return config[level as keyof typeof config] || config.unused;
}

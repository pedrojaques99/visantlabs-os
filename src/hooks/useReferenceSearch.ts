import { useState, useEffect, useCallback, useDeferredValue } from 'react';
import { referenceApi, type ReferenceResult } from '@/services/referenceApi';
import type { ReferenceDimensionKey } from '@/constants/referenceDimensions';

interface UseReferenceSearchParams {
  brandGuidelineId?: string | null;
  enabled?: boolean;
  limit?: number;
}

export function useReferenceSearch({ brandGuidelineId, enabled = true, limit = 30 }: UseReferenceSearchParams = {}) {
  const [results, setResults] = useState<ReferenceResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [dimFilters, setDimFilters] = useState<Partial<Record<ReferenceDimensionKey, string>>>({});
  const deferredQuery = useDeferredValue(query);

  const fetch = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    try {
      const all = await referenceApi.search({ brandGuidelineId, query: deferredQuery || undefined, limit });

      // Client-side dimension refinement (secondary filters on top of smart ranking)
      const activeFilters = Object.entries(dimFilters).filter(([, v]) => !!v);
      if (activeFilters.length === 0) {
        setResults(all);
      } else {
        const filtered = all.filter(ref => {
          return activeFilters.every(([key, val]) => {
            const dims = ref.dimensions[key as ReferenceDimensionKey];
            return dims?.includes(val as string);
          });
        });
        // Show filtered matches first, then rest (dimmed via relevanceScore override)
        const filteredIds = new Set(filtered.map(r => r.id));
        const rest = all.filter(r => !filteredIds.has(r.id)).map(r => ({ ...r, relevanceScore: 0 }));
        setResults([...filtered, ...rest]);
      }
    } catch {
      // silent — degrade gracefully
    } finally {
      setIsLoading(false);
    }
  }, [brandGuidelineId, deferredQuery, dimFilters, enabled, limit]);

  useEffect(() => {
    const timer = setTimeout(fetch, 350);
    return () => clearTimeout(timer);
  }, [fetch]);

  const toggleDimFilter = useCallback((key: ReferenceDimensionKey, value: string) => {
    setDimFilters(prev => {
      const next = { ...prev };
      if (next[key] === value) delete next[key]; else next[key] = value;
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setDimFilters({});
    setQuery('');
  }, []);

  return {
    results,
    isLoading,
    query,
    setQuery,
    dimFilters,
    toggleDimFilter,
    clearFilters,
    activeFilterCount: Object.keys(dimFilters).length,
    refresh: fetch,
  };
}

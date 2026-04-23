import { useEffect, useState } from 'react';

/**
 * Read-only hooks for Brand Learning (#5) and Agent Observability (#6).
 * Consumed by future Audit Log panel (pending design-system approval)
 * and by any MCP tool that surfaces brand intelligence.
 */

export interface BrandInsights {
  sampleSize: number;
  creatives: number;
  avgEditsPerCreative: number;
  firstTryAcceptance: number;
  fontSizeBias: number;
  colorOverrides: { from: string; to: string; count: number }[];
  logoPositionBias: { x: number; y: number } | null;
  removedRoles: { role: string; count: number }[];
  commonPatches: string[];
}

export interface CreativeEventRecord {
  id: string;
  ts: number;
  brandId: string | null;
  creativeId: string;
  type: string;
  layerId?: string;
  layerRole?: string;
  diff?: Record<string, { from: unknown; to: unknown }>;
  isCorrection?: boolean;
}

export function useBrandInsights(brandId: string | null) {
  const [data, setData] = useState<BrandInsights | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/creative/brand/${brandId}/insights`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setData(j);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [brandId]);

  return { data, loading };
}

export function useCreativeEventFeed(opts: {
  brandId?: string | null;
  creativeId?: string | null;
  limit?: number;
  pollMs?: number;
}) {
  const { brandId, creativeId, limit = 100, pollMs = 0 } = opts;
  const [events, setEvents] = useState<CreativeEventRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const params = new URLSearchParams();
      if (brandId) params.set('brandId', brandId);
      if (creativeId) params.set('creativeId', creativeId);
      params.set('limit', String(limit));
      try {
        const r = await fetch(`/api/creative/events?${params.toString()}`);
        const j = await r.json();
        if (!cancelled) setEvents(j.events ?? []);
      } catch {
        /* noop */
      }
    };
    void load();
    if (pollMs > 0) {
      const t = setInterval(load, pollMs);
      return () => {
        cancelled = true;
        clearInterval(t);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [brandId, creativeId, limit, pollMs]);

  return events;
}

export function useCreativeMetrics(brandId?: string | null) {
  const [metrics, setMetrics] = useState<{
    creatives: number;
    totalEvents: number;
    totalCorrections: number;
    avgEditsPerCreative: number;
    firstTryAcceptance: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = brandId
      ? `/api/creative/events/metrics?brandId=${brandId}`
      : `/api/creative/events/metrics`;
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setMetrics(j);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [brandId]);

  return metrics;
}

import { useQuery } from '@tanstack/react-query';
import { API_BASE } from '@/config/api';
import { authService } from '@/services/authService';

async function getJson(path: string) {
  const token = authService.getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

export const USAGE_KEYS = {
  all: ['usage'] as const,
  stats: ['usage', 'stats'] as const,
  daily: (feature: string) => ['usage', 'daily', feature] as const,
};

/** Account usage summary (KPI tiles). */
export function useUsageStats(enabled = true) {
  return useQuery({
    queryKey: USAGE_KEYS.stats,
    queryFn: () => getJson('/usage/history?limit=1').then((d) => d.stats),
    enabled,
  });
}

/** Daily usage series for the chart — refetches automatically when `feature` changes. */
export function useDailyUsage(feature: string, enabled = true) {
  return useQuery({
    queryKey: USAGE_KEYS.daily(feature),
    queryFn: () => {
      const params = new URLSearchParams({ days: '30' });
      if (feature !== 'all') params.set('feature', feature);
      return getJson(`/usage/daily?${params.toString()}`).then((d) => d.daily || []);
    },
    enabled,
  });
}

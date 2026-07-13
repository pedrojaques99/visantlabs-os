import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/services/adminApi';

export const ADMIN_KEYS = {
  all: ['admin'] as const,
  summary: ['admin', 'summary'] as const,
  users: ['admin', 'users'] as const,
  charts: ['admin', 'charts'] as const,
};

/** KPI cards — cheap global aggregations, paints first. */
export function useAdminSummary(enabled = true) {
  return useQuery({
    queryKey: ADMIN_KEYS.summary,
    queryFn: adminApi.getSummary,
    enabled,
  });
}

/** User table + per-user metrics (batched aggregations server-side). */
export function useAdminUsers(enabled = true) {
  return useQuery({
    queryKey: ADMIN_KEYS.users,
    queryFn: adminApi.getUsers,
    enabled,
  });
}

/** Generation stats + revenue/cost/generation time series. */
export function useAdminCharts(enabled = true) {
  return useQuery({
    queryKey: ADMIN_KEYS.charts,
    queryFn: adminApi.getCharts,
    enabled,
  });
}

/** Refetch every dashboard slice (the toolbar refresh button). */
export function useRefreshAdminDashboard() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ADMIN_KEYS.all });
}

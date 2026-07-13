import { useQuery } from '@tanstack/react-query';
import { mockupApi, type Mockup } from '@/services/mockupApi';

export const BRAND_MOCKUP_KEYS = {
  all: ['mockups'] as const,
  list: (brandId?: string) => ['mockups', 'list', brandId ?? 'all'] as const,
};

/**
 * Brand cockpit: the per-brand output gallery. Lists the mockups generated for a
 * given brand (server filters by `brandGuidelineId`). Powers the cockpit gallery
 * so every generated asset persists and stays browsable per brand.
 */
export function useBrandMockups(brandId?: string, enabled = true) {
  return useQuery<Mockup[]>({
    queryKey: BRAND_MOCKUP_KEYS.list(brandId),
    queryFn: () => mockupApi.getAll(brandId),
    enabled: enabled && !!brandId,
  });
}

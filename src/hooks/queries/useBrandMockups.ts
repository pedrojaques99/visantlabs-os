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

/**
 * Grid de marcas: o mockup mais recente de cada marca, numa chamada só (a lista
 * do usuário vem ordenada por createdAt desc). brandId -> imageUrl.
 */
export function useLatestMockupByBrand(enabled = true) {
  return useQuery<Mockup[], Error, Map<string, string>>({
    queryKey: BRAND_MOCKUP_KEYS.list(),
    queryFn: () => mockupApi.getAll(),
    enabled,
    staleTime: 5 * 60 * 1000,
    select: (mockups) => {
      const byBrand = new Map<string, string>();
      for (const m of mockups) {
        if (m.brandGuidelineId && m.imageUrl && !byBrand.has(m.brandGuidelineId)) {
          byBrand.set(m.brandGuidelineId, m.imageUrl);
        }
      }
      return byBrand;
    },
  });
}

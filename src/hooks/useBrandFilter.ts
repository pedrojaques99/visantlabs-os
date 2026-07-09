import { useCallback, useState } from 'react';
import { useActiveBrandSafe } from '@/contexts/ActiveBrandContext';
import type { BrandGuideline } from '@/lib/figma-types';

/**
 * Filtro opcional pela marca ativa para listas de PRODUÇÃO (canvas, criativos…).
 * Default global; um clique escopa. A preferência persiste por lista
 * (`storageKey`). `brandId` só é não-nulo quando o filtro está ligado E há marca
 * ativa — use direto no fetch/filter. Plano APP-SHELL (produção brand-scoped).
 */
export interface BrandFilterState {
  activeBrand: BrandGuideline | null;
  enabled: boolean;
  toggle: () => void;
  /** Id da marca a filtrar, ou null (mostrar tudo). */
  brandId: string | null;
}

export function useBrandFilter(storageKey: string): BrandFilterState {
  const activeBrand = useActiveBrandSafe()?.activeBrand ?? null;

  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(storageKey) === '1';
  });

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') localStorage.setItem(storageKey, next ? '1' : '0');
      return next;
    });
  }, [storageKey]);

  const brandId = enabled && activeBrand?.id ? activeBrand.id : null;

  return { activeBrand, enabled, toggle, brandId };
}

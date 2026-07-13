import { useHotkeys } from 'react-hotkeys-hook';
import { useActiveBrandSafe } from '@/contexts/ActiveBrandContext';

/**
 * A "marca anterior" para o quick-switch: o primeiro id do MRU (`recentBrandIds`,
 * mais-recente-primeiro) que NÃO é a marca ativa e ainda existe na lista. Puro e
 * testável. Retorna null quando não há uma anterior utilizável.
 */
export function resolvePreviousBrandId(
  recentBrandIds: string[],
  activeBrandId: string | null,
  validIds: Set<string>
): string | null {
  for (const id of recentBrandIds) {
    if (id !== activeBrandId && validIds.has(id)) return id;
  }
  return null;
}

/**
 * `Alt+B` = alterna para a última marca ativa (o "Alt+Tab de marcas"). Trocar de
 * marca NUNCA navega (invariante da AppSpine) — re-escopa a tela no lugar, ideal
 * pra comparar A↔B do cliente sem sair do cockpit. Reusa o MRU do SSoT
 * `ActiveBrandContext`; não reordena lista nenhuma (zero jumpiness).
 * Ver plano HOME-ADAPTIVE-IA.
 */
export function useBrandQuickSwitch(): void {
  const brand = useActiveBrandSafe();
  useHotkeys(
    'alt+b',
    (e) => {
      e.preventDefault();
      if (!brand) return;
      const validIds = new Set(
        brand.brands.map((b) => b.id).filter((id): id is string => !!id)
      );
      const prev = resolvePreviousBrandId(brand.recentBrandIds, brand.activeBrandId, validIds);
      if (prev) brand.setActiveBrand(prev);
    },
    { enableOnFormTags: false }
  );
}

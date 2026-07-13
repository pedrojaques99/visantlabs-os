import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { classifyRoute, routeMode } from '@/config/navConfig';

/**
 * Origem do "voltar" nos editores (AppSpine, modo focus).
 *
 * A espinha do editor volta para a **seção de origem** — de onde você entrou no
 * editor (cockpit → cockpit, /apps → apps). Guardamos a última rota de dashboard
 * (`mode: 'full'`) visitada num ref de módulo: ele sobrevive à troca de shell
 * (dashboard → editor) dentro da SPA sem exigir um provider acima de toda a
 * árvore. Fallback quando não há origem (deep-link direto no editor): /cockpit.
 *
 * Plano: APP-SPINE-CONSOLIDATION.
 */
let lastFullRoute: { path: string; section: string | null } | null = null;

export function getEditorOrigin(): { path: string; section: string | null } | null {
  return lastFullRoute;
}

/** Registra a última rota de dashboard visitada. Montar 1× (no Layout). */
export function useTrackEditorOrigin(): void {
  const location = useLocation();
  useEffect(() => {
    if (routeMode(location.pathname) === 'full') {
      lastFullRoute = {
        path: location.pathname,
        section: classifyRoute(location.pathname).section,
      };
    }
  }, [location.pathname]);
}

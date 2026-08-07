import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLayout } from '@/hooks/useLayout';
import { useActiveBrand } from '@/contexts/ActiveBrandContext';
import { FEATURE_COCKPIT } from '@/config/featureFlags';

const FIRST_RUN_KEY = 'vsn_firstrun_routed';

/**
 * First-run do shell: usuário autenticado SEM nenhuma marca, na primeira visita à
 * landing neutra (`/`), é levado ao `/cockpit`. Sem marca, o `/cockpit`
 * (`HomeRoute` em App.tsx) NÃO renderiza o cockpit nem faz bounce pra lista de
 * marcas: renderiza o estado de ativação guiado — checklist de primeiros passos
 * + wizard de criação da 1ª marca inline. Criada a marca, o mesmo HomeRoute
 * passa a renderizar o cockpit, sem nova navegação.
 *
 * Roda UMA vez (flag em localStorage) e só intercepta `/`: não sequestra tools
 * grátis, criação (`/welcome`), nem marketing. Com marca (ou já roteado) → nunca
 * mais mexe.
 */
export const FirstRunGuard: React.FC = () => {
  const { isAuthenticated, isCheckingAuth } = useLayout();
  const { brands, isLoading } = useActiveBrand();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!FEATURE_COCKPIT) return;
    if (isAuthenticated !== true || isCheckingAuth) return;
    if (isLoading) return; // espera as marcas carregarem antes de decidir
    if (brands.length > 0) return; // já tem marca: fluxo normal
    if (location.pathname !== '/') return; // só a landing neutra
    if (typeof window !== 'undefined' && localStorage.getItem(FIRST_RUN_KEY)) return;

    if (typeof window !== 'undefined') localStorage.setItem(FIRST_RUN_KEY, '1');
    navigate('/cockpit', { replace: true });
  }, [isAuthenticated, isCheckingAuth, isLoading, brands.length, location.pathname, navigate]);

  return null;
};

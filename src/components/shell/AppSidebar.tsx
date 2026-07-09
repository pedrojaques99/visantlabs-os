/**
 * Rail lateral persistente do app (plano APP-SHELL-REALIGNMENT, F1 / gap #3).
 *
 * Net-new: os primitivos `AppShell*` são chrome flutuante sobre workspace, não
 * têm slot de rail. Este é o rail brand-scoped estilo Linear, 100% dirigido
 * pelo SSoT `navConfig` — nenhum destino é hardcoded aqui.
 *
 *   Nível 0  BrandSwitcher (marca ativa)  — reusa o componente existente
 *   Nível 1  destinos globais              — visibleSections(ctx)
 *   Nível 2  sub-nav da seção da rota      — contextNavFor(pathname, ctx)
 *   Footer   usuário · tema · settings
 */
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Settings, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { useLayout } from '@/hooks/useLayout';
import { useActiveBrand } from '@/contexts/ActiveBrandContext';
import { BrandSwitcher } from '@/components/cockpit/BrandSwitcher';
import { FEATURE_COCKPIT, FEATURE_COPILOT } from '@/config/featureFlags';
import {
  classifyRoute,
  visibleSections,
  contextNavFor,
  type NavCtx,
} from '@/config/navConfig';

interface AppSidebarProps {
  /** 'desktop' = rail persistente (hidden no mobile); 'mobile' = drawer. */
  variant?: 'desktop' | 'mobile';
  /** Chamado após navegar — usado pelo drawer mobile para fechar. */
  onNavigate?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ variant = 'desktop', onNavigate }) => {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useLayout();
  const { brands, activeBrandId, setActiveBrand } = useActiveBrand();

  const ctx: NavCtx = {
    isAuthenticated: true,
    isElevated: !!user?.isAdmin || user?.userCategory === 'tester',
    flags: { cockpit: FEATURE_COCKPIT, copilot: FEATURE_COPILOT },
    activeBrandId,
  };

  const activeSection = classifyRoute(location.pathname).section;
  const sections = visibleSections(ctx);
  const contextItems = contextNavFor(location.pathname, ctx);
  const initial = (user?.name || user?.email || '?').slice(0, 1).toUpperCase();

  // Active-state do L2 respeitando `?tab`: item sem query casa por path; item
  // com `?tab` casa o tab atual; sem tab na URL, o 1º item daquele path é o
  // default. Evita destacar "Conta" e "Uso e créditos" juntos em /profile.
  const curTab = new URLSearchParams(location.search).get('tab');
  const firstItemForPath = contextItems.find((i) => i.to.split('?')[0] === location.pathname);
  const isSubActive = (to: string) => {
    const [toPath, toQuery] = to.split('?');
    if (location.pathname !== toPath) return false;
    const toTab = toQuery ? new URLSearchParams(toQuery).get('tab') : null;
    if (toTab === null) return true;
    if (curTab === null) return firstItemForPath?.to === to;
    return curTab === toTab;
  };
  const go = (to: string) => {
    navigate(to);
    onNavigate?.();
  };

  return (
    <aside
      className={cn(
        'flex-col border-r border-border',
        variant === 'mobile'
          ? 'flex w-64 h-full bg-background'
          : 'hidden md:flex w-60 shrink-0 bg-background/60'
      )}
    >
      {/* Nível 0 — marca ativa */}
      <div className="p-3 border-b border-border">
        <BrandSwitcher
          brands={brands}
          value={activeBrandId}
          onChange={setActiveBrand}
          className="w-full"
        />
      </div>

      {/* Nível 1 — destinos globais */}
      <nav className="p-2 space-y-0.5">
        {sections.map((s) => {
          const Icon = s.icon;
          const active = activeSection === s.id;
          return (
            <button
              key={s.id}
              onClick={() => go(s.to)}
              className={cn(
                'w-full flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                active
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon size={16} className="shrink-0" />
              <span className="truncate">{t(s.labelKey)}</span>
            </button>
          );
        })}
      </nav>

      {/* Nível 2 — contexto da seção atual */}
      {contextItems.length > 0 && (
        <div className="px-2 pt-2 mt-1 border-t border-border">
          <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">
            {t('nav.context')}
          </div>
          <nav className="space-y-0.5">
            {contextItems.map((i) => {
              const Icon = i.icon;
              const active = isSubActive(i.to);
              return (
                <button
                  key={i.id}
                  onClick={() => go(i.to)}
                  className={cn(
                    'w-full flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                    active
                      ? 'bg-accent/60 text-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {Icon && <Icon size={14} className="shrink-0" />}
                  <span className="truncate">{t(i.labelKey)}</span>
                </button>
              );
            })}
          </nav>
        </div>
      )}

      <div className="flex-1" />

      {/* Footer — usuário · tema · settings */}
      <div className="p-2 border-t border-border flex items-center gap-1">
        <button
          onClick={() => go('/profile')}
          className="flex-1 min-w-0 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <span className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
            {initial}
          </span>
          <span className="truncate">{user?.name || user?.email || t('nav.profile.label')}</span>
        </button>
        <button
          onClick={toggleTheme}
          aria-label="toggle theme"
          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button
          onClick={() => go('/profile?tab=configuration')}
          aria-label="settings"
          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Settings size={15} />
        </button>
      </div>
    </aside>
  );
};

/**
 * Rail lateral persistente do app (plano APP-SHELL-REALIGNMENT, F1 / gap #3, P2).
 *
 * Net-new: os primitivos `AppShell*` são chrome flutuante sobre workspace, não
 * têm slot de rail. Este é o rail brand-scoped estilo Linear, 100% dirigido
 * pelo SSoT `navConfig` — nenhum destino é hardcoded aqui.
 *
 *   Nível 0  BrandSwitcher (marca ativa)  — reusa o componente existente
 *   Nível 1  destinos globais              — visibleSections(ctx)
 *   Nível 2  sub-nav da seção da rota      — contextNavFor(pathname, ctx)
 *   Footer   usuário · tema · settings · colapsar
 *
 * Colapsável (P2): estado persiste em `vsn_rail_collapsed`; colapsado vira
 * uma faixa de ícones (labels/L2 escondidos). Mobile é sempre expandido.
 */
import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Settings, Sun, Moon, PanelLeftClose, PanelLeftOpen, Star, X, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { useLayout } from '@/hooks/useLayout';
import { useActiveBrand } from '@/contexts/ActiveBrandContext';
import { usePinnedNav } from '@/hooks/usePinnedNav';
import { BrandSwitcher } from '@/components/cockpit/BrandSwitcher';
import { BrandAvatar } from '@/components/brand/BrandAvatar';
import { getLucideIcon } from '@/lib/ui/lucideIcon';
import { FEATURE_COCKPIT, FEATURE_COPILOT } from '@/config/featureFlags';
import { classifyRoute, visibleSections, contextNavFor, type NavCtx } from '@/config/navConfig';
import type { BrandGuideline } from '@/lib/figma-types';

const RAIL_COLLAPSED_KEY = 'vsn_rail_collapsed';

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
  const { brands, activeBrand, activeBrandId, setActiveBrand, recentBrandIds } = useActiveBrand();
  const { items: pinned, unpin } = usePinnedNav();

  // RECENTES — marcas visitadas recentemente (MRU), exceto a ativa. Sem MRU
  // ainda, cai nas mais recém-editadas. Acesso rápido cross-tela que o rail
  // (sempre presente) oferece e a página não duplica.
  const recentBrands = useMemo(() => {
    const byId = new Map(brands.map((b) => [b.id, b]));
    const notActive = (b: BrandGuideline) => b.id !== activeBrandId;
    // MRU (menos a ativa); se sobrou nada, cai nas mais recém-editadas.
    const mru = recentBrandIds
      .map((id) => byId.get(id))
      .filter((b): b is BrandGuideline => !!b)
      .filter(notActive);
    const source =
      mru.length > 0
        ? mru
        : [...brands]
            .sort(
              (a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()
            )
            .filter(notActive);
    return source.slice(0, 4);
  }, [brands, recentBrandIds, activeBrandId]);

  const openBrand = (id: string) => {
    setActiveBrand(id);
    go('/cockpit');
  };

  const isMobile = variant === 'mobile';
  const [collapsedRaw, setCollapsedRaw] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(RAIL_COLLAPSED_KEY) === '1'
  );
  const collapsed = !isMobile && collapsedRaw; // o drawer mobile é sempre expandido
  const toggleCollapsed = () => {
    const v = !collapsedRaw;
    setCollapsedRaw(v);
    if (typeof window !== 'undefined') localStorage.setItem(RAIL_COLLAPSED_KEY, v ? '1' : '0');
  };

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
    if (/^https?:\/\//.test(to)) {
      window.open(to, '_blank', 'noopener,noreferrer');
    } else {
      navigate(to);
    }
    onNavigate?.();
  };

  const iconBtn =
    'p-1.5 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors';

  return (
    <aside
      className={cn(
        'flex-col border-r border-sidebar-border',
        isMobile
          ? 'flex w-64 h-full bg-sidebar'
          : cn('hidden md:flex shrink-0 bg-sidebar', collapsed ? 'w-[56px]' : 'w-60')
      )}
    >
      {/* Nível 0 — marca ativa */}
      <div className={cn('border-b border-sidebar-border', collapsed ? 'p-2 flex justify-center' : 'p-3')}>
        {collapsed ? (
          <button
            onClick={toggleCollapsed}
            title={activeBrand?.identity?.name || activeBrand?.name || t('nav.brands.label')}
            className="rounded-md hover:opacity-80 transition-opacity"
          >
            {activeBrand ? (
              <BrandAvatar brand={activeBrand} size={28} rounded="md" />
            ) : (
              <span className="h-7 w-7 rounded-md bg-muted flex items-center justify-center text-[11px] font-medium">
                ?
              </span>
            )}
          </button>
        ) : (
          <BrandSwitcher
            brands={brands}
            value={activeBrandId}
            onChange={setActiveBrand}
            className="w-full"
          />
        )}
      </div>

      {/* Nível 1 — destinos globais */}
      <nav className={cn('p-2 space-y-0.5', collapsed && 'flex flex-col items-center')}>
        {sections.map((s) => {
          const Icon = s.icon;
          const active = activeSection === s.id;
          return (
            <button
              key={s.id}
              onClick={() => go(s.to)}
              title={collapsed ? t(s.labelKey) : undefined}
              className={cn(
                'flex items-center rounded-md text-sm transition-colors',
                collapsed ? 'h-9 w-9 justify-center' : 'w-full gap-2.5 px-2.5 py-1.5',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon size={16} className="shrink-0" />
              {!collapsed && <span className="truncate">{t(s.labelKey)}</span>}
            </button>
          );
        })}
      </nav>

      {/* Favoritos — itens fixados pelo usuário (star estilo Figma) */}
      {pinned.length > 0 &&
        (collapsed ? (
          <div className="px-2 pt-2 mt-1 border-t border-sidebar-border flex flex-col items-center gap-1">
            {pinned.map((p) => {
              const PinIcon = p.type === 'brand' ? Palette : getLucideIcon(p.icon) ?? Star;
              const active = location.pathname === p.to.split('?')[0];
              return (
                <button
                  key={`${p.type}:${p.id}`}
                  onClick={() => go(p.to)}
                  title={p.label}
                  className={cn(
                    'h-9 w-9 flex items-center justify-center rounded-md transition-colors',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <PinIcon size={16} className="shrink-0" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="px-2 pt-2 mt-1 border-t border-sidebar-border">
            <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-sidebar-foreground/50">
              {t('nav.pinned')}
            </div>
            <nav className="space-y-0.5">
              {pinned.map((p) => {
                const PinIcon = p.type === 'brand' ? Palette : getLucideIcon(p.icon) ?? Star;
                const active = location.pathname === p.to.split('?')[0];
                return (
                  <div key={`${p.type}:${p.id}`} className="group relative flex items-center">
                    <button
                      onClick={() => go(p.to)}
                      className={cn(
                        'flex-1 min-w-0 flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                        active
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      )}
                    >
                      <PinIcon size={14} className="shrink-0" />
                      <span className="truncate">{p.label}</span>
                    </button>
                    <button
                      onClick={() => unpin(p.type, p.id)}
                      aria-label={t('nav.unpin')}
                      title={t('nav.unpin')}
                      className="absolute right-1 opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </nav>
          </div>
        ))}

      {/* Recentes — marcas visitadas recentemente (acesso rápido cross-tela) */}
      {recentBrands.length > 0 &&
        (collapsed ? (
          <div className="px-2 pt-2 mt-1 border-t border-sidebar-border flex flex-col items-center gap-1">
            {recentBrands.map((b) => (
              <button
                key={b.id}
                onClick={() => openBrand(b.id!)}
                title={b.identity?.name || b.name || 'Brand'}
                className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
              >
                <BrandAvatar brand={b} size={20} rounded="md" />
              </button>
            ))}
          </div>
        ) : (
          <div className="px-2 pt-2 mt-1 border-t border-sidebar-border">
            <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-sidebar-foreground/50">
              {t('nav.recent')}
            </div>
            <nav className="space-y-0.5">
              {recentBrands.map((b) => (
                <button
                  key={b.id}
                  onClick={() => openBrand(b.id!)}
                  className="w-full min-w-0 flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                >
                  <BrandAvatar brand={b} size={16} rounded="sm" />
                  <span className="truncate">{b.identity?.name || b.name || 'Brand'}</span>
                </button>
              ))}
            </nav>
          </div>
        ))}

      {/* Nível 2 — contexto da seção atual (escondido quando colapsado) */}
      {!collapsed && contextItems.length > 0 && (
        <div className="px-2 pt-2 mt-1 border-t border-sidebar-border">
          <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-sidebar-foreground/50">
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
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
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

      {/* Footer — usuário · tema · settings · colapsar */}
      {collapsed ? (
        <div className="p-2 border-t border-sidebar-border flex flex-col items-center gap-1">
          <button onClick={() => go('/profile')} title={user?.name || user?.email || t('nav.profile.label')} className={iconBtn}>
            <span className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">
              {initial}
            </span>
          </button>
          <button onClick={toggleTheme} aria-label="toggle theme" className={iconBtn}>
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button onClick={toggleCollapsed} aria-label="expand sidebar" title={t('nav.expand')} className={iconBtn}>
            <PanelLeftOpen size={15} />
          </button>
        </div>
      ) : (
        <div className="p-2 border-t border-sidebar-border flex items-center gap-1">
          <button
            onClick={() => go('/profile')}
            className="flex-1 min-w-0 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <span className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
              {initial}
            </span>
            <span className="truncate">{user?.name || user?.email || t('nav.profile.label')}</span>
          </button>
          <button onClick={toggleTheme} aria-label="toggle theme" className={iconBtn}>
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button onClick={() => go('/profile?tab=configuration')} aria-label="settings" className={iconBtn}>
            <Settings size={15} />
          </button>
          {!isMobile && (
            <button onClick={toggleCollapsed} aria-label="collapse sidebar" title={t('nav.collapse')} className={iconBtn}>
              <PanelLeftClose size={15} />
            </button>
          )}
        </div>
      )}
    </aside>
  );
};

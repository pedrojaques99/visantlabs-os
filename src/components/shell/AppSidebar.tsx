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
import {
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Gem,
  X,
  Palette,
  Star,
  ArrowLeft,
  User as UserIcon,
} from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { useActiveBrand } from '@/contexts/ActiveBrandContext';
import { usePinnedNav } from '@/hooks/usePinnedNav';
import { BrandAvatar } from '@/components/brand/BrandAvatar';
import { AppShellLegalMenu } from '@/components/ui/AppShellLegalMenu';
import { AuthButton } from '@/components/AuthButton';
import { getLucideIcon } from '@/lib/ui/lucideIcon';
import { FEATURE_COCKPIT, FEATURE_COPILOT } from '@/config/featureFlags';
import {
  classifyRoute,
  visibleSections,
  contextNavFor,
  isDrillInSection,
  DRILL_TITLES,
  LIBRARY_ITEMS,
  type NavCtx,
} from '@/config/navConfig';

const RAIL_COLLAPSED_KEY = 'vsn_rail_collapsed';

interface AppSidebarProps {
  /** 'desktop' = rail persistente (hidden no mobile); 'mobile' = drawer. */
  variant?: 'desktop' | 'mobile';
  /** Chamado após navegar — usado pelo drawer mobile para fechar. */
  onNavigate?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ variant = 'desktop', onNavigate }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, subscriptionStatus, onCreditPackagesModalOpen } = useLayout();
  const { brands, activeBrandId, setActiveBrand } = useActiveBrand();
  const { items: pinned, unpin, toggle: togglePin, isPinned } = usePinnedNav();

  // RECENTES — acesso rápido cross-tela às marcas (a marca ativa fica na lista,
  // destacada). Ordem ESTÁVEL por data de edição: não reordena a cada clique
  // (feedback do user — antes era MRU + excluía a ativa, e a lista "pulava").
  const recentBrands = useMemo(
    () =>
      [...brands]
        .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())
        .slice(0, 5),
    [brands]
  );

  // Trocar de marca NUNCA navega — só troca o contexto ativo. Você muda de marca
  // sem sair da tela em que está (invariante da AppSpine / plano APP-SPINE-CONSOLIDATION).
  const openBrand = (id: string) => {
    setActiveBrand(id);
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

  // Modo "drill": seções ricas (community, references) SUBSTITUEM a rail-mãe pelas
  // suas tabs + uma seta de voltar, em vez de empilhar um bloco L2 embaixo de tudo
  // (ficava muita coisa). Voltar leva pra Início, onde a rail-mãe reaparece.
  const drillIn = isDrillInSection(activeSection) && contextItems.length > 0;
  const drillTitleKey = activeSection ? DRILL_TITLES[activeSection] : undefined;

  // Active-state do L2 genérico por query (?tab no profile, ?type na comunidade):
  // sem query na URL, o 1º item daquele path é o default (Conta em /profile,
  // Explorar tudo em /community/presets); com query, casa o item cujos params
  // todos batem. Evita destacar vários itens juntos.
  const search = new URLSearchParams(location.search);
  const hasQuery = Array.from(search).length > 0;
  const firstItemForPath = contextItems.find((i) => i.to.split('?')[0] === location.pathname);
  const isSubActive = (to: string) => {
    const [toPath, toQuery] = to.split('?');
    if (location.pathname !== toPath) return false;
    if (!hasQuery) return firstItemForPath?.to === to;
    if (!toQuery) return false; // item sem filtro não casa quando há filtro ativo
    return Array.from(new URLSearchParams(toQuery)).every(([k, v]) => search.get(k) === v);
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
      {/* Nível 0 (marca ativa) vive no AppTopBar (BrandSwitcher) — SSoT única,
          o rail não duplica. Expandir/colapsar fica no rodapé. */}

      {/* Rail-mãe (L1 + BIBLIOTECA + FIXADOS + RECENTES + L2). Em modo drill some
          por completo e dá lugar às tabs da seção (ver bloco `drillIn` abaixo). */}
      {!drillIn && (
        <>
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

          {/* Biblioteca — acervo pessoal + descoberta (Meus Mockups · Comunidade).
          Grupo fixo, dirigido pelo SSoT navConfig (LIBRARY_ITEMS). */}
          {collapsed ? (
            <div className="px-2 pt-2 mt-1 border-t border-sidebar-border flex flex-col items-center gap-1">
              {LIBRARY_ITEMS.map((i) => {
                const Icon = i.icon;
                const active = location.pathname === i.to.split('?')[0];
                return (
                  <button
                    key={i.id}
                    onClick={() => go(i.to)}
                    title={t(i.labelKey)}
                    className={cn(
                      'h-9 w-9 flex items-center justify-center rounded-md transition-colors',
                      active
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    {Icon && <Icon size={16} className="shrink-0" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-2 pt-2 mt-1 border-t border-sidebar-border">
              <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-sidebar-foreground/50">
                {t('nav.library.title')}
              </div>
              <nav className="space-y-0.5">
                {LIBRARY_ITEMS.map((i) => {
                  const Icon = i.icon;
                  const active = location.pathname === i.to.split('?')[0];
                  return (
                    <button
                      key={i.id}
                      onClick={() => go(i.to)}
                      className={cn(
                        'w-full flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                        active
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
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

          {/* Favoritos — itens fixados pelo usuário (star estilo Figma) */}
          {pinned.length > 0 &&
            (collapsed ? (
              <div className="px-2 pt-2 mt-1 border-t border-sidebar-border flex flex-col items-center gap-1">
                {pinned.map((p) => {
                  const PinIcon = p.type === 'brand' ? Palette : (getLucideIcon(p.icon) ?? Gem);
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
                    const PinIcon = p.type === 'brand' ? Palette : (getLucideIcon(p.icon) ?? Gem);
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

          {/* Recentes — acesso rápido às marcas (ativa destacada; star fixa/desafixa) */}
          {recentBrands.length > 0 &&
            (collapsed ? (
              <div className="px-2 pt-2 mt-1 border-t border-sidebar-border flex flex-col items-center gap-1">
                {recentBrands.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => openBrand(b.id!)}
                    title={b.identity?.name || b.name || 'Brand'}
                    className={cn(
                      'h-9 w-9 flex items-center justify-center rounded-md transition-colors',
                      b.id === activeBrandId ? 'ring-1 ring-brand-cyan/60' : 'hover:bg-muted'
                    )}
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
                  {recentBrands.map((b) => {
                    const label = b.identity?.name || b.name || 'Brand';
                    const active = b.id === activeBrandId;
                    const pinnedBrand = isPinned('brand', b.id!);
                    return (
                      <div key={b.id} className="group relative flex items-center">
                        <button
                          onClick={() => openBrand(b.id!)}
                          className={cn(
                            'flex-1 min-w-0 flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                            active
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                          )}
                        >
                          <BrandAvatar brand={b} size={16} rounded="sm" />
                          <span className="truncate">{label}</span>
                        </button>
                        <button
                          onClick={() =>
                            togglePin({
                              type: 'brand',
                              id: b.id!,
                              label,
                              to: `/brand-guidelines?id=${b.id}`,
                            })
                          }
                          aria-label={pinnedBrand ? t('nav.unpin') : t('nav.pin')}
                          title={pinnedBrand ? t('nav.unpin') : t('nav.pin')}
                          className={cn(
                            'absolute right-1 p-1 rounded transition-opacity hover:bg-muted',
                            pinnedBrand
                              ? 'opacity-100 text-brand-cyan'
                              : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <Star size={12} className={pinnedBrand ? 'fill-brand-cyan' : ''} />
                        </button>
                      </div>
                    );
                  })}
                </nav>
              </div>
            ))}

          {/* Nível 2 — contexto da seção atual (escondido quando colapsado) */}
          {!collapsed && contextItems.length > 0 && (
            <div className="px-2 pt-2 mt-1 border-t border-sidebar-border">
              <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-sidebar-foreground/50">
                {t('nav.context')}
              </div>
              {/* Cap + scroll: seções com muitos itens (categorias da comunidade)
              não podem empurrar o rodapé/conta pra fora da viewport. */}
              <nav className="space-y-0.5 max-h-[42vh] overflow-y-auto scrollbar-none">
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
        </>
      )}

      {/* Modo drill (seção community): a rail-mãe some e dá lugar às tabs da seção
          + a seta de voltar. A nav ocupa a coluna toda e rola sozinha (muitas
          categorias), sem empurrar o rodapé/conta pra fora da viewport. */}
      {drillIn && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className={cn('p-2', !collapsed && 'border-b border-sidebar-border')}>
            <button
              onClick={() => go('/cockpit')}
              title={collapsed ? t('nav.back') : undefined}
              className={cn(
                'flex items-center rounded-md text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors',
                collapsed ? 'h-9 w-9 justify-center' : 'w-full gap-2 px-2.5 py-1.5'
              )}
            >
              <ArrowLeft size={16} className="shrink-0" />
              {!collapsed && (
                <span className="truncate font-medium">{t(drillTitleKey ?? 'nav.back')}</span>
              )}
            </button>
          </div>
          <nav
            className={cn(
              'flex-1 overflow-y-auto scrollbar-none p-2 space-y-0.5',
              collapsed && 'flex flex-col items-center'
            )}
          >
            {contextItems.map((i) => {
              const Icon = i.icon;
              const active = isSubActive(i.to);
              return (
                <button
                  key={i.id}
                  onClick={() => go(i.to)}
                  title={collapsed ? t(i.labelKey) : undefined}
                  className={cn(
                    'flex items-center rounded-md text-[13px] transition-colors',
                    collapsed ? 'h-9 w-9 justify-center' : 'w-full gap-2.5 px-2.5 py-1.5',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  {Icon && <Icon size={collapsed ? 16 : 14} className="shrink-0" />}
                  {!collapsed && <span className="truncate">{t(i.labelKey)}</span>}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {!drillIn && <div className="flex-1" />}

      {/* Rodapé — conta (AuthButton = fonte única de usuário+créditos+menu) +
          barra de utilidades num ÚNICO bloco/borda. Configurações vira ícone
          (icon-only), sempre presente (não some com a rota — feedback "perfil
          sumindo"), e também vive dentro do menu do AuthButton. */}
      {collapsed ? (
        <div className="p-2 border-t border-sidebar-border flex flex-col items-center gap-1">
          {/* Avatar → expande o rail pra alcançar créditos/menu */}
          <button
            onClick={toggleCollapsed}
            aria-label={t('nav.expand')}
            title={user?.name || t('nav.expand')}
            className={iconBtn}
          >
            {user?.picture ? (
              <img src={user.picture} alt="" className="w-5 h-5 rounded-[4px]" />
            ) : (
              <UserIcon size={15} />
            )}
          </button>
          <button
            onClick={() => go('/profile?tab=configuration')}
            aria-label={t('nav.settings')}
            title={t('nav.settings')}
            className={iconBtn}
          >
            <Settings size={15} />
          </button>
          <AppShellLegalMenu openUp />
          <button
            onClick={toggleCollapsed}
            aria-label="expand sidebar"
            title={t('nav.expand')}
            className={iconBtn}
          >
            <PanelLeftOpen size={15} />
          </button>
        </div>
      ) : (
        <div className="mt-1 border-t border-sidebar-border p-2 space-y-1.5">
          <AuthButton
            subscriptionStatus={subscriptionStatus}
            onCreditsClick={() => onCreditPackagesModalOpen()}
            menuPlacement="top"
          />
          {/* Utilidades icon-only — Configurações · Legal · Colapsar */}
          <div className="flex items-center justify-end gap-0.5">
            <button
              onClick={() => go('/profile?tab=configuration')}
              aria-label={t('nav.settings')}
              title={t('nav.settings')}
              className={cn(
                iconBtn,
                location.pathname === '/profile' &&
                  'bg-sidebar-accent text-sidebar-accent-foreground'
              )}
            >
              <Settings size={15} />
            </button>
            <AppShellLegalMenu openUp />
            {!isMobile && (
              <button
                onClick={toggleCollapsed}
                aria-label="collapse sidebar"
                title={t('nav.collapse')}
                className={iconBtn}
              >
                <PanelLeftClose size={15} />
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};

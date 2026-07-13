import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutGrid, Sparkles, Check, SunMoon, Languages, ArrowUpRight } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { useTheme } from '@/hooks/useTheme';
import { useActiveBrand } from '@/contexts/ActiveBrandContext';
import { usePinnedNav } from '@/hooks/usePinnedNav';
import { useRecentCommands } from '@/hooks/useRecentCommands';
import { visibleSections, type NavCtx } from '@/config/navConfig';
import { FEATURE_COCKPIT, FEATURE_COPILOT } from '@/config/featureFlags';
import { appsService } from '@/services/appsService';
import { getLucideIcon } from '@/lib/ui/lucideIcon';
import { BrandAvatar } from '@/components/brand/BrandAvatar';

/** Item consumido pelo `CommandPalette` (mesma shape do componente). */
export interface ShellCommand {
  id: string;
  label: string;
  category: string;
  icon?: React.ReactNode;
  /** Acessório à direita (✓ na marca ativa, ↗ externo…). */
  trailing?: React.ReactNode;
  /** Some da busca (grupos de atalho: Recentes / Fixados). */
  hideOnSearch?: boolean;
  /** Drill-in page — se presente, selecionar abre uma sub-lista em vez de agir. */
  children?: ShellCommand[];
  onClick?: () => void;
}

/**
 * Comandos do Cmd+K do AppShell, montados a partir do SSoT `navConfig` (destinos)
 * + catálogo de apps + marcas + ações. Camadas: **Recentes** (MRU) e **Fixados**
 * (`usePinnedNav`) no topo, depois navegação, "Trocar marca" como drill-in, e
 * **Ações** (tema/idioma/agentes). Cada leaf grava no MRU ao ser executado. O
 * palette continua sem hardcodar destino nenhum.
 */
export function useShellCommands(): ShellCommand[] {
  const { t, locale, setLocale } = useTranslation();
  const navigate = useNavigate();
  const { user } = useLayout();
  const { toggleTheme } = useTheme();
  const { brands, activeBrand, activeBrandId, setActiveBrand } = useActiveBrand();
  const { items: pinned } = usePinnedNav();
  const { ids: recentIds, record } = useRecentCommands();

  const activeBrandName = activeBrand?.identity?.name || activeBrand?.name || '';
  const isElevated = !!user?.isAdmin || user?.userCategory === 'tester';

  const { data: apps = [] } = useQuery({
    queryKey: ['apps'],
    queryFn: () => appsService.getAll(),
    staleTime: 5 * 60_000,
  });

  return useMemo(() => {
    const go = (to: string) => () => {
      if (/^https?:\/\//.test(to)) window.open(to, '_blank', 'noopener,noreferrer');
      else navigate(to);
    };
    /** Envolve a ação p/ gravar no MRU antes de executar. */
    const act = (id: string, fn: () => void) => () => {
      record(id);
      fn();
    };

    const ctx: NavCtx = {
      isAuthenticated: true,
      isElevated,
      flags: { cockpit: FEATURE_COCKPIT, copilot: FEATURE_COPILOT },
      activeBrandId,
    };

    const gotoLabel = t('command.goto') || 'Ir para';
    const appsLabel = t('command.apps') || 'Apps';
    const brandLabel = t('command.switchBrand') || 'Trocar marca';
    const actionsLabel = t('command.actions') || 'Ações';

    // ── Navegação ──────────────────────────────────────────────────────────
    const sectionCmds: ShellCommand[] = visibleSections(ctx).map((s) => {
      const Icon = s.icon;
      const id = `nav:${s.id}`;
      return {
        id,
        label: t(s.labelKey),
        category: gotoLabel,
        icon: <Icon className="h-4 w-4" />,
        onClick: act(id, go(s.to)),
      };
    });

    // ── Apps ───────────────────────────────────────────────────────────────
    const appCmds: ShellCommand[] = apps
      .filter((a) => !a.isHidden)
      .map((a) => {
        const Icon = getLucideIcon(a.icon) ?? LayoutGrid;
        const id = `app:${a.appId}`;
        const external = a.isExternal || /^https?:\/\//.test(a.link);
        return {
          id,
          label: a.name,
          category: appsLabel,
          icon: <Icon className="h-4 w-4" />,
          trailing: external ? (
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/60" />
          ) : undefined,
          onClick: act(id, go(a.link)),
        };
      });

    // ── Marcas — drill-in page ("Trocar marca →") ────────────────────────────
    const brandChildren: ShellCommand[] = brands.map((b) => {
      const id = `brand:${b.id}`;
      const isActive = !!b.id && b.id === activeBrandId;
      return {
        id,
        label: b.identity?.name || b.name || 'Brand',
        category: brandLabel,
        icon: <BrandAvatar brand={b} size={18} rounded="sm" />,
        trailing: isActive ? <Check className="h-3.5 w-3.5 text-brand-cyan" /> : undefined,
        // Trocar de marca NUNCA navega — só troca o contexto ativo (invariante
        // da AppSpine; mesmo comportamento do switcher no topo e do rail).
        onClick: act(id, () => {
          if (b.id) {
            setActiveBrand(b.id);
          }
        }),
      };
    });
    const brandCmds: ShellCommand[] =
      brandChildren.length > 0
        ? [
            {
              id: 'brands:switch',
              label: brandLabel,
              category: gotoLabel,
              icon: <BrandAvatar brand={activeBrand} size={18} rounded="sm" />,
              children: brandChildren,
            },
          ]
        : [];

    // ── Ações ────────────────────────────────────────────────────────────────
    const suffix = activeBrandName ? ` — ${activeBrandName}` : '';
    const agentCmds: ShellCommand[] =
      FEATURE_COPILOT && activeBrandName
        ? [
            { id: 'act:mockupKit', prompt: t('copilot.suggestions.mockupKit') },
            { id: 'act:seasonal', prompt: t('copilot.suggestions.seasonalCampaign') },
            { id: 'act:figma', prompt: t('copilot.suggestions.figmaPiece') },
          ]
            .filter((a) => a.prompt)
            .map((a) => ({
              id: a.id,
              label: `${a.prompt}${suffix}`,
              category: actionsLabel,
              icon: <Sparkles className="h-4 w-4" />,
              onClick: act(a.id, () =>
                navigate(`/copilot?prompt=${encodeURIComponent(a.prompt)}`)
              ),
            }))
        : [];

    const settingCmds: ShellCommand[] = [
      {
        id: 'act:theme',
        label: t('command.toggleTheme') || 'Trocar tema',
        category: actionsLabel,
        icon: <SunMoon className="h-4 w-4" />,
        onClick: act('act:theme', toggleTheme),
      },
      {
        id: 'act:lang',
        label: t('command.toggleLanguage') || 'Trocar idioma',
        category: actionsLabel,
        icon: <Languages className="h-4 w-4" />,
        trailing: (
          <span className="font-mono text-[10px] uppercase text-neutral-500">{locale}</span>
        ),
        onClick: act('act:lang', () => setLocale(locale === 'pt-BR' ? 'en-US' : 'pt-BR')),
      },
    ];

    const actionCmds = [...agentCmds, ...settingCmds];
    const base = [...sectionCmds, ...appCmds, ...brandCmds, ...actionCmds];

    // ── Recentes (MRU) + Fixados — atalhos no topo, escondem na busca ─────────
    const leafIndex = new Map<string, ShellCommand>();
    for (const c of [...sectionCmds, ...appCmds, ...brandChildren, ...actionCmds]) {
      leafIndex.set(c.id, c);
    }

    const recentLabel = t('command.recent') || 'Recentes';
    const recentCmds: ShellCommand[] = recentIds
      .map((id) => leafIndex.get(id))
      .filter((c): c is ShellCommand => !!c)
      .slice(0, 4)
      .map((c) => ({ ...c, id: `recent:${c.id}`, category: recentLabel, hideOnSearch: true }));

    const pinnedLabel = t('command.pinned') || 'Fixados';
    const pinnedCmds: ShellCommand[] = pinned.map((p) => {
      const Icon = p.type === 'app' ? getLucideIcon(p.icon) ?? LayoutGrid : undefined;
      return {
        id: `pinned:${p.type}:${p.id}`,
        label: p.label,
        category: pinnedLabel,
        icon: Icon ? (
          <Icon className="h-4 w-4" />
        ) : (
          <BrandAvatar brand={{ id: p.id, identity: { name: p.label } }} size={18} rounded="sm" />
        ),
        hideOnSearch: true,
        onClick: act(`pinned:${p.type}:${p.id}`, go(p.to)),
      };
    });

    return [...recentCmds, ...pinnedCmds, ...base];
  }, [
    t,
    locale,
    setLocale,
    navigate,
    apps,
    brands,
    activeBrand,
    isElevated,
    activeBrandId,
    activeBrandName,
    setActiveBrand,
    toggleTheme,
    pinned,
    recentIds,
    record,
  ]);
}

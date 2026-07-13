/**
 * AppSpine — a espinha contínua no topo do app, nos DOIS mundos.
 *
 * `variant="full"`  → topo dos dashboards (rail + conteúdo). Comportamento e
 *                     layout idênticos ao antigo AppTopBar (paridade de pixel).
 * `variant="focus"` → topo dos editores. Substitui o Header de marketing que era
 *                     parafusado por cima do editor. Casa a MESMA altura/posição
 *                     (`fixed`, h-10 md:h-14, z-50) do Header antigo, então os
 *                     offsets já afinados de cada editor (pt-10/14, top-10/14)
 *                     seguem válidos — swap like-for-like.
 *
 * Slots iguais nos dois: marca ativa (chip único, switcher SSoT), título,
 * portal de ações (ShellHeaderContext), busca Cmd+K e pílula de upgrade.
 * O "voltar" do focus vai pra seção de origem (ver editorOrigin).
 *
 * Plano: APP-SPINE-CONSOLIDATION.
 */
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, ChevronLeft, Command } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { useActiveBrandSafe } from '@/contexts/ActiveBrandContext';
import { classifyRoute, isBrandContext, isBrandScopedEditor, isBrandFilteredList } from '@/config/navConfig';
import { BrandSwitcher } from '@/components/cockpit/BrandSwitcher';
import { useShellHeader } from './ShellHeaderContext';
import { openCommandPalette } from '@/components/ui/CommandPalette';
import { getEditorOrigin } from './editorOrigin';
import { useBrandQuickSwitch } from '@/hooks/useBrandQuickSwitch';

interface AppSpineProps {
  variant: 'full' | 'focus';
  /** full: abre o drawer de navegação no mobile. */
  onMenuClick?: () => void;
  /** focus: nome do editor. Se ausente, derivado da rota. */
  title?: string;
}

// Títulos de editor por prefixo de rota (focus). Scaffolding do F1 — cada editor
// pode passar `title` explícito ao convergir (F2–F5). Fallback: humaniza a rota.
const FOCUS_TITLES: Record<string, string> = {
  '/create': 'Creative Studio',
  '/mockupmachine': 'Mockup Machine',
  '/content-studio': 'Content Studio',
  '/branding-machine': 'Branding Machine',
  '/branding-expert': 'Branding Expert',
  '/budget-machine': 'Budget',
  '/3d-studio': '3D Studio',
  '/image-lab': 'Image Lab',
  '/moodboard': 'Moodboard',
  '/grid-machine': 'Grid Machine',
  '/grid-paint': 'Grid Paint',
  '/playground': 'Playground',
  '/editor': 'Editor',
};

function deriveFocusTitle(pathname: string): string {
  const key = Object.keys(FOCUS_TITLES).find(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );
  if (key) return FOCUS_TITLES[key];
  const seg = pathname.split('/').filter(Boolean)[0] ?? '';
  return seg ? seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';
}

export const AppSpine: React.FC<AppSpineProps> = ({ variant, onMenuClick, title }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { subscriptionStatus, onSubscriptionModalOpen } = useLayout();
  const brand = useActiveBrandSafe();
  const shellHeader = useShellHeader();
  // Alt+B → alterna pra última marca (quick-switch; ver useBrandQuickSwitch).
  useBrandQuickSwitch();

  const isFocus = variant === 'focus';
  const isFree = !subscriptionStatus?.hasActiveSubscription;
  const hasBrands = (brand?.brands?.length ?? 0) > 0;

  // Marca: dashboard segue isBrandContext (produção vs. gestão); editor mostra
  // só quando opera sobre uma marca — utilitários (/qrcode…) não têm chip.
  const showBrand = isFocus
    ? isBrandScopedEditor(location.pathname) && hasBrands
    : isBrandContext(location.pathname) && hasBrands;

  const section = classifyRoute(location.pathname).section;
  const sectionLabel = section ? t(`nav.${section}.label`) : '';

  // "Todas as marcas" no switcher só nas listas filtráveis por marca (SSoT em
  // navConfig) — nelas o switcher É o filtro. Cockpit/editor não operam "sem marca".
  const showAllBrandsOption = isBrandFilteredList(location.pathname);

  // "Voltar" do editor → seção de origem (fallback /cockpit).
  const origin = getEditorOrigin();
  const backTo = origin?.path ?? '/cockpit';
  const backLabel = origin?.section
    ? t(`nav.${origin.section}.label`)
    : t('nav.cockpit.label');

  const focusTitle = title ?? deriveFocusTitle(location.pathname);

  const outerClass = isFocus
    ? 'fixed top-0 left-0 right-0 z-50 h-10 md:h-14 flex items-center justify-between px-4 border-b border-border bg-background'
    : 'h-12 shrink-0 flex items-center justify-between px-4 border-b border-border';

  return (
    <header className={outerClass}>
      <div className="flex items-center gap-2 text-sm min-w-0">
        {isFocus ? (
          <button
            onClick={() => navigate(backTo)}
            aria-label={t('nav.back') || 'Voltar'}
            className="flex items-center gap-1 -ml-1.5 p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ChevronLeft size={18} />
            <span className="hidden sm:inline text-xs">{backLabel}</span>
          </button>
        ) : (
          <button
            onClick={onMenuClick}
            aria-label="open navigation"
            className="md:hidden p-1.5 -ml-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Menu size={18} />
          </button>
        )}

        {showBrand && brand && (
          <>
            <BrandSwitcher
              brands={brand.brands}
              value={brand.activeBrandId}
              onChange={brand.setActiveBrand}
              showAllOption={showAllBrandsOption}
            />
            {(isFocus ? focusTitle : sectionLabel) && (
              <span className="text-muted-foreground/40">/</span>
            )}
          </>
        )}

        {isFocus
          ? focusTitle && (
              <span className="font-medium text-foreground truncate">{focusTitle}</span>
            )
          : sectionLabel && (
              <span className="text-muted-foreground truncate">{sectionLabel}</span>
            )}
      </div>

      <div className="flex items-center gap-2">
        {/* Buscar / Cmd+K — descobribilidade do palette global */}
        <button
          onClick={openCommandPalette}
          title={`${t('command.goto')} · Ctrl+K`}
          className="hidden sm:flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {/* Ícone de comando (não lupa) — o Cmd+K é navegação global, distinto
              do search de lista de cada página, que usa a lupa. */}
          <Command size={13} />
          <span className="hidden md:inline">{t('command.search') || 'Buscar'}</span>
          <kbd className="hidden md:inline font-mono text-[10px] px-1 py-0.5 rounded bg-background/60 border border-border">
            ⌘K
          </kbd>
        </button>

        {/* Ações da página/editor — teleportadas via portal (ShellHeaderContext).
            Universal: funciona no dashboard E no editor (F1 montou o provider
            também no branch focus do Layout). */}
        <div ref={shellHeader?.setActionsSlot} className={cn('flex items-center gap-2 empty:hidden')} />

        {isFree && (
          <button
            onClick={() => onSubscriptionModalOpen()}
            className="rounded-md px-3 py-1 text-xs font-medium bg-brand-cyan/90 text-black hover:bg-brand-cyan transition-colors"
          >
            {t('nav.upgrade')}
          </button>
        )}
      </div>
    </header>
  );
};

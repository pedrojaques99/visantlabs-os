/**
 * Top bar contextual do AppShell (plano APP-SHELL-REALIGNMENT, F1 / gap #6).
 * Montada dos primitivos existentes (sem novo componente de UI): breadcrumb
 * leve "marca / seção" à esquerda; pílula de créditos à direita reusando o
 * modal de créditos já provido pelo LayoutContext.
 */
import React from 'react';
import { useLocation } from 'react-router-dom';
import { Coins, Menu } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { useActiveBrandSafe } from '@/contexts/ActiveBrandContext';
import { classifyRoute } from '@/config/navConfig';

interface AppTopBarProps {
  /** Abre o drawer de navegação no mobile. */
  onMenuClick?: () => void;
}

export const AppTopBar: React.FC<AppTopBarProps> = ({ onMenuClick }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { subscriptionStatus, onCreditPackagesModalOpen } = useLayout();
  const brand = useActiveBrandSafe();

  const section = classifyRoute(location.pathname).section;
  const sectionLabel = section ? t(`nav.${section}.label`) : '';
  const brandName = brand?.activeBrand?.identity?.name || brand?.activeBrand?.name || '';
  const credits = subscriptionStatus?.creditsRemaining;

  return (
    <header className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border">
      <div className="flex items-center gap-2 text-sm min-w-0">
        <button
          onClick={onMenuClick}
          aria-label="open navigation"
          className="md:hidden p-1.5 -ml-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Menu size={18} />
        </button>
        {brandName && (
          <>
            <span className="text-foreground font-medium truncate">{brandName}</span>
            {sectionLabel && <span className="text-muted-foreground/40">/</span>}
          </>
        )}
        {sectionLabel && <span className="text-muted-foreground truncate">{sectionLabel}</span>}
      </div>
      <div className="flex items-center gap-2">
        {typeof credits === 'number' && (
          <button
            onClick={() => onCreditPackagesModalOpen()}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Coins size={13} />
            <span>{credits}</span>
          </button>
        )}
      </div>
    </header>
  );
};

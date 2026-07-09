/**
 * FocusRail (plano APP-SHELL-REALIGNMENT, F3).
 *
 * Navegação de app para rotas em modo `focus` (editores full-bleed: canvas,
 * mockupmachine, 3d-studio, image-lab, mini-tools). Em vez de embutir o rail
 * completo — que colidiria com os workspaces `fixed inset-0` dos editores —,
 * é um dock vertical flutuante, icon-only e não-intrusivo, à esquerda-centro.
 * Dá nav consistente (mesmos destinos do SSoT) sem roubar área do editor, e
 * permite sumir com o Header de marketing (fim do "parece site").
 */
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { FEATURE_COCKPIT, FEATURE_COPILOT } from '@/config/featureFlags';
import { classifyRoute, visibleSections, PROFILE_SECTION, type NavCtx } from '@/config/navConfig';

interface DockItemProps {
  icon: LucideIcon;
  label: string;
  to: string;
  active: boolean;
  onClick: (to: string) => void;
}

const DockItem: React.FC<DockItemProps> = ({ icon: Icon, label, to, active, onClick }) => (
  <button
    onClick={() => onClick(to)}
    title={label}
    aria-label={label}
    className={cn(
      'h-9 w-9 flex items-center justify-center rounded-lg transition-colors',
      active
        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
    )}
  >
    <Icon size={17} />
  </button>
);

export const FocusRail: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useLayout();

  const ctx: NavCtx = {
    isAuthenticated: true,
    isElevated: !!user?.isAdmin || user?.userCategory === 'tester',
    flags: { cockpit: FEATURE_COCKPIT, copilot: FEATURE_COPILOT },
    activeBrandId: null,
  };

  const activeSection = classifyRoute(location.pathname).section;
  const sections = visibleSections(ctx);
  const go = (to: string) => navigate(to);

  return (
    <div className="hidden md:flex fixed left-2 top-1/2 -translate-y-1/2 z-40 flex-col items-center gap-1 p-1.5 rounded-2xl border border-sidebar-border bg-sidebar/90 backdrop-blur-md shadow-lg">
      {sections.map((s) => (
        <DockItem
          key={s.id}
          icon={s.icon}
          label={t(s.labelKey)}
          to={s.to}
          active={activeSection === s.id}
          onClick={go}
        />
      ))}
      <div className="h-px w-6 bg-sidebar-border my-0.5" />
      <DockItem
        icon={PROFILE_SECTION.icon}
        label={t(PROFILE_SECTION.labelKey)}
        to={PROFILE_SECTION.to}
        active={activeSection === 'profile'}
        onClick={go}
      />
    </div>
  );
};

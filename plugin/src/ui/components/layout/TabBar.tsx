import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { usePluginStore } from '../../store';
import { TAB_VIEWS, type TabView } from '../../store/types';
// The plugin stays on lucide-react — the Phosphor barrel is the app's, not this bundle's.
import { Palette, MessageSquare, LayoutGrid, User as UserIcon } from 'lucide-react';

const TAB_ICON: Record<TabView, React.ComponentType<{ size?: number }>> = {
  brand: Palette,
  main: MessageSquare,
  tools: LayoutGrid,
  profile: UserIcon,
};

const TAB_LABEL: Record<TabView, string> = {
  brand: 'plugin.nav.brand',
  main: 'plugin.nav.chat',
  tools: 'plugin.nav.tools',
  profile: 'plugin.nav.profile',
};

/**
 * The four destinations, in the product's hierarchy: brand → chat → tools → user.
 *
 * Navigation informs, it doesn't ask for attention: the active tab is carried by type weight
 * and a dot, never by a colored icon. Cyan stays reserved for primary CTAs and selection.
 */
export function TabBar() {
  const { t } = useTranslation();
  const activeView = usePluginStore((s) => s.activeView);
  const setActiveView = usePluginStore((s) => s.setActiveView);

  // Chat history is a chat concern, not a fifth destination — keep Chat lit while it's open.
  const current: TabView = activeView === 'sessions' ? 'main' : (activeView as TabView);

  return (
    <nav
      className="shrink-0 border-t border-border bg-card flex items-stretch"
      aria-label={t('plugin.nav.label')}
    >
      {TAB_VIEWS.map((view) => {
        const Icon = TAB_ICON[view];
        const isActive = current === view;
        return (
          <button
            key={view}
            type="button"
            onClick={() => setActiveView(view)}
            aria-current={isActive ? 'page' : undefined}
            className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
              isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon size={16} />
            <span
              className={`text-[10px] leading-none ${isActive ? 'font-semibold' : 'font-normal'}`}
            >
              {t(TAB_LABEL[view])}
            </span>
            {isActive && (
              <span className="absolute top-0 h-[2px] w-6 rounded-full bg-foreground" aria-hidden />
            )}
          </button>
        );
      })}
    </nav>
  );
}

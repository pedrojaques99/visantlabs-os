import React, { useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { usePluginStore } from '../../store';
import { useServerStatus } from '../../hooks/useServerStatus';
import { Button } from '@/components/ui/button';
import { Minimize2 } from 'lucide-react';
import type { ActiveView } from '../../store/types';

const VIEW_TITLE: Record<ActiveView, string> = {
  brand: 'plugin.nav.brand',
  main: 'plugin.nav.chat',
  tools: 'plugin.nav.tools',
  profile: 'plugin.nav.profile',
  sessions: 'plugin.sessions.title',
};

/**
 * Says where you are and lets you collapse. Navigation moved to the TabBar, chat history to
 * the chat, and credits to the profile tab — the header used to carry all three and direct
 * nobody.
 */
export function Header() {
  const { t } = useTranslation();
  const activeView = usePluginStore((s) => s.activeView);
  const setCollapsed = usePluginStore((s) => s.setCollapsed);
  const devMode = usePluginStore((s) => s.devMode);
  const { isConnected } = useServerStatus();

  const collapse = useCallback(() => {
    setCollapsed(true);
    parent.postMessage({ pluginMessage: { type: 'COLLAPSE_WINDOW' } }, '*');
  }, [setCollapsed]);

  return (
    <header className="shrink-0 border-b border-border bg-card px-4 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-2 min-h-[28px]">
        {/* Only surface the status dot when the server is DOWN — silent when healthy. */}
        {isConnected === false && (
          <div
            className="w-2 h-2 rounded-full shrink-0 bg-destructive"
            role="status"
            aria-label={t('plugin.header.serverDisconnected')}
            title={t('plugin.header.serverDisconnected')}
          />
        )}
        <h1 className="text-sm font-semibold text-foreground">{t(VIEW_TITLE[activeView])}</h1>
        {devMode && (
          <span className="text-[9px] font-mono font-bold tracking-wide text-muted-foreground border border-border rounded px-1 py-0.5">
            DEV
          </span>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={collapse}
        className="h-7 w-7 hover:bg-muted"
        title={t('plugin.header.collapse')}
        aria-label={t('plugin.header.collapsePanel')}
      >
        <Minimize2 size={14} className="text-muted-foreground" />
      </Button>
    </header>
  );
}

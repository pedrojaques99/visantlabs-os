import React, { useEffect } from 'react';
import { usePluginStore } from './store';
import { useFigmaMessages } from './hooks/useFigmaMessages';
import { useAuth } from './hooks/useAuth';
import { useIllustratorExport } from './hooks/useIllustratorExport';
import { usePluginOpsChannel } from './hooks/usePluginOpsChannel';
import { useClient } from './lib/ClientProvider';
import { AppShell } from './components/layout/AppShell';
import { loadChatHistory, setChatPersistClient } from './store';
import { setStoredLocale, type Locale } from '@/utils/localeUtils';

export function App() {
  const setServerUrl = usePluginStore((s) => s.setServerUrl);
  const { send } = useFigmaMessages();
  const { checkStatus } = useAuth();
  const client = useClient();
  useIllustratorExport();
  usePluginOpsChannel(); // HTTP ops channel: external agent → this open plugin

  useEffect(() => {
    setChatPersistClient(client);

    const init = async () => {
      const [serverUrlResult, , , localeResult] = await Promise.allSettled([
        client.request('storage.get', { key: 'serverUrl' }),
        checkStatus(),
        loadChatHistory(client),
        client.request('storage.get', { key: 'locale' }),
      ]);

      if (serverUrlResult.status === 'fulfilled' && serverUrlResult.value?.value) {
        setServerUrl(serverUrlResult.value.value as string);
      }

      // The Figma sandbox localStorage is memory-only, so the user's language
      // preference is persisted via clientStorage and rehydrated here on launch.
      if (localeResult.status === 'fulfilled') {
        const stored = localeResult.value?.value as Locale | undefined;
        if (stored === 'en-US' || stored === 'pt-BR') {
          setStoredLocale(stored);
          window.dispatchEvent(new CustomEvent('localechange', { detail: stored }));
        }
      }

      send({ type: 'GET_CONTEXT' } as any);
      send({ type: 'GET_BRAND_GUIDELINE' } as any);
    };

    init();
  }, []);

  // Guidelines are loaded on-demand by BrandGuidelineSection via the API
  // (single source of truth). The legacy pluginData path (GET_GUIDELINES)
  // is kept only for offline/cache fallback inside the sandbox.

  return <AppShell />;
}

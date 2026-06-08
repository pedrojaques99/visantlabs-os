import React, { useEffect } from 'react';
import { usePluginStore } from './store';
import { useFigmaMessages } from './hooks/useFigmaMessages';
import { useAuth } from './hooks/useAuth';
import { useIllustratorExport } from './hooks/useIllustratorExport';
import { useClient } from './lib/ClientProvider';
import { AppShell } from './components/layout/AppShell';
import { loadChatHistory, setChatPersistClient } from './store';

export function App() {
  const setServerUrl = usePluginStore((s) => s.setServerUrl);
  const { send } = useFigmaMessages();
  const { checkStatus } = useAuth();
  const client = useClient();
  useIllustratorExport();

  useEffect(() => {
    setChatPersistClient(client);

    const init = async () => {
      const [serverUrlResult] = await Promise.allSettled([
        client.request('storage.get', { key: 'serverUrl' }),
        checkStatus(),
        loadChatHistory(client),
      ]);

      if (serverUrlResult.status === 'fulfilled' && serverUrlResult.value?.value) {
        setServerUrl(serverUrlResult.value.value as string);
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

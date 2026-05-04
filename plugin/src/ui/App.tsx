import React, { useEffect } from 'react';
import { usePluginStore } from './store';
import { useFigmaMessages } from './hooks/useFigmaMessages';
import { useAuth } from './hooks/useAuth';
import { useIllustratorExport } from './hooks/useIllustratorExport';
import { useClient } from './lib/ClientProvider';
import { AppShell } from './components/layout/AppShell';

export function App() {
  const { activeView, authToken } = usePluginStore();
  const setServerUrl = usePluginStore((s) => s.setServerUrl);
  const { send } = useFigmaMessages();
  const { checkStatus } = useAuth();
  const client = useClient();
  useIllustratorExport();

  useEffect(() => {
    const init = async () => {
      const [serverUrlResult] = await Promise.allSettled([
        client.request('storage.get', { key: 'serverUrl' }),
        checkStatus(),
      ]);

      if (serverUrlResult.status === 'fulfilled' && serverUrlResult.value?.value) {
        setServerUrl(serverUrlResult.value.value as string);
      }

      send({ type: 'GET_CONTEXT' } as any);
    };

    init();
  }, []);

  // Load guidelines after auth is checked and available
  useEffect(() => {
    if (authToken) {
      send({ type: 'GET_GUIDELINES' } as any);
    }
  }, [authToken, send]);

  return <AppShell />;
}

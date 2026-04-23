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
      // wait 100ms para deixar useFigmaMessages setup
      await new Promise((r) => setTimeout(r, 100));

      // Load persisted server URL before auth check
      try {
        const { value } = await client.request('storage.get', { key: 'serverUrl' });
        if (value) setServerUrl(value);
      } catch { /* fall back to build-time default */ }

      // 1. Check auth status (includes loading saved token from sandbox)
      await checkStatus();

      // 2. Request initial context from sandbox
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

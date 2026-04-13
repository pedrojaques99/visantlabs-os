import React, { useEffect } from 'react';
import { usePluginStore } from './store';
import { useFigmaMessages } from './hooks/useFigmaMessages';
import { useAuth } from './hooks/useAuth';
import { AppShell } from './components/layout/AppShell';

export function App() {
  const { activeView, authToken } = usePluginStore();
  const { send } = useFigmaMessages();
  const { checkStatus } = useAuth();

  useEffect(() => {
    // Initialize on mount
    const init = async () => {
      // 1. Check auth status (includes loading saved token from sandbox)
      // wait 100ms para deixar useFigmaMessages setup
      await new Promise((r) => setTimeout(r, 100));
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

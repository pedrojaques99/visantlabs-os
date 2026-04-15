import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { createClient, type Client } from './client';
import { API_BASE_URL } from '../config';
import { usePluginStore } from '../store';

const ClientCtx = createContext<Client | null>(null);

export function ClientProvider({ children }: { children: ReactNode }) {
  const client = useMemo(
    () => createClient({
      baseUrl: API_BASE_URL,
      getToken: () => usePluginStore.getState().authToken,
      getBrandId: () => (usePluginStore.getState() as any).activeBrandId ?? null,
      onUnauthorized: () => usePluginStore.setState({ authToken: null, authEmail: null } as any),
    }),
    []
  );

  useEffect(() => () => client.dispose(), [client]);

  // Recebe telemetria do sandbox via postMessage (TELEMETRY_BATCH) e encaminha para o server
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      const data = (ev.data as any)?.pluginMessage ?? ev.data;
      if (data?.type === 'TELEMETRY_BATCH' && Array.isArray(data.entries)) {
        void client.reportTelemetry(data.entries);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [client]);

  return <ClientCtx.Provider value={client}>{children}</ClientCtx.Provider>;
}

export function useClient(): Client {
  const c = useContext(ClientCtx);
  if (!c) throw new Error('useClient must be used inside <ClientProvider>');
  return c;
}

import { useCallback, useRef } from 'react';
import { usePluginStore } from '../store';

export function useApi() {
  const abortControllerRef = useRef<AbortController | null>(null);
  const { authToken } = usePluginStore();

  const call = useCallback(
    async (endpoint: string, options: RequestInit = {}) => {
      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers
      };

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      try {
        const response = await fetch(endpoint, {
          ...options,
          headers,
          signal: abortControllerRef.current.signal
        });

        if (response.status === 401 || response.status === 403) {
          usePluginStore.setState({ authToken: null, authEmail: null });
          throw new Error('Unauthorized');
        }

        if (response.status === 429) {
          throw new Error('Too many requests. Please try again later.');
        }

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }

        return await response.json();
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          throw err;
        }
        return null;
      }
    },
    [authToken]
  );

  return { call };
}

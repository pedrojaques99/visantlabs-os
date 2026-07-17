import { useCallback, useRef } from 'react';
import { usePluginStore } from '../store';
import { apiUrl } from '../config';

export interface CallOptions {
  /**
   * Cancel this hook instance's previous in-flight call before starting.
   *
   * Only for last-one-wins reads — search-as-you-type, filter changes. It used to be the
   * unconditional default, which meant any two concurrent calls from one component killed
   * each other: a debounced library search would abort an upload that the server had already
   * accepted and charged credits for, and the client would report "0 saved". Cancelling a
   * mutation is never what the caller wanted, so it has to be asked for.
   */
  abortPrevious?: boolean;
  /**
   * Fail after N ms instead of waiting forever. `fetch` has no timeout of its own, so a
   * dropped connection on a long request leaves the caller's spinner up for good.
   */
  timeoutMs?: number;
}

/** Thrown on `timeoutMs`, so callers can tell "too slow" from "superseded" (which is null). */
export class ApiTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = 'ApiTimeoutError';
  }
}

export function useApi() {
  const supersedableRef = useRef<AbortController | null>(null);
  const { authToken } = usePluginStore();

  const call = useCallback(
    async (endpoint: string, options: RequestInit = {}, callOptions: CallOptions = {}) => {
      const { abortPrevious = false, timeoutMs } = callOptions;

      if (abortPrevious) {
        supersedableRef.current?.abort();
      }

      const controller = new AbortController();
      // Only supersedable calls are tracked — a mutation must not become the thing the
      // next search cancels.
      if (abortPrevious) supersedableRef.current = controller;

      let timedOut = false;
      const timer =
        timeoutMs && timeoutMs > 0
          ? setTimeout(() => {
              timedOut = true;
              controller.abort();
            }, timeoutMs)
          : undefined;

      const headers = new Headers(options.headers);
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      if (authToken) {
        headers.set('Authorization', `Bearer ${authToken}`);
      }

      try {
        // Convert relative API paths to full URLs
        const url = endpoint.startsWith('http') ? endpoint : apiUrl(endpoint.replace(/^\/api/, ''));

        const response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
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
        if ((err as Error).name === 'AbortError') {
          // A timeout is a real failure and must reach the caller; being superseded by a
          // newer call is not, and stays the historical `null`.
          if (timedOut) throw new ApiTimeoutError(timeoutMs!);
          return null;
        }
        throw err;
      } finally {
        if (timer) clearTimeout(timer);
        if (supersedableRef.current === controller) supersedableRef.current = null;
      }
    },
    [authToken]
  );

  return { call };
}

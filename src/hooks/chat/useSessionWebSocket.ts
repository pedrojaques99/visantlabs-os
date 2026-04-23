import { useEffect, useRef } from 'react';
import { authService } from '@/services/authService';

/** Events emitted by the server chat WS (see server/routes/adminChat.ts). */
export type SessionWsEvent =
  | { type: 'READY'; sessionId: string }
  | { type: 'MESSAGE'; payload: any }
  | { type: 'TOOL_CALL_START'; payload: any }
  | { type: 'TOOL_CALL_END'; payload: any }
  | { type: 'APPROVAL_REQUIRED'; payload: any }
  | { type: 'APPROVAL_RESOLVED'; payload: any }
  | { type: 'CREATIVE_PLAN_PROPOSED'; payload: any }
  | { type: 'FIGMA_OPS_QUEUED'; payload: any }
  | { type: 'FIGMA_OPS_APPLIED'; payload: any };

interface Options {
  /** WS path relative to the API base, e.g. `/admin-chat/ws`. */
  path: string;
  sessionId: string | null | undefined;
  onEvent: (ev: SessionWsEvent) => void;
  /** Default: true. Set false to skip connection without unmounting the hook. */
  enabled?: boolean;
}

function buildWsUrl(path: string, token: string, sessionId: string): string {
  const apiBase = (import.meta as any).env?.VITE_API_URL || '/api';
  const wsBase = apiBase.startsWith('http')
    ? apiBase.replace(/^http/, 'ws')
    : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${apiBase}`;
  return `${wsBase}${path}?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sessionId)}`;
}

/**
 * JWT-authenticated WebSocket for a chat session. Auto-reconnects when
 * `sessionId` changes, closes on unmount, swallows parse/transport errors
 * (HTTP still works as graceful fallback).
 *
 * Keeps the handler in a ref so callers can pass inline closures without
 * re-opening the socket on every render.
 */
export function useSessionWebSocket({ path, sessionId, onEvent, enabled = true }: Options) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef(onEvent);

  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled || !sessionId) return;
    const token = authService.getToken();
    if (!token) return;

    const ws = new WebSocket(buildWsUrl(path, token, sessionId));
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && typeof data === 'object' && data.type) {
          handlerRef.current(data as SessionWsEvent);
        }
      } catch {
        // malformed frame — ignore
      }
    };

    ws.onerror = () => {
      // silent; HTTP fallback keeps the feature working
    };

    return () => {
      try { ws.close(); } catch {}
      wsRef.current = null;
    };
  }, [path, sessionId, enabled]);

  return wsRef;
}

import { useCallback, useEffect } from 'react';
import type { UIMessage, PluginMessage } from '@/lib/figma-types';

export function useFigmaBridge(onMessage: (msg: PluginMessage) => void) {
  const send = useCallback((msg: UIMessage) => {
    if (typeof parent !== 'undefined') {
      parent.postMessage({ pluginMessage: msg }, 'https://www.figma.com');
    }
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as PluginMessage | undefined;
      if (msg) {
        onMessage(msg);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onMessage]);

  return { send };
}

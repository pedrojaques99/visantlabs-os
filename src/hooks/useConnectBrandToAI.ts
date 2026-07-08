import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';

/**
 * Mint do link de conexão MCP ("Connect to AI") — SSoT extracted from
 * `PublicBrandGuideline.handleConnect` (plano Revenue-Centric §4.4) so the
 * brand view and the home cockpit share the same flow. Redirects into the
 * existing `/connect/:token` ConnectPage; brands that aren't public yet call
 * `onMissingSlug` (e.g. open the Share dialog) instead of dying silently.
 */
export function useConnectBrandToAI() {
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(
    async (publicSlug: string | null | undefined, onMissingSlug?: () => void) => {
      if (!publicSlug) {
        toast.error('Make the brand public first to connect it');
        onMissingSlug?.();
        return;
      }
      setConnecting(true);
      try {
        const { connectUrl } = await brandGuidelineApi.getPublicConnectLink(publicSlug);
        window.location.href = connectUrl;
      } catch {
        toast.error('Failed to generate connect link');
        setConnecting(false);
      }
    },
    []
  );

  return { connecting, connect };
}

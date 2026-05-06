import { useCallback, useRef } from 'react';
import { usePluginStore } from '../store';
import { useFigmaMessages } from './useFigmaMessages';
import type { UIMessage } from '@/lib/figma-types';
import { parseMentions } from './useMentions';

export function useChatSend() {
  const { send } = useFigmaMessages();
  const isSendingRef = useRef(false);
  const store = usePluginStore();

  const sendMessage = useCallback(
    async (content: string) => {
      if (isSendingRef.current || !content.trim()) return;

      isSendingRef.current = true;

      // Add user message to history
      const userMessage = {
        id: `msg-${Date.now()}`,
        role: 'user' as const,
        content,
        timestamp: Date.now(),
        attachments: store.pendingAttachments.slice()
      };

      store.addChatMessage(userMessage);
      store.setIsGenerating(true);

      try {
        // Map brand data from store to expected payload format
        const typo = store.typography;
        const brandFonts = (typo.length > 0) ? {
          primary: typo.find(t => t.name === 'primary') ? {
            family: typo.find(t => t.name === 'primary')!.fontFamily,
            style: typo.find(t => t.name === 'primary')!.fontStyle,
            size: typo.find(t => t.name === 'primary')!.fontSize,
          } : undefined,
          secondary: typo.find(t => t.name === 'secondary') ? {
            family: typo.find(t => t.name === 'secondary')!.fontFamily,
            style: typo.find(t => t.name === 'secondary')!.fontStyle,
            size: typo.find(t => t.name === 'secondary')!.fontSize,
          } : undefined,
        } : null;

        const logos = store.logos;
        const brandLogos = logos.length > 0 ? {
          light: logos.find(l => l.name === 'light') ? { name: logos.find(l => l.name === 'light')!.label || 'Logo Light', key: logos.find(l => l.name === 'light')!.figmaKey } : undefined,
          dark: logos.find(l => l.name === 'dark') ? { name: logos.find(l => l.name === 'dark')!.label || 'Logo Dark', key: logos.find(l => l.name === 'dark')!.figmaKey } : undefined,
        } : null;

        const brandColors = store.selectedColors.size > 0
          ? Array.from(store.selectedColors.entries()).map(([role, entry]) => ({ name: entry.name || role, value: entry.hex, role }))
          : null;

        const mentions = parseMentions(content);

        const serverAttachments = store.pendingAttachments
          .filter((a) => a.preview)
          .map((a) => {
            const match = a.preview!.match(/^data:([^;]+);base64,(.+)$/);
            return match
              ? { name: a.name, mimeType: match[1], data: match[2] }
              : null;
          })
          .filter(Boolean);

        // Send message to sandbox with context
        const msg: any = {
          type: 'GENERATE_WITH_CONTEXT',
          command: content,
          thinkMode: store.thinkMode,
          useBrand: store.useBrand,
          attachments: serverAttachments,
          model: store.selectedModel,
          brandFonts,
          brandLogos,
          brandColors,
          designSystem: store.designSystem,
          mentions,
        };

        send(msg);

        // Clear pending attachments
        usePluginStore.setState({ pendingAttachments: [] });
      } catch (err) {
        console.error('Failed to send message:', err);
        store.showToast('Failed to send message', 'error');
      } finally {
        isSendingRef.current = false;
      }
    },
    [send, store]
  );

  return { sendMessage, isSending: isSendingRef.current };
}

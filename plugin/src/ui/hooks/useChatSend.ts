import { useCallback, useRef } from 'react';
import { usePluginStore } from '../store';
import { useFigmaMessages } from './useFigmaMessages';
import type { UIMessage } from '@/lib/figma-types';

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
        // Send message to sandbox with context
        const msg: any = {
          type: 'GENERATE_WITH_CONTEXT',
          command: content,
          thinkMode: store.thinkMode,
          useBrand: store.useBrand,
          attachments: store.pendingAttachments,
          model: store.selectedModel
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

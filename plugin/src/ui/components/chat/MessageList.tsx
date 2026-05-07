import React, { useCallback } from 'react';
import { MessageBubble } from './MessageBubble';
import { usePluginStore } from '../../store';
import type { ChatMessage } from '../../store/types';

interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  const lastAssistantIdx = messages.reduce((acc, m, i) => (m.role === 'assistant' ? i : acc), -1);

  const handleUndo = useCallback(() => {
    parent.postMessage(
      { pluginMessage: { type: 'UNDO_LAST_BATCH' } },
      'https://www.figma.com',
    );
    usePluginStore.getState().showToast('Undoing last operation…', 'info');
  }, []);

  const handleRetry = useCallback(() => {
    const history = usePluginStore.getState().chatHistory;
    const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant');
    const lastUser = [...history].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;

    // Remove last assistant message
    if (lastAssistant) {
      usePluginStore.setState((s) => ({
        chatHistory: s.chatHistory.filter((m) => m.id !== lastAssistant.id),
      }));
    }

    // Re-send user message via sandbox
    parent.postMessage(
      { pluginMessage: { type: 'GENERATE_WITH_CONTEXT', command: lastUser.content } },
      'https://www.figma.com',
    );
    usePluginStore.getState().setIsGenerating(true);
    usePluginStore.getState().showToast('Retrying…', 'info');
  }, []);

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-center">
        <div className="max-w-xs">
          <p className="text-muted-foreground text-sm">No messages yet. Start by describing what you want to create.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((message, i) => (
        <MessageBubble
          key={message.id}
          message={message}
          isLast={i === lastAssistantIdx}
          onUndo={handleUndo}
          onRetry={handleRetry}
        />
      ))}
    </div>
  );
}

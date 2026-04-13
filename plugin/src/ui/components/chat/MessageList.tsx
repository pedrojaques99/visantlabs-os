import React from 'react';
import { MessageBubble } from './MessageBubble';
import type { ChatMessage } from '../../store/types';

interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
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
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  );
}

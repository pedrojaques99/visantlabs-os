import React from 'react';
import type { ChatMessage } from '../../store/types';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
          isUser ? 'bg-brand-cyan text-black' : 'bg-card border border-border text-foreground'
        }`}
      >
        {message.thinking && (
          <div className="text-xs text-muted-foreground mb-2">
            <details>
              <summary>Thinking...</summary>
              <pre className="text-[10px] mt-1 overflow-auto max-h-24">{message.thinking}</pre>
            </details>
          </div>
        )}
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 text-xs opacity-75">
            {message.attachments.length} attachment{message.attachments.length > 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useRef, useEffect } from 'react';
import { usePluginStore } from '../../store';
import { useChatSend } from '../../hooks/useChatSend';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { Sparkles } from 'lucide-react';

export function ChatView() {
  const { chatHistory } = usePluginStore();
  const { sendMessage } = useChatSend();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isGenerating = usePluginStore(s => s.isGenerating);

  useEffect(() => {
    // Auto-scroll to bottom
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 50);
    }
  }, [chatHistory]);

  return (
    <div className="flex flex-col h-full bg-background">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatHistory.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-xs space-y-3">
              <p className="text-sm text-muted-foreground">
                Descreva o que deseja criar e o Visant Copilot irá gerar designs no Figma.
              </p>
            </div>
          </div>
        ) : (
          <>
            <MessageList messages={chatHistory} />
            {isGenerating && <TypingIndicator />}
          </>
        )}
      </div>
      <ChatInput onSend={sendMessage} />
    </div>
  );
}

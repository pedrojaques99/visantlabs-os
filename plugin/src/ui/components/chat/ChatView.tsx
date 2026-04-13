import React, { useRef, useEffect } from 'react';
import { usePluginStore } from '../../store';
import { useChatSend } from '../../hooks/useChatSend';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';

export function ChatView() {
  const { chatHistory } = usePluginStore();
  const { sendMessage } = useChatSend();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isLoading = chatHistory.length > 0 && chatHistory[chatHistory.length - 1]?.role === 'user';

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
              <div className="w-12 h-12 rounded-full bg-brand-cyan/10 flex items-center justify-center mx-auto">
                <span className="text-xl">✨</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Descreva o que deseja criar e o Visant Copilot irá gerar designs no Figma.
              </p>
              <p className="text-xs text-muted-foreground/60">
                Use as opções acima para ativar Think Mode, Brand Guidelines e Page Scan.
              </p>
            </div>
          </div>
        ) : (
          <>
            <MessageList messages={chatHistory} />
            {isLoading && <TypingIndicator />}
          </>
        )}
      </div>
      <ChatInput onSend={sendMessage} />
    </div>
  );
}

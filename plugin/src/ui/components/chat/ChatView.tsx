import React, { useRef, useEffect } from 'react';
import { usePluginStore } from '../../store';
import { useChatSend } from '../../hooks/useChatSend';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { Layers } from 'lucide-react';

export function ChatView() {
  const { chatHistory, selectionDetails } = usePluginStore();
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
      {selectionDetails.length > 0 && (
        <div className="px-3 py-1.5 border-t border-border/50 bg-muted/30 flex items-center gap-1.5 flex-wrap">
          <Layers size={10} className="text-muted-foreground shrink-0" />
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">{selectionDetails.length} frame{selectionDetails.length > 1 ? 's' : ''}:</span>
          {selectionDetails.map((f) => (
            <span key={f.id} className="text-[10px] font-mono bg-background border border-border/60 rounded px-1 py-0.5 text-foreground/70 truncate max-w-[90px]" title={`${f.id} · ${f.name}`}>{f.name}</span>
          ))}
        </div>
      )}
      <ChatInput onSend={sendMessage} />
    </div>
  );
}
